import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, SquarePen, Crop, Palette, Image as ImageIcon, Droplets, FileText, Eye, Download, Maximize2, Plus, X } from "lucide-react";
import { useStudio } from "./store";
import { RATIOS, ratioSpec } from "./types";
import type { RatioId } from "./types";
import {
  FieldLabel, FormFooter, FormPanel, MissingHint, OptionCard, PageGrid, PageHeader, Pill, PreviewLoading, PreviewPanel, DownloadButton, FullscreenButton,
  UploadBox, missingOf, selectCls,
} from "./page-kit";

const OBJETIVOS = ["Vender um produto", "Gerar leads", "Divulgar promoção", "Lançamento", "Reconhecimento de marca", "Tráfego para o site"];
const CTAS = ["Comprar agora", "Saiba mais", "Garanta o seu", "Cadastre-se", "Fale conosco", "Aproveite a oferta"];
const ESTILOS = ["Minimalista", "Fotográfico", "Moderno", "Elegante", "Vibrante"];

/** Largura da prévia por proporção: o 9:16 não estoura a altura da tela. */
const previewWidth = (r: RatioId) =>
  r === "9:16" ? "max-w-[250px]" : r === "4:5" ? "max-w-[330px]" : "max-w-full";

export default function CriativoPage() {
  const { brief, patchBrief, opts, patchOpts, imageUrl, runImage, busy } = useStudio();
  const o = opts.image;
  const spec = ratioSpec(brief.ratio);
  const colorRef = useRef<HTMLInputElement>(null);

  const missing = missingOf([
    ["produto", brief.produto], ["objetivo", o.objetivo], ["público", brief.publico],
    ["texto principal", o.texto], ["headline", brief.headline], ["CTA", o.cta],
  ]);

  const clear = () => {
    patchBrief({ produto: "", publico: "", headline: "", estilo: "" });
    patchOpts("image", { objetivo: "", texto: "", cta: "", observacoes: "", referencia: "" });
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Sparkles}
        title="Criação de Criativo"
        sub="Gere anúncios e criativos incríveis em poucos cliques com o poder da IA."
        tip="quanto mais detalhes você fornecer, melhor será o resultado!"
      />

      <PageGrid
        form={
          <FormPanel
            icon={SquarePen}
            title="Informações do criativo"
            sub="Preencha os campos abaixo para gerar sua imagem."
            footer={
              <div className="space-y-3">
                <FormFooter onClear={clear} onSubmit={() => void runImage()} busy={busy.image} disabled={missing.length > 0} label="Gerar criativo" busyLabel="Gerando criativo…" icon={Sparkles} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
              <div>
                <FieldLabel required>Produto ou serviço</FieldLabel>
                <Input value={brief.produto} onChange={(e) => patchBrief({ produto: e.target.value })} placeholder="Ex.: tênis esportivo, curso de marketing, suplemento..." />
              </div>
              <div>
                <FieldLabel required>Objetivo</FieldLabel>
                <select value={o.objetivo} onChange={(e) => patchOpts("image", { objetivo: e.target.value })} className={selectCls}>
                  <option value="">Selecione o objetivo</option>
                  {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Público-alvo</FieldLabel>
                <Input value={brief.publico} onChange={(e) => patchBrief({ publico: e.target.value })} placeholder="Ex.: homens de 25 a 40 anos, iniciantes em academia..." />
              </div>
              <div>
                <FieldLabel required>Texto principal</FieldLabel>
                <Textarea value={o.texto} onChange={(e) => patchOpts("image", { texto: e.target.value })} placeholder="Descreva o texto principal do seu anúncio..." className="min-h-[72px] md:min-h-[40px] md:h-10 resize-y" />
              </div>
              <div>
                <FieldLabel required>Headline</FieldLabel>
                <Input value={brief.headline} onChange={(e) => patchBrief({ headline: e.target.value })} placeholder="Ex.: 50% OFF HOJE, Transforme seu corpo..." />
              </div>
              <div>
                <FieldLabel required>CTA</FieldLabel>
                <select value={o.cta} onChange={(e) => patchOpts("image", { cta: e.target.value })} className={selectCls}>
                  <option value="">Selecione um CTA</option>
                  {CTAS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
              <OptionCard icon={Crop} title="Tamanho e formato" sub="Escolha a proporção da sua imagem.">
                <div className="grid grid-cols-4 gap-2">
                  {RATIOS.map((r) => (
                    <Pill key={r.id} active={brief.ratio === r.id} onClick={() => patchBrief({ ratio: r.id })} className="px-0">{r.id}</Pill>
                  ))}
                </div>
              </OptionCard>

              <OptionCard icon={Palette} title="Estilo visual" sub="Defina o estilo do seu criativo.">
                <div className="flex flex-wrap gap-1.5">
                  {ESTILOS.map((e) => (
                    <Pill key={e} active={brief.estilo === e} onClick={() => patchBrief({ estilo: brief.estilo === e ? "" : e })} className="h-8 px-3">{e}</Pill>
                  ))}
                </div>
              </OptionCard>

              <OptionCard icon={Droplets} title="Cores da marca" sub="Adicione as cores da sua marca." optional>
                <div className="flex flex-wrap items-center gap-2">
                  {o.cores.map((c, i) => (
                    <button
                      key={`${c}-${i}`}
                      type="button"
                      onClick={() => patchOpts("image", { cores: o.cores.filter((_, j) => j !== i) })}
                      className="group relative w-8 h-8 rounded-full border shadow-sm"
                      style={{ background: c }}
                      title={`${c} — clique para remover`}
                    >
                      <X className="w-3.5 h-3.5 absolute inset-0 m-auto text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                    </button>
                  ))}
                  {o.cores.length < 6 && (
                    <button type="button" onClick={() => colorRef.current?.click()} className="w-8 h-8 rounded-full border border-dashed flex items-center justify-center hover:bg-muted" title="Adicionar cor">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <input ref={colorRef} type="color" className="sr-only" onChange={(e) => patchOpts("image", { cores: [...o.cores, e.target.value] })} />
                </div>
              </OptionCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <OptionCard icon={ImageIcon} title="Referência" sub="Envie uma imagem de referência para guiar o estilo." optional>
                <UploadBox
                  accept="image/png,image/jpeg,image/webp"
                  hint="PNG, JPG ou WEBP (máx. 5MB)"
                  maxMb={5}
                  value={o.referencia ? [{ data: o.referencia, type: "image/png", name: "Imagem de referência" }] : []}
                  onChange={(f) => patchOpts("image", { referencia: f[0]?.data || "" })}
                />
              </OptionCard>
              <OptionCard icon={FileText} title="Observações" sub="Adicione informações extras para um resultado ainda melhor." optional>
                <Textarea value={o.observacoes} onChange={(e) => patchOpts("image", { observacoes: e.target.value })} placeholder="Ex.: incluir logo, destacar preço, usar um tom mais sério..." className="min-h-[64px]" />
              </OptionCard>
            </div>
          </FormPanel>
        }
        preview={
          <PreviewPanel
            busy={busy.image}
            icon={Eye}
            sub="Veja como seu criativo ficará. A imagem será gerada aqui."
            actions={
              <>
                <DownloadButton url={imageUrl} label="Baixar" />
                <FullscreenButton url={imageUrl} />
              </>
            }
          >
            <div className={`mx-auto w-full transition-[max-width] duration-300 ${previewWidth(brief.ratio)}`}>
              <div className={`${spec.cls} w-full rounded-xl overflow-hidden border bg-gradient-to-br from-[color-mix(in_srgb,var(--muted)_60%,transparent)] to-[color-mix(in_srgb,var(--accent)_40%,transparent)] relative`}>
                {imageUrl ? (
                  <img src={imageUrl} alt="Criativo gerado" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
                    <ImageIcon className="w-8 h-8 text-[color-mix(in_srgb,var(--muted-foreground)_60%,transparent)]" />
                    <p className="text-sm font-semibold">{spec.id} · {spec.label}</p>
                    <p className="text-xs text-muted-foreground">{spec.sub}</p>
                  </div>
                )}
                {busy.image && <PreviewLoading label="Criando seu criativo…" sub="Costuma levar de 10 a 30 segundos" />}
              </div>
            </div>
          </PreviewPanel>
        }
      />
    </div>
  );
}
