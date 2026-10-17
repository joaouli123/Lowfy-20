import crypto from "crypto";
import { pool } from "../db";
import { logger } from "../utils/logger";
import { ObjectStorageService } from "../objectStorage";
import { searchLibrary, pageActiveAds, type ScrapedAd } from "./scraper";
import { inferirCategoria, inferirIdioma, checkoutDe, dominioDe, pageKeyDe, creativeKeyDe, escalaDe } from "./enrich";

/**
 * Hack Ads: o banco de anúncios é compartilhado (toda busca de qualquer usuário enriquece a base),
 * salvos e monitoramento são de cada usuário. As coletas abrem um Chrome, então rodam numa fila
 * única, uma de cada vez, para não pesar o servidor.
 */

// ---------------- fila ----------------
type JobKind = "search" | "page";
export interface Job {
  id: string; kind: JobKind; userId: string | null; status: "queued" | "running" | "done" | "error";
  progress: number; params: any; result?: any; error?: string; createdAt: number;
}
const jobs = new Map<string, Job>();
const fila: Job[] = [];
let rodando = false;

export function jobInfo(id: string) {
  const j = jobs.get(id);
  if (!j) return null;
  return { ...j, position: j.status === "queued" ? fila.indexOf(j) + 1 : 0 };
}
export const filaTamanho = () => fila.length + (rodando ? 1 : 0);

function enqueue(kind: JobKind, userId: string | null, params: any): Job {
  const now = Date.now();
  jobs.forEach((j, k) => { if (now - j.createdAt > 6 * 3600_000) jobs.delete(k); });
  const job: Job = { id: crypto.randomUUID(), kind, userId, status: "queued", progress: 0, params, createdAt: now };
  jobs.set(job.id, job);
  fila.push(job);
  void pump();
  return job;
}

async function pump() {
  if (rodando) return;
  const job = fila.shift();
  if (!job) return;
  rodando = true;
  job.status = "running";
  try {
    job.result = job.kind === "search" ? await runSearch(job) : await runPageCheck(job.params.pageKey);
    job.status = "done";
  } catch (e: any) {
    job.status = "error";
    job.error = e?.message || "Falha na coleta";
    logger.warn(`[Hack Ads] ${job.kind}: ${job.error}`);
  } finally {
    rodando = false;
    setImmediate(() => void pump());
  }
}

