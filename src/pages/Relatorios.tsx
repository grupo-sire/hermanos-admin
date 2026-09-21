import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { PageHeader } from "@/components/ui/page-header";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Download, FileText, Users, DollarSign, Percent, Package, Scissors, Sparkles, TrendingUp, ArrowUpDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { HistoricoCaixasDialog } from "@/components/checkout/HistoricoCaixasDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calcularComissoesUnidade } from "@/lib/commissionEngine";

interface ItemVendido {
  nome: string;
  tipo: string;
  quantidade: number;
  total: number;
}

interface ProfessionalReport {
  id: string;
  nome: string;
  atendimentos: number;
  faturamento: number;
  comissaoPerc: number;
  comissaoValor: number;
  totalServicos: number;
  totalProdutos: number;
  itensVendidos: ItemVendido[];
}

interface GeneralReport {
  totalRevenue: number;
  totalAtendimentos: number;
  ticketMedio: number;
  totalDesconto: number;
  formasPagamento: Record<string, { count: number; total: number }>;
  professionals: ProfessionalReport[];
  itensVendidos: ItemVendido[];
  servicosVendidos: ItemVendido[];
  produtosVendidos: ItemVendido[];
  totalQtdServicos: number;
  totalQtdProdutos: number;
  totalFaturamentoServicos: number;
  totalFaturamentoProdutos: number;
}

