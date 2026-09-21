import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

export interface Categoria {
  id: string;
  nome: string;
  tipo: string;
  created_at: string;
}

export function useCategorias(tipo: "produto" | "servico") {
  const { empresaId } = useEmpresa();
  const defaultEmpresaId = empresaId || "93d24bc4-e371-4395-8ed8-636d02575de6";
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategorias = async () => {
    setLoading(true);
    let query = supabase.from("categorias").select("*").eq("tipo", tipo).order("nome");
    if (defaultEmpresaId) query = query.eq("empresa_id", defaultEmpresaId);

    const { data, error } = await query;

    if (!error && data) {
      setCategorias(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategorias();
  }, [tipo, empresaId]);

  return { categorias, loading, refetch: fetchCategorias };
}