// ---------------- gravação ----------------
async function upsert(ads: ScrapedAd[], country: string): Promise<{ ids: number[]; added: number; novos: number[] }> {
  const ids: number[] = [], novos: number[] = [];
  for (const a of ads) {
    const pageKey = pageKeyDe(a.page_id, a.page_name, a.external_id);
    const chk = a.destination_url ? checkoutDe(a.destination_url) : null;
    const r = await pool.query(
      `INSERT INTO hack_ads (ext_id, page_id, page_name, page_key, text, media_type, image_url, video_url, avatar_url, library_url,
         destination_url, domain, checkout_url, checkout_platform, countries, language, category, started_at, active, creative_uses, creative_key, platforms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (ext_id) DO UPDATE SET
         page_id = COALESCE(NULLIF(EXCLUDED.page_id,''), hack_ads.page_id),
         page_name = COALESCE(NULLIF(EXCLUDED.page_name,''), hack_ads.page_name),
         page_key = CASE WHEN COALESCE(EXCLUDED.page_id,'') <> '' THEN EXCLUDED.page_key ELSE hack_ads.page_key END,
         text = COALESCE(NULLIF(EXCLUDED.text,''), hack_ads.text),
         creative_key = CASE WHEN COALESCE(EXCLUDED.text,'') <> '' THEN EXCLUDED.creative_key ELSE hack_ads.creative_key END,
         media_type = CASE WHEN EXCLUDED.media_type = 'unknown' OR (EXCLUDED.media_type = 'image' AND hack_ads.media_type = 'video') THEN hack_ads.media_type ELSE EXCLUDED.media_type END,
         image_url = COALESCE(NULLIF(EXCLUDED.image_url,''), hack_ads.image_url),
         video_url = COALESCE(NULLIF(EXCLUDED.video_url,''), hack_ads.video_url),
         avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url,''), hack_ads.avatar_url),
         destination_url = COALESCE(NULLIF(EXCLUDED.destination_url,''), hack_ads.destination_url),
         domain = COALESCE(EXCLUDED.domain, hack_ads.domain),
         checkout_url = COALESCE(EXCLUDED.checkout_url, hack_ads.checkout_url),
         checkout_platform = COALESCE(EXCLUDED.checkout_platform, hack_ads.checkout_platform),
         countries = ARRAY(SELECT DISTINCT unnest(hack_ads.countries || EXCLUDED.countries)),
         language = COALESCE(hack_ads.language, EXCLUDED.language),
         category = COALESCE(hack_ads.category, EXCLUDED.category),
         started_at = COALESCE(EXCLUDED.started_at, hack_ads.started_at),
         active = COALESCE(EXCLUDED.active, hack_ads.active),
         creative_uses = COALESCE(EXCLUDED.creative_uses, hack_ads.creative_uses),
         platforms = CASE WHEN cardinality(EXCLUDED.platforms) > 0 THEN EXCLUDED.platforms ELSE hack_ads.platforms END,
         last_seen = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [a.external_id, a.page_id || null, a.page_name || null, pageKey, a.text || null, a.media_type, a.image_url || null, a.video_url || null,
        a.avatar_url || null, a.library_url, a.destination_url || null, a.destination_url ? dominioDe(a.destination_url) : null,
        chk?.url || null, chk?.plataforma || null, country && country !== "ALL" ? [country] : [], inferirIdioma(a.text), inferirCategoria(a.page_name, a.text),
        a.started_at, a.active, a.creative_uses, creativeKeyDe(pageKey, a.text, a.external_id), a.platforms || []],
    );
    const id = Number(r.rows[0].id);
    ids.push(id);
    if (r.rows[0].inserted) novos.push(id);
    await pool.query(
      `INSERT INTO hack_ads_observations (ad_id, creative_uses, active) VALUES ($1,$2,$3)
       ON CONFLICT (ad_id, dia) DO UPDATE SET creative_uses = GREATEST(hack_ads_observations.creative_uses, EXCLUDED.creative_uses), active = COALESCE(EXCLUDED.active, hack_ads_observations.active)`,
      [id, a.creative_uses, a.active],
    );
  }
  return { ids, added: novos.length, novos };
}

async function runSearch(job: Job) {
  const { term, country, limit, searchId, active, media } = job.params;
  await pool.query(`UPDATE hack_ads_searches SET status = 'running' WHERE id = $1`, [searchId]);
  try {
    const r = await searchLibrary({ term, country, limit, active, media }, (n) => { job.progress = n; });
    const { ids, added, novos } = await upsert(r.ads, country);
    if (ids.length) await pool.query(`INSERT INTO hack_ads_search_ads (search_id, ad_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`, [searchId, ids]);
    await pool.query(`UPDATE hack_ads_searches SET status = 'done', found = $2, added = $3, finished_at = now() WHERE id = $1`, [searchId, ids.length, added]);
    // Os links da Meta expiram em dias: guarda imagem e foto da página dos anúncios novos já agora.
    void cacheImagens(novos);
    return { searchId, found: ids.length, added, results: r.results };
  } catch (e: any) {
    await pool.query(`UPDATE hack_ads_searches SET status = 'error', error = $2, finished_at = now() WHERE id = $1`, [searchId, String(e?.message || e).slice(0, 300)]);
    throw e;
  }
}

// ---------------- mídia ----------------
const CDN_OK = (u: string) => { try { const h = new URL(u).hostname; return /(^|\.)(fbcdn\.net|facebook\.com|cdninstagram\.com)$/.test(h) && u.startsWith("https://"); } catch { return false; } };
const LIMITE = { image: 8 * 1024 * 1024, avatar: 2 * 1024 * 1024, video: 80 * 1024 * 1024 };
type Kind = keyof typeof LIMITE;
const COL: Record<Kind, [string, string]> = { image: ["image_url", "image_local"], avatar: ["avatar_url", "avatar_local"], video: ["video_url", "video_local"] };
const baixando = new Map<string, Promise<string | null>>();

/** Baixa a mídia do CDN da Meta para o nosso armazenamento (uma vez) e devolve o caminho /objects/... */
export async function mediaLocal(adId: number, kind: Kind): Promise<string | null> {
  const [urlCol, localCol] = COL[kind];
  const r = await pool.query(`SELECT ${urlCol} AS url, ${localCol} AS local FROM hack_ads WHERE id = $1`, [adId]);
  const row = r.rows[0];
  if (!row) return null;
  if (row.local) return row.local;
  if (!row.url || !CDN_OK(row.url)) return null;
  const key = `${adId}:${kind}`;
  if (!baixando.has(key)) {
    baixando.set(key, (async () => {
      try {
        const res = await fetch(row.url, { signal: AbortSignal.timeout(kind === "video" ? 90_000 : 20_000), redirect: "follow" });
        if (!res.ok) return null;
        const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
        if (!(kind === "video" ? /^video\//.test(mime) : /^image\//.test(mime))) return null;
        const len = Number(res.headers.get("content-length") || 0);
        if (len > LIMITE[kind]) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > LIMITE[kind]) return null;
        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("mp4") || kind === "video" ? "mp4" : "jpg";
        const local = await new ObjectStorageService().uploadBuffer(buf, "hack-ads", mime, ext);
        await pool.query(`UPDATE hack_ads SET ${localCol} = $2 WHERE id = $1`, [adId, local]);
        return local;
      } catch (e: any) {
        logger.warn(`[Hack Ads] mídia ${kind} ${adId}: ${e?.message}`);
        return null;
      } finally { baixando.delete(key); }
    })());
  }
  return baixando.get(key)!;
}

/** Onde está a mídia: cópia nossa (se já guardada) e o link original da Meta (se ainda válido para exibir). */
export async function mediaFor(adId: number, kind: Kind): Promise<{ local: string | null; remote: string | null }> {
  const [urlCol, localCol] = COL[kind];
  const r = await pool.query(`SELECT ${urlCol} AS url, ${localCol} AS local FROM hack_ads WHERE id = $1`, [adId]);
  const row = r.rows[0];
  if (!row) return { local: null, remote: null };
  return { local: row.local || null, remote: row.url && CDN_OK(row.url) ? row.url : null };
}

async function cacheImagens(ids: number[]) {
  const lista = [...ids];
  const worker = async () => { for (let id = lista.shift(); id != null; id = lista.shift()) { await mediaLocal(id, "image"); await mediaLocal(id, "avatar"); } };
  await Promise.all([worker(), worker(), worker()]).catch(() => {});
}

// ---------------- buscas ----------------
export async function startSearch(userId: string, p: { term: string; country: string; limit: number; active?: boolean; media?: string }) {
  const term = String(p.term || "").trim().slice(0, 100);
  if (term.length < 2) throw Object.assign(new Error("Digite o que você quer minerar (ex.: emagrecimento, renda extra)"), { status: 400 });
  const country = /^[A-Z]{2}$|^ALL$/.test(String(p.country || "").toUpperCase()) ? String(p.country).toUpperCase() : "BR";
  const limit = Math.max(10, Math.min(100, Number(p.limit) || 50));
  const uso = await pool.query(`SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS hora, COUNT(*) FILTER (WHERE created_at > now() - interval '1 day') AS dia FROM hack_ads_searches WHERE user_id = $1`, [userId]);
  if (Number(uso.rows[0].hora) >= 12) throw Object.assign(new Error("Você fez muitas buscas nesta hora. Enquanto isso, explore a biblioteca com os filtros."), { status: 429 });
  if (Number(uso.rows[0].dia) >= 60) throw Object.assign(new Error("Limite de buscas de hoje atingido. Amanhã libera de novo."), { status: 429 });
  if (fila.length >= 25) throw Object.assign(new Error("Muita gente minerando agora. Tente de novo em alguns minutos."), { status: 503 });
  const s = await pool.query(`INSERT INTO hack_ads_searches (user_id, term, country, requested) VALUES ($1,$2,$3,$4) RETURNING id`, [userId, term, country, limit]);
  const job = enqueue("search", userId, { term, country, limit, searchId: Number(s.rows[0].id), active: !!p.active, media: ["image", "video"].includes(String(p.media)) ? p.media : undefined });
  return { jobId: job.id, searchId: Number(s.rows[0].id), position: fila.indexOf(job) + 1 };
}

export async function listSearches(userId: string) {
  const r = await pool.query(`SELECT id, term, country, requested, found, added, status, error, created_at FROM hack_ads_searches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
  return r.rows;
}

// ---------------- biblioteca ----------------
export interface Filtros {
  q?: string; search_by?: string; category?: string; country?: string; media?: string; language?: string;
  min_days?: string; min_dups?: string; min_page_ads?: string; from?: string; to?: string; checkout?: string; platform?: string;
  active?: string; favorites?: string; search_id?: string; placement?: string; domain?: string; sort?: string; dir?: string; limit?: string; offset?: string; page_key?: string;
}

export async function listAds(userId: string, f: Filtros, modo: "library" | "trending" = "library") {
  const where: string[] = [], args: any[] = [userId];
  const arg = (v: any) => { args.push(v); return `$${args.length}`; };
  const q = String(f.q || "").trim().slice(0, 120);
  if (q) {
    const t = arg(`%${q}%`);
    if (f.search_by === "text") where.push(`a.text ILIKE ${t}`);
    else if (f.search_by === "page") where.push(`a.page_name ILIKE ${t}`);
    else if (f.search_by === "url") where.push(`(a.destination_url ILIKE ${t} OR a.checkout_url ILIKE ${t} OR a.domain ILIKE ${t})`);
    else where.push(`(a.text ILIKE ${t} OR a.page_name ILIKE ${t} OR a.domain ILIKE ${t} OR a.ext_id = ${arg(q)})`);
  }
  const lista = (v?: string, n = 30) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, n);
  const cats = lista(f.category);
  if (cats.length) where.push(`a.category = ANY(${arg(cats)}::text[])`);
  const paises = lista(f.country).map((x) => x.toUpperCase());
  if (paises.length) where.push(`a.countries && ${arg(paises)}::text[]`);
  if (f.media === "image" || f.media === "video") where.push(`a.media_type = ${arg(f.media)}`);
  if (f.language) where.push(`a.language = ${arg(String(f.language).slice(0, 5))}`);
  if (Number(f.min_days) > 0) where.push(`a.started_at IS NOT NULL AND a.started_at <= CURRENT_DATE - ${arg(Math.floor(Number(f.min_days)))}::int`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(f.from || ""))) where.push(`a.started_at >= ${arg(f.from)}::date`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(f.to || ""))) where.push(`a.started_at <= ${arg(f.to)}::date`);
  if (f.checkout === "1") where.push(`a.checkout_url IS NOT NULL`);
  if (f.platform) where.push(`a.checkout_platform = ${arg(String(f.platform).slice(0, 20))}`);
  const plats = lista(f.placement, 6).filter((x) => /^[a-z_]{3,20}$/.test(x));
  if (plats.length) where.push(`a.platforms && ${arg(plats)}::text[]`);
  if (f.active === "1" || modo === "trending") where.push(`a.active IS TRUE`);
  if (modo === "trending") where.push(`a.last_seen > now() - interval '21 days'`);
  if (f.domain) where.push(`a.domain ILIKE ${arg(`%${String(f.domain).slice(0, 100)}%`)}`);
  if (f.page_key) where.push(`a.page_key = ${arg(String(f.page_key).slice(0, 220))}`);
  if (f.favorites === "1") where.push(`EXISTS (SELECT 1 FROM hack_ads_favorites fv WHERE fv.ad_id = a.id AND fv.user_id = $1)`);
  if (Number(f.search_id) > 0) where.push(`EXISTS (SELECT 1 FROM hack_ads_search_ads sa WHERE sa.ad_id = a.id AND sa.search_id = ${arg(Number(f.search_id))})`);

  const outer: string[] = [];
  if (Number(f.min_dups) > 0) outer.push(`g.duplicates >= ${arg(Math.floor(Number(f.min_dups)))}`);
  if (Number(f.min_page_ads) > 0) outer.push(`g.page_ads >= ${arg(Math.floor(Number(f.min_page_ads)))}`);

  const dir = f.dir === "asc" ? "ASC" : "DESC";
  const sort = modo === "trending" ? "duplicates" : f.sort;
  const order =
    sort === "started" ? `g.started_at ${dir} NULLS LAST` :
    sort === "duplicates" ? `g.duplicates ${dir}, g.started_at ASC NULLS LAST` :
    sort === "days" ? `g.started_at ${dir === "DESC" ? "ASC" : "DESC"} NULLS LAST` :
    sort === "page_ads" ? `g.page_ads ${dir}, g.last_seen DESC` :
    `g.last_seen ${dir}`;
  const limit = Math.max(1, Math.min(60, Number(f.limit) || 30));
  const offset = Math.max(0, Number(f.offset) || 0);

  const sql = `
    WITH base AS (
      SELECT a.*,
        COUNT(*) OVER (PARTITION BY a.creative_key) AS dup_count,
        MAX(COALESCE(a.creative_uses, 0)) OVER (PARTITION BY a.creative_key) AS group_uses,
        ROW_NUMBER() OVER (PARTITION BY a.creative_key ORDER BY (a.video_url IS NULL AND a.image_url IS NULL), a.last_seen DESC, a.id DESC) AS rk
      FROM hack_ads a ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ), g AS (
      SELECT b.*, GREATEST(b.dup_count, b.group_uses) AS duplicates,
        (SELECT COUNT(*) FROM hack_ads p WHERE p.page_key = b.page_key) AS page_ads
      FROM base b WHERE b.rk = 1
    )
    SELECT g.id, g.ext_id, g.page_id, g.page_name, g.page_key, g.text, g.media_type, g.library_url, g.destination_url, g.domain,
      g.checkout_url, g.checkout_platform, g.countries, g.language, g.category, g.started_at, g.active, g.creative_uses, g.platforms,
      g.first_seen, g.last_seen, g.duplicates, g.page_ads,
      (g.image_url IS NOT NULL OR g.image_local IS NOT NULL) AS has_image, (g.video_url IS NOT NULL OR g.video_local IS NOT NULL) AS has_video,
      (g.avatar_url IS NOT NULL OR g.avatar_local IS NOT NULL) AS has_avatar,
      EXISTS (SELECT 1 FROM hack_ads_favorites fv WHERE fv.ad_id = g.id AND fv.user_id = $1) AS favorite,
      EXISTS (SELECT 1 FROM hack_ads_monitors mo WHERE mo.page_key = g.page_key AND mo.user_id = $1) AS monitored,
      COUNT(*) OVER () AS total
    FROM g ${outer.length ? `WHERE ${outer.join(" AND ")}` : ""}
    ORDER BY ${order}, g.id DESC
    LIMIT ${limit} OFFSET ${offset}`;
  const r = await pool.query(sql, args);
  return { rows: r.rows.map(row), total: r.rows[0] ? Number(r.rows[0].total) : 0, limit, offset };
}

