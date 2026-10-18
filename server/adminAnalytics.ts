import type { Express } from "express";
import fs from "fs";
import path from "path";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from "./auth";

/**
 * Admin → Analytics: tudo o que acontece na plataforma num período, separado por assunto
 * (usuários, páginas visitadas, comunidade, marketplace, suporte, indicações e criadores de
 * páginas/quiz). Também registra as páginas visitadas (page_views) e o "visto por último".
 */

const TZ = "America/Sao_Paulo";
// Período em datas de São Paulo: [início do dia "from", início do dia seguinte a "to").
const RANGE = (col: string, a = 1, b = 2) =>
  `${col} >= ($${a}::date)::timestamp AT TIME ZONE '${TZ}' AND ${col} < ($${b}::date + 1)::timestamp AT TIME ZONE '${TZ}'`;
// Data local (São Paulo) de uma coluna, funcione ela com ou sem fuso.
const LOCAL = (col: string) => `(${col}::timestamptz AT TIME ZONE '${TZ}')`;
const BUCKET = (col: string, g: string) => `to_char(date_trunc('${g}', ${LOCAL(col)}), 'YYYY-MM-DD')`;

const ok = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
function period(q: any): [string, string] {
  const from = ok(q.startDate) ? q.startDate : new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return [from, ok(q.endDate) ? q.endDate : hoje()];
}
// Período anterior de mesmo tamanho (para comparar).
function previous(from: string, to: string): [string, string] {
  const a = new Date(`${from}T12:00:00Z`), b = new Date(`${to}T12:00:00Z`);
  const dias = Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  const pTo = new Date(a.getTime() - 864e5), pFrom = new Date(a.getTime() - dias * 864e5);
  return [pFrom.toISOString().slice(0, 10), pTo.toISOString().slice(0, 10)];
}
const groupOf = (g: any) => (g === "week" || g === "month" ? g : "day");
const n = (v: any) => Number(v) || 0;

