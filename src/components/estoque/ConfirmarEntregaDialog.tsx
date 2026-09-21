import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Truck, Upload, CheckCircle2, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface ConfirmarEntregaDialogProps {
  pedido: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ConfirmarEntregaDialog({ pedido, open, onOpenChange, onSuccess }: ConfirmarEntregaDialogProps) {
  const { empresaId } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fotoCaixaUrl, setFotoCaixaUrl] = useState<string | null>(null);
  const [observacaoEntregador, setObservacaoEntregador] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pedido) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `entrega_caixa_${pedido.id.slice(0, 8)}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("comprovantes").upload(filePath, file, { upsert: true });

      if (uploadError) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoCaixaUrl(reader.result as string);
          toast.success("Foto da caixa anexada com sucesso!");
        };
        reader.readAsDataURL(file);
      } else {
        const { data: publicUrlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);
        setFotoCaixaUrl(publicUrlData.publicUrl);
        toast.success("Foto da caixa entregue salva com sucesso!");
      }
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmarEntrega = async () => {
    if (!pedido) return;
    if (!fotoCaixaUrl) {
      toast.error("⚠️ Anexe a foto da caixa entregue na unidade.");
      return;
    }

    setLoading(true);
    try {
      const obsEntregadorTxt = `[FOTO CAIXA ENTREGUE: ${fotoCaixaUrl}] ${observacaoEntregador || ""}`;

      const { error } = await supabase
        .from("pedidos_suprimentos" as any)
        .update({
          status: "entregue",
          observacao_matriz: `${pedido.observacao_matriz || ""} | ${obsEntregadorTxt}`,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", pedido.id);

      if (error) throw error;

      toast.success("Status atualizado para ENTREGUE! A Unidade foi notificada para conferência final.");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao confirmar entrega:", err);
      toast.error(err.message || "Erro ao registrar entrega");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Truck className="h-5 w-5 text-primary" />
            Registrar Entrega de Suprimentos (Perfil Entregador)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-secondary/30 rounded-lg text-xs border border-border">
            <span className="font-bold text-foreground">Pedido #{pedido?.id?.slice(0, 8)}</span>
            <p className="text-muted-foreground mt-0.5">Destino: {pedido?.unidades?.nome || "Unidade"}</p>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  Foto da Caixa Entregue na Unidade (Obrigatório) *
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tire uma foto da caixa no balcão/porta da unidade.
                </p>
              </div>

              <div className="relative shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="caixa-file-input"
                />
                <label
                  htmlFor="caixa-file-input"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-800 to-amber-700 hover:from-red-700 hover:to-amber-600 active:scale-95 transition-all cursor-pointer shadow-lg border border-amber-500/30"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>Anexar Foto</span>
                </label>
              </div>
            </div>

            {fotoCaixaUrl ? (
              <div className="flex items-center gap-3 p-2 bg-card rounded-lg border border-emerald-500/30 text-xs">
                <div className="w-12 h-12 rounded overflow-hidden bg-black/40 flex items-center justify-center">
                  <img src={fotoCaixaUrl} alt="Caixa Entregue" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Foto Anexada com Sucesso!
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-warning flex items-center gap-1.5 font-medium">
                ⚠️ Tire uma foto da caixa entregue para atualizar o status.
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Observação do Entregador (opcional)</label>
            <Textarea
              placeholder="Ex: Deixado no balcão da recepção aos cuidados do recebedor..."
              value={observacaoEntregador}
              onChange={(e) => setObservacaoEntregador(e.target.value)}
              className="input-dark text-xs resize-none h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="btn-wine text-xs" onClick={handleConfirmarEntrega} disabled={loading || !fotoCaixaUrl}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Status ENTREGUE
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
