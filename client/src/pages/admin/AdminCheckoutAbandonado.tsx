import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingCart, RefreshCw, Search, ChevronLeft, ChevronRight, MoreHorizontal, Copy, MessageCircle, Mail, Send,
  CircleDollarSign, Undo2, Percent, Hourglass, Info, ExternalLink, CheckCircle2, AlertTriangle, Phone,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, PeriodFilter, defaultPeriod, ChartCard, EmptyState, TableSkeleton,
  StatusBadge, CHART_COLORS, gridProps, axisProps, tooltipStyle, formatBRLValue, formatNumber,
} from "@/components/admin";

interface Checkout {
  id: string; name: string; email: string; phone: string; plan: string; brl: number; method: string; status: string;
  createdAt: string; paidAt: string | null; pixExpiresAt: string | null; emailsSent: number; whatsappSent: number;
  lastContactAt: string | null; subscribedElsewhere: boolean; recovered: boolean; checkoutUrl: string;
}
interface Resp {
  whatsappConnected: boolean;
  kpis: {
    open: number; openBrl: number; recovered: number; recoveredBrl: number; recoveryRate: number | null; inRecovery: number; noContact: number;
    emails: { sent: number; clicks: number }; whatsapp: { sent: number; clicks: number };
  };
  series: { date: string; abandoned: number; recovered: number }[];
  page: number; perPage: number; total: number;
  checkouts: Checkout[];
}

const ha = (iso?: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true }) : "—");
const nomePlano = (p: string) => (p === "anual" ? "Anual" : p === "mensal" ? "Mensal" : p || "—");
const nomeMetodo = (m: string) => (m === "pix" ? "Pix" : m === "credit_card" ? "Cartão" : m === "boleto" ? "Boleto" : m || "—");
const primeiroNome = (n: string) => (n || "").trim().split(/\s+/)[0] || "";
const msgPadrao = (c: Checkout) =>
  `Oi ${primeiroNome(c.name)}! Aqui é da Lowfy.\n\nVi que você começou a assinatura ${nomePlano(c.plan)} e não finalizou. Ficou alguma dúvida? Posso te ajudar por aqui.\n\nSe quiser concluir, é só continuar de onde parou:\n${c.checkoutUrl}`;

