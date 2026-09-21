import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Target, TrendingUp, Users, DollarSign, Search, ArrowUpRight,
  Calendar, MessageSquare, CheckCircle2, Key, RefreshCw, Loader2,
  Eye, Image as ImageIcon, Sparkles, Play, Film, ArrowUpDown, ArrowUp, ArrowDown,
  SlidersHorizontal, ShoppingCart, Compass, Volume2
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export type ObjetivoCampanha = "mensagens" | "vendas" | "visitas" | "trafego" | "engajamento";

export interface CampanhaItem {
  id: string;
  origem: string;
  campanha: string;
  adName: string;
  status: string;
  effectiveStatus: string;
  thumbnailUrl: string | null;
  previewIframeUrl: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
  // Métricas dinâmicas por objetivo
  tipoObjetivo: ObjetivoCampanha;
  resultadoLabel: string;
  resultadoUnidade: string;
  resultadoQtd: number;
  custoPorResultado: string;
  custoPorResultadoNum: number;
  // Métricas gerais
  conversasIniciadas: number;
  gasto: string;
  gastoNum: number;
  custoPorConversa: string;
  cliques: number;
  impressoes: number;
  ctr: string;
}

type ObjetivoFiltro = "todos" | "mensagens" | "vendas" | "visitas" | "trafego";

// Função inteligente para detectar o objetivo da campanha/anúncio com base nos dados oficiais da Meta
export function detectarObjetivo(campanhaNome: string, adName: string, metaObjective?: string | null): ObjetivoCampanha {
  const cUpper = (campanhaNome || "").toUpperCase();
  const aUpper = (adName || "").toUpperCase();
  const combined = `${cUpper} ${aUpper}`;
  const obj = (metaObjective || "").toUpperCase();

  // 1. Vendas / E-commerce / Site / Assinatura / Checkout
  if (
    obj.includes("SALES") ||
    combined.includes("[VENDAS/SITE") ||
    combined.includes("[VENDAS]") && (combined.includes("[SITE]") || combined.includes("ASSINATURA")) ||
    combined.includes("ASSINATURA") ||
    combined.includes("CHECKOUT") ||
    combined.includes("PURCHASE")
  ) {
    // Atenção: se for [VENDAS] [MSG] [WPP], o canal de conversão é mensagens zap!
    if (combined.includes("[MSG]") || combined.includes("[WPP]") || combined.includes("MENSAGEM") || combined.includes("WHATSAPP")) {
      return "mensagens";
    }
    return "vendas";
  }

  // 2. Visitas ao Perfil do Instagram
  if (
    combined.includes("PERFIL") ||
    combined.includes("INSTAGRAM") && combined.includes("TRÁFEGO") ||
    combined.includes("INSTAGRAM") && combined.includes("TRAFEGO") ||
    combined.includes("VISITAS")
  ) {
    return "visitas";
  }

  // 3. Tráfego / Cliques no Link / Landing Page
  if (
    obj.includes("TRAFFIC") ||
    combined.includes("TRÁFEGO") ||
    combined.includes("TRAFEGO") ||
    combined.includes("[SITE]") ||
    combined.includes("LANDING PAGE")
  ) {
    return "trafego";
  }

  // 4. Mensagens WhatsApp / Direct
  if (
    obj.includes("MESSAGES") ||
    combined.includes("[MSG]") ||
    combined.includes("[WPP]") ||
    combined.includes("MENSAGEM") ||
    combined.includes("WHATSAPP") ||
    combined.includes("CONVERSAS")
  ) {
    return "mensagens";
  }

  return "mensagens"; // Padrão da Hermanos
}

// Extrair contagem de resultados reais de acordo com o objetivo
function extrairResultadoPorObjetivo(actions: any[], tipo: ObjetivoCampanha, conversoesDb: number, cliques: number) {
  if (!actions || !Array.isArray(actions) || actions.length === 0) {
    if (tipo === "mensagens") return conversoesDb;
    if (tipo === "visitas" || tipo === "trafego") return cliques;
    return conversoesDb;
  }

  const findAction = (types: string[]) => {
    for (const t of types) {
      const found = actions.find(a => a.action_type === t);
      if (found) return Number(found.value) || 0;
    }
    return 0;
  };

  if (tipo === "vendas") {
    // Compras / Assinaturas / Checkouts iniciados
    const purchases = findAction(["purchase", "omni_purchase", "subscribe", "offsite_conversion.fb_pixel_purchase"]);
    if (purchases > 0) return purchases;
    const checkouts = findAction(["initiate_checkout", "omni_initiated_checkout", "onsite_web_initiate_checkout"]);
    if (checkouts > 0) return checkouts;
    return conversoesDb;
  }

  if (tipo === "visitas") {
    // Visitas ao Perfil / Cliques no link de perfil
    const linkClicks = findAction(["link_click"]);
    if (linkClicks > 0) return linkClicks;
    const profileClicks = findAction(["profile_visit", "onsite_conversion.post_save"]);
    if (profileClicks > 0) return profileClicks;
    return cliques;
  }

  if (tipo === "trafego") {
    // Cliques no link ou visualizações da página de destino
    const lpViews = findAction(["landing_page_view", "omni_landing_page_view"]);
    if (lpViews > 0) return lpViews;
    const linkClicks = findAction(["link_click"]);
    if (linkClicks > 0) return linkClicks;
    return cliques;
  }

  // Mensagens
  const zapConv = findAction([
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.messaging_first_reply",
    "onsite_conversion.total_messaging_connection"
  ]);
  if (zapConv > 0) return zapConv;
  return conversoesDb;
}

