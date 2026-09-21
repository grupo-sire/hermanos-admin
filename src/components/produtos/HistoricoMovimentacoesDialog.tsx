import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, History, ArrowDownLeft, ArrowUpRight, Search, RefreshCw, Calendar, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Movimentacao {
  id: string;
  created_at: string;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  produtos?: { nome: string; categoria: string | null } | null;
  unidades?: { nome: string } | null;
}

interface HistoricoMovimentacoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoricoMovimentacoesDialog({
  open,
  onOpenChange,
}: HistoricoMovimentacoesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [search, setSearch] = useState("");
  const { empresaId } = useEmpresa();

  useEffect(() => {
    if (open) {
      fetchMovimentacoes();
    }
  }, [open, empresaId]);

  const fetchMovimentacoes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("estoque_movimentacoes")
        .select("*, produtos(nome, categoria), unidades(nome)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMovimentacoes((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = movimentacoes.filter((m) => {
    const term = search.toLowerCase();
    const prodNome = m.produtos?.nome?.toLowerCase() || "";
    const obs = m.observacao?.toLowerCase() || "";
    const uni = m.unidades?.nome?.toLowerCase() || "";
    return prodNome.includes(term) || obs.includes(term) || uni.includes(term);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[85vh] bg-card border-white/[0.08] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
            <History className="h-5 w-5 text-red-500" />
            Histórico & Auditoria de Movimentações (CD & Unidades)
          </DialogTitle>
          <DialogDescription>
            Registro de entradas de carga, saídas, baixas e solicitações de suprimentos.
          </DialogDescription>
        </DialogHeader>

        {/* Busca e Atualização */}
        <div className="flex items-center justify-between gap-3 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por produto, observação ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 input-dark text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchMovimentacoes} className="text-xs border-white/10">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        {/* Tabela de Histórico */}
        <div className="flex-1 overflow-y-auto border border-white/[0.06] rounded-xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              <Package className="h-10 w-10 mx-auto opacity-30 mb-2" />
              Nenhum registro de movimentação encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow>
                  <TableHead className="text-xs">Data & Hora</TableHead>
                  <TableHead className="text-xs">Operação</TableHead>
                  <TableHead className="text-xs">Produto</TableHead>
                  <TableHead className="text-xs text-right">Qtd</TableHead>
                  <TableHead className="text-xs">Destino / Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((mov) => {
                  const isEntrada = mov.tipo === "entrada";
                  return (
                    <TableRow key={mov.id} className="hover:bg-white/[0.02]">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {isEntrada ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1 w-fit">
                            <ArrowDownLeft className="h-3 w-3" /> Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] flex items-center gap-1 w-fit">
                            <ArrowUpRight className="h-3 w-3" /> Saída / Baixa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-foreground">
                        {mov.produtos?.nome || "Produto Removido"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs">
                        <span className={isEntrada ? "text-emerald-400" : "text-rose-400"}>
                          {isEntrada ? `+${mov.quantidade}` : `-${mov.quantidade}`} un
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300 max-w-[280px] truncate" title={mov.observacao || ""}>
                        {mov.observacao || (mov.unidades?.nome ? `Unidade: ${mov.unidades.nome}` : "-")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
