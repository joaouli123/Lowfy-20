import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Video, FileText, Eye, Download, Maximize2, Sparkles, Film } from "lucide-react";
import { useStudio } from "./store";
import { ratioSpec } from "./types";
import type { RatioId } from "./types";
import {
  FieldLabel, FormFooter, FormPanel, MissingHint, PageGrid, PageHeader, PillGroup, PreviewLoading, PreviewPanel,
  UploadBox, missingOf, selectCls, useLocalForm,
} from "./page-kit";
import type { UploadedFile } from "./page-kit";

const OBJETIVOS = ["Divulgar e vender", "Gerar leads", "Lançamento", "Promoção relâmpago", "Reconhecimento de marca", "Engajamento"];
const CTAS = ["Compre agora", "Saiba mais", "Garanta o seu", "Fale no WhatsApp", "Cadastre-se", "Aproveite a oferta"];
// Seedance 2.0 gera até 15s por vídeo.
const DURACOES = [{ v: "5", label: "5s" }, { v: "10", label: "10s" }, { v: "15", label: "15s" }] as const;
const FORMATOS = [{ v: "9:16", label: "9:16" }, { v: "1:1", label: "1:1" }, { v: "16:9", label: "16:9" }] as const;
const ESTILOS = [
  { v: "clean", label: "Clean" }, { v: "moderno", label: "Moderno" }, { v: "promocional", label: "Promocional" }, { v: "cinematografico", label: "Cinematográfico" },
] as const;

const DEFAULTS = {
  produto: "", objetivo: "Divulgar e vender", publico: "", mensagem: "", duracao: "15" as string, formato: "9:16" as RatioId,
  estilo: "clean" as string, cta: "Compre agora", observacoes: "", arquivos: [] as UploadedFile[],
};

const previewWidth = (r: RatioId) => (r === "9:16" ? "max-w-[250px]" : r === "1:1" ? "max-w-[360px]" : "max-w-full");

