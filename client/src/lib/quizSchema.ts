/**
 * Schema compartilhado do Quiz Builder (estilo Inlead).
 * Tipos + catálogo da paleta + props padrão + helpers de score/variáveis/visibilidade.
 * Usado tanto pelo editor (QuizBuilder) quanto pelo runtime público (QuizPlay).
 */

export type QComponentType =
  | "texto" | "imagem" | "video" | "audio"
  | "opcoes" | "captura" | "botao"
  | "timer" | "loading" | "nivel"
  | "alerta" | "notificacao" | "depoimentos" | "argumentos"
  | "preco" | "galeria" | "espaco";

export interface QVisibility {
  mode?: "always" | "score" | "time";
  op?: ">" | "<" | ">=" | "<=" | "==";
  value?: number;
  afterSeconds?: number;
}

export interface QuizOption {
  id: string;
  label: string;
  emoji?: string;
  image?: string | null;
  score?: number;
  nextStepId?: string | null;
}

export interface QuizField {
  type: "name" | "email" | "phone" | "text";
  name?: string;
  label?: string;
  required?: boolean;
}

export interface QComponent {
  id: string;
  type: QComponentType;
  props: Record<string, any>;
  visibility?: QVisibility;
}

export interface QuizStep {
  id: string;
  name?: string;
  components: QComponent[];
}

export interface QuizTheme {
  primaryColor?: string;
  bgColor?: string;
  textColor?: string;
  buttonTextColor?: string;
  logoUrl?: string | null;
  showProgress?: boolean;
  font?: string;
}

export interface QuizSpec {
  name: string;
  slug: string;
  steps: QuizStep[];
  theme?: QuizTheme;
  pixelId?: string | null;
  webhookUrl?: string | null;
  redirectUrl?: string | null;
  isPublished?: boolean;
}

// ---------------------------------------------------------------------------

export interface PaletteItem {
  type: QComponentType;
  label: string;
  icon: string;          // nome do ícone lucide (resolvido na UI)
  category: string;
  defaults: () => Record<string, any>;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/** Catálogo de componentes da paleta, agrupado por categoria (espelha o Inlead). */
export const PALETTE: PaletteItem[] = [
  // Conteúdo
  { type: "texto", label: "Texto", icon: "Type", category: "Conteúdo", defaults: () => ({ text: "Escreva seu título aqui", variant: "title", align: "center", color: "" }) },
  { type: "imagem", label: "Imagem", icon: "Image", category: "Conteúdo", defaults: () => ({ url: "", alt: "", radius: 14, maxWidth: 100 }) },
  { type: "video", label: "Vídeo", icon: "Video", category: "Conteúdo", defaults: () => ({ url: "" }) },
  { type: "audio", label: "Áudio", icon: "Volume2", category: "Conteúdo", defaults: () => ({ url: "" }) },
  { type: "galeria", label: "Galeria", icon: "Images", category: "Conteúdo", defaults: () => ({ images: [], layout: "grid" }) },
  // Interação
  { type: "opcoes", label: "Opções", icon: "ListChecks", category: "Interação", defaults: () => ({ question: "Qual a sua pergunta?", help: "", multiple: false, layout: "list", autoAdvance: true, options: [{ id: uid(), label: "Opção 1", score: 0 }, { id: uid(), label: "Opção 2", score: 0 }] }) },
  { type: "captura", label: "Captura", icon: "UserPlus", category: "Interação", defaults: () => ({ title: "Falta pouco!", description: "", fields: [{ type: "name", name: "nome", label: "Seu nome", required: true }, { type: "email", name: "email", label: "Seu melhor e-mail", required: true }], buttonText: "Continuar", nextStepId: "" }) },
  { type: "botao", label: "Botão", icon: "MousePointerClick", category: "Interação", defaults: () => ({ label: "Continuar", action: "next", url: "", stepId: "", style: "solid", full: true }) },
  { type: "nivel", label: "Nível", icon: "BarChart3", category: "Interação", defaults: () => ({ label: "Seu progresso", percent: 75, fromScore: false }) },
  { type: "loading", label: "Loading", icon: "Loader", category: "Interação", defaults: () => ({ text: "Analisando suas respostas…", durationSec: 3, nextStepId: "", redirectUrl: "" }) },
  // Prova social
  { type: "depoimentos", label: "Depoimentos", icon: "Quote", category: "Prova social", defaults: () => ({ layout: "list", items: [{ name: "Maria Silva", text: "Esse produto mudou a minha vida!", stars: 5 }] }) },
  { type: "argumentos", label: "Argumentos", icon: "LayoutGrid", category: "Prova social", defaults: () => ({ items: [{ title: "Durabilidade", text: "Feito para durar" }, { title: "Eficiência", text: "Resultados rápidos" }] }) },
  { type: "preco", label: "Preço", icon: "Tag", category: "Prova social", defaults: () => ({ price: "R$ 297", installments: "ou 12x de R$ 29,70", ctaLabel: "Comprar agora", url: "", highlight: true }) },
  // Urgência
  { type: "timer", label: "Timer", icon: "Clock", category: "Urgência", defaults: () => ({ minutes: 10, text: "A oferta termina em", expiredText: "Tempo esgotado!" }) },
  { type: "alerta", label: "Alerta", icon: "AlertTriangle", category: "Urgência", defaults: () => ({ text: "Oferta por tempo limitado! Só hoje.", variant: "warning" }) },
  { type: "notificacao", label: "Notificação", icon: "BellRing", category: "Urgência", defaults: () => ({ title: "Novo!", text: "Você desbloqueou um bônus exclusivo." }) },
  // Layout
  { type: "espaco", label: "Espaço", icon: "Minus", category: "Layout", defaults: () => ({ height: 24 }) },
];

export const PALETTE_BY_TYPE: Record<string, PaletteItem> = Object.fromEntries(PALETTE.map((p) => [p.type, p]));
export const CATEGORIES = Array.from(new Set(PALETTE.map((p) => p.category)));

export function newComponent(type: QComponentType): QComponent {
  const def = PALETTE_BY_TYPE[type];
  return { id: uid(), type, props: def ? def.defaults() : {}, visibility: { mode: "always" } };
}

export function newStep(name?: string): QuizStep {
  return { id: uid(), name: name || "Nova etapa", components: [] };
}

export function emptySpec(name: string, slug: string): QuizSpec {
  return {
    name, slug,
    steps: [newStep("Etapa 1")],
    theme: { primaryColor: "#22c55e", bgColor: "#ffffff", textColor: "#0f172a", buttonTextColor: "#ffffff", showProgress: true },
    isPublished: false,
  };
}

// ---- Runtime helpers ----

/** Substitui {{score}} e {{nome_do_campo}} pelos valores correntes. */
export function resolveVars(text: string, vars: Record<string, any>): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Avalia a regra de visibilidade de um componente para o estado atual. */
export function isVisible(comp: QComponent, ctx: { score: number; elapsedSec: number }): boolean {
  const vis = comp.visibility;
  if (!vis || !vis.mode || vis.mode === "always") return true;
  if (vis.mode === "time") return ctx.elapsedSec >= (vis.afterSeconds || 0);
  if (vis.mode === "score") {
    const a = ctx.score, b = vis.value || 0;
    switch (vis.op) {
      case ">": return a > b;
      case "<": return a < b;
      case ">=": return a >= b;
      case "<=": return a <= b;
      case "==": return a === b;
      default: return a >= b;
    }
  }
  return true;
}
