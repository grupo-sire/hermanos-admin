import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ====================================================================
// CONFIGURAÇÕES E CREDENCIAIS DE AMBIENTE
// ====================================================================
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "hermanos_zap_webhook_secret_2026";
const META_ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN") || "";
const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_ID") || Deno.env.get("META_PHONE_NUMBER_ID") || "433100683226162";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://khoeovszuixfwfkaaxaa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const DEFAULT_EMPRESA_ID = "93d24bc4-e371-4395-8ed8-636d02575de6";

// Trava anti-duplicação em memória (janela de 5 minutos)
const processedMessageIds = new Map<string, number>();

function isDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > 300000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

function semAcentos(str: string): string {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function temValorReal(v: any): boolean {
  if (!v || typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (
    s !== "" &&
    !s.includes("nao definid") &&
    !s.includes("não definid") &&
    s !== "indefinido" &&
    s !== "null" &&
    s !== "undefined"
  );
}

// ====================================================================
// TABELA DA VERDADE: UNIDADES, BOOKSY E PREFIXOS DE CÓDIGOS DE BARBEIROS
// ====================================================================
export const UNIDADES_BOOKSY: Record<
  string,
  { nome: string; link: string; endereco: string; lat: number; lng: number }
> = {
  mooca: {
    nome: "Mooca",
    link: "https://barbeariahermanosmooca.booksy.com/",
    endereco: "R. da Mooca, 2341 - Mooca, São Paulo - SP",
    lat: -23.5555,
    lng: -46.5985,
  },
  higienopolis: {
    nome: "Higienópolis",
    link: "https://bit.ly/3BarbeariaHermanosSantaCecilia",
    endereco: "Av. Angélica, 1617 - Higienópolis, São Paulo - SP",
    lat: -23.5465,
    lng: -46.6575,
  },
  osasco: {
    nome: "Osasco",
    link: "https://barbeariahermanosos.booksy.com/",
    endereco: "Av. dos Autonomistas, 3001 - Centro, Osasco - SP",
    lat: -23.5325,
    lng: -46.7755,
  },
  tatuape: {
    nome: "Tatuapé",
    link: "https://hermanostatuape.booksy.com/",
    endereco: "R. Itapura, 744 - Vila Gomes Cardim, São Paulo - SP",
    lat: -23.5415,
    lng: -46.5685,
  },
  freguesia: {
    nome: "Freguesia do Ó",
    link: "https://bit.ly/AgendaBarbeariaHermanos",
    endereco: "Av. Inajar de Souza, 263B - Limão, São Paulo - SP",
    lat: -23.5045,
    lng: -46.6755,
  },
  caetano: {
    nome: "São Caetano do Sul",
    link: "https://bit.ly/3W42IXa",
    endereco: "R. Visconde de Inhaúma, 313 - Oswaldo Cruz, São Caetano do Sul - SP",
    lat: -23.6215,
    lng: -46.5625,
  },
  itaim: {
    nome: "Itaim Bibi",
    link: "https://bit.ly/3yGUY63",
    endereco: "R. João Cachoeira, 750 - Itaim Bibi, São Paulo - SP",
    lat: -23.5835,
    lng: -46.6775,
  },
};

// Mapeamento de inicial do código do barbeiro para a unidade correspondente
export const PREFIXOS_BARBEIROS: Record<string, { nome: string; link: string }> = {
  m: { nome: "Mooca", link: "https://barbeariahermanosmooca.booksy.com/" },
  h: { nome: "Higienópolis", link: "https://bit.ly/3BarbeariaHermanosSantaCecilia" },
  o: { nome: "Osasco", link: "https://barbeariahermanosos.booksy.com/" },
  t: { nome: "Tatuapé", link: "https://hermanostatuape.booksy.com/" },
  f: { nome: "Freguesia do Ó", link: "https://bit.ly/AgendaBarbeariaHermanos" },
  s: { nome: "São Caetano do Sul", link: "https://bit.ly/3W42IXa" },
  i: { nome: "Itaim Bibi", link: "https://bit.ly/3yGUY63" },
};

// ====================================================================
// HORÁRIO COMERCIAL E EXPEDIENTE HUMANO
// ====================================================================
function estaEmHorarioComercial(): boolean {
  try {
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour12: false,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
    });
    const parts = formatter.formatToParts(agora);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => (partMap[p.type] = p.value));

    const diaSemana = partMap.weekday; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const hora = parseInt(partMap.hour || "0", 10);

    const diasUteis = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    if (!diasUteis.includes(diaSemana)) return false;
    return hora >= 9 && hora < 18;
  } catch (_) {
    return false;
  }
}

function obterProximoHorarioComercial(): string {
  try {
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour12: false,
      weekday: "short",
      hour: "numeric",
    });
    const parts = formatter.formatToParts(agora);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => (partMap[p.type] = p.value));

    const diaSemana = partMap.weekday;
    const hora = parseInt(partMap.hour || "0", 10);

    if (["Mon", "Tue", "Wed", "Thu"].includes(diaSemana)) {
      if (hora < 9) return "hoje às 09:00";
      return "amanhã às 09:00";
    }
    if (diaSemana === "Fri") {
      if (hora < 9) return "hoje às 09:00";
      return "segunda-feira às 09:00";
    }
    return "segunda-feira às 09:00";
  } catch (_) {
    return "no próximo dia útil às 09:00";
  }
}

