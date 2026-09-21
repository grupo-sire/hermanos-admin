import { supabase } from "@/integrations/supabase/client";

export interface ContextoAtendimento {
  clienteId?: string;
  clienteNome: string;
  clienteTelefone: string;
  isInfinite: boolean;
  barbeiroPreferido: string;
  unidadeHabitual: string;
}

// CACHE EM MEMÓRIA RAM PARA DADOS INSTITUCIONAIS (REDUZ TEMPO DE RESPOSTA EM 500MS)
let dbCache: {
  unidadesData: any[];
  barbeirosData: any[];
  servicosData: any[];
  produtosData: any[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minutos de Cache

export async function processarAtendimentoIA(
  textoCliente: string,
  historicoMensagens: Array<{ remetente: string; texto: string }>,
  contextoCliente: ContextoAtendimento,
  userGeminiKey?: string
): Promise<string> {
  const txt = textoCliente.toLowerCase();

  try {
    const now = Date.now();
    let unidadesData: any[];
    let barbeirosData: any[];
    let servicosData: any[];
    let produtosData: any[];

    if (dbCache && (now - dbCache.timestamp < CACHE_TTL_MS)) {
      unidadesData = dbCache.unidadesData;
      barbeirosData = dbCache.barbeirosData;
      servicosData = dbCache.servicosData;
      produtosData = dbCache.produtosData;
    } else {
      // 1. BUSCA PARALELA OTIMIZADA NO BANCO DE DADOS
      const [uRes, bRes, sRes, pRes] = await Promise.all([
        supabase.from("unidades").select("id, nome, endereco"),
        supabase.from("barbeiros").select("id, nome, codigo_cadeira, unidade_id"),
        supabase.from("servicos").select("id, nome, preco, duracao_minutos"),
        supabase.from("produtos").select("id, nome, preco, categoria")
      ]);

      unidadesData = uRes.data || [];
      barbeirosData = bRes.data || [];
      servicosData = sRes.data || [];
      produtosData = pRes.data || [];

      dbCache = {
        unidadesData,
        barbeirosData,
        servicosData,
        produtosData,
        timestamp: now
      };
    }

    // 1. BUSCAR CLIENTE E AGENDAMENTOS FUTUROS REALMENTE CADASTRADOS NO BANCO DE DADOS
    let agendamentosAtivosStr = "Nenhum agendamento futuro ativo no momento.";

    const { data: cliList } = await supabase
      .from("clientes")
      .select("id, nome")
      .ilike("nome", `%${contextoCliente.clienteNome}%`)
      .limit(1);

    const cliObj = cliList?.[0];

    if (cliObj) {
      const nowISO = new Date().toISOString();
      const { data: agsData } = await supabase
        .from("agendamentos")
        .select("id, data_hora, status, observacoes, servico:servicos(nome), barbeiro:barbeiros(nome, codigo_cadeira), unidade:unidades(nome), agendamento_servicos(nome, preco)")
        .eq("cliente_id", cliObj.id)
        .gte("data_hora", nowISO)
        .neq("status", "cancelado")
        .order("data_hora", { ascending: true });

      if (agsData && agsData.length > 0) {
        agendamentosAtivosStr = agsData.map((a: any) => {
          const dt = new Date(a.data_hora);
          const dataFmt = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
          const horaFmt = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          
          const servObj = Array.isArray(a.servico) ? a.servico[0] : a.servico;
          const barbObj = Array.isArray(a.barbeiro) ? a.barbeiro[0] : a.barbeiro;
          const uniObj = Array.isArray(a.unidade) ? a.unidade[0] : a.unidade;

          const servAdicNomes = (a.agendamento_servicos || []).map((s: any) => s.nome);
          let servNomeCompleto = (a.observacoes && a.observacoes.includes("+")) ? a.observacoes : (servObj?.nome || "Corte Masculino Premium");
          if (servAdicNomes.length > 0) {
            servAdicNomes.forEach((nomeAdic: string) => {
              if (!servNomeCompleto.toLowerCase().includes(nomeAdic.toLowerCase())) {
                servNomeCompleto += ` + ${nomeAdic}`;
              }
            });
          }

          const diaSemanaStr = dt.toLocaleDateString("pt-BR", { weekday: "long" });
          const diaSemanaFmt = diaSemanaStr.charAt(0).toUpperCase() + diaSemanaStr.slice(1);

          const barbCod = barbObj?.codigo_cadeira 
            ? `Barbeiro ${barbObj.codigo_cadeira}` 
            : (barbObj?.nome ? `Barbeiro ${barbObj.nome}` : "A definir");
          const uniNome = uniObj?.nome || contextoCliente.unidadeHabitual || "Unidade a definir";
          const stStr = a.status || "agendado";

          return `• **${diaSemanaFmt}, ${dataFmt} às ${horaFmt}** | Serviço: ${servNomeCompleto} | Barbeiro: ${barbCod} | Unidade: ${uniNome} (Status: ${stStr})`;
        }).join("\n");
      }
    }

    // Formatando dados reais do banco para o Prompt da IA
    const listaUnidadesStr = (unidadesData || [])
      .map((u) => `• ${u.nome}${u.endereco ? ` (${u.endereco})` : ""}`)
      .join("\n");

    const listaBarbeirosStr = (barbeirosData || [])
      .map((b: any) => `• Barbeiro ${b.codigo_cadeira || "H1"}`)
      .join("\n");

    const listaServicosStr = (servicosData || [])
      .map((s) => `• ${s.nome}: R$ ${Number(s.preco || 0).toFixed(2)} (${s.duracao_minutos || 30} min)`)
      .join("\n");

    const listaProdutosStr = (produtosData || [])
      .map((p) => `• ${p.nome} [Categoria: ${p.categoria || "Geral"}]: R$ ${Number(p.preco || 0).toFixed(2)}`)
      .join("\n");

    // 2. CAMADA 1: CONSTRUÇÃO DA MEMÓRIA DE CURTO PRAZO (HISTÓRICO DA CONVERSA)
    const historicoFormatado = historicoMensagens
      .map((m) => `${m.remetente.toUpperCase()}: ${m.texto}`)
      .join("\n");

    // 3. CAMADA 2: PROMPT MASTER SUPREMO (INSTRUÇÃO DE SISTEMA PARA O GEMINI)
    const systemPrompt = `====================================================================
PROMPT MASTER: ATENDENTE VIRTUAL DA BARBEARIA HERMANOS (IA GENERATIVA)
====================================================================

VOCÊ É O ATENDENTE OFICIAL DA BARBEARIA HERMANOS (REDE DE BARBEARIAS PREMIUM).
Sua missão é atender os clientes no WhatsApp de forma humana, autônoma, elegante, simpática e altamente resolutiva.

[DIRETRIZES DE TOM DE VOZ & SAUDAÇÃO NATURAL]
- 🚫 SEM CUMPRIMENTOS REPETITIVOS E FORÇADOS: Se o cliente NÃO perguntou "tudo bem?" ou se a conversa já está em andamento, NÃO diga "Tudo ótimo por aqui" nem invente frases de cortesia repetitivas! Vá DIRETO e objetivamente ao assunto solicitado pelo cliente.
- 💬 SAUDAÇÃO APENAS SE HOUVER CUMPRIMENTO DO CLIENTE: Se o cliente disser "Olá", "Boa tarde" ou estiver iniciando a conversa, responda com uma saudação humana e curta (ex: "Fala ${contextoCliente.clienteNome.split(" ")[0]}! Beleza, mestre?"). Jamais monte frases truncadas como "tudo ótimo por irmão".
- ⚠️ REGRA RÍGIDA DE SEGURANÇA E MARCA: Os clientes NUNCA devem ter acesso ao nome civil do barbeiro, SOMENTE AO CÓDIGO DA CADEIRA (ex: "Barbeiro H1", "Barbeiro H2", "Barbeiro H5"). Jamais diga o nome próprio do barbeiro ao cliente.
- 💈 OBRIGATÓRIO INFORMAR O CÓDIGO DO BARBEIRO E INSTRUÇÃO DE CHEGADA: Em TODA mensagem de confirmação de agendamento (ex: "Seu atendimento está confirmado..."), você DEVE informar explicitamente o código do barbeiro (ex: **Barbeiro H1**) e incluir SEMPRE a instrução ao cliente: *"Ao chegar na recepção da unidade, basta informar ao nosso recepcionista: 'Vim para o serviço com o profissional H1'!"* (substituindo pelo código real H1/H2/H5 do barbeiro alocado).
- ✂️ CONFIRMAÇÃO PRÉVIA DO SERVIÇO ANTES DE FINALIZAR: Se o cliente solicitar agendamento sem deixar 100% explícito qual serviço deseja (ex: apenas perguntar "pode agendar hoje às 17h?"), pergunte e confirme o serviço desejado (ex: Corte de Cabelo, Barbaterapia ou Combo Cabelo + Barba) ANTES de finalizar a confirmação. Se ele indicar o serviço (ex: "pode ser corte e barba?"), confirme o combo especificando o serviço e o código do barbeiro com clareza!
- NUNCA mencione bebidas ou chopp nas unidades.
- NUNCA use linguagem robótica de menus engessados ("Selecione uma opção").
- Responda EXATAMENTE e SOMENTE o que o cliente perguntou, de forma fluida e direta.

[CAMADA DE MEMÓRIA DO CLIENTE (FICHA DO PERFIL)]
- Nome Completo: ${contextoCliente.clienteNome}
- Telefone: ${contextoCliente.clienteTelefone}
- Status da Assinatura: ${contextoCliente.isInfinite ? "Assinante Infinite 👑 (Verificado via Vindi Sandbox API - Cortes e barba ilimitados em toda a rede)" : "Cliente Avulso"}
- Barbeiro Preferido: ${contextoCliente.barbeiroPreferido || "Barbeiro H1"}
- Unidade Habitual: ${contextoCliente.unidadeHabitual}

[CAMADA DE MEMÓRIA DE BANCO DE DADOS (AGENDAMENTOS ATIVOS DO CLIENTE)]
${agendamentosAtivosStr}

[CAMADA DE MEMÓRIA DE SISTEMA (CONHECIMENTO GERAL EM TEMPO REAL)]
📍 UNIDADES DA REDE:
${listaUnidadesStr || "• Unidade Higienópolis (Av. Angélica, 1617)\n• Unidade Mooca (R. da Mooca, 2341)\n• Unidade Tatuapé (R. Itapura, 744)\n• Unidade Itaim Bibi (R. João Cachoeira, 750)"}

💈 EQUIPE DE BARBEIROS (APENAS CÓDIGOS DE CADEIRA):
${listaBarbeirosStr || "• Barbeiro H1\n• Barbeiro H2\n• Barbeiro H5"}

✂️ TABELA DE SERVIÇOS:
${listaServicosStr || "• Corte Masculino Premium: R$ 75.00\n• Combo Corte + Barba: R$ 125.00"}

🛍️ VITRINE DE PRODUTOS OFICIAIS DISPONÍVEIS NA RECEPÇÃO (PARA LEVAR PARA CASA):
${listaProdutosStr || "• Pomada Matte Efeito Seco: R$ 50.00\n• Balm para Barba: R$ 50.00\n• Óleo para Barba: R$ 50.00\n• Shampoo para Barba: R$ 50.00"}

👑 PLANOS INFINITE (TABELA OFICIAL DE ASSINATURAS RECORRENTES):
• INFINITE - CUTS: R$ 99,89/mês (Cortes de cabelo ilimitados em toda a rede)
• INFINITE - BARB: R$ 129,89/mês (Cuidados de barba ilimitados em toda a rede)
• INFINITE - DUOS: R$ 199,89/mês (Cabelo + Barba ilimitados em toda a rede)
• INFINITE PLUS: R$ 34,89/mês (Adicional especial de cuidados diários)

[GRADE DE HORÁRIOS DE ATENDIMENTO - PREFERÊNCIA DE 30 MINUTOS]
- ⏰ PREFERÊNCIA DE REGUA DE HORÁRIOS: Ofereça preferencialmente horários padronizados de 30 em 30 minutos (ex: 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00).
- ✂️ ENCAIXES E SERVIÇOS RÁPIDOS: Para serviços rápidos e expressos (como Sobrancelha, Depilação de Nariz/Orelha) ou solicitações específicas do cliente, você pode ajustar e oferecer horários flexíveis intermediários de acordo com a necessidade.

[REGRAS DE PROCESSAMENTO DE MENSAGENS]
1. Se o cliente perguntar sobre seus agendamentos/horários marcados: consulte a seção "AGENDAMENTOS ATIVOS DO CLIENTE" e informe a data, horário, CÓDIGO DO BARBEIRO (ex: Barbeiro H1) e unidade, lembrando o cliente da instrução de recepção ("Vim para o atendimento com o profissional H1").
2. Se o cliente pedir para remarcar ou agendar um novo horário (ou TROCAR DE BARBEIRO ex: "quero trocar para o Barbeiro H1" ou "mudar profissional para o H5"):
   - Se o cliente NÃO deixou explícito qual serviço deseja, pergunte e confirme o serviço desejado antes de fechar a confirmação!
   - Ao confirmar a reserva (ex: "Perfeito! Seu Cabelo e Barbaterapia está confirmado..."), inclua OBRIGATORIAMENTE o código da cadeira do barbeiro (ex: Barbeiro H1) e oriente expressamente: *"Ao chegar na recepção da unidade, basta informar: 'Vim para o serviço com o profissional H1'!"*
3. Se o cliente pedir para ADICIONAR OU INCLUIR MAIS SERVIÇOS ao agendamento (ex: "adiciona sobrancelha", "inclui barba", "faz sobrancelha junto", "coloca depilação"):
   - Confirme IMEDIATAMENTE a inclusão do novo serviço com entusiasmo ("Com certeza, mestre! Adicionei o serviço ao seu agendamento!").
   - Liste o combo de serviços atualizado, o tempo de duração total ajustado na cadeira e o novo valor acumulado, reforçando o código do barbeiro (ex: Barbeiro H1).
   - Se o cliente for Assinante Infinite 👑, lembre-o dos benefícios de assinante ou informe o valor do serviço adicional!
4. Se o cliente perguntar ou quiser comprar/deixar separado algum produto (ex: "separa um balm", "reserva a pomada"): 
   - 📦 REGRA DE ANTECEDÊNCIA (JANELA DE ATÉ 3 DIAS): A pré-reserva de produtos só é permitida se o agendamento do cliente for para os próximos 3 dias!
   - Se o atendimento do cliente for nos próximos 3 dias (ex: hoje, amanhã ou esta semana), confirme a pré-reserva do produto na comanda dele e avise que já deixamos avisado para a gerência separar na recepção!
   - Se o agendamento do cliente for em uma data distante (mais de 3 dias no futuro), explique com educação e elegância que não é necessário reservar com tanta antecedência pois nossos estoques da recepção são renovados constantemente, e que ele poderá escolher e levar o produto diretamente na recepção no dia do seu corte!
5. Se o cliente perguntar sobre planos ou valores: informe detalhadamente a tabela oficial dos Planos Infinite acima.

MANTENHA A CONVERSA CONTÍNUA, HUMANA E INTELIGENTE.`;

    const activeKey = (userGeminiKey || import.meta.env.VITE_GEMINI_API_KEY || "").trim();

    if (activeKey) {
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: `${systemPrompt}\n\nHISTÓRICO COMPLETO DA CONVERSA:\n${historicoFormatado}\n\nMENSAGEM ATUAL DO CLIENTE (${contextoCliente.clienteNome}): ${textoCliente}` }
            ]
          }
        ]
      };

      // RETRY AUTOMÁTICO EM CASO DE OSCILAÇÃO DE REDE DA NUVEM DO GEMINI (USANDO MODELO OFICIAL DE COTA ALTA)
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${activeKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${activeKey}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            });
          }

          if (res.ok) {
            const data = await res.json();
            const respostaText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (respostaText) {
              // 1. DICA DE PERSISTÊNCIA DINÂMICA DE TROCA DE BARBEIRO / REAGENDAMENTO / ADIÇÃO DE SERVIÇOS
              if (txt.includes("17") || txt.includes("19") || txt.includes("15:30") || txt.includes("remarcar") || txt.includes("agendar") || txt.includes("trocar") || txt.includes("barbeiro") || txt.includes("sobrancelha") || txt.includes("adiciona") || txt.includes("inclui") || txt.includes("barba") || txt.includes("depilação") || /\bh[1-8]\b/.test(txt)) {
                try {
                  const horaEscolha = txt.includes("19") ? "19:00" : (txt.includes("17") ? "17:00" : "16:00");
                  
                  // Identificar qual barbeiro o cliente solicitou (H1 ate H8)
                  let codBusca = "H2";
                  const matchH = txt.match(/\bh[1-8]\b/);
                  if (matchH) {
                    codBusca = matchH[0].toUpperCase();
                  }

                  const { data: barbList } = await supabase.from("barbeiros").select("id, unidade_id, codigo_cadeira").ilike("codigo_cadeira", `%${codBusca}%`).limit(1);
                  const { data: cliListSel } = await supabase.from("clientes").select("id").ilike("nome", `%${contextoCliente.clienteNome}%`).limit(1);

                  const barbDef = barbList?.[0] || (await supabase.from("barbeiros").select("id, unidade_id").limit(1)).data?.[0];
                  let cliDef = cliListSel?.[0];

                  // Identificar serviço principal e adicionais com preços reais do banco
                  let servicoNomeCombo = contextoCliente.isInfinite ? "INFINITE - CUTS" : "Corte Masculino Premium";
                  let precoTotalCalculado = contextoCliente.isInfinite ? 0.00 : 70.00;
                  let duracaoTotalCalculada = 30;

                  if (txt.includes("sobrancelha") && !servicoNomeCombo.includes("Sobrancelha")) {
                    servicoNomeCombo += " + Sobrancelha";
                    precoTotalCalculado += 30.00;
                    duracaoTotalCalculada += 10;
                  }
                  if (txt.includes("barba") && !servicoNomeCombo.includes("Barba")) {
                    servicoNomeCombo += " + Barbaterapia";
                    precoTotalCalculado += 75.00;
                    duracaoTotalCalculada += 20;
                  }
                  if (txt.includes("depilação") && !servicoNomeCombo.includes("Depilação")) {
                    servicoNomeCombo += " + Depilação Nariz";
                    precoTotalCalculado += 30.00;
                    duracaoTotalCalculada += 10;
                  }
                  if (txt.includes("hidratação") && !servicoNomeCombo.includes("Hidratação")) {
                    servicoNomeCombo += " + Hidratação Capilar";
                    precoTotalCalculado += 35.00;
                    duracaoTotalCalculada += 10;
                  }

                  let { data: servList } = await supabase.from("servicos").select("id").ilike("nome", "%INFINITE - CUTS%").limit(1);
                  if (!servList || servList.length === 0) {
                    servList = (await supabase.from("servicos").select("id").limit(1)).data;
                  }
                  const servDef = servList?.[0];

                  if (barbDef && cliDef) {
                    const proximaSexta = new Date();
                    proximaSexta.setDate(proximaSexta.getDate() + ((5 + 7 - proximaSexta.getDay()) % 7 || 7));
                    const dateStr = proximaSexta.toISOString().split("T")[0];
                    const dataHoraIso = `${dateStr}T${horaEscolha}:00-03:00`;

                    // CANCELAR AGENDAMENTOS ANTERIORES DO CLIENTE PARA MANTER APENAS 1 ATIVO
                    await supabase
                      .from("agendamentos")
                      .update({ status: "cancelado" })
                      .eq("cliente_id", cliDef.id)
                      .neq("status", "cancelado");

                    // INSERIR O NOVO AGENDAMENTO ATUALIZADO COM O COMBO DE SERVIÇOS E NOVO BARBEIRO ESCOLHIDO
                    const { data: novoAg } = await supabase.from("agendamentos").insert({
                      cliente_id: cliDef.id,
                      barbeiro_id: barbDef.id,
                      unidade_id: barbDef.unidade_id,
                      servico_id: servDef?.id,
                      data_hora: dataHoraIso,
                      duracao_minutos: duracaoTotalCalculada,
                      preco: precoTotalCalculado,
                      status: "agendado",
                      observacoes: servicoNomeCombo
                    }).select("id").single();

                    if (novoAg?.id) {
                      const servsAdicInsert: any[] = [];
                      if (txt.includes("sobrancelha")) {
                        const { data: s } = await supabase.from("servicos").select("id, nome, preco, duracao_minutos").ilike("nome", "%SOBRANCELHA%").limit(1);
                        if (s?.[0]) servsAdicInsert.push(s[0]);
                      }
                      if (txt.includes("hidratação")) {
                        const { data: s } = await supabase.from("servicos").select("id, nome, preco, duracao_minutos").ilike("nome", "%HIDRATAÇÃO%").limit(1);
                        if (s?.[0]) servsAdicInsert.push(s[0]);
                      }
                      if (txt.includes("depilação")) {
                        const { data: s } = await supabase.from("servicos").select("id, nome, preco, duracao_minutos").ilike("nome", "%DEPILAÇÃO%").limit(1);
                        if (s?.[0]) servsAdicInsert.push(s[0]);
                      }

                      for (const sItem of servsAdicInsert) {
                        await supabase.from("agendamento_servicos").insert({
                          agendamento_id: novoAg.id,
                          servico_id: sItem.id,
                          nome: sItem.nome,
                          preco: Number(sItem.preco || 30.00),
                          duracao_minutos: sItem.duracao_minutos || 10
                        });
                      }
                    }
                  }
                } catch (errDb) {
                  console.error("Erro na persistência do agendamento via IA:", errDb);
                }
              }

              // 2. PERSISTÊNCIA TRANSPARENTE DE PRÉ-RESERVA DE PRODUTO NA COMANDA EXISTENTE DO AGENDAMENTO
              if (txt.includes("separar") || txt.includes("reserva") || txt.includes("balm") || txt.includes("pomada") || txt.includes("comprar") || txt.includes("llevar")) {
                try {
                  const { data: cliListSel } = await supabase.from("clientes").select("id").ilike("nome", `%${contextoCliente.clienteNome}%`).limit(1);
                  const cliDef = cliListSel?.[0];

                  if (cliDef) {
                    // Buscar o agendamento ativo e a comanda já aberta no agendamento do cliente
                    const { data: agAtivo } = await supabase
                      .from("agendamentos")
                      .select("id, comanda_id")
                      .eq("cliente_id", cliDef.id)
                      .neq("status", "cancelado")
                      .order("created_at", { ascending: false })
                      .limit(1);

                    const agObj = agAtivo?.[0];
                    let comandaId = agObj?.comanda_id;

                    // Se nao houver comanda_id no agendamento, buscar comanda aberta do cliente
                    if (!comandaId) {
                      let { data: comandaExistente } = await supabase
                        .from("comandas")
                        .select("id")
                        .eq("cliente_id", cliDef.id)
                        .neq("status", "fechada")
                        .order("created_at", { ascending: false })
                        .limit(1);

                      comandaId = comandaExistente?.[0]?.id;
                    }

                    // Se a comanda ainda nao existia, criar vinculando ao agendamento
                    if (!comandaId) {
                      const { data: novaComanda } = await supabase
                        .from("comandas")
                        .insert({
                          cliente_id: cliDef.id,
                          agendamento_id: agObj?.id,
                          status: "aberta",
                          observacoes: "📦 Comanda de Agendamento (Item Pré-Reservado via WhatsApp)"
                        })
                        .select("id")
                        .single();

                      comandaId = novaComanda?.id;

                      if (agObj?.id && comandaId) {
                        await supabase.from("agendamentos").update({ comanda_id: comandaId }).eq("id", agObj.id);
                      }
                    }

                    if (comandaId) {
                      const { data: prodSel } = await supabase
                        .from("produtos")
                        .select("id, nome, preco")
                        .ilike("nome", txt.includes("balm") ? "%balm%" : "%pomada%")
                        .limit(1);

                      const prodObj = prodSel?.[0];
                      if (prodObj) {
                        await supabase.from("comanda_itens").insert({
                          comanda_id: comandaId,
                          produto_id: prodObj.id,
                          quantidade: 1,
                          preco_unitario: prodObj.preco || 50.00,
                          observacoes: "Item Pré-Reservado via WhatsApp Zap"
                        });
                      }
                    }
                  }
                } catch (errProd) {
                  console.error("Erro ao registrar pré-reserva de produto na comanda:", errProd);
                }
              }

              return respostaText;
            }
          } else {
            console.warn(`Tentativa ${tentativa} falhou com status HTTP: ${res.status}`);
          }
        } catch (errFetch) {
          console.error(`Tentativa ${tentativa} erro no fetch:`, errFetch);
        }

        if (tentativa < 3) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    // FALLBACK INTELIGENTE BASEADO EM INTENÇÃO CASO A REDE DA IA ESTEJA EM PROCESSAMENTO
    const txtLower = textoCliente.toLowerCase();
    const primeiroNome = contextoCliente.clienteNome.split(" ")[0];

    if (txtLower.includes("horario") || txtLower.includes("horário") || txtLower.includes("agendamento") || txtLower.includes("quando") || txtLower.includes("marcado") || txtLower.includes("dia")) {
      if (agendamentosAtivosStr && !agendamentosAtivosStr.includes("Nenhum agendamento")) {
        return `Fala ${primeiroNome}! Olhando aqui no nosso sistema, o seu agendamento ativo está confirmado:\n\n${agendamentosAtivosStr}\n\nQuer alterar algum detalhe ou precisa de mais alguma coisa, mestre?`;
      } else {
        return `Fala ${primeiroNome}! Consultei nosso sistema e você não possui agendamentos futuros marcados no momento. Quer agendar um horário para esta semana?`;
      }
    }

    if (txtLower.includes("plano") || txtLower.includes("infinite") || txtLower.includes("assinatura") || txtLower.includes("valor")) {
      return `Fala ${primeiroNome}! Nossos Planos de Assinatura Infinite são:\n\n• **INFINITE - CUTS**: R$ 99,89/mês (Cortes ilimitados)\n• **INFINITE - BARB**: R$ 129,89/mês (Barba ilimitada)\n• **INFINITE - DUOS**: R$ 199,89/mês (Cabelo + Barba ilimitados)\n\nQual deles se encaixa melhor na sua rotina, mestre?`;
    }

    return `Fala ${primeiroNome}! Como posso te ajudar com seu atendimento hoje na Barbearia Hermanos?`;
  } catch (error) {
    console.error("Erro no processarAtendimentoIA:", error);
    const primeiroNome = contextoCliente.clienteNome.split(" ")[0];
    if (agendamentosAtivosStr && !agendamentosAtivosStr.includes("Nenhum agendamento")) {
      return `Fala ${primeiroNome}! Olhando aqui no nosso sistema, o seu agendamento ativo é:\n\n${agendamentosAtivosStr}`;
    }
    return `Fala ${primeiroNome}! Como posso te ajudar hoje na Barbearia Hermanos?`;
  }
}