export default function AdminCheckoutAbandonado() {
  const { toast } = useToast();
  const [period, setPeriod] = useState(defaultPeriod("30days"));
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [aberto, setAberto] = useState<Checkout | null>(null);
  const [envio, setEnvio] = useState<{ c: Checkout; canal: "whatsapp" | "email" } | null>(null);
  useEffect(() => { const t = setTimeout(() => { setBusca(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [filter, period.startDate, period.endDate]);

  const params = new URLSearchParams({ startDate: period.startDate, endDate: period.endDate, filter, search: busca, page: String(page) }).toString();
  const q = useQuery<Resp>({
    queryKey: ["/api/admin/checkout/v2", params],
    queryFn: async () => (await apiRequest("GET", `/api/admin/checkout/v2?${params}`)).json(),
    staleTime: 20_000,
  });
  const d = q.data;
  const k = d?.kpis;
  const paginas = d ? Math.max(1, Math.ceil(d.total / d.perPage)) : 1;
  const dados = (d?.series || []).map((s) => ({ ...s, label: format(new Date(`${s.date}T12:00:00`), "dd/MM") }));

  const copiar = async (c: Checkout) => {
    try { await navigator.clipboard.writeText(c.checkoutUrl); toast({ title: "Link copiado", description: "O link leva direto ao checkout desse plano." }); }
    catch { toast({ title: "Não deu para copiar", variant: "destructive" }); }
  };
  const abrirMeuWhats = (c: Checkout) => {
    const tel = (c.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${tel.startsWith("55") ? tel : `55${tel}`}?text=${encodeURIComponent(msgPadrao(c))}`, "_blank", "noopener");
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Checkout abandonado"
        description="Quem começou a assinar e não pagou, o que a recuperação já enviou e quem voltou."
        icon={ShoppingCart}
        actions={
          <Button onClick={() => q.refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 mr-2 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      >
        <PeriodFilter value={period} onChange={setPeriod} />
      </AdminPageHeader>

      {d && !d.whatsappConnected && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>O WhatsApp da Lowfy está desconectado: a recuperação automática por WhatsApp está parada. <Link href="/admin/whatsapp" className="font-semibold underline">Conectar agora</Link></p>
        </div>
      )}

      {q.error ? (
        <EmptyState icon={Info} title="Não deu para carregar" description={String((q.error as any)?.message || "").replace(/^\d+:\s*/, "") || "Tente de novo."} />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Em aberto" icon={Hourglass} tone="warning" loading={q.isLoading} value={formatNumber(k?.open)} hint={k ? `${formatBRLValue(k.openBrl)} parados` : undefined} testId="stat-open" />
            <StatCard label="Recuperados" icon={Undo2} tone="success" colorValue loading={q.isLoading} value={formatNumber(k?.recovered)} hint={k ? `${formatBRLValue(k.recoveredBrl)} que voltaram` : undefined} testId="stat-recovered" />
            <StatCard label="Taxa de recuperação" icon={Percent} tone="info" loading={q.isLoading} value={k?.recoveryRate != null ? `${k.recoveryRate.toFixed(0)}%` : "—"} hint={k ? `${formatNumber(k.inRecovery)} em recuperação agora` : undefined} />
            <StatCard label="Mensagens enviadas" icon={Send} loading={q.isLoading} value={formatNumber(k ? k.emails.sent + k.whatsapp.sent : undefined)}
              hint={k ? `${formatNumber(k.emails.sent)} e-mails · ${formatNumber(k.whatsapp.sent)} WhatsApp · ${formatNumber(k.emails.clicks + k.whatsapp.clicks)} cliques` : undefined} />
          </StatGrid>

          <ChartCard title="Abandonos e recuperações por dia" loading={q.isLoading} empty={!dados.length} height={220}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={28} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="abandoned" name="Começaram e não pagaram" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="recovered" name="Recuperados" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, e-mail ou telefone" className="pl-9 h-9" data-testid="input-search-checkout" />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-9 w-[200px]" data-testid="select-checkout-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Em aberto</SelectItem>
                  <SelectItem value="uncontacted">Em aberto, sem contato</SelectItem>
                  <SelectItem value="recovered">Recuperados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">{d ? `${formatNumber(d.total)} checkout${d.total === 1 ? "" : "s"}` : ""}</span>
            </div>
            {q.isLoading ? <TableSkeleton rows={8} /> : !d?.checkouts.length ? (
              <EmptyState icon={ShoppingCart} title={filter === "recovered" ? "Nenhum recuperado no período" : "Nenhum checkout abandonado"} description="Mude o período ou o filtro." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Plano</TableHead>
                    <TableHead className="hidden sm:table-cell">Quando</TableHead>
                    <TableHead>Recuperação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.checkouts.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setAberto(c)} data-testid={`row-checkout-${c.id}`}>
                      <TableCell>
                        <p className="font-medium truncate max-w-[200px]">{c.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email || c.phone || "sem contato"}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm">{nomePlano(c.plan)} · <span className="tabular-nums">{formatBRLValue(c.brl)}</span></p>
                        <p className="text-xs text-muted-foreground">{nomeMetodo(c.method)}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">{ha(c.createdAt)}</TableCell>
                      <TableCell>
                        {c.recovered ? <StatusBadge tone="success" dot>Pagou {ha(c.paidAt)}</StatusBadge>
                          : c.subscribedElsewhere ? <StatusBadge tone="info">Assinou em outra compra</StatusBadge>
                          : c.emailsSent + c.whatsappSent === 0 ? <StatusBadge tone="neutral">Sem contato ainda</StatusBadge>
                          : (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {c.emailsSent > 0 && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{c.emailsSent}</span>}
                              {c.whatsappSent > 0 && <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{c.whatsappSent}</span>}
                              <span>· último {ha(c.lastContactAt)}</span>
                            </div>
                          )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`actions-${c.id}`}><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuItem disabled={!c.phone || !d.whatsappConnected} onClick={() => setEnvio({ c, canal: "whatsapp" })}>
                              <MessageCircle className="w-4 h-4 mr-2 text-emerald-600" /> Enviar pelo WhatsApp da Lowfy
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!c.email} onClick={() => setEnvio({ c, canal: "email" })}>
                              <Mail className="w-4 h-4 mr-2 text-sky-600" /> Enviar e-mail
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={!c.phone} onClick={() => abrirMeuWhats(c)}>
                              <Phone className="w-4 h-4 mr-2" /> Abrir no meu WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copiar(c)}>
                              <Copy className="w-4 h-4 mr-2" /> Copiar link do checkout
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {d && paginas > 1 && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t text-sm">
                <span className="text-muted-foreground">Página {page} de {paginas}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-prev-page"><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)} data-testid="button-next-page"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            A recuperação automática manda 3 WhatsApps (30 min, 24 h e 48 h com cupom de 50%) e 4 e-mails (15 min, na manhã e na noite seguintes, e no outro dia com cupom de 50%). "Recuperado" é quem recebeu alguma mensagem e depois pagou.
          </p>
        </>
      )}

      <Detalhe c={aberto} onClose={() => setAberto(null)} onSend={(canal) => aberto && setEnvio({ c: aberto, canal })} whatsappOk={!!d?.whatsappConnected} onCopy={copiar} />
      <Envio envio={envio} onClose={() => setEnvio(null)} />
    </AdminPage>
  );
}

function Detalhe({ c, onClose, onSend, whatsappOk, onCopy }: { c: Checkout | null; onClose: () => void; onSend: (canal: "whatsapp" | "email") => void; whatsappOk: boolean; onCopy: (c: Checkout) => void }) {
  const h = useQuery<{ history: { channel: string; sequence: number; type: string; sentAt: string | null; status: string; clickedAt: string | null; discountCode: string | null }[] }>({
    queryKey: ["/api/admin/checkout/v2/history", c?.id],
    queryFn: async () => (await apiRequest("GET", `/api/admin/checkout/v2/${c!.id}/history`)).json(),
    enabled: !!c,
  });
  const rotulo = (x: { channel: string; sequence: number; type: string }) =>
    x.sequence === 0 ? "Mensagem manual" : x.channel === "email" ? `E-mail automático ${x.sequence} de 4` : `WhatsApp automático ${x.sequence} de 3`;
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{c?.name || "Checkout"}</SheetTitle>
          <SheetDescription>{nomePlano(c?.plan || "")} · {formatBRLValue(c?.brl)} · {nomeMetodo(c?.method || "")}</SheetDescription>
        </SheetHeader>
        {c && (
          <div className="mt-5 space-y-6">
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-muted-foreground">E-mail</span><span className="truncate">{c.email || "—"}</span></div>
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-muted-foreground">Telefone</span><span>{c.phone || "—"}</span></div>
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-muted-foreground">Começou</span><span>{format(new Date(c.createdAt), "dd/MM/yy 'às' HH:mm")}</span></div>
              <div className="flex justify-between gap-3 px-3 py-2"><span className="text-muted-foreground">Situação</span>
                {c.recovered ? <StatusBadge tone="success">Pagou</StatusBadge> : c.subscribedElsewhere ? <StatusBadge tone="info">Assinou em outra compra</StatusBadge> : <StatusBadge tone="warning">Não pagou</StatusBadge>}
              </div>
            </div>
            {!c.recovered && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" disabled={!c.phone || !whatsappOk} onClick={() => onSend("whatsapp")}><MessageCircle className="w-4 h-4 mr-2" /> WhatsApp</Button>
                <Button size="sm" variant="outline" disabled={!c.email} onClick={() => onSend("email")}><Mail className="w-4 h-4 mr-2" /> E-mail</Button>
                <Button size="sm" variant="ghost" className="col-span-2" onClick={() => onCopy(c)}><Copy className="w-4 h-4 mr-2" /> Copiar link do checkout</Button>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold mb-2">Mensagens enviadas</p>
              {h.isLoading ? <TableSkeleton rows={3} /> : !h.data?.history.length ? <p className="text-sm text-muted-foreground">Nada enviado ainda.</p> : (
                <ol className="relative border-l pl-4 space-y-4">
                  {h.data.history.map((x, i) => (
                    <li key={i} className="text-sm">
                      <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${x.channel === "email" ? "bg-sky-500" : "bg-emerald-500"}`} />
                      <p className="font-medium flex items-center gap-1.5">{x.channel === "email" ? <Mail className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}{rotulo(x)}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.sentAt ? format(new Date(x.sentAt), "dd/MM 'às' HH:mm") : "agendado"}
                        {x.discountCode ? ` · cupom ${x.discountCode}` : ""}
                        {x.clickedAt ? " · clicou no link" : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <a href={c.checkoutUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">Abrir o checkout <ExternalLink className="w-3 h-3" /></a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Envio({ envio, onClose }: { envio: { c: Checkout; canal: "whatsapp" | "email" } | null; onClose: () => void }) {
  const { toast } = useToast();
  const [texto, setTexto] = useState("");
  const [assunto, setAssunto] = useState("");
  useEffect(() => {
    if (envio) { setTexto(msgPadrao(envio.c)); setAssunto(`${primeiroNome(envio.c.name) || "Olá"}, sua assinatura da Lowfy está te esperando`); }
  }, [envio]);
  const m = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/checkout/v2/${envio!.c.id}/send`, { channel: envio!.canal, message: texto, subject: assunto })).json(),
    onSuccess: () => {
      toast({ title: envio?.canal === "email" ? "E-mail enviado" : "WhatsApp enviado", description: `Para ${envio?.c.name}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checkout/v2"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/checkout/v2/history"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Não enviou", description: String(e?.message || "").replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });
  const email = envio?.canal === "email";
  return (
    <Sheet open={!!envio} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">{email ? <Mail className="w-5 h-5 text-sky-600" /> : <MessageCircle className="w-5 h-5 text-emerald-600" />}{email ? "Enviar e-mail" : "Enviar pelo WhatsApp da Lowfy"}</SheetTitle>
          <SheetDescription>Para {envio?.c.name} · {email ? envio?.c.email : envio?.c.phone}</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          {email && (
            <div className="space-y-1.5">
              <Label htmlFor="assunto">Assunto</Label>
              <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={140} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="msg">Mensagem</Label>
            <Textarea id="msg" value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} maxLength={2000} className="text-sm" data-testid="textarea-recovery-message" />
            <p className="text-xs text-muted-foreground">O link já leva para o checkout do plano que a pessoa escolheu.</p>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => m.mutate()} disabled={m.isPending || texto.trim().length < 5} data-testid="button-send-recovery">
              {m.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Enviar
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Fica registrado no histórico do checkout e não atrapalha as mensagens automáticas.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
