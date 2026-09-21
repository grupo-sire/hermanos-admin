import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, MoreHorizontal, Send, Loader2, Settings, Sparkles, Globe, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmpresaDialog } from "@/components/admin/EmpresaDialog";
import { EmpresaConfigPanel } from "@/components/admin/EmpresaConfigPanel";
import { ChatbotBuilderSection } from "@/components/marketing/ChatbotBuilderSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Bot } from "lucide-react";

interface Empresa {
  id: string;
  nome: string;
  slug: string | null;
  email: string | null;
  telefone: string | null;
  status: string;
  tipo_estabelecimento: string | null;
  plano_id: string | null;
  created_at: string;
  onboarding_completo: boolean;
  planos?: { nome: string } | null;
}

interface Plano {
  id: string;
  nome: string;
  slug: string;
}

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [configEmpresa, setConfigEmpresa] = useState<Empresa | null>(null);
  const [chatbotEmpresa, setChatbotEmpresa] = useState<Empresa | null>(null);
  const [agenteIAEmpresa, setAgenteIAEmpresa] = useState<Empresa | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookUniversal, setWebhookUniversal] = useState("");
  const [savingUniversal, setSavingUniversal] = useState(false);
  const [webhookOnboarding, setWebhookOnboarding] = useState("");
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: empData }, { data: planoData }] = await Promise.all([
      supabase.from("empresas").select("*, planos(nome)").order("created_at", { ascending: false }),
      supabase.from("planos").select("id, nome, slug").order("ordem"),
    ]);
    setEmpresas((empData as any[]) || []);
    setPlanos(planoData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); fetchWebhookUniversal(); }, []);

  const fetchWebhookUniversal = async () => {
    const { data: dataUniv } = await supabase.from("configuracoes_plataforma").select("valor").eq("chave", "webhook_n8n_universal").maybeSingle();
    if (dataUniv) setWebhookUniversal(dataUniv.valor || "");
    
    const { data: dataOnb } = await supabase.from("configuracoes_plataforma").select("valor").eq("chave", "webhook_n8n_onboarding").maybeSingle();
    if (dataOnb) setWebhookOnboarding(dataOnb.valor || "");
  };

  const handleSaveUniversal = async () => {
    setSavingUniversal(true);
    try {
      const { error } = await supabase.from("configuracoes_plataforma").update({ valor: webhookUniversal, updated_at: new Date().toISOString() }).eq("chave", "webhook_n8n_universal");
      if (error) throw error;
      toast.success("Webhook universal salvo!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSavingUniversal(false);
    }
  };

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    try {
      const { data: existing } = await supabase.from("configuracoes_plataforma").select("id").eq("chave", "webhook_n8n_onboarding").maybeSingle();
      if (existing) {
        await supabase.from("configuracoes_plataforma").update({ valor: webhookOnboarding, updated_at: new Date().toISOString() }).eq("chave", "webhook_n8n_onboarding");
      } else {
        await supabase.from("configuracoes_plataforma").insert({ chave: "webhook_n8n_onboarding", valor: webhookOnboarding });
      }
      toast.success("Webhook de Onboarding salvo!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleDelete = async (empresa: Empresa) => {
    setDeleting(true);
    try {
      const id = empresa.id;

      // Delete in correct FK order (children before parents)
      const tables = [
        "comanda_itens", "comandas", "agendamento_servicos", "agendamentos",
        "agenda_bloqueios", "estoque_movimentacoes", "campanha_envios",
        "crm_interacoes", "crm_funil_clientes", "crm_funil_estagios",
        "cliente_pontos", "barbeiros", "clientes", "servicos", "produtos",
        "categorias", "horarios_funcionamento", "unidades", "campanhas",
        "cupons", "convites", "perfil_permissoes", "perfis_acesso",
        "user_roles", "email_config", "evolution_config", "chatbot_flows",
        "chatbot_fluxos", "planos_fidelidade", "ads_metrics",
      ] as const;

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq("empresa_id", id);
        if (error) {
          console.warn(`Warning deleting from ${table}:`, error.message);
        }
      }

      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Empresa excluída com sucesso");
      fetchData();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir empresa: " + (error.message || "erro desconhecido"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleResendInvite = async (empresa: Empresa) => {
    if (!empresa.email) {
      toast.error("Esta empresa não possui email cadastrado");
      return;
    }
    setResending(empresa.id);
    try {
      // Dispara webhook do n8n ao invés de usar a edge function inconsistente
      const targetWebhook = webhookOnboarding || "https://n8n.seudominio.com/webhook/onboarding";
      
      const response = await fetch(targetWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "empresa.reenviar_convite",
          empresa_id: empresa.id,
          nome_empresa: empresa.nome,
          admin: {
            nome: empresa.nome,
            email: empresa.email
          }
        })
      });

      if (!response.ok) throw new Error("Erro HTTTP do n8n: " + response.status);
      
      toast.success("Convite reenviado pelo n8n para " + empresa.email);
    } catch (error: any) {
      toast.error("Erro ao contatar o n8n: " + (error.message || "erro desconhecido"));
    } finally {
      setResending(null);
    }
  };

  const handleToggleStatus = async (empresa: Empresa) => {
    const newStatus = empresa.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("empresas").update({ status: newStatus }).eq("id", empresa.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(`Empresa ${newStatus === "active" ? "ativada" : "suspensa"}`);
      fetchData();
    }
  };

  const filtered = empresas.filter(
    (e) => e.nome.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Empresas" description="Gerencie as empresas cadastradas na plataforma">
        <Button onClick={() => { setEditingEmpresa(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Empresa
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webhook Universal Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" /> Webhook n8n Universal (IA)
            </CardTitle>
            <CardDescription>
              URL do webhook n8n padrão para todas as empresas com Agente IA ativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                value={webhookUniversal}
                onChange={e => setWebhookUniversal(e.target.value)}
                placeholder="https://n8n.seudominio.com/webhook/agente-ia-universal"
                className="font-mono text-sm flex-1"
              />
              <Button onClick={handleSaveUniversal} disabled={savingUniversal} className="gap-2 shrink-0">
                {savingUniversal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Onboarding Card */}
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-5 w-5 text-info" /> Webhook n8n (Criação de Clientes)
            </CardTitle>
            <CardDescription>
              URL do n8n que recebe novos cadastros do Super Admin para envio de e-mail de acesso e Automações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                value={webhookOnboarding}
                onChange={e => setWebhookOnboarding(e.target.value)}
                placeholder="https://n8n.seudominio.com/webhook/onboarding"
                className="font-mono text-sm flex-1"
              />
              <Button onClick={handleSaveOnboarding} disabled={savingOnboarding} variant="secondary" className="gap-2 shrink-0">
                {savingOnboarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{empresas.length} empresas</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell>
              </TableRow>
            ) : (
              filtered.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{empresa.nome}</div>
                        <div className="text-xs text-muted-foreground">{empresa.email || "—"}</div>
                      </div>
                      {empresa.slug && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          title="Acessar Painel do Cliente"
                          asChild
                        >
                          <a href={`/${empresa.slug}/dashboard`} target="_blank" rel="noreferrer">
                            <Globe className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{(empresa as any).planos?.nome || "Sem plano"}</Badge>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{empresa.tipo_estabelecimento || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={empresa.status === "active" ? "default" : "destructive"}>
                      {empresa.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(empresa.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setConfigEmpresa(empresa)}>
                          <Settings className="h-4 w-4 mr-2" /> Configurações
                        </DropdownMenuItem>
                        {empresa.slug && (
                          <DropdownMenuItem asChild>
                            <a href={`/${empresa.slug}/dashboard`} target="_blank" rel="noreferrer">
                              <Globe className="h-4 w-4 mr-2" /> Acessar Painel
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setChatbotEmpresa(empresa)}>
                          <Bot className="h-4 w-4 mr-2" /> Chatbot
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          setAgenteIAEmpresa(empresa);
                          const { data } = await supabase.from("agentes_ia").select("webhook_n8n_url").eq("empresa_id", empresa.id).maybeSingle();
                          setWebhookUrl(data?.webhook_n8n_url || "");
                        }}>
                          <Sparkles className="h-4 w-4 mr-2" /> Agente IA
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingEmpresa(empresa); setDialogOpen(true); }}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(empresa)}>
                          {empresa.status === "active" ? "Suspender" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResendInvite(empresa)} disabled={resending === empresa.id}>
                          {resending === empresa.id ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                          ) : (
                            <><Send className="h-4 w-4 mr-2" /> Reenviar Convite</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(empresa)}>
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

      <EmpresaDialog open={dialogOpen} onOpenChange={setDialogOpen} empresa={editingEmpresa} planos={planos} onSuccess={fetchData} />

      {configEmpresa && (
        <EmpresaConfigPanel
          empresaId={configEmpresa.id}
          empresaNome={configEmpresa.nome}
          open={!!configEmpresa}
          onOpenChange={(open) => { if (!open) { setConfigEmpresa(null); fetchData(); } }}
        />
      )}

      {chatbotEmpresa && (
        <Dialog open={!!chatbotEmpresa} onOpenChange={(open) => !open && setChatbotEmpresa(null)}>
          <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Gerenciar Chatbot - {chatbotEmpresa.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 bg-background">
              <ChatbotBuilderSection empresaId={chatbotEmpresa.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {agenteIAEmpresa && (
        <Dialog open={!!agenteIAEmpresa} onOpenChange={(open) => !open && setAgenteIAEmpresa(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Agente IA — {agenteIAEmpresa.nome}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">URL do Webhook n8n</label>
                <Input
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://n8n.seudominio.com/webhook/..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  O webhook receberá: mensagem, telefone, e contexto completo (serviços, profissionais, produtos, histórico).
                  Deixe em branco para desativar a IA e usar o chatbot padrão.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAgenteIAEmpresa(null)}>Cancelar</Button>
                <Button
                  onClick={async () => {
                    setSavingWebhook(true);
                    try {
                      const { data: existing } = await supabase.from("agentes_ia").select("id").eq("empresa_id", agenteIAEmpresa.id).maybeSingle();
                      if (existing) {
                        await supabase.from("agentes_ia").update({ webhook_n8n_url: webhookUrl }).eq("empresa_id", agenteIAEmpresa.id);
                      } else {
                        await supabase.from("agentes_ia").insert({ empresa_id: agenteIAEmpresa.id, webhook_n8n_url: webhookUrl, ativo: false });
                      }
                      toast.success("Webhook salvo!");
                      setAgenteIAEmpresa(null);
                    } catch (err: any) {
                      toast.error("Erro: " + err.message);
                    } finally {
                      setSavingWebhook(false);
                    }
                  }}
                  disabled={savingWebhook}
                  className="gap-2"
                >
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Salvar Webhook
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Todos os dados relacionados serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteTarget && handleDelete(deleteTarget); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo...</> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
