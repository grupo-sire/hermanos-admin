import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProdutoGaleria = {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
  imagem_url?: string | null;
};

interface ProdutoGaleriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: ProdutoGaleria[];
  onSelectProduto: (produto: ProdutoGaleria, quantidade: number) => void;
}

export function ProdutoGaleriaDialog({
  open, onOpenChange, produtos, onSelectProduto,
}: ProdutoGaleriaDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  const filteredProdutos = produtos.filter((p) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (produto: ProdutoGaleria) => {
    const qtd = selectedQuantities[produto.id] || 1;
    onSelectProduto(produto, qtd);
    onOpenChange(false);
  };

  const setQtd = (id: string, val: number) => {
    setSelectedQuantities((prev) => ({ ...prev, [id]: Math.max(1, val) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] bg-card border-white/[0.08] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-white/[0.08]">
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
            <ShoppingBag className="h-5 w-5 text-red-500" />
            Catálogo Visual de Produtos Hermanos
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Selecione o produto desejado e confirme a adição na comanda.
          </p>
        </DialogHeader>

        {/* Busca */}
        <div className="relative my-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 input-dark text-xs h-9"
          />
        </div>

        {/* Grid de Produtos */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProdutos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Nenhum produto encontrado com o filtro "{searchTerm}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredProdutos.map((produto) => {
                const qtd = selectedQuantities[produto.id] || 1;
                const isOutOfStock = produto.estoque <= 0;

                return (
                  <div
                    key={produto.id}
                    className={cn(
                      "group bg-secondary/20 hover:bg-secondary/40 border border-white/[0.06] rounded-xl p-3 flex flex-col justify-between transition-all duration-200 hover:border-red-500/30",
                      isOutOfStock && "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="space-y-2">
                      {/* Imagem do Produto */}
                      <div className="w-full h-32 rounded-lg bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center relative p-2">
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                        )}
                        <Badge
                          variant={isOutOfStock ? "destructive" : "secondary"}
                          className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.2"
                        >
                          {isOutOfStock ? "Esgotado" : `${produto.estoque} em est.`}
                        </Badge>
                      </div>

                      {/* Nome e Preco */}
                      <div>
                        <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                          {produto.nome}
                        </h4>
                        <p className="text-sm font-extrabold text-emerald-400 mt-1">
                          R$ {Number(produto.preco).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Controles de Quantidade e Adicionar */}
                    <div className="pt-3 border-t border-white/5 mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={produto.estoque}
                        value={qtd}
                        onChange={(e) => setQtd(produto.id, parseInt(e.target.value) || 1)}
                        className="w-14 input-dark text-xs h-8 text-center p-1"
                      />
                      <Button
                        onClick={() => handleAdd(produto)}
                        disabled={isOutOfStock}
                        className="flex-1 btn-wine h-8 text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
