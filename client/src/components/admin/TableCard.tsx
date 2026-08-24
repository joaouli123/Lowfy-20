import { ReactNode } from "react";
import { LucideIcon, Search, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  /** valor da busca; se definido, renderiza o campo de busca */
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** filtros adicionais (selects, chips) */
  children?: ReactNode;
  /** conteúdo alinhado à direita (botões de ação) */
  trailing?: ReactNode;
  className?: string;
}

/** Barra de filtros padrão: busca com ícone + slots para selects/ações. */
export function FilterBar({ search, onSearchChange, searchPlaceholder = "Buscar...", children, trailing, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-2.5", className)}>
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 h-9"
            data-testid="input-search"
          />
        </div>
      )}
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      {trailing && <div className="flex items-center gap-2 sm:ml-auto">{trailing}</div>}
    </div>
  );
}

interface TableCardProps {
  /** cabeçalho opcional do card (título + contagem + ações) */
  title?: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  /** rodapé (paginação) */
  footer?: ReactNode;
  className?: string;
}

/** Card que envolve tabelas: borda arredondada, header opcional e scroll horizontal interno. */
export function TableCard({ title, count, actions, children, footer, className }: TableCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
          <div className="flex items-baseline gap-2 min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>}
            {count !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString("pt-BR")}</span>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
      {footer && <div className="border-t px-5 py-3">{footer}</div>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio padrão para tabelas e listas. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Skeleton de linhas para tabelas em carregamento. */
export function TableSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("p-5 space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
