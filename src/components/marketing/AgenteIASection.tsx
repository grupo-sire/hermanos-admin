import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot, Sparkles, Zap, Calendar, Package, Star, UserCheck,
  ChevronDown, Save, Loader2, Eye, BotOff, Settings, Link, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

interface AgenteIA {
  id?: string;
  empresa_id: string;
  ativo: boolean;
  nome: string;
  tom: string;
  func_agendamento: boolean;
  func_produtos: boolean;
  func_fidelidade: boolean;
  func_humano: boolean;
  instrucoes_extras: string;
  webhook_n8n_url?: string;
}

const TOM_LABELS: Record<string, string> = {
  amigavel: "😊 Amigável — Natural e próximo do cliente",
  formal: "👔 Formal — Linguagem profissional e respeitosa",
  descontraido: "😎 Descontraído — Leve, divertido e informal",
  profissional: "⭐ Profissional — Direto e focado em resultados",
};

const FUNCAO_CONFIG = [
  {
    key: "func_agendamento",
    label: "Agendamentos",
    desc: "Agenda serviços, consulta horários e confirma reservas",
    icon: Calendar,
    color: "text-blue-400",
  },
  {
    key: "func_produtos",
    label: "Produtos",
    desc: "Informa preços, disponibilidade e recomenda produtos",
    icon: Package,
    color: "text-emerald-400",
  },
  {
    key: "func_fidelidade",
    label: "Fidelidade",
    desc: "Consulta pontos e benefícios do programa de fidelidade",
    icon: Star,
    color: "text-amber-400",
  },
  {
    key: "func_humano",
    label: "Transferir para humano",
    desc: "Encaminha o cliente para um atendente quando necessário",
    icon: UserCheck,
    color: "text-purple-400",
  },
];

