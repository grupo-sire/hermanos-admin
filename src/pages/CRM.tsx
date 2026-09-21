import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Search, Send, Bot, User, Trash2, Calendar, Crown, Scissors, CreditCard, CheckCheck, Smile, Paperclip, Mic, Volume2, Loader2, Sparkles, MousePointerClick, Smartphone, Instagram, MapPin, ExternalLink, Globe
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { enviarMensagemWhatsAppMeta, META_WHATSAPP_CONFIG } from "@/services/metaWhatsAppService";
import { cn } from "@/lib/utils";

export interface Conversa {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteAvatar?: string;
  isInfinite: boolean;
  canal?: "whatsapp" | "app" | "instagram";
  barbeiroPreferido: string;
  statusAtendimento: "ia" | "humano" | "finalizado";
  ultimaMensagem: string;
  horarioUltimaMensagem: string;
  naoLidas: number;
  mensagens: Array<{
    id: string;
    remetente: "cliente" | "ia" | "humano" | "sistema";
    texto: string;
    tipo?: string;
    horario: string;
    created_at?: string;
  }>;
}

const formatarDataResumida = (dtStr?: string | null) => {
  if (!dtStr) return "";
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return "";

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (d.toDateString() === ontem.toDateString()) {
    return "Ontem";
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatarDataDivider = (dtStr?: string | null) => {
  if (!dtStr) return "";
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return "";

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) {
    return "Hoje";
  }
  if (d.toDateString() === ontem.toDateString()) {
    return "Ontem";
  }
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== hoje.getFullYear() ? "numeric" : undefined,
  });
};

