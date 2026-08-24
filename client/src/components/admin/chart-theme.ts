// Paleta e estilos padronizados para todos os gráficos recharts do admin.
// Uso: espalhar as props nos elementos nativos do recharts —
//   <CartesianGrid {...gridProps} /> <XAxis {...axisProps} dataKey="x" /> <Tooltip {...tooltipStyle} />
// (recharts identifica filhos pelo tipo, então componentes wrapper não funcionam)
export const CHART_COLORS = {
  primary: "hsl(161, 84%, 33%)",
  teal: "hsl(173, 70%, 40%)",
  sky: "hsl(199, 89%, 48%)",
  amber: "hsl(43, 96%, 50%)",
  violet: "hsl(258, 70%, 62%)",
  rose: "hsl(347, 77%, 55%)",
  slate: "hsl(215, 16%, 47%)",
} as const;

export const CHART_SERIES: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.sky,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.rose,
  CHART_COLORS.teal,
];

export const gridProps = {
  strokeDasharray: "3 3",
  stroke: "hsl(214, 22%, 91%)",
  vertical: false,
} as const;

export const axisProps = {
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: "hsl(215, 16%, 47%)" },
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: "hsl(0, 0%, 100%)",
    border: "1px solid hsl(214, 22%, 91%)",
    borderRadius: "0.625rem",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
    fontSize: 12,
    padding: "8px 12px",
  },
  labelStyle: { color: "hsl(222, 40%, 12%)", fontWeight: 600, marginBottom: 4 },
  cursor: { fill: "hsl(210, 24%, 96%)", opacity: 0.6 },
} as const;

