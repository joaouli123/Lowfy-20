import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const REFERRAL_COOKIE_NAME = 'ref_code';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 3 meses em milissegundos

export async function referralTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const refCode = req.query.ref as string | undefined;

    if (refCode) {
      const referralCode = await storage.getReferralCodeByCode(refCode);

      if (referralCode) {
        res.cookie(REFERRAL_COOKIE_NAME, refCode, {
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });

        const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
        const userAgent = req.headers['user-agent'] || '';

        const existingClick = await storage.findReferralClickByIp(referralCode.id, ipAddress);
        
        if (!existingClick) {
          await storage.trackReferralClick({
            referralCodeId: referralCode.id,
            referrerId: referralCode.userId,
            ipAddress,
            userAgent,
            converted: false,
          });

          logger.debug(`[Referral] Novo click rastreado: ${refCode} de IP ${ipAddress}`);
        } else {
          logger.debug(`[Referral] Click duplicado ignorado: ${refCode} de IP ${ipAddress}`);
        }
      } else {
        logger.debug(`[Referral] Código inválido: ${refCode}`);
      }
    }
  } catch (error) {
    logger.error('[Referral Tracking] Erro ao processar referral:', error);
  }

  next();
}

export function getReferralCodeFromCookie(req: Request): string | undefined {
  return req.cookies[REFERRAL_COOKIE_NAME];
}

export function clearReferralCookie(res: Response) {
  res.clearCookie(REFERRAL_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
