import type { Express } from "express";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware } from "./auth";
import { sendEmail } from "./email";

/**
 * Reembolso de assinatura: estorno no gateway (Asaas ou Podpay) e a tela do admin.
 *
 * Regras do produto: ao pedir reembolso o cliente perde o acesso na hora (rota do usuário em routes.ts).
 * Daqui o admin estorna no gateway, marca como devolvido por fora, ou recusa — e recusar devolve o acesso.
 */

const TZ = "America/Sao_Paulo";
const RANGE = (col: string, a = 1, b = 2) =>
  `${col} >= ($${a}::date)::timestamp AT TIME ZONE '${TZ}' AND ${col} < ($${b}::date + 1)::timestamp AT TIME ZONE '${TZ}'`;
const ok = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
function period(q: any): [string, string] {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const from = ok(q.startDate) ? q.startDate : new Date(Date.now() - 90 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return [from, ok(q.endDate) ? q.endDate : hoje];
}
const n = (v: any) => Number(v) || 0;
const q = async (sql: string, params: any[] = []) => (await pool.query(sql, params)).rows;

type Assinatura = { id: string; provider: string | null; provider_transaction_id: string | null; provider_subscription_id: string | null; payment_method: string | null };

/** Onde dá para estornar automaticamente; null = só manual. */
export function gatewayDoEstorno(s: Assinatura): "asaas" | "podpay" | null {
  if (s.provider === "asaas" && (s.provider_transaction_id || s.provider_subscription_id)) return "asaas";
  if (s.provider === "podpay" && s.provider_transaction_id) return "podpay";
  return null;
}

/**
 * Estorna o valor integral do último pagamento da assinatura no gateway.
 * No Asaas o estorno é por cobrança (pay_...): se só houver o id da assinatura (sub_...), usa a última cobrança paga.
 * Sem valor = estorno integral (o Asaas espera reais, nunca centavos).
 */
export async function estornarNoGateway(s: Assinatura): Promise<{ ok: boolean; via: "asaas" | "podpay" | null; detalhe: string }> {
  const via = gatewayDoEstorno(s);
  if (!via) return { ok: false, via: null, detalhe: "Pagamento sem referência no Asaas ou na Podpay: devolva por fora e marque como devolvido." };
  try {
    if (via === "asaas") {
      const asaas = await import("./services/asaas");
      let pagamento = s.provider_transaction_id && !s.provider_transaction_id.startsWith("sub_") ? s.provider_transaction_id : null;
      if (!pagamento) {
        const assinaturaId = s.provider_subscription_id || s.provider_transaction_id!;
        const lista: any = await asaas.listSubscriptionPayments(assinaturaId, { limit: 20 });
        const pagos = (lista?.data || []).filter((p: any) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status));
        pagos.sort((a: any, b: any) => String(b.paymentDate || b.confirmedDate || b.dateCreated).localeCompare(String(a.paymentDate || a.confirmedDate || a.dateCreated)));
        pagamento = pagos[0]?.id || null;
        if (!pagamento) return { ok: false, via, detalhe: "Nenhuma cobrança paga encontrada nessa assinatura do Asaas." };
      }
      const r: any = await asaas.refundPayment(pagamento, undefined, "Reembolso de assinatura Lowfy");
      return { ok: true, via, detalhe: `Asaas: cobrança ${pagamento} ${r?.status === "REFUNDED" ? "estornada" : "com estorno solicitado"}.` };
    }
    const { getPodpayServiceSafe } = await import("./services/podpay");
    const podpay = getPodpayServiceSafe();
    if (!podpay) return { ok: false, via, detalhe: "Podpay não configurada no servidor." };
    await podpay.refundTransaction(s.provider_transaction_id!);
    return { ok: true, via, detalhe: `Podpay: transação ${s.provider_transaction_id} estornada.` };
  } catch (e: any) {
    logger.error(`[Reembolso] estorno no gateway falhou: ${e?.message}`);
    return { ok: false, via, detalhe: String(e?.message || "O gateway recusou o estorno.") };
  }
}

async function avisarCliente(sub: any, valorCents: number, metodo: string) {
  try {
    const { generateRefundCompletedEmail } = await import("./email");
    await sendEmail({
      to: sub.buyer_email,
      subject: "💸 Reembolso Processado - Lowfy",
      html: generateRefundCompletedEmail(sub.buyer_name, valorCents / 100, metodo || "unknown"),
    });
  } catch (e: any) {
    logger.error(`[Reembolso] e-mail de reembolso concluído: ${e?.message}`);
  }
}

async function carregar(id: string) {
  const [r] = await q(
    `SELECT r.*, s.id sub_id, s.provider, s.provider_transaction_id, s.provider_subscription_id, s.payment_method sub_method, s.status sub_status,
            s.buyer_name, s.buyer_email, s.user_id sub_user, s.paid_at
     FROM subscription_refund_requests r JOIN lowfy_subscriptions s ON s.id = r.subscription_id WHERE r.id = $1`, [id]);
  return r;
}

