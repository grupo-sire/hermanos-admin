import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssinaturaStatus {
  status: string;
  dias_inadimplente: number;
  data_vencimento: string | null;
}

export function BillingAlert() {
  const { empresaId, config } = useEmpresa();
  const [assinatura, setAssinatura] = useState<AssinaturaStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    fetchAssinatura();
  }, [empresaId]);

  async function fetchAssinatura() {
    const { data } = await supabase
      .from("empresa_assinaturas")
      .select("status, dias_inadimplente, data_vencimento")
      .eq("empresa_id", empresaId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setAssinatura(data as AssinaturaStatus);
  }

  // Don't show if acesso_liberado
  if ((config as any).acesso_liberado) return null;
  if (!assinatura) return null;
  if (dismissed) return null;

  const isPending = assinatura.status === "pending" || assinatura.status === "overdue";
  const isOverdue = assinatura.dias_inadimplente > 0;

  if (!isPending && !isOverdue) return null;

  const isUrgent = assinatura.dias_inadimplente >= 5;
  const isCritical = assinatura.dias_inadimplente >= 7;

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border ${
        isCritical
          ? "bg-destructive/20 border-destructive/40 text-destructive"
          : isUrgent
          ? "bg-warning/20 border-warning/40 text-warning"
          : "bg-primary/10 border-primary/30 text-primary"
      }`}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        {isCritical ? (
          <p className="text-sm font-semibold">
            ⚠️ Seu acesso será bloqueado! Você está com {assinatura.dias_inadimplente} dias de inadimplência.
            Regularize sua mensalidade para continuar usando o sistema.
          </p>
        ) : isUrgent ? (
          <p className="text-sm font-medium">
            Sua mensalidade está vencida há {assinatura.dias_inadimplente} dias. 
            Regularize para evitar o bloqueio do sistema.
          </p>
        ) : (
          <p className="text-sm">
            Sua mensalidade está pendente. Regularize o pagamento para evitar interrupções.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={isCritical ? "destructive" : "default"} className="gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          Regularizar
        </Button>
        {!isCritical && (
          <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