export default function Relatorios() {
  const { selectedUnidadeId } = useUnidade();
  const { labels } = useEmpresa();
  const { isBarber, barbeiroId } = useUserRole();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

  // Filtros internos da aba Itens Vendidos
  const [itemTypeFilter, setItemTypeFilter] = useState<"todos" | "servicos" | "produtos">("todos");
  const [itemSortOrder, setItemSortOrder] = useState<"qtd" | "total">("qtd");
  const [historicoCaixaOpen, setHistoricoCaixaOpen] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ["relatorio", dateRange?.from, dateRange?.to, selectedUnidadeId, isBarber, barbeiroId],
    queryFn: async (): Promise<GeneralReport> => {
      if (!dateRange?.from || !dateRange?.to) throw new Error("Selecione um período");

      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      let comandasQuery = supabase
        .from("comandas")
        .select("id, total, desconto, barbeiro_id, forma_pagamento, fechada_em, created_at")
        .eq("status", "fechada")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (selectedUnidadeId) comandasQuery = comandasQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) comandasQuery = comandasQuery.eq("barbeiro_id", barbeiroId);

      const { data: comandas, error } = await comandasQuery;
      if (error) throw error;

      let barbQuery = supabase
        .from("barbeiros")
        .select("id, nome, comissao_percentual, comissao_servico, comissao_produto")
        .eq("status", "active");

      if (selectedUnidadeId) barbQuery = barbQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) barbQuery = barbQuery.eq("id", barbeiroId);

      const { data: barbeiros } = await barbQuery;

      const comandaIds = comandas?.map(c => c.id) || [];
      let itens: any[] = [];
      if (comandaIds.length > 0) {
        const { data: itensData } = await supabase
          .from("comanda_itens")
          .select("comanda_id, tipo, subtotal, nome, quantidade")
          .in("comanda_id", comandaIds);
        itens = itensData || [];
      }

      const totalRevenue = comandas?.reduce((s, c) => s + Number(c.total), 0) || 0;
      const totalAtendimentos = comandas?.length || 0;
      const ticketMedio = totalAtendimentos > 0 ? totalRevenue / totalAtendimentos : 0;
      const totalDesconto = comandas?.reduce((s, c) => s + Number(c.desconto), 0) || 0;

      const formasPagamento: Record<string, { count: number; total: number }> = {};
      comandas?.forEach(c => {
        const forma = c.forma_pagamento || "Não informado";
        if (!formasPagamento[forma]) formasPagamento[forma] = { count: 0, total: 0 };
        formasPagamento[forma].count++;
        formasPagamento[forma].total += Number(c.total);
      });

      // Agregar todos os itens vendidos
      const itensMap = new Map<string, ItemVendido>();
      itens.forEach(i => {
        const isProd = (i.tipo || "").toLowerCase().includes("produto");
        const tipoLimpo = isProd ? "produto" : "servico";
        const key = tipoLimpo + "_" + i.nome;
        const existing = itensMap.get(key);
        const qtd = Number(i.quantidade) || 1;
        const sub = Number(i.subtotal) || 0;

        if (existing) {
          existing.quantidade += qtd;
          existing.total += sub;
        } else {
          itensMap.set(key, { nome: i.nome, tipo: tipoLimpo, quantidade: qtd, total: sub });
        }
      });

      const todosItens = Array.from(itensMap.values());
      const itensVendidos = [...todosItens].sort((a, b) => b.quantidade - a.quantidade || b.total - a.total);

      const servicosVendidos = todosItens
        .filter(i => i.tipo === "servico")
        .sort((a, b) => b.quantidade - a.quantidade || b.total - a.total);

      const produtosVendidos = todosItens
        .filter(i => i.tipo === "produto")
        .sort((a, b) => b.quantidade - a.quantidade || b.total - a.total);

      const totalQtdServicos = servicosVendidos.reduce((s, i) => s + i.quantidade, 0);
      const totalQtdProdutos = produtosVendidos.reduce((s, i) => s + i.quantidade, 0);
      const totalFaturamentoServicos = servicosVendidos.reduce((s, i) => s + i.total, 0);
      const totalFaturamentoProdutos = produtosVendidos.reduce((s, i) => s + i.total, 0);

      // Apuração de Comissões via Motor 2.0 (35% Serviços/Vindi + 30% Produtos da filial por volume de atendimento)
      const { allBarbersCommissions } = await calcularComissoesUnidade(fromDate, toDate, selectedUnidadeId);

      const professionals: ProfessionalReport[] = (barbeiros || []).map((b: any) => {
        const bComandas = comandas?.filter(c => c.barbeiro_id === b.id) || [];
        const bComandaIds = bComandas.map(c => c.id);
        const bItens = itens.filter(i => bComandaIds.includes(i.comanda_id));
        const totalServicos = bItens.filter(i => (i.tipo || "").toLowerCase() !== "produto").reduce((s: number, i: any) => s + Number(i.subtotal), 0);
        const totalProdutos = bItens.filter(i => (i.tipo || "").toLowerCase().includes("produto")).reduce((s: number, i: any) => s + Number(i.subtotal), 0);

        const engineCalc = allBarbersCommissions.find((x) => x.id === b.id);
        const comissaoValor = engineCalc ? engineCalc.comissaoTotal : 0;
        const comissaoPerc = engineCalc ? engineCalc.taxaServicoAplicada : 35;

        const profItensMap = new Map<string, ItemVendido>();
        bItens.forEach((i: any) => {
          const isProd = (i.tipo || "").toLowerCase().includes("produto");
          const tipoLimpo = isProd ? "produto" : "servico";
          const key = tipoLimpo + "_" + i.nome;
          const existing = profItensMap.get(key);
          const qtd = Number(i.quantidade) || 1;
          const sub = Number(i.subtotal) || 0;

          if (existing) {
            existing.quantidade += qtd;
            existing.total += sub;
          } else {
            profItensMap.set(key, { nome: i.nome, tipo: tipoLimpo, quantidade: qtd, total: sub });
          }
        });

        return {
          id: b.id,
          nome: b.nome,
          atendimentos: engineCalc?.atendimentosCount || bComandas.length,
          faturamento: bComandas.reduce((s, c) => s + Number(c.total), 0),
          comissaoPerc,
          comissaoValor,
          totalServicos,
          totalProdutos,
          itensVendidos: Array.from(profItensMap.values()).sort((a, b) => b.quantidade - a.quantidade || b.total - a.total),
        };
      }).filter(p => p.atendimentos > 0 || p.comissaoValor > 0).sort((a, b) => b.faturamento - a.faturamento);

      return {
        totalRevenue,
        totalAtendimentos,
        ticketMedio,
        totalDesconto,
        formasPagamento,
        professionals,
        itensVendidos,
        servicosVendidos,
        produtosVendidos,
        totalQtdServicos,
        totalQtdProdutos,
        totalFaturamentoServicos,
        totalFaturamentoProdutos,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const exportCSV = (type: "geral" | "profissional") => {
    if (!report) return;
    let csv = "";
    const periodo = "Período: " + format(dateRange.from, "dd/MM/yyyy") + " - " + format(dateRange.to, "dd/MM/yyyy");

    if (isBarber) {
      csv = "Extrato de Comissões - Meu Desempenho\n" + periodo + "\n\n";
      report.professionals.forEach(p => {
        csv += "Profissional: " + p.nome + "\n";
        csv += "Atendimentos;" + p.atendimentos + "\n";
        csv += "Faturamento Cadeira;" + formatCurrency(p.faturamento) + "\n";
        csv += "Serviços;" + formatCurrency(p.totalServicos) + "\n";
        csv += "Produtos;" + formatCurrency(p.totalProdutos) + "\n";
        csv += "Comissão (" + p.comissaoPerc + "%);" + formatCurrency(p.comissaoValor) + "\n";
        csv += "\nItens Vendidos;Tipo;Quantidade;Total\n";
        p.itensVendidos.forEach(i => {
          csv += i.nome + ";" + i.tipo + ";" + i.quantidade + ";" + formatCurrency(i.total) + "\n";
        });
      });
    } else if (type === "geral") {
      csv = "Relatório Geral Hermanos\n" + periodo + "\n\n";
      csv += "Faturamento Total;" + formatCurrency(report.totalRevenue) + "\n";
      csv += "Total Atendimentos;" + report.totalAtendimentos + "\n";
      csv += "Ticket Médio;" + formatCurrency(report.ticketMedio) + "\n";
      csv += "Total Descontos;" + formatCurrency(report.totalDesconto) + "\n\n";
      
      csv += "RANKING DE SERVIÇOS VENDIDOS (POR QUANTIDADE)\nServiço;Quantidade Realizada;Total Gerado\n";
      report.servicosVendidos.forEach(s => {
        csv += s.nome + ";" + s.quantidade + ";" + formatCurrency(s.total) + "\n";
      });
      csv += "Total Serviços;" + report.totalQtdServicos + ";" + formatCurrency(report.totalFaturamentoServicos) + "\n\n";

      csv += "RANKING DE PRODUTOS VENDIDOS (POR QUANTIDADE)\nProduto;Quantidade Vendida;Total Gerado\n";
      report.produtosVendidos.forEach(p => {
        csv += p.nome + ";" + p.quantidade + ";" + formatCurrency(p.total) + "\n";
      });
      csv += "Total Produtos;" + report.totalQtdProdutos + ";" + formatCurrency(report.totalFaturamentoProdutos) + "\n\n";

      csv += "Formas de Pagamento;Quantidade;Total\n";
      Object.entries(report.formasPagamento).forEach(([forma, data]) => {
        csv += forma + ";" + data.count + ";" + formatCurrency(data.total) + "\n";
      });
      csv += "\n" + labels.profissional + ";Atendimentos;Faturamento;Serviços;Produtos;Comissão %;Comissão R$\n";
      report.professionals.forEach(p => {
        csv += p.nome + ";" + p.atendimentos + ";" + formatCurrency(p.faturamento) + ";" + formatCurrency(p.totalServicos) + ";" + formatCurrency(p.totalProdutos) + ";" + p.comissaoPerc + "%;" + formatCurrency(p.comissaoValor) + "\n";
      });
    } else {
      csv = "Relatório por " + labels.profissional + "\n" + periodo + "\n\n";
      report.professionals.forEach(p => {
        csv += "\n" + p.nome + "\n";
        csv += "Atendimentos;" + p.atendimentos + "\n";
        csv += "Faturamento;" + formatCurrency(p.faturamento) + "\n";
        csv += "Serviços;" + formatCurrency(p.totalServicos) + "\n";
        csv += "Produtos;" + formatCurrency(p.totalProdutos) + "\n";
        csv += "Comissão (" + p.comissaoPerc + "%);" + formatCurrency(p.comissaoValor) + "\n";
        csv += "\nItens Vendidos;Tipo;Quantidade;Total\n";
        p.itensVendidos.forEach(i => {
          csv += i.nome + ";" + i.tipo + ";" + i.quantidade + ";" + formatCurrency(i.total) + "\n";
        });
      });
    }

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-vendas-hermanos-" + format(new Date(), "yyyy-MM-dd") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalComissoes = report?.professionals.reduce((s, p) => s + p.comissaoValor, 0) || 0;

  // Filtragem e ordenação dinâmica para a aba de Itens Vendidos
  let listaItensExibicao = report?.itensVendidos || [];
  if (itemTypeFilter === "servicos") {
    listaItensExibicao = report?.servicosVendidos || [];
  } else if (itemTypeFilter === "produtos") {
    listaItensExibicao = report?.produtosVendidos || [];
  }

  if (itemSortOrder === "qtd") {
    listaItensExibicao = [...listaItensExibicao].sort((a, b) => b.quantidade - a.quantidade || b.total - a.total);
  } else {
    listaItensExibicao = [...listaItensExibicao].sort((a, b) => b.total - a.total || b.quantidade - a.quantidade);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title={isBarber ? "Meu Extrato de Comissões" : "Relatórios & Desempenho"}
        description={
          isBarber
            ? "Acompanhe suas comissões, vendas e extrato de atendimentos por período."
            : "Exportação de relatórios financeiros, serviços vendidos e desempenho por " + labels.profissional.toLowerCase()
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {!isBarber && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoricoCaixaOpen(true)}
              className="btn-soft text-xs h-9 font-bold"
            >
              <History className="h-4 w-4 mr-1.5 text-primary" />
              Histórico de Caixas (2FA)
            </Button>
          )}
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </PageHeader>

      {/* CARDS DE RESUMO GERAL */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="panel p-4 border-red-500/20 bg-red-950/10">
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold mb-1">
            <Percent className="h-3.5 w-3.5" />
            {isBarber ? "Minha Comissão A Receber" : "Total Comissões"}
          </div>
          <div className="text-2xl font-black text-red-500">{isLoading ? "..." : formatCurrency(totalComissoes)}</div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Scissors className="h-3.5 w-3.5 text-primary" />
            {isBarber ? "Meus Atendimentos" : "Total Atendimentos"}
          </div>
          <div className="text-xl font-bold text-foreground">{isLoading ? "..." : report?.totalAtendimentos || 0}</div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            {isBarber ? "Faturamento da Cadeira" : "Faturamento Total"}
          </div>
          <div className="text-xl font-bold text-foreground">{isLoading ? "..." : formatCurrency(report?.totalRevenue || 0)}</div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="h-3.5 w-3.5" />
            Ticket Médio
          </div>
          <div className="text-xl font-bold text-foreground">{isLoading ? "..." : formatCurrency(report?.ticketMedio || 0)}</div>
        </div>
      </div>

      <Tabs defaultValue={isBarber ? "profissional" : "geral"} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="bg-muted/50 p-1 border border-border">
            {!isBarber && <TabsTrigger value="geral" className="font-bold text-xs">Relatório Geral</TabsTrigger>}
            <TabsTrigger value="profissional" className="font-bold text-xs">{isBarber ? "Meu Extrato Detalhado" : "Por " + labels.profissional}</TabsTrigger>
            <TabsTrigger value="itens" className="font-bold text-xs flex items-center gap-1.5">
              <Scissors className="h-3.5 w-3.5 text-primary" />
              {isBarber ? "Meus Serviços & Produtos" : "Serviços & Produtos Vendidos"}
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" className="btn-wine font-bold text-xs" onClick={() => exportCSV(isBarber ? "profissional" : "geral")}>
              <Download className="h-4 w-4 mr-2" />
              {isBarber ? "Exportar Extrato (CSV)" : "Exportar Relatório (CSV)"}
            </Button>
          </div>
        </div>

        {/* ABA 1: RELATÓRIO GERAL */}
        {!isBarber && (
          <TabsContent value="geral" className="space-y-4">
            
            {/* LINHA 1: RANKINGS DE SERVIÇOS E PRODUTOS POR QUANTIDADE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* RANKING DE SERVIÇOS POR QUANTIDADE */}
              <div className="panel border-primary/20 bg-card">
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-primary" />
                    Ranking de Serviços Mais Vendidos (por Quantidade)
                  </h3>
                  <Badge variant="outline" className="text-[11px] font-extrabold border-primary/40 text-primary bg-primary/10">
                    {(report?.totalQtdServicos || 0)} serviços realizados
                  </Badge>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10 text-center font-bold">#</TableHead>
                        <TableHead className="text-xs font-bold">Serviço</TableHead>
                        <TableHead className="text-xs text-center font-bold">Qtd Vendida</TableHead>
                        <TableHead className="text-xs text-right font-bold">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!report?.servicosVendidos || report.servicosVendidos.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs font-semibold">
                            Nenhum serviço finalizado no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.servicosVendidos.map((s, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="text-xs text-center font-black text-muted-foreground">
                              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "#" + (idx + 1)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">
                              {s.nome}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge className="font-black bg-primary/20 text-primary border-primary/30 px-2 py-0.5">
                                {s.quantidade}x
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-black text-foreground">
                              {formatCurrency(s.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {report && report.servicosVendidos.length > 0 && (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={2} className="font-bold text-xs">Total de Serviços</TableCell>
                          <TableCell className="text-center font-black text-xs text-primary">{report.totalQtdServicos}x</TableCell>
                          <TableCell className="text-right font-black text-xs text-foreground">{formatCurrency(report.totalFaturamentoServicos)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </div>

              {/* RANKING DE PRODUTOS POR QUANTIDADE */}
              <div className="panel border-blue-500/20 bg-card">
                <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    Ranking de Produtos Mais Vendidos (por Quantidade)
                  </h3>
                  <Badge variant="outline" className="text-[11px] font-extrabold border-blue-500/40 text-blue-400 bg-blue-500/10">
                    {(report?.totalQtdProdutos || 0)} unidades vendidas
                  </Badge>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10 text-center font-bold">#</TableHead>
                        <TableHead className="text-xs font-bold">Produto</TableHead>
                        <TableHead className="text-xs text-center font-bold">Qtd Vendida</TableHead>
                        <TableHead className="text-xs text-right font-bold">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!report?.produtosVendidos || report.produtosVendidos.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs font-semibold">
                            Nenhum produto vendido no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.produtosVendidos.map((p, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30">
                            <TableCell className="text-xs text-center font-black text-muted-foreground">
                              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "#" + (idx + 1)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">
                              {p.nome}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              <Badge className="font-black bg-blue-500/20 text-blue-400 border-blue-500/30 px-2 py-0.5">
                                {p.quantidade} un.
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-black text-foreground">
                              {formatCurrency(p.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                    {report && report.produtosVendidos.length > 0 && (
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={2} className="font-bold text-xs">Total de Produtos</TableCell>
                          <TableCell className="text-center font-black text-xs text-blue-400">{report.totalQtdProdutos} un.</TableCell>
                          <TableCell className="text-right font-black text-xs text-foreground">{formatCurrency(report.totalFaturamentoProdutos)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </div>

            </div>

            {/* LINHA 2: FORMAS DE PAGAMENTO & RESUMO POR BARBEIRO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="panel">
                <h3 className="text-sm font-bold text-foreground mb-3">Formas de Pagamento</h3>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Forma</TableHead><TableHead className="text-center">Qtd</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {report && Object.entries(report.formasPagamento).map(([forma, data]) => (
                      <TableRow key={forma}>
                        <TableCell className="capitalize">{forma}</TableCell>
                        <TableCell className="text-center">{data.count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(data.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="panel">
                <h3 className="text-sm font-bold text-foreground mb-3">Resumo por {labels.profissional}</h3>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>{labels.profissional}</TableHead><TableHead className="text-center">Atend.</TableHead><TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {report?.professionals.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-center">{p.atendimentos}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.faturamento)}</TableCell>
                        <TableCell className="text-right text-primary font-bold">{formatCurrency(p.comissaoValor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {report && report.professionals.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-center font-bold">{report.professionals.reduce((s, p) => s + p.atendimentos, 0)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(report.totalRevenue)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCurrency(totalComissoes)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ABA 2: POR BARBEIRO */}
        <TabsContent value="profissional">
          <div className="space-y-4">
            {report?.professionals.map(p => (
              <div key={p.id} className="panel border-white/[0.08]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold">
                    {p.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{p.nome}</h3>
                    <p className="text-xs text-muted-foreground">{p.atendimentos} atendimentos realizados no período</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-secondary/30 rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-muted-foreground">Faturamento Cadeira</div>
                    <div className="text-sm font-bold text-foreground">{formatCurrency(p.faturamento)}</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-muted-foreground">Total Serviços</div>
                    <div className="text-sm font-bold text-foreground">{formatCurrency(p.totalServicos)}</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-muted-foreground">Total Produtos</div>
                    <div className="text-sm font-bold text-foreground">{formatCurrency(p.totalProdutos)}</div>
                  </div>
                  <div className="bg-red-950/20 rounded-lg p-3 border border-red-500/20">
                    <div className="text-xs text-red-400 font-bold">Comissão ({p.comissaoPerc}%)</div>
                    <div className="text-sm font-black text-red-500">{formatCurrency(p.comissaoValor)}</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 border border-white/[0.04]">
                    <div className="text-xs text-muted-foreground">Ticket Médio</div>
                    <div className="text-sm font-bold text-foreground">{formatCurrency(p.atendimentos > 0 ? p.faturamento / p.atendimentos : 0)}</div>
                  </div>
                </div>

                {p.itensVendidos.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhamento dos Serviços e Produtos Vendidos</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs text-center">Quantidade</TableHead>
                          <TableHead className="text-xs text-right">Total Gerado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.itensVendidos.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm font-medium">{item.nome}</TableCell>
                            <TableCell className="text-sm capitalize text-muted-foreground">{item.tipo === "produto" ? "🛍️ Produto" : "✂️ Serviço"}</TableCell>
                            <TableCell className="text-sm text-center font-semibold">{item.quantidade}</TableCell>
                            <TableCell className="text-sm text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
            {report?.professionals.length === 0 && (
              <div className="panel text-center text-muted-foreground py-8">Nenhum atendimento ou comissão registrada no período selecionado</div>
            )}
          </div>
        </TabsContent>

        {/* ABA 3: SERVIÇOS & PRODUTOS VENDIDOS DETALHADOS (COM FILTRO E ORDENAÇÃO) */}
        <TabsContent value="itens" className="space-y-4">
          
          {/* CARDS DE VOLUME CONSOLIDADO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="panel p-3.5 border-primary/30 bg-primary/5">
              <span className="text-[11px] font-bold uppercase text-primary flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> Total Serviços Realizados
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-foreground">{report?.totalQtdServicos || 0} cortes</span>
                <span className="text-xs font-extrabold text-primary">{formatCurrency(report?.totalFaturamentoServicos || 0)}</span>
              </div>
            </div>

            <div className="panel p-3.5 border-blue-500/30 bg-blue-500/5">
              <span className="text-[11px] font-bold uppercase text-blue-400 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Total Produtos Vendidos
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-foreground">{report?.totalQtdProdutos || 0} unidades</span>
                <span className="text-xs font-extrabold text-blue-400">{formatCurrency(report?.totalFaturamentoProdutos || 0)}</span>
              </div>
            </div>

            <div className="panel p-3.5 border-emerald-500/30 bg-emerald-500/5">
              <span className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Faturamento Total dos Itens
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-400">{formatCurrency(report?.totalRevenue || 0)}</span>
                <span className="text-xs text-muted-foreground font-semibold">{(report?.totalQtdServicos || 0) + (report?.totalQtdProdutos || 0)} itens no total</span>
              </div>
            </div>
          </div>

          <div className="panel space-y-4">
            
            {/* CONTROLES DE FILTRO E ORDENAÇÃO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={itemTypeFilter === "todos" ? "default" : "outline"}
                  onClick={() => setItemTypeFilter("todos")}
                  className={cn("text-xs font-bold h-8", itemTypeFilter === "todos" && "btn-wine text-white")}
                >
                  Todos os Itens ({report?.itensVendidos.length || 0})
                </Button>

                <Button
                  size="sm"
                  variant={itemTypeFilter === "servicos" ? "default" : "outline"}
                  onClick={() => setItemTypeFilter("servicos")}
                  className={cn("text-xs font-bold h-8", itemTypeFilter === "servicos" && "btn-wine text-white")}
                >
                  <Scissors className="h-3.5 w-3.5 mr-1.5" />
                  Apenas Serviços ({report?.totalQtdServicos || 0} cortes)
                </Button>

                <Button
                  size="sm"
                  variant={itemTypeFilter === "produtos" ? "default" : "outline"}
                  onClick={() => setItemTypeFilter("produtos")}
                  className={cn("text-xs font-bold h-8", itemTypeFilter === "produtos" && "btn-wine text-white")}
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Apenas Produtos ({report?.totalQtdProdutos || 0} un.)
                </Button>
              </div>

              {/* Toggle de ordenação */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" /> Ordenar por:
                </span>
                <Button
                  size="sm"
                  variant={itemSortOrder === "qtd" ? "secondary" : "ghost"}
                  onClick={() => setItemSortOrder("qtd")}
                  className="text-xs font-extrabold h-7 px-2.5"
                >
                  Quantidade (Qtd)
                </Button>
                <Button
                  size="sm"
                  variant={itemSortOrder === "total" ? "secondary" : "ghost"}
                  onClick={() => setItemSortOrder("total")}
                  className="text-xs font-extrabold h-7 px-2.5"
                >
                  Faturamento (R$)
                </Button>
              </div>
            </div>

            {/* TABELA DE ITENS */}
            <div className="border border-border rounded-xl overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="text-xs w-12 text-center font-bold">Posição</TableHead>
                    <TableHead className="text-xs font-bold">Item / Descrição</TableHead>
                    <TableHead className="text-xs font-bold">Categoria</TableHead>
                    <TableHead className="text-xs text-center font-bold">Quantidade Vendida</TableHead>
                    <TableHead className="text-xs text-right font-bold">Faturamento Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaItensExibicao.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-center font-black text-muted-foreground">
                        {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : "#" + (idx + 1)}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-foreground">{item.nome}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold",
                          item.tipo === "produto" ? "border-blue-500/30 text-blue-400 bg-blue-500/10" : "border-primary/30 text-primary bg-primary/10"
                        )}>
                          {item.tipo === "produto" ? "🛍️ Produto" : "✂️ Serviço"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="font-black text-xs px-2.5 py-0.5 bg-secondary text-foreground border-border">
                          {item.quantidade} {item.tipo === "produto" ? "un." : "cortes"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-foreground">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                  {listaItensExibicao.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs font-semibold">
                        Nenhum item vendido encontrado com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {listaItensExibicao.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold text-xs">Total Consolidado</TableCell>
                      <TableCell className="text-center font-black text-xs text-primary">
                        {listaItensExibicao.reduce((s, i) => s + i.quantidade, 0)} {itemTypeFilter === "produtos" ? "un." : itemTypeFilter === "servicos" ? "cortes" : "itens"}
                      </TableCell>
                      <TableCell className="text-right font-black text-xs text-foreground">
                        {formatCurrency(listaItensExibicao.reduce((s, i) => s + i.total, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <HistoricoCaixasDialog
        open={historicoCaixaOpen}
        onOpenChange={setHistoricoCaixaOpen}
      />
    </div>
  );
}
