import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Asset, AssetKind, Brief, FlowStep, Recipe, StepKind, ToolId } from "./types";
import { genAvatar, genCopy, genImage, genTts, genVideo, pickHeadline } from "./runners";

const STORAGE_KEY = "lowfy.studio.v1";
const MAX_ASSETS = 60;

const EMPTY_BRIEF: Brief = {
  produto: "",
  publico: "",
  dor: "",
  beneficios: "",
  oferta: "",
  tom: "",
  estilo: "",
  headline: "",
  ratio: "1:1",
  voice: "pNInz6obpgDQGcFmaJgB",
  lang: "pt-BR",
  photo: "",
};

const DEFAULT_OPTS = {
  image: { quality: "high", format: "png", background: "auto", objetivo: "", texto: "", cta: "", cores: [] as string[], observacoes: "", referencia: "" },
  copy: { tipo: "anuncio", framework: "auto", variacoes: 3 },
  tts: { modelId: "eleven_multilingual_v2", stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1 },
  video: { prompt: "", resolution: "720p", duration: "auto", imageUrl: "" },
};

type Opts = typeof DEFAULT_OPTS;

interface Persisted {
  brief: Brief;
  script: string;
  opts: Opts;
  assets: Asset[];
  projectName: string;
}

interface StudioValue {
  projectName: string;
  setProjectName: (n: string) => void;
  brief: Brief;
  patchBrief: (p: Partial<Brief>) => void;
  /** Roteiro único do projeto: alimenta narração, avatar e vídeo. */
  script: string;
  setScript: (s: string) => void;
  opts: Opts;
  patchOpts: <K extends keyof Opts>(k: K, p: Partial<Opts[K]>) => void;

  copyOut: string[];
  imageUrl: string | null;
  ttsUrl: string | null;
  avatarUrl: string | null;
  videoUrl: string | null;

  busy: Record<StepKind, boolean>;
  runCopy: () => Promise<void>;
  runImage: () => Promise<void>;
  runTts: () => Promise<void>;
  runAvatar: () => Promise<void>;
  runVideo: () => Promise<void>;

  assets: Asset[];
  addAsset: (a: Omit<Asset, "id" | "createdAt">) => Asset;
  removeAsset: (id: string) => void;
  clearAssets: () => void;
  /** Manda um asset para outra ferramenta já preenchida e troca de aba. */
  sendTo: (asset: Asset, target: ToolId) => void;

  tab: ToolId;
  setTab: (t: ToolId) => void;
  /** Abre/fecha o painel de briefing — as ferramentas pedem pra abrir. */
  briefOpen: boolean;
  setBriefOpen: (v: boolean) => void;

  flow: FlowState;
  startRecipe: (r: Recipe) => void;
  /** Volta para a vitrine de receitas. */
  clearRecipe: () => void;
  runFlow: () => void;
  runFlowStep: (index: number) => void;
  resetFlow: () => void;
  setFlowMode: (m: "auto" | "step") => void;

  resetProject: () => void;
  /** Campos do briefing que ainda faltam para o fluxo escolhido rodar. */
  missingFor: (r: Recipe | null) => string[];
}

interface FlowState {
  recipe: Recipe | null;
  steps: FlowStep[];
  running: boolean;
  mode: "auto" | "step";
  /** Índice da etapa em execução (-1 = parado). */
  cursor: number;
}

const Ctx = createContext<StudioValue | null>(null);

export const useStudio = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio precisa estar dentro de <StudioProvider>");
  return v;
};

