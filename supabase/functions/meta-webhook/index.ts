import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "hermanos_zap_webhook_secret_2026";
const META_ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN") || "";
const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_ID") || Deno.env.get("META_PHONE_NUMBER_ID") || "433100683226162";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://khoeovszuixfwfkaaxaa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const DEFAULT_EMPRESA_ID = "93d24bc4-e371-4395-8ed8-636d02575de6";

// Trava anti-duplicação de webhook em memória (5 minutos)
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

// Mapeamento dos barbeiros da Hermanos
const MAPA_BARBEIROS: Record<string, string> = {
  h1: "H1", kadu: "H1", "carlos eduardo": "H1", carlos: "H1", eduardo: "H1",
  h2: "H2", navalha: "H2", matheus: "H2", mateus: "H2",
  h3: "H3", biel: "H3", gabriel: "H3",
  h4: "H4", dread: "H4", lucas: "H4",
  h5: "H5", bigode: "H5", diego: "H5",
  h6: "H6", fafa: "H6", rafael: "H6",
  h7: "H7", bala: "H7", bruno: "H7",
  h8: "H8", viti: "H8", victor: "H8", vitor: "H8",
};

// Validador estrito de barbeiros da Hermanos (Detecta solicitações válidas e rejeita inválidas como H9, H10, Pedro, etc.)
function detectarBarbeiroNoTexto(texto: string, codigosValidos: string[]): { codigoValido: string; codigoInvalido: string } {
  const txtNorm = semAcentos(texto || "");

  // 1. Procura por menções a H seguido de dígitos: H1, H2, H 10, H10, H99...
  const matchH = txtNorm.match(/(?<!\d\s*)\bh\s*(\d+)\b/i);
  if (matchH) {
    const cod = `H${matchH[1]}`;
    if (codigosValidos.includes(cod)) {
      return { codigoValido: cod, codigoInvalido: "" };
    } else {
      return { codigoValido: "", codigoInvalido: cod };
    }
  }

  // 2. Procura por "barbeiro 1", "profissional 10", "cadeira 5", etc.
  const matchNum = txtNorm.match(/\b(?:barbeiro|profissional|cadeira)\s+(\d+)\b/i);
  if (matchNum) {
    const cod = `H${matchNum[1]}`;
    if (codigosValidos.includes(cod)) {
      return { codigoValido: cod, codigoInvalido: "" };
    } else {
      return { codigoValido: "", codigoInvalido: cod };
    }
  }

  // 3. Procura por apelidos/nomes conhecidos (Kadu, Navalha, Biel, etc.)
  for (const [apelido, cod] of Object.entries(MAPA_BARBEIROS)) {
    if (new RegExp(`\\b${apelido}\\b`, "i").test(txtNorm)) {
      if (codigosValidos.includes(cod)) {
        return { codigoValido: cod, codigoInvalido: "" };
      }
    }
  }

  // 4. Procura por "barbeiro [Nome]" ou "profissional [Nome]" com nome inexistente
  const matchNome = txtNorm.match(/\b(?:barbeiro|profissional)\s+([a-z]+)\b/i);
  if (matchNome) {
    const nomeTentado = matchNome[1].toLowerCase();
    const palavrasIgnoradas = [
      "disponivel", "qualquer", "melhor", "da", "de", "do", "que", "excelente",
      "bom", "novo", "outro", "responsavel", "preferido", "hoje", "amanha",
      "sabado", "segunda", "terca", "quarta", "quinta", "sexta", "domingo",
      "agora", "certo", "fixo", "especifico", "livre"
    ];
    if (!palavrasIgnoradas.includes(nomeTentado)) {
      let achou = false;
      for (const [apelido, cod] of Object.entries(MAPA_BARBEIROS)) {
        if (apelido === nomeTentado || apelido.includes(nomeTentado) || nomeTentado.includes(apelido)) {
          achou = true;
          if (codigosValidos.includes(cod)) return { codigoValido: cod, codigoInvalido: "" };
        }
      }
      if (!achou) {
        return { codigoValido: "", codigoInvalido: matchNome[1].charAt(0).toUpperCase() + matchNome[1].slice(1) };
      }
    }
  }

  return { codigoValido: "", codigoInvalido: "" };
}

// Coordenadas GPS & Links do Booksy Oficiais das Unidades
const UNIDADES_GPS: Record<string, { lat: number; lng: number; nome: string; endereco: string; link_booksy: string }> = {
  higienopolis: { lat: -23.5465, lng: -46.6575, nome: "Barbearia Hermanos - Higienópolis", endereco: "Av. Angélica, 1617 - Higienópolis, São Paulo - SP", link_booksy: "https://bit.ly/3BarbeariaHermanosSantaCecilia" },
  itaim: { lat: -23.5835, lng: -46.6775, nome: "Barbearia Hermanos - Itaim Bibi", endereco: "R. João Cachoeira, 750 - Itaim Bibi, São Paulo - SP", link_booksy: "https://bit.ly/3yGUY63" },
  mooca: { lat: -23.5555, lng: -46.5985, nome: "Barbearia Hermanos - Mooca", endereco: "R. da Mooca, 2341 - Mooca, São Paulo - SP", link_booksy: "https://barbeariahermanosmooca.booksy.com/" },
  tatuape: { lat: -23.5415, lng: -46.5685, nome: "Barbearia Hermanos - Tatuapé", endereco: "R. Itapura, 744 - Vila Gomes Cardim, São Paulo - SP", link_booksy: "https://hermanostatuape.booksy.com/" },
  osasco: { lat: -23.5325, lng: -46.7755, nome: "Barbearia Hermanos - Osasco", endereco: "Av. dos Autonomistas, 3001 - Centro, Osasco - SP", link_booksy: "https://barbeariahermanosos.booksy.com/" },
  caetano: { lat: -23.6215, lng: -46.5625, nome: "Barbearia Hermanos - São Caetano", endereco: "R. Visconde de Inhaúma, 313 - Oswaldo Cruz, São Caetano do Sul - SP", link_booksy: "https://bit.ly/3W42IXa" },
  freguesia: { lat: -23.5045, lng: -46.6755, nome: "Barbearia Hermanos - Freguesia do Ó", endereco: "Av. Inajar de Souza, 263B - Limão, São Paulo - SP", link_booksy: "https://bit.ly/AgendaBarbeariaHermanos" },
};

// Calendário em tempo real de São Paulo
function obterCalendarioAtual(): { dataHojeFmt: string; diasSemanaFmt: string } {
  const agora = new Date();
  const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const diaSemanaHoje = diasDaSemana[agora.getDay()];
  const diaNumHoje = agora.getDate();
  const mesHoje = meses[agora.getMonth()];
  const anoHoje = agora.getFullYear();
  const horaFmt = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  const dataHojeFmt = `${diaSemanaHoje}, ${diaNumHoje} de ${mesHoje} de ${anoHoje} às ${horaFmt}`;

  const proximosDias: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date(agora);
    d.setDate(agora.getDate() + i);
    const diaNome = diasDaSemana[d.getDay()];
    const diaStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const label = i === 0 ? "HOJE" : i === 1 ? "AMANHÃ" : diaNome.toUpperCase();
    proximosDias.push(`• ${label} é ${diaNome} (${diaStr})`);
  }

  return { dataHojeFmt, diasSemanaFmt: proximosDias.join("\n") };
}

// Formatação da Ocupação da Agenda em Tempo Real (Anti-Overbooking e Anti-Alucinação de Vagas)
function formatarOcupacaoAgenda(agendamentosOcupados: any[]): string {
  if (!agendamentosOcupados || agendamentosOcupados.length === 0) {
    return "Todos os profissionais possuem horários livres nos próximos dias.";
  }

  const mapa: Record<string, { diaMes: string; barbeiros: Record<string, string[]> }> = {};
  agendamentosOcupados.forEach((item) => {
    const d = new Date(item.data_hora);
    const dataIso = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
    const diaMes = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const horaStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const barbeiro = item.barbeiros?.codigo_cadeira || "H1";

    if (!mapa[dataIso]) mapa[dataIso] = { diaMes, barbeiros: {} };
    if (!mapa[dataIso].barbeiros[barbeiro]) mapa[dataIso].barbeiros[barbeiro] = [];
    if (!mapa[dataIso].barbeiros[barbeiro].includes(horaStr)) {
      mapa[dataIso].barbeiros[barbeiro].push(horaStr);
    }
  });

  const linhas: string[] = [];
  Object.keys(mapa).sort().forEach((dt) => {
    const item = mapa[dt];
    const bPartes = Object.keys(item.barbeiros).sort().map(
      (b) => `${b} OCUPADO às [${item.barbeiros[b].join(", ")}]`
    );
    linhas.push(`• ${item.diaMes} (${dt}): ${bPartes.join(" | ")}`);
  });

  return linhas.join("\n");
}

function formatarRespostaFinal(texto: string, nomeAtendente: string = "Heloísa"): string {
  if (!texto) return "";
  let limpo = texto.trim();

  // Remove eventuais tags de ação do texto que o cliente vai ler
  limpo = limpo.replace(/\[ACAO:[^\]]+\]/gi, "").trim();
  limpo = limpo.replace(/^(Draft|Opção|Option|Rascunho)\s*\d+.*?:?\*?\s*/i, "").trim();
  limpo = limpo.replace(/^\*?(Draft|Opção|Option|Rascunho)\s*\d+.*?\*?:?\s*/i, "").trim();

  // Converte markdown links [Texto](url) para formato nativo do WhatsApp (Texto: url)
  limpo = limpo.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, "$1: $2");

  // Converte asteriscos duplos (**texto**) em negrito padrão do WhatsApp (*texto*)
  limpo = limpo.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  const etiqueta = `*${nomeAtendente} - Barbearia Hermanos* 💈`;
  if (!limpo.startsWith(`*${nomeAtendente}`) && !limpo.startsWith(`[${nomeAtendente}`)) {
    limpo = `${etiqueta}\n\n${limpo}`;
  }
  return limpo;
}

// Baixar mídia da Meta Cloud API com timeout de segurança
async function baixarMidiaMeta(mediaId: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const urlRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
      signal: controller.signal,
    });
    const urlData = await urlRes.json();
    clearTimeout(timeout);
    if (!urlData?.url) return null;

    const fileRes = await fetch(urlData.url, {
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
    });
    const arrayBuffer = await fileRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return {
      mimeType: urlData.mime_type || "audio/ogg",
      data: base64,
    };
  } catch (e: any) {
    console.error("Erro ao baixar mídia da Meta:", e.message);
    return null;
  }
}

// Helper para checar horário comercial do transbordo humano (Seg a Sex das 09:00 às 18:00)
function estaEmHorarioComercial(): boolean {
  try {
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaSemana = agoraSP.getDay(); // 0 = Dom, 1 = Seg, ..., 5 = Sex, 6 = Sáb
    const hora = agoraSP.getHours();
    return diaSemana >= 1 && diaSemana <= 5 && hora >= 9 && hora < 18;
  } catch (_) {
    const d = new Date();
    const diaSemana = d.getUTCDay();
    const hora = d.getUTCHours() - 3;
    return diaSemana >= 1 && diaSemana <= 5 && hora >= 9 && hora < 18;
  }
}

// Helper para indicar dinamicamente quando a recepção humana reabre
function obterProximoHorarioComercial(): string {
  try {
    const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const diaSemana = agoraSP.getDay(); // 0 = Dom, 1 = Seg, ..., 5 = Sex, 6 = Sáb
    const hora = agoraSP.getHours();

    if (diaSemana === 5 && hora >= 18) {
      return "na próxima segunda-feira às 09:00";
    } else if (diaSemana === 6 || diaSemana === 0) {
      return "na próxima segunda-feira às 09:00";
    } else if (hora >= 18) {
      return "amanhã às 09:00";
    } else if (hora < 9) {
      return "hoje às 09:00";
    }
    return "de segunda a sexta-feira, das 09:00 às 18:00";
  } catch (_) {
    return "na próxima segunda-feira às 09:00";
  }
}

// Detector inteligente de solicitações de atendimento humano em linguagem natural
function ehSolicitacaoAtendimentoHumano(texto: string, buttonId: string): boolean {
  if (
    buttonId === "btn_falar_humano" ||
    buttonId === "btn_humano" ||
    buttonId === "btn_falar_equipe"
  ) {
    return true;
  }

  const txtNorm = semAcentos(texto || "").trim();
  if (!txtNorm) return false;

  const termosDiretos = [
    "/humano", "/parar", "/stop", "/pausar", "parar ia", "desativar ia",
    "falar com humano", "falar c/ humano", "falar com atendente", "falar c/ atendente",
    "falar com recepcao", "falar c/ recepcao", "falar com equipe", "falar c/ equipe",
    "falar com gerente", "falar c/ gerente", "atendente humano", "atendimento humano",
    "pessoa de carne e osso", "falar com uma pessoa", "falar com alguem", "falar c/ alguem"
  ];

  if (termosDiretos.some((t) => txtNorm.includes(t))) return true;

  const regexHumano = /\b(?:transferir|transfere|passar|passa|chamar|chama|falar|conversar|atender)\b.*?\b(?:humano|atendente|recepcao|gerente|equipe|pessoa)\b/i;
  const regexHumanoInverso = /\b(?:humano|atendente|recepcao|gerente|equipe|pessoa)\b.*?\b(?:transferir|transfere|passar|passa|chamar|chama|falar|conversar|atender)\b/i;

  return regexHumano.test(txtNorm) || regexHumanoInverso.test(txtNorm);
}

