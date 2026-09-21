import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, Mail, Star, Scissors, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarbeiroDialog } from "@/components/barbeiros/BarbeiroDialog";
import { BarbeiroInativarAssistenteDialog } from "@/components/barbeiros/BarbeiroInativarAssistenteDialog";
import { BarbeiroAvaliacoesDialog } from "@/components/barbeiros/BarbeiroAvaliacoesDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Tables } from "@/integrations/supabase/types";

import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Crown, UserX } from "lucide-react";

export default function Barbeiros() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "active" | "inactive">("todos");
  const [barbeiros, setBarbeiros] = useState<Tables<"barbeiros">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<Tables<"barbeiros"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [barbeiroToDelete, setBarbeiroToDelete] = useState<Tables<"barbeiros"> | null>(null);

  // Assistente de Inativacao / Remanejamento
  const [assistenteOpen, setAssistenteOpen] = useState(false);
  const [barbeiroParaInativar, setBarbeiroParaInativar] = useState<any>(null);

  // Modal de Histórico de Avaliações
  const [avaliacoesDialogOpen, setAvaliacoesDialogOpen] = useState(false);
  const [barbeiroParaAvaliacoes, setBarbeiroParaAvaliacoes] = useState<any | null>(null);

  const { selectedUnidadeId } = useUnidade();
  const { labels, empresaId } = useEmpresa();
  const { isSuperAdmin } = useUserRole();

  useEffect(() => {
    if (empresaId) {
      fetchBarbeiros();
    }
  }, [selectedUnidadeId, empresaId]);

  const fetchBarbeiros = async () => {
    setLoading(true);
    let query = supabase.from("barbeiros").select("*").eq("empresa_id", empresaId);
    if (selectedUnidadeId) query = query.eq("unidade_id", selectedUnidadeId);
    const { data, error } = await query.order("nome");

    if (error) {
      toast({ title: `Erro ao carregar ${labels.profissionais.toLowerCase()}`, description: error.message, variant: "destructive" });
    } else {
      setBarbeiros(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (barbeiro: Tables<"barbeiros">) => { setSelectedBarbeiro(barbeiro); setDialogOpen(true); };
  const handleNew = () => { setSelectedBarbeiro(null); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!barbeiroToDelete) return;
    const { error } = await supabase.from("barbeiros").delete().eq("id", barbeiroToDelete.id);
    if (error) {
      toast({ title: `Erro ao excluir ${labels.profissional.toLowerCase()}`, description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${labels.profissional} excluído com sucesso!` });
      fetchBarbeiros();
    }
    setDeleteDialogOpen(false);
    setBarbeiroToDelete(null);
  };
  
  const filteredBarbers = barbeiros.filter((b: any) => {
    const matchesSearch = b.nome.toLowerCase().includes(search.toLowerCase()) ||
      (b.codigo_cadeira && b.codigo_cadeira.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "todos" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Data N/I";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title={labels.profissionais} description={`Gerencie sua equipe de ${labels.profissionais.toLowerCase()}`}>
        <Button className="btn-wine" onClick={handleNew}><Plus className="h-4 w-4 mr-2" />Novo {labels.profissional}</Button>
      </PageHeader>

      <div className="panel">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={`Buscar por nome ou código (ex: H2)...`} value={search} onChange={(e) => setSearch(e.target.value)} className="input-dark pl-10" />
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-initial ${
                statusFilter === "todos" ? "bg-red-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({barbeiros.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-initial ${
                statusFilter === "active" ? "bg-emerald-600 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ativos ({barbeiros.filter(b => b.status === "active").length})
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 sm:flex-initial ${
                statusFilter === "inactive" ? "bg-amber-600/90 text-white shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inativos ({barbeiros.filter(b => b.status === "inactive").length})
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/${slug || "hermanos"}/avaliacoes`)}
            className="text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 h-8 ml-auto flex items-center gap-1.5 shadow-xs"
          >
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> Ver Página de Avaliações →
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBarbers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">Nenhum {labels.profissional.toLowerCase()} encontrado</div>
          ) : (
            filteredBarbers.map((barber: any) => (
              <div key={barber.id} className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md ${
                barber.status === "inactive" ? "bg-card/40 border-amber-500/30 opacity-75" : "bg-card border-border hover:border-red-500/50"
              }`}>
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-base font-extrabold flex-shrink-0 shadow-md font-mono ${
                      barber.status === "inactive" ? "bg-slate-700 text-slate-300 border border-slate-600" : "bg-gradient-to-br from-red-600 via-red-700 to-red-950 text-white border border-red-400/40"
                    }`}>
                      {barber.codigo_cadeira || barber.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-foreground truncate text-sm">
                          {barber.codigo_cadeira ? `Barbeiro ${barber.codigo_cadeira}` : barber.nome}
                          <span className="text-xs text-muted-foreground font-normal ml-1">({barber.nome})</span>
                        </h3>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold shadow-xs ${barber.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40" : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40"}`}>
                          {barber.status === "active" ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      
                      {barber.codigo_cadeira && (
                        <Badge variant="outline" className={`font-mono font-extrabold text-xs w-fit ${
                          barber.status === "inactive" ? "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border-slate-300 dark:border-slate-700" : "bg-red-500/10 text-red-700 dark:bg-red-950/80 dark:text-red-300 border-red-500/40"
                        }`}>
                          Barbeiro {barber.codigo_cadeira}
                        </Badge>
                      )}

                      {/* Exibicao da Data Exata de Desligamento para Barbeiros Inativos */}
                      {barber.status === "inactive" && barber.data_desligamento && (
                        <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/30 mt-1.5 w-fit">
                          Desligado em: {formatDate(barber.data_desligamento)}
                        </div>
                      )}

                      {/* Badge de Ranking Visivel EXCLUSIVAMENTE para o SuperAdmin */}
                      {isSuperAdmin && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold flex items-center gap-1 w-fit mt-1">
                          <Crown className="h-3 w-3 text-amber-500" /> {barber.ranking || "Top Barber Junior"}
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border shadow-lg">
                        <DropdownMenuItem onClick={() => handleEdit(barber)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setBarbeiroParaAvaliacoes(barber);
                            setAvaliacoesDialogOpen(true);
                          }}
                          className="text-amber-600 dark:text-amber-400 font-medium"
                        >
                          <Star className="h-3.5 w-3.5 mr-2 text-amber-500 fill-amber-500" />
                          Ver Avaliações & Elogios
                        </DropdownMenuItem>
                        {barber.status === "active" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setBarbeiroParaInativar(barber);
                              setAssistenteOpen(true);
                            }}
                            className="text-amber-600 dark:text-amber-400 font-medium"
                          >
                            <UserX className="h-3.5 w-3.5 mr-2 text-amber-500" />
                            Inativar / Desligar (Assistente)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => { setBarbeiroToDelete(barber); setDeleteDialogOpen(true); }}>Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground font-medium">
                    <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-red-500" />{barber.email}</div>
                    {barber.telefone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 text-red-500" />{barber.telefone}</div>}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setBarbeiroParaAvaliacoes(barber);
                      setAvaliacoesDialogOpen(true);
                    }}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer group"
                  >
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground underline decoration-amber-500/40">{barber.rating || 5.0} (Avaliações)</span>
                  </button>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold"><Scissors className="h-3.5 w-3.5 text-red-500" />{barber.total_servicos || 0} serviços</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BarbeiroDialog open={dialogOpen} onOpenChange={setDialogOpen} barbeiro={selectedBarbeiro} onSuccess={fetchBarbeiros} />

      <BarbeiroInativarAssistenteDialog
        open={assistenteOpen}
        onOpenChange={setAssistenteOpen}
        barbeiro={barbeiroParaInativar}
        onSuccess={fetchBarbeiros}
      />

      <BarbeiroAvaliacoesDialog
        open={avaliacoesDialogOpen}
        onOpenChange={setAvaliacoesDialogOpen}
        barbeiro={barbeiroParaAvaliacoes}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o {labels.profissional.toLowerCase()} "{barbeiroToDelete?.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
