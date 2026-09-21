import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  Settings,
  LogOut,
  ArrowLeft,
  Mail,
  Users,
  ShoppingBag,
  Package,
  Wrench,
  Tag,
  Megaphone,
  BarChart3,
  Shield,
  MessageSquare,
  Truck,
  QrCode,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QrScannerDialog } from "@/components/estoque/QrScannerDialog";

import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Banco de Talentos", href: "/admin/banco-talentos", icon: UserCheck },
  { name: "Relatórios Master", href: "/admin/relatorios", icon: BarChart3 },
  { name: "Marketing", href: "/admin/marketing", icon: Megaphone },
  { name: "Suprimentos", href: "/admin/suprimentos", icon: ShoppingBag },
  { name: "Manutenção", href: "/admin/manutencao", icon: Wrench },
  { name: "Produtos Mestre", href: "/admin/produtos", icon: Package },
  { name: "Serviços Mestre", href: "/admin/servicos", icon: Wrench },
  { name: "Unidades", href: "/admin/unidades", icon: Building2 },
  { name: "Categorias Mestre", href: "/admin/categorias", icon: Tag },
  { name: "Permissões", href: "/admin/permissoes", icon: Shield },
  { name: "Emails", href: "/admin/emails", icon: Mail },
  { name: "Usuários", href: "/admin/usuarios", icon: Users },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { config } = useEmpresa();
  const { user, signOut } = useAuth();
  const targetSlug = config?.slug || "hermanos";
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const isEntregador = Boolean(
    user?.email?.toLowerCase().includes("entregador") ||
    user?.user_metadata?.nome?.toLowerCase().includes("entregador") ||
    user?.user_metadata?.perfil_nome?.toLowerCase().includes("entregador")
  );

  // Se for perfil entregador e tentar acessar qualquer outra rota do admin, redireciona estritamente para suprimentos
  useEffect(() => {
    if (isEntregador && location.pathname !== "/admin/suprimentos") {
      navigate("/admin/suprimentos", { replace: true });
    }
  }, [isEntregador, location.pathname, navigate]);

  const navItems = isEntregador
    ? navigation.filter((item) => item.href === "/admin/suprimentos")
    : navigation;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-sm shadow-md",
              isEntregador
                ? "bg-gradient-to-br from-amber-600 to-amber-700"
                : "bg-gradient-to-br from-destructive to-destructive/70"
            )}>
              {isEntregador ? <Truck className="h-4 w-4" /> : "SA"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground truncate">
                {isEntregador ? "Logística & CD" : "Super Admin"}
              </div>
              <div className="text-xs text-muted-foreground">
                {isEntregador ? "Perfil Entregador" : "Painel de Controle"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.href);

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-foreground border border-border"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {isEntregador ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da Conta</span>
            </button>
          ) : (
            <button
              onClick={() => navigate(`/${targetSlug}/dashboard`)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-all w-full"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao Sistema</span>
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-auto">
        <header className="sticky top-0 z-10 flex items-center justify-end gap-2 px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
          <Button
            variant="outline"
            size="sm"
            className="btn-soft text-xs h-9 gap-1.5 font-semibold text-foreground hidden sm:flex border-border"
            onClick={() => setQrScannerOpen(true)}
          >
            <QrCode className="h-4 w-4 text-primary" />
            <span>Bipar Carga</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="btn-soft h-9 w-9 rounded-xl sm:hidden border-border"
            onClick={() => setQrScannerOpen(true)}
            title="Bipar Caixa QR Code"
          >
            <QrCode className="h-4 w-4 text-primary" />
          </Button>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
      <QrScannerDialog open={qrScannerOpen} onOpenChange={setQrScannerOpen} />
    </div>
  );
}
