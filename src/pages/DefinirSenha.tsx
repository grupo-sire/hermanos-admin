import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Lock, Loader2 } from "lucide-react";

interface EmpresaBranding {
  nome: string;
  logo_url: string | null;
  cor_primaria: string;
}

export default function DefinirSenha() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [branding, setBranding] = useState<EmpresaBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);

  const slug = searchParams.get("slug");

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error) {
        console.error("Erro ao validar sessão do convite:", error);
      }

      if (data.session?.user || user) {
        setSessionChecked(true);
        return;
      }

      window.setTimeout(() => {
        if (!cancelled) {
          setSessionChecked(true);
        }
      }, 1200);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setSessionChecked(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!slug) return;

    let active = true;
    setBrandingLoading(true);

    const loadBranding = async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("nome, logo_url, cor_primaria")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (!active) return;

      if (!error && data) {
        setBranding({
          nome: data.nome,
          logo_url: data.logo_url,
          cor_primaria: data.cor_primaria || "350 65% 33%",
        });
      }

      setBrandingLoading(false);
    };

    loadBranding();

    return () => {
      active = false;
    };
  }, [slug]);

  const loginPath = useMemo(() => (slug ? `/login/${slug}` : "/login"), [slug]);
  const empresaNome = branding?.nome || "Sistema de Gestão";
  const logoUrl = branding?.logo_url;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({ title: "Senha definida!", description: "Agora você já pode acessar o sistema." });
      navigate(slug ? `/${slug}/dashboard` : "/dashboard", { replace: true });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao definir senha.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (!sessionChecked && !user) || brandingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Validando seu acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <div className="panel p-6 space-y-6 text-center">
            <div className="space-y-2">
              {logoUrl ? (
                <img src={logoUrl} alt={empresaNome} className="mx-auto h-16 w-auto object-contain" />
              ) : (
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-wine-dark flex items-center justify-center">
                  <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
                </div>
              )}
              <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
              <p className="text-sm text-muted-foreground">
                Abra o link mais recente do seu e-mail ou solicite um novo convite para continuar.
              </p>
            </div>

            <Button type="button" className="w-full btn-wine" onClick={() => navigate(loginPath, { replace: true })}>
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="panel p-6 space-y-6">
          <div className="text-center space-y-2">
            {logoUrl ? (
              <img src={logoUrl} alt={empresaNome} className="mx-auto h-16 w-auto object-contain" />
            ) : (
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-wine-dark flex items-center justify-center">
                <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground">{empresaNome}</h1>
            <p className="text-sm text-muted-foreground">Defina sua senha para acessar o sistema</p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border">
            <Lock className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-foreground truncate">{user.email}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-dark"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full btn-wine" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
