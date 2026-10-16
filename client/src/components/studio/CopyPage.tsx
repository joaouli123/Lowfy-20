import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Type, FileText, Eye, Copy as CopyIcon, Download, ChevronDown, Wand2, RotateCcw, Check, Mic } from "lucide-react";
import { useStudio } from "./store";
import {
  FieldLabel, FormFooter, FormPanel, MissingHint, PageGrid, PageHeader, PillGroup, PreviewLoading, PreviewPanel,
  missingOf, selectCls, useLocalForm,
} from "./page-kit";

const OBJETIVOS = ["Vender um produto", "Gerar leads", "Divulgar promoção", "Lançamento", "Engajamento", "Tráfego para o site"];
const CTAS = ["Garanta o seu agora!", "Compre agora", "Saiba mais", "Fale com a gente no WhatsApp", "Cadastre-se grátis", "Aproveite a oferta"];
const TONS = [
  { v: "direto", label: "Direto" }, { v: "profissional", label: "Profissional" },
  { v: "emocional", label: "Emocional" }, { v: "descontraido", label: "Descontraído" },
] as const;
const CANAIS = [
  { v: "instagram", label: "Instagram" }, { v: "whatsapp", label: "WhatsApp" },
  { v: "landing", label: "Landing page" }, { v: "anuncio", label: "Anúncio" },
] as const;
const TAMANHOS = [{ v: "curto", label: "Curto" }, { v: "medio", label: "Médio" }, { v: "longo", label: "Longo" }] as const;

interface CopyKit { headline: string; subheadline: string; texto: string; cta: string; variacoes: string[] }

const DEFAULTS = {
  produto: "", objetivo: "", publico: "", oferta: "", beneficios: "", cta: "", observacoes: "",
  tom: "direto" as string, canal: "instagram" as string, tamanho: "curto" as string,
};

const SAMPLE: CopyKit = {
  headline: "Mais desempenho no seu dia a dia",
  subheadline: "Tênis esportivo com 50% OFF apenas hoje.",
  texto: "Conforto, leveza e tecnologia para você ir mais longe. Nosso tênis esportivo é ideal para quem busca performance, sem abrir mão do estilo.",
  cta: "Garanta o seu agora!",
  variacoes: ["Seu próximo passo para uma vida mais ativa", "Conforto que acompanha o seu ritmo", "Qualidade e estilo em todos os momentos"],
};

