import { format } from "date-fns";
import { CaixaSessao } from "@/types/caixa";

const CAIXA_SESSIONS_KEY = "hermanos_caixa_sessoes";
const CAIXA_HISTORICO_KEY = "historico_fechamentos_caixa";

/**
 * Retorna a chave do dia no formato YYYY-MM-DD
 */
export function getHojeDataKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Retorna a lista completa de sessões gravadas
 */
export function getAllCaixaSessoes(): CaixaSessao[] {
  try {
    const raw = localStorage.getItem(CAIXA_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Salva a lista de sessões de caixa
 */
function saveAllCaixaSessoes(sessoes: CaixaSessao[]): void {
  try {
    localStorage.setItem(CAIXA_SESSIONS_KEY, JSON.stringify(sessoes.slice(0, 200)));
  } catch (err) {
    console.error("Erro ao salvar sessoes de caixa:", err);
  }
}

/**
 * Busca a sessão de caixa para uma unidade e data específica
 */
export function getCaixaSessao(unidadeId: string | null | undefined, dataStr: string = getHojeDataKey()): CaixaSessao | null {
  const sessoes = getAllCaixaSessoes();
  const targetUnidade = unidadeId || "all";
  return sessoes.find((s) => (s.unidade_id === targetUnidade || s.unidade_id === "all" || targetUnidade === "all") && s.data === dataStr) || null;
}

/**
 * Abre o caixa para a unidade no dia de hoje (Abertura Matinal pelo Gerente).
 * Não permite abrir novamente caso o caixa do dia já tenha sido fechado.
 */
export function abrirCaixa(params: {
  unidadeId: string;
  unidadeNome: string;
  userEmail: string;
  userNome: string;
  fundoTroco: number;
  observacao?: string;
}): CaixaSessao {
  const dataHoje = getHojeDataKey();
  const sessoes = getAllCaixaSessoes();
  const targetUnidade = params.unidadeId || "all";

  const existingIdx = sessoes.findIndex(
    (s) => (s.unidade_id === targetUnidade || s.unidade_id === "all") && s.data === dataHoje
  );

  if (existingIdx >= 0 && sessoes[existingIdx].status === "fechado") {
    throw new Error("O caixa de hoje já foi fechado e homologado com 2FA. A nova abertura estará disponível apenas no próximo dia de expediente.");
  }

  const novaSessao: CaixaSessao = {
    id: `CX-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`,
    unidade_id: targetUnidade,
    unidade_nome: params.unidadeNome,
    data: dataHoje,
    status: "aberto",
    aberto_em: new Date().toISOString(),
    aberto_por_email: params.userEmail,
    aberto_por_nome: params.userNome,
    fundo_troco_inicial: params.fundoTroco,
    observacao_abertura: params.observacao,
  };

  if (existingIdx >= 0) {
    sessoes[existingIdx] = {
      ...sessoes[existingIdx],
      status: "aberto",
      aberto_em: novaSessao.aberto_em,
      aberto_por_email: novaSessao.aberto_por_email,
      aberto_por_nome: novaSessao.aberto_por_nome,
      fundo_troco_inicial: novaSessao.fundo_troco_inicial,
      observacao_abertura: novaSessao.observacao_abertura,
    };
  } else {
    sessoes.unshift(novaSessao);
  }

  saveAllCaixaSessoes(sessoes);
  return novaSessao;
}

/**
 * Fecha e homologa o caixa do dia (Fechamento Noturno com 2FA)
 */
export function fecharCaixa(params: {
  unidadeId: string;
  unidadeNome: string;
  userEmail: string;
  userNome: string;
  protocolo: string;
  saldoEsperadoGaveta: number;
  valorContadoGaveta: number;
  diferencaGaveta: number;
  observacoes?: string;
  resumoVendas: any;
  comandasResumo: any[];
  fundoTroco: number;
}): CaixaSessao {
  const dataHoje = getHojeDataKey();
  const sessoes = getAllCaixaSessoes();
  const targetUnidade = params.unidadeId || "all";

  const existingIdx = sessoes.findIndex(
    (s) => (s.unidade_id === targetUnidade || s.unidade_id === "all") && s.data === dataHoje
  );

  const sessaoFechada: CaixaSessao = {
    id: existingIdx >= 0 ? sessoes[existingIdx].id : `CX-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`,
    protocolo: params.protocolo,
    unidade_id: targetUnidade,
    unidade_nome: params.unidadeNome,
    data: dataHoje,
    status: "fechado",
    aberto_em: existingIdx >= 0 ? sessoes[existingIdx].aberto_em : new Date().toISOString(),
    aberto_por_email: existingIdx >= 0 ? sessoes[existingIdx].aberto_por_email : params.userEmail,
    aberto_por_nome: existingIdx >= 0 ? sessoes[existingIdx].aberto_por_nome : params.userNome,
    fundo_troco_inicial: existingIdx >= 0 ? sessoes[existingIdx].fundo_troco_inicial : params.fundoTroco,
    fechado_em: new Date().toISOString(),
    fechado_por_email: params.userEmail,
    fechado_por_nome: params.userNome,
    saldo_esperado_gaveta: params.saldoEsperadoGaveta,
    valor_contado_gaveta: params.valorContadoGaveta,
    diferenca_gaveta: params.diferencaGaveta,
    observacoes_fechamento: params.observacoes,
    resumo_vendas: params.resumoVendas,
    comandas_resumo: params.comandasResumo,
  };

  if (existingIdx >= 0) {
    sessoes[existingIdx] = sessaoFechada;
  } else {
    sessoes.unshift(sessaoFechada);
  }

  saveAllCaixaSessoes(sessoes);

  // Também salvar no historico_fechamentos_caixa para compatibilidade
  try {
    const historico = JSON.parse(localStorage.getItem(CAIXA_HISTORICO_KEY) || "[]");
    historico.unshift(sessaoFechada);
    localStorage.setItem(CAIXA_HISTORICO_KEY, JSON.stringify(historico.slice(0, 100)));
  } catch {}

  return sessaoFechada;
}

/**
 * Verifica e auto-fecha caixas de dias anteriores que ficaram abertos por esquecimento do gerente.
 * Gera registro de incidente de não conformidade auditável para o SuperAdmin.
 */
export function verificarEAutoFecharCaixasAnteriores(unidadeId?: string | null): CaixaSessao[] {
  const sessoes = getAllCaixaSessoes();
  const dataHoje = getHojeDataKey();
  const incidentes: CaixaSessao[] = [];
  let alterou = false;

  sessoes.forEach((s) => {
    // Se a sessão pertence a um dia anterior e ainda está com status aberto
    if (s.data < dataHoje && s.status === "aberto") {
      s.status = "fechado_inadvertido";
      s.fechado_em = new Date().toISOString();
      s.detectado_virada_em = new Date().toISOString();
      s.fechado_por_nome = "Sistema (Auto-Fechamento Virada de Dia)";
      s.fechado_por_email = "sistema@hermanos.com";
      s.incidente_nao_conformidade = true;
      s.data_inconformidade = s.data;
      s.auto_fechado_motivo = `⚠️ NÃO CONFORMIDADE: Caixa do dia ${s.data} não foi encerrado pelo gerente (${s.aberto_por_nome}) no encerramento do expediente anterior.`;
      s.observacoes_fechamento = s.auto_fechado_motivo;
      incidentes.push({ ...s });
      alterou = true;
    }
  });

  if (alterou) {
    saveAllCaixaSessoes(sessoes);
  }

  return incidentes;
}

/**
 * Retorna todos os incidentes de caixas não fechados no dia correto para o SuperAdmin
 */
export function getIncidentesCaixas(): CaixaSessao[] {
  // Roda a checagem primeiro para garantir dados atualizados
  verificarEAutoFecharCaixasAnteriores();
  const sessoes = getAllCaixaSessoes();
  return sessoes.filter((s) => s.status === "fechado_inadvertido" || s.incidente_nao_conformidade === true);
}
