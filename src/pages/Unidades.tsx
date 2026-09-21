import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MapPin, Phone, Users, Clock, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { UnidadeDialog } from "@/components/unidades/UnidadeDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import type { Tables } from "@/integrations/supabase/types";

interface UnidadeWithBarbers extends Tables<"unidades"> {
  barberCount?: number;
}

export default function Unidades() {
  const [search, setSearch] = useState("");
  const [unidades, setUnidades] = useState<UnidadeWithBarbers[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<Tables<"unidades"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unidadeToDelete, setUnidadeToDelete] = useState<Tables<"unidades"> | null>(null);
  const { labels } = useEmpresa();

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    setLoading(true);
    
    const { data: unidadesData, error } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");

    if (error) {
      toast({ title: "Erro ao carregar unidades", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch barber counts for each unit
    const { data: barbeirosData } = await supabase
      .from("barbeiros")
      .select("unidade_id")
      .eq("status", "active");

    const barberCounts: Record<string, number> = {};
    barbeirosData?.forEach((b) => {
      if (b.unidade_id) {
        barberCounts[b.unidade_id] = (barberCounts[b.unidade_id] || 0) + 1;
      }
    });

    const unidadesWithCounts = unidadesData?.map((u) => ({
      ...u,
      barberCount: barberCounts[u.id] || 0,
    })) || [];

    setUnidades(unidadesWithCounts);
    setLoading(false);
  };

  const handleEdit = (unidade: Tables<"unidades">) => {
    setSelectedUnidade(unidade);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedUnidade(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!unidadeToDelete) return;

    const { error } = await supabase
      .from("unidades")
      .delete()
      .eq("id", unidadeToDelete.id);

    if (error) {
      toast({ title: "Erro ao excluir unidade", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Unidade excluída com sucesso!" });
      fetchUnidades();
    }
    setDeleteDialogOpen(false);
    setUnidadeToDelete(null);
  };

  const filteredUnits = unidades.filter((unit) =>
    unit.nome.toLowerCase().includes(search.toLowerCase()) ||
    unit.endereco.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Unidades"
        description="Gerencie suas filiais"
      >
        <Button className="btn-wine" onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Unidade
        </Button>
      </PageHeader>

      <div className="panel">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUnits.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Nenhuma unidade encontrada
            </div>
          ) : (
            filteredUnits.map((unit) => (
              <div
                key={unit.id}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{unit.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      unit.status === "active"
                        ? "bg-success/20 text-success"
                        : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {unit.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-white/10">
                        <DropdownMenuItem onClick={() => handleEdit(unit)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setUnidadeToDelete(unit);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{unit.endereco}</span>
                  </div>
                  {unit.telefone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {unit.telefone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {unit.horario_abertura} - {unit.horario_fechamento}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-medium">{unit.barberCount} {labels.profissionais.toLowerCase()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <UnidadeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        unidade={selectedUnidade}
        onSuccess={fetchUnidades}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a unidade "{unidadeToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
