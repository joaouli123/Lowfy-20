import cron from 'node-cron';
import { db } from './db';
import { lowfySubscriptions, checkoutRecoveryEmails } from '@shared/schema';
import { eq, and, isNull, lt, gte, inArray, notInArray, sql } from 'drizzle-orm';
import { 
  sendEmail, 
  generateCheckoutRecoveryEmail1,
  generateCheckoutRecoveryEmail2,
  generateCheckoutRecoveryEmail3,
  generateCheckoutRecoveryEmail4WithDiscount
} from './email';
import { logger } from './utils/logger';
import crypto from 'crypto';
import { getNowSaoPaulo, hoursAgoSaoPaulo, daysAgoSaoPaulo, minutesAgoSaoPaulo } from '@shared/dateUtils';
import { getCheckoutUrl } from '@shared/domainConfig';

function generateDiscountCode(): string {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VOLTA50-${randomPart}`;
}

function getCheckoutUrlForRecovery(plan: string, subscriptionId: string, discountCode?: string): string {
  const params = new URLSearchParams({
    plan,
    recoveryId: subscriptionId,
  });
  
  if (discountCode) {
    params.set('cupom', discountCode);
  }
  
  return getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
}

async function getAbandonedCheckoutsForRecovery() {
  const abandonedCheckouts = await db
    .select()
    .from(lowfySubscriptions)
    .where(
      and(
        eq(lowfySubscriptions.status, 'awaiting_payment'),
        isNull(lowfySubscriptions.userId)
      )
    );

  return abandonedCheckouts;
}

async function hasAlreadySentEmail(subscriptionId: string, emailSequence: number): Promise<boolean> {
  const existing = await db
    .select()
    .from(checkoutRecoveryEmails)
    .where(
      and(
        eq(checkoutRecoveryEmails.subscriptionId, subscriptionId),
        eq(checkoutRecoveryEmails.emailSequence, emailSequence)
      )
    );
  
  return existing.length > 0;
}

async function getLastEmailSentTime(subscriptionId: string, emailSequence: number): Promise<Date | null> {
  const emails = await db
    .select()
    .from(checkoutRecoveryEmails)
    .where(
      and(
        eq(checkoutRecoveryEmails.subscriptionId, subscriptionId),
        eq(checkoutRecoveryEmails.emailSequence, emailSequence)
      )
    )
    .orderBy(sql`${checkoutRecoveryEmails.sentAt} DESC`)
    .limit(1);
  
  return emails.length > 0 ? emails[0].sentAt : null;
}

async function canSendNextEmail(subscriptionId: string, previousSequence: number, minHoursAfterPrevious: number): Promise<boolean> {
  const previousSentAt = await getLastEmailSentTime(subscriptionId, previousSequence);
  if (!previousSentAt) return false;
  
  const now = getNowSaoPaulo();
  const minTimeAfterPrevious = new Date(previousSentAt.getTime() + minHoursAfterPrevious * 60 * 60 * 1000);
  
  return now >= minTimeAfterPrevious;
}

async function hasConvertedAlready(email: string, subscriptionId?: string): Promise<boolean> {
  if (subscriptionId) {
    const subscription = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.id, subscriptionId))
      .limit(1);
    
    if (subscription.length > 0) {
      const status = subscription[0].status;
      if (status !== 'awaiting_payment') {
        logger.debug(`   🔍 Subscription ${subscriptionId} status: ${status} (converted)`);
        return true;
      }
      if (subscription[0].userId) {
        logger.debug(`   🔍 Subscription ${subscriptionId} has userId (converted)`);
        return true;
      }
      if (subscription[0].asaasSubscriptionId || subscription[0].asaasPaymentId || 
          subscription[0].podpayTransactionId) {
        logger.debug(`   🔍 Subscription ${subscriptionId} has payment reference - checking for active payments`);
        const paidByOther = await db
          .select()
          .from(lowfySubscriptions)
          .where(
            and(
              eq(lowfySubscriptions.buyerEmail, email),
              inArray(lowfySubscriptions.status, ['active', 'paid', 'pending']),
              sql`${lowfySubscriptions.id} != ${subscriptionId}`
            )
          )
          .limit(1);
        
        if (paidByOther.length > 0) {
          logger.debug(`   🔍 Found other paid subscription for ${email}`);
          return true;
        }
      }
    }
  }
  
  const converted = await db
    .select()
    .from(lowfySubscriptions)
    .where(
      and(
        eq(lowfySubscriptions.buyerEmail, email),
        inArray(lowfySubscriptions.status, ['active', 'paid'])
      )
    );
  
  return converted.length > 0;
}

async function recordEmailSent(
  subscriptionId: string,
  buyerEmail: string,
  buyerName: string,
  plan: string,
  originalAmount: number,
  emailSequence: number,
  emailType: string,
  discountCode?: string
) {
  await db.insert(checkoutRecoveryEmails).values({
    subscriptionId,
    buyerEmail,
    buyerName,
    plan,
    originalAmount,
    emailSequence,
    emailType,
    sentAt: getNowSaoPaulo(),
    status: 'sent',
    discountCode: discountCode || null,
    discountPercent: discountCode ? 50 : null,
  });
}

async function sendRecoveryEmail1_15min() {
  try {
    logger.debug('\n🛒 [CHECKOUT RECOVERY] Verificando checkouts abandonados (15 min)...');
    
    const fifteenMinutesAgo = minutesAgoSaoPaulo(15);
    const twentyMinutesAgo = minutesAgoSaoPaulo(20);
    
    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          lt(lowfySubscriptions.createdAt, fifteenMinutesAgo),
          gte(lowfySubscriptions.createdAt, twentyMinutesAgo)
        )
      );

    logger.debug(`   📧 Encontrados ${abandonedCheckouts.length} checkouts para email 1 (15 min)`);

    for (const checkout of abandonedCheckouts) {
      try {
        if (await hasConvertedAlready(checkout.buyerEmail, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerEmail} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentEmail(checkout.id, 1)) {
          continue;
        }

        const checkoutUrl = getCheckoutUrlForRecovery(checkout.plan, checkout.id);
        const emailHtml = generateCheckoutRecoveryEmail1(
          checkout.buyerName,
          checkout.plan as 'mensal' | 'anual',
          checkoutUrl
        );

        await sendEmail({
          to: checkout.buyerEmail,
          subject: '👋 Oi! Você esqueceu algo...',
          html: emailHtml,
        });

        await recordEmailSent(
          checkout.id,
          checkout.buyerEmail,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          1,
          '15min'
        );

        logger.debug(`   ✅ Email 1 (15min) enviado para: ${checkout.buyerEmail}`);
      } catch (emailError) {
        logger.error(`   ❌ Erro ao enviar email 1 para ${checkout.buyerEmail}:`, emailError);
      }
    }
  } catch (error) {
    logger.error('❌ [CHECKOUT RECOVERY] Erro no email 1 (15min):', error);
  }
}

async function sendRecoveryEmail2_Morning() {
  try {
    logger.debug('\n🛒 [CHECKOUT RECOVERY] Verificando checkouts para email matinal...');
    
    const yesterday = daysAgoSaoPaulo(1);
    const twoDaysAgo = daysAgoSaoPaulo(2);
    
    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          lt(lowfySubscriptions.createdAt, yesterday),
          gte(lowfySubscriptions.createdAt, twoDaysAgo)
        )
      );

    logger.debug(`   📧 Encontrados ${abandonedCheckouts.length} checkouts para email 2 (manhã)`);

    for (const checkout of abandonedCheckouts) {
      try {
        if (await hasConvertedAlready(checkout.buyerEmail, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerEmail} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentEmail(checkout.id, 2)) {
          continue;
        }

        const email1Sent = await hasAlreadySentEmail(checkout.id, 1);
        if (!email1Sent) {
          continue;
        }

        if (!await canSendNextEmail(checkout.id, 1, 8)) {
          continue;
        }

        const checkoutUrl = getCheckoutUrlForRecovery(checkout.plan, checkout.id);
        const emailHtml = generateCheckoutRecoveryEmail2(
          checkout.buyerName,
          checkout.plan as 'mensal' | 'anual',
          checkoutUrl
        );

        await sendEmail({
          to: checkout.buyerEmail,
          subject: '☀️ Bom dia! Seu negócio digital te espera...',
          html: emailHtml,
        });

        await recordEmailSent(
          checkout.id,
          checkout.buyerEmail,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          2,
          'morning'
        );

        logger.debug(`   ✅ Email 2 (manhã) enviado para: ${checkout.buyerEmail}`);
      } catch (emailError) {
        logger.error(`   ❌ Erro ao enviar email 2 para ${checkout.buyerEmail}:`, emailError);
      }
    }
  } catch (error) {
    logger.error('❌ [CHECKOUT RECOVERY] Erro no email 2 (manhã):', error);
  }
}

async function sendRecoveryEmail3_Evening() {
  try {
    logger.debug('\n🛒 [CHECKOUT RECOVERY] Verificando checkouts para email noturno...');
    
    const yesterday = daysAgoSaoPaulo(1);
    const twoDaysAgo = daysAgoSaoPaulo(2);
    
    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          lt(lowfySubscriptions.createdAt, yesterday),
          gte(lowfySubscriptions.createdAt, twoDaysAgo)
        )
      );

    logger.debug(`   📧 Encontrados ${abandonedCheckouts.length} checkouts para email 3 (noite)`);

    for (const checkout of abandonedCheckouts) {
      try {
        if (await hasConvertedAlready(checkout.buyerEmail, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerEmail} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentEmail(checkout.id, 3)) {
          continue;
        }

        const email2Sent = await hasAlreadySentEmail(checkout.id, 2);
        if (!email2Sent) {
          continue;
        }

        if (!await canSendNextEmail(checkout.id, 2, 8)) {
          continue;
        }

        const checkoutUrl = getCheckoutUrlForRecovery(checkout.plan, checkout.id);
        const emailHtml = generateCheckoutRecoveryEmail3(
          checkout.buyerName,
          checkout.plan as 'mensal' | 'anual',
          checkoutUrl
        );

        await sendEmail({
          to: checkout.buyerEmail,
          subject: '⏰ Seu carrinho vai expirar em breve...',
          html: emailHtml,
        });

        await recordEmailSent(
          checkout.id,
          checkout.buyerEmail,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          3,
          'evening'
        );

        logger.debug(`   ✅ Email 3 (noite) enviado para: ${checkout.buyerEmail}`);
      } catch (emailError) {
        logger.error(`   ❌ Erro ao enviar email 3 para ${checkout.buyerEmail}:`, emailError);
      }
    }
  } catch (error) {
    logger.error('❌ [CHECKOUT RECOVERY] Erro no email 3 (noite):', error);
  }
}

async function sendRecoveryEmail4_NextDayDiscount() {
  try {
    logger.debug('\n🛒 [CHECKOUT RECOVERY] Verificando checkouts para email com 50% desconto...');
    
    const twoDaysAgo = daysAgoSaoPaulo(2);
    const threeDaysAgo = daysAgoSaoPaulo(3);
    
    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          lt(lowfySubscriptions.createdAt, twoDaysAgo),
          gte(lowfySubscriptions.createdAt, threeDaysAgo)
        )
      );

    logger.debug(`   📧 Encontrados ${abandonedCheckouts.length} checkouts para email 4 (50% desconto)`);

    for (const checkout of abandonedCheckouts) {
      try {
        if (await hasConvertedAlready(checkout.buyerEmail, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerEmail} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentEmail(checkout.id, 4)) {
          continue;
        }

        const email3Sent = await hasAlreadySentEmail(checkout.id, 3);
        if (!email3Sent) {
          continue;
        }

        if (!await canSendNextEmail(checkout.id, 3, 12)) {
          continue;
        }

        const discountCode = generateDiscountCode();
        const checkoutUrlWithDiscount = getCheckoutUrlForRecovery(checkout.plan, checkout.id, discountCode);
        
        // IMPORTANTE: Usar o valor real da assinatura do checkout, NÃO valores fixos
        // Isso garante que o desconto de 50% funcione corretamente com QUALQUER valor
        const originalAmount = checkout.amount;
        
        const emailHtml = generateCheckoutRecoveryEmail4WithDiscount(
          checkout.buyerName,
          checkout.plan as 'mensal' | 'anual',
          originalAmount,
          discountCode,
          checkoutUrlWithDiscount
        );

        await sendEmail({
          to: checkout.buyerEmail,
          subject: '🔥 ÚLTIMA CHANCE: 50% OFF só para você!',
          html: emailHtml,
        });

        await recordEmailSent(
          checkout.id,
          checkout.buyerEmail,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          4,
          'next_day_discount',
          discountCode
        );

        logger.debug(`   ✅ Email 4 (50% OFF - ${discountCode}) enviado para: ${checkout.buyerEmail}`);
      } catch (emailError) {
        logger.error(`   ❌ Erro ao enviar email 4 para ${checkout.buyerEmail}:`, emailError);
      }
    }
  } catch (error) {
    logger.error('❌ [CHECKOUT RECOVERY] Erro no email 4 (desconto):', error);
  }
}

export function startCheckoutRecoveryScheduler() {
  logger.debug('\n🛒 [CHECKOUT RECOVERY] Agendador de recuperação de checkout iniciado!');
  logger.debug('📅 Programação:');
  logger.debug('   • Email 1 (15min): A cada 5 minutos');
  logger.debug('   • Email 2 (manhã): Todos os dias às 09:00');
  logger.debug('   • Email 3 (noite): Todos os dias às 20:00');
  logger.debug('   • Email 4 (50% OFF): Todos os dias às 10:00\n');

  cron.schedule('*/5 * * * *', async () => {
    await sendRecoveryEmail1_15min();
  }, {
    timezone: "America/Sao_Paulo"
  });

  cron.schedule('0 9 * * *', async () => {
    logger.debug('\n⏰ [CHECKOUT RECOVERY] Executando email 2 (manhã)...');
    await sendRecoveryEmail2_Morning();
  }, {
    timezone: "America/Sao_Paulo"
  });

  cron.schedule('0 20 * * *', async () => {
    logger.debug('\n⏰ [CHECKOUT RECOVERY] Executando email 3 (noite)...');
    await sendRecoveryEmail3_Evening();
  }, {
    timezone: "America/Sao_Paulo"
  });

  cron.schedule('0 10 * * *', async () => {
    logger.debug('\n⏰ [CHECKOUT RECOVERY] Executando email 4 (50% desconto)...');
    await sendRecoveryEmail4_NextDayDiscount();
  }, {
    timezone: "America/Sao_Paulo"
  });

  logger.debug('✅ Agendador de recuperação de checkout ativo e funcionando!\n');
}

export { 
  sendRecoveryEmail1_15min, 
  sendRecoveryEmail2_Morning, 
  sendRecoveryEmail3_Evening, 
  sendRecoveryEmail4_NextDayDiscount 
};
