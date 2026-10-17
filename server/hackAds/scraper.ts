import { chromium, type Browser } from "playwright-core";
import { logger } from "../utils/logger";

/**
 * Coletor da Biblioteca de Anúncios pública da Meta (sem login), portado do Ad Intelligence.
 * Abre a busca num Chrome invisível, rola a página e lê os cartões direto do DOM.
 * Imagens, vídeos e fontes NÃO são baixados pelo navegador (só lemos os links): economiza
 * memória e banda. Uma coleta por vez no servidor inteiro (fila em hackAds/service.ts).
 */

export interface ScrapedAd {
  external_id: string;
  page_id: string;
  page_name: string;
  text: string;
  library_url: string;
  destination_url: string;
  image_url: string;
  avatar_url: string;
  video_url: string;
  media_type: "video" | "image" | "unknown";
  creative_uses: number | null;
  started_at: string | null;
  active: boolean | null;
  platforms: string[];
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12 };

export function startedAt(text: string): string | null {
  const en = text.match(/Started running on\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i) || text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(?:to|[-–])\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4}/i);
  const pt = text.match(/Veicula[çc][ãa]o iniciada em\s+(\d{1,2})\s+de\s+([A-Za-zç]+)\.?\s+de\s+(\d{4})/i) || text.match(/(\d{1,2})\s+de\s+([A-Za-zç]+)\.?\s+de\s+(\d{4})\s+a\s+\d{1,2}\s+de\s+[A-Za-zç]+\.?\s+de\s+\d{4}/i);
  const month = MONTHS[String(en?.[1] || pt?.[2] || "").slice(0, 3).toLowerCase()];
  if (!month) return null;
  const year = en?.[3] || pt?.[3];
  const day = Number(en?.[2] || pt?.[1]);
  if (!year || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Roda dentro da página: devolve os cartões crus (texto + links), sem depender de classes da Meta além do necessário.
const PARSE_IN_PAGE = `(() => {
  const ID = /(?:Library ID|Identificação da biblioteca|ID da biblioteca)\\s*:\\s*(\\d+)/i;
  const out = [], seen = new Set();
  const spans = Array.from(document.querySelectorAll('span'));
  for (const label of spans) {
    const m = (label.textContent || '').match(ID);
    if (!m || seen.has(m[1])) continue;
    let card = null, node = label;
    for (let d = 0; d < 14; d++) {
      node = node.parentElement;
      if (!node) break;
      const n = ((node.innerText || node.textContent || '').match(new RegExp(ID.source, 'gi')) || []).length;
      if (n !== 1) break;
      if (node.querySelector('a[href]')) card = node;
    }
    if (!card) continue;
    seen.add(m[1]);
    const anchors = Array.from(card.querySelectorAll('a[href]')).map(a => ({ href: a.getAttribute('href') || '', text: (a.textContent || '').trim() }));
    const copyEl = card.querySelector('._7jyr');
    const video = card.querySelector('video');
    const imgs = Array.from(card.querySelectorAll('img[src]')).map(i => i.getAttribute('src') || '');
    // nome da página: o texto logo antes do rótulo "Patrocinado/Sponsored"
    let sponsoredName = '';
    for (const s of Array.from(card.querySelectorAll('strong, span'))) {
      if (!/^(?:Sponsored|Patrocinado)$/.test((s.textContent || '').trim())) continue;
      let p = s;
      for (let d = 0; d < 9 && !sponsoredName; d++) {
        p = p.parentElement; if (!p) break;
        const kids = Array.from(p.children);
        const i = kids.findIndex(k => /^(?:Sponsored|Patrocinado)$/.test((k.textContent || '').trim()));
        if (i > 0) { const t = (kids[i - 1].textContent || '').trim(); if (t && t.length <= 120 && !ID.test(t)) sponsoredName = t; }
      }
      if (sponsoredName) break;
    }
    const platformIcons = Array.from(card.querySelectorAll('[style*="mask-image"], [aria-label]')).map(e => (e.getAttribute('aria-label') || '')).filter(Boolean);
    out.push({
      id: m[1],
      text: (card.innerText || '').slice(0, 12000),
      copy: copyEl ? (copyEl.innerText || copyEl.textContent || '').trim().slice(0, 10000) : '',
      anchors,
      videoSrc: video ? (video.getAttribute('src') || (video.querySelector('source[src]') || {}).src || '') : '',
      poster: video ? (video.getAttribute('poster') || '') : '',
      hasVideo: !!video,
      imgs,
      sponsoredName,
      platformIcons,
    });
  }
  return out;
})()`;

interface RawCard { id: string; text: string; copy: string; anchors: { href: string; text: string }[]; videoSrc: string; poster: string; hasVideo: boolean; imgs: string[]; sponsoredName: string; platformIcons: string[] }

function externalUrl(raw: string): string {
  try {
    let url = new URL(raw, "https://www.facebook.com");
    if (/(^|\.)facebook\.com$/.test(url.hostname) && url.pathname === "/l.php") url = new URL(url.searchParams.get("u") || "");
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || /(^|\.)(facebook|instagram|fb)\.com$/.test(url.hostname) || url.hostname === "transparency.meta.com") return "";
    return url.href.slice(0, 2048);
  } catch { return ""; }
}
function socialPage(raw: string): URL | null {
  try {
    const url = new URL(raw, "https://www.facebook.com");
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "facebook.com" && url.pathname !== "/" && !/^\/(?:ads|policies|privacy|help|login|l\.php)(?:\/|$)/i.test(url.pathname)) return url;
    if (host === "instagram.com" && url.pathname !== "/" && !/^\/(?:p|reel|reels|stories|explore|accounts)(?:\/|$)/i.test(url.pathname)) return url;
  } catch { /* link inválido */ }
  return null;
}
const https = (raw: string) => { try { const u = new URL(raw); return u.protocol === "https:" && u.href.length <= 2048 ? u.href : ""; } catch { return ""; } };

