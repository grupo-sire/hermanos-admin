import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";

interface Produto {
  id: string;
  nome: string;
  estoque: number;
}

interface ItemPedido {
  produto_id: string;
  nome: string;
  qtd_solicitada: number;
}

interface SolicitarSuprimentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SolicitarSuprimentosDialog({ open, onOpenChange, onSuccess }: SolicitarSuprimentosDialogProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [selectedProdutoId, setSelectedProdutoId] = useState("");
  const [qtdInput, setQtdInput] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  const { selectedUnidadeId, userUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { unidadeId: roleUnidadeId } = useUserRole();

  const targetUnidadeId = selectedUnidadeId || userUnidadeId || roleUnidadeId || "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

  useEffect(() => {
    if (open) {
      fetchProdutos();
      setItens([]);
      setObservacao("");
      setSelectedProdutoId("");
      setQtdInput(1);
    }
  }, [open, selectedUnidadeId, userUnidadeId, roleUnidadeId, empresaId]);

  const fetchProdutos = async () => {

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

  const handleAddItem = () => {
    if (!selectedProdutoId) {
      toast.error("Selecione um produto");
      return;
    }
    const prod = produtos.find(p => p.id === selectedProdutoId);
    if (!prod) return;

    const existingIndex = itens.findIndex(i => i.produto_id === selectedProdutoId);
    if (existingIndex >= 0) {
      const updated = [...itens];
      updated[existingIndex].qtd_solicitada += Number(qtdInput);
      setItens(updated);
    } else {
      setItens([...itens, { produto_id: prod.id, nome: prod.nome, qtd_solicitada: Number(qtdInput) }]);
    }
    setSelectedProdutoId("");
    setQtdInput(1);
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedUnidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }
    if (itens.length === 0) {
      toast.error("Adicione pelo menos um produto ao pedido");
      return;
    }

    setLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();

      const { data: pedido, error: pedErr } = await supabase
        .from("pedidos_suprimentos" as any)
        .insert({
          empresa_id: empresaId,
          unidade_id: targetUnidadeId,
          solicitante_id: userRes.user?.id || null,
          status: "pendente",
          observacao_filial: observacao || null,
        } as any)
        .select()
        .single();

      if (pedErr) throw pedErr;

      const itensPayload = itens.map(item => ({
        pedido_id: (pedido as any).id,
        produto_id: item.produto_id,
        qtd_solicitada: item.qtd_solicitada,
        status_item: "pendente",
      }));

      const { error: itensErr } = await supabase
        .from("pedidos_suprimentos_itens" as any)
        .insert(itensPayload as any);

      if (itensErr) throw itensErr;

      toast.success("Pedido de suprimentos enviado à Matriz!");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao enviar pedido:", err);
      toast.error(err.message || "Erro ao solicitar suprimentos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Solicitar Produtos para a Matriz
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-6 space-y-1">
              <label className="text-xs text-muted-foreground">Produto</label>
              <select
                value={selectedProdutoId}
                onChange={(e) => setSelectedProdutoId(e.target.value)}
                className="w-full h-9 rounded-md bg-secondary/50 border border-input px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} (Atual: {p.estoque})</option>
                ))}
              </select>
            </div>
            <div className="col-span-4 space-y-1">
              <label className="text-xs text-muted-foreground">Qtd Pedida</label>
              <Input
                type="number"
                min="1"
                value={qtdInput}
                onChange={(e) => setQtdInput(Number(e.target.value))}
                className="input-dark h-9"
              />
            </div>
            <div className="col-span-2">
              <Button onClick={handleAddItem} className="btn-wine h-9 w-full">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden max-h-[200px] overflow-y-auto">
            {itens.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhum item adicionado à solicitação
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="py-2 text-xs">Produto</TableHead>
                    <TableHead className="py-2 text-xs text-center">Qtd</TableHead>
                    <TableHead className="py-2 text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, idx) => (
                    <TableRow key={idx} className="border-border">
                      <TableCell className="py-2 text-xs font-medium text-foreground">{item.nome}</TableCell>
                      <TableCell className="py-2 text-xs text-center font-bold text-primary">{item.qtd_solicitada}</TableCell>
                      <TableCell className="py-2 text-xs">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveItem(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Observação para a Matriz (opcional)</label>
            <Textarea
              placeholder="Ex: Precisamos com urgência da Pomada Matte para o final de semana..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="input-dark text-xs resize-none h-16"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="btn-soft text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="btn-wine text-xs" onClick={handleSubmit} disabled={loading || itens.length === 0}>
              {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Enviar Pedido à Matriz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