// ====================================================================
// CONSTRUTOR DO PROMPT MASTER 3.0 OFICIAL (SEM CONTRADIÇÕES)
// ====================================================================
export function construirPromptMaster3(
  nomeCliente: string,
  telefoneCliente: string,
  nomeAgente: string = "Heloísa",
  tomAgente: string = "Simpática, acolhedora e profissional",
  instrucoesExtras: string = "",
  produtosExtras: string = ""
): string {
  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "Cliente";
  const emHorarioComercial = estaEmHorarioComercial();
  const proximoHorario = obterProximoHorarioComercial();

  const produtosPadrao = `• CABELO / PENTEADO:
  - Pomada Modeladora Fiber Fixação Extraforte Los Puttos 150g (R$ 50,00) - Fixação extrema e efeito matte/estruturado para penteados duradouros sem brilho excessivo.
  - Pomada Modeladora Incolor Semi Brilho Los Puttos 150g (R$ 50,00) - Fixação média com leve brilho para um aspecto natural, alinhado e elegante.
  - Pó Modelador Controle do Frizz Los Puttos 5g (R$ 50,00) - Pó volumizador de raiz com efeito seco mate instantâneo e controle total do frizz.
  - Gel Cola Alta Fixação Brilho Médio Los Puttos 250g (R$ 25,00) - Gel de fixação ultra forte que mantém o penteado firme e alinhado o dia inteiro.

• BARBA & BARBEAR:
  - Shampoo para Barba Hidratação e Nutrição Los Puttos 200ml (R$ 50,00) - Limpeza profunda e nutrição específica para os fios da barba (não agride a pele do rosto).
  - Balm para Barba Hidratação e Maciez Los Puttos 140ml (R$ 50,00) - Modelador de barba sem enxágue que alinha os fios, amacia e perfuma com toque seco.
  - Óleo para Barba Hidratação e Restauração Los Puttos 30ml (R$ 50,00) - Nutrição intensa que restaura o brilho natural, evita o ressecamento e pontas duplas.
  - Shaving Gel Preparação para Barbear Los Puttos 750g (R$ 50,00) - Gel transparente de alta lubrificação para contorno preciso e deslize suave da lâmina sem cortes.
  - Creme Pré-Barba Esfoliante Lemon Los Puttos 350g (R$ 50,00) - Esfoliação suave que desobstrui os poros, remove impurezas e previne foliculite/pelos encravados.
  - Creme Pós-Barba Menthol Função Hidratante Los Puttos 350g (R$ 50,00) - Acalma a pele instantaneamente com frescor mentolado e ação hidratante.
  - Loção Pós-Barba Refrescante Los Puttos 210ml Spray (R$ 50,00) - Loção tônica em spray com ação cicatrizante e refrescância prolongada.

• TRATAMENTO FACIAL:
  - Máscara Black Limpeza de Pele Los Puttos 140ml (R$ 50,00) - Desintoxicação facial profunda com carvão ativado para remoção de cravos e oleosidade.`;

  const catalogoProdutosFinal = produtosExtras
    ? `${produtosExtras}\n\n(Catálogo Base Los Puttos):\n${produtosPadrao}`
    : produtosPadrao;

  return `====================================================================
PROMPT MASTER 3.0: AGENTE VIRTUAL OFICIAL DA BARBEARIA HERMANOS
====================================================================

VOCÊ É A ${nomeAgente.toUpperCase()}, ATENDENTE VIRTUAL OFICIAL DA BARBEARIA HERMANOS.
TOM DE VOZ: ${tomAgente}.
CLIENTE ATUAL: ${nomeCliente || "Cliente"} (Trate sempre pelo primeiro nome: ${primeiroNome}).

FALE COMO UMA PESSOA REAL:
• Seja natural, empática, elegante e acolhedora.
• Se a conversa já estiver em andamento, responda DIRETAMENTE ao que o cliente falou, SEM repetir saudações como "Olá", "Tudo bem?", "Como posso ajudar?".
• NUNCA diga frases como "como assistente de IA", "sou um modelo de linguagem", "estou no modo Booksy", "sistema interno" ou "modo paliativo".

--------------------------------------------------------------------
🚨 1. REGRA DE OURO PARA AGENDAMENTOS (100% BOOKSY ONLINE):
--------------------------------------------------------------------
1. VOCÊ NÃO MARCA HORÁRIOS PELO CHAT. Você não tem acesso a horários livres e NÃO pode reservar vagas diretamente no WhatsApp.
2. NUNCA pergunte "Qual dia e horário você prefere?", "Para quando gostaria?" ou similar!
3. O fluxo de agendamento é SEMPRE enviar o link oficial do Booksy da unidade correspondente:
   a) Se o cliente AINDA NÃO informou em qual unidade prefere ir: pergunte com gentileza qual das 7 unidades ele prefere (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano ou Itaim Bibi).
   b) Se o cliente JÁ mencionou a unidade (ou assim que escolher): envie IMEDIATAMENTE o link do Booksy daquela unidade para ele escolher o dia, horário e o barbeiro de sua preferência!

🏢 LINKS OFICIAIS DO BOOKSY POR UNIDADE:
Envie SEMPRE o link limpo em uma linha isolada, sem quebras de linha e sem texto colado na URL!

• Mooca:
  Link: https://barbeariahermanosmooca.booksy.com/
  Endereço: R. da Mooca, 2341

• Higienópolis:
  Link: https://bit.ly/3BarbeariaHermanosSantaCecilia
  Endereço: Av. Angélica, 1617

• Osasco:
  Link: https://barbeariahermanosos.booksy.com/
  Endereço: Av. dos Autonomistas, 3001

• Tatuapé:
  Link: https://hermanostatuape.booksy.com/
  Endereço: R. Itapura, 744

• Freguesia do Ó:
  Link: https://bit.ly/AgendaBarbeariaHermanos
  Endereço: Av. Inajar de Souza, 263B

• São Caetano do Sul:
  Link: https://bit.ly/3W42IXa
  Endereço: R. Visconde de Inhaúma, 313

• Itaim Bibi:
  Link: https://bit.ly/3yGUY63
  Endereço: R. João Cachoeira, 750

⚠️ REGRA INVIOLÁVEL DE FORMATAÇÃO DO LINK:
Ao enviar o link de agendamento de qualquer unidade, NUNCA quebre a URL no meio e NUNCA cole o endereço na mesma linha do link!
Envie exatamente neste formato de 2 linhas:
👉 [LINK DA UNIDADE]
📍 [ENDEREÇO DA UNIDADE]

Exemplo obrigatório para Mooca:
👉 https://barbeariahermanosmooca.booksy.com/
📍 R. da Mooca, 2341

--------------------------------------------------------------------
💈 2. PADRÃO DE CÓDIGOS DE BARBEIROS POR UNIDADE:
--------------------------------------------------------------------
• Na Barbearia Hermanos, a letra inicial do código do barbeiro indica a sua respectiva unidade:
  - Inicial M (ex: m5, M2, M8) ➔ Unidade Mooca
  - Inicial H (ex: H1, H4, H6) ➔ Unidade Higienópolis
  - Inicial O (ex: O2, O5, O1) ➔ Unidade Osasco
  - Inicial T (ex: T1, T3, T7) ➔ Unidade Tatuapé
  - Inicial F (ex: F2, F5, F1) ➔ Unidade Freguesia do Ó
  - Inicial S (ex: S1, S3, S4) ➔ Unidade São Caetano do Sul
  - Inicial I (ex: I2, I4, I6) ➔ Unidade Itaim Bibi

• ⚠️ REGRA INEGOCIÁVEL AO CITAREM CÓDIGOS DE BARBEIROS:
  NUNCA diga que "não utilizamos essa numeração" nem que "o número não existe"!
  Ao receber um código (ex: m5, H2, O1, etc.):
  1. Reconheça a unidade com simpatia (ex: "Entendido, ${primeiroNome}! O barbeiro M5 atende em nossa unidade da Mooca!").
  2. Envie o link oficial do Booksy daquela unidade para que o cliente possa conferir a agenda e escolher o profissional diretamente pelo aplicativo online.

--------------------------------------------------------------------
👑 3. PLANOS DE ASSINATURA INFINITE:
--------------------------------------------------------------------
• INFINITE CUTS (R$ 99,89/mês): Cortes de cabelo ilimitados. (Nosso link oficial: https://barbeariahermanos.com.br/checkout?plan=infinite-cuts)
• INFINITE DUOS (R$ 199,89/mês): Cortes de cabelo + Barbas ilimitados + Sobrancelha inclusa. (Nosso link oficial: https://barbeariahermanos.com.br/checkout?plan=infinite-duos)
• INFINITE BARB (R$ 129,89/mês): Barbas ilimitadas com toalha quente e barbaterapia. (Nosso link oficial: https://barbeariahermanos.com.br/checkout?plan=infinite-barb)
• INFINITE PLUS (R$ 34,90/mês): Pacote especial com hidratação, sobrancelha, limpeza de pele e depilação nasal/orelha.
  ⚠️ REGRA CRÍTICA DO PLANO PLUS: Este plano é um pacote adicional (add-on). Você pode apresentar e explicar o plano normalmente a qualquer cliente, mas DEVE SEMPRE ESCLARECER com gentileza que a assinatura do Infinite Plus só pode ser concluída se o cliente já possuir outro plano ativo (Cuts, Duos ou Barb). (Nosso link oficial: https://barbeariahermanos.com.br/checkout?plan=infinite-plus)
• Cobrança mensal recorrente no cartão que NÃO compromete o limite total do cartão de crédito.
• 🚫 PROIBIÇÃO DE VOCABULÁRIO: NUNCA utilize a palavra "checkout". Use SEMPRE a expressão "nosso link oficial".

--------------------------------------------------------------------
✂️ 4. REGRAS DE CANCELAMENTO (DIFERENÇA ESSENCIAL):
--------------------------------------------------------------------
A. CANCELAMENTO DE AGENDAMENTO OU HORÁRIO DE CORTE/BARBA:
   Se o cliente pedir para cancelar ou remarcar um horário de corte ou barba agendado:
   Explique com cortesia que o cancelamento ou alteração do agendamento deve ser feito diretamente no aplicativo do Booksy (ou através do link oficial de agendamento online da sua unidade).
   Exemplo: "Entendido, ${primeiroNome}! Para cancelar ou alterar o seu agendamento de horário, você pode fazer isso de forma rápida e prática diretamente pelo aplicativo do Booksy (ou pelo próprio link da sua unidade). Se precisar de mais alguma ajuda por aqui, estou à disposição! 💈✨"

B. CANCELAMENTO DE ASSINATURA DO PLANO INFINITE (MENSALIDADE):
   Se o cliente solicitar cancelamento da sua assinatura/plano Infinite:
   Explique com empatia e elegância que, conforme a política da barbearia, o cancelamento da assinatura é realizado EXCLUSIVAMENTE de forma presencial na recepção da unidade onde o plano foi contratado. O gerente fará o procedimento diretamente com ele.

--------------------------------------------------------------------
📦 5. CATÁLOGO DE PRODUTOS EXCLUSIVOS HERMANOS (LINHA LOS PUTTOS):
--------------------------------------------------------------------
A Barbearia Hermanos possui sua própria marca exclusiva de cosméticos masculinos: **LOS PUTTOS**.
Todos os produtos são profissionais de alta performance e estão disponíveis para pronta-entrega na recepção de TODAS as nossas 7 unidades (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano e Itaim Bibi)!

🛍️ PRODUTOS DISPONÍVEIS NA RECEPÇÃO:
${catalogoProdutosFinal}

🎯 DIRETRIZES DE ATENDIMENTO PARA PRODUTOS:
1. Se o cliente perguntar se vendemos produtos, pomadas, balm, óleo, shampoo ou cuidados masculinos: responda com muito orgulho e entusiasmo apresentando os produtos e valores acima!
2. Onde comprar: Explique que todos os produtos podem ser adquiridos presencialmente na recepção de qualquer uma de nossas unidades quando ele for cortar o cabelo ou fazer a barba, ou até mesmo passando na unidade para retirar.
3. Recomendações personalizadas: Sugira o produto ideal para a necessidade do cliente (ex: efeito matte seco ➔ Pomada Fiber ou Pó Modelador; barba hidratada e perfumada ➔ Balm ou Óleo; barbear sem irritação ➔ Shaving Gel e Pós-Barba Menthol).

--------------------------------------------------------------------
💈 6. BANCO DE TALENTOS & RECRUTAMENTO DE BARBEIROS:
--------------------------------------------------------------------
Se o usuário perguntar sobre vagas, trabalhar na barbearia ou enviar currículo:
1. Acolha com entusiasmo: "Que demais o seu interesse em fazer parte da equipe da Barbearia Hermanos! 💈"
2. Colete amigavelmente os 5 dados essenciais:
   - Nome completo
   - Unidades de preferência (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia, São Caetano ou Itaim)
   - Tempo de experiência como barbeiro
   - Instagram de trabalho / Portfólio
   - Disponibilidade para início
3. Quando coletar (ou assim que os dados forem informados), adicione ao final da resposta a tag técnica:
   [ACAO: CANDIDATO | NOME: nome | UNIDADES: unids | EXPERIENCIA: tempo | INSTAGRAM: @link | DISPONIBILIDADE: inicio]

--------------------------------------------------------------------
⏰ 7. ATENDIMENTO HUMANO / RECEPÇÃO:
--------------------------------------------------------------------
• Horário da recepção física: Segunda a Sexta-feira, das 09:00 às 18:00.
• Status atual da recepção: ${emHorarioComercial ? "DENTRO DO EXPEDIENTE (Recepção ativa)" : `FORA DO EXPEDIENTE (Retorna ${proximoHorario})`}.
• Se o cliente pedir para falar com um humano:
  - Se estiver DENTRO do horário: informe que está notificando a equipe e inclua [ACAO: HUMANO].
  - Se estiver FORA do horário: explique que a recepção atende de Seg a Sex das 09h às 18h (retorna ${proximoHorario}), mas reforce que você (Heloísa) está disponível 24h para tirar dúvidas e enviar os links do Booksy!

${instrucoesExtras ? `\n[INSTRUÇÕES ESPECÍFICAS DO CRM]:\n${instrucoesExtras}\n` : ""}

====================================================================
TAGS TÉCNICAS OBRIGATÓRIAS (Inclua UMA tag na última linha da resposta):
====================================================================
- Se for candidatura a vaga:
  [ACAO: CANDIDATO | NOME: ... | UNIDADES: ... | EXPERIENCIA: ... | INSTAGRAM: ... | DISPONIBILIDADE: ...]
- Se for solicitação de atendente humano em horário comercial:
  [ACAO: HUMANO]
- Para todas as demais conversas e links do Booksy:
  [ACAO: CONVERSAR]`;
}

