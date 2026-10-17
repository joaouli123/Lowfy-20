import { createHash } from "crypto";

/** Categorias (as do Ad Intelligence, em português) e pistas para adivinhar pela página + copy. */
export const CATEGORIAS = [
  "Pets", "Artesanato e costura", "Automotivo", "Bebês e crianças", "Beleza e cuidados", "Moda",
  "Eletrônicos", "Casa e cozinha", "Saúde e bem-estar", "Esportes", "Comida e bebida", "Educação", "Negócios e renda",
] as const;

const PISTAS: [string, RegExp][] = [
  ["Pets", /\b(?:pets?|cachorr[oa]s?|gatos?|caes|filhotes?|racao|coleiras?|arranhadores?)\b/],
  ["Artesanato e costura", /\b(?:artesanato|costura|bordados?|croche|trico|sewing|embroidery|amigurumi)\b/],
  ["Automotivo", /\b(?:automotiv[oa]s?|automoveis?|veiculos?|motocicletas?|carroceria|pneus?|mecanica)\b/],
  ["Bebês e crianças", /\b(?:bebes?|fraldas?|maternidade|carrinho de bebe|brinquedos? infantis?|gestantes?)\b/],
  ["Beleza e cuidados", /\b(?:maquiagem|cosmeticos?|skincare|skin care|perfumes?|depilacao|manicure|unhas? em gel|cuidados com a pele|cabelos?)\b/],
  ["Moda", /\b(?:vestidos?|blusas?|calcas?|lingerie|sutias?|tenis|calcados?|sapatos?|sneakers?|camisetas?|moda feminina|moda masculina)\b/],
  ["Eletrônicos", /\b(?:smartphones?|celulares?|notebooks?|laptops?|headphones?|fones? bluetooth|smartwatch(?:es)?|computadores?)\b/],
  ["Casa e cozinha", /\b(?:air ?fryer|aspiradores?|sofas?|moveis?|decoracao|utensilios? de cozinha|cama mesa e banho|organizadores?)\b/],
  ["Saúde e bem-estar", /\b(?:emagrec\w*|diabetes|diabeticos?|suplementos?|colageno|probioticos?|saude mental|menopausa|dieta|barriga|creatina|whey)\b/],
  ["Esportes", /\b(?:ciclismo|pedal|bicicletas?|corrida|futebol|musculacao|academia|yoga|camping|fitness|treino)\b/],
  ["Comida e bebida", /\b(?:sobremesas?|culinaria|confeitaria|pizzas?|cafes? especiais|receitas? de|marmitas?)\b/],
  ["Educação", /\b(?:cursos? online|aulas? online|treinamento|apostilas?|aprender ingles|concursos?|enem|vestibular|mentoria)\b/],
  ["Negócios e renda", /\b(?:renda extra|trafego pago|marketing digital|afiliad\w+|dropshipping|empreendedor\w*|vendas online|ganhar dinheiro|infoprodutos?|lancamentos?)\b/],
];

const plain = (v: string) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Só atribui categoria quando a evidência aponta para uma única área. */
export function inferirCategoria(pageName: string, text: string): string | null {
  const c = plain(`${pageName} ${text}`).replace(/\bacademia financeira\b/g, "");
  if (!c.trim()) return null;
  const hits = new Set(PISTAS.filter(([, re]) => re.test(c)).map(([k]) => k));
  return hits.size === 1 ? [...hits][0] : null;
}

/** Idioma pelas palavras mais comuns (pt/es/en); o suficiente para o público da Lowfy. */
export function inferirIdioma(text: string): string | null {
  const w = plain(text).match(/[a-z]+/g) || [];
  if (w.length < 8) return null;
  const score = (list: string[]) => w.filter((x) => list.includes(x)).length;
  const pt = score(["voce", "nao", "para", "com", "que", "uma", "seu", "sua", "mais", "como", "isso", "esta", "agora", "aqui", "muito", "tambem", "ate"]);
  const es = score(["usted", "para", "con", "que", "una", "su", "mas", "como", "esto", "ahora", "aqui", "muy", "tambien", "hasta", "los", "las", "del"]);
  const en = score(["you", "your", "the", "and", "for", "with", "this", "that", "now", "more", "how", "get", "our", "are", "what"]);
  const best = Math.max(pt, es, en);
  if (best < 2) return null;
  return best === pt ? "pt" : best === es ? "es" : "en";
}

