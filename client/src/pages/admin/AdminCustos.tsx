import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Coins, Wallet, TrendingUp, Sparkles, RefreshCw, AlertTriangle, Settings2, ExternalLink, Users, Info, Search, Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, Legend, ResponsiveContainer } from "recharts";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, ChartCard,
  EmptyState, TableSkeleton, StatusBadge, gridProps, axisProps, tooltipStyle, formatBRLValue, formatNumber,
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
  "motion/brief": "Motion · briefing",
  "motion/script": "Motion · roteiro",
  "motion/voice": "Motion · voz",
  "motion/audio": "Motion · trilha e efeitos",
  "motion/trilha": "Motion · trilha",
  "motion/efeitos": "Motion · efeitos",
  "motion/animate": "Motion · animação",
  "ebook/outline": "E-book · sumário",
  "ebook/build": "E-book · livro",
  "ebook/redo-image": "E-book · imagem",
  "ebook/generate": "E-book (antigo)",
  "ebook/gen-image": "E-book (antigo) · imagem",
  "landing/generate": "Criador de páginas",
  "landing/vibe": "Criador de páginas (HTML)",
  "quiz/generate": "Quiz com IA",
  "clonador/pixels": "Clonador · pixels",
  sistema: "Sistema",
};
const toolLabel = (t: string) => TOOL_LABEL[t] || t;
const PROVEDORES: { id: string; nome: string; cor: string }[] = [
  { id: "openai", nome: "OpenAI", cor: "hsl(161, 84%, 33%)" },
  { id: "anthropic", nome: "Claude (Anthropic)", cor: "hsl(25, 85%, 55%)" },
  { id: "elevenlabs", nome: "ElevenLabs", cor: "hsl(258, 70%, 62%)" },
  { id: "kie", nome: "Kie.ai", cor: "hsl(199, 89%, 48%)" },
  { id: "gemini", nome: "Gemini", cor: "hsl(43, 96%, 50%)" },
  { id: "outro", nome: "Outro", cor: "hsl(215, 16%, 60%)" },
];
const PROVIDER_LABEL: Record<string, string> = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.nome]));

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
  seriesByProvider: Record<string, any>[];
  topUsers: { id: string; name: string; email: string; costUsd: number; events: number; alert: boolean }[];
  balances: {
    kie?: { credits?: number; usd?: number; error?: string };
    elevenlabs?: { tier?: string; used?: number; limit?: number; resetAt?: string | null; error?: string };
    openaiMonth?: { usd?: number; error?: string };
  };
  settings: { preferProvider: "openai" | "kie"; alertUserUsd: number; paymentFeePct: number; iaAcesso?: "admin" | "assinantes" };
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
    staleTime: 30_000,
  });
  const us = useQuery<{ users: UserRow[]; alertUserUsd: number }>({
    queryKey: ["/api/admin/costs/users", params, search],
    queryFn: async () => (await apiRequest("GET", `/api/admin/costs/users?${qs({ ...params, search })}`)).json(),
    staleTime: 30_000,
  });

  const d = ov.data;
  const fx = d?.fx.rate || 5;
  const chart = useMemo((): Record<string, any>[] => (d?.seriesByProvider || []).map((s) => ({
    ...s,
    label: (() => { try { return format(new Date(`${s.date}T12:00:00`), period.groupBy === "month" ? "MMM/yy" : "dd/MM", { locale: ptBR }); } catch { return s.date; } })(),
  })), [d?.seriesByProvider, period.groupBy]);
  const provsNoGrafico = PROVEDORES.filter((p) => chart.some((r) => r[p.id]));

  const refresh = () => { void ov.refetch(); void us.refetch(); };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Consumo e custos"
        description="Quanto a IA está custando, quem está usando e o resultado do período."
        icon={Coins}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-cost-settings">
              <Settings2 className="w-4 h-4 mr-2" /> Preços e acesso
            </Button>
            <Button variant="outline" size="sm" onClick={refresh} data-testid="button-refresh">
              <RefreshCw className={`w-4 h-4 mr-2 ${ov.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} showGroupBy />
      </AdminPageHeader>

      {d?.settings.iaAcesso !== "assinantes" && d && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p><b>IA liberada só para a equipe.</b> Assinantes veem as ferramentas mas não geram (seus créditos estão protegidos). Para liberar, vá em "Preços e acesso".</p>
        </div>
      )}

      {ov.error ? (
        <EmptyState icon={AlertTriangle} title="Não deu para carregar o consumo" description={(ov.error as any)?.message?.replace(/^\d+:\s*/, "") || "Tente de novo."} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Gasto com IA" icon={Sparkles} tone="danger" loading={ov.isLoading}
              value={formatBRLValue(d?.totals.costBrl)} hint={d ? usd(d.totals.costUsd) : undefined} testId="stat-ai-cost" />
            <StatCard label="Receita líquida" icon={Wallet} tone="success" colorValue loading={ov.isLoading}
              value={formatBRLValue(d?.revenue.netBrl)} hint={d ? `${formatBRLValue(d.revenue.grossBrl)} bruto` : undefined} testId="stat-net-revenue" />
            <StatCard label="Resultado" icon={TrendingUp} tone={d && d.profitBrl < 0 ? "danger" : "success"} colorValue loading={ov.isLoading}
              value={formatBRLValue(d?.profitBrl)} hint={d?.marginPct != null ? `margem de ${d.marginPct.toFixed(0)}%` : "sem receita no período"} testId="stat-profit" />
            <StatCard label="Gerações" icon={Users} loading={ov.isLoading}
              value={formatNumber(d?.totals.events)} hint={d ? `${formatNumber(d.totals.users)} usuário${d.totals.users === 1 ? "" : "s"}` : undefined} testId="stat-events" />
          </StatGrid>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <ChartCard
              title="Gasto com IA por dia"
              description={`Em reais, por provedor (dólar a R$ ${fx.toFixed(2).replace(".", ",")}, ${d?.fx.source || "cotação"})`}
              loading={ov.isLoading}
              empty={!chart.length}
              emptyMessage="Nenhuma geração paga no período"
              height={410}
              className="xl:col-span-2"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={56} tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, k: any) => [formatBRLValue(Number(v)), PROVIDER_LABEL[k] || k]} />
                  <Legend formatter={(k) => PROVIDER_LABEL[k] || k} wrapperStyle={{ fontSize: 12 }} />
                  {provsNoGrafico.map((p, i) => (
                    <Bar key={p.id} dataKey={p.id} stackId="a" fill={p.cor} radius={i === provsNoGrafico.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="space-y-4">
              <ReceitaVsCusto d={d} loading={ov.isLoading} />
              <Saldos d={d} loading={ov.isLoading} />
            </div>
          </div>

          <Tabs defaultValue="ferramentas">
            <TabsList className="max-w-full overflow-x-auto justify-start">
              <TabsTrigger value="ferramentas">Por ferramenta</TabsTrigger>
              <TabsTrigger value="provedores">Por provedor</TabsTrigger>
              <TabsTrigger value="usuarios">Por usuário</TabsTrigger>
            </TabsList>

            <TabsContent value="ferramentas" className="mt-4">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {ov.isLoading ? <TableSkeleton rows={5} /> : !d?.byTool.length ? (
                  <EmptyState icon={Sparkles} title="Nenhuma geração no período" description="O consumo aparece aqui a partir da primeira geração paga." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ferramenta</TableHead>
                        <TableHead className="text-right">Gerações</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Usuários</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Custo médio</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-[22%] hidden lg:table-cell">Peso no gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.byTool.map((t) => {
                        const pct = d.totals.costUsd ? (t.costUsd / d.totals.costUsd) * 100 : 0;
                        return (
                          <TableRow key={t.tool}>
                            <TableCell className="font-medium">{toolLabel(t.tool)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(t.events)}</TableCell>
                            <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatNumber(t.users)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground hidden md:table-cell">{formatBRLValue(t.avgUsd * fx)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{formatBRLValue(t.costUsd * fx)}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <div className="flex items-center gap-2"><Progress value={pct} className="h-1.5 flex-1" /><span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span></div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="provedores" className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(d?.byProvider || []).map((p) => {
                  const pct = d!.totals.costUsd ? (p.costUsd / d!.totals.costUsd) * 100 : 0;
                  const cor = PROVEDORES.find((x) => x.id === p.provider)?.cor;
                  return (
                    <div key={p.provider} className="rounded-xl border bg-card shadow-sm p-4">
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} /><p className="text-sm font-medium">{PROVIDER_LABEL[p.provider] || p.provider}</p></div>
                      <p className="text-2xl font-semibold tabular-nums mt-2">{formatBRLValue(p.costUsd * fx)}</p>
                      <p className="text-xs text-muted-foreground">{usd(p.costUsd)} · {formatNumber(p.events)} chamadas · {pct.toFixed(0)}% do gasto</p>
                    </div>
                  );
                })}
                {!d?.byProvider.length && !ov.isLoading && <p className="text-sm text-muted-foreground">Sem consumo no período.</p>}
              </div>
            </TabsContent>

            <TabsContent value="usuarios" className="mt-4">
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="p-3 border-b">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9 h-9" />
                  </div>
                </div>
                {us.isLoading ? <TableSkeleton rows={6} /> : !us.data?.users.length ? (
                  <EmptyState icon={Users} title="Ninguém no período" description="Aparecem aqui os usuários que geraram com IA ou pagaram no período." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead className="hidden md:table-cell">Assinatura</TableHead>
                        <TableHead className="text-right">Gerações</TableHead>
                        <TableHead className="text-right">Gasto IA</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Pagou</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Resultado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {us.data.users.map((u) => (
                        <TableRow key={u.id} className="cursor-pointer" onClick={() => setUserId(u.id)} data-testid={`row-user-${u.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="min-w-0">
                                <p className="font-medium truncate max-w-[220px]">{u.name}</p>
                                <p className="text-xs text-muted-foreground truncate max-w-[220px]">{u.email}</p>
                              </div>
                              {u.alert && <StatusBadge tone="warning" dot>Consumo alto</StatusBadge>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell"><StatusBadge tone={u.status === "active" ? "success" : "neutral"}>{u.status === "active" ? "Ativa" : u.status || "—"}</StatusBadge></TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(u.events)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRLValue(u.costBrl)}</TableCell>
                          <TableCell className="text-right tabular-nums hidden sm:table-cell">{formatBRLValue(u.revenueBrl)}</TableCell>
                          <TableCell className={`text-right tabular-nums font-medium hidden sm:table-cell ${u.resultBrl < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatBRLValue(u.resultBrl)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            O gasto é estimado pelo consumo de cada geração (tokens, imagens, caracteres e créditos), com os preços de "Preços e acesso". O valor exato cobrado fica no painel de cada provedor.
          </p>
        </>
      )}

      <UserDetail id={userId} params={params} onClose={() => setUserId(null)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </AdminPage>
  );
}

function ReceitaVsCusto({ d, loading }: { d?: Overview; loading: boolean }) {
  if (loading || !d) return <div className="rounded-xl border bg-card shadow-sm h-[140px] animate-pulse" />;
  const receita = Math.max(0, d.revenue.netBrl), custo = d.totals.costBrl;
  const max = Math.max(receita, custo, 1);
  const linha = (rotulo: string, valor: number, cor: string) => (
    <div>
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{rotulo}</span><span className="font-semibold tabular-nums">{formatBRLValue(valor)}</span></div>
      <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(valor / max) * 100}%`, background: cor }} /></div>
    </div>
  );
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
      <p className="text-sm font-semibold">Receita x gasto com IA</p>
      {linha("Receita líquida", receita, "hsl(161, 84%, 33%)")}
      {linha("Gasto com IA", custo, "hsl(347, 77%, 55%)")}
      <p className="text-xs text-muted-foreground">
        {receita > 0 ? `A IA consome ${((custo / receita) * 100).toFixed(1).replace(".", ",")}% da receita` : "Sem receita no período"}
        {d.costPerPayingUserBrl != null ? ` · ${formatBRLValue(d.costPerPayingUserBrl)} por pagante` : ""}
      </p>
    </div>
  );
}

