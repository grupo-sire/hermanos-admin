import { useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";

const planoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  pontos_por_real: z.number().min(0.01, "Deve ser maior que 0"),
  pontos_para_resgate: z.number().min(1, "Deve ser pelo menos 1"),
  valor_resgate: z.number().min(0.01, "Deve ser maior que 0"),
  status: z.enum(["active", "inactive"]),
});

type PlanoForm = z.infer<typeof planoSchema>;

type PlanoFidelidade = {
  id: string;
  nome: string;
  descricao?: string | null;
  pontos_por_real: number;
  pontos_para_resgate: number;
  valor_resgate: number;
  status: string;
};

interface FidelidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: PlanoFidelidade | null;
  onSuccess: () => void;
}

export function FidelidadeDialog({ open, onOpenChange, plano, onSuccess }: FidelidadeDialogProps) {
  const { empresaId } = useEmpresa();
  const form = useForm<PlanoForm>({
    resolver: zodResolver(planoSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      pontos_por_real: 1,
      pontos_para_resgate: 100,
      valor_resgate: 10,
      status: "active",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (plano) {
      form.reset({
        nome: plano.nome,
        descricao: plano.descricao || "",
        pontos_por_real: plano.pontos_por_real,
        pontos_para_resgate: plano.pontos_para_resgate,
        valor_resgate: plano.valor_resgate,
        status: plano.status as "active" | "inactive",
      });
    } else {
      form.reset({
        nome: "",
        descricao: "",
        pontos_por_real: 1,
        pontos_para_resgate: 100,
        valor_resgate: 10,
        status: "active",
      });
    }
  }, [plano, form]);

  async function onSubmit(values: PlanoForm) {
    try {
      const payload = {
        nome: values.nome,
        descricao: values.descricao || null,
        pontos_por_real: values.pontos_por_real,
        pontos_para_resgate: values.pontos_para_resgate,
        valor_resgate: values.valor_resgate,
        status: values.status,
      };

      if (plano) {
        const { error } = await supabase.from("planos_fidelidade")
          .update(payload)
          .eq("id", plano.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("planos_fidelidade")
          .insert({ ...payload, empresa_id: empresaId });
        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      toast.error("Erro ao salvar plano");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plano ? "Editar Plano de Fidelidade" : "Novo Plano de Fidelidade"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Plano *</Label>
            <Input
              id="nome"
              {...form.register("nome")}
              placeholder="Ex: Programa de Pontos"
              className="input-dark"
            />
            {form.formState.errors.nome && (
              <p className="text-destructive text-xs">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              {...form.register("descricao")}
              placeholder="Descrição do plano..."
              className="input-dark min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pontos_por_real">Pontos por R$ 1,00</Label>
            <Input
              id="pontos_por_real"
              type="number"
              step="0.01"
              {...form.register("pontos_por_real", { valueAsNumber: true })}
              className="input-dark"
            />
            {form.formState.errors.pontos_por_real && (
              <p className="text-destructive text-xs">{form.formState.errors.pontos_por_real.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Quantos pontos o cliente ganha por cada R$ 1,00 gasto
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pontos_para_resgate">Pontos para Resgate</Label>
              <Input
                id="pontos_para_resgate"
                type="number"
                {...form.register("pontos_para_resgate", { valueAsNumber: true })}
                className="input-dark"
              />
              {form.formState.errors.pontos_para_resgate && (
                <p className="text-destructive text-xs">{form.formState.errors.pontos_para_resgate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_resgate">Valor do Resgate (R$)</Label>
              <Input
                id="valor_resgate"
                type="number"
                step="0.01"
                {...form.register("valor_resgate", { valueAsNumber: true })}
                className="input-dark"
              />
              {form.formState.errors.valor_resgate && (
                <p className="text-destructive text-xs">{form.formState.errors.valor_resgate.message}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded-lg">
            Exemplo: Com {form.watch("pontos_para_resgate") || 100} pontos, o cliente ganha R$ {(form.watch("valor_resgate") || 10).toFixed(2)} de desconto
          </p>

          <div className="flex items-center justify-between">
            <Label htmlFor="status">Ativo</Label>
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
              {plano ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
