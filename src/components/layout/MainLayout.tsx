import React from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { UnitSelector } from "./UnitSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BillingAlert } from "@/components/billing/BillingAlert";
import { BillingBlockScreen } from "@/components/billing/BillingBlockScreen";
import { MobileNav } from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Menu, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUserRole } from "@/hooks/useUserRole";
import { QrScannerDialog } from "@/components/estoque/QrScannerDialog";
import { cn } from "@/lib/utils";

export function MainLayout() {
  const isMobile = useIsMobile();
  const { config } = useEmpresa();
  const { isBarber } = useUserRole();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [qrScannerOpen, setQrScannerOpen] = React.useState(false);

  return (
    <BillingBlockScreen>
      <div className="flex min-h-screen w-full bg-background pb-16 md:pb-0">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Main App-like Header */}
          <header className={cn(
            "sticky top-0 z-10 flex items-center gap-2 px-5 py-3 border-b border-border bg-background/80 backdrop-blur-sm",
            isMobile ? "justify-between" : "justify-end"
          )}>
            {isMobile && (
              <div className="flex items-center gap-3">
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 border-none w-64">
                    <AppSidebar onNavigate={() => setDrawerOpen(false)} />
                  </SheetContent>
                </Sheet>
                <div className="flex items-center gap-2">
                   {config.logo_url ? (
                    <img src={config.logo_url} alt={config.nome} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                      {config.nome?.charAt(0)}
                    </div>
                  )}
                  <span className="font-bold text-base truncate max-w-[120px]">{config.nome}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              {!isBarber && (
                <>
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
                </>
              )}
              <ThemeToggle />
              <UnitSelector />
            </div>
          </header>

          <main className={cn("flex-1", isMobile ? "p-4" : "p-5")}>
            <BillingAlert />
            <Outlet />
          </main>
        </div>
        {isMobile && <MobileNav />}
      </div>
      <QrScannerDialog open={qrScannerOpen} onOpenChange={setQrScannerOpen} />
    </BillingBlockScreen>
  );
}
