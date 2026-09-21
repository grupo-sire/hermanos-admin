import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ArrowUp, ArrowDown, Package, Loader2, ShoppingBag, Truck, CheckCircle2, UserCheck, Clock, ShieldCheck, Printer, FileCheck, AlertTriangle, QrCode } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MovimentacaoDialog } from "@/components/estoque/MovimentacaoDialog";
import { SolicitarSuprimentosDialog } from "@/components/estoque/SolicitarSuprimentosDialog";
import { ConferirRecebimentoDialog } from "@/components/estoque/ConferirRecebimentoDialog";
import { ReciboSuprimentosDialog } from "@/components/estoque/ReciboSuprimentosDialog";
import { QrScannerDialog } from "@/components/estoque/QrScannerDialog";
import { AuditoriaInsumos } from "@/components/estoque/AuditoriaInsumos";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

interface Movimentacao {
  id: string;
  produto_id: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  created_at: string;
  unidade_id: string | null;
  responsavel_id?: string | null;
  produtos?: { nome: string } | null;
  responsavel_nome?: string | null;
}

interface Produto {
  id: string;
  nome: string;
  estoque: number;
  estoque_minimo: number;
}

export default function Estoque() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidosMatriz, setPedidosMatriz] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchPedido, setSearchPedido] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [selectedPedidoTransito, setSelectedPedidoTransito] = useState<any | null>(null);
  const [conferirOpen, setConferirOpen] = useState(false);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [selectedPedidoRecibo, setSelectedPedidoRecibo] = useState<any | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("estoque");

  const { selectedUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { isSuperAdmin, unidadeId: userUnidadeId } = useUserRole();
  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";

  const activeUnidadeId = selectedUnidadeId || userUnidadeId || null;

  useEffect(() => {
    fetchData();
  }, [selectedUnidadeId, userUnidadeId, empresaId]);

  async function fetchData() {
    setLoading(true);
    try {
      let movQuery = supabase
        .from("estoque_movimentacoes")
        .select("*, produtos(nome)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (defaultEmpresaId) {
        movQuery = movQuery.eq("empresa_id", defaultEmpresaId);
      }

      if (activeUnidadeId) {
        movQuery = movQuery.eq("unidade_id", activeUnidadeId);
      }

      let pedQuery = supabase
        .from("pedidos_suprimentos" as any)
        .select("*, pedidos_suprimentos_itens(*, produtos(nome))")
        .order("created_at", { ascending: false });

      if (defaultEmpresaId) {
        pedQuery = pedQuery.eq("empresa_id", defaultEmpresaId);
      }

      if (activeUnidadeId) {
        pedQuery = pedQuery.eq("unidade_id", activeUnidadeId);
      }

      const [movRes, prodRes, pedRes, estFilialRes] = await Promise.all([
        movQuery,
        supabase.from("produtos").select("id, nome, estoque, estoque_minimo").eq("status", "active"),
        pedQuery,
        activeUnidadeId
          ? supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", activeUnidadeId)
          : Promise.resolve({ data: null, error: null })
      ]);

      if (movRes.error) throw movRes.error;
      if (prodRes.error) throw prodRes.error;

      let prods = (prodRes.data || []) as any[];
      if (estFilialRes?.data && activeUnidadeId) {
        const estoqueMap: Record<string, number> = {};
        estFilialRes.data.forEach((ef: any) => {
          estoqueMap[ef.produto_id] = Number(ef.quantidade) || 0;
        });

        prods = prods.map((p) => ({
          ...p,
          estoque: estoqueMap[p.id] !== undefined ? Math.max(0, estoqueMap[p.id]) : 0,
        }));
      }

      let movsList: Movimentacao[] = (movRes.data as any) || [];

      const respIds = Array.from(new Set(movsList.map(m => m.responsavel_id).filter(Boolean)));
      if (respIds.length > 0) {
        const { data: barbData } = await supabase
          .from("barbeiros")
          .select("id, nome")
          .in("id", respIds as string[]);

        if (barbData) {
          const barbMap = new Map(barbData.map(b => [b.id, b.nome]));
          movsList = movsList.map(m => ({
            ...m,
            responsavel_nome: m.responsavel_id ? barbMap.get(m.responsavel_id) || null : null,
          }));
        }
      }

      setMovimentacoes(movsList);
      setProdutos(prods);
      setPedidosMatriz((pedRes.data as any) || []);
    } catch (error) {
      console.error("Erro ao carregar dados de estoque:", error);
      toast.error("Erro ao carregar dados de estoque.");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenConferir = (pedido: any) => {
    setSelectedPedidoTransito(pedido);
    setConferirOpen(true);
  };

  const handleOpenRecibo = (pedido: any) => {
    setSelectedPedidoRecibo(pedido);
    setReciboOpen(true);
  };

  const filteredMovements = movimentacoes.filter((mov) =>
    (mov.produtos?.nome || "").toLowerCase().includes(search.toLowerCase()) ||
    (mov.responsavel_nome || "").toLowerCase().includes(search.toLowerCase()) ||
    (mov.observacao || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredPedidos = pedidosMatriz.filter((ped) =>
    ped.id.toLowerCase().includes(searchPedido.toLowerCase()) ||
    (ped.status || "").toLowerCase().includes(searchPedido.toLowerCase()) ||
    ped.pedidos_suprimentos_itens?.some((i: any) => (i.produtos?.nome || "").toLowerCase().includes(searchPedido.toLowerCase()))
  );

  const pedidosEmTransito = pedidosMatriz.filter((p) => p.status === "em_transito" || p.status === "entregue");
  const totalProdutos = produtos.length;
  const produtosBaixoEstoque = produtos.filter((p) => p.estoque <= p.estoque_minimo).length;
  const entradasMes = movimentacoes.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + m.quantidade, 0);
  const saidasMes = movimentacoes.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + m.quantidade, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_transito":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 font-semibold"><Truck className="h-3 w-3" /> Em Rota (Com Entregador)</Badge>;
      case "entregue":
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1 animate-pulse font-semibold"><Package className="h-3 w-3" /> Caixa Entregue na Filial</Badge>;
      case "divergencia_pendente":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30 flex items-center gap-1 font-bold"><AlertTriangle className="h-3 w-3" /> Divergência em Auditoria</Badge>;
      case "concluido":
      case "recebido":
      case "entregue_concluido":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3 w-3" /> Recebido & Concluído</Badge>;
      case "cancelado":
        return <Badge variant="destructive" className="flex items-center gap-1">Cancelado</Badge>;
      case "pendente":
      default:
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-semibold"><Clock className="h-3 w-3" /> Aguardando Matriz</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Estoque da Filial & Auditoria" description="Controle local de produtos, auditoria de insumos e acompanhamento de pedidos à Matriz">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="btn-soft font-medium border-border" onClick={() => setQrScannerOpen(true)}>
            <QrCode className="h-4 w-4 mr-2 text-primary" />Bipar Caixa
          </Button>
          <Button variant="outline" className="btn-soft font-medium" onClick={() => setSolicitarOpen(true)}>
            <ShoppingBag className="h-4 w-4 mr-2" />Pedir à Matriz
          </Button>
          <Button className="btn-wine font-medium" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova Movimentação
          </Button>
        </div>
      </PageHeader>

      {/* Sistema de Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="bg-card border border-border p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="estoque" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2">
            <Package className="h-3.5 w-3.5 mr-2" />
            Estoque & Movimentações Locais
          </TabsTrigger>
          <TabsTrigger value="pedidos_matriz" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2 relative">
            <Truck className="h-3.5 w-3.5 mr-2" />
            Acompanhamento de Pedidos à Matriz
            {pedidosEmTransito.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                {pedidosEmTransito.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2">
            <ShieldCheck className="h-3.5 w-3.5 mr-2 text-emerald-500" />
            Auditoria Insumos vs Atendimentos
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: ESTOQUE E MOVIMENTAÇÕES LOCAIS */}
        <TabsContent value="estoque" className="space-y-4 m-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Total de Produtos" value={totalProdutos} description="Filial local" icon={Package} />
            <StatCard title="Baixo Estoque" value={produtosBaixoEstoque} description="Precisam reposição" icon={Package} />
            <StatCard title="Entradas" value={entradasMes} description="Últimas movimentações" icon={ArrowUp} />
            <StatCard title="Saídas" value={saidasMes} description="Últimas movimentações" icon={ArrowDown} />
          </div>

          {/* Painel Alerta de Suprimentos Em Trânsito / Entregues */}
          {pedidosEmTransito.length > 0 && (
            <div className="panel border-info/30 bg-info/5">
              <h3 className="text-sm font-bold text-info mb-3 flex items-center gap-2">
                <Truck className="h-4 w-4 animate-bounce" />
                ⚠️ {pedidosEmTransito.length} Pedido(s) de Suprimentos da Matriz em Andamento
              </h3>
              <div className="space-y-2">
                {pedidosEmTransito.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-info/20">
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">Pedido #{p.id.slice(0, 6)}</span>
                        {getStatusBadge(p.status)}
                      </div>
                      <p className="text-muted-foreground">Despachado em: {p.despachado_em ? format(new Date(p.despachado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Recentemente"}</p>
                      <p className="text-info font-medium">{p.pedidos_suprimentos_itens?.length || 0} produto(s) no lote</p>
                    </div>

                    {p.status === "entregue" ? (
                      <Button size="sm" className="btn-wine text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md animate-pulse" onClick={() => handleOpenConferir(p)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Conferir Recebimento
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="btn-soft text-xs opacity-60 cursor-not-allowed" disabled>
                        <Clock className="h-3.5 w-3.5 mr-1 text-amber-400" />
                        Aguardando Entregador
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {produtosBaixoEstoque > 0 && (
            <div className="panel border-warning/30">
              <h3 className="text-sm font-bold text-warning mb-3">⚠️ Produtos com Baixo Estoque na Filial</h3>
              <div className="flex flex-wrap gap-2">
                {produtos.filter((p) => p.estoque <= p.estoque_minimo).map((p) => (
                  <span key={p.id} className="text-xs px-3 py-1.5 rounded-full bg-warning/20 text-warning">
                    {p.nome} ({p.estoque} un.)
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <h3 className="text-sm font-bold text-foreground mb-4">Últimas Movimentações</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto ou responsável..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-dark pl-10" />
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {filteredMovements.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Nenhuma movimentação registrada</p>
                  <Button variant="link" className="text-primary mt-2" onClick={() => setDialogOpen(true)}>Registrar primeira movimentação</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/[0.06] hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Produto</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Tipo</TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-center">Quantidade</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Responsável</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Data</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.map((mov) => (
                      <TableRow key={mov.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                        <TableCell className="font-medium text-foreground">{mov.produtos?.nome || "Produto removido"}</TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${mov.tipo === "entrada" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                            {mov.tipo === "entrada" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-foreground">{mov.quantidade}</TableCell>
                        <TableCell className="text-foreground text-xs">
                          {mov.responsavel_nome ? (
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-primary" />
                              <span>{mov.responsavel_nome}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-muted-foreground">{mov.observacao || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ABA 2: ACOMPANHAMENTO DE PEDIDOS À MATRIZ */}
        <TabsContent value="pedidos_matriz" className="space-y-4 m-0">
          <div className="panel">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Pedidos de Suprimentos Solicitados à Matriz</h3>
                <p className="text-xs text-muted-foreground">Acompanhe o status de aprovação, envio e confirmação de recebimento dos insumos da filial.</p>
              </div>

              <Button className="btn-wine text-xs h-9" onClick={() => setSolicitarOpen(true)}>
                <ShoppingBag className="h-4 w-4 mr-2" /> Novo Pedido de Suprimentos
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por código, status ou produto..." value={searchPedido} onChange={(e) => setSearchPedido(e.target.value)} className="input-dark pl-10 text-xs" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredPedidos.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-xl border border-border">
                  <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h4 className="text-sm font-medium text-foreground">Nenhum pedido de suprimentos encontrado</h4>
                  <p className="text-xs text-muted-foreground mt-1">Sua filial não possui pedidos solicitados nesta categoria.</p>
                  <Button variant="link" className="text-primary text-xs mt-2" onClick={() => setSolicitarOpen(true)}>Fazer primeiro pedido à Matriz</Button>
                </div>
              ) : (
                filteredPedidos.map((ped) => (
                  <div key={ped.id} className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-primary font-bold text-sm">
                          #{ped.id.slice(0, 4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm font-mono">Pedido #{ped.id.slice(0, 8)}</span>
                            {getStatusBadge(ped.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Solicitado em: {format(new Date(ped.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" className="btn-soft text-xs h-8" onClick={() => handleOpenRecibo(ped)}>
                          <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir Guia
                        </Button>
                        {ped.status === "entregue" && (
                          <Button size="sm" className="btn-wine text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold animate-pulse shadow-md" onClick={() => handleOpenConferir(ped)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Conferir & Confirmar Recebimento
                          </Button>
                        )}
                        {ped.status === "em_transito" && (
                          <Badge variant="outline" className="text-xs py-1 px-2.5 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-medium">
                            <Clock className="h-3.5 w-3.5 mr-1 animate-spin" /> Em Trânsito
                          </Badge>
                        )}
                        {ped.status === "divergencia_pendente" && (
                          <Badge variant="outline" className="text-xs py-1 px-2.5 border-destructive/30 text-destructive bg-destructive/10 font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Aguardando Parecer Matriz
                          </Badge>
                        )}
                        {(ped.status === "entregue_concluido" || ped.status === "concluido") && (
                          <Button size="sm" variant="outline" className="btn-soft text-xs h-8 text-emerald-600 dark:text-emerald-400" onClick={() => handleOpenRecibo(ped)}>
                            <FileCheck className="h-3.5 w-3.5 mr-1" /> Ver Canhoto
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Itens Solicitados:</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                        {ped.pedidos_suprimentos_itens?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded bg-card border border-border">
                            <span className="font-medium text-foreground truncate max-w-[180px]">
                              {item.produtos?.nome || "Produto"}
                            </span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono ml-2">
                              {item.qtd_solicitada} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ABA 3: AUDITORIA DE INSUMOS X ATENDIMENTOS */}
        <TabsContent value="auditoria" className="space-y-4 m-0">
          <AuditoriaInsumos />
        </TabsContent>
      </Tabs>

      <MovimentacaoDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={fetchData} />
      <SolicitarSuprimentosDialog open={solicitarOpen} onOpenChange={setSolicitarOpen} onSuccess={fetchData} />
      <ConferirRecebimentoDialog pedido={selectedPedidoTransito} open={conferirOpen} onOpenChange={setConferirOpen} onSuccess={fetchData} />
      <ReciboSuprimentosDialog pedido={selectedPedidoRecibo} open={reciboOpen} onOpenChange={setReciboOpen} />
      <QrScannerDialog open={qrScannerOpen} onOpenChange={setQrScannerOpen} onSuccess={fetchData} />
    </div>
  );
}
