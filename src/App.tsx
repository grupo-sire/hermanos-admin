import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { EmpresaProvider, useEmpresa } from "@/contexts/EmpresaContext";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Clientes from "./pages/Clientes";
import Barbeiros from "./pages/Barbeiros";
import Servicos from "./pages/Servicos";
import Produtos from "./pages/Produtos";
import Estoque from "./pages/Estoque";
import Unidades from "./pages/Unidades";
import Assistente from "./pages/Assistente";
import IaV01 from "./pages/IaV01";
import Configuracoes from "./pages/Configuracoes";
import Marketing from "./pages/Marketing";
import Checkout from "./pages/Checkout";
import Categorias from "./pages/Categorias";
import Usuarios from "./pages/Usuarios";
import Permissoes from "./pages/Permissoes";
import DefinirSenha from "./pages/DefinirSenha";
import Relatorios from "./pages/Relatorios";
import Avaliacoes from "./pages/Avaliacoes";
import CRM from "./pages/CRM";
import BancoTalentos from "./pages/admin/BancoTalentos";
import AgendarPublico from "./pages/AgendarPublico";
import LoginEmpresa from "./pages/LoginEmpresa";
import ClienteDashboard from "./pages/cliente/ClienteDashboard";
import NotFound from "./pages/NotFound";
import { SuperAdminGuard } from "@/components/admin/SuperAdminGuard";
import { BranchRoleGuard } from "@/components/BranchRoleGuard";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useUserRole } from "@/hooks/useUserRole";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUnidades from "./pages/admin/AdminUnidades";
import AdminConfiguracoes from "./pages/admin/AdminConfiguracoes";
import AdminEmailConfig from "./components/admin/AdminEmailConfig";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import AdminSuprimentos from "./pages/admin/AdminSuprimentos";
import AdminManutencao from "./pages/admin/AdminManutencao";
import AdminRelatorios from "./pages/admin/AdminRelatorios";
import Manutencao from "./pages/Manutencao";

const queryClient = new QueryClient();

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isEntregador, isCliente, isBarber } = useUserRole();
  const { config } = useEmpresa();
  const targetSlug = config?.slug || "hermanos";

  if (isEntregador) {
    return <Navigate to="/admin/suprimentos" replace />;
  }

  if (isCliente) {
    return <Navigate to={`/${targetSlug}/cliente`} replace />;
  }

  return <>{children}</>;
}

/** Redirects authenticated users from / to their role-specific landing page */
function RootRedirect() {
  const { config, loading: empresaLoading } = useEmpresa();
  const { isSuperAdmin, isEntregador, isBarber, isCliente, loading: roleLoading } = useUserRole();
  const targetSlug = config?.slug || "hermanos";

  if (empresaLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isEntregador) {
    return <Navigate to="/admin/suprimentos" replace />;
  }

  if (isCliente) {
    return <Navigate to={`/${targetSlug}/cliente`} replace />;
  }

  if (isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (isBarber) {
    return <Navigate to={`/${targetSlug}/agenda`} replace />;
  }

  if (config?.slug) {
    return <Navigate to={`/${config.slug}/dashboard`} replace />;
  }

  return <Navigate to="/onboarding" replace />;
}

const KNOWN_FEATURE_ROUTES = [
  "dashboard", "agenda", "clientes", "barbeiros", "servicos", "produtos",
  "estoque", "unidades", "configuracoes", "manutencao", "marketing", "checkout",
  "categorias", "usuarios", "permissoes", "relatorios", "avaliacoes", "crm", "assistente", "ia-v01"
];

/** Validates that the slug in URL matches the user's empresa */
function SlugGuard({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { config, loading } = useEmpresa();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const targetSlug = config?.slug || "hermanos";

  // Se o slug na URL for o nome de uma rota (ex: /clientes), redireciona para /hermanos/clientes
  if (slug && KNOWN_FEATURE_ROUTES.includes(slug)) {
    return <Navigate to={`/${targetSlug}/${slug}`} replace />;
  }

  if (config?.slug && slug !== config.slug) {
    return <Navigate to={`/${config.slug}/dashboard`} replace />;
  }

  return <>{children}</>;
}

/** Redireciona acessos diretos como /clientes ou /agenda para /:slug/clientes */
function DirectRouteRedirect({ path }: { path: string }) {
  const { config } = useEmpresa();
  const targetSlug = config?.slug || "hermanos";
  return <Navigate to={`/${targetSlug}/${path}`} replace />;
}

/** Redireciona /login/:slug para /:slug/login */
function LoginSlugRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/${slug}/login`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/login/:slug" element={<LoginSlugRedirect />} />
      <Route path="/definir-senha" element={<DefinirSenha />} />
      <Route path="/agendar" element={<AgendarPublico />} />
      <Route path="/agendar/:slug" element={<AgendarPublico />} />
      <Route path="/:slug/agendar" element={<AgendarPublico />} />
      <Route path="/cliente" element={<ClienteDashboard />} />
      <Route path="/cliente/:slug" element={<ClienteDashboard />} />
      <Route path="/:slug/cliente" element={<ClienteDashboard />} />
      <Route path="/:slug/login" element={<LoginEmpresa />} />

      {/* Redirecionamentos para acessos sem o prefixo da empresa */}
      {KNOWN_FEATURE_ROUTES.map((routePath) => (
        <Route key={routePath} path={`/${routePath}`} element={<DirectRouteRedirect path={routePath} />} />
      ))}

      {/* Admin Panel (SuperAdmin) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <SuperAdminGuard>
              <AdminLayout />
            </SuperAdminGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="banco-talentos" element={<BancoTalentos />} />
        <Route path="relatorios" element={<AdminRelatorios />} />
        <Route path="crm" element={<CRM />} />
        <Route path="unidades" element={<AdminUnidades />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="servicos" element={<Servicos />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="suprimentos" element={<AdminSuprimentos />} />
        <Route path="manutencao" element={<AdminManutencao />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="permissoes" element={<Permissoes />} />
        <Route path="configuracoes" element={<AdminConfiguracoes />} />
        <Route path="emails" element={<AdminEmailConfig />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
      </Route>

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingGuard>
              <Onboarding />
            </OnboardingGuard>
          </ProtectedRoute>
        }
      />

      {/* Empresa routes with :slug prefix */}
      <Route
        path="/:slug"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <BranchRoleGuard>
                <OnboardingGuard>
                  <MainLayout />
                </OnboardingGuard>
              </BranchRoleGuard>
            </SlugGuard>
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="barbeiros" element={<Barbeiros />} />
        <Route path="banco-talentos" element={<BancoTalentos />} />
        <Route path="servicos" element={<Servicos />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="manutencao" element={<Manutencao />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="permissoes" element={<Permissoes />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="avaliacoes" element={<Avaliacoes />} />
        <Route path="crm" element={<CRM />} />
        <Route path="assistente" element={<Assistente />} />
        <Route path="ia-v01" element={<IaV01 />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <EmpresaProvider>
                <UnidadeProvider>
                  <AppRoutes />
                </UnidadeProvider>
              </EmpresaProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