function row(r: any) {
  const dias = r.started_at ? Math.max(0, Math.floor((Date.now() - new Date(r.started_at).getTime()) / 864e5)) : null;
  const dups = Number(r.duplicates) || 1;
  // Regra que o mercado usa (Guru Master): 7+ dias no ar e 3+ anúncios do mesmo criativo = validado.
  const selo = dias != null && dias < 7 ? "teste" : dias != null && dups >= 3 ? "validado" : null;
  return {
    id: Number(r.id), extId: r.ext_id, pageId: r.page_id, pageName: r.page_name, pageKey: r.page_key, text: r.text || "",
    mediaType: r.media_type, libraryUrl: r.library_url, destinationUrl: r.destination_url, domain: r.domain,
    checkoutUrl: r.checkout_url, checkoutPlatform: r.checkout_platform, countries: r.countries || [], platforms: r.platforms || [], language: r.language,
    category: r.category, startedAt: r.started_at, active: r.active, days: dias, duplicates: dups, pageAds: Number(r.page_ads) || 1,
    hot: dups >= 40, selo, firstSeen: r.first_seen, lastSeen: r.last_seen,
    hasImage: !!r.has_image, hasVideo: !!r.has_video, hasAvatar: !!r.has_avatar, favorite: !!r.favorite, monitored: !!r.monitored,
  };
}

