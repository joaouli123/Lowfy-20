import { ReactNode } from "react";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "danger" | "warning" | "info" | "violet";

const iconTone: Record<StatTone, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-600",
  info: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
};

const valueTone: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  danger: "text-red-600",
  warning: "text-amber-600",
  info: "text-sky-600",
  violet: "text-violet-600",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** aplica a cor do tone também no valor (padrão: só no ícone) */
  colorValue?: boolean;
  /** variação percentual vs. período anterior; renderiza seta ↑/↓ */
  delta?: number | null;
  /** texto pequeno abaixo do valor (ex.: "12 no período") */
  hint?: ReactNode;
  loading?: boolean;
  testId?: string;
  className?: string;
}

/** Card de métrica padrão do admin: rótulo, valor grande tabular, ícone tintado e delta opcional. */
export function StatCard({ label, value, icon: Icon, tone = "default", colorValue, delta, hint, loading, testId, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-1.5" />
          ) : (
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums truncate", colorValue && valueTone[tone])} data-testid={testId}>
              {value}
            </p>
          )}
          {(delta !== undefined && delta !== null) || hint ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              {delta !== undefined && delta !== null && (
                <span className={cn("inline-flex items-center gap-0.5 font-medium rounded-full px-1.5 py-0.5", delta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                  {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </span>
              )}
              {hint && <span className="text-muted-foreground truncate">{hint}</span>}
            </div>
          ) : null}
        </div>
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconTone[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  /** colunas no desktop (2–6). Mobile é sempre 1–2. */
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const colsClass = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
} as const;

export function StatGrid({ children, cols = 4, className }: StatGridProps) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:gap-4", colsClass[cols], className)}>{children}</div>;
}
