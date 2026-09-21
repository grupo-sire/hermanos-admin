import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  AlertTriangle,
  Pencil,
  ArrowUpDown,
  Send,
  CheckCircle2,
  Tag,
  Boxes,
  Layers,
  Sparkles,
  DollarSign
} from "lucide-react";

interface ProdutoDetalhesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: any | null;
  targetUnidadeNome?: string;
  isSuperAdmin?: boolean;
  onEdit?: (produto: any) => void;
  onMovimentacao?: (produto: any) => void;
  onEnvio?: (produto: any) => void;
}

export function ProdutoDetalhesDialog({
  open,
  onOpenChange,
  produto,
  targetUnidadeNome,
  isSuperAdmin,
  onEdit,
  onMovimentacao,
  onEnvio,
}: ProdutoDetalhesDialogProps) {
  if (!produto) return null;

  const currentStock = produto.estoqueLocal ?? produto.estoque ?? 0;
  const isEstoqueBaixo = currentStock <= (produto.estoque_minimo || 5);

  // Extração de tags de destinação e rendimento da descrição
  let cleanDesc = produto.descricao || "";
  let destinação = "Venda & Uso Interno";
  let rendimento = null;

  if (cleanDesc.includes("[DESTINACAO:uso_interno]")) {
    destinação = "Uso Interno (Bancadas)";
    cleanDesc = cleanDesc.replace("[DESTINACAO:uso_interno]", "").trim();
  } else if (cleanDesc.includes("[DESTINACAO:venda_balcao]")) {
    destinação = "Venda no Balcão (PDV)";
    cleanDesc = cleanDesc.replace("[DESTINACAO:venda_balcao]", "").trim();
  } else if (cleanDesc.includes("[DESTINACAO:ambos]")) {
    destinação = "Ambos (Venda & Uso Interno)";
    cleanDesc = cleanDesc.replace("[DESTINACAO:ambos]", "").trim();
  }

  const rendimentoMatch = cleanDesc.match(/\[RENDIMENTO:(\d+)\]/);
  if (rendimentoMatch) {
    rendimento = `${rendimentoMatch[1]} aplicações / usos por embalagem`;
    cleanDesc = cleanDesc.replace(rendimentoMatch[0], "").trim();
  }

  const precoFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(produto.preco || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col bg-gradient-to-b from-[#1c0c11] via-[#14080a] to-[#0d0506] border border-red-900/40 text-white rounded-3xl p-0 overflow-hidden shadow-2xl">
        {/* Banner do Produto */}
        <div className="relative h-44 w-full bg-black/60 flex items-center justify-center overflow-hidden border-b border-red-900/30 shrink-0">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Package className="h-12 w-12 opacity-40" />
              <span className="text-xs font-semibold">Sem foto cadastrada</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#14080a] via-transparent to-black/60" />

          {/* Badges superiores */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {produto.categoria ? (
              <Badge className="bg-red-950/90 text-red-300 border-red-700/50 backdrop-blur-md text-[11px] font-bold px-2.5 py-0.5">
                <Tag className="h-3 w-3 mr-1 text-red-400" /> {produto.categoria}
              </Badge>
            ) : <div />}

            {isEstoqueBaixo ? (
              <Badge className="bg-red-600 text-white font-bold text-[11px] px-2.5 py-0.5 animate-pulse shadow-lg flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Estoque Baixo ({currentStock} un)
              </Badge>
            ) : (
              <Badge className="bg-emerald-950/90 text-emerald-400 border-emerald-700/50 backdrop-blur-md text-[11px] font-bold px-2.5 py-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Estoque OK ({currentStock} un)
              </Badge>
            )}
          </div>

          {/* Preço em destaque sobre o banner */}
          <div className="absolute bottom-2.5 right-3 bg-black/80 backdrop-blur-md border border-amber-500/40 rounded-xl px-3 py-1 shadow-xl">
            <span className="text-[9px] text-slate-400 font-semibold block uppercase">Preço Venda</span>
            <span className="text-lg font-black text-amber-400 font-mono leading-none">{precoFormatado}</span>
          </div>
        </div>

        {/* Corpo do Modal com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Título & Categoria */}
          <div>
            <h2 className="text-lg font-black text-white leading-tight">{produto.nome}</h2>
            {cleanDesc && (
              <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-black/40 p-3 rounded-2xl border border-white/5">
                {cleanDesc}
              </p>
            )}
          </div>

          {/* Grid de Informações Tecnicas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                <Boxes className="h-3 w-3 text-red-400" /> {targetUnidadeNome ? `Estoque ${targetUnidadeNome}` : "Estoque da Unidade"}
              </span>
              <span className={`text-base font-black font-mono ${isEstoqueBaixo ? "text-red-400" : "text-emerald-400"}`}>
                {currentStock} <span className="text-xs font-semibold text-slate-400">unidades</span>
              </span>
              <span className="text-[10px] text-slate-500 block">Estoque Mínimo: {produto.estoque_minimo || 5} un</span>
            </div>

            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                <Layers className="h-3 w-3 text-amber-400" /> Estoque Mestre CD
              </span>
              <span className="text-base font-black font-mono text-white">
                {produto.estoque ?? 0} <span className="text-xs font-semibold text-slate-400">unidades</span>
              </span>
              <span className="text-[10px] text-slate-500 block">Galpão Central CD</span>
            </div>
          </div>

          {/* Destinação & Rendimento */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#1b0a0e] to-[#0f0407] border border-red-900/30 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Destinação do Produto:
              </span>
              <span className="font-bold text-white bg-black/50 px-2.5 py-0.5 rounded-lg border border-white/10">{destinação}</span>
            </div>

            {rendimento && (
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-slate-400 font-semibold">Estimativa de Rendimento:</span>
                <span className="font-bold text-amber-300">{rendimento}</span>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Fixo com Ações */}
        <DialogFooter className="p-3 bg-black/80 border-t border-red-900/30 flex flex-wrap items-center justify-between sm:justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(produto);
                }}
                className="border-white/10 text-white hover:bg-white/10 text-xs font-bold h-8 px-2.5"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            )}

            {onMovimentacao && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onMovimentacao(produto);
                }}
                className="border-amber-500/40 text-amber-400 hover:bg-amber-950/40 text-xs font-bold h-8 px-2.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Entrada/Saída
              </Button>
            )}

            {isSuperAdmin && onEnvio && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEnvio(produto);
                }}
                className="border-red-500/40 text-red-400 hover:bg-red-950/40 text-xs font-bold h-8 px-2.5"
              >
                <Send className="h-3.5 w-3.5 mr-1" /> Despachar
              </Button>
            )}
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="bg-red-700 hover:bg-red-800 text-white font-black text-xs h-8 px-4 rounded-lg shadow-lg ml-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