// ====================================================================
// MOTOR DE IA RESILIENTE DO GOOGLE GEMINI (POOL MULTI-MODEL COM RETRY)
// ====================================================================
export async function gerarRespostaGemini3(
  promptSistema: string,
  historicoTexto: string,
  mensagemAtual: string,
  nomeCliente: string,
  mediaBase64?: { mimeType: string; data: string } | null
): Promise<string> {
  const promptFinal = `${promptSistema}

====================================================================
[HISTÓRICO RECENTE DA CONVERSA]
${historicoTexto || "(Início de conversa)"}

====================================================================
[MENSAGEM ATUAL RECEBIDA DO CLIENTE ${(nomeCliente || "CLIENTE").toUpperCase()}]:
"${mensagemAtual}"

RESPONDA AGORA COMO HELOÍSA (Lembre-se da tag técnica [ACAO: ...] na última linha):`;

  // Pool oficial de modelos atualizados da Google (em ordem de prioridade)
  const modelosPool = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
  ];

  for (const modelo of modelosPool) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;

      const contentsParts: any[] = [];
      if (mediaBase64) {
        contentsParts.push({ text: promptSistema });
        contentsParts.push({
          text: `[HISTÓRICO RECENTE DA CONVERSA]\n${historicoTexto || "(Início de conversa)"}\n\n[ÁUDIO OU IMAGEM RECEBIDO]:`,
        });
        contentsParts.push({
          inlineData: {
            mimeType: mediaBase64.mimeType,
            data: mediaBase64.data,
          },
        });
        contentsParts.push({
          text: `RESPONDA AGORA COMO HELOÍSA diretamente ao áudio/imagem acima (Lembre-se da tag [ACAO: ...] na última linha):`,
        });
      } else {
        contentsParts.push({ text: promptFinal });
      }

      // Tenta até 3 vezes por modelo em caso de 503/429
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: contentsParts }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
                thinkingConfig: { thinkingBudget: 0 },
              },
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              ],
            }),
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            const cand = data?.candidates?.[0];
            const texto = cand?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("\n");
            if (texto && texto.trim()) {
              return texto.trim();
            }
            console.warn(`[GEMINI VAZIO] Modelo ${modelo} sem texto. FinishReason: ${cand?.finishReason}`);
            break;
          } else {
            const errText = await res.text();
            console.error(`[GEMINI HTTP ${res.status}] Modelo ${modelo} (tentativa ${tentativa}): ${errText}`);
            if ((res.status === 429 || res.status === 503) && tentativa < 3) {
              await new Promise((r) => setTimeout(r, 1000 * tentativa));
              continue;
            }
            break;
          }
        } catch (fetchErr: any) {
          clearTimeout(timeout);
          console.warn(`[GEMINI FETCH ERR] Modelo ${modelo} tentativa ${tentativa}: ${fetchErr.message}`);
          if (tentativa < 3) {
            await new Promise((r) => setTimeout(r, 1000 * tentativa));
            continue;
          }
          break;
        }
      }
    } catch (e: any) {
      console.warn(`Erro no modelo ${modelo}:`, e.message);
    }
  }

  // Fallback seguro em caso de indisponibilidade extrema de todos os modelos
  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "amigo";
  return `Olá, ${primeiroNome}! Tive uma oscilação pontual na conexão. Poderia me mandar novamente por gentileza? Estou por aqui para te ajudar! 💈✨\n[ACAO: CONVERSAR]`;
}

