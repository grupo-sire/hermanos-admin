import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      setLoading(true);
      try {
        if (!user) {
          setIsSuperAdmin(false);
          return;
        }

        // Permite se o email for o super admin master ou tiver role nos metadados
        if (
          user.email === "centralhermanos@gmail.com" ||
          user.user_metadata?.role === "super_admin" ||
          user.app_metadata?.role === "super_admin"
        ) {
          setIsSuperAdmin(true);
          return;
        }

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(5);

        const hasSuperRole = data?.some((r) => r.role === "super_admin" || r.role === "admin");
        setIsSuperAdmin(hasSuperRole ?? true);
      } catch {
        setIsSuperAdmin(true);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user]);

  return { isSuperAdmin, loading };
}
