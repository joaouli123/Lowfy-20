import type { Express } from "express";
import { randomUUID } from "crypto";
import { pool } from "./db";
import { logger } from "./utils/logger";
import { authMiddleware, adminMiddleware } from "./auth";
import { loadSettings } from "./services/usage";
import { getPodpayServiceSafe } from "./services/podpay";

/**
 * Créditos do Estúdio IA: quem não é da equipe paga cada geração em créditos.
 * Saldo comprado (pacotes via Pix, validade de 12 meses) + bônus mensal do assinante (não acumula).
 * A cobrança acontece ANTES de gerar e volta sozinha se a geração falhar.
 */

/** Valor de referência: 1 crédito ≈ R$ 0,10 (custo real hoje ~1/3 disso). */
export const PACOTES = [
  { id: "inicial", nome: "Inicial", creditos: 300, centavos: 2990 },
  { id: "pro", nome: "Pro", creditos: 1000, centavos: 8990, destaque: true },
  { id: "agencia", nome: "Agência", creditos: 3000, centavos: 22990 },
] as const;

export const BONUS_ASSINANTE = 100;
const VALIDADE_MESES = 12;

/** Tabela mostrada no Estúdio (o servidor cobra por custoDe). */
export const TABELA = [
  { ferramenta: "Copy", creditos: 2, unidade: "por geração" },
  { ferramenta: "Criativo", creditos: 15, unidade: "por imagem (25 em alta qualidade)" },
  { ferramenta: "Carrossel", creditos: 12, unidade: "por slide (5 slides = 60)" },
  { ferramenta: "Narração", creditos: 20, unidade: "por minuto de áudio" },
  { ferramenta: "E-book", creditos: 10, unidade: "por página" },
  { ferramenta: "Motion", creditos: 100, unidade: "por vídeo completo (em etapas)" },
  { ferramenta: "Vídeo", creditos: 80, unidade: "por vídeo" },
  { ferramenta: "Avatar", creditos: 80, unidade: "por vídeo" },
  { ferramenta: "Clone de voz", creditos: 30, unidade: "por voz" },
];

export interface Preco { custo: number; ferramenta: string; descricao: string }