export function AgenteIASection() {
  const { empresaId } = useEmpresa();
  const [agente, setAgente] = useState<AgenteIA | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);

  useEffect(() => {
    if (empresaId) fetchAgente();
  }, [empresaId]);

  const fetchAgente = async () => {
    setLoading(true);
    try {
      const [{ data: agenteData }, { data: empresaData }] = await Promise.all([
        supabase.from("agentes_ia").select("*").eq("empresa_id", empresaId!).maybeSingle(),
        supabase.from("empresas").select("nome").eq("id", empresaId!).single(),
      ]);

      setEmpresa(empresaData);

      if (agenteData) {
        setAgente({
          ...(agenteData as AgenteIA),
          instrucoes_extras: agenteData.instrucoes_extras || "",
          webhook_n8n_url: agenteData.webhook_n8n_url || "",
        });
      } else {
        // Default state for new agent
        setAgente({
          empresa_id: empresaId!,
          ativo: false,
          nome: "Assistente 10X",
          tom: "amigavel",
          func_agendamento: true,
          func_produtos: true,
          func_fidelidade: true,
          func_humano: true,
          instrucoes_extras: "Seja prestativo e foque em converter o cliente para um agendamento.",
          webhook_n8n_url: "",
        });
      }
    } catch (err) {
      toast.error("Erro ao carregar configurações do agente");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (ativo: boolean) => {
    if (!agente) return;
    setToggling(true);
    try {
      if (agente.id) {
        const { error } = await supabase
          .from("agentes_ia")
          .update({ ativo })
          .eq("id", agente.id);
        if (error) throw error;
      } else {
        // Save first if never saved
        await handleSave(ativo);
        return;
      }
      setAgente({ ...agente, ativo });
      toast.success(ativo ? "🤖 Agente ativado!" : "Agente pausado");
    } catch (err: any) {
      toast.error("Erro ao alterar status: " + err.message);
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async (forceAtivo?: boolean) => {
    if (!agente) return;
    setSaving(true);
    try {
      const payload = {
        empresa_id: empresaId!,
        ativo: forceAtivo !== undefined ? forceAtivo : agente.ativo,
        nome: agente.nome,
        tom: agente.tom,
        func_agendamento: agente.func_agendamento,
        func_produtos: agente.func_produtos,
        func_fidelidade: agente.func_fidelidade,
        func_humano: agente.func_humano,
        instrucoes_extras: agente.instrucoes_extras,
        webhook_n8n_url: agente.webhook_n8n_url,
      };

      if (agente.id) {
        const { error } = await supabase.from("agentes_ia").update(payload).eq("id", agente.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("agentes_ia")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setAgente({ ...agente, id: data.id });
      }

      toast.success("Agente salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof AgenteIA, value: any) => {
    setAgente(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const buildPreviewPrompt = () => {
    if (!agente) return "";
    const nomeEmpresa = empresa?.nome || "sua empresa";
    const tomMap: Record<string, string> = {
      amigavel: "Use linguagem natural, próxima e amigável.",
      formal: "Use linguagem formal, respeitosa e profissional.",
      descontraido: "Use linguagem leve, informal e descontraída, com emojis ocasionais.",
      profissional: "Seja direto, objetivo e focado em resolver o problema do cliente.",
    };

    const funcs = [];
    if (agente.func_agendamento) funcs.push("- Agendar e consultar disponibilidade de serviços");
    if (agente.func_produtos) funcs.push("- Informar sobre produtos e preços");
    if (agente.func_fidelidade) funcs.push("- Consultar pontos e benefícios do programa de fidelidade");
    if (agente.func_humano) funcs.push("- Transferir para atendente humano quando solicitado");

    return `Você é ${agente.nome}, assistente virtual de ${nomeEmpresa}.

Tom de comunicação: ${tomMap[agente.tom] || ""}

Você pode realizar as seguintes funções:
${funcs.join("\n") || "Nenhuma função ativa"}

[SERVIÇOS DA EMPRESA - carregado automaticamente]
[PROFISSIONAIS DISPONÍVEIS - carregado automaticamente]
[PRODUTOS ATIVOS - carregado automaticamente]
[HORÁRIOS DE FUNCIONAMENTO - carregado automaticamente]
[HISTÓRICO DA CONVERSA - carregado automaticamente]

${agente.instrucoes_extras ? `Instruções especiais:\n${agente.instrucoes_extras}` : ""}

Nunca invente informações. Se não souber algo, diga que vai verificar.`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (!agente) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero / Toggle Card */}
      <Card className={`border-2 transition-all duration-500 ${agente.ativo
        ? "border-primary/40 bg-primary/5 shadow-[0_0_30px_rgba(139,92,246,0.15)]"
        : "border-border bg-card"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${agente.ativo
                ? "bg-primary shadow-lg shadow-primary/30"
                : "bg-muted"}`}>
                {agente.ativo
                  ? <Sparkles className="h-7 w-7 text-white animate-pulse" />
                  : <BotOff className="h-7 w-7 text-muted-foreground" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{agente.nome}</h2>
                  <Badge
                    className={agente.ativo
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-muted text-muted-foreground border-border"}>
                    {agente.ativo ? "● Ativo" : "○ Pausado"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {agente.ativo
                    ? "Atendendo clientes no WhatsApp agora"
                    : "Agente pausado — clientes não são atendidos pela IA"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm font-medium text-muted-foreground">
                {agente.ativo ? "Ligar" : "Desligar"}
              </Label>
              <Switch
                checked={agente.ativo}
                onCheckedChange={handleToggle}
                disabled={toggling}
                className="data-[state=checked]:bg-primary scale-125"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identidade */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" /> Identidade do Agente
            </CardTitle>
            <CardDescription>Como seu assistente se apresenta aos clientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input
                value={agente.nome}
                onChange={e => updateField("nome", e.target.value)}
                placeholder="Ex: Sofia, Max, Assistente..."
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">Este nome aparece para o cliente no WhatsApp</p>
            </div>
            <div className="space-y-2">
              <Label>Tom de Voz</Label>
              <Select value={agente.tom} onValueChange={v => updateField("tom", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TOM_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Funções */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" /> Funções Ativas
            </CardTitle>
            <CardDescription>O que o agente pode fazer em nome da sua empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {FUNCAO_CONFIG.map(({ key, label, desc, icon: Icon, color }) => (
              <div
                key={key}
                onClick={() => updateField(key as keyof AgenteIA, !agente[key as keyof AgenteIA])}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  agente[key as keyof AgenteIA]
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/20 opacity-60"
                }`}>
                <div className={`mt-0.5 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <Switch
                  checked={agente[key as keyof AgenteIA] as boolean}
                  onCheckedChange={v => updateField(key as keyof AgenteIA, v)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Instruções e Webhook */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Instruções Personalizadas
            </CardTitle>
            <CardDescription>
              Regras de comportamento e informações exclusivas do seu negócio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={agente.instrucoes_extras}
              onChange={e => updateField("instrucoes_extras", e.target.value)}
              placeholder={`Exemplos:
• Sempre ofereça o combo do mês para novos clientes
• Mencione que temos estacionamento gratuito
• Nunca dê descontos acima de 10% sem autorização`}
              className="min-h-[180px] resize-none font-mono text-sm bg-black/20"
              maxLength={2000}
            />
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">{agente.instrucoes_extras?.length || 0}/2000</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link className="h-4 w-4 text-primary" /> Integração n8n
            </CardTitle>
            <CardDescription>
              Conecte o "cérebro" customizado ao seu agente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Webhook URL (Opcional)</Label>
              <div className="relative">
                <Input
                  value={agente.webhook_n8n_url}
                  onChange={e => updateField("webhook_n8n_url", e.target.value)}
                  placeholder="https://n8n.seudominio.com/..."
                  className="bg-black/20 pr-10"
                />
                <Settings className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Se vazio, o agente usará o motor universal da plataforma. Use para fluxos complexos de IA no n8n.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 text-primary mt-0.5" />
                <div className="text-[10px] text-muted-foreground">
                  <strong>Dica:</strong> O sistema envia automaticamente o contexto da empresa, produtos, serviços e histórico de conversa para este URL.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview do Prompt */}
      <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
        <Card className="border-border bg-card">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/20 rounded-t-xl transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-primary" /> Preview do Prompt
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${promptOpen ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Veja como o agente será instruído com suas configurações</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-4 whitespace-pre-wrap font-mono border border-border leading-relaxed">
                {buildPreviewPrompt()}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => handleSave()} disabled={saving} className="btn-wine gap-2 min-w-[160px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
