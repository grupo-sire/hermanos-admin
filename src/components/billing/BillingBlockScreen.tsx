import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ShieldAlert, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Blocks the entire app if the empresa is 7+ days overdue
 * and acesso_liberado is false.
 */
export function BillingBlockScreen({ children }: { children: React.ReactNode }) {
  const { empresaId, config, loading, isSuperAdmin } = useEmpresa();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading || isSuperAdmin) {
      setChecking(false);
      return;
    }
    if (!empresaId) {
      setChecking(false);
      return;
    }
    checkAccess();
  }, [empresaId, loading, isSuperAdmin, config]);

  async function checkAccess() {
    // If acesso_liberado, never block
    if ((config as any).acesso_liberado) {
      setBlocked(false);
      setChecking(false);
      return;
    }

    const { data } = await supabase
      .from("empresa_assinaturas")
      .select("dias_inadimplente, status")
      .eq("empresa_id", empresaId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.dias_inadimplente >= 7 && data.status !== "paid") {
      setBlocked(true);
    } else {
      setBlocked(false);
    }
    setChecking(false);
  }

  if (checking) return null;

  if (blocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Bloqueado</h1>
            <p className="text-muted-foreground">
              Sua mensalidade está vencida há mais de 7 dias. 
              Para continuar utilizando o sistema, regularize seu pagamento.
            </p>
          </div>
          <Button size="lg" className="gap-2">
            <CreditCard className="h-5 w-5" />
            Regularizar Pagamento
          </Button>
          <p className="text-xs text-muted-foreground">
            Em caso de dúvidas, entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
