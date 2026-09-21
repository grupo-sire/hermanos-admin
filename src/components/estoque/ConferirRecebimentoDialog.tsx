import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, PackageCheck, Upload, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface PedidoItem {
  id: string;
  produto_id: string;
  qtd_solicitada: number;
  qtd_enviada: number;
  qtd_recebida: number;
  motivo_divergencia?: string | null;
  produtos?: { nome: string } | null;
}

interface PedidoSuprimento {
  id: string;
  unidade_id: string;
  status: string;
  observacao_matriz: string | null;
  created_at: string;
  despachado_em: string | null;
  pedidos_suprimentos_itens?: PedidoItem[];
}

interface ConferirRecebimentoDialogProps {
  pedido: PedidoSuprimento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ConferirRecebimentoDialog({ pedido, open, onOpenChange, onSuccess }: ConferirRecebimentoDialogProps) {
  const { empresaId } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [itensState, setItensState] = useState<PedidoItem[]>([]);
  const [observacaoRecebimento, setObservacaoRecebimento] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open && pedido) {
      setObservacaoRecebimento("");
      setComprovanteUrl(null);
      const formatted = (pedido.pedidos_suprimentos_itens || []).map(item => ({
        ...item,
        qtd_recebida: item.qtd_enviada,
        motivo_divergencia: "",
      }));
      setItensState(formatted);
    }
  }, [open, pedido]);

  const handleUpdateQtdRecebida = (itemId: string, val: number) => {
    setItensState(prev => prev.map(i => i.id === itemId ? { ...i, qtd_recebida: val } : i));
  };

  const handleUpdateMotivo = (itemId: string, val: string) => {
    setItensState(prev => prev.map(i => i.id === itemId ? { ...i, motivo_divergencia: val } : i));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `recibo_assinado_${pedido?.id?.slice(0, 8)}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("comprovantes").upload(filePath, file, { upsert: true });

      if (uploadError) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setComprovanteUrl(reader.result as string);
          toast.success("Foto do recibo assinado anexada com sucesso!");
        };
        reader.readAsDataURL(file);
      } else {
        const { data: publicUrlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);
        setComprovanteUrl(publicUrlData.publicUrl);
        toast.success("Foto do recibo assinado enviada com sucesso!");
      }
    } catch (err: any) {
      toast.error("Erro ao carregar foto: " + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleConfirmarRecebimento = async () => {
    if (!pedido) return;

    if (!comprovanteUrl) {
      toast.error("⚠️ Anexe a foto do recibo assinado para liberar a entrada no estoque da filial!");
      return;
    }

    const itemComDivergenciaSemMotivo = itensState.find(
      i => i.qtd_recebida !== i.qtd_enviada && (!i.motivo_divergencia || !i.motivo_divergencia.trim())
    );

    if (itemComDivergenciaSemMotivo) {
      toast.error(`Informe o motivo da divergência para o produto "${itemComDivergenciaSemMotivo.produtos?.nome}"`);
      return;
    }

    setLoading(true);
    try {
      let temDivergencia = false;

      for (const item of itensState) {
        if (item.qtd_recebida !== item.qtd_enviada) {
          temDivergencia = true;
        }

        const { error: itemErr } = await supabase
          .from("pedidos_suprimentos_itens" as any)
          .update({
            qtd_recebida: item.qtd_recebida,
            motivo_divergencia: item.motivo_divergencia || null,
            status_item: item.qtd_recebida === item.qtd_enviada ? "completo" : "divergente",
          } as any)
          .eq("id", item.id);

        if (itemErr) throw itemErr;

        if (item.qtd_recebida > 0) {
          const { data: efData } = await supabase
            .from("estoque_filial")
            .select("quantidade")
            .eq("unidade_id", pedido.unidade_id)
            .eq("produto_id", item.produto_id)
            .maybeSingle();

          const currentQty = efData?.quantidade !== undefined ? Number(efData.quantidade) : 0;
          const novoEstoque = currentQty + item.qtd_recebida;

          await supabase
            .from("estoque_filial")
            .upsert({
              empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
              unidade_id: pedido.unidade_id,
              produto_id: item.produto_id,
              quantidade: novoEstoque,
              updated_at: new Date().toISOString()
            }, { onConflict: "unidade_id,produto_id" });

          await supabase.from("estoque_movimentacoes").insert({
            produto_id: item.produto_id,
            tipo: "entrada",
            quantidade: item.qtd_recebida,
            observacao: `Recebimento de Suprimento com Recibo Assinado (Pedido #${pedido.id.slice(0, 6)})`,
            unidade_id: pedido.unidade_id,
            empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
          });
        }
      }

      const novoStatus = temDivergencia ? "divergencia_pendente" : "entregue_concluido";
      const obsFinal = `[COMPROVANTE ANEXADO: ${comprovanteUrl}] ${observacaoRecebimento || ""}`;

      const { error: pedErr } = await supabase
        .from("pedidos_suprimentos" as any)
        .update({
          status: novoStatus,
          observacao_recebimento: obsFinal,
          recebido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", pedido.id);

      if (pedErr) throw pedErr;

      if (temDivergencia) {
        toast.warning("Recebimento confirmado com DIVERGÊNCIAS. A Matriz foi notificada para auditoria.");
      } else {
        toast.success("Recebimento confirmado! Recibo anexado e estoque da filial atualizado.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao confirmar recebimento:", err);
      toast.error(err.message || "Erro ao confirmar recebimento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-card border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <PackageCheck className="h-5 w-5 text-primary" />
            Conferir Recebimento & Anexar Recibo Assinado (Matriz ➔ Filial)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {pedido?.observacao_matriz && (
            <div className="p-3 bg-secondary/30 rounded-lg text-xs border border-border">
              <span className="font-bold text-info">Obs da Matriz no Despacho:</span> {pedido.observacao_matriz}
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="py-2 text-xs">Produto</TableHead>
                  <TableHead className="py-2 text-xs text-center">Despachado</TableHead>
                  <TableHead className="py-2 text-xs text-center w-28">Qtd Recebida</TableHead>
                  <TableHead className="py-2 text-xs">Motivo Divergência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensState.map((item) => {
                  const temDivergencia = item.qtd_recebida !== item.qtd_enviada;
                  return (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="py-2 text-xs font-medium text-foreground">
                        {item.produtos?.nome || "Produto"}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center font-bold text-foreground">
                        {item.qtd_enviada}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center">
                        <Input
                          type="number"
                          min="0"
                          max={item.qtd_enviada * 2}
                          value={item.qtd_recebida}
                          onChange={(e) => handleUpdateQtdRecebida(item.id, Number(e.target.value))}
                          className={`input-dark h-8 text-center font-bold ${temDivergencia ? 'text-warning border-warning' : 'text-success'}`}
                        />
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <Input
                          placeholder={temDivergencia ? "Motivo obrigatório..." : "Opcional"}
                          value={item.motivo_divergencia || ""}
                          onChange={(e) => handleUpdateMotivo(item.id, e.target.value)}
                          className={`input-dark h-8 text-xs ${temDivergencia && !item.motivo_divergencia ? 'border-warning/50' : ''}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* OBRIGATÓRIO: ANEXAR FOTO DO RECIBO ASSINADO */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Foto do Recibo Físico Assinado (Obrigatório) *
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tire uma foto do recibo impresso com a assinatura da recepção/gerente da filial.
                </p>
              </div>

              <div className="relative shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="recibo-file-input"
                />
                <label
                  htmlFor="recibo-file-input"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 active:scale-95 transition-all cursor-pointer shadow-lg border border-amber-500/30"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Upload className="h-4 w-4 text-amber-300" />
                  )}
                  <span>Anexar Foto</span>
                </label>
              </div>
            </div>

            {comprovanteUrl ? (
              <div className="flex items-center gap-3 p-2 bg-card rounded-lg border border-emerald-500/30 text-xs">
                <div className="w-12 h-12 rounded overflow-hidden bg-black/40 flex items-center justify-center">
                  <img src={comprovanteUrl} alt="Recibo Assinado" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Comprovante Anexado com Sucesso!
                  </span>
                  <p className="text-[10px] text-muted-foreground">Pronto para liberar a entrada no estoque.</p>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-warning flex items-center gap-1.5 font-medium">
                ⚠️ Entrada no estoque bloqueada até o envio da foto do recibo assinado.
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Observação Geral do Recebimento (opcional)</label>
            <Textarea
              placeholder="Ex: Tudo entregue em ordem..."
              value={observacaoRecebimento}
              onChange={(e) => setObservacaoRecebimento(e.target.value)}
              className="input-dark text-xs resize-none h-14"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="btn-soft text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              className="btn-wine text-xs"
              onClick={handleConfirmarRecebimento}
              disabled={loading || !comprovanteUrl}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirmar Recebimento & Dar Entrada no Estoque
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