const TRACKING = /^(?:utm_.+|fbclid|gclid|gbraid|wbraid|msclkid|ttclid|src|sck|s[1-3]|afid|ref|referrer)$/i;

/** Plataforma e link canônico de checkout (Kiwify, Hotmart, Eduzz, Ticto, Monetizze, Greenn ou /checkout genérico). */
export function checkoutDe(raw: string): { url: string; plataforma: string } | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (host === "pay.kiwify.com.br") return path === "/" ? null : { url: `https://${host}${path}`, plataforma: "Kiwify" };
  if (host === "pay.hotmart.com" || host === "go.hotmart.com") {
    if (path === "/") return null;
    const off = url.searchParams.get("off");
    return { url: `https://${host}${path}${off ? `?off=${encodeURIComponent(off)}` : ""}`, plataforma: "Hotmart" };
  }
  if (["sun.eduzz.com", "chk.eduzz.com"].includes(host)) return path === "/" ? null : { url: `https://${host}${path}`, plataforma: "Eduzz" };
  if (host === "payment.ticto.app" || host === "checkout.ticto.app") return path === "/" ? null : { url: `https://${host}${path}`, plataforma: "Ticto" };
  if (host === "app.monetizze.com.br") return /^\/checkout\/[A-Za-z0-9_-]{5,}$/.test(path) ? { url: `https://${host}${path}`, plataforma: "Monetizze" } : null;
  if (host === "payfast.greenn.com.br" || host === "pay.greenn.com.br") return /^\/\d+/.test(path) ? { url: `https://${host}${path}`, plataforma: "Greenn" } : null;
  if (host.endsWith("cakto.com.br")) return path === "/" ? null : { url: `https://${host}${path}`, plataforma: "Cakto" };
  if (/(?:^|\/)(?:checkout|checkouts|cart|carrinho|finalizar|payment|pay|order|pedido)(?:\/|$)/i.test(path)) {
    const params = new URLSearchParams();
    url.searchParams.forEach((v, k) => { if (!TRACKING.test(k)) params.append(k, v); });
    params.sort();
    return { url: `${url.origin}${path}${params.size ? `?${params}` : ""}`, plataforma: "Outro" };
  }
  return null;
}

export const dominioDe = (raw: string): string | null => {
  try { return new URL(raw).hostname.toLowerCase().replace(/^www\./, "").slice(0, 200) || null; } catch { return null; }
};

export const pageKeyDe = (pageId: string, pageName: string, extId: string) =>
  pageId ? `id:${pageId}` : pageName.trim() ? `name:${pageName.trim().toLowerCase().slice(0, 200)}` : `ad:${extId}`;

/** Anúncios da mesma página com a mesma copy são duplicados do mesmo criativo (como a Meta agrupa). */
export const creativeKeyDe = (pageKey: string, text: string, extId: string) =>
  createHash("sha256").update(text.trim() ? `${pageKey}|${text.trim().toLowerCase().slice(0, 240)}` : `ad:${extId}`).digest("hex").slice(0, 40);

/** Leitura do ritmo de uma página monitorada (regra do Ad Intelligence). */
export function escalaDe(snaps: { checked_at: string | Date; active_ads: number }[]): { status: string; variacao: number | null } {
  if (!snaps.length) return { status: "sem_leitura", variacao: null };
  const last = snaps[snaps.length - 1];
  if (snaps.length === 1) return { status: last.active_ads === 0 ? "pausado" : "primeira_leitura", variacao: null };
  if (last.active_ads === 0) return { status: "pausado", variacao: -100 };
  const limite = new Date(last.checked_at).getTime() - 3 * 864e5;
  const base = [...snaps].reverse().find((s) => new Date(s.checked_at).getTime() <= limite) || snaps[0];
  if (!base.active_ads) return { status: "escalando", variacao: null };
  const v = ((last.active_ads - base.active_ads) / base.active_ads) * 100;
  return { status: v >= 20 ? "escalando" : v <= -20 ? "em_queda" : "estavel", variacao: Math.round(v) };
}