/** Quanto custa um pedido de geração (null = rota não cobrada). */
export function custoDe(path: string, body: any): Preco | null {
  const b = body || {};
  const p = path.replace(/\/+$/, "");
  const pag = (n: any) => Math.max(6, Math.min(60, Number(n) || 20));
  switch (p) {
    case "/api/ai-studio/copy": return { custo: 2, ferramenta: "copy", descricao: "Copy" };
    case "/api/ai-studio/copy-kit": return { custo: 2, ferramenta: "copy", descricao: "Copy por canal" };
    case "/api/ai-studio/image": return b.quality === "high"
      ? { custo: 25, ferramenta: "criativo", descricao: "Criativo (alta qualidade)" }
      : { custo: 15, ferramenta: "criativo", descricao: "Criativo" };
    case "/api/ai-studio/carousel": {
      const n = Math.max(3, Math.min(10, Number(b.slides) || 5));
      return { custo: 12 * n, ferramenta: "carrossel", descricao: `Carrossel com ${n} slides` };
    }
    case "/api/ai-studio/tts": {
      const min = Math.max(1, Math.ceil(String(b.text || "").length / 900));
      return { custo: 20 * min, ferramenta: "narracao", descricao: `Narração (~${min} min)` };
    }
    case "/api/ai-studio/clone-voice": return { custo: 30, ferramenta: "voz", descricao: "Clone de voz" };
    case "/api/ai-studio/video": return { custo: 80, ferramenta: "video", descricao: "Vídeo" };
    case "/api/ai-studio/avatar": return { custo: 80, ferramenta: "avatar", descricao: "Avatar" };
    case "/api/ai-studio/motion/brief": return { custo: 5, ferramenta: "motion", descricao: "Motion · briefing" };
    case "/api/ai-studio/motion/script": return { custo: 15, ferramenta: "motion", descricao: "Motion · roteiro" };
    case "/api/ai-studio/motion/voice": return { custo: 20, ferramenta: "motion", descricao: "Motion · narração" };
    case "/api/ai-studio/motion/audio": return { custo: 20, ferramenta: "motion", descricao: "Motion · trilha e efeitos" };
    case "/api/ai-studio/motion/animate": return { custo: 40, ferramenta: "motion", descricao: "Motion · animação" };
    case "/api/ebook/v2/build": {
      const n = pag(b.brief?.paginas);
      return { custo: 10 * n, ferramenta: "ebook", descricao: `E-book de ${n} páginas` };
    }
    case "/api/ebook/v2/redo-image": return b.cover
      ? { custo: 25, ferramenta: "ebook", descricao: "E-book · refazer capa" }
      : { custo: 15, ferramenta: "ebook", descricao: "E-book · refazer imagem" };
    case "/api/ebook/v2/outline": return { custo: 0, ferramenta: "ebook", descricao: "E-book · sumário" };
    case "/api/ebook/generate": {
      const n = pag(b.paginas);
      return { custo: 10 * n, ferramenta: "ebook", descricao: `E-book de ${n} páginas` };
    }
    case "/api/ebook/gen-image": return { custo: 15, ferramenta: "ebook", descricao: "E-book · imagem" };
    case "/api/landing/generate": return { custo: 20, ferramenta: "pagina", descricao: "Página com IA" };
    case "/api/landing/vibe": return { custo: 20, ferramenta: "pagina", descricao: "Página com IA (HTML)" };
    case "/api/quiz/generate": return { custo: 15, ferramenta: "quiz", descricao: "Quiz com IA" };
    default: return null;
  }
}

const mesAtual = () => new Date().toISOString().slice(0, 7);
/** Assinante pagante em dia ganha o bônus mensal (compra única antiga não entra). */
const ehAssinante = (u: any) => !!u && u.subscriptionStatus === "active" && (!u.subscriptionExpiresAt || new Date(u.subscriptionExpiresAt) > new Date());

type Carteira = { saldo: number; bonus: number; bonus_mes: string | null; expira_em: Date | null };

/** Lê a carteira com trava (dentro de transação) e aplica bônus do mês e validade. */
async function carteiraTravada(c: any, user: any): Promise<Carteira> {
  await c.query(`INSERT INTO credit_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
  const { rows } = await c.query(`SELECT saldo, bonus, bonus_mes, expira_em FROM credit_wallets WHERE user_id = $1 FOR UPDATE`, [user.id]);
  const w: Carteira = rows[0];
  let mudou = false;
  if (w.saldo > 0 && w.expira_em && new Date(w.expira_em) < new Date()) {
    await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, descricao, saldo_depois) VALUES ($1, $2, 'expirou', 'Créditos vencidos (12 meses)', $3)`, [user.id, -w.saldo, w.bonus]);
    w.saldo = 0; mudou = true;
  }
  const mes = mesAtual();
  if (w.bonus_mes !== mes) {
    const novo = ehAssinante(user) ? BONUS_ASSINANTE : 0;
    if (w.bonus > 0) await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, descricao, saldo_depois) VALUES ($1, $2, 'expirou', 'Bônus do mês anterior', $3)`, [user.id, -w.bonus, w.saldo]);
    if (novo > 0) await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, descricao, saldo_depois) VALUES ($1, $2, 'bonus', 'Bônus mensal de assinante', $3)`, [user.id, novo, w.saldo + novo]);
    w.bonus = novo; w.bonus_mes = mes; mudou = true;
  }
  if (mudou) await c.query(`UPDATE credit_wallets SET saldo = $2, bonus = $3, bonus_mes = $4, updated_at = now() WHERE user_id = $1`, [user.id, w.saldo, w.bonus, w.bonus_mes]);
  return w;
}

