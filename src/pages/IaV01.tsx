import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, Send, Sparkles, Settings, MessageSquare, Save, Loader2, 
  MapPin, ExternalLink, CheckCircle2, ShieldCheck, Copy, Phone, Globe
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  telefone: string | null;
  horario_abertura: string | null;
  horario_fechamento: string | null;
  link_booksy?: string | null;
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const PROMPT_PADRAO_V01 = `Você é a Heloisa v0.1, a assistente virtual oficial de atendimento da Barbearia Hermanos no WhatsApp.

Seu objetivo é:
1. Tirar dúvidas do dia a dia dos clientes (horários de funcionamento, endereços, serviços oferecidos, preços e dúvidas frequentes).
2. Direcionar o cliente para o agendamento no Booksy da unidade desejada.

Diretrizes de Atendimento:
- Tom de voz: Muito amigável, direto, profissional e brasileiro.
- Se o cliente perguntar sobre serviços ou preços, informe os detalhes com clareza.
- Se o cliente desejar AGENDAR um corte/barba/serviço ou ver horários:
  a) Pergunte em qual unidade ele gostaria de ser atendido (caso ele não tenha especificado).
  b) Envie o Link do Booksy correspondente à unidade escolhida com uma mensagem gentil incentivando o agendamento.
- Se o cliente pedir para falar com um humano/atendente, confirme com cortesia que nossa equipe humana irá responder em breve.`;

