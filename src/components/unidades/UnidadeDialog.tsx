import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const unidadeSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  endereco: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres").max(200),
  telefone: z.string().max(20).optional().or(z.literal("")),
  horario_abertura: z.string().min(1, "Horário de abertura é obrigatório"),
  horario_fechamento: z.string().min(1, "Horário de fechamento é obrigatório"),
  status: z.enum(["active", "inactive"]),
});

type UnidadeFormData = z.infer<typeof unidadeSchema>;

interface UnidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidade?: Tables<"unidades"> | null;
  onSuccess: () => void;
}

export function UnidadeDialog({
  open,
  onOpenChange,
  unidade,
  onSuccess,
}: UnidadeDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!unidade;

  const form = useForm<UnidadeFormData>({
    resolver: zodResolver(unidadeSchema),
    defaultValues: {
      nome: "",
      endereco: "",
      telefone: "",
      horario_abertura: "09:00",
      horario_fechamento: "20:00",
      status: "active",
    },
  });

  useEffect(() => {
    if (unidade) {
      form.reset({
        nome: unidade.nome,
        endereco: unidade.endereco,
        telefone: unidade.telefone || "",
        horario_abertura: unidade.horario_abertura,
        horario_fechamento: unidade.horario_fechamento,
        status: unidade.status as "active" | "inactive",
      });
    } else {
      form.reset({
        nome: "",
        endereco: "",
        telefone: "",
        horario_abertura: "09:00",
        horario_fechamento: "20:00",
        status: "active",
      });
    }
  }, [unidade, form]);

  const onSubmit = async (data: UnidadeFormData) => {
    setLoading(true);
    try {
      const payload = {
        nome: data.nome.trim(),
        endereco: data.endereco.trim(),
        telefone: data.telefone?.trim() || null,
        horario_abertura: data.horario_abertura,
        horario_fechamento: data.horario_fechamento,
        status: data.status,
      };

      if (isEditing && unidade) {
        const { error } = await supabase
          .from("unidades")
          .update(payload)
          .eq("id", unidade.id);

        if (error) throw error;
        toast({ title: "Unidade atualizada com sucesso!" });
      } else {
        const { error } = await supabase.from("unidades").insert(payload);

        if (error) throw error;
        toast({ title: "Unidade cadastrada com sucesso!" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar unidade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-white/10">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Unidade" : "Nova Unidade"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input {...field} className="input-dark" placeholder="Nome da unidade" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço *</FormLabel>
                  <FormControl>
                    <Input {...field} className="input-dark" placeholder="Rua, número - Bairro" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} className="input-dark" placeholder="(11) 3333-1234" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="horario_abertura"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abertura *</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" className="input-dark" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horario_fechamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fechamento *</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" className="input-dark" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-white/10">
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10"
              >
                Cancelar
              </Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
