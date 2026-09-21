import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserRoleInfo {
  role: "super_admin" | "admin" | "manager" | "barber" | "cliente" | "entregador" | null;
  barbeiroId: string | null;
  unidadeId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isBarber: boolean;
  isSuperAdmin: boolean;
  isEntregador: boolean;
  isCliente: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { user } = useAuth();
  
  // Cache em sessionStorage para 0ms de FOUC/Hydration lag
  const cachedRole = user ? (sessionStorage.getItem(`HERMANOS_ROLE_${user.id}`) as any) : null;
  const cachedBarbeiroId = user ? sessionStorage.getItem(`HERMANOS_BARBEIRO_ID_${user.id}`) : null;
  const cachedUnidadeId = user ? sessionStorage.getItem(`HERMANOS_UNIDADE_ID_${user.id}`) : null;

  const [role, setRole] = useState<"super_admin" | "admin" | "manager" | "barber" | "cliente" | "entregador" | null>(cachedRole || null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(cachedBarbeiroId || null);
  const [unidadeId, setUnidadeId] = useState<string | null>(cachedUnidadeId || null);
  const [loading, setLoading] = useState(!cachedRole);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setBarbeiroId(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // 1. Checagem imediata de entregador
        const isEntregadorCheck = Boolean(
          user.email?.toLowerCase().includes("entregador") ||
          user.user_metadata?.nome?.toLowerCase().includes("entregador") ||
          user.user_metadata?.perfil_nome?.toLowerCase().includes("entregador") ||
          user.user_metadata?.role?.toLowerCase().includes("entregador")
        );

        if (isEntregadorCheck) {
          setRole("entregador");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "entregador");
          setLoading(false);
          return;
        }

        // 2. Checagem de Super Admin Master
        if (
          user.email === "centralhermanos@gmail.com" ||
          user.user_metadata?.role === "super_admin" ||
          user.app_metadata?.role === "super_admin"
        ) {
          setRole("super_admin");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "super_admin");
          setLoading(false);
          return;
        }

        const [rolesRes, barbeiroRes] = await Promise.all([
          supabase.from("user_roles").select("role, unidade_id, perfil_acesso_id").eq("user_id", user.id),
          supabase.from("barbeiros").select("id, unidade_id").eq("user_id", user.id).maybeSingle()
        ]);

        const roles = rolesRes.data || [];
        const bId = barbeiroRes.data?.id || null;
        const uId = roles.find(r => r.unidade_id)?.unidade_id || barbeiroRes.data?.unidade_id || null;

        setUnidadeId(uId);
        if (uId) sessionStorage.setItem(`HERMANOS_UNIDADE_ID_${user.id}`, uId);

        if (roles.some((r) => r.role === "super_admin")) {
          setRole("super_admin");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "super_admin");
        } else if (roles.some((r) => r.role === "manager")) {
          setRole("manager");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "manager");
        } else if (roles.some((r) => r.role === "barber") || bId) {
          setRole("barber");
          setBarbeiroId(bId);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "barber");
          if (bId) sessionStorage.setItem(`HERMANOS_BARBEIRO_ID_${user.id}`, bId);
        } else if (roles.some((r) => r.role === "admin")) {
          setRole("admin");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "admin");
        } else {
          // Se não tem role de funcionário cadastrado, é cliente
          setRole("cliente");
          setBarbeiroId(null);
          sessionStorage.setItem(`HERMANOS_ROLE_${user.id}`, "cliente");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return {
    role,
    barbeiroId,
    unidadeId,
    loading,
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "super_admin",
    isManager: role === "manager",
    isBarber: role === "barber",
    isEntregador: role === "entregador",
    isCliente: role === "cliente",
  };
}
