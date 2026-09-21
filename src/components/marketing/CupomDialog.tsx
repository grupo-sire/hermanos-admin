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
import { Loader2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";

const cupomSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").toUpperCase(),
  tipo: z.enum(["percentual", "valor_fixo"]),
  valor: z.number().min(0.01, "Valor deve ser maior que 0"),
  minimo_compra: z.number().min(0).optional(),
  data_fim: z.string().optional(),
  max_usos: z.number().min(1).optional().nullable(),
  status: z.enum(["active", "inactive"]),
});

type CupomForm = z.infer<typeof cupomSchema>;

type Cupom = {
  id: string;
  codigo: string;
  tipo: string;
  valor: number;
  minimo_compra?: number | null;
  data_fim: string | null;
  max_usos: number | null;
  status: string;
};

interface CupomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cupom: Cupom | null;
  onSuccess: () => void;
}

export function CupomDialog({ open, onOpenChange, cupom, onSuccess }: CupomDialogProps) {
  const { empresaId } = useEmpresa();
  const form = useForm<CupomForm>({
    resolver: zodResolver(cupomSchema),
    defaultValues: {
      codigo: "",
      tipo: "percentual",
      valor: 10,
      minimo_compra: 0,
      data_fim: "",
      max_usos: null,
      status: "active",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (cupom) {
      form.reset({
        codigo: cupom.codigo,
        tipo: cupom.tipo as "percentual" | "valor_fixo",
        valor: cupom.valor,
        minimo_compra: cupom.minimo_compra || 0,
        data_fim: cupom.data_fim ? cupom.data_fim.split("T")[0] : "",
        max_usos: cupom.max_usos,
        status: cupom.status as "active" | "inactive",
      });
    } else {
      form.reset({
        codigo: "",
        tipo: "percentual",
        valor: 10,
        minimo_compra: 0,
        data_fim: "",
        max_usos: null,
        status: "active",
      });
    }
  }, [cupom, form]);

  async function onSubmit(values: CupomForm) {
    try {
      const payload = {
        codigo: values.codigo.toUpperCase(),
        tipo: values.tipo,
        valor: values.valor,
        minimo_compra: values.minimo_compra || 0,
        data_fim: values.data_fim || null,
        max_usos: values.max_usos || null,
        status: values.status,
      };

      if (cupom) {
        const { error } = await supabase.from("cupons")
          .update(payload)
          .eq("id", cupom.id)
          .eq("empresa_id", empresaId);
        if (error) throw error;
        toast.success("Cupom atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("cupons")
          .insert({ ...payload, empresa_id: empresaId });
        if (error) throw error;
        toast.success("Cupom criado com sucesso!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar cupom:", error);
      if (error.code === "23505") {
        toast.error("Já existe um cupom com este código");
      } else {
        toast.error("Erro ao salvar cupom");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cupom ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código do Cupom *</Label>
            <Input
              id="codigo"
              {...form.register("codigo")}
              placeholder="EX: DESCONTO10"
              className="input-dark uppercase"
            />
            {form.formState.errors.codigo && (
              <p className="text-destructive text-xs">{form.formState.errors.codigo.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Desconto</Label>
              <Select
                value={form.watch("tipo")}
                onValueChange={(v) => form.setValue("tipo", v as "percentual" | "valor_fixo")}
              >
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                {...form.register("valor", { valueAsNumber: true })}
                className="input-dark"
              />
              {form.formState.errors.valor && (
                <p className="text-destructive text-xs">{form.formState.errors.valor.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimo_compra">Mínimo de Compra (R$)</Label>
              <Input
                id="minimo_compra"
                type="number"
                step="0.01"
                {...form.register("minimo_compra", { valueAsNumber: true })}
                className="input-dark"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_usos">Limite de Usos</Label>
              <Input
                id="max_usos"
                type="number"
                {...form.register("max_usos", { valueAsNumber: true })}
                placeholder="Ilimitado"
                className="input-dark"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_fim">Data de Expiração</Label>
            <Input
              id="data_fim"
              type="date"
              {...form.register("data_fim")}
              className="input-dark"
            />
          </div>

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
              {cupom ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
