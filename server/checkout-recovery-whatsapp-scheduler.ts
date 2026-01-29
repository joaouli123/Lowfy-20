import cron from 'node-cron';
import { db } from './db';
import { lowfySubscriptions, checkoutRecoveryWhatsapp } from '@shared/schema';
import { eq, and, isNull, lt, gte, inArray, sql } from 'drizzle-orm';
import { logger } from './utils/logger';
import crypto from 'crypto';
import { getNowSaoPaulo, minutesAgoSaoPaulo } from '@shared/dateUtils';
import { getCheckoutUrl } from '@shared/domainConfig';
import { whatsappService } from './whatsapp';

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

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateWhatsAppMessage1(name: string, plan: string, checkoutUrl: string): string {
  const firstName = name.split(' ')[0];
  const planName = plan === 'anual' ? 'Anual' : 'Mensal';
  
  return `Oi ${firstName}! 👋

Vi que você começou sua assinatura ${planName} da Lowfy mas não finalizou.

Aconteceu algo? Posso te ajudar com alguma dúvida?

👉 Continue de onde parou: ${checkoutUrl}

Qualquer coisa, só responder aqui! 😊`;
}

function generateWhatsAppMessage2(name: string, plan: string, checkoutUrl: string): string {
  const firstName = name.split(' ')[0];
  
  return `${firstName}, ainda dá tempo! ⏰

Sua reserva na Lowfy ainda está disponível.

✅ Acesso imediato a todos os PLRs
✅ Ferramentas de IA exclusivas
✅ Suporte prioritário

Finaliza antes que expire: ${checkoutUrl}`;
}

function generateWhatsAppMessage3WithDiscount(
  name: string, 
  plan: string, 
  originalAmount: number,
  discountCode: string,
  checkoutUrl: string
): string {
  const firstName = name.split(' ')[0];
  const discountedAmount = originalAmount / 2;
  
  return `🔥 *ÚLTIMA CHANCE* - 50% OFF só pra você, ${firstName}!

De ${formatCurrency(originalAmount)} por apenas *${formatCurrency(discountedAmount)}*

Seu cupom exclusivo: *${discountCode}*

Essa é sua última oportunidade de entrar na Lowfy com desconto especial.

👉 Aproveita agora: ${checkoutUrl}

⚠️ Válido apenas por 24h!`;
}

async function hasAlreadySentWhatsApp(subscriptionId: string, messageSequence: number): Promise<boolean> {
  const existing = await db
    .select()
    .from(checkoutRecoveryWhatsapp)
    .where(
      and(
        eq(checkoutRecoveryWhatsapp.subscriptionId, subscriptionId),
        eq(checkoutRecoveryWhatsapp.messageSequence, messageSequence)
      )
    );
  
  return existing.length > 0;
}

async function getLastWhatsAppSentTime(subscriptionId: string, messageSequence: number): Promise<Date | null> {
  const messages = await db
    .select()
    .from(checkoutRecoveryWhatsapp)
    .where(
      and(
        eq(checkoutRecoveryWhatsapp.subscriptionId, subscriptionId),
        eq(checkoutRecoveryWhatsapp.messageSequence, messageSequence)
      )
    )
    .orderBy(sql`${checkoutRecoveryWhatsapp.sentAt} DESC`)
    .limit(1);
  
  return messages.length > 0 ? messages[0].sentAt : null;
}

async function canSendNextWhatsApp(subscriptionId: string, previousSequence: number, minHoursAfterPrevious: number): Promise<boolean> {
  const previousSentAt = await getLastWhatsAppSentTime(subscriptionId, previousSequence);
  if (!previousSentAt) return false;
  
  const now = getNowSaoPaulo();
  const minTimeAfterPrevious = new Date(previousSentAt.getTime() + minHoursAfterPrevious * 60 * 60 * 1000);
  
  return now >= minTimeAfterPrevious;
}

async function hasConvertedAlready(phone: string, subscriptionId?: string): Promise<boolean> {
  if (subscriptionId) {
    const subscription = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.id, subscriptionId))
      .limit(1);
    
    if (subscription.length > 0) {
      const status = subscription[0].status;
      if (status !== 'awaiting_payment') {
        return true;
      }
      if (subscription[0].userId) {
        return true;
      }
    }
  }
  
  const converted = await db
    .select()
    .from(lowfySubscriptions)
    .where(
      and(
        eq(lowfySubscriptions.buyerPhone, phone),
        inArray(lowfySubscriptions.status, ['active', 'paid'])
      )
    );
  
  return converted.length > 0;
}

async function recordWhatsAppSent(
  subscriptionId: string,
  buyerPhone: string,
  buyerName: string,
  plan: string,
  originalAmount: number,
  messageSequence: number,
  messageType: string,
  discountCode?: string
) {
  await db.insert(checkoutRecoveryWhatsapp).values({
    subscriptionId,
    buyerPhone,
    buyerName,
    plan,
    originalAmount,
    messageSequence,
    messageType,
    sentAt: getNowSaoPaulo(),
    status: 'sent',
    discountCode: discountCode || null,
    discountPercent: discountCode ? 50 : null,
  });
}