async function emTransacao<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export async function saldoDe(user: any) {
  return emTransacao(async (c) => {
    const w = await carteiraTravada(c, user);
    return { saldo: w.saldo, bonus: w.bonus, total: w.saldo + w.bonus, expiraEm: w.saldo > 0 ? w.expira_em : null };
  });
}

export interface Cobranca { userId: string; deBonus: number; deSaldo: number; ferramenta: string; descricao: string }

/** Debita (bônus primeiro). Sem saldo, não debita nada. */
export async function cobrar(user: any, preco: Preco): Promise<{ ok: true; cobranca: Cobranca; total: number } | { ok: false; total: number }> {
  return emTransacao(async (c) => {
    const w = await carteiraTravada(c, user);
    const total = w.saldo + w.bonus;
    if (total < preco.custo) return { ok: false as const, total };
    const deBonus = Math.min(w.bonus, preco.custo);
    const deSaldo = preco.custo - deBonus;
    await c.query(`UPDATE credit_wallets SET saldo = saldo - $2, bonus = bonus - $3, updated_at = now() WHERE user_id = $1`, [user.id, deSaldo, deBonus]);
    await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, ferramenta, descricao, saldo_depois) VALUES ($1, $2, 'uso', $3, $4, $5)`,
      [user.id, -preco.custo, preco.ferramenta, preco.descricao, total - preco.custo]);
    return { ok: true as const, cobranca: { userId: user.id, deBonus, deSaldo, ferramenta: preco.ferramenta, descricao: preco.descricao }, total: total - preco.custo };
  });
}

/** Devolve uma cobrança (geração falhou). */
export async function devolver(cb: Cobranca, motivo = "Geração não concluída") {
  const valor = cb.deBonus + cb.deSaldo;
  if (valor <= 0) return;
  await emTransacao(async (c) => {
    const { rows } = await c.query(
      `UPDATE credit_wallets SET saldo = saldo + $2, bonus = bonus + $3, updated_at = now() WHERE user_id = $1 RETURNING saldo + bonus AS total`,
      [cb.userId, cb.deSaldo, cb.deBonus]);
    await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, ferramenta, descricao, saldo_depois) VALUES ($1, $2, 'estorno', $3, $4, $5)`,
      [cb.userId, valor, cb.ferramenta, `${motivo}: ${cb.descricao}`, rows[0]?.total ?? 0]);
  });
}

/** Entrada de créditos comprados/ajustados (renova a validade de 12 meses). */
async function creditar(c: any, userId: string, creditos: number, tipo: string, descricao: string, pedidoId?: string) {
  await c.query(`INSERT INTO credit_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const { rows } = await c.query(
    `UPDATE credit_wallets SET saldo = GREATEST(0, saldo + $2), expira_em = CASE WHEN $2 > 0 THEN now() + interval '${VALIDADE_MESES} months' ELSE expira_em END, updated_at = now()
     WHERE user_id = $1 RETURNING saldo + bonus AS total`, [userId, creditos]);
  await c.query(`INSERT INTO credit_ledger (user_id, delta, tipo, descricao, pedido_id, saldo_depois) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, creditos, tipo, descricao, pedidoId || null, rows[0]?.total ?? 0]);
}

/** Confirma um pedido pago (idempotente: só credita uma vez). */
export async function confirmarPedido(pedidoId: string): Promise<boolean> {
  return emTransacao(async (c) => {
    const { rows } = await c.query(`UPDATE credit_orders SET status = 'pago', pago_em = now() WHERE id = $1 AND status = 'pendente' RETURNING user_id, creditos, pacote`, [pedidoId]);
    if (!rows.length) return false;
    const o = rows[0];
    const pac = PACOTES.find((p) => p.id === o.pacote);
    await creditar(c, o.user_id, o.creditos, "compra", `Pacote ${pac?.nome || o.pacote} (Pix)`, pedidoId);
    logger.info(`[Créditos] Pedido ${pedidoId} pago: +${o.creditos} para ${o.user_id}`);
    return true;
  });
}

