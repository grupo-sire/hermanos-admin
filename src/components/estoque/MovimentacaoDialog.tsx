import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

const formSchema = z.object({
  produto_id: z.string().min(1, "Selecione um produto"),
  tipo: z.enum(["entrada", "saida"]),
  responsavel_id: z.string().optional(),
  quantidade: z.coerce.number().min(1, "Quantidade deve ser maior que zero"),
  observacao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
type Produto = { id: string; nome: string; estoque: number };
type Barbeiro = { id: string; nome: string };

interface MovimentacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MovimentacaoDialog({ open, onOpenChange, onSuccess }: MovimentacaoDialogProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedUnidadeId, userUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { unidadeId: roleUnidadeId } = useUserRole();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { produto_id: "", tipo: "entrada", responsavel_id: "", quantidade: 1, observacao: "" },
  });

  useEffect(() => {
    if (open) {
      fetchProdutos();
      fetchBarbeiros();
      form.reset({ produto_id: "", tipo: "entrada", responsavel_id: "", quantidade: 1, observacao: "" });
    }
  }, [open, selectedUnidadeId, userUnidadeId, roleUnidadeId, empresaId]);

  const fetchProdutos = async () => {
    const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

    let query = supabase.from("produtos").select("id, nome, estoque").eq("status", "active").order("nome");
    if (empresaId) query = query.eq("empresa_id", empresaId);

    const [prodRes, estFilialRes] = await Promise.all([
      query,
      supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", targetUnidadeId),
    ]);

    if (prodRes.data) {
      const estFilialData = estFilialRes.data || [];
      const estoqueMap: Record<string, number> = {};
      estFilialData.forEach((ef: any) => {
        estoqueMap[ef.produto_id] = Number(ef.quantidade) || 0;
      });

      const prodsList = prodRes.data.map((p) => ({
        ...p,
        estoque: estoqueMap[p.id] !== undefined ? Math.max(0, estoqueMap[p.id]) : 0,
      }));

      setProdutos(prodsList);
    }
  };

  const fetchBarbeiros = async () => {
    const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";
    let query = supabase.from("barbeiros").select("id, nome").eq("status", "active").order("nome");
    if (targetUnidadeId) query = query.eq("unidade_id", targetUnidadeId);
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data } = await query;
    setBarbeiros(data || []);
  };

  const onSubmit = async (data: FormData) => {
    const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

    setLoading(true);
    try {
      const produto = produtos.find((p) => p.id === data.produto_id);
      if (!produto) throw new Error("Produto não encontrado");

      if (data.tipo === "saida" && produto.estoque < data.quantidade) {
        toast.error(`Estoque insuficiente na filial. Disponível: ${produto.estoque}`);
        setLoading(false);
        return;
      }

      const { error: movError } = await supabase.from("estoque_movimentacoes").insert({
        produto_id: data.produto_id,
        tipo: data.tipo,
        quantidade: data.quantidade,
        responsavel_id: data.responsavel_id || null,
        observacao: data.observacao || null,
        unidade_id: targetUnidadeId,
        empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
      });
      if (movError) throw movError;

      const novoEstoque = data.tipo === "entrada" ? produto.estoque + data.quantidade : Math.max(0, produto.estoque - data.quantidade);
      await supabase
        .from("estoque_filial")
        .upsert({
          empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
          unidade_id: targetUnidadeId,
          produto_id: data.produto_id,
          quantidade: novoEstoque,
          updated_at: new Date().toISOString()
        }, { onConflict: "unidade_id,produto_id" });

      toast.success(`Movimentação de ${data.tipo} registrada na filial!`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar movimentação");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduto = produtos.find((p) => p.id === form.watch("produto_id"));
  const watchTipo = form.watch("tipo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card border-white/[0.08]">
        <DialogHeader><DialogTitle className="text-foreground">Nova Movimentação de Estoque</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="produto_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Produto</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger className="input-dark"><SelectValue placeholder="Selecione um produto" /></SelectTrigger></FormControl>
                  <SelectContent>{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} (Estoque: {p.estoque})</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="input-dark"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl><Input type="number" min="1" className="input-dark" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {watchTipo === "saida" && (
              <FormField control={form.control} name="responsavel_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional Responsável (Opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger className="input-dark"><SelectValue placeholder="Selecione o profissional" /></SelectTrigger></FormControl>
                    <SelectContent>{barbeiros.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedProduto && (
              <div className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-lg">
                Estoque atual: <span className="font-semibold text-foreground">{selectedProduto.estoque}</span> unidades
              </div>
            )}

            <FormField control={form.control} name="observacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Observação</FormLabel>
                <FormControl><Textarea placeholder="Motivo da movimentação..." className="input-dark resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" className="btn-wine" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Movimentação
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