async function sendRecoveryWhatsApp1_30min() {
  try {
    if (!whatsappService.isConnected()) {
      logger.debug('📱 [WHATSAPP RECOVERY] WhatsApp não conectado, pulando...');
      return;
    }

    logger.debug('\n📱 [WHATSAPP RECOVERY] Verificando checkouts abandonados (30 min)...');
    
    const thirtyMinutesAgo = minutesAgoSaoPaulo(30);
    const fortyMinutesAgo = minutesAgoSaoPaulo(40);
    
    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          lt(lowfySubscriptions.createdAt, thirtyMinutesAgo),
          gte(lowfySubscriptions.createdAt, fortyMinutesAgo)
        )
      );

    const checkoutsWithPhone = abandonedCheckouts.filter(c => c.buyerPhone);
    logger.debug(`   📱 Encontrados ${checkoutsWithPhone.length} checkouts com telefone para WhatsApp 1 (30 min)`);

    for (const checkout of checkoutsWithPhone) {
      try {
        if (!checkout.buyerPhone) continue;

        if (await hasConvertedAlready(checkout.buyerPhone, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerPhone} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentWhatsApp(checkout.id, 1)) {
          continue;
        }

        const formattedPhone = formatPhoneForWhatsApp(checkout.buyerPhone);
        const checkoutUrl = getCheckoutUrlForRecovery(checkout.plan, checkout.id);
        const message = generateWhatsAppMessage1(
          checkout.buyerName,
          checkout.plan,
          checkoutUrl
        );

        await whatsappService.sendMessage(formattedPhone, message);

        await recordWhatsAppSent(
          checkout.id,
          checkout.buyerPhone,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          1,
          '30min'
        );

        logger.debug(`   ✅ WhatsApp 1 (30min) enviado para: ${checkout.buyerPhone}`);
      } catch (whatsappError) {
        logger.error(`   ❌ Erro ao enviar WhatsApp 1 para ${checkout.buyerPhone}:`, whatsappError);
      }
    }
  } catch (error) {
    logger.error('❌ [WHATSAPP RECOVERY] Erro no WhatsApp 1 (30min):', error);
  }
}

async function sendRecoveryWhatsApp2_24h() {
  try {
    if (!whatsappService.isConnected()) {
      logger.debug('📱 [WHATSAPP RECOVERY] WhatsApp não conectado, pulando...');
      return;
    }

    logger.debug('\n📱 [WHATSAPP RECOVERY] Verificando checkouts para WhatsApp 2 (24h)...');
    
    const sentMessage1 = await db
      .select({
        subscriptionId: checkoutRecoveryWhatsapp.subscriptionId,
        sentAt: checkoutRecoveryWhatsapp.sentAt,
      })
      .from(checkoutRecoveryWhatsapp)
      .where(eq(checkoutRecoveryWhatsapp.messageSequence, 1));
    
    const subscriptionIds = sentMessage1.map(m => m.subscriptionId);
    
    if (subscriptionIds.length === 0) {
      logger.debug('   📱 Nenhum checkout com mensagem 1 enviada encontrado');
      return;
    }

    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          inArray(lowfySubscriptions.id, subscriptionIds)
        )
      );

    const checkoutsWithPhone = abandonedCheckouts.filter(c => c.buyerPhone);
    logger.debug(`   📱 Encontrados ${checkoutsWithPhone.length} checkouts elegíveis para WhatsApp 2`);

    for (const checkout of checkoutsWithPhone) {
      try {
        if (!checkout.buyerPhone) continue;

        if (await hasConvertedAlready(checkout.buyerPhone, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerPhone} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentWhatsApp(checkout.id, 2)) {
          continue;
        }

        if (!await canSendNextWhatsApp(checkout.id, 1, 12)) {
          continue;
        }

        const formattedPhone = formatPhoneForWhatsApp(checkout.buyerPhone);
        const checkoutUrl = getCheckoutUrlForRecovery(checkout.plan, checkout.id);
        const message = generateWhatsAppMessage2(
          checkout.buyerName,
          checkout.plan,
          checkoutUrl
        );

        await whatsappService.sendMessage(formattedPhone, message);

        await recordWhatsAppSent(
          checkout.id,
          checkout.buyerPhone,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          2,
          '24h'
        );

        logger.debug(`   ✅ WhatsApp 2 (24h) enviado para: ${checkout.buyerPhone}`);
      } catch (whatsappError) {
        logger.error(`   ❌ Erro ao enviar WhatsApp 2 para ${checkout.buyerPhone}:`, whatsappError);
      }
    }
  } catch (error) {
    logger.error('❌ [WHATSAPP RECOVERY] Erro no WhatsApp 2 (24h):', error);
  }
}

