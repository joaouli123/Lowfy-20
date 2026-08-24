import { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** slot à direita do título (legenda custom, seletor) */
  actions?: ReactNode;
  height?: number;
  loading?: boolean;
  /** true quando não há dados no período — mostra estado vazio no lugar do gráfico */
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  className?: string;
}

/** Card de gráfico padrão: título compacto, descrição muted, altura fixa e loading/empty prontos. */
export function ChartCard({ title, description, actions, height = 300, loading, empty, emptyMessage = "Sem dados no período selecionado", children, className }: ChartCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="px-3 pb-4 pt-2">
        {loading ? (
          <Skeleton style={{ height }} className="w-full rounded-lg" />
        ) : empty ? (
          <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
    </div>
  );
}
