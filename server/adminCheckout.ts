import type { Express } from "express";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware } from "./auth";
import { sendEmail } from "./email";
import { getCheckoutUrl } from "@shared/domainConfig";

/**
 * Admin → Checkout abandonado: quem começou a assinar e não pagou, o que a recuperação automática
 * (e-mail e WhatsApp) já mandou, quem voltou e pagou, e envio manual de mensagem pelo admin.
 */

const TZ = "America/Sao_Paulo";
const RANGE = (col: string, a = 1, b = 2) =>
  `${col} >= ($${a}::date)::timestamp AT TIME ZONE '${TZ}' AND ${col} < ($${b}::date + 1)::timestamp AT TIME ZONE '${TZ}'`;
const BUCKET = (col: string) => `to_char(date_trunc('day', ${col}::timestamptz AT TIME ZONE '${TZ}'), 'YYYY-MM-DD')`;
const ok = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
function period(q: any): [string, string] {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const from = ok(q.startDate) ? q.startDate : new Date(Date.now() - 30 * 864e5).toLocaleDateString("en-CA", { timeZone: TZ });
  return [from, ok(q.endDate) ? q.endDate : hoje];
}
const n = (v: any) => Number(v) || 0;
const q = async (sql: string, params: any[] = []) => (await pool.query(sql, params)).rows;

const ABERTO = `s.status IN ('pending', 'awaiting_payment')`;
// Recuperado: recebeu alguma mensagem de recuperação e depois pagou.
const CONTATADO = `(EXISTS (SELECT 1 FROM checkout_recovery_emails e WHERE e.subscription_id = s.id AND e.sent_at IS NOT NULL)
  OR EXISTS (SELECT 1 FROM checkout_recovery_whatsapp w WHERE w.subscription_id = s.id AND w.sent_at IS NOT NULL))`;
const PAGO = `s.paid_at IS NOT NULL AND s.status NOT IN ('pending', 'awaiting_payment')`;
const RECUPERADO = `(${PAGO} AND ${CONTATADO})`;

const linkCheckout = (plan: string, id: string) =>
  getCheckoutUrl(`/assinatura/checkout?${new URLSearchParams({ plan: plan || "mensal", recoveryId: id }).toString()}`);
const soDigitos = (t: string) => String(t || "").replace(/\D/g, "");
const telefoneWhats = (t: string) => { const d = soDigitos(t); return d.startsWith("55") ? d : `55${d}`; };
const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Zap = { isConnected(): boolean; sendMessage(phone: string, msg: string): Promise<boolean> };

