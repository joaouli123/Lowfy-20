import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "danger" | "warning" | "info" | "violet" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  neutral: "bg-secondary text-secondary-foreground ring-border",
};

interface StatusBadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
  /** pontinho colorido à esquerda */
  dot?: boolean;
  className?: string;
  "data-testid"?: string;
}

const dotClass: Record<BadgeTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  violet: "bg-violet-500",
  neutral: "bg-muted-foreground",
};

/** Badge de status padrão (estilo Stripe: fundo suave + ring). */
export function StatusBadge({ tone = "neutral", dot, children, className, "data-testid": testId }: StatusBadgeProps) {
  return (
    <span data-testid={testId} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", toneClass[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} />}
      {children}
    </span>
  );
}
