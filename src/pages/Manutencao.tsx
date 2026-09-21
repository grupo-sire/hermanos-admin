import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Wrench, Clock, CheckCircle2, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { NovaSolicitacaoDialog } from "@/components/manutencao/NovaSolicitacaoDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Solicitacao {
  id: string;
  titulo: string;
  categoria: string;
  prioridade: string;
  descricao: string;
  foto_solicitacao_url: string | null;
  observacao_manutencao: string | null;
  foto_conclusao_url: string | null;
  status: string;
  created_at: string;
  resolvido_em: string | null;
}

export default function Manutencao() {
  const { empresaId } = useEmpresa();
  const { selectedUnidadeId } = useUnidade();

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [novaDialogOpen, setNovaDialogOpen] = useState(false);
  const [detalhesDialog, setDetalhesDialog] = useState<Solicitacao | null>(null);

  useEffect(() => {
    if (empresaId && selectedUnidadeId) {
      fetchSolicitacoes();
    }
  }, [empresaId, selectedUnidadeId]);

  const fetchSolicitacoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("solicitacoes_manutencao" as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("unidade_id", selectedUnidadeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar solicitações de manutenção:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = solicitacoes.filter(
    (s) =>
      s.titulo.toLowerCase().includes(search.toLowerCase()) ||
      s.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgente":
        return <Badge className="bg-destructive text-destructive-foreground">🚨 URGENTE</Badge>;
      case "alta":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">🔴 Alta</Badge>;
      case "media":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">🟡 Média</Badge>;
      default:
        return <Badge variant="secondary">🟢 Baixa</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "concluido":
        return (
          <Badge className="bg-success/20 text-success border-success/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Concluído
          </Badge>
        );
      case "em_andamento":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1">
            <Clock className="h-3 w-3 animate-spin" /> Em Reparo
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Manutenção & Reparos da Unidade"
        description="Solicite consertos de ar-condicionado, cadeiras e infraestrutura e acompanhe a resolução pelo time de manutenção."
      >
        <Button onClick={() => setNovaDialogOpen(true)} className="btn-wine">
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 input-dark"
          />
        </div>
        <Badge variant="secondary" className="h-10 px-4">
          {solicitacoes.length} Registros
        </Badge>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-muted-foreground font-semibold">Problema / Título</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Categoria</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Prioridade</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
              <TableHead className="text-muted-foreground font-semibold">Data</TableHead>
              <TableHead className="text-muted-foreground font-semibold w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma solicitação de manutenção registrada nesta unidade.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell>
                    <div className="font-medium text-foreground">{item.titulo}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{item.descricao}</div>
                  </TableCell>
                  <TableCell className="text-sm">{item.categoria}</TableCell>
                  <TableCell>{getPriorityBadge(item.prioridade)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDetalhesDialog(item)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NovaSolicitacaoDialog
        open={novaDialogOpen}
        onOpenChange={setNovaDialogOpen}
        onSuccess={fetchSolicitacoes}
      />

      {/* Modal de Detalhes da Solicitação */}
      {detalhesDialog && (
        <Dialog open={!!detalhesDialog} onOpenChange={() => setDetalhesDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                {detalhesDialog.titulo}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs">
                <span>Categoria: <strong>{detalhesDialog.categoria}</strong></span>
                {getStatusBadge(detalhesDialog.status)}
              </div>

              <div className="p-3 bg-secondary/30 rounded-xl space-y-1 text-xs">
                <span className="font-semibold text-muted-foreground">Descrição do Defeito:</span>
                <p className="text-foreground leading-relaxed">{detalhesDialog.descricao}</p>
              </div>

              {/* Fotos Anexadas */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {detalhesDialog.foto_solicitacao_url && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground">Foto da Abertura:</span>
                    <img
                      src={detalhesDialog.foto_solicitacao_url}
                      alt="Problema"
                      className="w-full h-32 object-cover rounded-xl border border-white/10"
                    />
                  </div>
                )}

                {detalhesDialog.foto_conclusao_url && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-success">Foto da Resolução (OK):</span>
                    <img
                      src={detalhesDialog.foto_conclusao_url}
                      alt="Conclusão"
                      className="w-full h-32 object-cover rounded-xl border border-success/30"
                    />
                  </div>
                )}
              </div>

              {detalhesDialog.observacao_manutencao && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-xl space-y-1 text-xs">
                  <span className="font-semibold text-success">Parecer Técnico da Manutenção:</span>
                  <p className="text-foreground">{detalhesDialog.observacao_manutencao}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
