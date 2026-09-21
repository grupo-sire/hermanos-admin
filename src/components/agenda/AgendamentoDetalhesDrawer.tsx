import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Calendar as CalendarIcon, Clock, User, Scissors, DollarSign, MessageCircle, Edit, Trash2, CheckCircle2, PlayCircle, XCircle, ShoppingBag, Phone, Sparkles, ExternalLink, Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

interface AgendamentoServico {
  servico_id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
}

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
  barbeiros?: { nome: string } | null;
}

interface AgendamentoDetalhesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  barbeirosList: { id: string; nome: string }[];
  onEdit: (agendamento: Agendamento) => void;
  onStatusChange: (agendamentoId: string, status: string) => void;
  onAbrirComanda: (agendamento: Agendamento) => void;
}

export function AgendamentoDetalhesDrawer({
  open,
  onOpenChange,
  agendamento,
  barbeirosList,
  onEdit,
  onStatusChange,
  onAbrirComanda,
}: AgendamentoDetalhesDrawerProps) {
  const { isBarber } = useUserRole();

  if (!agendamento) return null;

  const barbeiroObj = barbeirosList.find((b) => b.id === agendamento.barbeiro_id);
  const barbeiroNome = barbeiroObj?.nome || (agendamento.barbeiros as any)?.nome || "Profissional";

  const agDate = new Date(agendamento.data_hora);
  const dataFormatada = format(agDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const horaInicio = format(agDate, "HH:mm");

  const fimDate = new Date(agDate.getTime() + (agendamento.duracao_minutos || 30) * 60000);
  const horaFim = format(fimDate, "HH:mm");

  const servicosLista: { nome: string; preco: number; duracao: number }[] = [];

  if (agendamento.servicos_adicionais && agendamento.servicos_adicionais.length > 0) {
    agendamento.servicos_adicionais.forEach((s) => {
      servicosLista.push({
        nome: s.nome,
        preco: Number(s.preco),
        duracao: s.duracao_minutos || 30,
      });
    });
  } else if (agendamento.servicos?.nome) {
    servicosLista.push({
      nome: agendamento.servicos.nome,
      preco: Number(agendamento.preco) || Number((agendamento.servicos as any)?.preco) || 0,
      duracao: agendamento.duracao_minutos || (agendamento.servicos as any)?.duracao_minutos || 30,
    });
  }

  const valorTotalServicos = servicosLista.reduce((acc, s) => acc + s.preco, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "agendado":
        return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 text-xs py-1"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>;
      case "confirmado":
      case "em_atendimento":
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 text-xs py-1"><PlayCircle className="h-3 w-3 mr-1 text-amber-500" /> Em Atendimento</Badge>;
      case "concluido":
        return <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-xs py-1"><CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Concluído</Badge>;
      case "cancelado":
        return <Badge className="bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/40 text-xs py-1"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenWhatsApp = () => {
    if (!agendamento.clientes?.telefone) {
      toast.error("Telefone do cliente não cadastrado.");
      return;
    }
    const cleanPhone = agendamento.clientes.telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${agendamento.clientes.nome}, confirmamos seu agendamento na Barbearia Hermanos para ${format(agDate, "dd/MM 'às' HH:mm")} com o profissional ${barbeiroNome}.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto bg-background text-foreground border-l border-border p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          <SheetHeader className="pb-4 border-b border-border text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-700 via-red-900 to-black text-white flex items-center justify-center font-black text-lg shadow-md border border-red-500/30">
                  {agendamento.clientes?.nome?.charAt(0).toUpperCase() || "C"}
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-foreground">
                    {agendamento.clientes?.nome || "Cliente"}
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {agendamento.clientes?.telefone || "Telefone não informado"}
                  </SheetDescription>
                </div>
              </div>

              {agendamento.clientes?.telefone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenWhatsApp}
                  className="text-xs h-8 border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 font-bold px-2.5"
                >
                  <MessageCircle className="h-4 w-4 mr-1 text-emerald-600 dark:text-emerald-400" /> WhatsApp
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status do Atendimento</span>
              {getStatusBadge(agendamento.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/50">
              <div>
                <span className="text-muted-foreground font-semibold">Profissional / Barbeiro:</span>
                <p className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <Scissors className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> {barbeiroNome}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground font-semibold">Horário Previsto:</span>
                <p className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> {horaInicio} - {horaFim} ({agendamento.duracao_minutos || 30} min)
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-medium pt-1">
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> {dataFormatada}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Scissors className="h-4 w-4 text-red-600 dark:text-red-400" /> Serviços Agendados ({servicosLista.length})
              </Label>
              <Badge variant="outline" className="text-[11px] font-bold border-border">
                {agendamento.duracao_minutos || 30} min no total
              </Badge>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-background divide-y divide-border">
              {servicosLista.map((s, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{s.nome}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{s.duracao} min de atendimento</p>
                    </div>
                  </div>
                  {s.preco > 0 && (
                    <span className="font-black text-foreground">R$ {s.preco.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>

            {valorTotalServicos > 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">Valor Total dos Serviços:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-base">R$ {valorTotalServicos.toFixed(2)}</span>
              </div>
            )}
          </div>

          {agendamento.observacoes && (
            <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs space-y-1">
              <span className="font-bold text-muted-foreground uppercase text-[10px]">Observações / Encaixe:</span>
              <p className="text-foreground font-medium italic">{agendamento.observacoes}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-6 border-t border-border mt-6">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Ações Rápidas do Atendimento</Label>
          
          <Button
            onClick={() => { onOpenChange(false); onAbrirComanda(agendamento); }}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 shadow-md flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" /> Abrir Comanda no Checkout / Cobrar
          </Button>

          <div className={cn("grid gap-2", isBarber ? "grid-cols-1" : "grid-cols-2")}>
            {!isBarber && (
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); onEdit(agendamento); }}
                className="text-xs font-bold border-border text-foreground h-9"
              >
                <Edit className="h-3.5 w-3.5 mr-1.5" /> Editar Agendamento
              </Button>
            )}

            {agendamento.status === "agendado" && (
              <Button
                onClick={() => { onOpenChange(false); onStatusChange(agendamento.id, "confirmado"); }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-9 shadow-md"
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Iniciar Atendimento
              </Button>
            )}

            {(agendamento.status === "confirmado" || agendamento.status === "em_atendimento") && (
              <Button
                onClick={() => { onOpenChange(false); onStatusChange(agendamento.id, "concluido"); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 shadow-md"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Concluir Atendimento
              </Button>
            )}

            {agendamento.status !== "agendado" && agendamento.status !== "confirmado" && agendamento.status !== "em_atendimento" && (
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); onStatusChange(agendamento.id, "cancelado"); }}
                className="text-xs font-bold border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 h-9"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