export default function VideoPage() {
  const { brief, addAsset } = useStudio();
  const { toast } = useToast();
  const [f, patch, reset] = useLocalForm("video", DEFAULTS);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thumb, setThumb] = useState(0);
  const spec = ratioSpec(f.formato);

  const missing = missingOf([["produto", f.produto], ["objetivo", f.objetivo], ["público", f.publico], ["mensagem", f.mensagem], ["CTA", f.cta]]);

  const run = async () => {
    setBusy(true);
    try {
      const r = await apiRequest("POST", "/api/ai-studio/video", {
        produto: f.produto, objetivo: f.objetivo, publico: f.publico, mensagem: f.mensagem, estilo: f.estilo, cta: f.cta, observacoes: f.observacoes,
        imageUrl: f.arquivos[thumb]?.data || f.arquivos[0]?.data || undefined,
        script: f.mensagem,
        voice: brief.voice,
        size: spec.videoSize,
        resolution: "720p",
        duration: f.duracao,
        idioma: brief.lang,
      });
      const d = (await r.json()) as { url: string };
      setUrl(d.url);
      addAsset({ kind: "video", url: d.url, label: f.produto || "Vídeo", from: "Vídeo", ratio: f.formato });
    } catch (e: any) {
      toast({ title: "Erro ao gerar vídeo", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const base = f.arquivos[thumb] || f.arquivos[0];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={Video}
        title="Criação de Vídeo"
        sub="Transforme sua oferta em vídeos curtos de forma rápida e fácil com ajuda da IA."
        tip="vídeos curtos e objetivos costumam converter mais."
      />

      <PageGrid
        form={
          <FormPanel
            icon={FileText}
            title="Informações do vídeo"
            sub="Defina os dados principais para montar seu vídeo."
            footer={
              <div className="space-y-3">
                <FormFooter onClear={() => { reset(); setUrl(null); setThumb(0); }} onSubmit={() => void run()} busy={busy} disabled={missing.length > 0} label="Gerar vídeo" busyLabel="Gerando vídeo…" icon={Sparkles} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
              <div>
                <FieldLabel upper required>Produto ou oferta</FieldLabel>
                <Input value={f.produto} onChange={(e) => patch({ produto: e.target.value })} placeholder="Ex.: tênis esportivo branco premium" />
              </div>
              <div>
                <FieldLabel upper required>Objetivo</FieldLabel>
                <select value={f.objetivo} onChange={(e) => patch({ objetivo: e.target.value })} className={selectCls}>
                  <option value="">Selecione o objetivo</option>
                  {OBJETIVOS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel upper required>Público-alvo</FieldLabel>
                <Input value={f.publico} onChange={(e) => patch({ publico: e.target.value })} placeholder="Ex.: jovens de 18 a 30 anos, que praticam esportes" />
              </div>
              <div>
                <FieldLabel upper required>Mensagem principal</FieldLabel>
                <Textarea value={f.mensagem} onChange={(e) => patch({ mensagem: e.target.value })} placeholder="Ex.: Conforto, performance e estilo em todo momento." className="min-h-[64px]" />
              </div>
              <div>
                <FieldLabel upper required>Duração</FieldLabel>
                <PillGroup options={[...DURACOES]} value={f.duracao} onChange={(v) => patch({ duracao: v })} />
              </div>
              <div>
                <FieldLabel upper required>Formato</FieldLabel>
                <PillGroup options={[...FORMATOS]} value={f.formato} onChange={(v) => patch({ formato: v })} />
              </div>
              <div>
                <FieldLabel upper>Estilo visual</FieldLabel>
                <PillGroup options={[...ESTILOS]} value={f.estilo} onChange={(v) => patch({ estilo: v })} />
              </div>
              <div>
                <FieldLabel upper required>CTA</FieldLabel>
                <select value={f.cta} onChange={(e) => patch({ cta: e.target.value })} className={selectCls}>
                  <option value="">Selecione um CTA</option>
                  {CTAS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel upper optional>Uploads</FieldLabel>
                <p className="text-[11px] text-muted-foreground -mt-1 mb-2">Envie sua logo, produto ou imagens de apoio.</p>
                <UploadBox
                  accept="image/png,image/jpeg,image/webp"
                  hint="PNG, JPG ou WEBP (máx. 5MB cada, até 5)"
                  label="Clique para enviar arquivos"
                  maxMb={5}
                  multiple
                  value={f.arquivos}
                  onChange={(v) => { patch({ arquivos: v }); setThumb(0); }}
                />
              </div>
              <div>
                <FieldLabel upper optional>Observações</FieldLabel>
                <Textarea value={f.observacoes} onChange={(e) => patch({ observacoes: e.target.value })} placeholder="Ex.: cores da marca, tom de voz, algum detalhe específico..." className="min-h-[86px]" />
              </div>
            </div>
          </FormPanel>
        }
        preview={
          <PreviewPanel
            icon={Eye}
            sub="Veja uma prévia do seu vídeo antes de gerar."
            actions={
              <>
                <Button variant="outline" className="h-10" disabled={!url} asChild={!!url}>
                  {url ? <a href={url} download><Download className="w-4 h-4 mr-2" /> Baixar</a> : <span><Download className="w-4 h-4 mr-2" /> Baixar</span>}
                </Button>
                <Button variant="outline" className="h-10" disabled={!url} onClick={() => url && window.open(url, "_blank")}>
                  <Maximize2 className="w-4 h-4 mr-2" /> Abrir em tela cheia
                </Button>
              </>
            }
          >
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--muted)_50%,transparent)] p-3">
              <div className={`mx-auto w-full transition-[max-width] duration-300 ${previewWidth(f.formato)}`}>
                <div className={`${spec.cls} w-full rounded-lg overflow-hidden relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900`}>
                  {url ? (
                    <video src={url} controls className="w-full h-full object-cover bg-black" />
                  ) : base ? (
                    <img src={base.data} alt="Base do vídeo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-5 text-white">
                      <Film className="w-8 h-8 text-white/70" />
                      <p className="text-lg font-extrabold uppercase leading-tight line-clamp-3">{f.mensagem || f.produto || "Sua mensagem aqui"}</p>
                      {f.cta && <span className="mt-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase">{f.cta}</span>}
                    </div>
                  )}
                  {!url && (
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-2 text-white text-[10px] pointer-events-none">
                      <span>0:00 / 0:{f.duracao.padStart(2, "0")}</span>
                      <div className="flex-1 h-1 rounded-full bg-white/30" />
                    </div>
                  )}
                  {busy && <PreviewLoading label="Gerando seu vídeo…" sub="Pode levar alguns minutos" />}
                </div>
              </div>
            </div>

            {f.arquivos.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {f.arquivos.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setThumb(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition ${i === thumb ? "border-primary" : "border-transparent opacity-80 hover:opacity-100"}`}
                    title={i === thumb ? "Imagem base do vídeo" : "Usar como imagem base"}
                  >
                    <img src={a.data} alt={a.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </PreviewPanel>
        }
      />
    </div>
  );
}
