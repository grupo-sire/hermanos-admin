import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  change?: React.ReactNode | string;
  changeType?: "positive" | "negative" | "neutral";
  loading?: boolean;
  icon?: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  description,
  change,
  changeType,
  loading,
  icon: Icon,
  trend,
  className,
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "panel relative overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:border-red-500/50 hover:bg-red-950/10 hover:scale-[1.01] active:scale-[0.99] group shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-red-400 transition-colors">
            {title}
          </p>
          <p className="text-2xl font-extrabold text-foreground">
            {loading ? "..." : value}
          </p>
          {change && (
            <p
              className={cn(
                "text-[11px] font-medium",
                changeType === "positive"
                  ? "text-emerald-400"
                  : changeType === "negative"
                  ? "text-red-400"
                  : "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-semibold",
                trend.positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-red-500/20 transition-colors">
            <Icon className="h-5 w-5 text-primary group-hover:text-red-400 transition-colors" />
          </div>
        )}
      </div>
      {onClick && (
        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 group-hover:text-red-400 font-bold transition-colors">
          <span>Ver Detalhes do Relatório</span>
          <span>→</span>
        </div>
      )}
    </div>
  );
}
