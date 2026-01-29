import * as fs from 'fs';
import * as path from 'path';
import cron from 'node-cron';
import { db } from '../db';
import { users, pageClones, lowfySubscriptions } from '@shared/schema';
import { eq, and, lt, isNotNull, ne, isNull, or } from 'drizzle-orm';
import { logger } from '../utils/logger';

interface PageMetadata {
  userId: string | null;
  originalName: string;
  createdAt: string;
  viewCount: number;
  requiresDomain: boolean;
  customDomain: string | null;
  domainAddedAt: string | null;
  isActive: boolean;
  deactivatedAt?: string;
  deactivationReason?: string;
}

async function getExpiredSubscriptionUsers(): Promise<{ id: string; subscriptionExpiresAt: Date }[]> {
  const now = new Date();
  const result = await db
    .select({ id: users.id, subscriptionExpiresAt: users.subscriptionExpiresAt })
    .from(users)
    .where(
      and(
        lt(users.subscriptionExpiresAt, now),
        isNotNull(users.subscriptionExpiresAt)
      )
    );
  
  return result.filter(u => u.subscriptionExpiresAt !== null).map(u => ({
    id: u.id,
    subscriptionExpiresAt: u.subscriptionExpiresAt as Date
  }));
}

function getDaysExpired(expiresAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - expiresAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function processClonedPages(userId: string, daysExpired: number): Promise<void> {
  const clonedPagesDir = path.join(process.cwd(), 'cloned-pages');
  
  if (!fs.existsSync(clonedPagesDir)) {
    return;
  }

  const files = fs.readdirSync(clonedPagesDir);
  const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

  for (const metaFile of metadataFiles) {
    try {
      const metaPath = path.join(clonedPagesDir, metaFile);
      const content = fs.readFileSync(metaPath, 'utf-8');
      const metadata: PageMetadata = JSON.parse(content);

      if (metadata.userId !== userId) {
        continue;
      }

      const slug = metaFile.replace('.metadata.json', '');
      const htmlPath = path.join(clonedPagesDir, `${slug}.html`);

      if (daysExpired >= 10) {
        logger.info(`[SubscriptionPageManager] Deletando página ${slug} do usuário ${userId} (${daysExpired} dias expirado)`);
        
        if (fs.existsSync(htmlPath)) {
          fs.unlinkSync(htmlPath);
        }
        fs.unlinkSync(metaPath);
        
        logger.info(`[SubscriptionPageManager] Página ${slug} deletada permanentemente`);
      } else if (daysExpired >= 0 && metadata.isActive) {
        logger.info(`[SubscriptionPageManager] Desativando página ${slug} do usuário ${userId} (${daysExpired} dias expirado)`);
        
        metadata.isActive = false;
        metadata.deactivatedAt = new Date().toISOString();
        metadata.deactivationReason = 'subscription_expired';
        
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
        
        logger.info(`[SubscriptionPageManager] Página ${slug} desativada`);
      }
    } catch (error) {
      logger.error(`[SubscriptionPageManager] Erro ao processar ${metaFile}:`, error);
    }
  }
}

async function processPresellPages(userId: string, daysExpired: number): Promise<void> {
  const presellPagesDir = path.join(process.cwd(), 'presell-pages');
  
  if (!fs.existsSync(presellPagesDir)) {
    return;
  }

  const files = fs.readdirSync(presellPagesDir);
  const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));

  for (const metaFile of metadataFiles) {
    try {
      const metaPath = path.join(presellPagesDir, metaFile);
      const content = fs.readFileSync(metaPath, 'utf-8');
      const metadata: PageMetadata = JSON.parse(content);

      if (metadata.userId !== userId) {
        continue;
      }

      const pageName = metaFile.replace('.metadata.json', '');
      const jsonPath = path.join(presellPagesDir, `${pageName}.json`);

      if (daysExpired >= 10) {
        logger.info(`[SubscriptionPageManager] Deletando Pre-Sell ${pageName} do usuário ${userId} (${daysExpired} dias expirado)`);
        
        if (fs.existsSync(jsonPath)) {
          fs.unlinkSync(jsonPath);
        }
        fs.unlinkSync(metaPath);
        
        logger.info(`[SubscriptionPageManager] Pre-Sell ${pageName} deletada permanentemente`);
      } else if (daysExpired >= 0 && metadata.isActive) {
        logger.info(`[SubscriptionPageManager] Desativando Pre-Sell ${pageName} do usuário ${userId} (${daysExpired} dias expirado)`);
        
        metadata.isActive = false;
        metadata.deactivatedAt = new Date().toISOString();
        metadata.deactivationReason = 'subscription_expired';
        
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
        
        logger.info(`[SubscriptionPageManager] Pre-Sell ${pageName} desativada`);
      }
    } catch (error) {
      logger.error(`[SubscriptionPageManager] Erro ao processar Pre-Sell ${metaFile}:`, error);
    }
  }
}

