import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Unidade {
  id: string;
  nome: string;
  status: string;
}

interface UnidadeContextType {
  unidades: Unidade[];
  selectedUnidadeId: string | null;
  setSelectedUnidadeId: (id: string | null) => void;
  selectedUnidade: Unidade | null;
  loading: boolean;
  isAdmin: boolean;
  userUnidadeId: string | null;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { empresaId, loading: empresaLoading } = useEmpresa();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeIdState] = useState<string | null>(
    localStorage.getItem("selectedUnidadeId")
  );
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userUnidadeId, setUserUnidadeId] = useState<string | null>(null);
  const cacheRef = useState<{ key: string | null; loaded: boolean }>({ key: null, loaded: false })[0];

  useEffect(() => {
    const currentKey = `${user?.id || ''}_${empresaId || ''}`;
    if (user && !empresaLoading) {
      if (cacheRef.key === currentKey && cacheRef.loaded) {
        setLoading(false);
        return;
      }
      fetchUserRoleAndUnidades();
    } else if (!user && !empresaLoading) {
      setUnidades([]);
      setIsAdmin(false);
      setUserUnidadeId(null);
      setLoading(false);
      cacheRef.loaded = false;
    }
  }, [user, empresaId, empresaLoading]);

  const fetchUserRoleAndUnidades = async () => {
    setLoading(true);

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role, unidade_id, empresa_id")
      .eq("user_id", user!.id);

    if (roleError) {
      console.error("Error fetching user roles:", roleError);
      setIsAdmin(false);
      setUserUnidadeId(null);
      setLoading(false);
      return;
    }

    const roles = roleRows ?? [];
    const tenantRole = roles.find((row) => row.role !== "super_admin") ?? roles[0] ?? null;
    const userIsAdmin = tenantRole?.role === "admin" || tenantRole?.role === "manager" || tenantRole?.role === "super_admin";
    setIsAdmin(userIsAdmin);
    setUserUnidadeId(tenantRole?.unidade_id || null);

    const { data } = await supabase
      .from("unidades")
      .select("id, nome, status")
      .eq("status", "active")
      .eq("empresa_id", empresaId)
      .order("nome");

    if (data) {
      setUnidades(data);

      if (tenantRole?.unidade_id && data.some(u => u.id === tenantRole.unidade_id)) {
        setSelectedUnidadeId(tenantRole.unidade_id);
      } else if (userIsAdmin) {
        const higienopolis = data.find(u => u.nome.toLowerCase().includes("higienópolis") || u.nome.toLowerCase().includes("higienopolis"));
        if (!selectedUnidadeId || !data.some(u => u.id === selectedUnidadeId)) {
          setSelectedUnidadeId(higienopolis ? higienopolis.id : (data[0]?.id || null));
        }
      } else if (data.length > 0) {
        setSelectedUnidadeId(data[0].id);
      }
    }
    cacheRef.key = `${user?.id || ''}_${empresaId || ''}`;
    cacheRef.loaded = true;
    setLoading(false);
  };

  const setSelectedUnidadeId = (id: string | null) => {
    // Non-admin users can't change their unit
    if (!isAdmin && userUnidadeId) return;

    setSelectedUnidadeIdState(id);
    if (id) {
      localStorage.setItem("selectedUnidadeId", id);
    } else {
      localStorage.removeItem("selectedUnidadeId");
    }
  };

  const selectedUnidade = unidades.find((u) => u.id === selectedUnidadeId) || null;

  return (
    <UnidadeContext.Provider
      value={{ unidades, selectedUnidadeId, setSelectedUnidadeId, selectedUnidade, loading, isAdmin, userUnidadeId }}
    >
      {children}
    </UnidadeContext.Provider>
  );
}

export function useUnidade() {
  const context = useContext(UnidadeContext);
  if (context === undefined) {
    throw new Error("useUnidade must be used within an UnidadeProvider");
  }
  return context;
}