// Início de cada intervalo do período (mesma regra do date_trunc do Postgres: semana começa na segunda).
function buckets(from: string, to: string, g: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  if (g === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (g === "month") d.setUTCDate(1);
  const end = new Date(`${to}T12:00:00Z`);
  for (let i = 0; d <= end && i < 800; i++) {
    out.push(d.toISOString().slice(0, 10));
    if (g === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (g === "week") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

async function q(sql: string, params: any[] = []) {
  return (await pool.query(sql, params)).rows;
}
// Conta por intervalo: devolve { "2026-10-01": 12, ... }.
async function porIntervalo(table: string, col: string, g: string, from: string, to: string, extra = "", expr = "count(*)") {
  const rows = await q(`SELECT ${BUCKET(col, g)} k, ${expr} v FROM ${table} WHERE ${RANGE(col)} ${extra} GROUP BY 1`, [from, to]);
  return Object.fromEntries(rows.map((r: any) => [r.k, n(r.v)]));
}
async function total(table: string, col: string, from: string, to: string, extra = "", expr = "count(*)") {
  const [r] = await q(`SELECT ${expr} v FROM ${table} WHERE ${RANGE(col)} ${extra}`, [from, to]);
  return n(r?.v);
}
// Não deixa uma tabela que ainda não existe (ou um erro isolado) derrubar a página inteira.
async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch (e: any) { logger.warn(`[Analytics] ${e?.message}`); return fallback; }
}

// Quem esteve ativo: abriu páginas, entrou, postou, comentou, reagiu ou usou IA.
const ATIVIDADE = `(
  SELECT user_id, created_at FROM page_views WHERE user_id IS NOT NULL
  UNION ALL SELECT user_id, created_at FROM sessions
  UNION ALL SELECT author_id, created_at FROM forum_topics
  UNION ALL SELECT author_id, created_at FROM forum_replies
  UNION ALL SELECT user_id, created_at FROM timeline_posts
  UNION ALL SELECT user_id, created_at FROM post_comments
  UNION ALL SELECT user_id, created_at FROM post_reactions
  UNION ALL SELECT user_id, created_at FROM ai_usage WHERE user_id IS NOT NULL
) atv`;
// Versão tolerante: se page_views ainda não existir (migração pendente), usa só o resto.
let temPageViews: boolean | null = null;
async function pageViewsExiste() {
  if (temPageViews) return true;
  const [r] = await q(`SELECT to_regclass('public.page_views') IS NOT NULL AS ok`);
  temPageViews = !!r?.ok;
  return temPageViews;
}
async function atividadeSql() {
  return (await pageViewsExiste()) ? ATIVIDADE : ATIVIDADE.replace(/SELECT user_id, created_at FROM page_views WHERE user_id IS NOT NULL\n  UNION ALL /, "");
}

// ---------- registro de páginas visitadas ----------
const BOT = /bot|crawler|spider|crawling|headless|lighthouse|preview|facebookexternalhit|whatsapp/i;
const recentes = new Map<string, number>();
const vistoEm = new Map<string, number>();
// Troca ids e slugs longos por ":id" para agrupar "/forum/abc-123" com "/forum/xyz-456".
function normalizar(p: string) {
  const limpo = String(p || "/").split(/[?#]/)[0].slice(0, 250).replace(/\/+$/, "") || "/";
  const partes = limpo.split("/").map((s) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^\d+$/.test(s) || s.length > 32 ? ":id" : s));
  // Rotas com id/slug no fim viram uma só (cada tópico do fórum não é uma página diferente).
  const i = ["forum", "users", "q"].includes(partes[1]) ? 2 : partes[2] === "produto" ? 3 : partes[3] === "pix" ? 4 : -1;
  if (i > 0 && partes[i]) partes[i] = ":id";
  return partes.join("/") || "/";
}

// ---------- limpeza ----------
// page_views cresce a cada página aberta: guarda só os últimos 90 dias. Apaga em lotes para não travar a
// tabela, a cada 6 horas (a primeira 2 min depois de subir, para não pesar no boot).
const RETENCAO_DIAS = 90;
let limpezaAgendada = false;
async function limparPageViews() {
  try {
    if (!(await pageViewsExiste())) return;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const r = await pool.query(
        `DELETE FROM page_views WHERE id IN (SELECT id FROM page_views WHERE created_at < now() - interval '${RETENCAO_DIAS} days' LIMIT 20000)`,
      );
      total += r.rowCount || 0;
      if ((r.rowCount || 0) < 20000) break;
    }
    if (total) logger.warn(`[Analytics] limpeza: ${total} páginas vistas com mais de ${RETENCAO_DIAS} dias apagadas`);
  } catch (e: any) {
    logger.error(`[Analytics] limpeza de page_views: ${e?.message}`);
  }
}
function agendarLimpezaPageViews() {
  if (limpezaAgendada) return;
  limpezaAgendada = true;
  setTimeout(() => void limparPageViews(), 2 * 60_000).unref?.();
  setInterval(() => void limparPageViews(), 6 * 60 * 60_000).unref?.();
}

export function registerAdminAnalyticsRoutes(app: Express, opts: { guard?: any[]; auth?: any; cleanup?: boolean } = {}) {
  const G = opts.guard || [authMiddleware, adminMiddleware];
  if (opts.cleanup !== false) agendarLimpezaPageViews();

  app.post("/api/track/pv", opts.auth || optionalAuthMiddleware, async (req: any, res) => {
    res.status(204).end();
    try {
      const ua = String(req.headers["user-agent"] || "");
      if (BOT.test(ua)) return;
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const caminho = normalizar(body.path);
      if (caminho.startsWith("/api")) return;
      const uid = req.user?.id || null;
      const sid = String(body.sid || "").slice(0, 64) || null;
      const chave = `${uid || sid || req.ip}|${caminho}`;
      const agora = Date.now();
      if (agora - (recentes.get(chave) || 0) < 30_000) return; // mesma página em 30s conta uma vez
      recentes.set(chave, agora);
      if (recentes.size > 20_000) recentes.clear();
      if (!(await pageViewsExiste())) return;
      const ref = String(body.ref || "").slice(0, 300) || null;
      await pool.query(
        `INSERT INTO page_views (user_id, session_id, path, referrer, device) VALUES ($1, $2, $3, $4, $5)`,
        [uid, sid, caminho, ref, /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop"],
      );
      if (uid && agora - (vistoEm.get(uid) || 0) > 5 * 60_000) {
        vistoEm.set(uid, agora);
        await pool.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [uid]);
      }
    } catch (e: any) {
      logger.warn(`[Analytics] page view: ${e?.message}`);
    }
  });

  // ---------- Visão geral ----------
  app.get("/api/admin/analytics/v2/overview", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const [pFrom, pTo] = previous(from, to);
      const g = groupOf(req.query.groupBy);
      const ATV = await atividadeSql();
      const pv = await pageViewsExiste();

      const [
        signups, signupsPrev, ativos, ativosPrev, views, viewsPrev, totalUsers, assinantes, novosAssinantes,
        topics, replies, posts, comments, reactions, products, orders, gmv, tickets, ticketsAbertos,
        refClicks, refConv, clonadas, statusRows,
      ] = await Promise.all([
        total("users", "created_at", from, to),
        total("users", "created_at", pFrom, pTo),
        safe(total(ATV, "atv.created_at", from, to, "", "count(DISTINCT atv.user_id)"), 0),
        safe(total(ATV, "atv.created_at", pFrom, pTo, "", "count(DISTINCT atv.user_id)"), 0),
        pv ? total("page_views", "created_at", from, to) : 0,
        pv ? total("page_views", "created_at", pFrom, pTo) : 0,
        q(`SELECT count(*) v FROM users`).then((r) => n(r[0]?.v)),
        q(`SELECT count(*) v FROM users WHERE subscription_status = 'active'`).then((r) => n(r[0]?.v)),
        safe(total("lowfy_subscriptions", "paid_at", from, to, "AND status NOT IN ('awaiting_payment','pending')"), 0),
        total("forum_topics", "created_at", from, to),
        total("forum_replies", "created_at", from, to),
        total("timeline_posts", "created_at", from, to),
        total("post_comments", "created_at", from, to),
        total("post_reactions", "created_at", from, to),
        total("marketplace_products", "created_at", from, to),
        total("marketplace_orders", "paid_at", from, to, "AND status IN ('completed','refund_requested')"),
        total("marketplace_orders", "paid_at", from, to, "AND status IN ('completed','refund_requested')", "COALESCE(sum(COALESCE(gross_amount_cents, amount)),0)"),
        total("support_tickets", "created_at", from, to),
        q(`SELECT count(*) v FROM support_tickets WHERE status IN ('open','in_progress')`).then((r) => n(r[0]?.v)),
        total("referral_clicks", "created_at", from, to),
        total("referral_clicks", "created_at", from, to, "AND converted = true"),
        safe(total("cloned_pages", "created_at", from, to), 0),
        q(`SELECT COALESCE(subscription_status,'none') s, count(*) c FROM users GROUP BY 1 ORDER BY 2 DESC`),
      ]);

      const [sSign, sAtv, sViews, sTopics, sReplies, sPosts, sComments, sReact, sProd, sOrders, sTickets, sRef] = await Promise.all([
        porIntervalo("users", "created_at", g, from, to),
        safe(porIntervalo(ATV, "atv.created_at", g, from, to, "", "count(DISTINCT atv.user_id)"), {}),
        pv ? porIntervalo("page_views", "created_at", g, from, to) : Promise.resolve({}),
        porIntervalo("forum_topics", "created_at", g, from, to),
        porIntervalo("forum_replies", "created_at", g, from, to),
        porIntervalo("timeline_posts", "created_at", g, from, to),
        porIntervalo("post_comments", "created_at", g, from, to),
        porIntervalo("post_reactions", "created_at", g, from, to),
        porIntervalo("marketplace_products", "created_at", g, from, to),
        porIntervalo("marketplace_orders", "paid_at", g, from, to, "AND status IN ('completed','refund_requested')"),
        porIntervalo("support_tickets", "created_at", g, from, to),
        porIntervalo("referral_clicks", "created_at", g, from, to),
      ]);
      const series = buckets(from, to, g).map((date) => ({
        date,
        signups: sSign[date] || 0, active: (sAtv as any)[date] || 0, views: (sViews as any)[date] || 0,
        topics: sTopics[date] || 0, replies: sReplies[date] || 0, posts: sPosts[date] || 0,
        comments: sComments[date] || 0, reactions: sReact[date] || 0, products: sProd[date] || 0,
        orders: sOrders[date] || 0, tickets: sTickets[date] || 0, refClicks: sRef[date] || 0,
      }));

      res.json({
        period: { from, to, groupBy: g, previous: { from: pFrom, to: pTo } },
        tracking: { pageViews: pv },
        kpis: {
          signups, signupsPrev, activeUsers: ativos, activeUsersPrev: ativosPrev, pageViews: views, pageViewsPrev: viewsPrev,
          totalUsers, subscribersActive: assinantes, newSubscribers: novosAssinantes,
          topics, replies, posts, comments, reactions, products, ordersPaid: orders, gmvCents: gmv,
          ticketsOpened: tickets, ticketsOpen: ticketsAbertos, refClicks, refConversions: refConv, clonedPages: clonadas,
        },
        subscriptionStatus: statusRows.map((r: any) => ({ status: r.s, count: n(r.c) })),
        series,
      });
    } catch (e: any) {
      logger.error(`[Analytics] visão geral: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar o analytics" });
    }
  });

  // ---------- Usuários ----------
  app.get("/api/admin/analytics/v2/users", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const pv = await pageViewsExiste();
      const busca = String(req.query.search || "").trim().slice(0, 80);
      const filtro = String(req.query.filter || "all");
      const ordem = String(req.query.sort || "lastSeen");
      const pagina = Math.max(1, Math.min(500, parseInt(req.query.page) || 1));
      const porPagina = 25;

      const where: string[] = [];
      const params: any[] = [from, to];
      if (busca) { params.push(`%${busca}%`); where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
      if (filtro === "new") where.push(RANGE("u.created_at"));
      if (filtro === "subscribers") where.push(`u.subscription_status = 'active'`);
      if (filtro === "inactive") where.push(`COALESCE(u.last_seen_at, ls.last_login) < now() - interval '30 days'`);
      const W = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const ORD = ordem === "signup" ? "created_at DESC NULLS LAST"
        : ordem === "views" ? "views DESC, created_at DESC"
        : ordem === "activity" ? "(topics + replies + posts + comments) DESC, created_at DESC"
        : "last_seen DESC NULLS LAST, created_at DESC";

      // Cada tabela é agregada UMA vez no período e cruzada com os usuários (antes eram 5 subconsultas
      // por usuário, para todos os usuários, antes do LIMIT). Barato para qualquer ordenação.
      const POR = (tabela: string, col: string, extra = "") =>
        `SELECT ${col} AS user_id, count(*) AS c FROM ${tabela} WHERE ${RANGE("created_at")} ${extra} GROUP BY 1`;
      const pvCte = pv ? POR("page_views", "user_id", "AND user_id IS NOT NULL") : `SELECT NULL::varchar AS user_id, 0::bigint AS c WHERE false`;
      const rows = await q(
        `WITH ls AS (SELECT user_id, max(created_at) last_login FROM sessions GROUP BY user_id),
              pv AS (${pvCte}),
              tp AS (${POR("forum_topics", "author_id")}),
              rp AS (${POR("forum_replies", "author_id")}),
              po AS (${POR("timeline_posts", "user_id")}),
              co AS (${POR("post_comments", "user_id")}),
              base AS (
                SELECT u.id, u.name, u.email, u.created_at, u.subscription_status, u.access_plan, u.account_status, u.is_admin,
                       GREATEST(u.last_seen_at, ls.last_login::timestamptz) AS last_seen,
                       COALESCE(pv.c, 0) AS views, COALESCE(tp.c, 0) AS topics, COALESCE(rp.c, 0) AS replies,
                       COALESCE(po.c, 0) AS posts, COALESCE(co.c, 0) AS comments
                FROM users u
                LEFT JOIN ls ON ls.user_id = u.id
                LEFT JOIN pv ON pv.user_id = u.id
                LEFT JOIN tp ON tp.user_id = u.id
                LEFT JOIN rp ON rp.user_id = u.id
                LEFT JOIN po ON po.user_id = u.id
                LEFT JOIN co ON co.user_id = u.id
                ${W}
              )
         SELECT *, count(*) OVER() AS total FROM base
         ORDER BY ${ORD}
         LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
        params,
      );
      res.json({
        page: pagina, perPage: porPagina, total: n(rows[0]?.total),
        users: rows.map((r: any) => ({
          id: r.id, name: r.name, email: r.email, createdAt: r.created_at, lastSeenAt: r.last_seen,
          subscriptionStatus: r.subscription_status, accessPlan: r.access_plan, accountStatus: r.account_status, isAdmin: !!r.is_admin,
          views: n(r.views), topics: n(r.topics), replies: n(r.replies), posts: n(r.posts), comments: n(r.comments),
        })),
      });
    } catch (e: any) {
      logger.error(`[Analytics] usuários: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar os usuários" });
    }
  });

  // Páginas que um usuário abriu (mais recentes primeiro).
  app.get("/api/admin/analytics/v2/users/:id/pages", ...G, async (req: any, res) => {
    try {
      if (!(await pageViewsExiste())) return res.json({ recent: [], top: [] });
      const [from, to] = period(req.query);
      const [recent, top] = await Promise.all([
        q(`SELECT path, device, created_at FROM page_views WHERE user_id = $1 ORDER BY created_at DESC LIMIT 60`, [req.params.id]),
        q(`SELECT path, count(*) c FROM page_views WHERE user_id = $3 AND ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`, [from, to, req.params.id]),
      ]);
      res.json({
        recent: recent.map((r: any) => ({ path: r.path, device: r.device, at: r.created_at })),
        top: top.map((r: any) => ({ path: r.path, views: n(r.c) })),
      });
    } catch (e: any) {
      logger.error(`[Analytics] páginas do usuário: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar as páginas do usuário" });
    }
  });

  // ---------- Páginas visitadas ----------
  app.get("/api/admin/analytics/v2/pages", ...G, async (req: any, res) => {
    try {
      if (!(await pageViewsExiste())) return res.json({ tracking: false, top: [], sections: [], devices: [], hours: [] });
      const [from, to] = period(req.query);
      const [top, sections, devices, hours, visitantes] = await Promise.all([
        q(`SELECT path, count(*) v, count(DISTINCT COALESCE(user_id, session_id)) u FROM page_views WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC LIMIT 40`, [from, to]),
        q(`SELECT COALESCE(NULLIF(split_part(path, '/', 2), ''), 'inicio') s, count(*) v, count(DISTINCT COALESCE(user_id, session_id)) u FROM page_views WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, [from, to]),
        q(`SELECT COALESCE(device,'desktop') d, count(*) v FROM page_views WHERE ${RANGE("created_at")} GROUP BY 1`, [from, to]),
        q(`SELECT extract(hour FROM ${LOCAL("created_at")})::int h, count(*) v FROM page_views WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 1`, [from, to]),
        q(`SELECT count(DISTINCT user_id) logados, count(DISTINCT session_id) FILTER (WHERE user_id IS NULL) anonimos FROM page_views WHERE ${RANGE("created_at")}`, [from, to]),
      ]);
      const porHora = Object.fromEntries(hours.map((r: any) => [r.h, n(r.v)]));
      res.json({
        tracking: true,
        visitors: { loggedIn: n(visitantes[0]?.logados), anonymous: n(visitantes[0]?.anonimos) },
        top: top.map((r: any) => ({ path: r.path, views: n(r.v), visitors: n(r.u) })),
        sections: sections.map((r: any) => ({ section: r.s, views: n(r.v), visitors: n(r.u) })),
        devices: devices.map((r: any) => ({ device: r.d, views: n(r.v) })),
        hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, views: porHora[h] || 0 })),
      });
    } catch (e: any) {
      logger.error(`[Analytics] páginas: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar as páginas" });
    }
  });

  // ---------- Comunidade (fórum + timeline) ----------
  app.get("/api/admin/analytics/v2/community", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const [topTopics, topPosts, contribuidores, denuncias] = await Promise.all([
        q(`SELECT t.id, t.title, t.slug, u.name author,
                  (SELECT count(*) FROM forum_replies r WHERE r.topic_id = t.id AND ${RANGE("r.created_at")}) replies,
                  t.view_count, t.like_count
           FROM forum_topics t LEFT JOIN users u ON u.id = t.author_id
           WHERE ${RANGE("t.created_at")} OR EXISTS (SELECT 1 FROM forum_replies r WHERE r.topic_id = t.id AND ${RANGE("r.created_at")})
           ORDER BY replies DESC, t.view_count DESC LIMIT 10`, [from, to]),
        q(`SELECT p.id, left(p.content, 140) content, u.name author, p.like_count, p.comment_count, p.view_count, p.created_at
           FROM timeline_posts p LEFT JOIN users u ON u.id = p.user_id
           WHERE ${RANGE("p.created_at")} AND COALESCE(p.is_active, true)
           ORDER BY (p.like_count + p.comment_count * 2) DESC LIMIT 10`, [from, to]),
        q(`SELECT u.id, u.name, u.email, sum(c) total,
                  sum(c) FILTER (WHERE k = 'topic') topics, sum(c) FILTER (WHERE k = 'reply') replies,
                  sum(c) FILTER (WHERE k = 'post') posts, sum(c) FILTER (WHERE k = 'comment') comments
           FROM (
             SELECT author_id uid, 'topic' k, count(*) c FROM forum_topics WHERE ${RANGE("created_at")} GROUP BY 1
             UNION ALL SELECT author_id, 'reply', count(*) FROM forum_replies WHERE ${RANGE("created_at")} GROUP BY 1
             UNION ALL SELECT user_id, 'post', count(*) FROM timeline_posts WHERE ${RANGE("created_at")} GROUP BY 1
             UNION ALL SELECT user_id, 'comment', count(*) FROM post_comments WHERE ${RANGE("created_at")} GROUP BY 1
           ) x JOIN users u ON u.id = x.uid
           GROUP BY u.id, u.name, u.email ORDER BY total DESC LIMIT 15`, [from, to]),
        safe(q(`SELECT
                  (SELECT count(*) FROM post_reports WHERE status = 'pending') posts,
                  (SELECT count(*) FROM comment_reports WHERE status = 'pending') comments,
                  (SELECT count(*) FROM forum_topic_reports WHERE status = 'pending') topics,
                  (SELECT count(*) FROM forum_reply_reports WHERE status = 'pending') replies`), [] as any[]),
      ]);
      const d = denuncias[0] || {};
      res.json({
        topTopics: topTopics.map((r: any) => ({ id: r.id, title: r.title, slug: r.slug, author: r.author, replies: n(r.replies), views: n(r.view_count), likes: n(r.like_count) })),
        topPosts: topPosts.map((r: any) => ({ id: r.id, content: r.content, author: r.author, likes: n(r.like_count), comments: n(r.comment_count), views: n(r.view_count), createdAt: r.created_at })),
        contributors: contribuidores.map((r: any) => ({ id: r.id, name: r.name, email: r.email, total: n(r.total), topics: n(r.topics), replies: n(r.replies), posts: n(r.posts), comments: n(r.comments) })),
        pendingReports: { posts: n(d.posts), comments: n(d.comments), topics: n(d.topics), replies: n(d.replies) },
      });
    } catch (e: any) {
      logger.error(`[Analytics] comunidade: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar a comunidade" });
    }
  });

  // ---------- Marketplace ----------
  app.get("/api/admin/analytics/v2/marketplace", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const PAGO = "status IN ('completed','refund_requested')";
      const [topProdutos, topVendedores, status, ativos] = await Promise.all([
        q(`SELECT p.id, p.title, u.name seller, count(o.id) orders, COALESCE(sum(COALESCE(o.gross_amount_cents, o.amount)),0) cents
           FROM marketplace_orders o JOIN marketplace_products p ON p.id = o.product_id LEFT JOIN users u ON u.id = p.seller_id
           WHERE o.${PAGO} AND ${RANGE("o.paid_at")} GROUP BY p.id, p.title, u.name ORDER BY cents DESC LIMIT 10`, [from, to]),
        q(`SELECT u.id, u.name, u.email, count(o.id) orders, COALESCE(sum(COALESCE(o.gross_amount_cents, o.amount)),0) cents, COALESCE(sum(o.net_amount_cents),0) net
           FROM marketplace_orders o JOIN users u ON u.id = o.seller_id
           WHERE o.${PAGO} AND ${RANGE("o.paid_at")} GROUP BY u.id, u.name, u.email ORDER BY cents DESC LIMIT 10`, [from, to]),
        q(`SELECT COALESCE(status,'pending') s, count(*) c, COALESCE(sum(COALESCE(gross_amount_cents, amount)),0) cents FROM marketplace_orders WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
        q(`SELECT count(*) FILTER (WHERE COALESCE(is_active,true) AND NOT COALESCE(is_blocked,false) AND deleted_at IS NULL) ativos,
                  count(*) FILTER (WHERE is_blocked) bloqueados, count(DISTINCT seller_id) vendedores FROM marketplace_products`),
      ]);
      res.json({
        topProducts: topProdutos.map((r: any) => ({ id: r.id, title: r.title, seller: r.seller, orders: n(r.orders), cents: n(r.cents) })),
        topSellers: topVendedores.map((r: any) => ({ id: r.id, name: r.name, email: r.email, orders: n(r.orders), cents: n(r.cents), netCents: n(r.net) })),
        ordersByStatus: status.map((r: any) => ({ status: r.s, count: n(r.c), cents: n(r.cents) })),
        catalog: { active: n(ativos[0]?.ativos), blocked: n(ativos[0]?.bloqueados), sellers: n(ativos[0]?.vendedores) },
      });
    } catch (e: any) {
      logger.error(`[Analytics] marketplace: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar o marketplace" });
    }
  });

  // ---------- Suporte ----------
  app.get("/api/admin/analytics/v2/support", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const [porStatus, porPrioridade, abertos] = await Promise.all([
        q(`SELECT COALESCE(status,'open') s, count(*) c FROM support_tickets WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
        q(`SELECT COALESCE(priority,'normal') p, count(*) c FROM support_tickets WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
        q(`SELECT t.id, t.subject, t.status, t.priority, t.created_at, COALESCE(u.name, t.name) name, COALESCE(u.email, t.email) email
           FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
           WHERE t.status IN ('open','in_progress') ORDER BY t.created_at ASC LIMIT 20`),
      ]);
      res.json({
        byStatus: porStatus.map((r: any) => ({ status: r.s, count: n(r.c) })),
        byPriority: porPrioridade.map((r: any) => ({ priority: r.p, count: n(r.c) })),
        open: abertos.map((r: any) => ({ id: r.id, subject: r.subject, status: r.status, priority: r.priority, createdAt: r.created_at, name: r.name, email: r.email })),
      });
    } catch (e: any) {
      logger.error(`[Analytics] suporte: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar o suporte" });
    }
  });

  // ---------- Indicações ----------
  app.get("/api/admin/analytics/v2/referrals", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const [top, comissoes] = await Promise.all([
        q(`SELECT u.id, u.name, u.email, rc.code,
                  (SELECT count(*) FROM referral_clicks c WHERE c.referral_code_id = rc.id AND ${RANGE("c.created_at")}) clicks,
                  (SELECT count(*) FROM referral_clicks c WHERE c.referral_code_id = rc.id AND c.converted AND ${RANGE("c.created_at")}) conversions,
                  (SELECT COALESCE(sum(commission_amount_cents),0) FROM referral_commissions m WHERE m.referrer_id = u.id AND m.status NOT IN ('canceled','cancelled','refunded') AND ${RANGE("m.created_at")}) cents
           FROM referral_codes rc JOIN users u ON u.id = rc.user_id
           ORDER BY conversions DESC, clicks DESC LIMIT 15`, [from, to]),
        q(`SELECT COALESCE(status,'pending') s, count(*) c, COALESCE(sum(commission_amount_cents),0) cents FROM referral_commissions WHERE ${RANGE("created_at")} GROUP BY 1`, [from, to]),
      ]);
      res.json({
        topReferrers: top.filter((r: any) => n(r.clicks) || n(r.conversions) || n(r.cents))
          .map((r: any) => ({ id: r.id, name: r.name, email: r.email, code: r.code, clicks: n(r.clicks), conversions: n(r.conversions), cents: n(r.cents) })),
        commissionsByStatus: comissoes.map((r: any) => ({ status: r.s === "cancelled" ? "canceled" : r.s, count: n(r.c), cents: n(r.cents) })),
      });
    } catch (e: any) {
      logger.error(`[Analytics] indicações: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar as indicações" });
    }
  });

  // ---------- Criadores: páginas clonadas, presells e quizzes por usuário ----------
  app.get("/api/admin/analytics/v2/creators", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const ini = new Date(`${from}T00:00:00-03:00`).getTime(), fim = new Date(`${to}T23:59:59-03:00`).getTime();
      const noPeriodo = (iso: any) => { const t = new Date(iso || 0).getTime(); return t >= ini && t <= fim; };
      type Linha = { cloned: number; clonedViews: number; presells: number; presellViews: number; quizzes: number; quizViews: number; quizStarts: number; quizCompletions: number; leads: number; newInPeriod: number };
      const porUsuario = new Map<string, Linha>();
      const linha = (uid: string) => {
        if (!porUsuario.has(uid)) porUsuario.set(uid, { cloned: 0, clonedViews: 0, presells: 0, presellViews: 0, quizzes: 0, quizViews: 0, quizStarts: 0, quizCompletions: 0, leads: 0, newInPeriod: 0 });
        return porUsuario.get(uid)!;
      };

      for (const r of await safe(q(`SELECT user_id, count(*) c, COALESCE(sum(view_count),0) v, count(*) FILTER (WHERE ${RANGE("created_at")}) novos FROM cloned_pages WHERE user_id IS NOT NULL GROUP BY 1`, [from, to]), [] as any[])) {
        const l = linha(r.user_id); l.cloned += n(r.c); l.clonedViews += n(r.v); l.newInPeriod += n(r.novos);
      }
      // Presells e quizzes ficam em arquivos com o dono no metadata.
      const lerJson = async (p: string) => { try { return JSON.parse(await fs.promises.readFile(p, "utf-8")); } catch { return null; } };
      const presellDir = path.join(process.cwd(), "presell-pages");
      for (const f of await fs.promises.readdir(presellDir).catch(() => [] as string[])) {
        if (!f.endsWith(".metadata.json")) continue;
        const m = await lerJson(path.join(presellDir, f));
        if (!m?.userId) continue;
        const l = linha(m.userId); l.presells++; l.presellViews += n(m.viewCount); if (noPeriodo(m.createdAt)) l.newInPeriod++;
      }
      const dataRoot = process.env.OBJECT_STORAGE_DIR ? path.dirname(process.env.OBJECT_STORAGE_DIR) : process.cwd();
      const quizDir = path.join(dataRoot, "quizzes");
      for (const f of await fs.promises.readdir(quizDir).catch(() => [] as string[])) {
        if (!f.endsWith(".meta.json")) continue;
        const m = await lerJson(path.join(quizDir, f));
        if (!m?.userId) continue;
        const l = linha(m.userId);
        l.quizzes++; l.quizViews += n(m.views); l.quizStarts += n(m.starts); l.quizCompletions += n(m.completions); l.leads += n(m.leads);
        if (noPeriodo(m.createdAt)) l.newInPeriod++;
      }

      const ids = [...porUsuario.keys()];
      const nomes = ids.length ? await q(`SELECT id, name, email FROM users WHERE id = ANY($1)`, [ids]) : [];
      const quem = new Map(nomes.map((u: any) => [u.id, u]));
      const usuarios = ids.map((id) => ({ id, name: (quem.get(id) as any)?.name || "Usuário removido", email: (quem.get(id) as any)?.email || "", ...porUsuario.get(id)! }))
        .sort((a, b) => b.leads - a.leads || (b.clonedViews + b.presellViews + b.quizViews) - (a.clonedViews + a.presellViews + a.quizViews));
      const soma = (k: keyof Linha) => usuarios.reduce((s, u) => s + (u[k] as number), 0);
      res.json({
        totals: {
          creators: usuarios.length, cloned: soma("cloned"), clonedViews: soma("clonedViews"), presells: soma("presells"), presellViews: soma("presellViews"),
          quizzes: soma("quizzes"), quizViews: soma("quizViews"), quizStarts: soma("quizStarts"), quizCompletions: soma("quizCompletions"), leads: soma("leads"), newInPeriod: soma("newInPeriod"),
        },
        users: usuarios.slice(0, 200),
      });
    } catch (e: any) {
      logger.error(`[Analytics] criadores: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar os criadores" });
    }
  });
}