export default function CopyPage() {
  const { brief, addAsset, setScript, setTab } = useStudio();
  const { toast } = useToast();
  const [f, patch, reset] = useLocalForm("copy", DEFAULTS);
  const [out, setOut] = useState<CopyKit | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const missing = missingOf([
    ["produto", f.produto], ["objetivo", f.objetivo], ["público", f.publico],
    ["oferta", f.oferta], ["benefícios", f.beneficios], ["CTA", f.cta],
  ]);

  const run = async () => {
    setBusy(true);
    try {
      const r = await apiRequest("POST", "/api/ai-studio/copy-kit", { ...f, idioma: brief.lang });
      const d = (await r.json()) as CopyKit;
      setOut(d);
      addAsset({ kind: "copy", text: fullText(d), label: f.produto || "Copy", from: "Copy" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar copy", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const shown = out || SAMPLE;
  const isSample = !out;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const download = (ext: "txt" | "md") => {
    const body = ext === "md"
      ? `# ${shown.headline}\n\n_${shown.subheadline}_\n\n${shown.texto}\n\n**${shown.cta}**\n\n## Variações de headline\n${shown.variacoes.map((v) => `- ${v}`).join("\n")}\n`
      : fullText(shown);
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `copy-${(f.produto || "lowfy").slice(0, 30)}.${ext}` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Type}
        title="Geração de Copy"
        sub="Crie textos persuasivos para anúncios, páginas e redes sociais com poucos dados."
        tip="informe benefício, oferta e público para uma copy mais forte."
      />

      <PageGrid
        form={
          <FormPanel
            icon={FileText}
            title="Informações da copy"
            sub="Preencha o básico e deixe a IA montar o texto para você."
            footer={
              <div className="space-y-3">
                <FormFooter onClear={() => { reset(); setOut(null); }} onSubmit={() => void run()} busy={busy} disabled={missing.length > 0} label="Gerar copy" busyLabel="Escrevendo…" icon={Wand2} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
              <div>
                <FieldLabel required>Produto ou serviço</FieldLabel>
                <Input value={f.produto} onChange={(e) => patch({ produto: e.target.value })} placeholder="Ex.: tênis esportivo, curso de inglês, suplemento..." />
              </div>
              <div>
                <FieldLabel required>Objetivo</FieldLabel>
                <select value={f.objetivo} onChange={(e) => patch({ objetivo: e.target.value })} className={selectCls}>
                  <option value="">Selecione um objetivo</option>
                  {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Público-alvo</FieldLabel>
                <Input value={f.publico} onChange={(e) => patch({ publico: e.target.value })} placeholder="Ex.: mulheres de 25 a 40 anos, iniciantes em academia..." />
              </div>
              <div>
                <FieldLabel required>Oferta</FieldLabel>
                <Input value={f.oferta} onChange={(e) => patch({ oferta: e.target.value })} placeholder="Ex.: 50% de desconto, frete grátis, bônus exclusivo..." />
              </div>
              <div>
                <FieldLabel>Tom da comunicação</FieldLabel>
                <PillGroup options={[...TONS]} value={f.tom} onChange={(v) => patch({ tom: v })} />
              </div>
              <div>
                <FieldLabel>Canal</FieldLabel>
                <PillGroup options={[...CANAIS]} value={f.canal} onChange={(v) => patch({ canal: v })} />
              </div>
              <div>
                <FieldLabel required>Benefícios / diferenciais</FieldLabel>
                <Textarea value={f.beneficios} onChange={(e) => patch({ beneficios: e.target.value })} placeholder="Ex.: alta durabilidade, confortável, melhora o desempenho..." className="min-h-[64px]" />
              </div>
              <div>
                <FieldLabel required>CTA</FieldLabel>
                <select value={f.cta} onChange={(e) => patch({ cta: e.target.value })} className={selectCls}>
                  <option value="">Selecione um CTA</option>
                  {CTAS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Tamanho do texto</FieldLabel>
                <PillGroup options={[...TAMANHOS]} value={f.tamanho} onChange={(v) => patch({ tamanho: v })} />
              </div>
              <div>
                <FieldLabel optional>Observações</FieldLabel>
                <Textarea value={f.observacoes} onChange={(e) => patch({ observacoes: e.target.value })} placeholder="Ex.: mencionar cor, tamanho, garantia, etc..." className="min-h-[64px]" />
              </div>
            </div>
          </FormPanel>
        }
        preview={
          <PreviewPanel
            icon={Eye}
            sub={isSample ? "Veja como sua copy pode ficar." : "Sua copy está pronta. Copie ou baixe."}
            actions={
              <>
                <Button variant="outline" className="h-10" disabled={isSample} onClick={() => copy(fullText(shown), "all")}>
                  {copied === "all" ? <Check className="w-4 h-4 mr-2 text-primary" /> : <CopyIcon className="w-4 h-4 mr-2" />} Copiar texto
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10" disabled={isSample}><Download className="w-4 h-4 mr-2" /> Baixar <ChevronDown className="w-4 h-4 ml-1.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => download("txt")}>Texto (.txt)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => download("md")}>Markdown (.md)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          >
            <div className="relative space-y-4">
              {isSample && <span className="absolute -top-1 right-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5 z-10">Exemplo</span>}

              <Block title="Headline" onCopy={isSample ? undefined : () => copy(`${shown.headline}\n${shown.subheadline}`, "h")} copied={copied === "h"} tinted>
                <p className="text-[17px] font-bold text-primary leading-snug">{shown.headline}</p>
                {shown.subheadline && <p className="text-xs text-muted-foreground mt-1">{shown.subheadline}</p>}
              </Block>

              <Block title="Texto principal" onCopy={isSample ? undefined : () => copy(shown.texto, "t")} copied={copied === "t"}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{shown.texto}</p>
              </Block>

              <Block title="CTA" onCopy={isSample ? undefined : () => copy(shown.cta, "c")} copied={copied === "c"} tinted>
                <p className="text-sm font-semibold">{shown.cta}</p>
              </Block>

              {shown.variacoes.length > 0 && (
                <Block title="Variações de headline" onCopy={isSample ? undefined : () => copy(shown.variacoes.join("\n"), "v")} copied={copied === "v"}>
                  <ul className="space-y-1.5">
                    {shown.variacoes.map((v, i) => (
                      <li key={i} className="flex gap-2 text-[13px]"><span className="w-1.5 h-1.5 rounded-full bg-primary mt-[7px] flex-shrink-0" />{v}</li>
                    ))}
                  </ul>
                </Block>
              )}

              {busy && <PreviewLoading label="Escrevendo sua copy…" sub="A IA está testando ângulos diferentes" />}
            </div>

            {!isSample && (
              <div className="flex flex-wrap gap-2 -mt-1">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void run()} disabled={busy}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Gerar outra versão</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setScript(shown.texto); setTab("narracao"); }}><Mic className="w-3.5 h-3.5 mr-1.5" /> Narrar este texto</Button>
              </div>
            )}
          </PreviewPanel>
        }
      />
    </div>
  );
}

function Block({ title, children, onCopy, copied, tinted }: { title: string; children: React.ReactNode; onCopy?: () => void; copied?: boolean; tinted?: boolean }) {
  return (
    <div>
      <p className="text-[13px] font-semibold mb-1.5">{title}</p>
      <div className={`relative rounded-xl p-3.5 pr-12 ${tinted ? "bg-[color-mix(in_srgb,var(--accent)_50%,transparent)]" : "bg-[color-mix(in_srgb,var(--muted)_40%,transparent)]"}`}>
        {children}
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="absolute right-2.5 top-2.5 w-8 h-8 rounded-lg border bg-card flex items-center justify-center hover:bg-muted transition"
            aria-label={`Copiar ${title}`}
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <CopyIcon className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

const fullText = (d: CopyKit) =>
  [d.headline, d.subheadline, "", d.texto, "", d.cta, "", "Variações de headline:", ...d.variacoes.map((v) => `- ${v}`)].join("\n").trim();
