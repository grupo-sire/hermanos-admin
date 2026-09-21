import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { 
  Calendar as CalendarIcon, Clock, User, MapPin, ShoppingBag, Check, ChevronLeft, ChevronRight, 
  Loader2, Package, Search, Plus, Minus, Trash2, Building2,
  Instagram, MessageCircle, Phone, Globe, Sparkles, CheckCircle2, Scissors, ShieldCheck, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getLabels } from "@/lib/estabelecimento-labels";
import { applyThemeColors } from "@/lib/theme-palettes";
import { useAvailability } from "@/hooks/useAvailability";
import { useHorariosFuncionamento } from "@/hooks/useHorariosFuncionamento";
import { Badge } from "@/components/ui/badge";

interface EmpresaPublic {
  id: string;
  nome: string;
  logo_url: string | null;
  capa_url: string | null;
  tema_publico: "light" | "dark";
  links_adicionais: Array<{ label: string; url: string; icon: string }>;
  tipo_estabelecimento: string;
  cor_primaria: string;
  permitir_escolha_profissional: boolean;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  endereco?: string | null;
  telefone?: string | null;
}

interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  telefone: string | null;
  horario_abertura: string;
  horario_fechamento: string;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
  descricao: string | null;
  categoria: string | null;
}

interface Barbeiro {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  categoria: string | null;
  estoque: number;
}

interface HorarioFuncionamento {
  dia_semana: number;
  aberto: boolean;
  horario_abertura: string;
  horario_fechamento: string;
}

type Step = "unidade" | "servico" | "profissional" | "horario" | "produtos" | "dados" | "confirmado";