export async function getAd(userId: string, id: number) {
  const r =await pool.query(`SELECT a.*, 1 AS duplicates,
      (SELECT COUNT(*) FROM hack_ads p WHERE p.page_key = a.page_key) AS page_ads,
      (SELECT COUNT(*) FROM hack_ads d WHERE d.creative_key = a.creative_key) AS dup_count,
      (image_url IS NOT NULL OR image_local IS NOT NULL) AS has_image, (video_url IS NOT NULL OR video_local IS NOT NULL) AS has_video,
      (avatar_url IS NOT NULL OR avatar_local IS NOT NULL) AS has_avatar,
      EXISTS (SELECT 1 FROM hack_ads_favorites fv WHERE fv.ad_id = a.id AND fv.user_id = $1) AS favorite,
      EXISTS (SELECT 1 FROM hack_ads_monitors mo WHERE mo.page_key = a.page_key AND mo.user_id = $1) AS monitored
    FROM hack_ads a WHERE a.id = $2`, [userId, id]);
  if (!r.rows[0]) return null;
  const a = r.rows[0];
  a.duplicates = Math.max(Number(a.dup_count) || 1, Number(a.creative_uses) || 0);
  const [obs, rel, snaps] = await Promise.all([
    pool.query(`SELECT dia, creative_uses, active FROM hack_ads_observations WHERE ad_id = $1 ORDER BY dia`, [id]),
    listAds(userId, { page_key: a.page_key, limit: "12", sort: "recent" }),
    pool.query(`SELECT checked_at, active_ads, active_cards FROM hack_ads_page_snapshots WHERE page_key = $1 ORDER BY checked_at`, [a.page_key]),
  ]);
  return {
    ad: row(a),
    observations: obs.rows.map((o: any) => ({ dia: o.dia, uses: o.creative_uses, active: o.active })),
    related: rel.rows.filter((x) => x.id !== id),
    page: { snapshots: snaps.rows.map((s: any) => ({ at: s.checked_at, activeAds: s.active_ads })), escala: escalaDe(snaps.rows) },
  };
}

