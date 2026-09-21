import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Users, DollarSign, TrendingUp, Clock, Scissors, Calendar, Phone, Mail, MapPin, User, ChevronRight, Sparkles, Loader2, ShoppingBag, AlertCircle, Search, ExternalLink, Percent
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { calcularComissoesUnidade } from "@/lib/commissionEngine";

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedUnidadeId } = useUnidade();
  const { isBarber, barbeiroId, loading: roleLoading } = useUserRole();
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [modalMetrica, setModalMetrica] = useState<"faturamento" | "atendimentos" | "clientes" | "ticket" | "hoje" | "comandas_abertas" | "comissao" | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

  // Fetch revenue and attendance data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-stats", dateRange?.from, dateRange?.to, selectedUnidadeId, isBarber, barbeiroId],
    refetchInterval: 30000,
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return null;

      const fromDate = dateRange.from.toISOString();
      const toDate = dateRange.to.toISOString();

      const startOfTodayIso = startOfDay(new Date()).toISOString();
      const endOfTodayIso = endOfDay(new Date()).toISOString();

      // 1. Comandas no período (com os relacionamentos para exibir no modal)
      let comandasQuery = supabase
        .from("comandas")
        .select("id, total, cliente_id, fechada_em, created_at, barbeiro_id, status, agendamento_id, clientes(nome, telefone, email, observacoes), barbeiros(nome, codigo_cadeira), unidades(nome)");

      if (selectedUnidadeId) comandasQuery = comandasQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) comandasQuery = comandasQuery.eq("barbeiro_id", barbeiroId);

      // 2. Agendamentos no período selecionado
      let agendamentosQuery = supabase
        .from("agendamentos")
        .select("id, data_hora, preco, cliente_id, servico_id, barbeiro_id, status, observacoes, clientes(nome, telefone, email, observacoes), servicos(nome, duracao_minutos, preco), barbeiros(nome, codigo_cadeira), unidades(nome)")
        .gte("data_hora", fromDate)
        .lte("data_hora", toDate)
        .order("data_hora", { ascending: true });

      if (selectedUnidadeId) agendamentosQuery = agendamentosQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) agendamentosQuery = agendamentosQuery.eq("barbeiro_id", barbeiroId);

      // 3. Comandas ABERTAS no momento (checkout)
      let comandasAbertasCheckoutQuery = supabase
        .from("comandas")
        .select("id, total, cliente_id, created_at, status, barbeiro_id, clientes(nome, telefone, email, observacoes), barbeiros(nome, codigo_cadeira), unidades(nome)")
        .eq("status", "aberta");

      if (selectedUnidadeId) comandasAbertasCheckoutQuery = comandasAbertasCheckoutQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) comandasAbertasCheckoutQuery = comandasAbertasCheckoutQuery.eq("barbeiro_id", barbeiroId);

      // 4. Agendamentos programados para HOJE
      let agHojeQuery = supabase
        .from("agendamentos")
        .select("id, data_hora, preco, cliente_id, servico_id, barbeiro_id, status, observacoes, clientes(nome, telefone, email, observacoes), servicos(nome, duracao_minutos, preco), barbeiros(nome, codigo_cadeira), unidades(nome)")
        .neq("status", "cancelado")
        .gte("data_hora", startOfTodayIso)
        .lte("data_hora", endOfTodayIso)
        .order("data_hora", { ascending: true });

      if (selectedUnidadeId) agHojeQuery = agHojeQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) agHojeQuery = agHojeQuery.eq("barbeiro_id", barbeiroId);

      // 5. Próximos agendamentos
      const nowIso = new Date().toISOString();
      let upcomingQuery = supabase
        .from("agendamentos")
        .select("id, data_hora, preco, cliente_id, servico_id, barbeiro_id, status, observacoes, clientes(nome, telefone, email, observacoes), servicos(nome, duracao_minutos, preco), barbeiros(nome, codigo_cadeira), unidades(nome)")
        .gte("data_hora", nowIso)
        .neq("status", "cancelado")
        .neq("status", "concluido")
        .order("data_hora", { ascending: true })
        .limit(10);

      if (selectedUnidadeId) upcomingQuery = upcomingQuery.eq("unidade_id", selectedUnidadeId);
      if (isBarber && barbeiroId) upcomingQuery = upcomingQuery.eq("barbeiro_id", barbeiroId);

      // 6. Clientes total count & clientes list
      const clientesCountQuery = supabase
        .from("clientes")
        .select("id", { count: "exact", head: true });

      const clientesListQuery = supabase
        .from("clientes")
        .select("id, nome, telefone, email, observacoes, created_at")
        .order("created_at", { ascending: false })
        .limit(300);

      const [
        resComandas,
        resAgendamentos,
        resComAbertasCheckout,
        resAgHoje,
        resUpcoming,
        resClientesCount,
        resClientesList,
      ] = await Promise.all([
        comandasQuery,
        agendamentosQuery,
        comandasAbertasCheckoutQuery,
        agHojeQuery,
        upcomingQuery,
        clientesCountQuery,
        clientesListQuery,
      ]);

      if (resComandas.error) throw resComandas.error;
      if (resAgendamentos.error) throw resAgendamentos.error;

      const todasComandas = resComandas.data || [];
      const todosAgendamentos = resAgendamentos.data || [];
      const comandasAbertasCheckout = resComAbertasCheckout.data || [];
      const agendamentosHoje = resAgHoje.data || [];
      const upcomingAppointments = resUpcoming.data || [];
      const activeClients = resClientesCount.count || 0;
      const clientesList = resClientesList.data || [];

      // Filtrar comandas fechadas no período selecionado
      const comandasFechadas = todasComandas.filter(c => c.status === "fechada" && c.fechada_em && c.fechada_em >= fromDate && c.fechada_em <= toDate);

      // Faturamento real de comandas fechadas
      const totalRevenueComandas = comandasFechadas.reduce((sum, c) => sum + Number(c.total || 0), 0);

      // Agendamentos concluídos no período sem comanda fechada
      const agConcluidosSemComanda = todosAgendamentos.filter(
        (a) => a.status === "concluido" && !comandasFechadas.some((c) => c.agendamento_id === a.id)
      );
      const totalRevenueAgendamentos = agConcluidosSemComanda.reduce((sum, a) => sum + Number(a.preco || 0), 0);

      const totalRevenue = totalRevenueComandas + totalRevenueAgendamentos;
      const totalAtendimentos = comandasFechadas.length + agConcluidosSemComanda.length;
      const ticketMedio = totalAtendimentos > 0 ? totalRevenue / totalAtendimentos : 0;

      const atendimentosHojeTotal = agendamentosHoje.length;
      const checkoutAbertoQtd = comandasAbertasCheckout.length;
      const checkoutAbertoValor = comandasAbertasCheckout.reduce((sum, c) => sum + Number(c.total || 0), 0);

      // Gráfico diário
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const revenueByDay = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");

        const dayComandas = comandasFechadas.filter((c) => {
          const dt = c.fechada_em || c.created_at;
          return dt ? format(new Date(dt), "yyyy-MM-dd") === dayStr : false;
        });

        const dayAgConcluidos = agConcluidosSemComanda.filter((a) => {
          return a.data_hora ? format(new Date(a.data_hora), "yyyy-MM-dd") === dayStr : false;
        });

        const dayRevCom = dayComandas.reduce((sum, c) => sum + Number(c.total || 0), 0);
        const dayRevAg = dayAgConcluidos.reduce((sum, a) => sum + Number(a.preco || 0), 0);

        return {
          date: format(day, "dd/MM", { locale: ptBR }),
          faturamento: dayRevCom + dayRevAg,
          atendimentos: dayComandas.length + dayAgConcluidos.length,
        };
      });

      // Apuração de Comissões via Motor 2.0 (35% Serviços/Vindi + 30% Produtos por volume de atendimentos)
      const { allBarbersCommissions, allManagersCommissions, summaries } = await calcularComissoesUnidade(fromDate, toDate, selectedUnidadeId);

      const managerCommissionTotal = allManagersCommissions.reduce((sum, m) => sum + m.comissaoTotal, 0);
      const managerCommissionEstimadaTotal = allManagersCommissions.reduce((sum, m) => sum + (m.comissaoEstimadaTotal || 0), 0);
      const barbersCommissionTotal = allBarbersCommissions.reduce((sum, b) => sum + b.comissaoTotal, 0);
      const barbersCommissionEstimadaTotal = allBarbersCommissions.reduce((sum, b) => sum + (b.comissaoEstimadaTotal || 0), 0);
      const totalProdutosUnidade = summaries.reduce((sum, s) => sum + s.totalProdutos, 0);

      let barbeirosList = allBarbersCommissions.map((b) => ({
        id: b.id,
        nome: b.nome,
        atendimentos: b.atendimentosCount,
        faturamento: b.faturamentoServicos,
        totalProdutos: b.faturamentoProdutosUnidade,
        totalServicos: b.faturamentoServicos,
        comissaoServicos: b.comissaoServicos,
        comissaoProdutosProporcional: b.comissaoProdutosProporcional,
        comissaoAssinaturasVindi: b.comissaoAssinaturasVindi,
        comissaoPerc: b.taxaServicoAplicada,
        comissaoValor: b.comissaoTotal,
        pctAtendimentos: b.pctAtendimentos,
        // Estimados
        atendimentosEstimados: b.atendimentosEstimadosCount || 0,
        faturamentoEstimado: b.faturamentoServicosEstimado || 0,
        comissaoEstimadaValor: b.comissaoEstimadaTotal || 0,
      }));

      if (isBarber && barbeiroId) {
        barbeirosList = barbeirosList.filter((b) => b.id === barbeiroId);
      }

      return {
        totalRevenue,
        totalAtendimentos,
        activeClients,
        ticketMedio,
        atendimentosHojeTotal,
        checkoutAbertoQtd,
        checkoutAbertoValor,
        upcomingAppointments,
        revenueByDay,
        barbeiros: barbeirosList,
        allBarbersCommissions,
        allManagersCommissions,
        managerCommissionTotal,
        managerCommissionEstimadaTotal,
        barbersCommissionTotal,
        barbersCommissionEstimadaTotal,
        totalProdutosUnidade,
        comandasFechadas,
        agConcluidosSemComanda,
        comandasAbertasCheckout,
        agendamentosHoje,
        clientesList,
      };
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const barbeiros = dashboardData?.barbeiros || [];

  // Filtering for Modals
  const searchLower = modalSearch.toLowerCase().trim();

  // Combined Atendimentos/Comandas list for Faturamento, Atendimentos and Ticket Médio
  const itemsAtendimentos = [
    ...(dashboardData?.comandasFechadas || []).map((c: any) => ({
      id: `comanda-${c.id}`,
      tipo: "Comanda Fechada",
      data: c.fechada_em || c.created_at,
      cliente: c.clientes?.nome || "Cliente avulso",
      telefone: c.clientes?.telefone || "",
      email: c.clientes?.email || "",
      isInfinite: c.clientes?.observacoes?.includes("VINDI_INFINITE"),
      barbeiro: c.barbeiros?.codigo_cadeira ? `Barbeiro ${c.barbeiros.codigo_cadeira} (${c.barbeiros?.nome || ''})` : (c.barbeiros?.nome || "Não informado"),
      unidade: c.unidades?.nome || "Unidade",
      valor: Number(c.total || 0),
      status: c.status || "fechada",
      raw: c,
    })),
    ...(dashboardData?.agConcluidosSemComanda || []).map((a: any) => ({
      id: `agendamento-${a.id}`,
      tipo: "Agendamento Concluído",
      servico: a.servicos?.nome || "Serviço",
      data: a.data_hora,
      cliente: a.clientes?.nome || "Cliente",
      telefone: a.clientes?.telefone || "",
      email: a.clientes?.email || "",
      isInfinite: a.clientes?.observacoes?.includes("VINDI_INFINITE"),
      barbeiro: a.barbeiros?.codigo_cadeira ? `Barbeiro ${a.barbeiros.codigo_cadeira} (${a.barbeiros?.nome || ''})` : (a.barbeiros?.nome || "Não informado"),
      unidade: a.unidades?.nome || "Unidade",
      valor: Number(a.preco || 0),
      status: a.status || "concluido",
      raw: a,
    }))
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const filteredAtendimentos = itemsAtendimentos.filter((item) => {
    if (!searchLower) return true;
    return (
      item.cliente.toLowerCase().includes(searchLower) ||
      item.barbeiro.toLowerCase().includes(searchLower) ||
      item.telefone.toLowerCase().includes(searchLower) ||
      (item.servico && item.servico.toLowerCase().includes(searchLower)) ||
      item.tipo.toLowerCase().includes(searchLower)
    );
  });

  // Clientes List
  const filteredClientes = (dashboardData?.clientesList || []).filter((c: any) => {
    if (!searchLower) return true;
    return (
      (c.nome && c.nome.toLowerCase().includes(searchLower)) ||
      (c.telefone && c.telefone.toLowerCase().includes(searchLower)) ||
      (c.email && c.email.toLowerCase().includes(searchLower)) ||
      (c.observacoes && c.observacoes.toLowerCase().includes(searchLower))
    );
  });

  // Hoje List
  const itemsHoje = (dashboardData?.agendamentosHoje || []).map((a: any) => ({
    id: a.id,
    data_hora: a.data_hora,
    cliente: a.clientes?.nome || "Cliente",
    telefone: a.clientes?.telefone || "",
    email: a.clientes?.email || "",
    isInfinite: a.clientes?.observacoes?.includes("VINDI_INFINITE"),
    servico: a.servicos?.nome || "Serviço",
    duracao: a.servicos?.duracao_minutos,
    barbeiro: a.barbeiros?.codigo_cadeira ? `Barbeiro ${a.barbeiros.codigo_cadeira}` : (a.barbeiros?.nome || "Profissional"),
    barbeiroNome: a.barbeiros?.nome,
    preco: Number(a.preco || a.servicos?.preco || 0),
    status: a.status,
    unidade: a.unidades?.nome,
    raw: a,
  })).filter((a: any) => {
    if (!searchLower) return true;
    return (
      a.cliente.toLowerCase().includes(searchLower) ||
      a.barbeiro.toLowerCase().includes(searchLower) ||
      (a.barbeiroNome && a.barbeiroNome.toLowerCase().includes(searchLower)) ||
      a.servico.toLowerCase().includes(searchLower) ||
      a.telefone.toLowerCase().includes(searchLower)
    );
  }).sort((a: any, b: any) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  // Comandas Abertas List
  const itemsComandasAbertas = (dashboardData?.comandasAbertasCheckout || []).map((c: any) => ({
    id: c.id,
    created_at: c.created_at,
    cliente: c.clientes?.nome || "Cliente avulso",
    telefone: c.clientes?.telefone || "",
    email: c.clientes?.email || "",
    isInfinite: c.clientes?.observacoes?.includes("VINDI_INFINITE"),
    barbeiro: c.barbeiros?.codigo_cadeira ? `Barbeiro ${c.barbeiros.codigo_cadeira}` : (c.barbeiros?.nome || "Profissional"),
    barbeiroNome: c.barbeiros?.nome,
    total: Number(c.total || 0),
    unidade: c.unidades?.nome,
    raw: c,
  })).filter((c: any) => {
    if (!searchLower) return true;
    return (
      c.cliente.toLowerCase().includes(searchLower) ||
      c.barbeiro.toLowerCase().includes(searchLower) ||
      (c.barbeiroNome && c.barbeiroNome.toLowerCase().includes(searchLower)) ||
      c.telefone.toLowerCase().includes(searchLower)
    );
  }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getModalConfig = () => {
    switch (modalMetrica) {
      case "faturamento":
        return {
          title: "Detalhamento: Faturamento Real (Liquidado)",
          subtitle: "Comandas fechadas e agendamentos liquidados no período",
          icon: DollarSign,
          color: "text-emerald-400",
          badgeBg: "bg-emerald-950/60 text-emerald-400 border-emerald-500/40",
        };
      case "atendimentos":
        return {
          title: "Detalhamento: Atendimentos Concluídos",
          subtitle: "Lista de todos os atendimentos finalizados no período",
          icon: Scissors,
          color: "text-red-400",
          badgeBg: "bg-red-950/60 text-red-400 border-red-500/40",
        };
      case "clientes":
        return {
          title: "Detalhamento: Base de Clientes Cadastrados",
          subtitle: "Todos os clientes ativos e cadastrados no sistema",
          icon: Users,
          color: "text-blue-400",
          badgeBg: "bg-blue-950/60 text-blue-400 border-blue-500/40",
        };
      case "ticket":
        return {
          title: "Detalhamento: Ticket Médio por Atendimento",
          subtitle: "Análise de valor individual por atendimento concluído",
          icon: TrendingUp,
          color: "text-amber-400",
          badgeBg: "bg-amber-950/60 text-amber-400 border-amber-500/40",
        };
      case "hoje":
        return {
          title: "Detalhamento: Agendamentos de Hoje",
          subtitle: "Todos os agendamentos previstos para a data de hoje",
          icon: Calendar,
          color: "text-red-500",
          badgeBg: "bg-red-950/60 text-red-400 border-red-500/40",
        };
      case "comandas_abertas":
        return {
          title: "Detalhamento: Comandas em Aberto (Checkout)",
          subtitle: "Comandas atualmente aguardando fechamento no caixa",
          icon: ShoppingBag,
          color: "text-amber-500",
          badgeBg: "bg-amber-950/60 text-amber-400 border-amber-500/40",
        };
      case "comissao":
        return {
          title: "Detalhamento: Comissão Estimada do Período",
          subtitle: "Apuração automatizada do Motor 2.0 (20% Gestor sobre produtos e 35% Serviços/Vindi + 30% Bolo de Produtos)",
          icon: Percent,
          color: "text-red-400",
          badgeBg: "bg-red-950/60 text-red-400 border-red-500/40",
        };
      default:
        return null;
    }
  };

  const modalConfig = getModalConfig();

  if (roleLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        <p className="text-xs text-muted-foreground font-medium">Carregando perfil e permissões da agenda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Acompanhe o desempenho geral da sua barbearia em tempo real."
      >
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </PageHeader>

      {/* Metric Cards - Período Selecionado */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Métricas do Período Selecionado
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Faturamento Real (Liquidado)"
            value={formatCurrency(dashboardData?.totalRevenue || 0)}
            change={
              (dashboardData?.checkoutAbertoValor || 0) > 0 ? (
                <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                  <Clock className="h-3 w-3 shrink-0" />
                  Pendente: {formatCurrency(dashboardData.checkoutAbertoValor)}
                </span>
              ) : (
                "Comandas fechadas no período"
              )
            }
            changeType="positive"
            icon={DollarSign}
            loading={isLoading}
            onClick={() => { setModalMetrica("faturamento"); setModalSearch(""); }}
          />
          <StatCard
            title="Atendimentos Concluídos"
            value={dashboardData?.totalAtendimentos || 0}
            change="Finalizados no período"
            changeType="positive"
            icon={Scissors}
            loading={isLoading}
            onClick={() => { setModalMetrica("atendimentos"); setModalSearch(""); }}
          />
          <StatCard
            title="Comissão Estimada do Mês"
            value={
              isBarber
                ? formatCurrency(barbeiros[0]?.comissaoEstimadaValor || 0)
                : formatCurrency(dashboardData?.managerCommissionEstimadaTotal || 0)
            }
            change={
              isBarber
                ? `(Liquidado: ${formatCurrency(barbeiros[0]?.comissaoValor || 0)})`
                : `20% s/ prod. (Equipe Est: ${formatCurrency(dashboardData?.barbersCommissionEstimadaTotal || 0)})`
            }
            changeType="positive"
            icon={Percent}
            loading={isLoading}
            onClick={() => { setModalMetrica("comissao"); setModalSearch(""); }}
          />
          <StatCard
            title="Ticket Médio"
            value={formatCurrency(dashboardData?.ticketMedio || 0)}
            change="Por atendimento concluído"
            changeType="positive"
            icon={TrendingUp}
            loading={isLoading}
            onClick={() => { setModalMetrica("ticket"); setModalSearch(""); }}
          />
        </div>
      </div>

      {/* Painel Operacional em Tempo Real (Checkout & Agenda Hoje) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Painel Operacional em Tempo Real (Agora)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            onClick={() => { setModalMetrica("hoje"); setModalSearch(""); }}
            className="panel border-primary/20 bg-primary/[0.03] cursor-pointer hover:border-red-500/50 hover:bg-red-950/20 hover:scale-[1.01] active:scale-[0.99] transition-all group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-red-400 transition-colors">
                  Atendimentos de Hoje
                </span>
                <div className="text-2xl font-black text-foreground">
                  {dashboardData?.atendimentosHojeTotal || 0}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Agendados para serem realizados hoje
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-red-500/20 group-hover:text-red-400 transition-colors">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-red-400 font-bold transition-colors">
              <span>Ver Agendamentos de Hoje</span>
              <span>→</span>
            </div>
          </div>

          <div
            onClick={() => { setModalMetrica("comandas_abertas"); setModalSearch(""); }}
            className="panel border-warning/30 bg-warning/[0.03] cursor-pointer hover:border-amber-500/50 hover:bg-amber-950/20 hover:scale-[1.01] active:scale-[0.99] transition-all group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-warning uppercase tracking-wider flex items-center gap-1.5 group-hover:text-amber-400 transition-colors">
                  <AlertCircle className="h-3.5 w-3.5" /> Comandas em Aberto (Checkout)
                </span>
                <div className="text-2xl font-black text-warning">
                  {dashboardData?.checkoutAbertoQtd || 0}{" "}
                  <span className="text-xs font-medium text-muted-foreground">comandas</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pendentes de fechamento no caixa
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-center text-warning group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                <ShoppingBag className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-amber-400 font-bold transition-colors">
              <span>Ver Comandas em Aberto</span>
              <span>→</span>
            </div>
          </div>

          <div
            onClick={() => { setModalMetrica("comandas_abertas"); setModalSearch(""); }}
            className="panel border-warning/30 bg-warning/[0.03] cursor-pointer hover:border-amber-500/50 hover:bg-amber-950/20 hover:scale-[1.01] active:scale-[0.99] transition-all group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-warning uppercase tracking-wider group-hover:text-amber-400 transition-colors">
                  Valor Pendente no Checkout
                </span>
                <div className="text-2xl font-black text-foreground">
                  {formatCurrency(dashboardData?.checkoutAbertoValor || 0)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Total acumulado a receber no momento
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-center text-warning group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-amber-400 font-bold transition-colors">
              <span>Ir para o Checkout</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Faturamento Diário Chart */}
        <div className="panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Faturamento Diário</h2>
              <p className="text-xs text-muted-foreground">Evolução da receita por dia</p>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="h-[220px]">
            {dashboardData?.revenueByDay?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.revenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [formatCurrency(value), "Faturamento"]} />
                  <Area type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorFaturamento)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados no período</div>
            )}
          </div>
        </div>

        {/* Atendimentos por Dia Chart */}
        <div className="panel">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Atendimentos por Dia</h2>
              <p className="text-xs text-muted-foreground">Volume de clientes atendidos</p>
            </div>
            <Scissors className="h-4 w-4 text-primary" />
          </div>
          <div className="h-[220px]">
            {dashboardData?.revenueByDay?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.revenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [value, "Atendimentos"]} />
                  <Bar dataKey="atendimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Sem dados no período</div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Próximos Agendamentos */}
        <div className="lg:col-span-2 panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground">Próximos Agendamentos</h2>
            <span className="text-[11px] text-muted-foreground font-medium">Clique em um agendamento para ver detalhes</span>
          </div>

          <div className="space-y-3">
            {(!dashboardData?.upcomingAppointments || dashboardData?.upcomingAppointments?.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento próximo</p>
            )}
            {dashboardData?.upcomingAppointments?.map((item: any) => (
              <div
                key={item.id}
                onClick={() => setSelectedAppointment(item)}
                className="flex items-center gap-4 p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-red-500/50 hover:bg-red-950/20 transition-all cursor-pointer group shadow-sm"
              >
                {/* Data e Hora */}
                <div className="flex flex-col min-w-[100px] border-r border-zinc-800/60 pr-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-500 font-mono">
                    <Calendar className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span>{format(new Date(item.data_hora), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold font-mono mt-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>{format(new Date(item.data_hora), "HH:mm", { locale: ptBR })}h</span>
                  </div>
                </div>

                {/* Cliente e Serviço */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-100 group-hover:text-red-400 transition-colors truncate">
                      {item.clientes?.nome || "Cliente"}
                    </p>
                    {item.clientes?.observacoes?.includes("VINDI_INFINITE") && (
                      <Badge className="bg-red-950/50 text-red-400 border-red-500/40 text-[9px] font-bold">
                        👑 INFINITE
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{item.servicos?.nome || "Serviço"}</p>
                </div>

                {/* Barbeiro / Cadeira */}
                {!isBarber && (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                        <Scissors className="h-3.5 w-3.5 text-red-500" />
                        {item.barbeiros?.codigo_cadeira ? `Barbeiro ${item.barbeiros.codigo_cadeira}` : item.barbeiros?.nome || "Profissional"}
                      </div>
                      <span className="text-[10px] text-zinc-400 block">{item.barbeiros?.nome}</span>
                    </div>
                  </div>
                )}

                <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Barbeiros / Comissão */}
        <div className="panel">
          <h2 className="text-sm font-bold text-foreground mb-4">
            {isBarber ? "Minha Comissão" : "Profissionais - Comissão"}
          </h2>
          <div className="space-y-3">
            {!isBarber && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-zinc-900/60 to-zinc-900/60 border border-amber-500/40 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 font-mono border border-amber-500/40">
                      G
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        Comissão Gestor da Filial
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        20% sobre Faturamento de Produtos da Filial
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-950/60 text-amber-400 border-amber-500/40 font-mono text-[9px]">
                    GESTOR 20%
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-amber-500/20 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-medium">Comissão Efetivada</span>
                    <span className="font-extrabold text-zinc-200 font-mono">
                      {formatCurrency(dashboardData?.managerCommissionTotal || 0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-amber-400/90 block font-medium">Comissão Estimada (Aberto)</span>
                    <span className="font-extrabold text-amber-400 font-mono text-sm">
                      {formatCurrency(dashboardData?.managerCommissionEstimadaTotal || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {barbeiros?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum profissional cadastrado</p>
            )}
            {barbeiros?.map((barber: any) => (
              <div key={barber.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-950/60 to-red-900/30 flex items-center justify-center text-sm font-bold text-foreground font-mono border border-red-500/30">
                  {barber.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{barber.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {barber.atendimentos} conc. • Fat: {formatCurrency(barber.faturamento)}
                  </p>
                  <p className="text-[10px] text-amber-400 font-bold mt-0.5">
                    Est: {barber.atendimentosEstimados} agend. ({formatCurrency(barber.faturamentoEstimado)})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-red-500">{formatCurrency(barber.comissaoValor)}</p>
                  <p className="text-[11px] font-extrabold text-amber-400">
                    Est: {formatCurrency(barber.comissaoEstimadaValor)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Agendamento */}
      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="border-b border-zinc-800 pb-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-red-950/60 text-red-400 border-red-500/40 font-mono text-[10px]">
                👑 DETALHES DO AGENDAMENTO
              </Badge>
              <Badge variant="outline" className="border-zinc-800 text-zinc-300 font-mono text-[10px] uppercase">
                {selectedAppointment?.status || "AGENDADO"}
              </Badge>
            </div>
            <DialogTitle className="text-base font-bold text-zinc-100 mt-2 flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-red-500" />
              {selectedAppointment?.data_hora
                ? format(new Date(selectedAppointment.data_hora), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Cliente Info */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-blue-400" /> Cliente
                  </span>
                  {selectedAppointment.clientes?.observacoes?.includes("VINDI_INFINITE") && (
                    <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[10px]">
                      👑 Assinante Infinite
                    </Badge>
                  )}
                </div>
                <div className="font-bold text-sm text-zinc-100">{selectedAppointment.clientes?.nome || "Cliente"}</div>
                {selectedAppointment.clientes?.telefone && (
                  <div className="text-zinc-400 flex items-center gap-1.5 font-mono">
                    <Phone className="h-3 w-3 text-emerald-400" /> {selectedAppointment.clientes.telefone}
                  </div>
                )}
                {selectedAppointment.clientes?.email && (
                  <div className="text-zinc-400 flex items-center gap-1.5 font-mono">
                    <Mail className="h-3 w-3 text-purple-400" /> {selectedAppointment.clientes.email}
                  </div>
                )}
              </div>

              {/* Serviço & Profissional */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                  <span className="font-semibold text-zinc-400 flex items-center gap-1">
                    <Scissors className="h-3.5 w-3.5 text-red-500" /> Serviço
                  </span>
                  <div className="font-bold text-zinc-100">{selectedAppointment.servicos?.nome || "Serviço"}</div>
                  <div className="text-emerald-400 font-mono font-bold">
                    R$ {Number(selectedAppointment.preco || selectedAppointment.servicos?.preco || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
                  <span className="font-semibold text-zinc-400 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-emerald-400" /> Barbeiro / Cadeira
                  </span>
                  <div className="font-bold text-zinc-100">
                    {selectedAppointment.barbeiros?.codigo_cadeira
                      ? `Barbeiro ${selectedAppointment.barbeiros.codigo_cadeira}`
                      : selectedAppointment.barbeiros?.nome || "Profissional"}
                  </div>
                  {selectedAppointment.barbeiros?.nome && (
                    <div className="text-zinc-400 text-[11px] truncate">{selectedAppointment.barbeiros.nome}</div>
                  )}
                </div>
              </div>

              {/* Unidade */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
                <span className="font-semibold text-zinc-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-red-400" /> Unidade
                </span>
                <span className="font-bold text-zinc-100">{selectedAppointment.unidades?.nome || "Unidade"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Lista de Detalhes da Métrica Selecionada */}
      <Dialog open={!!modalMetrica} onOpenChange={(open) => !open && setModalMetrica(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-4xl max-h-[85vh] flex flex-col p-6 rounded-2xl shadow-2xl overflow-hidden">
          {modalConfig && (
            <>
              <DialogHeader className="border-b border-zinc-800 pb-4 shrink-0">
                <div className="flex items-center justify-between">
                  <Badge className={`${modalConfig.badgeBg} font-mono text-[10px] tracking-wider uppercase`}>
                    RELATÓRIO DETALHADO
                  </Badge>
                  {modalMetrica === "comandas_abertas" && (
                    <Button
                      size="sm"
                      onClick={() => { setModalMetrica(null); navigate("/checkout"); }}
                      className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs h-7 gap-1 mr-6"
                    >
                      Ir para Caixa <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <DialogTitle className="text-lg font-extrabold text-zinc-100 mt-2 flex items-center gap-2">
                  <modalConfig.icon className={`h-5 w-5 ${modalConfig.color}`} />
                  {modalConfig.title}
                </DialogTitle>
                <p className="text-xs text-zinc-400">{modalConfig.subtitle}</p>

                {/* Input de Busca */}
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Filtrar por cliente, barbeiro, serviço ou telefone..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="pl-9 bg-zinc-900/90 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-red-500/50 text-xs h-9 rounded-xl"
                  />
                </div>
              </DialogHeader>

              {/* KPIs de Resumo dentro do Modal */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3 shrink-0">
                {(modalMetrica === "faturamento" || modalMetrica === "atendimentos" || modalMetrica === "ticket") && (
                  <>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Liquidado</span>
                      <span className="text-base font-extrabold text-emerald-400">{formatCurrency(dashboardData?.totalRevenue || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Atendimentos</span>
                      <span className="text-base font-extrabold text-zinc-100">{dashboardData?.totalAtendimentos || 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Ticket Médio</span>
                      <span className="text-base font-extrabold text-amber-400">{formatCurrency(dashboardData?.ticketMedio || 0)}</span>
                    </div>
                  </>
                )}

                {modalMetrica === "clientes" && (
                  <>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Cadastrados</span>
                      <span className="text-base font-extrabold text-blue-400">{dashboardData?.activeClients || 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Exibindo</span>
                      <span className="text-base font-extrabold text-zinc-100">{filteredClientes.length} clientes</span>
                    </div>
                  </>
                )}

                {modalMetrica === "hoje" && (
                  <>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Agendados Hoje</span>
                      <span className="text-base font-extrabold text-red-400">{dashboardData?.atendimentosHojeTotal || 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Exibindo</span>
                      <span className="text-base font-extrabold text-zinc-100">{itemsHoje.length} horários</span>
                    </div>
                  </>
                )}

                {modalMetrica === "comandas_abertas" && (
                  <>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Comandas em Aberto</span>
                      <span className="text-base font-extrabold text-amber-400">{dashboardData?.checkoutAbertoQtd || 0}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase block">Valor Pendente</span>
                      <span className="text-base font-extrabold text-amber-300">{formatCurrency(dashboardData?.checkoutAbertoValor || 0)}</span>
                    </div>
                  </>
                )}

                {modalMetrica === "comissao" && (
                  <>
                    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
                      <span className="text-[10px] font-bold text-amber-400 uppercase block">Comissão Gestor (20% Prod)</span>
                      <span className="text-base font-extrabold text-amber-400">{formatCurrency(dashboardData?.managerCommissionTotal || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <span className="text-[10px] font-bold text-red-400 uppercase block">Comissão Barbeiros (Equipe)</span>
                      <span className="text-base font-extrabold text-red-400">{formatCurrency(dashboardData?.barbersCommissionTotal || 0)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase block">Total Geral Comissões</span>
                      <span className="text-base font-extrabold text-emerald-400">{formatCurrency((dashboardData?.managerCommissionTotal || 0) + (dashboardData?.barbersCommissionTotal || 0))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Tabela/Lista */}
              <div className="flex-1 overflow-y-auto pr-1 border border-zinc-800/80 rounded-xl bg-zinc-900/30">
                {(modalMetrica === "faturamento" || modalMetrica === "atendimentos" || modalMetrica === "ticket") && (
                  <Table>
                    <TableHeader className="bg-zinc-900/80 sticky top-0 backdrop-blur-md">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs font-bold">Data & Hora</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Cliente</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Barbeiro / Cadeira</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Origem / Serviço</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold text-right">Valor Efetivado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAtendimentos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                            Nenhum registro encontrado no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAtendimentos.map((item) => (
                          <TableRow key={item.id} className="border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                            <TableCell className="font-mono text-xs text-zinc-300">
                              {item.data ? format(new Date(item.data), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "--"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-zinc-100">{item.cliente}</span>
                                {item.isInfinite && (
                                  <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[8px]">👑 Infinite</Badge>
                                )}
                              </div>
                              {item.telefone && (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono mt-0.5">
                                  <Phone className="h-2.5 w-2.5 text-emerald-400" /> {item.telefone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300 font-medium">
                              {item.barbeiro}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-[10px] font-mono">
                                {item.servico || item.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-400 text-xs">
                              {formatCurrency(item.valor)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                {modalMetrica === "clientes" && (
                  <Table>
                    <TableHeader className="bg-zinc-900/80 sticky top-0 backdrop-blur-md">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs font-bold">Data Cadastro</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Nome</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Telefone / WhatsApp</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">E-mail</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Observações / Tag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                            Nenhum cliente encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClientes.map((c: any) => (
                          <TableRow key={c.id} className="border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                            <TableCell className="font-mono text-xs text-zinc-400">
                              {c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR }) : "--"}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-zinc-100">
                              {c.nome || "Sem Nome"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              {c.telefone || "--"}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-400 truncate max-w-[150px]">
                              {c.email || "--"}
                            </TableCell>
                            <TableCell>
                              {c.observacoes?.includes("VINDI_INFINITE") ? (
                                <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[9px]">👑 Infinite Subscriber</Badge>
                              ) : (
                                <span className="text-[11px] text-zinc-500 truncate max-w-[120px] block">{c.observacoes || "--"}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                {modalMetrica === "hoje" && (
                  <Table>
                    <TableHeader className="bg-zinc-900/80 sticky top-0 backdrop-blur-md">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs font-bold">Horário</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Cliente</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Serviço</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Barbeiro / Cadeira</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Status</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsHoje.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-zinc-500 text-xs">
                            Nenhum agendamento para hoje.
                          </TableCell>
                        </TableRow>
                      ) : (
                        itemsHoje.map((item: any) => (
                          <TableRow key={item.id} className="border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-red-400">
                              {item.data_hora ? format(new Date(item.data_hora), "HH:mm", { locale: ptBR }) : "--"}h
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-zinc-100">{item.cliente}</span>
                                {item.isInfinite && (
                                  <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[8px]">👑 Infinite</Badge>
                                )}
                              </div>
                              {item.telefone && (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono mt-0.5">
                                  <Phone className="h-2.5 w-2.5 text-emerald-400" /> {item.telefone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300">
                              {item.servico}
                              {item.duracao && <span className="text-[10px] text-zinc-500 block">{item.duracao} min</span>}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300">
                              {item.barbeiro}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-[9px] uppercase">
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setModalMetrica(null);
                                  setSelectedAppointment(item.raw);
                                }}
                                className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                              >
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                {modalMetrica === "comandas_abertas" && (
                  <Table>
                    <TableHeader className="bg-zinc-900/80 sticky top-0 backdrop-blur-md">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs font-bold">Abertura</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Cliente</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Barbeiro / Cadeira</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Valor Acumulado</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsComandasAbertas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                            Nenhuma comanda aberta no checkout no momento.
                          </TableCell>
                        </TableRow>
                      ) : (
                        itemsComandasAbertas.map((item: any) => (
                          <TableRow key={item.id} className="border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                            <TableCell className="font-mono text-xs text-zinc-300">
                              {item.created_at ? format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR }) : "--"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-zinc-100">{item.cliente}</span>
                                {item.isInfinite && (
                                  <Badge className="bg-red-950/60 text-red-400 border-red-500/40 text-[8px]">👑 Infinite</Badge>
                                )}
                              </div>
                              {item.telefone && (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono mt-0.5">
                                  <Phone className="h-2.5 w-2.5 text-emerald-400" /> {item.telefone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300">
                              {item.barbeiro}
                            </TableCell>
                            <TableCell className="font-mono font-extrabold text-amber-400 text-xs">
                              {formatCurrency(item.total)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setModalMetrica(null);
                                  navigate("/checkout");
                                }}
                                className="h-7 text-xs bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold gap-1"
                              >
                                Abrir Caixa <ChevronRight className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                {modalMetrica === "comissao" && (
                  <Table>
                    <TableHeader className="bg-zinc-900/80 sticky top-0 backdrop-blur-md">
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs font-bold">Profissional / Função</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Atendimentos (% Volume)</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">Fat. Serviços</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">35% Serv/Vindi</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold">30% Pool Prod</TableHead>
                        <TableHead className="text-zinc-400 text-xs font-bold text-right">Comissão Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!dashboardData?.allBarbersCommissions || dashboardData.allBarbersCommissions.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-zinc-500 text-xs">
                            Nenhum registro de comissão encontrado para o período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dashboardData.allBarbersCommissions.map((b: any) => (
                          <TableRow key={b.id} className="border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
                            <TableCell className="font-bold text-xs text-zinc-100">
                              {b.nome}
                            </TableCell>
                            <TableCell className="text-xs text-zinc-300 font-mono">
                              {b.atendimentosCount} atend. ({(b.pctAtendimentos * 100).toFixed(1)}%)
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-400">
                              {formatCurrency(b.faturamentoServicos)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-red-400">
                              {formatCurrency(b.comissaoServicos + (b.comissaoAssinaturasVindi || 0))}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              {formatCurrency(b.comissaoProdutosProporcional)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-extrabold text-red-500 text-xs">
                              {formatCurrency(b.comissaoTotal)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
