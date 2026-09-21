import { useState, useEffect, useCallback, useMemo } from "react";
import { format, startOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Clock, User, Loader2, Receipt, Edit, Ban, CheckCircle, PlayCircle, XCircle, DollarSign, MessageSquare, CalendarPlus, Coffee, Move, Scissors, Sparkles, ShieldAlert, Utensils, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AgendamentoDialog } from "@/components/agenda/AgendamentoDialog";
import { BloqueioDialog } from "@/components/agenda/BloqueioDialog";
import { ComandaDialog } from "@/components/checkout/ComandaDialog";
import { AgendamentoDetalhesDrawer } from "@/components/agenda/AgendamentoDetalhesDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useHorariosFuncionamento } from "@/hooks/useHorariosFuncionamento";

interface Barbeiro { id: string; nome: string; }
interface AgendamentoServico { servico_id: string; nome: string; preco: number; duracao_minutos: number; }
interface Agendamento {
  id: string;
  cliente_id: string;
  barbeiro_id: string;
  servico_id: string;
  unidade_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes?: string;
  clientes: { nome: string; telefone?: string } | null;
  servicos: { nome: string } | null;
  servicos_adicionais?: AgendamentoServico[];
}

interface Bloqueio {
  id: string;
  barbeiro_id: string | null;
  unidade_id: string;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  motivo: string | null;
}

interface Comanda {
  id: string;
  agendamento_id: string | null;
  cliente_id: string;
  status: string;
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento: string | null;
}

interface ComandaStatusMap {
  [agendamentoId: string]: { status: string };
}

const pastHachuraStyle = {
  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 20px)",
};