/**
 * Webhook do Podpay: devolve true se a transação era de créditos (aí a rota não segue para
 * marketplace/assinatura). Pago credita; estorno/chargeback de pedido pago retira os créditos.
 */
export async function webhookCreditos(transactionId: string, status: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT id, status, user_id, creditos FROM credit_orders WHERE gateway = 'podpay' AND gateway_id = $1`, [String(transactionId)]);
  if (!rows.length) return false;
  const o = rows[0];
  const st = String(status || "").toLowerCase();
  if (st === "paid" || st === "approved") await confirmarPedido(o.id);
  else if ((st === "refunded" || st === "chargeback") && o.status === "pago") {
    await emTransacao(async (c) => {
      const { rowCount } = await c.query(`UPDATE credit_orders SET status = 'estornado' WHERE id = $1 AND status = 'pago'`, [o.id]);
      if (rowCount) await creditar(c, o.user_id, -o.creditos, "estorno", "Compra estornada no Pix", o.id);
    });
  } else if (["refused", "cancelled", "canceled"].includes(st)) {
    await pool.query(`UPDATE credit_orders SET status = 'cancelado' WHERE id = $1 AND status = 'pendente'`, [o.id]);
  }
  return true;
}

/**
 * Middleware global das rotas de IA pagas: equipe gera de graça; o resto paga em créditos.
 * Marca `req.acessoPorCreditos` (libera a rota mesmo sem plano) e `req.devolverCreditos(motivo)`.
 * Resposta de erro (status >= 400) devolve sozinha; rotas em segundo plano chamam devolverCreditos.
 */
export function cobrarIaMiddleware(auth: any = authMiddleware) {
  return (req: any, res: any, next: any) => {
    if (req.method !== "POST") return next();
    const preco = custoDe(req.path, req.body);
    if (!preco) return next();
    auth(req, res, async () => {
      if (req.user?.isAdmin) return next(); // equipe: sem cobrança (o custo aparece em Consumo e custos)
      if ((await loadSettings()).iaAcesso === "admin") {
        return res.status(403).json({ code: "IA_SO_EQUIPE", message: "As ferramentas de IA estão temporariamente liberadas só para a equipe." });
      }
      try {
        if (preco.custo <= 0) { req.acessoPorCreditos = true; return next(); }
        const r = await cobrar(req.user, preco);
        if (!r.ok) {
          return res.status(402).json({
            code: "SEM_CREDITOS", custo: preco.custo, saldo: r.total,
            message: `Você precisa de ${preco.custo} créditos para isso (seu saldo: ${r.total}). Compre créditos no topo do Estúdio.`,
          });
        }
        req.acessoPorCreditos = true;
        // Quanto ainda pode voltar (devolução parcial, ex.: slides que falharam, não passa do cobrado).
        const resta = { ...r.cobranca };
        req.devolverCreditos = async (motivo?: string, valor?: number) => {
          const total = resta.deSaldo + resta.deBonus;
          const v = Math.min(total, valor == null ? total : Math.max(0, Math.floor(valor)));
          if (v <= 0) return;
          const deSaldo = Math.min(v, resta.deSaldo);
          const parte: Cobranca = { ...resta, deSaldo, deBonus: v - deSaldo };
          resta.deSaldo -= parte.deSaldo; resta.deBonus -= parte.deBonus;
          try { await devolver(parte, motivo); } catch (e: any) { logger.error(`[Créditos] Falha ao devolver: ${e?.message}`); }
        };
        res.setHeader("X-Creditos-Saldo", String(r.total));
        res.on("finish", () => { if (res.statusCode >= 400) void req.devolverCreditos("Geração com erro"); });
        next();
      } catch (e: any) {
        logger.error(`[Créditos] Erro ao cobrar: ${e?.message}`);
        res.status(500).json({ message: "Não foi possível verificar seus créditos. Tente de novo." });
      }
    });
  };
}

export function registerCreditosRoutes(app: Express, opts: { auth?: any; admin?: any[] } = {}) {
  void loadSettings(); // aquece a configuração no boot (senão o 1º pedido lê o padrão "só equipe")
  const A = opts.auth || authMiddleware;
  const ADM = opts.admin || [authMiddleware, adminMiddleware];
  // Saldo, tabela, pacotes e extrato do usuário.
  app.get("/api/creditos", A, async (req: any, res) => {
    try {
      const s = await saldoDe(req.user);
      const { rows } = await pool.query(
        `SELECT delta, tipo, ferramenta, descricao, saldo_depois, created_at FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30`, [req.user.id]);
      res.json({
        ...s, ilimitado: !!req.user.isAdmin, assinante: ehAssinante(req.user), bonusMensal: BONUS_ASSINANTE,
        pacotes: PACOTES, tabela: TABELA, extrato: rows,
        liberado: !!req.user.isAdmin || (await loadSettings()).iaAcesso !== "admin",
      });
    } catch (e: any) {
      logger.error(`[Créditos] saldo: ${e?.message}`);
      res.status(500).json({ message: "Erro ao carregar seus créditos" });
    }
  });

  // Compra de pacote por Pix (Podpay).
  app.post("/api/creditos/comprar", A, async (req: any, res) => {
    try {
      const pac = PACOTES.find((p) => p.id === req.body?.pacote);
      if (!pac) return res.status(400).json({ message: "Escolha um pacote" });
      const cpf = String(req.body?.cpf || req.user.cpf || "").replace(/\D/g, "");
      if (cpf.length !== 11 && cpf.length !== 14) return res.status(400).json({ code: "PRECISA_CPF", message: "Informe o CPF (ou CNPJ) para gerar o Pix" });
      const podpay = getPodpayServiceSafe();
      if (!podpay) return res.status(503).json({ message: "Pagamento por Pix indisponível no momento" });
      // Pix pendente recente do mesmo pacote: reaproveita em vez de gerar outro.
      const { rows: ab } = await pool.query(
        `SELECT id, pix_copia_cola, pix_expira_em FROM credit_orders WHERE user_id = $1 AND pacote = $2 AND status = 'pendente' AND created_at > now() - interval '30 minutes' ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, pac.id]);
      if (ab[0]?.pix_copia_cola) return res.json({ pedidoId: ab[0].id, pix: ab[0].pix_copia_cola, expiraEm: ab[0].pix_expira_em, valor: pac.centavos, creditos: pac.creditos });

      const id = `cred_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
      const pix = await podpay.createPixTransaction({
        orderId: id, sellerId: "lowfy", buyerId: req.user.id, amountCents: pac.centavos,
        items: [{ name: `Créditos Lowfy - Pacote ${pac.nome} (${pac.creditos})`, quantity: 1, price: pac.centavos }],
        customer: { name: req.user.name || "Cliente Lowfy", email: req.user.email, phone: req.user.phone || "", cpf },
      });
      const copiaCola = pix.pix?.qrcode || "";
      const expira = pix.pix?.expirationDate ? new Date(pix.pix.expirationDate) : null;
      await pool.query(
        `INSERT INTO credit_orders (id, user_id, pacote, creditos, valor_centavos, gateway, gateway_id, pix_copia_cola, pix_expira_em) VALUES ($1,$2,$3,$4,$5,'podpay',$6,$7,$8)`,
        [id, req.user.id, pac.id, pac.creditos, pac.centavos, String(pix.id), copiaCola, expira]);
      res.json({ pedidoId: id, pix: copiaCola, expiraEm: expira, valor: pac.centavos, creditos: pac.creditos });
    } catch (e: any) {
      logger.error(`[Créditos] compra: ${e?.message}`);
      res.status(502).json({ message: e?.message || "Não foi possível gerar o Pix agora" });
    }
  });

  // Status do pedido (o front consulta enquanto mostra o Pix). Confere no Podpay se ainda pendente.
  const ultimaConsulta = new Map<string, number>();
  app.get("/api/creditos/pedido/:id", A, async (req: any, res) => {
    try {
      const { rows } = await pool.query(`SELECT id, status, creditos, gateway_id, created_at FROM credit_orders WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
      const o = rows[0];
      if (!o) return res.status(404).json({ message: "Pedido não encontrado" });
      if (o.status === "pendente" && o.gateway_id && Date.now() - (ultimaConsulta.get(o.id) || 0) > 5000) {
        ultimaConsulta.set(o.id, Date.now());
        if (ultimaConsulta.size > 5000) ultimaConsulta.clear();
        try {
          const st = await getPodpayServiceSafe()?.getTransactionStatus(o.gateway_id);
          if (st?.status) await webhookCreditos(o.gateway_id, st.status);
        } catch { /* o webhook confirma depois */ }
      }
      const { rows: r2 } = await pool.query(`SELECT status FROM credit_orders WHERE id = $1`, [o.id]);
      res.json({ status: r2[0]?.status || o.status, creditos: o.creditos });
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao consultar o pedido" });
    }
  });

  // Admin: visão geral e ajuste manual (presente, cortesia, correção).
  app.get("/api/admin/creditos", ...ADM, async (_req, res) => {
    try {
      const [vendas, uso, top, recentes] = await Promise.all([
        pool.query(`SELECT count(*)::int pedidos, coalesce(sum(valor_centavos),0)::int centavos, coalesce(sum(creditos),0)::int creditos FROM credit_orders WHERE status = 'pago' AND pago_em > now() - interval '30 days'`),
        pool.query(`SELECT coalesce(-sum(delta),0)::int creditos, count(*)::int geracoes FROM credit_ledger WHERE tipo = 'uso' AND created_at > now() - interval '30 days'`),
        pool.query(`SELECT w.user_id, u.name, u.email, w.saldo, w.bonus FROM credit_wallets w JOIN users u ON u.id = w.user_id WHERE w.saldo + w.bonus > 0 ORDER BY w.saldo DESC LIMIT 20`),
        pool.query(`SELECT o.id, o.pacote, o.creditos, o.valor_centavos, o.status, o.created_at, o.pago_em, u.name, u.email FROM credit_orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 30`),
      ]);
      res.json({ vendas30d: vendas.rows[0], uso30d: uso.rows[0], carteiras: top.rows, pedidos: recentes.rows });
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao carregar créditos" });
    }
  });

  app.post("/api/admin/creditos/ajuste", ...ADM, async (req: any, res) => {
    try {
      const delta = Math.trunc(Number(req.body?.creditos));
      const motivo = String(req.body?.motivo || "").trim().slice(0, 200);
      const email = String(req.body?.email || "").trim().toLowerCase();
      if ((!req.body?.userId && !email) || !delta || Math.abs(delta) > 100000) return res.status(400).json({ message: "Informe o usuário e a quantidade de créditos" });
      if (!motivo) return res.status(400).json({ message: "Informe o motivo do ajuste" });
      const { rows } = req.body?.userId
        ? await pool.query(`SELECT id FROM users WHERE id = $1`, [String(req.body.userId)])
        : await pool.query(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
      if (!rows.length) return res.status(404).json({ message: "Usuário não encontrado" });
      const userId = rows[0].id as string;
      await emTransacao((c) => creditar(c, userId, delta, "ajuste", `${motivo} (por ${req.user.name || req.user.email})`));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao ajustar créditos" });
    }
  });
}
