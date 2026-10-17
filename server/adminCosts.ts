import type { Express } from "express";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware } from "./auth";
import { loadSettings, saveSettings, usdBrl, DEFAULT_PRICES, type CostSettings } from "./services/usage";

/**
 * Admin → Consumo e custos: quanto cada IA custou (plataforma e por usuário), quanto entrou de
 * assinatura no mesmo período e a margem. Custos de IA são estimativas a partir do consumo
 * registrado em ai_usage; os saldos reais vêm das APIs de cada provedor.
 */

const TZ = "America/Sao_Paulo";
// Período em datas de São Paulo: [início do dia "from", início do dia seguinte a "to").
const RANGE = (col: string, a = 1, b = 2) =>
  `${col} >= ($${a}::date)::timestamp AT TIME ZONE '${TZ}' AND ${col} < ($${b}::date + 1)::timestamp AT TIME ZONE '${TZ}'`;

function period(q: any): [string, string] {
  const ok = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const from = ok(q.startDate) ? q.startDate : new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return [from, ok(q.endDate) ? q.endDate : today];
}
// Pagamentos confirmados: o histórico (lowfy_subscription_payments) mais o 1º pagamento de cada
// assinatura, que muitas vezes só existe em lowfy_subscriptions.paid_at (sem contar duas vezes).
const PAGAMENTOS = `(
  SELECT p.user_id, p.amount AS cents, p.paid_at FROM lowfy_subscription_payments p WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
  UNION ALL
  SELECT s.user_id, s.amount, s.paid_at FROM lowfy_subscriptions s
  WHERE s.paid_at IS NOT NULL AND s.status NOT IN ('awaiting_payment', 'pending')
    AND NOT EXISTS (SELECT 1 FROM lowfy_subscription_payments p WHERE p.subscription_id = s.id AND p.status = 'paid' AND COALESCE(p.billing_period, 1) = 1)
)`;

const groupOf = (g: any) => (g === "week" || g === "month" ? g : "day");
const n = (v: any) => Number(v) || 0;

