import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLabels, EstabelecimentoLabels } from "@/lib/estabelecimento-labels";
import { applyThemeColors } from "@/lib/theme-palettes";
import { useAuth } from "@/contexts/AuthContext";

export type { EstabelecimentoLabels };

interface EmpresaConfig {
  id: string | null;
  slug: string | null;
  nome: string;
  logo_url: string | null;
  capa_url: string | null;
  tema_publico: "light" | "dark";
  tipo_estabelecimento: string;
  cor_primaria: string;
  cor_nome: string;
  onboarding_completo: boolean;
  multi_unidades: boolean;
  acesso_liberado: boolean;
}

interface EmpresaContextType {
  config: EmpresaConfig;
  labels: EstabelecimentoLabels;
  loading: boolean;
  empresaId: string | null;
  isSuperAdmin: boolean;
  refresh: () => Promise<void>;
}

const defaultConfig: EmpresaConfig = {
  id: "hermanos-id",
  slug: "hermanos",
  nome: "Barbearia Hermanos",
  logo_url: null,
  capa_url: null,
  tema_publico: "dark",
  tipo_estabelecimento: "barbearia",
  cor_primaria: "0 100% 55%",
  cor_nome: "Vermelho Hermanos",
  onboarding_completo: true,
  multi_unidades: true,
  acesso_liberado: true,
};

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<EmpresaConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const cachedUserIdRef = useState<{ userId: string | null; loaded: boolean }>({ userId: null, loaded: false })[0];

  const fetchConfig = useCallback(async () => {
    if (authLoading) return;

    if (!user) {
      setConfig(defaultConfig);
      setEmpresaId(null);
      setIsSuperAdmin(false);
      setLoading(false);
      cachedUserIdRef.loaded = false;
      cachedUserIdRef.userId = null;
      return;
    }

    // Se já foi carregado para este mesmo usuário, não refaz requisição para evitar lag
    if (cachedUserIdRef.userId === user.id && cachedUserIdRef.loaded) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("role, empresa_id")
        .eq("user_id", user.id);

      if (roleError) throw roleError;

      const roles = roleRows ?? [];
      const superAdminRow = roles.find((row) => row.role === "super_admin");
      const userIsSuperAdmin = !!superAdminRow;
      setIsSuperAdmin(userIsSuperAdmin);

      let resolvedEmpresaId: string | null = null;
      
      // Capturamos o slug da URL para priorizar se for Super Admin
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const urlSlug = pathParts[0];

      // SE for Super Admin E houver um slug na URL (que não seja rota reservada), priorizamos o Slug
      if (userIsSuperAdmin && urlSlug && !["admin", "onboarding", "login", "definir-senha", "agendar"].includes(urlSlug)) {
        const { data: empData } = await supabase
          .from("empresas")
          .select("id")
          .eq("slug", urlSlug)
          .maybeSingle();
        
        if (empData) {
          resolvedEmpresaId = empData.id;
        }
      }

      // Se não resolveu via URL (ou não é super admin), buscamos o tenant padrão do usuário
      if (!resolvedEmpresaId) {
        const tenantRoleRow = roles.find((row) => row.empresa_id);
        resolvedEmpresaId = tenantRoleRow?.empresa_id ?? null;
      }

      // Fallback para Convites ou RPC
      if (!resolvedEmpresaId && user.email) {
        const { data: conviteRow, error: conviteError } = await supabase
          .from("convites")
          .select("empresa_id")
          .eq("email", user.email)
          .not("empresa_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conviteError) {
          console.error("Error loading convite fallback:", conviteError);
        } else {
          resolvedEmpresaId = conviteRow?.empresa_id ?? null;
        }

        if (!resolvedEmpresaId) {
          try {
            const { data: empresaIdViaRpc, error: rpcError } = await supabase.rpc("link_user_by_email" as any);
            if (!rpcError && empresaIdViaRpc) {
              resolvedEmpresaId = empresaIdViaRpc as string;
            }
          } catch (e) {
            console.error("Erro ao vincular usuario por email via RPC:", e);
          }
        }
      }

      // Se for Super Admin e mesmo assim não achou empresa, marcamos como onboarding ok para ver o painel admin
      if (!resolvedEmpresaId && userIsSuperAdmin) {
        setConfig({ ...defaultConfig, onboarding_completo: true });
        setEmpresaId(null);
        setLoading(false);
        return;
      }

      setEmpresaId(resolvedEmpresaId);

      if (!resolvedEmpresaId) {
        setConfig(defaultConfig);
        applyThemeColors(defaultConfig.cor_primaria);
        setLoading(false);
        return;
      }

      const { data, error: empresaError } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", resolvedEmpresaId)
        .single();

      if (empresaError) throw empresaError;

      if (data) {
        const cfg: EmpresaConfig = {
          id: data.id,
          slug: data.slug || "hermanos",
          nome: data.nome || "Barbearia Hermanos",
          logo_url: data.logo_url,
          capa_url: (data as any).capa_url,
          tema_publico: (data as any).tema_publico || "dark",
          tipo_estabelecimento: data.tipo_estabelecimento || "barbearia",
          cor_primaria: data.cor_primaria || "0 100% 55%",
          cor_nome: data.cor_nome || "Vermelho Hermanos",
          onboarding_completo: true,
          multi_unidades: true,
          acesso_liberado: true,
        };
        setConfig(cfg);
        applyThemeColors(cfg.cor_primaria);
      } else {
        setConfig(defaultConfig);
        applyThemeColors(defaultConfig.cor_primaria);
      }
      
      cachedUserIdRef.userId = user.id;
      cachedUserIdRef.loaded = true;
    } catch (error) {
      console.error("Error loading empresa config:", error);
      setConfig(defaultConfig);
      setEmpresaId(null);
      setIsSuperAdmin(false);
      applyThemeColors(defaultConfig.cor_primaria);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  const refresh = async () => {
    cachedUserIdRef.loaded = false;
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const labels = getLabels(config.tipo_estabelecimento);

  return (
    <EmpresaContext.Provider value={{ config, labels, loading, empresaId, isSuperAdmin, refresh }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (context === undefined) {
    throw new Error("useEmpresa must be used within an EmpresaProvider");
  }
  return context;
}
