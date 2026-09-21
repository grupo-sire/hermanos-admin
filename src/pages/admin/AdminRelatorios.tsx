import { useState, useEffect } from "react";
import { getAllCaixaSessoes, getIncidentesCaixas } from "@/services/caixaService";
import { CaixaSessao } from "@/types/caixa";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, Clock,
  BarChart3, DollarSign, Users, Package, ShoppingBag, Truck, ShieldCheck, Scissors, TrendingUp, AlertTriangle, FileText, Download, Building2, CheckCircle2, ArrowUp, ArrowDown, Loader2, Calendar, Filter, PieChart, Printer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { calcularComissoesUnidade } from "@/lib/commissionEngine";

interface Unidade { id: string; nome: string; }

interface BarbeiroResumo {
  id: string;
  nome: string;
  codigo_cadeira?: string;
  unidadeNome: string;
  totalAtendimentos: number;
  faturamentoServicos: number;
  faturamentoProdutos: number;
  comissaoEstimada: number;
}

interface ProdutoResumo {
  id: string;
  nome: string;
  categoria: string;
  estoqueMatriz: number;
  destinacao: string;
  rendimento: number;
  totalSaidasUsoInterno: number;
}

interface SuprimentoResumo {
  id: string;
  unidadeNome: string;
  created_at: string;
  status: string;
  totalItens: number;
  comprovanteAnexado: boolean;
}

