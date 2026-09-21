import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Zap, Clock, Users, ArrowRight, ShieldCheck, HelpCircle, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Progress } from "@/components/ui/progress";

export function ChatbotSummarySection() {
  const { empresaId } = useEmpresa();
  const [stats, setStats] = useState({ total_conversas: 0, humanos: 0, automatizadas: 0 });
  const [activeFlow, setActiveFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (empresaId) {
      fetchData();
    }
  }, [empresaId]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: flow } = await supabase.from("chatbot_flows")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .maybeSingle();

      setActiveFlow(flow);

      const { data: convs } = await supabase.from("whatsapp_conversas")
        .select("atendimento_humano")
        .eq("empresa_id", empresaId);

      if (convs) {
        setStats({
          total_conversas: convs.length,
          humanos: convs.filter(c => c.atendimento_humano).length,
          automatizadas: convs.filter(c => !c.atendimento_humano).length
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando informações do assistente...</div>;
  }

  const automationRate = stats.total_conversas > 0 
    ? Math.round((stats.automatizadas / stats.total_conversas) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Seu Assistente Inteligente</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Veja abaixo como o seu robozinho gerencia as conversas da sua empresa 24 horas por dia.
        </p>
      </div>

      {/* Process Steps Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {/* Connection arrows for desktop */}
        <div className="hidden lg:block absolute top-1/2 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 -translate-y-1/2 -z-10" />

        <Card className="panel border-t-4 border-t-blue-500 hover:scale-[1.02] transition-transform">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto mb-2">
              <MessageSquare className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">1. Boas-vindas</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            O assistente recebe a mensagem do cliente instantaneamente, não importa o horário, e inicia o atendimento cordial.
          </CardContent>
        </Card>

        <Card className="panel border-t-4 border-t-purple-500 hover:scale-[1.02] transition-transform">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mx-auto mb-2">
              <GitBranch className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">2. Entendimento</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Ele apresenta as opções que você oferece: Agendamento, Preços de Serviços ou Dúvidas Frequentes.
          </CardContent>
        </Card>

        <Card className="panel border-t-4 border-t-green-500 hover:scale-[1.02] transition-transform">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto mb-2">
              <Zap className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">3. Ação Ágil</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Se o cliente quiser agendar, o robô faz tudo sozinho! Ele mostra horários livres e salva direto na sua agenda.
          </CardContent>
        </Card>

        <Card className="panel border-t-4 border-t-orange-500 hover:scale-[1.02] transition-transform">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mx-auto mb-2">
              <Users className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">4. Transbordo</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Caso o cliente peça para falar com alguém, o robô te notifica imediatamente para você assumir a conversa.
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="panel bg-gradient-to-br from-primary/5 to-transparent border-primary/10 mt-12 overflow-hidden relative">
         <Bot className="absolute -bottom-4 -right-4 h-32 w-32 text-primary/5 -rotate-12" />
         <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold text-foreground">Sua automação está em boas mãos</h3>
                <p className="text-muted-foreground mt-2">
                  Toda a estrutura lógica e o fluxo do seu assistente são configurados e monitorados pela equipe <strong>10x Marketing</strong>. Isso garante que sua empresa sempre tenha o melhor desempenho sem que você precise se preocupar com a parte técnica.
                </p>
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4">
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">Ativo 24h</Badge>
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">Monitoramento 10x</Badge>
                </div>
              </div>
              <Button className="btn-wine shrink-0">Solicitar Ajuste no Fluxo</Button>
            </div>
         </CardContent>
      </Card>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-blue-500 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> Se você mudar de telefone ou quiser trocar a mensagem de boas-vindas, fale conosco pelo suporte.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> O robô já sabe todos os seus serviços e preços que você cadastrou no sistema!
          </p>
        </div>
      </div>
    </div>
  );
}
