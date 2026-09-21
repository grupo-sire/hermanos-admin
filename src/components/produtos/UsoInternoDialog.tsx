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
import { Loader2, PackageMinus, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

const formSchema = z.object({
  produto_id: z.string().min(1, "Selecione um produto"),
  tipo_destino: z.enum(["compartilhado", "profissional"]).default("compartilhado"),
  responsavel_id: z.string().optional(),
  quantidade: z.coerce.number().min(1, "Quantidade deve ser maior que zero"),
  observacao: z.string().min(1, "Informe o motivo do uso interno"),
});

type FormData = z.infer<typeof formSchema>;
type Produto = { id: string; nome: string; estoque: number; descricao: string | null };
type Barbeiro = { id: string; nome: string };

interface UsoInternoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function UsoInternoDialog({ open, onOpenChange, onSuccess }: UsoInternoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const { selectedUnidadeId, userUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { isBarber, unidadeId: roleUnidadeId } = useUserRole();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { produto_id: "", tipo_destino: "compartilhado", responsavel_id: "", quantidade: 1, observacao: "" },
  });

  useEffect(() => {
    if (open) {
      fetchProdutos();
      fetchBarbeiros();
      form.reset({ produto_id: "", tipo_destino: "compartilhado", responsavel_id: "", quantidade: 1, observacao: "" });
    }
  }, [open, selectedUnidadeId, userUnidadeId, roleUnidadeId, empresaId]);

  const fetchProdutos = async () => {
    const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

    let query = supabase.from("produtos").select("id, nome, estoque, descricao").eq("status", "active").order("nome");
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

      const disponiveis = prodRes.data
        .filter((p) => {
          if (!p.descricao) return true;
          return !p.descricao.includes("[DESTINACAO:venda]");
        })
        .map((p) => ({
          ...p,
          estoque: estoqueMap[p.id] !== undefined ? Math.max(0, estoqueMap[p.id]) : 0,
        }));

      setProdutos(disponiveis);
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
    if (isBarber) {
      toast.error("Acesso restrito: Apenas a gerência da unidade pode autorizar baixas de uso interno.");
      return;
    }

    const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

    if (data.tipo_destino === "profissional" && !data.responsavel_id) {
      toast.error("Selecione o profissional que recebeu o insumo.");
      return;
    }

    const produto = produtos.find((p) => p.id === data.produto_id);
    if (!produto) return;

    if (produto.estoque < data.quantidade) {
      toast.error(`Estoque insuficiente na filial. Disponível: ${produto.estoque}`);
      return;
    }

    setLoading(true);
    try {
      const respId = data.tipo_destino === "profissional" ? data.responsavel_id : null;
      const destinoTxt = data.tipo_destino === "compartilhado" ? "Abastecimento Compartilhado da Filial" : "Consumo Individual";

      const insertPayload: any = {
        produto_id: data.produto_id,
        tipo: "saida",
        quantidade: data.quantidade,
        responsavel_id: respId,
        observacao: `[USO INTERNO - ${destinoTxt}] ${data.observacao}`,
        unidade_id: targetUnidadeId,
        empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
      };

      const { error: movError } = await supabase.from("estoque_movimentacoes").insert(insertPayload);
      if (movError) throw movError;

      const novoEstoque = Math.max(0, produto.estoque - data.quantidade);
      await supabase
        .from("estoque_filial")
        .upsert({
          empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
          unidade_id: targetUnidadeId,
          produto_id: data.produto_id,
          quantidade: novoEstoque,
          updated_at: new Date().toISOString()
        }, { onConflict: "unidade_id,produto_id" });

      toast.success("Baixa de uso interno registrada pela gerência!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao registrar uso interno:", error);
      toast.error(error.message || "Erro ao registrar uso interno");
    } finally {
      setLoading(false);
    }
  };

  const selectedProduto = produtos.find((p) => p.id === form.watch("produto_id"));
  const watchTipoDestino = form.watch("tipo_destino");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <PackageMinus className="h-5 w-5 text-warning" />
            Baixa de Uso Interno / Abastecimento de Bancada
          </DialogTitle>
        </DialogHeader>

        {isBarber ? (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
            <h4 className="font-bold text-foreground text-sm">Acesso Restrito à Gerência</h4>
            <p className="text-xs text-muted-foreground">
              Apenas gerentes e supervisores da unidade podem registrar saídas de suprimentos de uso interno.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="produto_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Insumo / Produto de Bancada *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark"><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome} (Estoque: {p.estoque} un)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="tipo_destino" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Destino *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="compartilhado">🏢 Bancada Geral / Compartilhado</SelectItem>
                        <SelectItem value="profissional">👤 Barbeiro Específico</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="quantidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade Retirada *</FormLabel>
                    <FormControl><Input type="number" min="1" className="input-dark" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {watchTipoDestino === "profissional" && (
                <FormField control={form.control} name="responsavel_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barbeiro Destinatário *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="input-dark"><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {barbeiros.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {selectedProduto && (
                <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-lg flex justify-between items-center">
                  <span>Estoque atual na filial:</span>
                  <span className="font-bold text-foreground">{selectedProduto.estoque} unidades</span>
                </div>
              )}

              <FormField control={form.control} name="observacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo / Observação do Gerente *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ex: Abastecimento de lâminas e golas nas bancadas 1, 2 e 3..." className="input-dark resize-none h-16" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" className="btn-wine" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirmar Baixa (Gerência)
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
