import { Router } from 'express';
import { storage } from '../storage';
import { authMiddleware } from '../auth';
import { createPixTransfer, getAsaasServiceSafe } from '../services/asaas';
import { db } from '../db';
import { referralWallet, referralTransactions, podpayWithdrawals, users } from '@shared/schema';
import { eq, sql as sqlOp, gte, and } from 'drizzle-orm';
import { z } from 'zod';
import { getReferralCodeFromCookie } from '../middleware/referral-tracking';
import { logger } from '../utils/logger';
import { sendEmail, generateWithdrawalRequestedEmail } from '../email';
import { getLandingUrl } from '@shared/domainConfig';
import { 
  parseDateStringToStartOfDaySaoPaulo, 
  parseDateStringToEndOfDaySaoPaulo,
  startOfDaySaoPaulo,
  daysAgoSaoPaulo
} from '@shared/dateUtils';

export const referralRoutes = Router();

// GET /api/referrals/current - Obter código de referência atual do cookie (para checkout)
referralRoutes.get('/current', async (req: any, res) => {
  try {
    const refCode = getReferralCodeFromCookie(req);
    
    if (!refCode) {
      return res.json({ referralCode: null });
    }
    
    // Verificar se o código existe no banco
    const referralCode = await storage.getReferralCodeByCode(refCode);
    
    if (!referralCode) {
      return res.json({ referralCode: null });
    }
    
    res.json({ 
      referralCode: refCode,
      referrerId: referralCode.userId 
    });
  } catch (error: any) {
    logger.error('Error getting current referral code:', error);
    res.json({ referralCode: null });
  }
});

// GET /api/referrals/my-code - Obter ou criar código de indicação
referralRoutes.get('/my-code', authMiddleware, async (req: any, res) => {
  try {
    const referralCode = await storage.getOrCreateReferralCode(req.user.id);
    
    // Usar o domínio da landing page (lowfy.com.br) para links de indicação
    const referralLink = getLandingUrl(`/?ref=${referralCode.code}`);

    res.json({
      ...referralCode,
      referralLink,
    });
  } catch (error: any) {
    logger.error('Error getting referral code:', error);
    res.status(500).json({ message: 'Erro ao buscar código de indicação' });
  }
});

// GET /api/referrals/wallet - Obter carteira de comissões
referralRoutes.get('/wallet', authMiddleware, async (req: any, res) => {
  try {
    const wallet = await storage.getOrCreateReferralWallet(req.user.id);
    res.json(wallet);
  } catch (error: any) {
    logger.error('Error getting referral wallet:', error);
    res.status(500).json({ message: 'Erro ao buscar carteira de afiliado' });
  }
});