async function runSubscriptionPageCleanup(): Promise<void> {
  logger.info('[SubscriptionPageManager] Iniciando limpeza de páginas de assinaturas expiradas...');
  
  try {
    const expiredUsers = await getExpiredSubscriptionUsers();
    logger.info(`[SubscriptionPageManager] Encontrados ${expiredUsers.length} usuários com assinatura expirada`);

    for (const user of expiredUsers) {
      const daysExpired = getDaysExpired(user.subscriptionExpiresAt);
      logger.debug(`[SubscriptionPageManager] Processando usuário ${user.id} - ${daysExpired} dias expirado`);

      await processClonedPages(user.id, daysExpired);
      await processPresellPages(user.id, daysExpired);
    }

    logger.info('[SubscriptionPageManager] Limpeza de páginas concluída com sucesso');
  } catch (error) {
    logger.error('[SubscriptionPageManager] Erro durante a limpeza:', error);
  }
}

// ==================== SINCRONIZAÇÃO DE ASSINATURAS ====================
// Verifica e corrige assinaturas com status inconsistente
// (ex: assinatura "active" mas usuário com subscription_status "none")
async function syncInconsistentSubscriptions(): Promise<void> {
  logger.info('[SubscriptionSync] 🔄 Iniciando sincronização de assinaturas...');
  
  try {
    // Buscar assinaturas ativas que não têm o usuário sincronizado
    const activeSubscriptions = await db
      .select({
        subscriptionId: lowfySubscriptions.id,
        userId: lowfySubscriptions.userId,
        buyerEmail: lowfySubscriptions.buyerEmail,
        plan: lowfySubscriptions.plan,
        status: lowfySubscriptions.status,
        paidAt: lowfySubscriptions.paidAt,
        nextPaymentDate: lowfySubscriptions.nextPaymentDate,
      })
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.status, 'active'));
    
    let fixedCount = 0;
    
    for (const subscription of activeSubscriptions) {
      if (!subscription.userId) continue;
      
      // Verificar status do usuário
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
        })
        .from(users)
        .where(eq(users.id, subscription.userId))
        .limit(1);
      
      if (!user) continue;
      
      // Se assinatura está ativa mas usuário não está, CORRIGIR!
      if (user.subscriptionStatus !== 'active') {
        logger.warn(`[SubscriptionSync] ⚠️ Inconsistência detectada! Usuário ${user.email} tem assinatura ativa mas subscription_status='${user.subscriptionStatus}'`);
        
        // Calcular data de expiração se não existir
        let expiresAt = subscription.nextPaymentDate;
        if (!expiresAt) {
          const now = new Date();
          expiresAt = new Date(now);
          if (subscription.plan === 'anual') {
            expiresAt.setDate(expiresAt.getDate() + 365);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 30);
          }
        }
        
        // Corrigir o status do usuário
        await db
          .update(users)
          .set({
            subscriptionStatus: 'active',
            subscriptionExpiresAt: expiresAt,
            accountStatus: 'active',
            updatedAt: new Date(),
          })
          .where(eq(users.id, subscription.userId));
        
        // Se paidAt estiver vazio na assinatura, preencher
        if (!subscription.paidAt) {
          await db
            .update(lowfySubscriptions)
            .set({
              paidAt: new Date(),
              nextPaymentDate: expiresAt,
              updatedAt: new Date(),
            })
            .where(eq(lowfySubscriptions.id, subscription.subscriptionId));
        }
        
        logger.info(`[SubscriptionSync] ✅ Usuário ${user.email} corrigido! subscription_status='active', expira em ${expiresAt.toISOString()}`);
        fixedCount++;
      }
    }
    
    if (fixedCount > 0) {
      logger.info(`[SubscriptionSync] ✅ Sincronização concluída! ${fixedCount} assinatura(s) corrigida(s)`);
    } else {
      logger.info('[SubscriptionSync] ✅ Todas as assinaturas estão sincronizadas corretamente');
    }
    
  } catch (error) {
    logger.error('[SubscriptionSync] ❌ Erro durante sincronização:', error);
  }
}

export function initSubscriptionPageManager(): void {
  // Job de limpeza de páginas expiradas - 03:00 diariamente
  cron.schedule('0 3 * * *', async () => {
    logger.info('[SubscriptionPageManager] Executando job de limpeza programado (03:00)');
    await runSubscriptionPageCleanup();
  }, { timezone: "America/Sao_Paulo" });

  // Job de sincronização de assinaturas - A CADA HORA
  // Verifica e corrige assinaturas com status inconsistente
  cron.schedule('0 * * * *', async () => {
    await syncInconsistentSubscriptions();
  }, { timezone: "America/Sao_Paulo" });

  logger.info('[SubscriptionPageManager] Job de limpeza de páginas agendado para 03:00 diariamente');
  logger.info('[SubscriptionSync] 🔄 Job de sincronização de assinaturas agendado para rodar A CADA HORA');
}

// Executar sincronização imediata ao iniciar o servidor
export async function runInitialSubscriptionSync(): Promise<void> {
  logger.info('[SubscriptionSync] 🚀 Executando sincronização inicial...');
  await syncInconsistentSubscriptions();
}

export { runSubscriptionPageCleanup, syncInconsistentSubscriptions };
