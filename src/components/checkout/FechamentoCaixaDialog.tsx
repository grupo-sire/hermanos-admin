
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Wallet, Banknote, QrCode, CreditCard, Crown, ArrowUpRight, ArrowDownRight,
  ShieldCheck, Lock, CheckCircle2, AlertTriangle, Printer, FileText,
  KeyRound, Loader2, UserCheck, ZoomIn, Check, Sparkles, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { fecharCaixa } from "@/services/caixaService";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FechamentoCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FechamentoCaixaDialog({ open, onOpenChange, onSuccess }: FechamentoCaixaDialogProps) {
  const { selectedUnidadeId, unidades } = useUnidade();
  const { user } = useAuth();
  const { config } = useEmpresa();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");

  // Dados das vendas do dia
  const [comandas, setComandas] = useState<any[]>([]);
  const [fundoTroco] = useState(150.0);
  const [totalDinheiroVendas, setTotalDinheiroVendas] = useState(0.0);
  const [totalPix, setTotalPix] = useState(0.0);
  const [totalCartaoCredito, setTotalCartaoCredito] = useState(0.0);
  const [totalCartaoDebito, setTotalCartaoDebito] = useState(0.0);
  const [totalPlanosInfinite, setTotalPlanosInfinite] = useState(0);
  const [totalFaturado, setTotalFaturado] = useState(0.0);

  // Sangrias e Reforços
  const [sangrias, setSangrias] = useState<any[]>([]);
  const [totalSangrias, setTotalSangrias] = useState(0.0);
  const [totalReforcos, setTotalReforcos] = useState(0.0);

  // Conferência da Gaveta
  const [valorContadoGaveta, setValorContadoGaveta] = useState<string>("");
  const [observacoesFechamento, setObservacoesFechamento] = useState("");

  // Modal de 2-Step Verification (Reautenticação)
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  // Estado de Fechamento Concluído com Sucesso
  const [fechamentoConcluido, setFechamentoConcluido] = useState<any | null>(null);

  // Modal Zoom de Comprovante
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

  const unidadeAtual = unidades.find((u) => u.id === selectedUnidadeId);
  const unidadeNome = unidadeAtual?.nome || "Unidade Filial";

  const hoje = new Date();
  const dataFormatadaHoje = format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  useEffect(() => {
    if (open) {
      fetchDadosDoDia();
      setFechamentoConcluido(null);
      setAuthPassword("");
      setValorContadoGaveta("");
      setObservacoesFechamento("");
      setActiveTab("resumo");
    }
  }, [open, selectedUnidadeId]);

  async function fetchDadosDoDia() {
    setLoading(true);
    try {
      const start = startOfDay(new Date());
      const end = endOfDay(new Date());

      let query = supabase
        .from("comandas")
        .select(`
          id, total, subtotal, desconto, forma_pagamento, fechada_em, created_at,
          codigo_autorizacao_nsu, comprovante_pix_url,
          clientes(nome, telefone),
          barbeiros(nome),
          comanda_itens(id, tipo, nome, quantidade, preco_unitario, subtotal)
        `)
        .eq("status", "fechada")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (selectedUnidadeId) {
        query = query.eq("unidade_id", selectedUnidadeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const listaComandas = data || [];
      setComandas(listaComandas);

      let din = 0;
      let pix = 0;
      let cred = 0;
      let deb = 0;
      let planosCount = 0;
      let fat = 0;

      listaComandas.forEach((c) => {
        const val = Number(c.total) || 0;
        fat += val;
        const forma = (c.forma_pagamento || "").toLowerCase();

        if (forma.includes("dinheiro")) {
          din += val;
        } else if (forma.includes("pix")) {
          pix += val;
        } else if (forma.includes("credito") || forma.includes("crédito")) {
          cred += val;
        } else if (forma.includes("debito") || forma.includes("débito")) {
          deb += val;
        } else if (forma.includes("plano") || forma.includes("infinite") || val === 0) {
          planosCount++;
        } else if (forma.includes("múltiplo") || forma.includes("multiplo")) {
          pix += val;
        } else {
          pix += val;
        }
      });

      setTotalDinheiroVendas(din);
      setTotalPix(pix);
      setTotalCartaoCredito(cred);
      setTotalCartaoDebito(deb);
      setTotalPlanosInfinite(planosCount);
      setTotalFaturado(fat);

      const storageKey = `caixa_movs_${selectedUnidadeId || "all"}_${format(hoje, "yyyy-MM-dd")}`;
      const savedMovs = localStorage.getItem(storageKey);
      if (savedMovs) {
        try {
          const parsed = JSON.parse(savedMovs);
          setSangrias(parsed);
          const totalS = parsed.filter((m: any) => m.tipo === "sangria").reduce((acc: number, m: any) => acc + m.valor, 0);
          const totalR = parsed.filter((m: any) => m.tipo === "reforco").reduce((acc: number, m: any) => acc + m.valor, 0);
          setTotalSangrias(totalS);
          setTotalReforcos(totalR);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados do dia:", err);
      toast.error("Erro ao consolidar dados do caixa");
    } finally {
      setLoading(false);
    }
  }

  // Cálculos do Caixa Físico
  const saldoEsperadoGaveta = fundoTroco + totalDinheiroVendas + totalReforcos - totalSangrias;
  const valorContadoNum = parseFloat(valorContadoGaveta) || 0;
  const diferencaGaveta = valorContadoNum - saldoEsperadoGaveta;

  // Iniciar processo de fechamento (Abre verificação de 2 etapas)
  const handleIniciarFechamento = () => {
    if (!valorContadoGaveta || isNaN(Number(valorContadoGaveta))) {
      toast.error("⚠️ Informe o valor em dinheiro contado fisicamente na gaveta!");
      setActiveTab("resumo");
      return;
    }
    setAuthDialogOpen(true);
  };

  // Autenticar com a senha do usuário logado (Verificação de 2 Fatores)
  const handleConfirmarComSenha = async () => {
    if (!authPassword) {
      toast.error("Digite sua senha de acesso para autorizar.");
      return;
    }
    if (!user?.email) {
      toast.error("Usuário logado não identificado.");
      return;
    }

    setAuthenticating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: authPassword,
      });

      if (error) {
        throw new Error("Senha de acesso incorreta! Fechamento de caixa NÃO autorizado.");
      }

      const protocolo = `FECH-${format(hoje, "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;

      const fechamentoData = {
        protocolo,
        unidade_nome: unidadeNome,
        data_fechamento: new Date().toISOString(),
        responsavel_email: user.email,
        responsavel_nome: user.user_metadata?.nome || user.email.split("@")[0],
        fundo_troco_inicial: fundoTroco,
        total_dinheiro_vendas: totalDinheiroVendas,
        total_pix: totalPix,
        total_cartao_credito: totalCartaoCredito,
        total_cartao_debito: totalCartaoDebito,
        total_planos_infinite: totalPlanosInfinite,
        total_sangrias: totalSangrias,
        total_reforcos: totalReforcos,
        total_faturado: totalFaturado,
        saldo_esperado_gaveta: saldoEsperadoGaveta,
        valor_contado_gaveta: valorContadoNum,
        diferenca_gaveta: diferencaGaveta,
        observacoes: observacoesFechamento,
        total_comandas: comandas.length,
        comandas_resumo: comandas.map((c) => ({
          id: c.id.slice(0, 8),
          cliente: c.clientes?.nome || "Cliente Balcão",
          barbeiro: c.barbeiros?.nome || "Profissional",
          total: c.total,
          forma_pagamento: c.forma_pagamento || "Não informado",
          hora: c.created_at ? format(new Date(c.created_at), "HH:mm") : "--:--",
        })),
      };

      fecharCaixa({
        unidadeId: selectedUnidadeId || "all",
        unidadeNome,
        userEmail: user.email,
        userNome: user.user_metadata?.nome || user.email.split("@")[0],
        protocolo,
        saldoEsperadoGaveta,
        valorContadoGaveta: valorContadoNum,
        diferencaGaveta,
        observacoes: observacoesFechamento,
        resumoVendas: {
          total_faturado: totalFaturado,
          total_dinheiro: totalDinheiroVendas,
          total_pix: totalPix,
          total_cartao: totalCartaoCredito + totalCartaoDebito,
          total_planos_infinite: totalPlanosInfinite,
          total_sangrias: totalSangrias,
          total_reforcos: totalReforcos,
          total_comandas: comandas.length,
        },
        comandasResumo: fechamentoData.comandas_resumo,
        fundoTroco,
      });

      setFechamentoConcluido(fechamentoData);
      setAuthDialogOpen(false);
      toast.success("🔐 Verificação de 2 etapas aprovada! Caixa do dia fechado com sucesso!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro na autenticação de 2 etapas");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleImprimirRelatorio = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl">
          
          {/* TELA DE SUCESSO: RELATÓRIO OFICIAL EMITIDO */}
          {fechamentoConcluido ? (
            <div className="space-y-6 animate-fade-in print:p-0">
              <div className="text-center space-y-2 border-b border-border pb-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center border border-emerald-500/40 shadow-lg">
                  <ShieldCheck className="h-9 w-9" />
                </div>
                <h2 className="text-xl font-black text-foreground uppercase tracking-wider">
                  Fechamento de Caixa Oficial Homologado
                </h2>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-semibold">
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10 font-bold px-2 py-0.5">
                    {fechamentoConcluido.protocolo}
                  </Badge>
                  <span>•</span>
                  <span>{unidadeNome}</span>
                  <span>•</span>
                  <span>{format(new Date(fechamentoConcluido.data_fechamento), "dd/MM/yyyy 'às' HH:mm")}</span>
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[10px] block">Responsável Homologador:</span>
                  <span className="font-extrabold text-foreground">{fechamentoConcluido.responsavel_nome}</span>
                  <span className="text-[11px] text-muted-foreground block">{fechamentoConcluido.responsavel_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[10px] block">Total de Vendas / Comandas:</span>
                  <span className="font-black text-foreground text-sm">{fechamentoConcluido.total_comandas} atendimentos</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold uppercase text-[10px] block">Status da Gaveta Física:</span>
                  <span className={cn(
                    "font-black text-sm",
                    Math.abs(fechamentoConcluido.diferenca_gaveta) < 0.01
                      ? "text-emerald-500"
                      : fechamentoConcluido.diferenca_gaveta > 0
                      ? "text-blue-500"
                      : "text-red-500"
                  )}>
                    {Math.abs(fechamentoConcluido.diferenca_gaveta) < 0.01
                      ? "✓ Conferência Perfeita (R$ 0,00)"
                      : fechamentoConcluido.diferenca_gaveta > 0
                      ? `+ Sobra: R$ ${fechamentoConcluido.diferenca_gaveta.toFixed(2)}`
                      : `- Falta: R$ ${Math.abs(fechamentoConcluido.diferenca_gaveta).toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">Total Faturado</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">R$ {fechamentoConcluido.total_faturado.toFixed(2)}</span>
                </div>

                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-cyan-400 block">Total em Pix</span>
                  <span className="text-xl font-black text-cyan-400 mt-1 block">R$ {fechamentoConcluido.total_pix.toFixed(2)}</span>
                </div>

                <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-blue-400 block">Total Cartões</span>
                  <span className="text-xl font-black text-blue-400 mt-1 block">
                    R$ {(fechamentoConcluido.total_cartao_credito + fechamentoConcluido.total_cartao_debito).toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-amber-400 block">Gaveta Final</span>
                  <span className="text-xl font-black text-amber-400 mt-1 block">R$ {fechamentoConcluido.valor_contado_gaveta.toFixed(2)}</span>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden bg-background">
                <div className="p-3 bg-muted/60 border-b border-border font-bold text-xs flex justify-between items-center">
                  <span>Detalhamento Analítico de Vendas (#{fechamentoConcluido.comandas_resumo.length})</span>
                  <span className="text-[11px] text-muted-foreground font-semibold">Todas as comandas fechadas hoje</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Hora</TableHead>
                        <TableHead className="text-xs">Código</TableHead>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Barbeiro</TableHead>
                        <TableHead className="text-xs">Forma de Pagto</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fechamentoConcluido.comandas_resumo.map((c: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono font-bold text-foreground">{c.hora}</TableCell>
                          <TableCell className="text-xs font-mono font-bold">#{c.id}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground">{c.cliente}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.barbeiro}</TableCell>
                          <TableCell className="text-xs font-semibold">
                            <Badge variant="outline" className="text-[10px] border-border">
                              {c.forma_pagamento}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-black text-foreground">
                            R$ {Number(c.total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs font-bold">
                  Fechar Janela
                </Button>

                <Button onClick={handleImprimirRelatorio} className="btn-wine w-full sm:w-auto text-xs font-bold flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimir Relatório de Fechamento
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <DialogHeader className="border-b border-border pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        Fechamento Diário de Caixa & Relatório Final
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground font-semibold">
                        {unidadeNome} • {dataFormatadaHoje}
                      </DialogDescription>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" onClick={fetchDadosDoDia} disabled={loading} className="text-xs h-8">
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
                    Atualizar Dados
                  </Button>
                </div>
              </DialogHeader>

              {loading ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground font-bold">Consolidando vendas e comandas do dia...</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="bg-muted/60 p-1 border border-border w-full grid grid-cols-3">
                    <TabsTrigger value="resumo" className="text-xs font-bold">
                      <Wallet className="h-3.5 w-3.5 mr-1.5" /> Resumo & Gaveta
                    </TabsTrigger>
                    <TabsTrigger value="vendas" className="text-xs font-bold">
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Extrato de Vendas ({comandas.length})
                    </TabsTrigger>
                    <TabsTrigger value="sangrias" className="text-xs font-bold">
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Sangrias / Retiradas ({sangrias.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* ABA 1: RESUMO CONSOLIDADO & CONFERÊNCIA DA GAVETA */}
                  <TabsContent value="resumo" className="space-y-4 m-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <div className="p-3 bg-muted/40 border border-border rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Banknote className="h-3.5 w-3.5 text-emerald-500" /> Dinheiro
                        </span>
                        <span className="text-base font-black text-foreground mt-1 block">R$ {totalDinheiroVendas.toFixed(2)}</span>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <QrCode className="h-3.5 w-3.5 text-cyan-500" /> Pix
                        </span>
                        <span className="text-base font-black text-foreground mt-1 block">R$ {totalPix.toFixed(2)}</span>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5 text-blue-500" /> Crédito
                        </span>
                        <span className="text-base font-black text-foreground mt-1 block">R$ {totalCartaoCredito.toFixed(2)}</span>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5 text-indigo-500" /> Débito
                        </span>
                        <span className="text-base font-black text-foreground mt-1 block">R$ {totalCartaoDebito.toFixed(2)}</span>
                      </div>

                      <div className="p-3 bg-muted/40 border border-border rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Crown className="h-3.5 w-3.5 text-amber-500" /> Infinite
                        </span>
                        <span className="text-base font-black text-foreground mt-1 block">{totalPlanosInfinite} atend.</span>
                      </div>

                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Total Faturado</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">R$ {totalFaturado.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Wallet className="h-4 w-4 text-primary" /> Balanço Matemático da Gaveta (Dinheiro Físico)
                        </h4>
                        <Badge variant="outline" className="text-[11px] font-bold">
                          Fundo Inicial: R$ {fundoTroco.toFixed(2)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground font-semibold block text-[11px]">Fundo de Troco Inicial:</span>
                          <span className="font-extrabold text-foreground">R$ {fundoTroco.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold block text-[11px]">+ Vendas em Dinheiro:</span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400">+ R$ {totalDinheiroVendas.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold block text-[11px]">- Sangrias / Saídas:</span>
                          <span className="font-extrabold text-red-600 dark:text-red-400">- R$ {totalSangrias.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-semibold block text-[11px]">= Saldo Esperado na Gaveta:</span>
                          <span className="font-black text-primary text-sm">R$ {saldoEsperadoGaveta.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                            Valor Físico Contado na Gaveta (R$) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Digite o valor exato contado na gaveta..."
                            value={valorContadoGaveta}
                            onChange={(e) => setValorContadoGaveta(e.target.value)}
                            className="bg-background text-foreground border-primary/50 text-sm font-black h-10"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-muted-foreground block mb-1.5">Resultado da Conferência</Label>
                          <div className={cn(
                            "h-10 px-3 rounded-lg border flex items-center font-bold text-xs",
                            !valorContadoGaveta
                              ? "bg-muted/40 text-muted-foreground border-border"
                              : Math.abs(diferencaGaveta) < 0.01
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                              : diferencaGaveta > 0
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40"
                          )}>
                            {!valorContadoGaveta
                              ? "Aguardando contagem física..."
                              : Math.abs(diferencaGaveta) < 0.01
                              ? "✓ Caixa Bateu Perfeitamente! (Diferença: R$ 0,00)"
                              : diferencaGaveta > 0
                              ? `⚠️ Sobra de Caixa: + R$ ${diferencaGaveta.toFixed(2)}`
                              : `⚠️ Falta de Caixa: - R$ ${Math.abs(diferencaGaveta).toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">Observações / Justificativas do Fechamento (Opcional)</Label>
                      <Textarea
                        placeholder="Ex: Tudo conferido e envelopes de sangria lacrados no cofre..."
                        value={observacoesFechamento}
                        onChange={(e) => setObservacoesFechamento(e.target.value)}
                        className="bg-background text-foreground border-border text-xs h-16"
                      />
                    </div>
                  </TabsContent>

                  {/* ABA 2: DETALHAMENTO DE TODAS AS VENDAS */}
                  <TabsContent value="vendas" className="space-y-3 m-0">
                    <div className="border border-border rounded-xl overflow-hidden bg-background">
                      <div className="p-3 bg-muted/60 border-b border-border font-bold text-xs flex justify-between items-center">
                        <span>Extrato Detalhado de Vendas do Dia ({comandas.length} comandas)</span>
                        <span className="text-muted-foreground text-[11px]">Total: R$ {totalFaturado.toFixed(2)}</span>
                      </div>

                      <div className="max-h-80 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs font-bold">Hora</TableHead>
                              <TableHead className="text-xs font-bold">Código</TableHead>
                              <TableHead className="text-xs font-bold">Cliente</TableHead>
                              <TableHead className="text-xs font-bold">Profissional</TableHead>
                              <TableHead className="text-xs font-bold">Itens / Serviços</TableHead>
                              <TableHead className="text-xs font-bold">Forma de Pagto</TableHead>
                              <TableHead className="text-xs font-bold text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comandas.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground font-semibold">
                                  Nenhuma comanda fechada registrada para hoje até o momento.
                                </TableCell>
                              </TableRow>
                            ) : (
                              comandas.map((c) => (
                                <TableRow key={c.id} className="hover:bg-muted/30">
                                  <TableCell className="text-xs font-mono font-bold text-foreground">
                                    {c.created_at ? format(new Date(c.created_at), "HH:mm") : "--:--"}
                                  </TableCell>
                                  <TableCell className="text-xs font-mono font-bold">#{c.id.slice(0, 6)}</TableCell>
                                  <TableCell className="text-xs font-medium text-foreground">{c.clientes?.nome || "Cliente Balcão"}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{c.barbeiros?.nome || "Barbeiro"}</TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[200px] truncate text-[11px] text-muted-foreground">
                                      {c.comanda_itens?.map((i: any) => `${i.quantidade}x ${i.nome}`).join(", ") || "Serviço"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className="text-[10px] border-border font-bold">
                                        {c.forma_pagamento || "Não informado"}
                                      </Badge>
                                      {c.comprovante_pix_url && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewImgUrl(c.comprovante_pix_url)}
                                          className="text-[10px] text-cyan-600 hover:underline flex items-center gap-0.5 font-bold"
                                        >
                                          <ZoomIn className="h-3 w-3" /> Pix
                                        </button>
                                      )}
                                      {c.codigo_autorizacao_nsu && (
                                        <span className="text-[9px] font-mono text-muted-foreground font-bold">
                                          NSU:{c.codigo_autorizacao_nsu}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-black text-foreground">
                                    R$ {Number(c.total).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ABA 3: SANGRIAS E REFORÇOS */}
                  <TabsContent value="sangrias" className="space-y-3 m-0">
                    <div className="border border-border rounded-xl overflow-hidden bg-background">
                      <div className="p-3 bg-muted/60 border-b border-border font-bold text-xs flex justify-between items-center">
                        <span>Lançamentos de Sangria e Reforço do Dia</span>
                        <span className="text-red-600 dark:text-red-400 font-bold text-xs">Total Retiradas: R$ {totalSangrias.toFixed(2)}</span>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs font-bold">Hora</TableHead>
                            <TableHead className="text-xs font-bold">Tipo</TableHead>
                            <TableHead className="text-xs font-bold">Justificativa / Motivo</TableHead>
                            <TableHead className="text-xs font-bold text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sangrias.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground font-semibold">
                                Nenhuma sangria ou reforço registrado para o dia de hoje.
                              </TableCell>
                            </TableRow>
                          ) : (
                            sangrias.map((s, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs font-mono font-bold">{s.hora || "--:--"}</TableCell>
                                <TableCell className="text-xs font-bold">
                                  <span className={cn(
                                    "flex items-center gap-1",
                                    s.tipo === "sangria" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                  )}>
                                    {s.tipo === "sangria" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                    {s.tipo === "sangria" ? "Sangria (Saída)" : "Reforço (Entrada)"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{s.motivo || "Não informado"}</TableCell>
                                <TableCell className={cn(
                                  "text-xs text-right font-black",
                                  s.tipo === "sangria" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                )}>
                                  {s.tipo === "sangria" ? "-" : "+"} R$ {Number(s.valor).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs font-bold">
                  Cancelar
                </Button>

                <Button
                  onClick={handleIniciarFechamento}
                  disabled={loading}
                  className="btn-wine w-full sm:w-auto text-xs font-bold shadow-lg flex items-center justify-center gap-2 h-10 px-6"
                >
                  <Lock className="h-4 w-4" />
                  Conferir & Realizar Fechamento Diário (2FA)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE 2-STEP VERIFICATION (REAUTENTICAÇÃO COM SENHA) */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-6 shadow-2xl rounded-2xl">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  Verificação de Segurança em 2 Etapas
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-semibold">
                  Confirmação de identidade para fechamento oficial
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-bold">Usuário Responsável:</span>
                <span className="font-extrabold text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-bold">Unidade Filial:</span>
                <span className="font-extrabold text-foreground">{unidadeNome}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-bold">Total Faturado no Dia:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">R$ {totalFaturado.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                Digite sua Senha de Acesso para Homologar <span className="text-red-500">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Sua senha de login no sistema..."
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmarComSenha();
                }}
                className="bg-background text-foreground border-primary/50 text-xs font-bold h-10"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                🔒 Esta etapa garante que apenas o operador ou gerente autorizado encerre o caixa da unidade.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setAuthDialogOpen(false)} className="text-xs font-bold">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarComSenha}
              disabled={authenticating || !authPassword}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              {authenticating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              Autorizar & Homologar Fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Zoom de Foto de Pix */}
      {previewImgUrl && (
        <Dialog open={Boolean(previewImgUrl)} onOpenChange={() => setPreviewImgUrl(null)}>
          <DialogContent className="sm:max-w-xl bg-background border-border p-4">
            <DialogHeader className="flex justify-between items-center pb-2">
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-cyan-600" /> Foto do Comprovante Pix
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-border">
              <img src={previewImgUrl} alt="Comprovante Pix" className="max-w-full h-auto object-contain rounded-lg shadow-2xl" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
