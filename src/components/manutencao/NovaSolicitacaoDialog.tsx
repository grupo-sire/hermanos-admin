import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Camera, Check, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compressor";

interface NovaSolicitacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaSolicitacaoDialog({ open, onOpenChange, onSuccess }: NovaSolicitacaoDialogProps) {
  const { empresaId } = useEmpresa();
  const { selectedUnidadeId } = useUnidade();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("Equipamento/Móvel");
  const [prioridade, setPrioridade] = useState("media");
  const [descricao, setDescricao] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      // Comprime a imagem reduzindo arquivos de 10MB para <200KB
      const compressedBase64 = await compressImage(file, { maxWidth: 1200, quality: 0.75 });
      setFotoUrl(compressedBase64);
      toast.success("Foto otimizada e comprimida com sucesso!");
    } catch (err) {
      toast.error("Erro ao comprimir imagem.");
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async () => {
    if (!titulo || !descricao) {
      toast.error("Preencha o título e a descrição do problema.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("solicitacoes_manutencao" as any).insert({
        empresa_id: empresaId,
        unidade_id: selectedUnidadeId,
        solicitante_id: user?.id,
        titulo: titulo.trim(),
        categoria,
        prioridade,
        descricao: descricao.trim(),
        foto_solicitacao_url: fotoUrl || null,
        status: "pendente",
      });

      if (error) throw error;

      toast.success("Solicitação de manutenção enviada com sucesso!");
      setTitulo("");
      setDescricao("");
      setFotoUrl("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao enviar solicitação: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🛠️ Nova Solicitação de Manutenção
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold">Título do Problema *</Label>
            <Input
              placeholder="Ex: Cadeira de barbeiro 02 travada / Ar-condicionado pingando"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Equipamento/Móvel">Cadeira / Móveis</SelectItem>
                  <SelectItem value="Ar-condicionado">Ar-condicionado</SelectItem>
                  <SelectItem value="Hidráulica">Hidráulica / Lavatório</SelectItem>
                  <SelectItem value="Elétrica">Elétrica / Iluminação</SelectItem>
                  <SelectItem value="Estrutural">Estrutural / Pintura</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="urgente">🚨 URGENTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Descrição do Defeito *</Label>
            <Textarea
              placeholder="Descreva com detalhes o que aconteceu, horários de pico e localização na unidade..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 resize-none h-24"
            />
          </div>

          {/* Compressor de Imagem */}
          <div>
            <Label className="text-xs font-semibold">Foto do Problema (Otimização Automática)</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border hover:border-primary/50 rounded-xl bg-secondary/20 transition-all text-xs font-medium text-muted-foreground hover:text-foreground">
                {compressing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Comprimindo foto no navegador...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-primary" />
                    {fotoUrl ? "Trocar Foto Anexada" : "Anexar Foto (Compressão Ultra-leve)"}
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={compressing}
                />
              </label>

              {fotoUrl && (
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-primary/30 flex-shrink-0">
                  <img src={fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 right-0 bg-success text-white text-[8px] p-0.5 rounded-tl">
                    <Check className="h-3 w-3" />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || compressing} className="btn-wine">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