export function toAd(c: RawCard): ScrapedAd {
  const page = c.anchors.find((a) => a.text && socialPage(a.href));
  const pageUrl = page ? socialPage(page.href) : null;
  const pageId = pageUrl && /facebook\.com$/i.test(pageUrl.hostname) && /^\/\d+\/?$/.test(pageUrl.pathname) ? pageUrl.pathname.split("/").join("") : "";
  const paid = (c.text.match(/(?:Pago por|Paid for by)\s+([^\n]+)/i)?.[1] || "").trim();
  const imgs = c.imgs.map(https).filter(Boolean);
  const avatar = imgs.find((s) => /s60x60/i.test(s) && !/static\.xx\.fbcdn\.net/i.test(s)) || "";
  const size = (s: string) => { const m = /[?&]stp=[^&]*?_s(\d+)x\d+/i.exec(s); return m ? Number(m[1]) : 10000; };
  const creatives = imgs.filter((s) => !/(?:s60x60|static\.xx\.fbcdn\.net)/i.test(s)).sort((a, b) => size(a) - size(b));
  const image = https(c.poster) || creatives.at(-1) || "";
  const video = https(c.videoSrc);
  const uses = c.text.match(/(\d+)\s+(?:ads? use|anúncios? usam)/i);
  const status = /\bInactive\b|\bInativo\b/.test(c.text) ? false : /\bActive\b|\bAtivo\b/.test(c.text) ? true : null;
  const plats = new Set<string>();
  for (const p of c.platformIcons) {
    const s = p.toLowerCase();
    if (s.includes("facebook")) plats.add("facebook");
    if (s.includes("instagram")) plats.add("instagram");
    if (s.includes("messenger")) plats.add("messenger");
    if (s.includes("audience")) plats.add("audience_network");
    if (s.includes("threads")) plats.add("threads");
  }
  return {
    external_id: c.id,
    page_id: pageId,
    page_name: (page?.text || c.sponsoredName || paid).slice(0, 200),
    text: c.copy,
    library_url: `https://www.facebook.com/ads/library/?id=${c.id}`,
    destination_url: c.anchors.map((a) => externalUrl(a.href)).find(Boolean) || "",
    image_url: image,
    avatar_url: avatar,
    video_url: video,
    media_type: c.hasVideo ? "video" : image ? "image" : "unknown",
    creative_uses: uses ? Number(uses[1]) : null,
    started_at: startedAt(c.text),
    active: status,
    platforms: [...plats],
  };
}

async function launch(): Promise<Browser> {
  const base = {
    headless: true,
    timeout: 20_000,
    // Servidor pequeno: sem /dev/shm grande, sem GPU, heap de JS limitado.
    args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox", "--disable-extensions", "--mute-audio", "--js-flags=--max-old-space-size=384"],
  };
  if (process.env.META_CHROME_PATH) return chromium.launch({ ...base, executablePath: process.env.META_CHROME_PATH });
  return chromium.launch({ ...base, channel: "chrome" });
}

export interface ScrapeResult { ads: ScrapedAd[]; loaded: number; results: number | null; url: string }

/** A Biblioteca às vezes vem sem cartões (instabilidade da Meta): tenta mais uma vez antes de desistir. */
async function scrape(url: URL, limit: number, onProgress?: (n: number) => void): Promise<ScrapeResult> {
  try { return await scrapeOnce(url, limit, onProgress); }
  catch (e: any) {
    if (!/não carregou/.test(String(e?.message))) throw e;
    await new Promise((r) => setTimeout(r, 5000));
    return scrapeOnce(url, limit, onProgress);
  }
}

