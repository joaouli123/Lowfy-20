import fs from "fs";
import path from "path";

/**
 * Kit de motion (server/motion-kit): CSS + JS com transições e peças realistas que o Claude usa
 * para montar as animações. O kit vai embutido no HTML devolvido (entre marcadores), então o
 * vídeo é autossuficiente; num pedido de ajuste ele é retirado antes de ir para o Claude.
 */

const DIR = path.join(process.cwd(), "server", "motion-kit");
const read = (f: string) => fs.readFileSync(path.join(DIR, f), "utf8");

let cache: { css: string; js: string; example: string; doc: string } | null = null;
function kit() {
  if (!cache || process.env.NODE_ENV !== "production") cache = { css: read("kit.css"), js: read("kit.js"), example: read("example.html"), doc: read("kit.md") };
  return cache;
}

const OPEN = "<!--motion-kit-->";
const CLOSE = "<!--/motion-kit-->";

/** Põe o kit logo no começo do <head> (depois do MOTION que o player injeta). */
export function withKit(html: string): string {
  const clean = withoutKit(html);
  const { css, js } = kit();
  const block = `${OPEN}<style data-motion-kit>${css}</style><script data-motion-kit>${js}</script>${CLOSE}`;
  if (/<head[^>]*>/i.test(clean)) return clean.replace(/<head[^>]*>/i, (m) => m + block);
  return block + clean;
}

export function withoutKit(html: string): string {
  const i = html.indexOf(OPEN);
  const j = html.indexOf(CLOSE);
  return i >= 0 && j > i ? html.slice(0, i) + html.slice(j + CLOSE.length) : html;
}

export const usesKit = (html: string) => html.includes(OPEN);

export function kitExample(): string {
  return kit().example;
}

/** Referência da API do kit (vai no prompt do Claude). */
export function kitDoc(): string {
  return kit().doc;
}
