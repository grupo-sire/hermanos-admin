import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sun, DollarSign, Wallet, ShieldCheck, CheckCircle2, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { abrirCaixa, verificarEAutoFecharCaixasAnteriores } from "@/services/caixaService";
import { AlertTriangle } from "lucide-react";
import { CaixaSessao } from "@/types/caixa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AberturaCaixaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AberturaCaixaDialog({ open, onOpenChange, onSuccess }: AberturaCaixaDialogProps) {
  const { user } = useAuth();
  const { selectedUnidadeId, unidades } = useUnidade();
  const [fundoTroco, setFundoTroco] = useState("150.00");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const unidadeAtual = unidades.find((u) => u.id === selectedUnidadeId);
  const unidadeNome = unidadeAtual?.nome || "Unidade Filial";
  const hoje = new Date();
  const dataFormatada = format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const [pendenciaAnterior, setPendenciaAnterior] = useState<CaixaSessao | null>(null);

  useEffect(() => {
    if (open) {
      setFundoTroco("150.00");
      setObservacao("");
      const incidentes = verificarEAutoFecharCaixasAnteriores(selectedUnidadeId);
      if (incidentes.length > 0) {
        setPendenciaAnterior(incidentes[0]);
        toast.warning(`⚠️ Caixa Anterior Não Fechado: O caixa de ${incidentes[0].data} foi encerrado automaticamente na virada do dia e reportado ao SuperAdmin.`, { duration: 6000 });
      } else {
        setPendenciaAnterior(null);
      }
    }
  }, [open, selectedUnidadeId]);

  const handleConfirmarAbertura = () => {
    const valorNum = parseFloat(fundoTroco);
    if (isNaN(valorNum) || valorNum < 0) {
      toast.error("Informe um valor válido para o fundo de troco.");
      return;
    }

    if (!user) {
      toast.error("Usuário não identificado.");
      return;
    }

    setSaving(true);
    try {
      abrirCaixa({
        unidadeId: selectedUnidadeId || "all",
        unidadeNome,
        userEmail: user.email || "gerente@hermanos.com",
        userNome: user.user_metadata?.nome || user.email?.split("@")[0] || "Gerente",
        fundoTroco: valorNum,
        observacao: observacao.trim() || undefined,
      });

      toast.success("☀️ Caixa do dia aberto com sucesso! Bom expediente!");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar abertura do caixa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background text-foreground border border-border p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2 border-b border-border pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
            <Sun className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground">
            Abertura de Caixa Diária
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {dataFormatada} • <strong className="text-foreground">{unidadeNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {pendenciaAnterior && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl space-y-1.5 text-amber-700 dark:text-amber-400 animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Alerta de Auditoria: Caixa Anterior Não Fechado</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                O caixa do dia <strong>{pendenciaAnterior.data}</strong> não foi encerrado pelo gerente no fim do expediente. O fechamento diário é obrigatório. Este incidente foi auditado e registrado no SuperAdmin.
              </p>
            </div>
          )}
          <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Responsável pela Abertura:</span>
            <div className="font-extrabold text-foreground text-sm">
              {user?.user_metadata?.nome || user?.email?.split("@")[0] || "Gerente"}
            </div>
            <div className="text-muted-foreground text-[11px]">{user?.email}</div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Fundo de Troco Inicial na Gaveta (R$) *
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={fundoTroco}
              onChange={(e) => setFundoTroco(e.target.value)}
              placeholder="150.00"
              className="text-base font-black text-emerald-500 h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              Valor em dinheiro vivo colocado na gaveta para troco dos primeiros clientes.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Observações de Abertura (Opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Notas de R$ 10 e R$ 5 trocadas para a gaveta..."
              className="text-xs resize-none h-18"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="btn-soft text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmarAbertura}
            disabled={saving}
            className="btn-wine text-xs font-bold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
            Confirmar Abertura do Caixa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
