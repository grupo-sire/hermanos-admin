import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Receipt, Search, Eye, Loader2, CreditCard, Banknote, QrCode, Wallet, ShoppingBag, DollarSign, Calendar as CalendarIcon, Filter, X, DateRange, FileText, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComandaDialog } from "@/components/checkout/ComandaDialog";
import { VendaManualDialog } from "@/components/checkout/VendaManualDialog";
import { CaixaFisicoPainel } from "@/components/checkout/CaixaFisicoPainel";
import { FechamentoCaixaDialog } from "@/components/checkout/FechamentoCaixaDialog";
import { AberturaCaixaDialog } from "@/components/checkout/AberturaCaixaDialog";
import { HistoricoCaixasDialog } from "@/components/checkout/HistoricoCaixasDialog";
import { getCaixaSessao } from "@/services/caixaService";
import { CaixaSessao } from "@/types/caixa";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sun, LockOpen, History } from "lucide-react";

type Comanda = {
  id: string;
  agendamento_id: string | null;
  cliente_id: string;
  barbeiro_id: string | null;
  unidade_id: string | null;
  status: string;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: string | null;
  created_at: string;
  fechada_em: string | null;
  clientes?: { nome: string; telefone: string };
  barbeiros?: { nome: string } | null;
  unidades?: { nome: string } | null;
};

