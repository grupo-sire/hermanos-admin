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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useCategorias } from "@/hooks/useCategorias";

const servicoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  preco: z.string().min(1, "Preço é obrigatório"),
  duracao_minutos: z.string().min(1, "Duração é obrigatória"),
  categoria: z.string().max(50).optional().or(z.literal("")),
  descricao: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

type ServicoFormData = z.infer<typeof servicoSchema>;

interface ServicoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico?: Tables<"servicos"> | null;
  onSuccess: () => void;
}

export function ServicoDialog({
  open,
  onOpenChange,
  servico,
  onSuccess,
}: ServicoDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!servico;
  const { categorias } = useCategorias("servico");

  const form = useForm<ServicoFormData>({
    resolver: zodResolver(servicoSchema),
    defaultValues: {
      nome: "",
      preco: "",
      duracao_minutos: "30",
      categoria: "",
      descricao: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (servico) {
      form.reset({
        nome: servico.nome,
        preco: String(servico.preco),
        duracao_minutos: String(servico.duracao_minutos),
        categoria: servico.categoria || "",
        descricao: servico.descricao || "",
        status: servico.status as "active" | "inactive",
      });
    } else {
      form.reset({
        nome: "",
        preco: "",
        duracao_minutos: "30",
        categoria: "",
        descricao: "",
        status: "active",
      });
    }
  }, [servico, form]);

  const onSubmit = async (data: ServicoFormData) => {
    setLoading(true);
    try {
      const payload = {
        nome: data.nome.trim(),
        preco: parseFloat(data.preco),
        duracao_minutos: parseInt(data.duracao_minutos),
        categoria: data.categoria?.trim() || null,
        descricao: data.descricao?.trim() || null,
        status: data.status,
      };

      if (isEditing && servico) {
        const { error } = await supabase
          .from("servicos")
          .update(payload)
          .eq("id", servico.id);

        if (error) throw error;
        toast({ title: "Serviço atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("servicos").insert(payload);

        if (error) throw error;
        toast({ title: "Serviço cadastrado com sucesso!" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar serviço",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Serviço" : "Novo Serviço"}
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
                    <Input {...field} className="input-dark" placeholder="Nome do serviço" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$) *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        step="0.01" 
                        min="0"
                        className="input-dark" 
                        placeholder="0.00" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duracao_minutos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração (min) *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        min="5"
                        step="5"
                        className="input-dark" 
                        placeholder="30" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                      {categorias.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhuma categoria cadastrada
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="input-dark resize-none" rows={3} placeholder="Descrição do serviço..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
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