type PeriodoTipo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "custom";
type SortField = "gasto" | "conversas" | "custo" | "cliques" | "impressoes" | "ctr" | "nome";
type SortDirection = "desc" | "asc";

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatBrDate = (str: string) => {
  if (!str) return "";
  const parts = str.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

export default function OrigemTrafegoSection() {
  const { empresaId } = useEmpresa();
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoTipo>("7d");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "pausados">("ativos");
  const [filtroObjetivo, setFiltroObjetivo] = useState<ObjetivoFiltro>("todos");
  const [subAba, setSubAba] = useState<"campanhas" | "palavras_chave">("campanhas");
  
  const todayStr = formatLocalDate(new Date());
  const [dataInicio, setDataInicio] = useState(todayStr);
  const [dataFim, setDataFim] = useState(todayStr);
  const [rangeExibido, setRangeExibido] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Ordenação
  const [sortField, setSortField] = useState<SortField>("gasto");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Modal para ver criativo / vídeo ampliado
  const [criativoSelecionado, setCriativoSelecionado] = useState<CampanhaItem | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<"player" | "imagem">("player");

  // Estados de dados agregados reais
  const [totalConversas, setTotalConversas] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalVisitas, setTotalVisitas] = useState(0);
  const [totalGasto, setTotalGasto] = useState(0);
  const [totalCliques, setTotalCliques] = useState(0);
  const [totalImpressoes, setTotalImpressoes] = useState(0);
  const [campanhasList, setCampanhasList] = useState<CampanhaItem[]>([]);

  useEffect(() => {
    carregarMetricasReais();
  }, [empresaId, periodo, dataInicio, dataFim]);

  const carregarMetricasReais = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDateStr = todayStr;
      let endDateStr = todayStr;

      if (periodo === "hoje") {
        startDateStr = todayStr;
        endDateStr = todayStr;
      } else if (periodo === "ontem") {
        const ontem = new Date();
        ontem.setDate(now.getDate() - 1);
        startDateStr = formatLocalDate(ontem);
        endDateStr = startDateStr;
      } else if (periodo === "7d") {
        // PADRÃO EXATO META ADS: 7 dias fechados de ontem para trás (exclui hoje)
        const ontem = new Date();
        ontem.setDate(now.getDate() - 1);
        const start = new Date(ontem);
        start.setDate(ontem.getDate() - 6);
        startDateStr = formatLocalDate(start);
        endDateStr = formatLocalDate(ontem);
      } else if (periodo === "30d") {
        // PADRÃO EXATO META ADS: 30 dias fechados de ontem para trás (exclui hoje)
        const ontem = new Date();
        ontem.setDate(now.getDate() - 1);
        const start = new Date(ontem);
        start.setDate(ontem.getDate() - 29);
        startDateStr = formatLocalDate(start);
        endDateStr = formatLocalDate(ontem);
      } else if (periodo === "mes") {
        // Este Mês: Do 1º do mês até hoje
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = formatLocalDate(start);
        endDateStr = todayStr;
      } else if (periodo === "custom") {
        startDateStr = dataInicio || todayStr;
        endDateStr = dataFim || todayStr;
      }

      setRangeExibido(`${formatBrDate(startDateStr)} a ${formatBrDate(endDateStr)}`);

      let query = supabase
        .from("ads_metrics")
        .select("*")
        .gte("data_referencia", startDateStr)
        .lte("data_referencia", endDateStr)
        .order("data_referencia", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setCampanhasList([]);
        setTotalConversas(0);
        setTotalGasto(0);
        setTotalCliques(0);
        setTotalImpressoes(0);
        return;
      }

      let sumConversas = 0;
      let sumVendas = 0;
      let sumVisitas = 0;
      let sumGasto = 0;
      let sumCliques = 0;
      let sumImpressoes = 0;

      // Agrupar por campanha_id_externo (anúncio)
      const agrupado: Record<string, {
        id: string;
        origem: string;
        campanha: string;
        adName: string;
        status: string;
        effectiveStatus: string;
        thumbnailUrl: string | null;
        previewIframeUrl: string | null;
        creativeTitle: string | null;
        creativeBody: string | null;
        metaObjective?: string | null;
        actions: any[];
        conversas: number;
        gasto: number;
        cliques: number;
        impressoes: number;
      }> = {};

      for (const row of data) {
        const key = row.campanha_id_externo || row.campanha_nome || "Anuncio";
        const conv = Number(row.conversoes) || 0;
        const gast = Number(row.gasto) || 0;
        const cliq = Number(row.cliques) || 0;
        const impr = Number(row.impressoes) || 0;

        sumConversas += conv;
        sumGasto += gast;
        sumCliques += cliq;
        sumImpressoes += impr;

        const extras = (row.dados_extras as any) || {};

        if (!agrupado[key]) {
          agrupado[key] = {
            id: key,
            origem: row.plataforma === "meta" ? "Meta Ads (Instagram / FB)" : row.plataforma === "google" ? "Google Ads" : "Outros",
            campanha: extras.campaign_name || row.campanha_nome || "Campanha",
            adName: extras.ad_name || row.campanha_nome || "Anúncio",
            status: extras.status || "ACTIVE",
            effectiveStatus: extras.effective_status || "ACTIVE",
            thumbnailUrl: extras.thumbnail_url || null,
            previewIframeUrl: extras.preview_iframe_url || null,
            creativeTitle: extras.title || null,
            creativeBody: extras.body || null,
            metaObjective: extras.objective || null,
            actions: extras.actions || [],
            conversas: 0,
            gasto: 0,
            cliques: 0,
            impressoes: 0,
          };
        }

        agrupado[key].conversas += conv;
        agrupado[key].gasto += gast;
        agrupado[key].cliques += cliq;
        agrupado[key].impressoes += impr;
        if (extras.thumbnail_url && !agrupado[key].thumbnailUrl) {
          agrupado[key].thumbnailUrl = extras.thumbnail_url;
        }
        if (extras.preview_iframe_url && !agrupado[key].previewIframeUrl) {
          agrupado[key].previewIframeUrl = extras.preview_iframe_url;
        }
        if (extras.body && !agrupado[key].creativeBody) {
          agrupado[key].creativeBody = extras.body;
        }
        if (extras.actions && Array.isArray(extras.actions) && agrupado[key].actions.length === 0) {
          agrupado[key].actions = extras.actions;
        }
      }

      const formatado: CampanhaItem[] = Object.values(agrupado).map((item) => {
        const objTipo = detectarObjetivo(item.campanha, item.adName, item.metaObjective);
        const qtdResultado = extrairResultadoPorObjetivo(item.actions, objTipo, item.conversas, item.cliques);

        let resLabel = "Conversas (Zap)";
        let resUnidade = "conversas";
        if (objTipo === "vendas") {
          resLabel = "Vendas / Checkouts";
          resUnidade = "vendas";
          sumVendas += qtdResultado;
        } else if (objTipo === "visitas") {
          resLabel = "Visitas Perfil (Cliques)";
          resUnidade = "visitas";
          sumVisitas += qtdResultado;
        } else if (objTipo === "trafego") {
          resLabel = "Cliques no Link";
          resUnidade = "cliques";
        }

        const custoPorResultadoNum = qtdResultado > 0 ? (item.gasto / qtdResultado) : 0;
        const custoPorResultadoStr = qtdResultado > 0
          ? custoPorResultadoNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—";

        const custoConv = item.conversas > 0
          ? (item.gasto / item.conversas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—";
        const ctr = item.impressoes > 0 ? ((item.cliques / item.impressoes) * 100).toFixed(2) + "%" : "0.00%";

        return {
          id: item.id,
          origem: item.origem,
          campanha: item.campanha,
          adName: item.adName,
          status: item.status,
          effectiveStatus: item.effectiveStatus,
          thumbnailUrl: item.thumbnailUrl,
          previewIframeUrl: item.previewIframeUrl,
          creativeTitle: item.creativeTitle,
          creativeBody: item.creativeBody,
          tipoObjetivo: objTipo,
          resultadoLabel: resLabel,
          resultadoUnidade: resUnidade,
          resultadoQtd: qtdResultado,
          custoPorResultado: custoPorResultadoStr,
          custoPorResultadoNum,
          conversasIniciadas: item.conversas,
          gasto: item.gasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          gastoNum: item.gasto,
          custoPorConversa: custoConv,
          cliques: item.cliques,
          impressoes: item.impressoes,
          ctr,
        };
      });

      setTotalConversas(sumConversas);
      setTotalVendas(sumVendas);
      setTotalVisitas(sumVisitas);
      setTotalGasto(sumGasto);
      setTotalCliques(sumCliques);
      setTotalImpressoes(sumImpressoes);
      setCampanhasList(formatado);
    } catch (err: any) {
      console.error("Erro ao carregar métricas de origem de tráfego:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMetaAds = async () => {
    setSyncing(true);
    try {
      const res = await fetch("https://khoeovszuixfwfkaaxaa.supabase.co/functions/v1/sync-meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao sincronizar anúncios");
      }
      toast.success(data.message || "Anúncios sincronizados com sucesso!");
      await carregarMetricasReais();
    } catch (err: any) {
      toast.error(err.message || "Falha ao sincronizar anúncios");
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Filtro por texto, status e objetivo
  const campanhasFiltradas = campanhasList.filter(c => {
    const matchBusca =
      c.campanha.toLowerCase().includes(search.toLowerCase()) ||
      c.origem.toLowerCase().includes(search.toLowerCase()) ||
      c.adName.toLowerCase().includes(search.toLowerCase()) ||
      (c.creativeBody && c.creativeBody.toLowerCase().includes(search.toLowerCase()));

    if (!matchBusca) return false;

    if (filtroStatus === "ativos") {
      const isAtivo = c.effectiveStatus === "ACTIVE" || c.status === "ACTIVE";
      if (!isAtivo) return false;
    } else if (filtroStatus === "pausados") {
      const isAtivo = c.effectiveStatus === "ACTIVE" || c.status === "ACTIVE";
      if (isAtivo) return false;
    }

    if (filtroObjetivo !== "todos") {
      if (c.tipoObjetivo !== filtroObjetivo) return false;
    }

    return true;
  });

  // Ordenação matemática
  const campanhasOrdenadas = [...campanhasFiltradas].sort((a, b) => {
    let valA = 0;
    let valB = 0;

    if (sortField === "gasto") {
      valA = a.gastoNum;
      valB = b.gastoNum;
    } else if (sortField === "conversas") {
      valA = a.resultadoQtd;
      valB = b.resultadoQtd;
    } else if (sortField === "custo") {
      valA = a.custoPorResultadoNum > 0 ? a.custoPorResultadoNum : 999999;
      valB = b.custoPorResultadoNum > 0 ? b.custoPorResultadoNum : 999999;
    } else if (sortField === "cliques") {
      valA = a.cliques;
      valB = b.cliques;
    } else if (sortField === "impressoes") {
      valA = a.impressoes;
      valB = b.impressoes;
    } else if (sortField === "ctr") {
      valA = a.impressoes > 0 ? (a.cliques / a.impressoes) : 0;
      valB = b.impressoes > 0 ? (b.cliques / b.impressoes) : 0;
    } else if (sortField === "nome") {
      return sortDirection === "desc" ? b.adName.localeCompare(a.adName) : a.adName.localeCompare(b.adName);
    }

    return sortDirection === "desc" ? valB - valA : valA - valB;
  });

  // Cards dinâmicos adaptados ao objetivo selecionado
  const getMetricasCards = () => {
    if (filtroObjetivo === "vendas") {
      const gastoVendas = campanhasFiltradas.reduce((acc, c) => acc + c.gastoNum, 0);
      const vendasTotal = campanhasFiltradas.reduce((acc, c) => acc + c.resultadoQtd, 0);
      return [
        {
          title: "Vendas / Checkouts",
          value: `${vendasTotal} Vendas`,
          desc: "Conversões de compra & checkout",
          icon: ShoppingCart,
          color: "text-emerald-400",
        },
        {
          title: "Valor Investido",
          value: gastoVendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          desc: "Investimento em campanhas de venda",
          icon: DollarSign,
          color: "text-emerald-400",
        },
        {
          title: "CPA Médio (Custo por Venda)",
          value: vendasTotal > 0 ? (gastoVendas / vendasTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00",
          desc: "Custo por compra/aquisição",
          icon: TrendingUp,
          color: "text-amber-400",
        },
        {
          title: "Cliques no Site",
          value: `${campanhasFiltradas.reduce((acc, c) => acc + c.cliques, 0).toLocaleString("pt-BR")} cliques`,
          desc: "Tráfego direcionado para checkout",
          icon: Users,
          color: "text-purple-400",
        },
      ];
    }

    if (filtroObjetivo === "visitas") {
      const gastoVisitas = campanhasFiltradas.reduce((acc, c) => acc + c.gastoNum, 0);
      const visitasTotal = campanhasFiltradas.reduce((acc, c) => acc + c.resultadoQtd, 0);
      return [
        {
          title: "Visitas ao Perfil (Instagram)",
          value: `${visitasTotal.toLocaleString("pt-BR")} Visitas`,
          desc: "Cliques no link e visitas ao perfil",
          icon: Compass,
          color: "text-purple-400",
        },
        {
          title: "Valor Investido",
          value: gastoVisitas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          desc: "Investimento em tráfego do perfil",
          icon: DollarSign,
          color: "text-emerald-400",
        },
        {
          title: "Custo por Visita (CPV)",
          value: visitasTotal > 0 ? (gastoVisitas / visitasTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00",
          desc: "Média por clique/visita ao Instagram",
          icon: TrendingUp,
          color: "text-amber-400",
        },
        {
          title: "Impressões no Feed/Stories",
          value: `${campanhasFiltradas.reduce((acc, c) => acc + c.impressoes, 0).toLocaleString("pt-BR")} imp`,
          desc: "Alcance e visualizações do perfil",
          icon: Users,
          color: "text-blue-400",
        },
      ];
    }

    if (filtroObjetivo === "trafego") {
      const gastoTrafego = campanhasFiltradas.reduce((acc, c) => acc + c.gastoNum, 0);
      const cliquesTotal = campanhasFiltradas.reduce((acc, c) => acc + c.cliques, 0);
      return [
        {
          title: "Cliques no Link / Site",
          value: `${cliquesTotal.toLocaleString("pt-BR")} Cliques`,
          desc: "Direcionamento para páginas do site",
          icon: Users,
          color: "text-blue-400",
        },
        {
          title: "Valor Investido",
          value: gastoTrafego.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          desc: "Investimento em campanhas de tráfego",
          icon: DollarSign,
          color: "text-emerald-400",
        },
        {
          title: "CPC Médio (Custo por Clique)",
          value: cliquesTotal > 0 ? (gastoTrafego / cliquesTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00",
          desc: "Custo por visitante no site",
          icon: TrendingUp,
          color: "text-amber-400",
        },
        {
          title: "CTR Médio",
          value: totalImpressoes > 0 ? `${((cliquesTotal / totalImpressoes) * 100).toFixed(2)}%` : "0.00%",
          desc: "Taxa de cliques nas campanhas de tráfego",
          icon: TrendingUp,
          color: "text-emerald-400",
        },
      ];
    }

    // Visão Geral / Mensagens (Padrão)
    const custoMedioConversa = totalConversas > 0 ? (totalGasto / totalConversas).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
    return [
      {
        title: "Conversas por Mensagem (Zap)",
        value: `${totalConversas} Conversas`,
        desc: totalVendas > 0 ? `+ ${totalVendas} vendas em anúncios de site` : "Resultado oficial da Meta no período",
        icon: MessageSquare,
        color: "text-blue-400",
      },
      {
        title: "Valor Usado (Gasto Real)",
        value: totalGasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        desc: `${totalImpressoes.toLocaleString("pt-BR")} impressões no período`,
        icon: DollarSign,
        color: "text-emerald-400",
      },
      {
        title: "Custo por Conversa (Zap)",
        value: custoMedioConversa,
        desc: "Média por mensagem de WhatsApp iniciada",
        icon: TrendingUp,
        color: "text-amber-400",
      },
      {
        title: "Cliques no Link / Perfil",
        value: `${totalCliques.toLocaleString("pt-BR")} cliques`,
        desc: totalImpressoes > 0 ? `CTR médio: ${((totalCliques / totalImpressoes) * 100).toFixed(2)}%` : "Taxa de cliques",
        icon: Users,
        color: "text-purple-400",
      },
    ];
  };

  const metricasCards = getMetricasCards();

  return (
    <div className="space-y-6">
      {/* BARRA DE FILTRO POR DATA E PERÍODO COM BOTÃO DE SINCRONIZAR */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Período:</span>
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs flex-wrap">
            <button
              onClick={() => setPeriodo("hoje")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "hoje" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodo("ontem")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "ontem" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Ontem
            </button>
            <button
              onClick={() => setPeriodo("7d")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "7d" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setPeriodo("30d")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "30d" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Últimos 30 dias
            </button>
            <button
              onClick={() => setPeriodo("mes")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "mes" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Este Mês
            </button>
            <button
              onClick={() => {
                setPeriodo("custom");
                if (!dataInicio) setDataInicio(todayStr);
                if (!dataFim) setDataFim(todayStr);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${periodo === "custom" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
            >
              Personalizado
            </button>
          </div>

          {/* BADGE COM O RANGE EXATO DE DATAS (TRANSPARÊNCIA TOTAL) */}
          {rangeExibido && (
            <Badge variant="outline" className="border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 font-mono">
              {rangeExibido}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {periodo === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">De:</span>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 w-36 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"
              />
              <span className="text-zinc-400">Até:</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 w-36 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"
              />
            </div>
          )}

          <Button
            size="sm"
            onClick={handleSyncMetaAds}
            disabled={syncing}
            className="gap-2 text-xs bg-[#1877F2] hover:bg-[#166fe5] text-zinc-900 dark:text-white font-bold shadow-md h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar Meta Ads"}
          </Button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS LUXURY DINÂMICAS POR OBJETIVO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricasCards.map((m, idx) => {
          const Icon = m.icon;
          return (
            <Card key={idx} className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold text-zinc-700 dark:text-zinc-400 uppercase tracking-wider">{m.title}</CardTitle>
                <Icon className={`h-4 w-4 ${m.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{m.value}</div>
                <p className="text-xs text-zinc-700 dark:text-zinc-400 mt-1">{m.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* SUB-NAVEGAÇÃO: CAMPANHAS VS PALAVRAS-CHAVE */}
      <Card className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 shadow-sm">
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800/60 pb-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => setSubAba("campanhas")}
                variant={subAba === "campanhas" ? "default" : "outline"}
                className={`h-9 text-xs font-semibold gap-2 ${subAba === "campanhas" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                <Target className="h-4 w-4 text-emerald-400" /> Atribuição por Anúncio & Criativo
              </Button>
              <Button
                onClick={() => setSubAba("palavras_chave")}
                variant={subAba === "palavras_chave" ? "default" : "outline"}
                className={`h-9 text-xs font-semibold gap-2 ${subAba === "palavras_chave" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700" : "border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
              >
                <Key className="h-4 w-4 text-blue-400" /> Palavras-Chave (Google)
              </Button>

              {/* SELETOR DE STATUS: ATIVOS vs TODOS */}
              {subAba === "campanhas" && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs ml-0 sm:ml-2">
                  <button
                    type="button"
                    onClick={() => setFiltroStatus("ativos")}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                      filtroStatus === "ativos" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                    Ativas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus("todos")}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                      filtroStatus === "todos" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus("pausados")}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all ${
                      filtroStatus === "pausados" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    Pausadas
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* SELETOR RÁPIDO DE ORDENAÇÃO */}
              {subAba === "campanhas" && (
                <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 ml-1" />
                  <span className="text-[11px] text-zinc-400 font-semibold">Ordenar:</span>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 font-bold outline-none cursor-pointer pr-1 py-0.5"
                  >
                    <option value="gasto" className="bg-zinc-950 text-zinc-200">Gasto (Valor Usado)</option>
                    <option value="conversas" className="bg-zinc-950 text-zinc-200">Resultados (Por Objetivo)</option>
                    <option value="custo" className="bg-zinc-950 text-zinc-200">Custo por Resultado</option>
                    <option value="cliques" className="bg-zinc-950 text-zinc-200">Cliques no Link</option>
                    <option value="impressoes" className="bg-zinc-950 text-zinc-200">Impressões</option>
                    <option value="ctr" className="bg-zinc-950 text-zinc-200">Taxa de Cliques (CTR)</option>
                    <option value="nome" className="bg-zinc-950 text-zinc-200">Nome do Anúncio</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
                    className="px-2 py-1 rounded bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 font-bold text-[11px] flex items-center gap-1 border border-zinc-700 transition-colors shadow-sm"
                    title={sortDirection === "desc" ? "Ordem Decrescente (Maior primeiro)" : "Ordem Crescente (Menor primeiro)"}
                  >
                    {sortDirection === "desc" ? (
                      <>
                        <ArrowDown className="h-3 w-3 text-emerald-400" />
                        <span>Maior primeiro</span>
                      </>
                    ) : (
                      <>
                        <ArrowUp className="h-3 w-3 text-emerald-400" />
                        <span>Menor primeiro</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="relative w-52">
                <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-2.5" />
                <Input
                  placeholder="Buscar anúncio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* FILTRO DINÂMICO POR OBJETIVO DO ANÚNCIO */}
          {subAba === "campanhas" && (
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/40 flex-wrap">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Objetivo:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFiltroObjetivo("todos")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    filtroObjetivo === "todos"
                      ? "bg-zinc-800 text-white shadow-sm border border-zinc-600"
                      : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-zinc-800"
                  }`}
                >
                  Todos os Anúncios ({campanhasList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroObjetivo("mensagens")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filtroObjetivo === "mensagens"
                      ? "bg-blue-950 text-blue-300 border border-blue-700 shadow-sm"
                      : "bg-zinc-900/50 text-zinc-400 hover:text-blue-300 hover:bg-zinc-800/40 border border-zinc-800"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 text-blue-400" />
                  Mensagens WhatsApp ({campanhasList.filter(c => c.tipoObjetivo === "mensagens").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroObjetivo("vendas")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filtroObjetivo === "vendas"
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-sm"
                      : "bg-zinc-900/50 text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800/40 border border-zinc-800"
                  }`}
                >
                  <ShoppingCart className="h-3 w-3 text-emerald-400" />
                  Vendas & Assinaturas ({campanhasList.filter(c => c.tipoObjetivo === "vendas").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroObjetivo("visitas")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filtroObjetivo === "visitas"
                      ? "bg-purple-950 text-purple-300 border border-purple-700 shadow-sm"
                      : "bg-zinc-900/50 text-zinc-400 hover:text-purple-300 hover:bg-zinc-800/40 border border-zinc-800"
                  }`}
                >
                  <Compass className="h-3 w-3 text-purple-400" />
                  Visitas ao Perfil ({campanhasList.filter(c => c.tipoObjetivo === "visitas").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroObjetivo("trafego")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    filtroObjetivo === "trafego"
                      ? "bg-amber-950 text-amber-300 border border-amber-700 shadow-sm"
                      : "bg-zinc-900/50 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800/40 border border-zinc-800"
                  }`}
                >
                  <TrendingUp className="h-3 w-3 text-amber-400" />
                  Tráfego & Site ({campanhasList.filter(c => c.tipoObjetivo === "trafego").length})
                </button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
              <span className="text-xs text-zinc-400">Carregando métricas oficiais de anúncios...</span>
            </div>
          ) : subAba === "campanhas" ? (
            <div className="overflow-x-auto">
              {campanhasOrdenadas.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-xs text-zinc-400">
                    {filtroStatus === "ativos"
                      ? "Nenhum anúncio ativo com gastos/cliques encontrado no período selecionado."
                      : "Nenhuma campanha encontrada para o período selecionado."}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleSyncMetaAds}
                    disabled={syncing}
                    className="gap-2 text-xs bg-[#1877F2] text-zinc-900 dark:text-white"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                    Sincronizar Meta Ads Agora
                  </Button>
                </div>
              ) : (
                <>
                  <div className="text-[11px] text-zinc-500 pb-2 flex items-center justify-between">
                    <span>
                      Exibindo <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{campanhasOrdenadas.length}</strong> anúncio(s)
                      {filtroStatus === "ativos" && " ativos"}
                      {filtroStatus === "pausados" && " pausados"}
                      {filtroStatus === "todos" && " totais"}
                      {filtroObjetivo !== "todos" && ` [${filtroObjetivo.toUpperCase()}]`}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      Clique no cabeçalho de qualquer coluna para inverter a ordenação
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                        <th className="pb-3 font-semibold">Criativo / Status</th>

                        {/* NOME DO ANÚNCIO (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("nome")}
                          className="pb-3 font-semibold cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center gap-1">
                            Campanha & Anúncio
                            {sortField === "nome" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* RESULTADOS DINÂMICOS (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("conversas")}
                          className="pb-3 font-semibold text-center cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {filtroObjetivo === "vendas"
                              ? "Resultados (Vendas / Conversões)"
                              : filtroObjetivo === "visitas"
                              ? "Resultados (Visitas Perfil)"
                              : filtroObjetivo === "trafego"
                              ? "Resultados (Cliques no Link)"
                              : "Resultados (Por Objetivo)"}
                            {sortField === "conversas" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* CUSTO POR RESULTADO (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("custo")}
                          className="pb-3 font-semibold text-center cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {filtroObjetivo === "vendas"
                              ? "CPA (Custo por Venda)"
                              : filtroObjetivo === "visitas"
                              ? "Custo por Visita"
                              : filtroObjetivo === "trafego"
                              ? "CPC (Custo / Clique)"
                              : "Custo por Resultado"}
                            {sortField === "custo" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* VALOR USADO / GASTO (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("gasto")}
                          className="pb-3 font-semibold text-center cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            Valor Usado (Gasto)
                            {sortField === "gasto" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* CLIQUES (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("cliques")}
                          className="pb-3 font-semibold text-center cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            Cliques / Impressões
                            {sortField === "cliques" || sortField === "impressoes" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        {/* CTR (ORDENÁVEL) */}
                        <th
                          onClick={() => handleSort("ctr")}
                          className="pb-3 font-semibold text-center cursor-pointer select-none hover:text-zinc-900 dark:text-white transition-colors group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            CTR
                            {sortField === "ctr" ? (
                              sortDirection === "desc" ? <ArrowDown className="h-3 w-3 text-emerald-400" /> : <ArrowUp className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </div>
                        </th>

                        <th className="pb-3 font-semibold text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                      {campanhasOrdenadas.map((c) => {
                        const isAtivo = c.effectiveStatus === "ACTIVE" || c.status === "ACTIVE";

                        // Badge de Objetivo e Cores
                        let badgeObjetivo = {
                          text: "MENSAGENS",
                          className: "bg-blue-950/70 text-blue-400 border-blue-800/40",
                          icon: MessageSquare,
                          resultColor: "text-blue-400"
                        };

                        if (c.tipoObjetivo === "vendas") {
                          badgeObjetivo = {
                            text: "VENDAS / SITE",
                            className: "bg-emerald-950/70 text-emerald-400 border-emerald-800/40",
                            icon: ShoppingCart,
                            resultColor: "text-emerald-400"
                          };
                        } else if (c.tipoObjetivo === "visitas") {
                          badgeObjetivo = {
                            text: "PERFIL INSTAGRAM",
                            className: "bg-purple-950/70 text-purple-400 border-purple-800/40",
                            icon: Compass,
                            resultColor: "text-purple-400"
                          };
                        } else if (c.tipoObjetivo === "trafego") {
                          badgeObjetivo = {
                            text: "TRÁFEGO / LINK",
                            className: "bg-amber-950/70 text-amber-400 border-amber-800/40",
                            icon: TrendingUp,
                            resultColor: "text-amber-400"
                          };
                        }

                        const BadgeIcon = badgeObjetivo.icon;

                        return (
                          <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                            <td className="py-3.5 font-medium">
                              <div className="flex items-center gap-2.5">
                                {/* Thumbnail do Criativo */}
                                {c.thumbnailUrl ? (
                                  <div
                                    onClick={() => {
                                      setCriativoSelecionado(c);
                                      setModoVisualizacao(c.previewIframeUrl ? "player" : "imagem");
                                    }}
                                    className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-700 bg-black cursor-pointer hover:border-emerald-500 transition-all flex-shrink-0 relative group shadow-sm"
                                    title="Clique para ver o vídeo / ouvir áudio do criativo"
                                  >
                                    <img
                                      src={c.thumbnailUrl}
                                      alt={c.adName}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-all"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                      <Play className="h-4 w-4 text-white fill-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-500 flex-shrink-0">
                                    <ImageIcon className="h-5 w-5" />
                                  </div>
                                )}

                                {/* Badges de Status e Objetivo */}
                                <div className="space-y-1">
                                  {isAtivo ? (
                                    <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px] font-bold gap-1 px-1.5 py-0.5">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                      ATIVO
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-zinc-400 border-zinc-200 dark:border-zinc-800 text-[10px] px-1.5 py-0.5">
                                      PAUSADO
                                    </Badge>
                                  )}
                                  <Badge className={`${badgeObjetivo.className} border text-[9px] font-bold gap-1 px-1.5 py-0.5 block w-fit`}>
                                    <BadgeIcon className="h-2.5 w-2.5 inline mr-0.5" />
                                    {badgeObjetivo.text}
                                  </Badge>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 max-w-sm truncate text-xs">{c.adName}</div>
                              <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-sm">{c.campanha}</div>
                              {c.creativeBody && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 italic max-w-sm truncate mt-0.5">
                                  "{c.creativeBody}"
                                </p>
                              )}
                            </td>

                            {/* RESULTADO DINÂMICO ESPECÍFICO DESTE ANÚNCIO */}
                            <td className={`py-3.5 text-center font-bold ${badgeObjetivo.resultColor} font-mono text-sm`}>
                              {c.resultadoQtd.toLocaleString("pt-BR")}
                              <span className="text-xs text-zinc-600 dark:text-zinc-400 block font-normal">
                                {c.resultadoUnidade}
                              </span>
                            </td>

                            {/* CUSTO POR RESULTADO DINÂMICO */}
                            <td className="py-3.5 text-center font-bold text-amber-400 font-mono text-xs">
                              {c.custoPorResultado}
                              <span className="text-xs text-zinc-600 dark:text-zinc-400 block font-normal">
                                {c.tipoObjetivo === "vendas" ? "por venda (CPA)" : c.tipoObjetivo === "visitas" ? "por visita" : "por conversa"}
                              </span>
                            </td>

                            <td className="py-3.5 text-center font-bold text-emerald-400 font-mono text-xs">
                              {c.gasto}
                            </td>

                            <td className="py-3.5 text-center font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                              <div><strong className="text-zinc-900 dark:text-white">{c.cliques.toLocaleString("pt-BR")}</strong> cliq</div>
                              <div className="text-xs text-zinc-600 dark:text-zinc-400">{c.impressoes.toLocaleString("pt-BR")} imp</div>
                            </td>

                            <td className="py-3.5 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100 font-bold text-xs">
                              {c.ctr}
                            </td>

                            <td className="py-3.5 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCriativoSelecionado(c);
                                  setModoVisualizacao(c.previewIframeUrl ? "player" : "imagem");
                                }}
                                className="h-8 text-xs gap-1.5 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 text-zinc-200"
                              >
                                <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/40" />
                                Ver Vídeo & Áudio
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">Palavra-Chave</th>
                    <th className="pb-3 font-semibold">Origem</th>
                    <th className="pb-3 font-semibold text-center">Conversas</th>
                    <th className="pb-3 font-semibold text-center">Cliques</th>
                    <th className="pb-3 font-semibold text-right">Gasto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {keywordsFiltradas.map((k, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3.5 font-bold text-zinc-100 flex items-center gap-2">
                        <Search className="h-3 w-3 text-blue-400" /> "{k.kw}"
                      </td>
                      <td className="py-3.5">
                        <Badge variant="outline" className="border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px]">
                          {k.origem}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-center font-semibold text-blue-400 font-mono">
                        {k.conversasIniciadas} msg
                      </td>
                      <td className="py-3.5 text-center font-semibold text-emerald-400 font-mono">
                        {k.cliques} cliq
                      </td>
                      <td className="py-3.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                        {k.gasto}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE PLAYER DE VÍDEO & CRIATIVO HD (OFICIAL DA META COM SUPORTE TOTAL A ÁUDIO) */}
      <Dialog open={!!criativoSelecionado} onOpenChange={(open) => !open && setCriativoSelecionado(null)}>
        <DialogContent className="max-w-lg bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-100 p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Film className="h-4 w-4 text-emerald-400" />
                Preview Interativo com Áudio (Meta Ads)
              </DialogTitle>
            </div>
          </DialogHeader>

          {criativoSelecionado && (
            <div className="space-y-4 pt-2">
              {/* DICA DE ÁUDIO ATIVO */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
                <Volume2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Áudio liberado:</strong> Clique no ícone de som ou no vídeo dentro do player para ouvir o áudio do criativo.
                </span>
              </div>

              {/* SELETOR DE MODO: PLAYER DE VÍDEO vs IMAGEM HD */}
              {criativoSelecionado.previewIframeUrl && (
                <div className="flex rounded-lg bg-zinc-900 p-1 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("player")}
                    className={`flex-1 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
                      modoVisualizacao === "player" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Play className="h-3 w-3 fill-emerald-400 text-emerald-400" /> Player Interativo com Som (Meta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("imagem")}
                    className={`flex-1 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
                      modoVisualizacao === "imagem" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <ImageIcon className="h-3 w-3" /> Imagem em Alta Resolução
                  </button>
                </div>
              )}

              {/* CONTAINER DO PLAYER OFICIAL DA META COM PERMISSÕES COMPLETAS DE ÁUDIO */}
              {modoVisualizacao === "player" && criativoSelecionado.previewIframeUrl ? (
                <div className="w-full flex justify-center bg-black/80 rounded-2xl p-2 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
                  <iframe
                    src={criativoSelecionado.previewIframeUrl}
                    className="w-[340px] h-[550px] border-0 rounded-xl shadow-inner"
                    allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *; microphone *; clipboard-write *"
                    scrolling="yes"
                  />
                </div>
              ) : (
                /* CONTAINER DE IMAGEM HD */
                criativoSelecionado.thumbnailUrl && (
                  <div className="w-full max-h-80 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black flex items-center justify-center p-1">
                    <img
                      src={criativoSelecionado.thumbnailUrl}
                      alt={criativoSelecionado.adName}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                )
              )}

              {/* INFORMAÇÕES DO ANÚNCIO */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Nome do Anúncio</span>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{criativoSelecionado.adName}</p>
                  </div>
                  <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 text-[10px]">
                    ● ATIVO NO META ADS
                  </Badge>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Campanha</span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">{criativoSelecionado.campanha}</p>
                </div>

                {criativoSelecionado.creativeBody && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Texto / Copy do Anúncio</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-900/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 whitespace-pre-line leading-relaxed">
                      {criativoSelecionado.creativeBody}
                    </p>
                  </div>
                )}

                {/* MÉTRICAS OFICIAIS DESTE ANÚNCIO */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 block">Valor Usado</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">{criativoSelecionado.gasto}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 block">{criativoSelecionado.resultadoLabel}</span>
                    <span className="text-xs font-bold text-blue-400 font-mono">
                      {criativoSelecionado.resultadoQtd} {criativoSelecionado.resultadoUnidade}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 block">Custo / Resultado</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">{criativoSelecionado.custoPorResultado}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
