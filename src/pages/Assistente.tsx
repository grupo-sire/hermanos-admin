import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bot, Send, User, Sparkles, Settings, Zap, 
  MessageSquare, Save, Loader2, Globe, ShieldCheck,
  Calendar, ShoppingBag, Heart, Headphones, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const DEFAULT_PROMPT = `Você é o assistente virtual oficial e especialista em atendimento da Barbearia Hermanos.
Seu objetivo é prestar um atendimento acolhedor, rápido, elegante e eficiente pelo WhatsApp.

Diretrizes Principais:
1. Agendamento Inteligente: Ajude o cliente a agendar cortes, barba e tratamentos, informando serviços disponíveis, preços e horários, e permitindo a escolha ou troca do profissional/barbeiro de sua preferência.
2. Recomendação de Produtos: Informe preços e recomende produtos de cuidados masculinos (pomadas, óleos, balms) disponíveis em nosso catálogo.
3. Transbordo Humano: Caso o cliente solicite um atendente humano ou tenha uma dúvida específica, confirme a transferência de forma rápida e cortês.
4. Tom de Voz: Profissional, acolhedor, direto e elegante.`;

export default function Assistente() {
  const { empresaId, config } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("config");

  // Agent State
  const [agentData, setAgentData] = useState({
    id: "",
    ativo: true,
    nome: "BARBEARIA HERMANOS",
    tom: "Profissional e acolhedor",
    instrucoes_extras: DEFAULT_PROMPT,
    webhook_n8n_url: "",
    func_agendamento: true,
    func_produtos: true,
    func_fidelidade: false,
    func_humano: true
  });

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Olá! Sou o seu novo assistente de IA. Configure minhas habilidades na aba ao lado para começarmos!",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (empresaId) {
      fetchAgentData();
    }
  }, [empresaId]);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agentes_ia")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAgentData({
          ...data,
          instrucoes_extras: data.instrucoes_extras || DEFAULT_PROMPT
        });
      } else {
        console.log("Nenhum agente encontrado para esta empresa. Usando padrão.");
      }
    } catch (error: any) {
      console.error("Erro ao buscar agente:", error);
      toast.error("Erro ao carregar dados do agente");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      const payload = {
        ...agentData,
        empresa_id: empresaId,
        updated_at: new Date().toISOString()
      };

      // Upsert
      const { data, error } = await supabase
        .from("agentes_ia")
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      
      setAgentData(data);
      toast.success("Configurações do Agente salvas!");
    } catch (error: any) {
      console.error("Erro ao salvar agente:", error);
      toast.error("Falha ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Estado do Motor de Simulação de Agendamento IA
  const [testStep, setTestStep] = useState<"init" | "service" | "barber" | "date" | "time" | "confirm">("init");
  const [testData, setTestData] = useState<any>({});

  const resetChat = () => {
    setTestStep("init");
    setTestData({});
    setMessages([
      {
        id: Date.now().toString(),
        content: `👋 Olá! Sou o assistente ${agentData.nome || 'IA'}. Digite "1" ou "oi" para simular o agendamento completo, testar a escolha de profissional e registrar em tempo real no banco de dados!`,
        sender: "bot",
        timestamp: new Date(),
      },
    ]);
  };

  const processBotStep = async (userText: string): Promise<string> => {
    const clean = userText.trim().toLowerCase();

    if (clean === "0" || clean === "cancelar" || clean === "reiniciar") {
      setTestStep("init");
      setTestData({});
      return "❌ Atendimento cancelado. Digite 1 ou envie qualquer mensagem para iniciar uma nova simulação!";
    }

    // 1. INIT / MENU DE SERVIÇOS
    if (testStep === "init") {
      const { data: servicos } = await supabase
        .from("servicos")
        .select("id, nome, preco, duracao_minutos")
        .eq("empresa_id", empresaId)
        .eq("status", "active")
        .order("nome");

      if (!servicos || servicos.length === 0) {
        return "⚠️ Nenhum serviço ativo encontrado para esta empresa no banco de dados.";
      }

      setTestData({ servicos });
      setTestStep("service");

      let msg = `👋 Olá! Sou o *${agentData.nome || "Assistente IA"}* da *${config.nome || "Barbearia Hermanos"}*.\n\nEscolha o serviço desejado:\n\n`;
      servicos.forEach((s: any, i: number) => {
        msg += `${i + 1}. ${s.nome} - R$ ${Number(s.preco).toFixed(2)} (${s.duracao_minutos} min)\n`;
      });
      msg += `\n0. Cancelar`;
      return msg;
    }

    // 2. SELEÇÃO DE SERVIÇO
    if (testStep === "service") {
      const idx = parseInt(clean) - 1;
      const servicos = testData.servicos || [];
      if (isNaN(idx) || idx < 0 || idx >= servicos.length) {
        return "⚠️ Opção inválida. Digite o número do serviço desejado.";
      }

      const selectedSvc = servicos[idx];
      
      const [{ data: barbeiros }, { data: unidades }] = await Promise.all([
        supabase.from("barbeiros").select("id, nome, unidade_id").eq("empresa_id", empresaId).eq("status", "active").order("nome"),
        supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId).eq("status", "active").order("nome"),
      ]);

      const unit = unidades?.[0] || { id: "a1346ecc-b354-4b15-8e05-8a980d3bd55e", nome: "Unidade Higienópolis" };
      const unitBarbers = (barbeiros || []).filter(b => !b.unidade_id || b.unidade_id === unit.id);

      setTestData((prev: any) => ({
        ...prev,
        service: selectedSvc,
        unit,
        barbers: unitBarbers,
      }));
      setTestStep("barber");

      let msg = `✅ *${selectedSvc.nome}* selecionado! (R$ ${Number(selectedSvc.preco).toFixed(2)})\n\n`;
      msg += `📍 Unidade: *${unit.nome}*\n\n`;
      msg += `Escolha o Profissional / Barbeiro:\n\n`;
      msg += `1. 💈 Sem preferência (Qualquer profissional)\n`;
      unitBarbers.forEach((b: any, i: number) => {
        msg += `${i + 2}. 👤 ${b.nome}\n`;
      });
      msg += `\n0. Cancelar`;
      return msg;
    }

    // 3. SELEÇÃO DE PROFISSIONAL (BARBEIRO)
    if (testStep === "barber") {
      const idx = parseInt(clean);
      const unitBarbers = testData.barbers || [];
      if (isNaN(idx) || idx < 1 || idx > unitBarbers.length + 1) {
        return "⚠️ Opção inválida. Digite o número do profissional desejado.";
      }

      let selectedBarberId = null;
      let selectedBarberName = "Sem preferência";

      if (idx > 1) {
        const b = unitBarbers[idx - 2];
        selectedBarberId = b.id;
        selectedBarberName = b.nome;
      }

      const dates: string[] = [];
      const labels: string[] = [];
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().split("T")[0];
        const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        dates.push(iso);
        labels.push(label);
      }

      setTestData((prev: any) => ({
        ...prev,
        barberId: selectedBarberId,
        barberName: selectedBarberName,
        dates,
        dateLabels: labels,
      }));
      setTestStep("date");

      let msg = `👤 Profissional escolhido: *${selectedBarberName}*\n\n`;
      msg += `Escolha a data do agendamento:\n\n`;
      labels.forEach((lbl, i) => {
        msg += `${i + 1}. 📅 ${lbl}\n`;
      });
      msg += `\n0. Cancelar`;
      return msg;
    }

    // 4. SELEÇÃO DE DATA -> CARREGAR HORÁRIOS DISPONÍVEIS
    if (testStep === "date") {
      const idx = parseInt(clean) - 1;
      const dates = testData.dates || [];
      if (isNaN(idx) || idx < 0 || idx >= dates.length) {
        return "⚠️ Opção inválida. Digite o número da data desejada.";
      }

      const selectedDate = dates[idx];
      const selectedLabel = testData.dateLabels[idx];

      const availableTimes = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

      setTestData((prev: any) => ({
        ...prev,
        selectedDate,
        selectedDateLabel: selectedLabel,
        availableTimes,
      }));
      setTestStep("time");

      let msg = `📅 Data selecionada: *${selectedLabel}*\n\n`;
      msg += `Escolha o horário desejado:\n\n`;
      availableTimes.forEach((t, i) => {
        msg += `${i + 1}. ⏰ ${t}\n`;
      });
      msg += `\n0. Cancelar`;
      return msg;
    }

    // 5. SELEÇÃO DE HORÁRIO -> CONFIRMAÇÃO
    if (testStep === "time") {
      const idx = parseInt(clean) - 1;
      const times = testData.availableTimes || [];
      if (isNaN(idx) || idx < 0 || idx >= times.length) {
        return "⚠️ Opção inválida. Digite o número do horário.";
      }

      const selectedTime = times[idx];

      setTestData((prev: any) => ({
        ...prev,
        selectedTime,
      }));
      setTestStep("confirm");

      let msg = `✅ *Confirme os dados do agendamento:*\n\n`;
      msg += `📋 Serviço: *${testData.service.nome}* (R$ ${Number(testData.service.preco).toFixed(2)})\n`;
      msg += `👤 Profissional: *${testData.barberName}*\n`;
      msg += `📍 Unidade: *${testData.unit.nome}*\n`;
      msg += `📅 Data: *${testData.selectedDateLabel}* às *${selectedTime}*\n\n`;
      msg += `1. ✅ Confirmar Agendamento no Banco de Dados\n`;
      msg += `2. ❌ Cancelar`;
      return msg;
    }

    // 6. CONFIRMAÇÃO -> REGISTRO EM TEMPO REAL NO SUPABASE
    if (testStep === "confirm") {
      if (clean !== "1") {
        setTestStep("init");
        setTestData({});
        return "❌ Agendamento cancelado. Digite 1 ou envie qualquer mensagem para reiniciar o teste.";
      }

      try {
        let { data: cliente } = await supabase.from("clientes").select("id").eq("empresa_id", empresaId).limit(1).maybeSingle();
        
        let barberIdToAssign = testData.barberId;
        if (!barberIdToAssign || barberIdToAssign === "any") {
          const firstB = testData.barbers?.[0];
          barberIdToAssign = firstB?.id || "410ed7da-be33-49cc-93da-83f19a2444e1";
        }

        const [hh, mm] = testData.selectedTime.split(":").map(Number);
        const dataHoraISO = `${testData.selectedDate}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`;

        const { data: newAg, error: agErr } = await supabase
          .from("agendamentos")
          .insert({
            empresa_id: empresaId,
            cliente_id: cliente?.id || null,
            barbeiro_id: barberIdToAssign,
            servico_id: testData.service.id,
            unidade_id: testData.unit.id,
            data_hora: dataHoraISO,
            duracao_minutos: testData.service.duracao_minutos || 30,
            preco: testData.service.preco,
            status: "agendado",
            observacoes: "Agendado via IA (Playground SuperAdmin)",
          })
          .select()
          .single();

        if (agErr) throw agErr;

        setTestStep("init");
        setTestData({});

        toast.success("Agendamento criado com sucesso no banco de dados!");

        return `🎉 *AGENDAMENTO REGISTRADO COM SUCESSO NO BANCO DE DADOS!*\n\n` +
          `🆔 ID do Registro: ${newAg.id}\n` +
          `📋 Serviço: ${testData.service.nome}\n` +
          `👤 Profissional: ${testData.barberName}\n` +
          `📅 Data/Hora: ${testData.selectedDateLabel} às ${testData.selectedTime}\n` +
          `📍 Unidade: ${testData.unit.nome}\n\n` +
          `✅ *O agendamento já está visível na tela de Agenda e no Checkout!* Digite 1 para fazer outro teste.`;
      } catch (err: any) {
        console.error("Erro ao registrar agendamento no Supabase:", err);
        setTestStep("init");
        setTestData({});
        return `❌ Erro ao registrar agendamento: ${err.message || "Erro desconhecido"}`;
      }
    }

    return "Digite 1 para iniciar a simulação.";
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      content: userText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const responseText = await processBotStep(userText);
      setTimeout(() => {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          content: responseText,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }, 500);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Sincronizando configurações com a empresa {config.nome}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <PageHeader 
          title="Agente IA Marketing" 
          description={`Configurações de IA para ${config.nome || 'sua empresa'}`}
        />
        <Button 
          className="btn-wine shadow-lg shadow-primary/20" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-black/40 border border-white/5 p-1 h-12 rounded-xl mb-6">
          <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <MessageSquare className="h-4 w-4 mr-2" />
            Playground / Teste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="panel border-primary/10 bg-black/40 backdrop-blur-sm overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Bot size={80} />
                </div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 italic uppercase font-black text-lg">
                    <Sparkles className="h-5 w-5 text-primary" /> 
                    Identidade do Agente
                  </CardTitle>
                  <CardDescription>Configure as instruções de sistema para {config.nome}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20 ring-1 ring-primary/10">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Status do Agente</Label>
                      <p className="text-xs text-muted-foreground">Ative para que ele responda automaticamente no WhatsApp</p>
                    </div>
                    <Switch 
                      checked={agentData.ativo} 
                      onCheckedChange={(v) => setAgentData(prev => ({ ...prev, ativo: v }))} 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome de Exibição</Label>
                      <Input 
                        value={agentData.nome}
                        onChange={(e) => setAgentData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Bia da 10X" 
                        className="input-dark" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tom da Conversa</Label>
                      <Input 
                        value={agentData.tom}
                        onChange={(e) => setAgentData(prev => ({ ...prev, tom: e.target.value }))}
                        placeholder="Ex: Descontraído e direto" 
                        className="input-dark" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Instruções do Sistema (Prompt Base)
                      <Zap className="h-3 w-3 text-warning fill-warning" />
                    </Label>
                    <Textarea 
                      value={agentData.instrucoes_extras}
                      onChange={(e) => setAgentData(prev => ({ ...prev, instrucoes_extras: e.target.value }))}
                      placeholder={`Ex: Você é um assistente de vendas da ${config.nome}. Seu objetivo é...`} 
                      className="input-dark min-h-[150px] resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* The Webhook URL card was removed from here. Only SuperAdmins should configure the Webhook URL to ensure the use of the Universal Flow. */}
            </div>

            <div className="space-y-6">
              <Card className="panel border-success/10 bg-success/5 h-full">
                <CardHeader>
                  <CardTitle className="text-sm uppercase font-black tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success" /> Habilidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: "func_agendamento", label: "Agendar Serviços", desc: "Consultar horários e marcar agenda", icon: Calendar, color: "text-primary" },
                    { id: "func_produtos", label: "Catálogo de Produtos", desc: "Informar preços e disponibilidade", icon: ShoppingBag, color: "text-info" },
                    { id: "func_fidelidade", label: "Programa Fidelidade", desc: "Consultar e resgatar pontos", icon: Heart, color: "text-red-400" },
                    { id: "func_humano", label: "Transbordo Humano", desc: "Encaminhar para um atendente real", icon: Headphones, color: "text-warning" },
                  ].map(skill => (
                    <div 
                      key={skill.id}
                      className="flex items-start space-x-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                      onClick={() => setAgentData(prev => ({ ...prev, [skill.id]: !(prev as any)[skill.id] }))}
                    >
                      <Checkbox 
                        id={skill.id} 
                        checked={(agentData as any)[skill.id]}
                        className="mt-1 data-[state=checked]:bg-success data-[state=checked]:border-success" 
                      />
                      <div className="space-y-0.5 pointer-events-none">
                        <Label className="font-bold flex items-center gap-2">
                          <skill.icon className={`h-3 w-3 ${skill.color}`} />
                          {skill.label}
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {skill.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat">
          <Card className="panel border-white/5 bg-black/40 h-[600px] flex flex-col p-0 overflow-hidden">
            <CardHeader className="border-b border-white/5 px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Bot className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                      <CardTitle className="text-base">{agentData.nome}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${agentData.ativo ? "bg-success" : "bg-destructive"}`} />
                        {agentData.ativo ? `Agente (${config.nome}) On-line` : "Agente Off-line"}
                      </CardDescription>
                   </div>
                </div>
                <Button variant="outline" size="sm" onClick={resetChat} className="border-white/10 text-xs">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reiniciar Simulação
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 ${
                    message.sender === "user" ? "bg-primary text-white" : "bg-white/5 border border-white/10"
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    <p className="text-[10px] opacity-40 mt-1">{message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-150" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-300" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t border-white/5 bg-black/20">
              <div className="flex gap-2">
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Envie uma mensagem para testar..." 
                  className="input-dark" 
                />
                <Button onClick={sendMessage} className="btn-wine">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
