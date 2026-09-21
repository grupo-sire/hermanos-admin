import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LayoutDashboard } from "lucide-react";

interface EmpresaBranding {
  nome: string;
  logo_url: string | null;
  cor_primaria: string;
}

export default function LoginEmpresa() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<EmpresaBranding | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Load empresa branding by slug
  useEffect(() => {
    async function loadBranding() {
      if (!slug) {
        setNotFound(true);
        setLoadingBranding(false);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("nome, logo_url, cor_primaria")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setBranding({
          nome: data.nome,
          logo_url: data.logo_url,
          cor_primaria: data.cor_primaria || "350 65% 33%",
        });
      }
      setLoadingBranding(false);
    }

    loadBranding();
  }, [slug]);

  useEffect(() => {
    if (user && slug) {
      navigate(`/${slug}/dashboard`, { replace: true });
    }
  }, [user, navigate, slug]);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: "Informe seu e-mail", description: "Digite seu e-mail para receber o link de redefinição.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/definir-senha?slug=${slug}`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir sua senha." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível enviar o e-mail.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("E-mail ou senha incorretos.");
        }
        throw error;
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loadingBranding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Empresa não encontrada</h1>
          <p className="text-muted-foreground">O link que você acessou não corresponde a nenhuma empresa cadastrada.</p>
          <Button onClick={() => navigate("/login")} variant="outline">
            Ir para login principal
          </Button>
        </div>
      </div>
    );
  }

  const empresaNome = branding?.nome || "Sistema";
  const logoUrl = branding?.logo_url;

  // Convert HSL to CSS for inline accent
  const corPrimaria = branding?.cor_primaria || "350 65% 33%";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <style>{`
        .empresa-login-accent { --empresa-accent: ${corPrimaria}; }
        .empresa-login-accent .btn-empresa { background: hsl(${corPrimaria}); color: white; }
        .empresa-login-accent .btn-empresa:hover { background: hsl(${corPrimaria} / 0.9); }
        .empresa-login-accent .accent-gradient { background: linear-gradient(135deg, hsl(${corPrimaria}), hsl(${corPrimaria} / 0.7)); }
      `}</style>
      <div className="w-full max-w-sm empresa-login-accent">
        <div className="panel p-6 space-y-6">
          {/* Logo / Branding */}
          <div className="text-center space-y-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={empresaNome}
                className="mx-auto h-16 w-auto object-contain"
              />
            ) : (
              <div className="mx-auto w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${corPrimaria}), hsl(${corPrimaria} / 0.7))` }}>
                <LayoutDashboard className="h-7 w-7 text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground">{empresaNome}</h1>
            <p className="text-sm text-muted-foreground">Faça login para continuar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs hover:opacity-80 transition-colors"
                  style={{ color: `hsl(${corPrimaria})` }}
                >
                  Esqueci minha senha
                </button>
              </div>
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

            <Button
              type="submit"
              className="w-full btn-empresa"
              disabled={loading}
              style={{ backgroundColor: `hsl(${corPrimaria})` }}
            >
              {loading ? "Carregando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