export default function IaV01() {
  const { empresaId, config } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [savingUnidadeId, setSavingUnidadeId] = useState<string | null>(null);
  
  // Prompt State
  const [prompt, setPrompt] = useState(PROMPT_PADRAO_V01);

  // Chat Sandbox State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Olá! Sou a IA v0.1 da Barbearia Hermanos. Posso tirar suas dúvidas sobre horários, serviços e te enviar o link do Booksy para agendar. Como posso ajudar?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    fetchData();
  }, [empresaId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch units
      let query = supabase.from("unidades").select("*");
      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }
      const { data: unitsData, error: unitsError } = await query;
      if (unitsError) throw unitsError;
      setUnidades(unitsData || []);

      // Fetch saved AI agent prompt if available
      if (empresaId) {
        const { data: agente } = await supabase
          .from("agentes_ia")
          .select("instrucoes_extras")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (agente?.instrucoes_extras) {
          setPrompt(agente.instrucoes_extras);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados da IA v0.1:", err);
      toast.error("Erro ao carregar dados das unidades");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBooksyLink = async (unidadeId: string, link: string) => {
    setSavingUnidadeId(unidadeId);
    try {
      const { error } = await supabase
        .from("unidades")
        .update({ link_booksy: link } as any)
        .eq("id", unidadeId);

      if (error) throw error;

      setUnidades((prev) =>
        prev.map((u) => (u.id === unidadeId ? { ...u, link_booksy: link } : u))
      );
      toast.success("Link do Booksy atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar link do Booksy:", err);
      toast.error("Erro ao salvar link do Booksy. Verifique as permissões.");
    } finally {
      setSavingUnidadeId(null);
    }
  };

  const handleSavePrompt = async () => {
    if (!empresaId) {
      toast.error("Empresa não identificada");
      return;
    }
    setSavingPrompt(true);
    try {
      const { data: existing } = await supabase
        .from("agentes_ia")
        .select("id")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("agentes_ia")
          .update({ instrucoes_extras: prompt, ativo: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agentes_ia").insert({
          empresa_id: empresaId,
          nome: "Heloisa v0.1",
          tom: "Amigável e Eficiente",
          instrucoes_extras: prompt,
          ativo: true,
        });
        if (error) throw error;
      }

      toast.success("Instruções da IA v0.1 salvas com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar prompt:", err);
      toast.error("Erro ao salvar instruções da IA");
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userText = inputMessage.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      content: userText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setSendingChat(true);

    try {
      // Simulate/invoke IA response with context
      const unitsContext = unidades.map(u => 
        `- Unidade: ${u.nome} | Endereço: ${u.endereco} | Horário: ${u.horario_abertura || '09:00'} às ${u.horario_fechamento || '20:00'} | Link Booksy: ${u.link_booksy || 'Link não cadastrado'}`
      ).join("\n");

      // Logic simulation for Sandbox
      const lower = userText.toLowerCase();
      let botResponse = "";

      if (lower.includes("agendar") || lower.includes("marcar") || lower.includes("corte") || lower.includes("barba") || lower.includes("horario")) {
        const matchedUnit = unidades.find(u => lower.includes(u.nome.toLowerCase()));
        if (matchedUnit) {
          botResponse = `Com certeza! Para agendar na **${matchedUnit.nome}**, acesse nosso aplicativo do Booksy no link abaixo:\n\n🔗 ${matchedUnit.link_booksy || 'https://booksy.com'}\n\nEscolha o melhor dia, horário e seu barbeiro de preferência por lá!`;
        } else if (unidades.length > 0) {
          botResponse = `Com certeza! Temos as seguintes unidades disponíveis para agendamento via Booksy:\n\n` +
            unidades.map(u => `📍 **${u.nome}**\n🔗 Booksy: ${u.link_booksy || 'https://booksy.com'}`).join("\n\n") +
            `\n\nQual delas fica melhor para você?`;
        } else {
          botResponse = `Com certeza! Acesse o nosso Booksy oficial para realizar seu agendamento em poucos cliques:\n\n🔗 https://booksy.com`;
        }
      } else if (lower.includes("endereco") || lower.includes("onde fica") || lower.includes("localizacao")) {
        botResponse = `Nossas unidades da Barbearia Hermanos estão localizadas nos endereços:\n\n` +
          unidades.map(u => `📍 **${u.nome}**: ${u.endereco}`).join("\n\n");
      } else if (lower.includes("preco") || lower.includes("valor") || lower.includes("quanto custa")) {
        botResponse = `Nossos principais serviços incluem:\n- Corte Tradicional / Degradê: R$ 50,00\n- Barba Completa / Toalha Quente: R$ 40,00\n- Combo Corte + Barba: R$ 80,00\n\nQuer agendar o seu horário pelo Booksy?`;
      } else {
        botResponse = `Olá! Sou a Heloisa v0.1 da Barbearia Hermanos. Posso te ajudar tirando dúvidas sobre nossos serviços e te enviar o link do Booksy de cada unidade para agendamento! Em que posso ajudar?`;
      }

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            content: botResponse,
            sender: "bot",
            timestamp: new Date(),
          },
        ]);
        setSendingChat(false);
      }, 600);
    } catch (err) {
      console.error(err);
      setSendingChat(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA WhatsApp v0.1"
        description="Módulo de Atendimento Automatizado para WhatsApp — Dúvidas do dia a dia e Agendamento via Booksy"
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500 text-emerald-400 bg-emerald-500/10 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            IA Versão v0.1 (Meta Cloud API)
          </Badge>
        </div>
      </PageHeader>

      <Tabs defaultValue="unidades" className="w-full">
        <TabsList className="bg-muted/50 p-1 border border-border">
          <TabsTrigger value="unidades" className="gap-2">
            <MapPin className="w-4 h-4" />
            Unidades & Booksy Links
          </TabsTrigger>
          <TabsTrigger value="prompt" className="gap-2">
            <Settings className="w-4 h-4" />
            Instruções & Prompt v0.1
          </TabsTrigger>
          <TabsTrigger value="sandbox" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Simulador de Teste (Sandbox)
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <Globe className="w-4 h-4" />
            WhatsApp Meta Cloud API
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: UNIDADES & BOOKSY */}
        <TabsContent value="unidades" className="mt-4 space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Links do Booksy por Unidade
              </CardTitle>
              <CardDescription>
                Cadastre a URL do Booksy para cada uma das unidades da barbearia. A IA v0.1 irá enviar o link exato da unidade escolhida pelo cliente no WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {unidades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma unidade cadastrada no momento.
                </div>
              ) : (
                unidades.map((unidade) => (
                  <div
                    key={unidade.id}
                    className="p-4 rounded-xl border border-border/80 bg-background/50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-foreground text-base flex items-center gap-2">
                          {unidade.nome}
                          <Badge variant="secondary" className="text-xs">
                            {unidade.horario_abertura || "09:00"} - {unidade.horario_fechamento || "20:00"}
                          </Badge>
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{unidade.endereco}</p>
                      </div>
                      {unidade.telefone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {unidade.telefone}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1 block">
                          Link do Booksy da {unidade.nome}
                        </Label>
                        <Input
                          placeholder="https://booksy.com/pt-br/12345_barbearia-hermanos"
                          defaultValue={unidade.link_booksy || ""}
                          id={`booksy-link-${unidade.id}`}
                          className="bg-background border-border"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          size="sm"
                          disabled={savingUnidadeId === unidade.id}
                          onClick={() => {
                            const val = (
                              document.getElementById(
                                `booksy-link-${unidade.id}`
                              ) as HTMLInputElement
                            )?.value;
                            handleSaveBooksyLink(unidade.id, val || "");
                          }}
                          className="w-full sm:w-auto gap-2"
                        >
                          {savingUnidadeId === unidade.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Salvar Link
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PROMPT & INSTRUÇÕES */}
        <TabsContent value="prompt" className="mt-4 space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Diretrizes & Prompt da IA v0.1
              </CardTitle>
              <CardDescription>
                Configure as instruções que a inteligência artificial deve seguir ao conversar com os clientes no WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt-input" className="text-sm font-medium">
                  Prompt do Sistema (System Instructions)
                </Label>
                <Textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={12}
                  className="font-mono text-sm bg-background border-border leading-relaxed"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt(PROMPT_PADRAO_V01)}
                >
                  Restaurar Prompt Padrão v0.1
                </Button>

                <Button
                  onClick={handleSavePrompt}
                  disabled={savingPrompt}
                  className="gap-2"
                >
                  {savingPrompt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Configuração v0.1
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SANDBOX / SIMULADOR */}
        <TabsContent value="sandbox" className="mt-4 space-y-4">
          <Card className="bg-card/50 border-border flex flex-col h-[550px]">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Simulador da IA v0.1 em Tempo Real
              </CardTitle>
              <CardDescription>
                Faça perguntas de teste (ex: "Qual o endereço?", "Quero agendar um corte na unidade Centro") para verificar como a IA irá responder aos seus clientes.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted border border-border text-foreground rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        msg.sender === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="flex justify-start">
                  <div className="bg-muted border border-border rounded-2xl rounded-tl-none px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Heloisa v0.1 está digitando...
                  </div>
                </div>
              )}
            </CardContent>

            <div className="p-3 border-t border-border bg-background/50 flex gap-2">
              <Input
                placeholder="Digite uma mensagem de teste..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                className="bg-background border-border"
              />
              <Button onClick={handleSendMessage} disabled={sendingChat || !inputMessage.trim()} className="gap-2">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: META CLOUD API */}
        <TabsContent value="meta" className="mt-4 space-y-4">
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Conexão com a Meta Cloud API (WhatsApp Oficial)
              </CardTitle>
              <CardDescription>
                Credenciais ativas do seu aplicativo registrado no Facebook Developers para a Barbearia Hermanos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border bg-background/50 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                    Número de Telefone Inscrito
                  </span>
                  <div className="font-semibold text-lg text-foreground flex items-center gap-2">
                    <Phone className="w-5 h-5 text-emerald-400" />
                    +55 (11) 4118-8017
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      Inscrito & Ativo
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-background/50 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                    ID do Número de Telefone (Phone Number ID)
                  </span>
                  <div className="font-semibold text-base font-mono text-foreground flex items-center justify-between">
                    <span>1342513118936733</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard("1342513118936733")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  URL do Webhook do Supabase (Para colar no Facebook Developers)
                </h4>
                <p className="text-xs text-muted-foreground">
                  No painel do Facebook Developers → WhatsApp → Configuração básica → Webhooks, cole a URL abaixo para receber as mensagens dos seus clientes:
                </p>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Callback URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="https://khoeovszuixfwfkaaxaa.supabase.co/functions/v1/meta-webhook"
                      className="font-mono text-xs bg-background border-border"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard("https://khoeovszuixfwfkaaxaa.supabase.co/functions/v1/meta-webhook")}
                      className="gap-1 text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground">Verify Token</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value="hermanos_zap_webhook_secret_2026"
                      className="font-mono text-xs bg-background border-border"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard("hermanos_zap_webhook_secret_2026")}
                      className="gap-1 text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