// Construção do Prompt Master da Heloísa com regras rígidas à prova de falhas
function construirPromptMaster(
  nomeCliente: string,
  telefoneCliente: string,
  codigoProfissional: string,
  unidadesDb: Array<{ id: string; nome: string; endereco: string; telefone?: string; horario_abertura?: string; horario_fechamento?: string; link_booksy?: string }>,
  servicosDb: Array<{ id: string; nome: string; preco: number; duracao_minutos?: number }>,
  produtosDb: Array<{ nome: string; preco: number; categoria: string; estoque: number }>,
  barbeirosCodigos: string[],
  agendamentoAtivoInfo: string = "",
  bookingState: any = {},
  nomeAgente: string = "Heloísa",
  tomAgente: string = "Simpática, acolhedora e profissional",
  instrucoesExtrasDb: string = "",
  feriadosDb: any[] = [],
  barbeirosDb: any[] = [],
  barbeiroInvalidoSolicitado: string = "",
  clientePerfil: any = null,
  historicoAgendamentos: any[] = [],
  agendamentosOcupadosDb: any[] = [],
  modoV01Booksy: boolean = false,
  promptV01Booksy: string = ""
): string {
  if (modoV01Booksy) {
    const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "Cliente";
    const emHorarioComercial = estaEmHorarioComercial();
    const proximoHorario = obterProximoHorarioComercial();

    return `====================================================================
PROMPT MASTER: ${nomeAgente.toUpperCase()} - ATENDIMENTO OFICIAL DA BARBEARIA HERMANOS
====================================================================
VOCÊ É A ${nomeAgente.toUpperCase()}, ATENDENTE DA BARBEARIA HERMANOS.
TOM DE VOZ: ${tomAgente}.
FALE COMO UMA PESSOA REAL: Natural, simpática, objetiva e acolhedora.

🚫 PROIBIÇÃO ABSOLUTA DE TERMOS TÉCNICOS INTERNOS (INEGOCIÁVEL):
• NUNCA, em hipótese alguma, mencione frases como "como estou no modo Booksy", "modo Booksy", "modo paliativo", "modo v0.1", "sistema interno" ou "modo de agendamento" para o cliente!
• NUNCA fale sobre como o seu sistema funciona internamente ou que você está em um "modo" específico!
• Fale sempre de forma 100% natural, acolhedora e humana:
  "Por aqui pelo chat eu te envio o link de agendamento online da sua unidade para você escolher o melhor horário!" ou "Vou te enviar o link de agendamento online da sua unidade para você escolher o horário que preferir!"

⏰ HORÁRIO DO ATENDIMENTO HUMANO DA RECEPÇÃO:
• O atendimento humano com a recepção funciona exclusivamente de Segunda a Sexta-feira, das 09:00 às 18:00 (America/Sao_Paulo).
• STATUS ATUAL DA RECEPÇÃO AGORA: ${emHorarioComercial ? "DENTRO DO HORÁRIO COMERCIAL (Recepção ativa)" : `FORA DO HORÁRIO COMERCIAL (Recepção fechada - Retorna ${proximoHorario})`}

🚨 REGRA CRÍTICA DE TRANSBORDO / ATENDIMENTO HUMANO:
• Se o cliente solicitar falar com atendente humano, gerência ou recepção:
  - SE O STATUS AGORA FOR "FORA DO HORÁRIO COMERCIAL":
    🚫 É TERMINANTEMENTE PROIBIDO DIZER QUE NOTIFICOU A RECEPÇÃO OU QUE UM ATENDENTE VAI RESPONDER EM INSTANTES!
    ✨ Informe com clareza e gentileza que a recepção atende de segunda a sexta das 09:00 às 18:00 e no momento está fora do expediente (retorna ${proximoHorario}).
    ✨ Lembre o cliente de que você (Heloísa) está disponível 24h por aqui para ajudá-lo com agendamentos, dúvidas e planos. Convide-o a continuar tirando as dúvidas por aqui mesmo!

🚨 REGRA DE OURO PARA AGENDAMENTOS ONLINE (INEGOCIÁVEL / LINK DIRETO DA UNIDADE):
1. VOCÊ NÃO TEM ACESSO AO SISTEMA DE AGENDAMENTO DE VAGAS E HORÁRIOS DA BARBEARIA. VOCÊ NÃO PODE AGENDAR DIRETO PELO CHAT.
2. NUNCA PERGUNTE DIA E HORÁRIO PARA O CLIENTE! É TOTALMENTE PROIBIDO perguntar "Qual dia e horário você prefere?", "Para quando gostaria de agendar?" ou similar!
3. NUNCA SUGIRA VAGAS, HORÁRIOS OU DISPONIBILIDADE DA AGENDA!
4. QUANDO O CLIENTE QUISER AGENDAR UM HORÁRIO OU CONSULTAR DISPONIBILIDADE:
   a) Se ele AINDA NÃO informou em qual das 7 unidades prefere ser atendido, pergunte com gentileza em qual unidade ele prefere (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano do Sul ou Itaim Bibi).
   b) Se ele JÁ informou a unidade (ou assim que ele escolher a unidade), envie IMEDIATAMENTE e EXCLUSIVAMENTE o link do Booksy daquela unidade correspondente para que ele consulte a agenda e agende diretamente pelo Booksy!
5. 🚫 PROIBIÇÃO ABSOLUTA DE LINKS DO APP DO CLIENTE PARA AGENDAMENTO: NUNCA envie links como barbeariahermanos.com.br/hermanos/cliente para o cliente agendar! O ÚNICO link para agendar é o link do Booksy da unidade dele (ex: Osasco -> https://barbeariahermanosos.booksy.com/)!

🏢 LINKS OFICIAIS DO BOOKSY POR UNIDADE (TODAS AS 7 UNIDADES ESTÃO COM AGENDAMENTO ABERTO NO BOOKSY):
• Higienópolis: https://bit.ly/3BarbeariaHermanosSantaCecilia (Endereço: Av. Angélica, 1617)
• Osasco: https://barbeariahermanosos.booksy.com/ (Endereço: Av. dos Autonomistas, 3001)
• Mooca: https://barbeariahermanosmooca.booksy.com/ (Endereço: R. da Mooca, 2341)
• Tatuapé: https://hermanostatuape.booksy.com/ (Endereço: R. Itapura, 744)
• Freguesia do Ó: https://bit.ly/AgendaBarbeariaHermanos (Endereço: Av. Inajar de Souza, 263B)
• São Caetano do Sul: https://bit.ly/3W42IXa (Endereço: R. Visconde de Inhaúma, 313)
• Itaim Bibi: https://bit.ly/3yGUY63 (Endereço: R. João Cachoeira, 750)

👑 PLANOS DE ASSINATURA INFINITE:
• INFINITE CUTS (R$ 99,89/mês): Cortes ilimitados. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-cuts)
• INFINITE DUOS (R$ 199,89/mês): Cortes + Barbas ilimitados + Sobrancelha inclusa. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-duos)
• INFINITE BARB (R$ 129,89/mês): Barbas ilimitadas com toalha quente. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-barb)
• INFINITE PLUS (R$ 34,90/mês): Pacote de hidratação, sobrancelha, limpeza de pele e depilação. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-plus)
• A Assinatura Infinite é uma cobrança mensal recorrente no cartão que NÃO compromete o limite total do cartão de crédito do cliente.
• Após assinar, o cliente pode agendar seu horário diretamente pelo link do Booksy da unidade dele.

⭐ REGRA DO CORTE TESTE (GATILHO DE FECHAMENTO PARA CLIENTES INDECISOS):
• O corte avulso (R$ 70,00) só é abonado/gratuito se o cliente assinar o plano Infinite durante o atendimento na barbearia. Se ele não assinar, paga o corte avulso normalmente. NUNCA prometemos corte grátis sem assinatura!

🚪 CANCELAMENTO DE ASSINATURA INFINITE:
• O cancelamento da Assinatura Infinite é realizado EXCLUSIVAMENTE de forma presencial na recepção da unidade onde foi contratada.

👤 CANCELAMENTO DE AGENDAMENTO OU HORÁRIO (VIA CHAT):
• Se o cliente pedir para cancelar um agendamento ou horário, confirme com simpatia e coloque a tag [ACAO: CANCELAR] na última linha.

💈 BANCO DE TALENTOS E RECRUTAMENTO DE BARBEIROS:
• Se o usuário perguntar sobre vaga de barbeiro, contratação, enviar currículo ou responder a anúncios de recrutamento (ex: "estão contratando?", "tem vaga para barbeiro?", "sou barbeiro", "vaga de emprego", "queria trabalhar com vocês"):
  1. Acolha com entusiasmo e profissionalismo: "Que demais o seu interesse em fazer parte da equipe da Barbearia Hermanos! 💈 Estamos sempre de olho em novos talentos para o nosso Banco de Talentos!"
  2. Colete de forma amigável e conversacional os 5 dados essenciais do candidato:
     - Nome completo
     - Unidades de interesse (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano ou Itaim Bibi)
     - Tempo de experiência como barbeiro (ex: 1 ano, 3 anos, etc.)
     - Instagram de trabalho / Portfólio (para a gerência ver as fotos dos cortes)
     - Disponibilidade para início (ex: Imediato, 1 semana, 15 dias, etc.)
  3. Assim que coletar os dados (ou as informações fornecidas), adicione OBRIGATORIAMENTE ao final da resposta a tag técnica:
     [ACAO: CANDIDATO | NOME: nome_do_candidato | UNIDADES: unidade1, unidade2 | EXPERIENCIA: tempo_exp | INSTAGRAM: @usuario_ou_link | DISPONIBILIDADE: inicio]
  4. Agradeça e confirme que a gerência analisará o perfil e entrará em contato assim que surgirem vagas na unidade desejada!

🚫 PROIBIÇÃO DE MENCIONAR BARBEIROS INDIVIDUAIS:
• NUNCA mencione nomes de barbeiros individuais nem códigos H1 a H8 nas suas respostas.

🛡️ BLOQUEIO DE ASSUNTOS FORA DE CONTEXTO:
• Se perguntarem sobre assuntos alheios à barbearia (receitas, esportes, planetas, etc.), recuse simpaticamente e traga de volta para os serviços e atendimento da Hermanos.

${promptV01Booksy ? `[DIRETRIZES DE ATENDIMENTO ONLINE DO CRM]:\n${promptV01Booksy}\n` : ""}${instrucoesExtrasDb ? `[DIRETRIZES PERSONALIZADAS DO CRM]:\n${instrucoesExtrasDb}\n` : ""}

====================================================================
[ESTRUTURA OBRIGATÓRIA DE CONTROLE TÉCNICO AO FINAL DA RESPOSTA]
====================================================================
Sempre adicione ao final da sua resposta (na última linha) UMA destas tags:
- Se o usuário estiver se candidatando a vaga de barbeiro:
  [ACAO: CANDIDATO | NOME: ... | UNIDADES: ... | EXPERIENCIA: ... | INSTAGRAM: ... | DISPONIBILIDADE: ...]
- Se o cliente pediu para cancelar um agendamento:
  [ACAO: CANCELAR]
- Para todas as demais conversas e envios de link do Booksy:
  [ACAO: CONVERSAR]`;
  }

  const { dataHojeFmt, diasSemanaFmt } = obterCalendarioAtual();
  let textoFeriados = "";
  if (feriadosDb && feriadosDb.length > 0) {
    const hojeIso = new Date().toISOString().split("T")[0];
    const proximos = feriadosDb.filter((f: any) => f.data >= hojeIso);
    if (proximos.length > 0) {
      textoFeriados = proximos.map((f: any) => {
        const [anoF, mesF, diaF] = f.data.split("-");
        const dataFmt = `${diaF}/${mesF}/${anoF}`;
        const st = f.fechado
          ? "FECHADO O DIA TODO"
          : `HORÁRIO ESPECIAL: ${f.horario_abertura ? f.horario_abertura.slice(0, 5) : "09:00"} às ${f.horario_fechamento ? f.horario_fechamento.slice(0, 5) : "14:00"}`;
        const escopo = f.unidade_id ? " (específico desta unidade)" : " (todas as unidades)";
        return `• ${dataFmt} - ${f.descricao}: ${st}${escopo}`;
      }).join("\n");
    }
  }
  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "Cliente";

  // Perfil e Histórico VIP do Cliente (Camada 2 - CRM da Hermanos)
  let blocoPerfilCliente = "";
  if (clientePerfil) {
    const planoAtivo = clientePerfil.status_assinatura === "active" || clientePerfil.status_assinatura === "ativa" || !!clientePerfil.plano_assinatura;
    const descPlano = planoAtivo ? `⭐ CLIENTE ASSINANTE: ${clientePerfil.plano_assinatura || "Assinatura Infinite"} (Status: Ativo)` : "Cliente Avulso (Sem assinatura ativa no momento)";
    const totalVisitas = clientePerfil.total_visitas || (historicoAgendamentos ? historicoAgendamentos.length : 0);
    
    let ultimosAgendamentosTxt = "Nenhum histórico anterior registrado.";
    if (historicoAgendamentos && historicoAgendamentos.length > 0) {
      ultimosAgendamentosTxt = historicoAgendamentos.slice(0, 3).map((h: any) => {
        const d = new Date(h.data_hora).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return `• ${d} - ${h.servicos?.nome || "Corte"} c/ ${h.barbeiros?.nome || "Barbeiro"} (${h.barbeiros?.codigo_cadeira || "H1"}) na ${h.unidades?.nome || "Higienópolis"}`;
      }).join("\n");
    }

    blocoPerfilCliente = `====================================================================
[PERFIL DO CLIENTE NO CRM - CAMADA 2]
• Nome: ${clientePerfil.nome || nomeCliente}
• Telefone: ${telefoneCliente}
• ${descPlano}
• Total de visitas na Hermanos: ${totalVisitas}

DIRETRIZ DE ATENDIMENTO:
- Se o cliente for assinante da Assinatura Infinite, reconheça-o calorosamente como nosso membro VIP!
- Trate sempre com simpatia e foco no atendimento atual. NUNCA mencione frases automáticas de visitas antigas ou frases como "Que ótimo te ver de volta por aqui" no início da conversa! Comece direto e naturally com a saudação padrão.
====================================================================`;
  }

  const textoUnidades = unidadesDb.length > 0
    ? unidadesDb.map((u, i) => {
        const abre = u.horario_abertura ? u.horario_abertura.slice(0, 5) : "10:00";
        const fecha = u.horario_fechamento ? u.horario_fechamento.slice(0, 5) : "20:00";
        const tel = u.telefone ? ` | Tel: ${u.telefone}` : "";
        const barbeirosDestaUnidade = (barbeirosDb || []).filter((b: any) => b.unidade_id === u.id);
        const temBarbeiros = barbeirosDestaUnidade.length > 0 || modoV01Booksy;
        
        const linkBooksy = u.link_booksy ? ` | 📅 Agenda Booksy: ${u.link_booksy}` : "";
        if (temBarbeiros) {
          return `${i + 1}. ${u.nome}: ${u.endereco} (Seg a Sex: ${abre} às ${fecha} | Sáb: 09:00 às 19:00 | Dom: Fechado${tel}${linkBooksy}) - ✅ DISPONÍVEL`;
        } else {
          return `${i + 1}. ${u.nome}: ${u.endereco} (Seg a Sex: ${abre} às ${fecha} | Sáb: 09:00 às 19:00 | Dom: Fechado${tel}${linkBooksy})`;
        }
      }).join("\n")
    : `1. Higienópolis: Av. Angélica, 1617 | Link Booksy: https://bit.ly/3BarbeariaHermanosSantaCecilia
2. Osasco: Av. dos Autonomistas, 3001 | Link Booksy: https://barbeariahermanosos.booksy.com/
3. Mooca: R. da Mooca, 2341 | Link Booksy: https://barbeariahermanosmooca.booksy.com/
4. Tatuapé: R. Itapura, 744 | Link Booksy: https://hermanostatuape.booksy.com/
5. Freguesia do Ó: Av. Inajar de Souza, 263B | Link Booksy: https://bit.ly/AgendaBarbeariaHermanos
6. São Caetano do Sul: R. Visconde de Inhaúma, 313 | Link Booksy: https://bit.ly/3W42IXa
7. Itaim Bibi: R. João Cachoeira, 750 | Link Booksy: https://bit.ly/3yGUY63`;

  const servicosAvulsos = servicosDb.filter((s) => !s.nome.toUpperCase().includes("INFINITE"));

  const textoServicos = servicosAvulsos.length > 0
    ? servicosAvulsos.map((s) => {
        const durFmt = s.duracao_minutos ? ` (${s.duracao_minutos} min)` : "";
        return `• ${s.nome}: R$ ${Number(s.preco).toFixed(2).replace(".", ",")}${durFmt}`;
      }).join("\n")
    : `• CORTE DE CABELO: R$ 70,00 (30 min)\n• BARBATERAPIA: R$ 75,00 (30 min)\n• CABELO E BARBATERAPIA: R$ 125,00 (50 min)\n• SOBRANCELHA: R$ 30,00 (5 min)\n• HIDRATAÇÃO CAPILAR: R$ 35,00 (5 min)\n• LIMPEZA DE PELE: R$ 60,00 (10 min)`;

  const textoPlanos = `👑 OS 4 PLANOS OFICIAIS DA ASSINATURA INFINITE (Válidos em todas as unidades):
• INFINITE CUTS (R$ 99,89/mês): Cortes ilimitados. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-cuts)
• INFINITE DUOS (R$ 199,89/mês): Cortes + Barbas ilimitados + Sobrancelha inclusa. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-duos)
• INFINITE BARB (R$ 129,89/mês): Barbas ilimitadas com toalha quente. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-barb)
• INFINITE PLUS (R$ 34,90/mês): Pacote de cuidados com hidratação, sobrancelha, limpeza de pele e depilação. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-plus)

🛡️ REGRA DE OURO PARA APRESENTAÇÃO DE PLANOS (CURTA E ELEGANTE):
• Quando o cliente perguntar sobre planos em geral (ex: "como funcionam os planos?", "gostaria de saber dos planos"):
  Apresente a ideia de forma simples e convidativa em apenas 1 a 2 parágrafos curtos, SEM links e SEM falar de corte teste logo de cara:
  "Com a nossa Assinatura Infinite você tem cortes ou barbas ilimitadas no mês a partir de R$ 99,89, mantendo o visual sempre em dia com muita praticidade e economia!"
  Em seguida, faça APENAS UMA PERGUNTA investigativa:
  "Para eu te indicar a melhor opção: você costuma cuidar mais só do cabelo, só da barba ou dos dois juntos?"
• Somente envie o link de checkout específico quando o cliente escolher o plano dele!

💳 COBRANÇA E LIMITE DO CARTÃO (ASSINATURA RECORRENTE):
• Esclareça sempre que necessário: a Assinatura Infinite NÃO retém e NÃO compromete o limite total do cartão de crédito!
• É uma cobrança mensal recorrente: basta que o cliente tenha disponível no dia da cobrança apenas o valor da mensalidade do plano (ex: R$ 99,89 no Cuts).

✂️ CANCELAMENTO DE AGENDAMENTO DE CORTE/HORÁRIO (VIA CHAT/WHATSAPP):
• Se o cliente pedir para CANCELAR SEU AGENDAMENTO OU HORÁRIO (ex: "gostaria de cancelar meus agendamentos", "cancela meu horário", "não vou conseguir ir"):
  CONFIRME O CANCELAMENTO IMEDIATAMENTE COM SIMPATIA E RESPEITO!
  "Entendido, ${primeiroNome}! Cancelei seus agendamentos no sistema com sucesso. Quando quiser marcar um novo horário para dar aquele tapa no visual, é só me avisar por aqui, combinado?"
  Tag de ação obrigatória na última linha: [ACAO: CANCELAR]

🚪 CANCELAMENTO DE ASSINATURA INFINITE (PLANO MENSAL):
• O cancelamento do PLANO DE ASSINATURA INFINITE (não do horário) é realizado EXCLUSIVAMENTE de forma presencial na recepção da unidade onde o cliente contratou a assinatura.

⭐ REGRA DO CORTE TESTE (GATILHO DE FECHAMENTO - EXCLUSIVO PARA CLIENTES INDECISOS OU COM RECEIO):
• NUNCA mencione "corte de teste" ou "corte grátis" logo de início. Isso gera confusão e atrai curiosos querendo cortar sem pagar.
• O cliente SÓ tem o corte abonado SE fechar o plano! Se não assinar, ele paga o corte avulso normalmente.
• Use o corte teste EXCLUSIVAMENTE se o cliente demonstrar hesitação, insegurança ou disser que quer conhecer a barbearia antes de assinar:
  "Te entendo perfeitamente! Para você ficar super tranquilo, você pode agendar um corte avulso para conhecer a nossa barbearia. Se você curtir a experiência e decidir assinar o plano no final do atendimento, esse corte de hoje fica 100% como cortesia da sua assinatura!"`;

  const textoProdutos = `🧴 CATÁLOGO OFICIAL LOS PUTTOS (E-COMMERCE NUVEMSHOP: https://losputtos.com.br/):
• Pomada Matte Efeito Seco 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-matte-efeito-seco-los-puttos-150g-1hflb/)
• Pomada Teia 2 em 1 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-teia-efeito-2-em-1-los-puttos-150g-iii9e/)
• Pomada Fiber Fixação Extraforte 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-fiber-fixacao-extraforte-los-puttos-150g-12w0b/)
• Pomada Incolor Semi Brilho 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-incolor-semi-brilho-los-puttos-150g-s7o1k/)
• Pó Modelador Anti-Frizz 5g: R$ 50,00 (Link: https://losputtos.com.br/produtos/po-modelador-controle-do-frizz-los-puttos-5g-gt0iv/)
• Gel Cola 250g: R$ 25,00 (Link: https://losputtos.com.br/produtos/gel-cola-alta-fixacao-brilho-medio-los-puttos-250g-1mq68/)
• Linha de Barba (Shampoo 200ml, Balm 140ml, Óleo 30ml, Shaving Gel 750g): R$ 50,00 cada

🛡️ REGRA CONSULTIVA DE PRODUTOS (NUNCA DESPEJE O CATÁLOGO):
• Se o cliente perguntar sobre produtos em geral, NUNCA envie a lista inteira nem múltiplos links!
• Pergunte primeiro como é o cabelo ou barba dele, ou qual efeito ele prefere (ex: seco/matte ou com brilho).
• Recomende no máximo 1 ou 2 produtos ideais e envie apenas o link correspondente ou o site oficial https://losputtos.com.br/!`;

  let blocoAgendamentoExistente = "";
  if (agendamentoAtivoInfo) {
    blocoAgendamentoExistente = `====================================================================
🚨 REGRA INEGOCIÁVEL: TRAVA DE 1 ÚNICO AGENDAMENTO ATIVO POR CLIENTE (POLÍTICA OFICIAL)
${agendamentoAtivoInfo}
• POLÍTICA DA BARBEARIA HERMANOS: Cada cliente tem direito a APENAS 1 AGENDAMENTO ATIVO no sistema por vez! Um novo agendamento SÓ PODE SER FEITO APÓS ELE CONCLUIR E FAZER O CHECKOUT DO ATENDIMENTO ATUAL NA RECEPÇÃO!
• Se o cliente que já possui agendamento ativo pedir para marcar outro horário/dia (tentando criar um 2º agendamento):
  🚫 VOCÊ ESTÁ TERMINANTEMENTE PROIBIDA DE CONFIRMAR UM NOVO AGENDAMENTO!
  ✨ Responda explicando a política com gentileza e educação:
  "Identifiquei que você já possui um agendamento confirmado para o seu visual! Pela política da Barbearia Hermanos, cada cliente pode manter 1 horário ativo por vez, podendo marcar o próximo logo após o checkout do atendimento atual na nossa recepção.
  Caso você precise, posso REMARCAR este seu horário atual para outro dia ou horário que preferir! Deseja trocar o seu horário existente?"
  Tag de ação obrigatória: [ACAO: CONVERSAR]
• SE E SOMENTE SE o cliente pedir explicitamente para TROCAR, REMARCAR ou MUDAR o horário/dia:
  Aí sim, proceda com a remarcação alterando a data/hora para a nova data desejada, informando o novo horário remarcado!
• Se o cliente já está confirmado e apenas respondeu "ok", "obrigado", "combinado" ou clicou em confirmar:
  NÃO repita o agendamento por completo e NÃO faça propagandas! Seja breve: "Tudo certo, te esperamos lá! Qualquer coisa é só chamar."
====================================================================`;
  }

  const textoOcupacaoAgenda = formatarOcupacaoAgenda(agendamentosOcupadosDb);

  const estadoServico = bookingState?.servico || "Não definido";
  const estadoUnidade = bookingState?.unidade || "Não definida";
  const estadoData = bookingState?.data || "Não definida";
  const estadoHora = bookingState?.hora || "Não definida";
  const estadoBarbeiro = codigoProfissional || (bookingState?.barbeiro && bookingState?.barbeiro !== "Não definido" ? bookingState.barbeiro : "Ainda não escolhido pelo cliente");

  const blocoBookingState = `====================================================================
[MEMÓRIA DO AGENDAMENTO EM ANDAMENTO (BOOKING STATE)]
• Serviço Selecionado: ${estadoServico}
• Unidade Selecionada: ${estadoUnidade}
• Data: ${estadoData}
• Horário: ${estadoHora}
• Profissional Solicitado: ${estadoBarbeiro}
(Use essas informações salvas para NÃO perguntar novamente o que o cliente já respondeu anteriormente!)
====================================================================`;

  const barbeiroPadrao = (barbeirosDb && barbeirosDb.length > 0 ? barbeirosDb[0].codigo_cadeira : "H1");

  let blocoProfissional = "";
  if (barbeiroInvalidoSolicitado) {
    blocoProfissional = `🚨 ALERTA MÁXIMO (PROFISSIONAL NÃO RECONHECIDO):
• O cliente tentou agendar com "${barbeiroInvalidoSolicitado}", que não consta na nossa equipe.
• Responda com simpatia:
  "Ops, ${primeiroNome}! O profissional ${barbeiroInvalidoSolicitado} não faz parte da nossa equipe no momento. Gostaria de agendar com a nossa equipe no horário desejado?"
• Tag de ação obrigatória: [ACAO: CONVERSAR]`;
  } else if (codigoProfissional) {
    blocoProfissional = `★ PROFISSIONAL SOLICITADO PELO CLIENTE: Profissional ${codigoProfissional}
• O cliente solicitou EXPLICITAMENTE o Profissional ${codigoProfissional}.
• ATENÇÃO À DISPONIBILIDADE: Se o Profissional ${codigoProfissional} estiver OCUPADO no dia e horário, NUNCA confirme o horário! Avise com simpatia que o ${codigoProfissional} já está com a agenda ocupada nesse horário e ofereça horários vagos próximos dele ou com a nossa equipe.
• Se o horário estiver livre na agenda, confirme: "Perfeito! Agendado com o nosso profissional ${codigoProfissional}."`;
  } else {
    blocoProfissional = `★ REGRA RIGOROSA DE ATRIBUIÇÃO INTERNA DA EQUIPE (LEIA COM MÁXIMA ATENÇÃO):
• O cliente NÃO escolheu e NÃO pediu nenhum barbeiro específico! Ele quer apenas cortar o cabelo ou fazer a barba com a nossa equipe!
• 🚫 PROIBIÇÃO ABSOLUTA DE OFERECER ESCOLHA DE PROFISSIONAIS:
  - NUNCA liste os barbeiros disponíveis dizendo coisas como: "temos os profissionais H6 (Rafael) ou H7 (Bruno), qual prefere?".
  - NUNCA pergunte "qual profissional você prefere?" ou "com qual barbeiro gostaria de fazer?".
  - NUNCA cite códigos internos (H1, H2, H6, H7) para o cliente!
• O que fazer: Se o horário pedido pelo cliente (ex: 12:30) tiver vaga em qualquer um dos barbeiros da equipe, CONFIRME DIRETAMENTE O AGENDAMENTO com a frase:
  "Perfeito, ${primeiroNome}! Seu [Serviço] está confirmado para amanhã, sábado (12/09), às 12:30 na Unidade [Unidade] com a nossa equipe!"
• Na tag de controle técnico [ACAO: CONFIRMAR], atribua internamente um barbeiro vago (ex: BARBEIRO: ${barbeiroPadrao}), mas no texto falado com o cliente fale SEMPRE "com a nossa equipe"!`;
  }

  return `====================================================================
PROMPT MASTER: ${nomeAgente.toUpperCase()} - ATENDIMENTO OFICIAL DA BARBEARIA HERMANOS
====================================================================
VOCÊ É A ${nomeAgente.toUpperCase()}, ATENDENTE DA BARBEARIA HERMANOS.
TOM DE VOZ: ${tomAgente}.
FALE COMO UMA PESSOA REAL: Natural, simpática, objetiva e SEM REPETIÇÕES DESNECESSÁRIAS.

🛡️ REGRAS DE CONDUTA E PROFISSIONAIS (INEGOCIÁVEIS):
1. O CLIENTE NÃO DEVE SER INCOMODADO COM ESCOLHA DE BARBEIROS. Se ele não pediu um barbeiro específico pelo nome, NUNCA liste opções de barbeiros e NUNCA pergunte "qual você prefere". Apenas confirme o horário com a frase padrão "com a nossa equipe"!
2. CÓDIGOS H1 A H8 SÃO DE USO ESTRITAMENTE INTERNO DO SISTEMA. NUNCA mencione códigos como "H1", "H6", "H7" nas mensagens com o cliente, a menos que o próprio cliente tenha falado isso primeiro.
3. Se o cliente pedir expressamente um profissional inexistente (ex: H10), esclareça com simpatia que na equipe Hermanos os profissionais vão até o H8.

🛡️ REGRA DE OURO: ESCOPO EXCLUSIVO E BLOQUEIO TOTAL DE ASSUNTOS FORA DE CONTEXTO (INEGOCIÁVEL):
• VOCÊ É EXCLUSIVAMENTE UMA ASSISTENTE DE ATENDIMENTO DA BARBEARIA HERMANOS.
• SE O CLIENTE PERGUNTAR QUALQUER COISA FORA DO CONTEXTO DA BARBEARIA (ex: receitas culinárias, planetas, astronomia, física, piadas, notícias, esportes, política, cálculos matemáticos, programação, tarefas escolares, curiosidades gerais ou qualquer tema que NÃO seja a Barbearia Hermanos, cortes, barba, planos Infinite ou produtos Los Puttos):
  🚫 NÃO DÊ LINHA! NUNCA RESPONDA À PERGUNTA FORA DE CONTEXTO! 
  Não dê receitas, não diga quantos planetas existem, não resolva problemas, não filosofe sobre o assunto!
  ✨ APENAS CORTE DE FORMA EDUCADA, SIMPÁTICA E RÁPIDA, trazendo o cliente de volta:
  "Haha, essa eu vou ficar te devendo! 😅 Por aqui meu foco é 100% cuidar do seu visual e agendamentos na Barbearia Hermanos. Como posso te ajudar com o seu cabelo, barba ou horário hoje?"
• NUNCA aja como um assistente genérico ou enciclopédia virtual! Mantenha o foco absoluto na barbearia!

📸 REDES SOCIAIS OFICIAIS:
• Instagram Oficial da Hermanos: @barbearia_hermanoss (Link: https://instagram.com/barbearia_hermanoss)

🚫 PROIBIÇÃO DE OFERTA DE BEBIDAS:
• NUNCA ofereça, cite ou prometa "bebida gelada", "cerveja", "chopp", "refrigerante" ou qualquer bebida alcoólica/não alcoólica! No momento não oferecemos isso aos clientes.

🏢 PROCEDIMENTO OFICIAL DE CHEGADA NA UNIDADE & RECONHECIMENTO FACIAL (MUITO IMPORTANTE):
• Quando o cliente perguntar como funciona a chegada, o que fazer ao chegar ou após confirmar o agendamento:
  1. Recepção: Ele deve chegar no horário agendado, se apresentar na recepção e informar seu nome e o barbeiro com quem irá cortar.
  2. Cadastro Facial para Catraca Inteligente: Na primeira visita, o cliente realiza um cadastro facial rápido na recepção para liberação da catraca. Nas próximas visitas, o acesso é 100% automático e sem filas por reconhecimento facial!
  3. Acesso e Adimplência:
     - Estando adimplente (com os pagamentos em dia no plano ou serviço), a catraca é liberada automaticamente.
     - Em caso de pendências financeiras, a catraca não libera até a regularização do pagamento na recepção ou diretamente pelo nosso aplicativo.
  4. Tranquilidade Financeira para Assinantes: Lembre-o de que a Assinatura Infinite não retém o limite do cartão — basta apenas ter saldo disponível no dia do vencimento da mensalidade!

${blocoPerfilCliente ? `${blocoPerfilCliente}\n\n` : ""}${instrucoesExtrasDb ? `[DIRETRIZES PERSONALIZADAS DO CRM]:\n${instrucoesExtrasDb}\n` : ""}

• DATA E HORA ATUAL (SÃO PAULO): ${dataHojeFmt}
• PRÓXIMOS DIAS:
${diasSemanaFmt}

⏰ REGRAS OFICIAIS DE HORÁRIOS DE ATENDIMENTO (OBRIGATÓRIO):
• SEGUNDA A SEXTA: das 10:00 às 20:00 (último atendimento às 19:30).
• SÁBADO: das 09:00 às 19:00 (abre 1h mais cedo e fecha às 19:00!).
• DOMINGO: TOTALMENTE FECHADO em todas as unidades. Se o cliente pedir domingo, avise gentilmente que fechamos aos domingos e ofereça sábado ou segunda-feira!

📅 OCUPAÇÃO DA AGENDA EM TEMPO REAL (HORÁRIOS INDISPONÍVEIS / OCUPADOS NOS PRÓXIMOS 7 DIAS):
${textoOcupacaoAgenda}
🛡️ REGRAS ANTI-OVERBOOKING E DE ATENDIMENTO DE HORÁRIOS:
1. Esta lista serve UNICAMENTE para você saber internamente se há vaga.
2. NUNCA cite esta lista e NUNCA ofereça escolha entre os barbeiros que estão livres!
3. Se o horário solicitado pelo cliente tiver pelo menos um barbeiro livre (não ocupado), o horário É VÁLIDO e você deve CONFIRMAR DIRETAMENTE para o cliente com a equipe:
   "Perfeito, ${primeiroNome}! Seu [Serviço] está confirmado para amanhã, sábado (12/09), às 12:30 na Unidade [Unidade] com a nossa equipe!"
4. Se TODOS os barbeiros estiverem ocupados naquele horário:
   - NÃO confirme o agendamento!
   - Fale sempre em nome da equipe de forma elegante e natural: "Ops, ${primeiroNome}! O horário das [HH:mm] já está totalmente preenchido com a nossa equipe."
   - Sugira 2 opções de horários livres mais próximos no mesmo dia!
   - Tag de ação obrigatória: [ACAO: CONVERSAR]

${textoFeriados ? `📅 CALENDÁRIO DE FERIADOS E EXCEÇÕES CADASTRADAS NO SISTEMA:\n${textoFeriados}\n• ATENÇÃO AOS FERIADOS: Se o cliente solicitar agendamento para uma data listada acima que esteja "FECHADO O DIA TODO", informe com clareza e simpatia que a barbearia estará fechada devido ao feriado e ofereça a data útil anterior ou seguinte!\n` : ""}

💈 UNIDADES:
${textoUnidades}

✂️ SERVIÇOS AVULSOS:
${textoServicos}

${textoPlanos}
⭐ REGRA DO CORTE TESTE: Corte avulso (R$ 70,00) vira 100% GRATUITO se o cliente assinar o plano Infinite durante o atendimento!

🧴 PRODUTOS LOS PUTTOS:
${textoProdutos}

${blocoAgendamentoExistente}

${blocoBookingState}

${blocoProfissional}

====================================================================

${modoV01Booksy ? `⚡ INSTRUÇÕES DE AGENDAMENTO DIRETO VIA LINK ONLINE DA UNIDADE
====================================================================
• O cliente deve ser direcionado para agendar diretamente pelo link online da unidade desejada.
• 🚫 PROIBIÇÃO DE TERMOS TÉCNICOS: NUNCA diga frases como "como estou no modo Booksy", "modo paliativo", "modo v0.1" ou "sistema interno" para o cliente! Fale de forma 100% natural e humana.
• TODAS as 7 unidades (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano, Itaim Bibi) estão ativas e com agendamento aberto! NUNCA diga que nenhuma dessas unidades está indisponível!
• Quando o cliente solicitar agendamento ou escolher uma unidade, envie com simpatia e clareza o link de agendamento online daquela unidade para que ele escolha dia e horário.
• Se ele perguntar sobre a assinatura Infinite, explique os planos (Cuts, Duos, Barb, Plus), forneça o link de checkout do plano e sugira que, após assinar, ele agende o corte pelo link da unidade dele.
• NUNCA mencione nomes de barbeiros individuais nas respostas.
${promptV01Booksy ? `\n[INSTRUÇÕES ESPECÍFICAS CADASTRADAS NO CRM]:\n${promptV01Booksy}` : ""}` : `🚨 REGRA CRÍTICA DE UNIDADES E PROFISSIONAIS (INEGOCIÁVEL):
• As filiais que não tiverem barbeiros cadastrados no sistema NÃO possuem agenda aberta internamente.
• SE O CLIENTE ESCOLHER OU PEDIR PARA AGENDAR EM UMA FILIAL SEM AGENDA ABERTA NO SISTEMA:
  Informe com clareza e simpatia:
  "No momento a nossa unidade escolhida ainda não possui barbeiros com agenda aberta no sistema. Mas temos atendimento completo na nossa unidade Higienópolis (Av. Angélica, 1617) com todos os nossos profissionais! Você gostaria de agendar em Higienópolis ou prefere aguardar?"
• SE O CLIENTE AINDA NÃO ESCOLHEU A UNIDADE:
  NUNCA sugira, mencione ou empurre Higienópolis antes da escolha dele! Deixe a escolha 100% neutra!
• Só agende e prossiga nas filiais que estiverem marcadas como ✅ DISPONÍVEL!`}

[FLUXO RIGOROSO DE AGENDAMENTO PASSO A PASSO]
====================================================================
Cliente: ${primeiroNome} (${telefoneCliente})

Siga ESTRITAMENTE estas etapas sem atropelar e sem misturar:
1. ETAPA 1 - SERVIÇO: Se ainda não tem serviço definido, pergunte qual serviço deseja (Corte, Barba, Combo).
2. ETAPA 2 - ESCOLHA DA UNIDADE: Com serviço definido, pergunte em qual das nossas unidades prefere ser atendido.
   🛡️ REGRA CRÍTICA DA UNIDADE (TOTALMENTE NEUTRA - NUNCA EMPURRE HIGIENÓPOLIS DE ANTIMÃO):
   • A Barbearia Hermanos possui filiais em: Higienópolis, Itaim Bibi, Mooca, Tatuapé, Osasco, São Caetano e Freguesia do Ó.
   • NUNCA presuma, assuma ou sugira a unidade Higienópolis antes do cliente dizer onde prefere!
   • NUNCA adicione lembretes ou observações empurrando Higienópolis na pergunta (ex: NUNCA diga 'Lembrando que temos atendimento completo na unidade Higienópolis'). Pergunte de forma 100% neutra e elegante:
     "Com certeza, ${primeiroNome}! Em qual das nossas unidades você prefere ser atendido? Temos filiais em Higienópolis, Itaim Bibi, Mooca, Tatuapé, Osasco, São Caetano e Freguesia do Ó."
   • Mesmo que o cliente já diga serviço, dia e horário juntos, se ele AINDA NÃO escolheu a unidade, você NÃO PODE confirmar o agendamento! Pergunte primeiro a unidade de forma neutra.
3. ETAPA 3 - DATA E HORÁRIO: Com serviço e unidade definidos, pergunte qual dia e horário ele prefere.
4. ETAPA 4 - CONFIRMAÇÃO FINAL: Quando o cliente definir SERVIÇO + UNIDADE ESCOLHIDA + DIA E HORÁRIO (ex: corte amanhã às 12:30 em Higienópolis):
   • SE HOUVER VAGA NO HORÁRIO SOLICITADO: CONFIRME DIRETAMENTE E IMEDIATAMENTE!
     🚫 PROIBIDO PERGUNTAR QUAL PROFISSIONAL ELE PREFERE!
     🚫 PROIBIDO LISTAR QUAIS BARBEIROS ESTÃO DISPONÍVEIS NESSE HORÁRIO (ex: "temos o H6 ou o H7, qual você prefere?")! O cliente NÃO pediu barbeiro exclusivo!
     • Se o cliente NÃO pediu barbeiro nominalmente, confirme com a frase exata:
       "Perfeito, ${primeiroNome}! Seu [Serviço] está confirmado para amanhã, [Dia da semana] ([Data]), às [Horário] na Unidade [Unidade] com a nossa equipe!"
     • Se o cliente escolheu expressamente um barbeiro (ex: "com o H2"), confirme mencionando o profissional solicitado.
     • SEMPRE inclua o link para acompanhamento no aplicativo do cliente:
       "📱 Acompanhe seu agendamento, pontos e histórico pelo nosso app: https://barbeariahermanos.com.br/hermanos/cliente"
   • Se TODOS os barbeiros estiverem OCUPADOS no horário solicitado:
     - NÃO CONFIRME! Avise com elegância: "Ops, ${primeiroNome}! O horário das [HH:mm] já está totalmente preenchido com a nossa equipe amanhã."
     - Sugira 2 opções de horários livres mais próximos no mesmo dia!
     - Use a tag [ACAO: CONVERSAR].

====================================================================
[REGRAS CRÍTICAS DE ENTENDIMENTO DE MENSAGENS]
====================================================================
• ALTERAÇÕES E CANCELAMENTO DE ITENS:
  Se o cliente disser "não", "cancela sobrancelha", "tira a barba", "só o corte", "não quero hidratação":
  -> REMOVA imediatamente o serviço cancelado!
  -> Responda confirmando a remoção: "Entendido! Sobrancelha removida. Ficamos então com..."
  -> NUNCA diga "com certeza mantido" quando o cliente pedir cancelamento de item!

• RESPOSTAS POR TEXTO LIVRE:
  Se o cliente digitar por texto em vez de usar botões, entenda perfeitamente o texto e avance o fluxo sem se perder.

• RESPOSTAS CURTAS:
  Mantenha respostas concisas (1 a 3 parágrafos curtos). Seja rápida, elegante e objetiva.

====================================================================
[ESTRUTURA OBRIGATÓRIA DE CONTROLE TÉCNICO AO FINAL DA RESPOSTA]
====================================================================
Sempre adicione ao final da sua resposta (na última linha) UMA destas tags:
- Se identificou novos dados de agendamento:
  [ACAO: ATUALIZAR | SERVICO: nome_do_servico | UNIDADE: nome_da_unidade | DATA: YYYY-MM-DD | HORA: HH:mm | BARBEIRO: H1..H8]
- Se o cliente confirmou o horário e deve salvar o agendamento no banco:
  [ACAO: CONFIRMAR | SERVICO: nome_do_servico | UNIDADE: nome_da_unidade | DATA: YYYY-MM-DD | HORA: HH:mm | BARBEIRO: H1..H8]
- Se o cliente cancelou o agendamento:
  [ACAO: CANCELAR]
- Se for apenas conversa geral:
  [ACAO: CONVERSAR]`;
}

