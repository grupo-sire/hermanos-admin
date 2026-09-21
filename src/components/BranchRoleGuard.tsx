import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

interface BranchRoleGuardProps {
  children: React.ReactNode;
}

// Rotas autorizadas para o perfil de Barbeiro dentro de /:slug/
const BARBER_ALLOWED_ROUTES = [
  '/agenda',
  '/dashboard',
  '/checkout',
  '/relatorios',
];

export function BranchRoleGuard({ children }: BranchRoleGuardProps) {
  const { isSuperAdmin, isManager, isBarber, isCliente, isEntregador, loading } = useUserRole();
  const { config } = useEmpresa();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const currentSlug = slug || config?.slug || 'hermanos';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Entregador é estritamente bloqueado de qualquer tela de filial
  if (isEntregador) {
    return <Navigate to="/admin/suprimentos" replace />;
  }

  // 2. Cliente é estritamente bloqueado de telas de gestão/funcionários
  if (isCliente) {
    return <Navigate to={`/${currentSlug}/cliente`} replace />;
  }

  // 3. Barbeiro tem acesso restrito a: Agenda, Dashboard, Checkout e Relatórios
  if (isBarber) {
    const relativePath = location.pathname.replace(`/${currentSlug}`, '');
    const isAllowed = BARBER_ALLOWED_ROUTES.some(route => 
      relativePath === route || relativePath.startsWith(`${route}/`) || relativePath === ''
    );

    if (!isAllowed) {
      toast.error('⚠️ Acesso restrito: este módulo é exclusivo para Gerentes e Administradores.');
      return <Navigate to={`/${currentSlug}/agenda`} replace />;
    }
  }

  // Gerentes e Super Admins têm acesso permitido a todas as rotas da filial
  return <>{children}</>;
}