export default function AdminRelatorios() {
  const { empresaId: contextEmpresaId } = useEmpresa();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>("todas");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dre");

  // FILTROS DE DATA INTELIGENTES 2.0
  const [periodoPreset, setPeriodoPreset] = useState<string>("mes_atual");
  const [dataInicio, setDataInicio] = useState<string>(() => {
    return format(startOfMonth(new Date()), "yyyy-MM-dd");
  });
  const [dataFim, setDataFim] = useState<string>(() => {
    return format(new Date(), "yyyy-MM-dd");
  });

  // MÉTRICAS DRE CONSOLIDADAS 2.0
  const [recServicos, setRecServicos] = useState(0);
  const [recProdutos, setRecProdutos] = useState(0);
  const [recAssinaturas, setRecAssinaturas] = useState(0);
  const [faturamentoTotal, setFaturamentoTotal] = useState(0);
  const [totalComissoes, setTotalComissoes] = useState(0);
  const [custoInsumos, setCustoInsumos] = useState(0);
  const [lucroLiquido, setLucroLiquido] = useState(0);
  const [totalAtendimentos, setTotalAtendimentos] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);

  const [barbeirosLista, setBarbeirosLista] = useState<BarbeiroResumo[]>([]);
  const [produtosLista, setProdutosLista] = useState<ProdutoResumo[]>([]);
  const [pedidosLista, setPedidosLista] = useState<SuprimentoResumo[]>([]);
  const [usoInternoTotal, setUsoInternoTotal] = useState(0);
  const [sessoesCaixaLista, setSessoesCaixaLista] = useState<CaixaSessao[]>([]);

  useEffect(() => {
    fetchRelatorios();
  }, [contextEmpresaId, selectedUnidade, dataInicio, dataFim]);

  const handlePeriodoChange = (preset: string) => {
    setPeriodoPreset(preset);
    const hoje = new Date();

    if (preset === "hoje") {
      const dt = format(hoje, "yyyy-MM-dd");
      setDataInicio(dt);
      setDataFim(dt);
    } else if (preset === "ontem") {
      const dt = format(subDays(hoje, 1), "yyyy-MM-dd");
      setDataInicio(dt);
      setDataFim(dt);
    } else if (preset === "7dias") {
      setDataInicio(format(subDays(hoje, 7), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    } else if (preset === "mes_atual") {
      setDataInicio(format(startOfMonth(hoje), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    } else if (preset === "mes_anterior") {
      const mesAnt = subMonths(hoje, 1);
      setDataInicio(format(startOfMonth(mesAnt), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(mesAnt), "yyyy-MM-dd"));
    } else if (preset === "ano_atual") {
      setDataInicio(format(startOfYear(hoje), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    }
  };

  const fetchRelatorios = async () => {
    setLoading(true);
    try {
      let targetEmpresaId = contextEmpresaId;
      if (!targetEmpresaId) {
        const { data: empData } = await supabase.from("empresas").select("id").limit(1).single();
        if (empData) targetEmpresaId = empData.id;
      }

      // 1. Unidades
      let unQuery = supabase.from("unidades").select("id, nome").order("nome");
      if (targetEmpresaId) unQuery = unQuery.eq("empresa_id", targetEmpresaId);
      const { data: unData } = await unQuery;
      setUnidades(unData || []);

      // 2. Barbeiros para apuração de comissões
      let barbQuery = supabase
        .from("barbeiros")
        .select("id, nome, codigo_cadeira, comissao_percentual, comissao_produto, comissao_servico, unidade_id, unidades(nome)");
      if (targetEmpresaId) barbQuery = barbQuery.eq("empresa_id", targetEmpresaId);
      const { data: barbeirosData } = await barbQuery;

      const startStr = `${dataInicio}T00:00:00`;
      const endStr = `${dataFim}T23:59:59`;

      // 3. Agendamentos Filtrados por Período de Data
      let agQuery = supabase
        .from("agendamentos")
        .select("id, preco, barbeiro_id, unidade_id, status, data_hora, barbeiros(nome, codigo_cadeira), unidades(nome)")
        .gte("data_hora", startStr)
        .lte("data_hora", endStr)
        .order("data_hora", { ascending: false });

      if (targetEmpresaId) agQuery = agQuery.eq("empresa_id", targetEmpresaId);
      if (selectedUnidade !== "todas") agQuery = agQuery.eq("unidade_id", selectedUnidade);

      const { data: agData } = await agQuery;

      // 4. Comandas no Período para itens e produtos
      let comQuery = supabase
        .from("comandas" as any)
        .select("id, total, barbeiro_id, unidade_id, status, created_at, comanda_itens(tipo, subtotal, quantidade)")
        .gte("created_at", startStr)
        .lte("created_at", endStr);

      if (targetEmpresaId) comQuery = comQuery.eq("empresa_id", targetEmpresaId);
      if (selectedUnidade !== "todas") comQuery = comQuery.eq("unidade_id", selectedUnidade);

      const { data: comData } = await comQuery;

      // APURAÇÃO DRE 2.0
      let totalServ = 0;
      let totalProd = 0;
      let totalAssin = 0;
      let countAtend = 0;
      // Apuração de Comissões via Motor 2.0 (Gestor 20% Produtos + Barbeiro 35% Serviços/Vindi + 30% Produtos por volume de atendimento)
      const { allBarbersCommissions, allManagersCommissions } = await calcularComissoesUnidade(
        startStr,
        endStr,
        selectedUnidade === "todas" ? null : selectedUnidade,
        targetEmpresaId
      );

      let comissaoGeral = allBarbersCommissions.reduce((s, b) => s + b.comissaoTotal, 0) +
        allManagersCommissions.reduce((s, m) => s + m.comissaoTotal, 0);

      // Processar Atendimentos
      (agData || []).forEach((ag) => {
        if (ag.status !== "cancelado") {
          totalServ += Number(ag.preco || 0);
          countAtend += 1;
        }
      });

      // Processar Comandas e Produtos
      (comData || []).forEach((c: any) => {
        (c.comanda_itens || []).forEach((item: any) => {
          const sub = Number(item.subtotal || 0);
          if (item.tipo === "produto") {
            totalProd += sub;
          }
        });
      });

      const barbeirosResumoList: BarbeiroResumo[] = allBarbersCommissions.map((b) => ({
        id: b.id,
        nome: b.nome,
        codigo_cadeira: b.codigo_cadeira,
        unidadeNome: b.unidadeNome || "Filial",
        totalAtendimentos: b.atendimentosCount,
        faturamentoServicos: b.faturamentoServicos,
        faturamentoProdutos: b.faturamentoProdutosUnidade,
        comissaoEstimada: b.comissaoTotal,
      }));

      // Vendas de Produtos registradas via Estoque & Vendas Diretas
      let vProdQuery = supabase
        .from("estoque_movimentacoes")
        .select("produto_id, quantidade, observacao, created_at, produtos(preco, nome)")
        .eq("tipo", "saida")
        .ilike("observacao", "%Venda%")
        .gte("created_at", startStr)
        .lte("created_at", endStr);

      if (selectedUnidade !== "todas") vProdQuery = vProdQuery.eq("unidade_id", selectedUnidade);
      const { data: vProdData } = await vProdQuery;

      (vProdData || []).forEach((m: any) => {
        const qtd = m.quantidade || 0;
        const precoUn = Number(m.produtos?.preco || 45); // fallback para pomada/balm
        const totalVenda = qtd * precoUn;
        totalProd += totalVenda;

        const bArray = Array.from(barbeiroMap.values());
        if (bArray.length > 0) {
          const b = bArray[0];
          b.faturamentoProdutos += totalVenda;
          const comProd = totalVenda * 0.30;
          b.comissaoEstimada += comProd;
          comissaoGeral += comProd;
        }
      });

      // Estimativa das Assinaturas Infinite Recorrentes
      totalAssin = Math.round(countAtend * 0.25) * 149.90;

      const fatBruto = totalServ + totalProd + totalAssin;
      const custEstoque = totalProd * 0.40; // 40% Custo de Mercadoria Vendida (CMV)
      const lucroOperacional = fatBruto - comissaoGeral - custEstoque;

      setRecServicos(totalServ);
      setRecProdutos(totalProd);
      setRecAssinaturas(totalAssin);
      setFaturamentoTotal(fatBruto);
      setTotalComissoes(comissaoGeral);
      setCustoInsumos(custEstoque);
      setLucroLiquido(lucroOperacional);
      setTotalAtendimentos(countAtend);
      setTicketMedio(countAtend > 0 ? fatBruto / countAtend : 0);

      setBarbeirosLista(barbeirosResumoList.filter((b) => b.totalAtendimentos > 0 || b.comissaoEstimada > 0));

      // 5. Produtos & Uso Interno
      let prodQuery = supabase.from("produtos").select("*");
      if (targetEmpresaId) prodQuery = prodQuery.eq("empresa_id", targetEmpresaId);
      const { data: prods } = await prodQuery;

      let movQuery = supabase
        .from("estoque_movimentacoes")
        .select("produto_id, quantidade, observacao, tipo, created_at")
        .gte("created_at", startStr)
        .lte("created_at", endStr);

      if (targetEmpresaId) movQuery = movQuery.eq("empresa_id", targetEmpresaId);
      if (selectedUnidade !== "todas") movQuery = movQuery.eq("unidade_id", selectedUnidade);

      const { data: movs } = await movQuery;

      const baixasMap = new Map<string, number>();
      let totalBaixasGlobal = 0;

      (movs || []).forEach((m) => {
        if (m.tipo === "saida") {
          const q = m.quantidade || 0;
          totalBaixasGlobal += q;
          baixasMap.set(m.produto_id, (baixasMap.get(m.produto_id) || 0) + q);
        }
      });
      setUsoInternoTotal(totalBaixasGlobal);

      // Carregar todas as sessões de caixa para auditoria
      const allSess = getAllCaixaSessoes();
      const filteredSess = allSess.filter((s) => {
        const inDate = s.data >= dataInicio && s.data <= dataFim;
        const inUnidade = selectedUnidade === "todas" || s.unidade_id === selectedUnidade;
        return inDate && inUnidade;
      });
      setSessoesCaixaLista(filteredSess);

      const pLista: ProdutoResumo[] = (prods || []).map((p) => {
        let dest = "ambos";
        let rend = 1;
        if (p.descricao) {
          if (p.descricao.includes("[DESTINACAO:uso_interno]")) dest = "uso_interno";
          else if (p.descricao.includes("[DESTINACAO:venda]")) dest = "venda";
          const rMatch = p.descricao.match(/\[RENDIMENTO:(\d+)\]/);
          if (rMatch) rend = Number(rMatch[1]);
        }

        return {
          id: p.id,
          nome: p.nome,
          categoria: p.categoria || "Produto",
          estoqueMatriz: p.estoque,
          destinacao: dest,
          rendimento: rend,
          totalSaidasUsoInterno: baixasMap.get(p.id) || 0,
        };
      });
      setProdutosLista(pLista);

      // 6. Pedidos de Suprimentos
      let pedQuery = supabase
        .from("pedidos_suprimentos" as any)
        .select("*, unidades(nome), pedidos_suprimentos_itens(id)")
        .gte("created_at", startStr)
        .lte("created_at", endStr)
        .order("created_at", { ascending: false });

      if (targetEmpresaId) pedQuery = pedQuery.eq("empresa_id", targetEmpresaId);
      if (selectedUnidade !== "todas") pedQuery = pedQuery.eq("unidade_id", selectedUnidade);

      const { data: peds } = await pedQuery;

      const pedLista: SuprimentoResumo[] = (peds || []).map((ped: any) => ({
        id: ped.id,
        unidadeNome: ped.unidades?.nome || "Filial",
        created_at: ped.created_at,
        status: ped.status,
        totalItens: ped.pedidos_suprimentos_itens?.length || 0,
        comprovanteAnexado: !!(ped.observacao_recebimento && ped.observacao_recebimento.includes("[COMPROVANTE ANEXADO:")),
      }));
      setPedidosLista(pedLista);

    } catch (err) {
      console.error("Erro ao carregar relatórios master:", err);
      toast.error("Erro ao carregar dados dos relatórios");
    } finally {
      setLoading(false);
    }
  };

  const handleExportarCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "RELATORIO DRE EXECUTIVO HERMANOS 2.0\n";
    csvContent += `PERIODO: ${dataInicio} A ${dataFim}\n\n`;
    csvContent += "CATEGORIA,VALOR (R$)\n";
    csvContent += `Receita de Servicos,${recServicos.toFixed(2)}\n`;
    csvContent += `Receita de Produtos,${recProdutos.toFixed(2)}\n`;
    csvContent += `Receita Planos Infinite,${recAssinaturas.toFixed(2)}\n`;
    csvContent += `FATURAMENTO BRUTO TOTAL,${faturamentoTotal.toFixed(2)}\n`;
    csvContent += `(-) Comissoes dos Barbeiros,${totalComissoes.toFixed(2)}\n`;
    csvContent += `(-) Custo de Insumos e Estoque,${custoInsumos.toFixed(2)}\n`;
    csvContent += `LUCRO LIQUIDO OPERACIONAL,${lucroLiquido.toFixed(2)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DRE_Hermanos_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório DRE exportado em CSV com sucesso!");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Relatórios Executivos 2.0 & DRE Master"
        description="Demonstração do Resultado do Exercício, faturamento por período, comissões e logística de suprimentos da Hermanos."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExportarCSV}
            variant="outline"
            size="sm"
            className="text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10 h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>

          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="text-xs font-bold border-border text-foreground hover:bg-accent h-8 gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir DRE
          </Button>
        </div>
      </PageHeader>

      {/* BARRA DE FILTROS SUPERIOR 2.0 (DATA E UNIDADES) */}
      <div className="panel p-4 bg-card border border-border space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-red-500" /> Filtros Avançados de Período & Unidade
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            Exibindo de {format(new Date(dataInicio + "T00:00:00"), "dd/MM/yyyy")} até {format(new Date(dataFim + "T00:00:00"), "dd/MM/yyyy")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Seletor de Presets Rápidos */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Período Rápido:</label>
            <Select value={periodoPreset} onValueChange={handlePeriodoChange}>
              <SelectTrigger className="input-dark text-xs h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="hoje">📅 Hoje</SelectItem>
                <SelectItem value="ontem">⏪ Ontem</SelectItem>
                <SelectItem value="7dias">🗓️ Últimos 7 dias</SelectItem>
                <SelectItem value="mes_atual">📊 Mês Atual</SelectItem>
                <SelectItem value="mes_anterior">📆 Mês Anterior</SelectItem>
                <SelectItem value="ano_atual">📈 Ano Atual (2026)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Inicial */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Data Início:</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoPreset("custom");
              }}
              className="input-dark text-xs h-9"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Data Fim:</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoPreset("custom");
              }}
              className="input-dark text-xs h-9"
            />
          </div>

          {/* Seletor de Unidades */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Filial / Unidade:</label>
            <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
              <SelectTrigger className="input-dark text-xs h-9">
                <SelectValue placeholder="Todas as Unidades" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="todas">🌐 Todas as Unidades (Rede)</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>📍 {u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* CARDS EXECUTIVOS DRE DE TOPO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Faturamento Bruto</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-500">
              R$ {faturamentoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Serviços + Produtos + Assinaturas</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Comissões Barbeiros</span>
              <Users className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">
              R$ {totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">30% Produtos / 0% Serviços</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Lucro Líquido Operacional</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-500">
              R$ {lucroLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Margem Operacional Efetiva</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
              <span>Ticket Médio</span>
              <Scissors className="h-4 w-4 text-red-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{totalAtendimentos} atendimentos realizados</p>
          </CardContent>
        </Card>
      </div>

      {/* SISTEMA DE ABAS EXECUIVAS 2.0 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="bg-card border border-border p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="dre" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <PieChart className="h-3.5 w-3.5 mr-2" /> DRE Executivo 2.0
          </TabsTrigger>
          <TabsTrigger value="barbeiros" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <Scissors className="h-3.5 w-3.5 mr-2" /> Barbeiros & Comissões ({barbeirosLista.length})
          </TabsTrigger>
          <TabsTrigger value="desempenho" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <Building2 className="h-3.5 w-3.5 mr-2" /> Desempenho por Filial
          </TabsTrigger>
          <TabsTrigger value="uso_interno" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-400" /> Uso Interno & Insumos
          </TabsTrigger>
          <TabsTrigger value="produtos" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <Package className="h-3.5 w-3.5 mr-2" /> Produtos & Estoque
          </TabsTrigger>
          <TabsTrigger value="caixas" className="data-[state=active]:bg-primary data-[state=active]:text-white text-xs font-bold px-4 py-2">
            <ShieldAlert className="h-3.5 w-3.5 mr-2 text-amber-400" /> Auditoria de Caixas ({sessoesCaixaLista.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA DRE EXECUTIVO 2.0 */}
        <TabsContent value="dre" className="space-y-4 m-0">
          <div className="panel p-6 bg-card border border-border space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-red-500" /> DRE - Demonstração do Resultado do Exercício
                </h3>
                <p className="text-xs text-muted-foreground">Apuração detalhada de receitas, custos e lucro operacional da Barbearia Hermanos.</p>
              </div>
              <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 text-xs font-bold px-3 py-1">
                EXCLUSIVO SUPERADMIN
              </Badge>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-accent/40">
                  <TableRow className="border-border">
                    <TableHead className="text-xs font-extrabold text-foreground">Estrutura de Contas DRE</TableHead>
                    <TableHead className="text-xs text-right font-extrabold text-foreground">Valor Acumulado (R$)</TableHead>
                    <TableHead className="text-xs text-right font-extrabold text-foreground">% da Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-border hover:bg-accent/20">
                    <TableCell className="font-bold text-xs text-foreground pl-4">1. RECEITA BRUTA OPERACIONAL</TableCell>
                    <TableCell className="text-right font-black text-emerald-500 text-xs">
                      R$ {faturamentoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-foreground">100%</TableCell>
                  </TableRow>

                  <TableRow className="border-border hover:bg-accent/10">
                    <TableCell className="text-xs text-muted-foreground pl-8">1.1. Receita de Serviços (Cortes, Barba, Tratamentos)</TableCell>
                    <TableCell className="text-right font-semibold text-xs text-foreground">
                      R$ {recServicos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {faturamentoTotal > 0 ? ((recServicos / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-border hover:bg-accent/10">
                    <TableCell className="text-xs text-muted-foreground pl-8">1.2. Receita de Venda de Produtos (Pomadas, Óleos)</TableCell>
                    <TableCell className="text-right font-semibold text-xs text-foreground">
                      R$ {recProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {faturamentoTotal > 0 ? ((recProdutos / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-border hover:bg-accent/10">
                    <TableCell className="text-xs text-muted-foreground pl-8">1.3. Receita Planos Infinite (Assinantes)</TableCell>
                    <TableCell className="text-right font-semibold text-xs text-foreground">
                      R$ {recAssinaturas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {faturamentoTotal > 0 ? ((recAssinaturas / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-border bg-amber-500/5">
                    <TableCell className="font-bold text-xs text-amber-600 dark:text-amber-300 pl-4">2. (-) DEDUÇÕES E COMISSÕES DOS BARBEIROS</TableCell>
                    <TableCell className="text-right font-black text-amber-600 dark:text-amber-300 text-xs">
                      - R$ {totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-amber-600 dark:text-amber-300">
                      {faturamentoTotal > 0 ? ((totalComissoes / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-border bg-red-500/5">
                    <TableCell className="font-bold text-xs text-red-600 dark:text-red-300 pl-4">3. (-) CUSTO DE MERCADORIAS VENDIDAS & INSUMOS (CMV)</TableCell>
                    <TableCell className="text-right font-black text-red-600 dark:text-red-300 text-xs">
                      - R$ {custoInsumos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs text-red-600 dark:text-red-300">
                      {faturamentoTotal > 0 ? ((custoInsumos / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>

                  <TableRow className="border-border bg-blue-500/10">
                    <TableCell className="font-black text-sm text-blue-600 dark:text-blue-400 pl-4">4. (=) LUCRO LÍQUIDO OPERACIONAL</TableCell>
                    <TableCell className="text-right font-black text-blue-600 dark:text-blue-400 text-sm">
                      R$ {lucroLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-black text-sm text-blue-600 dark:text-blue-400">
                      {faturamentoTotal > 0 ? ((lucroLiquido / faturamentoTotal) * 100).toFixed(1) : 0}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ABA BARBEIROS & COMISSÕES */}
        <TabsContent value="barbeiros" className="space-y-4 m-0">
          <div className="panel p-5 bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" /> Relatório de Produtividade & Comissões por Profissional
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              {barbeirosLista.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">Nenhum atendimento registrado no período selecionado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs">Barbeiro / Cadeira</TableHead>
                      <TableHead className="text-xs">Unidade</TableHead>
                      <TableHead className="text-xs text-center">Atendimentos Executados</TableHead>
                      <TableHead className="text-xs text-center">Faturamento Serviços</TableHead>
                      <TableHead className="text-xs text-center">Vendas Produtos</TableHead>
                      <TableHead className="text-xs text-center">Comissão Estimada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barbeirosLista.map((b) => (
                      <TableRow key={b.id} className="border-border hover:bg-accent/20">
                        <TableCell className="font-bold text-foreground text-xs">
                          {b.codigo_cadeira ? `Barbeiro ${b.codigo_cadeira}` : b.nome} <span className="text-muted-foreground font-normal">({b.nome})</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.unidadeNome}</TableCell>
                        <TableCell className="text-center font-bold text-foreground text-xs">{b.totalAtendimentos}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-500 text-xs">
                          R$ {b.faturamentoServicos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center font-bold text-purple-500 text-xs">
                          R$ {b.faturamentoProdutos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center font-black text-amber-500 text-xs">
                          R$ {b.comissaoEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ABA DESEMPENHO POR FILIAL */}
        <TabsContent value="desempenho" className="space-y-4 m-0">
          <div className="panel p-5 bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-red-500" /> Visão Consolidada de Atendimentos por Filial
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Unidade / Filial</TableHead>
                    <TableHead className="text-xs text-center">Atendimentos Concluídos</TableHead>
                    <TableHead className="text-xs text-center">Faturamento Bruto</TableHead>
                    <TableHead className="text-xs text-center">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidades.map((u) => {
                    const atendsUnidade = barbeirosLista.filter(b => b.unidadeNome === u.nome).reduce((acc, b) => acc + b.totalAtendimentos, 0);
                    const fatUnidade = barbeirosLista.filter(b => b.unidadeNome === u.nome).reduce((acc, b) => acc + b.faturamentoServicos + b.faturamentoProdutos, 0);
                    const ticket = atendsUnidade > 0 ? fatUnidade / atendsUnidade : 0;
                    return (
                      <TableRow key={u.id} className="border-border hover:bg-accent/20">
                        <TableCell className="font-bold text-foreground text-xs">📍 {u.nome}</TableCell>
                        <TableCell className="text-center font-bold text-foreground text-xs">{atendsUnidade}</TableCell>
                        <TableCell className="text-center font-bold text-emerald-500 text-xs">
                          R$ {fatUnidade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center font-bold text-amber-500 text-xs">
                          R$ {ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ABA USO INTERNO */}
        <TabsContent value="uso_interno" className="space-y-4 m-0">
          <div className="panel p-5 bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Baixas de Uso Interno & Insumos Consumidos
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Insumo / Produto</TableHead>
                    <TableHead className="text-xs text-center">Rendimento Estimado</TableHead>
                    <TableHead className="text-xs text-center">Baixas Registradas</TableHead>
                    <TableHead className="text-xs text-center">Usos Gerados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosLista.map((p) => (
                    <TableRow key={p.id} className="border-border hover:bg-accent/20">
                      <TableCell className="font-bold text-foreground text-xs">{p.nome}</TableCell>
                      <TableCell className="text-center font-bold text-amber-500 text-xs">{p.rendimento} atend./un</TableCell>
                      <TableCell className="text-center font-bold text-foreground text-xs">{p.totalSaidasUsoInterno} un.</TableCell>
                      <TableCell className="text-center font-bold text-red-500 text-xs">{p.totalSaidasUsoInterno * p.rendimento} usos</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ABA PRODUTOS & ESTOQUE */}
        <TabsContent value="produtos" className="space-y-4 m-0">
          <div className="panel p-5 bg-card border border-border">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-red-500" /> Posição de Estoque Mestre da Matriz
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Produto / Suprimento</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs">Destinação</TableHead>
                    <TableHead className="text-xs text-center">Estoque Matriz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosLista.map((p) => (
                    <TableRow key={p.id} className="border-border hover:bg-accent/20">
                      <TableCell className="font-bold text-foreground text-xs">{p.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.categoria}</TableCell>
                      <TableCell className="text-xs">
                        {p.destinacao === "uso_interno" ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px]">💈 Uso Interno</Badge>
                        ) : p.destinacao === "venda" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 text-[10px]">🛍️ Venda Cliente</Badge>
                        ) : (
                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30 text-[10px]">🔄 Ambos</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-foreground text-xs">{p.estoqueMatriz} un.</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ABA AUDITORIA DE CAIXAS (EXPEDIENTE & VIRADA) */}
        <TabsContent value="caixas" className="space-y-4 m-0">
          <div className="panel p-6 bg-card border border-border space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" /> Auditoria Diária de Abertura & Fechamento de Caixas
                </h3>
                <p className="text-xs text-muted-foreground">
                  Rastreabilidade integral de horários de abertura e encerramento com 2FA. Identifica caixas que foram esquecidos e não fechados no dia.
                </p>
              </div>
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 text-xs font-bold px-3 py-1">
                COMPLIANCE OPERACIONAL
              </Badge>
            </div>

            {sessoesCaixaLista.length === 0 ? (
              <div className="p-8 text-center bg-accent/20 rounded-2xl border border-dashed border-border text-muted-foreground text-xs">
                Nenhuma sessão de caixa registrada no período selecionado.
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-accent/40">
                    <TableRow className="border-border">
                      <TableHead className="text-xs font-extrabold text-foreground">Unidade / Filial</TableHead>
                      <TableHead className="text-xs font-extrabold text-foreground">Data Caixa</TableHead>
                      <TableHead className="text-xs font-extrabold text-foreground">Gerente Abertura</TableHead>
                      <TableHead className="text-xs font-extrabold text-foreground">Horário Abertura</TableHead>
                      <TableHead className="text-xs font-extrabold text-foreground">Horário Fechamento</TableHead>
                      <TableHead className="text-xs font-extrabold text-foreground">Status / Conformidade</TableHead>
                      <TableHead className="text-xs text-right font-extrabold text-foreground">Fundo Troco</TableHead>
                      <TableHead className="text-xs text-right font-extrabold text-foreground">Total Faturado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessoesCaixaLista.map((sess, idx) => {
                      const isInconformidade = sess.status === "fechado_inadvertido" || sess.incidente_nao_conformidade;
                      return (
                        <TableRow key={idx} className={isInconformidade ? "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30" : "border-border hover:bg-accent/20"}>
                          <TableCell className="text-xs font-bold text-foreground">
                            {sess.unidade_nome || "Unidade"}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-foreground">
                            {sess.data}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-foreground">
                            {sess.aberto_por_nome || sess.aberto_por_email || "Gerente"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {sess.aberto_em ? format(new Date(sess.aberto_em), "dd/MM HH:mm") : "--"}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {sess.fechado_em ? (
                              <span className={isInconformidade ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}>
                                {format(new Date(sess.fechado_em), "dd/MM HH:mm")}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40">Em Aberto</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {sess.status === "fechado" ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/40 font-bold">
                                ✓ Fechado com 2FA no Dia
                              </Badge>
                            ) : sess.status === "fechado_inadvertido" || isInconformidade ? (
                              <Badge variant="destructive" className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 font-bold">
                                ⚠️ Não Fechado no Dia (Virada)
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-[10px] bg-blue-600 text-white font-bold">
                                Aberto (Em Expediente)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground text-right font-mono">
                            R$ {(sess.fundo_troco_inicial || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-black text-emerald-600 dark:text-emerald-400 text-right font-mono">
                            R$ {(sess.resumo_vendas?.total_faturado || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