// Chamar Gemini com suporte multimodal
async function gerarRespostaGemini(
  historicoTexto: string,
  mensagemAtual: string,
  nomeCliente: string,
  telefoneCliente: string,
  codigoProfissional: string,
  unidadesDb: any[],
  servicosDb: any[],
  produtosDb: any[],
  barbeirosCodigos: string[],
  agendamentoAtivoInfo: string = "",
  bookingState: any = {},
  midiaBase64?: { mimeType: string; data: string } | null,
  nomeAgente: string = "Heloísa",
  tomAgente: string = "Simpática, acolhedora e profissional",
  instrucoesExtrasDb: string = "",
  feriadosDb: any[] = [],
  barbeirosDb: any[] = [],
  barbeiroInvalidoSolicitado: string = "",
  clientePerfil: any = null,
  historicoAgendamentos: any[] = [],
  agendamentosOcupadosDb: any[] = [],
  modoV01Booksy: boolean = false,
  promptV01Booksy: string = ""
): Promise<string> {
  const promptSistema = construirPromptMaster(
    nomeCliente,
    telefoneCliente,
    codigoProfissional,
    unidadesDb,
    servicosDb,
    produtosDb,
    barbeirosCodigos,
    agendamentoAtivoInfo,
    bookingState,
    nomeAgente,
    tomAgente,
    instrucoesExtrasDb,
    feriadosDb,
    barbeirosDb,
    barbeiroInvalidoSolicitado,
    clientePerfil,
    historicoAgendamentos,
    agendamentosOcupadosDb,
    modoV01Booksy,
    promptV01Booksy
  );

  const promptFinal = `${promptSistema}

====================================================================
[HISTÓRICO RECENTE DA CONVERSA]
${historicoTexto || "(Início de conversa)"}

====================================================================
[MENSAGEM ATUAL RECEBIDA DO CLIENTE ${nomeCliente.toUpperCase()}]:
"${mensagemAtual}"

RESPONDA AGORA COMO ${nomeAgente.toUpperCase()} (Lembre-se de incluir a tag [ACAO: ...] na última linha):`;

  const modelosParaTentar = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ];

  for (const modelo of modelosParaTentar) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;

      const contentsParts: any[] = [];
      if (midiaBase64) {
        contentsParts.push({ text: promptSistema });
        contentsParts.push({
          text: `====================================================================
[HISTÓRICO RECENTE DA CONVERSA]
${historicoTexto || "(Início de conversa)"}

====================================================================
[ÁUDIO OU IMAGEM RECEBIDO DO CLIENTE ${nomeCliente.toUpperCase()}]:
(Ouça atentamente o áudio abaixo ou analise a imagem. Extraia todos os detalhes mencionados pelo cliente: serviço, unidade, data, horário ou profissional preferido)`
        });
        contentsParts.push({
          inlineData: {
            mimeType: midiaBase64.mimeType,
            data: midiaBase64.data,
          },
        });
        contentsParts.push({
          text: `RESPONDA AGORA COMO ${nomeAgente.toUpperCase()} diretamente ao que o cliente falou no áudio acima (Lembre-se de incluir a tag [ACAO: ...] na última linha):`
        });
      } else {
        contentsParts.push({ text: promptFinal });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
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
      } else {
        const errText = await res.text();
        console.error(`[GEMINI HTTP ${res.status}] Modelo ${modelo} falhou: ${errText}`);
        if (res.status === 429 || res.status === 503) {
          // Pausa de 2s para desafogar quota antes do retry
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const retryRes = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: contentsParts }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
              }),
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (retryText && retryText.trim()) return retryText.trim();
            }
          } catch (_) {}
        }
      }
    } catch (e: any) {
      console.warn(`Erro no modelo ${modelo}:`, e.message);
    }
  }

  const primeiroNome = nomeCliente ? nomeCliente.split(" ")[0] : "";
  const msgLower = (mensagemAtual || "").toLowerCase();
  const servicoAtual = temValorReal(bookingState?.servico) ? bookingState.servico : null;
  const unidadeAtual = temValorReal(bookingState?.unidade) ? bookingState.unidade : null;

  // Se o cliente já definiu serviço mas falta a unidade:
  if (servicoAtual && !unidadeAtual) {
    return `Olá, ${primeiroNome}! Combinado, ${servicoAtual.toLowerCase()} anotado! ✂️\n\nEm qual das nossas unidades você prefere ser atendido? (Higienópolis, Itaim Bibi, Mooca, Tatuapé, Osasco, São Caetano ou Freguesia do Ó)?\n[ACAO: ATUALIZAR | SERVICO: ${servicoAtual}]`;
  }

  // Se o cliente já tem serviço e unidade, mas falta data/hora:
  if (servicoAtual && unidadeAtual) {
    return `Olá, ${primeiroNome}! Perfeito, para a unidade ${unidadeAtual}! Qual o melhor dia e horário para você vir cuidar do visual?\n[ACAO: ATUALIZAR | SERVICO: ${servicoAtual} | UNIDADE: ${unidadeAtual}]`;
  }

  // Se o cliente mencionou corte, cabelo, barba ou cortar na mensagem atual:
  if (msgLower.includes("corte") || msgLower.includes("cortar") || msgLower.includes("cabelo") || msgLower.includes("barba") || msgLower.includes("barbaterapia")) {
    const srv = msgLower.includes("barba") && (msgLower.includes("corte") || msgLower.includes("cortar")) ? "Corte + Barba" : msgLower.includes("barba") ? "Barbaterapia" : "Corte de Cabelo";
    return `Olá, ${primeiroNome}! Com certeza, ${srv.toLowerCase()} anotado! ✂️\n\nEm qual das nossas unidades você prefere ser atendido? (Higienópolis, Itaim Bibi, Mooca, Tatuapé, Osasco, São Caetano ou Freguesia do Ó)?\n[ACAO: ATUALIZAR | SERVICO: ${srv}]`;
  }

  // Fallback inteligente para combos/duos (Cabelo + Barba):
  if (msgLower.includes("combo") || msgLower.includes("duos") || msgLower.includes("os dois") || msgLower.includes("ambos") || (msgLower.includes("cabelo") && msgLower.includes("barba"))) {
    return `Olá, ${primeiroNome}! Para cuidar de cabelo e barba juntos, o nosso plano ideal é o *Infinite Duos* (R$ 199,89/mês)! 👑\n\nEle inclui cortes e barbas ilimitados no mês + sobrancelha inclusa com atendimento VIP!\n\nVocê pode assinar diretamente por este link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-duos\n\nApós assinar, você pode agendar o seu corte pelo link do Booksy da sua unidade! Como posso te ajudar a mais?\n[ACAO: CONVERSAR]`;
  }

  // Fallback inteligente para planos:
  if (msgLower.includes("plano") || msgLower.includes("infinite") || msgLower.includes("assinar") || msgLower.includes("assinatura")) {
    return `Olá, ${primeiroNome}! Com a nossa Assinatura Infinite você tem cortes ou barbas ilimitadas no mês a partir de R$ 99,89!\n\nVocê costuma cuidar mais só do cabelo, só da barba ou dos dois juntos?\n[ACAO: CONVERSAR]`;
  }

  if (modoV01Booksy) {
    if (msgLower.includes("horario") || msgLower.includes("hora") || msgLower.includes("agendar") || msgLower.includes("marcar")) {
      return `Olá, ${primeiroNome}! Para agendar o seu horário, em qual de nossas 7 unidades você prefere ser atendido? (Higienópolis, Osasco, Mooca, Tatuapé, Freguesia do Ó, São Caetano ou Itaim Bibi)?\n[ACAO: CONVERSAR]`;
    }
    return `Olá, ${primeiroNome}! Como posso te ajudar hoje na Barbearia Hermanos? Se quiser links do Booksy para agendamento ou informações sobre nossos planos Infinite e produtos, estou à disposição!\n[ACAO: CONVERSAR]`;
  }

  if (msgLower.includes("horario") || msgLower.includes("hora") || msgLower.includes("agendar") || msgLower.includes("marcar") || msgLower.includes("segunda") || msgLower.includes("terca") || msgLower.includes("quarta") || msgLower.includes("quinta") || msgLower.includes("sexta") || msgLower.includes("sabado")) {
    return `Olá, ${primeiroNome}! Claro, vamos agendar! Para qual unidade você prefere e em qual dia e horário você gostaria de vir?\n[ACAO: CONVERSAR]`;
  }

  return `Olá, ${primeiroNome}! Como posso te ajudar hoje na Barbearia Hermanos? Se quiser agendar um horário ou saber mais sobre nossos planos e serviços, estou por aqui!\n[ACAO: CONVERSAR]`;
}

