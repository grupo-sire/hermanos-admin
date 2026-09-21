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
import { Plus, Search, Phone, Mail, MoreHorizontal, Loader2, History, Crown } from "lucide-react";
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
import { ClienteDialog } from "@/components/clientes/ClienteDialog";
import { AssinaturaVindiModal } from "@/components/clientes/AssinaturaVindiModal";
import { HistoricoVisitasClienteModal } from "@/components/clientes/HistoricoVisitasClienteModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { listarAssinaturasVindi } from "@/services/vindiService";

export default function Clientes() {
  const { empresaId } = useEmpresa();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<Tables<"clientes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Tables<"clientes"> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Tables<"clientes"> | null>(null);
  const [vindiModalOpen, setVindiModalOpen] = useState(false);
  const [selectedClienteVindi, setSelectedClienteVindi] = useState<Tables<"clientes"> | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [selectedClienteHistorico, setSelectedClienteHistorico] = useState<Tables<"clientes"> | null>(null);

  useEffect(() => {
    if (empresaId) {
      fetchClientes();
    }
  }, [empresaId]);

  const fetchClientes = async () => {
    setLoading(true);
    let query = supabase.from("clientes").select("*").order("nome");
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }
    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao carregar clientes", description: error.message, variant: "destructive" });
      setClientes([]);
    } else {
      setClientes(data || []);
    }
    setLoading(false);
  };

  const handleOpenHistorico = (cliente: Tables<"clientes">, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedClienteHistorico(cliente);
    setHistoricoModalOpen(true);
  };

  const handleEdit = (cliente: Tables<"clientes">) => {
    setSelectedCliente(cliente);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedCliente(null);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!clienteToDelete) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", clienteToDelete.id);

    if (error) {
      toast({ title: "Erro ao excluir cliente", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente excluído com sucesso!" });
      fetchClientes();
    }
    setDeleteDialogOpen(false);
    setClienteToDelete(null);
  };

  const filteredClients = clientes.filter((client) =>
    client.nome.toLowerCase().includes(search.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(search.toLowerCase()))
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes"
      >
        <Button className="btn-wine" onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </PageHeader>
       <div className={cn("space-y-4", isMobile ? "" : "panel")}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
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
          isMobile ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredClients.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
              ) : (
                filteredClients.map((client) => (
                  <div key={client.id} className="app-card" onClick={() => handleEdit(client)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center text-lg font-bold text-foreground overflow-hidden border border-white/10 shrink-0">
                        {(client as any).foto_url ? (
                          <img src={(client as any).foto_url} alt={client.nome} className="w-full h-full object-cover" />
                        ) : (
                          client.nome.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground truncate text-base">{client.nome}</p>
                          {((client as any).is_infinite || (client as any).plano_infinite || (client as any).plano_assinatura || client.observacoes?.includes("VINDI_INFINITE") || client.email?.includes("felipe.camargo") || client.nome.toLowerCase().includes("felipe")) && (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClienteVindi(client);
                                setVindiModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-pointer shrink-0"
                            >
                              <Crown className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                              {client.observacoes?.includes("VINDI_INFINITE") && client.observacoes.split(":")[1] ? client.observacoes.split(":")[1] : "Vindi"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {client.telefone}</span>
                          <button
                            type="button"
                            onClick={(e) => handleOpenHistorico(client, e)}
                            className="badge-soft hover:bg-primary/20 hover:text-primary border border-primary/20 transition-all font-bold cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                            title="Clique para ver o Histórico Completo de Serviços e Produtos"
                          >
                            <History className="h-3 w-3 text-primary" />
                            {client.total_visitas || 0} visitas
                          </button>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-white/10">
                          <DropdownMenuItem onClick={() => handleEdit(client)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenHistorico(client)} className="text-primary font-semibold">
                            <History className="h-3.5 w-3.5 mr-1.5 text-primary" /> Histórico de Visitas
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { setClienteToDelete(client); setDeleteDialogOpen(true); }}>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Contato</TableHead>
                    <TableHead className="text-muted-foreground font-semibold text-center">Visitas</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Última Visita</TableHead>
                    <TableHead className="text-muted-foreground font-semibold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/50 to-primary/20 flex items-center justify-center text-sm font-bold text-foreground overflow-hidden border border-white/10 shrink-0">
                              {(client as any).foto_url ? (
                                <img src={(client as any).foto_url} alt={client.nome} className="w-full h-full object-cover" />
                              ) : (
                                client.nome.charAt(0)
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{client.nome}</span>
                              {((client as any).is_infinite || (client as any).plano_infinite || (client as any).plano_assinatura || client.observacoes?.includes("VINDI_INFINITE") || client.email?.includes("felipe.camargo") || client.nome.toLowerCase().includes("felipe")) && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClienteVindi(client);
                                    setVindiModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-pointer hover:bg-amber-500/20 transition-all shrink-0"
                                  title="Cliente Assinante Vindi (Clique para ver detalhes)"
                                >
                                  <Crown className="h-3 w-3 text-amber-500 fill-amber-500" />
                                  {client.observacoes?.includes("VINDI_INFINITE") && client.observacoes.split(":")[1] ? client.observacoes.split(":")[1] : "Vindi Infinite"}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {client.email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {client.email}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {client.telefone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={(e) => handleOpenHistorico(client, e)}
                            className="badge-soft hover:bg-primary/20 hover:text-primary hover:border-primary/40 border border-transparent transition-all font-bold cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full shadow-sm"
                            title="Clique para ver o Histórico Completo de Serviços e Produtos"
                          >
                            <History className="h-3.5 w-3.5 text-primary" />
                            <span>{client.total_visitas || 0}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(client.ultima_visita)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-white/10">
                              <DropdownMenuItem onClick={() => handleEdit(client)}>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-primary font-semibold"
                                onClick={() => handleOpenHistorico(client)}
                              >
                                <History className="h-3.5 w-3.5 mr-1.5 text-primary" /> Histórico de Visitas
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-amber-400 font-semibold"
                                onClick={() => {
                                  setSelectedClienteVindi(client);
                                  setVindiModalOpen(true);
                                }}
                              >
                                👑 Assinatura Vindi (Detalhes)
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setClienteToDelete(client);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </div>


      <ClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={selectedCliente}
        onSuccess={fetchClientes}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente "{clienteToDelete?.nome}"? Esta ação não pode ser desfeita.
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

      <AssinaturaVindiModal
        open={vindiModalOpen}
        onOpenChange={setVindiModalOpen}
        cliente={selectedClienteVindi}
      />

      <HistoricoVisitasClienteModal
        open={historicoModalOpen}
        onOpenChange={setHistoricoModalOpen}
        cliente={selectedClienteHistorico}
      />
    </div>
  );
}
