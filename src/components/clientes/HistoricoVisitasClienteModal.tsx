import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  History, Calendar, Scissors, Package, DollarSign, Crown, User,
  ShoppingBag, Sparkles, Loader2, ArrowUpRight, CheckCircle2, Clock,
  Receipt, Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface HistoricoVisitasClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: any | null;
}

export function HistoricoVisitasClienteModal({ open, onOpenChange, cliente }: HistoricoVisitasClienteModalProps) {
  const [loading, setLoading] = useState(false);
  const [comandas, setComandas] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("visitas");

  useEffect(() => {
    if (open && cliente?.id) {
      fetchHistorico();
      setActiveTab("visitas");
    }
  }, [open, cliente?.id]);

  async function fetchHistorico() {
    if (!cliente?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comandas")
        .select(`
          id, total, subtotal, desconto, forma_pagamento, status, fechada_em, created_at,
          barbeiros (nome),
          unidades (nome),
          comanda_itens (
            id, tipo, nome, quantidade, preco_unitario, subtotal
          )
        `)
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComandas(data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico do cliente:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!cliente) return null;

  // Cálculos consolidados
  const comandasValidas = comandas.filter((c) => c.status === "fechada" || c.status === "aberta");
  const totalGastoLTV = comandasValidas.reduce((acc, c) => acc + Number(c.total || 0), 0);
  
  // Extrair todos os itens vendidos em lista plana
  const todosItens = comandasValidas.flatMap((c) => 
    (c.comanda_itens || []).map((i: any) => ({
      ...i,
      comandaData: c.fechada_em || c.created_at,
      barbeiroNome: c.barbeiros?.nome || "Profissional",
      comandaId: c.id
    }))
  );

  const servicosRealizados = todosItens.filter((i) => i.tipo === "servico");
  const produtosComprados = todosItens.filter((i) => i.tipo === "produto");

  // Agrupamento de Serviços por frequência
  const servicosAgrupados: Record<string, { nome: string; quantidade: number; total: number; ultimaData: string }> = {};
  servicosRealizados.forEach((s) => {
    const k = s.nome;
    if (!servicosAgrupados[k]) {
      servicosAgrupados[k] = { nome: s.nome, quantidade: 0, total: 0, ultimaData: s.comandaData };
    }
    servicosAgrupados[k].quantidade += Number(s.quantidade || 1);
    servicosAgrupados[k].total += Number(s.subtotal || 0);
  });
  const rankingServicos = Object.values(servicosAgrupados).sort((a, b) => b.quantidade - a.quantidade);

  // Agrupamento de Produtos por frequência
  const produtosAgrupados: Record<string, { nome: string; quantidade: number; total: number; ultimaData: string }> = {};
  produtosComprados.forEach((p) => {
    const k = p.nome;
    if (!produtosAgrupados[k]) {
      produtosAgrupados[k] = { nome: p.nome, quantidade: 0, total: 0, ultimaData: p.comandaData };
    }
    produtosAgrupados[k].quantidade += Number(p.quantidade || 1);
    produtosAgrupados[k].total += Number(p.subtotal || 0);
  });
  const rankingProdutos = Object.values(produtosAgrupados).sort((a, b) => b.quantidade - a.quantidade);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center text-lg font-black text-foreground overflow-hidden border border-border shrink-0 shadow-md">
                {cliente.foto_url ? (
                  <img src={cliente.foto_url} alt={cliente.nome} className="w-full h-full object-cover" />
                ) : (
                  cliente.nome?.charAt(0) || "C"
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-black text-foreground">
                    {cliente.nome}
                  </DialogTitle>
                  {(cliente.is_infinite || cliente.plano_assinatura || cliente.observacoes?.includes("VINDI_INFINITE")) && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5">
                      <Crown className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" />
                      {cliente.plano_assinatura || "Assinante Infinite 👑"}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{cliente.telefone || "Sem telefone"}</span>
                  {cliente.email && <span>• {cliente.email}</span>}
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="border-border text-foreground font-bold px-3 py-1 text-xs">
              <History className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Histórico Completo de Fidelidade
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* CARDS DE RESUMO DO CLIENTE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-card rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Total de Visitas
                </div>
                <div className="text-2xl font-black text-foreground mt-1">
                  {comandasValidas.length || cliente.total_visitas || 0} <span className="text-xs font-bold text-muted-foreground">visitas</span>
                </div>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> LTV Acumulado
                </div>
                <div className="text-2xl font-black text-emerald-500 mt-1">
                  R$ {totalGastoLTV.toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase">
                  <Scissors className="h-3.5 w-3.5 text-red-500" /> Serviços Feitos
                </div>
                <div className="text-2xl font-black text-foreground mt-1">
                  {servicosRealizados.reduce((s, i) => s + (i.quantidade || 1), 0)} <span className="text-xs font-bold text-muted-foreground">cortes</span>
                </div>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase">
                  <Package className="h-3.5 w-3.5 text-cyan-500" /> Produtos Comprados
                </div>
                <div className="text-2xl font-black text-foreground mt-1">
                  {produtosComprados.reduce((s, i) => s + (i.quantidade || 1), 0)} <span className="text-xs font-bold text-muted-foreground">un.</span>
                </div>
              </div>
            </div>

            {/* ABAS DE DETALHAMENTO */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
              <TabsList className="bg-muted/40 p-1 border border-border flex w-full">
                <TabsTrigger value="visitas" className="flex-1 text-xs font-bold gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-primary" />
                  Visitas & Comandas ({comandas.length})
                </TabsTrigger>
                <TabsTrigger value="servicos" className="flex-1 text-xs font-bold gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-red-500" />
                  Serviços ({rankingServicos.length})
                </TabsTrigger>
                <TabsTrigger value="produtos" className="flex-1 text-xs font-bold gap-1.5">
                  <Package className="h-3.5 w-3.5 text-cyan-500" />
                  Produtos ({rankingProdutos.length})
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: VISITAS & COMANDAS */}
              <TabsContent value="visitas" className="space-y-3">
                {comandas.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground font-semibold bg-muted/20 rounded-xl border border-border">
                    Nenhum atendimento ou comanda registrada para este cliente ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comandas.map((c) => {
                      const dataVisita = c.fechada_em || c.created_at;
                      const itensVisita = c.comanda_itens || [];
                      return (
                        <div key={c.id} className="p-4 bg-card rounded-xl border border-border space-y-3 shadow-sm hover:border-primary/40 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-foreground">
                                  {dataVisita ? format(new Date(dataVisita), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Data não registrada"}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Unidade: <strong className="text-foreground">{c.unidades?.nome || "Unidade Filial"}</strong> • Profissional: <strong className="text-foreground">{c.barbeiros?.nome || "Barbeiro"}</strong>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold",
                                c.status === "fechada" ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" : "border-amber-500/40 text-amber-600 bg-amber-500/10"
                              )}>
                                {c.status === "fechada" ? "✓ Concluída" : "Em Aberto"}
                              </Badge>
                              <div className="text-right font-black text-sm text-foreground">
                                R$ {Number(c.total || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Lista de itens discriminados da visita */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Itens desta Visita:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {itensVisita.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">Atendimento sem itens discriminados</span>
                              ) : (
                                itensVisita.map((item: any) => (
                                  <div key={item.id} className="p-2 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 truncate">
                                      {item.tipo === "servico" ? (
                                        <Scissors className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                      ) : (
                                        <Package className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                      )}
                                      <span className="font-bold text-foreground truncate">{item.nome}</span>
                                      {item.quantidade > 1 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-border">
                                          x{item.quantidade}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-foreground shrink-0 ml-2">
                                      R$ {Number(item.subtotal || 0).toFixed(2)}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Forma de Pagamento */}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                            <span>Pagamento: <strong className="text-foreground capitalize">{c.forma_pagamento || "Não informado"}</strong></span>
                            {c.desconto > 0 && (
                              <span className="text-red-500 font-bold">Desconto aplicado: R$ {Number(c.desconto).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ABA 2: SERVIÇOS PREFERIDOS */}
              <TabsContent value="servicos">
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-foreground">Serviço Realizado</TableHead>
                        <TableHead className="text-xs font-bold text-center text-foreground">Qtd Total</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Total Investido</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Última Realização</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingServicos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                            Nenhum serviço registrado para este cliente.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rankingServicos.map((s, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30 border-border">
                            <TableCell className="text-xs font-bold text-foreground flex items-center gap-2">
                              <Scissors className="h-3.5 w-3.5 text-red-500" />
                              {s.nome}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono font-bold text-primary">
                              {s.quantidade}x
                            </TableCell>
                            <TableCell className="text-xs text-right font-black text-foreground">
                              R$ {s.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground font-mono">
                              {s.ultimaData ? format(new Date(s.ultimaData), "dd/MM/yyyy") : "--"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ABA 3: PRODUTOS COMPRADOS */}
              <TabsContent value="produtos">
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/60">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-foreground">Produto Adquirido</TableHead>
                        <TableHead className="text-xs font-bold text-center text-foreground">Qtd Total</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Total Investido</TableHead>
                        <TableHead className="text-xs font-bold text-right text-foreground">Última Compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingProdutos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                            Nenhum produto adquirido por este cliente ainda.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rankingProdutos.map((p, idx) => (
                          <TableRow key={idx} className="hover:bg-muted/30 border-border">
                            <TableCell className="text-xs font-bold text-foreground flex items-center gap-2">
                              <Package className="h-3.5 w-3.5 text-cyan-500" />
                              {p.nome}
                            </TableCell>
                            <TableCell className="text-xs text-center font-mono font-bold text-cyan-500">
                              {p.quantidade} un.
                            </TableCell>
                            <TableCell className="text-xs text-right font-black text-foreground">
                              R$ {p.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground font-mono">
                              {p.ultimaData ? format(new Date(p.ultimaData), "dd/MM/yyyy") : "--"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
