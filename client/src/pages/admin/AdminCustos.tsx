import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Coins, Wallet, TrendingUp, Sparkles, RefreshCw, AlertTriangle, Settings2, ExternalLink, Users, Info,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, Legend, ResponsiveContainer } from "recharts";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, ChartCard, TableCard, FilterBar,
  EmptyState, TableSkeleton, StatusBadge, CHART_COLORS, gridProps, axisProps, tooltipStyle, formatBRLValue, formatNumber,
} from "@/components/admin";

// Nome amigável de cada ferramenta (vem do caminho da API).
const TOOL_LABEL: Record<string, string> = {
  image: "Criativo (imagem)",
  carousel: "Carrossel",
  copy: "Copy",
  "copy-kit": "Copy por canal",
  tts: "Narração",
  video: "Vídeo",
  avatar: "Avatar",
  "clone-voice": "Clone de voz",
  "motion/script": "Motion · roteiro",
  "motion/voice": "Motion · voz",
  "motion/animate": "Motion · animação",
  "ebook/outline": "E-book · sumário",
  "ebook/build": "E-book · livro",
  "ebook/redo-image": "E-book · imagem",
  "ebook/generate": "E-book (antigo)",
  "ebook/gen-image": "E-book (antigo) · imagem",
  "quiz/generate": "Quiz com IA",
  "clonador/pixels": "Clonador · pixels",
  sistema: "Sistema",
};
const toolLabel = (t: string) => TOOL_LABEL[t] || t;
const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", kie: "Kie.ai", elevenlabs: "ElevenLabs", anthropic: "Claude (Anthropic)", gemini: "Gemini", outro: "Outro" };
const KIND_LABEL: Record<string, string> = { image: "Imagem", text: "Texto", tts: "Voz", video: "Vídeo", avatar: "Avatar", stt: "Transcrição", music: "Música", sfx: "Efeitos", outro: "Outro" };

const usd = (v: number) => `US$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`;
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

interface Overview {
  period: { from: string; to: string; groupBy: string };
  fx: { rate: number; source: string };
  totals: { costUsd: number; costBrl: number; events: number; users: number };
  revenue: { grossBrl: number; refundsBrl: number; feesBrl: number; commissionsBrl: number; netBrl: number; payments: number; payingUsers: number };
  profitBrl: number;
  marginPct: number | null;
  costPerPayingUserBrl: number | null;
  byProvider: { provider: string; costUsd: number; events: number }[];
  byTool: { tool: string; costUsd: number; events: number; users: number; avgUsd: number }[];
  byKind: { kind: string; costUsd: number; events: number }[];
  series: { date: string; costBrl: number; revenueBrl: number; events: number }[];
  topUsers: { id: string; name: string; email: string; costUsd: number; events: number; alert: boolean }[];
  balances: {
    kie?: { credits?: number; usd?: number; error?: string };
    elevenlabs?: { tier?: string; used?: number; limit?: number; resetAt?: string | null; error?: string };
    openaiMonth?: { usd?: number; error?: string };
  };
  settings: { preferProvider: "openai" | "kie"; alertUserUsd: number; paymentFeePct: number };
}

interface UserRow {
  id: string; name: string; email: string; status: string; plan: string; events: number; lastAt: string | null;
  costUsd: number; costBrl: number; revenueBrl: number; resultBrl: number; alert: boolean;
}

