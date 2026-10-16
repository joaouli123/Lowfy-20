import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sparkles, Workflow, Image as ImageIcon, Type, Mic, Video, UserSquare2, AudioWaveform,
  Library, RotateCcw, Languages, Cpu, Check,
} from "lucide-react";
import { StudioProvider, useStudio } from "@/components/studio/store";
import type { ToolId } from "@/components/studio/types";
import BriefBar from "@/components/studio/BriefBar";
import FlowBoard from "@/components/studio/FlowBoard";
import AssetDock from "@/components/studio/AssetDock";
import VoicesPanel from "@/components/studio/VoicesPanel";
import LibraryPanel from "@/components/studio/LibraryPanel";
import CriativoPage from "@/components/studio/CriativoPage";
import CopyPage from "@/components/studio/CopyPage";
import NarracaoPage from "@/components/studio/NarracaoPage";
import AvatarPage from "@/components/studio/AvatarPage";
import VideoPage from "@/components/studio/VideoPage";

// Ferramentas com página própria (cabeçalho + formulário + preview).
const FULL_PAGES: Partial<Record<ToolId, () => JSX.Element>> = {
  criativo: CriativoPage,
  copy: CopyPage,
  narracao: NarracaoPage,
  avatar: AvatarPage,
  video: VideoPage,
};

/** Cada ferramenta do Estúdio é uma página própria (submenu no sidebar). */
export const STUDIO_PAGES: { id: ToolId; slug: string; label: string; icon: any }[] = [
  { id: "criativo", slug: "criativo", label: "Criativo", icon: ImageIcon },
  { id: "copy", slug: "copy", label: "Copy", icon: Type },
  { id: "narracao", slug: "narracao", label: "Narração", icon: Mic },
  { id: "avatar", slug: "avatar", label: "Avatar", icon: UserSquare2 },
  { id: "video", slug: "video", label: "Vídeo", icon: Video },
  { id: "vozes", slug: "clone-de-voz", label: "Clone de voz", icon: AudioWaveform },
  { id: "fluxo", slug: "fluxos", label: "Fluxos", icon: Workflow },
  { id: "biblioteca", slug: "historico", label: "Histórico", icon: Library },
];

const LANGS = [
  { v: "pt-BR", label: "Português (BR)" },
  { v: "en-US", label: "English (US)" },
  { v: "es-ES", label: "Español" },
];

export default function AIStudio() {
  return (
    <StudioProvider>
      <StudioShell />
    </StudioProvider>
  );
}

function StudioShell() {
  const { tab, setTab, projectName, setProjectName, brief, patchBrief, resetProject } = useStudio();
  const params = useParams<{ tool?: string }>();
  const [, navigate] = useLocation();
  const fromUrl = STUDIO_PAGES.find((p) => p.slug === params.tool);

  // URL manda: /ai-studio/<slug> define a ferramenta aberta.
  useEffect(() => {
    if (!fromUrl) navigate("/ai-studio/criativo", { replace: true });
    else if (fromUrl.id !== tab) setTab(fromUrl.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tool]);

  // Ações internas (ex.: "usar em narração") trocam a ferramenta pelo store; refletimos na URL.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const target = STUDIO_PAGES.find((p) => p.id === tab);
    if (fromUrl && target && target.id !== fromUrl.id) navigate(`/ai-studio/${target.slug}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!fromUrl) return null;
  const current = fromUrl.id;

  const Full = FULL_PAGES[current];
  if (Full) {
    return (
      <>
        <Full />
        <AssetDock />
      </>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <StudioHeader
        projectName={projectName}
        setProjectName={setProjectName}
        lang={brief.lang}
        setLang={(v) => patchBrief({ lang: v })}
        onReset={resetProject}
      />

      {current !== "biblioteca" && current !== "vozes" && <BriefBar />}

      {current === "fluxo" && <FlowBoard />}
      {current === "vozes" && <VoicesPanel />}
      {current === "biblioteca" && <LibraryPanel />}

      <AssetDock />
    </div>
  );
}

function StudioHeader({ projectName, setProjectName, lang, setLang, onReset }: {
  projectName: string;
  setProjectName: (n: string) => void;
  lang: string;
  setLang: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full max-w-sm bg-transparent text-xl font-bold tracking-tight outline-none border-b border-transparent focus:border-border transition px-0"
          aria-label="Nome do projeto"
        />
        <p className="text-sm text-muted-foreground">Estúdio de Criação IA — criativo, copy, voz e vídeo no mesmo projeto.</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <Languages className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="h-9 rounded-lg border bg-card pl-8 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            aria-label="Idioma das gerações"
          >
            {LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
          </select>
        </div>
        <EnginesBadge />
        <Button variant="outline" size="sm" className="h-9" onClick={onReset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Novo projeto
        </Button>
      </div>
    </div>
  );
}

/** Estado dos motores de IA: mostra o que está no modo premium e o que roda no gratuito. */
function EnginesBadge() {
  const { data } = useQuery({
    queryKey: ["/api/ai-studio/capabilities"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ai-studio/capabilities");
      return (await r.json()) as Record<string, { ready?: boolean; premium?: boolean }>;
    },
    staleTime: 10 * 60 * 1000,
  });

  const rows = [
    { k: "image", label: "Criativos" },
    { k: "copy", label: "Copy" },
    { k: "tts", label: "Narração" },
    { k: "voiceClone", label: "Clonagem de voz" },
    { k: "avatar", label: "Avatar" },
    { k: "video", label: "Vídeo" },
  ];
  const premium = rows.filter((r) => data?.[r.k]?.premium).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Cpu className="w-3.5 h-3.5 mr-1.5" /> Motores
          {premium > 0 && <span className="ml-1.5 text-[10px] font-bold text-primary bg-accent rounded px-1">{premium} PRO</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-[11px] text-muted-foreground px-1.5 pb-1.5">O que está ligado nesta conta</p>
        {rows.map((r) => {
          const c = data?.[r.k];
          return (
            <div key={r.k} className="flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-lg hover:bg-muted transition">
              <span className="text-xs font-medium">{r.label}</span>
              {c?.premium ? (
                <span className="text-[10px] font-bold text-primary bg-accent rounded px-1.5 py-0.5 inline-flex items-center gap-1"><Check className="w-3 h-3" /> PRO</span>
              ) : c?.ready ? (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">Gratuito</span>
              ) : (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Sem chave</span>
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
