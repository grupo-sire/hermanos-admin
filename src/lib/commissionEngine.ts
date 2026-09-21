import { supabase } from "@/integrations/supabase/client";

export interface CommissionConfig {
  gestor_produto_perc: number; // Padrão: 20%
  barbeiro_servico_perc: number; // Padrão: 35%
  barbeiro_assinatura_perc: number; // Padrão: 35%
  barbeiro_produto_pool_perc: number; // Padrão: 30%
  campanhas?: CampaignOverride[];
}

export interface CampaignOverride {
  id: string;
  tipo: "unidade" | "gestor" | "barbeiro";
  target_id: string;
  target_nome?: string;
  gestor_produto_perc?: number;
  barbeiro_servico_perc?: number;
  barbeiro_produto_pool_perc?: number;
  motivo?: string;
  ativa: boolean;
  data_inicio?: string; // YYYY-MM-DD
  data_fim?: string; // YYYY-MM-DD
}

export function isCampaignActiveInPeriod(c: CampaignOverride, fromDateIso: string, toDateIso: string): boolean {
  if (!c.ativa) return false;
  const fromDay = fromDateIso.substring(0, 10);
  const toDay = toDateIso.substring(0, 10);
  if (c.data_inicio && c.data_inicio > toDay) return false;
  if (c.data_fim && c.data_fim < fromDay) return false;
  return true;
}

export interface BarberCommissionDetail {
  id: string;
  nome: string;
  codigo_cadeira?: string;
  unidadeId: string;
  unidadeNome?: string;
  atendimentosCount: number;
  pctAtendimentos: number; // Ex: 0.25 (25% do volume total da filial)
  faturamentoServicos: number;
  comissaoServicos: number; // 35% dos serviços dele (ou taxa de campanha)
  faturamentoProdutosUnidade: number;
  comissaoProdutosProporcional: number; // Fatia do bolo de 30% de produtos da filial
  novasAssinaturasVindiCount: number;
  faturamentoAssinaturasVindi: number;
  comissaoAssinaturasVindi: number; // 35% sobre assinaturas Vindi
  comissaoTotal: number;
  taxaServicoAplicada: number;
  taxaProdutoPoolAplicada: number;
  // Métricas Estimadas (Liquidado + Em Aberto/Agendado no período)
  atendimentosEstimadosCount?: number;
  pctAtendimentosEstimado?: number;
  faturamentoServicosEstimado?: number;
  comissaoServicosEstimado?: number;
  comissaoProdutosProporcionalEstimado?: number;
  comissaoEstimadaTotal?: number;
}

export interface ManagerCommissionDetail {
  id?: string;
  nome?: string;
  unidadeId: string;
  unidadeNome?: string;
  faturamentoProdutosUnidade: number;
  comissaoPerc: number; // Padrão: 20%
  comissaoTotal: number;
  faturamentoProdutosEstimado?: number;
  comissaoEstimadaTotal?: number;
}

export interface UnitCommissionSummary {
  unidadeId: string;
  unidadeNome: string;
  totalRevenue: number;
  totalServicos: number;
  totalProdutos: number;
  totalAtendimentos: number;
  managerCommission: ManagerCommissionDetail;
  barbersCommissions: BarberCommissionDetail[];
}

const DEFAULT_CONFIG: CommissionConfig = {
  gestor_produto_perc: 20,
  barbeiro_servico_perc: 35,
  barbeiro_assinatura_perc: 35,
  barbeiro_produto_pool_perc: 30,
  campanhas: [],
};

const CONFIG_STORAGE_KEY = "HERMANOS_COMMISSION_CONFIG_V2";

export function getCommissionConfig(): CommissionConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error("Erro ao ler configurações locais de comissão:", e);
  }
  return DEFAULT_CONFIG;
}

export function saveCommissionConfig(config: CommissionConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Erro ao salvar configurações locais de comissão:", e);
  }
}

/**
 * Salvar e sincronizar remotamente no Supabase para refletir instantaneamente em todos os usuários/dispositivos
 */
export async function saveCommissionConfigAsync(config: CommissionConfig, empresaId?: string | null): Promise<void> {
  saveCommissionConfig(config);
  if (empresaId) {
    try {
      const { data: current } = await supabase.from("empresas").select("descricao").eq("id", empresaId).single();
      const metaTag = `[COMMISSION_CONFIG:${JSON.stringify(config)}]`;
      let cleanDesc = (current?.descricao || "").replace(/\[COMMISSION_CONFIG:.*?\]/s, "").trim();
      const newDesc = `${metaTag} ${cleanDesc}`.trim();
      await supabase.from("empresas").update({ descricao: newDesc }).eq("id", empresaId);
    } catch (e) {
      console.error("Erro ao sincronizar comissão no banco remoto:", e);
    }
  }
}