// Persistir, Reagendar ou Cancelar Agendamento no Banco
async function gerenciarAgendamentoNoBanco(
  supabase: any,
  clienteId: string,
  textoResposta: string,
  textoEntrada: string,
  codigoProfissional: string,
  tagAcao: string,
  unidadesDb: any[],
  servicosDb: any[],
  barbeirosDb: any[],
  agendamentoAtivoExistente: any = null,
  bookingState: any = {},
  barbeiroInvalidoSolicitado: string = ""
): Promise<{ agendamentoCriado: boolean; cancelado?: boolean; unidadeNome?: string; unidadeChave?: string }> {
  try {
    if (barbeiroInvalidoSolicitado) {
      console.log(`[BLOQUEIO AGENDA] Barbeiro inválido solicitado (${barbeiroInvalidoSolicitado}). Agendamento/alteração recusada.`);
      return { agendamentoCriado: false };
    }

    const txtFull = semAcentos(`${textoResposta} ${textoEntrada} ${tagAcao}`);
    const ehCancelamento =
      tagAcao.includes("CANCELAR") ||
      textoEntrada.toLowerCase().includes("btn_conf_cancelar") ||
      txtFull.includes("cancelar reserva") ||
      txtFull.includes("cancelar agendamento") ||
      txtFull.includes("cancela meu agendamento") ||
      txtFull.includes("quero cancelar");

    const matchBarbeiro = txtFull.match(/\b(h[1-8])\b/i);

    const respostaIndicaConfirmacao =
      txtFull.includes("confirmado") ||
      txtFull.includes("agendado com sucesso") ||
      txtFull.includes("horario marcado") ||
      txtFull.includes("te esperamos dia") ||
      txtFull.includes("te esperamos na");

    const ehConfirmacaoOuTroca =
      !barbeiroInvalidoSolicitado &&
      (tagAcao.includes("CONFIRMAR") ||
       tagAcao.includes("REAGENDAR") ||
       (tagAcao.includes("ATUALIZAR") && respostaIndicaConfirmacao) ||
       textoEntrada.toLowerCase().includes("btn_conf_confirmar"));

    if (!clienteId) return { agendamentoCriado: false };

    if (ehCancelamento) {
      await supabase
        .from("agendamentos")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("cliente_id", clienteId)
        .eq("status", "agendado");

      console.log(`🚫 [AGENDA] Agendamentos cancelados para cliente ${clienteId}`);
      return { agendamentoCriado: false, cancelado: true };
    }

    if (!ehConfirmacaoOuTroca) return { agendamentoCriado: false };

    // 1. Identificar Unidade
    let unidadeEscolhida: any = null;
    let unidadeChave = "higienopolis";

    const txtRespostaSemAcento = semAcentos(textoResposta || "");
    const tagAcaoSemAcento = semAcentos(tagAcao || "");
    const bookingUnidadeSemAcento = semAcentos(bookingState?.unidade || "");

    // Prioridade 1: Unidade explicitamente confirmada na resposta da IA ou na tagAcao atual
    for (const u of unidadesDb) {
      const nomeSemAcento = semAcentos(u.nome).replace("unidade", "").replace("-", "").trim();
      if (txtRespostaSemAcento.includes(nomeSemAcento) || tagAcaoSemAcento.includes(nomeSemAcento)) {
        unidadeEscolhida = u;
        if (nomeSemAcento.includes("itaim")) unidadeChave = "itaim";
        else if (nomeSemAcento.includes("mooca")) unidadeChave = "mooca";
        else if (nomeSemAcento.includes("tatuape")) unidadeChave = "tatuape";
        else if (nomeSemAcento.includes("osasco")) unidadeChave = "osasco";
        else if (nomeSemAcento.includes("caetano")) unidadeChave = "caetano";
        else if (nomeSemAcento.includes("freguesia")) unidadeChave = "freguesia";
        else unidadeChave = "higienopolis";
        break;
      }
    }

    // Prioridade 2: Unidade definida no bookingState ou no histórico consolidado
    if (!unidadeEscolhida) {
      for (const u of unidadesDb) {
        const nomeSemAcento = semAcentos(u.nome).replace("unidade", "").replace("-", "").trim();
        if (bookingUnidadeSemAcento.includes(nomeSemAcento) || txtFull.includes(nomeSemAcento)) {
          unidadeEscolhida = u;
          if (nomeSemAcento.includes("itaim")) unidadeChave = "itaim";
          else if (nomeSemAcento.includes("mooca")) unidadeChave = "mooca";
          else if (nomeSemAcento.includes("tatuape")) unidadeChave = "tatuape";
          else if (nomeSemAcento.includes("osasco")) unidadeChave = "osasco";
          else if (nomeSemAcento.includes("caetano")) unidadeChave = "caetano";
          else if (nomeSemAcento.includes("freguesia")) unidadeChave = "freguesia";
          else unidadeChave = "higienopolis";
          break;
        }
      }
    }

    // Fallback garantido: Unidade Higienópolis (sede matriz)
    if (!unidadeEscolhida) {
      unidadeEscolhida = unidadesDb.find((u: any) => semAcentos(u.nome).includes("higienopolis")) || unidadesDb[0];
      unidadeChave = "higienopolis";
    }

    // 2. Identificar Barbeiro (com filtro estrito por unidade e fallback resiliente)
    let codigoBarbeiroFinal = codigoProfissional;
    if (!codigoBarbeiroFinal) {
      const tagBarMatch = tagAcao.match(/BARBEIRO:\s*(H[1-8])/i);
      if (tagBarMatch) {
        codigoBarbeiroFinal = tagBarMatch[1].toUpperCase();
      } else if (matchBarbeiro) {
        codigoBarbeiroFinal = matchBarbeiro[1].toUpperCase();
      }
    }

    // Barbeiros desta filial ou da rede Hermanos (garante que agendamentos confirmados nunca sejam descartados)
    const barbeirosDaUnidade = (barbeirosDb || []).filter((b: any) => b.unidade_id === unidadeEscolhida?.id);
    const poolBarbeiros = barbeirosDaUnidade.length > 0 ? barbeirosDaUnidade : (barbeirosDb || []);

    let barbeiroEscolhido = null;
    if (codigoBarbeiroFinal) {
      barbeiroEscolhido = (poolBarbeiros || []).find((b: any) => b.codigo_cadeira === codigoBarbeiroFinal);
    }
    if (!barbeiroEscolhido) {
      barbeiroEscolhido = poolBarbeiros?.[0] || barbeirosDb?.[0];
    }
    
    // 3. Identificar Serviço, Duração e Preço Calculados
    // Prioridade máxima: serviço definido no bookingState ou na tagAcao
    const servicoNoBooking = semAcentos(bookingState?.servico || "");
    const tagAcaoServico = semAcentos((tagAcao.match(/SERVICO:\s*([^|]+)/i) || [])[1] || "");

    let servicoEscolhido = null;

    // Se no bookingState ou na tagAcao tiver corte e barba (combo):
    if (
      (servicoNoBooking.includes("barba") && (servicoNoBooking.includes("corte") || servicoNoBooking.includes("cabelo"))) ||
      (tagAcaoServico.includes("barba") && (tagAcaoServico.includes("corte") || tagAcaoServico.includes("cabelo"))) ||
      (txtFull.includes("barba") && (txtFull.includes("corte") || txtFull.includes("cabelo"))) ||
      (semAcentos(textoResposta).includes("cabelo") && semAcentos(textoResposta).includes("barba"))
    ) {
      servicoEscolhido = servicosDb.find((s: any) => {
        const sNome = semAcentos(s.nome);
        return sNome.includes("cabelo e barba") || (sNome.includes("corte") && sNome.includes("barba"));
      });
    } else if (
      servicoNoBooking.includes("barba") ||
      tagAcaoServico.includes("barba") ||
      txtFull.includes("barbaterapia") ||
      (txtFull.includes("barba") && !txtFull.includes("corte") && !txtFull.includes("cabelo"))
    ) {
      servicoEscolhido = servicosDb.find((s: any) => semAcentos(s.nome) === "barbaterapia") || servicosDb?.[0];
    } else if (
      servicoNoBooking.includes("sobrancelha") ||
      tagAcaoServico.includes("sobrancelha") ||
      txtFull.includes("sobrancelha")
    ) {
      servicoEscolhido = servicosDb.find((s: any) => semAcentos(s.nome).includes("sobrancelha")) || servicosDb?.[0];
    } else {
      servicoEscolhido = servicosDb.find((s: any) => semAcentos(s.nome).includes("corte") && !semAcentos(s.nome).includes("infinite")) || servicosDb?.[0];
    }

    if (!servicoEscolhido) {
      servicoEscolhido = servicosDb?.[0];
    }

    let duracaoMinutos = Number(servicoEscolhido?.duracao_minutos) || 30;
    let precoTotal = Number(servicoEscolhido?.preco) || 70.00;

    // Se o cliente combinou múltiplos serviços adicionais (ex: Cabelo e Barba + Sobrancelha)
    if (txtFull.includes("sobrancelha") && !semAcentos(servicoEscolhido?.nome || "").includes("sobrancelha")) {
      const srvSob = servicosDb.find((s: any) => semAcentos(s.nome).includes("sobrancelha"));
      duracaoMinutos += Number(srvSob?.duracao_minutos) || 5;
      precoTotal += Number(srvSob?.preco) || 30.00;
    }
    if (txtFull.includes("hidratacao")) {
      const srvHid = servicosDb.find((s: any) => semAcentos(s.nome).includes("hidratacao"));
      duracaoMinutos += Number(srvHid?.duracao_minutos) || 5;
      precoTotal += Number(srvHid?.preco) || 35.00;
    }

    // 4. Identificar Hora e Data
    let hora = 14;
    let minuto = 0;

    const timeColonMatch = txtFull.match(/(\d{1,2}):(\d{2})/);
    const timeHMatch = txtFull.match(/(\d{1,2})h(\d{2})?/);
    const timeAsMatch = txtFull.match(/as\s+(\d{1,2})(?:h|\b)/);

    if (timeColonMatch) {
      hora = parseInt(timeColonMatch[1], 10);
      minuto = parseInt(timeColonMatch[2], 10);
    } else if (timeHMatch) {
      hora = parseInt(timeHMatch[1], 10);
      if (timeHMatch[2]) minuto = parseInt(timeHMatch[2], 10);
    } else if (timeAsMatch) {
      hora = parseInt(timeAsMatch[1], 10);
    }

    const agora = new Date();
    const spDateStr = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const [spAno, spMes, spDia] = spDateStr.split("-").map(Number);

    let targetAno = spAno;
    let targetMes = spMes;
    let targetDia = spDia;

    // Verificar se a tagAcao já tem a data ISO formatada (YYYY-MM-DD)
    const tagDateMatch = tagAcao.match(/DATA:\s*(\d{4})-(\d{2})-(\d{2})/i);
    const dateSlashMatch = txtFull.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);

    if (tagDateMatch) {
      targetAno = parseInt(tagDateMatch[1], 10);
      targetMes = parseInt(tagDateMatch[2], 10);
      targetDia = parseInt(tagDateMatch[3], 10);
    } else if (dateSlashMatch) {
      targetDia = parseInt(dateSlashMatch[1], 10);
      targetMes = parseInt(dateSlashMatch[2], 10);
      if (dateSlashMatch[3]) {
        targetAno = parseInt(dateSlashMatch[3], 10);
        if (targetAno < 100) targetAno += 2000;
      }
    } else if (txtFull.includes("amanha")) {
      const d = new Date(Date.UTC(spAno, spMes - 1, spDia + 1));
      targetAno = d.getUTCFullYear();
      targetMes = d.getUTCMonth() + 1;
      targetDia = d.getUTCDate();
    } else if (txtFull.includes("hoje")) {
      targetAno = spAno;
      targetMes = spMes;
      targetDia = spDia;
    } else {
      const diasSemanaMap: Record<string, number> = {
        domingo: 0,
        segunda: 1,
        terca: 2,
        quarta: 3,
        quinta: 4,
        sexta: 5,
        sabado: 6,
      };
      const spDayOfWeek = new Date(Date.UTC(spAno, spMes - 1, spDia)).getUTCDay();
      for (const [diaNome, diaIdx] of Object.entries(diasSemanaMap)) {
        if (new RegExp(`\\b${diaNome}\\b`, "i").test(txtFull)) {
          let diff = (diaIdx - spDayOfWeek + 7) % 7;
          if (diff === 0) diff = 7;
          const d = new Date(Date.UTC(spAno, spMes - 1, spDia + diff));
          targetAno = d.getUTCFullYear();
          targetMes = d.getUTCMonth() + 1;
          targetDia = d.getUTCDate();
          break;
        }
      }
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const dataHoraIsoSP = `${targetAno}-${pad(targetMes)}-${pad(targetDia)}T${pad(hora)}:${pad(minuto)}:00-03:00`;

    // 5. Verificação de Conflito de Horário (Anti-Overbooking)
    if (barbeiroEscolhido?.id) {
      const { data: conflito } = await supabase
        .from("agendamentos")
        .select("id")
        .eq("barbeiro_id", barbeiroEscolhido.id)
        .eq("data_hora", dataHoraIsoSP)
        .eq("status", "agendado")
        .neq("cliente_id", clienteId)
        .limit(1);

      if (conflito && conflito.length > 0) {
        console.warn(`⚠️ Barbeiro ${barbeiroEscolhido.codigo_cadeira} ocupado em ${dataHoraIsoSP}.`);
        // Se o cliente ou a IA especificou explicitamente este barbeiro, NÃO troque silenciosamente para outro!
        if (!codigoBarbeiroFinal) {
          const outroDisponivel = poolBarbeiros.find((b: any) => b.id !== barbeiroEscolhido.id);
          if (outroDisponivel) {
            barbeiroEscolhido = outroDisponivel;
          }
        }
      }
    }

    let dataHoraFinal = dataHoraIsoSP;
    if (agendamentoAtivoExistente && !tagDateMatch && !dateSlashMatch && !timeColonMatch && !timeHMatch && !timeAsMatch && !txtFull.includes("amanha") && !txtFull.includes("hoje") && !txtFull.includes("sabado") && !txtFull.includes("segunda") && !txtFull.includes("terca") && !txtFull.includes("quarta") && !txtFull.includes("quinta") && !txtFull.includes("sexta") && !txtFull.includes("domingo")) {
      dataHoraFinal = agendamentoAtivoExistente.data_hora;
    }

    if (agendamentoAtivoExistente) {
      await supabase
        .from("agendamentos")
        .update({
          data_hora: dataHoraFinal,
          unidade_id: unidadeEscolhida?.id || agendamentoAtivoExistente.unidade_id,
          barbeiro_id: barbeiroEscolhido?.id || agendamentoAtivoExistente.barbeiro_id,
          servico_id: servicoEscolhido?.id || agendamentoAtivoExistente.servico_id,
          duracao_minutos: duracaoMinutos || servicoEscolhido?.duracao_minutos || 30,
          preco: precoTotal || servicoEscolhido?.preco || 70.00,
          observacoes: `Agendado via WhatsApp com Heloísa para ${hora}h${minuto > 0 ? minuto : ""} (Profissional ${barbeiroEscolhido?.codigo_cadeira || codigoBarbeiroFinal || "H1"} - ${unidadeEscolhida?.nome})`,
          status: "agendado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", agendamentoAtivoExistente.id);

      await supabase
        .from("agendamentos")
        .delete()
        .eq("cliente_id", clienteId)
        .eq("status", "agendado")
        .neq("id", agendamentoAtivoExistente.id);

      console.log(`🔄 [AGENDA] Agendamento #${agendamentoAtivoExistente.id} ATUALIZADO para ${dataHoraIsoSP} (${duracaoMinutos} min, R$ ${precoTotal})!`);
      return { agendamentoCriado: true, unidadeNome: unidadeEscolhida?.nome, unidadeChave };
    }

    const { data: agNovo } = await supabase.from("agendamentos").insert({
      cliente_id: clienteId,
      unidade_id: unidadeEscolhida?.id || null,
      barbeiro_id: barbeiroEscolhido?.id || null,
      servico_id: servicoEscolhido?.id || null,
      data_hora: dataHoraIsoSP,
      duracao_minutos: duracaoMinutos || servicoEscolhido?.duracao_minutos || 30,
      preco: precoTotal || servicoEscolhido?.preco || 70.00,
      status: "agendado",
      observacoes: `Agendado via WhatsApp com Heloísa (Profissional ${barbeiroEscolhido?.codigo_cadeira || codigoBarbeiroFinal || "H1"} - ${unidadeEscolhida?.nome})`,
      empresa_id: DEFAULT_EMPRESA_ID,
    }).select("id").single();

    if (agNovo) {
      await supabase
        .from("agendamentos")
        .delete()
        .eq("cliente_id", clienteId)
        .eq("status", "agendado")
        .neq("id", agNovo.id);

      console.log(`✅ [AGENDA] Novo agendamento #${agNovo.id} registrado para ${unidadeEscolhida?.nome} às ${hora}h${minuto > 0 ? minuto : ""}!`);
      return { agendamentoCriado: true, unidadeNome: unidadeEscolhida?.nome, unidadeChave };
    }
  } catch (err: any) {
    console.error("Erro no gerenciamento do agendamento:", err.message);
  }
  return { agendamentoCriado: false };
}

// Persistir Candidaturas do Banco de Talentos no Banco
async function gerenciarCandidatoNoBanco(
  supabase: any,
  empresaId: string,
  whatsappPhone: string,
  nomeCliente: string,
  tagAcao: string,
  textoResposta: string,
  textoConsolidado: string
): Promise<void> {
  try {
    const fullTxt = `${tagAcao} ${textoResposta} ${textoConsolidado}`;
    const txtLower = semAcentos(fullTxt);
    
    if (!tagAcao.includes("CANDIDATO") && !txtLower.includes("banco de talentos") && !txtLower.includes("candidatura") && !txtLower.includes("vaga de barbeiro") && !txtLower.includes("contratando barbeiro")) {
      return;
    }

    const matchNome = tagAcao.match(/NOME:\s*([^|]+)/i);
    const matchUnidades = tagAcao.match(/UNIDADES?:\s*([^|]+)/i);
    const matchExp = tagAcao.match(/EXPERIENCIA:\s*([^|]+)/i);
    const matchInsta = tagAcao.match(/INSTAGRAM:\s*([^|]+)/i);
    const matchDisp = tagAcao.match(/DISPONIBILIDADE:\s*([^|]+)/i);

    const nome = matchNome && temValorReal(matchNome[1]) ? matchNome[1].trim() : (nomeCliente || "Candidato WhatsApp");
    const exp = matchExp && temValorReal(matchExp[1]) ? matchExp[1].trim() : "";
    const insta = matchInsta && temValorReal(matchInsta[1]) ? matchInsta[1].trim() : "";
    const disp = matchDisp && temValorReal(matchDisp[1]) ? matchDisp[1].trim() : "";
    
    let unidades: string[] = [];
    if (matchUnidades && temValorReal(matchUnidades[1])) {
      unidades = matchUnidades[1].split(",").map((u: string) => u.trim()).filter(Boolean);
    }

    if (unidades.length === 0) {
      const possiveis = ["Higienópolis", "Osasco", "Mooca", "Tatuapé", "Freguesia do Ó", "São Caetano", "Itaim Bibi"];
      possiveis.forEach((u) => {
        if (txtLower.includes(semAcentos(u))) unidades.push(u);
      });
    }

    const { data: existente } = await supabase
      .from("candidatos_barbeiros")
      .select("id, unidades_interesse")
      .eq("empresa_id", empresaId)
      .eq("whatsapp_phone", whatsappPhone)
      .maybeSingle();

    if (existente) {
      const payload: any = { atualizado_em: new Date().toISOString() };
      if (nome && nome !== "Candidato WhatsApp") payload.nome = nome;
      if (unidades.length > 0) payload.unidades_interesse = unidades;
      if (exp) payload.tempo_experiencia = exp;
      if (insta) payload.instagram_portfolio = insta;
      if (disp) payload.disponibilidade_inicio = disp;

      await supabase.from("candidatos_barbeiros").update(payload).eq("id", existente.id);
      console.log(`💈 [BANCO DE TALENTOS] Candidatura atualizada para ${whatsappPhone} (${nome})`);
    } else {
      await supabase.from("candidatos_barbeiros").insert({
        empresa_id: empresaId,
        whatsapp_phone: whatsappPhone,
        nome: nome,
        unidades_interesse: unidades,
        tempo_experiencia: exp,
        instagram_portfolio: insta,
        disponibilidade_inicio: disp,
        status: "novo"
      });
      console.log(`💈 [BANCO DE TALENTOS] Nova candidatura criada para ${whatsappPhone} (${nome})`);
    }
  } catch (e: any) {
    console.error("Erro ao salvar candidatura no Banco de Talentos:", e.message);
  }
}

// Marcar mensagem como lida (dois tiques azuis)
async function marcarComoLidaMeta(messageId: string) {
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
  } catch (e) {
    console.error("Erro ao marcar como lida:", e);
  }
}

