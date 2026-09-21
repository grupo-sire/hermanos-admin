import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";

const campanhaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.enum(["lembrete", "aniversario", "cashback", "promocao"]),
  mensagem: z.string().optional(),
  desconto_percentual: z.number().min(0).max(100).optional().nullable(),
  cashback_percentual: z.number().min(0).max(100).optional().nullable(),
  dias_antecedencia: z.number().min(0).optional(),
  dias_inatividade: z.number().min(1).optional(),
  status: z.enum(["active", "inactive"]),
});

type CampanhaForm = z.infer<typeof campanhaSchema>;

type Campanha = {
  id: string;
  nome: string;
  tipo: string;
  mensagem?: string | null;
  desconto_percentual: number | null;
  cashback_percentual: number | null;
  dias_antecedencia?: number | null;
  dias_inatividade?: number | null;
  status: string;
};

interface CampanhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: Campanha | null;
  onSuccess: () => void;
}

export function CampanhaDialog({ open, onOpenChange, campanha, onSuccess }: CampanhaDialogProps) {
  const { empresaId } = useEmpresa();
  const form = useForm<CampanhaForm>({
    resolver: zodResolver(campanhaSchema),
    defaultValues: {
      nome: "",
      tipo: "promocao",
      mensagem: "",
      desconto_percentual: null,
      cashback_percentual: null,
      dias_antecedencia: 7,
      dias_inatividade: 30,
      status: "active",
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  const tipo = form.watch("tipo");
  const mensagem = form.watch("mensagem");
  const descontoVal = form.watch("desconto_percentual");
  const cashbackVal = form.watch("cashback_percentual");

  const previewMsg = useMemo(() => {
    if (!mensagem) return null;
    let msg = mensagem;
    msg = msg.replace(/\{\{nome\}\}/g, "João Silva");
    msg = msg.replace(/\{\{empresa\}\}/g, "Minha Empresa");
    msg = msg.replace(/\{\{desconto\}\}/g, descontoVal ? `${descontoVal}%` : "10%");
    msg = msg.replace(/\{\{cashback\}\}/g, cashbackVal ? `${cashbackVal}%` : "5%");
    return msg;
  }, [mensagem, descontoVal, cashbackVal]);

  useEffect(() => {
    if (campanha) {
      form.reset({
        nome: campanha.nome,
        tipo: campanha.tipo as CampanhaForm["tipo"],
        mensagem: campanha.mensagem || "",
        desconto_percentual: campanha.desconto_percentual,
        cashback_percentual: campanha.cashback_percentual,
        dias_antecedencia: campanha.dias_antecedencia || 7,
        dias_inatividade: campanha.dias_inatividade || 30,
        status: campanha.status as "active" | "inactive",
      });
    } else {
      form.reset({
        nome: "",
        tipo: "promocao",
        mensagem: "",
        desconto_percentual: null,
        cashback_percentual: null,
        dias_antecedencia: 7,
        dias_inatividade: 30,
        status: "active",
      });
    }
  }, [campanha, form]);

  async function onSubmit(values: CampanhaForm) {
    try {
      const payload = {
        nome: values.nome,
        tipo: values.tipo,
        mensagem: values.mensagem || null,
        desconto_percentual: values.tipo === "promocao" || values.tipo === "aniversario" ? values.desconto_percentual : null,
        cashback_percentual: values.tipo === "cashback" ? values.cashback_percentual : null,
        dias_antecedencia: values.tipo === "aniversario" ? values.dias_antecedencia : null,
        dias_inatividade: values.tipo === "lembrete" ? values.dias_inatividade : null,
        status: values.status,
      };

      if (campanha) {
        const { error } = await supabase.from("campanhas")
          .update(payload)
          .eq("id", campanha.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        toast.success("Campanha atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("campanhas")
          .insert({ ...payload, empresa_id: empresaId });
        if (error) throw error;
        toast.success("Campanha criada com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar campanha:", error);
      toast.error("Erro ao salvar campanha");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campanha ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Campanha *</Label>
            <Input
              id="nome"
              {...form.register("nome")}
              placeholder="Ex: Promoção de Verão"
              className="input-dark"
            />
            {form.formState.errors.nome && (
              <p className="text-destructive text-xs">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.watch("tipo")}
              onValueChange={(v) => form.setValue("tipo", v as CampanhaForm["tipo"])}
            >
              <SelectTrigger className="input-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="promocao">Promoção</SelectItem>
                <SelectItem value="lembrete">Lembrete de Retorno</SelectItem>
                <SelectItem value="aniversario">Aniversário do Cliente</SelectItem>
                <SelectItem value="cashback">Cashback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">Mensagem</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {[
                { label: "Nome", value: "{{nome}}" },
                { label: "Empresa", value: "{{empresa}}" },
                ...(tipo === "promocao" || tipo === "aniversario" ? [{ label: "Desconto", value: "{{desconto}}" }] : []),
                ...(tipo === "cashback" ? [{ label: "Cashback", value: "{{cashback}}" }] : []),
              ].map((v) => (
                <Button
                  key={v.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => {
                    const el = document.getElementById("mensagem") as HTMLTextAreaElement;
                    if (el) {
                      const start = el.selectionStart;
                      const end = el.selectionEnd;
                      const current = form.getValues("mensagem") || "";
                      const newVal = current.slice(0, start) + v.value + current.slice(end);
                      form.setValue("mensagem", newVal);
                      setTimeout(() => { el.focus(); el.setSelectionRange(start + v.value.length, start + v.value.length); }, 0);
                    } else {
                      form.setValue("mensagem", (form.getValues("mensagem") || "") + v.value);
                    }
                  }}
                >
                  {v.label}
                </Button>
              ))}
            </div>
            <Textarea
              id="mensagem"
              {...form.register("mensagem")}
              placeholder="Mensagem a ser enviada ao cliente... Use os botões acima para inserir variáveis."
              className="input-dark min-h-[80px]"
            />
          </div>

          {/* Preview da mensagem */}
          {previewMsg && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" /> Pré-visualização
              </Label>
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm whitespace-pre-wrap">
                {previewMsg}
              </div>
            </div>
          )}

          {(tipo === "promocao" || tipo === "aniversario") && (
            <div className="space-y-2">
              <Label htmlFor="desconto_percentual">Desconto (%)</Label>
              <Input
                id="desconto_percentual"
                type="number"
                step="0.01"
                {...form.register("desconto_percentual", { valueAsNumber: true })}
                placeholder="Ex: 10"
                className="input-dark"
              />
            </div>
          )}

          {tipo === "cashback" && (
            <div className="space-y-2">
              <Label htmlFor="cashback_percentual">Cashback (%)</Label>
              <Input
                id="cashback_percentual"
                type="number"
                step="0.01"
                {...form.register("cashback_percentual", { valueAsNumber: true })}
                placeholder="Ex: 5"
                className="input-dark"
              />
            </div>
          )}

          {tipo === "aniversario" && (
            <div className="space-y-2">
              <Label htmlFor="dias_antecedencia">Dias de Antecedência</Label>
              <Input
                id="dias_antecedencia"
                type="number"
                {...form.register("dias_antecedencia", { valueAsNumber: true })}
                className="input-dark"
              />
              <p className="text-xs text-muted-foreground">
                Quantos dias antes do aniversário enviar a mensagem
              </p>
            </div>
          )}

          {tipo === "lembrete" && (
            <div className="space-y-2">
              <Label htmlFor="dias_inatividade">Dias de Inatividade</Label>
              <Input
                id="dias_inatividade"
                type="number"
                {...form.register("dias_inatividade", { valueAsNumber: true })}
                className="input-dark"
              />
              <p className="text-xs text-muted-foreground">
                Enviar lembrete após quantos dias sem visita
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="status">Ativa</Label>
            <Switch
              id="status"
              checked={form.watch("status") === "active"}
              onCheckedChange={(checked) => form.setValue("status", checked ? "active" : "inactive")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="btn-wine">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {campanha ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
