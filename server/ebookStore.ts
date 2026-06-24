import { promises as fs } from "fs";
import path from "path";
import type { Ebook } from "./services/ebookStudio";

/** Armazenamento simples de ebooks no volume (um JSON por ebook, keyed por slug). */
const DIR = path.join(process.cwd(), "ebooks");

async function ensureDir() { await fs.mkdir(DIR, { recursive: true }).catch(() => {}); }

export function sanitizeSlug(s: string): string {
  return (
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `ebook-${Date.now()}`
  );
}

export interface StoredEbook extends Ebook { slug: string; userId: string; createdAt: string; updatedAt: string; }

async function uniqueSlug(base: string): Promise<string> {
  await ensureDir();
  let slug = base;
  let i = 2;
  // evita colisão de arquivo
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await fs.access(path.join(DIR, `${slug}.json`)); slug = `${base}-${i++}`; }
    catch { return slug; }
  }
}

export async function getEbook(slug: string): Promise<StoredEbook | null> {
  try { return JSON.parse(await fs.readFile(path.join(DIR, `${sanitizeSlug(slug)}.json`), "utf8")); }
  catch { return null; }
}

export async function saveEbook(ebook: Ebook, userId: string, existingSlug?: string): Promise<StoredEbook> {
  await ensureDir();
  const now = new Date().toISOString();
  const slug = existingSlug ? sanitizeSlug(existingSlug) : await uniqueSlug(sanitizeSlug(ebook.title));
  let createdAt = now;
  if (existingSlug) {
    const prev = await getEbook(slug);
    if (prev) {
      if (prev.userId !== userId) throw Object.assign(new Error("Acesso negado"), { code: "FORBIDDEN" });
      createdAt = prev.createdAt;
    }
  }
  const stored: StoredEbook = { ...ebook, slug, userId, createdAt, updatedAt: now };
  await fs.writeFile(path.join(DIR, `${slug}.json`), JSON.stringify(stored), "utf8");
  return stored;
}

export async function listEbooks(userId: string): Promise<any[]> {
  await ensureDir();
  const files = await fs.readdir(DIR).catch(() => [] as string[]);
  const out: any[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const e = JSON.parse(await fs.readFile(path.join(DIR, f), "utf8")) as StoredEbook;
      if (e.userId === userId) out.push({ slug: e.slug, title: e.title, subtitle: e.subtitle, theme: e.theme, pageCount: e.pageCount, updatedAt: e.updatedAt });
    } catch {}
  }
  return out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function deleteEbook(slug: string, userId: string): Promise<void> {
  const e = await getEbook(slug);
  if (!e) return;
  if (e.userId !== userId) throw Object.assign(new Error("Acesso negado"), { code: "FORBIDDEN" });
  await fs.unlink(path.join(DIR, `${sanitizeSlug(slug)}.json`)).catch(() => {});
}
