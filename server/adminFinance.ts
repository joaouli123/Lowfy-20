import type { Express } from "express";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware } from "./auth";
import { revenue } from "./adminCosts";
import { loadSettings, usdBrl } from "./services/usage";

/**
 * Admin → Financeiro: receita das assinaturas (mesma base do "Consumo e custos"), MRR, novas,
 * cancelamentos, reembolsos, taxa do marketplace, custo de IA e o resultado do período.
 */

const TZ = "America/Sao_Paulo";
const RANGE = (col: string, a = 1, b = 2) =>
  `${col} >= ($${a}::date)::timestamp AT TIME ZONE '${TZ}' AND ${col} < ($${b}::date + 1)::timestamp AT TIME ZONE '${TZ}'`;
const BUCKET = (col: string, g: string) => `to_char(date_trunc('${g}', ${col}::timestamptz AT TIME ZONE '${TZ}'), 'YYYY-MM-DD')`;
const ok = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
function period(q: any): [string, string] {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const from = ok(q.startDate) ? q.startDate : new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return [from, ok(q.endDate) ? q.endDate : hoje];
}
function previous(from: string, to: string): [string, string] {
  const a = new Date(`${from}T12:00:00Z`), b = new Date(`${to}T12:00:00Z`);
  const dias = Math.round((b.getTime() - a.getTime()) / 864e5) + 1;
  return [new Date(a.getTime() - dias * 864e5).toISOString().slice(0, 10), new Date(a.getTime() - 864e5).toISOString().slice(0, 10)];
}
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
const groupOf = (g: any) => (g === "week" || g === "month" ? g : "day");
const n = (v: any) => Number(v) || 0;
const q = async (sql: string, params: any[] = []) => (await pool.query(sql, params)).rows;
const mapa = (rows: any[]) => Object.fromEntries(rows.map((r: any) => [r.k, n(r.v)]));

// Pagamentos confirmados com detalhes (mesma regra do PAGAMENTOS de adminCosts: histórico + 1º pagamento
// que só existe em lowfy_subscriptions, sem contar duas vezes).
const PAGAMENTOS_DET = `(
  SELECT p.user_id, p.amount AS cents, p.paid_at, p.payment_method AS method, s.plan, COALESCE(p.billing_period, 1) AS ciclo
  FROM lowfy_subscription_payments p LEFT JOIN lowfy_subscriptions s ON s.id = p.subscription_id
  WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
  UNION ALL
  SELECT s.user_id, s.amount, s.paid_at, s.payment_method, s.plan, 1
  FROM lowfy_subscriptions s
  WHERE s.paid_at IS NOT NULL AND s.status NOT IN ('awaiting_payment', 'pending')
    AND NOT EXISTS (SELECT 1 FROM lowfy_subscription_payments p WHERE p.subscription_id = s.id AND p.status = 'paid' AND COALESCE(p.billing_period, 1) = 1)
  UNION ALL
  -- pacotes de créditos do Estúdio IA (Pix)
  SELECT c.user_id, c.valor_centavos, c.pago_em, 'pix', 'creditos', 1
  FROM credit_orders c WHERE c.status IN ('pago', 'estornado') AND c.pago_em IS NOT NULL
)`;
const CANCELADA = `status IN ('canceled', 'cancelled', 'expired')`;
const QUANDO_MUDOU = `COALESCE(canceled_at, status_changed_at, updated_at)`;
const PAGO_MKT = `status IN ('completed', 'refund_requested')`;
// Taxa da Lowfy em cada venda; pedidos antigos sem system_fee_cents usam bruto − líquido do vendedor.
const TAXA_MKT = `COALESCE(NULLIF(system_fee_cents, 0), COALESCE(gross_amount_cents, amount) - net_amount_cents, 0)`;

