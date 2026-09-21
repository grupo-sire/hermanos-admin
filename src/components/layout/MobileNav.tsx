import { useLocation, useParams, NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  Receipt, 
  UserRound, 
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export function MobileNav() {
  const { slug } = useParams<{ slug: string }>();
  const { isBarber } = useUserRole();
  const location = useLocation();

  const FEATURE_ROUTES = [
    "dashboard", "agenda", "clientes", "barbeiros", "servicos", "produtos",
    "estoque", "unidades", "configuracoes", "manutencao", "marketing", "checkout",
    "categorias", "usuarios", "permissoes", "relatorios", "avaliacoes", "crm", "assistente", "banco-talentos"
  ];
  const targetSlug = (slug && !FEATURE_ROUTES.includes(slug)) ? slug : "hermanos";
  const prefix = `/${targetSlug}`;

  const menuItems = [
    { name: "Agenda", href: `${prefix}/agenda`, icon: Calendar },
    { name: "Dashboard", href: `${prefix}/dashboard`, icon: LayoutDashboard },
    { name: "Checkout", href: `${prefix}/checkout`, icon: Receipt },
    isBarber 
      ? { name: "Relatórios", href: `${prefix}/relatorios`, icon: BarChart3 }
      : { name: "Clientes", href: `${prefix}/clientes`, icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border flex items-center justify-around px-2 py-2 safe-area-bottom md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <NavLink
            key={item.href}
            to={item.href}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 min-w-[64px]",
              isActive 
                ? "text-primary scale-110" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
