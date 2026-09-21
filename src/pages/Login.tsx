import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LayoutDashboard } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();
  const { config } = useEmpresa();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({ title: "Informe seu e-mail", description: "Digite seu e-mail para receber o link de redefinição.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/definir-senha`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir sua senha." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Não foi possível enviar o e-mail.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const isAdminSession = localStorage.getItem("hermanos_admin_session") === "true";
      if (isAdminSession) {
        navigate("/", { replace: true });
      }
    }
  }, [user, navigate]);

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
      // Marcar sessão de administração autenticada
      localStorage.setItem("hermanos_admin_session", "true");
      navigate("/", { replace: true });
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const empresaNome = config.nome || "Barbearia Hermanos";
  const logoUrl = config.logo_url;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-4 font-sans text-white relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="glass-card p-8 space-y-6 shadow-2xl">
          {/* Logo / Branding */}
          <div className="text-center space-y-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={empresaNome}
                className="mx-auto h-20 w-auto object-contain"
              />
            ) : (
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff1a1a] to-[#a30000] flex items-center justify-center shadow-lg shadow-[#ff1a1a]/20 border border-white/10">
                <LayoutDashboard className="h-8 w-8 text-white animate-pulse" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{empresaNome}</h1>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mt-1">
                Painel Administrativo
              </p>
            </div>
            <div className="h-[1px] w-12 bg-primary/50 mx-auto my-1" />
            <p className="text-sm text-gray-400">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-300">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#161618]/60 border-white/10 text-white placeholder:text-gray-500 rounded-xl px-3 py-2.5 focus:border-[#ff1a1a] focus:ring-1 focus:ring-[#ff1a1a]/30 transition-all duration-300"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-300">
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
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
                className="bg-[#161618]/60 border-white/10 text-white placeholder:text-gray-500 rounded-xl px-3 py-2.5 focus:border-[#ff1a1a] focus:ring-1 focus:ring-[#ff1a1a]/30 transition-all duration-300"
                required
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#ff1a1a] hover:bg-[#e01616] active:scale-95 text-white font-bold rounded-xl border-none shadow-lg shadow-[#ff1a1a]/20 transition-all duration-300 h-11 mt-2 flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Carregando...
                </>
              ) : (
                "Acessar Painel"
              )}
            </Button>
          </form>

          {/* Footer branding details */}
          <div className="text-center pt-2">
            <span className="text-xs text-gray-500 flex items-center justify-center gap-1">
              Desenvolvido por <span className="text-gray-400 font-semibold">WebSquad</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
