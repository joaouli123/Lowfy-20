import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPageProps {
  children: ReactNode;
  className?: string;
  /** largura máxima do conteúdo; "wide" para páginas com tabelas densas */
  width?: "default" | "wide";
}

/** Casca padrão de página do admin: largura, padding e espaçamento consistentes. */
export function AdminPage({ children, className, width = "default" }: AdminPageProps) {
  return (
    <div className={cn("p-4 sm:p-6 mx-auto space-y-5", width === "wide" ? "max-w-[1600px]" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** ações à direita (botões, filtros rápidos) */
  actions?: ReactNode;
  /** conteúdo extra abaixo do título (tabs, chips) */
  children?: ReactNode;
}

/** Cabeçalho padrão: ícone em quadrado suave + título + descrição + ações à direita. */
export function AdminPageHeader({ title, description, icon: Icon, actions, children }: AdminPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground truncate" data-testid="page-title">
              {title}
            </h1>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
