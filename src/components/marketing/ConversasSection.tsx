import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle, Send, User, Phone, Bot, UserCheck, Search, Loader2, Trash2, Smartphone, Instagram, Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversa = {
  id: string;
  telefone: string;
  cliente_id: string | null;
  nome_contato: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string | null;
  nao_lidas: number;
  atendimento_humano: boolean;
  estagio_funil_id: string | null;
  status: string;
};

type Mensagem = {
  id: string;
  telefone: string;
  mensagem: string;
  direcao: string;
  tipo: string;
  lida: boolean;
  created_at: string;
  cliente_id: string | null;
};

type Estagio = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
};

export function ConversasSection() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroCanal, setFiltroCanal] = useState<"todos" | "whatsapp" | "app" | "instagram">("todos");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    setupRealtime();
    return () => { supabase.removeAllChannels(); };
  }, []);

  useEffect(() => {
    if (selectedConversa) fetchMensagens(selectedConversa.telefone);
  }, [selectedConversa?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  function setupRealtime() {
    supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as Mensagem;
          setMensagens(prev => {
            if (selectedConversa && newMsg.telefone === selectedConversa.telefone) {
              return [...prev, newMsg];
            }
            return prev;
          });
          fetchConversas();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, () => {
        fetchConversas();
      })
      .subscribe();
  }

  async function fetchData() {
    setLoading(true);
    await Promise.all([fetchConversas(), fetchEstagios()]);
    setLoading(false);
  }

  async function fetchConversas() {
    const { data } = await supabase
      .from("whatsapp_conversas")
      .select("*")
      .order("ultima_mensagem_at", { ascending: false });
    if (data) setConversas(data);
  }

  async function fetchEstagios() {
    const { data } = await supabase
      .from("crm_funil_estagios")
      .select("*")
      .order("ordem");
    if (data) setEstagios(data);
  }

  async function fetchMensagens(telefone: string) {
    const { data } = await supabase
      .from("whatsapp_mensagens")
      .select("*")
      .eq("telefone", telefone)
      .order("created_at", { ascending: true });
    if (data) setMensagens(data);

    // mark as read
    if (selectedConversa) {
      await supabase
        .from("whatsapp_conversas")
        .update({ nao_lidas: 0 })
        .eq("id", selectedConversa.id);
    }
  }

  async function handleSend() {
    if (!novaMensagem.trim() || !selectedConversa) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "send",
          instanceName: (await supabase.from("evolution_config").select("instance_name").limit(1).maybeSingle()).data?.instance_name,
          phone: selectedConversa.telefone,
          message: novaMensagem.trim(),
        },
      });
      if (error) throw error;
      setNovaMensagem("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleHuman(conversa: Conversa) {
    const newVal = !conversa.atendimento_humano;
    await supabase.from("whatsapp_conversas").update({ atendimento_humano: newVal }).eq("id", conversa.id);
    setConversas(prev => prev.map(c => c.id === conversa.id ? { ...c, atendimento_humano: newVal } : c));
    if (selectedConversa?.id === conversa.id) {
      setSelectedConversa(prev => prev ? { ...prev, atendimento_humano: newVal } : null);
    }
    toast.success(newVal ? "Atendimento humano ativado" : "Chatbot reativado");
  }

  async function handleChangeEstagio(conversaId: string, estagioId: string) {
    await supabase.from("whatsapp_conversas").update({ estagio_funil_id: estagioId }).eq("id", conversaId);
    setConversas(prev => prev.map(c => c.id === conversaId ? { ...c, estagio_funil_id: estagioId } : c));
    if (selectedConversa?.id === conversaId) {
      setSelectedConversa(prev => prev ? { ...prev, estagio_funil_id: estagioId } : null);
    }
    toast.success("Estágio atualizado");
  }

  async function handleClearConversa() {
    if (!selectedConversa) return;
    try {
      await supabase.from("whatsapp_mensagens").delete().eq("telefone", selectedConversa.telefone);
      await supabase.from("whatsapp_conversas").update({
        ultima_mensagem: null,
        ultima_mensagem_at: null,
        nao_lidas: 0,
        flow_state: null,
        booking_state: null,
      }).eq("id", selectedConversa.id);
      setMensagens([]);
      toast.success("Conversa limpa!");
      fetchConversas();
    } catch {
      toast.error("Erro ao limpar conversa");
    }
  }

  async function handleClearAll() {
    if (!confirm("Tem certeza que deseja limpar TODAS as conversas e mensagens?")) return;
    try {
      await supabase.from("whatsapp_mensagens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("whatsapp_conversas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setConversas([]);
      setMensagens([]);
      setSelectedConversa(null);
      toast.success("Todas as conversas foram limpas!");
    } catch {
      toast.error("Erro ao limpar conversas");
    }
  }

  const filteredConversas = conversas.filter(c =>
    (c.nome_contato || c.telefone).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEstagioNome = (id: string | null) => estagios.find(e => e.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] border border-border rounded-lg overflow-hidden bg-background">
      {/* Left Panel - Conversations list */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 input-dark"
            />
          </div>
          {conversas.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-destructive hover:text-destructive gap-1" onClick={handleClearAll}>
              <Trash2 className="h-3 w-3" /> Limpar todas
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          {filteredConversas.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhuma conversa ainda
            </div>
          ) : (
            filteredConversas.map(conversa => {
              const estagio = getEstagioNome(conversa.estagio_funil_id);
              return (
                <div
                  key={conversa.id}
                  onClick={() => setSelectedConversa(conversa)}
                  className={`p-3 border-b border-border cursor-pointer hover:bg-secondary/50 transition-colors ${
                    selectedConversa?.id === conversa.id ? "bg-secondary/80" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {(conversa.nome_contato || conversa.telefone).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conversa.nome_contato || conversa.telefone}
                        </span>
                        {conversa.nao_lidas > 0 && (
                          <Badge className="bg-green-500 text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                            {conversa.nao_lidas}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conversa.ultima_mensagem || "Sem mensagens"}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {conversa.atendimento_humano && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-500 text-orange-500">
                            <UserCheck className="h-2.5 w-2.5 mr-0.5" /> Humano
                          </Badge>
                        )}
                        {estagio && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1" style={{ borderColor: estagio.cor, color: estagio.cor }}>
                            {estagio.nome}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col">
        {!selectedConversa ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">Selecione uma conversa</p>
              <p className="text-sm mt-1">Escolha uma conversa na lista ao lado</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {(selectedConversa.nome_contato || selectedConversa.telefone).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedConversa.nome_contato || selectedConversa.telefone}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {selectedConversa.telefone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedConversa.estagio_funil_id || ""}
                  onValueChange={(val) => handleChangeEstagio(selectedConversa.id, val)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Estágio do funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {estagios.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.cor }} />
                          {e.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={handleClearConversa}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Limpar
                </Button>
                <Button
                  variant={selectedConversa.atendimento_humano ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => handleToggleHuman(selectedConversa)}
                >
                  {selectedConversa.atendimento_humano ? (
                    <><UserCheck className="h-3.5 w-3.5" /> Humano</>
                  ) : (
                    <><Bot className="h-3.5 w-3.5" /> Bot</>
                  )}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {mensagens.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.direcao === "enviada"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
                      <p className={`text-[10px] mt-1 ${
                        msg.direcao === "enviada" ? "text-primary-foreground/60" : "text-muted-foreground"
                      }`}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Digite sua mensagem..."
                  className="input-dark"
                />
                <Button onClick={handleSend} disabled={sending || !novaMensagem.trim()} className="btn-wine shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