export default function AdminCustos() {
  const [period, setPeriod] = useState(defaultPeriod("30days"));
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const params = { startDate: period.startDate, endDate: period.endDate, groupBy: period.groupBy };

  const ov = useQuery<Overview>({
    queryKey: ["/api/admin/costs/overview", params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/costs/overview?${qs(params)}`)).json(),
  });
  const us = useQuery<{ users: UserRow[]; alertUserUsd: number }>({
    queryKey: ["/api/admin/costs/users", params, search],
    queryFn: async () => (await apiRequest("GET", `/api/admin/costs/users?${qs({ ...params, search })}`)).json(),
  });

  const d = ov.data;
  const chart = useMemo(() => (d?.series || []).map((s) => ({
    ...s,
    label: (() => { try { return format(new Date(`${s.date}T12:00:00`), period.groupBy === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR }); } catch { return s.date; } })(),
  })), [d?.series, period.groupBy]);

  const refresh = () => { void ov.refetch(); void us.refetch(); };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Consumo e custos"
        description="Quanto cada IA custou, quanto entrou de assinatura e o resultado do período."
        icon={Coins}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-cost-settings">
              <Settings2 className="w-4 h-4 mr-2" /> Preços e provedor
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${ov.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} showGroupBy />
      </AdminPageHeader>

      {ov.error ? (
        <EmptyState icon={AlertTriangle} title="Não deu para carregar o consumo" description={(ov.error as any)?.message?.replace(/^\d+:\s*/, "") || "Tente de novo."} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard
              label="Custo de IA" icon={Sparkles} tone="danger" loading={ov.isLoading}
              value={formatBRLValue(d?.totals.costBrl)}
              hint={d ? `${usd(d.totals.costUsd)} · dólar a R$ ${d.fx.rate.toFixed(2)} (${d.fx.source})` : undefined}
              testId="stat-ai-cost"
            />
            <StatCard
              label="Receita líquida" icon={Wallet} tone="success" colorValue loading={ov.isLoading}
              value={formatBRLValue(d?.revenue.netBrl)}
              hint={d ? `Bruta ${formatBRLValue(d.revenue.grossBrl)} − taxas, reembolsos e comissões` : undefined}
              testId="stat-net-revenue"
            />
            <StatCard
              label="Resultado" icon={TrendingUp} tone={d && d.profitBrl < 0 ? "danger" : "success"} colorValue loading={ov.isLoading}
              value={formatBRLValue(d?.profitBrl)}
              hint={d?.marginPct != null ? `Margem de ${d.marginPct.toFixed(0)}% sobre a receita líquida` : "Sem receita no período"}
              testId="stat-profit"
            />
            <StatCard
              label="Gerações com IA" icon={Users} loading={ov.isLoading}
              value={formatNumber(d?.totals.events)}
              hint={d ? `${formatNumber(d.totals.users)} usuários${d.costPerPayingUserBrl != null ? ` · ${formatBRLValue(d.costPerPayingUserBrl)} de IA por pagante` : ""}` : undefined}
              testId="stat-events"
            />
          </StatGrid>

          <Balances d={d} loading={ov.isLoading} />

          <ChartCard
            title="Receita x custo de IA"
            description="Pagamentos de assinatura confirmados e o custo estimado de IA em cada período."
            loading={ov.isLoading}
            empty={!chart.length}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => `R$${Math.round(v)}`} width={56} />
                <Tooltip {...tooltipStyle} formatter={(v: any, k: any) => [formatBRLValue(Number(v)), k === "revenueBrl" ? "Receita" : "Custo de IA"]} />
                <Legend formatter={(k) => (k === "revenueBrl" ? "Receita" : "Custo de IA")} />
                <Bar dataKey="revenueBrl" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="costBrl" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TableCard title="Custo por ferramenta" count={d?.byTool.length} className="lg:col-span-2">
              {ov.isLoading ? <TableSkeleton rows={5} /> : !d?.byTool.length ? (
                <EmptyState icon={Sparkles} title="Nenhuma geração no período" description="O consumo aparece aqui a partir da primeira geração registrada." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 px-4 font-medium">Ferramenta</th>
                        <th className="py-2 px-3 font-medium text-right">Gerações</th>
                        <th className="py-2 px-3 font-medium text-right">Usuários</th>
                        <th className="py-2 px-3 font-medium text-right">Custo médio</th>
                        <th className="py-2 px-4 font-medium text-right">Custo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.byTool.map((t) => (
                        <tr key={t.tool} className="border-b last:border-0">
                          <td className="py-2.5 px-4 font-medium">{toolLabel(t.tool)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(t.events)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(t.users)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatBRLValue(t.avgUsd * d.fx.rate)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums font-medium">{formatBRLValue(t.costUsd * d.fx.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>

            <TableCard title="Por provedor">
              {ov.isLoading ? <TableSkeleton rows={4} /> : !d?.byProvider.length ? (
                <p className="p-4 text-sm text-muted-foreground">Sem consumo no período.</p>
              ) : (
                <div className="p-4 space-y-3">
                  {d.byProvider.map((p) => {
                    const pct = d.totals.costUsd ? (p.costUsd / d.totals.costUsd) * 100 : 0;
                    return (
                      <div key={p.provider}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{PROVIDER_LABEL[p.provider] || p.provider}</span>
                          <span className="tabular-nums">{formatBRLValue(p.costUsd * d.fx.rate)}</span>
                        </div>
                        <Progress value={pct} className="h-1.5 mt-1.5" />
                        <p className="text-[11px] text-muted-foreground mt-1">{formatNumber(p.events)} chamadas · {pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Por tipo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {d.byKind.map((k) => (
                        <StatusBadge key={k.kind} tone="neutral">{KIND_LABEL[k.kind] || k.kind} · {formatBRLValue(k.costUsd * d.fx.rate)}</StatusBadge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </TableCard>
          </div>

          <TableCard title="Usuários" count={us.data?.users.length}>
            <div className="p-4 border-b">
              <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por nome ou e-mail" />
            </div>
            {us.isLoading ? <TableSkeleton rows={6} /> : !us.data?.users.length ? (
              <EmptyState icon={Users} title="Ninguém no período" description="Aparecem aqui os usuários que geraram com IA ou pagaram no período." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 px-4 font-medium">Usuário</th>
                      <th className="py-2 px-3 font-medium">Assinatura</th>
                      <th className="py-2 px-3 font-medium text-right">Gerações</th>
                      <th className="py-2 px-3 font-medium text-right">Custo de IA</th>
                      <th className="py-2 px-3 font-medium text-right">Pagou</th>
                      <th className="py-2 px-4 font-medium text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {us.data.users.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => setUserId(u.id)} data-testid={`row-user-${u.id}`}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[220px]">{u.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">{u.email}</p>
                            </div>
                            {u.alert && <StatusBadge tone="warning" dot>Consumo alto</StatusBadge>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3"><StatusBadge tone={u.status === "active" ? "success" : "neutral"}>{u.status === "active" ? "Ativa" : u.status || "—"}</StatusBadge></td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(u.events)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatBRLValue(u.costBrl)}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatBRLValue(u.revenueBrl)}</td>
                        <td className={`py-2.5 px-4 text-right tabular-nums font-medium ${u.resultBrl < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatBRLValue(u.resultBrl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TableCard>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            O custo de IA é estimado pelo consumo de cada geração (tokens, imagens, caracteres e créditos) com os preços de "Preços e provedor".
            O valor exato cobrado fica no painel de cada provedor. A receita considera os pagamentos de assinatura confirmados no período.
          </p>
        </>
      )}

      <UserDetail id={userId} params={params} onClose={() => setUserId(null)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </AdminPage>
  );
}

function Balances({ d, loading }: { d?: Overview; loading: boolean }) {
  const b = d?.balances || {};
  const el = b.elevenlabs;
  const elPct = el?.limit ? Math.min(100, ((el.used || 0) / el.limit) * 100) : 0;
  const card = "rounded-xl border bg-card p-4";
  if (loading) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">OpenAI · gasto real no mês</p>
          <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Painel <ExternalLink className="w-3 h-3" /></a>
        </div>
        {b.openaiMonth?.usd != null ? (
          <p className="mt-1 text-2xl font-semibold tabular-nums">{usd(b.openaiMonth.usd)}</p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {b.openaiMonth?.error ? `Não respondeu: ${b.openaiMonth.error}` : "Para ver o valor exato aqui, crie uma chave de administrador na OpenAI (Settings → Admin keys) e salve no Coolify como OPENAI_ADMIN_KEY."}
          </p>
        )}
        {d?.settings.preferProvider === "openai" && <p className="text-[11px] text-emerald-600 mt-1.5">Provedor principal das imagens e textos</p>}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">ElevenLabs · caracteres do plano</p>
          <a href="https://elevenlabs.io/app/subscription" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Painel <ExternalLink className="w-3 h-3" /></a>
        </div>
        {el && !el.error ? (
          <>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(el.used)} <span className="text-sm font-normal text-muted-foreground">de {formatNumber(el.limit)}</span></p>
            <Progress value={elPct} className={`h-1.5 mt-2 ${elPct > 85 ? "[&>div]:bg-red-500" : ""}`} />
            <p className="text-[11px] text-muted-foreground mt-1.5">Plano {el.tier}{el.resetAt ? ` · renova em ${format(new Date(el.resetAt), "dd/MM", { locale: ptBR })}` : ""}</p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{el?.error ? `Não respondeu: ${el.error}. A chave precisa da permissão de leitura do usuário.` : "Chave não configurada."}</p>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-muted-foreground">Kie.ai · saldo</p>
          <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">Recarregar <ExternalLink className="w-3 h-3" /></a>
        </div>
        {b.kie && !b.kie.error ? (
          <>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${(b.kie.credits || 0) <= 0 ? "text-red-600" : ""}`}>{formatNumber(Math.round(b.kie.credits || 0))} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
            <p className="text-[11px] text-muted-foreground mt-1.5">≈ {usd(b.kie.usd || 0)}{(b.kie.credits || 0) <= 0 ? " · sem saldo: tudo sai pela OpenAI" : ""}</p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{b.kie?.error ? `Não respondeu: ${b.kie.error}` : "Chave não configurada."}</p>
        )}
      </div>
    </div>
  );
}

function UserDetail({ id, params, onClose }: { id: string | null; params: Record<string, string>; onClose: () => void }) {
  const q = useQuery<any>({
    queryKey: ["/api/admin/costs/users", id, params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/costs/users/${id}?${qs(params)}`)).json(),
    enabled: !!id,
  });
  const d = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d?.user?.name || "Usuário"}</DialogTitle>
          <DialogDescription>{d?.user?.email}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <TableSkeleton rows={5} /> : d ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {d.byTool.map((t: any) => (
                <StatusBadge key={t.tool} tone="neutral">{toolLabel(t.tool)}: {t.events}× · {formatBRLValue(t.costUsd * d.fx.rate)}</StatusBadge>
              ))}
              {!d.byTool.length && <p className="text-sm text-muted-foreground">Nenhuma geração no período.</p>}
            </div>
            {!!d.events.length && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">Ferramenta</th>
                    <th className="py-2 pr-3 font-medium">Provedor</th>
                    <th className="py-2 font-medium text-right">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {d.events.map((e: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-muted-foreground whitespace-nowrap">{format(new Date(e.at), "dd/MM HH:mm")}</td>
                      <td className="py-2 pr-3">{toolLabel(e.tool)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{PROVIDER_LABEL[e.provider] || e.provider}{e.model ? ` · ${e.model}` : ""}</td>
                      <td className="py-2 text-right tabular-nums">{formatBRLValue(e.costUsd * d.fx.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const q = useQuery<any>({
    queryKey: ["/api/admin/costs/settings"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/costs/settings")).json(),
    enabled: open,
  });
  const [form, setForm] = useState<any>(null);
  const s = form || q.data?.settings;
  const set = (patch: any) => setForm({ ...(form || q.data?.settings), ...patch });
  const setPrice = (patch: any) => set({ prices: { ...s.prices, ...patch } });

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/admin/costs/settings", s)).json(),
    onSuccess: () => {
      toast({ title: "Salvo", description: "Os próximos registros já usam os novos valores." });
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/settings"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/overview"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/costs/users"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Não salvou", description: e?.message, variant: "destructive" }),
  });

  const num = (v: string) => (v === "" ? "" : Number(v.replace(",", ".")));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setForm(null); onClose(); } }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preços e provedor</DialogTitle>
          <DialogDescription>Quem gera primeiro e os preços usados para estimar o custo de cada geração.</DialogDescription>
        </DialogHeader>
        {!s ? <TableSkeleton rows={4} /> : (
          <div className="space-y-5">
            <div>
              <Label>Provedor principal (imagens e textos)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(["openai", "kie"] as const).map((p) => (
                  <button
                    key={p} type="button" onClick={() => set({ preferProvider: p })}
                    className={`rounded-lg border p-3 text-left text-sm transition ${s.preferProvider === p ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <p className="font-medium">{p === "openai" ? "OpenAI" : "Kie.ai"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p === "openai" ? "Direto na OpenAI. A Kie fica de reserva." : "Mais barato. Sem saldo, cai na OpenAI sozinho."}</p>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Vídeo e avatar continuam na Kie (é o único provedor deles). Voz continua na ElevenLabs.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Dólar fixo (R$)" hint={`Vazio = cotação do dia (hoje ${q.data?.fx?.rate?.toFixed(2)})`} value={s.usdBrl ?? ""} onChange={(v) => set({ usdBrl: v === "" ? null : num(v) })} />
              <Field label="Taxa do pagamento (%)" hint="Média do gateway" value={s.paymentFeePct} onChange={(v) => set({ paymentFeePct: num(v) })} />
              <Field label="Alerta por usuário (US$)" hint="No período" value={s.alertUserUsd} onChange={(v) => set({ alertUserUsd: num(v) })} />
            </div>

            <div>
              <p className="text-sm font-medium">Preços (US$)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Field label="Crédito da Kie" value={s.prices.kieCredit} onChange={(v) => setPrice({ kieCredit: num(v) })} />
                <Field label="ElevenLabs por mil caracteres" hint="Preço do plano ÷ caracteres" value={s.prices.eleven1kChars} onChange={(v) => setPrice({ eleven1kChars: num(v) })} />
                {(["low", "medium", "high"] as const).map((k) => (
                  <Field key={k} label={`Imagem OpenAI ${k === "low" ? "baixa" : k === "medium" ? "média" : "alta"} (sem contagem de tokens)`} value={s.prices.imagePerQuality[k]} onChange={(v) => setPrice({ imagePerQuality: { ...s.prices.imagePerQuality, [k]: num(v) } })} />
                ))}
              </div>
              <p className="text-sm font-medium mt-4">Tokens (US$ por 1 milhão: entrada / saída)</p>
              <div className="mt-2 space-y-1.5">
                {Object.entries(s.prices.tokens as Record<string, [number, number]>).map(([k, [a, b]]) => (
                  <div key={k} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center">
                    <span className="text-xs font-mono truncate">{k}</span>
                    <Input className="h-8" inputMode="decimal" value={a} onChange={(e) => setPrice({ tokens: { ...s.prices.tokens, [k]: [num(e.target.value), b] } })} />
                    <Input className="h-8" inputMode="decimal" value={b} onChange={(e) => setPrice({ tokens: { ...s.prices.tokens, [k]: [a, num(e.target.value)] } })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setForm(null); onClose(); }}>Cancelar</Button>
              <Button onClick={() => save.mutate()} disabled={!form || save.isPending} data-testid="button-save-cost-settings">{save.isPending ? "Salvando…" : "Salvar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, value, onChange }: { label: string; hint?: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="h-9 mt-1" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
