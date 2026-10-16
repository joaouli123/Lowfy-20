import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserRound, SquarePen, Eye, Download, Maximize2, User, Crop, Image as ImageIcon, MessageSquare, Sparkles, Play } from "lucide-react";
import { useStudio } from "./store";
import { ratioSpec } from "./types";
import type { RatioId } from "./types";
import {
  CharCount, FieldLabel, FormFooter, FormPanel, MissingHint, OptionCard, PageGrid, PageHeader, PillGroup, PreviewLoading,
  PreviewPanel, DownloadButton, FullscreenButton, UploadBox, missingOf, selectCls, useLocalForm,
} from "./page-kit";
import type { UploadedFile } from "./page-kit";

const MAX = 2000;
const OBJETIVOS = ["Vender um produto", "Explicar como funciona", "Apresentar a empresa", "Dar boas-vindas", "Divulgar promoção", "Depoimento"];
const LANGS = [{ v: "pt-BR", label: "Português (BR)" }, { v: "en-US", label: "English (US)" }, { v: "es-ES", label: "Español" }];
const ESTILOS = [
  { v: "profissional", label: "Profissional" }, { v: "casual", label: "Casual" }, { v: "elegante", label: "Elegante" }, { v: "vendedor", label: "Vendedor" },
] as const;
const FORMATOS = [{ v: "1:1", label: "1:1" }, { v: "9:16", label: "9:16" }, { v: "16:9", label: "16:9" }] as const;
const CENARIOS = [
  { v: "estudio", label: "Estúdio" }, { v: "clean", label: "Clean" }, { v: "escritorio", label: "Escritório" }, { v: "produto", label: "Produto" },
] as const;

const DEFAULTS = {
  objetivo: "", produto: "", publico: "", roteiro: "", estilo: "profissional" as string, formato: "16:9" as RatioId,
  cenario: "estudio" as string, observacoes: "", foto: [] as UploadedFile[],
};

const previewWidth = (r: RatioId) => (r === "9:16" ? "max-w-[250px]" : r === "1:1" ? "max-w-[360px]" : "max-w-full");