// 1. Enviar Mensagem de Texto Normal
async function enviarMensagemWhatsAppMeta(toPhone: string, text: string) {
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

// 2. Enviar Botões de Resposta Rápida (Até 3 botões com proteção de limite de 1024 caracteres da Meta)
async function enviarBotoesMeta(toPhone: string, bodyText: string, botoes: Array<{ id: string; title: string }>) {
  try {
    // Se o texto exceder 1000 caracteres (limite estrito da Meta para botões é 1024):
    if (bodyText.length > 1000) {
      // Envia como mensagem de texto normal (suporta até 4096 caracteres) sem duplicar!
      return await enviarMensagemWhatsAppMeta(toPhone, bodyText);
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
    const data = await res.json();
    if (data?.error) {
      console.error("Erro Meta Buttons:", data.error);
      // Fallback seguro: se a Meta recusar os botões, envia o texto como mensagem normal
      await enviarMensagemWhatsAppMeta(toPhone, bodyText);
    }
    return data;
  } catch (e) {
    console.error("Erro Meta Buttons:", e);
    await enviarMensagemWhatsAppMeta(toPhone, bodyText);
  }
}

// 3. Enviar Menu de Lista Suspenso da Meta (Até 10 opções com descrição e proteção de limite de 1024 caracteres)
async function enviarMenuListaMeta(
  toPhone: string,
  bodyText: string,
  buttonTitle: string,
  secoes: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
) {
  try {
    if (bodyText.length > 1000) {
      await enviarMensagemWhatsAppMeta(toPhone, bodyText);
      bodyText = "Selecione uma opção abaixo:";
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
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonTitle.slice(0, 20),
            sections: secoes.map((s) => ({
              title: s.title.slice(0, 24),
              rows: s.rows.slice(0, 10).map((r) => ({
                id: r.id.slice(0, 200),
                title: r.title.slice(0, 24),
                description: (r.description || "").slice(0, 72),
              })),
            })),
          },
        },
      }),
    });
    const data = await res.json();
    if (data?.error) {
      console.error("Erro Meta List:", data.error);
      await enviarMensagemWhatsAppMeta(toPhone, bodyText);
    }
    return data;
  } catch (e) {
    console.error("Erro Meta List:", e);
    await enviarMensagemWhatsAppMeta(toPhone, bodyText);
  }
}

