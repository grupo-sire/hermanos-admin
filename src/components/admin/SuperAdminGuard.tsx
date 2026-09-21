import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmpresa } from "@/contexts/EmpresaContext";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, isEntregador, isBarber, isCliente, loading } = useUserRole();
  const { config } = useEmpresa();
  const location = useLocation();
  const targetSlug = config?.slug || "hermanos";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Entregador pode acessar apenas /admin/suprimentos
  if (isEntregador) {
    if (location.pathname === "/admin/suprimentos") {
      return <>{children}</>;
    }
    return <Navigate to="/admin/suprimentos" replace />;
  }

  // Se for cliente, manda para a tela do cliente
  if (isCliente) {
    return <Navigate to={`/${targetSlug}/cliente`} replace />;
  }

  // Se for barbeiro, manda para a agenda
  if (isBarber) {
    return <Navigate to={`/${targetSlug}/agenda`} replace />;
  }

  // Se for gerente (não super admin), manda para o dashboard da filial
  if (!isSuperAdmin) {
    return <Navigate to={`/${targetSlug}/dashboard`} replace />;
  }

  return <>{children}</>;
}
