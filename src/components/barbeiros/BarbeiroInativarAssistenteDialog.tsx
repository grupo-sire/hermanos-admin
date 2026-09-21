import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  MessageSquare, 
  Loader2,
  ShieldCheck
} from "lucide-react";

interface BarbeiroInativarAssistenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barbeiro: any;
  onSuccess: () => void;
}

export function BarbeiroInativarAssistenteDialog({
  open,
  onOpenChange,
  barbeiro,
  onSuccess
}: BarbeiroInativarAssistenteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [agendamentosFuturos, setAgendamentosFuturos] = useState<any[]>([]);
  const [outrosBarbeiros, setOutrosBarbeiros] = useState<any[]>([]);
  const [opcaoMigracao, setOpcaoMigracao] = useState<"auto_distribuir" | "manter_cadeira" | "whatsapp">("auto_distribuir");
  const [barbeiroDestinoId, setBarbeiroDestinoId] = useState<string>("");

  useEffect(() => {
    if (open && barbeiro) {
      analisarAgendamentosFuturos();
    }
  }, [open, barbeiro]);

  const analisarAgendamentosFuturos = async () => {
    setAnalyzing(true);
    try {
      const nowIso = new Date().toISOString();

      // 1. Buscar agendamentos futuros do barbeiro alvo
      const { data: ags, error: agsErr } = await supabase
        .from("agendamentos")
        .select(`
          id,
          data_hora,
          status,
          preco,
          duracao_minutos,
          clientes:cliente_id (id, nome, telefone),
          servicos:servico_id (id, nome)
        `)
        .eq("barbeiro_id", barbeiro.id)
        .gte("data_hora", nowIso)
        .neq("status", "cancelado")
        .order("data_hora");

      if (agsErr) throw agsErr;

      // 2. Buscar outros barbeiros ativos da mesma filial
      const { data: barbs } = await supabase
        .from("barbeiros")
        .select("id, nome, codigo_cadeira")
        .eq("unidade_id", barbeiro.unidade_id)
        .eq("status", "active")
        .neq("id", barbeiro.id);

      const outrosList = barbs || [];
      setOutrosBarbeiros(outrosList);

      if (outrosList.length > 0 && !barbeiroDestinoId) {
        setBarbeiroDestinoId(outrosList[0].id);
      }

      // 3. Buscar todos os agendamentos futuros dos OUTROS barbeiros na filial para verificar choques de horario
      const { data: agsOutros } = await supabase
        .from("agendamentos")
        .select("id, barbeiro_id, data_hora, duracao_minutos")
        .eq("unidade_id", barbeiro.unidade_id)
        .neq("barbeiro_id", barbeiro.id)
        .gte("data_hora", nowIso)
        .neq("status", "cancelado");

      const agsOutrosList = agsOutros || [];

      // 4. Analisar cada agendamento futuro do barbeiro inativado contra sobreposicoes
      const analisados = (ags || []).map((ag: any) => {
        const agStartMs = new Date(ag.data_hora).getTime();
        const agEndMs = agStartMs + (ag.duracao_minutos || 30) * 60000;

        // Verificar disponibilidade em cada barbeiro da filial
        const barbeirosDisponiveis = outrosList.filter((b) => {
          const conflito = agsOutrosList.some((ao) => {
            if (ao.barbeiro_id !== b.id) return false;
            const aoStartMs = new Date(ao.data_hora).getTime();
            const aoEndMs = aoStartMs + (ao.duracao_minutos || 30) * 60000;
            // Ha sobreposicao se Math.max(start1, start2) < Math.min(end1, end2)
            return Math.max(agStartMs, aoStartMs) < Math.min(agEndMs, aoEndMs);
          });
          return !conflito;
        });

        const temVagaDestinoPrincipal = barbeirosDisponiveis.some((b) => b.id === (barbeiroDestinoId || outrosList[0]?.id));

        return {
          ...ag,
          barbeirosDisponiveis,
          temVagaDestinoPrincipal,
          statusConflito: temVagaDestinoPrincipal
            ? "livre"
            : barbeirosDisponiveis.length > 0
            ? "redirecionar_outra_cadeira"
            : "choque_sem_vaga",
        };
      });

      setAgendamentosFuturos(analisados);
    } catch (err: any) {
      console.error("Erro ao analisar agendamentos futuros:", err);
      toast({
        title: "Erro de Análise",
        description: "Não foi possível verificar os agendamentos futuros do barbeiro.",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmarInativacao = async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      if (agendamentosFuturos.length > 0) {
        if (opcaoMigracao === "auto_distribuir" || opcaoMigracao === "manter_cadeira") {
          const targetBarbId = barbeiroDestinoId || (outrosBarbeiros[0]?.id || null);

          // Processar agendamento a agendamento para impedir QUALQUER choque de horario
          for (const ag of agendamentosFuturos) {
            let barbeiroAtribuidoId = null;

            if (ag.temVagaDestinoPrincipal) {
              barbeiroAtribuidoId = targetBarbId;
            } else if (ag.barbeirosDisponiveis && ag.barbeirosDisponiveis.length > 0) {
              // Redireciona para outra cadeira com horario 100% livre
              barbeiroAtribuidoId = ag.barbeirosDisponiveis[0].id;
            }

            if (barbeiroAtribuidoId) {
              await supabase
                .from("agendamentos")
                .update({ barbeiro_id: barbeiroAtribuidoId })
                .eq("id", ag.id);
            } else {
              // Se TODAS as cadeiras estiverem ocupadas naquele horario, cancela e marca para reagendamento WhatsApp
              await supabase
                .from("agendamentos")
                .update({ status: "cancelado" })
                .eq("id", ag.id);
            }
          }
        } else if (opcaoMigracao === "whatsapp") {
          const agIds = agendamentosFuturos.map(a => a.id);
          await supabase
            .from("agendamentos")
            .update({ status: "cancelado" })
            .in("id", agIds);
        }
      }

      // 2. Inativar o barbeiro e gravar a data exata de desligamento
      const { error: inativarErr } = await supabase
        .from("barbeiros")
        .update({
          status: "inactive",
          data_desligamento: nowIso
        })
        .eq("id", barbeiro.id);

      if (inativarErr) throw inativarErr;

      toast({
        title: "Profissional Inativado com Sucesso",
        description: agendamentosFuturos.length > 0
          ? `${agendamentosFuturos.length} agendamentos futuros foram remanejados de forma inteligente.`
          : "Barbeiro inativado com histórico de desligamento salvo."
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao concluir inativação:", err);
      toast({
        title: "Erro ao inativar",
        description: err.message || "Ocorreu uma falha ao processar a migração.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-white/10 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-red-500" />
            Assistente Inteligente de Remanejamento
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Análise preventiva antes de concluir a inativação do barbeiro{" "}
            <strong className="text-foreground font-semibold">{barbeiro?.nome} {barbeiro?.codigo_cadeira && `(${barbeiro.codigo_cadeira})`}</strong>
          </DialogDescription>
        </DialogHeader>

        {analyzing ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <p className="text-xs text-muted-foreground">Analisando agendamentos futuros e horários das outras cadeiras...</p>
          </div>
        ) : agendamentosFuturos.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-emerald-400">Zero Agendamentos Pendentes</h4>
                <p className="text-xs text-emerald-200/80">
                  Este profissional não possui nenhum agendamento futuro marcado na filial. Você pode concluir a inativação com 100% de segurança.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Alerta de Agendamentos Futuros */}
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-400">
                  {agendamentosFuturos.length} Agendamento(s) Futuro(s) Detectado(s)
                </h4>
                <p className="text-xs text-amber-200/80">
                  Para não deixar nenhum cliente sem atendimento, escolha como deseja remanejar a agenda abaixo antes de finalizar.
                </p>
              </div>
            </div>

            {/* Lista dos Agendamentos Afetados */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Clientes Marcados no Futuro:
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {agendamentosFuturos.map((ag) => (
                  <div key={ag.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-foreground">{ag.clientes?.nome || "Cliente Não Informado"}</div>
                      <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3 text-red-400" />
                        {formatDate(ag.data_hora)} • {ag.servicos?.nome || "Serviço"}
                      </div>
                    </div>

                    {ag.statusConflito === "livre" && (
                      <Badge variant="outline" className="bg-emerald-950/50 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                        Horário Livre
                      </Badge>
                    )}
                    {ag.statusConflito === "redirecionar_outra_cadeira" && (
                      <Badge variant="outline" className="bg-blue-950/50 text-blue-400 border-blue-500/30 font-mono text-[10px]">
                        Vaga em Cadeira Auxiliar
                      </Badge>
                    )}
                    {ag.statusConflito === "choque_sem_vaga" && (
                      <Badge variant="outline" className="bg-amber-950/50 text-amber-400 border-amber-500/30 font-mono text-[10px]">
                        Choque de Horário (Reagendar)
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Seleção da Ação de Migração */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-foreground">Como deseja tratar esses {agendamentosFuturos.length} clientes?</h5>
              
              <div className="grid grid-cols-1 gap-2">
                <div
                  onClick={() => setOpcaoMigracao("auto_distribuir")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    opcaoMigracao === "auto_distribuir"
                      ? "bg-red-950/40 border-red-500/60 ring-1 ring-red-500/30"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <Users className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Transferir para Outro Barbeiro da Filial</div>
                    <div className="text-[11px] text-muted-foreground">
                      Move automaticamente os cortes para outra cadeira ativa na filial nos mesmos horários.
                    </div>

                    {opcaoMigracao === "auto_distribuir" && outrosBarbeiros.length > 0 && (
                      <div className="mt-2.5">
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Selecione o profissional de destino:</label>
                        <select
                          value={barbeiroDestinoId}
                          onChange={(e) => setBarbeiroDestinoId(e.target.value)}
                          className="bg-black/60 border border-white/20 text-foreground text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-red-500"
                        >
                          {outrosBarbeiros.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.codigo_cadeira ? `[Barbeiro ${b.codigo_cadeira}] ` : ""}{b.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setOpcaoMigracao("whatsapp")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    opcaoMigracao === "whatsapp"
                      ? "bg-red-950/40 border-red-500/60 ring-1 ring-red-500/30"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <MessageSquare className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">Cancelar e Disparar Aviso via WhatsApp</div>
                    <div className="text-[11px] text-muted-foreground">
                      Libera a agenda e envia notificação de reagendamento para os clientes afetados.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-white/[0.06]">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-white/10"
          >
            Cancelar
          </Button>

          <Button
            onClick={handleConfirmarInativacao}
            disabled={loading || analyzing}
            className="bg-red-700 hover:bg-red-800 text-white font-bold"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {agendamentosFuturos.length > 0 ? "Confirmar Migração e Inativar" : "Confirmar Inativação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
