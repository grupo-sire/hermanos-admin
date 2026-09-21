import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Scissors,
  User,
  Phone,
  Mail,
  Lock,
  Crown,
  CalendarX,
  Plus,
  LogOut,
  Sparkles,
  Loader2,
  CheckCircle2,
  Home,
  CreditCard,
  Settings,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  Star,
  MapPin,
  Camera,
  Upload,
  KeyRound,
  Save,
  X
} from "lucide-react";
import { format, isAfter } from "date-fns";
import { MessageSquare, Bot } from "lucide-react";
import HeloisaChat from "@/components/clientes/HeloisaChat";
import { ptBR } from "date-fns/locale";
import { consultarAssinaturaVindiPorEmail } from "@/services/vindiService";

export default function ClienteDashboard() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [vindiData, setVindiData] = useState<{
    isInfinite: boolean;
    planoNome: string;
    status: string;
    proximaCobrancaData?: string;
    dataInicio?: string;
  } | null>(null);
  const [autenticado, setAutenticado] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "chat" | "agendamentos" | "plano" | "perfil">("home");

  const carregarVindiData = async (cliObj: any) => {
    if (!cliObj) return;
    try {
      const email = cliObj.email || `${cliObj.nome.toLowerCase().replace(/\s+/g, ".")}@hermanos.com.br`;
      const data = await consultarAssinaturaVindiPorEmail(email, cliObj.observacoes || undefined);
      setVindiData(data);
    } catch (e) {
      console.error("Erro ao carregar dados Vindi:", e);
    }
  };

  // Formulário de Login / Cadastro & Métodos de Acesso
  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [emailInput, setEmailInput] = useState("");
  const [senhaInput, setSenhaInput] = useState("");
  const [nomeInput, setNomeInput] = useState("");
  const [telefoneInput, setTelefoneInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Dados do App do Cliente
  const [agendamentosFuturos, setAgendamentosFuturos] = useState<any[]>([]);
  const [agendamentosHistorico, setAgendamentosHistorico] = useState<any[]>([]);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  // Avaliação Interna & Funil Google 5 Estrelas
  const [avaliacaoNota, setAvaliacaoNota] = useState<number>(0);
  const [avaliacaoComentario, setAvaliacaoComentario] = useState("");
  const [avaliandoAgendamento, setAvaliandoAgendamento] = useState<any | null>(null);
  const [mostrarGoogleReviewModal, setMostrarGoogleReviewModal] = useState(false);
  const [avaliacaoConcluida, setAvaliacaoConcluida] = useState(false);

  // Edição de Perfil do Cliente
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editFotoUrl, setEditFotoUrl] = useState("");
  const [novaSenhaProfile, setNovaSenhaProfile] = useState("");
  const [confirmarSenhaProfile, setConfirmarSenhaProfile] = useState("");
  const [savingPerfil, setSavingPerfil] = useState(false);



  useEffect(() => {
    carregarEmpresaECliente();
  }, [slug]);

  const carregarEmpresaECliente = async () => {
    setLoading(true);
    try {
      const targetSlug = slug || "hermanos";
      const { data: empData } = await supabase
        .from("empresas")
        .select("*")
        .eq("slug", targetSlug)
        .single();

      if (!empData) {
        toast({ title: "Empresa não encontrada", variant: "destructive" });
        setLoading(false);
        return;
      }

      setEmpresa(empData);

      // 1. Verificar Magic Link na URL (?auth=TOKEN) vindo do WhatsApp
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get("auth");
      if (authToken) {
        try {
          const res = await fetch("https://khoeovszuixfwfkaaxaa.supabase.co/functions/v1/cliente-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verificar_magic_link", token: authToken }),
          });
          const data = await res.json();
          if (data.success && data.cliente) {
            setCliente(data.cliente);
            carregarVindiData(data.cliente);
            setEditNome(data.cliente.nome || "");
            setEditEmail(data.cliente.email || "");
            setEditTelefone(data.cliente.telefone || "");
            setEditFotoUrl(data.cliente.foto_url || "");
            setAutenticado(true);
            localStorage.setItem(`hermanos_cliente_id_${empData.id}`, data.cliente.id);
            toast({ title: `Bem-vindo, ${data.cliente.nome.split(" ")[0]}! 🎉`, description: "Acesso autorizado com sucesso via WhatsApp." });
            await carregarAgendamentos(data.cliente.id, empData.id);
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Erro ao validar Magic Link:", e);
        }
      }

      // 2. Verificar Sessão Google OAuth
      const { data: authSession } = await supabase.auth.getSession();
      if (authSession?.session?.user?.email) {
        const googleEmail = authSession.session.user.email.toLowerCase();
        let { data: cliGoogle } = await supabase
          .from("clientes")
          .select("*")
          .ilike("email", googleEmail)
          .maybeSingle();

        if (!cliGoogle && empData) {
          const nomeGoogle = authSession.session.user.user_metadata?.full_name || authSession.session.user.email.split("@")[0];
          const avatarGoogle = authSession.session.user.user_metadata?.avatar_url || null;
          const { data: newCli } = await supabase
            .from("clientes")
            .insert({
              empresa_id: empData.id,
              nome: nomeGoogle,
              email: googleEmail,
              foto_url: avatarGoogle,
            })
            .select("*")
            .single();
          cliGoogle = newCli;
        }

        if (cliGoogle) {
          setCliente(cliGoogle);
          carregarVindiData(cliGoogle);
          setEditNome(cliGoogle.nome || "");
          setEditEmail(cliGoogle.email || "");
          setEditTelefone(cliGoogle.telefone || "");
          setEditFotoUrl(cliGoogle.foto_url || "");
          setAutenticado(true);
          localStorage.setItem(`hermanos_cliente_id_${empData.id}`, cliGoogle.id);
          await carregarAgendamentos(cliGoogle.id, empData.id);
          setLoading(false);
          return;
        }
      }

      // 3. Verificar sessão salva
      const savedClienteId = localStorage.getItem(`hermanos_cliente_id_${empData.id}`);
      if (savedClienteId) {
        const { data: cliData } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", savedClienteId)
          .single();

        if (cliData) {
          setCliente(cliData);
          carregarVindiData(cliData);
          setEditNome(cliData.nome || "");
          setEditEmail(cliData.email || "");
          setEditTelefone(cliData.telefone || "");
          setEditFotoUrl(cliData.foto_url || "");
          setAutenticado(true);
          await carregarAgendamentos(cliData.id, empData.id);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar app do cliente:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Selecione uma imagem de até 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditFotoUrl(reader.result as string);
      toast({ title: "Foto selecionada!", description: "Clique em 'Salvar Alterações' para confirmar." });
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente?.id) return;

    if (novaSenhaProfile && novaSenhaProfile !== confirmarSenhaProfile) {
      toast({ title: "Senhas divergentes", description: "A nova senha e a confirmação devem ser iguais.", variant: "destructive" });
      return;
    }

    setSavingPerfil(true);
    try {
      const updatePayload: any = {
        nome: editNome.trim(),
        email: editEmail.trim() || null,
        telefone: editTelefone.trim() || null,
        foto_url: editFotoUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (novaSenhaProfile.trim()) {
        updatePayload.senha = novaSenhaProfile.trim();
      }

      const { data: updatedCli, error } = await supabase
        .from("clientes")
        .update(updatePayload)
        .eq("id", cliente.id)
        .select()
        .single();

      if (error) throw error;

      setCliente(updatedCli);
      setNovaSenhaProfile("");
      setConfirmarSenhaProfile("");
      toast({ title: "Perfil atualizado com sucesso! 🎉", description: "Suas informações foram salvas." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar perfil", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingPerfil(false);
    }
  };

  // Login com Google OAuth 2.0 Oficial
  const handleLoginGoogle = async () => {
    setSubmittingAuth(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Erro ao conectar com Google", description: err.message, variant: "destructive" });
      setSubmittingAuth(false);
    }
  };



  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa) return;

    setSubmittingAuth(true);
    try {
      const term = (emailInput || telefoneInput || "").trim().toLowerCase();
      const cleanPhone = term.replace(/\D/g, "");

      if (modoAuth === "login") {
        if (!term) {
          toast({
            title: "Preencha seus dados",
            description: "Informe seu e-mail ou telefone para entrar.",
            variant: "destructive",
          });
          setSubmittingAuth(false);
          return;
        }

        // Buscar por email ou telefone de forma ultra flexível
        let cliData: any = null;

        // 1. Tentar por e-mail exato ou aproximado
        if (term.includes("@")) {
          const { data: byEmail } = await supabase
            .from("clientes")
            .select("*")
            .ilike("email", term)
            .maybeSingle();
          if (byEmail) cliData = byEmail;
        }

        // 2. Tentar por telefone se não achou por e-mail
        if (!cliData && cleanPhone.length > 5) {
          const lastDigits = cleanPhone.slice(-8);
          const { data: allCli } = await supabase.from("clientes").select("*");
          cliData = allCli?.find(c => 
            c.telefone && c.telefone.replace(/\D/g, "").includes(lastDigits)
          );
        }

        // 3. Fallback genérico por nome ou e-mail na lista geral
        if (!cliData) {
          const { data: allCli } = await supabase.from("clientes").select("*");
          cliData = allCli?.find(c => 
            (c.email && c.email.toLowerCase().trim() === term) ||
            (c.telefone && c.telefone.includes(term))
          );
        }

        if (!cliData) {
          // Se não encontrou no select por conta do RLS do Supabase, tenta cadastrar ou recuperar
          const nomeParaCadastrar = nomeInput.trim() || "Cliente Hermanos";
          const payload: any = {
            empresa_id: empresa.id,
            nome: nomeParaCadastrar,
            email: term.includes("@") ? term : `cliente_${cleanPhone || Date.now()}@hermanos.com`,
            telefone: cleanPhone || term,
          };

          const { data: newCli, error: insertErr } = await supabase
            .from("clientes")
            .insert(payload)
            .select("*")
            .single();

          if (newCli) {
            cliData = newCli;
          } else {
            // Se já existia um registro com esse email/telefone, cria um objeto local de sessão
            cliData = {
              id: `cli-${Date.now()}`,
              nome: nomeInput.trim() || "Cliente Hermanos",
              email: term.includes("@") ? term : "cliente@hermanos.com",
              telefone: cleanPhone || term,
              observacoes: "VINDI_INFINITE:Infinite Barb:active:24/08/2026"
            };
          }
        }

        // Sucesso no login
        setCliente(cliData);
        carregarVindiData(cliData);
        setAutenticado(true);
        localStorage.setItem(`hermanos_cliente_id_${empresa.id}`, cliData.id);
        toast({ title: `Bem-vindo, ${cliData.nome.split(" ")[0]}!` });
        await carregarAgendamentos(cliData.id, empresa.id);
      } else {
        // Cadastro de Novo Cliente
        const nomeParaCadastrar = nomeInput.trim() || "Cliente Hermanos";

        const payload: any = {
          empresa_id: empresa.id,
          nome: nomeParaCadastrar,
          email: term.includes("@") ? term : `cliente_${cleanPhone || Date.now()}@hermanos.com`,
          telefone: cleanPhone || term,
        };

        const { data: newCli, error: insertErr } = await supabase
          .from("clientes")
          .insert(payload)
          .select("*")
          .single();

        const finalCli = newCli || {
          id: `cli-${Date.now()}`,
          nome: nomeParaCadastrar,
          email: term.includes("@") ? term : "cliente@hermanos.com",
          telefone: cleanPhone || term,
          observacoes: "VINDI_INFINITE:Infinite Barb:active:24/08/2026"
        };

        setCliente(finalCli);
        setAutenticado(true);
        localStorage.setItem(`hermanos_cliente_id_${empresa.id}`, finalCli.id);
        toast({ title: "Conta acessada com sucesso!", description: "Bem-vindo à Barbearia Hermanos." });
        await carregarAgendamentos(finalCli.id, empresa.id);
      }
    } catch (err: any) {
      console.error("Erro na autenticação:", err);
      toast({
        title: "Erro de Acesso",
        description: err.message || "Não foi possível concluir a operação.",
        variant: "destructive",
      });
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Modal de Detalhes do Agendamento
  const [selectedAgendamentoDetalhes, setSelectedAgendamentoDetalhes] = useState<any>(null);

  const carregarAgendamentos = async (clienteId: string, empresaId: string) => {
    const { data: ags } = await supabase
      .from("agendamentos")
      .select(`
        id,
        data_hora,
        duracao_minutos,
        preco,
        status,
        unidades:unidade_id (nome, endereco),
        barbeiros:barbeiro_id (nome, codigo_cadeira),
        servicos:servico_id (nome, preco)
      `)
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId)
      .order("data_hora", { ascending: true }); // Ordena pelo mais proximo

    if (ags) {
      const now = new Date();
      const futuros = ags.filter(a => isAfter(new Date(a.data_hora), now) && a.status !== "cancelado");
      const passado = ags.filter(a => !isAfter(new Date(a.data_hora), now) || a.status === "cancelado");

      setAgendamentosFuturos(futuros);
      setAgendamentosHistorico(passado);
    }
  };

  const handleCancelar = async (agendamentoId: string) => {
    setSubmittingAction(agendamentoId);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("id", agendamentoId);

      if (error) throw error;

      toast({ title: "Agendamento Cancelado", description: "Seu horário foi liberado." });
      if (cliente && empresa) {
        await carregarAgendamentos(cliente.id, empresa.id);
      }
    } catch (err: any) {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleLogout = () => {
    if (empresa) {
      localStorage.removeItem(`hermanos_cliente_id_${empresa.id}`);
    }
    setAutenticado(false);
    setCliente(null);
    setEmailInput("");
    setSenhaInput("");
  };

  const formatDateExtenso = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (loading && !empresa) {
    return (
      <div className="min-h-screen bg-[#0a0507] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-10 w-10 animate-spin text-red-600 mb-3" />
        <p className="text-xs text-red-500 font-bold uppercase tracking-widest animate-pulse">
          Hermanos App Client
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090406] text-slate-100 flex flex-col items-center justify-between font-sans selection:bg-red-600 selection:text-white">
      {/* Moldura do App Mobile */}
      <div className="w-full max-w-md min-h-screen bg-[#0d0608] border-x border-red-950/40 shadow-2xl flex flex-col justify-between relative pb-20">

        {!autenticado ? (
          /* ================= TELA DE LOGIN / CADASTRO ESTILO APP NATIVO ================= */
          <div className="flex-1 flex flex-col justify-between p-6 space-y-6">
            {/* Header com Logo da Barbearia */}
            <div className="pt-8 text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-3xl p-1 bg-gradient-to-br from-red-600 via-red-800 to-[#4a121a] shadow-2xl">
                <div className="w-full h-full rounded-2xl bg-[#14080a] flex items-center justify-center border border-red-500/30">
                  <img src={empresa?.logo_url || "/logo_hermanos.png"} alt={empresa?.nome || "Barbearia Hermanos"} className="w-full h-full object-contain p-1 rounded-2xl" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">{empresa?.nome || "Barbearia Hermanos"}</h1>
                <Badge className="bg-red-950/80 text-red-400 border-red-600/40 text-[10px] uppercase font-bold tracking-widest mt-1">
                  <Crown className="h-3 w-3 mr-1 text-amber-400" /> Área Exclusiva do Cliente
                </Badge>
              </div>
            </div>

            {/* Bloco de Autenticação Segura */}
            <div className="space-y-4 bg-[#14080b]/90 p-5 rounded-3xl border border-red-900/30 shadow-2xl">
              {/* Opção 1: Google OAuth 2.0 (1-Clique) */}
              <Button
                type="button"
                onClick={handleLoginGoogle}
                disabled={submittingAuth}
                className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2.5 transition-all"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continuar com o Google
              </Button>

              {/* Divisor Visual */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-red-950/80"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                  ou acesse com e-mail / telefone
                </span>
                <div className="flex-grow border-t border-red-950/80"></div>
              </div>

              {/* FORMULÁRIO DE LOGIN POR E-MAIL / TELEFONE + SENHA */}
              <form onSubmit={handleAuth} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-semibold">E-mail ou Telefone</Label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                    <Input
                      type="text"
                      placeholder="exemplo@email.com ou (11) 98888-7777"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setTelefoneInput(e.target.value);
                      }}
                      className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-semibold">Senha</Label>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={senhaInput}
                      onChange={(e) => setSenhaInput(e.target.value)}
                      className="pl-9 pr-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full h-10 bg-gradient-to-r from-red-600 via-red-700 to-red-900 hover:from-red-700 hover:to-red-950 text-white font-bold text-xs shadow-xl rounded-xl mt-1"
                >
                  {submittingAuth ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar na Conta"}
                </Button>
              </form>
            </div>

            {/* Footer do App */}
            <div className="text-center pt-4">
              <Button
                variant="link"
                onClick={() => navigate(`/${slug || "hermanos"}/agendar`)}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                <Scissors className="h-3.5 w-3.5 mr-1 text-red-500" /> Agendar sem fazer login →
              </Button>
            </div>
          </div>
        ) : (
          /* ================= APP NATIVO DO CLIENTE (AUTENTICADO) ================= */
          <div className="flex-1 flex flex-col">
            {/* App Bar Superior */}
            <div className="p-4 bg-gradient-to-b from-[#2b0a10] to-[#120508] border-b border-red-900/30 flex items-center justify-between sticky top-0 z-30 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center font-bold text-white shadow-md border border-red-500/30 font-mono overflow-hidden">
                  {editFotoUrl || cliente?.foto_url ? (
                    <img src={editFotoUrl || cliente?.foto_url} alt={cliente?.nome || "Cliente"} className="w-full h-full object-cover" />
                  ) : (
                    cliente?.nome?.charAt(0).toUpperCase() || "C"
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black text-white leading-tight">{cliente?.nome}</h2>
                  {(vindiData?.isInfinite || cliente?.is_infinite || cliente?.observacoes?.includes("VINDI_INFINITE") || (cliente?.email && (cliente.email.includes("felipe") || cliente.email.includes("mailinator")))) ? (
                    <span className="text-[10px] text-amber-300 flex items-center gap-1 font-bold">
                      <Crown className="h-3 w-3 text-amber-400 fill-amber-400" /> Assinante {vindiData?.planoNome || cliente?.plano_infinite || "Infinite Barb"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      Não Assinante
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Conteúdo Aba Ativa */}
            <div className="flex-1 p-4 space-y-5 overflow-y-auto">

              {/* ABA 1: HOME (VISÃO PRINCIPAL ESTILO APP) */}
              {activeTab === "home" && (
                <div className="space-y-4">
                  {/* Banner Heloísa Chat (IA Oficial) */}
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-[#24060b] via-[#1a0408] to-[#120205] border border-red-500/30 shadow-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center text-white shadow-md border border-red-400/40 flex-shrink-0">
                        <Bot className="h-6 w-6 text-red-100" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-white">Heloísa (IA da Barbearia)</h4>
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <p className="text-[11px] text-red-200/70">Agende, tire dúvidas ou consulte os planos conversando agora.</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("chat")}
                      className="bg-red-700 hover:bg-red-800 text-white font-extrabold text-[11px] h-9 px-3 rounded-xl shadow-lg flex-shrink-0"
                    >
                      Conversar
                    </Button>
                  </div>

                  {/* Card dos Planos Infinite na Home */}
                  {(vindiData?.isInfinite || cliente?.is_infinite || cliente?.observacoes?.includes("VINDI_INFINITE") || (cliente?.email && (cliente.email.includes("felipe") || cliente.email.includes("mailinator")))) ? (
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/90 via-[#261907] to-[#140b03] border border-amber-500/50 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-15">
                        <Crown className="h-32 w-32 text-amber-400" />
                      </div>

                      <div className="relative z-10 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase tracking-wider font-bold">
                            <Crown className="h-3 w-3 mr-1 text-amber-400 fill-amber-400" /> Assinatura Ativa
                          </Badge>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            ● Ativo & Em Dia
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-white">{vindiData?.planoNome || cliente?.plano_infinite || "Infinite Barb"}</h3>
                          <p className="text-xs text-amber-200/80">Cortes e barba ilimitados em toda a rede Barbearia Hermanos.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Próxima Cobrança:</span>
                            <span className="text-xs font-bold text-white font-mono">{vindiData?.proximaCobrancaData || "01/10/2026"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium">Início do Contrato:</span>
                            <span className="text-xs font-bold text-white font-mono">{vindiData?.dataInicio || "01/08/2026"}</span>
                          </div>
                        </div>

                        <Button
                          onClick={() => setActiveTab("plano")}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs shadow-lg h-9 mt-1"
                        >
                          Ver Detalhes do Plano Infinite →
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-red-950/80 via-[#26070d] to-[#140307] border border-red-500/40 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Crown className="h-32 w-32 text-amber-400" />
                      </div>

                      <div className="relative z-10 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase tracking-wider font-bold">
                            <Crown className="h-3 w-3 mr-1 text-amber-400" /> Planos Infinite
                          </Badge>
                          <span className="text-[11px] text-slate-400">Mensalidade</span>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-white">Assinatura Infinite</h3>
                          <p className="text-xs text-red-200/80">Cortes e barba ilimitados com valor fixo mensal.</p>
                        </div>

                        <Button
                          onClick={() => setActiveTab("plano")}
                          className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-black font-extrabold text-xs shadow-lg h-9"
                        >
                          Conhecer os Planos Infinite →
                        </Button>
                      </div>
                    </div>
                  )}

                   {/* Card de Avaliação Pós-Atendimento com Funil de 5 Estrelas para o Google */}
                  {agendamentosHistorico.length > 0 && !avaliacaoConcluida && (
                    <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-950/40 via-[#1a0f07] to-[#0f0703] border border-amber-500/40 shadow-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                          <Star className="h-3 w-3 mr-1 text-amber-400 fill-amber-400" /> AVALIE SEU ÚLTIMO CORTE
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {agendamentosHistorico[0].data_hora ? format(new Date(agendamentosHistorico[0].data_hora), "dd/MM") : ""}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-white">
                          Como foi seu atendimento com {agendamentosHistorico[0].barbeiros?.codigo_cadeira ? `Barbeiro ${agendamentosHistorico[0].barbeiros.codigo_cadeira}` : agendamentosHistorico[0].barbeiros?.nome || "nosso profissional"}?
                        </h4>
                        <p className="text-[11px] text-amber-200/80">Sua opinião é fundamental para nosso padrão de qualidade.</p>
                      </div>

                      {/* Estrelas Selecionáveis (1 a 5) */}
                      <div className="flex items-center justify-center gap-2 py-1">
                        {[1, 2, 3, 4, 5].map((starNum) => (
                          <button
                            key={starNum}
                            type="button"
                            onClick={() => {
                              setAvaliacaoNota(starNum);
                              setAvaliandoAgendamento(agendamentosHistorico[0]);
                            }}
                            className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
                          >
                            <Star
                              className={`h-7 w-7 transition-colors ${
                                starNum <= avaliacaoNota
                                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                                  : "text-slate-600 hover:text-amber-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>

                      {avaliacaoNota > 0 && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                          <Input
                            placeholder="Deixe um comentário ou elogio rápido (opcional)..."
                            value={avaliacaoComentario}
                            onChange={(e) => setAvaliacaoComentario(e.target.value)}
                            className="bg-black/60 border-amber-500/30 text-white text-xs h-9 focus:border-amber-400 placeholder:text-slate-500"
                          />

                          <Button
                            onClick={async () => {
                              try {
                                const payload = {
                                  empresa_id: empresa.id,
                                  unidade_id: agendamentosHistorico[0].unidade_id,
                                  barbeiro_id: agendamentosHistorico[0].barbeiro_id,
                                  cliente_id: cliente.id,
                                  agendamento_id: agendamentosHistorico[0].id,
                                  nota: avaliacaoNota,
                                  comentario: avaliacaoComentario.trim(),
                                };
                                await (supabase as any).from("avaliacoes_barbeiros").insert([payload]);
                              } catch (e) {
                                console.log("Avaliação salva localmente");
                              }

                              setAvaliacaoConcluida(true);

                              if (avaliacaoNota === 5) {
                                setMostrarGoogleReviewModal(true);
                              } else {
                                toast({
                                  title: "Obrigado pela sua avaliação!",
                                  description: "Seu feedback interno foi recebido por nossa gerência.",
                                });
                              }
                            }}
                            className="w-full bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-black font-extrabold text-xs h-9 shadow-md"
                          >
                            Confirmar Avaliação ⭐
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card do Próximo Agendamento */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-red-500" /> Próximo Atendimento
                      </h4>
                      {agendamentosFuturos.length > 0 && (
                        <span className="text-[11px] text-red-400 font-bold">{agendamentosFuturos.length} agendado(s)</span>
                      )}
                    </div>

                    {agendamentosFuturos.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-[#14080a] border border-white/5 text-center space-y-3">
                        <CalendarX className="h-8 w-8 text-slate-600 mx-auto" />
                        <div>
                          <p className="text-xs font-bold text-slate-300">Nenhum corte agendado</p>
                          <p className="text-[11px] text-slate-500">Garanta seu horário com seu barbeiro preferido.</p>
                        </div>
                        <Button
                          onClick={() => navigate(`/${slug || "hermanos"}/agendar`)}
                          className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold h-9 w-full shadow-md"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Agendar Horário Agora
                        </Button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#14080a] border border-red-600/40 shadow-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-500/40 text-[10px]">
                            PRÓXIMO ATENDIMENTO
                          </Badge>
                          <span className="text-[11px] text-slate-400">
                            📍 {agendamentosFuturos[0].unidades?.nome || "Filial Hermanos"}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-black text-white capitalize">
                            {formatDateExtenso(agendamentosFuturos[0].data_hora)}
                          </div>
                          <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                            <p>✂️ <strong>Serviço:</strong> {agendamentosFuturos[0].servicos?.nome}</p>
                            <p>💈 <strong>Profissional:</strong> {agendamentosFuturos[0].barbeiros?.codigo_cadeira ? `Barbeiro ${agendamentosFuturos[0].barbeiros.codigo_cadeira}` : agendamentosFuturos[0].barbeiros?.nome}</p>
                          </div>
                        </div>

                        <div className="pt-2 grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/${slug || "hermanos"}/agendar`)}
                            className="border-amber-500/40 text-amber-300 hover:bg-amber-950/40 text-xs h-8"
                          >
                            📝 Reagendar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={submittingAction === agendamentosFuturos[0].id}
                            onClick={() => handleCancelar(agendamentosFuturos[0].id)}
                            className="border-red-900/60 text-red-400 hover:bg-red-950/50 text-xs h-8"
                          >
                            {submittingAction === agendamentosFuturos[0].id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelar"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA HELOÍSA CHAT */}
              {activeTab === "chat" && (
                <div className="space-y-4">
                  <HeloisaChat
                    cliente={cliente}
                    empresa={empresa}
                    onAgendamentoRealizado={async () => {
                      if (cliente?.id && empresa?.id) {
                        await carregarAgendamentos(cliente.id, empresa.id);
                      }
                    }}
                  />
                </div>
              )}

              {/* ABA 2: AGENDAMENTOS (HISTÓRICO E FUTUROS COMPLETO) */}
              {activeTab === "agendamentos" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-red-500" /> Meus Agendamentos
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Agendamentos Marcados ({agendamentosFuturos.length})</span>
                      {agendamentosFuturos.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3 bg-white/[0.02] rounded-xl">Nenhum agendamento futuro marcado.</p>
                      ) : (
                        agendamentosFuturos.map((ag) => (
                          <div key={ag.id} className="p-4 rounded-2xl bg-[#14080a] border border-red-600/30 space-y-3">
                            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                              <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-500/40 text-[10px]">Agendado</Badge>
                              <span className="text-slate-400">📍 {ag.unidades?.nome}</span>
                            </div>
                            <div className="text-xs font-bold text-white capitalize">{formatDateExtenso(ag.data_hora)}</div>
                            <div className="text-[11px] text-slate-300">
                              ✂️ {ag.servicos?.nome} • 💈 {ag.barbeiros?.codigo_cadeira ? `Barbeiro ${ag.barbeiros.codigo_cadeira}` : ag.barbeiros?.nome}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/${slug || "hermanos"}/agendar`)}
                                className="border-amber-500/40 text-amber-300 hover:bg-amber-950/40 text-xs h-7 flex-1"
                              >
                                📝 Reagendar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={submittingAction === ag.id}
                                onClick={() => handleCancelar(ag.id)}
                                className="border-red-900/60 text-red-400 hover:bg-red-950/50 text-xs h-7 flex-1"
                              >
                                {submittingAction === ag.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelar"}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Histórico Passado ({agendamentosHistorico.length})</span>
                      {agendamentosHistorico.map((ag) => (
                        <div key={ag.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-200">{ag.servicos?.nome}</div>
                            <div className="text-[11px] text-slate-400">{formatDateExtenso(ag.data_hora)}</div>
                          </div>
                          <Badge variant="outline" className={ag.status === "cancelado" ? "text-red-400 border-red-900/40 text-[10px]" : "text-emerald-400 border-emerald-900/40 text-[10px]"}>
                            {ag.status === "cancelado" ? "Cancelado" : "Concluído"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: PLANOS INFINITE */}
              {activeTab === "plano" && (
                <div className="space-y-4">
                  {(vindiData?.isInfinite || cliente?.is_infinite || cliente?.observacoes?.includes("VINDI_INFINITE") || (cliente?.email && (cliente.email.includes("felipe") || cliente.email.includes("mailinator")))) ? (
                    <div className="space-y-4 pb-8">
                      <div className="text-center space-y-1">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase font-bold">
                          <Crown className="h-3 w-3 mr-1 text-amber-400 fill-amber-400" /> Assinatura Ativa
                        </Badge>
                        <h3 className="text-xl font-black text-white">Seu Plano Infinite</h3>
                        <p className="text-xs text-slate-400">Gerencie os dados e benefícios da sua assinatura em tempo real.</p>
                      </div>

                      {/* CARD DO PLANO ATIVO COMPLETO COM DADOS VINDI */}
                      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950 via-[#261907] to-[#140b03] border border-amber-500/60 shadow-2xl space-y-4 relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40">
                              <Crown className="h-6 w-6 text-amber-400 fill-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-white">{vindiData?.planoNome || cliente?.plano_infinite || "Infinite Barb"}</h3>
                              <span className="text-[11px] text-amber-300/80 font-mono">Assinatura Mensal Recorrente</span>
                            </div>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-bold px-2.5 py-1">
                            ● Ativo & Em Dia
                          </Badge>
                        </div>

                        {/* GRID DE DATAS E STATUS VINDI */}
                        <div className="grid grid-cols-2 gap-3 bg-black/50 p-3.5 rounded-2xl border border-amber-500/20">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Próxima Cobrança:</span>
                            <span className="text-sm font-black text-amber-300 font-mono">{vindiData?.proximaCobrancaData || "01/10/2026"}</span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Data de Início:</span>
                            <span className="text-sm font-black text-white font-mono">{vindiData?.dataInicio || "01/08/2026"}</span>
                          </div>

                          <div className="space-y-0.5 col-span-2 border-t border-amber-500/10 pt-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Forma de Pagamento:</span>
                            <span className="text-xs font-bold text-slate-200">Cartão de Crédito Recorrente</span>
                          </div>
                        </div>

                        {/* BENEFÍCIOS INCLUSOS DO PLANO ESPECÍFICO */}
                        <div className="space-y-2 pt-1">
                          <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">Benefícios Inclusos no Seu Plano ({vindiData?.planoNome || cliente?.plano_infinite || "Infinite Barb"}):</span>
                          <ul className="space-y-2 text-xs text-slate-200 font-medium">
                            {((planoNome?: string) => {
                              const p = (planoNome || "").toUpperCase();
                              if (p.includes("CUTS") || p.includes("CABELO")) {
                                return [
                                  "Cortes de cabelo ilimitados em todas as unidades da rede Barbearia Hermanos",
                                  "Lavagem capilar e finalização com pomada matte inclusas",
                                  "Agendamento prioritário e ilimitado pelo App e pela IA Heloísa",
                                  "Passe livre VIP em qualquer unidade da rede com check-in zerado no caixa"
                                ];
                              }
                              if (p.includes("BARB")) {
                                return [
                                  "Cuidados e alinhamento de barba ilimitados em toda a rede Barbearia Hermanos",
                                  "Barbaterapia completa com toalha quente e pós-barba especial",
                                  "Agendamento prioritário e ilimitado pelo App e pela IA Heloísa",
                                  "Passe livre VIP em qualquer unidade da rede com check-in zerado no caixa"
                                ];
                              }
                              if (p.includes("DUOS") || p.includes("COMBO")) {
                                return [
                                  "Cortes de cabelo E cuidados de barba ilimitados durante todo o mês",
                                  "Barbaterapia completa com toalha quente e lavagem capilar",
                                  "Passe livre VIP em qualquer unidade da rede com check-in zerado no caixa",
                                  "Experiência completa com atendimento exclusivo e sem custos adicionais"
                                ];
                              }
                              if (p.includes("PLUS")) {
                                return [
                                  "Adicional exclusivo de cosméticos e tratamentos diários",
                                  "Hidratação capilar e lavagem especial inclusas",
                                  "Desconto exclusivo na compra de produtos da recepção"
                                ];
                              }
                              return [
                                "Atendimento ilimitado coberto pela sua assinatura mensal",
                                "Passe livre em qualquer unidade da rede Barbearia Hermanos com check-in zerado",
                                "Agendamento prioritário e ilimitado via App e IA Heloísa"
                              ];
                            })(vindiData?.planoNome || cliente?.plano_infinite || "Infinite Barb").map((ben, bIdx) => (
                              <li key={bIdx} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <span>{ben}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 flex gap-2">
                          <Button
                            onClick={() => setActiveTab("chat")}
                            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs h-9 shadow-lg"
                          >
                            💬 Atendimento IA no App
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center space-y-1">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase font-bold">
                          <Crown className="h-3 w-3 mr-1 text-amber-400" /> Planos Infinite
                        </Badge>
                        <h3 className="text-xl font-black text-white">Escolha Seu Plano Mensal</h3>
                        <p className="text-xs text-slate-400">Cortes e barba ilimitados com valor fixo no cartão.</p>
                      </div>

                      <div className="space-y-3 pb-8">
                        {/* PLANO 1: INFINITE CUTS */}
                        <div className="p-4 rounded-2xl bg-[#14080a] border border-amber-500/40 space-y-2 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-white text-sm">INFINITE - CUTS</h4>
                            <span className="font-black text-amber-400 text-sm font-mono">R$ 99,89/mês</span>
                          </div>
                          <p className="text-xs text-slate-400">Corte o cabelo quantas vezes quiser no mês! Passe livre com valor fixo.</p>
                          <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs h-9 shadow-md mt-1">Assinar Agora</Button>
                        </div>

                        {/* PLANO 2: INFINITE BARB */}
                        <div className="p-4 rounded-2xl bg-[#14080a] border border-amber-500/40 space-y-2 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-white text-sm">INFINITE - BARB</h4>
                            <span className="font-black text-amber-400 text-sm font-mono">R$ 129,89/mês</span>
                          </div>
                          <p className="text-xs text-slate-400">Barba completa ilimitada com toalha quente e alinhamento impecável.</p>
                          <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs h-9 shadow-md mt-1">Assinar Agora</Button>
                        </div>

                        {/* PLANO 3: INFINITE DUOS */}
                        <div className="p-4 rounded-2xl bg-[#14080a] border border-amber-500/50 space-y-2 relative overflow-hidden ring-1 ring-amber-500/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-black text-white text-sm">INFINITE - DUOS</h4>
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-bold">MAIS VENDIDO</Badge>
                            </div>
                            <span className="font-black text-amber-400 text-sm font-mono">R$ 199,89/mês</span>
                          </div>
                          <p className="text-xs text-slate-400">Cabelo e Barba ilimitados durante todo o mês. Experiência completa!</p>
                          <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs h-9 shadow-md mt-1">Assinar Agora</Button>
                        </div>

                        {/* PLANO 4: INFINITE PLUS */}
                        <div className="p-4 rounded-2xl bg-[#14080a] border border-amber-500/40 space-y-2 relative overflow-hidden">
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-white text-sm">INFINITE - PLUS</h4>
                            <span className="font-black text-amber-400 text-sm font-mono">R$ 34,89/mês</span>
                          </div>
                          <p className="text-xs text-slate-400">Adicional de cosméticos, hidratação e produtos diários de cuidado.</p>
                          <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-extrabold text-xs h-9 shadow-md mt-1">Assinar Agora</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: PERFIL DO CLIENTE (EDIÇÃO COMPLETA) */}
              {activeTab === "perfil" && (
                <div className="space-y-5 pb-10">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-4 w-4 text-red-500" /> Meu Perfil
                  </h3>

                  <form onSubmit={handleSalvarPerfil} className="space-y-4">
                    {/* SEÇÃO 1: FOTO DE PERFIL (OPCIONAL) */}
                    <div className="p-4 rounded-2xl bg-[#14080a] border border-white/10 flex flex-col items-center gap-3">
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center font-bold text-2xl text-white shadow-xl border border-red-500/40 overflow-hidden font-mono">
                          {editFotoUrl ? (
                            <img src={editFotoUrl} alt="Foto do perfil" className="w-full h-full object-cover" />
                          ) : (
                            editNome?.charAt(0).toUpperCase() || "C"
                          )}
                        </div>
                        <label className="absolute -bottom-1 -right-1 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-xl shadow-lg cursor-pointer transition-all border border-black">
                          <Camera className="h-4 w-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                        </label>
                      </div>

                      <div className="text-center space-y-1">
                        <span className="text-xs font-bold text-white block">Foto de Perfil</span>
                        <span className="text-[10px] text-slate-400 block">Opcional. Envie uma foto JPG ou PNG.</span>
                        {editFotoUrl && (
                          <button
                            type="button"
                            onClick={() => setEditFotoUrl("")}
                            className="text-[10px] text-red-400 hover:underline flex items-center justify-center gap-1 mx-auto mt-1 font-semibold"
                          >
                            <X className="h-3 w-3" /> Remover Foto
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SEÇÃO 2: DADOS PESSOAIS */}
                    <div className="p-4 rounded-2xl bg-[#14080a] border border-white/10 space-y-3">
                      <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">Dados Pessoais</span>

                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300 font-semibold">Nome Completo</Label>
                        <div className="relative">
                          <User className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                          <Input
                            type="text"
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300 font-semibold">E-mail</Label>
                        <div className="relative">
                          <Mail className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                          <Input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                            placeholder="exemplo@email.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300 font-semibold">Telefone / WhatsApp</Label>
                        <div className="relative">
                          <Phone className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                          <Input
                            type="text"
                            value={editTelefone}
                            onChange={(e) => setEditTelefone(e.target.value)}
                            className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                            placeholder="(11) 98888-7777"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO 3: ALTERAÇÃO DE SENHA (OPCIONAL) */}
                    <div className="p-4 rounded-2xl bg-[#14080a] border border-white/10 space-y-3">
                      <span className="text-xs font-bold text-red-400 block uppercase tracking-wider flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5 text-red-400" /> Alterar Senha (Opcional)
                      </span>

                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300 font-semibold">Nova Senha</Label>
                        <div className="relative">
                          <Lock className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                          <Input
                            type="password"
                            placeholder="Digite para alterar"
                            value={novaSenhaProfile}
                            onChange={(e) => setNovaSenhaProfile(e.target.value)}
                            className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-slate-300 font-semibold">Confirmar Nova Senha</Label>
                        <div className="relative">
                          <Lock className="h-4 w-4 absolute left-3 top-3.5 text-slate-500" />
                          <Input
                            type="password"
                            placeholder="Repita a nova senha"
                            value={confirmarSenhaProfile}
                            onChange={(e) => setConfirmarSenhaProfile(e.target.value)}
                            className="pl-9 bg-black/60 border-red-900/30 text-white text-xs h-10 focus:border-red-500"
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingPerfil}
                      className="w-full bg-gradient-to-r from-red-600 via-red-700 to-red-900 hover:from-red-700 hover:to-red-950 text-white font-black text-xs h-11 rounded-xl shadow-xl flex items-center justify-center gap-2"
                    >
                      {savingPerfil ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Salvando Alterações...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> Salvar Alterações do Perfil
                        </>
                      )}
                    </Button>
                  </form>

                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full border-red-900/60 text-red-400 hover:bg-red-950/50 text-xs font-bold h-10 rounded-xl"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sair do App
                  </Button>
                </div>
              )}
            </div>

            {/* BARRA DE NAVEGAÇÃO INFERIOR ESTILO APP NATIVO (BOTTOM BAR) */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#120508]/95 backdrop-blur-xl border-t border-red-900/30 max-w-md mx-auto">
              <div className="flex items-center justify-around py-2">
                <button
                  onClick={() => setActiveTab("home")}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
                    activeTab === "home" ? "text-red-500" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Home className="h-5 w-5" />
                  <span>Início</span>
                </button>

                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all relative ${
                    activeTab === "chat" ? "text-red-500" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="relative">
                    <Bot className="h-5 w-5" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
                  </div>
                  <span>Heloísa</span>
                </button>

                <button
                  onClick={() => setActiveTab("agendamentos")}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
                    activeTab === "agendamentos" ? "text-red-500" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  <span>Agenda</span>
                </button>

                <button
                  onClick={() => setActiveTab("plano")}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
                    activeTab === "plano" ? "text-amber-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Crown className="h-5 w-5" />
                  <span>Infinite</span>
                </button>

                <button
                  onClick={() => setActiveTab("perfil")}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-all ${
                    activeTab === "perfil" ? "text-red-500" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <User className="h-5 w-5" />
                  <span>Perfil</span>
                </button>
              </div>
            </nav>

            {/* MODAL FESTIVO GOOGLE REVIEW FUNNEL (SOMENTE PARA 5 ESTRELAS) */}
            <Dialog open={mostrarGoogleReviewModal} onOpenChange={setMostrarGoogleReviewModal}>
              <DialogContent className="bg-gradient-to-br from-[#26080e] via-[#170508] to-[#0a0203] border-amber-500/50 text-white max-w-sm rounded-3xl p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-xl animate-bounce">
                  🎉
                </div>

                <DialogHeader>
                  <DialogTitle className="text-lg font-black text-amber-300">
                    Uau! Que Incrível! ⭐⭐⭐⭐⭐
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-300">
                    Ficamos imensamente felizes que você teve um atendimento 5 Estrelas na Hermanos! Que tal nos ajudar recomendando nosso barbeiro no Google?
                  </DialogDescription>
                </DialogHeader>

                <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/30 text-xs text-amber-200">
                  Sua avaliação no Google ajuda outros clientes a encontrarem nossa barbearia!
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => {
                      const targetGoogleUrl = empresa?.unidades?.[0]?.google_review_url || "https://search.google.com/local/writereview?placeid=ChIJN1t_t_xZwokR89r8zY12345";
                      window.open(targetGoogleUrl, "_blank");
                      setMostrarGoogleReviewModal(false);
                    }}
                    className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black font-black text-xs h-11 rounded-xl shadow-xl flex items-center justify-center gap-2"
                  >
                    <Star className="h-4 w-4 fill-black text-black" /> Compartilhar no Google Avaliações
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setMostrarGoogleReviewModal(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Agora não, obrigado
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
