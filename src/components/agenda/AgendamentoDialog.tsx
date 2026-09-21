import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, AlertTriangle, UserPlus, Plus, X, Search, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useHorariosFuncionamento } from "@/hooks/useHorariosFuncionamento";
import { ClienteDialog } from "@/components/clientes/ClienteDialog";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAvailability } from "@/hooks/useAvailability";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

const formSchema = z.object({
  cliente_id: z.string().min(1, "Selecione um cliente"),
  barbeiro_id: z.string().min(1, "Selecione um profissional"),
  servico_id: z.string().min(1, "Selecione um serviço"),
  unidade_id: z.string().min(1, "Selecione uma unidade"),
  data: z.date({ required_error: "Selecione uma data" }),
  hora: z.string().min(1, "Selecione um horário"),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Cliente { id: string; nome: string; telefone: string; email?: string; observacoes?: string; }
interface Barbeiro { id: string; nome: string; }
interface Servico { id: string; nome: string; preco: number; duracao_minutos: number; }
interface Unidade { id: string; nome: string; }

interface Agendamento {
  id: string;
  cliente_id: string;
  barbeiro_id: string;
  servico_id: string;
  unidade_id: string;
  data_hora: string;
  observacoes?: string;
}

interface AgendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento?: Agendamento | null;
  onSuccess: () => void;
  selectedDate?: Date;
  currentDate?: Date;
  preSelectedTime?: string;
  preSelectedBarbeiro?: string;
}

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "19:40", "19:45", "19:50", "20:00", "20:15", "20:30",
];

