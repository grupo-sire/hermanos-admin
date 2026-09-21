import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Package,
  Warehouse,
  Settings,
  LogOut,
  Menu,
  Receipt,
  Wrench,
  Tag,
  UserRound,
  BarChart3,
  Crown,
  ExternalLink,
  Star,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { signOut } = useAuth();
  const { config, labels } = useEmpresa();
  const { isBarber, isSuperAdmin, loading: roleLoading } = useUserRole();
  const [collapsed, setCollapsed] = useState(false);

  const FEATURE_ROUTES = [
    "dashboard", "agenda", "clientes", "barbeiros", "servicos", "produtos",
    "estoque", "unidades", "configuracoes", "manutencao", "marketing", "checkout",
    "categorias", "usuarios", "permissoes", "relatorios", "avaliacoes", "crm", "assistente", "banco-talentos"
  ];
  const targetSlug = (slug && !FEATURE_ROUTES.includes(slug)) ? slug : (config?.slug || "hermanos");
  const prefix = `/${targetSlug}`;

  const allNavigation = [
    { label: "PRINCIPAL", items: [], adminOnly: false },
    { name: "Dashboard", href: `${prefix}/dashboard`, icon: LayoutDashboard, adminOnly: false },
    { name: "Agenda", href: `${prefix}/agenda`, icon: Calendar, adminOnly: false },
    { name: "Checkout", href: `${prefix}/checkout`, icon: Receipt, adminOnly: false },
    { label: "CADASTROS", items: [], adminOnly: true },
    { name: "Clientes", href: `${prefix}/clientes`, icon: UserRound, adminOnly: true },
    { name: labels.profissionais, href: `${prefix}/barbeiros`, icon: Users, adminOnly: true },
    { name: "Banco de Talentos", href: `${prefix}/banco-talentos`, icon: UserCheck, adminOnly: true },
    { name: labels.servicos, href: `${prefix}/servicos`, icon: Wrench, adminOnly: true },
    { name: "Categorias", href: `${prefix}/categorias`, icon: Tag, adminOnly: true },
    { label: "PRODUTOS", items: [], adminOnly: true },
    { name: "Produtos", href: `${prefix}/produtos`, icon: Package, adminOnly: true },
    { name: "Estoque", href: `${prefix}/estoque`, icon: Warehouse, adminOnly: true },
    { name: "Manutenção", href: `${prefix}/manutencao`, icon: Wrench, adminOnly: true },
    { label: "RELATÓRIOS", items: [], adminOnly: false },
    { name: "Relatórios", href: `${prefix}/relatorios`, icon: BarChart3, adminOnly: false },
    { name: "Avaliações", href: `${prefix}/avaliacoes`, icon: Star, adminOnly: true },
  ];

  const navigation = allNavigation.filter((item) => {
    if (item.adminOnly && (isBarber || roleLoading)) return false;
    return true;
  });

  const handleSignOut = async () => {
    localStorage.removeItem("selectedUnidadeId");
    await signOut();
    navigate(slug ? `/login/${slug}` : "/login", { replace: true });
  };

  const handleBrandClick = () => {
    navigate(isBarber ? `${prefix}/dashboard` : `${prefix}/configuracoes`);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col z-30",
          collapsed ? "w-16" : "w-64",
          onNavigate ? "h-full" : "sticky top-0 h-screen"
        )}
      >
        {/* Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBrandClick}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <img src={config.logo_url || "/logo_hermanos.png"} alt={config.nome} className="h-9 w-9 object-contain flex-shrink-0 rounded-lg" />
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-bold text-foreground truncate">{config.nome}</div>
                  <div className="text-xs text-muted-foreground">Sistema de Gestão</div>
                </div>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigation.map((item, idx) => {
            if ("label" in item && item.label) {
              if (collapsed) return null;
              return (
                <div key={idx} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-2">
                  {item.label}
                </div>
              );
            }

            if (!item.href || !item.icon) return null;

            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            const linkContent = (
              <Link
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full",
                  isActive
                    ? "bg-sidebar-accent text-foreground border border-border"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={10}
                    className="bg-slate-950/95 backdrop-blur-xl border border-red-500/40 text-white shadow-2xl px-3.5 py-2 rounded-xl flex items-center gap-2 z-50 animate-in fade-in-0 slide-in-from-left-2"
                  >
                    <Icon className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="font-bold text-xs tracking-wide">{item.name}</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {!isBarber && !roleLoading && (
            <>
              {isSuperAdmin && (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to="/admin"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-sidebar-accent/50 hover:text-red-400 transition-all w-full"
                      >
                        <Crown className="h-4 w-4 shrink-0 text-red-500" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className="bg-slate-950/95 backdrop-blur-xl border border-red-500/40 text-white shadow-2xl px-3.5 py-2 rounded-xl flex items-center gap-2 z-50">
                      <Crown className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="font-bold text-xs tracking-wide">Painel Super Admin</span>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 bg-red-950/30 border border-red-500/30 hover:bg-red-900/40 hover:text-red-400 transition-all w-full shadow-sm"
                  >
                    <Crown className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
                    <span>Painel Super Admin</span>
                  </Link>
                )
              )}

              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`/agendar?s=${config.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-sidebar-accent/50 hover:text-primary-dark transition-all w-full"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className="bg-slate-950/95 backdrop-blur-xl border border-red-500/40 text-white shadow-2xl px-3.5 py-2 rounded-xl flex items-center gap-2 z-50">
                    <ExternalLink className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="font-bold text-xs tracking-wide">Ver Link Público</span>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <a
                  href={`/agendar?s=${config.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-sidebar-accent/50 hover:text-primary-dark transition-all w-full"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span>Ver Link Público</span>
                </a>
              )}
            </>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-all w-full"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="bg-slate-950/95 backdrop-blur-xl border border-red-500/40 text-white shadow-2xl px-3.5 py-2 rounded-xl flex items-center gap-2 z-50">
                <LogOut className="h-4 w-4 text-red-400 shrink-0" />
                <span className="font-bold text-xs tracking-wide">Sair</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-all w-full"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
