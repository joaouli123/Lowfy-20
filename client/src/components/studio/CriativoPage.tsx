import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles, SquarePen, Image as ImageIcon, Eye, Plus, X, GalleryHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, Download, Loader2, AlertCircle, Layers,
} from "lucide-react";
import { useStudio } from "./store";
import { RATIOS, ratioSpec } from "./types";
import type { RatioId } from "./types";
import {
  FieldLabel, FormFooter, FormPanel, FormSection, MissingHint, PageGrid, PageHeader, Pill, PillGroup, PreviewLoading, PreviewPanel,
  DownloadButton, FullscreenButton, UploadBox, missingOf, selectCls, useLocalForm,
} from "./page-kit";

const OBJETIVOS = ["Vender um produto", "Gerar leads", "Divulgar promoção", "Lançamento", "Reconhecimento de marca", "Tráfego para o site"];
const CTAS = ["Comprar agora", "Agende sua avaliação", "Saiba mais", "Garanta o seu", "Cadastre-se", "Fale conosco", "Aproveite a oferta", "Arraste para o lado", "Siga para mais dicas"];
const ESTILOS = ["Minimalista", "Fotográfico", "Moderno", "Elegante", "Vibrante"];
const QTD_SLIDES = [{ v: "3", label: "3" }, { v: "5", label: "5" }, { v: "7", label: "7" }, { v: "10", label: "10" }];
const CAROUSEL_RATIOS = RATIOS.filter((r) => r.id === "1:1" || r.id === "4:5");

// Exemplos reais gerados pelo Estúdio: aparecem no preview vazio para a pessoa ver o resultado antes de gastar crédito.
// Cada exemplo guarda os campos exatos que geraram a imagem: "Usar exemplo" preenche igual.
const POST_EXAMPLES = [
  {
    img: "/studio-examples/post-fone-4x5.webp", ratio: "4:5" as RatioId,
    brief: { produto: "Fone de ouvido bluetooth preto", publico: "", headline: "Fone Bluetooth", estilo: "" },
    opts: { objetivo: "Divulgar promoção", texto: "De R$ 199 por R$ 99", cta: "Comprar agora", cores: [] as string[], observacoes: "" },
  },
  {
    img: "/studio-examples/post-perfume-1x1.webp", ratio: "1:1" as RatioId,
    brief: { produto: "Perfume feminino floral em frasco de vidro", publico: "Mulheres de 25 a 45 anos", headline: "Dia das Mães", estilo: "Elegante" },
    opts: { objetivo: "Divulgar promoção", texto: "30% OFF em toda a linha", cta: "Comprar agora", cores: ["#7a1f3d", "#f4e1d2"], observacoes: "Colocar pétalas de rosa ao redor do frasco" },
  },
  {
    img: "/studio-examples/post-fone-9x16.webp", ratio: "9:16" as RatioId,
    brief: { produto: "Fone de ouvido bluetooth preto", publico: "", headline: "Fone Bluetooth", estilo: "" },
    opts: { objetivo: "Divulgar promoção", texto: "De R$ 199 por R$ 99", cta: "Comprar agora", cores: [] as string[], observacoes: "" },
  },
  {
    img: "/studio-examples/post-perfume-16x9.webp", ratio: "16:9" as RatioId,
    brief: { produto: "Perfume feminino floral em frasco de vidro", publico: "Mulheres de 25 a 45 anos", headline: "Dia das Mães", estilo: "Elegante" },
    opts: { objetivo: "Divulgar promoção", texto: "30% OFF em toda a linha", cta: "Comprar agora", cores: ["#7a1f3d", "#f4e1d2"], observacoes: "Colocar pétalas de rosa ao redor do frasco" },
  },
];
// Exemplo nativo por formato. Sem exemplo do formato, o preview mostra só a moldura (nunca imagem esticada).
const EXEMPLO_POST: Record<string, string | undefined> = {
  "4:5": POST_EXAMPLES[0].img, "9:16": POST_EXAMPLES[2].img, "1:1": POST_EXAMPLES[1].img, "16:9": POST_EXAMPLES[3].img,
};
const CAROUSEL_EXAMPLE = {
  tema: "3 hábitos que fazem sua pele envelhecer mais rápido", slides: "5",
  brief: { produto: "Clínica de estética facial", publico: "Mulheres de 30 a 50 anos", estilo: "Elegante", ratio: "4:5" as RatioId },
  opts: { objetivo: "Gerar leads", cta: "Agende sua avaliação", cores: ["#c8a27a", "#2b2b2b", "#f6f1eb"], observacoes: "" },
};
const EXEMPLO_CARROSSEL = [1, 2, 3, 4, 5].map((i) => `/studio-examples/carrossel-${i}.webp`);