export function AgendamentoDialog({
  open, onOpenChange, agendamento, onSuccess, selectedDate, currentDate, preSelectedTime, preSelectedBarbeiro,
}: AgendamentoDialogProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [servicosAdicionais, setServicosAdicionais] = useState<Servico[]>([]);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");
  const [isCustomTime, setIsCustomTime] = useState(false);
  const { selectedUnidadeId } = useUnidade();
  const { empresaId, labels } = useEmpresa();
  const { isBarber, isSuperAdmin } = useUserRole();
  const [busyData, setBusyData] = useState<{ appointments: any[]; blocks: any[] }>({ appointments: [], blocks: [] });
  const { fetchBusySlots, isProfessionalAvailable } = useAvailability();

  useEffect(() => {
    if (!isSuperAdmin) {
      const targetUnidadeId = selectedUnidadeId || (unidades.length > 0 ? unidades[0].id : "");
      if (targetUnidadeId && form.getValues("unidade_id") !== targetUnidadeId) {
        form.setValue("unidade_id", targetUnidadeId);
      }
    }
  }, [selectedUnidadeId, unidades, isSuperAdmin]);

  useEffect(() => {
    if (open && isBarber) {
      toast.error("Barbeiros não possuem permissão para criar ou editar agendamentos.");
      onOpenChange(false);
    }
  }, [open, isBarber]);

  const isEditing = !!agendamento;
  const activeDate = selectedDate || currentDate || new Date();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cliente_id: "",
      barbeiro_id: "",
      servico_id: "",
      unidade_id: selectedUnidadeId || "",
      data: activeDate,
      hora: "",
      observacoes: "",
    },
  });

  const watchedUnidadeId = form.watch("unidade_id");
  const watchedData = form.watch("data");
  const watchedBarbeiroId = form.watch("barbeiro_id");
  const watchedServicoId = form.watch("servico_id");
  const watchedClienteId = form.watch("cliente_id");

  const { isDayClosed, getHorariosForDate } = useHorariosFuncionamento(watchedUnidadeId);

  // Auto-seleção do serviço principal com base no Plano Infinite do Cliente
  useEffect(() => {
    if (watchedClienteId && clientes.length > 0 && servicos.length > 0 && !isEditing) {
      const clienteSel = clientes.find((c) => c.id === watchedClienteId);
      if (clienteSel && clienteSel.observacoes && clienteSel.observacoes.includes("VINDI_INFINITE")) {
        const obs = clienteSel.observacoes.toLowerCase();
        let matchingServico = null;
        if (obs.includes("duos")) {
          matchingServico = servicos.find((s) => s.nome.toLowerCase().includes("duos"));
        } else if (obs.includes("barb")) {
          matchingServico = servicos.find((s) => s.nome.toLowerCase().includes("barb") && !s.nome.toLowerCase().includes("duos") && !s.nome.toLowerCase().includes("barbaterapia"));
        } else if (obs.includes("cuts")) {
          matchingServico = servicos.find((s) => s.nome.toLowerCase().includes("cuts"));
        } else if (obs.includes("plus")) {
          matchingServico = servicos.find((s) => s.nome.toLowerCase().includes("plus"));
        }

        if (matchingServico) {
          form.setValue("servico_id", matchingServico.id);
          toast({
            title: "Plano Infinite Detectado 👑",
            description: `Serviço do plano selecionado automaticamente: ${matchingServico.nome}`,
          });
        }
      }
    }
  }, [watchedClienteId, clientes, servicos, isEditing]);

  useEffect(() => {
    if (watchedServicoId && servicos.length > 0) {
      const found = servicos.find((s) => s.id === watchedServicoId);
      setSelectedServico(found || null);
    }
  }, [watchedServicoId, servicos]);

  useEffect(() => {
    if (watchedData && empresaId) {
      fetchBusySlots(watchedData, empresaId, watchedUnidadeId).then(setBusyData);
    }
  }, [watchedData, empresaId, watchedUnidadeId, fetchBusySlots]);

  const totalDuracao = (selectedServico?.duracao_minutos || 0) + servicosAdicionais.reduce((sum, s) => sum + s.duracao_minutos, 0);
  const totalPreco = (selectedServico?.preco || 0) + servicosAdicionais.reduce((sum, s) => sum + s.preco, 0);

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  useEffect(() => {
    if (open && watchedUnidadeId) {
      fetchBarbeirosForUnidade(watchedUnidadeId);
    }
  }, [open, watchedUnidadeId]);

  useEffect(() => {
    if (open) {
      setServicosAdicionais([]);
      if (agendamento) {
        const dataHora = new Date(agendamento.data_hora);
        const isOddMinute = dataHora.getMinutes() !== 0 && dataHora.getMinutes() !== 30;
        if (isOddMinute || dataHora.getHours() >= 20) setIsCustomTime(true);
        form.reset({
          cliente_id: agendamento.cliente_id,
          barbeiro_id: agendamento.barbeiro_id,
          servico_id: agendamento.servico_id,
          unidade_id: agendamento.unidade_id,
          data: dataHora,
          hora: format(dataHora, "HH:mm"),
          observacoes: agendamento.observacoes || "",
        });

        loadServicosConsolidados(agendamento.id, agendamento.servico_id);
      } else {
        form.reset({
          cliente_id: "",
          barbeiro_id: preSelectedBarbeiro || "",
          servico_id: "",
          unidade_id: selectedUnidadeId || (unidades.length > 0 ? unidades[0].id : ""),
          data: activeDate,
          hora: preSelectedTime || "",
          observacoes: "",
        });
      }
    }
  }, [open, agendamento, selectedDate, currentDate, selectedUnidadeId, preSelectedTime, preSelectedBarbeiro]);

  const loadServicosConsolidados = async (agendamentoId: string, primaryServicoId?: string) => {
    const [agServsRes, comandaRes] = await Promise.all([
      supabase.from("agendamento_servicos").select("servico_id, nome, preco, duracao_minutos").eq("agendamento_id", agendamentoId),
      supabase.from("comandas").select("id").eq("agendamento_id", agendamentoId).maybeSingle()
    ]);

    let comandaItensRes: any[] = [];
    if (comandaRes.data) {
      const { data: cItens } = await supabase
        .from("comanda_itens")
        .select("servico_id, nome, preco_unitario")
        .eq("comanda_id", comandaRes.data.id)
        .eq("tipo", "servico");
      if (cItens) comandaItensRes = cItens;
    }

    const mapServicos = new Map<string, Servico>();

    if (agServsRes.data) {
      agServsRes.data.forEach(d => {
        if (d.servico_id && d.servico_id !== primaryServicoId) {
          mapServicos.set(d.servico_id, {
            id: d.servico_id,
            nome: d.nome,
            preco: Number(d.preco),
            duracao_minutos: d.duracao_minutos || 30,
          });
        }
      });
    }

    if (comandaItensRes) {
      comandaItensRes.forEach(c => {
        if (c.servico_id && c.servico_id !== primaryServicoId && !mapServicos.has(c.servico_id)) {
          const servMatch = servicos.find(s => s.id === c.servico_id);
          mapServicos.set(c.servico_id, {
            id: c.servico_id,
            nome: c.nome,
            preco: Number(c.preco_unitario),
            duracao_minutos: servMatch?.duracao_minutos || 30,
          });
        }
      });
    }

    if (agendamento?.observacoes) {
      const obsLower = agendamento.observacoes.toLowerCase();
      servicos.forEach(s => {
        const servNomeLower = s.nome.toLowerCase();
        if (s.id !== primaryServicoId && !mapServicos.has(s.id)) {
          if (servNomeLower.includes("sobrancelha") && obsLower.includes("sobrancelha")) {
            mapServicos.set(s.id, s);
          } else if (servNomeLower.includes("hidratação") && obsLower.includes("hidratação")) {
            mapServicos.set(s.id, s);
          } else if (servNomeLower.includes("depilação") && obsLower.includes("depilação")) {
            mapServicos.set(s.id, s);
          } else if (servNomeLower.includes("barbaterapia") && obsLower.includes("barbaterapia")) {
            mapServicos.set(s.id, s);
          }
        }
      });
    }

    setServicosAdicionais(Array.from(mapServicos.values()));
  };

  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";

  const fetchData = async () => {
    const [clientesRes, servicosRes, unidadesRes] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, email, observacoes").eq("empresa_id", defaultEmpresaId).order("nome"),
      supabase.from("servicos").select("id, nome, preco, duracao_minutos").eq("empresa_id", defaultEmpresaId).eq("status", "active").order("nome"),
      supabase.from("unidades").select("id, nome").eq("empresa_id", defaultEmpresaId).eq("status", "active").order("nome"),
    ]);

    if (clientesRes.data) setClientes(clientesRes.data);
    if (servicosRes.data) setServicos(servicosRes.data);
    if (unidadesRes.data) setUnidades(unidadesRes.data);
  };

  const fetchBarbeirosForUnidade = async (unidadeId: string) => {
    const { data } = await supabase
      .from("barbeiros")
      .select("id, nome")
      .eq("status", "active")
      .eq("unidade_id", unidadeId)
      .order("nome");

    if (data) {
      setBarbeiros(data);
      const currentBarbeiro = form.getValues("barbeiro_id");
      if (currentBarbeiro && !data.find(b => b.id === currentBarbeiro)) {
        form.setValue("barbeiro_id", "");
      }
    }
  };

  const handleAddServicoAdicional = (servicoId: string) => {
    if (!servicoId) return;
    if (servicoId === watchedServicoId) {
      toast({ title: "Atenção", description: "Este serviço já é o principal.", variant: "destructive" });
      return;
    }
    if (servicosAdicionais.some(s => s.id === servicoId)) {
      toast({ title: "Atenção", description: "Serviço já adicionado.", variant: "destructive" });
      return;
    }
    const found = servicos.find(s => s.id === servicoId);
    if (found) {
      setServicosAdicionais(prev => [...prev, found]);
    }
  };

  const handleRemoveServicoAdicional = (servicoId: string) => {
    setServicosAdicionais(prev => prev.filter(s => s.id !== servicoId));
  };

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const [hours, minutes] = data.hora.split(":").map(Number);
      const dataHora = new Date(data.data);
      dataHora.setHours(hours, minutes, 0, 0);

      // --- TRAVA DE SEGURANÇA: IMPEDIR AGENDAMENTOS EM DIAS FECHADOS ---
      if (isDayClosed(data.data)) {
        toast({
          title: "Unidade Fechada nesta data",
          description: "A unidade selecionada não funciona no dia escolhido. Por favor, escolha outra data.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // --- TRAVA DE SEGURANÇA: IMPEDIR AGENDAMENTOS ALÉM DO LIMITE DE 7 DIAS ---
      const now = new Date();
      const limit7Days = addDays(startOfDay(now), 7);
      limit7Days.setHours(23, 59, 59, 999);

      if (!isEditing && dataHora.getTime() > limit7Days.getTime()) {
        toast({
          title: "Limite de Antecedência (7 Dias)",
          description: "Agendamentos só podem ser realizados com no máximo 7 dias de antecedência.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // --- TRAVA ESTRIFA DE SEGURANÇA: IMPEDIR AGENDAMENTOS NO PASSADO ---
      if (!isEditing && dataHora.getTime() < now.getTime() - 60000) {
        toast({
          title: "Horário Inválido (Passado)",
          description: "Não é permitido criar novos agendamentos para datas ou horários que já passaram.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const servicoPrincipal = servicos.find(s => s.id === data.servico_id);
      const precoPrincipal = Number(servicoPrincipal?.preco || 0);
      const precoAdicionais = servicosAdicionais.reduce((acc, s) => acc + Number(s.preco), 0);
      const totalPrecoCalculado = precoPrincipal + precoAdicionais;

      // --- CHECAGEM RIGOROSA DE BLOQUEIO DE AGENDA ---
      const startAgendamentoMs = dataHora.getTime();
      const endAgendamentoMs = startAgendamentoMs + totalDuracao * 60000;

      const selectedDateObj = new Date(data.data);
      const startOfDayIso = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 0, 0, 0).toISOString();
      const endOfDayIso = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate(), 23, 59, 59).toISOString();

      const { data: bloqueiosAtivos } = await supabase
        .from("agenda_bloqueios")
        .select("id, barbeiro_id, tipo, data_inicio, data_fim, motivo")
        .gte("data_fim", startOfDayIso)
        .lte("data_inicio", endOfDayIso);

      if (bloqueiosAtivos && bloqueiosAtivos.length > 0) {
        const colideBloqueio = bloqueiosAtivos.find(bl => {
          if (bl.barbeiro_id && bl.barbeiro_id !== data.barbeiro_id) return false;

          const blStartMs = new Date(bl.data_inicio).getTime();
          const blEndMs = new Date(bl.data_fim).getTime();

          return Math.max(startAgendamentoMs, blStartMs) < Math.min(endAgendamentoMs, blEndMs);
        });

        if (colideBloqueio) {
          const tipoLabel = colideBloqueio.tipo === "almoco" ? "Almoço" : colideBloqueio.tipo === "falta" ? "Ausência / Falta" : "Compromisso";
          const horaInicioBloq = format(new Date(colideBloqueio.data_inicio), "HH:mm");
          const horaFimBloq = format(new Date(colideBloqueio.data_fim), "HH:mm");

          toast({
            title: "⚠️ Horário Indisponível (Agenda Bloqueada)",
            description: `O barbeiro selecionado possui um bloqueio de ${tipoLabel} registrado entre ${horaInicioBloq} e ${horaFimBloq}. Escolha outro horário ou remova o bloqueio primeiro!`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const agendamentoData: any = {
        cliente_id: data.cliente_id,
        barbeiro_id: data.barbeiro_id,
        servico_id: data.servico_id,
        unidade_id: data.unidade_id,
        data_hora: dataHora.toISOString(),
        duracao_minutos: totalDuracao,
        preco: totalPrecoCalculado,
        observacoes: data.observacoes || null,
        empresa_id: defaultEmpresaId,
      };

      if (isEditing && agendamento) {
        const { error } = await supabase
          .from("agendamentos")
          .update(agendamentoData)
          .eq("id", agendamento.id);

        if (error) throw error;

        await supabase.from("agendamento_servicos").delete().eq("agendamento_id", agendamento.id);

        if (servicosAdicionais.length > 0) {
          const payload = servicosAdicionais.map(s => ({
            agendamento_id: agendamento.id,
            servico_id: s.id,
            nome: s.nome,
            preco: s.preco,
            duracao_minutos: s.duracao_minutos,
          }));
          await supabase.from("agendamento_servicos").insert(payload);
        }

        const { data: comanda } = await supabase
          .from("comandas")
          .select("id")
          .eq("agendamento_id", agendamento.id)
          .maybeSingle();

        if (comanda) {
          const mainServ = servicos.find(s => s.id === data.servico_id);
          if (mainServ) {
            await supabase.from("comanda_itens").delete().eq("comanda_id", comanda.id).eq("tipo", "servico");

            const comandaServsPayload = [
              {
                comanda_id: comanda.id,
                tipo: "servico",
                servico_id: mainServ.id,
                nome: mainServ.nome,
                quantidade: 1,
                preco_unitario: Number(mainServ.preco),
                subtotal: Number(mainServ.preco),
              },
              ...servicosAdicionais.map(s => ({
                comanda_id: comanda.id,
                tipo: "servico",
                servico_id: s.id,
                nome: s.nome,
                quantidade: 1,
                preco_unitario: Number(s.preco),
                subtotal: Number(s.preco),
              }))
            ];

            await supabase.from("comanda_itens").insert(comandaServsPayload);
          }
        }

        toast({ title: "Sucesso", description: "Agendamento e comanda sincronizados!" });
      } else {
        agendamentoData.status = "agendado";
        const { data: newAg, error } = await supabase
          .from("agendamentos")
          .insert(agendamentoData)
          .select()
          .single();

        if (error) throw error;

        if (servicosAdicionais.length > 0 && newAg) {
          const payload = servicosAdicionais.map(s => ({
            agendamento_id: newAg.id,
            servico_id: s.id,
            nome: s.nome,
            preco: s.preco,
            duracao_minutos: s.duracao_minutos,
          }));
          await supabase.from("agendamento_servicos").insert(payload);
        }

        if (newAg) {
          const mainServ = servicos.find(s => s.id === data.servico_id);
          const subtotalComanda = totalPreco;

          const { data: newComanda } = await supabase
            .from("comandas")
            .insert({
              agendamento_id: newAg.id,
              cliente_id: data.cliente_id,
              barbeiro_id: data.barbeiro_id,
              unidade_id: data.unidade_id,
              status: "aberta",
              subtotal: subtotalComanda,
              desconto: 0,
              total: subtotalComanda,
              empresa_id: defaultEmpresaId,
            })
            .select()
            .single();

          if (newComanda && mainServ) {
            const comandaServsPayload = [
              {
                comanda_id: newComanda.id,
                tipo: "servico",
                servico_id: mainServ.id,
                nome: mainServ.nome,
                quantidade: 1,
                preco_unitario: Number(mainServ.preco),
                subtotal: Number(mainServ.preco),
              },
              ...servicosAdicionais.map(s => ({
                comanda_id: newComanda.id,
                tipo: "servico",
                servico_id: s.id,
                nome: s.nome,
                quantidade: 1,
                preco_unitario: Number(s.preco),
                subtotal: Number(s.preco),
              }))
            ];

            await supabase.from("comanda_itens").insert(comandaServsPayload);
          }
        }

        toast({ title: "Sucesso", description: "Agendamento criado com sucesso!" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao salvar agendamento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const selectedClienteObj = clientes.find(c => c.id === form.watch("cliente_id"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] bg-card border-white/[0.08] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-bold">
            {isEditing ? "Editar Agendamento" : "Novo Agendamento"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Cliente */}
            <FormField control={form.control} name="cliente_id" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Cliente</FormLabel>
                <div className="flex gap-2">
                  <Popover open={clienteSearchOpen} onOpenChange={setClienteSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className="w-full justify-between input-dark text-xs font-normal">
                          {selectedClienteObj ? `${selectedClienteObj.nome} (${selectedClienteObj.telefone})` : "Selecione o cliente..."}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." value={clienteSearch} onValueChange={setClienteSearch} />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientes.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome} ${c.telefone}`}
                                onSelect={() => {
                                  form.setValue("cliente_id", c.id);
                                  setClienteSearchOpen(false);
                                }}
                              >
                                {c.nome} - {c.telefone}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button type="button" variant="outline" size="icon" className="shrink-0 btn-soft" onClick={() => setClienteDialogOpen(true)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Unidade & Barbeiro */}
            {isSuperAdmin ? (
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="unidade_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-foreground">Unidade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark text-xs">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="barbeiro_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-foreground">Barbeiro</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark text-xs">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {barbeiros.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            ) : (
              <FormField control={form.control} name="barbeiro_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-foreground">Barbeiro</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-dark text-xs">
                        <SelectValue placeholder="Selecione o profissional..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {barbeiros.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Serviço Principal */}
            <FormField control={form.control} name="servico_id" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Serviço Principal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="input-dark text-xs">
                      <SelectValue placeholder="Selecione o serviço..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {servicos.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Serviços Adicionais */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Serviços Adicionais</Label>
              <div className="flex gap-2">
                <Select onValueChange={handleAddServicoAdicional} value="">
                  <SelectTrigger className="input-dark text-xs flex-1">
                    <SelectValue placeholder="+ Adicionar serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.filter(s => s.id !== watchedServicoId && !servicosAdicionais.some(sa => sa.id === s.id)).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {servicosAdicionais.length > 0 && (
                <div className="space-y-1 pt-1">
                  {servicosAdicionais.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg border border-white/5 text-xs">
                      <span className="font-medium text-foreground">{s.nome} ({s.duracao_minutos}min)</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">R$ {s.preco.toFixed(2)}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => handleRemoveServicoAdicional(s.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo de Tempo e Preço */}
            <div className="p-3 bg-secondary/20 rounded-xl border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4 text-red-400" />
                <span>Total: <strong>{totalDuracao} min</strong></span>
              </div>
              <div className="font-black text-emerald-400 text-sm">
                R$ {totalPreco.toFixed(2)}
              </div>
            </div>

            {/* Data e Horário */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="data" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold text-foreground">Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-between input-dark text-xs">
                          {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione..."}
                          <CalendarIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(d) => d < startOfDay(new Date()) || d > addDays(startOfDay(new Date()), 7) || isDayClosed(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="hora" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-bold text-foreground">Horário</FormLabel>
                    <button
                      type="button"
                      onClick={() => setIsCustomTime(!isCustomTime)}
                      className={cn(
                        "text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all",
                        isCustomTime
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Zap className="h-2.5 w-2.5 text-amber-500" />
                      {isCustomTime ? "Modo Encaixe Ativo" : "⚡ Encaixe / Horário Picado"}
                    </button>
                  </div>

                  {isCustomTime ? (
                    <div className="space-y-2 animate-fade-in">
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value}
                          onChange={field.onChange}
                          className="input-dark text-xs font-bold h-9 bg-background border-amber-500/50"
                        />
                      </FormControl>
                      
                      {/* Sugestões rápidas de tolerância e encaixe após 19h30 */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Tolerâncias & Encaixes Rápidos:</span>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { label: "19:40 (+10m)", val: "19:40" },
                            { label: "19:45 (+15m)", val: "19:45" },
                            { label: "19:50 (+20m)", val: "19:50" },
                            { label: "20:00", val: "20:00" },
                            { label: "20:15", val: "20:15" },
                            { label: "20:30", val: "20:30" },
                          ].map((t) => (
                            <button
                              key={t.val}
                              type="button"
                              onClick={() => field.onChange(t.val)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all",
                                field.value === t.val
                                  ? "bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-sm"
                                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-dark text-xs">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {timeSlots.map((time) => {
                          const isEncaixe = time.includes("19:40") || time.includes("19:45") || time.includes("19:50") || time.startsWith("20:");
                          return (
                            <SelectItem key={time} value={time} className="text-xs">
                              {time} {isEncaixe && "⚡ (Encaixe Gerente)"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Observações */}
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Observações (opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Alguma observação..." className="input-dark text-xs h-16" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-xs border-white/10">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="btn-wine text-xs font-bold">
                {loading ? "Salvar" : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>

        <ClienteDialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen} onSuccess={fetchData} />
      </DialogContent>
    </Dialog>
  );
}