function load(): Partial<Persisted> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const saved = useMemo(load, []);

  const [projectName, setProjectName] = useState<string>(saved.projectName || "Projeto sem nome");
  const [brief, setBrief] = useState<Brief>({ ...EMPTY_BRIEF, ...(saved.brief || {}) });
  const [script, setScript] = useState<string>(saved.script || "");
  const [opts, setOpts] = useState<Opts>({
    image: { ...DEFAULT_OPTS.image, ...(saved.opts?.image || {}) },
    copy: { ...DEFAULT_OPTS.copy, ...(saved.opts?.copy || {}) },
    tts: { ...DEFAULT_OPTS.tts, ...(saved.opts?.tts || {}) },
    video: { ...DEFAULT_OPTS.video, ...(saved.opts?.video || {}) },
  });
  const [assets, setAssets] = useState<Asset[]>(saved.assets || []);

  const [copyOut, setCopyOut] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<StepKind, boolean>>({ copy: false, image: false, tts: false, avatar: false, video: false });
  const [tab, setTab] = useState<ToolId>("fluxo");
  const [briefOpen, setBriefOpen] = useState<boolean>(!(saved.brief?.produto));

  const [flow, setFlow] = useState<FlowState>({ recipe: null, steps: [], running: false, mode: "auto", cursor: -1 });

  // Refs para o motor de fluxo enxergar sempre o estado mais novo dentro do loop async.
  const briefRef = useRef(brief);
  const optsRef = useRef(opts);
  const scriptRef = useRef(script);
  const abortRef = useRef(false);
  // Contexto acumulado do fluxo (saída de uma etapa vira entrada da próxima).
  const ctxRef = useRef<Record<string, any>>({});
  // Espelho do fluxo — o loop async precisa de mode/steps atualizados sem re-render.
  const flowRef = useRef<FlowState>({ recipe: null, steps: [], running: false, mode: "auto", cursor: -1 });
  useEffect(() => { briefRef.current = brief; }, [brief]);
  useEffect(() => { optsRef.current = opts; }, [opts]);
  useEffect(() => { scriptRef.current = script; }, [script]);

  // Persistência local: o projeto sobrevive a recarregar a página.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const payload: Persisted = { brief, script, opts: { ...opts, image: { ...opts.image, referencia: "" } }, assets: assets.slice(0, MAX_ASSETS), projectName };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch { /* quota estourada: seguimos sem persistir */ }
    }, 400);
    return () => clearTimeout(t);
  }, [brief, script, opts, assets, projectName]);

  const patchBrief = useCallback((p: Partial<Brief>) => setBrief((b) => ({ ...b, ...p })), []);
  const patchOpts = useCallback(<K extends keyof Opts>(k: K, p: Partial<Opts[K]>) => {
    setOpts((o) => ({ ...o, [k]: { ...o[k], ...p } }));
  }, []);

  const addAsset = useCallback((a: Omit<Asset, "id" | "createdAt">) => {
    const asset: Asset = { ...a, id: uid(), createdAt: Date.now() };
    setAssets((list) => [asset, ...list].slice(0, MAX_ASSETS));
    return asset;
  }, []);

  const removeAsset = useCallback((id: string) => setAssets((l) => l.filter((a) => a.id !== id)), []);
  const clearAssets = useCallback(() => setAssets([]), []);

  const fail = useCallback((title: string, e: any) => {
    toast({ title, description: e?.message || "Tente novamente", variant: "destructive" });
  }, [toast]);

  const withBusy = useCallback(async <T,>(kind: StepKind, fn: () => Promise<T>): Promise<T> => {
    setBusy((b) => ({ ...b, [kind]: true }));
    try {
      return await fn();
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  }, []);

  // ---- Execuções individuais (usadas pelos botões das abas) ----

  const runCopy = useCallback(async () => {
    try {
      const d = await withBusy("copy", () => genCopy(briefRef.current, optsRef.current.copy));
      const list = d.variacoes || [];
      setCopyOut(list);
      if (list[0] && !scriptRef.current.trim()) setScript(list[0]);
      addAsset({ kind: "copy", text: list.join("\n\n"), label: briefRef.current.produto || "Copy", from: "Copy" });
    } catch (e) { fail("Erro ao gerar copy", e); }
  }, [withBusy, addAsset, fail]);

  const runImage = useCallback(async () => {
    try {
      const d = await withBusy("image", () => genImage(briefRef.current, optsRef.current.image));
      setImageUrl(d.url);
      addAsset({ kind: "image", url: d.url, label: briefRef.current.produto || "Criativo", from: "Criativo", ratio: briefRef.current.ratio });
    } catch (e) { fail("Erro ao gerar criativo", e); }
  }, [withBusy, addAsset, fail]);

  const runTts = useCallback(async () => {
    try {
      const d = await withBusy("tts", () => genTts(briefRef.current, { ...optsRef.current.tts, text: scriptRef.current }));
      setTtsUrl(d.url);
      addAsset({ kind: "audio", url: d.url, label: "Narração", from: "Narração" });
    } catch (e) { fail("Erro ao gerar narração", e); }
  }, [withBusy, addAsset, fail]);

  const runAvatar = useCallback(async () => {
    try {
      const d = await withBusy("avatar", () => genAvatar(briefRef.current, { text: scriptRef.current }));
      setAvatarUrl(d.url);
      addAsset({ kind: "video", url: d.url, label: "Avatar falante", from: "Avatar", ratio: briefRef.current.ratio });
    } catch (e) { fail("Erro ao gerar avatar", e); }
  }, [withBusy, addAsset, fail]);

  const runVideo = useCallback(async () => {
    try {
      const d = await withBusy("video", () => genVideo(briefRef.current, { ...optsRef.current.video, script: scriptRef.current }));
      setVideoUrl(d.url);
      addAsset({ kind: "video", url: d.url, label: briefRef.current.produto || "Vídeo", from: "Vídeo", ratio: briefRef.current.ratio });
    } catch (e) { fail("Erro ao gerar vídeo", e); }
  }, [withBusy, addAsset, fail]);

  // ---- Reaproveitar um asset em outra ferramenta ----

  const sendTo = useCallback((asset: Asset, target: ToolId) => {
    if (asset.kind === "copy" && asset.text) {
      setScript(asset.text);
      if (target === "criativo") patchBrief({ headline: pickHeadline([asset.text], briefRef.current.headline) });
    }
    if (asset.kind === "image" && asset.url) {
      if (target === "video") patchOpts("video", { imageUrl: asset.url });
      if (target === "avatar") patchBrief({ photo: asset.url });
    }
    setTab(target);
    toast({ title: "Enviado", description: `"${asset.label}" já está carregado em ${LABELS[target]}.` });
  }, [patchBrief, patchOpts, toast]);

  // ---- Motor de fluxo ----

  const missingFor = useCallback((r: Recipe | null): string[] => {
    const miss: string[] = [];
    if (!brief.produto.trim()) miss.push("produto ou oferta");
    if (r?.needsPhoto && !brief.photo) miss.push("foto de rosto");
    return miss;
  }, [brief.produto, brief.photo]);

  const startRecipe = useCallback((r: Recipe) => {
    abortRef.current = true;
    if (r.ratio) patchBrief({ ratio: r.ratio });
    setFlow((f) => ({
      recipe: r,
      steps: r.steps.map((s) => ({ ...s, id: uid(), status: "idle" as const })),
      running: false,
      mode: f.mode,
      cursor: -1,
    }));
  }, [patchBrief]);

  const clearRecipe = useCallback(() => {
    abortRef.current = true;
    ctxRef.current = {};
    setFlow((f) => ({ ...f, recipe: null, steps: [], running: false, cursor: -1 }));
  }, []);

  const resetFlow = useCallback(() => {
    abortRef.current = true;
    setFlow((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, status: "idle", error: undefined, asset: undefined })), running: false, cursor: -1 }));
  }, []);

  const setFlowMode = useCallback((mode: "auto" | "step") => setFlow((f) => ({ ...f, mode })), []);

  const patchStep = useCallback((index: number, p: Partial<FlowStep>) => {
    setFlow((f) => ({ ...f, steps: f.steps.map((s, i) => (i === index ? { ...s, ...p } : s)) }));
  }, []);

  /** Executa uma etapa isolada, propagando o contexto acumulado do fluxo. */
  const execStep = useCallback(async (step: FlowStep, ctx: Record<string, any>): Promise<Asset> => {
    const b = briefRef.current;
    const o = optsRef.current;
    switch (step.kind) {
      case "copy": {
        const p = { tipo: step.opts?.tipo || o.copy.tipo, framework: step.opts?.framework || o.copy.framework, variacoes: step.opts?.variacoes || o.copy.variacoes };
        const d = await genCopy(b, p);
        const list = d.variacoes || [];
        if (!list.length) throw new Error("A IA não retornou nenhuma copy");
        ctx.copyList = list;
        ctx.copyText = list[0];
        ctx.headline = pickHeadline(list, b.headline || b.produto);
        setCopyOut(list);
        setScript(list[0]);
        setBrief((prev) => ({ ...prev, headline: prev.headline || ctx.headline }));
        return addAsset({ kind: "copy", text: list.join("\n\n"), label: `${step.title}`, from: "Fluxo · Copy" });
      }
      case "image": {
        const d = await genImage(b, { ...o.image, headline: ctx.headline });
        ctx.imageUrl = d.url;
        setImageUrl(d.url);
        return addAsset({ kind: "image", url: d.url, label: b.produto || "Criativo", from: "Fluxo · Criativo", ratio: b.ratio });
      }
      case "tts": {
        const text = ctx.copyText || scriptRef.current;
        if (!text.trim()) throw new Error("Sem roteiro para narrar");
        const d = await genTts(b, { ...o.tts, text });
        ctx.audioUrl = d.url;
        setTtsUrl(d.url);
        return addAsset({ kind: "audio", url: d.url, label: "Narração", from: "Fluxo · Narração" });
      }
      case "avatar": {
        const text = ctx.copyText || scriptRef.current;
        if (!b.photo) throw new Error("Envie uma foto de rosto no briefing");
        if (!text.trim()) throw new Error("Sem roteiro para o avatar falar");
        const d = await genAvatar(b, { text });
        ctx.videoUrl = d.url;
        setAvatarUrl(d.url);
        return addAsset({ kind: "video", url: d.url, label: "Avatar falante", from: "Fluxo · Avatar", ratio: b.ratio });
      }
      case "video": {
        const d = await genVideo(b, {
          ...o.video,
          script: ctx.copyText || scriptRef.current,
          imageUrl: ctx.imageUrl || o.video.imageUrl,
        });
        ctx.videoUrl = d.url;
        setVideoUrl(d.url);
        return addAsset({ kind: "video", url: d.url, label: b.produto || "Vídeo", from: "Fluxo · Vídeo", ratio: b.ratio });
      }
    }
  }, [addAsset]);

  const runFrom = useCallback(async (start: number) => {
    abortRef.current = false;
    const list = flowRef.current.steps;
    if (start === 0) ctxRef.current = {};
    setFlow((f) => ({ ...f, running: true }));
    for (let i = start; i < list.length; i++) {
      if (abortRef.current) break;
      setFlow((f) => ({ ...f, cursor: i }));
      patchStep(i, { status: "running", error: undefined });
      setBusy((b) => ({ ...b, [list[i].kind]: true }));
      try {
        const asset = await execStep(list[i], ctxRef.current);
        patchStep(i, { status: "done", asset });
      } catch (e: any) {
        patchStep(i, { status: "error", error: e?.message || "Falhou" });
        toast({ title: `Etapa "${list[i].title}" falhou`, description: e?.message || "Tente rodar essa etapa de novo", variant: "destructive" });
        setFlow((f) => ({ ...f, running: false, cursor: -1 }));
        return;
      } finally {
        setBusy((b) => ({ ...b, [list[i].kind]: false }));
      }
      if (flowRef.current.mode === "step" && i < list.length - 1) {
        setFlow((f) => ({ ...f, running: false, cursor: -1 }));
        return;
      }
    }
    setFlow((f) => ({ ...f, running: false, cursor: -1 }));
    if (!abortRef.current) toast({ title: "Fluxo concluído!", description: "Suas peças estão na bandeja, prontas pra baixar ou publicar." });
  }, [execStep, patchStep, toast]);

  const runFlow = useCallback(() => {
    const steps = flowRef.current.steps;
    const nextIdle = steps.findIndex((s) => s.status !== "done");
    void runFrom(nextIdle === -1 ? 0 : nextIdle);
  }, [runFrom]);

  const runFlowStep = useCallback((index: number) => {
    abortRef.current = false;
    void (async () => {
      const step = flowRef.current.steps[index];
      if (!step) return;
      setFlow((f) => ({ ...f, running: true, cursor: index }));
      patchStep(index, { status: "running", error: undefined });
      setBusy((b) => ({ ...b, [step.kind]: true }));
      try {
        const asset = await execStep(step, ctxRef.current);
        patchStep(index, { status: "done", asset });
      } catch (e: any) {
        patchStep(index, { status: "error", error: e?.message || "Falhou" });
        toast({ title: `Etapa "${step.title}" falhou`, description: e?.message, variant: "destructive" });
      } finally {
        setBusy((b) => ({ ...b, [step.kind]: false }));
        setFlow((f) => ({ ...f, running: false, cursor: -1 }));
      }
    })();
  }, [execStep, patchStep, toast]);

  const resetProject = useCallback(() => {
    abortRef.current = true;
    setBrief({ ...EMPTY_BRIEF });
    setScript("");
    setOpts({ ...DEFAULT_OPTS, image: { ...DEFAULT_OPTS.image }, copy: { ...DEFAULT_OPTS.copy }, tts: { ...DEFAULT_OPTS.tts }, video: { ...DEFAULT_OPTS.video } });
    setCopyOut([]); setImageUrl(null); setTtsUrl(null); setAvatarUrl(null); setVideoUrl(null);
    setAssets([]);
    setProjectName("Projeto sem nome");
    setBriefOpen(true);
    setFlow({ recipe: null, steps: [], running: false, mode: "auto", cursor: -1 });
    setTab("fluxo");
  }, []);

  const value: StudioValue = {
    projectName, setProjectName,
    brief, patchBrief,
    script, setScript,
    opts, patchOpts,
    addAsset,
    copyOut, imageUrl, ttsUrl, avatarUrl, videoUrl,
    busy, runCopy, runImage, runTts, runAvatar, runVideo,
    assets, removeAsset, clearAssets, sendTo,
    tab, setTab, briefOpen, setBriefOpen,
    flow, startRecipe, clearRecipe, runFlow, runFlowStep, resetFlow, setFlowMode,
    resetProject, missingFor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const LABELS: Record<ToolId, string> = {
  fluxo: "Fluxos",
  criativo: "Criativo",
  copy: "Copy",
  narracao: "Narração",
  avatar: "Avatar",
  video: "Vídeo",
  motion: "Motion",
  ebook: "E-books",
  vozes: "Vozes",
  biblioteca: "Biblioteca",
};

export const KIND_LABEL: Record<AssetKind, string> = {
  image: "Imagem",
  copy: "Texto",
  audio: "Áudio",
  video: "Vídeo",
};