export function registerAdminCheckoutRoutes(app: Express, opts: { guard?: any[]; whatsapp?: Zap } = {}) {
  const G = opts.guard || [authMiddleware, adminMiddleware];
  // Carregado sob demanda (o serviço do WhatsApp conecta ao ser importado).
  const zap = async (): Promise<Zap> => opts.whatsapp || (await import("./whatsapp")).whatsappService;

  app.get("/api/admin/checkout/v2", ...G, async (req: any, res) => {
    try {
      const [from, to] = period(req.query);
      const filtro = String(req.query.filter || "open");
      const busca = String(req.query.search || "").trim().slice(0, 80);
      const pagina = Math.max(1, Math.min(500, parseInt(req.query.page) || 1));
      const porPagina = 20;

      const [kpi, enviados, serieAband, serieRec] = await Promise.all([
        q(`SELECT
             count(*) FILTER (WHERE ${ABERTO}) abertos, COALESCE(sum(s.amount) FILTER (WHERE ${ABERTO}),0) abertos_cents,
             count(*) FILTER (WHERE ${RECUPERADO}) recuperados, COALESCE(sum(s.amount) FILTER (WHERE ${RECUPERADO}),0) recuperados_cents,
             count(*) FILTER (WHERE ${ABERTO} AND ${CONTATADO}) em_recuperacao,
             count(*) FILTER (WHERE ${ABERTO} AND COALESCE(s.buyer_phone,'') = '' AND COALESCE(s.buyer_email,'') = '') sem_contato
           FROM lowfy_subscriptions s
           WHERE (${ABERTO} OR ${RECUPERADO}) AND ${RANGE("s.created_at")}`, [from, to]),
        q(`SELECT 'email' canal, count(*) c, count(clicked_at) cliques FROM checkout_recovery_emails WHERE sent_at IS NOT NULL AND ${RANGE("sent_at")}
           UNION ALL SELECT 'whatsapp', count(*), count(clicked_at) FROM checkout_recovery_whatsapp WHERE sent_at IS NOT NULL AND ${RANGE("sent_at")}`, [from, to]),
        q(`SELECT ${BUCKET("s.created_at")} k, count(*) v FROM lowfy_subscriptions s WHERE (${ABERTO} OR ${RECUPERADO}) AND ${RANGE("s.created_at")} GROUP BY 1`, [from, to]),
        q(`SELECT ${BUCKET("s.paid_at")} k, count(*) v FROM lowfy_subscriptions s WHERE ${RECUPERADO} AND ${RANGE("s.paid_at")} GROUP BY 1`, [from, to]),
      ]);

      const where = [RANGE("s.created_at")];
      const params: any[] = [from, to];
      if (filtro === "recovered") where.push(RECUPERADO);
      else if (filtro === "all") where.push(`(${ABERTO} OR ${RECUPERADO})`);
      else if (filtro === "uncontacted") where.push(`${ABERTO} AND NOT ${CONTATADO}`);
      else where.push(ABERTO);
      if (busca) { params.push(`%${busca}%`); where.push(`(s.buyer_name ILIKE $${params.length} OR s.buyer_email ILIKE $${params.length} OR s.buyer_phone ILIKE $${params.length})`); }

      const linhas = await q(
        `SELECT s.id, s.buyer_name, s.buyer_email, s.buyer_phone, s.plan, s.amount, s.payment_method, s.status, s.created_at, s.paid_at, s.pix_expires_at,
                (SELECT count(*) FROM checkout_recovery_emails e WHERE e.subscription_id = s.id AND e.sent_at IS NOT NULL) emails,
                (SELECT count(*) FROM checkout_recovery_whatsapp w WHERE w.subscription_id = s.id AND w.sent_at IS NOT NULL) whats,
                GREATEST((SELECT max(sent_at) FROM checkout_recovery_emails e WHERE e.subscription_id = s.id),
                         (SELECT max(sent_at) FROM checkout_recovery_whatsapp w WHERE w.subscription_id = s.id)) ultimo_contato,
                EXISTS (SELECT 1 FROM lowfy_subscriptions o WHERE o.id <> s.id AND o.status = 'active'
                        AND ((s.buyer_email <> '' AND lower(o.buyer_email) = lower(s.buyer_email)) OR (s.user_id IS NOT NULL AND o.user_id = s.user_id))) assinou_outra,
                count(*) OVER() total
         FROM lowfy_subscriptions s
         WHERE ${where.join(" AND ")}
         ORDER BY s.created_at DESC
         LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
        params,
      );

      const k = kpi[0] || {};
      const canais = Object.fromEntries(enviados.map((r: any) => [r.canal, { sent: n(r.c), clicks: n(r.cliques) }]));
      const mA = Object.fromEntries(serieAband.map((r: any) => [r.k, n(r.v)]));
      const mR = Object.fromEntries(serieRec.map((r: any) => [r.k, n(r.v)]));
      const dias: string[] = [];
      for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`) && dias.length < 400; d.setUTCDate(d.getUTCDate() + 1)) dias.push(d.toISOString().slice(0, 10));
      const abertos = n(k.abertos), recuperados = n(k.recuperados);

      res.json({
        period: { from, to },
        whatsappConnected: (await zap()).isConnected(),
        kpis: {
          open: abertos, openBrl: n(k.abertos_cents) / 100, recovered: recuperados, recoveredBrl: n(k.recuperados_cents) / 100,
          recoveryRate: abertos + recuperados ? (recuperados / (abertos + recuperados)) * 100 : null,
          inRecovery: n(k.em_recuperacao), noContact: n(k.sem_contato),
          emails: canais.email || { sent: 0, clicks: 0 }, whatsapp: canais.whatsapp || { sent: 0, clicks: 0 },
        },
        series: dias.map((date) => ({ date, abandoned: mA[date] || 0, recovered: mR[date] || 0 })),
        page: pagina, perPage: porPagina, total: n(linhas[0]?.total),
        checkouts: linhas.map((r: any) => ({
          id: r.id, name: r.buyer_name, email: r.buyer_email, phone: r.buyer_phone, plan: r.plan, brl: n(r.amount) / 100,
          method: r.payment_method, status: r.status, createdAt: r.created_at, paidAt: r.paid_at, pixExpiresAt: r.pix_expires_at,
          emailsSent: n(r.emails), whatsappSent: n(r.whats), lastContactAt: r.ultimo_contato, subscribedElsewhere: !!r.assinou_outra,
          recovered: !!r.paid_at && !["pending", "awaiting_payment"].includes(r.status),
          checkoutUrl: linkCheckout(r.plan, r.id),
        })),
      });
    } catch (e: any) {
      logger.error(`[Checkout abandonado] lista: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar os checkouts abandonados" });
    }
  });

  // Histórico de mensagens de um checkout.
  app.get("/api/admin/checkout/v2/:id/history", ...G, async (req: any, res) => {
    try {
      const rows = await q(
        `SELECT 'email' canal, email_sequence seq, email_type tipo, sent_at, status, clicked_at, discount_code FROM checkout_recovery_emails WHERE subscription_id = $1
         UNION ALL
         SELECT 'whatsapp', message_sequence, message_type, sent_at, status, clicked_at, discount_code FROM checkout_recovery_whatsapp WHERE subscription_id = $1
         ORDER BY sent_at DESC NULLS LAST`, [req.params.id]);
      res.json({ history: rows.map((r: any) => ({ channel: r.canal, sequence: n(r.seq), type: r.tipo, sentAt: r.sent_at, status: r.status, clickedAt: r.clicked_at, discountCode: r.discount_code })) });
    } catch (e: any) {
      logger.error(`[Checkout abandonado] histórico: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar o histórico" });
    }
  });

  // Envio manual pelo admin: WhatsApp da Lowfy ou e-mail. Fica no mesmo histórico (sequência 0 = manual),
  // sem interferir nas três mensagens automáticas.
  app.post("/api/admin/checkout/v2/:id/send", ...G, async (req: any, res) => {
    try {
      const canal = req.body?.channel === "email" ? "email" : "whatsapp";
      const texto = String(req.body?.message || "").trim().slice(0, 2000);
      const assunto = String(req.body?.subject || "").trim().slice(0, 140) || "Sua assinatura da Lowfy está te esperando";
      if (texto.length < 5) return res.status(400).json({ message: "Escreva a mensagem." });
      const [s] = await q(`SELECT id, buyer_name, buyer_email, buyer_phone, plan, amount, status FROM lowfy_subscriptions WHERE id = $1`, [req.params.id]);
      if (!s) return res.status(404).json({ message: "Checkout não encontrado." });
      const nome = s.buyer_name || "cliente";

      if (canal === "whatsapp") {
        if (!soDigitos(s.buyer_phone)) return res.status(400).json({ message: "Esse checkout não tem telefone." });
        const w = await zap();
        if (!w.isConnected()) return res.status(409).json({ message: "O WhatsApp da Lowfy está desconectado. Conecte em Admin → WhatsApp." });
        const enviado = await w.sendMessage(telefoneWhats(s.buyer_phone), texto);
        if (!enviado) return res.status(502).json({ message: "O WhatsApp não confirmou o envio. Tente de novo." });
        await pool.query(
          `INSERT INTO checkout_recovery_whatsapp (subscription_id, buyer_phone, buyer_name, plan, original_amount, message_sequence, message_type, sent_at, status)
           VALUES ($1, $2, $3, $4, $5, 0, 'manual', now(), 'sent')`,
          [s.id, s.buyer_phone, nome, s.plan || "mensal", n(s.amount)],
        );
      } else {
        if (!s.buyer_email) return res.status(400).json({ message: "Esse checkout não tem e-mail." });
        const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px">${escapar(texto).replace(/\n/g, "<br>")}</div>`;
        const r = await sendEmail({ to: s.buyer_email, subject: assunto, html });
        if (!r?.success) return res.status(502).json({ message: "O e-mail não saiu. Confira o SMTP e tente de novo." });
        await pool.query(
          `INSERT INTO checkout_recovery_emails (subscription_id, buyer_email, buyer_name, plan, original_amount, email_sequence, email_type, sent_at, status)
           VALUES ($1, $2, $3, $4, $5, 0, 'manual', now(), 'sent')`,
          [s.id, s.buyer_email, nome, s.plan || "mensal", n(s.amount)],
        );
      }
      logger.info(`[Checkout abandonado] mensagem manual por ${canal} para o checkout ${s.id} (admin ${req.user?.id})`);
      res.json({ ok: true });
    } catch (e: any) {
      logger.error(`[Checkout abandonado] envio: ${e?.message}`);
      res.status(500).json({ message: "Não deu para enviar agora." });
    }
  });
}
