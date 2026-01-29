import cron from 'node-cron';
import { storage } from './storage';
import { DAILY_ACTIVITIES, WEEKLY_CHALLENGES, getCurrentWeekBoundaries } from './gamification';
import { logger } from './utils/logger';
import { getNowSaoPaulo, startOfDaySaoPaulo, formatDateTimeBR } from '@shared/dateUtils';

// Reset daily activities (runs at midnight)
async function resetDailyActivities() {
  try {
    logger.debug('\n🔄 [GAMIFICATION] Resetando atividades diárias...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));
    
    const result = await storage.resetDailyActivities();
    
    logger.debug('✅ [GAMIFICATION] Atividades diárias resetadas com sucesso!');
    logger.debug(`   👥 ${result.usersAffected} usuários afetados`);
    logger.debug(`   📝 ${result.activitiesReset} atividades resetadas\n`);
    
    return result;
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao resetar atividades diárias:', error);
    return { success: false, usersAffected: 0, activitiesReset: 0 };
  }
}

// Reset weekly challenges (runs on Sunday at 23:59)
async function resetWeeklyChallenges() {
  try {
    logger.debug('\n🏆 [GAMIFICATION] Resetando desafios semanais...');
    logger.debug('📅 Data/Hora:', formatDateTimeBR(getNowSaoPaulo()));
    
    const result = await storage.resetWeeklyChallenges();
    
    logger.debug('✅ [GAMIFICATION] Desafios semanais resetados com sucesso!');
    logger.debug(`   👥 ${result.usersAffected} usuários afetados`);
    logger.debug(`   🎯 ${result.challengesReset} desafios resetados\n`);
    
    return result;
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao resetar desafios semanais:', error);
    return { success: false, usersAffected: 0, challengesReset: 0 };
  }
}

// Create new week challenges (runs on Monday at 00:00)
async function createWeeklyChallenges() {
  try {
    logger.debug('\n🎯 [GAMIFICATION] Criando desafios da semana...');
    const { start, end } = getCurrentWeekBoundaries();
    
    for (const challenge of WEEKLY_CHALLENGES) {
      await storage.createWeeklyChallenge({
        title: challenge.title,
        description: challenge.description,
        challengeType: challenge.challengeType,
        requirementCount: challenge.requirementCount,
        xpReward: challenge.xpReward,
        rewardType: challenge.rewardType || null,
        rewardValue: challenge.rewardValue || null,
        icon: challenge.icon,
        startDate: start,
        endDate: end,
        isActive: true,
      });
    }
    
    logger.debug(`✅ [GAMIFICATION] ${WEEKLY_CHALLENGES.length} desafios criados para a semana!`);
    logger.debug(`   📅 Início: ${formatDateTimeBR(start)}`);
    logger.debug(`   📅 Fim: ${formatDateTimeBR(end)}\n`);
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao criar desafios semanais:', error);
  }
}

// Expire old rewards (runs every hour)
async function expireOldRewards() {
  try {
    const now = getNowSaoPaulo();
    const expired = await storage.expireOldRewards(now);
    
    if (expired > 0) {
      logger.debug(`⏰ [GAMIFICATION] ${expired} recompensa(s) expirada(s) - ${formatDateTimeBR(now)}`);
    }
    
    return expired;
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao expirar recompensas:', error);
    return 0;
  }
}

// Update featured members (runs on Monday at 00:00)
async function updateFeaturedMembers() {
  try {
    logger.debug('\n⭐ [GAMIFICATION] Atualizando membros em destaque...');
    
    const topUsers = await storage.getTopUsersOfWeek(10); // Top 10 users
    const { start, end } = getCurrentWeekBoundaries();
    
    // Deactivate old featured members
    await storage.deactivateFeaturedMembers();
    
    // Add new featured members
    for (const user of topUsers) {
      await storage.createFeaturedMember({
        userId: user.userId,
        reason: user.pointsEarned >= 200 ? 'weekly_champion' : 'top_contributor',
        weekStartDate: start,
        weekEndDate: end,
        pointsEarned: user.pointsEarned,
        isActive: true,
      });
    }
    
    logger.debug(`✅ [GAMIFICATION] ${topUsers.length} membros em destaque atualizados!`);
    if (topUsers.length > 0) {
      logger.debug(`   🏆 Campeão: ${topUsers[0].userName} (${topUsers[0].pointsEarned} XP)`);
    }
    logger.debug('\n');
    
    return topUsers.length;
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao atualizar membros em destaque:', error);
    return 0;
  }
}

// Initialize all daily activities for all users (run once on startup or manually)
export async function initializeDailyActivities() {
  try {
    logger.debug('\n🎯 [GAMIFICATION] Inicializando atividades diárias...');
    
    const users = await storage.getAllUsers();
    const today = startOfDaySaoPaulo();
    
    for (const user of users) {
      for (const activity of DAILY_ACTIVITIES) {
        // Check if activity already exists for today
        const exists = await storage.getUserDailyProgress(user.id, activity.id, today);
        
        if (!exists) {
          await storage.createDailyActivityProgress({
            userId: user.id,
            activityId: activity.id,
            currentProgress: 0,
            isCompleted: false,
            isClaimed: false,
            progressDate: today,
          });
        }
      }
    }
    
    logger.debug(`✅ [GAMIFICATION] Atividades inicializadas para ${users.length} usuários!\n`);
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao inicializar atividades:', error);
  }
}

// Initialize daily activities for a specific user (called on login/signup)
export async function initializeUserDailyActivities(userId: string) {
  try {
    const today = startOfDaySaoPaulo();
    
    for (const activity of DAILY_ACTIVITIES) {
      const exists = await storage.getUserDailyProgress(userId, activity.id, today);
      
      if (!exists) {
        await storage.createDailyActivityProgress({
          userId,
          activityId: activity.id,
          currentProgress: 0,
          isCompleted: false,
          isClaimed: false,
          progressDate: today,
        });
      }
    }
  } catch (error) {
    logger.error(`❌ [GAMIFICATION] Erro ao inicializar atividades para usuário ${userId}:`, error);
  }
}

// Ensure daily activities exist in database (called on startup)
export async function ensureDailyActivities() {
  try {
    logger.debug('📝 [GAMIFICATION] Verificando atividades diárias no banco...');
    
    for (const activity of DAILY_ACTIVITIES) {
      await storage.upsertDailyActivity({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        activityType: activity.activityType,
        requirementCount: activity.requirementCount,
        xpReward: activity.xpReward,
        icon: activity.icon,
        isActive: true,
      });
    }
    
    logger.debug(`✅ [GAMIFICATION] ${DAILY_ACTIVITIES.length} atividades diárias sincronizadas!`);
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao sincronizar atividades diárias:', error);
  }
}

// Ensure weekly challenges exist (called on startup and Mondays)
export async function ensureWeeklyChallenges() {
  try {
    const challenges = await storage.getActiveWeeklyChallenges();
    
    if (challenges.length === 0) {
      logger.debug('\n🎯 [GAMIFICATION] Nenhum desafio semanal ativo. Criando...');
      await createWeeklyChallenges();
    }
  } catch (error) {
    logger.error('❌ [GAMIFICATION] Erro ao verificar desafios semanais:', error);
  }
}

// Start all gamification schedulers
export async function startGamificationSchedulers() {
  logger.debug('🎮 Sistema de Gamificação - Agendadores Iniciados!');
  logger.debug('════════════════════════════════════════════════════════');
  
  // Initialize on startup (CRITICAL: ensures activities exist for all users immediately)
  await ensureDailyActivities(); // MUST be first: ensures activity definitions exist
  await ensureWeeklyChallenges();
  await initializeDailyActivities(); // Then create user progress rows
  
  // Daily activities reset (every day at 00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.debug('\n⏰ Executando reset diário de atividades...');
    await resetDailyActivities();
    await initializeDailyActivities(); // Create new activities for the day
  }, {
    timezone: "America/Sao_Paulo"
  });
  logger.debug('✅ Reset diário: Todos os dias às 00:00');
  
  // Weekly challenges reset (every Sunday at 23:59)
  cron.schedule('59 23 * * 0', async () => {
    logger.debug('\n⏰ Executando reset semanal de desafios...');
    await resetWeeklyChallenges();
  }, {
    timezone: "America/Sao_Paulo"
  });
  logger.debug('✅ Reset semanal: Domingos às 23:59');
  
  // Create new weekly challenges (every Monday at 00:00)
  cron.schedule('0 0 * * 1', async () => {
    logger.debug('\n⏰ Criando novos desafios semanais...');
    await createWeeklyChallenges();
    await updateFeaturedMembers(); // Update featured members for the new week
  }, {
    timezone: "America/Sao_Paulo"
  });
  logger.debug('✅ Novos desafios: Segundas às 00:00');
  
  // Expire old rewards (every hour)
  cron.schedule('0 * * * *', async () => {
    await expireOldRewards();
  }, {
    timezone: "America/Sao_Paulo"
  });
  logger.debug('✅ Expiração de recompensas: A cada hora');
  
  logger.debug('════════════════════════════════════════════════════════');
  logger.debug('🎯 Todos os agendadores ativos e funcionando!\n');
}