const tipoBloqueioLabels: Record<string, { label: string; icon: any }> = {
  almoco: { label: "Almoço", icon: Utensils },
  falta: { label: "Falta / Ausência", icon: Ban },
  compromisso: { label: "Compromisso", icon: ShieldAlert },
};

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [comandaStatuses, setComandaStatuses] = useState<ComandaStatusMap>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bloqueioDialogOpen, setBloqueioDialogOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [agendamentoDrawer, setAgendamentoDrawer] = useState<Agendamento | null>(null);

  const [comandaDialogOpen, setComandaDialogOpen] = useState(false);
  const [selectedComanda, setSelectedComanda] = useState<Comanda | null>(null);

  const [preSelectedTime, setPreSelectedTime] = useState<string | undefined>(undefined);
  const [preSelectedBarbeiro, setPreSelectedBarbeiro] = useState<string | undefined>(undefined);
  const { selectedUnidadeId } = useUnidade();
  const { empresaId } = useEmpresa();
  const { isBarber, barbeiroId } = useUserRole();

  const [draggedAgendamento, setDraggedAgendamento] = useState<Agendamento | null>(null);
  const [now, setNow] = useState(new Date());

  const { isDayClosed, getHorariosForDate } = useHorariosFuncionamento(selectedUnidadeId);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchBarbeiros();
  }, [selectedUnidadeId, isBarber, barbeiroId]);

  useEffect(() => {
    fetchAgendamentos();
  }, [currentDate, selectedUnidadeId]);

  const fetchBarbeiros = async () => {
    let query = supabase.from("barbeiros").select("id, nome, codigo_cadeira").eq("status", "active");
    if (selectedUnidadeId) query = query.eq("unidade_id", selectedUnidadeId);
    if (isBarber && barbeiroId) query = query.eq("id", barbeiroId);
    const { data } = await query.order("codigo_cadeira", { ascending: true, nullsFirst: false });
    if (data) setBarbeiros(data as any);
  };

  const fetchAgendamentos = async () => {
    setLoading(true);
    const startOfDayDate = startOfDay(currentDate);
    const endOfDayDate = new Date(startOfDayDate);
    endOfDayDate.setHours(23, 59, 59, 999);

    let agQuery = supabase
      .from("agendamentos")
      .select(`
        id, cliente_id, barbeiro_id, servico_id, unidade_id,
        data_hora, duracao_minutos, status, observacoes,
        clientes (nome, telefone), servicos (nome)
      `)
      .gte("data_hora", startOfDayDate.toISOString())
      .lte("data_hora", endOfDayDate.toISOString())
      .neq("status", "cancelado");

    if (selectedUnidadeId) agQuery = agQuery.eq("unidade_id", selectedUnidadeId);
    if (isBarber && barbeiroId) agQuery = agQuery.eq("barbeiro_id", barbeiroId);

    // CORREÇÃO CRÍTICA: Tabela correta no Supabase 'agenda_bloqueios'
    let blQuery = supabase
      .from("agenda_bloqueios")
      .select("id, barbeiro_id, unidade_id, tipo, data_inicio, data_fim, motivo")
      .gte("data_fim", startOfDayDate.toISOString())
      .lte("data_inicio", endOfDayDate.toISOString());

    if (selectedUnidadeId) blQuery = blQuery.eq("unidade_id", selectedUnidadeId);

    const [agRes, blRes] = await Promise.all([agQuery, blQuery]);

    if (agRes.data) {
      const agList = agRes.data as unknown as Agendamento[];
      const agIds = agList.map(a => a.id);

      if (agIds.length > 0) {
        const { data: servsData } = await supabase
          .from("agendamento_servicos")
          .select("agendamento_id, servico_id, nome, preco, duracao_minutos")
          .in("agendamento_id", agIds);

        if (servsData && servsData.length > 0) {
          const servsMap: Record<string, AgendamentoServico[]> = {};
          servsData.forEach(s => {
            if (!servsMap[s.agendamento_id]) servsMap[s.agendamento_id] = [];
            servsMap[s.agendamento_id].push({
              servico_id: s.servico_id,
              nome: s.nome,
              preco: Number(s.preco),
              duracao_minutos: s.duracao_minutos,
            });
          });
          agList.forEach(a => {
            if (servsMap[a.id]) a.servicos_adicionais = servsMap[a.id];
          });
        }

        const { data: comandasData } = await supabase
          .from("comandas")
          .select("id, agendamento_id, status")
          .in("agendamento_id", agIds);

        if (comandasData) {
          const statusMap: ComandaStatusMap = {};
          comandasData.forEach(c => {
            if (c.agendamento_id) statusMap[c.agendamento_id] = { status: c.status };
          });
          setComandaStatuses(statusMap);
        }
      }

      setAgendamentos(agList);
    }

    if (blRes.data) setBloqueios(blRes.data);
    setLoading(false);
  };

  const timeSlots = useMemo(() => {
    const hInfo = getHorariosForDate(currentDate);
    const abertura = hInfo?.horario_abertura || "09:00";
    const fechamento = hInfo?.horario_fechamento || "20:00";

    const [oh, om] = abertura.split(":").map(Number);
    const [ch, cm] = fechamento.split(":").map(Number);

    const startMinutes = Math.min(oh * 60 + om, 9 * 60);
    const endMinutes = Math.max(ch * 60 + cm, 20 * 60);

    const slots: string[] = [];
    let current = startMinutes;
    while (current <= endMinutes) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      current += 30;
    }
    return slots;
  }, [currentDate, getHorariosForDate]);

  const isToday = format(currentDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
  const startMinutesOfGrid = useMemo(() => {
    if (timeSlots.length === 0) return 9 * 60;
    const [h, m] = timeSlots[0].split(":").map(Number);
    return h * 60 + m;
  }, [timeSlots]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTopPx = useMemo(() => {
    if (!isToday) return null;
    const diff = nowMinutes - startMinutesOfGrid;
    if (diff < 0) return null;
    return diff * 1.83;
  }, [isToday, nowMinutes, startMinutesOfGrid]);

  const isSlotPast = useCallback((time: string) => {
    const todayStr = format(now, "yyyy-MM-dd");
    const selectedStr = format(currentDate, "yyyy-MM-dd");

    if (selectedStr < todayStr) return true;
    if (selectedStr === todayStr) {
      const [sh, sm] = time.split(":").map(Number);
      const slotM = sh * 60 + sm;
      return slotM < nowMinutes;
    }
    return false;
  }, [currentDate, now, nowMinutes]);

  const goToPreviousDay = () => setCurrentDate(subDays(currentDate, 1));
  const goToNextDay = () => setCurrentDate(addDays(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const formatDateHeader = (date: Date) => {
    const dayOfWeek = format(date, "EEEE", { locale: ptBR });
    const formattedDate = format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    return `${dayOfWeek}, ${formattedDate}`;
  };

  const handleDragStart = (e: React.DragEvent, agendamento: Agendamento) => {
    if (isBarber) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", agendamento.id);
    setDraggedAgendamento(agendamento);
  };

  const handleDropOnSlot = async (targetTime: string, targetBarbeiroId: string) => {
    if (isBarber) {
      toast.error("Barbeiros não possuem permissão para reagendar horários.");
      return;
    }
    if (!draggedAgendamento) return;

    const [hours, minutes] = targetTime.split(":").map(Number);
    const newDate = new Date(currentDate);
    newDate.setHours(hours, minutes, 0, 0);

    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data_hora: newDate.toISOString(),
          barbeiro_id: targetBarbeiroId,
        })
        .eq("id", draggedAgendamento.id);

      if (error) throw error;
      toast.success("Agendamento reagendado com sucesso!");
      fetchAgendamentos();
    } catch (error: any) {
      toast.error(error.message || "Erro ao reagendar");
    } finally {
      setDraggedAgendamento(null);
    }
  };

  const getAppointmentForSlot = (time: string, barbeiroId: string) => {
    const [h, m] = time.split(":").map(Number);
    const slotStartMinutes = h * 60 + m;
    const slotEndMinutes = slotStartMinutes + 30;

    for (const ag of agendamentos) {
      if (ag.barbeiro_id !== barbeiroId) continue;
      const agDate = new Date(ag.data_hora);
      const agStartMinutes = agDate.getHours() * 60 + agDate.getMinutes();
      const agEndMinutes = agStartMinutes + (ag.duracao_minutos || 30);

      // O agendamento começa exatamente dentro deste bloco de 30min (ex: 19:40 começa no bloco 19:30)
      if (agStartMinutes >= slotStartMinutes && agStartMinutes < slotEndMinutes) {
        const topOffsetPx = Math.round(((agStartMinutes - slotStartMinutes) / 30) * 56);
        return { appointment: ag, isStart: true, topOffsetPx };
      }

      // O agendamento começou em bloco anterior e ainda está em andamento
      if (slotStartMinutes > agStartMinutes && slotStartMinutes < agEndMinutes) {
        return { appointment: ag, isStart: false, topOffsetPx: 0 };
      }
    }
    return null;
  };

  // DETECTAR SE O SLOT ESTÁ BLOQUEADO (TIPO ALMOÇO / FALTA / COMPROMISSO)
  const getBlockForSlot = (time: string, barbeiroId: string) => {
    const [h, m] = time.split(":").map(Number);
    const slotDate = new Date(currentDate);
    slotDate.setHours(h, m, 0, 0);
    const slotTimeMs = slotDate.getTime();

    for (const bl of bloqueios) {
      if (bl.barbeiro_id && bl.barbeiro_id !== barbeiroId) continue;

      const blStartMs = new Date(bl.data_inicio).getTime();
      const blEndMs = new Date(bl.data_fim).getTime();

      if (slotTimeMs >= blStartMs && slotTimeMs < blEndMs) {
        const isStart = slotTimeMs === blStartMs || (slotTimeMs - blStartMs < 30 * 60000);
        return { bloqueio: bl, isStart };
      }
    }
    return null;
  };

  const isSlotOutsideOperation = (time: string) => {
    const hInfo = getHorariosForDate(currentDate);
    if (!hInfo || !hInfo.aberto) return true;

    const [oh, om] = (hInfo.horario_abertura || "09:00").split(":").map(Number);
    const [ch, cm] = (hInfo.horario_fechamento || "20:00").split(":").map(Number);

    const [sh, sm] = time.split(":").map(Number);
    const slotM = sh * 60 + sm;
    const openM = oh * 60 + om;
    const closeM = ch * 60 + cm;

    return slotM < openM || slotM >= closeM;
  };

  const handleNewAgendamento = (time?: string, barbeiroId?: string) => {
    if (startOfDay(currentDate) < startOfDay(new Date())) {
      toast.error("Não é permitido criar novos agendamentos para datas passadas.");
      return;
    }
    if (startOfDay(currentDate) > addDays(startOfDay(new Date()), 7)) {
      toast.error("Agendamentos só podem ser realizados com no máximo 7 dias de antecedência.");
      return;
    }
    if (isDayClosed(currentDate)) {
      toast.error("A unidade não abre na data selecionada.");
      return;
    }
    setSelectedAgendamento(null);
    setPreSelectedTime(time);
    setPreSelectedBarbeiro(barbeiroId);
    setDialogOpen(true);
  };

  const handleStatusChange = async (agendamentoId: string, newStatus: string) => {
    if (newStatus === "concluido") {
      const targetAg = agendamentos.find((a) => a.id === agendamentoId);
      if (targetAg) {
        const { data: comandasList } = await supabase
          .from("comandas")
          .select("id, status")
          .eq("agendamento_id", agendamentoId);

        const comandaFechada = comandasList && comandasList.some((c) => c.status === "fechada");

        if (!comandaFechada) {
          toast.warning("⚠️ Comanda em Aberto: Para concluir o atendimento, é necessário fechar a comanda e quitar o pagamento.");
          handleAbrirComanda(targetAg);
          return;
        }
      }
    }

    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: newStatus })
        .eq("id", agendamentoId);

      if (error) throw error;
      toast.success(`Status alterado para ${newStatus}`);
      fetchAgendamentos();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar status");
    }
  };

  const handleAbrirComanda = async (agendamento: Agendamento) => {
    try {
      const { data: comandasList } = await supabase
        .from("comandas")
        .select("*, comanda_itens(id, nome, tipo, quantidade, preco_unitario, subtotal)")
        .eq("agendamento_id", agendamento.id)
        .order("created_at", { ascending: false });

      const comandaExistente = comandasList && comandasList.length > 0 ? comandasList[0] : null;

      // Limpar duplicatas órfãs abertas se existirem para o mesmo agendamento
      if (comandasList && comandasList.length > 1) {
        const duplicadasAbertas = comandasList.filter(c => c.id !== comandaExistente.id && c.status === "aberta").map(c => c.id);
        if (duplicadasAbertas.length > 0) {
          await supabase.from("comandas").delete().in("id", duplicadasAbertas);
        }
      }

      if (comandaExistente) {
        // Se a comanda existia mas por acaso não tinha itens, vamos auto-popular com os serviços do agendamento!
        if (!comandaExistente.comanda_itens || comandaExistente.comanda_itens.length === 0) {
          const itensToInsert: any[] = [];
          let totalVal = 0;

          if (agendamento.servico_id) {
            const { data: servPrincipal } = await supabase
              .from("servicos")
              .select("id, nome, preco")
              .eq("id", agendamento.servico_id)
              .maybeSingle();

            if (servPrincipal) {
              const pr = Number(servPrincipal.preco) || 0;
              itensToInsert.push({
                comanda_id: comandaExistente.id,
                tipo: "servico",
                servico_id: servPrincipal.id,
                nome: servPrincipal.nome,
                quantidade: 1,
                preco_unitario: pr,
                subtotal: pr,
                empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
              });
              totalVal += pr;
            }
          }

          if (agendamento.servicos_adicionais && agendamento.servicos_adicionais.length > 0) {
            agendamento.servicos_adicionais.forEach(s => {
              const pr = Number(s.preco) || 0;
              const exists = itensToInsert.some(i => i.servico_id === s.servico_id && i.nome === s.nome);
              if (!exists) {
                itensToInsert.push({
                  comanda_id: comandaExistente.id,
                  tipo: "servico",
                  servico_id: s.servico_id,
                  nome: s.nome,
                  quantidade: 1,
                  preco_unitario: pr,
                  subtotal: pr,
                  empresa_id: empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6",
                });
                totalVal += pr;
              }
            });
          }

          if (itensToInsert.length > 0) {
            await supabase.from("comanda_itens").insert(itensToInsert);
            await supabase.from("comandas").update({ subtotal: totalVal, total: totalVal }).eq("id", comandaExistente.id);
            comandaExistente.subtotal = totalVal;
            comandaExistente.total = totalVal;
          }
        }

        setSelectedComanda(comandaExistente);
        setComandaDialogOpen(true);
      } else {
        const itensToInsert: any[] = [];
        let totalBruto = 0;

        if (agendamento.servico_id) {
          const { data: servPrincipal } = await supabase
            .from("servicos")
            .select("id, nome, preco")
            .eq("id", agendamento.servico_id)
            .maybeSingle();

          if (servPrincipal) {
            const pr = Number(servPrincipal.preco) || 0;
            itensToInsert.push({
              tipo: "servico",
              servico_id: servPrincipal.id,
              nome: servPrincipal.nome,
              quantidade: 1,
              preco_unitario: pr,
              subtotal: pr,
            });
            totalBruto += pr;
          }
        }

        const servsLista = agendamento.servicos_adicionais || [];
        servsLista.forEach(s => {
          const pr = Number(s.preco) || 0;
          const exists = itensToInsert.some(i => i.servico_id === s.servico_id && i.nome === s.nome);
          if (!exists) {
            itensToInsert.push({
              tipo: "servico",
              servico_id: s.servico_id,
              nome: s.nome,
              quantidade: 1,
              preco_unitario: pr,
              subtotal: pr,
            });
            totalBruto += pr;
          }
        });

        const { data: novaComanda, error: createError } = await supabase
          .from("comandas")
          .insert({
            agendamento_id: agendamento.id,
            cliente_id: agendamento.cliente_id,
            barbeiro_id: agendamento.barbeiro_id,
            unidade_id: agendamento.unidade_id,
            empresa_id: empresaId || (agendamento as any).empresa_id || "93d24bc4-e371-4395-8ed8-636d02575de6",
            subtotal: totalBruto,
            desconto: 0,
            total: totalBruto,
            status: "aberta",
          })
          .select()
          .single();

        if (createError) throw createError;

        if (itensToInsert.length > 0) {
          const comandaItensPayload = itensToInsert.map(i => ({
            ...i,
            comanda_id: novaComanda.id,
            empresa_id: empresaId || (agendamento as any).empresa_id || "93d24bc4-e371-4395-8ed8-636d02575de6",
          }));
          await supabase.from("comanda_itens").insert(comandaItensPayload);
        }

        setSelectedComanda(novaComanda);
        setComandaDialogOpen(true);
        fetchAgendamentos();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao abrir comanda");
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <PageHeader title="Agenda & Atendimentos" description={formatDateHeader(currentDate)}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="btn-soft h-8 w-8" onClick={goToPreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="btn-soft text-xs h-8 px-3" onClick={goToToday}>Hoje</Button>
          <Button variant="outline" size="icon" className="btn-soft h-8 w-8" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isBarber && (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="btn-soft text-xs h-8" onClick={() => setBloqueioDialogOpen(true)}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Bloqueio
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 shadow-sm" onClick={() => handleNewAgendamento()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Agendamento
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-3 items-start">
        <div className="space-y-3">
          <div className="panel p-2 bg-card border border-border">
            <Calendar mode="single" selected={currentDate} onSelect={(date) => date && setCurrentDate(date)} className="rounded-md mx-auto scale-90 -m-3" />
          </div>
          <div className="panel p-3 bg-card border border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total do Dia</h3>
            <div className="text-xl font-black text-foreground mt-0.5">{agendamentos.length} atendimentos</div>
          </div>
        </div>

        <div className="panel overflow-hidden p-2 bg-card border border-border">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-max">
                <div className="grid border-b border-border/40" style={{ gridTemplateColumns: `50px repeat(${barbeiros.length}, 1fr)` }}>
                  <div className="p-2 text-xs font-bold text-muted-foreground bg-card sticky left-0 z-20">Hora</div>
                  {barbeiros.map((barbeiro: any) => (
                    <div key={barbeiro.id} className="p-2 text-center border-l border-border/40 min-w-[170px] flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-950 text-white flex items-center justify-center font-mono font-black text-sm shadow-md border border-red-500/40 tracking-wider">
                        {barbeiro.codigo_cadeira || barbeiro.nome.charAt(0)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="max-h-[calc(100vh-210px)] overflow-y-auto relative">
                  {nowTopPx !== null && (
                    <div
                      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                      style={{ top: `${nowTopPx}px` }}
                    >
                      <div className="bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-40">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {format(now, "HH:mm")}
                      </div>
                      <div className="flex-1 h-[2px] bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    </div>
                  )}

                  {timeSlots.map((time) => {
                    const isOutside = isSlotOutsideOperation(time);
                    const isPast = isSlotPast(time);

                    return (
                      <div key={time} className="grid border-b border-border/30" style={{ gridTemplateColumns: `50px repeat(${barbeiros.length}, 1fr)` }}>
                        <div className={cn("p-1.5 text-[11px] font-medium flex items-start justify-end pr-2 bg-card sticky left-0 z-20", isPast ? "text-muted-foreground/70 font-normal" : "text-muted-foreground")}>
                          {time}
                        </div>
                        {barbeiros.map((barbeiro) => {
                          const slotResult = getAppointmentForSlot(time, barbeiro.id);
                          const appointment = slotResult?.appointment || null;
                          const isStartSlot = slotResult?.isStart ?? false;

                          const blockResult = !appointment ? getBlockForSlot(time, barbeiro.id) : null;
                          const bloqueio = blockResult?.bloqueio || null;
                          const isBlockStart = blockResult?.isStart ?? false;

                          const canClickNew = !appointment && !bloqueio && !isPast && !isOutside && !isBarber;
                          const isShortSlot = (appointment?.duracao_minutos || 30) <= 30;

                          return (
                            <div
                              key={`${time}-${barbeiro.id}`}
                              style={!appointment && !bloqueio && (isPast || isOutside) ? pastHachuraStyle : undefined}
                              className={cn(
                                "h-14 border-l border-border/30 p-0.5 relative group min-w-[170px] transition-colors",
                                canClickNew ? "hover:bg-accent/40 cursor-pointer" : "cursor-not-allowed",
                                !appointment && !bloqueio && isPast && "bg-slate-200/40 dark:bg-slate-900/40"
                              )}
                              onDragOver={(e) => canClickNew && e.preventDefault()}
                              onDrop={() => canClickNew && handleDropOnSlot(time, barbeiro.id)}
                              onClick={() => canClickNew && handleNewAgendamento(time, barbeiro.id)}
                            >
                              {/* RENDERIZAÇÃO DE BLOQUEIO DE AGENDA (ALMOÇO / FALTA / COMPROMISSO) */}
                              {bloqueio && isBlockStart && (
                                <div className="absolute inset-x-0.5 top-0.5 z-20 p-2 rounded-xl bg-slate-900/90 text-amber-400 border border-amber-500/40 shadow-sm flex flex-col justify-between overflow-hidden">
                                  <div className="flex items-center gap-1.5">
                                    <Ban className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    <span className="font-extrabold text-xs text-amber-300 truncate">
                                      {tipoBloqueioLabels[bloqueio.tipo]?.label || "Agenda Bloqueada"}
                                    </span>
                                  </div>
                                  {bloqueio.motivo && (
                                    <p className="text-[10px] text-muted-foreground italic truncate">{bloqueio.motivo}</p>
                                  )}
                                  <div className="text-[9px] font-bold text-amber-500/80">
                                    {format(new Date(bloqueio.data_inicio), "HH:mm")} - {format(new Date(bloqueio.data_fim), "HH:mm")}
                                  </div>
                                </div>
                              )}

                              {/* RENDERIZAÇÃO DO CARD LUXO VINHO HERMANOS ENCAIXADO NO SLOT */}
                              {appointment && isStartSlot && (
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, appointment)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAgendamentoDrawer(appointment);
                                    setDrawerOpen(true);
                                  }}
                                  className={cn(
                                    "absolute inset-x-0.5 top-0.5 z-20 rounded-xl cursor-pointer shadow-lg transition-all duration-200 hover:scale-[1.02] border flex flex-col justify-between overflow-hidden group",
                                    (appointment.duracao_minutos || 30) <= 30 ? "p-1.5" : "p-2",
                                    appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                      ? "bg-gradient-to-br from-amber-950/90 via-amber-900/60 to-[#1c1404] border-amber-500/60 text-amber-100 shadow-amber-950/30"
                                      : appointment.status === "concluido"
                                      ? "bg-gradient-to-br from-emerald-950/90 via-emerald-900/60 to-[#06170e] border-emerald-500/60 text-emerald-100 shadow-emerald-950/30"
                                      : "bg-gradient-to-br from-[#3b0d14] via-[#24060b] to-[#120305] border-red-500/50 text-foreground"
                                  )}
                                  style={{
                                    top: `${(slotResult?.topOffsetPx || 0) + 2}px`,
                                    height: `${Math.max(48, Math.round(((appointment.duracao_minutos || 30) / 30) * 56) - 4)}px`,
                                  }}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <Move className="h-3 w-3 text-muted-foreground/70 group-hover:text-amber-400 transition-colors shrink-0 cursor-grab" />
                                        <div className={cn(
                                          "w-4.5 h-4.5 rounded-full text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm border",
                                          appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                            ? "bg-gradient-to-r from-amber-500 to-amber-700 border-amber-400/40"
                                            : appointment.status === "concluido"
                                            ? "bg-gradient-to-r from-emerald-600 to-emerald-800 border-emerald-400/40"
                                            : "bg-gradient-to-r from-red-600 to-red-800 border-red-400/30"
                                        )}>
                                          {appointment.clientes?.nome?.charAt(0).toUpperCase() || "C"}
                                        </div>
                                        <span className="font-extrabold text-xs text-white truncate">
                                          {appointment.clientes?.nome || "Cliente"}
                                        </span>
                                      </div>
                                      <Badge variant="outline" className={cn(
                                        "text-[9px] font-extrabold px-1.5 py-0 bg-black/60 shrink-0 border",
                                        appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                          ? "border-amber-500/50 text-amber-300"
                                          : appointment.status === "concluido"
                                          ? "border-emerald-500/50 text-emerald-300"
                                          : "border-red-500/50 text-red-300"
                                      )}>
                                        {(() => {
                                          const d = new Date(appointment.data_hora);
                                          const isEncaixe = d.getMinutes() % 30 !== 0 || d.getHours() >= 20;
                                          return (
                                            <span className="flex items-center gap-0.5">
                                              {isEncaixe && <Zap className="h-2.5 w-2.5 text-amber-400" />}
                                              {format(d, "HH:mm")}
                                            </span>
                                          );
                                        })()}
                                      </Badge>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <Badge className={cn(
                                        "bg-black/60 text-[9.5px] font-bold py-0.5 px-1.5 flex items-center gap-1 shadow-sm w-full truncate border",
                                        appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                          ? "border-amber-500/40 text-amber-100"
                                          : appointment.status === "concluido"
                                          ? "border-emerald-500/40 text-emerald-100"
                                          : "border-red-500/40 text-slate-200"
                                      )}>
                                        <Scissors className={cn(
                                          "h-2.5 w-2.5 shrink-0",
                                          appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                            ? "text-amber-400"
                                            : appointment.status === "concluido"
                                            ? "text-emerald-400"
                                            : "text-red-500"
                                        )} />
                                        <span className="truncate">{appointment.servicos?.nome || "Corte de Cabelo"}</span>
                                      </Badge>
                                    </div>
                                  </div>

                                  {(appointment.duracao_minutos || 30) > 30 && (
                                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40 mt-0.5">
                                      <span className={cn(
                                        "font-semibold flex items-center gap-1",
                                        appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                          ? "text-amber-400"
                                          : appointment.status === "concluido"
                                          ? "text-emerald-400"
                                          : "text-red-400"
                                      )}>
                                        <Clock className="h-3 w-3" /> {appointment.duracao_minutos} min
                                      </span>
                                      <span className={cn(
                                        "font-bold underline text-[9px] group-hover:translate-x-0.5 transition-transform",
                                        appointment.status === "confirmado" || appointment.status === "em_atendimento"
                                          ? "text-amber-300"
                                          : appointment.status === "concluido"
                                          ? "text-emerald-300"
                                          : "text-red-400"
                                      )}>
                                        Ver Detalhes →
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AgendamentoDetalhesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        agendamento={agendamentoDrawer}
        barbeirosList={barbeiros}
        onEdit={(ag) => {
          setSelectedAgendamento(ag);
          setDialogOpen(true);
        }}
        onStatusChange={handleStatusChange}
        onAbrirComanda={handleAbrirComanda}
      />

      <AgendamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agendamento={selectedAgendamento}
        preSelectedTime={preSelectedTime}
        preSelectedBarbeiro={preSelectedBarbeiro}
        selectedDate={currentDate}
        currentDate={currentDate}
        onSuccess={fetchAgendamentos}
      />

      <BloqueioDialog
        open={bloqueioDialogOpen}
        onOpenChange={setBloqueioDialogOpen}
        currentDate={currentDate}
        onSuccess={fetchAgendamentos}
      />

      <ComandaDialog
        open={comandaDialogOpen}
        onOpenChange={setComandaDialogOpen}
        comanda={selectedComanda}
        onSuccess={fetchAgendamentos}
      />
    </div>
  );
}