export async function facets() {
  const r = await pool.query(`SELECT
      (SELECT COUNT(*) FROM hack_ads) AS total,
      (SELECT COUNT(DISTINCT page_key) FROM hack_ads) AS paginas,
      (SELECT json_agg(x) FROM (SELECT category AS v, COUNT(*) AS n FROM hack_ads WHERE category IS NOT NULL GROUP BY 1 ORDER BY 2 DESC) x) AS categorias,
      (SELECT json_agg(x) FROM (SELECT c AS v, COUNT(*) AS n FROM hack_ads, unnest(countries) c GROUP BY 1 ORDER BY 2 DESC LIMIT 40) x) AS paises,
      (SELECT json_agg(x) FROM (SELECT checkout_platform AS v, COUNT(*) AS n FROM hack_ads WHERE checkout_platform IS NOT NULL GROUP BY 1 ORDER BY 2 DESC) x) AS plataformas,
      (SELECT json_agg(x) FROM (SELECT p AS v, COUNT(*) AS n FROM hack_ads, unnest(platforms) p GROUP BY 1 ORDER BY 2 DESC) x) AS veiculacao`);
  const x = r.rows[0];
  return { total: Number(x.total), paginas: Number(x.paginas), categorias: x.categorias || [], paises: x.paises || [], plataformas: x.plataformas || [], veiculacao: x.veiculacao || [] };
}