// GET /api/referrals/commissions - Listar comissões com paginação e filtros de data
referralRoutes.get('/commissions', authMiddleware, async (req: any, res) => {
  try {
    const {
      status,
      type,
      limit = '15',
      offset = '0',
      startDate,
      endDate,
    } = req.query;

    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate && typeof startDate === 'string') {
      startDateObj = parseDateStringToStartOfDaySaoPaulo(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      endDateObj = parseDateStringToEndOfDaySaoPaulo(endDate);
    }

    logger.debug('[Referrals] Getting commissions for user:', { 
      userId: req.user.id, 
      status, 
      type, 
      limit, 
      offset,
      startDate: startDateObj?.toISOString(),
      endDate: endDateObj?.toISOString()
    });

    const result = await storage.getReferralCommissions(req.user.id, {
      status: status as string | undefined,
      type: type as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      startDate: startDateObj,
      endDate: endDateObj,
    });

    logger.debug('[Referrals] Commissions result:', { 
      userId: req.user.id, 
      total: result.total,
      count: result.commissions.length 
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Error getting commissions:', error);
    res.status(500).json({ message: 'Erro ao buscar comissões' });
  }
});

// GET /api/referrals/transactions - Histórico de transações
referralRoutes.get('/transactions', authMiddleware, async (req: any, res) => {
  try {
    const {
      limit = '15',
      offset = '0',
    } = req.query;

    const transactions = await storage.getReferralTransactions(
      req.user.id,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(transactions);
  } catch (error: any) {
    logger.error('Error getting referral transactions:', error);
    res.status(500).json({ message: 'Erro ao buscar transações' });
  }
});

// GET /api/referrals/stats - Estatísticas de afiliado
referralRoutes.get('/stats', authMiddleware, async (req: any, res) => {
  try {
    const [wallet, code] = await Promise.all([
      storage.getOrCreateReferralWallet(req.user.id),
      storage.getOrCreateReferralCode(req.user.id),
    ]);

    const stats = {
      totalClicks: code.clicks,
      totalConversions: code.conversions,
      conversionRate: code.clicks > 0 ? ((code.conversions / code.clicks) * 100).toFixed(2) : '0.00',
      activeReferrals: wallet.activeReferrals,
      canceledReferrals: wallet.canceledReferrals,
      balancePending: wallet.balancePending,
      balanceAvailable: wallet.balanceAvailable,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      totalRefunded: wallet.totalRefunded || 0,
    };

    res.json(stats);
  } catch (error: any) {
    logger.error('Error getting referral stats:', error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
});

// GET /api/referrals/referred-users - Lista de usuários indicados com status de assinatura
referralRoutes.get('/referred-users', authMiddleware, async (req: any, res) => {
  try {
    const { status, limit = '50', offset = '0', startDate, endDate } = req.query;
    
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate && typeof startDate === 'string') {
      startDateObj = parseDateStringToStartOfDaySaoPaulo(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      endDateObj = parseDateStringToEndOfDaySaoPaulo(endDate);
    }

    logger.debug('[Referrals] Getting referred users for:', { 
      userId: req.user.id, 
      status, 
      limit, 
      offset,
      startDate: startDateObj?.toISOString(),
      endDate: endDateObj?.toISOString()
    });

    const result = await storage.getReferredUsersList(req.user.id, {
      status: status as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      startDate: startDateObj,
      endDate: endDateObj,
    });

    logger.debug('[Referrals] Referred users result:', { 
      userId: req.user.id, 
      total: result.total, 
      count: result.users.length,
      byStatus: result.byStatus 
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Error getting referred users:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários indicados' });
  }
});

// GET /api/referrals/complete-stats - Estatísticas completas incluindo por status
referralRoutes.get('/complete-stats', authMiddleware, async (req: any, res) => {
  try {
    const stats = await storage.getCompleteReferralStats(req.user.id);
    res.json(stats);
  } catch (error: any) {
    logger.error('Error getting complete stats:', error);
    res.status(500).json({ message: 'Erro ao buscar estatísticas completas' });
  }
});

// GET /api/referrals/balance - Obter saldo de comissões (separado)
referralRoutes.get('/balance', authMiddleware, async (req: any, res) => {
  try {
    const balance = await storage.getReferralBalance(req.user.id);
    res.json(balance);
  } catch (error: any) {
    logger.error('Error getting referral balance:', error);
    res.status(500).json({ message: 'Erro ao buscar saldo de comissões' });
  }
});

// PUT /api/referrals/pix-config - Atualizar chave PIX de comissões
referralRoutes.put('/pix-config', authMiddleware, async (req: any, res) => {
  try {
    const { pixKey, pixKeyType } = req.body;

    if (!pixKey || !pixKeyType) {
      return res.status(400).json({ message: 'Chave PIX e tipo são obrigatórios' });
    }

    await storage.updateReferralPixConfig(req.user.id, pixKey, pixKeyType);
    res.json({ message: 'Chave PIX atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating referral PIX config:', error);
    res.status(500).json({ message: 'Erro ao atualizar chave PIX' });
  }
});

// GET /api/referrals/withdrawals - Listar saques de comissões
referralRoutes.get('/withdrawals', authMiddleware, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let startDateObj: Date | undefined;
    let endDateObj: Date | undefined;

    if (startDate && typeof startDate === 'string') {
      startDateObj = parseDateStringToStartOfDaySaoPaulo(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      endDateObj = parseDateStringToEndOfDaySaoPaulo(endDate);
    }

    const withdrawals = await storage.listReferralWithdrawals(req.user.id, {
      startDate: startDateObj,
      endDate: endDateObj,
    });
    res.json(withdrawals);
  } catch (error: any) {
    logger.error('Error getting referral withdrawals:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de saques' });
  }
});

const withdrawalRequestSchema = z.object({
  amountCents: z.number().int().min(1000).max(5000000),
});

const WITHDRAWAL_FEE = 249;
const DAILY_WITHDRAWAL_LIMIT = 5000000;
const WITHDRAWAL_COOLDOWN_MS = 60000;

const withdrawalCooldowns = new Map<number, number>();

referralRoutes.post('/request-withdrawal', authMiddleware, async (req: any, res) => {
  const userId = req.user.id;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  try {
    const lastWithdrawal = withdrawalCooldowns.get(userId);
    if (lastWithdrawal && Date.now() - lastWithdrawal < WITHDRAWAL_COOLDOWN_MS) {
      logger.warn(`[Anti-Fraud] Withdrawal cooldown active for user ${userId} from IP ${clientIp}`);
      return res.status(429).json({
        message: 'Aguarde um minuto antes de solicitar outro saque',
      });
    }
    
    const validationResult = withdrawalRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Dados de saque inválidos',
        errors: validationResult.error.errors 
      });
    }

    const { amountCents } = validationResult.data;

    if (amountCents < 1000 || amountCents > 5000000) {
      logger.warn(`[Anti-Fraud] Invalid amount ${amountCents} from user ${userId}`);
      return res.status(400).json({
        message: 'Valor deve estar entre R$ 10,00 e R$ 50.000,00',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [dailyTotal] = await db
      .select({ total: sqlOp`COALESCE(SUM(amount_cents), 0)` })
      .from(podpayWithdrawals)
      .where(and(
        eq(podpayWithdrawals.sellerId, userId),
        eq(podpayWithdrawals.source, 'referral'),
        gte(podpayWithdrawals.createdAt, today)
      ));
    
    const dailyWithdrawn = Number(dailyTotal?.total || 0);
    if (dailyWithdrawn + amountCents > DAILY_WITHDRAWAL_LIMIT) {
      logger.warn(`[Anti-Fraud] Daily limit exceeded for user ${userId}: ${dailyWithdrawn} + ${amountCents} > ${DAILY_WITHDRAWAL_LIMIT}`);
      return res.status(400).json({
        message: 'Limite diário de saques atingido (R$ 50.000,00)',
        dailyWithdrawn: dailyWithdrawn / 100,
        dailyLimit: DAILY_WITHDRAWAL_LIMIT / 100,
      });
    }

    const balance = await storage.getReferralBalance(req.user.id);

    if (!balance.pixKey || !balance.pixKeyType) {
      return res.status(400).json({
        message: 'Configure sua chave PIX de comissões antes de solicitar um saque',
      });
    }

    if (balance.balanceAvailable < amountCents) {
      return res.status(400).json({
        message: 'Saldo insuficiente para saque',
        balanceAvailable: balance.balanceAvailable,
        requested: amountCents,
      });
    }

    // Calculate net amount after fee (taxa de R$ 2,49 é lucro da plataforma - Asaas PIX é GRATUITO!)
    const netAmount = amountCents - WITHDRAWAL_FEE;

    // Verify Asaas service is configured
    const asaasService = getAsaasServiceSafe();
    if (!asaasService) {
      return res.status(500).json({
        message: 'Serviço de pagamento não configurado. Entre em contato com o suporte.',
      });
    }

    // Mapear tipo de chave PIX para o formato do Asaas (maiúsculas)
    const pixKeyTypeMap: Record<string, 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'> = {
      'cpf': 'CPF',
      'cnpj': 'CNPJ',
      'email': 'EMAIL',
      'phone': 'PHONE',
      'random': 'EVP',
    };
    const asaasPixKeyType = pixKeyTypeMap[balance.pixKeyType] || 'EVP';

    // 1. PRIMEIRO: Try Asaas transfer (FORA de transação, assim se falhar nada é perdido)
    let asaasResult;
    try {
      asaasResult = await createPixTransfer({
        sellerId: req.user.id,
        amountCents: netAmount, // Transfere apenas valor líquido (taxa fica como lucro)
        pixKey: balance.pixKey,
        pixKeyType: asaasPixKeyType,
        description: `Saque Comissões Lowfy - R$ ${(netAmount / 100).toFixed(2)}`,
      });
      
      logger.debug('[Referral Withdrawal] Asaas transfer created:', {
        transferId: asaasResult.id,
        status: asaasResult.status,
        value: asaasResult.value,
      });
    } catch (asaasError: any) {
      // Asaas failed ANTES de debitar saldo - usuário perde NADA!
      logger.error('[Referral Withdrawal] Asaas transfer failed (BEFORE debit):', asaasError);
      
      const errorMessage = asaasError.message || '';
      if (errorMessage.includes('Saldo insuficiente') || errorMessage.includes('insufficient')) {
        return res.status(503).json({
          message: 'Estamos com uma instabilidade temporária no processamento de saques. Por favor, tente novamente em alguns minutos.',
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          retryAfter: 300
        });
      }
      
      return res.status(500).json({ message: `Falha ao processar saque: ${asaasError.message}` });
    }

    // 2. AGORA: Asaas sucessiu - AGORA débitar saldo DENTRO de transação
    try {
      const withdrawal = await db.transaction(async (tx) => {
        // Debit from referral wallet with concurrency guard (row-level lock)
        const updateResult = await tx
          .update(referralWallet)
          .set({
            balanceAvailable: sqlOp`${referralWallet.balanceAvailable} - ${amountCents}`,
            totalWithdrawn: sqlOp`${referralWallet.totalWithdrawn} + ${amountCents}`,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(referralWallet.userId, req.user.id),
              gte(referralWallet.balanceAvailable, amountCents)
            )
          )
          .returning();

        // Check if update succeeded (balance was sufficient)
        if (!updateResult || updateResult.length === 0) {
          const error = new Error('INSUFFICIENT_BALANCE');
          (error as any).code = 'INSUFFICIENT_BALANCE';
          throw error;
        }

        // Save withdrawal to database with GROSS amount (requested), not net
        const [newWithdrawal] = await tx.insert(podpayWithdrawals).values({
          sellerId: req.user.id,
          source: 'referral',
          amountCents: amountCents,
          status: 'pending',
          pixKey: balance.pixKey,
          pixKeyType: balance.pixKeyType,
          provider: 'asaas',
          asaasTransferId: asaasResult.id,
        }).returning();

        // Create referral transaction record
        await tx.insert(referralTransactions).values({
          userId: req.user.id,
          type: 'withdrawal',
          amount: -amountCents,
          status: 'pending',
          description: `Saque de comissões via PIX - Taxa R$ 2,49`,
        });

        return newWithdrawal;
      });

      // Enviar email de confirmação de saque
      setImmediate(async () => {
        try {
          const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
          if (user) {
            const withdrawalEmailHtml = generateWithdrawalRequestedEmail(
              user.name,
              amountCents / 100, // valor bruto solicitado
              WITHDRAWAL_FEE, // taxa em centavos
              netAmount / 100, // valor líquido a receber
              `${balance.pixKeyType.toUpperCase()} - ${balance.pixKey}`
            );
            await sendEmail({
              to: user.email,
              subject: '✅ Saque de Comissões Solicitado - Lowfy',
              html: withdrawalEmailHtml,
            });
            logger.debug(`[Referral Withdrawal] Email enviado para ${user.email}`);
          }
        } catch (emailError) {
          logger.error('[Referral Withdrawal] Erro ao enviar email:', emailError);
        }
      });

      withdrawalCooldowns.set(userId, Date.now());
      
      logger.debug(`[Referral Withdrawal] Success for user ${userId} from IP ${clientIp}: R$ ${(amountCents / 100).toFixed(2)}`);
      
      res.json({
        message: 'Saque solicitado com sucesso',
        withdrawal,
        asaasTransferId: withdrawal.asaasTransferId,
        requestedAmount: amountCents,
        fee: WITHDRAWAL_FEE,
        netAmount: netAmount,
      });
    } catch (transactionError: any) {
      // Handle insufficient balance in user's wallet
      if (transactionError.code === 'INSUFFICIENT_BALANCE' || transactionError.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({
          message: 'Saldo insuficiente para saque ou saque já processado',
        });
      }
      
      // Handle Asaas insufficient balance (temporary service issue)
      if (transactionError.code === 'ASAAS_INSUFFICIENT_BALANCE') {
        return res.status(503).json({
          message: transactionError.userMessage,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          retryAfter: 300 // Sugerir tentar novamente em 5 minutos
        });
      }
      
      throw transactionError;
    }
  } catch (error: any) {
    logger.error('[Referral Withdrawal] Error:', error);
    
    if ((error as any).code === 'ASAAS_INSUFFICIENT_BALANCE') {
      return res.status(503).json({
        message: (error as any).userMessage,
        code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
        retryAfter: 300
      });
    }
    
    res.status(500).json({ 
      message: 'Erro ao solicitar saque de comissões' 
    });
  }
});