export default function Checkout() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("aberta");
  const [dateFilterType, setDateFilterType] = useState<string>("hoje");

  // Estados do Seletor Avançado de Data (Dia Unico vs Período)
  const [dateSelectionMode, setDateSelectionMode] = useState<"single" | "range">("single");
  const [selectedSingleDate, setSelectedSingleDate] = useState<Date | undefined>(undefined);
  const [selectedDateRange, setSelectedDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [selectedComanda, setSelectedComanda] = useState<Comanda | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vendaManualOpen, setVendaManualOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const [aberturaOpen, setAberturaOpen] = useState(false);
    const [historicoOpen, setHistoricoOpen] = useState(false);

  const [caixaSessao, setCaixaSessao] = useState<CaixaSessao | null>(null);
  const { isBarber, barbeiroId } = useUserRole();
  const { selectedUnidadeId } = useUnidade();

  useEffect(() => {
    fetchComandas();
  }, [statusFilter, dateFilterType, selectedSingleDate, selectedDateRange, isBarber, barbeiroId]);

  async function fetchComandas() {
    setLoading(true);
    try {
      let query = supabase
        .from("comandas")
        .select(`*, clientes (nome, telefone), barbeiros (nome), unidades (nome)`)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Aplicar Filtro de Data
      const now = new Date();
      if (dateFilterType === "custom_single" && selectedSingleDate) {
        query = query
          .gte("created_at", startOfDay(selectedSingleDate).toISOString())
          .lte("created_at", endOfDay(selectedSingleDate).toISOString());
      } else if (dateFilterType === "custom_range" && selectedDateRange.from) {
        const startDate = startOfDay(selectedDateRange.from);
        const endDate = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
        query = query.gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
      } else if (dateFilterType === "hoje") {
        query = query.gte("created_at", startOfDay(now).toISOString()).lte("created_at", endOfDay(now).toISOString());
      } else if (dateFilterType === "ontem") {
        const yesterday = subDays(now, 1);
        query = query.gte("created_at", startOfDay(yesterday).toISOString()).lte("created_at", endOfDay(yesterday).toISOString());
      } else if (dateFilterType === "7dias") {
        query = query.gte("created_at", startOfDay(subDays(now, 7)).toISOString());
      } else if (dateFilterType === "mes") {
        query = query.gte("created_at", startOfMonth(now).toISOString());
      }

      if (isBarber && barbeiroId) {
        query = query.eq("barbeiro_id", barbeiroId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setComandas(data || []);

      // Atualizar status da sessão de caixa
      setCaixaSessao(getCaixaSessao(selectedUnidadeId));
    } catch (error) {
      console.error("Erro ao carregar comandas:", error);
      toast.error("Erro ao carregar comandas");
    } finally {
      setLoading(false);
    }
  }

  const filteredComandas = comandas.filter(
    (c) =>
      c.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      aberta: { label: "Aberta", variant: "default" },
      fechada: { label: "Fechada", variant: "secondary" },
      cancelada: { label: "Cancelada", variant: "destructive" },
    };
    const c = config[status] || { label: status, variant: "secondary" };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getFormaPagamentoIcon = (forma: string | null) => {
    const icons: Record<string, React.ReactNode> = {
      dinheiro: <Banknote className="h-4 w-4 text-emerald-500" />,
      pix: <QrCode className="h-4 w-4 text-cyan-500" />,
      credito: <CreditCard className="h-4 w-4 text-blue-500" />,
      debito: <Wallet className="h-4 w-4 text-indigo-500" />,
    };
    return forma ? icons[forma] || null : null;
  };

  const comandasAbertas = comandas.filter((c) => c.status === "aberta").length;

  const getDateDisplayLabel = () => {
    if (dateFilterType === "custom_single" && selectedSingleDate) {
      return `Dia ${format(selectedSingleDate, "dd/MM/yyyy")}`;
    }
    if (dateFilterType === "custom_range" && selectedDateRange.from) {
      const fromStr = format(selectedDateRange.from, "dd/MM/yyyy");
      const toStr = selectedDateRange.to ? format(selectedDateRange.to, "dd/MM/yyyy") : fromStr;
      return `${fromStr} até ${toStr}`;
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Checkout & Caixa" description={isBarber ? "Suas comandas" : "Gerencie as comandas de atendimento e o caixa físico da unidade"}>
        {!isBarber && (
          <div className="flex flex-wrap items-center gap-2">
            {!caixaSessao ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                onClick={() => setAberturaOpen(true)}
              >
                <Sun className="h-4 w-4 mr-1 text-amber-300 animate-pulse" />
                Abrir Caixa do Dia
              </Button>
            ) : caixaSessao.status === "fechado" ? (
              <Badge variant="outline" className="h-9 px-3 border-destructive/40 bg-destructive/10 text-destructive font-bold text-xs flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Caixa de Hoje Fechado
              </Badge>
            ) : (
              <Button
                className="btn-wine text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                onClick={() => setFechamentoOpen(true)}
              >
                <FileText className="h-4 w-4 mr-1 text-amber-300" />
                Fechar Caixa do Dia (2FA)
              </Button>
            )}

            <Button
              variant="outline"
              className="border-border hover:bg-muted text-foreground font-bold text-xs"
              onClick={() => setVendaManualOpen(true)}
            >
              <ShoppingBag className="h-4 w-4 mr-1.5" />
              Venda Manual de Balcão
            </Button>

            <Button
              variant="outline"
              className="btn-soft font-bold text-xs"
              onClick={() => setHistoricoOpen(true)}
            >
              <History className="h-4 w-4 mr-1.5" />
              Histórico de Caixas
            </Button>
          </div>
        )}
      </PageHeader>

      <Tabs defaultValue="comandas" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList className="bg-muted/40 p-1 border border-border flex w-full sm:w-auto">
            <TabsTrigger value="comandas" className="gap-2 text-xs font-bold flex-1">
              <Receipt className="h-4 w-4 text-red-500" />
              Comandas de Atendimento ({comandasAbertas} abertas)
            </TabsTrigger>
            {!isBarber && (
              <TabsTrigger value="caixa" className="gap-2 text-xs font-bold flex-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Caixa Físico & Extrato da Filial
              </TabsTrigger>
            )}
          </TabsList>

          {/* BARRA DE FILTRO DE DATA COM SUPORTE A DIA ÚNICO E PERÍODO */}
          <div className="flex flex-wrap items-center gap-2 bg-card p-1.5 rounded-xl border border-border shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-4 w-4 text-red-600 dark:text-red-400 ml-1.5" />
              <span className="text-xs font-bold text-foreground mr-1">Filtrar Data:</span>
            </div>

            <Select
              value={dateFilterType}
              onValueChange={(val) => {
                setDateFilterType(val);
                if (val !== "custom_single" && val !== "custom_range") {
                  setSelectedSingleDate(undefined);
                  setSelectedDateRange({});
                } else if (val === "custom_single") {
                  setDateSelectionMode("single");
                  setCalendarOpen(true);
                } else if (val === "custom_range") {
                  setDateSelectionMode("range");
                  setCalendarOpen(true);
                }
              }}
            >
              <SelectTrigger className="w-40 bg-background text-foreground border-border text-xs h-8 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="ontem">Ontem</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="custom_single">📅 Dia Específico...</SelectItem>
                <SelectItem value="custom_range">📆 Período (De / Até)...</SelectItem>
                <SelectItem value="all">Todas as Datas</SelectItem>
              </SelectContent>
            </Select>

            {/* SELETOR DE CALENDÁRIO POPOVER (DIA ÚNICO vs PERÍODO) */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-red-600/40 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20">
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {getDateDisplayLabel() || "Abrir Calendário..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 bg-background border border-border shadow-2xl rounded-2xl" align="end">
                <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
                  <span className="text-xs font-bold text-foreground">Modo de Seleção:</span>
                  <div className="flex rounded-lg bg-muted p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => { setDateSelectionMode("single"); setDateFilterType("custom_single"); }}
                      className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all", dateSelectionMode === "single" ? "bg-red-600 text-white shadow" : "text-muted-foreground")}
                    >
                      Dia Único
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDateSelectionMode("range"); setDateFilterType("custom_range"); }}
                      className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all", dateSelectionMode === "range" ? "bg-red-600 text-white shadow" : "text-muted-foreground")}
                    >
                      Período (De/Até)
                    </button>
                  </div>
                </div>

                {dateSelectionMode === "single" ? (
                  <Calendar
                    mode="single"
                    selected={selectedSingleDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedSingleDate(date);
                        setDateFilterType("custom_single");
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                ) : (
                  <Calendar
                    mode="range"
                    selected={selectedDateRange as any}
                    onSelect={(range: any) => {
                      if (range) {
                        setSelectedDateRange(range);
                        setDateFilterType("custom_range");
                        if (range.from && range.to) setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                )}
              </PopoverContent>
            </Popover>

            {(selectedSingleDate || selectedDateRange.from) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedSingleDate(undefined);
                  setSelectedDateRange({});
                  setDateFilterType("hoje");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Aba Comandas */}
        <TabsContent value="comandas" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou código da comanda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background text-foreground border-input text-xs h-9 font-semibold"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36 bg-background text-foreground border-input text-xs h-9 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Abertas</SelectItem>
                  <SelectItem value="fechada">Fechadas</SelectItem>
                  <SelectItem value="all">Todas os Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="text-xs font-bold text-foreground">Comanda</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Data / Hora</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Barbeiro</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground">Total</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Pagamento</TableHead>
                  <TableHead className="text-xs font-bold text-center text-foreground">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComandas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground font-semibold">
                      Nenhuma comanda encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComandas.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono font-bold text-foreground">#{c.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy HH:mm") : "--"}</TableCell>
                      <TableCell className="text-xs font-bold text-foreground">{c.clientes?.nome || "Cliente avulso"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{c.barbeiros?.nome || "--"}</TableCell>
                      <TableCell className="text-xs text-right font-black text-emerald-600 dark:text-emerald-400">R$ {Number(c.total).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize font-medium">
                        <span className="flex items-center gap-1.5">
                          {getFormaPagamentoIcon(c.forma_pagamento)}
                          {c.forma_pagamento || "--"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-center">{getStatusBadge(c.status)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedComanda(c); setDialogOpen(true); }}
                          className="text-xs h-7 border-border font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Abrir Comanda
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Aba Caixa Fisico */}
        {!isBarber && (
          <TabsContent value="caixa">
            <CaixaFisicoPainel
              dateFilterType={dateFilterType}
              customStartDate={selectedSingleDate || selectedDateRange.from}
              customEndDate={selectedDateRange.to}
            />
          </TabsContent>
        )}
      </Tabs>

      <ComandaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        comanda={selectedComanda}
        onSuccess={fetchComandas}
      />

      <VendaManualDialog
        open={vendaManualOpen}
        onOpenChange={setVendaManualOpen}
        onSuccess={fetchComandas}
      />

      <FechamentoCaixaDialog
        open={fechamentoOpen}
        onOpenChange={setFechamentoOpen}
        onSuccess={fetchComandas}
      />

      <AberturaCaixaDialog
        open={aberturaOpen}
        onOpenChange={setAberturaOpen}
        onSuccess={fetchComandas}
      />

            <HistoricoCaixasDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
      />
    </div>
  );
}