// ---------------- salvos ----------------
export async function setFavorite(userId: string, adId: number, on: boolean) {
  if (on) await pool.query(`INSERT INTO hack_ads_favorites (user_id, ad_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, adId]);
  else await pool.query(`DELETE FROM hack_ads_favorites WHERE user_id = $1 AND ad_id = $2`, [userId, adId]);
  // Salvou: guarda o vídeo também, para não sumir quando o link da Meta expirar.
  if (on) { void mediaLocal(adId, "image"); void mediaLocal(adId, "video"); }
}

// ---------------- monitoramento ----------------
export async function addMonitor(userId: string, adId: number) {
  const r = await pool.query(`SELECT page_key, page_id, page_name FROM hack_ads WHERE id = $1`, [adId]);
  const a = r.rows[0];
  if (!a || !a.page_name) throw Object.assign(new Error("Esse anúncio não tem página identificada para monitorar."), { status: 400 });
  const n = await pool.query(`SELECT COUNT(*) AS n FROM hack_ads_monitors WHERE user_id = $1`, [userId]);
  if (Number(n.rows[0].n) >= 30) throw Object.assign(new Error("Você já monitora 30 páginas. Remova alguma para adicionar outra."), { status: 400 });
  await pool.query(`INSERT INTO hack_ads_pages (page_key, page_id, page_name) VALUES ($1,$2,$3) ON CONFLICT (page_key) DO UPDATE SET page_name = EXCLUDED.page_name, page_id = COALESCE(EXCLUDED.page_id, hack_ads_pages.page_id)`, [a.page_key, a.page_id, a.page_name]);
  await pool.query(`INSERT INTO hack_ads_monitors (user_id, page_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, a.page_key]);
  const p = await pool.query(`SELECT last_checked_at FROM hack_ads_pages WHERE page_key = $1`, [a.page_key]);
  if (!p.rows[0]?.last_checked_at) enqueue("page", userId, { pageKey: a.page_key });
  return { pageKey: a.page_key };
}