export function registerAdminFinanceRoutes(app: Express, opts: { guard?: any[] } = {}) {
  const G = opts.guard || [authMiddleware, adminMiddleware];

  app.get("/api/admin/finance/v2/overview", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const [pFrom, pTo] = previous(from, to);
      const g = groupOf(req.query.groupBy);
      const settings = await loadSettings();
      const fx = await usdBrl();

      const [
        rev, revPrev, ativas, novas, novasPrev, cancel, cancelPrev, reemb, mkt, mktPrev, ia, iaPrev,
        sReceita, sNovas, sCancel, sReemb, sMkt, porPlano, porMetodo, recentes, renovacoes, pedidosReembolso, pendentes, sCred,
      ] = await Promise.all([
        revenue(from, to, settings.paymentFeePct),
        revenue(pFrom, pTo, settings.paymentFeePct),
        q(`SELECT plan, count(*) c, COALESCE(sum(amount),0) cents FROM lowfy_subscriptions WHERE status = 'active' GROUP BY 1`),
        q(`SELECT count(*) v FROM lowfy_subscriptions WHERE paid_at IS NOT NULL AND status NOT IN ('awaiting_payment','pending') AND ${RANGE("paid_at")}`, [from, to]),
        q(`SELECT count(*) v FROM lowfy_subscriptions WHERE paid_at IS NOT NULL AND status NOT IN ('awaiting_payment','pending') AND ${RANGE("paid_at")}`, [pFrom, pTo]),
        q(`SELECT count(*) v, COALESCE(sum(amount),0) cents FROM lowfy_subscriptions WHERE ${CANCELADA} AND ${RANGE(QUANDO_MUDOU)}`, [from, to]),
        q(`SELECT count(*) v FROM lowfy_subscriptions WHERE ${CANCELADA} AND ${RANGE(QUANDO_MUDOU)}`, [pFrom, pTo]),
        q(`SELECT count(*) v FROM lowfy_subscriptions WHERE status = 'refunded' AND ${RANGE("COALESCE(status_changed_at, updated_at)")}`, [from, to]),
        q(`SELECT count(*) pedidos, COALESCE(sum(COALESCE(gross_amount_cents, amount)),0) gmv, COALESCE(sum(${TAXA_MKT}),0) taxa FROM marketplace_orders WHERE ${PAGO_MKT} AND ${RANGE("paid_at")}`, [from, to]),
        q(`SELECT COALESCE(sum(${TAXA_MKT}),0) taxa FROM marketplace_orders WHERE ${PAGO_MKT} AND ${RANGE("paid_at")}`, [pFrom, pTo]),
        q(`SELECT COALESCE(sum(cost_usd),0) usd FROM ai_usage WHERE ${RANGE("created_at")}`, [from, to]).catch(() => [{ usd: 0 }]),
        q(`SELECT COALESCE(sum(cost_usd),0) usd FROM ai_usage WHERE ${RANGE("created_at")}`, [pFrom, pTo]).catch(() => [{ usd: 0 }]),
        q(`SELECT ${BUCKET("paid_at", g)} k, sum(cents) v FROM ${PAGAMENTOS_DET} x WHERE ${RANGE("paid_at")} GROUP BY 1`, [from, to]),
        q(`SELECT ${BUCKET("paid_at", g)} k, count(*) v FROM lowfy_subscriptions WHERE paid_at IS NOT NULL AND status NOT IN ('awaiting_payment','pending') AND ${RANGE("paid_at")} GROUP BY 1`, [from, to]),
        q(`SELECT ${BUCKET(QUANDO_MUDOU, g)} k, count(*) v FROM lowfy_subscriptions WHERE ${CANCELADA} AND ${RANGE(QUANDO_MUDOU)} GROUP BY 1`, [from, to]),
        q(`SELECT ${BUCKET("COALESCE(status_changed_at, updated_at)", g)} k, sum(amount) v FROM lowfy_subscriptions WHERE status = 'refunded' AND ${RANGE("COALESCE(status_changed_at, updated_at)")} GROUP BY 1`, [from, to]),
        q(`SELECT ${BUCKET("paid_at", g)} k, sum(${TAXA_MKT}) v FROM marketplace_orders WHERE ${PAGO_MKT} AND ${RANGE("paid_at")} GROUP BY 1`, [from, to]),
        q(`SELECT COALESCE(plan,'—') plan, count(*) c, sum(cents) cents FROM ${PAGAMENTOS_DET} x WHERE ${RANGE("paid_at")} GROUP BY 1 ORDER BY 3 DESC`, [from, to]),
        q(`SELECT COALESCE(method,'—') method, count(*) c, sum(cents) cents FROM ${PAGAMENTOS_DET} x WHERE ${RANGE("paid_at")} GROUP BY 1 ORDER BY 3 DESC`, [from, to]),
        q(`SELECT x.cents, x.paid_at, x.method, x.plan, x.ciclo, u.id user_id, u.name, u.email
           FROM ${PAGAMENTOS_DET} x LEFT JOIN users u ON u.id = x.user_id
           WHERE ${RANGE("x.paid_at")} ORDER BY x.paid_at DESC LIMIT 15`, [from, to]),
        q(`SELECT s.id, s.plan, s.amount, s.payment_method, s.next_payment_date, COALESCE(u.name, s.buyer_name) name, COALESCE(u.email, s.buyer_email) email
           FROM lowfy_subscriptions s LEFT JOIN users u ON u.id = s.user_id
           WHERE s.status = 'active' AND s.next_payment_date >= now() AND s.next_payment_date < now() + interval '7 days'
           ORDER BY s.next_payment_date ASC LIMIT 20`),
        q(`SELECT count(*) c, COALESCE(sum(amount_cents),0) cents FROM subscription_refund_requests WHERE status = 'pending'`).catch(() => [{ c: 0, cents: 0 }]),
        q(`SELECT count(*) c, COALESCE(sum(amount),0) cents FROM lowfy_subscriptions WHERE status IN ('awaiting_payment','pending') AND created_at > now() - interval '7 days'`),
        q(`SELECT ${BUCKET("pago_em", g)} k, sum(valor_centavos) v FROM credit_orders WHERE status IN ('pago','estornado') AND ${RANGE("pago_em")} GROUP BY 1`, [from, to]).catch(() => []),
      ]);

      const planos = Object.fromEntries(ativas.map((r: any) => [r.plan || "mensal", { count: n(r.c), cents: n(r.cents) }]));
      const mensal = planos.mensal || { count: 0, cents: 0 };
      const anual = planos.anual || { count: 0, cents: 0 };
      const outros = ativas.filter((r: any) => r.plan !== "mensal" && r.plan !== "anual").reduce((s: number, r: any) => s + n(r.cents), 0);
      const mrrCents = mensal.cents + Math.round(anual.cents / 12) + outros;
      const assinantes = ativas.reduce((s: number, r: any) => s + n(r.c), 0);
      const canceladas = n(cancel[0]?.v);

      const mktTaxa = n(mkt[0]?.taxa) / 100;
      const iaBrl = n(ia[0]?.usd) * fx.rate;
      const resultado = rev.netBrl + mktTaxa - iaBrl;
      const resultadoPrev = revPrev.netBrl + n(mktPrev[0]?.taxa) / 100 - n(iaPrev[0]?.usd) * fx.rate;

      const [mR, mN, mC, mRe, mM, mCr] = [mapa(sReceita), mapa(sNovas), mapa(sCancel), mapa(sReemb), mapa(sMkt), mapa(sCred as any[])];
      const series = buckets(from, to, g).map((date) => ({
        date,
        // revenueBrl = só assinaturas; créditos vêm à parte para empilhar no gráfico
        revenueBrl: ((mR[date] || 0) - (mCr[date] || 0)) / 100, creditsBrl: (mCr[date] || 0) / 100,
        refundsBrl: (mRe[date] || 0) / 100, marketplaceFeeBrl: (mM[date] || 0) / 100,
        newSubs: mN[date] || 0, cancels: mC[date] || 0,
      }));

      res.json({
        period: { from, to, groupBy: g, previous: { from: pFrom, to: pTo } },
        fx,
        revenue: rev,
        revenuePrev: revPrev,
        mrrBrl: mrrCents / 100,
        subscribers: { active: assinantes, monthly: mensal.count, yearly: anual.count },
        newSubs: n(novas[0]?.v), newSubsPrev: n(novasPrev[0]?.v),
        cancels: canceladas, cancelsPrev: n(cancelPrev[0]?.v), lostMrrBrl: n(cancel[0]?.cents) / 100,
        churnPct: assinantes + canceladas ? (canceladas / (assinantes + canceladas)) * 100 : null,
        refundsCount: n(reemb[0]?.v),
        pendingRefunds: { count: n(pedidosReembolso[0]?.c), brl: n(pedidosReembolso[0]?.cents) / 100 },
        awaitingPayment: { count: n(pendentes[0]?.c), brl: n(pendentes[0]?.cents) / 100 },
        marketplace: { orders: n(mkt[0]?.pedidos), gmvBrl: n(mkt[0]?.gmv) / 100, feeBrl: mktTaxa },
        aiCostBrl: iaBrl,
        resultBrl: resultado,
        resultPrevBrl: resultadoPrev,
        series,
        byPlan: porPlano.map((r: any) => ({ plan: r.plan, count: n(r.c), brl: n(r.cents) / 100 })),
        byMethod: porMetodo.map((r: any) => ({ method: r.method, count: n(r.c), brl: n(r.cents) / 100 })),
        recentPayments: recentes.map((r: any) => ({ userId: r.user_id, name: r.name, email: r.email, brl: n(r.cents) / 100, paidAt: r.paid_at, method: r.method, plan: r.plan, renewal: n(r.ciclo) > 1 })),
        upcomingRenewals: renovacoes.map((r: any) => ({ id: r.id, name: r.name, email: r.email, plan: r.plan, brl: n(r.amount) / 100, method: r.payment_method, at: r.next_payment_date })),
      });
    } catch (e: any) {
      logger.error(`[Financeiro] visão geral: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar o financeiro" });
    }
  });
}