// ---------- Saldos nos provedores (cache curto) ----------
let balCache: { at: number; data: any } = { at: 0, data: null };
async function balances() {
  if (balCache.data && Date.now() - balCache.at < 120_000) return balCache.data;
  const out: any = {};
  const jobs: Promise<void>[] = [];
  if (process.env.KIE_API_KEY) {
    jobs.push((async () => {
      try {
        const r = await fetch("https://api.kie.ai/api/v1/chat/credit", { headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` }, signal: AbortSignal.timeout(8000) });
        const j: any = await r.json();
        const credits = n(j?.data);
        out.kie = { credits, usd: credits * (await loadSettings()).prices.kieCredit };
      } catch (e: any) { out.kie = { error: e?.message || "sem resposta" }; }
    })());
  }
  if (process.env.ELEVENLABS_API_KEY) {
    jobs.push((async () => {
      try {
        const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, signal: AbortSignal.timeout(8000) });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.detail?.message || `HTTP ${r.status}`);
        out.elevenlabs = { tier: j.tier, used: n(j.character_count), limit: n(j.character_limit), resetAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null };
      } catch (e: any) { out.elevenlabs = { error: e?.message || "sem resposta" }; }
    })());
  }
  // Gasto real da OpenAI no mês corrente: precisa de uma chave de administrador (opcional).
  if (process.env.OPENAI_ADMIN_KEY) {
    jobs.push((async () => {
      try {
        const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
        let page: string | undefined, usd = 0, guard = 0;
        do {
          const u = new URL("https://api.openai.com/v1/organization/costs");
          u.searchParams.set("start_time", String(Math.floor(start.getTime() / 1000)));
          u.searchParams.set("bucket_width", "1d");
          u.searchParams.set("limit", "31");
          if (page) u.searchParams.set("page", page);
          const r = await fetch(u, { headers: { Authorization: `Bearer ${process.env.OPENAI_ADMIN_KEY}` }, signal: AbortSignal.timeout(10000) });
          const j: any = await r.json();
          if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
          for (const b of j.data || []) for (const res of b.results || []) usd += n(res?.amount?.value);
          page = j.has_more ? j.next_page : undefined;
        } while (page && ++guard < 5);
        out.openaiMonth = { usd };
      } catch (e: any) { out.openaiMonth = { error: e?.message || "sem resposta" }; }
    })());
  }
  await Promise.all(jobs);
  balCache = { at: Date.now(), data: out };
  return out;
}

async function revenue(from: string, to: string, feePct: number) {
  const [pay, ref, com] = await Promise.all([
    pool.query(`SELECT COALESCE(SUM(cents),0) AS cents, COUNT(*) AS qtd, COUNT(DISTINCT user_id) AS pagantes FROM ${PAGAMENTOS} x WHERE ${RANGE("paid_at")}`, [from, to]),
    pool.query(`SELECT COALESCE(SUM(amount),0) AS cents, COUNT(*) AS qtd FROM lowfy_subscriptions WHERE status = 'refunded' AND ${RANGE("COALESCE(status_changed_at, updated_at)")}`, [from, to]),
    pool.query(`SELECT COALESCE(SUM(commission_amount_cents),0) AS cents FROM referral_commissions WHERE status NOT IN ('canceled','refunded') AND ${RANGE("created_at")}`, [from, to]).catch(() => ({ rows: [{ cents: 0 }] })),
  ]);
  const gross = n(pay.rows[0].cents) / 100;
  const refunds = n(ref.rows[0].cents) / 100;
  const fees = gross * (feePct / 100);
  const commissions = n(com.rows[0].cents) / 100;
  return { grossBrl: gross, refundsBrl: refunds, feesBrl: fees, commissionsBrl: commissions, netBrl: gross - refunds - fees - commissions, payments: n(pay.rows[0].qtd), payingUsers: n(pay.rows[0].pagantes) };
}

export function registerAdminCostRoutes(app: Express) {
  app.get("/api/admin/costs/overview", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const g = groupOf(req.query.groupBy);
      const s = await loadSettings();
      const fx = await usdBrl();
      const [tot, byProv, byTool, byKind, series, rev, top, revSeries, bal] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(cost_usd),0) AS usd, COUNT(*) AS ev, COUNT(DISTINCT user_id) AS users FROM ai_usage WHERE ${RANGE("created_at")}`, [from, to]),
        pool.query(`SELECT provider, SUM(cost_usd) AS usd, COUNT(*) AS ev FROM ai_usage WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
        pool.query(`SELECT tool, SUM(cost_usd) AS usd, COUNT(*) AS ev, COUNT(DISTINCT user_id) AS users FROM ai_usage WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC LIMIT 30`, [from, to]),
        pool.query(`SELECT kind, SUM(cost_usd) AS usd, COUNT(*) AS ev FROM ai_usage WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to]),
        pool.query(`SELECT to_char(date_trunc('${g}', created_at AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS d, SUM(cost_usd) AS usd, COUNT(*) AS ev FROM ai_usage WHERE ${RANGE("created_at")} GROUP BY 1 ORDER BY 1`, [from, to]),
        revenue(from, to, s.paymentFeePct),
        pool.query(`SELECT a.user_id AS id, u.name, u.email, SUM(a.cost_usd) AS usd, COUNT(*) AS ev FROM ai_usage a LEFT JOIN users u ON u.id = a.user_id WHERE ${RANGE("a.created_at")} AND a.user_id IS NOT NULL GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 10`, [from, to]),
        pool.query(`SELECT to_char(date_trunc('${g}', paid_at AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS d, SUM(cents) AS cents FROM ${PAGAMENTOS} x WHERE ${RANGE("paid_at")} GROUP BY 1`, [from, to]),
        balances(),
      ]);
      const usd = n(tot.rows[0].usd);
      const costBrl = usd * fx.rate;
      const revMap = new Map(revSeries.rows.map((r: any) => [r.d, n(r.cents) / 100]));
      const days = new Set([...series.rows.map((r: any) => r.d), ...revMap.keys()]);
      const costMap = new Map(series.rows.map((r: any) => [r.d, r]));
      res.json({
        period: { from, to, groupBy: g },
        fx,
        totals: { costUsd: usd, costBrl, events: n(tot.rows[0].ev), users: n(tot.rows[0].users) },
        revenue: rev,
        profitBrl: rev.netBrl - costBrl,
        marginPct: rev.netBrl > 0 ? ((rev.netBrl - costBrl) / rev.netBrl) * 100 : null,
        costPerPayingUserBrl: rev.payingUsers ? costBrl / rev.payingUsers : null,
        byProvider: byProv.rows.map((r: any) => ({ provider: r.provider, costUsd: n(r.usd), events: n(r.ev) })),
        byTool: byTool.rows.map((r: any) => ({ tool: r.tool, costUsd: n(r.usd), events: n(r.ev), users: n(r.users), avgUsd: n(r.ev) ? n(r.usd) / n(r.ev) : 0 })),
        byKind: byKind.rows.map((r: any) => ({ kind: r.kind, costUsd: n(r.usd), events: n(r.ev) })),
        series: [...days].sort().map((d) => ({ date: d, costBrl: n((costMap.get(d) as any)?.usd) * fx.rate, revenueBrl: revMap.get(d) || 0, events: n((costMap.get(d) as any)?.ev) })),
        topUsers: top.rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, costUsd: n(r.usd), events: n(r.ev), alert: n(r.usd) >= s.alertUserUsd })),
        balances: bal,
        settings: { preferProvider: s.preferProvider, alertUserUsd: s.alertUserUsd, paymentFeePct: s.paymentFeePct, iaAcesso: s.iaAcesso },
      });
    } catch (e: any) {
      logger.error("[Admin Custos] visão geral:", e?.message);
      res.status(500).json({ message: e?.message?.includes("ai_usage") ? "A tabela de consumo ainda não foi criada (migração 0018)." : "Erro ao carregar o consumo" });
    }
  });

  app.get("/api/admin/costs/users", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const s = await loadSettings();
      const fx = await usdBrl();
      const q = String(req.query.search || "").trim().slice(0, 80);
      const params: any[] = [from, to];
      let filtro = "";
      if (q) { params.push(`%${q}%`); filtro = `AND (u.name ILIKE $3 OR u.email ILIKE $3)`; }
      const r = await pool.query(
        `WITH uso AS (
           SELECT user_id, SUM(cost_usd) AS usd, COUNT(*) AS ev, MAX(created_at) AS ultimo FROM ai_usage WHERE ${RANGE("created_at")} AND user_id IS NOT NULL GROUP BY 1
         ), pago AS (
           SELECT user_id, SUM(cents) AS cents FROM ${PAGAMENTOS} x WHERE ${RANGE("paid_at")} AND user_id IS NOT NULL GROUP BY 1
         )
         SELECT u.id, u.name, u.email, u.subscription_status AS status, u.access_plan AS plan,
                COALESCE(uso.usd,0) AS usd, COALESCE(uso.ev,0) AS ev, uso.ultimo, COALESCE(pago.cents,0) AS cents
         FROM users u
         LEFT JOIN uso ON uso.user_id = u.id
         LEFT JOIN pago ON pago.user_id = u.id
         WHERE (uso.user_id IS NOT NULL OR pago.user_id IS NOT NULL) ${filtro}
         ORDER BY usd DESC, cents DESC
         LIMIT 300`,
        params,
      );
      res.json({
        fx,
        alertUserUsd: s.alertUserUsd,
        users: r.rows.map((x: any) => {
          const costBrl = n(x.usd) * fx.rate;
          const revenueBrl = n(x.cents) / 100;
          return { id: x.id, name: x.name, email: x.email, status: x.status, plan: x.plan, events: n(x.ev), lastAt: x.ultimo, costUsd: n(x.usd), costBrl, revenueBrl, resultBrl: revenueBrl - costBrl, alert: n(x.usd) >= s.alertUserUsd };
        }),
      });
    } catch (e: any) {
      logger.error("[Admin Custos] usuários:", e?.message);
      res.status(500).json({ message: "Erro ao carregar o consumo por usuário" });
    }
  });

  app.get("/api/admin/costs/users/:id", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const fx = await usdBrl();
      const id = String(req.params.id);
      const [u, tools, events] = await Promise.all([
        pool.query(`SELECT id, name, email, subscription_status AS status, access_plan AS plan, created_at FROM users WHERE id = $1`, [id]),
        pool.query(`SELECT tool, SUM(cost_usd) AS usd, COUNT(*) AS ev FROM ai_usage WHERE user_id = $3 AND ${RANGE("created_at")} GROUP BY 1 ORDER BY 2 DESC`, [from, to, id]),
        pool.query(`SELECT created_at, tool, provider, model, kind, units, unit, cost_usd FROM ai_usage WHERE user_id = $3 AND ${RANGE("created_at")} ORDER BY created_at DESC LIMIT 100`, [from, to, id]),
      ]);
      if (!u.rows[0]) return res.status(404).json({ message: "Usuário não encontrado" });
      res.json({
        fx,
        user: u.rows[0],
        byTool: tools.rows.map((r: any) => ({ tool: r.tool, costUsd: n(r.usd), events: n(r.ev) })),
        events: events.rows.map((r: any) => ({ at: r.created_at, tool: r.tool, provider: r.provider, model: r.model, kind: r.kind, units: n(r.units), unit: r.unit, costUsd: n(r.cost_usd) })),
      });
    } catch (e: any) {
      logger.error("[Admin Custos] usuário:", e?.message);
      res.status(500).json({ message: "Erro ao carregar o usuário" });
    }
  });

  app.get("/api/admin/costs/settings", authMiddleware, adminMiddleware, async (_req, res) => {
    res.json({ settings: await loadSettings(true), defaults: DEFAULT_PRICES, fx: await usdBrl(), hasOpenAIAdmin: !!process.env.OPENAI_ADMIN_KEY });
  });

  app.put("/api/admin/costs/settings", authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const b = req.body || {};
      const patch: Partial<CostSettings> = {};
      if (b.preferProvider === "openai" || b.preferProvider === "kie") patch.preferProvider = b.preferProvider;
      if (b.iaAcesso === "admin" || b.iaAcesso === "assinantes") patch.iaAcesso = b.iaAcesso;
      if (b.usdBrl === null || b.usdBrl === "") patch.usdBrl = null;
      else if (n(b.usdBrl) > 1 && n(b.usdBrl) < 20) patch.usdBrl = n(b.usdBrl);
      if (n(b.paymentFeePct) >= 0 && n(b.paymentFeePct) <= 30 && b.paymentFeePct != null) patch.paymentFeePct = n(b.paymentFeePct);
      if (n(b.alertUserUsd) > 0) patch.alertUserUsd = n(b.alertUserUsd);
      if (b.prices && typeof b.prices === "object") {
        const p = b.prices;
        const pos = (v: any) => (n(v) >= 0 && n(v) < 1000 ? n(v) : undefined);
        const tokens: Record<string, [number, number]> = {};
        for (const [k, v] of Object.entries(p.tokens || {})) {
          if (/^[a-z0-9.-]{2,40}$/i.test(k) && Array.isArray(v) && v.length === 2) tokens[k] = [pos(v[0]) ?? 0, pos(v[1]) ?? 0];
        }
        const qual: Record<string, number> = {};
        for (const [k, v] of Object.entries(p.imagePerQuality || {})) if (["low", "medium", "high", "auto"].includes(k) && pos(v) != null) qual[k] = pos(v)!;
        patch.prices = {
          ...DEFAULT_PRICES,
          ...(pos(p.kieCredit) != null ? { kieCredit: pos(p.kieCredit)! } : {}),
          ...(pos(p.eleven1kChars) != null ? { eleven1kChars: pos(p.eleven1kChars)! } : {}),
          ...(pos(p.imageInput1M) != null ? { imageInput1M: pos(p.imageInput1M)! } : {}),
          tokens: { ...DEFAULT_PRICES.tokens, ...tokens },
          imagePerQuality: { ...DEFAULT_PRICES.imagePerQuality, ...qual },
        };
      }
      balCache.at = 0;
      res.json({ settings: await saveSettings(patch) });
    } catch (e: any) {
      logger.error("[Admin Custos] configurações:", e?.message);
      res.status(500).json({ message: "Erro ao salvar" });
    }
  });
}