function ExampleBadge() {
  return (
    <span className="absolute top-2 left-2 rounded-md bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 backdrop-blur-sm">
      Exemplo
    </span>
  );
}

/** Largura da prévia por proporção: o 9:16 não estoura a altura da tela. */
const previewWidth = (r: RatioId) =>
  r === "9:16" ? "max-w-[250px]" : r === "4:5" ? "max-w-[330px]" : "max-w-full";

type Mode = "post" | "carrossel";
interface Slide { titulo: string; texto: string; url?: string; erro?: string }
interface CarouselState { status: "planning" | "drawing" | "done" | "error"; total: number; done: number; slides: Slide[]; error?: string }

export default function CriativoPage() {
  const { brief, patchBrief, opts, patchOpts, imageUrl, runImage, busy, addAsset } = useStudio();
  const { toast } = useToast();
  const o = opts.image;
  const colorRef = useRef<HTMLInputElement>(null);

  // O carrossel tem os PRÓPRIOS campos: mudar de modo não leva cores/produto de um para o outro.
  const [car, patchCar] = useLocalForm("carrossel", {
    mode: "post" as Mode, tema: "", slides: "5",
    produto: "", publico: "", objetivo: "", estilo: "", cores: [] as string[], cta: "", observacoes: "", referencia: "", ratio: "4:5" as RatioId,
  });
  const mode = car.mode;
  const isCar = mode === "carrossel";
  // Campos comuns aos dois modos, lidos/gravados no lugar certo conforme o modo.
  type Shared = { produto: string; publico: string; objetivo: string; estilo: string; cores: string[]; cta: string; observacoes: string; referencia: string; ratio: RatioId };
  const v: Shared = isCar
    ? { produto: car.produto, publico: car.publico, objetivo: car.objetivo, estilo: car.estilo, cores: car.cores, cta: car.cta, observacoes: car.observacoes, referencia: car.referencia, ratio: car.ratio }
    : { produto: brief.produto, publico: brief.publico, objetivo: o.objetivo, estilo: brief.estilo, cores: o.cores, cta: o.cta, observacoes: o.observacoes, referencia: o.referencia, ratio: brief.ratio };
  const setV = (p: Partial<Shared>) => {
    if (isCar) return patchCar(p);
    const { produto, publico, estilo, ratio: r, objetivo, cores, cta, observacoes, referencia } = p;
    const b = Object.fromEntries(Object.entries({ produto, publico, estilo, ratio: r }).filter(([, x]) => x !== undefined));
    const op = Object.fromEntries(Object.entries({ objetivo, cores, cta, observacoes, referencia }).filter(([, x]) => x !== undefined));
    if (Object.keys(b).length) patchBrief(b);
    if (Object.keys(op).length) patchOpts("image", op);
  };
  const ratio: RatioId = isCar && v.ratio !== "1:1" ? "4:5" : v.ratio;
  const spec = ratioSpec(ratio);

  // ---- carrossel: job em segundo plano + polling ----
  const [job, setJob] = useState<CarouselState | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [exSlide, setExSlide] = useState(0);
  const carBusy = !!job && (job.status === "planning" || job.status === "drawing");

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/ai-studio/carousel/${jobId}`, { credentials: "include" });
        if (r.status === 404) {
          // O servidor reiniciou (atualização do sistema) e o carrossel em andamento se perdeu.
          setJobId(null);
          setJob(null);
          toast({ title: "O carrossel foi interrompido", description: "O sistema foi atualizado enquanto gerava. Clique em gerar de novo.", variant: "destructive" });
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as CarouselState;
        if (stop) return;
        setJob(d);
        if (d.status === "done" || d.status === "error") {
          setJobId(null);
          if (d.status === "error") toast({ title: "Erro ao gerar carrossel", description: d.error, variant: "destructive" });
          else d.slides.forEach((s, i) => s.url && addAsset({ kind: "image", url: s.url, label: `${car.tema || "Carrossel"} ${i + 1}/${d.slides.length}`, from: "Carrossel", ratio }));
          return;
        }
      } catch { /* rede oscilou: tenta de novo no próximo ciclo */ }
      if (!stop) setTimeout(tick, 4000);
    };
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const runCarousel = async () => {
    setSlide(0);
    setJob({ status: "planning", total: Number(car.slides), done: 0, slides: [] });
    try {
      const r = await apiRequest("POST", "/api/ai-studio/carousel", {
        tema: car.tema, slides: Number(car.slides), aspect: ratio,
        produto: car.produto, publico: car.publico, objetivo: car.objetivo, estilo: car.estilo, cores: car.cores,
        cta: car.cta, observacoes: car.observacoes, referencia: car.referencia || undefined, idioma: brief.lang,
      });
      setJobId(((await r.json()) as { id: string }).id);
    } catch (e: any) {
      setJob(null);
      toast({ title: "Erro ao gerar carrossel", description: e?.message || "Tente novamente", variant: "destructive" });
    }
  };

  const [textMode, setTextModeState] = useState<"ia" | "eu">(() => (brief.headline || o.texto || o.cta ? "eu" : "ia"));
  const setTextMode = (m: "ia" | "eu") => {
    setTextModeState(m);
    // "A IA escreve": não manda textos antigos que ficaram escondidos.
    if (m === "ia") { patchBrief({ headline: "" }); patchOpts("image", { texto: "", cta: "" }); }
  };

  const missing = isCar
    ? missingOf([["sobre o que é o carrossel", car.tema]])
    : missingOf([["produto ou serviço", v.produto]]);

  // Alterna entre os exemplos a cada clique (fone ↔ perfume), sem gastar IA.
  // Trocou o produto de um exemplo: limpa o que ainda é do exemplo (pétalas, cores, textos...)
  // para não vazar no criativo da pessoa. O que ela mesma mudou continua.
  const trocarProduto = (produto: string) => {
    const exs = isCar
      ? [{ brief: CAROUSEL_EXAMPLE.brief, opts: CAROUSEL_EXAMPLE.opts }]
      : POST_EXAMPLES.map((e) => ({ brief: e.brief as Record<string, any>, opts: e.opts as Record<string, any> }));
    const ex = exs.find((e) => e.brief.produto === v.produto);
    if (!ex || produto === v.produto) return setV({ produto });
    const igual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
    const limpar: Record<string, any> = { produto };
    if (igual(v.publico, ex.brief.publico)) limpar.publico = "";
    if (igual(v.estilo, ex.brief.estilo)) limpar.estilo = "";
    if (igual(v.cores, ex.opts.cores)) limpar.cores = [];
    if (igual(v.observacoes, ex.opts.observacoes)) limpar.observacoes = "";
    if (igual(v.cta, ex.opts.cta)) limpar.cta = "";
    if (igual(v.objetivo, ex.opts.objetivo)) limpar.objetivo = "";
    setV(limpar);
    if (!isCar) {
      const textos: Record<string, any> = {};
      if (brief.headline === (ex.brief as any).headline) patchBrief({ headline: "" });
      if (o.texto === (ex.opts as any).texto) textos.texto = "";
      if (Object.keys(textos).length) patchOpts("image", textos);
      if (brief.headline === (ex.brief as any).headline && o.texto === (ex.opts as any).texto) setTextModeState("ia");
    } else if (car.tema === CAROUSEL_EXAMPLE.tema) {
      patchCar({ tema: "" });
    }
  };

  const exampleIdx = useRef(0);
  const example = () => {
    if (isCar) {
      patchCar({ tema: CAROUSEL_EXAMPLE.tema, slides: CAROUSEL_EXAMPLE.slides, ...CAROUSEL_EXAMPLE.brief, ...CAROUSEL_EXAMPLE.opts });
      setExSlide(0);
      return;
    }
    const ex = POST_EXAMPLES[exampleIdx.current % POST_EXAMPLES.length];
    exampleIdx.current++;
    patchBrief({ ...ex.brief, ratio: ex.ratio });
    patchOpts("image", ex.opts);
    setTextModeState("eu");
  };

  const clear = () => {
    if (isCar) {
      patchCar({ tema: "", produto: "", publico: "", objetivo: "", estilo: "", cores: [], cta: "", observacoes: "", referencia: "" });
      setJob(null);
      return;
    }
    patchBrief({ produto: "", publico: "", headline: "", estilo: "" });
    patchOpts("image", { objetivo: "", texto: "", cta: "", cores: [], observacoes: "", referencia: "" });
  };

  const slides = job?.slides || [];
  const cur = slides[slide];
  const ready = slides.filter((s) => s.url);

  const downloadAll = async () => {
    for (const [i, s] of slides.entries()) {
      if (!s.url) continue;
      const a = Object.assign(document.createElement("a"), { href: s.url, download: `carrossel-${i + 1}.png` });
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Sparkles}
        title="Criação de Criativo"
        sub="Gere anúncios, posts e carrosséis incríveis em poucos cliques com o poder da IA."
        tip={isCar ? "carrosséis com um tema claro e útil engajam muito mais." : "quanto mais detalhes você fornecer, melhor será o resultado!"}
      />

      {/* Seletor de tipo */}
      <div className="inline-flex rounded-xl border bg-card p-1 gap-1">
        {([["post", "Post único", ImageIcon], ["carrossel", "Carrossel", GalleryHorizontal]] as const).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => patchCar({ mode: v })}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition ${
              mode === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <PageGrid
        form={
          <FormPanel
            icon={isCar ? Layers : SquarePen}
            title={isCar ? "Informações do carrossel" : "Informações do criativo"}
            sub={isCar ? "Diga o tema: a IA escreve os slides e cria todos com o mesmo visual." : "Só o produto é obrigatório. O resto a IA completa se você deixar em branco."}
            onExample={example}
            footer={
              <div className="space-y-3">
                <FormFooter
                  onClear={clear}
                  onSubmit={() => void (isCar ? runCarousel() : runImage())}
                  busy={isCar ? carBusy : busy.image}
                  disabled={missing.length > 0}
                  label={isCar ? `Gerar carrossel (${car.slides} slides)` : "Gerar criativo"}
                  busyLabel={isCar ? "Gerando carrossel…" : "Gerando criativo…"}
                  icon={Sparkles}
                />
                <MissingHint missing={missing} />
              </div>
            }
          >
            {/* 1 — O que anunciar */}
            <FormSection n={1} title={isCar ? "Sobre o que é o carrossel" : "O que você vai anunciar"}>
              {isCar && (
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-[1fr_auto] [&>*]:min-w-0">
                  <div>
                    <FieldLabel required>Tema do carrossel</FieldLabel>
                    <Input value={car.tema} onChange={(e) => patchCar({ tema: e.target.value })} placeholder="Ex.: 5 erros que fazem você perder vendas no Instagram" />
                  </div>
                  <div>
                    <FieldLabel>Quantos slides</FieldLabel>
                    <PillGroup options={QTD_SLIDES} value={car.slides} onChange={(v) => patchCar({ slides: v })} />
                    <p className="text-[11px] text-muted-foreground mt-1.5">Capa + {Number(car.slides) - 2} de conteúdo + chamada final</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3 [&>*]:min-w-0">
                <div>
                  <FieldLabel required={!isCar} optional={isCar}>{isCar ? "Produto ou marca" : "Produto ou serviço"}</FieldLabel>
                  <Input value={v.produto} onChange={(e) => trocarProduto(e.target.value)} placeholder="Ex.: tênis esportivo branco" />
                </div>
                <div>
                  <FieldLabel optional>Para quem</FieldLabel>
                  <Input value={v.publico} onChange={(e) => setV({ publico: e.target.value })} placeholder="Ex.: mulheres de 25 a 40 anos" />
                </div>
                <div>
                  <FieldLabel optional>Objetivo</FieldLabel>
                  <select value={v.objetivo} onChange={(e) => setV({ objetivo: e.target.value })} className={selectCls}>
                    <option value="">A IA decide</option>
                    {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>
            </FormSection>

            {/* 2 — Textos */}
            <FormSection
              n={2}
              title={isCar ? "Textos dos slides" : "Textos da imagem"}
              right={!isCar && (
                <div className="inline-flex rounded-lg border p-0.5 gap-0.5">
                  {([["ia", "A IA escreve"], ["eu", "Eu escrevo"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTextMode(v)}
                      className={`h-7 px-3 rounded-md text-xs font-medium transition ${textMode === v ? "bg-[color-mix(in_srgb,var(--accent)_100%,transparent)] text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            >
              {isCar ? (
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 [&>*]:min-w-0">
                  <p className="text-[13px] text-muted-foreground leading-snug md:pt-6">A IA escreve o título e o texto de cada slide a partir do tema.</p>
                  <div>
                    <FieldLabel optional>Chamada do último slide</FieldLabel>
                    <select value={v.cta} onChange={(e) => setV({ cta: e.target.value })} className={selectCls}>
                      <option value="">A IA decide</option>
                      {CTAS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                </div>
              ) : textMode === "ia" ? (
                <p className="text-[13px] text-muted-foreground leading-snug">
                  A IA cria um título curto e chamativo para a imagem. Quer escrever o seu? Clique em <span className="font-medium text-foreground">Eu escrevo</span>.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3 [&>*]:min-w-0">
                  <div>
                    <FieldLabel>Título</FieldLabel>
                    <Input value={brief.headline} onChange={(e) => patchBrief({ headline: e.target.value })} placeholder="Ex.: VÁ MAIS LONGE" />
                  </div>
                  <div>
                    <FieldLabel optional>Texto menor</FieldLabel>
                    <Input value={o.texto} onChange={(e) => patchOpts("image", { texto: e.target.value })} placeholder="Ex.: 50% OFF só hoje" />
                  </div>
                  <div>
                    <FieldLabel optional>Botão</FieldLabel>
                    <select value={v.cta} onChange={(e) => setV({ cta: e.target.value })} className={selectCls}>
                      <option value="">Sem botão</option>
                      {CTAS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </FormSection>

            {/* 3 — Visual */}
            <FormSection n={3} title="Visual">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <FieldLabel>Formato</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {(isCar ? CAROUSEL_RATIOS : RATIOS).map((r) => (
                      <Pill key={r.id} active={ratio === r.id} onClick={() => setV({ ratio: r.id })}>
                        {r.id} <span className="text-[10px] opacity-70">· {r.sub}</span>
                      </Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Estilo</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {ESTILOS.map((e) => (
                      <Pill key={e} active={v.estilo === e} onClick={() => setV({ estilo: v.estilo === e ? "" : e })}>{e}</Pill>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel optional>Cores da marca</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    {v.cores.map((c, i) => (
                      <button
                        key={`${c}-${i}`}
                        type="button"
                        onClick={() => setV({ cores: v.cores.filter((_, j) => j !== i) })}
                        className="group relative w-8 h-8 rounded-full border shadow-sm"
                        style={{ background: c }}
                        title={`${c} — clique para remover`}
                      >
                        <X className="w-3.5 h-3.5 absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                      </button>
                    ))}
                    {v.cores.length < 6 && (
                      <button type="button" onClick={() => colorRef.current?.click()} className="h-8 px-3 rounded-full border border-dashed flex items-center gap-1.5 text-xs text-muted-foreground hover:bg-muted" title="Adicionar cor">
                        <Plus className="w-3.5 h-3.5" /> {v.cores.length ? "" : "Adicionar cor"}
                      </button>
                    )}
                    <input ref={colorRef} type="color" className="sr-only" onChange={(e) => setV({ cores: [...v.cores, e.target.value] })} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{v.cores.length ? "Clique numa cor para remover." : "Sem cores, a IA escolhe a paleta."}</p>
                </div>
                <div>
                  <FieldLabel optional>Imagem de referência</FieldLabel>
                  <UploadBox
                    accept="image/png,image/jpeg,image/webp"
                    hint="Foto do produto ou um post que você gosta"
                    label="Enviar imagem (PNG, JPG ou WEBP, até 5MB)"
                    maxMb={5}
                    value={v.referencia ? [{ data: v.referencia, type: "image/png", name: "Imagem de referência" }] : []}
                    onChange={(f) => setV({ referencia: f[0]?.data || "" })}
                  />
                </div>
              </div>
            </FormSection>

            {/* 4 — Extras */}
            <details className="group rounded-xl border bg-card" open={!!v.observacoes}>
              <summary className="flex items-center gap-2.5 px-4 py-3 cursor-pointer list-none select-none">
                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center">4</span>
                <span className="text-sm font-semibold">Detalhes extras</span>
                <span className="text-xs text-muted-foreground">(opcional)</span>
                <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4">
                <Textarea value={v.observacoes} onChange={(e) => setV({ observacoes: e.target.value })} placeholder="Ex.: colocar pétalas de rosa ao redor, destacar o preço, fundo mais escuro..." className="min-h-[64px]" />
              </div>
            </details>
          </FormPanel>
        }
        preview={
          isCar ? (
            <PreviewPanel
              busy={carBusy}
              icon={Eye}
              sub={job?.status === "done" ? `${ready.length} de ${slides.length} slides prontos.` : job ? "Seus slides aparecem aqui, um ao lado do outro." : "Exemplo real de carrossel feito aqui. Use as setas para ver."}
              actions={
                <>
                  <DownloadButton url={cur?.url || null} label="Baixar slide" />
                  <Button variant="outline" className="h-10 w-full" disabled={!ready.length || carBusy} onClick={() => void downloadAll()}>
                    <Download className="w-4 h-4 mr-2 flex-shrink-0" /> <span className="truncate">Baixar todos</span>
                  </Button>
                </>
              }
            >
              <div className={`mx-auto w-full ${previewWidth(ratio)}`}>
                <div className={`${spec.cls} w-full rounded-xl overflow-hidden border bg-gradient-to-br from-[color-mix(in_srgb,var(--muted)_60%,transparent)] to-[color-mix(in_srgb,var(--accent)_40%,transparent)] relative`}>
                  {cur?.url ? (
                    <img src={cur.url} alt={`Slide ${slide + 1}`} className="w-full h-full object-cover" />
                  ) : cur?.erro ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-5">
                      <AlertCircle className="w-7 h-7 text-red-500" />
                      <p className="text-sm font-semibold">Este slide falhou</p>
                      <p className="text-xs text-muted-foreground line-clamp-3">{cur.erro}</p>
                    </div>
                  ) : cur ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-5">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <p className="text-sm font-bold leading-snug">{cur.titulo}</p>
                      <p className="text-xs text-muted-foreground">{cur.texto}</p>
                    </div>
                  ) : (
                    <>
                      <img src={EXEMPLO_CARROSSEL[exSlide]} alt="Exemplo de carrossel" className="w-full h-full object-cover" />
                      <ExampleBadge />
                      <button type="button" onClick={() => setExSlide((i) => Math.max(0, i - 1))} disabled={exSlide === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30" aria-label="Exemplo anterior">
                        <ChevronLeft className="w-5 h-5 text-slate-800" />
                      </button>
                      <button type="button" onClick={() => setExSlide((i) => Math.min(EXEMPLO_CARROSSEL.length - 1, i + 1))} disabled={exSlide === EXEMPLO_CARROSSEL.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30" aria-label="Próximo exemplo">
                        <ChevronRight className="w-5 h-5 text-slate-800" />
                      </button>
                    </>
                  )}
                  {job?.status === "planning" && <PreviewLoading label="Escrevendo o roteiro dos slides…" sub="A IA está montando o gancho e o conteúdo" />}
                  {slides.length > 1 && (
                    <>
                      <button type="button" onClick={() => setSlide((i) => Math.max(0, i - 1))} disabled={slide === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30" aria-label="Slide anterior">
                        <ChevronLeft className="w-5 h-5 text-slate-800" />
                      </button>
                      <button type="button" onClick={() => setSlide((i) => Math.min(slides.length - 1, i + 1))} disabled={slide === slides.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center disabled:opacity-30" aria-label="Próximo slide">
                        <ChevronRight className="w-5 h-5 text-slate-800" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {job?.status === "drawing" && (
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Desenhando os slides…</span><span>{job.done}/{job.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.max(6, (job.done / Math.max(1, job.total)) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Leva uns minutos. Pode continuar usando o sistema, não feche esta página.</p>
                </div>
              )}

              {slides.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slides.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSlide(i)}
                      className={`relative flex-shrink-0 w-14 ${spec.cls} rounded-md overflow-hidden border-2 transition ${i === slide ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"} bg-muted`}
                      aria-label={`Ver slide ${i + 1}`}
                    >
                      {s.url ? <img src={s.url} alt="" className="w-full h-full object-cover" /> : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                          {s.erro ? <AlertCircle className="w-3.5 h-3.5 text-red-500" /> : i + 1}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </PreviewPanel>
          ) : (
            <PreviewPanel
              busy={busy.image}
              icon={Eye}
              sub={imageUrl ? "Seu criativo está pronto." : "Isto é um exemplo real feito aqui. O seu aparece no lugar."}
              actions={
                <>
                  <DownloadButton url={imageUrl} label="Baixar" />
                  <FullscreenButton url={imageUrl} />
                </>
              }
            >
              <div className={`mx-auto w-full transition-[max-width] duration-300 ${previewWidth(ratio)}`}>
                <div className={`${spec.cls} w-full rounded-xl overflow-hidden border bg-gradient-to-br from-[color-mix(in_srgb,var(--muted)_60%,transparent)] to-[color-mix(in_srgb,var(--accent)_40%,transparent)] relative`}>
                  {imageUrl ? (
                    <img src={imageUrl} alt="Criativo gerado" className="w-full h-full object-cover" />
                  ) : (
                    EXEMPLO_POST[ratio] ? (
                      <>
                        <img src={EXEMPLO_POST[ratio]} alt="Exemplo de criativo" className="w-full h-full object-cover" />
                        <ExampleBadge />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center p-4">
                        <ImageIcon className="w-8 h-8 text-[color-mix(in_srgb,var(--muted-foreground)_60%,transparent)]" />
                        <p className="text-sm font-semibold">{spec.id} · {spec.label}</p>
                        <p className="text-xs text-muted-foreground">{spec.sub} — seu criativo aparece aqui</p>
                      </div>
                    )
                  )}
                  {busy.image && <PreviewLoading label="Criando seu criativo…" sub="Costuma levar cerca de 1 minuto" />}
                </div>
              </div>
            </PreviewPanel>
          )
        }
      />
    </div>
  );
}
