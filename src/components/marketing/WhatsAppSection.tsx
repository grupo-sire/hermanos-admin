import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageCircle, QrCode, Wifi, WifiOff, Plus, Loader2, Trash2, Edit, Send, Bot, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

type EvolutionConfig = {
  id: string;
  instance_name: string;
  api_url: string;
  connected: boolean;
  qr_code: string | null;
  phone_number: string | null;
};

type ChatbotFluxo = {
  id: string;
  nome: string;
  gatilho: string;
  resposta: string;
  ativo: boolean;
  ordem: number;
};

type Mensagem = {
  id: string;
  cliente_id: string | null;
  telefone: string;
  mensagem: string;
  direcao: string;
  tipo: string;
  lida: boolean;
  created_at: string;
};

export function WhatsAppSection() {
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [fluxos, setFluxos] = useState<ChatbotFluxo[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Config form
  const [instanceName, setInstanceName] = useState("");
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Fluxo form
  const [fluxoDialogOpen, setFluxoDialogOpen] = useState(false);
  const [editingFluxo, setEditingFluxo] = useState<ChatbotFluxo | null>(null);
  const [fluxoNome, setFluxoNome] = useState("");
  const [fluxoGatilho, setFluxoGatilho] = useState("");
  const [fluxoResposta, setFluxoResposta] = useState("");
  const [deleteFluxoId, setDeleteFluxoId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, fluxosRes, mensagensRes] = await Promise.all([
        supabase.from("evolution_config").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("chatbot_fluxos").select("*").order("ordem"),
        supabase.from("whatsapp_mensagens").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (configRes.data) setConfig(configRes.data);
      setFluxos(fluxosRes.data || []);
      setMensagens(mensagensRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!instanceName.trim()) {
      toast.error("Informe o nome da instância");
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "connect", instanceName: instanceName.trim() },
      });

      if (error) throw error;

      if (data?.qrCode) {
        setQrCode(data.qrCode);
      }

      if (data?.config) {
        setConfig(data.config);
      }

      toast.success("Solicitação de conexão enviada!");
      setShowConfigDialog(false);
      fetchData();
    } catch (error: any) {
      console.error("Erro ao conectar:", error);
      toast.error(error.message || "Erro ao conectar com Evolution API");
    } finally {
      setConnecting(false);
    }
  }

  async function handleCheckStatus() {
    if (!config) return;
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "status", instanceName: config.instance_name },
      });
      if (error) throw error;

      if (data?.connected) {
        await supabase.from("evolution_config").update({ connected: true, phone_number: data.phone || null }).eq("id", config.id);
        setConfig(prev => prev ? { ...prev, connected: true, phone_number: data.phone || null } : null);
        setQrCode(null);
        toast.success("WhatsApp conectado com sucesso!");
      } else {
        if (data?.qrCode) setQrCode(data.qrCode);
        toast.info("Aguardando leitura do QR Code...");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao verificar status");
    }
  }

  async function handleDisconnect() {
    if (!config) return;
    setConnecting(true);
    try {
      const { error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "disconnect", instanceName: config.instance_name },
      });
      if (error) throw error;

      await supabase.from("evolution_config").update({ connected: false, qr_code: null }).eq("id", config.id);
      setConfig(prev => prev ? { ...prev, connected: false, qr_code: null } : null);
      setQrCode(null);
      toast.success("WhatsApp desconectado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao desconectar");
    } finally {
      setConnecting(false);
    }
  }

  async function handleReconnect() {
    if (!config) return;
    setConnecting(true);
    try {
      // First disconnect, then reconnect
      await supabase.functions.invoke("evolution-api", {
        body: { action: "disconnect", instanceName: config.instance_name },
      });

      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "connect", instanceName: config.instance_name },
      });
      if (error) throw error;

      if (data?.qrCode) setQrCode(data.qrCode);
      await supabase.from("evolution_config").update({ connected: false, qr_code: data?.qrCode || null }).eq("id", config.id);
      setConfig(prev => prev ? { ...prev, connected: false } : null);
      toast.success("Reconectando... Escaneie o QR Code novamente.");
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao reconectar");
    } finally {
      setConnecting(false);
    }
  }

  async function handleActiveWebhook() {
    if (!config) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "active-webhook", instanceName: config.instance_name },
      });
      if (error) throw error;

      if (data?.success) {
        toast.success("API ativada e Webhook configurado com sucesso!");
      } else {
        toast.error("Erro ao configurar Webhook");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao ativar API");
    } finally {
      setConnecting(false);
    }
  }

  async function saveFluxo() {
    if (!fluxoNome.trim() || !fluxoGatilho.trim() || !fluxoResposta.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    try {
      const payload = { nome: fluxoNome, gatilho: fluxoGatilho, resposta: fluxoResposta };
      if (editingFluxo) {
        const { error } = await supabase.from("chatbot_fluxos").update(payload).eq("id", editingFluxo.id);
        if (error) throw error;
        toast.success("Fluxo atualizado!");
      } else {
        const { error } = await supabase.from("chatbot_fluxos").insert({ ...payload, ordem: fluxos.length });
        if (error) throw error;
        toast.success("Fluxo criado!");
      }
      setFluxoDialogOpen(false);
      resetFluxoForm();
      fetchData();
    } catch (error) {
      toast.error("Erro ao salvar fluxo");
    }
  }

  async function deleteFluxo() {
    if (!deleteFluxoId) return;
    try {
      const { error } = await supabase.from("chatbot_fluxos").delete().eq("id", deleteFluxoId);
      if (error) throw error;
      toast.success("Fluxo excluído!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir fluxo");
    } finally {
      setDeleteFluxoId(null);
    }
  }

  async function toggleFluxo(id: string, ativo: boolean) {
    try {
      const { error } = await supabase.from("chatbot_fluxos").update({ ativo }).eq("id", id);
      if (error) throw error;
      setFluxos(prev => prev.map(f => f.id === id ? { ...f, ativo } : f));
    } catch (error) {
      toast.error("Erro ao atualizar fluxo");
    }
  }

  function resetFluxoForm() {
    setEditingFluxo(null);
    setFluxoNome("");
    setFluxoGatilho("");
    setFluxoResposta("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card className="panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-500" />
              Conexão WhatsApp (Evolution API)
            </div>
            {config ? (
              <Badge variant={config.connected ? "default" : "secondary"} className="gap-1">
                {config.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {config.connected ? "Conectado" : "Desconectado"}
              </Badge>
            ) : (
              <Button size="sm" className="btn-wine" onClick={() => setShowConfigDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Conectar
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!config && (
            <p className="text-sm text-muted-foreground">
              Configure sua instância da Evolution API para integrar o WhatsApp ao CRM.
            </p>
          )}
          {config && !config.connected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Instância: <strong>{config.instance_name}</strong>
              </p>
              {qrCode && (
                <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg max-w-xs mx-auto">
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48" />
                  <p className="text-xs text-gray-600 text-center">Escaneie o QR Code com seu WhatsApp</p>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button className="btn-wine" size="sm" onClick={handleCheckStatus} disabled={connecting}>
                    {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
                    Verificar Status / QR Code
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setInstanceName(config.instance_name); handleReconnect(); }} disabled={connecting}>
                    Nova Conexão
                  </Button>
                </div>
              </div>
            </div>
          )}
          {config?.connected && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Instância: <strong>{config.instance_name}</strong></span>
                {config.phone_number && <span className="text-muted-foreground">Telefone: <strong>{config.phone_number}</strong></span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCheckStatus}>Atualizar Status</Button>
                <Button variant="outline" size="sm" onClick={handleReconnect} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                  Reconectar
                </Button>
                <Button className="btn-wine" size="sm" onClick={handleActiveWebhook} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
                  Ativar API
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <WifiOff className="h-4 w-4 mr-1" />}
                  Desconectar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fluxos do Chatbot */}
      <Card className="panel">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary" />
            Fluxos do Chatbot
          </CardTitle>
          <Button size="sm" className="btn-wine" onClick={() => { resetFluxoForm(); setFluxoDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fluxo
          </Button>
        </CardHeader>
        <CardContent>
          {fluxos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum fluxo de chatbot configurado. Crie um para automatizar respostas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead>Resposta</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxos.map(fluxo => (
                  <TableRow key={fluxo.id}>
                    <TableCell className="font-medium">{fluxo.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{fluxo.gatilho}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{fluxo.resposta}</TableCell>
                    <TableCell>
                      <Switch checked={fluxo.ativo} onCheckedChange={(v) => toggleFluxo(fluxo.id, v)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                          setEditingFluxo(fluxo);
                          setFluxoNome(fluxo.nome);
                          setFluxoGatilho(fluxo.gatilho);
                          setFluxoResposta(fluxo.resposta);
                          setFluxoDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteFluxoId(fluxo.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Últimas Mensagens */}
      {mensagens.length > 0 && (
        <Card className="panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-primary" />
              Últimas Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {mensagens.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg p-2 text-sm ${msg.direcao === "enviada" ? "bg-primary/20 text-foreground" : "bg-secondary/50 text-foreground"}`}>
                      <p className="text-[10px] text-muted-foreground mb-1">{msg.telefone} • {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                      <p>{msg.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Evolution API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: minha-barbearia"
                className="input-dark"
              />
              <p className="text-xs text-muted-foreground">O nome da instância configurada na sua Evolution API.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancelar</Button>
              <Button className="btn-wine" onClick={handleConnect} disabled={connecting}>
                {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conectar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fluxo Dialog */}
      <Dialog open={fluxoDialogOpen} onOpenChange={setFluxoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFluxo ? "Editar Fluxo" : "Novo Fluxo de Chatbot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={fluxoNome} onChange={(e) => setFluxoNome(e.target.value)} placeholder="Ex: Boas-vindas" className="input-dark" />
            </div>
            <div className="space-y-2">
              <Label>Gatilho (palavra-chave)</Label>
              <Input value={fluxoGatilho} onChange={(e) => setFluxoGatilho(e.target.value)} placeholder="Ex: oi, olá, horário" className="input-dark" />
              <p className="text-xs text-muted-foreground">Palavra ou frase que ativa essa resposta automática.</p>
            </div>
            <div className="space-y-2">
              <Label>Resposta</Label>
              <Textarea value={fluxoResposta} onChange={(e) => setFluxoResposta(e.target.value)} placeholder="Ex: Olá! Seja bem-vindo à nossa barbearia..." className="input-dark min-h-[100px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFluxoDialogOpen(false)}>Cancelar</Button>
              <Button className="btn-wine" onClick={saveFluxo}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Fluxo Alert */}
      <AlertDialog open={!!deleteFluxoId} onOpenChange={() => setDeleteFluxoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteFluxo} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
