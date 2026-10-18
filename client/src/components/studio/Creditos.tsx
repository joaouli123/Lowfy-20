import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Coins, Check, Copy, Loader2, Receipt, Sparkles, Gift, ShieldCheck, ArrowLeft, History } from "lucide-react";

interface Pacote { id: string; nome: string; creditos: number; centavos: number; destaque?: boolean }
interface Linha { ferramenta: string; creditos: number; unidade: string }
interface Mov { delta: number; tipo: string; ferramenta: string | null; descricao: string | null; saldo_depois: number; created_at: string }
interface Creditos {
  saldo: number; bonus: number; total: number; expiraEm: string | null; ilimitado: boolean; assinante: boolean; bonusMensal: number;
  pacotes: Pacote[]; tabela: Linha[]; extrato: Mov[]; liberado: boolean;
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");

export function useCreditos() {
  const qc = useQueryClient();
  const q = useQuery<Creditos>({
    queryKey: ["/api/creditos"],
    queryFn: async () => (await apiRequest("GET", "/api/creditos")).json(),
    staleTime: 15_000,
  });
  useEffect(() => {
    const atualizar = () => void qc.invalidateQueries({ queryKey: ["/api/creditos"] });
    window.addEventListener("lowfy:creditos", atualizar);
    return () => window.removeEventListener("lowfy:creditos", atualizar);
  }, [qc]);
  return q;
}

/** Barra do Estúdio: saldo, tabela de preços, extrato e compra de créditos. */
export default function CreditosBar() {
  const { data } = useCreditos();
  const [compra, setCompra] = useState(false);
  const [falta, setFalta] = useState<{ custo: number; saldo: number } | null>(null);

  // Geração sem saldo: abre a compra já explicando quanto falta.
  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setFalta({ custo: Number(d.custo) || 0, saldo: Number(d.saldo) || 0 });
      setCompra(true);
    };
    window.addEventListener("lowfy:sem-creditos", abrir);
    return () => window.removeEventListener("lowfy:sem-creditos", abrir);
  }, []);

  if (!data) return null;
  if (!data.ilimitado && !data.liberado) return null; // IA pausada pela equipe: não vende crédito
  if (data.ilimitado) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm shadow-sm">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span><b>Equipe:</b> você gera sem gastar créditos. O custo real aparece em Consumo e custos.</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] flex items-center justify-center flex-shrink-0">
            <Coins className="w-[18px] h-[18px] text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums" data-testid="creditos-saldo">{num(data.total)} créditos</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {data.bonus > 0 ? `${num(data.bonus)} de bônus do mês + ${num(data.saldo)} comprados` : data.assinante ? "Bônus do mês já usado" : "Compre créditos para gerar com IA"}
              {data.expiraEm ? ` · válidos até ${new Date(data.expiraEm).toLocaleDateString("pt-BR")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9"><Receipt className="w-3.5 h-3.5 mr-1.5" /> Preços</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <p className="text-sm font-semibold mb-2">Quanto custa cada geração</p>
              <div className="divide-y">
                {data.tabela.map((l) => (
                  <div key={l.ferramenta} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                    <span>{l.ferramenta}<span className="block text-[11px] text-muted-foreground">{l.unidade}</span></span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">{num(l.creditos)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Se a geração falhar, os créditos voltam sozinhos.</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9"><History className="w-3.5 h-3.5 mr-1.5" /> Extrato</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm font-semibold mb-2">Últimas movimentações</p>
              {!data.extrato.length ? <p className="text-[12px] text-muted-foreground">Nada por aqui ainda.</p> : (
                <div className="divide-y">
                  {data.extrato.map((m, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-1.5 text-[12px]">
                      <span className="min-w-0">
                        <span className="block truncate">{m.descricao || m.tipo}</span>
                        <span className="text-[11px] text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      </span>
                      <span className={`font-semibold tabular-nums whitespace-nowrap ${m.delta >= 0 ? "text-emerald-600" : ""}`}>{m.delta > 0 ? "+" : ""}{num(m.delta)}</span>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-9" onClick={() => { setFalta(null); setCompra(true); }} data-testid="button-comprar-creditos">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Comprar créditos
          </Button>
        </div>
      </div>
      <CompraDialog open={compra} onClose={() => setCompra(false)} dados={data} falta={falta} />
    </>
  );
}

function CompraDialog({ open, onClose, dados, falta }: { open: boolean; onClose: () => void; dados: Creditos; falta: { custo: number; saldo: number } | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pacote, setPacote] = useState<string>("pro");
  const [cpf, setCpf] = useState("");
  const [pedeCpf, setPedeCpf] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pix, setPix] = useState<{ pedidoId: string; pix: string; valor: number; creditos: number } | null>(null);
  const [pago, setPago] = useState(false);

  useEffect(() => { if (!open) { setPix(null); setPago(false); setPedeCpf(false); } }, [open]);

  // Sugere o menor pacote que cobre o que faltou.
  useEffect(() => {
    if (!open || !falta) return;
    const precisa = Math.max(0, falta.custo - falta.saldo);
    const p = dados.pacotes.find((x) => x.creditos >= precisa) || dados.pacotes[dados.pacotes.length - 1];
    if (p) setPacote(p.id);
  }, [open, falta, dados.pacotes]);

  // Enquanto o Pix está na tela, confere o pagamento.
  useEffect(() => {
    if (!pix || pago) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/creditos/pedido/${pix.pedidoId}`, { credentials: "include" });
        const j = await r.json();
        if (vivo && j.status === "pago") {
          setPago(true);
          void qc.invalidateQueries({ queryKey: ["/api/creditos"] });
          toast({ title: "Pagamento confirmado!", description: `+${num(pix.creditos)} créditos na sua conta.` });
        }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => { vivo = false; clearInterval(t); };
  }, [pix, pago, qc, toast]);

  const escolhido = useMemo(() => dados.pacotes.find((p) => p.id === pacote), [dados.pacotes, pacote]);

  const gerarPix = async () => {
    setGerando(true);
    try {
      const r = await fetch("/api/creditos/comprar", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacote, cpf: cpf || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.code === "PRECISA_CPF") { setPedeCpf(true); return; }
      if (!r.ok) throw new Error(j.message || "Não foi possível gerar o Pix");
      setPix(j);
    } catch (e: any) {
      toast({ title: "Erro ao gerar o Pix", description: e?.message, variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pago ? "Créditos liberados" : pix ? "Pague com Pix" : "Comprar créditos"}</DialogTitle>
          <DialogDescription>
            {pago ? "Já pode voltar a gerar." : pix ? "Escaneie o QR code ou copie o código. Os créditos entram assim que o pagamento cair."
              : falta ? `Essa geração custa ${num(falta.custo)} créditos e você tem ${num(falta.saldo)}.` : "Créditos valem 12 meses e servem para todas as ferramentas do Estúdio."}
          </DialogDescription>
        </DialogHeader>

        {pago ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-7 h-7 text-emerald-600" /></div>
            <p className="text-sm font-semibold">+{num(pix!.creditos)} créditos</p>
            <Button onClick={onClose}>Continuar</Button>
          </div>
        ) : pix ? (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl border bg-white p-4">
              <QRCodeSVG value={pix.pix} size={208} level="M" />
            </div>
            <div className="flex gap-2">
              <Input readOnly value={pix.pix} className="font-mono text-[11px]" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(pix.pix); toast({ title: "Código Pix copiado" }); }}>
                <Copy className="w-4 h-4 mr-1.5" /> Copiar
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Aguardando o pagamento…</span>
              <b>{brl(pix.valor)}</b>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPix(null)}><ArrowLeft className="w-4 h-4 mr-1.5" /> Trocar pacote</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              {dados.pacotes.map((p) => {
                const ativo = p.id === pacote;
                const porCredito = p.centavos / p.creditos / 100;
                return (
                  <button key={p.id} type="button" onClick={() => setPacote(p.id)}
                    className={`relative flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${ativo ? "border-[color-mix(in_srgb,var(--primary)_60%,transparent)] bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] shadow-sm" : "hover:bg-muted"}`}>
                    <span className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${ativo ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>{ativo && <Check className="w-3 h-3 text-white" />}</span>
                      <span>
                        <span className="block text-sm font-semibold">{p.nome} · {num(p.creditos)} créditos</span>
                        <span className="block text-[11px] text-muted-foreground">R$ {porCredito.toFixed(3).replace(".", ",")} por crédito</span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold">{brl(p.centavos)}</span>
                      {p.destaque && <span className="text-[10px] font-semibold text-primary">Mais escolhido</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {dados.assinante && (
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-primary" /> Como assinante, você ganha {dados.bonusMensal} créditos de bônus todo mês.</p>
            )}
            {pedeCpf && (
              <div>
                <p className="text-[12px] font-medium mb-1">CPF ou CNPJ (para emitir o Pix)</p>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" autoFocus />
              </div>
            )}
            <Button className="w-full h-11" disabled={gerando || !escolhido || (pedeCpf && cpf.replace(/\D/g, "").length < 11)} onClick={() => void gerarPix()}>
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gerar Pix de {escolhido ? brl(escolhido.centavos) : ""}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">Pagamento por Pix. Créditos válidos por 12 meses. Se uma geração falhar, os créditos voltam.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