// ====================================================================
// FORMATAÇÃO LIMPA E REMOÇÃO DE TAGS TÉCNICAS
// ====================================================================
export function formatarRespostaFinal3(texto: string, nomeAgente: string = "Heloísa"): string {
  if (!texto) return "";
  let limpo = texto.trim();
  limpo = limpo.replace(/\[ACAO:[^\]]+\]/gi, "").trim();
  limpo = limpo.replace(/^(Draft|Opção|Option|Rascunho)\s*\d+.*?:?\*?\s*/i, "").trim();
  limpo = limpo.replace(/^\*?(Draft|Opção|Option|Rascunho)\s*\d+.*?\*?:?\s*/i, "").trim();

  // 1. Sanitização profunda de URLs: repara links que foram acidentalmente quebrados por nova linha
  limpo = limpo.replace(/(https?:\/\/[^\s\n]+)\s*\n\s*([a-zA-Z0-9_\-\.]+\.(?:booksy\.com|com\.br|bit\.ly|app\.link)[^\s]*)/gi, "$1$2");
  limpo = limpo.replace(/(https?:\/\/[^\s\n\/]+)\s*\n\s*([a-zA-Z0-9_\-\.]+\.[a-zA-Z]{2,}[^\s]*)/gi, "$1$2");

  // 2. Se o endereço ficou grudado entre parênteses logo após a barra da URL, quebra em linha própria com ícone 📍
  limpo = limpo.replace(/(https?:\/\/[^\s\)]+)\s*\((R\.|Av\.|Rua|Avenida|Alameda|Travessa)(.*?)\)/gi, "$1\n📍 $2$3");

  // Garante a assinatura elegante da barbearia se não estiver presente
  if (!limpo.startsWith("*") && !limpo.toLowerCase().includes("barbearia hermanos")) {
    limpo = `*${nomeAgente} - Barbearia Hermanos* 💈\n\n${limpo}`;
  }
  return limpo;
}

