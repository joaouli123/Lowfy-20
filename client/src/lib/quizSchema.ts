/**
 * Schema compartilhado do Quiz Builder (estilo Inlead).
 * Tipos + catálogo da paleta + props padrão + helpers de score/variáveis/visibilidade.
 * Usado tanto pelo editor (QuizBuilder) quanto pelo runtime público (QuizPlay).
 */

export type QComponentType =
  | "texto" | "imagem" | "video" | "audio"
  | "opcoes" | "video_resposta" | "captura" | "botao"
  | "timer" | "loading" | "nivel"
  | "alerta" | "notificacao" | "depoimentos" | "argumentos"
  | "preco" | "galeria" | "espaco"
  | "faq" | "carrossel" | "antes_depois" | "graficos" | "script";

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

export interface QStepHeader {
  showLogo?: boolean;
  showProgress?: boolean;
  allowBack?: boolean;
}

export interface QuizStep {
  id: string;
  name?: string;
  header?: QStepHeader;   // controle do cabeçalho por etapa (logo/progresso/voltar)
  components: QComponent[];
}

export interface QuizTheme {
  primaryColor?: string;
  bgColor?: string;
  textColor?: string;
  titleColor?: string;
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
  key: string;           // id único na paleta
  type: QComponentType;  // tipo de componente produzido
  label: string;
  icon: string;          // nome do ícone lucide (resolvido na UI)
  category: string;
  novo?: boolean;        // selo "novo"
  defaults: () => Record<string, any>;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/** Props padrão de um componente de Opções (com presets por variante). */
function opcoesDefaults(over: Record<string, any> = {}): Record<string, any> {
  return {
    name: "pergunta",
    question: "Qual a sua pergunta?",
    help: "",
    layout: "list",            // list | grid
    direction: "vertical",     // vertical | horizontal
    disposition: "texto",      // texto | image_texto | image | emoji_texto
    required: true,            // seleção obrigatória
    multiple: false,           // permitir múltipla escolha
    advanceOnButton: false,    // redirecionar apenas ao clicar no botão
    autoAdvance: true,
    options: [
      { id: uid(), label: "Opção 1", score: 0 },
      { id: uid(), label: "Opção 2", score: 0 },
    ],
    ...over,
  };
}

/** Catálogo de componentes da paleta, agrupado por categoria (espelha o Inlead/Movify). */
export const PALETTE: PaletteItem[] = [
  // Quiz
  { key: "escolha_unica", type: "opcoes", label: "Escolha Única", icon: "CircleDot", category: "Quiz", defaults: () => opcoesDefaults({ name: "escolha", multiple: false }) },
  { key: "multipla_escolha", type: "opcoes", label: "Múltipla Escolha", icon: "ListChecks", category: "Quiz", defaults: () => opcoesDefaults({ name: "interesses", multiple: true, advanceOnButton: true, autoAdvance: false, options: [{ id: uid(), label: "Opção 1", score: 0 }, { id: uid(), label: "Opção 2", score: 0 }, { id: uid(), label: "Opção 3", score: 0 }] }) },
  { key: "sim_nao", type: "opcoes", label: "Sim / Não", icon: "ToggleLeft", category: "Quiz", defaults: () => opcoesDefaults({ name: "sim_nao", direction: "horizontal", options: [{ id: uid(), label: "Sim", score: 1 }, { id: uid(), label: "Não", score: 0 }] }) },
  { key: "escolha_imagem", type: "opcoes", label: "Escolha de Imagem", icon: "ImagePlus", category: "Quiz", defaults: () => opcoesDefaults({ name: "escolha_imagem", layout: "grid", disposition: "image_texto", options: [{ id: uid(), label: "Opção 1", score: 0, image: "" }, { id: uid(), label: "Opção 2", score: 0, image: "" }] }) },
  { key: "opcoes", type: "opcoes", label: "Opções", icon: "List", category: "Quiz", defaults: () => opcoesDefaults() },
  { key: "video_resposta", type: "video_resposta", label: "Vídeo Resposta", icon: "Video", category: "Quiz", novo: true, defaults: () => ({ name: "video_resposta", question: "Grave um vídeo respondendo:", help: "", maxSeconds: 60, buttonText: "Continuar" }) },
  // Formulário
  { key: "captura", type: "captura", label: "Captura", icon: "UserPlus", category: "Formulário", defaults: () => ({ title: "Falta pouco!", description: "", fields: [{ type: "name", name: "nome", label: "Seu nome", required: true }, { type: "email", name: "email", label: "Seu melhor e-mail", required: true }], buttonText: "Continuar", nextStepId: "" }) },
  { key: "botao", type: "botao", label: "Botão", icon: "MousePointerClick", category: "Formulário", defaults: () => ({ label: "Continuar", action: "next", url: "", stepId: "", style: "solid", full: true, newTab: false, fixedBottom: false, animated: false }) },
  // Mídia e conteúdo
  { key: "texto", type: "texto", label: "Texto", icon: "Type", category: "Mídia e conteúdo", defaults: () => ({ text: "Escreva seu título aqui", variant: "title", align: "center", color: "" }) },
  { key: "imagem", type: "imagem", label: "Imagem", icon: "Image", category: "Mídia e conteúdo", defaults: () => ({ url: "", alt: "", radius: 14, maxWidth: 100 }) },
  { key: "video", type: "video", label: "Vídeo", icon: "Clapperboard", category: "Mídia e conteúdo", defaults: () => ({ url: "" }) },
  { key: "audio", type: "audio", label: "Áudio", icon: "Volume2", category: "Mídia e conteúdo", defaults: () => ({ url: "" }) },
  { key: "galeria", type: "galeria", label: "Galeria", icon: "Images", category: "Mídia e conteúdo", defaults: () => ({ images: [], layout: "grid" }) },
  // Argumentação
  { key: "argumentos", type: "argumentos", label: "Argumentos", icon: "LayoutGrid", category: "Argumentação", defaults: () => ({ items: [{ title: "Durabilidade", text: "Feito para durar" }, { title: "Eficiência", text: "Resultados rápidos" }] }) },
  { key: "depoimentos", type: "depoimentos", label: "Depoimentos", icon: "Quote", category: "Argumentação", defaults: () => ({ layout: "list", items: [{ name: "Maria Silva", handle: "@maria", text: "Esse produto mudou a minha vida!", stars: 5 }] }) },
  { key: "faq", type: "faq", label: "FAQ", icon: "MessagesSquare", category: "Argumentação", defaults: () => ({ items: [{ q: "Como funciona?", a: "É simples e rápido." }, { q: "Tem garantia?", a: "Sim, 7 dias." }] }) },
  { key: "preco", type: "preco", label: "Preço", icon: "Tag", category: "Argumentação", defaults: () => ({ title: "Plano PRO", prefix: "", price: "R$ 297", suffix: "à vista", installments: "ou 12x de R$ 29,70", highlightText: "MAIS POPULAR", ctaLabel: "Comprar agora", url: "", priceType: "redirect", highlight: true }) },
  { key: "antes_depois", type: "antes_depois", label: "Antes / Depois", icon: "GitCompareArrows", category: "Argumentação", defaults: () => ({ before: "", after: "", labelBefore: "Antes", labelAfter: "Depois" }) },
  { key: "carrossel", type: "carrossel", label: "Carrossel", icon: "GalleryHorizontalEnd", category: "Argumentação", defaults: () => ({ layout: "image_texto", autoplay: false, pagination: true, items: [{ image: "", title: "Item 1", desc: "Descrição do item." }, { image: "", title: "Item 2", desc: "Descrição do item." }] }) },
  // Atenção
  { key: "alerta", type: "alerta", label: "Alerta", icon: "AlertTriangle", category: "Atenção", defaults: () => ({ text: "Oferta por tempo limitado! Só hoje.", variant: "warning" }) },
  { key: "notificacao", type: "notificacao", label: "Notificação", icon: "BellRing", category: "Atenção", novo: true, defaults: () => ({ title: "Novo!", text: "Você desbloqueou um bônus exclusivo.", durationSec: 4, position: "top" }) },
  { key: "timer", type: "timer", label: "Timer", icon: "Clock", category: "Atenção", defaults: () => ({ minutes: 10, text: "A oferta termina em", expiredText: "Tempo esgotado!" }) },
  { key: "loading", type: "loading", label: "Loading", icon: "Loader", category: "Atenção", defaults: () => ({ text: "Analisando suas respostas…", durationSec: 3, nextStepId: "", redirectUrl: "", showProgress: true }) },
  { key: "nivel", type: "nivel", label: "Nível", icon: "BarChart3", category: "Atenção", defaults: () => ({ label: "Seu progresso", subtitle: "", percent: 75, fromScore: false, legends: "", indicator: "" }) },
  // Gráficos
  { key: "graficos", type: "graficos", label: "Gráficos", icon: "PieChart", category: "Gráficos", defaults: () => ({ layout: "list", items: [{ type: "circular", color: "tema", value: 70, label: "Engajamento" }, { type: "barra", color: "tema", value: 45, label: "Progresso" }] }) },
  // Personalização
  { key: "espaco", type: "espaco", label: "Espaço", icon: "Minus", category: "Personalização", defaults: () => ({ height: 24 }) },
  { key: "script", type: "script", label: "Script", icon: "Code", category: "Personalização", defaults: () => ({ code: "" }) },
];

export const PALETTE_BY_KEY: Record<string, PaletteItem> = Object.fromEntries(PALETTE.map((p) => [p.key, p]));
export const PALETTE_BY_TYPE: Record<string, PaletteItem> = Object.fromEntries(PALETTE.map((p) => [p.type, p]));
export const CATEGORIES = Array.from(new Set(PALETTE.map((p) => p.category)));

/** Cria um componente a partir da CHAVE da paleta (presets por variante). */
export function newComponentFromPalette(key: string): QComponent {
  const item = PALETTE_BY_KEY[key];
  if (!item) return newComponent("texto");
  return { id: uid(), type: item.type, props: { ...item.defaults(), _pk: item.key }, visibility: { mode: "always" } };
}

export function newComponent(type: QComponentType): QComponent {
  const def = PALETTE_BY_TYPE[type];
  return { id: uid(), type, props: def ? def.defaults() : {}, visibility: { mode: "always" } };
}

export function newStep(name?: string): QuizStep {
  return { id: uid(), name: name || "Nova etapa", header: { showLogo: true, showProgress: true, allowBack: true }, components: [] };
}

export function emptySpec(name: string, slug: string): QuizSpec {
  return {
    name, slug,
    steps: [newStep("Etapa 1")],
    theme: { primaryColor: "#22c55e", bgColor: "#ffffff", textColor: "#0f172a", buttonTextColor: "#ffffff", showProgress: true },
    isPublished: false,
  };
}

/** Garante que a fonte do Google (Poppins/Montserrat/Roboto…) esteja carregada. */
export function ensureGoogleFont(font?: string) {
  if (!font || typeof document === "undefined") return;
  const fam = font.split(",")[0].replace(/['"]/g, "").trim();
  if (["Inter", "Georgia", "system-ui", "sans-serif", "serif", ""].includes(fam)) return;
  const id = "gf-" + fam.replace(/\s+/g, "-");
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id; l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${fam.replace(/\s+/g, "+")}:wght@400;600;700;800&display=swap`;
  document.head.appendChild(l);
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