/**
 * Buscar configuração remota atualizada do Supabase
 */
export async function fetchCommissionConfigAsync(empresaId?: string | null): Promise<CommissionConfig> {
  const local = getCommissionConfig();
  if (empresaId) {
    try {
      const { data } = await supabase.from("empresas").select("descricao").eq("id", empresaId).single();
      if (data?.descricao && data.descricao.includes("[COMMISSION_CONFIG:")) {
        const match = data.descricao.match(/\[COMMISSION_CONFIG:(.*?)\]/s);
        if (match) {
          const parsed = JSON.parse(match[1]);
          const merged = { ...DEFAULT_CONFIG, ...local, ...parsed };
          saveCommissionConfig(merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar comissão remota:", e);
    }
  }
  return local;
}

/**
 * Apuração Completa das Comissões de Gestores e Barbeiros 2.0 (Liquidado + Estimado)
 */
export async function calcularComissoesUnidade(
  fromDateIso: string,
  toDateIso: string,
  selectedUnidadeId?: string | null,
  empresaId?: string | null
): Promise<{
  summaries: UnitCommissionSummary[];
  allBarbersCommissions: BarberCommissionDetail[];
  allManagersCommissions: ManagerCommissionDetail[];
  configUsada: CommissionConfig;
}> {
  const config = await fetchCommissionConfigAsync(empresaId);

  // 1. Buscar Unidades
  let unQuery = supabase.from("unidades").select("id, nome").order("nome");
  if (empresaId) unQuery = unQuery.eq("empresa_id", empresaId);
  if (selectedUnidadeId) unQuery = unQuery.eq("id", selectedUnidadeId);
  const { data: unidadesData } = await unQuery;
  const unidades = unidadesData || [];

  // 2. Buscar Barbeiros Ativos
  let barbQuery = supabase.from("barbeiros").select("id, nome, codigo_cadeira, unidade_id, status").eq("status", "active");
  if (empresaId) barbQuery = barbQuery.eq("empresa_id", empresaId);
  if (selectedUnidadeId) barbQuery = barbQuery.eq("unidade_id", selectedUnidadeId);
  const { data: barbeirosData } = await barbQuery;
  const barbeiros = barbeirosData || [];

  // 3. Buscar TODAS as Comandas no Período (fechadas e abertas)
  let comandasQuery = supabase
    .from("comandas")
    .select("id, total, barbeiro_id, unidade_id, status, created_at, fechada_em, agendamento_id, comanda_itens(tipo, subtotal, quantidade, nome)")
    .neq("status", "cancelada")
    .gte("created_at", fromDateIso)
    .lte("created_at", toDateIso);

  if (empresaId) comandasQuery = comandasQuery.eq("empresa_id", empresaId);
  if (selectedUnidadeId) comandasQuery = comandasQuery.eq("unidade_id", selectedUnidadeId);
  const { data: comandasData } = await comandasQuery;
  const comandas = comandasData || [];

  // 4. Buscar TODOS os Agendamentos no Período (concluídos, confirmados, agendados)
  let agendamentosQuery = supabase
    .from("agendamentos")
    .select("id, preco, barbeiro_id, unidade_id, status, data_hora, observacoes, clientes(observacoes)")
    .neq("status", "cancelado")
    .gte("data_hora", fromDateIso)
    .lte("data_hora", toDateIso);

  if (empresaId) agendamentosQuery = agendamentosQuery.eq("empresa_id", empresaId);
  if (selectedUnidadeId) agendamentosQuery = agendamentosQuery.eq("unidade_id", selectedUnidadeId);
  const { data: agendamentosData } = await agendamentosQuery;
  const agendamentos = agendamentosData || [];

  const summaries: UnitCommissionSummary[] = [];
  const allBarbersCommissions: BarberCommissionDetail[] = [];
  const allManagersCommissions: ManagerCommissionDetail[] = [];

  for (const un of unidades) {
    const unComandas = comandas.filter((c) => c.unidade_id === un.id);
    const unAgendamentos = agendamentos.filter((a) => a.unidade_id === un.id);

    const campUnidade = (config.campanhas || []).find(
      (c) => isCampaignActiveInPeriod(c, fromDateIso, toDateIso) && c.tipo === "unidade" && c.target_id === un.id
    );

    let totalProdutosUnidade = 0; // Liquidado
    let totalProdutosEstimadoUnidade = 0; // Estimado

    unComandas.forEach((c) => {
      const isFechada = c.status === "fechada";
      (c.comanda_itens || []).forEach((item: any) => {
        const isProd = (item.tipo || "").toLowerCase().includes("produto");
        if (isProd) {
          const sub = Number(item.subtotal || 0);
          totalProdutosEstimadoUnidade += sub;
          if (isFechada) {
            totalProdutosUnidade += sub;
          }
        }
      });
    });

    const campGestor = (config.campanhas || []).find(
      (c) => isCampaignActiveInPeriod(c, fromDateIso, toDateIso) && c.tipo === "gestor" && c.target_id === un.id
    );
    const gestorRate = campGestor?.gestor_produto_perc ?? campUnidade?.gestor_produto_perc ?? config.gestor_produto_perc;

    const managerCommission: ManagerCommissionDetail = {
      unidadeId: un.id,
      unidadeNome: un.nome,
      faturamentoProdutosUnidade: totalProdutosUnidade,
      comissaoPerc: gestorRate,
      comissaoTotal: (totalProdutosUnidade * gestorRate) / 100,
      faturamentoProdutosEstimado: totalProdutosEstimadoUnidade,
      comissaoEstimadaTotal: (totalProdutosEstimadoUnidade * gestorRate) / 100,
    };
    allManagersCommissions.push(managerCommission);

    const unBarbeiros = barbeiros.filter((b) => b.unidade_id === un.id);

    const barbeiroAtendMap = new Map<string, number>(); // Liquidado
    const barbeiroAtendEstimadoMap = new Map<string, number>(); // Estimado

    const barbeiroServicosMap = new Map<string, number>(); // Liquidado
    const barbeiroServicosEstimadoMap = new Map<string, number>(); // Estimado

    const barbeiroVindiCountMap = new Map<string, { count: number; valorTotal: number }>();

    let totalAtendimentosUnidade = 0;
    let totalAtendimentosEstimadosUnidade = 0;

    unComandas.forEach((c) => {
      if (c.barbeiro_id) {
        const isFechada = c.status === "fechada";

        const currentEstCount = barbeiroAtendEstimadoMap.get(c.barbeiro_id) || 0;
        barbeiroAtendEstimadoMap.set(c.barbeiro_id, currentEstCount + 1);
        totalAtendimentosEstimadosUnidade += 1;

        if (isFechada) {
          const currentCount = barbeiroAtendMap.get(c.barbeiro_id) || 0;
          barbeiroAtendMap.set(c.barbeiro_id, currentCount + 1);
          totalAtendimentosUnidade += 1;
        }

        let servTotalComanda = 0;
        (c.comanda_itens || []).forEach((item: any) => {
          const isProd = (item.tipo || "").toLowerCase().includes("produto");
          const isInfiniteServ = (item.nome || "").toUpperCase().includes("INFINITE");
          if (!isProd && !isInfiniteServ) {
            servTotalComanda += Number(item.subtotal || 0);
          }
        });

        const currentEstServ = barbeiroServicosEstimadoMap.get(c.barbeiro_id) || 0;
        barbeiroServicosEstimadoMap.set(c.barbeiro_id, currentEstServ + servTotalComanda);

        if (isFechada) {
          const currentServ = barbeiroServicosMap.get(c.barbeiro_id) || 0;
          barbeiroServicosMap.set(c.barbeiro_id, currentServ + servTotalComanda);
        }
      }
    });

    unAgendamentos.forEach((a) => {
      const semComanda = !unComandas.some((c) => c.agendamento_id === a.id || c.id === a.id);
      if (semComanda && a.barbeiro_id) {
        const isConcluido = a.status === "concluido";

        const currentEstCount = barbeiroAtendEstimadoMap.get(a.barbeiro_id) || 0;
        barbeiroAtendEstimadoMap.set(a.barbeiro_id, currentEstCount + 1);
        totalAtendimentosEstimadosUnidade += 1;

        if (isConcluido) {
          const currentCount = barbeiroAtendMap.get(a.barbeiro_id) || 0;
          barbeiroAtendMap.set(a.barbeiro_id, currentCount + 1);
          totalAtendimentosUnidade += 1;
        }

        const obs = a.observacoes || (a.clientes as any)?.observacoes || "";
        const isInfiniteAg = obs.includes("VINDI_INFINITE") ||
          obs.includes("ASSINATURA_VINDI") ||
          (a.servicos as any)?.nome?.toUpperCase().includes("INFINITE");

        const preco = isInfiniteAg ? 0 : Number(a.preco || 0);

        const currentEstServ = barbeiroServicosEstimadoMap.get(a.barbeiro_id) || 0;
        barbeiroServicosEstimadoMap.set(a.barbeiro_id, currentEstServ + preco);

        if (isConcluido) {
          const currentServ = barbeiroServicosMap.get(a.barbeiro_id) || 0;
          barbeiroServicosMap.set(a.barbeiro_id, currentServ + preco);
        }

        if (obs.includes("VINDI_INFINITE") || obs.includes("ASSINATURA_VINDI")) {
          const v = barbeiroVindiCountMap.get(a.barbeiro_id) || { count: 0, valorTotal: 0 };
          v.count += 1;
          v.valorTotal += preco;
          barbeiroVindiCountMap.set(a.barbeiro_id, v);
        }
      }
    });

    const poolRate = campUnidade?.barbeiro_produto_pool_perc ?? config.barbeiro_produto_pool_perc;
    const boloProdutosTotalUnidade = (totalProdutosUnidade * poolRate) / 100;
    const boloProdutosEstimadoTotalUnidade = (totalProdutosEstimadoUnidade * poolRate) / 100;

    const barbersCommissions: BarberCommissionDetail[] = unBarbeiros.map((b) => {
      // Liquidado
      const atendCount = barbeiroAtendMap.get(b.id) || 0;
      const pctAtend = totalAtendimentosUnidade > 0 ? atendCount / totalAtendimentosUnidade : 0;
      const comissaoProdutosProporcional = boloProdutosTotalUnidade * pctAtend;

      // Estimado
      const atendEstCount = barbeiroAtendEstimadoMap.get(b.id) || 0;
      const pctAtendEst = totalAtendimentosEstimadosUnidade > 0 ? atendEstCount / totalAtendimentosEstimadosUnidade : 0;
      const comissaoProdutosProporcionalEstimado = boloProdutosEstimadoTotalUnidade * pctAtendEst;

      const campBarbeiro = (config.campanhas || []).find(
        (c) => isCampaignActiveInPeriod(c, fromDateIso, toDateIso) && c.tipo === "barbeiro" && c.target_id === b.id
      );
      const servRate = campBarbeiro?.barbeiro_servico_perc ?? campUnidade?.barbeiro_servico_perc ?? config.barbeiro_servico_perc;

      // Liquidado
      const fatServicos = barbeiroServicosMap.get(b.id) || 0;
      const comissaoServicos = (fatServicos * servRate) / 100;

      // Estimado
      const fatServicosEstimado = barbeiroServicosEstimadoMap.get(b.id) || 0;
      const comissaoServicosEstimado = (fatServicosEstimado * servRate) / 100;

      const vindiInfo = barbeiroVindiCountMap.get(b.id) || { count: 0, valorTotal: 0 };
      const assinRate = config.barbeiro_assinatura_perc;
      const comissaoAssinaturasVindi = (vindiInfo.valorTotal * assinRate) / 100;

      const comissaoTotal = comissaoServicos + comissaoProdutosProporcional + comissaoAssinaturasVindi;
      const comissaoEstimadaTotal = comissaoServicosEstimado + comissaoProdutosProporcionalEstimado + comissaoAssinaturasVindi;

      return {
        id: b.id,
        nome: b.nome,
        codigo_cadeira: b.codigo_cadeira,
        unidadeId: un.id,
        unidadeNome: un.nome,
        atendimentosCount: atendCount,
        pctAtendimentos: pctAtend,
        faturamentoServicos: fatServicos,
        comissaoServicos,
        faturamentoProdutosUnidade: totalProdutosUnidade,
        comissaoProdutosProporcional,
        novasAssinaturasVindiCount: vindiInfo.count,
        faturamentoAssinaturasVindi: vindiInfo.valorTotal,
        comissaoAssinaturasVindi,
        comissaoTotal,
        taxaServicoAplicada: servRate,
        taxaProdutoPoolAplicada: poolRate,
        // Estimados
        atendimentosEstimadosCount: atendEstCount,
        pctAtendimentosEstimado: pctAtendEst,
        faturamentoServicosEstimado: fatServicosEstimado,
        comissaoServicosEstimado,
        comissaoProdutosProporcionalEstimado,
        comissaoEstimadaTotal,
      };
    });

    allBarbersCommissions.push(...barbersCommissions);

    const totalRevenueUnidade = unComandas.filter(c => c.status === "fechada").reduce((s, c) => s + Number(c.total || 0), 0) +
      unAgendamentos.filter(a => a.status === "concluido").reduce((s, a) => s + Number(a.preco || 0), 0);

    const totalServicosUnidade = Array.from(barbeiroServicosMap.values()).reduce((s, v) => s + v, 0);

    summaries.push({
      unidadeId: un.id,
      unidadeNome: un.nome,
      totalRevenue: totalRevenueUnidade,
      totalServicos: totalServicosUnidade,
      totalProdutos: totalProdutosUnidade,
      totalAtendimentos: totalAtendimentosUnidade,
      managerCommission,
      barbersCommissions: barbersCommissions.sort((a, b) => (b.comissaoEstimadaTotal || 0) - (a.comissaoEstimadaTotal || 0)),
    });
  }

  return {
    summaries,
    allBarbersCommissions: allBarbersCommissions.sort((a, b) => (b.comissaoEstimadaTotal || 0) - (a.comissaoEstimadaTotal || 0)),
    allManagersCommissions,
    configUsada: config,
  };
}