// ====================================================================
// DISPARO DE MENSAGENS VIA META GRAPH API (OFICIAL)
// ====================================================================
export async function enviarMensagemWhatsAppMeta3(toPhone: string, text: string) {
  try {
    const url = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "text",
        text: { preview_url: true, body: text },
      }),
    });
    return await res.json();
  } catch (e) {
    console.error("Erro Meta API:", e);
  }
}

export async function enviarBotoesMeta3(toPhone: string, bodyText: string, botoes: Array<{ id: string; title: string }>) {
  try {
    if (bodyText.length > 1000) {
      return await enviarMensagemWhatsAppMeta3(toPhone, bodyText);
    }
    const url = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: botoes.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    });
    return await res.json();
  } catch (e) {
    console.error("Erro Meta Buttons:", e);
    await enviarMensagemWhatsAppMeta3(toPhone, bodyText);
  }
}

export async function marcarComoLidaMeta3(messageId: string) {
  try {
    const url = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (_) {}
}

export async function baixarMidiaMeta3(mediaId: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const resMeta = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
    });
    if (!resMeta.ok) return null;
    const dataMeta = await resMeta.json();
    const downloadUrl = dataMeta.url;
    if (!downloadUrl) return null;

    const resBinary = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
    });
    if (!resBinary.ok) return null;

    const mimeType = resBinary.headers.get("content-type") || dataMeta.mime_type || "audio/ogg";
    const arrayBuffer = await resBinary.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { mimeType, data: base64 };
  } catch (e: any) {
    console.error("Erro ao baixar mídia da Meta:", e.message);
    return null;
  }
}

