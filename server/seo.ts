import type { Request, Response, NextFunction } from "express";

/**
 * SEO do domínio principal (lowfy.com.br). Domínios de clientes são atendidos antes
 * e nunca passam por aqui.
 *
 * - Redirecionamentos 301 de URLs antigas/duplicadas (preservam a autoridade no Google).
 * - HTML com título, descrição, canônica e robots certos por página, já no servidor
 *   (robôs e IAs que não executam JavaScript leem a página certa).
 * - Status 404 real para endereços que não existem (acaba com o "soft 404").
 */

export const SITE = "https://lowfy.com.br";
const MAIN_HOSTS = new Set(["lowfy.com.br", "www.lowfy.com.br"]);

const hostOf = (req: Request) =>
  String((req.headers["x-original-host"] as string) || (req.headers["x-forwarded-host"] as string) || req.hostname || "")
    .split(",")[0].trim().toLowerCase().split(":")[0];

// URLs antigas (site anterior / rotas renomeadas) → destino atual.
function legacyTarget(path: string): string | null {
  const p = path.toLowerCase();
  if (p === "/auth" || p === "/auth/" || p === "/entrar") return "/login";
  if (p === "/home" || p === "/home/" || p === "/inicio") return "/";
  if (p.startsWith("/produto/") || p.startsWith("/produtos/") || p.startsWith("/loja") || p.startsWith("/categoria-produto/") || p.startsWith("/wp-")) return "/";
  return null;
}

/** Redireciona www → domínio principal, URLs antigas e barra no final. */
export function seoRedirects(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const host = hostOf(req);
  if (!MAIN_HOSTS.has(host)) return next();
  if (req.path.startsWith("/api") || req.path.startsWith("/assets/") || req.path.startsWith("/objects/") || req.path.startsWith("/socket")) return next();

  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  let path = req.path;
  const legacy = legacyTarget(path);
  if (legacy) path = legacy;
  // Barra no final duplica a página no Google (/login/ vs /login).
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");

  if (host !== "lowfy.com.br" || path !== req.path) {
    return res.redirect(301, `${SITE}${path}${legacy ? "" : qs}`);
  }
  next();
}

interface PageMeta { title: string; description: string; index: boolean }

const DEFAULT_DESC =
  "Plataforma de marketing digital com IA: crie criativos, copies, narrações, vídeos e motions em minutos, além de PLRs, cursos, clonador de páginas e ferramentas premium.";

// Páginas públicas que devem aparecer no Google.
const PUBLIC_PAGES: Record<string, PageMeta> = {
  "/": { title: "Lowfy - Plataforma de Marketing Digital | PLR, IA, Ferramentas Premium", description: DEFAULT_DESC, index: true },
  "/login": { title: "Entrar na Lowfy | Plataforma de Marketing Digital", description: "Acesse sua conta Lowfy e use o Estúdio IA, PLRs, cursos, clonador de páginas e todas as ferramentas premium de marketing digital.", index: true },
  "/assinatura/checkout": { title: "Assine a Lowfy | Planos da Plataforma de Marketing Digital", description: "Assine a Lowfy e tenha acesso ao Estúdio IA, PLRs, cursos, clonador de páginas, templates e ferramentas premium de marketing digital.", index: true },
  "/termos": { title: "Termos de Uso | Lowfy", description: "Termos de uso da plataforma Lowfy.", index: true },
  "/privacidade": { title: "Política de Privacidade | Lowfy", description: "Como a Lowfy coleta, usa e protege os seus dados pessoais.", index: true },
  "/licenca-plr": { title: "Licença de Uso dos PLRs | Lowfy", description: "Entenda os direitos de uso e revenda dos produtos PLR disponíveis na Lowfy.", index: true },
  "/direitos-autorais": { title: "Direitos Autorais | Lowfy", description: "Política de direitos autorais e de propriedade intelectual da Lowfy.", index: true },
};

// Rotas do app (área logada, checkout, etc.): existem, mas não devem ser indexadas.
const APP_ROUTES = [
  "/admin", "/ai-studio", "/ai-tools", "/assinatura", "/ativar-conta", "/checkout", "/clonador", "/courses", "/dashboard",
  "/ebooks", "/forum", "/indicacoes", "/marketplace", "/modelos-n8n", "/notifications", "/plrs", "/plugins", "/presell",
  "/presell-builder", "/presell-dashboard", "/profile", "/q", "/quiz-builder", "/quiz-interativo", "/reset-password",
  "/services", "/set-password", "/subscription", "/support", "/templates", "/timeline", "/users",
];

export function pageMetaFor(path: string): { meta: PageMeta; status: number } {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (PUBLIC_PAGES[p]) return { meta: PUBLIC_PAGES[p], status: 200 };
  if (APP_ROUTES.some((r) => p === r || p.startsWith(`${r}/`))) {
    return { meta: { title: "Lowfy", description: DEFAULT_DESC, index: false }, status: 200 };
  }
  return { meta: { title: "Página não encontrada | Lowfy", description: DEFAULT_DESC, index: false }, status: 404 };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Reescreve título, descrição, canônica, Open Graph e robots do index.html para a página pedida. */
export function renderIndexHtml(html: string, path: string): { html: string; status: number } {
  const { meta, status } = pageMetaFor(path);
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const url = `${SITE}${p === "/" ? "/" : p}`;
  const t = esc(meta.title);
  const d = esc(meta.description);
  const robots = meta.index ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" : "noindex, follow";
  let out = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/i, `$1${d}$2`)
    .replace(/(<meta name="robots" content=")[^"]*(")/i, `$1${robots}$2`)
    .replace(/(<meta name="googlebot" content=")[^"]*(")/i, `$1${robots}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/i, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/i, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/i, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/i, `$1${d}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*(")/i, `$1${url}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/i, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/i, `$1${d}$2`);
  return { html: out, status };
}