async function scrapeOnce(url: URL, limit: number, onProgress?: (n: number) => void): Promise<ScrapeResult> {
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ locale: "en-US", viewport: { width: 1365, height: 900 }, userAgent: undefined });
    await ctx.route("**/*", (route) => {
      const t = route.request().resourceType();
      return t === "image" || t === "media" || t === "font" ? route.abort() : route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 40_000 });
    try {
      await page.waitForFunction(() => /Library ID\s*:\s*\d+|ID da biblioteca\s*:\s*\d+|Identificação da biblioteca\s*:\s*\d+/i.test(document.body?.innerText || ""), null, { timeout: 20_000 });
    } catch {
      const body = await page.locator("body").innerText().catch(() => "");
      if (/No ads match|No results|Nenhum anúncio|Nenhum resultado/i.test(body)) return { ads: [], loaded: 0, results: 0, url: url.href };
      logger.warn(`[Hack Ads] sem cartões em ${url.href} :: ${body.replace(/\s+/g, " ").slice(0, 300)}`);
      if (/log in|entrar|checkpoint|captcha/i.test(body.slice(0, 2000))) throw new Error("A Meta pediu verificação nesta busca. Tente de novo em alguns minutos.");
      throw new Error("A Biblioteca de Anúncios não carregou os cartões. Tente de novo em instantes.");
    }
    const byId = new Map<string, ScrapedAd>();
    let previous = 0, stagnant = 0;
    const maxScrolls = Math.min(60, Math.max(10, Math.ceil(limit / 8) * 2));
    for (let i = 0; i < maxScrolls; i++) {
      const raw = (await page.evaluate(PARSE_IN_PAGE)) as RawCard[];
      for (const c of raw) {
        const ad = toAd(c);
        const old = byId.get(ad.external_id);
        if (!old) byId.set(ad.external_id, ad);
        else {
          // A Meta desmonta o vídeo dos cartões que saem da tela: uma leitura posterior "pior" não apaga a anterior.
          for (const [k, v] of Object.entries(ad)) {
            if (v === "" || v == null || (Array.isArray(v) && !v.length)) continue;
            if (k === "media_type" && (v === "unknown" || (v === "image" && old.media_type === "video"))) continue;
            (old as any)[k] = v;
          }
        }
      }
      onProgress?.(byId.size);
      if (byId.size >= limit || stagnant >= 3) break;
      stagnant = byId.size === previous ? stagnant + 1 : 0;
      previous = byId.size;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
    }
    const header = (await page.locator("body").innerText().catch(() => "")).match(/~?\s?([\d.,]+)\s+results?/i);
    return { ads: [...byId.values()].slice(0, limit), loaded: byId.size, results: header ? Number(header[1].replace(/[.,]/g, "")) : null, url: url.href };
  } finally {
    await browser.close().catch((e) => logger.warn(`[Hack Ads] fechar navegador: ${e?.message}`));
  }
}

export function libraryUrl(p: { term: string; country: string; active?: boolean; exact?: boolean; media?: string }): URL {
  const url = new URL("https://www.facebook.com/ads/library/");
  url.search = new URLSearchParams({
    active_status: p.active ? "active" : "all",
    ad_type: "all",
    country: p.country,
    q: p.exact ? `"${p.term}"` : p.term,
    search_type: p.exact ? "keyword_exact_phrase" : "keyword_unordered",
    media_type: p.media || "all",
  }).toString();
  return url;
}

export async function searchLibrary(p: { term: string; country: string; limit: number; active?: boolean; media?: string }, onProgress?: (n: number) => void): Promise<ScrapeResult> {
  return scrape(libraryUrl({ term: p.term, country: p.country, active: p.active, media: p.media }), p.limit, onProgress);
}

/** Anúncios ativos de uma página: busca a frase exata do nome e fica só com os cartões dela. */
export async function pageActiveAds(p: { pageId?: string | null; pageName: string }): Promise<{ active_cards: number; active_ads: number; capped: boolean; ads: ScrapedAd[] }> {
  const limit = 150;
  const r = await scrape(libraryUrl({ term: p.pageName, country: "ALL", active: true, exact: true }), limit);
  const name = p.pageName.trim().toLowerCase();
  const own = r.ads.filter((a) => (p.pageId ? a.page_id === p.pageId : a.page_name.trim().toLowerCase() === name));
  return { active_cards: own.length, active_ads: own.reduce((s, a) => s + Math.max(1, a.creative_uses || 1), 0), capped: r.loaded >= limit, ads: own };
}