export default function AvatarPage() {
  const { brief, patchBrief, addAsset } = useStudio();
  const { toast } = useToast();
  const [f, patch, reset] = useLocalForm("avatar", DEFAULTS);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spec = ratioSpec(f.formato);

  const missing = missingOf([["o que o avatar vai falar", f.roteiro]]);

  const example = () => patch({
    objetivo: "Vender um produto", produto: "Curso online de marketing digital", publico: "Empreendedores iniciantes",
    roteiro: "Oi! Você quer vender todos os dias pela internet? No nosso curso você aprende, passo a passo, a criar anúncios que convertem. Clique no link e comece hoje mesmo!",
    estilo: "vendedor", formato: "9:16", cenario: "estudio",
  });

  const run = async () => {
    if (f.roteiro.length > MAX) return toast({ title: "Roteiro muito longo", description: `O limite é ${MAX} caracteres.`, variant: "destructive" });
    setBusy(true);
    try {
      const r = await apiRequest("POST", "/api/ai-studio/avatar", {
        imageUrl: f.foto[0]?.data || brief.photo || undefined,
        text: f.roteiro,
        voice: brief.voice,
        size: spec.videoSize,
        idioma: brief.lang,
        // Sem foto, o servidor cria o apresentador a partir destes campos.
        apresentador: { objetivo: f.objetivo, produto: f.produto, publico: f.publico, estilo: f.estilo, cenario: f.cenario, observacoes: f.observacoes, ratio: f.formato },
      });
      const d = (await r.json()) as { url: string };
      setUrl(d.url);
      addAsset({ kind: "video", url: d.url, label: f.produto || "Avatar", from: "Avatar", ratio: f.formato });
    } catch (e: any) {
      toast({ title: "Erro ao gerar avatar", description: e?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        icon={UserRound}
        title="Criação de Avatar"
        sub="Crie apresentadores virtuais em poucos cliques para vender, explicar ou apresentar seu produto."
        tip="descreva o que o avatar deve falar e escolha um estilo simples."
      />

      <PageGrid
        form={
          <FormPanel
            icon={SquarePen}
            title="Configurações do avatar"
            sub="Escreva o que o avatar vai falar. Sem foto, a IA cria um apresentador."
            onExample={example}
            footer={
              <div className="space-y-3">
                <FormFooter onClear={() => { reset(); setUrl(null); }} onSubmit={() => void run()} busy={busy} disabled={missing.length > 0} label="Gerar avatar" busyLabel="Gerando avatar…" icon={Sparkles} />
                <MissingHint missing={missing} />
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 [&>*]:min-w-0">
              <div className="space-y-4">
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
                  <FieldLabel>Idioma</FieldLabel>
                  <select value={brief.lang} onChange={(e) => patchBrief({ lang: e.target.value })} className={selectCls}>
                    {LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <FieldLabel optional>Produto ou assunto</FieldLabel>
                  <Input value={f.produto} onChange={(e) => patch({ produto: e.target.value })} placeholder="Ex.: tênis esportivo, curso de marketing, aplicativo..." />
                </div>
                <div>
                  <FieldLabel required>O que o avatar vai falar</FieldLabel>
                  <Textarea
                    value={f.roteiro}
                    onChange={(e) => patch({ roteiro: e.target.value })}
                    placeholder={"Digite aqui o que o avatar deve falar...\nEx.: Apresente o produto, destaque os benefícios e chame para a ação."}
                    className="min-h-[110px]"
                  />
                  <CharCount value={f.roteiro} max={MAX} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.9fr_1.3fr] [&>*]:min-w-0">
              <OptionCard icon={User} title="Estilo do avatar">
                <PillGroup options={[...ESTILOS]} value={f.estilo} onChange={(v) => patch({ estilo: v })} />
              </OptionCard>
              <OptionCard icon={Crop} title="Formato">
                <PillGroup options={[...FORMATOS]} value={f.formato} onChange={(v) => patch({ formato: v })} cols={3} />
              </OptionCard>
              <OptionCard icon={ImageIcon} title="Cenário de fundo">
                <PillGroup options={[...CENARIOS]} value={f.cenario} onChange={(v) => patch({ cenario: v })} />
              </OptionCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <OptionCard icon={ImageIcon} title="Referência" sub="Envie a foto de uma pessoa para ser o avatar. Sem foto, a IA cria um apresentador." optional>
                <UploadBox accept="image/png,image/jpeg,image/webp" hint="PNG, JPG ou WEBP (máx. 5MB)" maxMb={5} value={f.foto} onChange={(v) => patch({ foto: v })} />
              </OptionCard>
              <OptionCard icon={MessageSquare} title="Observações" optional>
                <Textarea value={f.observacoes} onChange={(e) => patch({ observacoes: e.target.value })} placeholder="Ex.: cor da roupa, tom de voz, destaque algum ponto..." className="min-h-[64px]" />
              </OptionCard>
            </div>
          </FormPanel>
        }
        preview={
          <PreviewPanel
            busy={busy}
            icon={Eye}
            sub="Veja como seu avatar poderá aparecer."
            actions={
              <>
                <DownloadButton url={url} label="Baixar" />
                <FullscreenButton url={url} />
              </>
            }
          >
            <div className={`mx-auto w-full transition-[max-width] duration-300 ${previewWidth(f.formato)}`}>
              <div className={`${spec.cls} w-full rounded-xl overflow-hidden border relative bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900`}>
                {url ? (
                  <video src={url} controls className="w-full h-full object-cover bg-black" />
                ) : f.foto[0] ? (
                  <>
                    <img src={f.foto[0].data} alt="Foto do avatar" className="w-full h-full object-cover" />
                    <PlayOverlay />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 text-white">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"><UserRound className="w-8 h-8 text-white/80" /></div>
                    <p className="text-sm font-semibold">{f.formato} · {CENARIOS.find((c) => c.v === f.cenario)?.label}</p>
                    <p className="text-xs text-white/60">Estilo {ESTILOS.find((e) => e.v === f.estilo)?.label.toLowerCase()}</p>
                    <PlayOverlay />
                  </div>
                )}
                {busy && <PreviewLoading label="Gerando seu avatar…" sub="Pode levar alguns minutos" />}
              </div>
            </div>
          </PreviewPanel>
        }
      />
    </div>
  );
}

function PlayOverlay() {
  return (
    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-2 text-white pointer-events-none">
      <Play className="w-4 h-4 fill-current" />
      <span className="text-[11px]">0:00</span>
      <div className="flex-1 h-1 rounded-full bg-white/30" />
    </div>
  );
}