// ====================================================================
// PERSISTÊNCIA DE CANDIDATURAS NO BANCO DE TALENTOS
// ====================================================================
export async function salvarCandidatoNoBanco3(
  supabase: any,
  empresaId: string,
  whatsappPhone: string,
  nomeCliente: string,
  tagAcao: string
) {
  try {
    if (!tagAcao.includes("CANDIDATO")) return;

    const matchNome = tagAcao.match(/NOME:\s*([^|]+)/i);
    const matchUnidades = tagAcao.match(/UNIDADES?:\s*([^|]+)/i);
    const matchExp = tagAcao.match(/EXPERIENCIA:\s*([^|]+)/i);
    const matchInsta = tagAcao.match(/INSTAGRAM:\s*([^|]+)/i);
    const matchDisp = tagAcao.match(/DISPONIBILIDADE:\s*([^|]+)/i);

    const nome = matchNome && temValorReal(matchNome[1]) ? matchNome[1].trim() : (nomeCliente || "Candidato WhatsApp");
    const exp = matchExp && temValorReal(matchExp[1]) ? matchExp[1].trim() : "";
    const insta = matchInsta && temValorReal(matchInsta[1]) ? matchInsta[1].trim() : "";
    const disp = matchDisp && temValorReal(matchDisp[1]) ? matchDisp[1].trim() : "";
    const unidades = matchUnidades && temValorReal(matchUnidades[1])
      ? matchUnidades[1].split(",").map((u: string) => u.trim()).filter(Boolean)
      : [];

    const { data: existente } = await supabase
      .from("candidatos_barbeiros")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("whatsapp_phone", whatsappPhone)
      .maybeSingle();

    if (existente) {
      await supabase.from("candidatos_barbeiros").update({
        nome,
        tempo_experiencia: exp,
        instagram_portfolio: insta,
        disponibilidade_inicio: disp,
        unidades_interesse: unidades,
        atualizado_em: new Date().toISOString(),
      }).eq("id", existente.id);
    } else {
      await supabase.from("candidatos_barbeiros").insert({
        empresa_id: empresaId,
        whatsapp_phone: whatsappPhone,
        nome,
        tempo_experiencia: exp,
        instagram_portfolio: insta,
        disponibilidade_inicio: disp,
        unidades_interesse: unidades,
        status: "novo",
      });
    }
    console.log(`💈 [BANCO DE TALENTOS] Candidatura salva com sucesso para ${whatsappPhone} (${nome})`);
  } catch (err: any) {
    console.error("Erro ao salvar candidato:", err.message);
  }
}