// 4. Enviar Localização no GPS Oficial da Meta
async function enviarLocalizacaoMeta(toPhone: string, lat: number, lng: number, nome: string, endereco: string) {
  try {
    const url = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "location",
        location: {
          latitude: lat,
          longitude: lng,
          name: nome,
          address: endereco,
        },
      }),
    });
    return await res.json();
  } catch (e) {
    console.error("Erro Meta Location:", e);
  }
}

// ====================================================================
// PROCESSADOR PRINCIPAL DE MENSAGENS COM DEBOUNCE E MEMÓRIA DE SESSÃO
// ====================================================================
async function processarMensagem(message: any, contactName: string) {
  const from = message.from;
  const msgId = message.id;

  let textBody = "";
  let mediaBase64: { mimeType: string; data: string } | null = null;
  let mediaDataUri = "";

  if (from === "551141188017" || from === META_PHONE_NUMBER_ID || from === "1342513118936733") {
    return;
  }

  let buttonId = "";
  if (message.type === "text") {
    textBody = message.text?.body || "";
  } else if (message.type === "interactive") {
    buttonId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || "";
    textBody = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
  } else if (message.type === "audio") {
    const audioId = message.audio?.id;
    if (audioId) {
      mediaBase64 = await baixarMidiaMeta(audioId);
      if (mediaBase64) {
        mediaDataUri = `data:${mediaBase64.mimeType};base64,${mediaBase64.data}`;
      }
      textBody = "[Áudio de voz recebido]";
    }
  } else if (message.type === "image") {
    const imageId = message.image?.id;
    if (imageId) {
      mediaBase64 = await baixarMidiaMeta(imageId);
      if (mediaBase64) {
        mediaDataUri = `data:${mediaBase64.mimeType};base64,${mediaBase64.data}`;
      }
      textBody = message.image?.caption || "[Imagem recebida]";
    }
  }

  if (!textBody.trim() && !mediaBase64) return;

  // Marca imediatamente como lida na Meta API (dois tiques azuis)
  if (msgId) {
    marcarComoLidaMeta(msgId);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 0. TRAVA DE IDEMPOTÊNCIA E MUTEX CONCORRENTE NO BANCO DE DADOS
  const { data: convCheckInitial } = await supabase
    .from("whatsapp_conversas")
    .select("id, flow_state")
    .eq("telefone", from)
    .maybeSingle();

  if (msgId) {
    const wamids: string[] = convCheckInitial?.flow_state?.processed_wamids || [];
    if (wamids.includes(msgId)) {
      console.log(`[DEDUP BANCO] Mensagem ID ${msgId} já foi processada anteriormente. Abortando duplicata.`);
      return;
    }
  }

  // Registra o WAMID recebido no banco para evitar duplicatas em caso de retry da Meta
  if (convCheckInitial && msgId) {
    const updatedWamids = [...(convCheckInitial?.flow_state?.processed_wamids || []).slice(-30), msgId];
    await supabase.from("whatsapp_conversas").update({
      flow_state: {
        ...(convCheckInitial.flow_state || {}),
        processed_wamids: updatedWamids,
      }
    }).eq("id", convCheckInitial.id);
  }

  // 1. Obter ou Criar Cliente no Banco de Dados
  let clienteId: string | null = null;
  let clientePerfil: any = null;
  let historicoAgendamentos: any[] = [];
  try {
    const cleanPhone = from.replace(/\D/g, "");
    const phoneWithout55 = cleanPhone.startsWith("55") ? cleanPhone.slice(2) : cleanPhone;
    const { data: cliExist } = await supabase
      .from("clientes")
      .select("id, nome, plano_assinatura, status_assinatura, total_visitas, ultima_visita")
      .or(`telefone.ilike.%${phoneWithout55}%,telefone.ilike.%${cleanPhone}%`)
      .limit(1)
      .maybeSingle();

    if (cliExist) {
      clienteId = cliExist.id;
      clientePerfil = cliExist;
    } else {
      const { data: novoCli } = await supabase
        .from("clientes")
        .insert({
          nome: contactName || "Cliente WhatsApp",
          telefone: from,
          empresa_id: DEFAULT_EMPRESA_ID,
        })
        .select("id")
        .single();
      if (novoCli) clienteId = novoCli.id;
    }
  } catch (e: any) {
    console.error("Erro cliente:", e.message);
  }

  // 2. Salvar IMEDIATAMENTE a mensagem de entrada no banco de dados com trava anti-duplicidade
  const tipoMsgEntrada = message.type === "interactive" ? "botao_resposta" : message.type === "audio" ? "audio" : message.type === "image" ? "imagem" : "texto";
  const textoParaSalvarEntrada = message.type === "interactive" ? `👆 ${textBody}` : (mediaDataUri || textBody);

  try {
    const { data: msgRecente } = await supabase
      .from("whatsapp_mensagens")
      .select("id, created_at")
      .eq("telefone", from)
      .eq("mensagem", textoParaSalvarEntrada)
      .eq("direcao", "entrada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msgRecente && (Date.now() - new Date(msgRecente.created_at).getTime() < 2500)) {
      console.log(`[DEDUP ENTRADA] Mensagem idêntica de ${from} recebida há menos de 2.5s. Abortando.`);
      return;
    }

    await supabase.from("whatsapp_mensagens").insert({
      telefone: from,
      cliente_id: clienteId,
      mensagem: textoParaSalvarEntrada,
      direcao: "entrada",
      tipo: tipoMsgEntrada,
      lida: false,
    });
  } catch (e: any) {
    console.error("Erro ao salvar mensagem de entrada:", e.message);
  }

  // 3. Verificar status de atendimento humano e comandos de controle
  const { data: convExist } = await supabase
    .from("whatsapp_conversas")
    .select("id, nao_lidas, atendimento_humano, flow_state, booking_state")
    .eq("telefone", from)
    .maybeSingle();

  const txtTrim = semAcentos(textBody.trim());

  // Comandos e mensagens de solicitação de transbordo humano
  const ehComandoHumano = ehSolicitacaoAtendimentoHumano(textBody, buttonId);

  if (ehComandoHumano) {
    const emHorarioComercial = estaEmHorarioComercial();
    const proximoHorario = obterProximoHorarioComercial();
    const primeiroNome = contactName ? contactName.split(" ")[0] : "Cliente";

    if (emHorarioComercial) {
      if (convExist) {
        await supabase.from("whatsapp_conversas").update({
          atendimento_humano: true,
          status: "humano",
        }).eq("id", convExist.id);
      }
      const msgHumano = formatarRespostaFinal(
        `Entendido, ${primeiroNome}! Já notifiquei a nossa equipe de recepção para te atender por aqui com total atenção. O atendimento automático foi pausado.`,
        "Heloísa"
      );
      await enviarMensagemWhatsAppMeta(from, msgHumano);
      return;
    } else {
      const msgForaHorario = formatarRespostaFinal(
        `Nosso atendimento humano com a recepção funciona exclusivamente de segunda a sexta-feira, das 09:00 às 18:00.\n\nNo momento a nossa recepção está fora do expediente e retorna ${proximoHorario}.\n\nMas não se preocupe! Eu (Heloísa) estou aqui 24 horas por dia para tirar suas dúvidas, enviar os links do Booksy e te ajudar com tudo o que precisar. Pode continuar por aqui comigo! Como posso te ajudar agora, ${primeiroNome}?`,
        "Heloísa"
      );
      await enviarMensagemWhatsAppMeta(from, msgForaHorario);
      return;
    }
  }

  // Comandos / botões que reativam a IA automaticamente
  const ehComandoAtivarIa =
    txtTrim === "/reset" ||
    txtTrim === "#reset" ||
    txtTrim === "/ativar" ||
    txtTrim === "/ia" ||
    buttonId === "btn_agendar" ||
    buttonId === "btn_planos" ||
    buttonId.startsWith("srv_") ||
    buttonId.startsWith("unid_") ||
    buttonId.startsWith("btn_data_");

  if (ehComandoAtivarIa && convExist?.atendimento_humano) {
    await supabase.from("whatsapp_conversas").update({
      atendimento_humano: false,
      status: "ativa",
    }).eq("id", convExist.id);
    convExist.atendimento_humano = false;
  }

  // Se estiver em atendimento humano, NÃO responde com IA
  if (convExist?.atendimento_humano === true && !ehComandoAtivarIa) {
    await supabase.from("whatsapp_conversas").update({
      ultima_mensagem: textBody,
      ultima_mensagem_at: new Date().toISOString(),
      nao_lidas: (convExist.nao_lidas || 0) + 1,
    }).eq("id", convExist.id);
    return;
  }

  // RESET: Somente com comando explícito /reset ou #reset
  if (txtTrim === "/reset" || txtTrim === "#reset") {
    try {
      await supabase.from("whatsapp_mensagens").delete().eq("telefone", from);
      await supabase.from("whatsapp_conversas").delete().eq("telefone", from);
      if (clienteId) {
        await supabase
          .from("agendamentos")
          .update({ status: "cancelado", observacoes: "Cancelado via /reset de teste" })
          .eq("cliente_id", clienteId)
          .eq("status", "agendado");
      }
    } catch (_) {}

    const msgReset = formatarRespostaFinal(
      `✨ Histórico resetado com sucesso, ${contactName.split(" ")[0]}! Como posso te ajudar hoje na Barbearia Hermanos?`,
      "Heloísa"
    );

    const msgResetComBotoes = `${msgReset}\n\n🔘 [BOTAO: Agendar Horário]\n🔘 [BOTAO: Assinatura Infinite]`;

    try {
      await supabase.from("whatsapp_mensagens").insert({
        telefone: from,
        cliente_id: null,
        mensagem: msgResetComBotoes,
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
    } catch (_) {}

    const resBtn = await enviarBotoesMeta(from, msgReset, [
      { id: "btn_agendar", title: "Agendar Horário" },
      { id: "btn_planos", title: "Assinatura Infinite" },
    ]);
    if (resBtn?.error) await enviarMensagemWhatsAppMeta(from, msgReset);
    return;
  }

  // ====================================================================
  // 4. DEBOUNCE E BUFFERING OTIMIZADO (RESPOSTA RÁPIDA)
  // ====================================================================
  const batchId = msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (convExist) {
    await supabase.from("whatsapp_conversas").update({
      nome_contato: contactName,
      cliente_id: clienteId,
      ultima_mensagem: message.type === "audio" ? "🎙️ Áudio de voz" : textBody,
      ultima_mensagem_at: new Date().toISOString(),
      flow_state: {
        ...(convExist.flow_state || {}),
        last_msg_id: batchId,
        buffered_at: Date.now(),
      },
    }).eq("id", convExist.id);
  } else {
    await supabase.from("whatsapp_conversas").insert({
      telefone: from,
      nome_contato: contactName,
      cliente_id: clienteId,
      status: "ativa",
      atendimento_humano: false,
      ultima_mensagem: message.type === "audio" ? "🎙️ Áudio de voz" : textBody,
      ultima_mensagem_at: new Date().toISOString(),
      nao_lidas: 1,
      flow_state: {
        last_msg_id: batchId,
        buffered_at: Date.now(),
      },
      booking_state: {},
    });
  }

  // Se for botão interativo, não precisa de debounce
  if (message.type !== "interactive") {
    const { data: convCheck } = await supabase
      .from("whatsapp_conversas")
      .select("atendimento_humano")
      .eq("telefone", from)
      .maybeSingle();

    if (convCheck?.atendimento_humano === true) {
      return;
    }
  }

  // ====================================================================
  // 5. CONSOLIDAÇÃO DO LOTE DE MENSAGENS RECEBIDAS RECENTEMENTE
  // ====================================================================
  let textoConsolidado = textBody;
  let historicoTexto = "";

  try {
    const { data: ultimasMsgs } = await supabase
      .from("whatsapp_mensagens")
      .select("id, mensagem, direcao, created_at")
      .eq("telefone", from)
      .order("created_at", { ascending: false })
      .limit(24);

    if (ultimasMsgs && ultimasMsgs.length > 0) {
      const loteEntrada: string[] = [];
      const historicoAnterior: Array<{ direcao: string; mensagem: string }> = [];
      let encontrouUltimaSaida = false;

      for (const m of ultimasMsgs) {
        if (!encontrouUltimaSaida) {
          if (m.direcao === "entrada") {
            let msgTexto = m.mensagem.replace(/^👆\s*/, "").trim();
            if (msgTexto.startsWith("data:audio/") || m.tipo === "audio") {
              if (msgTexto.startsWith("data:") && !mediaBase64) {
                const matchData = msgTexto.match(/^data:([^;]+);base64,(.+)$/);
                if (matchData) {
                  mediaBase64 = { mimeType: matchData[1], data: matchData[2] };
                }
              }
              msgTexto = "[Áudio de voz do cliente]";
            } else if (msgTexto.startsWith("data:image/") || m.tipo === "imagem") {
              if (msgTexto.startsWith("data:") && !mediaBase64) {
                const matchData = msgTexto.match(/^data:([^;]+);base64,(.+)$/);
                if (matchData) {
                  mediaBase64 = { mimeType: matchData[1], data: matchData[2] };
                }
              }
              msgTexto = "[Imagem enviada pelo cliente]";
            }
            loteEntrada.unshift(msgTexto);
          } else {
            encontrouUltimaSaida = true;
            historicoAnterior.unshift(m);
          }
        } else {
          // No histórico anterior, também substitui data URIs gigantes para não estourar prompt
          let histMsg = m.mensagem;
          if (histMsg.startsWith("data:audio/")) histMsg = "[Áudio anterior do cliente]";
          else if (histMsg.startsWith("data:image/")) histMsg = "[Imagem anterior do cliente]";
          historicoAnterior.unshift({ ...m, mensagem: histMsg });
        }
      }

      if (loteEntrada.length > 0) {
        textoConsolidado = loteEntrada.join("\n");
      }

      historicoTexto = historicoAnterior
        .map((m) => `[${m.direcao === "entrada" ? contactName : "Heloísa"}]: ${m.mensagem.replace(/^\*.*?\*\s*💈\s*/i, "")}`)
        .join("\n");
    }
  } catch (e: any) {
    console.error("Erro ao consolidar histórico:", e.message);
  }

  const txtConsTrim = semAcentos(textoConsolidado.trim());

  // 6. Buscar Dados Oficiais da Empresa (Unidades completas, Serviços, Barbeiros, Produtos e Agente IA)
  let unidadesDb: any[] = [];
  let servicosDb: any[] = [];
  let produtosDb: any[] = [];
  let barbeirosDb: any[] = [];
  let barbeirosCodigos: string[] = ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"];
  let nomeAgente = "Heloísa";
  let tomAgente = "Simpática, acolhedora e profissional";
  let instrucoesExtrasDb = "";
  let feriadosDb: any[] = [];
  let agendamentosOcupadosDb: any[] = [];
  let modoV01Booksy = false;
  let promptV01Booksy = "";

  try {
    const agoraIso = new Date().toISOString();
    const limite7DiasIso = new Date(Date.now() + 7 * 86400000).toISOString();

    const [resU, resS, resP, resB, resAgente, resFeriados, resOcupados] = await Promise.all([
      supabase.from("unidades").select("id, nome, endereco, telefone, horario_abertura, horario_fechamento, link_booksy").eq("status", "active"),
      supabase.from("servicos").select("id, nome, preco, duracao_minutos, status").neq("status", "inactive"),
      supabase.from("produtos").select("id, nome, preco, categoria, estoque").eq("status", "active"),
      supabase.from("barbeiros").select("id, nome, codigo_cadeira, unidade_id").eq("status", "active").order("codigo_cadeira", { ascending: true }),
      supabase.from("agentes_ia").select("nome, tom, instrucoes_extras, modo_v01_booksy, prompt_v01_booksy, ativo").eq("empresa_id", DEFAULT_EMPRESA_ID).maybeSingle(),
      supabase.from("horarios_feriados").select("*").order("data", { ascending: true }),
      supabase.from("agendamentos").select("data_hora, duracao_minutos, barbeiro_id, barbeiros(codigo_cadeira), unidades(nome)").eq("status", "agendado").gte("data_hora", agoraIso).lte("data_hora", limite7DiasIso).order("data_hora", { ascending: true }),
    ]);

    if (resU.data && resU.data.length > 0) unidadesDb = resU.data;
    if (resS.data && resS.data.length > 0) servicosDb = resS.data;
    if (resP.data && resP.data.length > 0) produtosDb = resP.data;
    if (resB.data && resB.data.length > 0) {
      barbeirosDb = resB.data;
      barbeirosCodigos = resB.data.map((b: any) => b.codigo_cadeira).filter(Boolean);
    }
    if (resAgente.data) {
      nomeAgente = resAgente.data.nome || "Heloísa";
      tomAgente = resAgente.data.tom || "Simpática, acolhedora e profissional";
      instrucoesExtrasDb = resAgente.data.instrucoes_extras || "";
      modoV01Booksy = !!resAgente.data.modo_v01_booksy;
      promptV01Booksy = resAgente.data.prompt_v01_booksy || "";
    }
    if (resFeriados.data) {
      feriadosDb = resFeriados.data;
    }
    if (resOcupados.data) {
      agendamentosOcupadosDb = resOcupados.data;
    }
  } catch (_) {}

  // 7. Buscar Agendamento Ativo Existente do Cliente e Histórico Completo
  let agendamentoAtivoExistente: any = null;
  let agendamentoAtivoInfo = "";
  if (clienteId) {
    try {
      const agoraIso = new Date().toISOString();
      const [resAgAtivo, resHist] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id, data_hora, status, observacoes, barbeiros(nome, codigo_cadeira), unidades(nome, endereco), servicos(nome, preco)")
          .eq("cliente_id", clienteId)
          .eq("status", "agendado")
          .gte("data_hora", agoraIso)
          .order("data_hora", { ascending: true })
          .limit(1),
        supabase
          .from("agendamentos")
          .select("id, data_hora, status, observacoes, barbeiros(nome, codigo_cadeira), unidades(nome), servicos(nome)")
          .eq("cliente_id", clienteId)
          .order("data_hora", { ascending: false })
          .limit(5)
      ]);

      const ags = resAgAtivo.data;
      if (resHist.data) {
        historicoAgendamentos = resHist.data;
      }

      if (ags && ags.length > 0) {
        agendamentoAtivoExistente = ags[0];
        const d = new Date(agendamentoAtivoExistente.data_hora);
        const dataFmt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
        const horaFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const nomeBarbAtivo = agendamentoAtivoExistente.barbeiros?.nome || "Barbeiro";
        const codBarbAtivo = agendamentoAtivoExistente.barbeiros?.codigo_cadeira || "H1";
        agendamentoAtivoInfo = `• STATUS: CLIENTE JÁ TEM AGENDAMENTO CONFIRMADO!
• Serviço: ${agendamentoAtivoExistente.servicos?.nome || "Corte de Cabelo"}
• Unidade: ${agendamentoAtivoExistente.unidades?.nome || "Higienópolis"}
• Barbeiro: ${nomeBarbAtivo} (${codBarbAtivo})
• Horário: ${dataFmt} às ${horaFmt}`;
      }
    } catch (_) {}
  }

  // 8. DETECÇÃO INTELIGENTE DE PROFISSIONAL (H1 a H8 ou nomes) COM VALIDAÇÃO ANTI-ALUCINAÇÃO
  let codigoProfissional = "";
  let barbeiroInvalidoSolicitado = "";

  const codigosValidosHermanos = barbeirosCodigos.length > 0
    ? barbeirosCodigos
    : ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"];

  const detBarbeiro = detectarBarbeiroNoTexto(textoConsolidado, codigosValidosHermanos);
  codigoProfissional = detBarbeiro.codigoValido;
  barbeiroInvalidoSolicitado = detBarbeiro.codigoInvalido;

  // Só herda o profissional do agendamento existente se o cliente estiver explicitamente pedindo para remarcar/trocar o horário daquele agendamento
  const estaPedindoRemarcacao =
    buttonId === "btn_conf_trocar" ||
    txtConsTrim.includes("remarcar") ||
    txtConsTrim.includes("trocar") ||
    txtConsTrim.includes("mudar horario") ||
    txtConsTrim.includes("outro horario");

  if (!codigoProfissional && !barbeiroInvalidoSolicitado && estaPedindoRemarcacao && agendamentoAtivoExistente?.barbeiros?.codigo_cadeira) {
    codigoProfissional = agendamentoAtivoExistente.barbeiros.codigo_cadeira;
  }

  const bookingStateAtual = { ...(convExist?.booking_state || {}) };
  // Se o cliente não mencionou barbeiro nesta mensagem nem está remarcando, não prenda a conversa a um barbeiro anterior
  if (!codigoProfissional && !estaPedindoRemarcacao && bookingStateAtual.barbeiro) {
    delete bookingStateAtual.barbeiro;
  }

  // Determinismo estrito de botões/listas antes da IA
  if (buttonId === "srv_corte") bookingStateAtual.servico = "Corte de Cabelo";
  else if (buttonId === "srv_barba") bookingStateAtual.servico = "Barbaterapia";
  else if (buttonId === "srv_combo") bookingStateAtual.servico = "Corte + Barba";

  if (buttonId === "unid_higienopolis") bookingStateAtual.unidade = "Higienópolis";
  else if (buttonId === "unid_itaim") bookingStateAtual.unidade = "Itaim Bibi";
  else if (buttonId === "unid_mooca") bookingStateAtual.unidade = "Mooca";
  else if (buttonId === "unid_tatuape") bookingStateAtual.unidade = "Tatuapé";
  else if (buttonId === "unid_osasco") bookingStateAtual.unidade = "Osasco";
  else if (buttonId === "unid_caetano") bookingStateAtual.unidade = "São Caetano";
  else if (buttonId === "unid_freguesia") bookingStateAtual.unidade = "Freguesia do Ó";

  if (buttonId === "btn_data_hoje") bookingStateAtual.data = "Hoje";
  else if (buttonId === "btn_data_amanha") bookingStateAtual.data = "Amanhã";

  // 9. Gerar IA com Google Gemini
  const respostaCrua = await gerarRespostaGemini(
    historicoTexto,
    textoConsolidado,
    contactName,
    from,
    codigoProfissional,
    unidadesDb,
    servicosDb,
    produtosDb,
    barbeirosCodigos,
    agendamentoAtivoInfo,
    bookingStateAtual,
    mediaBase64,
    nomeAgente,
    tomAgente,
    instrucoesExtrasDb,
    feriadosDb,
    barbeirosDb,
    barbeiroInvalidoSolicitado,
    clientePerfil,
    historicoAgendamentos,
    agendamentosOcupadosDb,
    modoV01Booksy,
    promptV01Booksy
  );

  // Extrair tag de ação e limpar texto final para o cliente
  const matchAcao = respostaCrua.match(/\[ACAO:\s*([^\]]+)\]/i);
  const tagAcao = matchAcao ? matchAcao[1] : "CONVERSAR";
  let respostaFinal = formatarRespostaFinal(respostaCrua, nomeAgente);

  // Se estiver no Modo Booksy v0.1 e a resposta contiver o link genérico do app, substitui pelo link do Booksy da unidade!
  if (modoV01Booksy && (respostaFinal.includes("barbeariahermanos.com.br/hermanos/cliente") || respostaFinal.includes("barbeariahermanos.com.br/cliente"))) {
    const undSearch = semAcentos(`${textoConsolidado} ${historicoTexto} ${bookingStateAtual?.unidade || ""}`);
    let linkBooksySubst = "https://barbeariahermanosos.booksy.com/";
    if (undSearch.includes("higienopolis")) linkBooksySubst = "https://bit.ly/3BarbeariaHermanosSantaCecilia";
    else if (undSearch.includes("osasco")) linkBooksySubst = "https://barbeariahermanosos.booksy.com/";
    else if (undSearch.includes("mooca")) linkBooksySubst = "https://barbeariahermanosmooca.booksy.com/";
    else if (undSearch.includes("tatuape")) linkBooksySubst = "https://hermanostatuape.booksy.com/";
    else if (undSearch.includes("freguesia")) linkBooksySubst = "https://bit.ly/AgendaBarbeariaHermanos";
    else if (undSearch.includes("caetano")) linkBooksySubst = "https://bit.ly/3W42IXa";
    else if (undSearch.includes("itaim")) linkBooksySubst = "https://bit.ly/3yGUY63";

    respostaFinal = respostaFinal
      .replace(/https?:\/\/barbeariahermanos\.com\.br\/hermanos\/cliente[^\s]*/gi, linkBooksySubst)
      .replace(/https?:\/\/barbeariahermanos\.com\.br\/cliente[^\s]*/gi, linkBooksySubst);
  }

  // Atualizar booking_state com base na tag de ação
  let novoBookingState = { ...bookingStateAtual };
  if (matchAcao) {
    const srvMatch = tagAcao.match(/SERVICO:\s*([^|]+)/i);
    const undMatch = tagAcao.match(/UNIDADE:\s*([^|]+)/i);
    const datMatch = tagAcao.match(/DATA:\s*([^|]+)/i);
    const horMatch = tagAcao.match(/HORA:\s*([^|]+)/i);
    const barMatch = tagAcao.match(/BARBEIRO:\s*([^|]+)/i);

    if (srvMatch && temValorReal(srvMatch[1])) novoBookingState.servico = srvMatch[1].trim();
    if (undMatch && temValorReal(undMatch[1])) novoBookingState.unidade = undMatch[1].trim();
    if (datMatch && temValorReal(datMatch[1])) novoBookingState.data = datMatch[1].trim();
    if (horMatch && temValorReal(horMatch[1])) novoBookingState.hora = horMatch[1].trim();
    // Barbeiro só é fixado na memória da sessão se o cliente pediu ou se o agendamento foi oficialmente confirmado
    if (barMatch && temValorReal(barMatch[1]) && (codigoProfissional || tagAcao.includes("CONFIRMAR"))) {
      novoBookingState.barbeiro = barMatch[1].trim();
    } else if (!codigoProfissional && !tagAcao.includes("CONFIRMAR")) {
      delete novoBookingState.barbeiro;
    }
  }
  if (codigoProfissional && !barbeiroInvalidoSolicitado) {
    novoBookingState.barbeiro = codigoProfissional;
  }
  if (buttonId.startsWith("srv_")) novoBookingState.servico = bookingStateAtual.servico;
  if (buttonId.startsWith("unid_")) novoBookingState.unidade = bookingStateAtual.unidade;



  // Trava anti-duplicação de saída: impede que a MESMA resposta seja enviada duas vezes se houver retry
  const { data: ultimaSaidaRecente } = await supabase
    .from("whatsapp_mensagens")
    .select("created_at, mensagem")
    .eq("telefone", from)
    .eq("direcao", "saida")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaSaidaRecente && ultimaSaidaRecente.mensagem === respostaFinal && (Date.now() - new Date(ultimaSaidaRecente.created_at).getTime() < 5000)) {
    console.log(`[DEDUP SAÍDA] Resposta idêntica já enviada para ${from} há menos de 5s. Abortando envio duplicado.`);
    return;
  }

  // 10. Salvar saída no banco e Atualizar/Criar Agendamento no Banco
  let resultadoAgendamento = { agendamentoCriado: false, cancelado: false, unidadeNome: "", unidadeChave: "higienopolis" };
  try {
    await supabase.from("whatsapp_mensagens").insert({
      telefone: from,
      cliente_id: clienteId,
      mensagem: respostaFinal,
      direcao: "saida",
      tipo: "ia",
      lida: true,
    });

    await supabase.from("whatsapp_conversas").update({
      ultima_mensagem: respostaFinal,
      ultima_mensagem_at: new Date().toISOString(),
      nao_lidas: 0,
      booking_state: novoBookingState,
    }).eq("telefone", from);

    resultadoAgendamento = await gerenciarAgendamentoNoBanco(
      supabase,
      clienteId || "",
      respostaFinal,
      textoConsolidado,
      codigoProfissional,
      tagAcao,
      unidadesDb,
      servicosDb,
      barbeirosDb,
      agendamentoAtivoExistente,
      novoBookingState,
      barbeiroInvalidoSolicitado
    );

    await gerenciarCandidatoNoBanco(
      supabase,
      DEFAULT_EMPRESA_ID,
      from,
      contactName,
      tagAcao,
      respostaFinal,
      textoConsolidado
    );

    if (resultadoAgendamento.agendamentoCriado && resultadoAgendamento.unidadeNome) {
      novoBookingState.unidade = resultadoAgendamento.unidadeNome;
      await supabase.from("whatsapp_conversas").update({
        booking_state: novoBookingState,
      }).eq("telefone", from);
    }

    if (resultadoAgendamento.cancelado || tagAcao.includes("CANCELAR")) {
      novoBookingState = {};
      await supabase.from("whatsapp_conversas").update({
        booking_state: {},
      }).eq("telefone", from);
    }
  } catch (e: any) {
    console.error("Erro ao salvar saída:", e.message);
  }

  // 11. DECISÃO DE INTERATIVIDADE: RESPEITO TOTAL AO PROMPT MASTER E DIÁLOGO LIVRE
  const estaTrocandoOuRemarcando =
    buttonId === "btn_conf_trocar" ||
    txtConsTrim.includes("trocar") ||
    txtConsTrim.includes("remarcar") ||
    txtConsTrim.includes("mudar horario");

  const ehFinalizacaoAgendamento =
    !barbeiroInvalidoSolicitado &&
    (resultadoAgendamento.agendamentoCriado || buttonId === "btn_conf_confirmar") &&
    !estaTrocandoOuRemarcando &&
    (respostaFinal.toLowerCase().includes("confirmado") ||
     respostaFinal.toLowerCase().includes("agendado") ||
     respostaFinal.toLowerCase().includes("te esperamos"));

  // Saudação inicial somente quando o cliente manda uma saudação sem contexto prévio
  const ehSaudacao =
    !historicoTexto &&
    (txtConsTrim === "ola" ||
     txtConsTrim === "oi" ||
     txtConsTrim === "ola heloisa" ||
     txtConsTrim === "oi heloisa" ||
     txtConsTrim === "bom dia" ||
     txtConsTrim === "boa tarde" ||
     txtConsTrim === "boa noite" ||
     txtConsTrim === "opa" ||
     txtConsTrim === "e ai" ||
     txtConsTrim === "tudo bem");

  // CASO 1: Agendamento finalizado com sucesso -> Envia link do App + Botões de ação pós-agendamento
  if (ehFinalizacaoAgendamento) {
    let linkAppCliente = "https://barbeariahermanos.com.br/hermanos/cliente";
    if (clienteId) {
      try {
        const randomArr = new Uint8Array(16);
        crypto.getRandomValues(randomArr);
        const token = Array.from(randomArr, (b) => b.toString(16).padStart(2, "0")).join("");
        const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("cliente_magic_links").insert({
          token,
          cliente_id: clienteId,
          expira_em: expiraEm,
          usado: false,
        });

        linkAppCliente = `https://barbeariahermanos.com.br/hermanos/cliente?auth=${token}`;
      } catch (err: any) {
        console.error("Erro ao gerar magic link:", err.message);
      }
    }

    let textoComLink = respostaFinal;
    if (!textoComLink.includes("barbeariahermanos.com.br/hermanos/cliente") && !textoComLink.includes("barbeariahermanos.com.br/cliente")) {
      textoComLink += `\n\n📱 *Acompanhe seu agendamento no nosso app:* ${linkAppCliente}`;
    }

    const botoesPosConfirmacao = [
      { id: "btn_conf_trocar", title: "🔄 Trocar Horário" },
      { id: "btn_conf_cancelar", title: "❌ Cancelar Reserva" },
      { id: "btn_falar_humano", title: "👤 Falar c/ Equipe" },
    ];
    await enviarBotoesMeta(from, textoComLink, botoesPosConfirmacao);
  } else if (ehSaudacao) {
    // CASO 2: Saudação inicial de boas-vindas com opções rápidas (apenas 2 botões)
    const resB = await enviarBotoesMeta(from, respostaFinal, [
      { id: "btn_agendar", title: "📅 Agendar Horário" },
      { id: "btn_planos", title: "👑 Assinatura Infinite" },
    ]);
    if (resB?.error) await enviarMensagemWhatsAppMeta(from, respostaFinal);
  } else {
    // CASO 3: DIÁLOGO TOTALMENTE LIVRE E AUTÔNOMO COM A HELOÍSA
    // Sem interceptar o fluxo com botões repetidos ou travas
    await enviarMensagemWhatsAppMeta(from, respostaFinal);
  }

}


