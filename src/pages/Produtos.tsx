import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Search, Package, Loader2, Pencil, Trash2, PackageMinus, Send, AlertTriangle, ShoppingBag, Building2, ArrowUpDown, History } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProdutoDialog } from "@/components/produtos/ProdutoDialog";
import { UsoInternoDialog } from "@/components/produtos/UsoInternoDialog";
import { EnvioDiretoSuprimentoDialog } from "@/components/produtos/EnvioDiretoSuprimentoDialog";
import { SolicitarSuprimentosDialog } from "@/components/estoque/SolicitarSuprimentosDialog";
import { MovimentacaoCDDialog } from "@/components/produtos/MovimentacaoCDDialog";
import { HistoricoMovimentacoesDialog } from "@/components/produtos/HistoricoMovimentacoesDialog";
import { ProdutoDetalhesDialog } from "@/components/produtos/ProdutoDetalhesDialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco: number;
  estoque: number;
  estoqueCD: number;
  estoqueLocal: number;
  estoqueTotalRede?: number;
  estoque_minimo: number;
  imagem_url?: string | null;
  status: string;
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);
  const [usoInternoOpen, setUsoInternoOpen] = useState(false);
  const [envioDiretoOpen, setEnvioDiretoOpen] = useState(false);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [produtoParaEnvio, setProdutoParaEnvio] = useState<Produto | null>(null);
  
  const [movimentacaoCDOpen, setMovimentacaoCDOpen] = useState(false);
  const [produtoParaMovimentarCD, setProdutoParaMovimentarCD] = useState<Produto | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  // Modal de Detalhes do Produto
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [produtoDetalhes, setProdutoDetalhes] = useState<Produto | null>(null);

  const { empresaId } = useEmpresa();
  const { isSuperAdmin, unidadeId: userUnidadeId } = useUserRole();
  const { selectedUnidadeId } = useUnidade();
  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";
  const higienopolisId = "a1346ecc-b354-4b15-8e05-8a980d3bd55e";

  const isAllUnits = !selectedUnidadeId || selectedUnidadeId === "all";
  const targetUnidadeId = isAllUnits ? null : (selectedUnidadeId || userUnidadeId || higienopolisId);

  useEffect(() => {
    fetchProdutos();
  }, [empresaId, selectedUnidadeId, userUnidadeId, isSuperAdmin]);

  const fetchProdutos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("produtos")
        .select("*")
        .eq("status", "active")
        .order("nome");

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const [prodRes, estFilialRes, estFilialAllRes] = await Promise.all([
        query,
        targetUnidadeId
          ? supabase.from("estoque_filial").select("produto_id, quantidade").eq("unidade_id", targetUnidadeId)
          : Promise.resolve({ data: null, error: null }),
        supabase.from("estoque_filial").select("produto_id, quantidade"),
      ]);

      if (prodRes.error) throw prodRes.error;

      const prodData = (prodRes.data || []) as any[];
      const estFilialData = estFilialRes.data || [];
      const estFilialAllData = estFilialAllRes.data || [];

      const estoqueLocalMap: Record<string, number> = {};
      estFilialData.forEach((ef: any) => {
        estoqueLocalMap[ef.produto_id] = Number(ef.quantidade) || 0;
      });

      const estoqueRedeMap: Record<string, number> = {};
      estFilialAllData.forEach((ef: any) => {
        estoqueRedeMap[ef.produto_id] = (estoqueRedeMap[ef.produto_id] || 0) + (Number(ef.quantidade) || 0);
      });

      const prods: Produto[] = prodData.map((p) => {
        const cdStock = Number(p.estoque) || 0;
        const localStock = isAllUnits
          ? (estoqueRedeMap[p.id] || 0)
          : (estoqueLocalMap[p.id] !== undefined ? Math.max(0, estoqueLocalMap[p.id]) : 0);
        const totalRede = cdStock + (estoqueRedeMap[p.id] || 0);

        return {
          ...p,
          estoque: localStock,
          estoqueCD: cdStock,
          estoqueLocal: localStock,
          estoqueTotalRede: totalRede,
        };
      });

      setProdutos(prods);
    } catch (error: any) {
      console.error("Erro ao buscar produtos:", error);
      toast.error("Erro ao carregar lista de produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!produtoToDelete) return;

    try {
      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produtoToDelete.id);

      if (error) throw error;

      toast.success("Produto excluído com sucesso");
      fetchProdutos();
    } catch (error: any) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Erro ao excluir produto: " + error.message);
    } finally {
      setDeleteDialogOpen(false);
      setProdutoToDelete(null);
    }
  };

  const handleEdit = (produto: Produto) => {
    setSelectedProduto(produto);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedProduto(null);
    setDialogOpen(true);
  };

  const handleUsoInterno = (produto: Produto) => {
    setSelectedProduto(produto);
    setUsoInternoOpen(true);
  };

  const handleOpenEnvioDireto = (produto?: Produto) => {
    if (produto) {
      setProdutoParaEnvio({ ...produto, estoque: produto.estoqueCD });
    } else {
      setProdutoParaEnvio(null);
    }
    setEnvioDiretoOpen(true);
  };

  const handleOpenMovimentacaoCD = (produto?: Produto) => {
    if (produto) {
      setProdutoParaMovimentarCD({ ...produto, estoque: produto.estoqueCD });
    } else {
      setProdutoParaMovimentarCD(null);
    }
    setMovimentacaoCDOpen(true);
  };

  const filteredProdutos = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={isSuperAdmin ? "Catálogo Mestre de Produtos (CD)" : "Catálogo & Produtos da Unidade"}
        description={
          isSuperAdmin
            ? "Gestão do catálogo mestre corporativo, estoque mestre do CD (Centro de Distribuição) e envio de suprimentos."
            : "Produtos disponíveis na unidade para vendas, consumo interno e pedido de suprimentos ao CD."
        }
      >
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin ? (
            <>
              <Button onClick={() => setHistoricoOpen(true)} variant="outline" className="btn-soft font-medium text-foreground">
                <History className="h-4 w-4 mr-2 text-primary" /> Histórico CD
              </Button>
              <Button onClick={() => handleOpenMovimentacaoCD()} variant="outline" className="btn-soft font-medium text-foreground border-primary/30">
                <ArrowUpDown className="h-4 w-4 mr-2 text-primary" /> Entrada / Baixa CD
              </Button>
              <Button onClick={() => handleOpenEnvioDireto()} className="btn-wine font-medium">
                <Send className="h-4 w-4 mr-2" /> Despachar para Unidade
              </Button>
              <Button onClick={handleAdd} className="btn-gold font-medium">
                <Plus className="h-4 w-4 mr-2" /> Novo Produto
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setSolicitarOpen(true)} className="btn-wine font-medium">
                <ShoppingBag className="h-4 w-4 mr-2" /> Pedir ao CD
              </Button>
              <Button onClick={() => setUsoInternoOpen(true)} variant="outline" className="border-warning/30 text-warning hover:bg-warning/10 font-medium">
                <PackageMinus className="h-4 w-4 mr-2" /> Uso Interno / Baixa
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Barra de Filtro e Busca */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 input-dark"
          />
        </div>
        <Badge variant="outline" className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-border bg-card">
          Total: {filteredProdutos.length} produtos
        </Badge>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProdutos.length === 0 ? (
        <div className="panel text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground mb-1">Nenhum produto encontrado</h3>
          <p className="text-xs text-muted-foreground mb-4">
            {search ? "Tente buscar com outros termos" : "Comece cadastrando o primeiro produto do catálogo mestre."}
          </p>
          {isSuperAdmin && (
            <Button onClick={handleAdd} className="btn-wine text-xs">
              <Plus className="h-4 w-4 mr-1" /> Cadastrar Produto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProdutos.map((produto) => {
            const currentStock = produto.estoqueLocal ?? produto.estoque ?? 0;
            const isEstoqueBaixo = currentStock <= (produto.estoque_minimo || 5);
            const stockDisplay = currentStock;

            return (
              <Card
                key={produto.id}
                className="bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden group shadow-sm rounded-2xl"
              >
                <div
                  onClick={() => {
                    setProdutoDetalhes(produto);
                    setDetalhesOpen(true);
                  }}
                  className="cursor-pointer group-hover:opacity-95 transition-opacity"
                >
                  {/* Banner / Foto do Produto */}
                  <div className="h-36 w-full bg-secondary/40 relative overflow-hidden flex items-center justify-center border-b border-border">
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      {produto.categoria && (
                        <Badge variant="secondary" className="text-[10px] bg-card/90 backdrop-blur-sm border border-border">
                          {produto.categoria}
                        </Badge>
                      )}
                      {produto.descricao?.includes("[DESTINACAO:uso_interno]") && (
                        <Badge className="bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800 text-[10px] font-bold">
                          🧴 Uso Interno
                        </Badge>
                      )}
                      {produto.descricao?.includes("[DESTINACAO:venda]") && (
                        <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                          🏷️ Venda Balcão
                        </Badge>
                      )}
                      {isEstoqueBaixo && (
                        <Badge className="bg-destructive text-white text-[10px] flex items-center gap-1 font-bold shadow-sm">
                          <AlertTriangle className="h-3 w-3" /> Estoque Baixo
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                      {produto.nome}
                    </CardTitle>
                    {produto.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {produto.descricao.replace(/\[DESTINACAO:[^\]]+\]/g, "").replace(/\[RENDIMENTO:[^\]]+\]/g, "").replace(/\[MIN_FILIAL:[^\]]+\]/g, "").trim()}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="pb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Preço Venda:</span>
                      <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(produto.preco)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                      <span className="text-muted-foreground">
                        {isAllUnits ? "Total Filiais:" : "Estoque Filial:"}
                      </span>
                      <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                        <span className={isEstoqueBaixo ? "text-destructive font-black" : "text-foreground"}>
                          {stockDisplay} un
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">(mín: {produto.estoque_minimo || 5})</span>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-border">
                        <span className="text-muted-foreground text-[11px] flex items-center gap-1 font-semibold">
                          <Building2 className="h-3 w-3 text-primary" /> Saldo CD Matriz:
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {produto.estoqueCD} un
                        </span>
                      </div>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="pt-2 pb-3 border-t border-border bg-secondary/15 flex items-center justify-between gap-1">
                  {isSuperAdmin ? (
                    <>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-foreground hover:bg-secondary" onClick={() => handleEdit(produto)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-amber-600 dark:text-amber-400 hover:bg-secondary" onClick={() => handleOpenMovimentacaoCD(produto)}>
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> CD
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-primary hover:bg-secondary" onClick={() => handleOpenEnvioDireto(produto)}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Despachar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-destructive hover:bg-destructive/10" onClick={() => { setProdutoToDelete(produto); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="sm" className="text-xs h-8 flex-1 text-warning hover:bg-warning/10" onClick={() => handleUsoInterno(produto)}>
                        <PackageMinus className="h-3.5 w-3.5 mr-1" /> Uso Interno
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-8 text-primary hover:bg-primary/10" onClick={() => setSolicitarOpen(true)}>
                        <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Pedir ao CD
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ProdutoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        produto={selectedProduto}
        onSuccess={fetchProdutos}
      />

      <UsoInternoDialog
        open={usoInternoOpen}
        onOpenChange={setUsoInternoOpen}
        onSuccess={fetchProdutos}
      />

      <EnvioDiretoSuprimentoDialog
        open={envioDiretoOpen}
        onOpenChange={setEnvioDiretoOpen}
        produtoPreSelecionado={produtoParaEnvio}
        onSuccess={fetchProdutos}
      />

      <SolicitarSuprimentosDialog
        open={solicitarOpen}
        onOpenChange={setSolicitarOpen}
        onSuccess={fetchProdutos}
      />

      <MovimentacaoCDDialog
        open={movimentacaoCDOpen}
        onOpenChange={setMovimentacaoCDOpen}
        initialProdutoId={produtoParaMovimentarCD?.id}
        onSuccess={fetchProdutos}
      />

      <HistoricoMovimentacoesDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
      />

      <ProdutoDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        produto={produtoDetalhes}
        isSuperAdmin={isSuperAdmin}
        onEdit={(p) => handleEdit(p)}
        onMovimentacao={(p) => handleOpenMovimentacaoCD(p)}
        onEnvio={(p) => handleOpenEnvioDireto(p)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto "{produtoToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