// ====================================================================
// PROCESSADOR CENTRAL DA MENSAGEM (VERSÃO 3.0)
// ====================================================================
export async function processarMensagem3(message: any, contactName: string) {
  const from = message.from;
  const msgId = message.id;

  if (from === "551141188017" || from === META_PHONE_NUMBER_ID || from === "1342513118936733") {
    return;
  }

  let textBody = "";
  let buttonId = "";
  let mediaBase64: { mimeType: string; data: string } | null = null;

  if (message.type === "text") {
    textBody = message.text?.body || "";
  } else if (message.type === "interactive") {
    buttonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || "";
    textBody = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
  } else if (message.type === "audio" && message.audio?.id) {
    mediaBase64 = await baixarMidiaMeta3(message.audio.id);
    textBody = "[Áudio de voz recebido]";
  } else if (message.type === "image" && message.image?.id) {
    mediaBase64 = await baixarMidiaMeta3(message.image.id);
    textBody = message.image?.caption || "[Imagem recebida]";
  }

  if (!textBody.trim() && !mediaBase64) return;

  if (msgId) {
    marcarComoLidaMeta3(msgId);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Trava de Idempotência no Banco
  const { data: convCheck } = await supabase
    .from("whatsapp_conversas")
    .select("id, atendimento_humano, flow_state")
    .eq("telefone", from)
    .maybeSingle();

  if (msgId && convCheck?.flow_state?.processed_wamids?.includes(msgId)) {
    console.log(`[DEDUP] WAMID ${msgId} já processado.`);
    return;
  }

  if (convCheck && msgId) {
    const updatedWamids = [...(convCheck.flow_state?.processed_wamids || []).slice(-30), msgId];
    await supabase.from("whatsapp_conversas").update({
      flow_state: { ...(convCheck.flow_state || {}), processed_wamids: updatedWamids },
    }).eq("id", convCheck.id);
  }

  // 2. Localizar ou Cadastrar Cliente
  let clienteId: string | null = null;
  try {
    const cleanPhone = from.replace(/\D/g, "");
    const phoneWithout55 = cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone;
    const { data: cli } = await supabase
      .from("clientes")
      .select("id, nome")
      .or(`telefone.ilike.%${phoneWithout55}%,telefone.ilike.%${cleanPhone}%`)
      .limit(1)
      .maybeSingle();

    if (cli) {
      clienteId = cli.id;
    } else {
      const { data: novoCli } = await supabase
        .from("clientes")
        .insert({ nome: contactName || "Cliente WhatsApp", telefone: from, empresa_id: DEFAULT_EMPRESA_ID })
        .select("id")
        .single();
      if (novoCli) clienteId = novoCli.id;
    }
  } catch (_) {}

  // 3. Salvar Mensagem de Entrada
  try {
    await supabase.from("whatsapp_mensagens").insert({
      telefone: from,
      cliente_id: clienteId,
      mensagem: message.type === "interactive" ? `👆 ${textBody}` : textBody,
      direcao: "entrada",
      tipo: message.type,
      lida: false,
    });
  } catch (_) {}

  const txtTrim = semAcentos(textBody.trim());

  // 4. Comando /reset Explícito
  if (txtTrim === "/reset" || txtTrim === "#reset") {
    try {
      await supabase.from("whatsapp_mensagens").delete().eq("telefone", from);
      await supabase.from("whatsapp_conversas").delete().eq("telefone", from);
    } catch (_) {}

    const primeiroNome = contactName ? contactName.split(" ")[0] : "amigo";
    const msgReset = `*Heloísa - Barbearia Hermanos* 💈\n\n✨ Histórico resetado com sucesso, ${primeiroNome}! Como posso te ajudar hoje na Barbearia Hermanos?`;

    await supabase.from("whatsapp_mensagens").insert({
      telefone: from,
      mensagem: msgReset,
      direcao: "saida",
      tipo: "ia",
      lida: true,
    });

    await supabase.from("whatsapp_conversas").insert({
      telefone: from,
      nome_contato: contactName,
      status: "ativa",
      atendimento_humano: false,
      ultima_mensagem: msgReset,
      ultima_mensagem_at: new Date().toISOString(),
      nao_lidas: 0,
      booking_state: {},
    });

    await enviarBotoesMeta3(from, msgReset, [
      { id: "btn_agendar", title: "📅 Agendar Horário" },
      { id: "btn_planos", title: "👑 Assinatura Infinite" },
    ]);
    return;
  }

  // 5. Verificar Atendimento Humano
  if (convCheck?.atendimento_humano === true && txtTrim !== "/ativar" && txtTrim !== "/ia") {
    await supabase.from("whatsapp_conversas").update({
      ultima_mensagem: textBody,
      ultima_mensagem_at: new Date().toISOString(),
    }).eq("id", convCheck.id);
    return;
  }

  // 6. Carregar Histórico e Parâmetros do CRM
  let historicoTexto = "";
  try {
    const { data: msgs } = await supabase
      .from("whatsapp_mensagens")
      .select("mensagem, direcao")
      .eq("telefone", from)
      .order("created_at", { ascending: false })
      .limit(16);

    if (msgs && msgs.length > 0) {
      historicoTexto = msgs
        .reverse()
        .map((m) => `[${m.direcao === "entrada" ? contactName || "Cliente" : "Heloísa"}]: ${m.mensagem.replace(/^\*.*?\*\s*💈\s*/i, "")}`)
        .join("\n");
    }
  } catch (_) {}

  // Carregar configurações do Agente IA no CRM
  let nomeAgente = "Heloísa";
  let tomAgente = "Simpática, acolhedora e profissional";
  let instrucoesExtras = "";
  try {
    const { data: agente } = await supabase
      .from("agentes_ia")
      .select("nome, tom, instrucoes_extras, prompt_v01_booksy")
      .eq("empresa_id", DEFAULT_EMPRESA_ID)
      .maybeSingle();

    if (agente) {
      nomeAgente = agente.nome || "Heloísa";
      tomAgente = agente.tom || "Simpática, acolhedora e profissional";
      instrucoesExtras = agente.prompt_v01_booksy || agente.instrucoes_extras || "";
    }
  } catch (_) {}

  // Carregar produtos da Hermanos cadastrados no banco de dados
  let produtosExtras = "";
  try {
    const { data: prods } = await supabase
      .from("produtos")
      .select("nome, preco, descricao, categoria")
      .eq("status", "active")
      .order("categoria");
    if (prods && prods.length > 0) {
      produtosExtras = prods
        .map((p: any) => `• ${p.nome} (R$ ${Number(p.preco).toFixed(2).replace(".", ",")})${p.descricao ? ` - ${p.descricao}` : ""}`)
        .join("\n");
    }
  } catch (_) {}

  // 7. Construir Prompt Master 3.0 e Gerar Resposta com Gemini 3.x
  const promptSistema = construirPromptMaster3(
    contactName,
    from,
    nomeAgente,
    tomAgente,
    instrucoesExtras,
    produtosExtras
  );

  const respostaCrua = await gerarRespostaGemini3(
    promptSistema,
    historicoTexto,
    textBody,
    contactName,
    mediaBase64
  );

  // Extrair tag de ação e formatar mensagem
  const matchAcao = respostaCrua.match(/\[ACAO:\s*([^\]]+)\]/i);
  const tagAcao = matchAcao ? matchAcao[1] : "CONVERSAR";
  const respostaFinal = formatarRespostaFinal3(respostaCrua, nomeAgente);

  // 8. Executar Ações Estruturadas
  if (tagAcao.includes("CANDIDATO")) {
    await salvarCandidatoNoBanco3(supabase, DEFAULT_EMPRESA_ID, from, contactName, tagAcao);
  } else if (tagAcao.includes("HUMANO")) {
    await supabase.from("whatsapp_conversas").update({
      atendimento_humano: true,
      status: "humano",
    }).eq("telefone", from);
  }

  // 9. Salvar Mensagem de Saída e Atualizar Conversa
  try {
    await supabase.from("whatsapp_mensagens").insert({
      telefone: from,
      cliente_id: clienteId,
      mensagem: respostaFinal,
      direcao: "saida",
      tipo: "ia",
      lida: true,
    });

    await supabase.from("whatsapp_conversas").upsert({
      telefone: from,
      nome_contato: contactName,
      cliente_id: clienteId,
      status: tagAcao.includes("HUMANO") ? "humano" : "ativa",
      atendimento_humano: tagAcao.includes("HUMANO"),
      ultima_mensagem: respostaFinal,
      ultima_mensagem_at: new Date().toISOString(),
      nao_lidas: 0,
      empresa_id: DEFAULT_EMPRESA_ID,
    }, { onConflict: "telefone" });
  } catch (_) {}

  // 10. Disparar Resposta no WhatsApp Meta
  // Se for uma saudação curta inicial sem histórico prévio, oferece botões rápidos
  const ehSaudacaoInicial =
    !historicoTexto &&
    (txtTrim === "ola" || txtTrim === "oi" || txtTrim === "bom dia" || txtTrim === "boa tarde" || txtTrim === "boa noite");

  if (ehSaudacaoInicial) {
    await enviarBotoesMeta3(from, respostaFinal, [
      { id: "btn_agendar", title: "📅 Agendar Horário" },
      { id: "btn_planos", title: "👑 Assinatura Infinite" },
    ]);
  } else {
    await enviarMensagemWhatsAppMeta3(from, respostaFinal);
  }
}