function Saldos({ d, loading }: { d?: Overview; loading: boolean }) {
  if (loading || !d) return <div className="rounded-xl border bg-card shadow-sm h-[220px] animate-pulse" />;
  const b = d.balances || {};
  const el = b.elevenlabs;
  const elPct = el?.limit ? Math.min(100, ((el.used || 0) / el.limit) * 100) : 0;
  const Item = ({ nome, link, rotuloLink, children }: { nome: string; link: string; rotuloLink: string; children: React.ReactNode }) => (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{nome}</p>
        <a href={link} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1 whitespace-nowrap">{rotuloLink} <ExternalLink className="w-3 h-3" /></a>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <p className="text-sm font-semibold mb-3">Saldos das contas</p>
      <div className="divide-y">
        <Item nome="ElevenLabs · caracteres do plano" link="https://elevenlabs.io/app/subscription" rotuloLink="Painel">
          {el && !el.error ? (
            <>
              <p className="text-sm font-semibold tabular-nums">{formatNumber(el.used)} <span className="font-normal text-muted-foreground">de {formatNumber(el.limit)}</span></p>
              <Progress value={elPct} className="h-1.5 mt-1.5" />
              <p className="text-[11px] text-muted-foreground mt-1">Plano {el.tier}{el.resetAt ? ` · renova em ${format(new Date(el.resetAt), "dd/MM", { locale: ptBR })}` : ""}</p>
            </>
          ) : <p className="text-xs text-muted-foreground">{el?.error ? `Não respondeu: ${el.error}` : "Chave não configurada"}</p>}
        </Item>
        <Item nome="Kie.ai · vídeo e avatar" link="https://kie.ai/billing" rotuloLink="Recarregar">
          {b.kie && !b.kie.error ? (
            <p className={`text-sm font-semibold tabular-nums ${(b.kie.credits || 0) <= 0 ? "text-red-600" : ""}`}>
              {formatNumber(Math.round(b.kie.credits || 0))} créditos <span className="font-normal text-muted-foreground">≈ {usd(b.kie.usd || 0)}</span>
            </p>
          ) : <p className="text-xs text-muted-foreground">{b.kie?.error ? `Não respondeu: ${b.kie.error}` : "Chave não configurada"}</p>}
        </Item>
        <Item nome="OpenAI · gasto real no mês" link="https://platform.openai.com/usage" rotuloLink="Painel">
          {b.openaiMonth?.usd != null
            ? <p className="text-sm font-semibold tabular-nums">{usd(b.openaiMonth.usd)}</p>
            : <p className="text-xs text-muted-foreground">{b.openaiMonth?.error ? `Não respondeu: ${b.openaiMonth.error}` : "Para ver aqui, crie uma chave de administrador na OpenAI e salve no Coolify como OPENAI_ADMIN_KEY."}</p>}
        </Item>
        <Item nome="Claude (Anthropic)" link="https://console.anthropic.com/settings/billing" rotuloLink="Painel">
          <p className="text-xs text-muted-foreground">Saldo e gasto real no console da Anthropic.</p>
        </Item>
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
          <DialogTitle>Preços e acesso</DialogTitle>
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

            <div>
              <Label>Quem pode usar a IA (gerar criativo, copy, voz, vídeo, Motion, e-book)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {([["admin", "Só a equipe", "Só administradores geram. Ninguém mais gasta seus créditos."], ["assinantes", "Assinantes", "Todos com plano completo podem gerar (com os limites por hora)."]] as const).map(([v, t, d]) => (
                  <button key={v} type="button" onClick={() => set({ iaAcesso: v })}
                    className={`rounded-lg border p-3 text-left text-sm transition ${(s.iaAcesso || "admin") === v ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                    <p className="font-medium">{t}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d}</p>
                  </button>
                ))}
              </div>
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