export async function removeMonitor(userId: string, pageKey: string) {
  await pool.query(`DELETE FROM hack_ads_monitors WHERE user_id = $1 AND page_key = $2`, [userId, pageKey]);
}

export async function checkNow(userId: string, pageKey: string) {
  const m = await pool.query(`SELECT 1 FROM hack_ads_monitors WHERE user_id = $1 AND page_key = $2`, [userId, pageKey]);
  if (!m.rows[0]) throw Object.assign(new Error("Você não monitora essa página."), { status: 404 });
  const ja = [...jobs.values()].find((j) => j.kind === "page" && j.params.pageKey === pageKey && (j.status === "queued" || j.status === "running"));
  return (ja || enqueue("page", userId, { pageKey })).id;
}

export async function listMonitors(userId: string) {
  const r = await pool.query(`
    SELECT p.page_key, p.page_id, p.page_name, p.last_checked_at, p.last_error, m.added_at,
      (SELECT id FROM hack_ads a WHERE a.page_key = p.page_key AND (a.avatar_url IS NOT NULL OR a.avatar_local IS NOT NULL) ORDER BY a.last_seen DESC LIMIT 1) AS avatar_ad,
      (SELECT COUNT(*) FROM hack_ads a WHERE a.page_key = p.page_key) AS ads_na_base,
      COALESCE((SELECT json_agg(json_build_object('at', s.checked_at, 'activeAds', s.active_ads) ORDER BY s.checked_at)
        FROM (SELECT * FROM hack_ads_page_snapshots s WHERE s.page_key = p.page_key ORDER BY s.checked_at DESC LIMIT 30) s), '[]') AS snaps
    FROM hack_ads_monitors m JOIN hack_ads_pages p ON p.page_key = m.page_key
    WHERE m.user_id = $1 ORDER BY m.added_at DESC`, [userId]);
  return r.rows.map((x: any) => {
    const snaps = (x.snaps || []).map((s: any) => ({ at: s.at, activeAds: Number(s.activeAds) }));
    const esc = escalaDe(snaps.map((s: any) => ({ checked_at: s.at, active_ads: s.activeAds })));
    const checando = [...jobs.values()].some((j) => j.kind === "page" && j.params.pageKey === x.page_key && (j.status === "queued" || j.status === "running"));
    return { pageKey: x.page_key, pageId: x.page_id, pageName: x.page_name, lastCheckedAt: x.last_checked_at, lastError: x.last_error, addedAt: x.added_at,
      avatarAd: x.avatar_ad ? Number(x.avatar_ad) : null, adsNaBase: Number(x.ads_na_base), snapshots: snaps, activeAds: snaps.at(-1)?.activeAds ?? null, ...esc, checando };
  });
}

