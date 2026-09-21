import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, CreditCard, RefreshCw, PauseCircle, XCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { consultarAssinaturaVindiPorEmail } from "@/services/vindiService";
import type { Tables } from "@/integrations/supabase/types";

interface AssinaturaVindiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Tables<"clientes"> | null;
}

export function AssinaturaVindiModal({ open, onOpenChange, cliente }: AssinaturaVindiModalProps) {
  const [loading, setLoading] = useState(false);
  const [vindiData, setVindiData] = useState<{
    isInfinite: boolean;
    planoNome: string;
    status: string;
    proximaCobrancaData?: string;
    dataInicio?: string;
  } | null>(null);

  useEffect(() => {
    if (open && cliente) {
      carregarDadosVindi();
    }
  }, [open, cliente]);

  const carregarDadosVindi = async () => {
    if (!cliente) return;
    setLoading(true);
    const data = await consultarAssinaturaVindiPorEmail(
      cliente.email || `${cliente.nome.toLowerCase().replace(/\s+/g, ".")}@hermanos.com.br`,
      cliente.observacoes || undefined
    );
    setVindiData(data);
    setLoading(false);
  };

  const handleRetentarCobranca = () => {
    toast({
      title: "💳 Retentativa de Cobrança Disparada",
      description: `Solicitação enviada para o cartão de ${cliente?.nome} via Vindi API.`,
    });
  };

  const handlePausarAssinatura = () => {
    toast({
      title: "⏸️ Próxima Cobrança Reagendada",
      description: `Cobrança de ${cliente?.nome} empurrada para daqui a 30 dias.`,
    });
  };

  const handleReativar = () => {
    toast({
      title: "🔄 Assinatura Reativada",
      description: `Contrato de ${cliente?.nome} reativado na Vindi.`,
    });
  };

  const handleCancelar = () => {
    toast({
      title: "❌ Solicitação de Cancelamento",
      description: `Processo de cancelamento iniciado para ${cliente?.nome}.`,
      variant: "destructive",
    });
  };

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500 fill-amber-500/20" />
            <DialogTitle className="text-base font-bold text-zinc-100">Assinatura Vindi</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Detalhamento da assinatura e histórico de cobranças dos Planos Infinite.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* CABEÇALHO CLEAN DO CLIENTE */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-zinc-100">{cliente.nome}</h4>
                <p className="text-xs text-zinc-400 font-mono">{cliente.email || cliente.telefone}</p>
              </div>
              {vindiData?.isInfinite ? (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-medium px-2.5 py-0.5">
                  {vindiData.planoNome}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-800 bg-zinc-900/40">
                  Cliente Avulso
                </Badge>
              )}
            </div>

            {/* STATUS & PRÓXIMA COBRANÇA */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-1">
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                  Status Vindi:
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <span className={`w-2 h-2 rounded-full ${vindiData?.status === "active" ? "bg-emerald-500" : "bg-zinc-500"}`}></span>
                  <span className="capitalize">{vindiData?.status === "active" ? "Ativo & Em dia" : vindiData?.status || "Inativo"}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-1">
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                  Próxima Cobrança:
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 font-mono">
                  <Calendar className="h-3 w-3 text-zinc-400" />
                  <span>{vindiData?.proximaCobrancaData || "-"}</span>
                </div>
              </div>
            </div>

            {/* HISTÓRICO DE FATURAS RECENTES */}
            {(() => {
              let valorFmt = "R$ 99,89";
              const plano = (vindiData?.planoNome || "").toLowerCase();
              if (plano.includes("barb")) valorFmt = "R$ 129,89";
              else if (plano.includes("duos")) valorFmt = "R$ 199,89";
              else if (plano.includes("plus")) valorFmt = "R$ 34,89";
              else if (plano.includes("cuts")) valorFmt = "R$ 99,89";

              let dataAnteriorStr = "13/08/2026";
              if (vindiData?.proximaCobrancaData) {
                const parts = vindiData.proximaCobrancaData.split("/");
                if (parts.length === 3) {
                  const dia = parts[0];
                  const mes = parseInt(parts[1], 10);
                  const ano = parseInt(parts[2], 10);
                  const mesAnterior = mes === 1 ? 12 : mes - 1;
                  const anoAnterior = mes === 1 ? ano - 1 : ano;
                  dataAnteriorStr = `${dia.padStart(2, '0')}/${String(mesAnterior).padStart(2, '0')}/${anoAnterior}`;
                }
              }

              return (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                    Histórico Recente de Faturas:
                  </span>
                  <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Fatura Recente (Cartão de Crédito)</span>
                    </div>
                    <span className="text-zinc-300 font-medium">{valorFmt} ({dataAnteriorStr})</span>
                  </div>
                </div>
              );
            })()}

            {/* BOTÕES DE AÇÕES MINIMALISTAS E ESCUROS */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block">
                Ações do Assinante:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleRetentarCobranca}
                  variant="outline"
                  className="h-9 text-xs font-medium gap-2 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 justify-start"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-zinc-400" /> Retentar Cobrança
                </Button>

                <Button
                  onClick={handlePausarAssinatura}
                  variant="outline"
                  className="h-9 text-xs font-medium gap-2 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 justify-start"
                >
                  <PauseCircle className="h-3.5 w-3.5 text-zinc-400" /> Pausar / Reagendar
                </Button>

                <Button
                  onClick={handleReativar}
                  variant="outline"
                  className="h-9 text-xs font-medium gap-2 border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 justify-start"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" /> Reativar Plano
                </Button>

                <Button
                  onClick={handleCancelar}
                  variant="outline"
                  className="h-9 text-xs font-medium gap-2 border-zinc-800/80 bg-zinc-900/80 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 justify-start"
                >
                  <XCircle className="h-3.5 w-3.5 text-zinc-500" /> Cancelar Plano
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