export default function AgendarPublico() {
  const [empresa, setEmpresa] = useState<EmpresaPublic | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [horarios, setHorarios] = useState<HorarioFuncionamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<Step>("unidade");
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [selectedServicos, setSelectedServicos] = useState<Servico[]>([]);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<Barbeiro | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteNascimento, setClienteNascimento] = useState("");
  const [clienteEncontrado, setClienteEncontrado] = useState<{ id: string; nome: string; email: string | null; data_nascimento: string | null } | null>(null);
  const [clienteLogado, setClienteLogado] = useState<any>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [modoNovoCliente, setModoNovoCliente] = useState(false);
  const [busyData, setBusyData] = useState<{ appointments: any[]; blocks: any[] }>({ appointments: [], blocks: [] });

  const { fetchBusySlots, isProfessionalAvailable } = useAvailability();

  const navigate = useNavigate();
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const slug = routeSlug || searchParams.get("s") || "hermanos";

  useEffect(() => {
    loadInitialData();
  }, [slug]);

  async function loadInitialData() {
    if (!slug) return;
    setLoading(true);

    const { data: empData, error: empError } = await supabase
      .from("empresas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (empError || !empData) {
      setLoading(false);
      toast.error("Empresa não encontrada");
      return;
    }

    const currentEmpresa = empData as any;
    setEmpresa({
      id: currentEmpresa.id,
      nome: currentEmpresa.nome,
      logo_url: currentEmpresa.logo_url,
      capa_url: currentEmpresa.capa_url,
      tema_publico: (currentEmpresa.tema_publico as "light" | "dark") || "dark",
      links_adicionais: currentEmpresa.links_adicionais || [],
      tipo_estabelecimento: currentEmpresa.tipo_estabelecimento || "barbearia",
      cor_primaria: currentEmpresa.cor_primaria || "350 65% 33%",
      permitir_escolha_profissional: currentEmpresa.permitir_escolha_profissional ?? true,
      whatsapp: currentEmpresa.whatsapp,
      instagram: currentEmpresa.instagram,
      facebook: currentEmpresa.facebook,
      endereco: currentEmpresa.endereco,
      telefone: currentEmpresa.telefone,
    });
    
    applyThemeColors(currentEmpresa.cor_primaria || "350 65% 33%");

    // Verificar se há um cliente já logado no App
    const savedClienteId = localStorage.getItem(`hermanos_cliente_id_${currentEmpresa.id}`);
    if (savedClienteId) {
      const { data: cliLogado } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", savedClienteId)
        .maybeSingle();

      if (cliLogado) {
        setClienteLogado(cliLogado);
        setClienteEncontrado(cliLogado);
        setClienteNome(cliLogado.nome);
        setClienteTelefone(cliLogado.telefone || "");
        setClienteEmail(cliLogado.email || "");
      }
    }

    const [uniRes, servRes, prodRes] = await Promise.all([
      supabase.from("unidades").select("*").eq("empresa_id", currentEmpresa.id).eq("status", "active").order("nome"),
      supabase.from("servicos").select("*").eq("empresa_id", currentEmpresa.id).eq("status", "active").order("nome"),
      supabase.from("produtos").select("*").eq("empresa_id", currentEmpresa.id).eq("status", "active").order("nome"),
    ]);

    if (uniRes.data) setUnidades(uniRes.data);
    if (servRes.data) setServicos(servRes.data);
    if (prodRes.data) setProdutos(prodRes.data);

    if (uniRes.data && uniRes.data.length === 1) {
      setSelectedUnidade(uniRes.data[0]);
      setStep("servico");
      loadBarbeiros(uniRes.data[0].id, currentEmpresa.id);
      loadHorarios(uniRes.data[0].id, currentEmpresa.id);
    }

    setLoading(false);
  }

  async function loadBarbeiros(unidadeId: string, empresaId: string) {
    const { data } = await supabase
      .from("barbeiros")
      .select("id, nome, avatar_url, codigo_cadeira")
      .eq("empresa_id", empresaId)
      .eq("status", "active")
      .eq("unidade_id", unidadeId)
      .order("codigo_cadeira", { ascending: true, nullsFirst: false });
    if (data) setBarbeiros(data as any);
  }

  async function loadHorarios(unidadeId: string, empresaId: string) {
    const { data } = await supabase
      .from("horarios_funcionamento")
      .select("dia_semana, aberto, horario_abertura, horario_fechamento")
      .eq("empresa_id", empresaId)
      .eq("unidade_id", unidadeId);
    if (data) setHorarios(data);
  }

  function selectUnidade(u: Unidade) {
    if (!empresa?.id) return;
    setSelectedUnidade(u);
    setStep("servico");
    loadBarbeiros(u.id, empresa.id);
    loadHorarios(u.id, empresa.id);
  }

  useEffect(() => {
    if (selectedDate && empresa?.id) {
      fetchBusySlots(selectedDate, empresa.id, selectedUnidade?.id).then(setBusyData);
    }
  }, [selectedDate, empresa?.id, selectedUnidade?.id, fetchBusySlots]);

  const buscarClientePorTelefone = useCallback(async (telefone: string) => {
    if (telefone.length < 10) {
      setClienteEncontrado(null);
      return;
    }
    setBuscandoCliente(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, email, data_nascimento")
      .eq("telefone", telefone)
      .maybeSingle();
    if (data) {
      setClienteEncontrado(data);
      setClienteNome(data.nome);
      setClienteEmail(data.email || "");
      setClienteNascimento(data.data_nascimento || "");
      setModoNovoCliente(false);
    } else {
      setClienteEncontrado(null);
    }
    setBuscandoCliente(false);
  }, []);

  function toggleServico(s: Servico) {
    setSelectedServicos((prev) =>
      prev.find((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
    );
  }

  function nextFromServico() {
    if (selectedServicos.length === 0) return toast.error("Selecione ao menos um serviço");
    if (empresa?.permitir_escolha_profissional) {
      setStep("profissional");
    } else {
      setStep("horario");
    }
  }

  const totalPreco = selectedServicos.reduce((a, s) => a + s.preco, 0);
  const totalDuracao = selectedServicos.reduce((a, s) => a + s.duracao_minutos, 0);
  const { isDayClosed, getHorariosForDate } = useHorariosFuncionamento(selectedUnidade?.id || null);

  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    const maxLimitDate = addDays(new Date(), 7); // Janela limite estrita de 7 dias

    for (let i = 0; i < 8; i++) {
      const d = addDays(today, i);
      if (startOfDay(d) <= startOfDay(maxLimitDate) && !isDayClosed(d)) {
        dates.push(d);
      }
    }
    return dates;
  }, [selectedUnidade, isDayClosed]);

  // GENERATE TIME SLOTS COM FILTRO DE HORÁRIOS PASSADOS, LIMITE DE 7 DIAS E BLOQUEIOS DA AGENDA
  const timeSlots = useMemo(() => {
    if (!selectedDate || !selectedUnidade || !empresa) return [];
    if (isDayClosed(selectedDate)) return [];

    const h = getHorariosForDate(selectedDate);
    if (!h || !h.aberto) return [];

    const [oh, om] = (h.horario_abertura || "09:00").split(":").map(Number);
    const [ch, cm] = (h.horario_fechamento || "20:00").split(":").map(Number);

    const isToday = startOfDay(selectedDate).getTime() === startOfDay(new Date()).getTime();
    const now = new Date();
    const currentNowMinutes = now.getHours() * 60 + now.getMinutes();

    // Limite de 7 dias exatos (hora a hora)
    const limit7Days = addDays(now, 7);
    const isExact7thDay = startOfDay(selectedDate).getTime() === startOfDay(limit7Days).getTime();
    const limit7thDayMinutes = limit7Days.getHours() * 60 + limit7Days.getMinutes();

    const slots: string[] = [];
    let current = oh * 60 + om;
    const end = ch * 60 + cm;

    while (current + totalDuracao <= end) {
      if (isToday && current <= currentNowMinutes + 15) {
        current += 30;
        continue;
      }
      if (isExact7thDay && current > limit7thDayMinutes) {
        current += 30;
        continue;
      }

      const hh = String(Math.floor(current / 60)).padStart(2, "0");
      const mm = String(current % 60).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;

      const isAvailable = barbeiros.some(b => 
        isProfessionalAvailable(timeStr, selectedDate, totalDuracao, b.id, busyData)
      );

      if (isAvailable) {
        if (selectedBarbeiro) {
          if (isProfessionalAvailable(timeStr, selectedDate, totalDuracao, selectedBarbeiro.id, busyData)) {
            slots.push(timeStr);
          }
        } else {
          slots.push(timeStr);
        }
      }
      current += 30;
    }
    return slots;
  }, [selectedDate, selectedUnidade, horarios, totalDuracao, barbeiros, busyData, isProfessionalAvailable, selectedBarbeiro, empresa]);

  async function handleSubmit() {
    if (!clienteTelefone.trim() || (!clienteEncontrado && !clienteNome.trim())) return toast.error("Preencha seus dados");
    if (!selectedUnidade || selectedServicos.length === 0 || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    try {
      let clienteId: string;

      if (clienteEncontrado) {
        clienteId = clienteEncontrado.id;
      } else {
        const insertPayload: any = {
          nome: clienteNome.trim(),
          telefone: clienteTelefone.trim(),
          empresa_id: empresa!.id,
        };
        if (clienteEmail.trim()) insertPayload.email = clienteEmail.trim();
        if (clienteNascimento) insertPayload.data_nascimento = clienteNascimento;

        const { data: newC, error } = await supabase
          .from("clientes")
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        clienteId = newC.id;
      }

      let barbeiroId = selectedBarbeiro?.id;
      if (!barbeiroId) {
        const availableProfs = barbeiros.filter(b => 
          isProfessionalAvailable(selectedTime, selectedDate, totalDuracao, b.id, busyData)
        );
        if (availableProfs.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableProfs.length);
          barbeiroId = availableProfs[randomIndex].id;
        } else {
          barbeiroId = barbeiros[0]?.id;
        }
      }

      const [h, m] = selectedTime.split(":").map(Number);
      const dataHoraObj = new Date(selectedDate);
      dataHoraObj.setHours(h, m, 0, 0);

      // --- TRAVA ESTRITA DE NEGÓCIO: 1 AGENDAMENTO ATIVO POR CLIENTE (LIBERAÇÃO SÓ APÓS CHECKOUT) ---
      const agoraIso = new Date().toISOString();
      const { data: agsAtivos } = await supabase
        .from("agendamentos")
        .select("id, data_hora, unidades(nome)")
        .eq("cliente_id", clienteId)
        .eq("status", "agendado")
        .gte("data_hora", agoraIso)
        .order("data_hora", { ascending: true })
        .limit(1);

      if (agsAtivos && agsAtivos.length > 0) {
        const agExistente = agsAtivos[0];
        const dataExistenteFmt = new Date(agExistente.data_hora).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        toast.error(
          `Você já possui um agendamento ativo (${dataExistenteFmt}). Pela nossa política, você só pode agendar o próximo corte após o checkout na recepção!`,
          { duration: 7000 }
        );
        setSubmitting(false);
        return;
      }

      const { data: agData, error: agErr } = await supabase
        .from("agendamentos")
        .insert({
          empresa_id: empresa!.id,
          unidade_id: selectedUnidade.id,
          cliente_id: clienteId,
          barbeiro_id: barbeiroId,
          servico_id: selectedServicos[0].id,
          data_hora: dataHoraObj.toISOString(),
          duracao_minutos: totalDuracao,
          preco: Number(totalPreco) || 0,
          status: "agendado",
        })
        .select("id")
        .single();

      if (agErr) throw agErr;

      if (selectedServicos.length > 1) {
        const addItems = selectedServicos.slice(1).map(s => ({
          agendamento_id: agData.id,
          servico_id: s.id,
          nome: s.nome,
          preco: s.preco,
          duracao_minutos: s.duracao_minutos,
        }));
        await supabase.from("agendamento_servicos").insert(addItems);
      }

      setStep("confirmado");
      toast.success("Agendamento realizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao agendar: " + (err.message || "Tente novamente"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0709] flex flex-col items-center justify-center text-white">
        <Loader2 className="h-10 w-10 animate-spin text-red-600 mb-3" />
        <p className="text-xs text-red-500 font-bold uppercase tracking-widest animate-pulse">Barbearia Hermanos</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0709] text-slate-100 flex flex-col items-center selection:bg-red-600 selection:text-white">
      {/* Dynamic Cover & Brand Banner - PALETA 100% VINHO E VERMELHO HERMANOS */}
      <header className="w-full max-w-4xl relative overflow-hidden rounded-b-3xl border-b border-red-600/30 shadow-2xl bg-gradient-to-b from-[#2b0a10] via-[#1a0508] to-[#0d0709]">
        <div className="h-44 sm:h-56 w-full relative bg-gradient-to-r from-[#4a121a] via-[#6b1622] to-[#1a0508] flex items-center justify-center">
          {empresa?.capa_url ? (
            <img src={empresa.capa_url} alt="Capa" className="w-full h-full object-cover opacity-50 mix-blend-overlay" />
          ) : (
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#801c2b_1px,transparent_1px)] [background-size:16px_16px]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0709] via-[#0d0709]/50 to-transparent" />
        </div>

        {/* Floating Profile Card */}
        <div className="relative px-6 pb-6 -mt-16 flex flex-col sm:flex-row items-center sm:items-end gap-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-1 bg-gradient-to-br from-red-600 via-red-800 to-[#581c25] shadow-2xl shrink-0 backdrop-blur-md">
            <div className="w-full h-full rounded-xl bg-[#140a0c] overflow-hidden flex items-center justify-center border border-red-500/30">
              <img src={empresa?.logo_url || "/logo_hermanos.png"} alt={empresa?.nome || "Barbearia Hermanos"} className="w-full h-full object-contain p-1" />
            </div>
          </div>

          <div className="text-center sm:text-left flex-1 space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{empresa?.nome}</h1>
              <Badge className="bg-red-950/60 text-red-400 border-red-600/40 text-[10px] uppercase font-bold tracking-wider">
                <ShieldCheck className="h-3 w-3 mr-1" /> Barbearia Hermanos
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-red-200/70 font-medium">
              {selectedUnidade ? `📍 ${selectedUnidade.nome} – ${selectedUnidade.endereco}` : "Sua experiência de corte & barba impecável"}
            </p>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="w-full max-w-4xl px-4 py-6 space-y-6">
        {step !== "confirmado" && (
          <div className="p-4 bg-[#170c0f]/90 backdrop-blur-xl rounded-2xl border border-red-600/20 shadow-xl space-y-4">
            {/* Stepper Status Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-2">
              <span className="flex items-center gap-1.5 text-red-500 font-bold">
                <Sparkles className="h-4 w-4" /> Passo a Passo
              </span>
              <span>
                Etapa <strong className="text-white">{step === "unidade" ? 1 : step === "servico" ? 2 : step === "profissional" ? 3 : step === "horario" ? 4 : 5}</strong> de 5
              </span>
            </div>

            {/* Stepper Dots */}
            <div className="grid grid-cols-5 gap-1.5">
              {["unidade", "servico", "profissional", "horario", "dados"].map((s, idx) => {
                const currentIdx = ["unidade", "servico", "profissional", "horario", "dados"].indexOf(step);
                const isDone = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isDone
                        ? "bg-gradient-to-r from-red-600 to-[#7c1a28] shadow-sm"
                        : isCurrent
                        ? "bg-red-600 ring-2 ring-red-600/40 shadow-lg shadow-red-600/30 animate-pulse"
                        : "bg-slate-900"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* VITRINE HERO BANNERS (PUBLICADOS NO PAINEL DE MARKETING - SUPORTA TEXTO OU ARTE VISUAL) */}
        {(() => {
          let bannersList: any[] = [];
          try {
            const salvos = localStorage.getItem("HERMANOS_VITRINE_BANNERS");
            if (salvos) bannersList = JSON.parse(salvos);
          } catch (e) {}

          const bannerAtivo = bannersList?.[0] || {
            tipo: "texto",
            titulo: "Planos Infinite - Cortes de Cabelo Ilimitados",
            subtitulo: "Ande sempre na régua pagando uma mensalidade fixa no cartão. Escolha seu plano e garanta o passe livre!",
            badge: "PROMOÇÃO EXCLUSIVA"
          };

          return (
            <div className="mb-6 rounded-2xl bg-gradient-to-r from-zinc-950 via-[#170c0f] to-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden relative group">
              {bannerAtivo.tipo === "imagem" && bannerAtivo.imagemUrl ? (
                <div className="relative w-full h-44 sm:h-52 overflow-hidden bg-zinc-900 flex items-center justify-center">
                  <img src={bannerAtivo.imagemUrl} alt={bannerAtivo.titulo} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent flex items-end p-4">
                    {bannerAtivo.titulo && <span className="font-bold text-sm text-zinc-100 drop-shadow-md">{bannerAtivo.titulo}</span>}
                  </div>
                </div>
              ) : (
                <div className="p-6 md:p-7 space-y-2">
                  <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                      🔥 {bannerAtivo.badge || "PROMOÇÃO EXCLUSIVA"}
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] font-bold">
                      👑 PLANOS INFINITE
                    </Badge>
                  </div>
                  <h3 className="font-extrabold text-lg text-zinc-100 tracking-tight">
                    {bannerAtivo.titulo}
                  </h3>
                  {bannerAtivo.subtitulo && (
                    <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                      {bannerAtivo.subtitulo}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10">
                    <span className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-400" /> A partir de R$ 99,89/mês
                    </span>
                    <Button size="sm" onClick={() => navigate("/hermanos/clientes")} className="h-9 px-4 text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold gap-1.5 rounded-xl shadow-lg">
                      <Sparkles className="h-3.5 w-3.5" /> Conhecer os Planos
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* STEP 1: UNIDADE */}
        {step === "unidade" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Selecione a Unidade Hermanos</h2>
              <p className="text-xs text-slate-400">Escolha a barbearia mais próxima de você</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {unidades.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUnidade(u)}
                  className="p-5 rounded-2xl bg-gradient-to-br from-[#170c0f] to-[#12080a] hover:from-[#251014] hover:to-[#170c0f] border border-red-600/20 hover:border-red-600/60 text-left transition-all group duration-300 shadow-lg hover:scale-[1.02] flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-white group-hover:text-red-400 transition-colors flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-red-500" /> {u.nome}
                      </h3>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-red-400 transform group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-slate-400 flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                      {u.endereco}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-emerald-400" /> {u.horario_abertura?.slice(0, 5)}h - {u.horario_fechamento?.slice(0, 5)}h
                    </span>
                    <span className="text-red-500 font-bold group-hover:underline">Agendar Aqui</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SERVIÇOS */}
        {step === "servico" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Escolha os Serviços</h2>
                <p className="text-xs text-slate-400">Você pode selecionar mais de um serviço</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => setStep("unidade")}>
                Trocar Unidade
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {servicos.map((s) => {
                const isSelected = !!selectedServicos.find((x) => x.id === s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleServico(s)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "bg-gradient-to-br from-[#4a121a] to-[#1a0609] border-red-600/80 ring-2 ring-red-600/30 shadow-xl"
                        : "bg-[#170c0f]/80 hover:bg-[#201014] border-white/10"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-sm text-white">{s.nome}</h3>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected ? "bg-red-600 border-red-600 text-white" : "border-slate-700 bg-slate-950"
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      {s.descricao && <p className="text-xs text-slate-400 line-clamp-2">{s.descricao}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" /> {s.duracao_minutos} min
                      </span>
                      <strong className="text-base font-black text-red-400">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.preco)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedServicos.length > 0 && (
              <div className="p-4 bg-[#1a080b]/90 backdrop-blur-xl rounded-2xl border border-red-600/40 flex items-center justify-between gap-4 sticky bottom-4 shadow-2xl">
                <div>
                  <span className="text-xs text-slate-400 block">{selectedServicos.length} serviço(s) • {totalDuracao} min</span>
                  <strong className="text-lg font-black text-red-400">
                    Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPreco)}
                  </strong>
                </div>
                <Button className="btn-wine px-6 h-11 rounded-xl text-sm font-bold shadow-lg" onClick={nextFromServico}>
                  Avançar <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PROFISSIONAL */}
        {step === "profissional" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Preferência de Barbeiro</h2>
                <p className="text-xs text-slate-400">Escolha o profissional ou deixe em "Qualquer um livre"</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => setStep("servico")}>
                Voltar
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => { setSelectedBarbeiro(null); setStep("horario"); }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                  selectedBarbeiro === null
                    ? "bg-[#4a121a]/60 border-red-600/80 ring-2 ring-red-600/20"
                    : "bg-[#170c0f]/80 hover:bg-[#201014] border-white/10"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-lg border border-red-600/30">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Sem Preferência</h3>
                  <p className="text-xs text-slate-400">Qualquer barbeiro disponível no horário</p>
                </div>
              </div>

              {barbeiros.map((b) => (
                <div
                  key={b.id}
                  onClick={() => { setSelectedBarbeiro(b); setStep("horario"); }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedBarbeiro?.id === b.id
                      ? "bg-[#4a121a]/60 border-red-600/80 ring-2 ring-red-600/20"
                      : "bg-[#170c0f]/80 hover:bg-[#201014] border-white/10"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-950 overflow-hidden flex items-center justify-center border border-red-500/40 shrink-0 shadow-md">
                    {b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.nome} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-extrabold text-white text-base font-mono">
                        {(b as any).codigo_cadeira || b.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {(b as any).codigo_cadeira ? `Profissional ${(b as any).codigo_cadeira}` : `Profissional ${b.nome}`}
                    </h3>
                    <p className="text-xs text-slate-400">Atendimento Padrão Hermanos</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: DATA & HORÁRIO */}
        {step === "horario" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Escolha a Data e Horário</h2>
                <p className="text-xs text-slate-400">Horários passados e horários bloqueados não são exibidos</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => setStep(empresa?.permitir_escolha_profissional ? "profissional" : "servico")}>
                Voltar
              </Button>
            </div>

            {/* Carrossel de Datas */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Dias Disponíveis</label>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {availableDates.map((d) => {
                  const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => { setSelectedDate(d); setSelectedTime(null); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[70px] border transition-all shrink-0 ${
                        isSelected
                          ? "bg-gradient-to-b from-red-600 to-red-800 text-white font-bold border-red-500 shadow-lg scale-105"
                          : "bg-[#170c0f]/80 hover:bg-[#201014] text-slate-300 border-white/10"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold opacity-80">{format(d, "EEE", { locale: ptBR })}</span>
                      <span className="text-lg font-black">{format(d, "dd")}</span>
                      <span className="text-[9px] opacity-80">{format(d, "MMM", { locale: ptBR })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grade de Horários Validados */}
            {selectedDate && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Horários Livres para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </label>

                {timeSlots.length === 0 ? (
                  <div className="p-8 text-center bg-[#170c0f]/60 rounded-2xl border border-white/5 text-red-400/80 text-xs font-medium">
                    ⚠️ Sem horários disponíveis para esta data. Selecione outro dia acima.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {timeSlots.map((time) => {
                      const isSelected = selectedTime === time;
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 scale-105"
                              : "bg-[#170c0f]/80 hover:bg-[#201014] text-white border-white/10"
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          {time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedTime && (
              <div className="flex justify-end pt-4">
                <Button className="btn-wine px-8 h-12 rounded-xl text-sm font-bold shadow-xl" onClick={() => setStep("dados")}>
                  Avançar para Identificação <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: SEUS DADOS & CONFIRMAÇÃO */}
        {step === "dados" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Confirmação de Dados</h2>
                <p className="text-xs text-slate-400">Informe seu WhatsApp para garantir o agendamento</p>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-slate-400" onClick={() => setStep("horario")}>
                Voltar
              </Button>
            </div>

            {/* Card Resumo do Agendamento */}
            <div className="p-4 bg-[#1a080b]/90 rounded-2xl border border-red-600/40 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Resumo da sua Reserva
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Unidade:</span>
                  <strong className="text-white">{selectedUnidade?.nome}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Data e Hora:</span>
                  <strong className="text-red-400">
                    {selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}h
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Serviço(s):</span>
                  <strong className="text-white">{selectedServicos.map(s => s.nome).join(", ")}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Valor Total:</span>
                  <strong className="text-emerald-400 text-sm">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalPreco)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Formulário de Identificação ou Card de Cliente Logado */}
            {clienteLogado ? (
              <div className="p-5 bg-[#170c0f]/90 rounded-2xl border border-red-600/40 space-y-4 shadow-xl">
                <div className="p-4 bg-gradient-to-r from-[#2b0a10] to-[#17080b] border border-red-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 font-bold text-white flex items-center justify-center text-sm shadow-md font-mono">
                      {clienteLogado.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Agendando como {clienteLogado.nome}</h4>
                      <p className="text-[11px] text-red-200/70">📱 {clienteLogado.telefone || clienteLogado.email}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-500/40 text-[10px]">
                    SESSÃO ATIVA
                  </Badge>
                </div>

                <Button
                  className="w-full h-12 btn-wine rounded-xl text-base font-bold shadow-2xl mt-2"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Agendamento"}
                </Button>
              </div>
            ) : (
              <div className="p-5 bg-[#170c0f]/80 rounded-2xl border border-white/10 space-y-4">
                <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-300">Já possui conta no App Hermanos?</span>
                  <Button
                    variant="link"
                    onClick={() => navigate(`/${slug}/cliente`)}
                    className="text-red-400 font-bold p-0 h-auto hover:text-red-300"
                  >
                    Fazer Login →
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">WhatsApp / Celular *</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={clienteTelefone}
                    onChange={(e) => {
                      setClienteTelefone(e.target.value);
                      buscarClientePorTelefone(e.target.value);
                    }}
                    className="input-dark text-sm h-11"
                  />
                </div>

                {buscandoCliente ? (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando cadastro...
                  </div>
                ) : clienteEncontrado ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-medium">
                    ✨ Cliente cadastrado: <strong>{clienteEncontrado.nome}</strong>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Seu Nome Completo *</Label>
                      <Input
                        placeholder="Ex: Carlos Silva"
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        className="input-dark text-sm h-11"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">E-mail (opcional)</Label>
                      <Input
                        placeholder="seu@email.com"
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        className="input-dark text-sm h-11"
                      />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full h-12 btn-wine rounded-xl text-base font-bold shadow-2xl mt-4"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar Agendamento"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: CONFIRMADO */}
        {step === "confirmado" && (
          <div className="p-8 bg-[#170c0f]/90 rounded-3xl border border-emerald-500/40 text-center space-y-6 animate-fade-in shadow-2xl">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 animate-bounce">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">Agendamento Confirmado!</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Seu agendamento foi registrado com sucesso na Barbearia Hermanos. Esperamos por você!
              </p>
            </div>

            <div className="p-4 bg-black/60 rounded-2xl border border-white/10 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-slate-400">Unidade:</span>
                <strong className="text-white">{selectedUnidade?.nome}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data & Hora:</span>
                <strong className="text-red-400">{selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}h</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Serviços:</span>
                <strong className="text-white">{selectedServicos.map(s => s.nome).join(", ")}</strong>
              </div>
            </div>

            <Button
              className="btn-wine px-8 h-11 rounded-xl text-sm font-bold shadow-xl"
              onClick={() => { setStep("unidade"); setSelectedServicos([]); setSelectedDate(null); setSelectedTime(null); }}
            >
              Fazer Novo Agendamento
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
