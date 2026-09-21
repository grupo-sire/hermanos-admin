import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Clock, MoreHorizontal, Loader2 } from "lucide-react";
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
import { ServicoDialog } from "@/components/servicos/ServicoDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables } from "@/integrations/supabase/types";

export default function Servicos() {
  const { empresaId } = useEmpresa();
  const { isSuperAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [servicos, setServicos] = useState<Tables<"servicos">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedServico, setSelectedServico] = useState<Tables<"servicos"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [servicoToDelete, setServicoToDelete] = useState<Tables<"servicos"> | null>(null);

  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";

  useEffect(() => {
    fetchServicos();
  }, [empresaId]);

  const fetchServicos = async () => {
    setLoading(true);
    let query = supabase.from("servicos").select("*").order("nome");
    if (defaultEmpresaId) query = query.eq("empresa_id", defaultEmpresaId);

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao carregar serviços", description: error.message, variant: "destructive" });
    } else {
      setServicos(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (servico: Tables<"servicos">) => {
    setSelectedServico(servico);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedServico(null);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (servico: Tables<"servicos">) => {
    const newStatus = servico.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("servicos")
      .update({ status: newStatus })
      .eq("id", servico.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Serviço ${newStatus === "active" ? "ativado" : "desativado"} com sucesso!` });
      fetchServicos();
    }
  };

  const handleDelete = async () => {
    if (!servicoToDelete) return;

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", servicoToDelete.id);

    if (error) {
      toast({ title: "Erro ao excluir serviço", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Serviço excluído com sucesso!" });
      fetchServicos();
    }
    setDeleteDialogOpen(false);
    setServicoToDelete(null);
  };

  const filteredServices = servicos.filter((service) =>
    service.nome.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Serviços"
        description="Gerencie os serviços oferecidos"
      >
        {isSuperAdmin && (
          <Button className="btn-wine" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        )}
      </PageHeader>

      <div className="panel">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold">Serviço</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Duração</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Preço</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                  <TableHead className="text-muted-foreground font-semibold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum serviço encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => (
                    <TableRow key={service.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{service.nome}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {service.duracao_minutos} min
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {formatCurrency(Number(service.preco))}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          service.status === "active"
                            ? "bg-success/20 text-success"
                            : "bg-muted/50 text-muted-foreground"
                        }`}>
                          {service.status === "active" ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(service)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(service)}>
                                {service.status === "active" ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setServicoToDelete(service);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ServicoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        servico={selectedServico}
        onSuccess={fetchServicos}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço "{servicoToDelete?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
