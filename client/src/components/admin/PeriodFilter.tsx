import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Period {
  preset: string;
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd
  groupBy: "day" | "week" | "month";
}

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "7D" },
  { value: "30days", label: "30D" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "3months", label: "3M" },
  { value: "6months", label: "6M" },
  { value: "12months", label: "12M" },
  { value: "all", label: "Tudo" },
];

export function resolvePreset(preset: string): Omit<Period, "preset"> | null {
  const now = new Date();
  const d = (x: Date) => format(x, "yyyy-MM-dd");
  switch (preset) {
    case "today": return { startDate: d(now), endDate: d(now), groupBy: "day" };
    case "7days": return { startDate: d(subDays(now, 7)), endDate: d(now), groupBy: "day" };
    case "30days": return { startDate: d(subDays(now, 30)), endDate: d(now), groupBy: "day" };
    case "thisMonth": return { startDate: d(startOfMonth(now)), endDate: d(endOfMonth(now)), groupBy: "day" };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { startDate: d(startOfMonth(lm)), endDate: d(endOfMonth(lm)), groupBy: "day" };
    }
    case "3months": return { startDate: d(subMonths(now, 3)), endDate: d(now), groupBy: "week" };
    case "6months": return { startDate: d(subMonths(now, 6)), endDate: d(now), groupBy: "week" };
    case "12months": return { startDate: d(subMonths(now, 12)), endDate: d(now), groupBy: "month" };
    case "all": return { startDate: "2020-01-01", endDate: d(now), groupBy: "month" };
    default: return null;
  }
}

export function defaultPeriod(preset = "30days"): Period {
  return { preset, ...resolvePreset(preset)! };
}

interface PeriodFilterProps {
  value: Period;
  onChange: (p: Period) => void;
  /** exibe o seletor de agrupamento (dia/semana/mês) */
  showGroupBy?: boolean;
  className?: string;
}

/**
 * Barra de período padrão do admin: atalhos em chips + datas personalizadas.
 * Clicar num chip resolve as datas; editar uma data vira "personalizado".
 */
export function PeriodFilter({ value, onChange, showGroupBy, className }: PeriodFilterProps) {
  const applyPreset = (preset: string) => {
    const resolved = resolvePreset(preset);
    if (resolved) onChange({ preset, ...resolved });
  };

  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-center gap-2.5", className)}>
      <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-card p-1 shadow-sm w-fit" data-testid="period-presets">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => applyPreset(p.value)}
            data-testid={`preset-${p.value}`}
            className={cn(
              "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
              value.preset === p.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="date"
          value={value.startDate}
          onChange={(e) => onChange({ ...value, preset: "custom", startDate: e.target.value })}
          className="h-9 w-[150px] text-sm"
          data-testid="input-start-date"
        />
        <span className="text-muted-foreground text-sm">até</span>
        <Input
          type="date"
          value={value.endDate}
          onChange={(e) => onChange({ ...value, preset: "custom", endDate: e.target.value })}
          className="h-9 w-[150px] text-sm"
          data-testid="input-end-date"
        />
        {showGroupBy && (
          <Select value={value.groupBy} onValueChange={(g) => onChange({ ...value, groupBy: g as Period["groupBy"] })}>
            <SelectTrigger className="h-9 w-[110px] text-sm" data-testid="select-group-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Por dia</SelectItem>
              <SelectItem value="week">Por semana</SelectItem>
              <SelectItem value="month">Por mês</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