// Servidor Deno HTTP
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();

      // ====================================================================
      // 1. AÇÃO MANUAL VIA CRM: ENVIAR MENSAGEM PELO BACKEND SEGURO
      // ====================================================================
            // ====================================================================
      // AÇÃO VIA APP CLIENTE: CHAT DIRETO COM A HELOÍSA (SEM CUSTO DA META)
      // ====================================================================
      if (body?.action === "app_chat") {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const clienteId = body.cliente_id;
        const textoEntrada = body.mensagem || "";
        const nomeCliente = body.nome_cliente || "Cliente";
        const telefoneCliente = body.telefone || "";

        if (!textoEntrada || !textoEntrada.trim()) {
          return new Response(JSON.stringify({ error: "Mensagem vazia" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 1. Carregar perfil do cliente e histórico
        let clientePerfil: any = null;
        let historicoAgendamentos: any[] = [];
        let agendamentoAtivoExistente: any = null;
        let agendamentoAtivoInfo = "";

        if (clienteId) {
          const [resCli, resAgAtivo, resHist] = await Promise.all([
            supabase
              .from("clientes")
              .select("id, nome, plano_assinatura, status_assinatura, total_visitas, ultima_visita")
              .eq("id", clienteId)
              .maybeSingle(),
            supabase
              .from("agendamentos")
              .select("id, data_hora, status, observacoes, barbeiros(nome, codigo_cadeira), unidades(nome, endereco), servicos(nome, preco)")
              .eq("cliente_id", clienteId)
              .eq("status", "agendado")
              .gte("data_hora", new Date().toISOString())
              .order("data_hora", { ascending: true })
              .limit(1),
            supabase
              .from("agendamentos")
              .select("id, data_hora, status, observacoes, barbeiros(nome, codigo_cadeira), unidades(nome), servicos(nome)")
              .eq("cliente_id", clienteId)
              .order("data_hora", { ascending: false })
              .limit(5)
          ]);

          clientePerfil = resCli.data;
          if (resHist.data) historicoAgendamentos = resHist.data;

          const ags = resAgAtivo.data;
          if (ags && ags.length > 0) {
            agendamentoAtivoExistente = ags[0];
            const d = new Date(agendamentoAtivoExistente.data_hora);
            const dataFmt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
            const horaFmt = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            agendamentoAtivoInfo = `• STATUS: CLIENTE JÁ TEM AGENDAMENTO CONFIRMADO!
• Serviço: ${agendamentoAtivoExistente.servicos?.nome || "Corte de Cabelo"}
• Unidade: ${agendamentoAtivoExistente.unidades?.nome || "Higienópolis"}
• Barbeiro: ${agendamentoAtivoExistente.barbeiros?.nome || "Profissional H1"} (${agendamentoAtivoExistente.barbeiros?.codigo_cadeira || "H1"})
• Horário: ${dataFmt} às ${horaFmt}`;
          }
        }

        const agoraAppIso = new Date().toISOString();
        const limiteApp7DiasIso = new Date(Date.now() + 7 * 86400000).toISOString();

        // 2. Buscar Dados Oficiais da Barbearia
        const [resU, resS, resP, resB, resAgente, resFeriados, resOcupados] = await Promise.all([
          supabase.from("unidades").select("id, nome, endereco, telefone, horario_abertura, horario_fechamento, link_booksy").eq("status", "active"),
          supabase.from("servicos").select("id, nome, preco, duracao_minutos, status").neq("status", "inactive"),
          supabase.from("produtos").select("id, nome, preco, categoria, estoque").eq("status", "active"),
          supabase.from("barbeiros").select("id, nome, codigo_cadeira, unidade_id").eq("status", "active").order("codigo_cadeira", { ascending: true }),
          supabase.from("agentes_ia").select("nome, tom, instrucoes_extras, modo_v01_booksy, prompt_v01_booksy, ativo").eq("empresa_id", DEFAULT_EMPRESA_ID).maybeSingle(),
          supabase.from("horarios_feriados").select("*").order("data", { ascending: true }),
          supabase.from("agendamentos").select("data_hora, duracao_minutos, barbeiro_id, barbeiros(codigo_cadeira), unidades(nome)").eq("status", "agendado").gte("data_hora", agoraAppIso).lte("data_hora", limiteApp7DiasIso).order("data_hora", { ascending: true }),
        ]);

        const unidadesDb = resU.data || [];
        const servicosDb = resS.data || [];
        const produtosDb = resP.data || [];
        const barbeirosDb = resB.data || [];
        const barbeirosCodigos = barbeirosDb.map((b: any) => b.codigo_cadeira).filter(Boolean);
        const nomeAgente = resAgente.data?.nome || "Heloísa";
        const tomAgente = resAgente.data?.tom || "Simpática, acolhedora e profissional";
        const instrucoesExtrasDb = resAgente.data?.instrucoes_extras || "";
        const modoV01Booksy = !!resAgente.data?.modo_v01_booksy;
        const promptV01Booksy = resAgente.data?.prompt_v01_booksy || "";
        const feriadosDb = resFeriados.data || [];
        const agendamentosOcupadosDb = resOcupados.data || [];

        // 3. Histórico da conversa no App
        const historicoMsgs = Array.isArray(body.historico) ? body.historico : [];
        const historicoTexto = historicoMsgs
          .map((m: any) => `[${m.origem === "usuario" ? nomeCliente : nomeAgente}]: ${m.texto}`)
          .join("\n");

        const detBarbeiro = detectarBarbeiroNoTexto(textoEntrada, barbeirosCodigos);
        const codigoProfissional = detBarbeiro.codigoValido;
        const barbeiroInvalidoSolicitado = detBarbeiro.codigoInvalido;

        const bookingState = body.booking_state || {};

        // 4. Gerar resposta com a Heloísa (Google Gemini)
        const respostaCrua = await gerarRespostaGemini(
          historicoTexto,
          textoEntrada,
          nomeCliente,
          telefoneCliente,
          codigoProfissional,
          unidadesDb,
          servicosDb,
          produtosDb,
          barbeirosCodigos,
          agendamentoAtivoInfo,
          bookingState,
          null,
          nomeAgente,
          tomAgente,
          instrucoesExtrasDb,
          feriadosDb,
          barbeirosDb,
          barbeiroInvalidoSolicitado,
          clientePerfil,
          historicoAgendamentos,
          agendamentosOcupadosDb,
          modoV01Booksy,
          promptV01Booksy
        );

        // 5. Extrair ação e limpar texto final
        const matchAcao = respostaCrua.match(/\[ACAO:\s*([^\]]+)\]/i);
        const tagAcao = matchAcao ? matchAcao[1] : "CONVERSAR";
        let respostaFinal = formatarRespostaFinal(respostaCrua, nomeAgente);

        // Se estiver no Modo Booksy v0.1 e a resposta contiver o link genérico do app, substitui pelo link do Booksy da unidade!
        if (modoV01Booksy && (respostaFinal.includes("barbeariahermanos.com.br/hermanos/cliente") || respostaFinal.includes("barbeariahermanos.com.br/cliente"))) {
          const undSearch = semAcentos(`${textoEntrada} ${historicoTexto} ${bookingState?.unidade || ""}`);
          let linkBooksySubst = "https://barbeariahermanosos.booksy.com/";
          if (undSearch.includes("higienopolis")) linkBooksySubst = "https://bit.ly/3BarbeariaHermanosSantaCecilia";
          else if (undSearch.includes("osasco")) linkBooksySubst = "https://barbeariahermanosos.booksy.com/";
          else if (undSearch.includes("mooca")) linkBooksySubst = "https://barbeariahermanosmooca.booksy.com/";
          else if (undSearch.includes("tatuape")) linkBooksySubst = "https://hermanostatuape.booksy.com/";
          else if (undSearch.includes("freguesia")) linkBooksySubst = "https://bit.ly/AgendaBarbeariaHermanos";
          else if (undSearch.includes("caetano")) linkBooksySubst = "https://bit.ly/3W42IXa";
          else if (undSearch.includes("itaim")) linkBooksySubst = "https://bit.ly/3yGUY63";

          respostaFinal = respostaFinal
            .replace(/https?:\/\/barbeariahermanos\.com\.br\/hermanos\/cliente[^\s]*/gi, linkBooksySubst)
            .replace(/https?:\/\/barbeariahermanos\.com\.br\/cliente[^\s]*/gi, linkBooksySubst);
        }

        // Se for no app, remove a etiqueta do whatsapp para ficar clean
        respostaFinal = respostaFinal.replace(/^\*Heloísa - Barbearia Hermanos\*\s*💈\s*/i, "").trim();

        // 6. Atualizar booking_state
        const novoBookingState = { ...bookingState };
        if (matchAcao) {
          const srvMatch = tagAcao.match(/SERVICO:\s*([^|]+)/i);
          const undMatch = tagAcao.match(/UNIDADE:\s*([^|]+)/i);
          const datMatch = tagAcao.match(/DATA:\s*([^|]+)/i);
          const horMatch = tagAcao.match(/HORA:\s*([^|]+)/i);
          const barMatch = tagAcao.match(/BARBEIRO:\s*([^|]+)/i);

          if (srvMatch && temValorReal(srvMatch[1])) novoBookingState.servico = srvMatch[1].trim();
          if (undMatch && temValorReal(undMatch[1])) novoBookingState.unidade = undMatch[1].trim();
          if (datMatch && temValorReal(datMatch[1])) novoBookingState.data = datMatch[1].trim();
          if (horMatch && temValorReal(horMatch[1])) novoBookingState.hora = horMatch[1].trim();
          if (barMatch && temValorReal(barMatch[1]) && (codigoProfissional || tagAcao.includes("CONFIRMAR"))) {
            novoBookingState.barbeiro = barMatch[1].trim();
          } else if (!codigoProfissional && !tagAcao.includes("CONFIRMAR")) {
            delete novoBookingState.barbeiro;
          }
        }
        if (codigoProfissional && !barbeiroInvalidoSolicitado) {
          novoBookingState.barbeiro = codigoProfissional;
        }

        // 7. Persistir Agendamento se confirmado
        let resultadoAgendamento = { agendamentoCriado: false, cancelado: false, unidadeNome: "" };
        if (clienteId) {
          resultadoAgendamento = await gerenciarAgendamentoNoBanco(
            supabase,
            clienteId,
            respostaFinal,
            textoEntrada,
            codigoProfissional,
            tagAcao,
            unidadesDb,
            servicosDb,
            barbeirosDb,
            agendamentoAtivoExistente,
            novoBookingState,
            barbeiroInvalidoSolicitado
          );
        }

        // 8. Salvar no CRM / Histórico de Conversas (com Tag "App Cliente")
        try {
          const telIdentificador = telefoneCliente || (clienteId ? `app_${clienteId.slice(0, 10)}` : "app_anonimo");

          // Mensagem de entrada do cliente
          await supabase.from("whatsapp_mensagens").insert({
            telefone: telIdentificador,
            cliente_id: clienteId || null,
            mensagem: textoEntrada,
            direcao: "entrada",
            tipo: "app_cliente",
            lida: true,
          });

          // Mensagem de resposta da IA
          await supabase.from("whatsapp_mensagens").insert({
            telefone: telIdentificador,
            cliente_id: clienteId || null,
            mensagem: respostaFinal,
            direcao: "saida",
            tipo: "app_cliente",
            lida: true,
          });

          // Upsert na conversa para aparecer em Tempo Real na aba de Marketing
          const { data: convExist } = await supabase
            .from("whatsapp_conversas")
            .select("id")
            .eq("telefone", telIdentificador)
            .maybeSingle();

          if (convExist) {
            await supabase.from("whatsapp_conversas").update({
              nome_contato: nomeCliente,
              cliente_id: clienteId || null,
              ultima_mensagem: respostaFinal,
              ultima_mensagem_at: new Date().toISOString(),
              booking_state: novoBookingState,
              updated_at: new Date().toISOString(),
            }).eq("id", convExist.id);
          } else {
            await supabase.from("whatsapp_conversas").insert({
              telefone: telIdentificador,
              nome_contato: nomeCliente,
              cliente_id: clienteId || null,
              status: "ativa",
              atendimento_humano: false,
              ultima_mensagem: respostaFinal,
              ultima_mensagem_at: new Date().toISOString(),
              nao_lidas: 0,
              booking_state: novoBookingState,
            });
          }
        } catch (crmErr: any) {
          console.error("Erro ao salvar histórico do App no CRM:", crmErr.message);
        }

        return new Response(
          JSON.stringify({
            resposta: respostaFinal,
            tag_acao: tagAcao,
            booking_state: novoBookingState,
            agendamento_criado: resultadoAgendamento.agendamentoCriado,
            agendamento_cancelado: resultadoAgendamento.cancelado,
            unidade: resultadoAgendamento.unidadeNome,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

if (body?.action === "send_manual_message") {
        const to = body.to;
        const text = body.text;
        if (!to || !text) {
          return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const resMeta = await enviarMensagemWhatsAppMeta(to, text);
        const msgId = resMeta?.messages?.[0]?.id;
        return new Response(
          JSON.stringify({
            success: !resMeta?.error,
            messageId: msgId,
            error: resMeta?.error?.message,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ====================================================================
      // 2. AÇÃO MANUAL VIA CRM: TESTE DE CONEXÃO META
      // ====================================================================
      if (body?.action === "test_connection") {
        const testUrl = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}`;
        const resTest = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
        });
        const dataTest = await resTest.json();
        return new Response(
          JSON.stringify({
            online: resTest.ok,
            dados: dataTest,
            error: dataTest?.error?.message,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (body?.action === "test_gemini") {
        const model = body.model || "gemini-3.6-flash";
        const text = body.text || "Ola";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }),
        });
        const data = await res.json();
        return new Response(JSON.stringify({ status: res.status, ok: res.ok, model, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ====================================================================
      // 3. TESTE DE CONEXÃO COM CONTA DE ANÚNCIOS (META ADS)
      // ====================================================================
      if (body?.action === "test_ads_connection") {
        const adAccountId = (body.ad_account_id || "act_939706096831223").replace(/^act_/, "");
        const testUrl = `https://graph.facebook.com/v21.0/act_${adAccountId}?fields=name,account_id,currency,account_status,amount_spent`;
        const resTest = await fetch(testUrl, {
          headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}` },
        });
        const dataTest = await resTest.json();
        return new Response(
          JSON.stringify({
            ok: resTest.ok,
            status: resTest.status,
            dados: dataTest,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ====================================================================
      // 3. FLUXO NORMAL DO WEBHOOK DA META (SUPORTE COMPLETO A MENSAGENS EM LOTE)
      // ====================================================================
      if (body?.entry && Array.isArray(body.entry)) {
        for (const entryItem of body.entry) {
          const changes = entryItem?.changes || [];
          for (const change of changes) {
            const val = change?.value;
            if (val?.messages && Array.isArray(val.messages) && val.messages.length > 0) {
              const contactName = val.contacts?.[0]?.profile?.name || "Cliente";

              for (let i = 0; i < val.messages.length; i++) {
                const message = val.messages[i];
                if (!isDuplicate(message.id)) {
                  if (i > 0) {
                    await new Promise((r) => setTimeout(r, i * 120));
                  }
                  await processarMensagem(message, contactName);
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "EVENT_RECEIVED" }), { status: 200, headers: corsHeaders });
    } catch (err: any) {
      console.error("Erro no webhook:", err);
      return new Response(JSON.stringify({ status: "ERROR", message: err.message }), { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
