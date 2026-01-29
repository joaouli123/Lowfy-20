import cron from 'node-cron';
import { db } from './db';
import { sellerTransactions, marketplaceOrders, sellerWallet, referralCommissions, referralWallet, referralTransactions, lowfySubscriptions } from '@shared/schema';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import { logger } from './utils/logger';
import { getNowSaoPaulo, daysAgoSaoPaulo, formatDateTimeBR } from '@shared/dateUtils';

export async function releaseSellerBalances(): Promise<{
  success: boolean;
  releasedCount: number;
  error?: string;
}> {
  try {
    logger.debug('\n💰 [BALANCE RELEASE] Iniciando liberação de saldos...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));

    const eightDaysAgo = daysAgoSaoPaulo(8);

    logger.debug(`⏰ Buscando vendas concluídas até ${formatDateTimeBR(eightDaysAgo)}...`);

    const pendingTransactions = await db
      .select({
        transaction: sellerTransactions,
        order: marketplaceOrders,
      })
      .from(sellerTransactions)
      .leftJoin(marketplaceOrders, eq(sellerTransactions.orderId, marketplaceOrders.id))
      .where(
        and(
          eq(sellerTransactions.type, 'sale'),
          eq(sellerTransactions.status, 'pending'),
          isNull(sellerTransactions.releasedAt),
          lte(sellerTransactions.createdAt, eightDaysAgo)
        )
      );

    logger.debug(`📊 Encontradas ${pendingTransactions.length} transações para liberar`);

    if (pendingTransactions.length === 0) {
      logger.debug('✅ Nenhuma transação pendente de liberação');
      return {
        success: true,
        releasedCount: 0,
      };
    }

    let releasedCount = 0;
    const now = getNowSaoPaulo();

    for (const { transaction, order } of pendingTransactions) {
      try {
        if (!order || order.status !== 'completed') {
          logger.debug(`⏭️  Pulando transação ${transaction.id} - Pedido não concluído`);
          continue;
        }

        const netAmount = transaction.netAmountCents || transaction.amount;

        await db.transaction(async (tx) => {
          const [lockedTransaction] = await tx
            .select()
            .from(sellerTransactions)
            .where(
              and(
                eq(sellerTransactions.id, transaction.id),
                eq(sellerTransactions.status, 'pending'),
                isNull(sellerTransactions.releasedAt)
              )
            )
            .for('update');

          if (!lockedTransaction) {
            logger.debug(`⏭️  Pulando ${transaction.id} - Já processada`);
            return;
          }

          const [lockedWallet] = await tx
            .select()
            .from(sellerWallet)
            .where(eq(sellerWallet.sellerId, transaction.sellerId))
            .for('update');

          if (!lockedWallet) {
            throw new Error(`Wallet not found for seller ${transaction.sellerId}`);
          }

          await tx
            .update(sellerTransactions)
            .set({
              releasedAt: now,
              status: 'completed',
            })
            .where(eq(sellerTransactions.id, transaction.id));

          await tx.execute(sql`
            UPDATE seller_wallet 
            SET 
              balance_pending = GREATEST(0, balance_pending - ${netAmount}),
              balance_available = balance_available + ${netAmount},
              updated_at = NOW()
            WHERE seller_id = ${transaction.sellerId}
          `);
        });

        releasedCount++;
        logger.debug(`✅ Liberado: ${transaction.id} - R$ ${(netAmount / 100).toFixed(2)} para vendedor ${transaction.sellerId}`);
      } catch (error) {
        logger.error(`❌ Erro ao liberar transação ${transaction.id}:`, error);
      }
    }

    logger.debug('\n════════════════════════════════════════════════════════');
    logger.debug(`✅ [BALANCE RELEASE] Liberação concluída!`);
    logger.debug(`   💰 ${releasedCount} transações liberadas`);
    logger.debug(`   📊 Total processado: R$ ${(
      pendingTransactions
        .filter((_, i) => i < releasedCount)
        .reduce((sum, { transaction }) => sum + (transaction.netAmountCents || transaction.amount), 0) / 100
    ).toFixed(2)}`);
    logger.debug('════════════════════════════════════════════════════════\n');

    return {
      success: true,
      releasedCount,
    };
  } catch (error) {
    logger.error('❌ [BALANCE RELEASE] Erro crítico na liberação de saldos:', error);
    return {
      success: false,
      releasedCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function releaseReferralCommissions(): Promise<{
  success: boolean;
  releasedCount: number;
  error?: string;
}> {
  try {
    logger.debug('\n💰 [REFERRAL COMMISSION RELEASE] Iniciando liberação de comissões...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));

    const eightDaysAgo = daysAgoSaoPaulo(8);

    logger.debug(`⏰ Buscando comissões pendentes até ${formatDateTimeBR(eightDaysAgo)}...`);

    const pendingCommissions = await db
      .select()
      .from(referralCommissions)
      .where(
        and(
          eq(referralCommissions.status, 'pending'),
          isNull(referralCommissions.releasedAt),
          lte(referralCommissions.createdAt, eightDaysAgo)
        )
      );

    logger.debug(`📊 Encontradas ${pendingCommissions.length} comissões para liberar`);

    if (pendingCommissions.length === 0) {
      logger.debug('✅ Nenhuma comissão pendente de liberação');
      return {
        success: true,
        releasedCount: 0,
      };
    }

    let releasedCount = 0;
    const now = getNowSaoPaulo();

    for (const commission of pendingCommissions) {
      try {
        const shouldRelease = await db.transaction(async (tx) => {
          const [lockedCommission] = await tx
            .select()
            .from(referralCommissions)
            .where(
              and(
                eq(referralCommissions.id, commission.id),
                eq(referralCommissions.status, 'pending'),
                isNull(referralCommissions.releasedAt)
              )
            )
            .for('update');

          if (!lockedCommission) {
            logger.debug(`⏭️  Pulando ${commission.id} - Já processada`);
            return false;
          }

          if (lockedCommission.status === 'cancelled') {
            logger.debug(`⏭️  Pulando ${commission.id} - Já cancelada anteriormente`);
            return false;
          }

          if (lockedCommission.subscriptionId) {
            const [subscription] = await tx
              .select()
              .from(lowfySubscriptions)
              .where(eq(lowfySubscriptions.providerSubscriptionId, lockedCommission.subscriptionId));

            if (!subscription) {
              logger.debug(`⚠️  Pulando ${commission.id} - Assinatura Lowfy não encontrada`);
              return false;
            }

            const subStatus = subscription.status;
            if (subStatus === 'refunded' || subStatus === 'canceled' || subStatus === 'expired') {
              logger.debug(`⚠️  Cancelando ${commission.id} - Assinatura com status inválido: ${subStatus}`);
              
              const [walletLock] = await tx
                .select()
                .from(referralWallet)
                .where(eq(referralWallet.userId, commission.referrerId))
                .for('update');

              if (!walletLock) {
                throw new Error(`Wallet not found for referrer ${commission.referrerId}`);
              }

              await tx
                .update(referralCommissions)
                .set({
                  status: 'cancelled',
                  canceledAt: now,
                })
                .where(
                  and(
                    eq(referralCommissions.id, commission.id),
                    eq(referralCommissions.status, 'pending')
                  )
                );

              await tx.execute(sql`
                UPDATE referral_wallet 
                SET 
                  balance_pending = GREATEST(0, balance_pending - ${commission.commissionAmountCents}),
                  total_refunded = total_refunded + ${commission.commissionAmountCents},
                  active_referrals = GREATEST(0, active_referrals - 1),
                  canceled_referrals = canceled_referrals + 1,
                  updated_at = NOW()
                WHERE user_id = ${commission.referrerId}
              `);

              await tx.insert(referralTransactions).values({
                userId: commission.referrerId,
                type: 'chargeback',
                amount: -commission.commissionAmountCents,
                commissionId: commission.id,
                status: 'completed',
                description: `Estorno de comissão - Assinatura ${subStatus}`,
              });

              logger.debug(`💸 Ajustado saldo da carteira do afiliado ${commission.referrerId} - R$ ${(commission.commissionAmountCents / 100).toFixed(2)} estornado (totalRefunded incrementado)`);

              return false;
            }
          }

          const [lockedWallet] = await tx
            .select()
            .from(referralWallet)
            .where(eq(referralWallet.userId, commission.referrerId))
            .for('update');

          if (!lockedWallet) {
            throw new Error(`Wallet not found for referrer ${commission.referrerId}`);
          }

          await tx
            .update(referralCommissions)
            .set({
              releasedAt: now,
              status: 'completed',
            })
            .where(eq(referralCommissions.id, commission.id));

          await tx.execute(sql`
            UPDATE referral_wallet 
            SET 
              balance_pending = GREATEST(0, balance_pending - ${commission.commissionAmountCents}),
              balance_available = balance_available + ${commission.commissionAmountCents},
              updated_at = NOW()
            WHERE user_id = ${commission.referrerId}
          `);

          return true;
        });

        if (shouldRelease) {
          releasedCount++;
          logger.debug(`✅ Liberado: ${commission.id} - R$ ${(commission.commissionAmountCents / 100).toFixed(2)} para afiliado ${commission.referrerId}`);
        }
      } catch (error) {
        logger.error(`❌ Erro ao liberar comissão ${commission.id}:`, error);
      }
    }

    logger.debug('\n════════════════════════════════════════════════════════');
    logger.debug(`✅ [REFERRAL COMMISSION RELEASE] Liberação concluída!`);
    logger.debug(`   💰 ${releasedCount} comissões liberadas`);
    logger.debug(`   📊 Total processado: R$ ${(
      pendingCommissions
        .filter((_, i) => i < releasedCount)
        .reduce((sum, commission) => sum + commission.commissionAmountCents, 0) / 100
    ).toFixed(2)}`);
    logger.debug('════════════════════════════════════════════════════════\n');

    return {
      success: true,
      releasedCount,
    };
  } catch (error) {
    logger.error('❌ [REFERRAL COMMISSION RELEASE] Erro crítico na liberação de comissões:', error);
    return {
      success: false,
      releasedCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export function startBalanceReleaseScheduler() {
  logger.debug('🤖 [BALANCE RELEASE] Agendador de liberação de saldos iniciado!');
  logger.debug('📅 Programação: A cada 6 horas (00:00, 06:00, 12:00, 18:00)');
  logger.debug('💰 Ação: Libera saldos de vendas e comissões concluídas há mais de 8 dias\n');

  cron.schedule('0 */6 * * *', async () => {
    logger.debug('\n⏰ Executando liberação de saldos agendada...');
    await releaseSellerBalances();
    await releaseReferralCommissions();
  }, {
    timezone: "America/Sao_Paulo"
  });

  logger.debug('✅ Agendador de liberação de saldos ativo e funcionando!\n');
}
