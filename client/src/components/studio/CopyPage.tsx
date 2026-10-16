import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Type, FileText, Eye, Copy as CopyIcon, Download, ChevronDown, Wand2, RotateCcw, Check, Mic } from "lucide-react";
import { useStudio } from "./store";
import { CopyPreview, copyToText } from "./CopyPreviews";
import type { Canal, CopyOut } from "./CopyPreviews";
import EXEMPLOS from "./copy-exemplos.json";
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
  { v: "social", label: "Redes sociais" }, { v: "meta", label: "Anúncio (Meta Ads)" }, { v: "whatsapp", label: "WhatsApp" },
  { v: "landing", label: "Landing page" }, { v: "email", label: "E-mail" },
] as const;
const CANAIS_VALIDOS = CANAIS.map((c) => c.v) as string[];
const TAMANHOS = [{ v: "curto", label: "Curto" }, { v: "medio", label: "Médio" }, { v: "longo", label: "Longo" }] as const;


const DEFAULTS = {
  modo: "simples" as "simples" | "detalhado", descricao: "",
  produto: "", objetivo: "", publico: "", oferta: "", beneficios: "", cta: "", observacoes: "",
  tom: "direto" as string, canal: "social" as string, tamanho: "curto" as string,
};


export default function CopyPage() {
  const { brief, addAsset, setScript, setTab } = useStudio();
  const { toast } = useToast();
  const [f, patch, reset] = useLocalForm("copy", DEFAULTS);
  const [out, setOut] = useState<CopyOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const simples = f.modo === "simples";
  // Canal salvo de versões antigas (instagram/anuncio) cai em Redes sociais.
  const canal = (CANAIS_VALIDOS.includes(f.canal) ? f.canal : "social") as Canal;
  const missing = simples ? missingOf([["o que você precisa", f.descricao]]) : missingOf([["produto ou serviço", f.produto]]);

  const example = () => simples ? patch({
    descricao: "Quero vender meu curso online de inglês para iniciantes, para adultos de 25 a 45 anos que travam na hora de falar. Está com 50% de desconto e tem 7 dias de garantia. As aulas são curtas, de 15 minutos, e a pessoa conversa desde o primeiro dia.",
    canal: "social", tamanho: "medio",
  }) : patch({
    produto: "Curso online de inglês para iniciantes", objetivo: "Vender um produto", publico: "Adultos de 25 a 45 anos que travam na hora de falar",
    oferta: "50% de desconto + 7 dias de garantia", beneficios: "Aulas curtas de 15 min, conversação desde o 1º dia, certificado", cta: "Garanta o seu agora!",
    tom: "direto", canal: "social", tamanho: "medio",
  });

  const run = async () => {
    setBusy(true);
    try {
      // No modo simples só vai a descrição livre: os campos detalhados escondidos não interferem.
      const body = simples
        ? { descricao: f.descricao, canal, tamanho: f.tamanho, idioma: brief.lang }
        : { ...f, canal, descricao: undefined, idioma: brief.lang };
      const r = await apiRequest("POST", "/api/ai-studio/copy-kit", body);
      const d = (await r.json()) as CopyOut;
      setOut(d);
      addAsset({ kind: "copy", text: copyToText(canal, d), label: (simples ? f.descricao : f.produto).slice(0, 40) || "Copy", from: "Copy" });
    } catch (e: any) {
      toast({ title: "Erro ao gerar copy", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // Sem resultado (ou trocou de canal): mostra o exemplo real daquele canal.
  const isSample = !out || out.canal !== canal;
  const shown: CopyOut = isSample ? ((EXEMPLOS as Record<string, CopyOut>)[canal] || {}) : out!;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const download = (ext: "txt" | "md") => {
    const body = copyToText(canal, shown);
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `copy-${((simples ? f.descricao : f.produto) || "lowfy").slice(0, 30).replace(/[^\w-]+/g, "-")}.${ext}` });
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
            sub={simples ? "Escreva do seu jeito: o que é, para quem e o que você quer." : "Só o produto é obrigatório. Quanto mais detalhes, melhor a copy."}
            onExample={example}
            footer={
              <div className="space-y-3">
                <FormFooter onClear={() => { reset(); setOut(null); }} onSubmit={() => void run()} busy={busy} disabled={missing.length > 0} label="Gerar copy" busyLabel="Escrevendo…" icon={Wand2} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div className="inline-flex rounded-xl border bg-[color-mix(in_srgb,var(--muted)_40%,transparent)] p-1 gap-1 w-full sm:w-auto">
              {([["simples", "Simples", "1 campo"], ["detalhado", "Detalhado", "todos os campos"]] as const).map(([v, label, hint]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => patch({ modo: v })}
                  className={`flex-1 sm:flex-none h-9 px-4 rounded-lg text-sm font-medium transition ${f.modo === v ? "bg-card text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label} <span className="text-[11px] font-normal text-muted-foreground">· {hint}</span>
                </button>
              ))}
            </div>

            {simples ? (
              <div className="space-y-4">
                <div>
                  <FieldLabel required>O que você precisa?</FieldLabel>
                  <Textarea
                    value={f.descricao}
                    onChange={(e) => patch({ descricao: e.target.value })}
                    placeholder={"Conte com suas palavras: o que você vende, para quem, qual a oferta e o que quer com o texto.\nEx.: Quero vender meu curso de inglês para adultos que travam na hora de falar. Está com 50% de desconto e 7 dias de garantia."}
                    className="min-h-[140px]"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Quanto mais detalhes você contar, melhor fica a copy. Quer mais controle? Use o modo{" "}
                    <button type="button" className="underline font-medium text-foreground" onClick={() => patch({ modo: "detalhado" })}>Detalhado</button>.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
                  <div>
                    <FieldLabel>Onde vai usar</FieldLabel>
                    <PillGroup options={[...CANAIS]} value={canal} onChange={(v) => patch({ canal: v })} />
                  </div>
                  {canal !== "landing" && <div>
                    <FieldLabel>Tamanho do texto</FieldLabel>
                    <PillGroup options={[...TAMANHOS]} value={f.tamanho} onChange={(v) => patch({ tamanho: v })} />
                  </div>}
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
              <div>
                <FieldLabel required>Produto ou serviço</FieldLabel>
                <Input value={f.produto} onChange={(e) => patch({ produto: e.target.value })} placeholder="Ex.: tênis esportivo, curso de inglês, suplemento..." />
              </div>
              <div>
                <FieldLabel optional>Objetivo</FieldLabel>
                <select value={f.objetivo} onChange={(e) => patch({ objetivo: e.target.value })} className={selectCls}>
                  <option value="">Deixa a IA decidir</option>
                  {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel optional>Público-alvo</FieldLabel>
                <Input value={f.publico} onChange={(e) => patch({ publico: e.target.value })} placeholder="Ex.: mulheres de 25 a 40 anos, iniciantes em academia..." />
              </div>
              <div>
                <FieldLabel optional>Oferta</FieldLabel>
                <Input value={f.oferta} onChange={(e) => patch({ oferta: e.target.value })} placeholder="Ex.: 50% de desconto, frete grátis, bônus exclusivo..." />
              </div>
              <div>
                <FieldLabel>Tom da comunicação</FieldLabel>
                <PillGroup options={[...TONS]} value={f.tom} onChange={(v) => patch({ tom: v })} />
              </div>
              <div>
                <FieldLabel>Onde vai usar</FieldLabel>
                <PillGroup options={[...CANAIS]} value={canal} onChange={(v) => patch({ canal: v })} />
              </div>
              <div>
                <FieldLabel optional>Benefícios / diferenciais</FieldLabel>
                <Textarea value={f.beneficios} onChange={(e) => patch({ beneficios: e.target.value })} placeholder="Ex.: alta durabilidade, confortável, melhora o desempenho..." className="min-h-[64px]" />
              </div>
              <div>
                <FieldLabel optional>Chamada (CTA)</FieldLabel>
                <select value={f.cta} onChange={(e) => patch({ cta: e.target.value })} className={selectCls}>
                  <option value="">A IA escolhe</option>
                  {CTAS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              {canal !== "landing" && <div>
                <FieldLabel>Tamanho do texto</FieldLabel>
                <PillGroup options={[...TAMANHOS]} value={f.tamanho} onChange={(v) => patch({ tamanho: v })} />
              </div>}
              <div>
                <FieldLabel optional>Observações</FieldLabel>
                <Textarea value={f.observacoes} onChange={(e) => patch({ observacoes: e.target.value })} placeholder="Ex.: mencionar cor, tamanho, garantia, etc..." className="min-h-[64px]" />
              </div>
            </div>
            )}
          </FormPanel>
        }
        preview={
          <PreviewPanel
            busy={busy}
            icon={Eye}
            sub={isSample ? "Exemplo real deste canal. A sua copy aparece no lugar." : "Sua copy está pronta. Copie ou baixe."}
            actions={
              <>
                <Button variant="outline" className="h-10" disabled={isSample} onClick={() => copy(copyToText(canal, shown), "all")}>
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
            <div className="relative">
              {isSample && <span className="absolute -top-2 right-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-[color-mix(in_srgb,var(--muted)_100%,transparent)] rounded px-1.5 py-0.5 z-20">Exemplo</span>}
              <CopyPreview key={`${canal}-${isSample}`} canal={canal} d={shown} />
              {busy && <PreviewLoading label="Escrevendo sua copy…" sub={canal === "landing" ? "A landing page leva uns 20 segundos" : "A IA está testando ângulos diferentes"} />}
            </div>

            {!isSample && (
              <div className="flex flex-wrap gap-2 -mt-1">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void run()} disabled={busy}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Gerar outra versão</Button>
                {(canal === "social" || canal === "whatsapp") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setScript(copyToText(canal, shown)); setTab("narracao"); }}><Mic className="w-3.5 h-3.5 mr-1.5" /> Narrar este texto</Button>
                )}
              </div>
            )}
          </PreviewPanel>
        }
      />
    </div>
  );
}