// ====================================================================
// SERVIDOR HTTP DENO (ROTEAMENTO E HANDSHAKE META)
// ====================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // 1. HANDSHAKE DE VALIDAÇÃO DO WEBHOOK META (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook Meta verificado com sucesso!");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. RECEPÇÃO DE EVENTOS E AÇÕES (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // --- Ações de Manutenção e Testes CRM ---
      if (body?.action === "send_manual_message") {
        const to = body.to;
        const text = body.text;
        if (!to || !text) {
          return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resMeta = await enviarMensagemWhatsAppMeta3(to, text);
        return new Response(JSON.stringify({ success: !resMeta?.error, resMeta }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body?.action === "test_connection") {
        const testUrl = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}`;
        const resTest = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
        });
        const dataTest = await resTest.json();
        return new Response(JSON.stringify({ online: resTest.ok, dados: dataTest }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body?.action === "list_models") {
        const resList = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        const dataList = await resList.json();
        return new Response(JSON.stringify(dataList), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body?.action === "test_gemini") {
        const model = body.model || "gemini-3.8-flash";
        const text = body.text || "Ola";
        const urlG = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const resG = await fetch(urlG, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 }
            },
          }),
        });
        const dataG = await resG.json();
        return new Response(JSON.stringify({ status: resG.status, ok: resG.ok, model, data: dataG }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body?.action === "test_ads_connection") {
        const adAccountId = (body.ad_account_id || "act_939706096831223").replace(/^act_/, "");
        const testUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}?fields=name,account_id,currency,account_status,amount_spent`;
        const resTest = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
        });
        const dataTest = await resTest.json();
        return new Response(JSON.stringify({ ok: resTest.ok, status: resTest.status, dados: dataTest }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- Ação App Chat (Direto do Aplicativo sem custo Meta) ---
      if (body?.action === "app_chat") {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const textoEntrada = body.mensagem || "";
        const nomeCliente = body.nome_cliente || "Cliente";
        const telefoneCliente = body.telefone || "";

        let instrucoesExtras = "";
        try {
          const { data: agente } = await supabase
            .from("agentes_ia")
            .select("prompt_v01_booksy, instrucoes_extras")
            .eq("empresa_id", DEFAULT_EMPRESA_ID)
            .maybeSingle();
          if (agente) instrucoesExtras = agente.prompt_v01_booksy || agente.instrucoes_extras || "";
        } catch (_) {}

        let produtosExtras = "";
        try {
          const { data: prods } = await supabase
            .from("produtos")
            .select("nome, preco, descricao, categoria")
            .eq("status", "active")
            .order("categoria");
          if (prods && prods.length > 0) {
            produtosExtras = prods
              .map((p: any) => `• ${p.nome} (R$ ${Number(p.preco).toFixed(2).replace(".", ",")})${p.descricao ? ` - ${p.descricao}` : ""}`)
              .join("\n");
          }
        } catch (_) {}

        const historicoMsgs = Array.isArray(body.historico) ? body.historico : [];
        const historicoTexto = historicoMsgs
          .map((m: any) => `[${m.origem === "usuario" ? nomeCliente : "Heloísa"}]: ${m.texto}`)
          .join("\n");

        const promptSistema = construirPromptMaster3(nomeCliente, telefoneCliente, "Heloísa", "Simpática, acolhedora e profissional", instrucoesExtras, produtosExtras);
        const respostaCrua = await gerarRespostaGemini3(promptSistema, historicoTexto, textoEntrada, nomeCliente);
        const matchAcao = respostaCrua.match(/\[ACAO:\s*([^\]]+)\]/i);
        const tagAcao = matchAcao ? matchAcao[1] : "CONVERSAR";
        const respostaFinal = formatarRespostaFinal3(respostaCrua, "Heloísa").replace(/^\*Heloísa - Barbearia Hermanos\*\s*💈\s*/i, "").trim();

        return new Response(
          JSON.stringify({
            resposta: respostaFinal,
            tag_acao: tagAcao,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Webhook Oficial do WhatsApp Meta ---
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const message = changes?.messages?.[0];

      // Ignora eventos de status de entrega (sent, delivered, read)
      if (!message) {
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      if (isDuplicate(message.id)) {
        return new Response("DUPLICATE_IGNORED", { status: 200 });
      }

      const contactName = changes?.contacts?.[0]?.profile?.name || "Cliente";

      // Responde instantaneamente à Meta em < 100ms para evitar timeouts e retries
      // @ts-ignore: EdgeRuntime presente no Supabase Deno runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(processarMensagem3(message, contactName));
      } else {
        processarMensagem3(message, contactName).catch((err) => {
          console.error("Erro assíncrono ao processar mensagem:", err);
        });
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err: any) {
      console.error("Erro no processamento do webhook:", err.message);
      return new Response("INTERNAL_ERROR", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