export function registerSubscriptionRefundRoutes(app: Express, opts: { guard?: any[]; estornar?: typeof estornarNoGateway } = {}) {
  const G = opts.guard || [authMiddleware, adminMiddleware];
  const estornar = opts.estornar || estornarNoGateway;

  app.get("/api/admin/refunds/v2", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const status = String(req.query.status || "all");
      const params: any[] = [from, to];
      const filtro = status === "open" ? `AND r.status IN ('pending','processing')` : ["pending", "processing", "completed", "rejected"].includes(status) ? `AND r.status = '${status}'` : "";

      const [kpi, abertos, linhas] = await Promise.all([
        q(`SELECT count(*) pedidos, COALESCE(sum(amount_cents),0) pedidos_cents,
                  count(*) FILTER (WHERE status = 'completed') feitos, COALESCE(sum(amount_cents) FILTER (WHERE status = 'completed'),0) feitos_cents,
                  count(*) FILTER (WHERE status = 'rejected') recusados,
                  count(*) FILTER (WHERE status = 'completed' AND refunded_via_provider) pelo_gateway,
                  avg(extract(epoch FROM (processed_at - created_at)) / 3600) FILTER (WHERE processed_at IS NOT NULL) horas
           FROM subscription_refund_requests WHERE ${RANGE("created_at")}`, params),
        q(`SELECT count(*) c, COALESCE(sum(amount_cents),0) cents, min(created_at) mais_antigo FROM subscription_refund_requests WHERE status IN ('pending','processing')`),
        q(`SELECT r.id, r.amount_cents, r.payment_method, r.status, r.reason, r.admin_notes, r.created_at, r.processed_at, r.refunded_via_provider,
                  s.plan, s.provider, s.provider_transaction_id, s.provider_subscription_id, s.status sub_status, s.paid_at,
                  COALESCE(u.name, s.buyer_name) nome, COALESCE(u.email, s.buyer_email) email, a.name admin
           FROM subscription_refund_requests r
           JOIN lowfy_subscriptions s ON s.id = r.subscription_id
           LEFT JOIN users u ON u.id = r.user_id
           LEFT JOIN users a ON a.id = r.processed_by
           WHERE (${RANGE("r.created_at")} OR r.status IN ('pending','processing')) ${filtro}
           ORDER BY (r.status IN ('pending','processing')) DESC, r.created_at DESC LIMIT 200`, params),
      ]);
      const k = kpi[0] || {};
      res.json({
        period: { from, to },
        kpis: {
          requested: n(k.pedidos), requestedBrl: n(k.pedidos_cents) / 100,
          completed: n(k.feitos), completedBrl: n(k.feitos_cents) / 100, viaGateway: n(k.pelo_gateway),
          rejected: n(k.recusados), avgHours: k.horas == null ? null : n(k.horas),
          open: n(abertos[0]?.c), openBrl: n(abertos[0]?.cents) / 100, oldestOpenAt: abertos[0]?.mais_antigo || null,
        },
        requests: linhas.map((r: any) => ({
          id: r.id, name: r.nome, email: r.email, plan: r.plan, method: r.payment_method, brl: n(r.amount_cents) / 100,
          status: r.status, reason: r.reason, adminNotes: r.admin_notes, createdAt: r.created_at, processedAt: r.processed_at,
          processedBy: r.admin, viaGateway: !!r.refunded_via_provider, subscriptionStatus: r.sub_status,
          daysAfterPayment: r.paid_at ? Math.max(0, Math.floor((new Date(r.created_at).getTime() - new Date(r.paid_at).getTime()) / 864e5)) : null,
          gateway: gatewayDoEstorno({ id: "", provider: r.provider, provider_transaction_id: r.provider_transaction_id, provider_subscription_id: r.provider_subscription_id, payment_method: r.payment_method }),
        })),
      });
    } catch (e: any) {
      logger.error(`[Reembolso] lista: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar os reembolsos" });
    }
  });

  // Estorna no Asaas/Podpay e conclui.
  app.post("/api/admin/refunds/v2/:id/gateway", ...G, async (req: any, res) => {
    try {
      const r = await carregar(req.params.id);
      if (!r) return res.status(404).json({ message: "Pedido não encontrado." });
      if (r.status === "completed") return res.status(409).json({ message: "Esse reembolso já foi concluído." });
      await pool.query(`UPDATE subscription_refund_requests SET status = 'processing', updated_at = now() WHERE id = $1`, [r.id]);
      const est = await estornar({ id: r.sub_id, provider: r.provider, provider_transaction_id: r.provider_transaction_id, provider_subscription_id: r.provider_subscription_id, payment_method: r.sub_method });
      const nota = [r.admin_notes, `${new Date().toLocaleString("pt-BR", { timeZone: TZ })}: ${est.detalhe}`].filter(Boolean).join("\n");
      if (!est.ok) {
        await pool.query(`UPDATE subscription_refund_requests SET admin_notes = $2, updated_at = now() WHERE id = $1`, [r.id, nota]);
        return res.status(502).json({ message: est.detalhe });
      }
      await pool.query(
        `UPDATE subscription_refund_requests SET status = 'completed', refunded_via_provider = true, processed_at = now(), processed_by = $2, admin_notes = $3, updated_at = now() WHERE id = $1`,
        [r.id, req.user?.id || null, nota]);
      await pool.query(`UPDATE lowfy_subscriptions SET status = 'refunded', status_changed_at = now(), updated_at = now() WHERE id = $1`, [r.sub_id]);
      if (r.sub_user) await pool.query(`UPDATE users SET subscription_status = 'refunded', updated_at = now() WHERE id = $1`, [r.sub_user]);
      await avisarCliente(r, n(r.amount_cents), r.payment_method);
      logger.info(`[Reembolso] ${r.id} estornado via ${est.via} pelo admin ${req.user?.id}`);
      res.json({ ok: true, detail: est.detalhe });
    } catch (e: any) {
      logger.error(`[Reembolso] estornar: ${e?.message}`);
      res.status(500).json({ message: "Não deu para estornar agora." });
    }
  });

  // Devolvido por fora (Pix manual, gateway fora do ar etc.): só registra.
  app.post("/api/admin/refunds/v2/:id/manual", ...G, async (req: any, res) => {
    try {
      const r = await carregar(req.params.id);
      if (!r) return res.status(404).json({ message: "Pedido não encontrado." });
      if (r.status === "completed") return res.status(409).json({ message: "Esse reembolso já foi concluído." });
      const notas = String(req.body?.notes || "").trim().slice(0, 1000);
      await pool.query(
        `UPDATE subscription_refund_requests SET status = 'completed', refunded_via_provider = false, processed_at = now(), processed_by = $2,
           admin_notes = NULLIF(concat_ws(E'\\n', admin_notes, NULLIF($3::text, '')), ''), updated_at = now() WHERE id = $1`,
        [r.id, req.user?.id || null, notas ? `Devolvido por fora: ${notas}` : "Devolvido por fora"]);
      await pool.query(`UPDATE lowfy_subscriptions SET status = 'refunded', status_changed_at = now(), updated_at = now() WHERE id = $1`, [r.sub_id]);
      if (r.sub_user) await pool.query(`UPDATE users SET subscription_status = 'refunded', updated_at = now() WHERE id = $1`, [r.sub_user]);
      await avisarCliente(r, n(r.amount_cents), r.payment_method);
      res.json({ ok: true });
    } catch (e: any) {
      logger.error(`[Reembolso] manual: ${e?.message}`);
      res.status(500).json({ message: "Não deu para registrar." });
    }
  });

  // Recusar: o cliente perdeu o acesso ao pedir, então recusar devolve o acesso.
  app.post("/api/admin/refunds/v2/:id/reject", ...G, async (req: any, res) => {
    try {
      const r = await carregar(req.params.id);
      if (!r) return res.status(404).json({ message: "Pedido não encontrado." });
      if (r.status === "completed") return res.status(409).json({ message: "Esse reembolso já foi concluído; não dá para recusar." });
      const motivo = String(req.body?.notes || "").trim().slice(0, 1000);
      if (motivo.length < 3) return res.status(400).json({ message: "Escreva o motivo da recusa." });
      await pool.query(
        `UPDATE subscription_refund_requests SET status = 'rejected', processed_at = now(), processed_by = $2,
           admin_notes = NULLIF(concat_ws(E'\\n', admin_notes, $3::text), ''), updated_at = now() WHERE id = $1`,
        [r.id, req.user?.id || null, `Recusado: ${motivo}`]);
      let acessoDevolvido = false;
      // Só devolve se a assinatura não tiver outro reembolso já concluído (aí o dinheiro já voltou).
      const [jaReembolsada] = await q(`SELECT 1 FROM subscription_refund_requests WHERE subscription_id = $1 AND status = 'completed' AND id <> $2 LIMIT 1`, [r.sub_id, r.id]);
      if (r.sub_status === "refunded" && r.paid_at && !jaReembolsada) {
        await pool.query(`UPDATE lowfy_subscriptions SET status = 'active', status_changed_at = now(), updated_at = now() WHERE id = $1`, [r.sub_id]);
        if (r.sub_user) await pool.query(`UPDATE users SET subscription_status = 'active', updated_at = now() WHERE id = $1`, [r.sub_user]);
        acessoDevolvido = true;
      }
      res.json({ ok: true, accessRestored: acessoDevolvido });
    } catch (e: any) {
      logger.error(`[Reembolso] recusar: ${e?.message}`);
      res.status(500).json({ message: "Não deu para recusar." });
    }
  });
}
