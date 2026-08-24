// Formatadores compartilhados do painel admin.
// Valores monetários do backend chegam em centavos.

export function formatBRL(cents: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

export function formatBRLValue(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

export function formatCompact(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return `${(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}