export default function CRM() {
  const { empresaId, config } = useEmpresa();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "humano" | "infinite">("todas");
  const [filtroCanal, setFiltroCanal] = useState<"todos" | "whatsapp" | "app" | "instagram">("todos");
  const [configOpen, setConfigOpen] = useState<boolean>(false);
  const [testZapOpen, setTestZapOpen] = useState<boolean>(false);
  const [testZapPhone, setTestZapPhone] = useState<string>("");
  const [testZapMsg, setTestZapMsg] = useState<string>("Olá! Mensagem da Central de Atendimento da Barbearia Hermanos.");
  const [sendingZapTest, setSendingZapTest] = useState<boolean>(false);

  const [modoIaV01, setModoIaV01] = useState<boolean>(() => {
    return localStorage.getItem("modo_ia_v01_active") === "true";
  });
  const [booksyConfigOpen, setBooksyConfigOpen] = useState<boolean>(false);
  const [unidadesList, setUnidadesList] = useState<any[]>([]);
  const [savingBooksyId, setSavingBooksyId] = useState<string | null>(null);

  const [promptV01State, setPromptV01State] = useState<string>(`# CONTEXTO E IDENTIDADE
Você é Heloísa, a recepcionista oficial e especialista em experiência do cliente da Barbearia Hermanos no WhatsApp.
Seu objetivo é atuar como consultora de vendas (SDR) para assinaturas e produtos, tirar dúvidas do dia a dia, e direcionar os agendamentos para o aplicativo do Booksy da unidade desejada de forma acolhedora, rápida, elegante e resolutiva.

# DIRETRIZES DE COMPORTAMENTO E TOM DE VOZ
1. Humanização: NUNCA diga que é um robô, IA, assistente virtual ou modelo de linguagem. Aja 100% como uma humana cordial.
2. Concisão: Responda em no máximo 1 a 3 parágrafos curtos.
3. Tom de Voz: Profissional, acolhedor, direto, elegante e resolutivo. Use emojis moderados (💈, ✂️, 📍, 🔗).

# REGRA DE OURO - DÚVIDAS DO DIA A DIA E UNIDADES (FAQ)
- Nossas filiais: Higienópolis, Itaim Bibi, Mooca, Tatuapé, Osasco, São Caetano do Sul e Freguesia do Ó.
- Responda sobre horários de funcionamento, localização das unidades, valores de cortes, barbas e tratamentos com clareza e elegância.

# REGRA DE OURO - AGENDAMENTOS (DIRECIONAMENTO BOOKSY POR UNIDADE)
- Sempre que o cliente pedir para AGENDAR, marcar um horário ou ver disponibilidade:
  1. Pergunte gentilmente em qual das nossas unidades ele prefere ser atendido (caso ainda não tenha informado a unidade).
  2. Envie o LINK DO BOOKSY correspondente à unidade escolhida para que ele escolha o melhor dia e horário diretamente no app do Booksy.

# VENDAS DA ASSINATURA INFINITE (PLANOS RECORRENTES)
👑 OS 4 PLANOS OFICIAIS DA ASSINATURA INFINITE (Válidos em todas as unidades):
• INFINITE CUTS (R$ 99,89/mês): Cortes ilimitados. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-cuts)
• INFINITE DUOS (R$ 199,89/mês): Cortes + Barbas ilimitados + Sobrancelha inclusa. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-duos)
• INFINITE BARB (R$ 129,89/mês): Barbas ilimitadas com toalha quente. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-barb)
• INFINITE PLUS (R$ 34,90/mês): Pacote de cuidados com hidratação, sobrancelha, limpeza de pele e depilação. (Link de checkout: https://barbeariahermanos.com.br/checkout?plan=infinite-plus)

🛡️ REGRA DE OURO PARA APRESENTAÇÃO DE PLANOS:
• Quando o cliente perguntar sobre planos em geral:
  Apresente a ideia de forma simples e convidativa em 1 a 2 parágrafos curtos, SEM enviar links logo de cara:
  "Com a nossa Assinatura Infinite você tem cortes ou barbas ilimitadas no mês a partir de R$ 99,89, mantendo o visual sempre em dia com muita praticidade e economia!"
  Em seguida faça uma pergunta investigativa: "Para eu te indicar a melhor opção: você costuma cuidar mais só do cabelo, só da barba ou dos dois juntos?"
• Somente envie o link de checkout específico quando o cliente escolher o plano dele!
• Após enviar o link de checkout do plano, sugira que o cliente já agende o seu horário direto no link do Booksy da unidade dele!

💳 COBRANÇA E LIMITE DO CARTÃO (ASSINATURA RECORRENTE):
• Esclareça sempre que necessário: a Assinatura Infinite NÃO compromete o limite total do cartão de crédito! É uma cobrança mensal recorrente (basta ter o valor da mensalidade no dia).

⭐ REGRA DO CORTE TESTE / CORTESIA AO ASSINAR (GATILHO DE FECHAMENTO):
• NUNCA mencione "corte de teste" ou "corte grátis" logo de início.
• Use o corte teste EXCLUSIVAMENTE se o cliente demonstrar hesitação, insegurança ou disser que quer conhecer a barbearia antes de assinar:
  "Te entendo perfeitamente! Para você ficar super tranquilo, você pode agendar um corte no Booksy da sua unidade para conhecer a nossa barbearia. Se você curtir a experiência e decidir assinar o plano no final do atendimento, esse corte de hoje fica 100% como cortesia da sua assinatura!"

🧴 CATÁLOGO CONSULTIVO DE PRODUTOS LOS PUTTOS (https://losputtos.com.br/):
• Pomada Matte Efeito Seco 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-matte-efeito-seco-los-puttos-150g-1hflb/)
• Pomada Teia 2 em 1 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-teia-efeito-2-em-1-los-puttos-150g-iii9e/)
• Pomada Fiber Fixação Extraforte 150g: R$ 50,00 (Link: https://losputtos.com.br/produtos/pomada-modeladora-fiber-fixacao-extraforte-los-puttos-150g-12w0b/)
• Gel Cola 250g: R$ 25,00 | Linha de Barba (Shampoo, Balm, Óleo): R$ 50,00 cada
• REGRA CONSULTIVA: NUNCA despeje o catálogo todo. Pergunte o tipo de cabelo/barba e recomende no máximo 1 ou 2 produtos ideais.

🚪 CANCELAMENTO DE ASSINATURA INFINITE (PLANO MENSAL):
• O cancelamento do PLANO DE ASSINATURA INFINITE é realizado EXCLUSIVAMENTE de forma presencial na recepção da unidade onde o cliente contratou a assinatura.

# TRANSBORDO HUMANO (HORÁRIO COMERCIAL DE ATENDIMENTO)
- O atendimento presencial/humano pela recepção ocorre EXCLUSIVAMENTE em Horário Comercial: de Segunda a Sexta-feira, das 09:00 às 18:00.
- Se o cliente solicitar falar com um atendente humano DENTRO do horário comercial (Segunda a Sexta, das 09h às 18h):
  Confirme gentilmente que nossa equipe de recepção irá responder em instantes com total atenção.
- Se o cliente solicitar falar com um atendente humano FORA do horário comercial (finais de semana, feriados ou antes das 09h / após as 18h):
  Explique com cortesia que a recepção atende de segunda a sexta das 09h às 18h, e que você (Heloísa) continuará cuidando do atendimento por aqui no momento para tirar todas as dúvidas e ajudar no agendamento!`);

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<string>("");
  const [novoTextoMensagem, setNovoTextoMensagem] = useState("");
  const [loadingConversas, setLoadingConversas] = useState<boolean>(true);

  const [agenteConfig, setAgenteConfig] = useState({
    id: "d1397ca8-3872-4e69-86a7-6fc3739aeea8",
    ativo: true,
    nome: "Heloísa",
    tom: "Simpática, acolhedora e profissional",
    instrucoes_extras: "",
  });

  const conversaAtiva = conversas.find((c) => c.id === conversaSelecionadaId) || conversas[0] || null;

  // Carregar conversas do banco em tempo real
  const carregarConversas = useCallback(async () => {
    try {
      const [{ data: convsData, error: convsErr }, { data: msgsData }, { data: clientesData }, { data: iaData }, { data: unitsData }] = await Promise.all([
        supabase.from("whatsapp_conversas").select("*").order("ultima_mensagem_at", { ascending: false }),
        supabase.from("whatsapp_mensagens").select("*").order("created_at", { ascending: true }),
        supabase.from("clientes").select("id, nome, telefone, email, observacoes"),
        supabase.from("agentes_ia").select("*").limit(1).maybeSingle(),
        supabase.from("unidades").select("*"),
      ]);

      if (iaData) {
        setAgenteConfig({
          id: iaData.id,
          ativo: iaData.ativo,
          nome: iaData.nome || "Heloísa",
          tom: iaData.tom || "Simpática, acolhedora e profissional",
          instrucoes_extras: iaData.instrucoes_extras || "",
        });
        if ((iaData as any).prompt_v01_booksy) {
          setPromptV01State((iaData as any).prompt_v01_booksy);
        }
        if ((iaData as any).modo_v01_booksy !== undefined && (iaData as any).modo_v01_booksy !== null) {
          const isDbActive = !!(iaData as any).modo_v01_booksy;
          setModoIaV01(isDbActive);
          localStorage.setItem("modo_ia_v01_active", isDbActive ? "true" : "false");
        }
      }

      if (unitsData) {
        setUnidadesList(unitsData);
      }

      if (convsErr) {
        console.error("Erro ao buscar conversas:", convsErr);
        setLoadingConversas(false);
        return;
      }

      if (!convsData || convsData.length === 0) {
        setConversas([]);
        setLoadingConversas(false);
        return;
      }

      const todasMsgs = msgsData || [];

      const listaMapeada: Conversa[] = convsData.map((c) => {
        const msgsDaConversa = todasMsgs.filter(
          (m) => m.telefone === c.telefone || m.telefone.replace(/\D/g, "") === c.telefone.replace(/\D/g, "")
        );

        const formatarHora = (dtStr?: string | null) => {
          if (!dtStr) return "";
          const d = new Date(dtStr);
          return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        };

        const cleanTel = c.telefone.replace(/\D/g, "");
        const cli = (clientesData || []).find(
          (cl) => cl.telefone && (cl.telefone.replace(/\D/g, "").includes(cleanTel.slice(-8)) || cleanTel.includes(cl.telefone.replace(/\D/g, "").slice(-8)))
        );

        const nomeFinal = c.nome_contato || cli?.nome || `Cliente (${c.telefone.slice(-4)})`;
        const avatarBichinho = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(nomeFinal)}&backgroundColor=005c4b,128c7e,00a884,0f766e,047857`;
        const avatarFinal = cli?.foto_url || avatarBichinho;

        const hasAppMsg = msgsDaConversa.some((m) => m.tipo === "app_cliente");
        const canal: "whatsapp" | "app" | "instagram" =
          c.telefone.startsWith("app_") || hasAppMsg
            ? "app"
            : c.telefone.startsWith("ig_") || c.telefone.startsWith("instagram_")
            ? "instagram"
            : "whatsapp";

        return {
          id: c.id,
          clienteNome: nomeFinal,
          clienteTelefone: c.telefone,
          clienteAvatar: avatarFinal,
          isInfinite: false,
          canal,
          barbeiroPreferido: "A Definir",
          statusAtendimento: c.atendimento_humano ? "humano" : "ia",
          ultimaMensagem: c.ultima_mensagem || "",
          horarioUltimaMensagem: formatarDataResumida(c.ultima_mensagem_at),
          naoLidas: c.nao_lidas || 0,
          mensagens: msgsDaConversa.map((m) => ({
            id: m.id,
            remetente: m.direcao === "entrada" ? "cliente" : (m.tipo === "ia" || m.tipo === "botoes" || m.tipo === "app_cliente") ? "ia" : "humano",
            texto: m.mensagem,
            tipo: m.tipo,
            horario: formatarHora(m.created_at),
            created_at: m.created_at,
          })),
        };
      });

      setConversas(listaMapeada);
      if (!conversaSelecionadaId && listaMapeada.length > 0) {
        setConversaSelecionadaId(listaMapeada[0].id);
      }
    } catch (err) {
      console.error("Erro geral no carregamento do CRM:", err);
    } finally {
      setLoadingConversas(false);
    }
  }, [conversaSelecionadaId]);

  // Carregar dados iniciais e escutar realtime do Supabase
  useEffect(() => {
    carregarConversas();

    const channel = supabase
      .channel("crm_whatsapp_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_mensagens" }, () => {
        carregarConversas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversas" }, () => {
        carregarConversas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarConversas]);

  // Alternar entre Atendimento Humano e Helena
  const handleToggleStatusAtendimento = async () => {
    if (!conversaAtiva) return;
    const novoStatus = conversaAtiva.statusAtendimento === "ia" ? "humano" : "ia";
    const ehHumano = novoStatus === "humano";

    try {
      await supabase
        .from("whatsapp_conversas")
        .update({ atendimento_humano: ehHumano })
        .eq("telefone", conversaAtiva.clienteTelefone);

      setConversas((prev) =>
        prev.map((c) => (c.id === conversaAtiva.id ? { ...c, statusAtendimento: novoStatus } : c))
      );

      toast.success(
        ehHumano
          ? `Atendimento assumido pela equipe humana! ${agenteConfig.nome || 'Heloísa'} pausada.`
          : `${agenteConfig.nome || 'Heloísa'} reativada com sucesso para esta conversa!`
      );
    } catch (err) {
      console.error("Erro ao alterar status:", err);
      toast.error("Falha ao alterar modo de atendimento.");
    }
  };

  // Limpar histórico da conversa
  const handleLimparHistorico = async () => {
    if (!conversaAtiva) return;
    const tel = conversaAtiva.clienteTelefone;

    try {
      await supabase.from("whatsapp_mensagens").delete().eq("telefone", tel);
      await supabase.from("whatsapp_conversas").delete().eq("telefone", tel);

      if (conversaAtiva.clienteId) {
        await supabase
          .from("agendamentos")
          .update({ status: "cancelado", observacoes: "Resetado via CRM" })
          .eq("cliente_id", conversaAtiva.clienteId)
          .eq("status", "agendado");
      }

      setConversas((prev) => prev.filter((c) => c.telefone !== tel));
      setConversaSelecionadaId("");
      toast.success("Histórico da conversa limpo e resetado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao limpar histórico: " + e.message);
    }
  };

  // Enviar mensagem humana
  const handleEnviarMensagem = async (isIA = false) => {
    if (!novoTextoMensagem.trim() || !conversaAtiva) return;
    const texto = novoTextoMensagem.trim();
    setNovoTextoMensagem("");

    try {
      await supabase.from("whatsapp_mensagens").insert({
        telefone: conversaAtiva.clienteTelefone,
        mensagem: texto,
        direcao: "saida",
        tipo: isIA ? "ia" : "humano",
        lida: true,
      });

      await supabase
        .from("whatsapp_conversas")
        .update({
          ultima_mensagem: texto,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .eq("telefone", conversaAtiva.clienteTelefone);

      await enviarMensagemWhatsAppMeta(conversaAtiva.clienteTelefone, texto);
      toast.success("Mensagem enviada no WhatsApp!");
      carregarConversas();
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      toast.error("Erro ao enviar mensagem.");
    }
  };

  // Disparar teste de WhatsApp
  const handleDispararTeste = async () => {
    if (!testZapPhone.trim() || !testZapMsg.trim()) {
      toast.error("Preencha o número de telefone e a mensagem.");
      return;
    }

    setSendingZapTest(true);
    try {
      const cleanPhone = testZapPhone.replace(/\D/g, "");
      const res = await enviarMensagemWhatsAppMeta(cleanPhone, testZapMsg);

      if (res?.messages?.[0]?.id) {
        toast.success("Mensagem de teste enviada com sucesso no WhatsApp!");
        setTestZapOpen(false);
        carregarConversas();
      } else {
        toast.error("Erro ao enviar pela Meta API. Verifique o número informado.");
      }
    } catch (err: any) {
      toast.error("Falha no disparo: " + err.message);
    } finally {
      setSendingZapTest(false);
    }
  };

  const handleToggleModoIaV01 = async (checked: boolean) => {
    setModoIaV01(checked);
    localStorage.setItem("modo_ia_v01_active", checked ? "true" : "false");
    try {
      const { data: iaData } = await supabase.from("agentes_ia").select("id").limit(1).maybeSingle();
      if (iaData?.id) {
        await supabase.from("agentes_ia").update({ modo_v01_booksy: checked } as any).eq("id", iaData.id);
      }
      toast.success(checked ? "Modo IA v0.1 (FAQ & Booksy) ATIVADO!" : "Modo IA v0.1 DESATIVADO (IA Nativa Ativa).");
    } catch (err: any) {
      console.error("Erro ao alternar modo IA v0.1:", err);
      toast.error("Erro ao salvar status do modo IA v0.1");
    }
  };

  const handleSaveBooksyLink = async (unidadeId: string, link: string) => {
    setSavingBooksyId(unidadeId);
    try {
      const { error } = await supabase.from("unidades").update({ link_booksy: link } as any).eq("id", unidadeId);
      if (error) throw error;
      setUnidadesList((prev) => prev.map((u) => (u.id === unidadeId ? { ...u, link_booksy: link } : u)));
      toast.success("Link do Booksy atualizado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar link do Booksy:", err);
      toast.error("Erro ao salvar link do Booksy.");
    } finally {
      setSavingBooksyId(null);
    }
  };

  const conversasFiltradas = conversas.filter((c) => {
    const matchSearch =
      c.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      c.clienteTelefone.includes(search) ||
      c.ultimaMensagem.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (filtroCanal !== "todos") {
      const canalConversa = c.canal || "whatsapp";
      if (canalConversa !== filtroCanal) return false;
    }

    if (filtroStatus === "humano") return c.statusAtendimento === "humano";
    if (filtroStatus === "infinite") return c.isInfinite;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* HEADER SUPERIOR */}
      <PageHeader
        title="Central de Atendimento CRM & WhatsApp"
        description={`Gestão unificada de conversas em tempo real com ${agenteConfig.nome || 'Heloísa'} Oficial e histórico completo do cliente.`}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* CHAVINHA MODO IA V0.1 */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-400 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>IA v0.1 (FAQ & Booksy):</span>
            <Switch
              checked={modoIaV01}
              onCheckedChange={handleToggleModoIaV01}
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setBooksyConfigOpen(true)}
            className="border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold h-9 rounded-xl gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" /> Links Booksy
          </Button>

          <Button
            size="sm"
            onClick={() => setTestZapOpen(true)}
            className="bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs h-9 rounded-xl shadow-md gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Disparar Teste WhatsApp
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfigOpen(true)}
            className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold h-9 rounded-xl gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" /> {agenteConfig.nome || 'Heloísa'} Oficial
          </Button>
        </div>
      </PageHeader>

      {/* PAINEL PRINCIPAL DE 3 COLUNAS ESTILO WHATSAPP WEB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[780px] min-h-0">
        
        {/* COLUNA 1: LISTA DE CONVERSAS ESTILO WHATSAPP WEB (3 COLUNAS) */}
        <div className="lg:col-span-3 bg-[#111b21] border border-[#222d34] rounded-3xl flex flex-col shadow-xl min-h-0 overflow-hidden">
          
          {/* Header do Inbox */}
          <div className="p-3.5 bg-zinc-50 dark:bg-[#202c33] border-b border-zinc-200 dark:border-[#2a3942] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-[#e9edef] flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#00a884]" /> Conversas
              </span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#2a3942] text-[#8696a0]">
                {conversasFiltradas.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTestZapOpen(true)}
              className="text-xs font-bold text-[#00a884] hover:text-[#02906f] hover:bg-white/5 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              + Nova
            </button>
          </div>

          {/* Barra de Busca estilo WhatsApp */}
          <div className="p-2.5 bg-[#111b21] border-b border-[#222d34] shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8696a0]" />
              <input
                type="text"
                placeholder="Pesquisar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#202c33] text-[#e9edef] placeholder:text-[#8696a0] pl-8 pr-3 text-xs h-8 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>

            {/* Filtros em Chips: Canais (2 em cima, 2 em baixo) */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setFiltroCanal("todos")}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full",
                  filtroCanal === "todos"
                    ? "bg-zinc-200 text-zinc-900 dark:bg-white dark:text-black shadow-sm font-black"
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]"
                )}
              >
                Todos ({conversas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroCanal("whatsapp")}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 w-full",
                  filtroCanal === "whatsapp"
                    ? "bg-[#00a884] text-white shadow-sm"
                    : "bg-[#202c33] text-[#00a884] hover:bg-[#00a884]/20"
                )}
              >
                <MessageSquare className="h-3 w-3 shrink-0" /> WhatsApp ({conversas.filter((c) => (c.canal || "whatsapp") === "whatsapp").length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroCanal("app")}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 w-full",
                  filtroCanal === "app"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-[#202c33] text-blue-400 hover:bg-blue-500/20"
                )}
              >
                <Smartphone className="h-3 w-3 shrink-0" /> App Cliente ({conversas.filter((c) => c.canal === "app").length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroCanal("instagram")}
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 w-full",
                  filtroCanal === "instagram"
                    ? "bg-pink-600 text-white shadow-sm"
                    : "bg-[#202c33] text-pink-400 hover:bg-pink-500/20"
                )}
              >
                <Instagram className="h-3 w-3 shrink-0" /> Instagram ({conversas.filter((c) => c.canal === "instagram").length})
              </button>
            </div>

            {/* Filtros em Chips: Status */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setFiltroStatus("todas")}
                className={cn(
                  "text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors flex-1 text-center min-w-[60px]",
                  filtroStatus === "todas"
                    ? "bg-[#00a884] text-white font-bold"
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]"
                )}
              >
                Todas ({conversas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("humano")}
                className={cn(
                  "text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors flex-1 text-center flex items-center justify-center gap-1 min-w-[90px]",
                  filtroStatus === "humano"
                    ? "bg-amber-500 text-white font-bold"
                    : "bg-[#202c33] text-amber-400/80 hover:text-amber-300"
                )}
              >
                <User className="h-2.5 w-2.5" /> Humano ({conversas.filter((c) => c.statusAtendimento === "humano").length})
                {conversas.some((c) => c.statusAtendimento === "humano" && c.naoLidas > 0) && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("infinite")}
                className={cn(
                  "text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors flex-1 text-center flex items-center justify-center gap-1 min-w-[70px]",
                  filtroStatus === "infinite"
                    ? "bg-amber-400 text-black font-bold"
                    : "bg-[#202c33] text-amber-400/80 hover:text-amber-300"
                )}
              >
                <Crown className="h-2.5 w-2.5" /> Infinite
              </button>
            </div>
          </div>

          {/* Lista de Contatos */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#222d34] min-h-0">
            {loadingConversas ? (
              <div className="h-full flex items-center justify-center p-6 text-[#8696a0]">
                <Loader2 className="h-5 w-5 animate-spin text-[#00a884]" />
              </div>
            ) : conversasFiltradas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#8696a0] space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884]">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-[#e9edef]">Nenhuma conversa encontrada</p>
                  <p className="text-[11px] text-[#8696a0] mt-1 leading-relaxed">
                    Envie um WhatsApp ou fale pelo App Cliente para ver aqui!
                  </p>
                </div>
              </div>
            ) : (
              conversasFiltradas.map((conversa) => {
                const isSelected = conversa.id === (conversaAtiva?.id || "");

                return (
                  <div
                    key={conversa.id}
                    onClick={() => setConversaSelecionadaId(conversa.id)}
                    className={cn(
                      "p-3 cursor-pointer transition-colors flex items-center gap-3 relative",
                      isSelected
                        ? "bg-[#2a3942]"
                        : "hover:bg-[#202c33]/70"
                    )}
                  >
                    {/* Foto de Perfil */}
                    <div className="relative shrink-0">
                      <img
                        src={conversa.clienteAvatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${conversa.clienteTelefone}`}
                        alt={conversa.clienteNome}
                        className="w-11 h-11 rounded-full object-cover bg-[#202c33] border border-white/10"
                      />
                      {conversa.canal === "app" ? (
                        <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md text-[9px]" title="App Cliente">
                          <Smartphone className="h-2.5 w-2.5" />
                        </span>
                      ) : conversa.canal === "instagram" ? (
                        <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md text-[9px]" title="Instagram">
                          <Instagram className="h-2.5 w-2.5" />
                        </span>
                      ) : (
                        <span className="absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md text-[9px]" title="WhatsApp">
                          <MessageSquare className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {conversa.isInfinite && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md">
                          <Crown className="h-2.5 w-2.5 fill-black" />
                        </span>
                      )}
                    </div>

                    {/* Detalhes do Contato */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-bold text-zinc-800 dark:text-[#e9edef] truncate">{conversa.clienteNome}</h4>
                          {conversa.canal === "app" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0 flex items-center gap-0.5">
                              <Smartphone className="h-2.5 w-2.5" /> App
                            </span>
                          )}
                          {conversa.canal === "instagram" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30 shrink-0 flex items-center gap-0.5">
                              <Instagram className="h-2.5 w-2.5" /> Insta
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] font-mono shrink-0",
                          conversa.naoLidas > 0 ? "text-emerald-600 dark:text-[#00a884] font-bold" : "text-zinc-500 dark:text-[#8696a0]"
                        )}>
                          {conversa.horarioUltimaMensagem}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] text-zinc-600 dark:text-[#8696a0] truncate flex items-center gap-1">
                          <CheckCheck className="h-3 w-3 text-[#53bdeb] shrink-0" />
                          <span className="truncate">{conversa.ultimaMensagem.replace(/^\*.*?\*\s*💈\s*/i, "")}</span>
                        </p>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {conversa.statusAtendimento === "ia" ? (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {agenteConfig.nome || 'Heloísa'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Humano
                            </span>
                          )}

                          {conversa.naoLidas > 0 && (
                            <span className="w-4 h-4 rounded-full bg-[#00a884] text-white font-bold text-[9px] flex items-center justify-center">
                              {conversa.naoLidas}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 2: JANELA DE CHAT ESTILO WHATSAPP WEB DARK (6 COLUNAS) */}
        <div className="lg:col-span-6 bg-[#efeae2] dark:bg-[#0b141a] border border-zinc-200 dark:border-[#2a3942] rounded-3xl shadow-sm flex flex-col shadow-2xl min-h-0 justify-between overflow-hidden relative">
          
          {/* TEXTURA DOODLE OFICIAL WHATSAPP */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.06] bg-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M9 20L5 16l4-4 1.41 1.41L7.83 16l2.58 2.59L9 20zm20 40l-4-4 4-4 1.41 1.41L27.83 60l2.58 2.59L29 64zm40-20l-4-4 4-4 1.41 1.41L67.83 40l2.58 2.59L69 44zm30 50l-4-4 4-4 1.41 1.41L97.83 90l2.58 2.59L99 94zM15 80a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm70-60a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm20 40a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM45 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              backgroundSize: '120px 120px'
            }}
          />

          {!conversaAtiva ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#8696a0] space-y-3 z-10">
              <div className="w-16 h-16 rounded-full bg-[#202c33] border border-[#2a3942] flex items-center justify-center text-[#00a884]">
                <Bot className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-zinc-900 dark:text-[#e9edef]">Central de Atendimento Hermanos</h4>
              <p className="text-xs text-[#8696a0] max-w-sm leading-relaxed">
                Nenhuma conversa selecionada. A {agenteConfig.nome || 'Heloísa'} responderá automaticamente aos clientes que enviarem mensagens pelo WhatsApp.
              </p>
              <Button
                size="sm"
                onClick={() => setTestZapOpen(true)}
                className="bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold shadow-md rounded-xl"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" /> Iniciar Conversa
              </Button>
            </div>
          ) : (
            <>
              {/* TOPO DO CHAT ESTILO WHATSAPP */}
              <div className="p-3.5 bg-zinc-50 dark:bg-[#202c33] border-b border-zinc-200 dark:border-[#2a3942] flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={conversaAtiva.clienteAvatar}
                      alt={conversaAtiva.clienteNome}
                      className="w-10 h-10 rounded-full object-cover bg-[#202c33] border border-emerald-400/30 shadow-md shrink-0"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border-2 border-[#202c33]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-[#e9edef]">{conversaAtiva.clienteNome}</h3>
                      {conversaAtiva.canal === "app" ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                          <Smartphone className="h-3 w-3" /> App Cliente
                        </Badge>
                      ) : conversaAtiva.canal === "instagram" ? (
                        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/40 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                          <Instagram className="h-3 w-3" /> Instagram
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> WhatsApp
                        </Badge>
                      )}
                      {conversaAtiva.isInfinite && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px] font-bold px-1.5 py-0">
                          <Crown className="h-2.5 w-2.5 mr-1 fill-amber-400" /> Infinite
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#8696a0]">
                      <span className="font-mono">{conversaAtiva.clienteTelefone}</span>
                      <span>•</span>
                      <span className="text-[#00a884] font-medium">online</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLimparHistorico}
                    title="Resetar memória e limpar mensagens desta conversa"
                    className="text-xs font-semibold h-8 gap-1.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleStatusAtendimento}
                    className={cn(
                      "text-xs font-bold h-8 gap-1.5 rounded-xl border transition-all",
                      conversaAtiva.statusAtendimento === "ia"
                        ? "border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                        : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                    )}
                  >
                    {conversaAtiva.statusAtendimento === "ia" ? (
                      <>
                        <User className="h-3.5 w-3.5" /> Assumir Humano
                      </>
                    ) : (
                      <>
                        <Bot className="h-3.5 w-3.5" /> Ativar {agenteConfig.nome || 'Heloísa'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* HISTÓRICO DE MENSAGENS DO CHAT */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pr-2 my-1 z-10">
                {conversaAtiva.mensagens.map((m, idx, array) => {
                  const isCliente = m.remetente === "cliente";
                  const isIA = m.remetente === "ia";

                  const dtAtual = m.created_at ? new Date(m.created_at).toDateString() : "";
                  const dtAnterior = idx > 0 && array[idx - 1].created_at ? new Date(array[idx - 1].created_at!).toDateString() : "";
                  const exibirDivisorData = dtAtual && (idx === 0 || dtAtual !== dtAnterior);

                  return (
                    <div key={m.id} className="space-y-2.5">
                      {exibirDivisorData && (
                        <div className="flex justify-center my-3 sticky top-1 z-20">
                          <span className="px-3.5 py-1 rounded-lg bg-[#182229] border border-white/10 text-[11px] text-[#8696a0] font-medium shadow-md backdrop-blur-md bg-opacity-95">
                            {formatarDataDivider(m.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={cn("flex flex-col", isCliente ? "items-start" : "items-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[82%] px-3.5 py-2 rounded-2xl space-y-1 shadow-md text-xs relative",
                            isCliente
                              ? "bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5"
                              : "bg-[#005c4b] text-[#e9edef] rounded-tr-none border border-emerald-400/20"
                          )}
                        >
                          {!isCliente && (
                            <div className="flex items-center gap-1 text-[10px] font-bold mb-0.5 text-emerald-800 dark:text-emerald-300">
                              {isIA ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                              <span>{isIA ? `${agenteConfig.nome || 'Heloísa'} (Hermanos)` : "Atendente Humano"}</span>
                            </div>
                          )}

                          {(() => {
                            const rawText = String(m.texto || "");
                            const ehAudio = m.tipo === "audio" || rawText.startsWith("data:audio/");
                            const ehImagem = m.tipo === "imagem" || rawText.startsWith("data:image/");
                            const ehCliqueBotao = m.tipo === "botao_resposta" || rawText.startsWith("👆 ");
                            const temBotoesTag = rawText.includes("🔘 [BOTAO:") || m.tipo === "botoes";

                            if (ehAudio) {
                              return (
                                <div className="space-y-1.5 py-1 min-w-[220px]">
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-300">
                                    <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Mensagem de Áudio
                                  </div>
                                  <audio controls className="w-full h-8 rounded-lg brightness-90 contrast-125" src={rawText} />
                                </div>
                              );
                            }

                            if (ehImagem) {
                              return (
                                <div className="space-y-1 py-1">
                                  <img src={rawText} alt="Referência" className="max-w-xs rounded-xl border border-white/10 object-cover max-h-60" />
                                </div>
                              );
                            }

                            // Extrair botões se houver
                            let textoLimpo = rawText;
                            let listaBotoes: string[] = [];

                            if (temBotoesTag) {
                              const regex = /🔘 \[BOTAO:\s*([^\]]+)\]/g;
                              let match;
                              while ((match = regex.exec(rawText)) !== null) {
                                listaBotoes.push(match[1].trim());
                              }
                              textoLimpo = rawText.replace(/🔘 \[BOTAO:[^\]]+\]\n?/g, "").trim();
                            }

                            // Se for a mensagem de saudação ou reset padrão e não tiver tags, sugerir os botões oficiais
                            if (!isCliente && listaBotoes.length === 0 && (textoLimpo.includes("Como posso te ajudar hoje") || textoLimpo.includes("Seja muito bem-vindo") || textoLimpo.includes("Histórico resetado"))) {
                              listaBotoes = ["Agendar Horário", "Planos Infinite"];
                            }

                            if (ehCliqueBotao) {
                              const btnTitulo = rawText.replace(/^👆\s*/, "").trim();
                              return (
                                <div className="space-y-1 py-0.5">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                                    <MousePointerClick className="h-3 w-3" />
                                    <span>Botão Selecionado:</span>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center gap-2 shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                    {btnTitulo}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <p className="leading-relaxed whitespace-pre-line text-[#e9edef] select-text">{textoLimpo}</p>
                                {listaBotoes.length > 0 && (
                                  <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                                    {listaBotoes.map((btn, bIdx) => (
                                      <div
                                        key={bIdx}
                                        className="px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/45 border border-emerald-400/30 text-emerald-200 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                                      >
                                        {btn.toLowerCase().includes("agendar") ? (
                                          <Calendar className="h-3 w-3 text-emerald-400" />
                                        ) : btn.toLowerCase().includes("plano") || btn.toLowerCase().includes("infinite") ? (
                                          <Crown className="h-3 w-3 text-amber-400" />
                                        ) : (
                                          <User className="h-3 w-3 text-cyan-400" />
                                        )}
                                        <span>{btn}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div
                            className="flex items-center justify-end gap-1 text-[9px] text-[#8696a0] font-mono pt-0.5 cursor-help"
                            title={m.created_at ? new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "medium" }) : undefined}
                          >
                            <span>{m.horario}</span>
                            {!isCliente && (
                              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BARRA DE DIGITAÇÃO ESTILO WHATSAPP WEB */}
              <div className="p-3 bg-white dark:bg-[#202c33] border-t border-zinc-200 dark:border-[#2a3942] z-10 shrink-0">
                <div className="flex items-center gap-2">
                  <button type="button" className="text-[#8696a0] hover:text-[#aebac1] p-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <Smile className="h-5 w-5" />
                  </button>
                  <button type="button" className="text-[#8696a0] hover:text-[#aebac1] p-1.5 rounded-full hover:bg-white/5 transition-colors">
                    <Paperclip className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    placeholder="Digite uma mensagem..."
                    value={novoTextoMensagem}
                    onChange={(e) => setNovoTextoMensagem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEnviarMensagem(false)}
                    className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] text-xs h-10 px-4 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  />

                  {novoTextoMensagem.trim() ? (
                    <button
                      type="button"
                      onClick={() => handleEnviarMensagem(false)}
                      className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-[#8696a0] hover:text-[#e9edef] flex items-center justify-center transition-colors shrink-0"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* COLUNA 3: DADOS DO CONTATO ESTILO WHATSAPP WEB (3 COLUNAS) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#111b21] border border-zinc-200 dark:border-[#222d34] rounded-3xl flex flex-col shadow-sm min-h-0 overflow-y-auto">
          {!conversaAtiva ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#8696a0] space-y-2">
              <User className="h-10 w-10 opacity-30 text-[#00a884]" />
              <p className="text-xs font-bold text-zinc-800 dark:text-[#e9edef]">Dados do Contato</p>
              <p className="text-[11px] text-[#8696a0]">Selecione uma conversa para visualizar os dados e histórico do cliente.</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Header do Perfil estilo WhatsApp */}
              <div className="text-center pb-4 border-b border-zinc-200 dark:border-[#222d34] space-y-3">
                <div className="relative inline-block mx-auto">
                  <img
                    src={conversaAtiva.clienteAvatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${conversaAtiva.clienteTelefone}`}
                    alt={conversaAtiva.clienteNome}
                    className="w-20 h-20 rounded-full object-cover mx-auto bg-[#202c33] border-2 border-[#00a884]/40 shadow-xl"
                  />
                  {conversaAtiva.isInfinite && (
                    <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg border-2 border-white dark:border-[#111b21]">
                      <Crown className="h-3.5 w-3.5 fill-black" />
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-[#e9edef]">{conversaAtiva.clienteNome}</h3>
                  <p className="text-xs text-zinc-600 dark:text-[#8696a0] font-mono mt-0.5">{conversaAtiva.clienteTelefone}</p>
                </div>

                {conversaAtiva.isInfinite ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-xs">
                    <Crown className="h-3.5 w-3.5 fill-amber-400" /> Assinante Infinite VIP
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202c33] border border-[#2a3942] text-[#8696a0] text-xs font-semibold">
                    Cliente Avulso
                  </div>
                )}
              </div>

              {/* CARD DE INFORMAÇÕES DO ATENDIMENTO */}
              <div className="p-3 bg-[#202c33] rounded-2xl border border-[#2a3942] space-y-2.5">
                <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-wider block">
                  Informações da Barbearia
                </span>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8696a0] flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-[#00a884]" /> Barbeiro Preferido:
                  </span>
                  <span className="font-bold text-[#e9edef]">{conversaAtiva.barbeiroPreferido}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                  <span className="text-[#8696a0] flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-[#00a884]" /> Atendente IA:
                  </span>
                  <span className="font-bold text-emerald-400">{agenteConfig.nome || 'Heloísa'} Oficial</span>
                </div>
              </div>

              {/* AÇÕES RÁPIDAS estilo WhatsApp Web */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-wider block">
                  Ações Rápidas:
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info(`Agendando para ${conversaAtiva.clienteNome}...`)}
                  className="w-full text-xs font-bold h-9 justify-start gap-2 rounded-xl bg-[#202c33] border-[#2a3942] text-[#e9edef] hover:bg-[#2a3942] hover:text-white"
                >
                  <Calendar className="h-4 w-4 text-[#00a884]" /> Agendar Horário
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Link do Clube Infinite gerado com sucesso!")}
                  className="w-full text-xs font-bold h-9 justify-start gap-2 rounded-xl bg-[#202c33] border-[#2a3942] text-[#e9edef] hover:bg-[#2a3942] hover:text-white"
                >
                  <Crown className="h-4 w-4 text-amber-400 fill-amber-400/20" /> Convidar para Infinite
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Chave PIX e fatura enviadas no chat!")}
                  className="w-full text-xs font-bold h-9 justify-start gap-2 rounded-xl bg-[#202c33] border-[#2a3942] text-[#e9edef] hover:bg-[#2a3942] hover:text-white"
                >
                  <CreditCard className="h-4 w-4 text-emerald-400" /> Gerar Cobrança PIX
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE CONFIGURAÇÕES DO AGENTE DE IA (UNIFICADO NO CRM) */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 text-foreground rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-emerald-400" />
              Configurações do Agente IA Google Gemini ({agenteConfig.nome || 'Heloísa'})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ajuste o tom de voz, nome e instruções de inteligência artificial da {config?.nome || 'Barbearia Hermanos'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-foreground">Status do Agente no WhatsApp</Label>
                <p className="text-xs text-muted-foreground">Respostas automáticas inteligentes ativas</p>
              </div>
              <Switch
                checked={agenteConfig.ativo}
                onCheckedChange={(v) => setAgenteConfig((prev) => ({ ...prev, ativo: v }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Nome de Exibição</Label>
                <Input
                  value={agenteConfig.nome}
                  onChange={(e) => setAgenteConfig((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Heloísa"
                  className="input-dark text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Tom da Conversa</Label>
                <Input
                  value={agenteConfig.tom}
                  onChange={(e) => setAgenteConfig((prev) => ({ ...prev, tom: e.target.value }))}
                  placeholder="Ex: Simpática, profissional e acolhedora"
                  className="input-dark text-xs"
                />
              </div>
            </div>

            <Tabs defaultValue="oficial" className="w-full space-y-3">
              <TabsList className="bg-zinc-900 border border-zinc-800 p-1 rounded-xl w-full grid grid-cols-2">
                <TabsTrigger value="oficial" className="text-xs font-bold gap-1.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  Prompt Oficial Nativo
                </TabsTrigger>
                <TabsTrigger value="v01" className="text-xs font-bold gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Prompt Versão v0.1 (Booksy)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="oficial" className="space-y-2 m-0">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-emerald-400">👑 Prompt Base Oficial (IA Nativa Hermanos)</Label>
                  <span className="text-[10px] text-emerald-400 font-mono">Google Gemini 3.5 Flash</span>
                </div>
                <Textarea
                  rows={10}
                  value={agenteConfig.instrucoes_extras || `# CONTEXTO E IDENTIDADE
Você é Heloísa, a recepcionista oficial e especialista em experiência do cliente da Barbearia Hermanos.
Seu objetivo é agendar serviços, atuar como consultora de vendas (SDR) para assinaturas e produtos, e realizar retenção de clientes. Tudo isso de forma acolhedora, rápida, elegante e resolutiva pelo WhatsApp.

# DIRETRIZES DE COMPORTAMENTO E TOM DE VOZ
1. Humanização: NUNCA diga que é um robô, IA, assistente virtual ou modelo de linguagem. Aja 100% como uma humana cordial.
2. Concisão: Responda em no máximo 1 a 3 parágrafos curtos.
3. Tom de Voz: Profissional, acolhedor, direto, elegante e resolutivo.`}
                  onChange={(e) => setAgenteConfig((prev) => ({ ...prev, instrucoes_extras: e.target.value }))}
                  placeholder="Diretrizes do CRM..."
                  className="input-dark text-xs font-mono leading-relaxed"
                />
              </TabsContent>

              <TabsContent value="v01" className="space-y-2 m-0">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-amber-400">⚡ Prompt Modo Paliativo v0.1 (FAQ & Booksy)</Label>
                  <span className="text-[10px] text-amber-400 font-mono">Google Gemini 3.5 Flash</span>
                </div>
                <Textarea
                  rows={10}
                  value={promptV01State}
                  onChange={(e) => setPromptV01State(e.target.value)}
                  placeholder="Instruções para o modo v0.1 Booksy..."
                  className="input-dark text-xs font-mono leading-relaxed"
                />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfigOpen(false)}
              className="border-zinc-800 text-xs font-bold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  await supabase.from("agentes_ia").update({
                    nome: agenteConfig.nome,
                    tom: agenteConfig.tom,
                    instrucoes_extras: agenteConfig.instrucoes_extras,
                    prompt_v01_booksy: promptV01State,
                    modo_v01_booksy: modoIaV01,
                    ativo: agenteConfig.ativo,
                    updated_at: new Date().toISOString(),
                  } as any).eq("id", agenteConfig.id || "d1397ca8-3872-4e69-86a7-6fc3739aeea8");

                  setConfigOpen(false);
                  toast.success(`Configurações da ${agenteConfig.nome} salvas com sucesso no banco!`);
                } catch (e: any) {
                  toast.error("Erro ao salvar: " + e.message);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
            >
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: DISPARAR MENSAGEM DE TESTE DE WHATSAPP */}
      <Dialog open={testZapOpen} onOpenChange={setTestZapOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-foreground rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-500" />
              Disparar WhatsApp de Teste
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Envie uma mensagem direta via Meta Cloud API ({META_WHATSAPP_CONFIG.senderPhone}) para testar a entrega.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Número de Telefone (com DDD e DDI 55)</Label>
              <Input
                placeholder="Ex: 5511949030959"
                value={testZapPhone}
                onChange={(e) => setTestZapPhone(e.target.value)}
                className="input-dark text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Mensagem</Label>
              <Textarea
                rows={4}
                value={testZapMsg}
                onChange={(e) => setTestZapMsg(e.target.value)}
                placeholder="Digite o texto da mensagem..."
                className="input-dark text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestZapOpen(false)}
              className="border-zinc-800 text-xs font-bold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDispararTeste}
              disabled={sendingZapTest}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl gap-1.5"
            >
              {sendingZapTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sendingZapTest ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIGURAÇÃO DE LINKS DO BOOKSY POR UNIDADE */}
      <Dialog open={booksyConfigOpen} onOpenChange={setBooksyConfigOpen}>
        <DialogContent className="max-w-lg bg-zinc-950 border border-zinc-800 text-foreground rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-amber-500" />
              Links do Booksy por Unidade (Modo IA v0.1)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cadastre o link do Booksy correspondente a cada unidade para a IA v0.1 enviar aos clientes durante o atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 max-h-[400px] overflow-y-auto pr-1">
            {unidadesList.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhuma unidade encontrada.
              </div>
            ) : (
              unidadesList.map((unidade) => {
                const getBooksyFallback = (nome: string) => {
                  const lower = (nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  if (lower.includes("higien")) return "https://bit.ly/3BarbeariaHermanosSantaCecilia";
                  if (lower.includes("osasco")) return "https://barbeariahermanosos.booksy.com/";
                  if (lower.includes("mooca")) return "https://barbeariahermanosmooca.booksy.com/";
                  if (lower.includes("tatuap")) return "https://hermanostatuape.booksy.com/";
                  if (lower.includes("freguesia")) return "https://bit.ly/AgendaBarbeariaHermanos";
                  if (lower.includes("caetano")) return "https://bit.ly/3W42IXa";
                  if (lower.includes("itaim")) return "https://bit.ly/3yGUY63";
                  return "";
                };

                const linkExibido = unidade.link_booksy || getBooksyFallback(unidade.nome);

                return (
                  <div key={unidade.id} className="p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-200">{unidade.nome}</span>
                      <span className="text-[10px] text-zinc-400">{unidade.endereco}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id={`crm-booksy-${unidade.id}`}
                        defaultValue={linkExibido}
                        placeholder="https://booksy.com/pt-br/..."
                        className="input-dark text-xs font-mono flex-1 text-amber-400"
                      />
                      <Button
                        size="sm"
                        disabled={savingBooksyId === unidade.id}
                        onClick={() => {
                          const val = (document.getElementById(`crm-booksy-${unidade.id}`) as HTMLInputElement)?.value;
                          handleSaveBooksyLink(unidade.id, val || linkExibido);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl gap-1"
                      >
                        {savingBooksyId === unidade.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBooksyConfigOpen(false)}
              className="border-zinc-800 text-xs font-bold rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
