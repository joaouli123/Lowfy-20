import fs from "fs";
import path from "path";
import { writeJsonAtomic } from "./utils/safe-fs";

/**
 * Armazenamento de quizzes (funis de quiz estilo inlead/xQuiz) em filesystem
 * sob o volume persistente. Cada quiz é um spec JSON; leads são gravados em JSONL.
 *
 * Modelo (estilo Inlead): Funil → steps[] (etapas) → cada step é um canvas com
 * components[] arrastáveis. Componentes de Opções carregam PONTUAÇÃO (score),
 * captura define variáveis {{nome}}, e cada componente pode ter exibição
 * condicional (por score comparativo ou por tempo). Roteamento via nextStepId.
 */

const DATA_ROOT = process.env.OBJECT_STORAGE_DIR
  ? path.dirname(process.env.OBJECT_STORAGE_DIR)
  : process.cwd();
const QUIZ_DIR = path.join(DATA_ROOT, "quizzes");
const LEADS_DIR = path.join(DATA_ROOT, "quiz-leads");

/** Tipos de componente arrastáveis (paridade com a paleta do Inlead). */
export type QComponentType =
  | "texto" | "imagem" | "video" | "audio"
  | "opcoes" | "captura" | "botao"
  | "timer" | "loading" | "nivel"
  | "alerta" | "notificacao" | "depoimentos" | "argumentos"
  | "preco" | "galeria" | "espaco";

/** Exibição condicional de um componente. */
export interface QVisibility {
  mode?: "always" | "score" | "time";
  op?: ">" | "<" | ">=" | "<=" | "==";
  value?: number;        // limiar de score (modo score)
  afterSeconds?: number; // atraso em segundos (modo time)
}

/** Uma opção de resposta (componente "opcoes") — carrega o SCORE. */
export interface QuizOption {
  id: string;
  label: string;
  emoji?: string;
  image?: string | null;
  score?: number;
  nextStepId?: string | null; // pulo condicional (branching)
}

/** Campo do componente de captura — o `name` vira a variável {{nome}}. */
export interface QuizField {
  type: "name" | "email" | "phone" | "text";
  name?: string;
  label?: string;
  required?: boolean;
}

/** Componente posicionado no canvas de uma etapa. `props` é específico do tipo. */
export interface QComponent {
  id: string;
  type: QComponentType;
  props: Record<string, any>;
  visibility?: QVisibility;
}

/** Etapa (página) do funil — um canvas de componentes. */
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
export interface QuizMeta {
  userId: string;
  createdAt: string;
  updatedAt: string;
  views: number;
  starts: number;
  completions: number;
  leads: number;
}

function specPath(slug: string) { return path.join(QUIZ_DIR, `${slug}.json`); }
function metaPath(slug: string) { return path.join(QUIZ_DIR, `${slug}.meta.json`); }
function leadsPath(slug: string) { return path.join(LEADS_DIR, `${slug}.jsonl`); }

export function sanitizeSlug(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function saveQuiz(slug: string, spec: QuizSpec, userId: string): Promise<QuizMeta> {
  await fs.promises.mkdir(QUIZ_DIR, { recursive: true });
  let meta = await getQuizMeta(slug);
  if (meta && meta.userId !== userId) {
    throw Object.assign(new Error("forbidden"), { code: "FORBIDDEN" });
  }
  const now = new Date().toISOString();
  if (!meta) {
    meta = { userId, createdAt: now, updatedAt: now, views: 0, starts: 0, completions: 0, leads: 0 };
  } else {
    meta.updatedAt = now;
  }
  await writeJsonAtomic(specPath(slug), { ...spec, slug });
  await writeJsonAtomic(metaPath(slug), meta);
  return meta;
}

export async function getQuiz(slug: string): Promise<QuizSpec | null> {
  try { return JSON.parse(await fs.promises.readFile(specPath(slug), "utf-8")); } catch { return null; }
}
export async function getQuizMeta(slug: string): Promise<QuizMeta | null> {
  try { return JSON.parse(await fs.promises.readFile(metaPath(slug), "utf-8")); } catch { return null; }
}

export async function listQuizzes(userId: string): Promise<Array<{ slug: string; name: string; isPublished: boolean; meta: QuizMeta }>> {
  let files: string[] = [];
  try { files = await fs.promises.readdir(QUIZ_DIR); } catch { return []; }
  const out: Array<{ slug: string; name: string; isPublished: boolean; meta: QuizMeta }> = [];
  for (const f of files.filter((x) => x.endsWith(".json") && !x.endsWith(".meta.json"))) {
    const slug = f.replace(/\.json$/, "");
    const meta = await getQuizMeta(slug);
    if (!meta || meta.userId !== userId) continue;
    const spec = await getQuiz(slug);
    out.push({ slug, name: spec?.name || slug, isPublished: !!spec?.isPublished, meta });
  }
  return out.sort((a, b) => (b.meta.updatedAt || "").localeCompare(a.meta.updatedAt || ""));
}

export async function deleteQuiz(slug: string, userId: string): Promise<void> {
  const meta = await getQuizMeta(slug);
  if (meta && meta.userId !== userId) throw Object.assign(new Error("forbidden"), { code: "FORBIDDEN" });
  await fs.promises.unlink(specPath(slug)).catch(() => {});
  await fs.promises.unlink(metaPath(slug)).catch(() => {});
}

export async function bumpMeta(slug: string, field: "views" | "starts" | "completions" | "leads"): Promise<void> {
  const meta = await getQuizMeta(slug);
  if (!meta) return;
  meta[field] = (meta[field] || 0) + 1;
  await writeJsonAtomic(metaPath(slug), meta).catch(() => {});
}

export async function appendLead(slug: string, lead: Record<string, any>): Promise<void> {
  await fs.promises.mkdir(LEADS_DIR, { recursive: true });
  const line = JSON.stringify({ ...lead, at: new Date().toISOString() }) + "\n";
  await fs.promises.appendFile(leadsPath(slug), line, "utf-8");
}

export async function getLeads(slug: string, userId: string, limit = 500): Promise<any[]> {
  const meta = await getQuizMeta(slug);
  if (!meta || meta.userId !== userId) return [];
  try {
    const raw = await fs.promises.readFile(leadsPath(slug), "utf-8");
    return raw.trim().split("\n").filter(Boolean).slice(-limit).reverse().map((l) => JSON.parse(l));
  } catch { return []; }
}
