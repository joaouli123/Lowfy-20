import fs from "fs";
import path from "path";
import { writeJsonAtomic } from "./utils/safe-fs";

/**
 * Armazenamento de quizzes (funis de quiz estilo inlead/xQuiz) em filesystem
 * sob o volume persistente. Cada quiz é um spec JSON; leads são gravados em JSONL.
 *
 * Modelo: Quiz → steps[] (páginas) → cada step com elementos (pergunta/conteúdo/
 * captura/resultado), opções com PONTUAÇÃO e roteamento condicional (nextStepId).
 */

const DATA_ROOT = process.env.OBJECT_STORAGE_DIR
  ? path.dirname(process.env.OBJECT_STORAGE_DIR)
  : process.cwd();
const QUIZ_DIR = path.join(DATA_ROOT, "quizzes");
const LEADS_DIR = path.join(DATA_ROOT, "quiz-leads");

export interface QuizOption {
  id: string;
  label: string;
  image?: string | null;
  score?: number;
  nextStepId?: string | null; // pulo condicional (branching)
}
export interface QuizField {
  type: "name" | "email" | "phone" | "text";
  label?: string;
  required?: boolean;
}
export interface QuizStep {
  id: string;
  type: "question" | "content" | "capture" | "result";
  title?: string;
  description?: string;
  image?: string | null;
  video?: string | null;
  multiple?: boolean; // permite múltipla seleção
  options?: QuizOption[];
  fields?: QuizField[];
  buttonText?: string;
  nextStepId?: string | null;
  // result step
  minScore?: number;
  resultTitle?: string;
  resultDescription?: string;
  resultButtonText?: string;
  resultRedirectUrl?: string;
}
export interface QuizTheme {
  primaryColor?: string;
  bgColor?: string;
  textColor?: string;
  logoUrl?: string | null;
  showProgress?: boolean;
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
