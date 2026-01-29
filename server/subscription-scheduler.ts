import cron from 'node-cron';
import { storage } from './storage';
import { 
  sendEmail, 
  generatePixExpirationWarningEmail,
  generateRetentionEmail 
} from './email';
import { logger } from './utils/logger';
import { getNowSaoPaulo, addDaysSaoPaulo, formatDateTimeBR } from '@shared/dateUtils';
import { getCheckoutUrl } from '@shared/domainConfig';

const CHECKOUT_URL_MENSAL = getCheckoutUrl('/assinatura/checkout?plan=mensal');
const CHECKOUT_URL_ANUAL = getCheckoutUrl('/assinatura/checkout?plan=anual');

async function sendLowfyPixExpirationWarnings() {
  try {
    logger.debug('\n📧 [LOWFY SUBSCRIPTION] Verificando assinaturas Lowfy PIX expirando...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));

    for (const daysRemaining of [4, 3, 2, 1]) {
      const subscriptions = await storage.getActivePixSubscriptionsExpiringInLowfy(daysRemaining);
      
      logger.debug(`   📅 ${daysRemaining} dia(s): ${subscriptions.length} assinatura(s) Lowfy encontrada(s)`);

      for (const { subscription, user } of subscriptions) {
        try {
          const expirationDate = subscription.nextPaymentDate?.toISOString() || getNowSaoPaulo().toISOString();
          const checkoutUrl = subscription.plan === 'anual' ? CHECKOUT_URL_ANUAL : CHECKOUT_URL_MENSAL;
          
          const emailHtml = generatePixExpirationWarningEmail(
            user.name,
            daysRemaining,
            expirationDate,
            checkoutUrl
          );

          await sendEmail({
            to: user.email,
            subject: daysRemaining <= 1 
              ? '🚨 Última chance! Sua assinatura expira amanhã'
              : `📅 Aviso: Sua assinatura expira em ${daysRemaining} dias`,
            html: emailHtml,
          });

          logger.debug(`   ✅ Email de aviso Lowfy enviado para: ${user.email}`);
        } catch (emailError) {
          logger.error(`   ❌ Erro ao enviar email Lowfy para ${user.email}:`, emailError);
        }
      }
    }

    logger.debug('✅ [LOWFY SUBSCRIPTION] Verificação de expirações PIX Lowfy concluída!\n');
  } catch (error) {
    logger.error('❌ [LOWFY SUBSCRIPTION] Erro ao verificar expirações PIX Lowfy:', error);
  }
}

async function sendRetentionEmails() {
  try {
    logger.debug('\n📧 [SUBSCRIPTION] Verificando usuários com assinatura expirada...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));

    const expiredUsersWithPages = await storage.getExpiredSubscriptionsWithPages();
    
    logger.debug(`   👥 ${expiredUsersWithPages.length} usuário(s) com páginas encontrado(s)`);

    for (const { user, pagesCount } of expiredUsersWithPages) {
      try {
        const deletionDate = addDaysSaoPaulo(getNowSaoPaulo(), 10);

        const emailHtml = generateRetentionEmail(
          user.name,
          pagesCount,
          deletionDate.toISOString(),
          CHECKOUT_URL_MENSAL
        );

        await sendEmail({
          to: user.email,
          subject: '🚨 Sua assinatura expirou - Suas páginas serão excluídas em 10 dias',
          html: emailHtml,
        });

        logger.debug(`   ✅ Email de retenção enviado para: ${user.email} (${pagesCount} páginas)`);
      } catch (emailError) {
        logger.error(`   ❌ Erro ao enviar email de retenção para ${user.email}:`, emailError);
      }
    }

    logger.debug('✅ [SUBSCRIPTION] Verificação de retenção concluída!\n');
  } catch (error) {
    logger.error('❌ [SUBSCRIPTION] Erro ao verificar retenção:', error);
  }
}

export function startSubscriptionScheduler() {
  logger.debug('📧 [SUBSCRIPTION] Agendador de notificações de assinatura iniciado!');
  logger.debug('📅 Programação: Todos os dias às 09:00 (horário de Brasília)');
  logger.debug('   • Avisos de expiração PIX Lowfy (4, 3, 2, 1 dias antes)');
  logger.debug('   • Emails de retenção (assinaturas expiradas com páginas)\n');

  cron.schedule('0 9 * * *', async () => {
    logger.debug('\n⏰ [SUBSCRIPTION] Executando verificações diárias de assinatura...');
    await sendLowfyPixExpirationWarnings();
    await sendRetentionEmails();
  }, {
    timezone: "America/Sao_Paulo"
  });

  logger.debug('✅ Agendador de assinaturas ativo e funcionando!\n');
}

export { sendLowfyPixExpirationWarnings, sendRetentionEmails };
