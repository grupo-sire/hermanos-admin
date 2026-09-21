import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wallet, ArrowUpRight, ArrowDownRight, ShieldAlert, Plus, RefreshCw, DollarSign,
  QrCode, CreditCard, Banknote, Calendar, FileText, Lock, Sun, LockOpen, History,
  AlertTriangle, CheckCircle2, ShieldCheck, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { CaixaGestaoDialog } from "./CaixaGestaoDialog";
import { FechamentoCaixaDialog } from "./FechamentoCaixaDialog";
import { AberturaCaixaDialog } from "./AberturaCaixaDialog";
import { HistoricoCaixasDialog } from "./HistoricoCaixasDialog";
import { getCaixaSessao } from "@/services/caixaService";
import { CaixaSessao } from "@/types/caixa";
import { format, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface CaixaFisicoPainelProps {
  dateFilterType?: string;
  customStartDate?: Date;
  customEndDate?: Date;
}

export function CaixaFisicoPainel({ dateFilterType = "hoje", customStartDate, customEndDate }: CaixaFisicoPainelProps) {
  const { selectedUnidadeId, unidades } = useUnidade();
  const [loading, setLoading] = useState(false);
  
  // Modais de Controle
  const [gestaoOpen, setGestaoOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);
  const [aberturaOpen, setAberturaOpen] = useState(false);
    const [historicoOpen, setHistoricoOpen] = useState(false);

  // Sessão Atual
  const [caixaSessao, setCaixaSessao] = useState<CaixaSessao | null>(null);

  const [saldoGaveta, setSaldoGaveta] = useState(150.0);
  const [totalPix, setTotalPix] = useState(0.0);
  const [totalCartao, setTotalCartao] = useState(0.0);
  const [totalSangrias, setTotalSangrias] = useState(0.0);

  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);

  useEffect(() => {
    fetchCaixaCompleto();
  }, [selectedUnidadeId, dateFilterType, customStartDate, customEndDate]);

  async function fetchCaixaCompleto() {
    setLoading(true);
    try {
      // 1. Carregar sessão de caixa do dia
      const sessao = getCaixaSessao(selectedUnidadeId);
      setCaixaSessao(sessao);
      const fundoInicial = sessao?.fundo_troco_inicial !== undefined ? Number(sessao.fundo_troco_inicial) : 150.0;

      let start: Date;
      let end: Date = endOfDay(new Date());

      const now = new Date();
      if (dateFilterType === "ontem") {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (dateFilterType === "7dias") {
        start = startOfDay(subDays(now, 7));
      } else if (dateFilterType === "mes") {
        start = startOfMonth(now);
      } else if ((dateFilterType === "custom_single" || dateFilterType === "custom_range") && customStartDate) {
        start = startOfDay(customStartDate);
        if (customEndDate) end = endOfDay(customEndDate);
      } else {
        start = startOfDay(now);
      }

      let query = supabase
        .from("comandas")
        .select("id, total, forma_pagamento, fechada_em, created_at, clientes(nome)")
        .eq("status", "fechada")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (selectedUnidadeId) query = query.eq("unidade_id", selectedUnidadeId);

      const { data } = await query;

      // Carregar sangrias e reforcos
      const storageKey = `caixa_movs_${selectedUnidadeId || "all"}_${format(now, "yyyy-MM-dd")}`;
      const savedMovs = JSON.parse(localStorage.getItem(storageKey) || "[]");
      let sangriasTotal = 0;
      let reforcosTotal = 0;

      savedMovs.forEach((sm: any) => {
        if (sm.tipo === "sangria") sangriasTotal += Number(sm.valor);
        if (sm.tipo === "reforco") reforcosTotal += Number(sm.valor);
      });

      setTotalSangrias(sangriasTotal);

      if (data) {
        let din = fundoInicial;
        let pix = 0.0;
        let card = 0.0;

        const listMov: any[] = [];

        // Adicionar sangrias e reforços ao extrato
        savedMovs.forEach((sm: any) => {
          listMov.push({
            id: `sm_${sm.id}`,
            hora: sm.hora ? `${format(now, "yyyy-MM-dd")}T${sm.hora}:00` : new Date().toISOString(),
            tipo: sm.tipo === "sangria" ? "Saída (Sangria de Caixa)" : "Entrada (Reforço de Troco)",
            cliente: sm.motivo || "Lançamento Interno",
            forma: "Dinheiro",
            valor: Number(sm.valor),
            isEntrada: sm.tipo === "reforco",
          });
        });

        data.forEach((c) => {
          const forma = (c.forma_pagamento || "").toLowerCase();
          const val = Number(c.total);

          if (forma.includes("dinheiro")) {
            din += val;
            listMov.push({
              id: c.id,
              hora: c.fechada_em || c.created_at,
              tipo: "Entrada (Venda Dinheiro)",
              cliente: (c.clientes as any)?.nome || "Cliente Balcão",
              forma: "Dinheiro",
              valor: val,
              isEntrada: true,
            });
          } else if (forma.includes("pix")) {
            pix += val;
            listMov.push({
              id: c.id,
              hora: c.fechada_em || c.created_at,
              tipo: "Entrada (Venda Pix)",
              cliente: (c.clientes as any)?.nome || "Cliente Balcão",
              forma: "Pix",
              valor: val,
              isEntrada: true,
            });
          } else if (forma.includes("credito") || forma.includes("debito") || forma.includes("cartao")) {
            card += val;
            listMov.push({
              id: c.id,
              hora: c.fechada_em || c.created_at,
              tipo: "Entrada (Venda Cartão)",
              cliente: (c.clientes as any)?.nome || "Cliente Balcão",
              forma: "Cartão",
              valor: val,
              isEntrada: true,
            });
          } else if (forma.includes("plano") || forma.includes("infinite") || val === 0) {
            listMov.push({
              id: c.id,
              hora: c.fechada_em || c.created_at,
              tipo: "Atendimento (Plano Infinite 👑)",
              cliente: (c.clientes as any)?.nome || "Cliente Assinante",
              forma: "Plano Infinite",
              valor: 0,
              isEntrada: true,
            });
          } else {
            pix += val;
            listMov.push({
              id: c.id,
              hora: c.fechada_em || c.created_at,
              tipo: "Entrada (Venda)",
              cliente: (c.clientes as any)?.nome || "Cliente Balcão",
              forma: c.forma_pagamento || "Outro",
              valor: val,
              isEntrada: true,
            });
          }
        });

        // Ordenar extrato por horário mais recente
        listMov.sort((a, b) => new Date(b.hora || 0).getTime() - new Date(a.hora || 0).getTime());

        setSaldoGaveta(din + reforcosTotal - sangriasTotal);
        setTotalPix(pix);
        setTotalCartao(card);
        setMovimentacoes(listMov);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* BANNER DINÂMICO DE STATUS DO CAIXA DO DIA */}
      {!caixaSessao ? (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/40">
              <Sun className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <span>Caixa de Hoje Não Aberto</span>
                <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[10px]">Abertura Pendente</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Inicie o turno do dia definindo o fundo de troco da gaveta.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={() => setHistoricoOpen(true)} variant="outline" className="btn-soft text-xs h-8">
              <History className="h-3.5 w-3.5 mr-1" /> Histórico
            </Button>
            <Button size="sm" onClick={() => setAberturaOpen(true)} className="btn-wine text-xs font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none">
              <Sun className="h-3.5 w-3.5 mr-1.5" /> Abrir Caixa do Dia
            </Button>
          </div>
        </div>
      ) : caixaSessao.status === "fechado" ? (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 text-destructive flex items-center justify-center border border-destructive/40">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <span>Caixa do Dia Fechado (Homologado 2FA)</span>
                <Badge className="bg-destructive/20 text-destructive border-destructive/40 text-[10px]">{caixaSessao.protocolo}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Fechado por <strong>{caixaSessao.fechado_por_nome}</strong> às {caixaSessao.fechado_em ? format(new Date(caixaSessao.fechado_em), "HH:mm") : "--"}. Expediente encerrado para hoje. A nova abertura estará disponível no próximo dia de expediente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={() => setHistoricoOpen(true)} variant="outline" className="btn-soft text-xs h-8">
              <History className="h-3.5 w-3.5 mr-1" /> Histórico de Fechamentos
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <span>Caixa Aberto • Turno em Andamento</span>
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40 text-[10px]">
                  {caixaSessao.status === "reaberto" ? "Reaberto Auditado" : "Operando"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Aberto por <strong>{caixaSessao.aberto_por_nome}</strong> às {format(new Date(caixaSessao.aberto_em), "HH:mm")} • Fundo Inicial: R$ {(caixaSessao.fundo_troco_inicial || 0).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button size="sm" onClick={() => setHistoricoOpen(true)} variant="outline" className="btn-soft text-xs h-8">
              <History className="h-3.5 w-3.5 mr-1" /> Histórico
            </Button>
            <Button size="sm" onClick={() => setFechamentoOpen(true)} className="btn-wine text-xs font-bold shadow-md flex-1 sm:flex-none">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Fechar Caixa do Dia (2FA)
            </Button>
          </div>
        </div>
      )}

      {/* HEADER DE AÇÕES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Caixa Físico da Unidade (Período Selecionado)</h3>
            <p className="text-xs text-muted-foreground">Monitoramento da gaveta e extrato transacional.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCaixaCompleto} className="text-xs border-border font-bold">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGestaoOpen(true)} className="text-xs border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 font-bold">
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Sangria / Troco
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHistoricoOpen(true)} className="btn-soft text-xs font-bold">
            <History className="h-3.5 w-3.5 mr-1.5" /> Histórico de Fechamentos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gaveta (Dinheiro)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">R$ {saldoGaveta.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Banknote className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Vendas Pix</p>
                <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">R$ {totalPix.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                <QrCode className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Cartão (Déb/Créd)</p>
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">R$ {totalCartao.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-500/30">
                <CreditCard className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sangrias (Retiradas)</p>
                <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">R$ {totalSangrias.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-red-500/10 rounded-xl text-red-600 dark:text-red-400 border border-red-500/30">
                <ShieldAlert className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extrato de Transações */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">Extrato de Movimentações do Período</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Entradas de comandas quitadas e retiradas da unidade.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-xl overflow-hidden bg-background">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="text-xs font-bold text-foreground">Data / Hora</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Tipo / Descrição</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Cliente / Origem</TableHead>
                  <TableHead className="text-xs font-bold text-foreground">Meio de Pagamento</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground font-semibold">
                      Nenhuma movimentação registrada no caixa para o período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoes.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-mono font-bold text-foreground">{m.hora ? format(new Date(m.hora), "dd/MM/yyyy HH:mm") : "--/--/----"}</TableCell>
                      <TableCell className="text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          {m.isEntrada ? <ArrowDownRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />}
                          {m.tipo}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{m.cliente}</TableCell>
                      <TableCell className="text-xs font-semibold">
                        <Badge variant="outline" className="text-[10px] border-border font-bold">
                          {m.forma}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-xs text-right font-black ${m.isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {m.isEntrada ? "+" : "-"} R$ {m.valor.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CaixaGestaoDialog open={gestaoOpen} onOpenChange={setGestaoOpen} onSuccess={fetchCaixaCompleto} />
      <FechamentoCaixaDialog open={fechamentoOpen} onOpenChange={setFechamentoOpen} onSuccess={fetchCaixaCompleto} />
      <AberturaCaixaDialog open={aberturaOpen} onOpenChange={setAberturaOpen} onSuccess={fetchCaixaCompleto} />
            <HistoricoCaixasDialog open={historicoOpen} onOpenChange={setHistoricoOpen} />
    </div>
  );
}
