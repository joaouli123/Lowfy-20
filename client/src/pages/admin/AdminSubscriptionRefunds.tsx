import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Undo2, RefreshCw, Hourglass, CheckCircle2, XCircle, Timer, Zap, HandCoins, Info, AlertTriangle, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, EmptyState, TableSkeleton, StatusBadge,
  formatBRLValue, formatNumber, type BadgeTone,
} from "@/components/admin";

interface Pedido {
  id: string; name: string; email: string; plan: string; method: string; brl: number; status: string; reason: string | null;
  adminNotes: string | null; createdAt: string; processedAt: string | null; processedBy: string | null; viaGateway: boolean;
  subscriptionStatus: string; daysAfterPayment: number | null; gateway: "asaas" | "podpay" | null;
}
interface Resp {
  kpis: {
    requested: number; requestedBrl: number; completed: number; completedBrl: number; viaGateway: number; rejected: number;
    avgHours: number | null; open: number; openBrl: number; oldestOpenAt: string | null;
  };
  requests: Pedido[];
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Aguardando", tone: "warning" },
  processing: { label: "Em andamento", tone: "info" },
  completed: { label: "Reembolsado", tone: "success" },
  rejected: { label: "Recusado", tone: "neutral" },
};
const nomeMetodo = (m: string) => (m === "pix" ? "Pix" : m === "credit_card" ? "Cartão" : m || "—");
const nomePlano = (p: string) => (p === "anual" ? "Anual" : p === "mensal" ? "Mensal" : p || "—");
const nomeGateway = (g: string | null) => (g === "asaas" ? "Asaas" : g === "podpay" ? "Podpay" : null);
const ha = (iso?: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true }) : "—");
const tempo = (h: number | null) => (h == null ? "—" : h < 1 ? "menos de 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`);
const aberto = (s: string) => s === "pending" || s === "processing";

export default function AdminSubscriptionRefunds() {
  const [period, setPeriod] = useState(defaultPeriod("3months"));
  const [status, setStatus] = useState("all");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Pedido | null>(null);
  const params = new URLSearchParams({ startDate: period.startDate, endDate: period.endDate, status }).toString();
  const q = useQuery<Resp>({
    queryKey: ["/api/admin/refunds/v2", params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/refunds/v2?${params}`)).json(),
    staleTime: 15_000,
  });
  const k = q.data?.kpis;
  const b = busca.trim().toLowerCase();
  const lista = (q.data?.requests || []).filter((r) => !b || `${r.name} ${r.email}`.toLowerCase().includes(b));
  // Mantém o painel aberto em sincronia depois de uma ação.
  useEffect(() => { if (sel && q.data) setSel(q.data.requests.find((r) => r.id === sel.id) || null); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminPage>
      <AdminPageHeader
        title="Reembolsos de assinatura"
        description="Pedidos de reembolso: estorne no gateway, registre o que foi devolvido por fora ou recuse."
        icon={Undo2}
        actions={
          <Button onClick={() => q.refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} />
      </AdminPageHeader>

      {k && k.open > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p><b>{k.open} pedido{k.open === 1 ? "" : "s"} esperando você</b> ({formatBRLValue(k.openBrl)}). O mais antigo chegou {ha(k.oldestOpenAt)}. Esses clientes já estão sem acesso.</p>
        </div>
      )}

      {q.error ? (
        <EmptyState icon={Info} title="Não deu para carregar" description={String((q.error as any)?.message || "").replace(/^\d+:\s*/, "") || "Tente de novo."} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Pedidos no período" icon={Undo2} loading={q.isLoading} value={formatNumber(k?.requested)} hint={k ? formatBRLValue(k.requestedBrl) : undefined} testId="stat-requested" />
            <StatCard label="Esperando decisão" icon={Hourglass} tone={k?.open ? "warning" : "default"} colorValue={!!k?.open} loading={q.isLoading} value={formatNumber(k?.open)} hint={k ? formatBRLValue(k.openBrl) : undefined} testId="stat-open" />
            <StatCard label="Reembolsados" icon={CheckCircle2} tone="success" loading={q.isLoading} value={formatBRLValue(k?.completedBrl)}
              hint={k ? `${formatNumber(k.completed)} pedidos · ${formatNumber(k.viaGateway)} pelo gateway` : undefined} testId="stat-completed" />
            <StatCard label="Tempo para resolver" icon={Timer} loading={q.isLoading} value={tempo(k?.avgHours ?? null)} hint={k ? `${formatNumber(k.rejected)} recusados` : undefined} testId="stat-time" />
          </StatGrid>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou e-mail" className="pl-9 h-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[190px]" data-testid="select-refund-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Esperando decisão</SelectItem>
                  <SelectItem value="completed">Reembolsados</SelectItem>
                  <SelectItem value="rejected">Recusados</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">Pedidos em aberto aparecem sempre, mesmo fora do período.</span>
            </div>
            {q.isLoading ? <TableSkeleton rows={6} /> : !lista.length ? (
              <EmptyState icon={Undo2} title="Nenhum pedido de reembolso" description="Mude o período ou o filtro." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Assinatura</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Pedido</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((r) => {
                    const st = STATUS[r.status] || { label: r.status, tone: "neutral" as BadgeTone };
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setSel(r)} data-testid={`row-refund-${r.id}`}>
                        <TableCell>
                          <p className="font-medium truncate max-w-[200px]">{r.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.email}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {nomePlano(r.plan)} · {nomeMetodo(r.method)}
                          {r.daysAfterPayment != null && <p className="text-xs text-muted-foreground">pediu {r.daysAfterPayment} dia{r.daysAfterPayment === 1 ? "" : "s"} após pagar</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatBRLValue(r.brl)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">{ha(r.createdAt)}</TableCell>
                        <TableCell><StatusBadge tone={st.tone} dot>{st.label}</StatusBadge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            O cliente perde o acesso assim que pede o reembolso. Pedidos de cartão são estornados no gateway automaticamente; se falhar, ficam aqui "em andamento" com o motivo.
          </p>
        </>
      )}

      <Detalhe p={sel} onClose={() => setSel(null)} />
    </AdminPage>
  );
}

function Detalhe({ p, onClose }: { p: Pedido | null; onClose: () => void }) {
  const { toast } = useToast();
  const [modo, setModo] = useState<null | "manual" | "reject">(null);
  const [nota, setNota] = useState("");
  useEffect(() => { setModo(null); setNota(""); }, [p?.id]);
  const acao = useMutation({
    mutationFn: async (tipo: "gateway" | "manual" | "reject") =>
      (await apiRequest("POST", `/api/admin/refunds/v2/${p!.id}/${tipo}`, tipo === "gateway" ? {} : { notes: nota })).json(),
    onSuccess: (r: any, tipo) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/refunds/v2"] });
      toast({
        title: tipo === "gateway" ? "Estornado" : tipo === "manual" ? "Registrado como devolvido" : "Pedido recusado",
        description: tipo === "gateway" ? r?.detail : tipo === "reject" ? (r?.accessRestored ? "O acesso do cliente foi devolvido." : "A assinatura não estava paga; o acesso não mudou.") : "O cliente recebe o e-mail de reembolso concluído.",
      });
      setModo(null); setNota("");
    },
    onError: (e: any) => toast({ title: "Não deu certo", description: String(e?.message || "").replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const st = p ? STATUS[p.status] || { label: p.status, tone: "neutral" as BadgeTone } : null;
  const gw = nomeGateway(p?.gateway || null);
  return (
    <Sheet open={!!p} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{p?.name}</SheetTitle>
          <SheetDescription>{p?.email}</SheetDescription>
        </SheetHeader>
        {p && st && (
          <div className="mt-5 space-y-5">
            <div className="rounded-lg border divide-y text-sm">
              <Linha r="Situação"><StatusBadge tone={st.tone} dot>{st.label}</StatusBadge></Linha>
              <Linha r="Valor"><b className="tabular-nums">{formatBRLValue(p.brl)}</b></Linha>
              <Linha r="Assinatura">{nomePlano(p.plan)} · {nomeMetodo(p.method)}</Linha>
              <Linha r="Pedido em">{format(new Date(p.createdAt), "dd/MM/yy 'às' HH:mm")}{p.daysAfterPayment != null ? ` · ${p.daysAfterPayment} d após pagar` : ""}</Linha>
              <Linha r="Gateway">{gw || "Sem referência (devolução manual)"}</Linha>
              {p.processedAt && <Linha r="Resolvido">{format(new Date(p.processedAt), "dd/MM/yy HH:mm")}{p.processedBy ? ` · ${p.processedBy}` : ""}{p.status === "completed" ? (p.viaGateway ? " · pelo gateway" : " · por fora") : ""}</Linha>}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Motivo do cliente</p>
              <p className="text-sm whitespace-pre-wrap">{p.reason || "Não informado"}</p>
            </div>
            {p.adminNotes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Anotações</p>
                <p className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{p.adminNotes}</p>
              </div>
            )}

            {aberto(p.status) && !modo && (
              <div className="space-y-2">
                {gw && (
                  <Button className="w-full" onClick={() => acao.mutate("gateway")} disabled={acao.isPending} data-testid="button-refund-gateway">
                    {acao.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Estornar {formatBRLValue(p.brl)} no {gw}
                  </Button>
                )}
                <Button variant={gw ? "outline" : "default"} className="w-full" onClick={() => setModo("manual")} data-testid="button-refund-manual">
                  <HandCoins className="w-4 h-4 mr-2" /> Já devolvi por fora
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setModo("reject")} data-testid="button-refund-reject">
                  <XCircle className="w-4 h-4 mr-2" /> Recusar e devolver o acesso
                </Button>
              </div>
            )}
            {modo && (
              <div className="space-y-3 rounded-lg border p-3">
                <Label htmlFor="nota">{modo === "manual" ? "Como foi devolvido (opcional)" : "Motivo da recusa"}</Label>
                <Textarea id="nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1000}
                  placeholder={modo === "manual" ? "Ex.: Pix enviado em 18/10 pelo banco" : "Ex.: pedido fora do prazo de 7 dias"} />
                {modo === "reject" && <p className="text-xs text-muted-foreground">A assinatura volta a ficar ativa. As comissões de afiliado canceladas no pedido não voltam sozinhas.</p>}
                <div className="flex gap-2">
                  <Button className="flex-1" variant={modo === "reject" ? "destructive" : "default"} disabled={acao.isPending || (modo === "reject" && nota.trim().length < 3)} onClick={() => acao.mutate(modo)}>
                    {modo === "manual" ? "Confirmar devolução" : "Recusar pedido"}
                  </Button>
                  <Button variant="outline" onClick={() => setModo(null)}>Voltar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Linha({ r, children }: { r: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-3 py-2"><span className="text-muted-foreground">{r}</span><span className="text-right">{children}</span></div>;
}
