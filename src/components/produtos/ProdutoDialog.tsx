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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCategorias } from "@/hooks/useCategorias";
import { useEmpresa } from "@/contexts/EmpresaContext";

const formSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  destinacao: z.enum(["venda", "uso_interno", "ambos"]).default("ambos"),
  rendimento_estimado_atendimentos: z.coerce.number().min(1, "Rendimento mínimo é 1 atendimento"),
  preco: z.coerce.number().min(0, "Preço não pode ser negativo"),
  estoque: z.coerce.number().min(0, "Estoque não pode ser negativo"),
  estoque_minimo: z.coerce.number().min(0, "Estoque mínimo da matriz não pode ser negativo"),
  estoque_minimo_filial: z.coerce.number().min(0, "Estoque mínimo da filial não pode ser negativo"),
  status: z.string().default("active"),
});

type FormData = z.infer<typeof formSchema>;

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco: number;
  estoque: number;
  estoque_minimo: number;
  status: string;
  destinacao?: string | null;
  rendimento_estimado_atendimentos?: number | null;
}

interface ProdutoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: Produto | null;
  onSuccess: () => void;
}

export function ProdutoDialog({ open, onOpenChange, produto, onSuccess }: ProdutoDialogProps) {
  const { empresaId } = useEmpresa();
  const [loading, setLoading] = useState(false);
  const isEditing = !!produto;
  const { categorias } = useCategorias("produto");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      categoria: "",
      destinacao: "ambos",
      rendimento_estimado_atendimentos: 1,
      preco: 0,
      estoque: 0,
      estoque_minimo: 100,
      estoque_minimo_filial: 10,
      status: "active",
    },
  });

  useEffect(() => {
    if (open) {
      if (produto) {
        let dest = (produto as any).destinacao || "ambos";
        let rend = (produto as any).rendimento_estimado_atendimentos || 1;
        let minFilial = 10;

        if (produto.descricao) {
          if (produto.descricao.includes("[DESTINACAO:uso_interno]")) dest = "uso_interno";
          else if (produto.descricao.includes("[DESTINACAO:venda]")) dest = "venda";
          else if (produto.descricao.includes("[DESTINACAO:ambos]")) dest = "ambos";

          const rendMatch = produto.descricao.match(/\[RENDIMENTO:(\d+)\]/);
          if (rendMatch) rend = Number(rendMatch[1]);

          const minFilialMatch = produto.descricao.match(/\[MIN_FILIAL:(\d+)\]/);
          if (minFilialMatch) minFilial = Number(minFilialMatch[1]);
        }

        const cleanDesc = (produto.descricao || "")
          .replace(/\[DESTINACAO:[^\]]+\]/g, "")
          .replace(/\[RENDIMENTO:\d+\]/g, "")
          .replace(/\[MIN_FILIAL:\d+\]/g, "")
          .trim();

        form.reset({
          nome: produto.nome,
          descricao: cleanDesc,
          categoria: produto.categoria || "",
          destinacao: dest as any,
          rendimento_estimado_atendimentos: rend,
          preco: Number(produto.preco),
          estoque: produto.estoque,
          estoque_minimo: produto.estoque_minimo || 100,
          estoque_minimo_filial: minFilial,
          status: produto.status,
        });
      } else {
        form.reset({
          nome: "",
          descricao: "",
          categoria: "",
          destinacao: "ambos",
          rendimento_estimado_atendimentos: 1,
          preco: 0,
          estoque: 0,
          estoque_minimo: 100,
          estoque_minimo_filial: 10,
          status: "active",
        });
      }
    }
  }, [open, produto, form]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const metaTag = `[DESTINACAO:${data.destinacao}] [RENDIMENTO:${data.rendimento_estimado_atendimentos}] [MIN_FILIAL:${data.estoque_minimo_filial}]`;
      const fullDesc = `${metaTag} ${data.descricao || ""}`.trim();

      const payload: any = {
        nome: data.nome,
        descricao: fullDesc,
        categoria: data.categoria || null,
        preco: data.preco,
        estoque: data.estoque,
        estoque_minimo: data.estoque_minimo_filial || 10,
        status: data.status,
      };

      if (empresaId) payload.empresa_id = empresaId;

      if (isEditing && produto) {
        const { error } = await supabase
          .from("produtos")
          .update(payload)
          .eq("id", produto.id);

        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase
          .from("produtos")
          .insert(payload);

        if (error) throw error;
        toast.success("Produto cadastrado!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setLoading(false);
    }
  };

  const watchDestinacao = form.watch("destinacao");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? "Editar Produto / Insumo" : "Novo Produto / Insumo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto / Insumo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Gola Higiênica Rolo, Lâminas de Navalha..." className="input-dark" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="destinacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinação / Uso *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark">
                          <SelectValue placeholder="Selecione a destinação" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="venda">🛍️ Exclusivo Venda</SelectItem>
                        <SelectItem value="uso_interno">💈 Exclusivo Uso Interno</SelectItem>
                        <SelectItem value="ambos">🔄 Ambos (Venda & Bancada)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rendimento_estimado_atendimentos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rendimento p/ Unidade (Atend.)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 200"
                        className="input-dark"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="preco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{watchDestinacao === "uso_interno" ? "Custo (R$)" : "Preço (R$)"}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        className="input-dark"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estoque_minimo_filial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mín. das Filiais</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="10"
                        className="input-dark text-center font-bold text-amber-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do produto ou especificações..."
                      className="input-dark resize-none h-16"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Produto"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
