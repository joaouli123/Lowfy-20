import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { db } from "./db";
import { users, sessions, emailVerifications } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

const TOKEN_EXPIRY_DAYS = 30;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function getSessionUser(token: string) {
  const [session] = await db
    .select({
      user: users,
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!session || new Date() > new Date(session.expiresAt)) {
    return null;
  }

  return session.user;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export function authMiddleware(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ message: "Não autenticado" });
  }

  getSessionUser(token)
    .then(user => {
      if (!user) {
        return res.status(401).json({ message: "Sessão inválida ou expirada" });
      }

      if (user.accountStatus === 'blocked') {
        return res.status(403).json({ message: "Conta bloqueada" });
      }

      req.user = user;
      next();
    })
    .catch(() => {
      res.status(500).json({ message: "Erro ao verificar autenticação" });
    });
}

export function optionalAuthMiddleware(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;

  if (!token) {
    req.user = undefined;
    return next();
  }

  getSessionUser(token)
    .then(user => {
      if (user && user.accountStatus !== 'blocked') {
        req.user = user;
      } else {
        req.user = undefined;
      }
      next();
    })
    .catch(() => {
      req.user = undefined;
      next();
    });
}

export function adminMiddleware(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Acesso negado. Apenas administradores." });
  }
  next();
}

export function isSubscriptionActive(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  
  const accessPlan = user.accessPlan;
  const status = user.subscriptionStatus;
  const expiresAt = user.subscriptionExpiresAt;
  
  // BASIC ou FULL access_plan: Acesso garantido (compradores de pagamento único ou assinantes)
  // Esses usuários têm acesso independente do subscriptionStatus
  if (accessPlan === 'basic' || accessPlan === 'full') {
    return true;
  }
  
  // REEMBOLSO: Perde acesso IMEDIATAMENTE - sem verificar data
  if (status === 'refunded') {
    return false;
  }
  
  // ATIVO ou TRIAL: Acesso normal (verifica expiração)
  if (status === 'active' || status === 'trial') {
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return false;
    }
    return true;
  }
  
  // CANCELADO: Mantém acesso ATÉ a data de expiração
  if (status === 'canceled') {
    if (expiresAt && new Date(expiresAt) >= new Date()) {
      return true; // Ainda tem acesso até expirar
    }
    return false; // Período já expirou
  }
  
  return false;
}

export function getSubscriptionDaysExpired(user: any): number {
  if (!user || !user.subscriptionExpiresAt) return 0;
  
  const expiresAt = new Date(user.subscriptionExpiresAt);
  const now = new Date();
  
  if (now <= expiresAt) return 0;
  
  const diffMs = now.getTime() - expiresAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function subscriptionMiddleware(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  
  if (req.user.isAdmin) {
    return next();
  }
  
  if (!isSubscriptionActive(req.user)) {
    const daysExpired = getSubscriptionDaysExpired(req.user);
    return res.status(403).json({ 
      message: "Sua assinatura expirou. Renove para continuar acessando.",
      code: "SUBSCRIPTION_EXPIRED",
      subscriptionStatus: req.user.subscriptionStatus,
      daysExpired
    });
  }
  
  next();
}

export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function create2FAVerification(userId: string, email: string, code: string): Promise<string> {
  const codeHash = await hashPassword(code);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  await db.delete(emailVerifications).where(
    and(
      eq(emailVerifications.userId, userId),
      eq(emailVerifications.status, 'pending')
    )
  );

  const [verification] = await db.insert(emailVerifications).values({
    userId,
    email,
    codeHash,
    expiresAt,
    status: 'pending',
    attemptCount: 0,
  }).returning();

  return verification.id;
}

export async function verify2FACode(userId: string, code: string): Promise<{ success: boolean; message: string }> {
  const [verification] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.userId, userId),
        eq(emailVerifications.status, 'pending'),
        gte(emailVerifications.expiresAt, new Date())
      )
    )
    .orderBy(emailVerifications.createdAt)
    .limit(1);

  if (!verification) {
    return { success: false, message: 'Código expirado ou inválido' };
  }

  if (verification.attemptCount >= MAX_OTP_ATTEMPTS) {
    await db.update(emailVerifications)
      .set({ status: 'failed' })
      .where(eq(emailVerifications.id, verification.id));
    return { success: false, message: 'Número máximo de tentativas excedido' };
  }

  const isValidCode = await bcrypt.compare(code, verification.codeHash);

  if (!isValidCode) {
    await db.update(emailVerifications)
      .set({ attemptCount: verification.attemptCount + 1 })
      .where(eq(emailVerifications.id, verification.id));
    return { success: false, message: 'Código incorreto' };
  }

  await db.update(emailVerifications)
    .set({ status: 'verified' })
    .where(eq(emailVerifications.id, verification.id));

  return { success: true, message: 'Código verificado com sucesso' };
}

export function setupAuth(app: Express) {
  app.use(cookieParser());
}
