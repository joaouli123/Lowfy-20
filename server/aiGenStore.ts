import { promises as fs } from "fs";
import path from "path";

/** Histórico de gerações do Estúdio IA (um JSON por item no volume). */
const DIR = path.join(process.cwd(), "ai-generations");

export interface Gen {
  id: string; userId: string; type: string;
  url?: string; text?: string; title: string; prompt?: string; meta?: any; createdAt: string;
}

async function ensure() { await fs.mkdir(DIR, { recursive: true }).catch(() => {}); }

/** Salva uma geração (nunca lança — falha silenciosa para não quebrar a geração). */
export async function saveGen(g: Omit<Gen, "id" | "createdAt">): Promise<void> {
  try {
    await ensure();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rec: Gen = { ...g, id, createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify(rec), "utf8");
  } catch {}
}

export async function listGens(userId: string, opts?: { type?: string; q?: string; limit?: number }): Promise<Gen[]> {
  await ensure();
  const files = (await fs.readdir(DIR).catch(() => [] as string[])).filter((f) => f.endsWith(".json"));
  const out: Gen[] = [];
  await Promise.all(files.map(async (f) => {
    try { const g = JSON.parse(await fs.readFile(path.join(DIR, f), "utf8")); if (g.userId === userId) out.push(g); } catch {}
  }));
  let r = out;
  if (opts?.type && opts.type !== "all") r = r.filter((g) => g.type === opts.type);
  if (opts?.q) { const q = opts.q.toLowerCase(); r = r.filter((g) => (g.title || "").toLowerCase().includes(q) || (g.prompt || "").toLowerCase().includes(q) || (g.text || "").toLowerCase().includes(q)); }
  r.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return r.slice(0, opts?.limit || 200);
}

export async function deleteGen(id: string, userId: string): Promise<void> {
  try {
    const p = path.join(DIR, `${path.basename(String(id))}.json`);
    const g = JSON.parse(await fs.readFile(p, "utf8"));
    if (g.userId === userId) await fs.unlink(p).catch(() => {});
  } catch {}
}
