import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Package, Check, Truck, Eye, ShoppingBag, MapPin, AlertTriangle, CheckCircle2, Printer, Send, FileCheck, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ReciboSuprimentosDialog } from "@/components/estoque/ReciboSuprimentosDialog";
import { EnvioDiretoSuprimentoDialog } from "@/components/produtos/EnvioDiretoSuprimentoDialog";
import { ConfirmarEntregaDialog } from "@/components/estoque/ConfirmarEntregaDialog";
import { QrScannerDialog } from "@/components/estoque/QrScannerDialog";

interface PedidoItem {
  id: string;
  produto_id: string;
  qtd_solicitada: number;
  qtd_enviada: number;
  qtd_recebida: number;
  status_item: string;
  motivo_falta: string | null;
  motivo_divergencia: string | null;
  produtos?: { nome: string; estoque: number } | null;
}

interface PedidoSuprimento {
  id: string;
  unidade_id: string;
  status: string;
  observacao_filial: string | null;
  observacao_matriz: string | null;
  observacao_recebimento: string | null;
  resolucao_matriz: string | null;
  created_at: string;
  despachado_em: string | null;
  recebido_em: string | null;
  unidades?: { nome: string } | null;
  pedidos_suprimentos_itens?: PedidoItem[];
}

export default function AdminSuprimentos() {
  const { empresaId } = useEmpresa();
  const [pedidos, setPedidos] = useState<PedidoSuprimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<PedidoSuprimento | null>(null);
  const [selectedPedidoRecibo, setSelectedPedidoRecibo] = useState<PedidoSuprimento | null>(null);
  const [selectedPedidoEntrega, setSelectedPedidoEntrega] = useState<PedidoSuprimento | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [envioOpen, setEnvioOpen] = useState(false);
  const [entregaDialogOpen, setEntregaDialogOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("pendentes");

  // Auditoria de Divergência
  const [divergenciaModalOpen, setDivergenciaModalOpen] = useState(false);
  const [selectedPedidoDivergencia, setSelectedPedidoDivergencia] = useState<PedidoSuprimento | null>(null);
  const [resolucaoDivergencia, setResolucaoDivergencia] = useState("");

  // Form state inside modal
  const [itensState, setItensState] = useState<PedidoItem[]>([]);
  const [observacaoMatriz, setObservacaoMatriz] = useState("");
  const [resolucaoMatriz, setResolucaoMatriz] = useState("");
  const [novoStatus, setNovoStatus] = useState("em_transito");

  useEffect(() => {
    fetchPedidos();
  }, [empresaId]);

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pedidos_suprimentos" as any)
        .select("*, unidades(nome), pedidos_suprimentos_itens(*, produtos(nome, estoque))")
        .order("created_at", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);

      const { data, error } = await query;
      if (error) throw error;

      setPedidos((data as any) || []);
    } catch (err: any) {
      console.error("Erro ao carregar pedidos de suprimentos:", err);
      toast.error("Erro ao carregar pedidos de suprimentos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = (pedido: PedidoSuprimento) => {
    setSelectedPedido(pedido);
    setObservacaoMatriz(pedido.observacao_matriz || "");
    setResolucaoMatriz(pedido.resolucao_matriz || "");
    setNovoStatus(pedido.status === "pendente" ? "em_transito" : pedido.status);

    const itemsFormatted = (pedido.pedidos_suprimentos_itens || []).map(item => ({
      ...item,
      qtd_enviada: item.qtd_enviada > 0 ? item.qtd_enviada : item.qtd_solicitada,
    }));
    setItensState(itemsFormatted);
    setDialogOpen(true);
  };

  const handleOpenRecibo = (pedido: PedidoSuprimento) => {
    setSelectedPedidoRecibo(pedido);
    setReciboOpen(true);
  };

  const handleUpdateQtdEnviada = (itemId: string, val: number) => {
    setItensState(prev => prev.map(i => i.id === itemId ? { ...i, qtd_enviada: val } : i));
  };

  const handleSalvarDespachoMatriz = async () => {
    if (!selectedPedido) return;

    setSaving(true);
    try {
      for (const item of itensState) {
        const { error: itemErr } = await supabase
          .from("pedidos_suprimentos_itens" as any)
          .update({
            qtd_enviada: item.qtd_enviada,
            motivo_falta: item.motivo_falta || null,
            status_item: item.qtd_enviada > 0 ? "em_transito" : "falta",
          } as any)
          .eq("id", item.id);

        if (itemErr) throw itemErr;

        if (novoStatus === "em_transito" && item.qtd_enviada > 0 && selectedPedido.status === "pendente") {
          const { data: prod } = await supabase.from("produtos").select("estoque").eq("id", item.produto_id).single();
          if (prod) {
            const currentStock = prod.estoque || 0;
            const newStock = Math.max(0, currentStock - item.qtd_enviada);
            await supabase.from("produtos").update({ estoque: newStock }).eq("id", item.produto_id);

            await supabase.from("estoque_movimentacoes").insert({
              produto_id: item.produto_id,
              tipo: "saida",
              quantidade: item.qtd_enviada,
              observacao: `Despacho de Suprimentos para ${selectedPedido.unidades?.nome || 'Filial'} (Pedido #${selectedPedido.id.slice(0, 6)})`,
              empresa_id: empresaId,
            });
          }
        }
      }

      const updatePayload: any = {
        status: novoStatus,
        observacao_matriz: observacaoMatriz || null,
        resolucao_matriz: resolucaoMatriz || null,
        updated_at: new Date().toISOString(),
      };

      if (novoStatus === "em_transito" && !selectedPedido.despachado_em) {
        updatePayload.despachado_em = new Date().toISOString();
      }

      const { error: pedErr } = await supabase
        .from("pedidos_suprimentos" as any)
        .update(updatePayload)
        .eq("id", selectedPedido.id);

      if (pedErr) throw pedErr;

      toast.success(`Pedido #${selectedPedido.id.slice(0, 6)} atualizado para status "${novoStatus}"!`);
      fetchPedidos();
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Erro ao processar despacho:", err);
      toast.error(err.message || "Erro ao salvar despacho");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEntrega = (pedido: PedidoSuprimento) => {
    setSelectedPedidoEntrega(pedido);
    setEntregaDialogOpen(true);
  };

  const handleOpenDivergencia = (pedido: PedidoSuprimento) => {
    setSelectedPedidoDivergencia(pedido);
    setResolucaoDivergencia(pedido.resolucao_matriz || "");
    setDivergenciaModalOpen(true);
  };

  const handleSalvarResolucaoDivergencia = async () => {
    if (!selectedPedidoDivergencia) return;

    if (!resolucaoDivergencia.trim()) {
      toast.error("Informe o parecer da Matriz para arquivar a divergência.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("pedidos_suprimentos" as any)
        .update({
          status: "entregue_concluido",
          resolucao_matriz: resolucaoDivergencia,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedPedidoDivergencia.id);

      if (error) throw error;

      toast.success("Divergência resolvida e pedido concluído com sucesso!");
      setDivergenciaModalOpen(false);
      fetchPedidos();
    } catch (err: any) {
      console.error("Erro ao resolver divergência:", err);
      toast.error("Erro ao resolver divergência: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_transito":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 font-semibold"><Truck className="h-3 w-3" /> Em Trânsito</Badge>;
      case "entregue":
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3 w-3" /> Entregue na Filial</Badge>;
      case "entregue_concluido":
      case "concluido":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3 w-3" /> Concluído & Conferido</Badge>;
      case "divergencia_pendente":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30 flex items-center gap-1 font-bold"><AlertTriangle className="h-3 w-3" /> Divergência Filial</Badge>;
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "pendente":
      default:
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-semibold"><Package className="h-3 w-3" /> Pendente de Separação</Badge>;
    }
  };

  const pedidosPendentes = pedidos.filter(p => p.status === "pendente");
  const pedidosEmTransito = pedidos.filter(p => p.status === "em_transito" || p.status === "entregue");
  const pedidosDivergentes = pedidos.filter(p => p.status === "divergencia_pendente");
  const pedidosConcluidos = pedidos.filter(p => p.status === "entregue_concluido" || p.status === "concluido");

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestão de Suprimentos & Auditoria de Entrega (Matriz Central)"
        description="Central de aprovação, separação, emissão de recibos físicos e conferência de comprovantes assinados."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="btn-soft font-medium border-border" onClick={() => setQrScannerOpen(true)}>
            <QrCode className="h-4 w-4 mr-2 text-primary" /> Bipar Caixa / QR
          </Button>
          <Button className="btn-wine font-medium" onClick={() => setEnvioOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Novo Despacho Direto
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="bg-card border border-border p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="pendentes" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2">
            Pendent. Separação ({pedidosPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="transito" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2">
            Em Trânsito ({pedidosEmTransito.length})
          </TabsTrigger>
          <TabsTrigger value="divergencias" className="data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive text-xs font-semibold px-4 py-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            Divergências & Auditoria ({pedidosDivergentes.length})
            {pedidosDivergentes.length > 0 && (
              <span className="bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                {pedidosDivergentes.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-xs font-semibold px-4 py-2">
            Histórico & Concluídos ({pedidosConcluidos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4 m-0">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {pedidosPendentes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum pedido pendente de separação na Matriz!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Unidade Destino</TableHead>
                    <TableHead className="text-xs">Itens Solicitados</TableHead>
                    <TableHead className="text-xs">Data Solicitação</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosPendentes.map((ped) => (
                    <TableRow key={ped.id} className="border-border hover:bg-secondary/30">
                      <TableCell className="font-bold text-foreground text-xs font-mono">#{ped.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-foreground text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {ped.unidades?.nome || "Filial"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ped.pedidos_suprimentos_itens?.length || 0} produto(s)
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(ped.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="btn-soft text-xs h-8" onClick={() => handleOpenRecibo(ped)}>
                            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir Recibo
                          </Button>
                          <Button size="sm" className="btn-wine text-xs h-8" onClick={() => handleOpenDetails(ped)}>
                            <Truck className="h-3.5 w-3.5 mr-1" /> Aprovar & Despachar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transito" className="space-y-4 m-0">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {pedidosEmTransito.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum pedido de suprimentos em trânsito no momento.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Filial Destino</TableHead>
                    <TableHead className="text-xs">Despachado em</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosEmTransito.map((ped) => (
                    <TableRow key={ped.id} className="border-border hover:bg-secondary/30">
                      <TableCell className="font-bold text-foreground text-xs font-mono">#{ped.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-foreground text-xs font-medium">{ped.unidades?.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ped.despachado_em ? format(new Date(ped.despachado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(ped.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="btn-soft text-xs h-8" onClick={() => handleOpenRecibo(ped)}>
                            <Printer className="h-3.5 w-3.5 mr-1" /> Recibo
                          </Button>
                          {ped.status === "em_transito" && (
                            <Button size="sm" className="btn-wine text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-md" onClick={() => handleOpenEntrega(ped)}>
                              <Truck className="h-3.5 w-3.5 mr-1" /> Registrar Entrega
                            </Button>
                          )}
                          {ped.status === "entregue" && (
                            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20 py-1 px-2 text-xs flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Aguardando Filial
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="divergencias" className="space-y-4 m-0">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {pedidosDivergentes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">Nenhuma divergência pendente de auditoria!</p>
                <p className="text-xs text-muted-foreground mt-1">Todos os pedidos recebidos pelas filiais foram validados sem avarias ou perdas.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Filial Destino</TableHead>
                    <TableHead className="text-xs">Data Recebimento</TableHead>
                    <TableHead className="text-xs">Divergências</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosDivergentes.map((ped) => {
                    const itensDivergentes = (ped.pedidos_suprimentos_itens || []).filter(
                      i => i.qtd_recebida !== undefined && i.qtd_recebida !== i.qtd_enviada
                    );

                    return (
                      <TableRow key={ped.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="font-bold text-foreground text-xs font-mono">#{ped.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-foreground text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {ped.unidades?.nome}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ped.recebido_em ? format(new Date(ped.recebido_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold text-destructive">
                            {itensDivergentes.length > 0 ? `${itensDivergentes.length} item(ns) c/ divergência` : "Divergência apontada"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px] font-bold">
                            Aguardando Parecer
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="btn-soft text-xs h-8" onClick={() => handleOpenRecibo(ped)}>
                              <FileCheck className="h-3.5 w-3.5 mr-1" /> Ver Canhoto
                            </Button>
                            <Button size="sm" className="btn-wine text-xs h-8 bg-destructive hover:bg-destructive/90 text-white font-bold shadow-sm" onClick={() => handleOpenDivergencia(ped)}>
                              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Auditar & Resolver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4 m-0">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-secondary/30">
                  <TableHead className="text-xs">Código</TableHead>
                  <TableHead className="text-xs">Filial Destino</TableHead>
                  <TableHead className="text-xs">Status Final</TableHead>
                  <TableHead className="text-xs">Recebido em</TableHead>
                  <TableHead className="text-xs text-right">Auditoria & Comprovante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidosConcluidos.map((ped) => (
                  <TableRow key={ped.id} className="border-border hover:bg-secondary/30">
                    <TableCell className="font-bold text-foreground text-xs font-mono">#{ped.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-foreground text-xs font-medium">{ped.unidades?.nome}</TableCell>
                    <TableCell>{getStatusBadge(ped.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ped.recebido_em ? format(new Date(ped.recebido_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="btn-wine text-xs h-8" onClick={() => handleOpenRecibo(ped)}>
                        <FileCheck className="h-3.5 w-3.5 mr-1" /> Ver Comprovante Assinado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Despacho da Matriz */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[650px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Processar Despacho do Pedido #{selectedPedido?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/30">
                    <TableHead className="py-2 text-xs">Produto</TableHead>
                    <TableHead className="py-2 text-xs text-center">Estoque Matriz</TableHead>
                    <TableHead className="py-2 text-xs text-center">Qtd Solicitada</TableHead>
                    <TableHead className="py-2 text-xs text-center w-28">Qtd a Enviar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensState.map((item) => (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="py-2 text-xs font-medium text-foreground">
                        {item.produtos?.nome || "Produto"}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {item.produtos?.estoque || 0} un
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center font-bold text-foreground font-mono">
                        {item.qtd_solicitada}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center">
                        <Input
                          type="number"
                          min="0"
                          max={item.produtos?.estoque || 999}
                          value={item.qtd_enviada}
                          onChange={(e) => handleUpdateQtdEnviada(item.id, Number(e.target.value))}
                          className="input-dark h-8 text-center font-bold"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Observação da Expedição da Matriz (opcional)</label>
              <Textarea
                placeholder="Ex: Carga despachada via transporte próprio com guia em anexo..."
                value={observacaoMatriz}
                onChange={(e) => setObservacaoMatriz(e.target.value)}
                className="input-dark text-xs resize-none h-16"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button size="sm" variant="outline" className="btn-soft text-xs" onClick={() => handleOpenRecibo(selectedPedido!)}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir Guia de Separação
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" className="btn-soft text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button className="btn-wine text-xs font-bold" onClick={handleSalvarDespachoMatriz} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Confirmar & Enviar para Filial
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Auditoria e Resolução de Divergência da Matriz */}
      <Dialog open={divergenciaModalOpen} onOpenChange={setDivergenciaModalOpen}>
        <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Auditoria de Divergência - Pedido #{selectedPedidoDivergencia?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-secondary/30 rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Filial Destino:</span>
                <span className="font-bold text-foreground">{selectedPedidoDivergencia?.unidades?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recebido & Conferido em:</span>
                <span className="font-bold text-foreground">
                  {selectedPedidoDivergencia?.recebido_em ? format(new Date(selectedPedidoDivergencia.recebido_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                </span>
              </div>
              {selectedPedidoDivergencia?.observacao_recebimento && (
                <div className="pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground font-semibold">Observações do Recebimento pela Filial:</span>
                  <p className="text-foreground mt-0.5 text-xs bg-card p-2 rounded-lg border border-border">
                    {selectedPedidoDivergencia.observacao_recebimento}
                  </p>
                </div>
              )}
            </div>

            {/* Tabela Comparativa de Itens */}
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-secondary/40">
                    <TableHead className="py-2 text-xs font-bold text-foreground">Produto</TableHead>
                    <TableHead className="py-2 text-xs font-bold text-foreground text-center">Enviado</TableHead>
                    <TableHead className="py-2 text-xs font-bold text-foreground text-center">Recebido</TableHead>
                    <TableHead className="py-2 text-xs font-bold text-foreground text-center">Diferença</TableHead>
                    <TableHead className="py-2 text-xs font-bold text-foreground">Motivo Apontado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedPedidoDivergencia?.pedidos_suprimentos_itens || []).map((item) => {
                    const diff = (item.qtd_recebida || 0) - (item.qtd_enviada || 0);
                    const hasDivergence = diff !== 0;

                    return (
                      <TableRow key={item.id} className={`border-border ${hasDivergence ? "bg-destructive/5" : ""}`}>
                        <TableCell className="py-2 text-xs font-medium text-foreground">
                          {item.produtos?.nome || "Produto"}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-center font-mono font-bold text-foreground">
                          {item.qtd_enviada} un
                        </TableCell>
                        <TableCell className="py-2 text-xs text-center font-mono font-bold text-foreground">
                          {item.qtd_recebida !== undefined ? `${item.qtd_recebida} un` : "-"}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-center font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                          ) : (
                            <span className="text-destructive font-black">{diff > 0 ? `+${diff}` : `${diff}`} un</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-xs text-muted-foreground">
                          {item.motivo_divergencia || (diff !== 0 ? "Falta / Avaria não descrita" : "-")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Parecer e Resolução da Matriz Central
              </label>
              <Textarea
                placeholder="Descreva a ação tomada pela Matriz (Ex: 'Aprovado ressarcimento da avaria. Reposição autorizada no próximo ciclo...')"
                value={resolucaoDivergencia}
                onChange={(e) => setResolucaoDivergencia(e.target.value)}
                className="input-dark text-xs resize-none h-20"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button size="sm" variant="outline" className="btn-soft text-xs" onClick={() => handleOpenRecibo(selectedPedidoDivergencia!)}>
                <FileCheck className="h-3.5 w-3.5 mr-1" /> Ver Canhoto Assinado
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" className="btn-soft text-xs" onClick={() => setDivergenciaModalOpen(false)}>Cancelar</Button>
                <Button className="btn-wine text-xs font-bold" onClick={handleSalvarResolucaoDivergencia} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Concluir & Registrar Resolução
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReciboSuprimentosDialog
        pedido={selectedPedidoRecibo}
        open={reciboOpen}
        onOpenChange={setReciboOpen}
      />

      <EnvioDiretoSuprimentoDialog
        open={envioOpen}
        onOpenChange={setEnvioOpen}
        onSuccess={fetchPedidos}
      />

      <ConfirmarEntregaDialog
        pedido={selectedPedidoEntrega}
        open={entregaDialogOpen}
        onOpenChange={setEntregaDialogOpen}
        onSuccess={fetchPedidos}
      />

      <QrScannerDialog
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onSuccess={fetchPedidos}
      />
    </div>
  );
}
