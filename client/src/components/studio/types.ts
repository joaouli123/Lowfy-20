// Tipos compartilhados do Estúdio de Criação IA.
// Tudo no Estúdio gira em torno de dois conceitos:
//  - Briefing: o "cérebro" do projeto (produto, público, dor, formato, voz). Preenchido
//    uma vez e reaproveitado por todas as ferramentas — o usuário não redigita nada.
//  - Asset: qualquer coisa gerada (criativo, copy, narração, avatar, vídeo). Assets
//    circulam entre as ferramentas ("usar em…") e alimentam os fluxos.

export type AssetKind = "image" | "copy" | "audio" | "video";

export type ToolId =
  | "fluxo"
  | "criativo"
  | "copy"
  | "narracao"
  | "avatar"
  | "video"
  | "motion"
  | "vozes"
  | "biblioteca";

export interface Asset {
  id: string;
  kind: AssetKind;
  /** URL do arquivo (imagem/áudio/vídeo). Vazio em assets de texto. */
  url?: string;
  /** Conteúdo textual (copy). */
  text?: string;
  label: string;
  /** Ferramenta que gerou — usado no rótulo da bandeja. */
  from: string;
  ratio?: string;
  createdAt: number;
}

export interface Brief {
  produto: string;
  publico: string;
  dor: string;
  beneficios: string;
  oferta: string;
  tom: string;
  /** Estilo visual dos criativos. */
  estilo: string;
  /** Headline curta usada nos criativos quando a IA não gerar uma. */
  headline: string;
  /** Formato mestre do projeto: define proporção de imagem e vídeo. */
  ratio: RatioId;
  /** voiceId (ElevenLabs) usado em narração, avatar e vídeo. */
  voice: string;
  lang: string;
  /** Foto de rosto (dataURL ou URL) para o avatar falante. */
  photo: string;
}

export type RatioId = "1:1" | "4:5" | "9:16" | "16:9";

export interface RatioSpec {
  id: RatioId;
  label: string;
  sub: string;
  /** Classe tailwind de aspect-ratio para as prévias. */
  cls: string;
  /** Tamanho aceito pelo endpoint de imagem. */
  imageSize: "1024x1024" | "1024x1536" | "1536x1024";
  /** Tamanho aceito pelos endpoints de vídeo/avatar. */
  videoSize: "1080x1080" | "1080x1920" | "1920x1080";
}

export const RATIOS: RatioSpec[] = [
  { id: "1:1", label: "Quadrado", sub: "Feed", cls: "aspect-square", imageSize: "1024x1024", videoSize: "1080x1080" },
  { id: "4:5", label: "Retrato", sub: "Feed alto", cls: "aspect-[4/5]", imageSize: "1024x1536", videoSize: "1080x1920" },
  { id: "9:16", label: "Vertical", sub: "Story / Reels", cls: "aspect-[9/16]", imageSize: "1024x1536", videoSize: "1080x1920" },
  { id: "16:9", label: "Horizontal", sub: "YouTube / VSL", cls: "aspect-video", imageSize: "1536x1024", videoSize: "1920x1080" },
];

export const ratioSpec = (id: string): RatioSpec => RATIOS.find((r) => r.id === id) || RATIOS[0];

// ---- Formulários por ferramenta (ficam no store para que fluxo e abas compartilhem) ----

export interface ImageForm {
  produto: string;
  estilo: string;
  headline: string;
  publico: string;
  ratio: RatioId;
  quality: "high" | "medium" | "low";
  format: "png" | "jpeg" | "webp";
  background: "auto" | "opaque" | "transparent";
}

export interface CopyForm {
  produto: string;
  publico: string;
  dor: string;
  beneficios: string;
  oferta: string;
  tipo: string;
  framework: string;
  tom: string;
  variacoes: number;
}

export interface TtsForm {
  text: string;
  voice: string;
  provider: string;
  instructions: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export interface AvatarForm {
  photo: string;
  text: string;
  voice: string;
  ratio: RatioId;
}

export interface VideoForm {
  prompt: string;
  script: string;
  voice: string;
  ratio: RatioId;
  resolution: "480p" | "720p" | "1080p";
  duration: string;
  imageUrl: string;
}

// ---- Fluxos ----

export type StepKind = "copy" | "image" | "tts" | "avatar" | "video";
export type StepStatus = "idle" | "running" | "done" | "error" | "skipped";

export interface FlowStep {
  id: string;
  kind: StepKind;
  title: string;
  /** O que essa etapa entrega, em linguagem de leigo. */
  outcome: string;
  /** Ajustes que a receita impõe (ex.: tipo de copy). */
  opts?: Record<string, any>;
  status: StepStatus;
  error?: string;
  /** Asset produzido pela etapa. */
  asset?: Asset;
}

export interface Recipe {
  id: string;
  name: string;
  /** Promessa em uma linha — é o que o leigo lê para escolher. */
  tagline: string;
  /** O que sai no final. */
  delivers: string;
  /** Emoji/etiqueta do card. */
  badge: string;
  /** Formato sugerido; aplicado ao briefing ao escolher a receita. */
  ratio?: RatioId;
  /** Exige foto de rosto no briefing. */
  needsPhoto?: boolean;
  steps: Omit<FlowStep, "id" | "status">[];
}

/** Contexto que vai passando de etapa em etapa dentro de um fluxo. */
export interface FlowContext {
  copyText?: string;
  copyList?: string[];
  headline?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
}
