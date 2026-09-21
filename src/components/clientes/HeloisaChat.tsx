import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Bot, Calendar, Clock, MapPin, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface HeloisaChatProps {
  cliente: any;
  empresa: any;
  onAgendamentoRealizado?: () => void;
}

interface MensagemChat {
  id: string;
  origem: "usuario" | "ia";
  texto: string;
  criadoEm: Date;
  tagAcao?: string;
  bookingState?: any;
  agendamentoCriado?: boolean;
}

const SUPABASE_URL = "https://khoeovszuixfwfkaaxaa.supabase.co";

export default function HeloisaChat({ cliente, empresa, onAgendamentoRealizado }: HeloisaChatProps) {
  const primeiroNome = cliente?.nome ? cliente.nome.split(" ")[0] : "Amigo";

  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    {
      id: "boas-vindas",
      origem: "ia",
      texto: `Olá, ${primeiroNome}! 💈 Eu sou a Heloísa, assistente oficial da Barbearia Hermanos. Como posso te ajudar hoje? Se quiser, posso agendar seu corte ou tirar dúvidas sobre a nossa Assinatura Infinite!`,
      criadoEm: new Date(),
    },
  ]);

  const [inputTexto, setInputTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [bookingState, setBookingState] = useState<any>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [mensagens, enviando]);

  const handleEnviarMensagem = async (textoParaEnviar?: string) => {
    const texto = (textoParaEnviar || inputTexto).trim();
    if (!texto || enviando) return;

    const novaMsgUsuario: MensagemChat = {
      id: `usr_${Date.now()}`,
      origem: "usuario",
      texto,
      criadoEm: new Date(),
    };

    setMensagens((prev) => [...prev, novaMsgUsuario]);
    setInputTexto("");
    setEnviando(true);

    try {
      // Monta o histórico recente para a IA entender o contexto
      const historicoRecente = [...mensagens, novaMsgUsuario].slice(-8).map((m) => ({
        origem: m.origem,
        texto: m.texto,
      }));

      const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "app_chat",
          cliente_id: cliente?.id,
          nome_cliente: cliente?.nome || "Cliente",
          telefone: cliente?.telefone || "",
          mensagem: texto,
          historico: historicoRecente,
          booking_state: bookingState,
        }),
      });

      const data = await res.json();

      if (data?.resposta) {
        const novaMsgIa: MensagemChat = {
          id: `ia_${Date.now()}`,
          origem: "ia",
          texto: data.resposta,
          criadoEm: new Date(),
          tagAcao: data.tag_acao,
          bookingState: data.booking_state,
          agendamentoCriado: data.agendamento_criado,
        };

        if (data.booking_state) {
          setBookingState(data.booking_state);
        }

        if (data.agendamento_criado && onAgendamentoRealizado) {
          onAgendamentoRealizado();
        }

        setMensagens((prev) => [...prev, novaMsgIa]);
      } else {
        setMensagens((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            origem: "ia",
            texto: "Desculpe, tive uma instabilidade momentânea na conexão. Poderia repetir por favor?",
            criadoEm: new Date(),
          },
        ]);
      }
    } catch (e) {
      console.error("Erro no chat da Heloísa:", e);
      setMensagens((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          origem: "ia",
          texto: "Ops! Não consegui me conectar ao servidor agora. Verifique sua conexão e tente novamente.",
          criadoEm: new Date(),
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const handleResetChat = () => {
    setBookingState({});
    setMensagens([
      {
        id: "boas-vindas-reset",
        origem: "ia",
        texto: `Histórico limpo! 💈 Como posso te ajudar agora, ${primeiroNome}?`,
        criadoEm: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[75vh] bg-[#120608] rounded-3xl border border-red-900/40 shadow-2xl overflow-hidden animate-in fade-in duration-300">
      {/* Header do Chat */}
      <div className="p-3.5 bg-gradient-to-r from-[#24060b] to-[#120306] border-b border-red-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center text-white shadow-md border border-red-400/40">
              <Bot className="h-5 w-5 text-red-100" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#120608]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black text-white">Heloísa</h3>
              <Badge className="bg-red-950 text-red-400 border-red-700/50 text-[9px] px-1 py-0 h-4 font-bold">
                IA Oficial
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400">Atendimento Hermanos 24h</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetChat}
          title="Recomeçar conversa"
          className="h-8 px-2 text-slate-400 hover:text-white hover:bg-red-950/40 text-[11px] font-semibold"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      </div>

      {/* Área de Mensagens (Scrollable) */}
      <div
        ref={chatScrollRef}
        className="flex-1 p-3.5 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-red-950/60"
      >
        {mensagens.map((msg) => {
          const isUser = msg.origem === "usuario";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in fade-in duration-150`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                  isUser
                    ? "bg-gradient-to-r from-red-700 to-red-900 text-white rounded-br-none border border-red-500/30"
                    : "bg-[#1f0a0e] text-slate-100 rounded-bl-none border border-red-900/30"
                }`}
              >
                <p className="whitespace-pre-line">{msg.texto}</p>

                {/* Badge de Agendamento Confirmado em Destaque */}
                {msg.agendamentoCriado && (
                  <div className="mt-2.5 p-2 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 font-bold text-[11px]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Agendamento registrado no sistema com sucesso!</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-400 px-1 mt-1 font-mono">
                {msg.criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}

        {enviando && (
          <div className="flex items-center gap-2 text-xs text-red-400 p-2 animate-pulse font-semibold">
            <Bot className="h-4 w-4 animate-spin text-red-500" />
            <span>Heloísa está digitando...</span>
          </div>
        )}
      </div>

      {/* Sugestões Rápidas de Ação */}
      {mensagens.length <= 2 && (
        <div className="px-3 py-1 flex gap-1.5 overflow-x-auto no-scrollbar border-t border-red-900/20 bg-[#170508]/40">
          <button
            onClick={() => handleEnviarMensagem("Quero agendar um corte de cabelo")}
            disabled={enviando}
            className="text-[10px] bg-red-950/60 hover:bg-red-900/80 border border-red-800/40 text-red-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
          >
            ✂️ Agendar Corte
          </button>
          <button
            onClick={() => handleEnviarMensagem("Como funciona a Assinatura Infinite?")}
            disabled={enviando}
            className="text-[10px] bg-amber-950/60 hover:bg-amber-900/80 border border-amber-700/40 text-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
          >
            👑 Assinatura Infinite
          </button>
          <button
            onClick={() => handleEnviarMensagem("Quais são os horários disponíveis hoje?")}
            disabled={enviando}
            className="text-[10px] bg-red-950/60 hover:bg-red-900/80 border border-red-800/40 text-red-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
          >
            ⏰ Horários de Hoje
          </button>
        </div>
      )}

      {/* Input de Mensagem */}
      <div className="p-3 bg-[#170508] border-t border-red-900/40 flex items-center gap-2">
        <Input
          placeholder="Converse com a Heloísa..."
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleEnviarMensagem();
            }
          }}
          disabled={enviando}
          className="bg-black/60 border-red-900/40 text-white placeholder:text-slate-500 text-xs h-10 rounded-xl focus:border-red-500"
        />
        <Button
          onClick={() => handleEnviarMensagem()}
          disabled={enviando || !inputTexto.trim()}
          className="h-10 w-10 p-0 bg-gradient-to-br from-red-600 to-red-900 hover:from-red-700 hover:to-red-950 text-white rounded-xl shadow-lg flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
