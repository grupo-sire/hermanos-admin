import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, Gift, Calendar, Percent, Bell, Star, Plus, Loader2, Trash2, Edit, Send, MessageCircle, Mail, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CupomDialog } from "./CupomDialog";
import { CampanhaDialog } from "./CampanhaDialog";
import { FidelidadeDialog } from "./FidelidadeDialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Cupom = {
  id: string;
  codigo: string;
  tipo: string;
  valor: number;
  data_fim: string | null;
  status: string;
  usos_atual: number;
  max_usos: number | null;
};

type Campanha = {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  desconto_percentual: number | null;
  cashback_percentual: number | null;
};

type PlanoFidelidade = {
  id: string;
  nome: string;
  pontos_por_real: number;
  pontos_para_resgate: number;
  valor_resgate: number;
  status: string;
};

export function AcoesPromocionais() {
  const { empresaId } = useEmpresa();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [planos, setPlanos] = useState<PlanoFidelidade[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [cupomDialogOpen, setCupomDialogOpen] = useState(false);
  const [campanhaDialogOpen, setCampanhaDialogOpen] = useState(false);
  const [fidelidadeDialogOpen, setFidelidadeDialogOpen] = useState(false);
  
  const [editingCupom, setEditingCupom] = useState<Cupom | null>(null);
  const [editingCampanha, setEditingCampanha] = useState<Campanha | null>(null);
  const [editingPlano, setEditingPlano] = useState<PlanoFidelidade | null>(null);
  
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string } | null>(null);
  const [disparando, setDisparando] = useState<string | null>(null);
  const [enviosDialog, setEnviosDialog] = useState<string | null>(null);
  const [envios, setEnvios] = useState<any[]>([]);
  const [loadingEnvios, setLoadingEnvios] = useState(false);

  useEffect(() => {
    if (empresaId) fetchData();
  }, [empresaId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [cuponsRes, campanhasRes, planosRes] = await Promise.all([
        supabase.from("cupons").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }),
        supabase.from("campanhas").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }),
        supabase.from("planos_fidelidade").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }),
      ]);

      if (cuponsRes.error) throw cuponsRes.error;
      if (campanhasRes.error) throw campanhasRes.error;
      if (planosRes.error) throw planosRes.error;

      setCupons(cuponsRes.data || []);
      setCampanhas(campanhasRes.data || []);
      setPlanos(planosRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados de marketing");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteDialog) return;

    try {
      let error;
      if (deleteDialog.type === "cupom") {
        ({ error } = await supabase.from("cupons").delete().eq("id", deleteDialog.id));
      } else if (deleteDialog.type === "campanha") {
        ({ error } = await supabase.from("campanhas").delete().eq("id", deleteDialog.id));
      } else if (deleteDialog.type === "plano") {
        ({ error } = await supabase.from("planos_fidelidade").delete().eq("id", deleteDialog.id));
      }

      if (error) throw error;
      toast.success("Item excluído com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir item");
    } finally {
      setDeleteDialog(null);
    }
  }

  async function dispararCampanha(campanhaId: string, canal: "whatsapp" | "email") {
    setDisparando(campanhaId);
    try {
      const { data, error } = await supabase.functions.invoke("disparar-campanha", {
        body: { campanha_id: campanhaId, canal },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || `Campanha disparada: ${data.enviados} envios`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao disparar campanha");
    } finally {
      setDisparando(null);
    }
  }

  async function fetchEnvios(campanhaId: string) {
    setEnviosDialog(campanhaId);
    setLoadingEnvios(true);
    try {
      const { data, error } = await supabase
        .from("campanha_envios")
        .select("*, clientes(nome, telefone, email)")
        .eq("campanha_id", campanhaId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setEnvios(data || []);
    } catch {
      toast.error("Erro ao carregar envios");
    } finally {
      setLoadingEnvios(false);
    }
  }

  const getCampanhaTipo = (tipo: string) => {
    const tipos: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
      lembrete: { label: "Lembrete", icon: <Bell className="h-4 w-4" />, color: "bg-info/20 text-info" },
      aniversario: { label: "Aniversário", icon: <Calendar className="h-4 w-4" />, color: "bg-success/20 text-success" },
      cashback: { label: "Cashback", icon: <Percent className="h-4 w-4" />, color: "bg-warning/20 text-warning" },
      promocao: { label: "Promoção", icon: <Gift className="h-4 w-4" />, color: "bg-primary/20 text-primary" },
    };
    return tipos[tipo] || { label: tipo, icon: <Star className="h-4 w-4" />, color: "bg-muted text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cupons */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-5 w-5 text-primary" />
            Cupons de Desconto
          </CardTitle>
          <Button
            size="sm"
            className="btn-wine"
            onClick={() => {
              setEditingCupom(null);
              setCupomDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo Cupom
          </Button>
        </CardHeader>
        <CardContent>
          {cupons.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cupom cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cupons.map((cupom) => (
                <div
                  key={cupom.id}
                  className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <code className="bg-primary/20 text-primary px-2 py-1 rounded font-mono text-sm">
                      {cupom.codigo}
                    </code>
                    <Badge variant={cupom.status === "active" ? "default" : "secondary"}>
                      {cupom.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {cupom.tipo === "percentual" ? `${cupom.valor}% OFF` : `R$ ${cupom.valor.toFixed(2)} OFF`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Usos: {cupom.usos_atual}{cupom.max_usos ? `/${cupom.max_usos}` : ""}
                    {cupom.data_fim && ` • Até ${new Date(cupom.data_fim).toLocaleDateString("pt-BR")}`}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingCupom(cupom);
                        setCupomDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleteDialog({ type: "cupom", id: cupom.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campanhas */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" />
            Campanhas Automáticas
          </CardTitle>
          <Button
            size="sm"
            className="btn-wine"
            onClick={() => {
              setEditingCampanha(null);
              setCampanhaDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova Campanha
          </Button>
        </CardHeader>
        <CardContent>
          {campanhas.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma campanha cadastrada</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campanhas.map((campanha) => {
                const tipoInfo = getCampanhaTipo(campanha.tipo);
                return (
                  <div
                    key={campanha.id}
                    className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`p-2 rounded-lg ${tipoInfo.color}`}>
                          {tipoInfo.icon}
                        </span>
                        <span className="font-medium">{campanha.nome}</span>
                      </div>
                      <Badge variant={campanha.status === "active" ? "default" : "secondary"}>
                        {campanha.status === "active" ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tipoInfo.label}
                      {campanha.desconto_percentual && ` • ${campanha.desconto_percentual}% desconto`}
                      {campanha.cashback_percentual && ` • ${campanha.cashback_percentual}% cashback`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {campanha.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            disabled={disparando === campanha.id}
                            onClick={() => dispararCampanha(campanha.id, "whatsapp")}
                          >
                            {disparando === campanha.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            disabled={disparando === campanha.id}
                            onClick={() => dispararCampanha(campanha.id, "email")}
                          >
                            {disparando === campanha.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                            E-mail
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs"
                        onClick={() => fetchEnvios(campanha.id)}
                      >
                        <History className="h-3 w-3" /> Envios
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCampanha(campanha);
                          setCampanhaDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteDialog({ type: "campanha", id: campanha.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plano de Fidelidade */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5 text-primary" />
            Planos de Fidelidade
          </CardTitle>
          <Button
            size="sm"
            className="btn-wine"
            onClick={() => {
              setEditingPlano(null);
              setFidelidadeDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Novo Plano
          </Button>
        </CardHeader>
        <CardContent>
          {planos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum plano de fidelidade cadastrado</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {planos.map((plano) => (
                <div
                  key={plano.id}
                  className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{plano.nome}</span>
                    <Badge variant={plano.status === "active" ? "default" : "secondary"}>
                      {plano.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{plano.pontos_por_real} ponto(s) por R$ 1,00</p>
                    <p>{plano.pontos_para_resgate} pontos = R$ {plano.valor_resgate.toFixed(2)} de desconto</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingPlano(plano);
                        setFidelidadeDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleteDialog({ type: "plano", id: plano.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CupomDialog
        open={cupomDialogOpen}
        onOpenChange={setCupomDialogOpen}
        cupom={editingCupom}
        onSuccess={fetchData}
      />

      <CampanhaDialog
        open={campanhaDialogOpen}
        onOpenChange={setCampanhaDialogOpen}
        campanha={editingCampanha}
        onSuccess={fetchData}
      />

      <FidelidadeDialog
        open={fidelidadeDialogOpen}
        onOpenChange={setFidelidadeDialogOpen}
        plano={editingPlano}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.
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

      {/* Envios Dialog */}
      <Dialog open={!!enviosDialog} onOpenChange={() => setEnviosDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico de Envios
            </DialogTitle>
          </DialogHeader>
          {loadingEnvios ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : envios.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum envio registrado para esta campanha.</p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {envios.map((envio) => (
                  <div key={envio.id} className="bg-secondary/30 border border-border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{envio.clientes?.nome || "Cliente"}</span>
                      <Badge variant={envio.status === "enviado" ? "default" : "destructive"} className="text-xs">
                        {envio.status === "enviado" ? "Enviado" : "Falha"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Badge variant="outline" className="text-xs gap-1">
                        {envio.canal === "whatsapp" ? <MessageCircle className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                        {envio.canal}
                      </Badge>
                      <span>{format(new Date(envio.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      {envio.clientes?.telefone && <span>• {envio.clientes.telefone}</span>}
                    </div>
                    {envio.mensagem && (
                      <div className="bg-muted/40 rounded p-2 text-xs text-muted-foreground whitespace-pre-wrap mt-1 line-clamp-3">
                        {envio.mensagem}
                      </div>
                    )}
                    {envio.erro && <p className="text-destructive text-xs">{envio.erro}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