async function sendRecoveryWhatsApp3_48hDiscount() {
  try {
    if (!whatsappService.isConnected()) {
      logger.debug('📱 [WHATSAPP RECOVERY] WhatsApp não conectado, pulando...');
      return;
    }

    logger.debug('\n📱 [WHATSAPP RECOVERY] Verificando checkouts para WhatsApp 3 (48h com desconto)...');
    
    const sentMessage2 = await db
      .select({
        subscriptionId: checkoutRecoveryWhatsapp.subscriptionId,
        sentAt: checkoutRecoveryWhatsapp.sentAt,
      })
      .from(checkoutRecoveryWhatsapp)
      .where(eq(checkoutRecoveryWhatsapp.messageSequence, 2));
    
    const subscriptionIds = sentMessage2.map(m => m.subscriptionId);
    
    if (subscriptionIds.length === 0) {
      logger.debug('   📱 Nenhum checkout com mensagem 2 enviada encontrado');
      return;
    }

    const abandonedCheckouts = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.status, 'awaiting_payment'),
          isNull(lowfySubscriptions.userId),
          inArray(lowfySubscriptions.id, subscriptionIds)
        )
      );

    const checkoutsWithPhone = abandonedCheckouts.filter(c => c.buyerPhone);
    logger.debug(`   📱 Encontrados ${checkoutsWithPhone.length} checkouts elegíveis para WhatsApp 3 (desconto)`);

    for (const checkout of checkoutsWithPhone) {
      try {
        if (!checkout.buyerPhone) continue;

        if (await hasConvertedAlready(checkout.buyerPhone, checkout.id)) {
          logger.debug(`   ⏭️ ${checkout.buyerPhone} já converteu, pulando...`);
          continue;
        }

        if (await hasAlreadySentWhatsApp(checkout.id, 3)) {
          continue;
        }

        const whatsapp2Sent = await hasAlreadySentWhatsApp(checkout.id, 2);
        if (!whatsapp2Sent) {
          continue;
        }

        if (!await canSendNextWhatsApp(checkout.id, 2, 20)) {
          continue;
        }

        const discountCode = generateDiscountCode();
        const formattedPhone = formatPhoneForWhatsApp(checkout.buyerPhone);
        const checkoutUrlWithDiscount = getCheckoutUrlForRecovery(checkout.plan, checkout.id, discountCode);
        
        const message = generateWhatsAppMessage3WithDiscount(
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          discountCode,
          checkoutUrlWithDiscount
        );

        await whatsappService.sendMessage(formattedPhone, message);

        await recordWhatsAppSent(
          checkout.id,
          checkout.buyerPhone,
          checkout.buyerName,
          checkout.plan,
          checkout.amount,
          3,
          '48h_discount',
          discountCode
        );

        logger.debug(`   ✅ WhatsApp 3 (48h - ${discountCode}) enviado para: ${checkout.buyerPhone}`);
      } catch (whatsappError) {
        logger.error(`   ❌ Erro ao enviar WhatsApp 3 para ${checkout.buyerPhone}:`, whatsappError);
      }
    }
  } catch (error) {
    logger.error('❌ [WHATSAPP RECOVERY] Erro no WhatsApp 3 (desconto):', error);
  }
}

export function startWhatsAppRecoveryScheduler() {
  logger.debug('\n📱 [WHATSAPP RECOVERY] Agendador de recuperação por WhatsApp iniciado!');
  logger.debug('📅 Programação:');
  logger.debug('   • Mensagem 1 (30min): A cada 10 minutos');
  logger.debug('   • Mensagem 2 (24h): Todos os dias às 11:00 e 18:00');
  logger.debug('   • Mensagem 3 (48h + 50% OFF): Todos os dias às 10:00\n');

  cron.schedule('*/10 * * * *', async () => {
    await sendRecoveryWhatsApp1_30min();
  }, {
    timezone: "America/Sao_Paulo"
  });

  cron.schedule('0 11,18 * * *', async () => {
    logger.debug('\n⏰ [WHATSAPP RECOVERY] Executando WhatsApp 2 (24h)...');
    await sendRecoveryWhatsApp2_24h();
  }, {
    timezone: "America/Sao_Paulo"
  });

  cron.schedule('0 10 * * *', async () => {
    logger.debug('\n⏰ [WHATSAPP RECOVERY] Executando WhatsApp 3 (48h desconto)...');
    await sendRecoveryWhatsApp3_48hDiscount();
  }, {
    timezone: "America/Sao_Paulo"
  });

  logger.debug('✅ Agendador de recuperação por WhatsApp ativo e funcionando!\n');
}

export { 
  sendRecoveryWhatsApp1_30min, 
  sendRecoveryWhatsApp2_24h, 
  sendRecoveryWhatsApp3_48hDiscount 
};
