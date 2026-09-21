import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Produto {
  id: string;
  nome: string;
  estoque: number;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  produtoPreSelecionado?: Produto | null;
}

export function EnvioDiretoSuprimentoDialog({ open, onOpenChange, onSuccess, produtoPreSelecionado }: Props) {
  const { empresaId } = useEmpresa();
  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [produtoId, setProdutoId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [observacao, setObservacao] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
      if (produtoPreSelecionado) {
        setProdutoId(produtoPreSelecionado.id);
      }
    }
  }, [open, produtoPreSelecionado]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodsRes, unidsRes] = await Promise.all([
        supabase.from("produtos").select("id, nome, estoque").eq("empresa_id", defaultEmpresaId).order("nome"),
        supabase.from("unidades").select("id, nome").eq("empresa_id", defaultEmpresaId).order("nome"),
      ]);

      if (prodsRes.data) setProdutos(prodsRes.data);
      if (unidsRes.data) setUnidades(unidsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!produtoId) {
      toast.error("Selecione o produto a ser enviado.");
      return;
    }
    if (!unidadeId) {
      toast.error("Selecione a filial de destino.");
      return;
    }
    if (quantidade <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    const prodSelected = produtos.find((p) => p.id === produtoId);
    if (prodSelected && prodSelected.estoque < quantidade) {
      toast.error(`Estoque central insuficiente! Disponível apenas: ${prodSelected.estoque} unidades.`);
      return;
    }

    setSubmitting(true);
    try {
      const userRes = await supabase.auth.getUser();

      // 1. Criar pedido master em pedidos_suprimentos
      const { data: novoPedido, error: pedidoErr } = await supabase
        .from("pedidos_suprimentos" as any)
        .insert([{
          empresa_id: defaultEmpresaId,
          unidade_id: unidadeId,
          status: "em_transito",
          solicitante_id: userRes.data.user?.id,
          despachado_em: new Date().toISOString(),
          observacao_matriz: observacao.trim() || "Despacho direto registrado pela administração central.",
        }])
        .select()
        .single();

      if (pedidoErr) throw pedidoErr;

      // 2. Inserir item em pedidos_suprimentos_itens
      const { error: itemErr } = await supabase
        .from("pedidos_suprimentos_itens" as any)
        .insert([{
          pedido_id: (novoPedido as any).id,
          produto_id: produtoId,
          qtd_solicitada: quantidade,
          qtd_enviada: quantidade,
          status_item: "em_transito",
        }]);

      if (itemErr) throw itemErr;

      // 3. Abater quantidade do estoque central
      if (prodSelected) {
        const novoEstoque = Math.max(0, prodSelected.estoque - quantidade);
        await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", produtoId);

        // Registrar movimentação de saída do estoque central
        await supabase.from("estoque_movimentacoes").insert({
          empresa_id: defaultEmpresaId,
          produto_id: produtoId,
          tipo: "saida",
          quantidade,
          observacao: `Despacho direto para filial - Pedido #${(novoPedido as any).id.slice(0, 6)}`,
        });
      }

      toast.success("Despacho registrado! Carga enviada para a filial.");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar envio: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Send className="h-5 w-5 text-primary" />
            Despachar Suprimento para Filial
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Produto do Estoque Central *</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="input-dark mt-1">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (Estoque Central: {p.estoque} un)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Filial de Destino *</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger className="input-dark mt-1">
                  <SelectValue placeholder="Selecione a filial" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Quantidade a Enviar *</Label>
              <Input
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                className="input-dark mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Observação do Despacho (Opcional)</Label>
              <Input
                placeholder="Ex: Entrega urgente por motoboy..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="input-dark mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button className="btn-wine" onClick={handleSend} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Confirmar Despacho
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
