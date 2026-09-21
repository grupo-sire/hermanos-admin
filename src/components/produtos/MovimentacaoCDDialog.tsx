import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpDown, ArrowDownLeft, ArrowUpRight, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

const formSchema = z.object({
  produto_id: z.string().min(1, "Selecione um produto"),
  tipo_movimentacao: z.enum(["entrada", "saida"]).default("entrada"),
  quantidade: z.coerce.number().min(1, "Quantidade deve ser maior que zero"),
  observacao: z.string().min(3, "Informe o motivo ou detalhes da movimentação"),
});

type FormData = z.infer<typeof formSchema>;
type Produto = { id: string; nome: string; estoque: number; categoria: string | null };

interface MovimentacaoCDDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialProdutoId?: string | null;
}

export function MovimentacaoCDDialog({
  open,
  onOpenChange,
  onSuccess,
  initialProdutoId,
}: MovimentacaoCDDialogProps) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const { empresaId } = useEmpresa();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      produto_id: initialProdutoId || "",
      tipo_movimentacao: "entrada",
      quantidade: 1,
      observacao: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchProdutos();
      form.reset({
        produto_id: initialProdutoId || "",
        tipo_movimentacao: "entrada",
        quantidade: 1,
        observacao: "",
      });
    }
  }, [open, initialProdutoId]);

  const fetchProdutos = async () => {
    let query = supabase
      .from("produtos")
      .select("id, nome, estoque, categoria")
      .eq("status", "active")
      .order("nome");

    if (empresaId) query = query.eq("empresa_id", empresaId);

    const { data } = await query;
    setProdutos(data || []);
  };

  const watchProdutoId = form.watch("produto_id");
  const watchTipo = form.watch("tipo_movimentacao");
  const selectedProduto = produtos.find((p) => p.id === watchProdutoId);

  const onSubmit = async (data: FormData) => {
    const produto = produtos.find((p) => p.id === data.produto_id);
    if (!produto) {
      toast.error("Produto não encontrado");
      return;
    }

    if (data.tipo_movimentacao === "saida" && produto.estoque < data.quantidade) {
      toast.error(`Estoque mestre do CD insuficiente. Disponível: ${produto.estoque} un`);
      return;
    }

    setLoading(true);
    try {
      const novoEstoque =
        data.tipo_movimentacao === "entrada"
          ? produto.estoque + data.quantidade
          : produto.estoque - data.quantidade;

      const tagTipo = data.tipo_movimentacao === "entrada" ? "ENTRADA CARGA CD" : "SAÍDA CD";

      const insertPayload: any = {
        produto_id: data.produto_id,
        tipo: data.tipo_movimentacao,
        quantidade: data.quantidade,
        observacao: `[CD - ${tagTipo}] ${data.observacao}`,
      };

      if (empresaId) {
        insertPayload.empresa_id = empresaId;
      }

      // 1. Gravar registro no histórico de movimentações
      const { error: movError } = await supabase.from("estoque_movimentacoes").insert(insertPayload);
      if (movError) throw movError;

      // 2. Atualizar saldo no estoque mestre do CD
      const { error: updateError } = await supabase
        .from("produtos")
        .update({ estoque: novoEstoque })
        .eq("id", data.produto_id);

      if (updateError) throw updateError;

      const msg =
        data.tipo_movimentacao === "entrada"
          ? `+${data.quantidade} un adicionadas ao estoque mestre do CD!`
          : `-${data.quantidade} un baixadas do estoque mestre do CD!`;

      toast.success(msg);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao movimentar estoque do CD:", error);
      toast.error(error.message || "Erro ao movimentar estoque do CD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Warehouse className="h-5 w-5 text-red-500" />
            Movimentação de Mercadorias (CD)
          </DialogTitle>
          <DialogDescription>
            Registre entrada de caixas/lotes recebidos ou saída por perdas, avarias e outros fins no Centro de Distribuição.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Tipo de Movimentação */}
            <FormField
              control={form.control}
              name="tipo_movimentacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Operação</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange("entrada")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                        field.value === "entrada"
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-md"
                          : "bg-secondary/20 border-white/5 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <ArrowDownLeft className="h-4 w-4" /> 📥 Entrada (Carga/Lote)
                    </button>

                    <button
                      type="button"
                      onClick={() => field.onChange("saida")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                        field.value === "saida"
                          ? "bg-rose-500/20 border-rose-500/60 text-rose-400 shadow-md"
                          : "bg-secondary/20 border-white/5 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <ArrowUpRight className="h-4 w-4" /> 📤 Saída (Avaria/Outros)
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Produto */}
            <FormField
              control={form.control}
              name="produto_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto Mestre</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} (Estoque CD: {p.estoque} un)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedProduto && (
              <div className="p-3 bg-secondary/30 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Estoque Atual Mestre (CD):</span>
                <Badge variant="outline" className="font-mono text-xs font-bold text-foreground">
                  {selectedProduto.estoque} unidades
                </Badge>
              </div>
            )}

            {/* Quantidade */}
            <FormField
              control={form.control}
              name="quantidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de Unidades</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ex: 50"
                      className="input-dark"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Motivo / Detalhes */}
            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo / Observação / Nota Fiscal</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        watchTipo === "entrada"
                          ? "Ex: Recebimento de caixa com 100un - NF 4589 do Fornecedor X"
                          : "Ex: Baixa por avaria no transporte ou descarte por validade"
                      }
                      className="input-dark resize-none min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className={
                  watchTipo === "entrada"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    : "btn-wine font-bold"
                }
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                )}
                {watchTipo === "entrada" ? "Registrar Entrada Mestre" : "Registrar Saída Mestre"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
