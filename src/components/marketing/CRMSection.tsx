import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, MessageCircle, Mail, User, Calendar, Plus, Loader2, Search, Trash2, Edit, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InteracaoDialog } from "./InteracaoDialog";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Interacao = {
  id: string;
  cliente_id: string;
  tipo: string;
  descricao: string | null;
  data_interacao: string;
  responsavel_id: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  status: string;
  clientes?: { nome: string };
  barbeiros?: { nome: string } | null;
};

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  total_visitas: number | null;
  ultima_visita: string | null;
};

export function CRMSection() {
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInteracao, setEditingInteracao] = useState<Interacao | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [interacoesRes, clientesRes] = await Promise.all([
        supabase
          .from("crm_interacoes")
          .select(`
            *,
            clientes (nome),
            barbeiros:responsavel_id (nome)
          `)
          .order("data_interacao", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome, telefone, email, total_visitas, ultima_visita")
          .order("nome"),
      ]);

      if (interacoesRes.error) throw interacoesRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setInteracoes(interacoesRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do CRM");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    try {
      const { error } = await supabase.from("crm_interacoes").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Interação excluída com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir interação");
    } finally {
      setDeleteId(null);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from("crm_interacoes")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado!");
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  }

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, React.ReactNode> = {
      ligacao: <Phone className="h-4 w-4" />,
      whatsapp: <MessageCircle className="h-4 w-4" />,
      email: <Mail className="h-4 w-4" />,
      visita: <User className="h-4 w-4" />,
    };
    return icons[tipo] || <Calendar className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      pendente: { label: "Pendente", variant: "secondary" },
      concluido: { label: "Concluído", variant: "default" },
      cancelado: { label: "Cancelado", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredInteracoes = interacoes.filter((i) => {
    const matchesSearch =
      i.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Clientes sem visita há mais de 30 dias
  const clientesInativos = clientes.filter((c) => {
    if (!c.ultima_visita) return true;
    const diasInativo = Math.floor(
      (new Date().getTime() - new Date(c.ultima_visita).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diasInativo > 30;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas de Clientes Inativos */}
      {clientesInativos.length > 0 && (
        <Card className="panel border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <Clock className="h-5 w-5" />
              Clientes Inativos ({clientesInativos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Estes clientes não visitam a barbearia há mais de 30 dias
            </p>
            <div className="flex flex-wrap gap-2">
              {clientesInativos.slice(0, 5).map((cliente) => (
                <Badge key={cliente.id} variant="outline" className="gap-1">
                  <User className="h-3 w-3" />
                  {cliente.nome}
                </Badge>
              ))}
              {clientesInativos.length > 5 && (
                <Badge variant="outline">+{clientesInativos.length - 5} mais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Interações */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Histórico de Interações
          </CardTitle>
          <Button
            size="sm"
            className="btn-wine"
            onClick={() => {
              setEditingInteracao(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova Interação
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-dark pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] input-dark">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredInteracoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma interação encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInteracoes.map((interacao) => (
                    <TableRow key={interacao.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {getTipoIcon(interacao.tipo)}
                          <span className="capitalize">{interacao.tipo}</span>
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{interacao.clientes?.nome}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{interacao.descricao || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(interacao.data_interacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{interacao.barbeiros?.nome || "-"}</TableCell>
                      <TableCell>{getStatusBadge(interacao.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {interacao.status === "pendente" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success"
                              onClick={() => handleStatusChange(interacao.id, "concluido")}
                              title="Marcar como concluído"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingInteracao(interacao);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteId(interacao.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InteracaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        interacao={editingInteracao}
        clientes={clientes}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta interação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