async function runPageCheck(pageKey: string) {
  const p = await pool.query(`SELECT page_key, page_id, page_name FROM hack_ads_pages WHERE page_key = $1`, [pageKey]);
  const page = p.rows[0];
  if (!page) throw new Error("Página não encontrada");
  try {
    const r = await pageActiveAds({ pageId: page.page_id, pageName: page.page_name });
    await upsert(r.ads, "ALL");
    await pool.query(`INSERT INTO hack_ads_page_snapshots (page_key, active_cards, active_ads, capped) VALUES ($1,$2,$3,$4)`, [pageKey, r.active_cards, r.active_ads, r.capped]);
    await pool.query(`UPDATE hack_ads_pages SET last_checked_at = now(), last_error = NULL WHERE page_key = $1`, [pageKey]);
    return { activeAds: r.active_ads };
  } catch (e: any) {
    await pool.query(`UPDATE hack_ads_pages SET last_checked_at = now(), last_error = $2 WHERE page_key = $1`, [pageKey, String(e?.message || e).slice(0, 300)]);
    throw e;
  }
}

/** Rotina: confere 1x por dia as páginas monitoradas (até 10 por rodada). */
export async function checkDuePages() {
  if (fila.length > 3) return;
  const r = await pool.query(`SELECT p.page_key FROM hack_ads_pages p
    WHERE EXISTS (SELECT 1 FROM hack_ads_monitors m WHERE m.page_key = p.page_key)
      AND (p.last_checked_at IS NULL OR p.last_checked_at < now() - interval '24 hours')
    ORDER BY p.last_checked_at NULLS FIRST LIMIT 10`);
  for (const x of r.rows) {
    const ja = [...jobs.values()].some((j) => j.kind === "page" && j.params.pageKey === x.page_key && (j.status === "queued" || j.status === "running"));
    if (!ja) enqueue("page", null, { pageKey: x.page_key });
  }
}
