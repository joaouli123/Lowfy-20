// Implemented the functionality to edit forum topics.
import { generateSlug } from "./utils/slug-utils";
import { logger } from "./utils/logger";
import {
  users,
  sessions,
  categories,
  languages,
  plrs,
  plrTags,
  plrDownloads,
  plrLikes,
  plrPurchases,
  plrTagRelations,
  services,
  courses,
  aiTools,
  globalAIAccess,
  quizInterativoSettings,
  forumTopics,
  forumReplies,
  forumTags,
  forumTopicTags,
  forumLikes,
  notifications,
  supportTickets,
  lowfySubscriptions,
  lowfySubscriptionPayments,
  webhookLogs,
  userPoints,
  badges,
  userBadges,
  marketplaceProducts,
  marketplaceOrders,
  productReviews,
  userFollows,
  topicFollows,
  timelinePosts,
  postReactions,
  postComments,
  commentLikes,
  postShares,
  timelineTags,
  postTagRelations,
  userConnections,
  dailyActivities,
  userDailyProgress,
  weeklyChallenges,
  userWeeklyProgress,
  userRewards,
  featuredMembers,
  postReports,
  forumTopicReports,
  forumReplyReports,
  clonedPages,
  n8nAutomations,
  type User,
  type TopicFollow,
  type InsertUser,
  type Category,
  type Language,
  type PLR,
  type PLRTag,
  type PLRDownload,
  type PLRLike,
  type PLRPurchase,
  type PLRWithRelations,
  type PLRDownloadWithLanguage,
  type Service,
  type Course,
  type AITool,
  type GlobalAIAccess,
  type QuizInterativoSettings,
  type ForumTopic,
  type ForumTopicWithRelations,
  type ForumReply,
  type ForumReplyWithRelations,
  type ForumTag,
  type Notification,
  type SupportTicket,
  type SupportTicketWithRelations,
  type InsertCategory,
  type InsertLanguage,
  type InsertPLR,
  type InsertPLRTag,
  type InsertPLRDownload,
  type InsertPLRPurchase,
  type InsertService,
  type InsertCourse,
  type InsertAITool,
  type InsertGlobalAIAccess,
  type InsertQuizInterativoSettings,
  type InsertForumTopic,
  type InsertForumReply,
  type InsertForumTag,
  type InsertSupportTicket,
  type InsertNotification,
  type LowfySubscription,
  type InsertLowfySubscription,
  type LowfySubscriptionPayment,
  type InsertLowfySubscriptionPayment,
  type WebhookLog,
  type UserPoints,
  type Badge,
  type MarketplaceProduct,
  type MarketplaceProductWithRelations,
  type ProductReview,
  type InsertMarketplaceProduct,
  type InsertProductReview,
  type TimelinePost,
  type TimelinePostWithRelations,
  type PostReaction,
  type PostComment,
  type CommentLike,
  type PostShare,
  type TimelineTag,
  type UserConnection,
  type InsertTimelinePost,
  type InsertPostReaction,
  type InsertPostComment,
  type InsertPostShare,
  type InsertTimelineTag,
  type InsertUserConnection,
  type DailyActivity,
  type UserDailyProgress,
  type WeeklyChallenge,
  type UserWeeklyProgress,
  type UserReward,
  type FeaturedMember,
  type PostReport,
  type ForumTopicReport,
  type InsertForumTopicReport,
  type ForumReplyReport,
  type InsertForumReplyReport,
  type InsertDailyActivity,
  type InsertUserDailyProgress,
  type InsertWeeklyChallenge,
  type InsertUserWeeklyProgress,
  type InsertUserReward,
  type InsertFeaturedMember,
  type InsertPostReport,
  type UserWithStats,
  type ClonedPage,
  type InsertClonedPage,
  type N8nAutomation,
  type InsertN8nAutomation,
  metaAdsCampaigns,
  type MetaAdsCampaign,
  type InsertMetaAdsCampaign,
  openaiTokenUsage,
  type OpenAITokenUsage,
  type InsertOpenAITokenUsage,
  sellerWallet,
  sellerTransactions,
  podpayTransactions,
  podpayWithdrawals,
  type SellerWallet,
  type SellerTransaction,
  type PodpayTransaction,
  type PodpayWithdrawal,
  referralCodes,
  referralClicks,
  referralCommissions,
  referralWallet,
  referralTransactions,
  type ReferralCode,
  type InsertReferralCode,
  type ReferralClick,
  type InsertReferralClick,
  type ReferralCommission,
  type InsertReferralCommission,
  type ReferralCommissionWithRelations,
  type ReferralWallet,
  type InsertReferralWallet,
  type ReferralTransaction,
  type InsertReferralTransaction,
  subscriptionRefundRequests,
  type SubscriptionRefundRequest,
  type InsertSubscriptionRefundRequest,
  type SubscriptionRefundRequestWithRelations,
  whatsappCampaigns,
  whatsappCampaignRecipients,
  whatsappOptOuts,
  type WhatsappCampaign,
  type InsertWhatsappCampaign,
  type WhatsappCampaignRecipient,
  type InsertWhatsappCampaignRecipient,
  type WhatsappOptOut,
  type InsertWhatsappOptOut,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, or, gte, lte, sql, sql as sqlOp, count, inArray, notInArray, ilike } from "drizzle-orm";
import { getNowSaoPaulo, startOfDaySaoPaulo, endOfDaySaoPaulo, addDaysSaoPaulo, subtractDaysSaoPaulo, daysAgoSaoPaulo, getWeekBoundariesSaoPaulo } from "@shared/dateUtils";

export class DatabaseStorage {
  // ==================== USER OPERATIONS ====================

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async getUserByCpf(cpf: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.cpf, cpf));
    return user;
  }

  async getUserByEmailOrUsername(emailOrUsername: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(or(
        eq(users.email, emailOrUsername),
        eq(users.name, emailOrUsername)
      ));
    return user;
  }

  async createUser(userData: Omit<InsertUser, 'password'> & { passwordHash: string; accountStatus?: string }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();

    // Criar pontos iniciais
    await db.insert(userPoints).values({
      userId: user.id,
      points: 0,
      level: 1,
    });

    return user;
  }

  async updateUserSubscription(userId: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUserAndRelatedData(userId: string): Promise<{ success: boolean; deletedTables: string[] }> {
    const deletedTables: string[] = [];
    
    try {
      // Delete sessions
      await db.delete(sessions).where(eq(sessions.userId, userId));
      deletedTables.push('sessions');

      // Delete notifications
      await db.delete(notifications).where(eq(notifications.userId, userId));
      deletedTables.push('notifications');

      // Delete user points and badges
      await db.delete(userPoints).where(eq(userPoints.userId, userId));
      deletedTables.push('userPoints');
      
      await db.delete(userBadges).where(eq(userBadges.userId, userId));
      deletedTables.push('userBadges');

      // Delete user follows (both as follower and followed)
      await db.delete(userFollows).where(or(
        eq(userFollows.followerId, userId),
        eq(userFollows.followingId, userId)
      ));
      deletedTables.push('userFollows');

      // Delete topic follows
      await db.delete(topicFollows).where(eq(topicFollows.userId, userId));
      deletedTables.push('topicFollows');

      // Delete user daily/weekly progress
      await db.delete(userDailyProgress).where(eq(userDailyProgress.userId, userId));
      deletedTables.push('userDailyProgress');
      
      await db.delete(userWeeklyProgress).where(eq(userWeeklyProgress.userId, userId));
      deletedTables.push('userWeeklyProgress');

      // Delete user rewards
      await db.delete(userRewards).where(eq(userRewards.userId, userId));
      deletedTables.push('userRewards');

      // Delete featured members
      await db.delete(featuredMembers).where(eq(featuredMembers.userId, userId));
      deletedTables.push('featuredMembers');

      // Delete post reports
      await db.delete(postReports).where(eq(postReports.reporterId, userId));
      deletedTables.push('postReports');

      // Delete forum likes
      await db.delete(forumLikes).where(eq(forumLikes.userId, userId));
      deletedTables.push('forumLikes');

      // Delete forum replies
      await db.delete(forumReplies).where(eq(forumReplies.authorId, userId));
      deletedTables.push('forumReplies');

      // Delete forum topics
      await db.delete(forumTopics).where(eq(forumTopics.authorId, userId));
      deletedTables.push('forumTopics');

      // Delete timeline posts reactions
      await db.delete(postReactions).where(eq(postReactions.userId, userId));
      deletedTables.push('postReactions');

      // Delete comment likes
      await db.delete(commentLikes).where(eq(commentLikes.userId, userId));
      deletedTables.push('commentLikes');

      // Delete post comments
      await db.delete(postComments).where(eq(postComments.userId, userId));
      deletedTables.push('postComments');

      // Delete post shares
      await db.delete(postShares).where(eq(postShares.userId, userId));
      deletedTables.push('postShares');

      // Delete timeline posts
      await db.delete(timelinePosts).where(eq(timelinePosts.userId, userId));
      deletedTables.push('timelinePosts');

      // Delete cloned pages
      await db.delete(clonedPages).where(eq(clonedPages.userId, userId));
      deletedTables.push('clonedPages');

      // Delete seller wallet and transactions
      await db.delete(sellerTransactions).where(eq(sellerTransactions.sellerId, userId));
      deletedTables.push('sellerTransactions');
      
      await db.delete(sellerWallet).where(eq(sellerWallet.sellerId, userId));
      deletedTables.push('sellerWallet');

      // Delete product reviews
      await db.delete(productReviews).where(eq(productReviews.userId, userId));
      deletedTables.push('productReviews');

      // Delete PLR likes and purchases (plrDownloads is PLR file storage, not user downloads)
      await db.delete(plrLikes).where(eq(plrLikes.userId, userId));
      deletedTables.push('plrLikes');
      
      await db.delete(plrPurchases).where(eq(plrPurchases.userId, userId));
      deletedTables.push('plrPurchases');

      // Delete referral codes and transactions
      await db.delete(referralTransactions).where(eq(referralTransactions.userId, userId));
      deletedTables.push('referralTransactions');
      
      await db.delete(referralWallet).where(eq(referralWallet.userId, userId));
      deletedTables.push('referralWallet');
      
      await db.delete(referralCodes).where(eq(referralCodes.userId, userId));
      deletedTables.push('referralCodes');

      // Delete lowfy subscriptions
      await db.delete(lowfySubscriptionPayments).where(
        sql`subscription_id IN (SELECT id FROM lowfy_subscriptions WHERE user_id = ${userId})`
      );
      deletedTables.push('lowfySubscriptionPayments');
      
      await db.delete(lowfySubscriptions).where(eq(lowfySubscriptions.userId, userId));
      deletedTables.push('lowfySubscriptions');

      // Delete support tickets
      await db.delete(supportTickets).where(eq(supportTickets.userId, userId));
      deletedTables.push('supportTickets');

      // Note: n8nAutomations is a template table without userId - no deletion needed

      // Finally delete the user
      await db.delete(users).where(eq(users.id, userId));
      deletedTables.push('users');

      logger.debug(`[DeleteUser] Successfully deleted user ${userId} and ${deletedTables.length} related tables`);
      
      return { success: true, deletedTables };
    } catch (error) {
      logger.error(`[DeleteUser] Error deleting user ${userId}:`, error);
      throw error;
    }
  }

  // ==================== WEBHOOK LOG OPERATIONS ====================

  async createWebhookLog(log: Omit<WebhookLog, 'id' | 'createdAt'>): Promise<WebhookLog> {
    const [webhookLog] = await db.insert(webhookLogs).values(log).returning();
    return webhookLog;
  }

  async updateWebhookLog(id: string, data: Partial<WebhookLog>): Promise<WebhookLog> {
    const [log] = await db
      .update(webhookLogs)
      .set(data)
      .where(eq(webhookLogs.id, id))
      .returning();
    return log;
  }

  async getAllWebhookLogs(): Promise<WebhookLog[]> {
    return await db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt));
  }

  // ==================== SUBSCRIPTION SCHEDULER OPERATIONS ====================

  async getExpiredSubscriptionsWithPages(): Promise<Array<{
    user: User;
    pagesCount: number;
  }>> {
    const now = getNowSaoPaulo();
    const tenDaysFromNow = addDaysSaoPaulo(now, 10);

    const expiredUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.subscriptionStatus, 'expired'),
          lte(users.subscriptionExpiresAt, now)
        )
      );

    const results: Array<{ user: User; pagesCount: number }> = [];

    for (const user of expiredUsers) {
      const [pageCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clonedPages)
        .where(eq(clonedPages.userId, user.id));

      if (pageCount && pageCount.count > 0) {
        results.push({ user, pagesCount: pageCount.count });
      }
    }

    return results;
  }

  // ==================== LOWFY SUBSCRIPTION OPERATIONS ====================

  async createLowfySubscription(data: InsertLowfySubscription): Promise<LowfySubscription> {
    const [subscription] = await db.insert(lowfySubscriptions).values(data).returning();
    return subscription;
  }

  async updateLowfySubscription(id: string, data: Partial<LowfySubscription>): Promise<LowfySubscription> {
    const updateData: Partial<LowfySubscription> & { updatedAt: Date; statusChangedAt?: Date } = {
      ...data,
      updatedAt: new Date(),
    };
    
    if (data.status !== undefined) {
      const [currentSub] = await db
        .select({ status: lowfySubscriptions.status })
        .from(lowfySubscriptions)
        .where(eq(lowfySubscriptions.id, id))
        .limit(1);
      
      if (currentSub && currentSub.status !== data.status) {
        updateData.statusChangedAt = new Date();
      }
    }
    
    const [subscription] = await db
      .update(lowfySubscriptions)
      .set(updateData)
      .where(eq(lowfySubscriptions.id, id))
      .returning();
    return subscription;
  }

  async getLowfySubscriptionByToken(token: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.activationToken, token))
      .limit(1);
    return subscription;
  }

  async getLowfySubscriptionByEmail(email: string): Promise<LowfySubscription | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(ilike(lowfySubscriptions.buyerEmail, normalizedEmail))
      .orderBy(desc(lowfySubscriptions.createdAt))
      .limit(1);
    return subscription;
  }

  async getLowfySubscriptionByProviderTransactionId(transactionId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.providerTransactionId, transactionId))
      .limit(1);
    return subscription;
  }

  async getLowfySubscriptionByProviderSubscriptionId(subscriptionId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.providerSubscriptionId, subscriptionId))
      .limit(1);
    return subscription;
  }

  async getActiveLowfySubscriptionByUserId(userId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.userId, userId),
          eq(lowfySubscriptions.status, 'active')
        )
      )
      .orderBy(desc(lowfySubscriptions.createdAt))
      .limit(1);
    return subscription;
  }

  async getLowfySubscriptionByUserId(userId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.userId, userId))
      .orderBy(desc(lowfySubscriptions.createdAt))
      .limit(1);
    return subscription;
  }

  async getLowfySubscriptionById(id: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.id, id))
      .limit(1);
    return subscription;
  }

  async getCanceledLowfySubscriptionByUserId(userId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.userId, userId),
          eq(lowfySubscriptions.status, 'canceled')
        )
      )
      .orderBy(desc(lowfySubscriptions.canceledAt))
      .limit(1);
    return subscription;
  }

  async getInactiveLowfySubscriptionByUserId(userId: string): Promise<LowfySubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(
        and(
          eq(lowfySubscriptions.userId, userId),
          inArray(lowfySubscriptions.status, ['canceled', 'refunded', 'expired'])
        )
      )
      .orderBy(
        desc(sql`COALESCE(
          ${lowfySubscriptions.statusChangedAt}, 
          ${lowfySubscriptions.canceledAt}, 
          ${lowfySubscriptions.updatedAt}, 
          ${lowfySubscriptions.createdAt}
        )`),
        desc(lowfySubscriptions.createdAt)
      )
      .limit(1);
    return subscription;
  }

  async getActivePixSubscriptionsExpiringInLowfy(days: number): Promise<Array<{
    subscription: LowfySubscription;
    user: User;
  }>> {
    const now = getNowSaoPaulo();
    const futureDate = addDaysSaoPaulo(now, days);
    const startOfDay = startOfDaySaoPaulo(futureDate);
    const targetDate = endOfDaySaoPaulo(futureDate);

    const results = await db
      .select({
        subscription: lowfySubscriptions,
        user: users
      })
      .from(lowfySubscriptions)
      .innerJoin(users, eq(lowfySubscriptions.userId, users.id))
      .where(
        and(
          eq(lowfySubscriptions.status, 'active'),
          eq(lowfySubscriptions.paymentMethod, 'pix'),
          gte(lowfySubscriptions.nextPaymentDate, startOfDay),
          lte(lowfySubscriptions.nextPaymentDate, targetDate)
        )
      );

    return results;
  }

  // ==================== SUBSCRIPTION PAYMENT HISTORY OPERATIONS ====================

  async createSubscriptionPayment(data: InsertLowfySubscriptionPayment): Promise<LowfySubscriptionPayment> {
    const [payment] = await db.insert(lowfySubscriptionPayments).values(data).returning();
    return payment;
  }

  async getSubscriptionPaymentsByUserId(userId: string): Promise<LowfySubscriptionPayment[]> {
    return await db
      .select()
      .from(lowfySubscriptionPayments)
      .where(eq(lowfySubscriptionPayments.userId, userId))
      .orderBy(desc(lowfySubscriptionPayments.createdAt));
  }

  async getSubscriptionPaymentsBySubscriptionId(subscriptionId: string): Promise<LowfySubscriptionPayment[]> {
    return await db
      .select()
      .from(lowfySubscriptionPayments)
      .where(eq(lowfySubscriptionPayments.subscriptionId, subscriptionId))
      .orderBy(desc(lowfySubscriptionPayments.createdAt));
  }

  async updateSubscriptionPayment(id: string, data: Partial<InsertLowfySubscriptionPayment>): Promise<LowfySubscriptionPayment> {
    const [payment] = await db
      .update(lowfySubscriptionPayments)
      .set(data)
      .where(eq(lowfySubscriptionPayments.id, id))
      .returning();
    return payment;
  }

  // ==================== CATEGORY OPERATIONS ====================

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // ==================== LANGUAGE OPERATIONS ====================

  async getLanguages(): Promise<Language[]> {
    return await db.select().from(languages).orderBy(languages.name);
  }

  async getLanguageByCode(code: string): Promise<Language | undefined> {
    const [language] = await db
      .select()
      .from(languages)
      .where(eq(languages.code, code))
      .limit(1);
    return language;
  }

  async createLanguage(language: InsertLanguage): Promise<Language> {
    const [newLanguage] = await db.insert(languages).values(language).returning();
    return newLanguage;
  }

  async updateLanguage(id: string, language: Partial<InsertLanguage>): Promise<Language> {
    const [updated] = await db
      .update(languages)
      .set(language)
      .where(eq(languages.id, id))
      .returning();
    return updated;
  }

  async deleteLanguage(id: string): Promise<void> {
    await db.delete(languages).where(eq(languages.id, id));
  }

  // ==================== PLR OPERATIONS ====================

  async getPLRs(filters?: {
    categoryId?: string;
    search?: string;
    userId?: string;
    onlyPurchased?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PLRWithRelations[], total: number }> {
    const conditions = [eq(plrs.isActive, true)];

    if (filters?.categoryId) {
      conditions.push(eq(plrs.categoryId, filters.categoryId));
    }
    if (filters?.search) {
      conditions.push(ilike(plrs.title, `%${filters.search}%`));
    }

    // Count query - same conditions but without limit/offset
    let countQuery;
    if (filters?.onlyPurchased && filters?.userId) {
      countQuery = db
        .select({ count: count() })
        .from(plrs)
        .innerJoin(plrPurchases, eq(plrs.id, plrPurchases.plrId))
        .where(and(...conditions, eq(plrPurchases.userId, filters.userId)));
    } else {
      countQuery = db
        .select({ count: count() })
        .from(plrs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
    }

    // Base query for PLRs
    let query = db
      .select({
        id: plrs.id,
        title: plrs.title,
        description: plrs.description,
        coverImageUrl: plrs.coverImageUrl,
        categoryId: plrs.categoryId,
        countryCode: plrs.countryCode,
        likeCount: plrs.likeCount,
        viewCount: plrs.viewCount,
        price: plrs.price,
        isFree: plrs.isFree,
        isActive: plrs.isActive,
        extraLinks: plrs.extraLinks,
        createdAt: plrs.createdAt,
        updatedAt: plrs.updatedAt,
      })
      .from(plrs);

    // If onlyPurchased, join with purchases
    if (filters?.onlyPurchased && filters?.userId) {
      query = query
        .innerJoin(plrPurchases, eq(plrs.id, plrPurchases.plrId))
        .where(and(...conditions, eq(plrPurchases.userId, filters.userId)));
    } else {
      query = query.where(conditions.length > 0 ? and(...conditions) : undefined);
    }

    // Apply pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    // Execute count and data queries in parallel
    const [countResult, plrResults] = await Promise.all([
      countQuery,
      query
        .orderBy(desc(plrs.createdAt))
        .limit(limit)
        .offset(offset)
    ]);

    // Get total count
    const total = countResult[0]?.count || 0;

    // Get all PLR IDs
    const plrIds = plrResults.map(p => p.id);
    if (plrIds.length === 0) return { data: [], total };

    // Fetch all related data in parallel
    const [categoriesData, downloadsData, tagsData, likesData, purchasesData] = await Promise.all([
      // Categories
      db.select().from(categories).where(
        inArray(categories.id, plrResults.map(p => p.categoryId).filter(Boolean) as string[])
      ),

      // Downloads with languages
      db.select({
        id: plrDownloads.id,
        plrId: plrDownloads.plrId,
        type: plrDownloads.type,
        languageId: plrDownloads.languageId,
        fileUrl: plrDownloads.fileUrl,
        createdAt: plrDownloads.createdAt,
        langId: languages.id,
        langName: languages.name,
        langCode: languages.code,
        langFlagEmoji: languages.flagEmoji,
        langCreatedAt: languages.createdAt,
      })
      .from(plrDownloads)
      .leftJoin(languages, eq(plrDownloads.languageId, languages.id))
      .where(inArray(plrDownloads.plrId, plrIds)),

      // Tags
      db.select({
        plrId: plrTagRelations.plrId,
        tagId: plrTags.id,
        tagName: plrTags.name,
        tagSlug: plrTags.slug,
        tagColor: plrTags.color,
        tagCreatedAt: plrTags.createdAt,
      })
      .from(plrTagRelations)
      .leftJoin(plrTags, eq(plrTagRelations.tagId, plrTags.id))
      .where(inArray(plrTagRelations.plrId, plrIds)),

      // Likes (only if userId provided)
      filters?.userId
        ? db.select({ plrId: plrLikes.plrId })
            .from(plrLikes)
            .where(and(
              eq(plrLikes.userId, filters.userId),
              inArray(plrLikes.plrId, plrIds)
            ))
        : Promise.resolve([]),

      // Purchases (only if userId provided)
      filters?.userId
        ? db.select({ plrId: plrPurchases.plrId })
            .from(plrPurchases)
            .where(and(
              eq(plrPurchases.userId, filters.userId),
              inArray(plrPurchases.plrId, plrIds)
            ))
        : Promise.resolve([])
    ]);

    // Build maps
    const categoriesMap = new Map(categoriesData.map(cat => [cat.id, cat]));

    const downloadsMap = new Map<string, any[]>();
    downloadsData.forEach(download => {
      if (!downloadsMap.has(download.plrId)) {
        downloadsMap.set(download.plrId, []);
      }
      downloadsMap.get(download.plrId)!.push({
        id: download.id,
        plrId: download.plrId,
        type: download.type,
        languageId: download.languageId,
        fileUrl: download.fileUrl,
        createdAt: download.createdAt,
        language: download.langId ? {
          id: download.langId,
          name: download.langName,
          code: download.langCode,
          flagEmoji: download.langFlagEmoji,
          createdAt: download.langCreatedAt,
        } : undefined,
      });
    });

    const tagsMap = new Map<string, any[]>();
    tagsData.forEach(item => {
      if (item.tagId) {
        if (!tagsMap.has(item.plrId)) {
          tagsMap.set(item.plrId, []);
        }
        tagsMap.get(item.plrId)!.push({
          id: item.tagId,
          name: item.tagName,
          slug: item.tagSlug,
          color: item.tagColor,
          createdAt: item.tagCreatedAt,
        });
      }
    });

    const likesMap = new Map(likesData.map(like => [like.plrId, true]));
    const purchasesMap = new Map(purchasesData.map(purchase => [purchase.plrId, true]));

    // Combine results
    const data = plrResults.map(plr => ({
      ...plr,
      category: plr.categoryId ? categoriesMap.get(plr.categoryId) : undefined,
      downloads: downloadsMap.get(plr.id) || [],
      tags: tagsMap.get(plr.id) || [],
      hasLiked: filters?.userId ? likesMap.get(plr.id) || false : false,
      hasPurchased: filters?.userId ? purchasesMap.get(plr.id) || false : false,
    }));

    return { data, total };
  }

  async getPLRById(id: string, userId?: string): Promise<PLRWithRelations | undefined> {
    const [plr] = await db
      .select()
      .from(plrs)
      .where(eq(plrs.id, id));

    if (!plr) return undefined;

    // Get category
    let category: Category | undefined;
    if (plr.categoryId) {
      const [cat] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, plr.categoryId));
      category = cat;
    }

    // Get downloads with languages
    const downloadsData = await db
      .select({
        id: plrDownloads.id,
        plrId: plrDownloads.plrId,
        type: plrDownloads.type,
        languageId: plrDownloads.languageId,
        fileUrl: plrDownloads.fileUrl,
        createdAt: plrDownloads.createdAt,
        languageId2: languages.id,
        languageName: languages.name,
        languageCode: languages.code,
        languageFlagEmoji: languages.flagEmoji,
      })
      .from(plrDownloads)
      .leftJoin(languages, eq(plrDownloads.languageId, languages.id))
      .where(eq(plrDownloads.plrId, id));

    const downloads = downloadsData.map(d => ({
      id: d.id,
      plrId: d.plrId,
      type: d.type,
      languageId: d.languageId,
      fileUrl: d.fileUrl,
      createdAt: d.createdAt,
      language: d.languageId2 ? {
        id: d.languageId2,
        name: d.languageName!,
        code: d.languageCode!,
        flagEmoji: d.languageFlagEmoji!,
        createdAt: new Date(),
      } : undefined,
    }));

    // Get tags
    const tagsData = await db
      .select({
        tagId: plrTags.id,
        tagName: plrTags.name,
        tagSlug: plrTags.slug,
        tagColor: plrTags.color,
        tagCreatedAt: plrTags.createdAt,
      })
      .from(plrTagRelations)
      .leftJoin(plrTags, eq(plrTagRelations.tagId, plrTags.id))
      .where(eq(plrTagRelations.plrId, id));

    const tags = tagsData
      .filter(t => t.tagId)
      .map(t => ({
        id: t.tagId!,
        name: t.tagName!,
        slug: t.tagSlug!,
        color: t.tagColor!,
        createdAt: t.tagCreatedAt!,
      })) as PLRTag[];

    // Check if user liked
    let hasLiked = false;
    if (userId) {
      const [like] = await db
        .select()
        .from(plrLikes)
        .where(and(eq(plrLikes.plrId, id), eq(plrLikes.userId, userId)));
      hasLiked = !!like;
    }

    // Check if user purchased
    let hasPurchased = false;
    if (userId) {
      const [purchase] = await db
        .select()
        .from(plrPurchases)
        .where(and(eq(plrPurchases.plrId, id), eq(plrPurchases.userId, userId)));
      hasPurchased = !!purchase;
    }

    return {
      ...plr,
      category,
      downloads,
      tags,
      hasLiked,
      hasPurchased,
    };
  }

  async createPLR(plr: InsertPLR): Promise<PLR> {
    const [newPLR] = await db.insert(plrs).values(plr).returning();
    return newPLR;
  }

  async updatePLR(id: string, plr: Partial<InsertPLR>): Promise<PLR> {
    const [updated] = await db
      .update(plrs)
      .set({ ...plr, updatedAt: new Date() })
      .where(eq(plrs.id, id))
      .returning();
    return updated;
  }

  async deletePLR(id: string): Promise<void> {
    // Delete all related records first to avoid foreign key constraints
    await db.delete(plrLikes).where(eq(plrLikes.plrId, id));
    await db.delete(plrPurchases).where(eq(plrPurchases.plrId, id));
    await db.delete(plrTagRelations).where(eq(plrTagRelations.plrId, id));
    await db.delete(plrDownloads).where(eq(plrDownloads.plrId, id));

    // Now delete the PLR
    await db.delete(plrs).where(eq(plrs.id, id));
  }

  // PLR Tags Operations
  async getPLRTags(): Promise<PLRTag[]> {
    return await db.select().from(plrTags).orderBy(plrTags.name);
  }

  async createPLRTag(tag: InsertPLRTag): Promise<PLRTag> {
    const [newTag] = await db.insert(plrTags).values(tag).returning();
    return newTag;
  }

  async updatePLRTag(id: string, tag: Partial<InsertPLRTag>): Promise<PLRTag> {
    const [updated] = await db
      .update(plrTags)
      .set(tag)
      .where(eq(plrTags.id, id))
      .returning();
    return updated;
  }

  async deletePLRTag(id: string): Promise<void> {
    await db.delete(plrTags).where(eq(plrTags.id, id));
  }

  // PLR Downloads Operations
  async addPLRDownload(download: InsertPLRDownload): Promise<PLRDownload> {
    const [newDownload] = await db.insert(plrDownloads).values(download).returning();
    return newDownload;
  }

  async updatePLRDownload(id: string, download: Partial<InsertPLRDownload>): Promise<PLRDownload> {
    const [updated] = await db
      .update(plrDownloads)
      .set(download)
      .where(eq(plrDownloads.id, id))
      .returning();
    return updated;
  }

  async deletePLRDownload(id: string): Promise<void> {
    await db.delete(plrDownloads).where(eq(plrDownloads.id, id));
  }

  async deletePLRDownloadsByPLRId(plrId: string): Promise<void> {
    await db.delete(plrDownloads).where(eq(plrDownloads.plrId, plrId));
  }

  // PLR Tag Relations Operations
  async addTagsToPLR(plrId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    const values = tagIds.map(tagId => ({ plrId, tagId }));
    await db.insert(plrTagRelations).values(values);
  }

  async removeTagsFromPLR(plrId: string): Promise<void> {
    await db.delete(plrTagRelations).where(eq(plrTagRelations.plrId, plrId));
  }

  // PLR Likes Operation
  async togglePLRLike(plrId: string, userId: string): Promise<{ liked: boolean }> {
    const [existingLike] = await db
      .select()
      .from(plrLikes)
      .where(and(eq(plrLikes.plrId, plrId), eq(plrLikes.userId, userId)));

    if (existingLike) {
      // Unlike
      await db
        .delete(plrLikes)
        .where(eq(plrLikes.id, existingLike.id));

      // Decrement like count
      await db
        .update(plrs)
        .set({ likeCount: sqlOp`${plrs.likeCount} - 1` })
        .where(eq(plrs.id, plrId));

      return { liked: false };
    } else {
      // Like
      await db
        .insert(plrLikes)
        .values({ plrId, userId });

      // Increment like count
      await db
        .update(plrs)
        .set({ likeCount: sqlOp`${plrs.likeCount} + 1` })
        .where(eq(plrs.id, plrId));

      return { liked: true };
    }
  }

  // Get PLRs by User
  async getPLRsByUserId(userId: string, purchased?: boolean): Promise<PLRWithRelations[]> {
    // Get purchased PLRs only
    const result = await this.getPLRs({ userId, onlyPurchased: true });
    return result.data;
  }

  // PLR Purchase Operations
  async createPLRPurchase(purchase: InsertPLRPurchase): Promise<PLRPurchase> {
    const [newPurchase] = await db.insert(plrPurchases).values(purchase).returning();
    return newPurchase;
  }

  async getUserPLRPurchases(userId: string): Promise<PLRPurchase[]> {
    return await db
      .select()
      .from(plrPurchases)
      .where(eq(plrPurchases.userId, userId))
      .orderBy(desc(plrPurchases.createdAt));
  }

  // ==================== SERVICE OPERATIONS ====================

  async getServices(): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.isActive, true)).orderBy(desc(services.isPopular));
  }

  async getServiceById(id: string): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db
      .update(services)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // ==================== COURSES ====================

  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
  }

  async getCourseById(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course> {
    const [updated] = await db
      .update(courses)
      .set({ ...course, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updated;
  }

  async deleteCourse(id: string): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  async getAITools(): Promise<AITool[]> {
    return await db.select().from(aiTools).where(eq(aiTools.isActive, true));
  }

  async getAllAITools(): Promise<AITool[]> {
    return await db.select().from(aiTools).orderBy(aiTools.name);
  }

  async getAIToolById(id: string): Promise<AITool | undefined> {
    const [tool] = await db.select().from(aiTools).where(eq(aiTools.id, id));
    return tool;
  }

  async createAITool(tool: InsertAITool): Promise<AITool> {
    const [newTool] = await db.insert(aiTools).values(tool).returning();
    return newTool;
  }

  async updateAITool(id: string, tool: Partial<InsertAITool>): Promise<AITool> {
    const [updated] = await db
      .update(aiTools)
      .set({ ...tool, updatedAt: new Date() })
      .where(eq(aiTools.id, id))
      .returning();
    return updated;
  }

  async deleteAITool(id: string): Promise<void> {
    await db.delete(aiTools).where(eq(aiTools.id, id));
  }

  async getGlobalAIAccess(): Promise<GlobalAIAccess[]> {
    return await db.select().from(globalAIAccess).where(eq(globalAIAccess.isActive, true)).orderBy(globalAIAccess.order);
  }

  async getAllGlobalAIAccess(): Promise<GlobalAIAccess[]> {
    return await db.select().from(globalAIAccess).orderBy(globalAIAccess.order);
  }

  async getGlobalAIAccessById(id: string): Promise<GlobalAIAccess | undefined> {
    const [access] = await db.select().from(globalAIAccess).where(eq(globalAIAccess.id, id));
    return access;
  }

  async createGlobalAIAccess(access: InsertGlobalAIAccess): Promise<GlobalAIAccess> {
    const [newAccess] = await db.insert(globalAIAccess).values(access).returning();
    return newAccess;
  }

  async updateGlobalAIAccess(id: string, access: Partial<InsertGlobalAIAccess>): Promise<GlobalAIAccess> {
    const [updated] = await db
      .update(globalAIAccess)
      .set({ ...access, updatedAt: new Date() })
      .where(eq(globalAIAccess.id, id))
      .returning();
    return updated;
  }

  async deleteGlobalAIAccess(id: string): Promise<void> {
    await db.delete(globalAIAccess).where(eq(globalAIAccess.id, id));
  }

  // Quiz Interativo Settings
  async getQuizInterativoSettings(): Promise<QuizInterativoSettings | undefined> {
    const [settings] = await db.select().from(quizInterativoSettings).where(eq(quizInterativoSettings.isActive, true)).limit(1);
    return settings;
  }

  async createQuizInterativoSettings(settings: InsertQuizInterativoSettings): Promise<QuizInterativoSettings> {
    const [created] = await db.insert(quizInterativoSettings).values(settings).returning();
    return created;
  }

  async updateQuizInterativoSettings(id: string, settings: Partial<InsertQuizInterativoSettings>): Promise<QuizInterativoSettings> {
    const [updated] = await db
      .update(quizInterativoSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(quizInterativoSettings.id, id))
      .returning();
    return updated;
  }

  // ==================== N8N AUTOMATIONS ====================

  async getN8nAutomations(filters?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<N8nAutomation[]> {
    try {
      let query = db.select().from(n8nAutomations).where(eq(n8nAutomations.isActive, true));

      if (filters?.category) {
        query = query.where(eq(n8nAutomations.category, filters.category)) as any;
      }

      if (filters?.search) {
        const searchTerm = `%${filters.search.toLowerCase()}%`;
        query = query.where(
          or(
            sql`LOWER(${n8nAutomations.title}) LIKE ${searchTerm}`,
            sql`LOWER(${n8nAutomations.description}) LIKE ${searchTerm}`,
            sql`LOWER(${n8nAutomations.department}) LIKE ${searchTerm}`
          )
        ) as any;
      }

      query = query.orderBy(desc(n8nAutomations.createdAt)) as any;

      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }

      if (filters?.offset) {
        query = query.offset(filters.offset) as any;
      }

      return await query;
    } catch (error) {
      logger.error("Error fetching N8N automations:", error);
      throw error;
    }
  }

  async getN8nAutomationById(id: string): Promise<N8nAutomation | null> {
    try {
      const [automation] = await db
        .select()
        .from(n8nAutomations)
        .where(eq(n8nAutomations.id, id))
        .limit(1);

      return automation || null;
    } catch (error) {
      logger.error("Error fetching N8N automation:", error);
      throw error;
    }
  }

  async createN8nAutomation(data: InsertN8nAutomation): Promise<N8nAutomation> {
    try {
      const [automation] = await db.insert(n8nAutomations).values(data).returning();
      return automation;
    } catch (error) {
      logger.error("Error creating N8N automation:", error);
      throw error;
    }
  }

  async updateN8nAutomation(id: string, data: Partial<InsertN8nAutomation>): Promise<N8nAutomation> {
    try {
      const [automation] = await db
        .update(n8nAutomations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(n8nAutomations.id, id))
        .returning();

      return automation;
    } catch (error) {
      logger.error("Error updating N8N automation:", error);
      throw error;
    }
  }

  async deleteN8nAutomation(id: string): Promise<void> {
    try {
      await db.delete(n8nAutomations).where(eq(n8nAutomations.id, id));
    } catch (error) {
      logger.error("Error deleting N8N automation:", error);
      throw error;
    }
  }

  async incrementN8nAutomationViewCount(id: string): Promise<void> {
    try {
      await db
        .update(n8nAutomations)
        .set({ viewCount: sql`${n8nAutomations.viewCount} + 1` })
        .where(eq(n8nAutomations.id, id));
    } catch (error) {
      logger.error("Error incrementing N8N automation view count:", error);
      throw error;
    }
  }

  async getN8nCategories(): Promise<{ category: string; count: number }[]> {
    try {
      const results = await db
        .select({
          category: n8nAutomations.category,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(n8nAutomations)
        .where(eq(n8nAutomations.isActive, true))
        .groupBy(n8nAutomations.category)
        .orderBy(n8nAutomations.category);

      return results;
    } catch (error) {
      logger.error("Error fetching N8N categories:", error);
      throw error;
    }
  }

  // ==================== FORUM OPERATIONS ====================

  async getForumTopics(categoryId?: string, userId?: string): Promise<ForumTopicWithRelations[]> {
    const conditions = categoryId ? [eq(forumTopics.categoryId, categoryId)] : [];

    const result = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        content: forumTopics.content,
        authorId: forumTopics.authorId,
        categoryId: forumTopics.categoryId,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isSticky: forumTopics.isSticky,
        isClosed: forumTopics.isClosed,
        bestAnswerId: forumTopics.bestAnswerId,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
          isAdmin: users.isAdmin,
          profession: users.profession,
          areaAtuacao: users.areaAtuacao,
        },
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(categories, eq(forumTopics.categoryId, categories.id))
      .$dynamic()
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(forumTopics.isSticky), desc(forumTopics.updatedAt));

    // Check if user liked each topic
    let hasLikedMap: Record<string, boolean> = {};
    if (userId) {
      const likes = await db
        .select({ topicId: forumLikes.topicId })
        .from(forumLikes)
        .where(and(eq(forumLikes.userId, userId), sqlOp`${forumLikes.topicId} IS NOT NULL`));

      hasLikedMap = likes.reduce((acc, like) => {
        if (like.topicId) acc[like.topicId] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Get tags for all topics
    const topicIds = result.map(r => r.id);
    const tagsData = topicIds.length > 0 ? await db
      .select({
        topicId: forumTopicTags.topicId,
        tag: {
          id: forumTags.id,
          name: forumTags.name,
          slug: forumTags.slug,
          color: forumTags.color,
        },
      })
      .from(forumTopicTags)
      .leftJoin(forumTags, eq(forumTopicTags.tagId, forumTags.id))
      .where(inArray(forumTopicTags.topicId, topicIds)) : [];

    // Group tags by topic
    const tagsByTopic: Record<string, ForumTag[]> = {};
    tagsData.forEach(t => {
      if (t.topicId && t.tag?.id) {
        if (!tagsByTopic[t.topicId]) {
          tagsByTopic[t.topicId] = [];
        }
        tagsByTopic[t.topicId].push(t.tag as ForumTag);
      }
    });

    return result.map(row => ({
      ...row,
      author: row.author?.id ? row.author : undefined,
      category: row.category?.id ? row.category : undefined,
      hasLiked: userId ? hasLikedMap[row.id] || false : false,
      tags: tagsByTopic[row.id] || [],
    }));
  }

  async getUserForumTopics(userId: string, limit = 10, offset = 0): Promise<ForumTopicWithRelations[]> {
    const result = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        content: forumTopics.content,
        authorId: forumTopics.authorId,
        categoryId: forumTopics.categoryId,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isSticky: forumTopics.isSticky,
        isClosed: forumTopics.isClosed,
        bestAnswerId: forumTopics.bestAnswerId,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
          isAdmin: users.isAdmin,
          profession: users.profession,
          areaAtuacao: users.areaAtuacao,
        },
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(categories, eq(forumTopics.categoryId, categories.id))
      .where(eq(forumTopics.authorId, userId))
      .orderBy(desc(forumTopics.createdAt))
      .limit(limit)
      .offset(offset);

    // Check if user liked each topic
    let hasLikedMap: Record<string, boolean> = {};
    if (userId) {
      const likes = await db
        .select({ topicId: forumLikes.topicId })
        .from(forumLikes)
        .where(and(eq(forumLikes.userId, userId), sqlOp`${forumLikes.topicId} IS NOT NULL`));

      hasLikedMap = likes.reduce((acc, like) => {
        if (like.topicId) acc[like.topicId] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Get tags for all topics
    const topicIds = result.map(r => r.id);
    const tagsData = topicIds.length > 0 ? await db
      .select({
        topicId: forumTopicTags.topicId,
        tag: {
          id: forumTags.id,
          name: forumTags.name,
          slug: forumTags.slug,
          color: forumTags.color,
        },
      })
      .from(forumTopicTags)
      .leftJoin(forumTags, eq(forumTopicTags.tagId, forumTags.id))
      .where(inArray(forumTopicTags.topicId, topicIds)) : [];

    // Group tags by topic
    const tagsByTopic: Record<string, ForumTag[]> = {};
    tagsData.forEach(t => {
      if (t.topicId && t.tag?.id) {
        if (!tagsByTopic[t.topicId]) {
          tagsByTopic[t.topicId] = [];
        }
        tagsByTopic[t.topicId].push(t.tag as ForumTag);
      }
    });

    return result.map(row => ({
      ...row,
      author: row.author?.id ? row.author : undefined,
      category: row.category?.id ? row.category : undefined,
      hasLiked: userId ? hasLikedMap[row.id] || false : false,
      tags: tagsByTopic[row.id] || [],
    }));
  }

  async forumTopicSlugExists(slug: string): Promise<boolean> {
    const [result] = await db
      .select({ id: forumTopics.id })
      .from(forumTopics)
      .where(eq(forumTopics.slug, slug))
      .limit(1);
    return !!result;
  }

  async getForumTopicBySlug(slug: string, userId?: string): Promise<ForumTopicWithRelations | undefined> {
    logger.debug('[Forum] Buscando tópico por slug:', slug);

    const [result] = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        content: forumTopics.content,
        authorId: forumTopics.authorId,
        categoryId: forumTopics.categoryId,
        videoLink: forumTopics.videoLink,
        attachments: forumTopics.attachments,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isSticky: forumTopics.isSticky,
        isClosed: forumTopics.isClosed,
        bestAnswerId: forumTopics.bestAnswerId,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
          bio: users.bio,
          location: users.location,
          website: users.website,
          profession: users.profession,
          areaAtuacao: users.areaAtuacao,
        },
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(categories, eq(forumTopics.categoryId, categories.id))
      .where(eq(forumTopics.slug, slug));

    if (!result) {
      logger.debug('[Forum] Tópico não encontrado por slug:', slug);
      return undefined;
    }

    logger.debug('[Forum] Tópico encontrado:', result.title);;

    // Check if user has liked this topic
    let hasLiked = false;
    if (userId) {
      const [like] = await db
        .select()
        .from(forumLikes)
        .where(
          and(
            eq(forumLikes.userId, userId),
            eq(forumLikes.topicId, result.id)
          )
        );
      hasLiked = !!like;
    }

    // Get tags
    const topicTagsData = await db
      .select({
        tag: {
          id: forumTags.id,
          name: forumTags.name,
          slug: forumTags.slug,
          color: forumTags.color,
        },
      })
      .from(forumTopicTags)
      .leftJoin(forumTags, eq(forumTopicTags.tagId, forumTags.id))
      .where(eq(forumTopicTags.topicId, result.id));

    const tags = topicTagsData
      .map(t => t.tag)
      .filter(tag => tag?.id) as ForumTag[];

    return {
      ...result,
      author: result.author?.id ? result.author : undefined,
      category: result.category?.id ? result.category : undefined,
      hasLiked,
      tags,
    };
  }

  async getForumTopicById(id: string, userId?: string): Promise<ForumTopicWithRelations | undefined> {
    const [result] = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        slug: forumTopics.slug,
        content: forumTopics.content,
        authorId: forumTopics.authorId,
        categoryId: forumTopics.categoryId,
        videoLink: forumTopics.videoLink,
        attachments: forumTopics.attachments,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isSticky: forumTopics.isSticky,
        isClosed: forumTopics.isClosed,
        bestAnswerId: forumTopics.bestAnswerId,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
          isAdmin: users.isAdmin,
          profession: users.profession,
          areaAtuacao: users.areaAtuacao,
        },
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(categories, eq(forumTopics.categoryId, categories.id))
      .where(eq(forumTopics.id, id));

    if (!result) return undefined;

    // Increment view count
    await this.incrementTopicViewCount(id);

    // Check if user liked
    let hasLiked = false;
    if (userId) {
      const [like] = await db
        .select()
        .from(forumLikes)
        .where(and(eq(forumLikes.userId, userId), eq(forumLikes.topicId, id)));
      hasLiked = !!like;
    }

    // Get tags
    const topicTagsData = await db
      .select({
        tag: {
          id: forumTags.id,
          name: forumTags.name,
          slug: forumTags.slug,
          color: forumTags.color,
        },
      })
      .from(forumTopicTags)
      .leftJoin(forumTags, eq(forumTopicTags.tagId, forumTags.id))
      .where(eq(forumTopicTags.topicId, id));

    const tags = topicTagsData
      .map(t => t.tag)
      .filter(tag => tag?.id) as ForumTag[];

    return {
      ...result,
      author: result.author?.id ? result.author : undefined,
      category: result.category?.id ? result.category : undefined,
      hasLiked,
      tags,
    };
  }

  async createForumTopic(topicData: InsertForumTopic): Promise<ForumTopic> {
    const { tags, ...topic } = topicData as InsertForumTopic & { tags?: string[] };

    // Generate unique SEO-friendly slug from title
    const { generateUniqueSlug } = await import('./utils/slug-utils');
    const slug = await generateUniqueSlug(topic.title, (s) => this.forumTopicSlugExists(s));

    const [newTopic] = await db.insert(forumTopics).values({ ...topic, slug }).returning();

    // Add tags if provided
    if (tags && tags.length > 0) {
      const tagIds = await Promise.all(
        tags.map(async (tagName) => {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-');
          const [tag] = await db
            .insert(forumTags)
            .values({ name: tagName, slug })
            .onConflictDoNothing()
            .returning();

          if (tag) return tag.id;

          const [existingTag] = await db
            .select()
            .from(forumTags)
            .where(eq(forumTags.slug, slug));

          return existingTag.id;
        })
      );

      await Promise.all(
        tagIds.map(tagId =>
          db.insert(forumTopicTags).values({
            topicId: newTopic.id,
            tagId,
          })
        )
      );
    }

    // Update user points
    await this.updateUserPointsForAction(topic.authorId, 'topic_created');

    return newTopic;
  }

  async updateForumTopic(id: string, data: { title?: string; content?: string; categoryId?: string; tags?: string[]; videoLink?: string | null; attachments?: any[] }): Promise<ForumTopic> {
    const { tags, ...topicData } = data;

    // Update topic
    const [updatedTopic] = await db
      .update(forumTopics)
      .set({
        ...topicData,
        updatedAt: new Date()
      })
      .where(eq(forumTopics.id, id))
      .returning();

    // Update tags if provided
    if (tags) {
      // Remove old tags
      await db.delete(forumTopicTags).where(eq(forumTopicTags.topicId, id));

      // Add new tags
      if (tags.length > 0) {
        for (const tagName of tags) {
          const normalizedTag = tagName.trim().toLowerCase();
          if (!normalizedTag) continue;

          // Get or create tag
          let [tag] = await db
            .select()
            .from(forumTags)
            .where(eq(forumTags.name, normalizedTag));

          if (!tag) {
            const slug = normalizedTag.replace(/[^a-z0-9]/g, '-');
            [tag] = await db
              .insert(forumTags)
              .values({ name: normalizedTag, slug })
              .returning();
          }

          // Link tag to topic
          await db.insert(forumTopicTags).values({
            topicId: id,
            tagId: tag.id
          });
        }
      }
    }

    return updatedTopic;
  }

  async updateForumTopicStatus(id: string, data: { isSticky?: boolean; isClosed?: boolean }): Promise<ForumTopic> {
    const [updatedTopic] = await db
      .update(forumTopics)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(forumTopics.id, id))
      .returning();

    return updatedTopic;
  }

  async deleteForumTopic(topicId: string): Promise<void> {
    // Get all reply IDs for this topic to delete related notifications
    const replies = await db.select({ id: forumReplies.id }).from(forumReplies).where(eq(forumReplies.topicId, topicId));
    const replyIds = replies.map(r => r.id);

    // Delete ALL notifications that reference this topic OR its replies
    await db.delete(notifications).where(
      or(
        eq(notifications.relatedTopicId, topicId),
        replyIds.length > 0 ? inArray(notifications.relatedReplyId, replyIds) : sql`false`
      )
    );

    // Delete reply likes first (foreign key constraint)
    if (replyIds.length > 0) {
      await db.delete(forumLikes).where(inArray(forumLikes.replyId, replyIds));
    }

    // Delete topic likes
    await db.delete(forumLikes).where(eq(forumLikes.topicId, topicId));

    // Delete topic tags
    await db.delete(forumTopicTags).where(eq(forumTopicTags.topicId, topicId));

    // Delete topic follows
    await db.delete(topicFollows).where(eq(topicFollows.topicId, topicId));

    // Delete replies
    await db.delete(forumReplies).where(eq(forumReplies.topicId, topicId));

    // Finally delete the topic
    await db.delete(forumTopics).where(eq(forumTopics.id, topicId));
  }

  async incrementTopicViewCount(topicId: string): Promise<void> {
    await db
      .update(forumTopics)
      .set({ viewCount: sql`${forumTopics.viewCount} + 1` })
      .where(eq(forumTopics.id, topicId));
  }

  async getForumReplies(topicId: string, userId?: string, limit = 10, offset = 0): Promise<ForumReplyWithRelations[]> {
    const result = await db
      .select({
        id: forumReplies.id,
        content: forumReplies.content,
        topicId: forumReplies.topicId,
        authorId: forumReplies.authorId,
        parentCommentId: forumReplies.parentCommentId,
        likeCount: forumReplies.likeCount,
        isAccepted: forumReplies.isAccepted,
        createdAt: forumReplies.createdAt,
        updatedAt: forumReplies.updatedAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
          isAdmin: users.isAdmin,
          areaAtuacao: users.areaAtuacao,
        },
      })
      .from(forumReplies)
      .leftJoin(users, eq(forumReplies.authorId, users.id))
      .where(eq(forumReplies.topicId, topicId))
      .orderBy(desc(forumReplies.isAccepted), desc(forumReplies.createdAt))
      .limit(limit)
      .offset(offset);

    // Check if user liked each reply
    let hasLikedMap: Record<string, boolean> = {};
    if (userId) {
      const likes = await db
        .select({ replyId: forumLikes.replyId })
        .from(forumLikes)
        .where(and(eq(forumLikes.userId, userId), sqlOp`${forumLikes.replyId} IS NOT NULL`));

      hasLikedMap = likes.reduce((acc, like) => {
        if (like.replyId) acc[like.replyId] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    return result.map(row => ({
      ...row,
      parentCommentId: row.parentCommentId || null,
      author: row.author?.id ? row.author : undefined,
      hasLiked: userId ? hasLikedMap[row.id] || false : false,
    }));
  }

  async getForumReplyById(replyId: string): Promise<ForumReply | undefined> {
    const [reply] = await db
      .select()
      .from(forumReplies)
      .where(eq(forumReplies.id, replyId));
    return reply;
  }

  async createForumReply(reply: InsertForumReply): Promise<ForumReply & { notificationIds?: string[] }> {
    const [newReply] = await db.insert(forumReplies).values(reply).returning();
    const notificationIds: string[] = [];

    // Update topic reply count and updated time
    await db
      .update(forumTopics)
      .set({
        replyCount: sqlOp`${forumTopics.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(forumTopics.id, reply.topicId));

    // Update user points
    await this.updateUserPointsForAction(reply.authorId, 'reply_created');

    // Get topic details and author info for notifications
    const [topic] = await db
      .select()
      .from(forumTopics)
      .where(eq(forumTopics.id, reply.topicId));

    if (!topic) return { ...newReply, notificationIds };

    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.id, reply.authorId));

    // Create notification for topic author (if different from reply author)
    if (topic.authorId !== reply.authorId) {
      const notification = await this.createNotification({
        userId: topic.authorId,
        actorId: reply.authorId,
        type: 'reply',
        message: `${author?.name || 'Alguém'} respondeu no seu tópico`,
        relatedTopicId: reply.topicId,
        relatedReplyId: newReply.id,
      });
      notificationIds.push(notification.id);
    }

    // Get all topic followers
    const followers = await this.getTopicFollowers(reply.topicId);

    // Create notifications for all followers (except the reply author)
    const notificationPromises = followers
      .filter(follower => follower.id !== reply.authorId)
      .map(async follower => {
        const notification = await this.createNotification({
          userId: follower.id,
          actorId: reply.authorId,
          type: 'topic_reply',
          message: `${author?.name || 'Alguém'} respondeu no tópico "${topic.title}" que você segue`,
          relatedTopicId: reply.topicId,
          relatedReplyId: newReply.id,
        });
        return notification.id;
      });

    const followerNotificationIds = await Promise.all(notificationPromises);
    notificationIds.push(...followerNotificationIds);

    return { ...newReply, notificationIds };
  }

  async deleteForumReply(id: string): Promise<void> {
    const [reply] = await db.select().from(forumReplies).where(eq(forumReplies.id, id));

    if (reply) {
      // Update topic reply count
      await db
        .update(forumTopics)
        .set({ replyCount: sqlOp`${forumTopics.replyCount} - 1` })
        .where(eq(forumTopics.id, reply.topicId));

      // Delete likes
      await db.delete(forumLikes).where(eq(forumLikes.replyId, id));
    }

    await db.delete(forumReplies).where(eq(forumReplies.id, id));
  }

  async toggleLike(userId: string, reactionType: string, topicId?: string, replyId?: string): Promise<{ action: 'added' | 'removed' | 'updated', reactionType: string, notificationId?: string, targetUserId?: string }> {
    const existing = await db
      .select()
      .from(forumLikes)
      .where(
        and(
          eq(forumLikes.userId, userId),
          topicId ? eq(forumLikes.topicId, topicId) : sqlOp`${forumLikes.topicId} IS NULL`,
          replyId ? eq(forumLikes.replyId, replyId) : sqlOp`${forumLikes.replyId} IS NULL`
        )
      );

    let notificationId: string | undefined = undefined;
    let targetUserId: string | undefined = undefined;

    if (existing.length > 0) {
      const existingReaction = existing[0];

      if (existingReaction.reactionType === reactionType) {
        // Same reaction - remove it (toggle off)
        await db.delete(forumLikes).where(eq(forumLikes.id, existingReaction.id));

        if (topicId) {
          await db
            .update(forumTopics)
            .set({ likeCount: sqlOp`${forumTopics.likeCount} - 1` })
            .where(eq(forumTopics.id, topicId));
        }

        if (replyId) {
          await db
            .update(forumReplies)
            .set({ likeCount: sqlOp`${forumReplies.likeCount} - 1` })
            .where(eq(forumReplies.id, replyId));
        }

        return { action: 'removed', reactionType };
      } else {
        // Different reaction - update it
        await db
          .update(forumLikes)
          .set({ reactionType })
          .where(eq(forumLikes.id, existingReaction.id));

        return { action: 'updated', reactionType };
      }
    } else {
      // No existing reaction - add new one
      await db.insert(forumLikes).values({
        userId,
        topicId: topicId || null,
        replyId: replyId || null,
        reactionType,
      });

      if (topicId) {
        await db
          .update(forumTopics)
          .set({ likeCount: sqlOp`${forumTopics.likeCount} + 1` })
          .where(eq(forumTopics.id, topicId));

        // Notify topic author
        const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
        if (topic && topic.authorId !== userId) {
          const [likeAuthor] = await db.select().from(users).where(eq(users.id, userId));
          if (likeAuthor) {
            const notification = await this.createNotification({
              userId: topic.authorId,
              actorId: userId,
              type: 'like',
              message: `${likeAuthor.name || 'Alguém'} reagiu ao seu tópico`,
              relatedTopicId: topicId,
            });
            notificationId = notification.id;
            targetUserId = topic.authorId;

            await this.updateUserPointsForAction(topic.authorId, 'like_received');
          }
        }
      }

      if (replyId) {
        await db
          .update(forumReplies)
          .set({ likeCount: sqlOp`${forumReplies.likeCount} + 1` })
          .where(eq(forumReplies.id, replyId));

        // Notify reply author
        const [reply] = await db.select().from(forumReplies).where(eq(forumReplies.id, replyId));
        if (reply && reply.authorId !== userId) {
          const [likeAuthor] = await db.select().from(users).where(eq(users.id, userId));
          if (likeAuthor) {
            const notification = await this.createNotification({
              userId: reply.authorId,
              actorId: userId,
              type: 'like',
              message: `${likeAuthor.name || 'Alguém'} reagiu à sua resposta`,
              relatedTopicId: reply.topicId,
              relatedReplyId: replyId,
            });
            notificationId = notification.id;
            targetUserId = reply.authorId;

            await this.updateUserPointsForAction(reply.authorId, 'like_received');
          }
        }
      }

      return { action: 'added', reactionType, notificationId, targetUserId };
    }
  }

  async unmarkAllBestAnswers(topicId: string): Promise<void> {
    // Primeiro, desmarcar todas as respostas deste tópico
    await db
      .update(forumReplies)
      .set({ isAccepted: false })
      .where(eq(forumReplies.topicId, topicId));

    // Limpar o bestAnswerId do tópico
    await db
      .update(forumTopics)
      .set({ bestAnswerId: null })
      .where(eq(forumTopics.id, topicId));
  }

  async markBestAnswer(topicId: string, replyId: string): Promise<void> {
    // Verificar se essa resposta já está marcada como melhor (idempotência)
    const [currentTopic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
    const isAlreadyBestAnswer = currentTopic?.bestAnswerId === replyId;

    // Se já está marcada, retornar sem fazer nada (evita duplicação de pontos)
    if (isAlreadyBestAnswer) {
      return;
    }

    // Primeiro, desmarcar TODAS as outras respostas deste tópico
    await this.unmarkAllBestAnswers(topicId);

    // Agora marcar a nova resposta como melhor
    await db
      .update(forumTopics)
      .set({ bestAnswerId: replyId })
      .where(eq(forumTopics.id, topicId));

    await db
      .update(forumReplies)
      .set({ isAccepted: true })
      .where(eq(forumReplies.id, replyId));

    // Conceder pontos e notificar (garantido que é a primeira vez)
    const [reply] = await db.select().from(forumReplies).where(eq(forumReplies.id, replyId));
    if (reply) {
      // Award points for best answer using new gamification system
      const { POINTS } = await import('./gamification');
      await this.awardPoints(reply.authorId, POINTS.BEST_ANSWER, 'best_answer', 'bestAnswers');

      const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
      await this.createNotification({
        userId: reply.authorId,
        actorId: topic?.authorId,
        type: 'best_answer',
        message: 'Sua resposta foi marcada como a melhor!',
        relatedTopicId: topicId,
        relatedReplyId: replyId,
      });
    }
  }

  async getForumTags(): Promise<ForumTag[]> {
    return await db.select().from(forumTags).orderBy(forumTags.name);
  }

  async searchForumTags(query: string, limit = 20): Promise<Array<ForumTag & { usageCount: number }>> {
    const searchTerm = `%${query.toLowerCase()}%`;

    const tagsWithCounts = await db
      .select({
        id: forumTags.id,
        name: forumTags.name,
        usageCount: count(forumTopicTags.tagId),
      })
      .from(forumTags)
      .leftJoin(forumTopicTags, eq(forumTags.id, forumTopicTags.tagId))
      .where(ilike(forumTags.name, searchTerm))
      .groupBy(forumTags.id, forumTags.name)
      .orderBy(desc(count(forumTopicTags.tagId)), forumTags.name)
      .limit(limit);

    return tagsWithCounts.map(tag => ({
      id: tag.id,
      name: tag.name,
      usageCount: Number(tag.usageCount || 0),
    }));
  }

  async getTrendingForumTags(limit = 10): Promise<Array<{ id: string; name: string; slug: string; topicCount: number }>> {
    const tagsWithCounts = await db
      .select({
        id: forumTags.id,
        name: forumTags.name,
        slug: forumTags.slug,
        topicCount: count(forumTopicTags.tagId),
      })
      .from(forumTags)
      .leftJoin(forumTopicTags, eq(forumTags.id, forumTopicTags.tagId))
      .groupBy(forumTags.id, forumTags.name, forumTags.slug)
      .orderBy(desc(count(forumTopicTags.tagId)))
      .limit(limit);

    return tagsWithCounts
      .filter(tag => Number(tag.topicCount || 0) > 0) // Apenas tags com tópicos
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        topicCount: Number(tag.topicCount || 0),
      }));
  }

  async getReactionCounts(topicId?: string, replyId?: string): Promise<Record<string, number>> {
    const reactions = await db
      .select({
        reactionType: forumLikes.reactionType,
        count: count(),
      })
      .from(forumLikes)
      .where(
        and(
          topicId ? eq(forumLikes.topicId, topicId) : sqlOp`${forumLikes.topicId} IS NULL`,
          replyId ? eq(forumLikes.replyId, replyId) : sqlOp`${forumLikes.replyId} IS NULL`
        )
      )
      .groupBy(forumLikes.reactionType);

    const counts: Record<string, number> = {};
    reactions.forEach(r => {
      counts[r.reactionType] = r.count;
    });

    return counts;
  }

  async getUserReaction(userId: string, topicId?: string, replyId?: string): Promise<string | null> {
    const [reaction] = await db
      .select({ reactionType: forumLikes.reactionType })
      .from(forumLikes)
      .where(
        and(
          eq(forumLikes.userId, userId),
          topicId ? eq(forumLikes.topicId, topicId) : sqlOp`${forumLikes.topicId} IS NULL`,
          replyId ? eq(forumLikes.replyId, replyId) : sqlOp`${forumLikes.replyId} IS NULL`
        )
      );

    return reaction?.reactionType || null;
  }

  // ==================== BADGES ====================

  async getAllBadges(): Promise<Badge[]> {
    return await db.select().from(badges).orderBy(badges.name);
  }

  async getUserBadges(userId: string): Promise<Badge[]> {
    const result = await db
      .select({
        id: badges.id,
        name: badges.name,
        description: badges.description,
        icon: badges.icon,
        color: badges.color,
        requirement: badges.requirement,
        type: badges.type,
        createdAt: badges.createdAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId));

    return result;
  }

  async awardBadge(userId: string, badgeId: string): Promise<void> {
    const existing = await db
      .select()
      .from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));

    if (existing.length === 0) {
      await db.insert(userBadges).values({
        userId,
        badgeId,
      });

      const [badge] = await db.select().from(badges).where(eq(badges.id, badgeId));
      if (badge) {
        await this.createNotification({
          userId,
          type: 'badge_earned',
          message: `Você conquistou o badge: ${badge.name}!`,
        });
      }
    }
  }

  // ==================== GAMIFICATION ====================

  async getUserPoints(userId: string): Promise<UserPoints | undefined> {
    const [points] = await db.select().from(userPoints).where(eq(userPoints.userId, userId));
    return points;
  }

  async updateUserPointsForAction(userId: string, action: string): Promise<void> {
    const pointsMap: Record<string, number> = {
      topic_created: 10,
      reply_created: 5,
      like_received: 2,
      best_answer: 20,
      post_created: 10,
      comment_created: 5,
      like_given: 1,
      share_given: 5,
    };

    const points = pointsMap[action] || 0;

    const updateData: any = {
      points: sqlOp`${userPoints.points} + ${points}`,
      updatedAt: new Date(),
    };

    if (action === 'topic_created') {
      updateData.topicsCreated = sqlOp`${userPoints.topicsCreated} + 1`;
    } else if (action === 'reply_created') {
      updateData.repliesCreated = sqlOp`${userPoints.repliesCreated} + 1`;
    } else if (action === 'like_received') {
      updateData.likesReceived = sqlOp`${userPoints.likesReceived} + 1`;
    } else if (action === 'best_answer') {
      updateData.bestAnswers = sqlOp`${userPoints.bestAnswers} + 1`;
    } else if (action === 'post_created') {
      updateData.postsCreated = sqlOp`${userPoints.postsCreated} + 1`;
    } else if (action === 'comment_created') {
      updateData.commentsCreated = sqlOp`${userPoints.commentsCreated} + 1`;
    }

    await db
      .update(userPoints)
      .set(updateData)
      .where(eq(userPoints.userId, userId));

    // Check and update level
    const [updated] = await db.select().from(userPoints).where(eq(userPoints.userId, userId));
    if (updated) {
      const newLevel = Math.floor(updated.points / 100) + 1;
      if (newLevel > updated.level) {
        await db
          .update(userPoints)
          .set({ level: newLevel })
          .where(eq(userPoints.userId, userId));
      }
    }

    // Update weekly challenge progress
    await this.updateWeeklyChallengeProgressForAction(userId, action);
  }

  async updateWeeklyChallengeProgressForAction(userId: string, action: string): Promise<void> {
    const challengeTypeMap: Record<string, string> = {
      post_created: 'posts_count',
      topic_created: 'topics_count',
      comment_created: 'comments_count',
      reply_created: 'comments_count',
      like_received: 'likes_count',
    };

    const challengeType = challengeTypeMap[action];
    if (!challengeType) return;

    const activeChallenges = await db
      .select()
      .from(weeklyChallenges)
      .where(
        and(
          eq(weeklyChallenges.isActive, true),
          eq(weeklyChallenges.challengeType, challengeType)
        )
      );

    // Calcular início da semana (segunda-feira) usando timezone de São Paulo
    const { start: weekStart } = getWeekBoundariesSaoPaulo();

    for (const challenge of activeChallenges) {
      let progress = await this.getUserWeeklyProgress(userId, challenge.id);

      if (!progress) {
        [progress] = await db
          .insert(userWeeklyProgress)
          .values({
            userId,
            challengeId: challenge.id,
            currentProgress: 1,
            isClaimed: false,
            weekStartDate: weekStart,
          })
          .returning();
      } else {
        await db
          .update(userWeeklyProgress)
          .set({
            currentProgress: sqlOp`${userWeeklyProgress.currentProgress} + 1`,
          })
          .where(eq(userWeeklyProgress.id, progress.id));
      }
    }
  }

  async getLeaderboard(limit: number = 10) {
    return await db
      .select({
        userId: userPoints.userId,
        points: userPoints.points,
        level: userPoints.level,
        user: {
          id: users.id,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(userPoints)
      .leftJoin(users, eq(userPoints.userId, users.id))
      .orderBy(desc(userPoints.points))
      .limit(limit);
  }

  // ==================== NOTIFICATIONS ====================

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();

    // Emitir notificação via Socket.IO para o usuário específico
    // A emissão será feita nas rotas para ter acesso ao objeto io
    return newNotification;
  }

  async createAndEmitNotification(notification: InsertNotification, io?: any): Promise<Notification> {
    const newNotification = await this.createNotification(notification);

    // Emitir notificação em tempo real se io estiver disponível
    if (io) {
      io.emit('new_notification', {
        ...newNotification,
        userId: notification.userId,
      });
    }

    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async getUserNotificationsWithActor(userId: string): Promise<any[]> {
    const notifs = await db
      .select({
        notification: notifications,
        actor: users,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    return notifs.map(row => ({
      ...row.notification,
      actor: row.actor ? {
        id: row.actor.id,
        name: row.actor.name,
        profileImageUrl: row.actor.profileImageUrl,
        profession: row.actor.profession,
      } : null,
    }));
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async getNotificationById(id: string): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // ==================== MARKETPLACE ====================

  async getMarketplaceProducts(filters?: {
    category?: string;
    search?: string;
    sellerId?: string;
  }): Promise<MarketplaceProductWithRelations[]> {
    const conditions = [eq(marketplaceProducts.isActive, true), eq(marketplaceProducts.isBlocked, false)];

    if (filters?.category) {
      conditions.push(eq(marketplaceProducts.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(marketplaceProducts.title, `%${filters.search}%`),
          ilike(marketplaceProducts.description, `%${filters.search}%`)
        )!
      );
    }
    if (filters?.sellerId) {
      conditions.push(eq(marketplaceProducts.sellerId, filters.sellerId));
    }

    const result = await db
      .select({
        product: marketplaceProducts,
        seller: {
          id: users.id,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(marketplaceProducts)
      .leftJoin(users, eq(marketplaceProducts.sellerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(marketplaceProducts.createdAt));

    return result.map(r => ({
      ...r.product,
      seller: r.seller?.id ? r.seller : undefined,
    }));
  }

  async getMarketplaceProductById(id: string): Promise<MarketplaceProductWithRelations | undefined> {
    const [result] = await db
      .select({
        product: marketplaceProducts,
        seller: {
          id: users.id,
          name: users.name,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(marketplaceProducts)
      .leftJoin(users, eq(marketplaceProducts.sellerId, users.id))
      .where(eq(marketplaceProducts.id, id));

    if (!result) return undefined;

    const reviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, id))
      .orderBy(desc(productReviews.createdAt));

    return {
      ...result.product,
      seller: result.seller?.id ? result.seller : undefined,
      reviews,
    };
  }

  async createMarketplaceProduct(product: InsertMarketplaceProduct): Promise<MarketplaceProduct> {
    const [newProduct] = await db.insert(marketplaceProducts).values(product).returning();
    return newProduct;
  }

  async updateMarketplaceProduct(id: string, product: Partial<InsertMarketplaceProduct>): Promise<MarketplaceProduct> {
    const [updated] = await db
      .update(marketplaceProducts)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(marketplaceProducts.id, id))
      .returning();
    return updated;
  }

  async deleteMarketplaceProduct(id: string): Promise<void> {
    await db.delete(marketplaceProducts).where(eq(marketplaceProducts.id, id));
  }

  async getAllMarketplaceProducts(): Promise<any[]> {
    const result = await db
      .select({
        product: marketplaceProducts,
        seller: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(marketplaceProducts)
      .leftJoin(users, eq(marketplaceProducts.sellerId, users.id))
      .where(isNull(marketplaceProducts.deletedAt)) // Filter out soft deleted products
      .orderBy(desc(marketplaceProducts.createdAt));

    return result.map(r => ({
      id: r.product.id,
      title: r.product.title,
      description: r.product.description,
      sellerId: r.product.sellerId,
      sellerName: r.seller?.name,
      sellerEmail: r.seller?.email,
      price: r.product.price,
      category: r.product.category,
      images: r.product.images,
      productUrl: r.product.productUrl,
      slug: r.product.slug,
      isDigital: r.product.isDigital,
      isActive: r.product.isActive,
      isBlocked: r.product.isBlocked,
      blockReason: r.product.blockReason,
      blockedAt: r.product.blockedAt,
      deletedAt: r.product.deletedAt,
      deletedReason: r.product.deletedReason,
      salesCount: r.product.salesCount,
      rating: r.product.rating,
      reviewCount: r.product.reviewCount,
      createdAt: r.product.createdAt,
      updatedAt: r.product.updatedAt,
    }));
  }

  async blockMarketplaceProduct(id: string, reason: string): Promise<MarketplaceProduct> {
    const [updated] = await db
      .update(marketplaceProducts)
      .set({
        isBlocked: true,
        blockReason: reason,
        blockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceProducts.id, id))
      .returning();
    return updated;
  }

  async unblockMarketplaceProduct(id: string): Promise<MarketplaceProduct> {
    const [updated] = await db
      .update(marketplaceProducts)
      .set({
        isBlocked: false,
        blockReason: null,
        blockedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceProducts.id, id))
      .returning();
    return updated;
  }

  async getProductReviews(productId: string): Promise<ProductReview[]> {
    return await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, productId))
      .orderBy(desc(productReviews.createdAt));
  }

  async createProductReview(review: InsertProductReview): Promise<ProductReview> {
    const [newReview] = await db.insert(productReviews).values(review).returning();

    // Update product rating
    const reviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.productId, review.productId));

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await db
      .update(marketplaceProducts)
      .set({
        rating: Math.round(avgRating * 10),
        reviewCount: reviews.length,
      })
      .where(eq(marketplaceProducts.id, review.productId));

    return newReview;
  }

  async deleteProductReview(id: string): Promise<void> {
    const [review] = await db.select().from(productReviews).where(eq(productReviews.id, id));
    if (review) {
      await db.delete(productReviews).where(eq(productReviews.id, id));

      // Recalculate product rating after deletion
      const reviews = await db
        .select()
        .from(productReviews)
        .where(eq(productReviews.productId, review.productId));

      if (reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await db
          .update(marketplaceProducts)
          .set({
            rating: Math.round(avgRating * 10),
            reviewCount: reviews.length,
          })
          .where(eq(marketplaceProducts.id, review.productId));
      } else {
        await db
          .update(marketplaceProducts)
          .set({ rating: 0, reviewCount: 0 })
          .where(eq(marketplaceProducts.id, review.productId));
      }
    }
  }

  // ==================== PODPAY & SELLER WALLET ====================

  async getOrCreateSellerWallet(sellerId: string): Promise<SellerWallet> {
    let [wallet] = await db
      .select()
      .from(sellerWallet)
      .where(eq(sellerWallet.sellerId, sellerId))
      .limit(1);

    if (!wallet) {
      [wallet] = await db
        .insert(sellerWallet)
        .values({
          sellerId,
          balancePending: 0,
          balanceAvailable: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        })
        .returning();
    }

    return wallet;
  }

  async updateSellerWallet(sellerId: string, updates: Partial<SellerWallet>): Promise<SellerWallet> {
    const [updated] = await db
      .update(sellerWallet)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sellerWallet.sellerId, sellerId))
      .returning();
    
    return updated;
  }

  async createPodpayTransaction(transaction: any): Promise<PodpayTransaction> {
    const [newTransaction] = await db
      .insert(podpayTransactions)
      .values(transaction)
      .returning();
    
    return newTransaction;
  }

  async updatePodpayTransaction(id: string, updates: any): Promise<PodpayTransaction> {
    const [updated] = await db
      .update(podpayTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(podpayTransactions.id, id))
      .returning();
    
    return updated;
  }

  async getPodpayTransactionByOrderId(orderId: string): Promise<PodpayTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(podpayTransactions)
      .where(eq(podpayTransactions.orderId, orderId))
      .limit(1);
    
    return transaction;
  }

  async createPodpayWithdrawal(withdrawal: any): Promise<PodpayWithdrawal> {
    const [newWithdrawal] = await db
      .insert(podpayWithdrawals)
      .values(withdrawal)
      .returning();
    
    return newWithdrawal;
  }

  async updatePodpayWithdrawal(id: string, updates: any): Promise<PodpayWithdrawal> {
    const [updated] = await db
      .update(podpayWithdrawals)
      .set(updates)
      .where(eq(podpayWithdrawals.id, id))
      .returning();
    
    return updated;
  }

  async getSellerWithdrawals(sellerId: string): Promise<PodpayWithdrawal[]> {
    return await db
      .select()
      .from(podpayWithdrawals)
      .where(eq(podpayWithdrawals.sellerId, sellerId))
      .orderBy(desc(podpayWithdrawals.createdAt));
  }

  async calculateAvailableBalance(sellerId: string): Promise<{ balancePending: number; balanceAvailable: number }> {
    // Get all completed orders for this seller
    const orders = await db
      .select()
      .from(marketplaceOrders)
      .where(
        and(
          eq(marketplaceOrders.sellerId, sellerId),
          eq(marketplaceOrders.status, 'completed')
        )
      );

    // Calculate 8 days ago using São Paulo timezone
    const eightDaysAgo = daysAgoSaoPaulo(8);

    // Separate pending (< 8 days) and available (>= 8 days) balances from marketplace sales
    let balancePending = 0;
    let balanceAvailable = 0;

    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      // Use netAmountCents (new data with split) or fallback to amount (old data without split)
      const netAmount = order.netAmountCents ?? order.amount;

      if (orderDate < eightDaysAgo) {
        balanceAvailable += netAmount;
      } else {
        balancePending += netAmount;
      }
    }

    // Subtract completed marketplace withdrawals only
    const withdrawals = await db
      .select()
      .from(podpayWithdrawals)
      .where(
        and(
          eq(podpayWithdrawals.sellerId, sellerId),
          eq(podpayWithdrawals.source, 'marketplace'),
          eq(podpayWithdrawals.status, 'completed')
        )
      );

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amountCents, 0);
    balanceAvailable -= totalWithdrawn;

    // Ensure balances are never negative
    balanceAvailable = Math.max(0, balanceAvailable);

    return {
      balancePending,
      balanceAvailable,
    };
  }

  async createSellerTransaction(transaction: any): Promise<SellerTransaction> {
    const [newTransaction] = await db
      .insert(sellerTransactions)
      .values(transaction)
      .returning();
    
    return newTransaction;
  }

  async getSellerTransactions(
    sellerId: string,
    filters?: { type?: string; status?: string }
  ): Promise<SellerTransaction[]> {
    const conditions = [eq(sellerTransactions.sellerId, sellerId)];

    if (filters?.type) {
      conditions.push(eq(sellerTransactions.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(sellerTransactions.status, filters.status));
    }

    return await db
      .select()
      .from(sellerTransactions)
      .where(and(...conditions))
      .orderBy(desc(sellerTransactions.createdAt));
  }

  // ==================== SUPPORT TICKETS ====================

  async getSupportTickets(userId?: string): Promise<SupportTicketWithRelations[]> {
    const conditions = userId ? [eq(supportTickets.userId, userId)] : [];

    const result = await db
      .select({
        ticket: supportTickets,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .$dynamic()
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt));

    return result.map(r => ({
      ...r.ticket,
      user: r.user?.id ? r.user : undefined,
    }));
  }

  async getSupportTicketById(id: string): Promise<SupportTicketWithRelations | undefined> {
    const [result] = await db
      .select({
        ticket: supportTickets,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(eq(supportTickets.id, id));

    if (!result) return undefined;

    return {
      ...result.ticket,
      user: result.user?.id ? result.user : undefined,
    };
  }

  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [newTicket] = await db.insert(supportTickets).values(ticket).returning();
    return newTicket;
  }

  async updateSupportTicketStatus(id: string, status: string): Promise<SupportTicket> {
    const [updated] = await db
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async deleteSupportTicket(id: string): Promise<void> {
    await db.delete(supportTickets).where(eq(supportTickets.id, id));
  }

  // ==================== USER FOLLOW OPERATIONS ====================

  async followUser(followerId: string, followingId: string): Promise<void> {
    await db.insert(userFollows).values({
      followerId,
      followingId,
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId)
        )
      );
  }

  async getFollowers(userId: string): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        phone: users.phone,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        accountStatus: users.accountStatus,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        caktoCustomerId: users.caktoCustomerId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(userFollows)
      .leftJoin(users, eq(userFollows.followerId, users.id))
      .where(eq(userFollows.followingId, userId));

    return result.filter(row => row.id !== null) as User[];
  }

  async getFollowing(userId: string): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        phone: users.phone,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        accountStatus: users.accountStatus,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        caktoCustomerId: users.caktoCustomerId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(userFollows)
      .leftJoin(users, eq(userFollows.followingId, users.id))
      .where(eq(userFollows.followerId, userId));

    return result.filter(row => row.id !== null) as User[];
  }

  async getUserFollowers(userId: string): Promise<User[]> {
    return this.getFollowers(userId);
  }

  async getUserFollowing(userId: string): Promise<User[]> {
    return this.getFollowing(userId);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId)
        )
      )
      .limit(1);

    return !!result;
  }

  // ==================== TOPIC FOLLOW OPERATIONS ====================

  async followTopic(userId: string, topicId: string): Promise<void> {
    await db.insert(topicFollows).values({
      userId,
      topicId,
    });
  }

  async unfollowTopic(userId: string, topicId: string): Promise<void> {
    await db
      .delete(topicFollows)
      .where(
        and(
          eq(topicFollows.userId, userId),
          eq(topicFollows.topicId, topicId)
        )
      );
  }

  async getTopicFollowers(topicId: string): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        name: users.name,
        phone: users.phone,
        profileImageUrl: users.profileImageUrl,
        isAdmin: users.isAdmin,
        accountStatus: users.accountStatus,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        caktoCustomerId: users.caktoCustomerId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(topicFollows)
      .leftJoin(users, eq(topicFollows.userId, users.id))
      .where(eq(topicFollows.topicId, topicId));

    return result.filter(row => row.id !== null) as User[];
  }

  async getFollowedTopics(userId: string): Promise<ForumTopic[]> {
    const result = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        content: forumTopics.content,
        authorId: forumTopics.authorId,
        categoryId: forumTopics.categoryId,
        viewCount: forumTopics.viewCount,
        replyCount: forumTopics.replyCount,
        likeCount: forumTopics.likeCount,
        isSticky: forumTopics.isSticky,
        isClosed: forumTopics.isClosed,
        bestAnswerId: forumTopics.bestAnswerId,
        createdAt: forumTopics.createdAt,
        updatedAt: forumTopics.updatedAt,
      })
      .from(topicFollows)
      .leftJoin(forumTopics, eq(topicFollows.topicId, forumTopics.id))
      .where(eq(topicFollows.userId, userId));

    return result.filter(row => row.id !== null) as ForumTopic[];
  }

  async isFollowingTopic(userId: string, topicId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(topicFollows)
      .where(
        and(
          eq(topicFollows.userId, userId),
          eq(topicFollows.topicId, topicId)
        )
      )
      .limit(1);

    return !!result;
  }

  // ==================== ADMIN ANALYTICS ====================

  async getAdminAnalytics() {
    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [activeUsersResult] = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.accountStatus, 'active'));
    const [totalTopicsResult] = await db.select({ count: count() }).from(forumTopics);
    const [totalRepliesResult] = await db.select({ count: count() }).from(forumReplies);
    const [totalPLRsResult] = await db.select({ count: count() }).from(plrs);
    const [totalServicesResult] = await db.select({ count: count() }).from(services);

    // Contar TODOS os cursos, não por categoria
    const [totalCoursesResult] = await db.select({ count: count() }).from(courses);

    const [totalAIToolsResult] = await db.select({ count: count() }).from(aiTools);
    const [totalMarketplaceProductsResult] = await db.select({ count: count() }).from(marketplaceProducts);
    const [totalSupportTicketsResult] = await db.select({ count: count() }).from(supportTickets);
    const [openTicketsResult] = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, 'open'));

    return {
      totalUsers: totalUsersResult.count,
      activeUsers: activeUsersResult.count,
      totalTopics: totalTopicsResult.count,
      totalReplies: totalRepliesResult.count,
      totalPLRs: totalPLRsResult.count,
      totalServices: totalServicesResult.count,
      totalCourses: totalCoursesResult.count,
      totalAITools: totalAIToolsResult.count,
      totalMarketplaceProducts: totalMarketplaceProductsResult.count,
      totalSupportTickets: totalSupportTicketsResult.count,
      openTickets: openTicketsResult.count,
    };
  }

  async getUserGrowthData(days: number = 30) {
    const result = await db
      .select({
        date: sqlOp<string>`DATE(${users.createdAt})`,
        count: count(),
      })
      .from(users)
      .where(sqlOp`${users.createdAt} >= NOW() - INTERVAL '${sqlOp.raw(String(days))} days'`)
      .groupBy(sqlOp`DATE(${users.createdAt})`)
      .orderBy(sqlOp`DATE(${users.createdAt})`);

    return result.map(row => ({
      date: row.date,
      count: row.count,
    }));
  }

  async getForumActivityData(days: number = 30) {
    const topicsResult = await db
      .select({
        date: sqlOp<string>`DATE(${forumTopics.createdAt})`,
        count: count(),
      })
      .from(forumTopics)
      .where(sqlOp`${forumTopics.createdAt} >= NOW() - INTERVAL '${sqlOp.raw(String(days))} days'`)
      .groupBy(sqlOp`DATE(${forumTopics.createdAt})`)
      .orderBy(sqlOp`DATE(${forumTopics.createdAt})`);

    const repliesResult = await db
      .select({
        date: sqlOp<string>`DATE(${forumReplies.createdAt})`,
        count: count(),
      })
      .from(forumReplies)
      .where(sqlOp`${forumReplies.createdAt} >= NOW() - INTERVAL '${sqlOp.raw(String(days))} days'`)
      .groupBy(sqlOp`DATE(${forumReplies.createdAt})`)
      .orderBy(sqlOp`DATE(${forumReplies.createdAt})`);

    const topicsMap = new Map(topicsResult.map(row => [row.date, row.count]));
    const repliesMap = new Map(repliesResult.map(row => [row.date, row.count]));

    const allDates = new Set([...topicsMap.keys(), ...repliesMap.keys()]);
    const result = Array.from(allDates).map(date => ({
      date,
      topics: topicsMap.get(date) || 0,
      replies: repliesMap.get(date) || 0,
    }));

    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }

  // ==================== TIMELINE/SOCIAL FEED OPERATIONS ====================

  async createTimelinePost(postData: InsertTimelinePost): Promise<TimelinePost> {
    const { tags, ...data } = postData;
    const [post] = await db.insert(timelinePosts).values(data).returning();

    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const slug = tagName.toLowerCase().replace(/\s+/g, '-');
        let [tag] = await db.select().from(timelineTags).where(eq(timelineTags.slug, slug));

        if (!tag) {
          [tag] = await db.insert(timelineTags).values({ name: tagName, slug }).returning();
        }

        await db.insert(postTagRelations).values({
          postId: post.id,
          tagId: tag.id,
        });

        await db
          .update(timelineTags)
          .set({ postCount: sqlOp`${timelineTags.postCount} + 1` })
          .where(eq(timelineTags.id, tag.id));
      }
    }

    return post;
  }

  async updatePostTags(postId: string, tags: string[]): Promise<void> {
    // Remover relações existentes
    await db.delete(postTagRelations).where(eq(postTagRelations.postId, postId));

    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const slug = tagName.toLowerCase().replace(/\s+/g, '-');
        let [tag] = await db.select().from(timelineTags).where(eq(timelineTags.slug, slug));

        if (!tag) {
          [tag] = await db.insert(timelineTags).values({ name: tagName, slug }).returning();
        }

        await db.insert(postTagRelations).values({
          postId,
          tagId: tag.id,
        });

        await db
          .update(timelineTags)
          .set({ postCount: sqlOp`${timelineTags.postCount} + 1` })
          .where(eq(timelineTags.id, tag.id));
      }
    }
  }

  async getTimelinePosts(
    filter?: 'recent' | 'oldest' | 'most_commented' | 'most_liked',
    userId?: string,
    limit = 8,
    offset = 0,
    category?: string,
    tag?: string
  ): Promise<TimelinePostWithRelations[]> {
    let orderByClause;
    switch (filter) {
      case 'oldest':
        orderByClause = timelinePosts.createdAt;
        break;
      case 'most_commented':
        orderByClause = desc(timelinePosts.commentCount);
        break;
      case 'most_liked':
        orderByClause = desc(timelinePosts.likeCount);
        break;
      default:
        orderByClause = desc(timelinePosts.createdAt);
    }

    // Se houver filtro por tag, fazer join com as tabelas de tags
    let query = db
      .select({
        timeline_posts: timelinePosts,
        users: users,
        userPoints: userPoints.points,
      })
      .from(timelinePosts)
      .leftJoin(users, eq(timelinePosts.userId, users.id))
      .leftJoin(userPoints, eq(users.id, userPoints.userId));

    // Adicionar join com tags se necessário
    if (tag) {
      query = query
        .innerJoin(postTagRelations, eq(timelinePosts.id, postTagRelations.postId))
        .innerJoin(timelineTags, and(
          eq(postTagRelations.tagId, timelineTags.id),
          eq(timelineTags.name, tag)
        )) as any;
    }

    // Buscar posts com autores e points otimizado
    const posts = await query
      .where(eq(timelinePosts.isActive, true))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    if (posts.length === 0) return [];

    const postIds = posts.map(row => row.timeline_posts.id);

    // 2. Buscar top 3 comentários raiz por post usando window function
    const postIdsStr = postIds.map(id => `'${id}'`).join(',');
    const allCommentsData = await db.execute(sql.raw(`
      WITH ranked_comments AS (
        SELECT 
          pc.*,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.profile_image_url as user_profile_image_url,
          u.profession as user_profession,
          up.points as user_points,
          ROW_NUMBER() OVER (
            PARTITION BY pc.post_id 
            ORDER BY 
              CASE WHEN pc.parent_comment_id IS NULL THEN 0 ELSE 1 END,
              pc.like_count DESC, 
              pc.created_at DESC
          ) as rn
        FROM post_comments pc
        INNER JOIN users u ON pc.user_id = u.id
        LEFT JOIN user_points up ON u.id = up.user_id
        WHERE pc.post_id IN (${postIdsStr})
          AND u.id IS NOT NULL
      )
      SELECT * FROM ranked_comments WHERE rn <= 3
    `));

    // 3. Buscar TODAS as relações de tags em UMA query
    const allTagRelations = await db
      .select()
      .from(postTagRelations)
      .where(inArray(postTagRelations.postId, postIds));

    // 4. Buscar TODAS as tags necessárias em UMA query
    const tagIds = allTagRelations.map(r => r.tagId);
    const allTags = tagIds.length > 0
      ? await db.select().from(timelineTags).where(inArray(timelineTags.id, tagIds))
      : [];

    // 5. Buscar TODAS as reações do usuário em UMA query
    const allReactions = userId
      ? await db
          .select()
          .from(postReactions)
          .where(and(
            inArray(postReactions.postId, postIds),
            eq(postReactions.userId, userId)
          ))
      : [];

    // 5.5. Buscar curtidas de TODOS os comentários do usuário (incluindo respostas)
    const topCommentIds = (allCommentsData.rows || []).map((row: any) => row.id);

    // Buscar TODOS os comentários dos posts (incluindo respostas)
    const allComments = await db
      .select()
      .from(postComments)
      .where(inArray(postComments.postId, postIds));

    const allCommentIds = allComments.map(c => c.id);
    const allCommentLikes = userId && allCommentIds.length > 0
      ? await db
          .select()
          .from(commentLikes)
          .where(and(
            inArray(commentLikes.commentId, allCommentIds),
            eq(commentLikes.userId, userId)
          ))
      : [];
    const likedCommentIds = new Set(allCommentLikes.map(like => like.commentId));

    // 6. Organizar dados em maps para acesso rápido
    const commentsByPostId = new Map<string, any[]>();
    (allCommentsData.rows || []).forEach((row: any) => {
      const postId = row.post_id;
      if (!commentsByPostId.has(postId)) {
        commentsByPostId.set(postId, []);
      }
      commentsByPostId.get(postId)!.push({
        id: row.id,
        content: row.content,
        postId: row.post_id,
        userId: row.user_id,
        parentCommentId: row.parent_comment_id,
        likeCount: row.like_count || 0,
        replyCount: row.reply_count || 0,
        isPinned: row.is_pinned || false,
        isBestAnswer: row.is_best_answer || false,
        userHasLiked: likedCommentIds.has(row.id),
        createdAt: row.created_at,
        author: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          profileImageUrl: row.user_profile_image_url,
          profession: row.user_profession,
          points: row.user_points,
        },
      });
    });

    const tagsByPostId = new Map<string, any[]>();
    const tagsMap = new Map(allTags.map(tag => [tag.id, tag]));
    allTagRelations.forEach(rel => {
      const tag = tagsMap.get(rel.tagId);
      if (tag) {
        if (!tagsByPostId.has(rel.postId)) {
          tagsByPostId.set(rel.postId, []);
        }
        tagsByPostId.get(rel.postId)!.push(tag);
      }
    });

    const reactionsByPostId = new Map(allReactions.map(r => [r.postId, r]));

    // Removido busca de user points e reações detalhadas para otimizar performance
    // Os counts já estão desnormalizados nas tabelas principais (likeCount, commentCount, etc)

    // 7. Buscar posts compartilhados (shared posts) com media
    const sharedPostIds = posts
      .map(row => row.timeline_posts.sharedPostId)
      .filter((id): id is string => id !== null);

    let sharedPostsMap = new Map<string, any>();

    if (sharedPostIds.length > 0) {
      const sharedPostsData = await db
        .select()
        .from(timelinePosts)
        .leftJoin(users, eq(timelinePosts.userId, users.id))
        .where(inArray(timelinePosts.id, sharedPostIds));

      sharedPostsData.forEach(row => {
        const postData = row.timeline_posts;
        const author = row.users;

        sharedPostsMap.set(postData.id, {
          ...postData,
          author: author ? {
            id: author.id,
            name: author.name,
            profileImageUrl: author.profileImageUrl,
            profession: author.profession,
            areaAtuacao: author.areaAtuacao,
            badge: author.badge,
          } : null,
          media: postData.media || [],
        });
      });
    }

    // 8. Construir resultado final
    return posts.map((row) => {
      const postData = row.timeline_posts;
      const author = row.users;

      const postComments = commentsByPostId.get(postData.id) || [];

      return {
        ...postData,
        author: author ? {
          id: author.id,
          name: author.name,
          profileImageUrl: author.profileImageUrl,
          profession: author.profession,
          areaAtuacao: author.areaAtuacao,
          points: row.userPoints, // Points do join com user_points
        } : null,
        likeCount: postData.likeCount || 0,
        commentCount: postData.commentCount || 0,
        shareCount: postData.shareCount || 0,
        reactionType: reactionsByPostId.get(postData.id)?.type || null,
        tags: tagsByPostId.get(postData.id) || [],
        comments: postComments,
        sharedPost: postData.sharedPostId ? sharedPostsMap.get(postData.sharedPostId) : null,
      };
    });
  }

  async getFollowingPosts(userId: string, limit = 8, offset = 0): Promise<TimelinePostWithRelations[]> {
    // Buscar IDs de usuários que o current user segue
    const following = await db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));

    if (following.length === 0) {
      return [];
    }

    const followingIds = following.map(f => f.followingId);

    // Buscar posts apenas desses usuários
    const posts = await db
      .select({
        timeline_posts: timelinePosts,
        users: users,
        userPoints: userPoints.points,
      })
      .from(timelinePosts)
      .leftJoin(users, eq(timelinePosts.userId, users.id))
      .leftJoin(userPoints, eq(users.id, userPoints.userId))
      .where(
        and(
          eq(timelinePosts.isActive, true),
          inArray(timelinePosts.userId, followingIds)
        )
      )
      .orderBy(desc(timelinePosts.createdAt))
      .limit(limit)
      .offset(offset);

    return this.buildTimelinePostsResponse(posts, userId);
  }

  async getUserPosts(userId: string, limit = 8, offset = 0): Promise<TimelinePostWithRelations[]> {
    // Buscar apenas posts do próprio usuário
    const posts = await db
      .select({
        timeline_posts: timelinePosts,
        users: users,
        userPoints: userPoints.points,
      })
      .from(timelinePosts)
      .leftJoin(users, eq(timelinePosts.userId, users.id))
      .leftJoin(userPoints, eq(users.id, userPoints.userId))
      .where(
        and(
          eq(timelinePosts.isActive, true),
          eq(timelinePosts.userId, userId)
        )
      )
      .orderBy(desc(timelinePosts.createdAt))
      .limit(limit)
      .offset(offset);

    return this.buildTimelinePostsResponse(posts, userId);
  }

  private async buildTimelinePostsResponse(posts: any[], userId?: string): Promise<TimelinePostWithRelations[]> {
    if (posts.length === 0) return [];

    const postIds = posts.map(row => row.timeline_posts.id);

    // Buscar APENAS top 2 comentários por post (reduzir tráfego)
    const postIdsStr = postIds.map(id => `'${id}'`).join(',');
    const allCommentsData = await db.execute(sql.raw(`
      WITH ranked_comments AS (
        SELECT 
          pc.id,
          pc.post_id,
          pc.content,
          pc.created_at,
          pc.like_count,
          pc.is_pinned,
          pc.parent_comment_id,
          pc.reply_count,
          u.id as user_id,
          u.name as user_name,
          u.profile_image_url as user_profile_image_url,
          u.profession as user_profession,
          ROW_NUMBER() OVER (
            PARTITION BY pc.post_id 
            ORDER BY 
              CASE WHEN pc.parent_comment_id IS NULL THEN 0 ELSE 1 END,
              pc.is_pinned DESC, 
              pc.like_count DESC, 
              pc.created_at DESC
          ) as rn
        FROM post_comments pc
        INNER JOIN users u ON pc.user_id = u.id
        WHERE pc.post_id IN (${postIdsStr})
          AND u.id IS NOT NULL
      )
      SELECT * FROM ranked_comments WHERE rn <= 2
    `));

    // Buscar TODAS as relações de tags em UMA query
    const allTagRelations = await db
      .select()
      .from(postTagRelations)
      .where(inArray(postTagRelations.postId, postIds));

    // Buscar TODAS as tags necessárias em UMA query
    const tagIds = allTagRelations.map(r => r.tagId);
    const allTags = tagIds.length > 0
      ? await db.select().from(timelineTags).where(inArray(timelineTags.id, tagIds))
      : [];

    // Buscar TODAS as reações do usuário em UMA query
    const allReactions = userId
      ? await db
          .select()
          .from(postReactions)
          .where(and(
            inArray(postReactions.postId, postIds),
            eq(postReactions.userId, userId)
          ))
      : [];

    // Buscar curtidas de TODOS os comentários do usuário
    const topCommentIds = (allCommentsData.rows || []).map((row: any) => row.id);
    const allComments = await db
      .select()
      .from(postComments)
      .where(inArray(postComments.postId, postIds));

    const allCommentIds = allComments.map(c => c.id);
    const allCommentLikes = userId && allCommentIds.length > 0
      ? await db
          .select()
          .from(commentLikes)
          .where(and(
            inArray(commentLikes.commentId, allCommentIds),
            eq(commentLikes.userId, userId)
          ))
      : [];

    const likedCommentIds = new Set(allCommentLikes.map(like => like.commentId));

    const commentsByPostId = new Map<string, any[]>();
    (allCommentsData.rows || []).forEach((row: any) => {
      if (!commentsByPostId.has(row.post_id)) {
        commentsByPostId.set(row.post_id, []);
      }
      commentsByPostId.get(row.post_id)!.push({
        id: row.id,
        content: row.content,
        postId: row.post_id,
        userId: row.user_id,
        parentCommentId: row.parent_comment_id,
        likeCount: row.like_count || 0,
        replyCount: row.reply_count || 0,
        isPinned: row.is_pinned || false,
        userHasLiked: likedCommentIds.has(row.id),
        createdAt: row.created_at,
        author: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          profileImageUrl: row.user_profile_image_url,
          profession: row.user_profession,
          points: row.user_points,
        },
      });
    });

    const tagsByPostId = new Map<string, any[]>();
    const tagsMap = new Map(allTags.map(tag => [tag.id, tag]));
    allTagRelations.forEach(rel => {
      const tag = tagsMap.get(rel.tagId);
      if (tag) {
        if (!tagsByPostId.has(rel.postId)) {
          tagsByPostId.set(rel.postId, []);
        }
        tagsByPostId.get(rel.postId)!.push(tag);
      }
    });

    const reactionsByPostId = new Map(allReactions.map(r => [r.postId, r]));

    // Buscar posts compartilhados (shared posts) com media
    const sharedPostIds = posts
      .map(row => row.timeline_posts.sharedPostId)
      .filter((id): id is string => id !== null);

    let sharedPostsMap = new Map<string, any>();

    if (sharedPostIds.length > 0) {
      const sharedPostsData = await db
        .select()
        .from(timelinePosts)
        .leftJoin(users, eq(timelinePosts.userId, users.id))
        .where(inArray(timelinePosts.id, sharedPostIds));

      sharedPostsData.forEach(row => {
        const postData = row.timeline_posts;
        const author = row.users;

        sharedPostsMap.set(postData.id, {
          ...postData,
          author: author ? {
            id: author.id,
            name: author.name,
            profileImageUrl: author.profileImageUrl,
            profession: author.profession,
            areaAtuacao: author.areaAtuacao,
            badge: author.badge,
          } : null,
          media: postData.media || [],
        });
      });
    }

    // 7. Construir resultado final
    return posts.map((row) => {
      const postData = row.timeline_posts;
      const author = row.users;

      const postComments = commentsByPostId.get(postData.id) || [];

      return {
        ...postData,
        author: author ? {
          id: author.id,
          name: author.name,
          profileImageUrl: author.profileImageUrl,
          profession: author.profession,
          areaAtuacao: author.areaAtuacao,
          points: row.userPoints,
        } : null,
        likeCount: postData.likeCount || 0,
        commentCount: postData.commentCount || 0,
        shareCount: postData.shareCount || 0,
        reactionType: reactionsByPostId.get(postData.id)?.type || null,
        tags: tagsByPostId.get(postData.id) || [],
        comments: postComments,
        sharedPost: postData.sharedPostId ? sharedPostsMap.get(postData.sharedPostId) : null,
      };
    });
  }

  async getTimelinePost(postId: string, userId?: string): Promise<TimelinePostWithRelations | undefined> {
    const [post] = await db.select().from(timelinePosts).where(eq(timelinePosts.id, postId));
    if (!post) return undefined;

    const author = await this.getUser(post.userId);
    const commentsData = await db
      .select()
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.postId, post.id));

    // Se houver userId, buscar todos os likes do usuário nos comentários deste post
    const commentIds = commentsData.map(row => row.post_comments.id);
    const userCommentLikes = userId && commentIds.length > 0
      ? await db
          .select()
          .from(commentLikes)
          .where(
            and(
              inArray(commentLikes.commentId, commentIds),
              eq(commentLikes.userId, userId)
            )
          )
      : [];

    const userLikedCommentIds = new Set(userCommentLikes.map(like => like.commentId));

    // Buscar reação do usuário neste post
    const userReaction = userId
      ? await db
          .select()
          .from(postReactions)
          .where(
            and(
              eq(postReactions.postId, post.id),
              eq(postReactions.userId, userId)
            )
          )
      : [];

    const reactionType = userReaction.length > 0 ? userReaction[0].type : null;
    const hasReacted = userReaction.length > 0;

    // Map and sort comments manually to avoid null issues
    const comments = commentsData
      .map(row => ({
        id: row.post_comments.id,
        content: row.post_comments.content,
        postId: row.post_comments.postId,
        userId: row.post_comments.userId,
        parentCommentId: row.post_comments.parentCommentId,
        likeCount: row.post_comments.likeCount || 0,
        replyCount: row.post_comments.replyCount || 0,
        isPinned: row.post_comments.isPinned || false,
        userHasLiked: userLikedCommentIds.has(row.post_comments.id), // ADICIONAR ESTE CAMPO
        createdAt: row.post_comments.createdAt,
        author: {
          id: row.users?.id,
          name: row.users?.name,
          email: row.users?.email,
          profileImageUrl: row.users?.profileImageUrl,
          profession: row.users?.profession,
          points: row.users?.points,
        },
      }))
      .sort((a, b) => {
        // Fixados primeiro
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        // Depois por curtidas
        if (a.likeCount !== b.likeCount) return b.likeCount - a.likeCount;
        // Depois por data
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const tagRelations = await db
      .select()
      .from(postTagRelations)
      .where(eq(postTagRelations.postId, post.id));

    const tags = tagRelations.length > 0
      ? await db.select().from(timelineTags).where(
          inArray(
            timelineTags.id,
            tagRelations.map(r => r.tagId)
          )
        )
      : [];

    return {
      ...post,
      author,
      comments,
      tags,
      hasReacted,
      reactionType,
    };
  }

  async getUserTimelinePosts(userId: string, limit = 8, offset = 0): Promise<TimelinePostWithRelations[]> {
    const posts = await db
      .select()
      .from(timelinePosts)
      .leftJoin(users, eq(timelinePosts.userId, users.id))
      .where(and(
        eq(timelinePosts.userId, userId),
        eq(timelinePosts.isActive, true)
      ))
      .orderBy(desc(timelinePosts.isPinned), desc(timelinePosts.createdAt))
      .limit(limit)
      .offset(offset);

    if (posts.length === 0) return [];

    const postIds = posts.map(row => row.timeline_posts.id);

    // Buscar posts compartilhados
    const sharedPostIds = posts
      .map(row => row.timeline_posts.sharedPostId)
      .filter((id): id is string => id !== null);

    const [topComments, allComments, allReactions, sharedPostsData] = await Promise.all([
      db.select()
        .from(postComments)
        .leftJoin(users, eq(postComments.userId, users.id))
        .where(inArray(postComments.postId, postIds))
        .orderBy(
          sql`CASE WHEN ${postComments.parentCommentId} IS NULL THEN 0 ELSE 1 END`,
          desc(postComments.isPinned),
          desc(postComments.likeCount),
          desc(postComments.createdAt)
        )
        .limit(100),
      db.select()
        .from(postComments)
        .leftJoin(users, eq(postComments.userId, users.id))
        .where(inArray(postComments.postId, postIds))
        .limit(200),
      db.select()
        .from(postReactions)
        .where(and(
          inArray(postReactions.postId, postIds),
          eq(postReactions.userId, userId)
        )),
      sharedPostIds.length > 0
        ? db.select()
            .from(timelinePosts)
            .leftJoin(users, eq(timelinePosts.userId, users.id))
            .where(inArray(timelinePosts.id, sharedPostIds))
        : Promise.resolve([])
    ]);

    // Buscar likes do usuário em TODOS os comentários (incluindo respostas)
    const allCommentIds = allComments.map(row => row.post_comments.id);
    const allCommentLikes = userId && allCommentIds.length > 0
      ? await db
          .select()
          .from(commentLikes)
          .where(and(
            inArray(commentLikes.commentId, allCommentIds),
            eq(commentLikes.userId, userId)
          ))
      : [];
    const likedCommentIds = new Set(allCommentLikes.map(like => like.commentId));

    // Criar map de posts compartilhados
    const sharedPostsMap = new Map<string, any>();
    sharedPostsData.forEach(row => {
      const postData = row.timeline_posts;
      const author = row.users;
      sharedPostsMap.set(postData.id, {
        ...postData,
        author: author ? {
          id: author.id,
          name: author.name,
          profileImageUrl: author.profileImageUrl,
          profession: author.profession,
          badge: author.badge,
        } : null,
        media: postData.media || [],
      });
    });

    const commentsByPostId = new Map<string, any[]>();
    topComments.forEach(row => {
      const comment = row.post_comments;
      const commentAuthor = row.users;
      if (!commentsByPostId.has(comment.postId)) commentsByPostId.set(comment.postId, []);
      commentsByPostId.get(comment.postId)!.push({
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        userId: comment.userId,
        parentCommentId: comment.parentCommentId,
        likeCount: comment.likeCount || 0,
        replyCount: comment.replyCount || 0,
        isPinned: comment.isPinned || false,
        isBestAnswer: comment.isBestAnswer || false,
        userHasLiked: likedCommentIds.has(comment.id),
        createdAt: comment.createdAt,
        author: commentAuthor ? {
          id: commentAuthor.id,
          name: commentAuthor.name,
          profileImageUrl: commentAuthor.profileImageUrl,
          profession: commentAuthor.profession,
          badge: commentAuthor.badge,
        } : null,
      });
    });

    const reactionsByPostId = new Map<string, any>();
    allReactions.forEach(r => reactionsByPostId.set(r.postId, r));

    return posts.map(row => {
      const post = row.timeline_posts;
      const author = row.users;
      const reaction = reactionsByPostId.get(post.id);

      return {
        ...post,
        author,
        comments: commentsByPostId.get(post.id) || [],
        tags: [],
        hasReacted: !!reaction,
        reactionType: reaction?.type || undefined,
        sharedPost: post.sharedPostId ? sharedPostsMap.get(post.sharedPostId) : null,
      };
    });
  }

  async addPostReaction(reactionData: InsertPostReaction): Promise<any> {
    const existing = await db
      .select()
      .from(postReactions)
      .where(
        and(
          eq(postReactions.postId, reactionData.postId),
          eq(postReactions.userId, reactionData.userId)
        )
      );

    // Se já existe uma reação
    if (existing.length > 0) {
      const existingReaction = existing[0];

      // Se é a mesma reação, remover (toggle off)
      if (existingReaction.type === reactionData.type) {
        await db
          .delete(postReactions)
          .where(eq(postReactions.id, existingReaction.id));

        // Decrementar contador apropriado (proteger contra valores negativos)
        if (reactionData.type === 'like') {
          await db
            .update(timelinePosts)
            .set({ likeCount: sqlOp`GREATEST(0, ${timelinePosts.likeCount} - 1)` })
            .where(eq(timelinePosts.id, reactionData.postId));
        } else if (reactionData.type === 'dislike') {
          await db
            .update(timelinePosts)
            .set({ dislikeCount: sqlOp`GREATEST(0, ${timelinePosts.dislikeCount} - 1)` })
            .where(eq(timelinePosts.id, reactionData.postId));
        }

        return { ...existingReaction, action: 'removed', prevType: existingReaction.type };
      }

      // Se é reação diferente, trocar (like <-> dislike)
      await db
        .update(postReactions)
        .set({ type: reactionData.type })
        .where(eq(postReactions.id, existingReaction.id));

      // Atualizar contadores: decrementar o antigo, incrementar o novo (proteger contra negativos)
      if (existingReaction.type === 'like' && reactionData.type === 'dislike') {
        await db
          .update(timelinePosts)
          .set({
            likeCount: sqlOp`GREATEST(0, ${timelinePosts.likeCount} - 1)`,
            dislikeCount: sqlOp`${timelinePosts.dislikeCount} + 1`
          })
          .where(eq(timelinePosts.id, reactionData.postId));
        // likeDelta = -1;
        // dislikeDelta = 1;
      } else if (existingReaction.type === 'dislike' && reactionData.type === 'like') {
        await db
          .update(timelinePosts)
          .set({
            dislikeCount: sqlOp`GREATEST(0, ${timelinePosts.dislikeCount} - 1)`,
            likeCount: sqlOp`${timelinePosts.likeCount} + 1`
          })
          .where(eq(timelinePosts.id, reactionData.postId));
        // dislikeDelta = -1;
        // likeDelta = 1;
      }

      return { ...existingReaction, type: reactionData.type, action: 'swapped', prevType: existingReaction.type };
    }

    // Criar nova reação
    const [reaction] = await db.insert(postReactions).values(reactionData).returning();

    // Incrementar contador apropriado
    if (reactionData.type === 'like') {
      await db
        .update(timelinePosts)
        .set({ likeCount: sqlOp`${timelinePosts.likeCount} + 1` })
        .where(eq(timelinePosts.id, reactionData.postId));
    } else if (reactionData.type === 'dislike') {
      await db
        .update(timelinePosts)
        .set({ dislikeCount: sqlOp`${timelinePosts.dislikeCount} + 1` })
        .where(eq(timelinePosts.id, reactionData.postId));
    }

    // Criar notificação para o autor do post (apenas para likes)
    let notificationId: string | null = null;
    if (reactionData.type === 'like') {
      const [post] = await db.select().from(timelinePosts).where(eq(timelinePosts.id, reactionData.postId));
      if (post && post.userId !== reactionData.userId) {
        const [reactionAuthor] = await db.select().from(users).where(eq(users.id, reactionData.userId));
        if (reactionAuthor) {
          const notification = await this.createNotification({
            userId: post.userId,
            actorId: reactionData.userId,
            type: 'reaction',
            message: `${reactionAuthor.name} curtiu seu post`,
            relatedPostId: reactionData.postId,
          });
          notificationId = notification.id;
        }
      }
    }

    return { ...reaction, action: 'added', notificationId };
  }

  async addPostComment(data: InsertPostComment): Promise<any> {
    const [newComment] = await db.insert(postComments).values(data).returning();

    // Update comment count on post
    await db
      .update(timelinePosts)
      .set({ commentCount: sqlOp`${timelinePosts.commentCount} + 1` })
      .where(eq(timelinePosts.id, data.postId));

    // If this is a reply to another comment, increment reply count
    if (data.parentCommentId) {
      await db
        .update(postComments)
        .set({ replyCount: sqlOp`${postComments.replyCount} + 1` })
        .where(eq(postComments.id, data.parentCommentId));
    }

    // Fetch complete comment with author data
    const commentData = await db
      .select()
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.id, newComment.id));

    if (!commentData || commentData.length === 0) {
      return newComment;
    }

    const row = commentData[0];
    const commentRow = row.post_comments;
    const author = row.users;

    // Criar notificação para o autor do post (se for comentário direto) ou para o autor do comentário pai (se for resposta)
    let notificationId: string | null = null;
    if (data.parentCommentId) {
      // É uma resposta a um comentário
      const [parentComment] = await db.select().from(postComments).where(eq(postComments.id, data.parentCommentId));
      if (parentComment && parentComment.userId !== data.userId && author) {
        const notification = await this.createNotification({
          userId: parentComment.userId,
          actorId: data.userId,
          type: 'comment',
          message: `${author.name} respondeu seu comentário`,
          relatedPostId: data.postId,
          relatedCommentId: newComment.id,
        });
        notificationId = notification.id;
      }
    } else {
      // É um comentário no post
      const [post] = await db.select().from(timelinePosts).where(eq(timelinePosts.id, data.postId));
      if (post && post.userId !== data.userId && author) {
        const notification = await this.createNotification({
          userId: post.userId,
          actorId: data.userId,
          type: 'comment',
          message: `${author.name} comentou no seu post`,
          relatedPostId: data.postId,
          relatedCommentId: newComment.id,
        });
        notificationId = notification.id;
      }
    }

    return {
      id: commentRow.id,
      content: commentRow.content,
      postId: commentRow.postId,
      userId: commentRow.userId,
      parentCommentId: commentRow.parentCommentId,
      createdAt: commentRow.createdAt,
      likeCount: commentRow.likeCount || 0,
      replyCount: commentRow.replyCount || 0,
      isPinned: commentRow.isPinned || false,
      userHasLiked: false,
      notificationId,
      author: author ? {
        id: author.id,
        name: author.name,
        profileImageUrl: author.profileImageUrl,
        profession: author.profession,
        badge: author.badge,
      } : null,
    };
  }

  async likeComment(commentId: string, userId: string): Promise<CommentLike | null> {
    // Check if user already liked the comment
    const existing = await db
      .select()
      .from(commentLikes)
      .where(
        and(
          eq(commentLikes.commentId, commentId),
          eq(commentLikes.userId, userId)
        )
      );

    // If already liked, unlike it
    if (existing.length > 0) {
      await db
        .delete(commentLikes)
        .where(eq(commentLikes.id, existing[0].id));

      await db
        .update(postComments)
        .set({ likeCount: sqlOp`${postComments.likeCount} - 1` })
        .where(eq(postComments.id, commentId));

      return null;
    }

    // Create like
    const [like] = await db
      .insert(commentLikes)
      .values({ commentId, userId })
      .returning();

    // Increment like count
    await db
      .update(postComments)
      .set({ likeCount: sqlOp`${postComments.likeCount} + 1` })
      .where(eq(postComments.id, commentId));

    return like;
  }

  async getComment(commentId: string) {
    const [comment] = await db.select().from(postComments).where(eq(postComments.id, commentId));
    return comment;
  }

  async getPostCommentWithAuthor(commentId: string) {
    const [result] = await db
      .select({
        comment: postComments,
        author: users,
        authorPoints: userPoints.points,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .leftJoin(userPoints, eq(users.id, userPoints.userId))
      .where(eq(postComments.id, commentId));

    if (!result) return null;

    return {
      id: result.comment.id,
      content: result.comment.content,
      postId: result.comment.postId,
      userId: result.comment.userId,
      parentCommentId: result.comment.parentCommentId,
      likeCount: result.comment.likeCount || 0,
      replyCount: result.comment.replyCount || 0,
      isPinned: result.comment.isPinned || false,
      isBestAnswer: result.comment.isBestAnswer || false,
      userHasLiked: false,
      createdAt: result.comment.createdAt,
      author: result.author ? {
        id: result.author.id,
        name: result.author.name,
        profileImageUrl: result.author.profileImageUrl,
        profession: result.author.profession,
        badge: result.author.badge,
        points: result.authorPoints,
      } : null,
    };
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<{ userHasLiked: boolean; likeCount: number; notificationId?: string | null }> {
    // Check if user already liked the comment
    const existing = await db
      .select()
      .from(commentLikes)
      .where(
        and(
          eq(commentLikes.commentId, commentId),
          eq(commentLikes.userId, userId)
        )
      );

    let userHasLiked: boolean;
    let notificationId: string | null = null;

    // If already liked, unlike it
    if (existing.length > 0) {
      logger.debug('[CommentLike] Removendo like do comentário:', commentId);

      await db
        .delete(commentLikes)
        .where(eq(commentLikes.id, existing[0].id));

      await db
        .update(postComments)
        .set({ likeCount: sqlOp`${postComments.likeCount} - 1` })
        .where(eq(postComments.id, commentId));

      userHasLiked = false;
    } else {
      logger.debug('[CommentLike] Adicionando like ao comentário:', commentId);

      // Create like
      await db
        .insert(commentLikes)
        .values({ commentId, userId });

      await db
        .update(postComments)
        .set({ likeCount: sqlOp`${postComments.likeCount} + 1` })
        .where(eq(postComments.id, commentId));

      userHasLiked = true;

      // Criar notificação para o autor do comentário
      const [comment] = await db.select().from(postComments).where(eq(postComments.id, commentId));
      if (comment && comment.userId !== userId) {
        const [likeAuthor] = await db.select().from(users).where(eq(users.id, userId));
        if (likeAuthor) {
          const notification = await this.createNotification({
            userId: comment.userId,
            actorId: userId,
            type: 'like',
            message: `${likeAuthor.name} curtiu seu comentário`,
            relatedPostId: comment.postId,
            relatedCommentId: commentId,
          });
          notificationId = notification.id;
        }
      }
    }

    // Get updated comment to return current like count
    const [comment] = await db
      .select()
      .from(postComments)
      .where(eq(postComments.id, commentId));

    const result = {
      userHasLiked: userHasLiked,
      likeCount: comment?.likeCount || 0,
      notificationId
    };

    logger.debug('[CommentLike] Retornando:', result);

    return result;
  }

  async pinComment(postId: string, commentId: string): Promise<PostComment> {
    // First, unpin all other comments on this post
    await db
      .update(postComments)
      .set({ isPinned: false })
      .where(eq(postComments.postId, postId));

    // Pin the selected comment
    const [pinnedComment] = await db
      .update(postComments)
      .set({ isPinned: true })
      .where(eq(postComments.id, commentId))
      .returning();

    return pinnedComment;
  }

  async unpinComment(commentId: string): Promise<PostComment> {
    const [unpinnedComment] = await db
      .update(postComments)
      .set({ isPinned: false })
      .where(eq(postComments.id, commentId))
      .returning();

    return unpinnedComment;
  }

  async pinPostComment(commentId: string, isPinned: boolean): Promise<void> {
    await db
      .update(postComments)
      .set({ isPinned })
      .where(eq(postComments.id, commentId));
  }


  async togglePostReaction(postId: string, userId: string, type: 'like' | 'dislike'): Promise<{ action: 'added' | 'removed', likeDelta: number, dislikeDelta: number, notificationId?: string }> {
    // Check if user already reacted to this post
    const existing = await db
      .select()
      .from(postReactions)
      .where(
        and(
          eq(postReactions.postId, postId),
          eq(postReactions.userId, userId)
        )
      );

    let likeDelta = 0;
    let dislikeDelta = 0;
    let action: 'added' | 'removed' = 'added';
    let notificationId: string | undefined = undefined;

    // If user already reacted
    if (existing.length > 0) {
      const existingReaction = existing[0];

      // If same reaction type, remove it
      if (existingReaction.type === type) {
        await db
          .delete(postReactions)
          .where(eq(postReactions.id, existingReaction.id));

        // Update post counts
        if (type === 'like') {
          await db
            .update(timelinePosts)
            .set({ likeCount: sqlOp`GREATEST(0, ${timelinePosts.likeCount} - 1)` })
            .where(eq(timelinePosts.id, postId));
          likeDelta = -1;
        } else {
          await db
            .update(timelinePosts)
            .set({ dislikeCount: sqlOp`GREATEST(0, ${timelinePosts.dislikeCount} - 1)` })
            .where(eq(timelinePosts.id, postId));
          dislikeDelta = -1;
        }

        action = 'removed';
      } else {
        // Different reaction type, update it
        await db
          .update(postReactions)
          .set({ type })
          .where(eq(postReactions.id, existingReaction.id));

        // Update post counts (decrease old, increase new)
        if (existingReaction.type === 'like') {
          await db
            .update(timelinePosts)
            .set({
              likeCount: sqlOp`GREATEST(0, ${timelinePosts.likeCount} - 1)`,
              dislikeCount: sqlOp`${timelinePosts.dislikeCount} + 1`
            })
            .where(eq(timelinePosts.id, postId));
          likeDelta = -1;
          dislikeDelta = 1;
        } else {
          await db
            .update(timelinePosts)
            .set({
              dislikeCount: sqlOp`GREATEST(0, ${timelinePosts.dislikeCount} - 1)`,
              likeCount: sqlOp`${timelinePosts.likeCount} + 1`
            })
            .where(eq(timelinePosts.id, postId));
          dislikeDelta = -1;
          likeDelta = 1;
        }

        // Create notification if changed to like
        if (type === 'like') {
          const [post] = await db.select().from(timelinePosts).where(eq(timelinePosts.id, postId));
          if (post && post.userId !== userId) {
            const [likeAuthor] = await db.select().from(users).where(eq(users.id, userId));
            if (likeAuthor) {
              const notification = await this.createNotification({
                userId: post.userId,
                actorId: userId,
                type: 'like',
                message: `${likeAuthor.name} curtiu seu post`,
                relatedPostId: postId,
              });
              notificationId = notification.id;
            }
          }
        }
      }
    } else {
      // Create new reaction
      await db
        .insert(postReactions)
        .values({ postId, userId, type });

      // Update post counts
      if (type === 'like') {
        await db
          .update(timelinePosts)
          .set({ likeCount: sqlOp`${timelinePosts.likeCount} + 1` })
          .where(eq(timelinePosts.id, postId));
        likeDelta = 1;

        // Create notification for like
        const [post] = await db.select().from(timelinePosts).where(eq(timelinePosts.id, postId));
        if (post && post.userId !== userId) {
          const [likeAuthor] = await db.select().from(users).where(eq(users.id, userId));
          if (likeAuthor) {
            const notification = await this.createNotification({
              userId: post.userId,
              actorId: userId,
              type: 'like',
              message: `${likeAuthor.name} curtiu seu post`,
              relatedPostId: postId,
            });
            notificationId = notification.id;
          }
        }
      } else {
        await db
          .update(timelinePosts)
          .set({ dislikeCount: sqlOp`${timelinePosts.dislikeCount} + 1` })
          .where(eq(timelinePosts.id, postId));
        dislikeDelta = 1;
      }
    }

    return { action, likeDelta, dislikeDelta, notificationId };
  }

  async pinPost(postId: string, userId: string): Promise<void> {
    // Desfixar todos os outros posts do usuário
    await db
      .update(timelinePosts)
      .set({ isPinned: false })
      .where(eq(timelinePosts.userId, userId));

    // Fixar o post selecionado
    await db
      .update(timelinePosts)
      .set({ isPinned: true })
      .where(eq(timelinePosts.id, postId));
  }

  async unpinPost(postId: string): Promise<void> {
    await db
      .update(timelinePosts)
      .set({ isPinned: false })
      .where(eq(timelinePosts.id, postId));
  }

  async sharePost(shareData: InsertPostShare): Promise<PostShare & { notificationId?: string }> {
    const [share] = await db.insert(postShares).values(shareData).returning();
    let notificationId: string | undefined = undefined;

    // Increment share count on original post
    await db
      .update(timelinePosts)
      .set({ shareCount: sqlOp`${timelinePosts.shareCount} + 1` })
      .where(eq(timelinePosts.id, shareData.postId));

    // Get the original post to share
    const [originalPost] = await db
      .select()
      .from(timelinePosts)
      .where(eq(timelinePosts.id, shareData.postId));

    if (originalPost) {
      // Create a new post that references the shared post
      const shareComment = shareData.comment || '';
      const shareContent = shareComment
        ? shareComment
        : `Compartilhou um post`;

      await db.insert(timelinePosts).values({
        userId: shareData.userId,
        content: shareContent,
        sharedPostId: shareData.postId,
        media: originalPost.media,
      });

      // Criar notificação para o autor do post original
      if (originalPost.userId !== shareData.userId) {
        const [shareAuthor] = await db.select().from(users).where(eq(users.id, shareData.userId));
        if (shareAuthor) {
          const notification = await this.createNotification({
            userId: originalPost.userId,
            actorId: shareData.userId,
            type: 'share',
            message: `${shareAuthor.name} compartilhou seu post`,
            relatedPostId: shareData.postId,
          });
          notificationId = notification.id;
        }
      }
    }

    return { ...share, notificationId };
  }

  async getTrendingTags(limit = 10): Promise<TimelineTag[]> {
    return await db
      .select()
      .from(timelineTags)
      .orderBy(desc(timelineTags.postCount))
      .limit(limit);
  }

  async getUserConnections(userId: string): Promise<UserConnection[]> {
    return await db
      .select()
      .from(userConnections)
      .where(
        or(
          eq(userConnections.userId, userId),
          eq(userConnections.connectedUserId, userId)
        )
      );
  }

  async createUserConnection(connectionData: InsertUserConnection): Promise<UserConnection> {
    const [connection] = await db.insert(userConnections).values(connectionData).returning();
    return connection;
  }

  async acceptUserConnection(connectionId: string): Promise<UserConnection> {
    const [connection] = await db
      .update(userConnections)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(userConnections.id, connectionId))
      .returning();
    return connection;
  }

  // ==================== CLONED PAGES OPERATIONS ====================

  async createClonedPage(pageData: InsertClonedPage): Promise<ClonedPage> {
    const [page] = await db.insert(clonedPages).values(pageData).returning();
    return page;
  }

  async getClonedPagesByUser(userId: string): Promise<ClonedPage[]> {
    return await db
      .select()
      .from(clonedPages)
      .where(and(eq(clonedPages.userId, userId), eq(clonedPages.isActive, true)))
      .orderBy(desc(clonedPages.createdAt));
  }

  async getClonedPageBySlug(slug: string): Promise<ClonedPage | undefined> {
    const [page] = await db
      .select()
      .from(clonedPages)
      .where(and(eq(clonedPages.slug, slug), eq(clonedPages.isActive, true)));
    return page;
  }

  async getClonedPageById(id: string): Promise<ClonedPage | undefined> {
    const [page] = await db
      .select()
      .from(clonedPages)
      .where(eq(clonedPages.id, id));
    return page;
  }

  async updateClonedPage(id: string, pageData: Partial<InsertClonedPage>): Promise<ClonedPage> {
    const [page] = await db
      .update(clonedPages)
      .set({ ...pageData, updatedAt: new Date() })
      .where(eq(clonedPages.id, id))
      .returning();
    return page;
  }

  async deleteClonedPage(id: string): Promise<void> {
    await db
      .update(clonedPages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clonedPages.id, id));
  }

  async incrementPageViewCount(slug: string): Promise<void> {
    await db
      .update(clonedPages)
      .set({ viewCount: sqlOp`${clonedPages.viewCount} + 1` })
      .where(eq(clonedPages.slug, slug));
  }

  // ==================== DAILY ACTIVITIES & GAMIFICATION ====================

  async getDailyActivities(): Promise<DailyActivity[]> {
    return await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.isActive, true))
      .orderBy(dailyActivities.xpReward);
  }

  async getUserDailyProgress(userId: string): Promise<UserDailyProgress[]> {
    const today = startOfDaySaoPaulo();

    return await db
      .select()
      .from(userDailyProgress)
      .where(
        and(
          eq(userDailyProgress.userId, userId),
          sqlOp`${userDailyProgress.date} >= ${today}`
        )
      );
  }

  async updateActivityProgress(userId: string, activityId: string, progress: number): Promise<void> {
    const today = startOfDaySaoPaulo();

    const [activity] = await db
      .select()
      .from(dailyActivities)
      .where(eq(dailyActivities.id, activityId));

    if (!activity) return;

    const [existing] = await db
      .select()
      .from(userDailyProgress)
      .where(
        and(
          eq(userDailyProgress.userId, userId),
          eq(userDailyProgress.activityId, activityId),
          sqlOp`${userDailyProgress.date} >= ${today}`
        )
      );

    const isCompleted = progress >= activity.requirementCount;

    if (existing) {
      await db
        .update(userDailyProgress)
        .set({
          progress,
          isCompleted,
          completedAt: isCompleted ? new Date() : null
        })
        .where(eq(userDailyProgress.id, existing.id));
    } else {
      await db.insert(userDailyProgress).values({
        userId,
        activityId,
        progress,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        date: today
      });
    }
  }

  async getWeeklyRanking(limit: number = 10): Promise<UserWithStats[]> {
    const oneWeekAgo = daysAgoSaoPaulo(7);

    const result = await db
      .select({
        user: users,
        points: userPoints,
      })
      .from(users)
      .leftJoin(userPoints, eq(users.id, userPoints.userId))
      .where(sqlOp`${userPoints.updatedAt} >= ${oneWeekAgo}`)
      .orderBy(desc(userPoints.points))
      .limit(limit);

    return result.map(r => ({
      ...r.user,
      points: r.points || undefined,
    }));
  }

  async getSuggestedConnections(userId: string, limit = 5): Promise<User[]> {
    // Buscar usuários que o usuário atual já segue
    const existingFollows = await db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));

    const followingIds = existingFollows.map(f => f.followingId);

    const conditions = [sqlOp`${users.id} != ${userId}`];

    // Excluir usuários já seguidos
    if (followingIds.length > 0) {
      conditions.push(notInArray(users.id, followingIds));
    }

    return await db
      .select()
      .from(users)
      .where(and(...conditions))
      .limit(limit);
  }

  async getTrendingTopics(limit = 5): Promise<ForumTopicWithRelations[]> {
    const oneWeekAgo = daysAgoSaoPaulo(7);

    const topics = await db
      .select({
        topic: forumTopics,
        author: users,
        category: categories,
      })
      .from(forumTopics)
      .leftJoin(users, eq(forumTopics.authorId, users.id))
      .leftJoin(categories, eq(forumTopics.categoryId, categories.id))
      .where(sqlOp`${forumTopics.createdAt} >= ${oneWeekAgo}`)
      .orderBy(desc(forumTopics.viewCount), desc(forumTopics.replyCount))
      .limit(limit);

    return topics.map(t => ({
      ...t.topic,
      author: t.author || undefined,
      category: t.category || undefined,
    }));
  }

  async getUserStats(userId: string): Promise<{
    postsCreated: number;
    connectionsCount: number;
    followersCount: number;
  }> {
    // Contagem correta de posts
    const [postsCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(timelinePosts)
      .where(eq(timelinePosts.userId, userId));

    // Contagem correta de conexões (ambos os lados)
    const [connectionsCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userConnections)
      .where(
        and(
          eq(userConnections.status, 'accepted'),
          or(
            eq(userConnections.userId, userId),
            eq(userConnections.connectedUserId, userId)
          )
        )
      );

    // Contagem correta de seguidores
    const [followersCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId));

    return {
      postsCreated: postsCount?.count || 0,
      connectionsCount: connectionsCount?.count || 0,
      followersCount: followersCount?.count || 0,
    };
  }

  async getUserRecentActivities(userId: string, limit = 20): Promise<any[]> {
    const activities: any[] = [];

    // Posts criados
    const posts = await db
      .select({
        id: timelinePosts.id,
        type: sql`'post_created'`.as('type'),
        action: sql`'Criou um post'`.as('action'),
        content: timelinePosts.content,
        timestamp: timelinePosts.createdAt,
      })
      .from(timelinePosts)
      .where(eq(timelinePosts.userId, userId))
      .orderBy(desc(timelinePosts.createdAt))
      .limit(limit);

    activities.push(...posts);

    // Comentários criados
    const comments = await db
      .select({
        id: postComments.id,
        type: sql`'comment_created'`.as('type'),
        action: sql`'Comentou em um post'`.as('action'),
        content: postComments.content,
        timestamp: postComments.createdAt,
      })
      .from(postComments)
      .where(eq(postComments.userId, userId))
      .orderBy(desc(postComments.createdAt))
      .limit(limit);

    activities.push(...comments);

    // Tópicos criados no fórum
    const topics = await db
      .select({
        id: forumTopics.id,
        type: sql`'topic_created'`.as('type'),
        action: sql`'Criou uma discussão no fórum'`.as('action'),
        content: forumTopics.title,
        timestamp: forumTopics.createdAt,
      })
      .from(forumTopics)
      .where(eq(forumTopics.authorId, userId))
      .orderBy(desc(forumTopics.createdAt))
      .limit(limit);

    activities.push(...topics);

    // Ordenar todas as atividades por data
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createPostReport(reportData: InsertPostReport): Promise<PostReport> {
    const [report] = await db.insert(postReports).values(reportData).returning();
    return report;
  }

  async createForumTopicReport(reportData: InsertForumTopicReport): Promise<ForumTopicReport> {
    const [report] = await db.insert(forumTopicReports).values(reportData).returning();
    return report;
  }

  async createForumReplyReport(reportData: InsertForumReplyReport): Promise<ForumReplyReport> {
    const [report] = await db.insert(forumReplyReports).values(reportData).returning();
    return report;
  }

  async deleteTimelinePost(postId: string): Promise<void> {
    // Delete related data first (cascading)
    await db.delete(postReactions).where(eq(postReactions.postId, postId));
    await db.delete(postShares).where(eq(postShares.postId, postId));
    await db.delete(postTagRelations).where(eq(postTagRelations.postId, postId));

    // Delete comments and their related data
    const comments = await db.select().from(postComments).where(eq(postComments.postId, postId));
    const commentIds = comments.map(c => c.id);
    
    if (commentIds.length > 0) {
      // Delete comment likes
      for (const comment of comments) {
        await db.delete(commentLikes).where(eq(commentLikes.commentId, comment.id));
      }
      
      // Delete notifications related to comments
      await db.delete(notifications).where(inArray(notifications.relatedCommentId, commentIds));
    }
    await db.delete(postComments).where(eq(postComments.postId, postId));

    // Delete notifications related to this post
    await db.delete(notifications).where(eq(notifications.relatedPostId, postId));

    // Clear sharedPostId references in posts that shared this post
    await db.update(timelinePosts)
      .set({ sharedPostId: null })
      .where(eq(timelinePosts.sharedPostId, postId));

    // Delete the post
    await db.delete(timelinePosts).where(eq(timelinePosts.id, postId));
  }

  async getPostComment(commentId: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.id, commentId));

    if (!result || result.length === 0) {
      return undefined;
    }

    const row = result[0];
    const commentRow = row.post_comments;
    const author = row.users;

    return {
      id: commentRow.id,
      content: commentRow.content,
      postId: commentRow.postId,
      userId: commentRow.userId,
      parentCommentId: commentRow.parentCommentId,
      createdAt: commentRow.createdAt,
      likeCount: commentRow.likeCount || 0,
      replyCount: commentRow.replyCount || 0,
      isPinned: commentRow.isPinned || false,
      author: author ? {
        id: author.id,
        name: author.name,
        profileImageUrl: author.profileImageUrl,
        profession: author.profession,
        badge: author.badge,
      } : null,
    };
  }

  async deletePostComment(commentId: string): Promise<void> {
    const [comment] = await db.select().from(postComments).where(eq(postComments.id, commentId));

    if (comment) {
      // Deletar notificações relacionadas ao comentário (antes de deletar o comentário)
      await db.delete(notifications).where(eq(notifications.relatedCommentId, commentId));

      // Decrementar contador de comentários do post
      await db
        .update(timelinePosts)
        .set({ commentCount: sqlOp`GREATEST(0, ${timelinePosts.commentCount} - 1)` })
        .where(eq(timelinePosts.id, comment.postId));

      // Se for uma resposta, decrementar contador do comentário pai
      if (comment.parentCommentId) {
        await db
          .update(postComments)
          .set({ replyCount: sqlOp`GREATEST(0, ${postComments.replyCount} - 1)` })
          .where(eq(postComments.id, comment.parentCommentId));
      }

      // Deletar curtidas do comentário
      await db.delete(commentLikes).where(eq(commentLikes.commentId, commentId));
    }

    await db.delete(postComments).where(eq(postComments.id, commentId));
  }

  async createCommentReport(reportData: any): Promise<any> {
    const { commentReports } = await import("@shared/schema");
    const [report] = await db.insert(commentReports).values(reportData).returning();
    return report;
  }

  async getUserPoints(userId: string): Promise<UserPoints | undefined> {
    const [points] = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, userId));
    return points;
  }

  async createOrUpdateUserPoints(userId: string): Promise<UserPoints> {
    const existing = await this.getUserPoints(userId);

    if (existing) {
      return existing;
    }

    const [points] = await db
      .insert(userPoints)
      .values({ userId, points: 0, level: 1 })
      .returning();
    return points;
  }

  async addPoints(userId: string, pointsToAdd: number): Promise<UserPoints> {
    await this.createOrUpdateUserPoints(userId);

    const [updated] = await db
      .update(userPoints)
      .set({
        points: sqlOp`${userPoints.points} + ${pointsToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId))
      .returning();

    return updated;
  }

  async getPostCommentWithAuthor(commentId: string) {
    const result = await db
      .select({
        comment: postComments,
        author: users,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(eq(postComments.id, commentId))
      .limit(1);

    if (result.length === 0) return null;

    const { comment, author } = result[0];

    return {
      ...comment,
      author: author ? {
        id: author.id,
        name: author.name,
        profileImageUrl: author.profileImageUrl,
        profession: author.profession,
        areaAtuacao: author.areaAtuacao,
        badge: author.badge
      } : null,
      likeCount: 0,
      userHasLiked: false,
      replies: []
    };
  }

  // ==================== GAMIFICATION SYSTEM ====================

  async awardPoints(
    userId: string,
    points: number,
    action?: string,
    incrementField?: string
  ): Promise<UserPoints> {
    await this.createOrUpdateUserPoints(userId);

    const updateData: any = {
      points: sqlOp`${userPoints.points} + ${points}`,
      updatedAt: new Date(),
    };

    // Increment specific stat fields
    if (incrementField) {
      const fieldMap: Record<string, any> = {
        postsCreated: userPoints.postsCreated,
        commentsCreated: userPoints.commentsCreated,
        topicsCreated: userPoints.topicsCreated,
        repliesCreated: userPoints.repliesCreated,
        likesReceived: userPoints.likesReceived,
        bestAnswers: userPoints.bestAnswers,
        sharesGiven: userPoints.sharesGiven,
        followersGained: userPoints.followersGained,
      };

      if (fieldMap[incrementField]) {
        updateData[incrementField] = sqlOp`${fieldMap[incrementField]} + 1`;
      }
    }

    const [updated] = await db
      .update(userPoints)
      .set(updateData)
      .where(eq(userPoints.userId, userId))
      .returning();

    // Emitir evento WebSocket para atualização em tempo real
    try {
      const { io } = await import('./routes');
      io.emit('points_awarded', {
        userId,
        points,
        totalPoints: updated.points,
        action
      });
      logger.debug(`🎯 Pontos emitidos via WebSocket: ${userId} ganhou +${points} XP`);
    } catch (error) {
      logger.error('Erro ao emitir pontos via WebSocket:', error);
    }

    // Check if level should be updated
    const { calculateLevel } = await import('./gamification');
    const newLevel = calculateLevel(updated.points);

    if (newLevel !== updated.level) {
      const [levelUpdated] = await db
        .update(userPoints)
        .set({ level: newLevel })
        .where(eq(userPoints.userId, userId))
        .returning();
      return levelUpdated;
    }

    // Check and award badges
    await this.checkAndAwardBadges(userId);

    return updated;
  }

  async trackDailyLogin(userId: string): Promise<void> {
    await this.createOrUpdateUserPoints(userId);

    const userPointsData = await this.getUserPoints(userId);
    if (!userPointsData) return;

    const today = startOfDaySaoPaulo();

    const lastLogin = userPointsData.lastLoginDate;
    const lastLoginDate = lastLogin ? startOfDaySaoPaulo(new Date(lastLogin)) : null;

    // Check if already logged in today
    if (lastLoginDate && lastLoginDate.getTime() === today.getTime()) {
      return; // Already tracked today
    }

    // Check if streak continues (yesterday)
    const yesterday = subtractDaysSaoPaulo(today, 1);

    let newStreak = 1;
    if (lastLoginDate && lastLoginDate.getTime() === yesterday.getTime()) {
      newStreak = (userPointsData.dailyLoginStreak || 0) + 1;
    }

    // Award daily login points
    const { POINTS } = await import('./gamification');

    await db
      .update(userPoints)
      .set({
        dailyLoginStreak: newStreak,
        totalLoginDays: sqlOp`${userPoints.totalLoginDays} + 1`,
        lastLoginDate: today,
        points: sqlOp`${userPoints.points} + ${POINTS.DAILY_LOGIN}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId));
  }

  async checkAndAwardBadges(userId: string): Promise<void> {
    const { checkBadgesEarned, BADGE_DEFINITIONS } = await import('./gamification');

    // Get user stats
    const userPointsData = await this.getUserPoints(userId);
    if (!userPointsData) return;

    const stats = {
      posts_created: userPointsData.postsCreated || 0,
      comments_created: userPointsData.commentsCreated || 0,
      likes_received: userPointsData.likesReceived || 0,
      best_answers: userPointsData.bestAnswers || 0,
      replies_created: userPointsData.repliesCreated || 0,
      total_login_days: userPointsData.totalLoginDays || 0,
      points: userPointsData.points || 0,
      level: userPointsData.level || 1,
    };

    // Check which badges should be earned
    const earnedBadgeIds = checkBadgesEarned(stats);

    // Get existing badges
    const existingBadges = await db
      .select()
      .from(userBadges)
      .leftJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId));

    const existingBadgeNames = existingBadges
      .map(b => b.badges?.name)
      .filter(Boolean);

    // Award new badges
    for (const badgeId of earnedBadgeIds) {
      const badgeDef = BADGE_DEFINITIONS.find(b => b.id === badgeId);
      if (!badgeDef) continue;

      // Skip if already has this badge
      if (existingBadgeNames.includes(badgeDef.name)) continue;

      // Find or create badge
      let [badge] = await db
        .select()
        .from(badges)
        .where(eq(badges.name, badgeDef.name))
        .limit(1);

      if (!badge) {
        [badge] = await db
          .insert(badges)
          .values({
            name: badgeDef.name,
            description: badgeDef.description,
            icon: badgeDef.icon,
            color: badgeDef.color,
            requirement: badgeDef.requirement,
            type: badgeDef.type,
          })
          .returning();
      }

      // Award badge to user
      await db.insert(userBadges).values({
        userId,
        badgeId: badge.id,
      });
    }
  }

  async getUserBadges(userId: string): Promise<Badge[]> {
    const result = await db
      .select({ badge: badges })
      .from(userBadges)
      .leftJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId));

    return result.map(r => r.badge).filter((b): b is Badge => b !== null);
  }

  // ==================== DAILY ACTIVITIES ====================

  async upsertDailyActivity(data: Omit<InsertDailyActivity, 'createdAt'>): Promise<DailyActivity> {
    const [activity] = await db
      .insert(dailyActivities)
      .values(data)
      .onConflictDoUpdate({
        target: dailyActivities.id,
        set: {
          title: data.title,
          description: data.description,
          xpReward: data.xpReward,
          requirementCount: data.requirementCount,
          icon: data.icon,
          isActive: data.isActive,
        },
      })
      .returning();
    return activity;
  }

  async createDailyActivityProgress(data: Omit<InsertUserDailyProgress, 'id'>): Promise<UserDailyProgress> {
    const [progress] = await db.insert(userDailyProgress).values(data).returning();
    return progress;
  }

  async getUserDailyProgress(userId: string, activityId: string, date: Date): Promise<UserDailyProgress | undefined> {
    const dayStart = startOfDaySaoPaulo(date);
    const dayEnd = endOfDaySaoPaulo(date);

    const [progress] = await db
      .select()
      .from(userDailyProgress)
      .where(
        and(
          eq(userDailyProgress.userId, userId),
          eq(userDailyProgress.activityId, activityId),
          gte(userDailyProgress.progressDate, dayStart),
          lte(userDailyProgress.progressDate, dayEnd)
        )
      )
      .limit(1);

    return progress;
  }

  async getUserDailyActivities(userId: string): Promise<Array<UserDailyProgress & { activity: DailyActivity }>> {
    const today = startOfDaySaoPaulo();
    const todayEnd = endOfDaySaoPaulo();

    const result = await db
      .select({
        progress: userDailyProgress,
        activity: dailyActivities,
      })
      .from(userDailyProgress)
      .leftJoin(dailyActivities, eq(userDailyProgress.activityId, dailyActivities.id))
      .where(
        and(
          eq(userDailyProgress.userId, userId),
          gte(userDailyProgress.progressDate, today),
          lte(userDailyProgress.progressDate, todayEnd)
        )
      );

    return result.map(r => ({
      ...r.progress,
      activity: r.activity!,
    }));
  }

  async updateDailyProgress(progressId: string, data: Partial<UserDailyProgress>): Promise<UserDailyProgress> {
    const [progress] = await db
      .update(userDailyProgress)
      .set(data)
      .where(eq(userDailyProgress.id, progressId))
      .returning();
    return progress;
  }

  async resetDailyActivities(): Promise<{ success: boolean; usersAffected: number; activitiesReset: number }> {
    const yesterday = subtractDaysSaoPaulo(startOfDaySaoPaulo(), 1);

    const result = await db
      .delete(userDailyProgress)
      .where(lte(userDailyProgress.progressDate, yesterday));

    return {
      success: true,
      usersAffected: 0, // Count would need a separate query
      activitiesReset: 0,
    };
  }

  // ==================== WEEKLY CHALLENGES ====================

  async createWeeklyChallenge(data: Omit<InsertWeeklyChallenge, 'id' | 'createdAt'>): Promise<WeeklyChallenge> {
    const [challenge] = await db.insert(weeklyChallenges).values(data).returning();
    return challenge;
  }

  async getActiveWeeklyChallenges(): Promise<WeeklyChallenge[]> {
    const now = getNowSaoPaulo();
    return await db
      .select()
      .from(weeklyChallenges)
      .where(
        and(
          eq(weeklyChallenges.isActive, true),
          lte(weeklyChallenges.startDate, now),
          gte(weeklyChallenges.endDate, now)
        )
      );
  }

  async getUserWeeklyProgress(userId: string, challengeId: string): Promise<UserWeeklyProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userWeeklyProgress)
      .where(
        and(
          eq(userWeeklyProgress.userId, userId),
          eq(userWeeklyProgress.challengeId, challengeId)
        )
      )
      .limit(1);

    return progress;
  }

  async getAllUserWeeklyProgress(userId: string): Promise<UserWeeklyProgress[]> {
    return await db
      .select()
      .from(userWeeklyProgress)
      .where(eq(userWeeklyProgress.userId, userId));
  }

  async createWeeklyProgress(data: Omit<InsertUserWeeklyProgress, 'id'>): Promise<UserWeeklyProgress> {
    const [progress] = await db.insert(userWeeklyProgress).values(data).returning();
    return progress;
  }

  async updateWeeklyProgress(progressId: string, data: Partial<UserWeeklyProgress>): Promise<UserWeeklyProgress> {
    const [progress] = await db
      .update(userWeeklyProgress)
      .set(data)
      .where(eq(userWeeklyProgress.id, progressId))
      .returning();
    return progress;
  }

  async resetWeeklyChallenges(): Promise<{ success: boolean; usersAffected: number; challengesReset: number }> {
    const lastWeek = daysAgoSaoPaulo(7);

    await db
      .delete(userWeeklyProgress)
      .where(lte(userWeeklyProgress.weekStartDate, lastWeek));

    await db
      .update(weeklyChallenges)
      .set({ isActive: false })
      .where(lte(weeklyChallenges.endDate, getNowSaoPaulo()));

    return {
      success: true,
      usersAffected: 0,
      challengesReset: 0,
    };
  }

  // ==================== REWARDS ====================

  async createUserReward(data: Omit<InsertUserReward, 'id' | 'createdAt'>): Promise<UserReward> {
    const [reward] = await db.insert(userRewards).values(data).returning();
    return reward;
  }

  async getUserActiveRewards(userId: string): Promise<UserReward[]> {
    const now = getNowSaoPaulo();
    return await db
      .select()
      .from(userRewards)
      .where(
        and(
          eq(userRewards.userId, userId),
          eq(userRewards.isActive, true),
          gte(userRewards.endDate, now)
        )
      );
  }

  async expireOldRewards(date: Date): Promise<number> {
    const result = await db
      .update(userRewards)
      .set({ isActive: false })
      .where(
        and(
          eq(userRewards.isActive, true),
          lte(userRewards.endDate, date)
        )
      );

    return 0; // Would need to count affected rows
  }

  // ==================== FEATURED MEMBERS ====================

  async createFeaturedMember(data: Omit<InsertFeaturedMember, 'id' | 'createdAt'>): Promise<FeaturedMember> {
    const [featured] = await db.insert(featuredMembers).values(data).returning();
    return featured;
  }

  async getFeaturedMembers(): Promise<Array<FeaturedMember & { user: User }>> {
    const result = await db
      .select({
        featured: featuredMembers,
        user: users,
      })
      .from(featuredMembers)
      .leftJoin(users, eq(featuredMembers.userId, users.id))
      .where(eq(featuredMembers.isActive, true))
      .orderBy(desc(featuredMembers.pointsEarned))
      .limit(10);

    return result.map(r => ({
      ...r.featured,
      user: r.user!,
    }));
  }

  async deactivateFeaturedMembers(): Promise<void> {
    await db
      .update(featuredMembers)
      .set({ isActive: false })
      .where(eq(featuredMembers.isActive, true));
  }

  async getTopUsersOfWeek(limit: number = 10): Promise<Array<{ userId: string; userName: string; pointsEarned: number }>> {
    const { start: weekStart } = getWeekBoundariesSaoPaulo();

    const result = await db
      .select({
        userId: userPoints.userId,
        userName: users.name,
        pointsEarned: sql<number>`${userPoints.points}`.as('points_earned'),
      })
      .from(userPoints)
      .leftJoin(users, eq(userPoints.userId, users.id))
      .where(gte(userPoints.updatedAt, weekStart))
      .orderBy(desc(userPoints.points))
      .limit(limit);

    return result.map(r => ({
      userId: r.userId,
      userName: r.userName,
      pointsEarned: r.pointsEarned || 0,
    }));
  }

  // ==================== META ADS ANDROMEDA CAMPAIGNS ====================

  async createMetaAdsCampaign(data: InsertMetaAdsCampaign): Promise<MetaAdsCampaign> {
    const [campaign] = await db.insert(metaAdsCampaigns).values(data).returning();
    return campaign;
  }

  async getMetaAdsCampaigns(userId: string): Promise<MetaAdsCampaign[]> {
    return await db
      .select()
      .from(metaAdsCampaigns)
      .where(eq(metaAdsCampaigns.userId, userId))
      .orderBy(desc(metaAdsCampaigns.createdAt));
  }

  async getMetaAdsCampaignById(id: string, userId: string): Promise<MetaAdsCampaign | undefined> {
    const [campaign] = await db
      .select()
      .from(metaAdsCampaigns)
      .where(and(
        eq(metaAdsCampaigns.id, id),
        eq(metaAdsCampaigns.userId, userId)
      ));
    return campaign;
  }

  async updateMetaAdsCampaign(id: string, userId: string, data: Partial<InsertMetaAdsCampaign>): Promise<MetaAdsCampaign> {
    const [campaign] = await db
      .update(metaAdsCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(metaAdsCampaigns.id, id),
        eq(metaAdsCampaigns.userId, userId)
      ))
      .returning();
    return campaign;
  }

  async deleteMetaAdsCampaign(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(metaAdsCampaigns)
      .where(and(
        eq(metaAdsCampaigns.id, id),
        eq(metaAdsCampaigns.userId, userId)
      ))
      .returning({ id: metaAdsCampaigns.id });
    return result.length > 0;
  }

  // OpenAI Token Usage Tracking
  async trackOpenAITokenUsage(data: {
    userId: string;
    model: string;
    operation?: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    costBrl?: number;
    exchangeRate?: number;
  }): Promise<void> {
    await db.insert(openaiTokenUsage).values({
      userId: data.userId,
      model: data.model,
      operation: data.operation || 'legacy',
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      costUsd: data.costUsd,
      costBrl: data.costBrl || data.costUsd * (data.exchangeRate || 5.0),
      exchangeRate: data.exchangeRate || 5.0,
    });
  }

  async getUserOpenAIUsage(userId: string, limit: number = 10): Promise<any[]> {
    return await db
      .select()
      .from(openaiTokenUsage)
      .where(eq(openaiTokenUsage.userId, userId))
      .orderBy(desc(openaiTokenUsage.usageDate))
      .limit(limit);
  }

  async getTotalOpenAIUsageByUser(userId: string): Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUSD: number;
  }> {
    const result = await db
      .select({
        totalPromptTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.completionTokens}), 0)::int`,
        totalTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.totalTokens}), 0)::int`,
        totalCostUSD: sql<number>`COALESCE(SUM(${openaiTokenUsage.costUsd}), 0)::float`
      })
      .from(openaiTokenUsage)
      .where(eq(openaiTokenUsage.userId, userId));

    return {
      totalPromptTokens: Number(result[0]?.totalPromptTokens) || 0,
      totalCompletionTokens: Number(result[0]?.totalCompletionTokens) || 0,
      totalTokens: Number(result[0]?.totalTokens) || 0,
      totalCostUSD: Number(result[0]?.totalCostUSD) || 0
    };
  }

  // ==================== REFERRAL/AFFILIATE SYSTEM ====================

  async getOrCreateReferralCode(userId: string): Promise<ReferralCode> {
    const [existing] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, userId));

    if (existing) return existing;

    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const { randomBytes } = await import('crypto');
    
    let code: string;
    let maxAttempts = 10;
    
    while (maxAttempts > 0) {
      const randomCode = randomBytes(5).toString('base64')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .substring(0, 9);
      
      code = randomCode.padEnd(9, '0');
      
      const [exists] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.code, code));

      if (!exists) break;
      maxAttempts--;
    }

    if (maxAttempts === 0) {
      throw new Error('Failed to generate unique referral code after 10 attempts');
    }

    try {
      const [referralCode] = await db
        .insert(referralCodes)
        .values({ userId, code: code! })
        .returning();
      return referralCode;
    } catch (error: any) {
      if (error?.code === '23505') {
        const [existingCode] = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.userId, userId));
        if (existingCode) return existingCode;
      }
      throw error;
    }
  }

  async getReferralCodeByCode(code: string): Promise<ReferralCode | undefined> {
    const [referralCode] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, code));
    return referralCode;
  }

  async updateReferralCodeStats(codeId: string, data: Partial<ReferralCode>): Promise<void> {
    await db
      .update(referralCodes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(referralCodes.id, codeId));
  }

  async trackReferralClick(data: InsertReferralClick): Promise<ReferralClick> {
    const [click] = await db.insert(referralClicks).values(data).returning();
    
    await db
      .update(referralCodes)
      .set({ clicks: sqlOp`${referralCodes.clicks} + 1`, updatedAt: new Date() })
      .where(eq(referralCodes.id, data.referralCodeId));

    return click;
  }

  async findReferralClickByIp(referralCodeId: string, ipAddress: string): Promise<ReferralClick | undefined> {
    const [click] = await db
      .select()
      .from(referralClicks)
      .where(and(
        eq(referralClicks.referralCodeId, referralCodeId),
        eq(referralClicks.ipAddress, ipAddress)
      ))
      .orderBy(desc(referralClicks.createdAt))
      .limit(1);
    return click;
  }

  async markReferralClickAsConverted(clickId: string, convertedUserId: string): Promise<void> {
    await db
      .update(referralClicks)
      .set({ converted: true, convertedUserId })
      .where(eq(referralClicks.id, clickId));
  }

  async getReferralClickByUserId(userId: string): Promise<ReferralClick | undefined> {
    const [click] = await db
      .select()
      .from(referralClicks)
      .where(eq(referralClicks.convertedUserId, userId))
      .orderBy(desc(referralClicks.createdAt))
      .limit(1);
    return click;
  }

  async createReferralCommission(data: InsertReferralCommission): Promise<ReferralCommission> {
    const conditions = [
      eq(referralCommissions.referrerId, data.referrerId),
      eq(referralCommissions.referredUserId, data.referredUserId),
      eq(referralCommissions.type, data.type)
    ];

    if (data.subscriptionId) {
      conditions.push(eq(referralCommissions.subscriptionId, data.subscriptionId));
      
      if (data.metadata && typeof data.metadata === 'object' && 'current_period' in data.metadata) {
        const currentPeriod = (data.metadata as any).current_period;
        conditions.push(sqlOp`metadata->>'current_period' = ${String(currentPeriod)}`);
      }
    } else if (data.caktoOrderId) {
      conditions.push(eq(referralCommissions.caktoOrderId, data.caktoOrderId));
    } else {
      logger.warn(`[REFERRAL] Commission creation without subscriptionId or caktoOrderId - this may cause duplicates`);
    }

    const existingCommissions = await db
      .select()
      .from(referralCommissions)
      .where(and(...conditions));
    
    if (existingCommissions.length > 0) {
      logger.debug(`[REFERRAL] Commission already exists for ${data.subscriptionId ? `subscription ${data.subscriptionId}` : `order ${data.caktoOrderId}`} type ${data.type}, skipping creation (idempotency check)`);
      return existingCommissions[0];
    }

    const [commission] = await db
      .insert(referralCommissions)
      .values(data)
      .returning();

    if (data.type === 'subscription') {
      await db
        .update(referralCodes)
        .set({ conversions: sqlOp`${referralCodes.conversions} + 1`, updatedAt: new Date() })
        .where(eq(referralCodes.userId, data.referrerId));
    }

    await this.getOrCreateReferralWallet(data.referrerId);
    
    const walletUpdate: any = {
      balancePending: sqlOp`${referralWallet.balancePending} + ${data.commissionAmountCents}`,
      totalEarned: sqlOp`${referralWallet.totalEarned} + ${data.commissionAmountCents}`,
      updatedAt: new Date()
    };
    
    if (data.type === 'subscription') {
      walletUpdate.activeReferrals = sqlOp`${referralWallet.activeReferrals} + 1`;
    }
    
    await db
      .update(referralWallet)
      .set(walletUpdate)
      .where(eq(referralWallet.userId, data.referrerId));

    await db.insert(referralTransactions).values({
      userId: data.referrerId,
      type: 'commission',
      amount: data.commissionAmountCents,
      commissionId: commission.id,
      status: 'pending',
      description: `Comissão de ${data.type === 'renewal' ? 'renovação' : 'assinatura'}`,
    });

    return commission;
  }

  async getReferralCommissionBySubscription(subscriptionId: string): Promise<ReferralCommission | null> {
    const [commission] = await db
      .select()
      .from(referralCommissions)
      .where(eq(referralCommissions.subscriptionId, subscriptionId))
      .limit(1);
    return commission || null;
  }

  async getReferralCommissions(
    userId: string,
    filters?: { status?: string; type?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<{ commissions: ReferralCommissionWithRelations[], total: number }> {
    const { status, type, limit = 15, offset = 0, startDate, endDate } = filters || {};

    const conditions: any[] = [eq(referralCommissions.referrerId, userId)];
    if (status) {
      conditions.push(eq(referralCommissions.status, status));
    }
    if (type) {
      conditions.push(eq(referralCommissions.type, type));
    }
    if (startDate) {
      conditions.push(gte(referralCommissions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(referralCommissions.createdAt, endDate));
    }

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralCommissions)
      .where(and(...conditions));

    const total = totalResult?.count || 0;

    const results = await db
      .select({
        commission: referralCommissions,
        referrer: users,
        referredUser: {
          id: sql<string>`referred_user.id`,
          name: sql<string>`referred_user.name`,
          email: sql<string>`referred_user.email`,
          profileImageUrl: sql<string>`referred_user.profile_image_url`,
        },
      })
      .from(referralCommissions)
      .leftJoin(users, eq(referralCommissions.referrerId, users.id))
      .leftJoin(
        sql`users AS referred_user`,
        sql`${referralCommissions.referredUserId} = referred_user.id`
      )
      .where(and(...conditions))
      .orderBy(desc(referralCommissions.createdAt))
      .limit(limit)
      .offset(offset);

    const commissions = results.map(r => ({
      ...r.commission,
      referrer: r.referrer,
      referredUser: r.referredUser?.id ? {
        id: r.referredUser.id,
        name: r.referredUser.name,
        email: r.referredUser.email,
        profileImageUrl: r.referredUser.profileImageUrl,
      } as any : undefined,
    }));

    return { commissions, total };
  }

  async updateReferralCommission(id: string, data: Partial<ReferralCommission>): Promise<void> {
    const [commission] = await db
      .select()
      .from(referralCommissions)
      .where(eq(referralCommissions.id, id));

    if (!commission) return;

    const oldStatus = commission.status;
    await db
      .update(referralCommissions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(referralCommissions.id, id));

    if (data.status && data.status !== oldStatus) {
      if (data.status === 'canceled' && oldStatus === 'active') {
        await db
          .update(referralWallet)
          .set({
            activeReferrals: sqlOp`${referralWallet.activeReferrals} - 1`,
            canceledReferrals: sqlOp`${referralWallet.canceledReferrals} + 1`,
            updatedAt: new Date()
          })
          .where(eq(referralWallet.userId, commission.referrerId));
      }
    }
  }

  async getOrCreateReferralWallet(userId: string): Promise<ReferralWallet> {
    const [existing] = await db
      .select()
      .from(referralWallet)
      .where(eq(referralWallet.userId, userId));

    if (existing) return existing;

    try {
      const [wallet] = await db
        .insert(referralWallet)
        .values({ userId })
        .returning();
      return wallet;
    } catch (error: any) {
      if (error?.code === '23505') {
        const [wallet] = await db
          .select()
          .from(referralWallet)
          .where(eq(referralWallet.userId, userId));
        if (wallet) return wallet;
      }
      throw error;
    }
  }

  async getReferralWallet(userId: string): Promise<ReferralWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(referralWallet)
      .where(eq(referralWallet.userId, userId));
    return wallet;
  }

  async getReferralTransactions(userId: string, limit: number = 15, offset: number = 0): Promise<ReferralTransaction[]> {
    return await db
      .select()
      .from(referralTransactions)
      .where(eq(referralTransactions.userId, userId))
      .orderBy(desc(referralTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getPendingReferralCommissionsForRelease(daysAgo: number = 8): Promise<ReferralCommission[]> {
    const cutoffDate = daysAgoSaoPaulo(daysAgo);

    return await db
      .select()
      .from(referralCommissions)
      .where(
        and(
          eq(referralCommissions.status, 'pending'),
          isNull(referralCommissions.releasedAt),
          lte(referralCommissions.createdAt, cutoffDate)
        )
      );
  }

  async updateReferralPixConfig(userId: string, pixKey: string, pixKeyType: string): Promise<void> {
    await this.getOrCreateReferralWallet(userId);
    await db
      .update(referralWallet)
      .set({
        pixKey,
        pixKeyType,
        updatedAt: new Date()
      })
      .where(eq(referralWallet.userId, userId));
  }

  async getReferralBalance(userId: string): Promise<{ balancePending: number; balanceAvailable: number; pixKey?: string; pixKeyType?: string }> {
    const wallet = await this.getOrCreateReferralWallet(userId);
    
    return {
      balancePending: wallet.balancePending ?? 0,
      balanceAvailable: wallet.balanceAvailable ?? 0,
      pixKey: wallet.pixKey || undefined,
      pixKeyType: wallet.pixKeyType || undefined,
    };
  }

  async createReferralWithdrawal(userId: string, amountCents: number, pixKey: string, pixKeyType: string, podpayTransferId: string): Promise<any> {
    const [withdrawal] = await db
      .insert(podpayWithdrawals)
      .values({
        sellerId: userId,
        source: 'referral',
        amountCents,
        pixKey,
        pixKeyType,
        podpayTransferId,
        status: 'pending',
      })
      .returning();

    return withdrawal;
  }

  async listReferralWithdrawals(userId: string, filters?: { startDate?: Date; endDate?: Date }): Promise<any[]> {
    const { startDate, endDate } = filters || {};
    
    const conditions: any[] = [
      eq(podpayWithdrawals.sellerId, userId),
      eq(podpayWithdrawals.source, 'referral')
    ];
    
    if (startDate) {
      conditions.push(gte(podpayWithdrawals.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(podpayWithdrawals.createdAt, endDate));
    }
    
    return await db
      .select()
      .from(podpayWithdrawals)
      .where(and(...conditions))
      .orderBy(desc(podpayWithdrawals.createdAt));
  }

  async getReferredUsersList(referrerId: string, filters?: { status?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }): Promise<{
    users: Array<{
      referredUser: { id: string; name: string; email: string; profileImageUrl?: string };
      subscriptionStatus: string;
      totalCommissions: number;
      activeCommissions: number;
      createdAt: Date;
      lastCommissionAt: Date | null;
    }>;
    total: number;
    byStatus: { active: number; pending: number; cancelled: number; refunded: number };
  }> {
    const { status, limit = 50, offset = 0, startDate, endDate } = filters || {};

    const baseConditions: any[] = [eq(referralCommissions.referrerId, referrerId)];
    if (status) {
      baseConditions.push(eq(referralCommissions.status, status));
    }
    if (startDate) {
      baseConditions.push(gte(referralCommissions.createdAt, startDate));
    }
    if (endDate) {
      baseConditions.push(lte(referralCommissions.createdAt, endDate));
    }

    const referredUsersData = await db
      .select({
        referredUserId: referralCommissions.referredUserId,
        status: referralCommissions.status,
        commissionAmount: referralCommissions.commissionAmountCents,
        createdAt: referralCommissions.createdAt,
      })
      .from(referralCommissions)
      .where(and(...baseConditions))
      .orderBy(desc(referralCommissions.createdAt));

    const userStatsMap = new Map<string, {
      totalCommissions: number;
      activeCommissions: number;
      subscriptionStatus: string;
      createdAt: Date;
      lastCommissionAt: Date | null;
    }>();

    for (const row of referredUsersData) {
      const existing = userStatsMap.get(row.referredUserId);
      if (!existing) {
        userStatsMap.set(row.referredUserId, {
          totalCommissions: row.commissionAmount,
          activeCommissions: row.status === 'active' || row.status === 'completed' ? row.commissionAmount : 0,
          subscriptionStatus: row.status || 'pending',
          createdAt: row.createdAt!,
          lastCommissionAt: row.createdAt,
        });
      } else {
        existing.totalCommissions += row.commissionAmount;
        if (row.status === 'active' || row.status === 'completed') {
          existing.activeCommissions += row.commissionAmount;
        }
        if (row.createdAt && (!existing.lastCommissionAt || row.createdAt > existing.lastCommissionAt)) {
          existing.lastCommissionAt = row.createdAt;
        }
      }
    }

    const userIds = Array.from(userStatsMap.keys());
    if (userIds.length === 0) {
      return { users: [], total: 0, byStatus: { active: 0, pending: 0, cancelled: 0, refunded: 0 } };
    }

    const usersInfo = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const usersMap = new Map(usersInfo.map(u => [u.id, u]));

    const byStatus = { active: 0, pending: 0, cancelled: 0, refunded: 0 };
    for (const row of referredUsersData) {
      const status = row.status || 'pending';
      if (status === 'active' || status === 'completed') byStatus.active++;
      else if (status === 'pending') byStatus.pending++;
      else if (status === 'cancelled' || status === 'canceled') byStatus.cancelled++;
      else if (status === 'refunded') byStatus.refunded++;
    }

    const result = userIds.slice(offset, offset + limit).map(userId => {
      const userInfo = usersMap.get(userId);
      const stats = userStatsMap.get(userId)!;
      return {
        referredUser: {
          id: userId,
          name: userInfo?.name || 'Usuário',
          email: userInfo?.email || '',
          profileImageUrl: userInfo?.profileImageUrl || undefined,
        },
        subscriptionStatus: userInfo?.subscriptionStatus || stats.subscriptionStatus,
        totalCommissions: stats.totalCommissions,
        activeCommissions: stats.activeCommissions,
        createdAt: stats.createdAt,
        lastCommissionAt: stats.lastCommissionAt,
      };
    });

    return { users: result, total: userIds.length, byStatus };
  }

  async getCompleteReferralStats(referrerId: string): Promise<{
    overview: {
      totalClicks: number;
      totalConversions: number;
      conversionRate: string;
      totalReferredUsers: number;
    };
    financial: {
      totalEarned: number;
      totalRefunded: number;
      totalWithdrawn: number;
      balancePending: number;
      balanceAvailable: number;
      netEarnings: number;
    };
    referrals: {
      active: number;
      pending: number;
      cancelled: number;
      refunded: number;
    };
    commissionsByStatus: {
      pending: number;
      active: number;
      completed: number;
      cancelled: number;
      refunded: number;
    };
  }> {
    const [wallet, code] = await Promise.all([
      this.getOrCreateReferralWallet(referrerId),
      this.getOrCreateReferralCode(referrerId),
    ]);

    const commissionStats = await db
      .select({
        status: referralCommissions.status,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`COALESCE(SUM(${referralCommissions.commissionAmountCents}), 0)::int`,
      })
      .from(referralCommissions)
      .where(eq(referralCommissions.referrerId, referrerId))
      .groupBy(referralCommissions.status);

    const statusCounts: Record<string, { count: number; amount: number }> = {};
    for (const row of commissionStats) {
      statusCounts[row.status || 'unknown'] = { count: row.count, amount: row.totalAmount };
    }

    const uniqueReferredUsers = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${referralCommissions.referredUserId})::int` })
      .from(referralCommissions)
      .where(eq(referralCommissions.referrerId, referrerId));

    const totalEarned = wallet.totalEarned ?? 0;
    const totalRefunded = wallet.totalRefunded ?? 0;
    const totalWithdrawn = wallet.totalWithdrawn ?? 0;
    const balancePending = wallet.balancePending ?? 0;
    const balanceAvailable = wallet.balanceAvailable ?? 0;
    const activeReferrals = wallet.activeReferrals ?? 0;
    const canceledReferrals = wallet.canceledReferrals ?? 0;

    return {
      overview: {
        totalClicks: code.clicks ?? 0,
        totalConversions: code.conversions ?? 0,
        conversionRate: code.clicks > 0 ? ((code.conversions / code.clicks) * 100).toFixed(2) : '0.00',
        totalReferredUsers: uniqueReferredUsers[0]?.count || 0,
      },
      financial: {
        totalEarned,
        totalRefunded,
        totalWithdrawn,
        balancePending,
        balanceAvailable,
        netEarnings: totalEarned - totalRefunded,
      },
      referrals: {
        active: activeReferrals,
        pending: statusCounts['pending']?.count || 0,
        cancelled: canceledReferrals,
        refunded: statusCounts['refunded']?.count || 0,
      },
      commissionsByStatus: {
        pending: statusCounts['pending']?.amount || 0,
        active: statusCounts['active']?.amount || 0,
        completed: statusCounts['completed']?.amount || 0,
        cancelled: statusCounts['cancelled']?.amount || statusCounts['canceled']?.amount || 0,
        refunded: statusCounts['refunded']?.amount || 0,
      },
    };
  }

  async cancelReferralCommissionsForUser(referredUserId: string, subscriptionId: string): Promise<void> {
    logger.debug(`[REFERRAL] Cancelando comissões para usuário ${referredUserId}, assinatura ${subscriptionId}`);

    const commissionsToCancel = await db
      .select()
      .from(referralCommissions)
      .where(
        and(
          eq(referralCommissions.referredUserId, referredUserId),
          eq(referralCommissions.subscriptionId, subscriptionId || ''),
          or(
            eq(referralCommissions.status, 'pending'),
            eq(referralCommissions.status, 'completed')
          )
        )
      );

    if (commissionsToCancel.length === 0) {
      logger.debug('[REFERRAL] Nenhuma comissão encontrada para cancelar');
      return;
    }

    await db.transaction(async (tx) => {
      const walletAdjustments = new Map<string, {
        pendingAmount: number;
        availableAmount: number;
        totalEarnedAmount: number;
        activeReferralsCount: number;
        canceledReferralsCount: number;
      }>();

      const commissionsToUpdate: string[] = [];
      const transactionsToCreate: any[] = [];

      for (const commission of commissionsToCancel) {
        const [locked] = await tx
          .select()
          .from(referralCommissions)
          .where(
            and(
              eq(referralCommissions.id, commission.id),
              or(
                eq(referralCommissions.status, 'pending'),
                eq(referralCommissions.status, 'completed')
              )
            )
          )
          .for('update');

        if (!locked) {
          logger.debug(`[REFERRAL] Comissão ${commission.id} já foi cancelada`);
          continue;
        }

        commissionsToUpdate.push(commission.id);

        if (!walletAdjustments.has(commission.referrerId)) {
          walletAdjustments.set(commission.referrerId, {
            pendingAmount: 0,
            availableAmount: 0,
            totalEarnedAmount: 0,
            activeReferralsCount: 0,
            canceledReferralsCount: 0,
          });
        }

        const adjustment = walletAdjustments.get(commission.referrerId)!;

        if (locked.status === 'pending') {
          adjustment.pendingAmount += commission.commissionAmountCents;
          adjustment.totalEarnedAmount += commission.commissionAmountCents;
          logger.debug(`[REFERRAL] Comissão ${commission.id} pendente - será removida de balancePending e adicionada a totalRefunded`);
        } else if (locked.status === 'completed' && locked.releasedAt) {
          adjustment.availableAmount += commission.commissionAmountCents;
          adjustment.totalEarnedAmount += commission.commissionAmountCents;
          logger.debug(`[REFERRAL] Comissão ${commission.id} completada - será removida de balanceAvailable e adicionada a totalRefunded`);
        } else {
          logger.warn(`[REFERRAL] Comissão ${commission.id} tem status inesperado: ${locked.status}`);
          continue;
        }

        if (commission.type === 'subscription') {
          adjustment.activeReferralsCount += 1;
          adjustment.canceledReferralsCount += 1;
        }

        transactionsToCreate.push({
          userId: commission.referrerId,
          type: 'chargeback',
          amount: -commission.commissionAmountCents,
          commissionId: commission.id,
          status: 'completed',
          description: `Estorno de comissão - Assinatura cancelada/reembolsada`,
        });
      }

      if (commissionsToUpdate.length > 0) {
        await tx
          .update(referralCommissions)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(inArray(referralCommissions.id, commissionsToUpdate));
      }

      for (const [userId, adjustment] of walletAdjustments.entries()) {
        const [wallet] = await tx
          .select()
          .from(referralWallet)
          .where(eq(referralWallet.userId, userId))
          .for('update');

        if (!wallet) {
          logger.error(`[REFERRAL] Wallet not found for referrer ${userId}`);
          continue;
        }

        logger.debug(`[REFERRAL] Ajustando wallet para afiliado ${userId}:`);
        logger.debug(`  - Pending a remover: R$ ${(adjustment.pendingAmount / 100).toFixed(2)}`);
        logger.debug(`  - Available a remover: R$ ${(adjustment.availableAmount / 100).toFixed(2)}`);
        logger.debug(`  - Total refunded a adicionar: R$ ${(adjustment.totalEarnedAmount / 100).toFixed(2)}`);
        logger.debug(`  - Active referrals a decrementar: ${adjustment.activeReferralsCount}`);

        await tx.execute(sql`
          UPDATE referral_wallet 
          SET 
            balance_pending = GREATEST(0, balance_pending - ${adjustment.pendingAmount}),
            balance_available = GREATEST(0, balance_available - ${adjustment.availableAmount}),
            total_refunded = total_refunded + ${adjustment.totalEarnedAmount},
            active_referrals = GREATEST(0, active_referrals - ${adjustment.activeReferralsCount}),
            canceled_referrals = canceled_referrals + ${adjustment.canceledReferralsCount},
            updated_at = NOW()
          WHERE user_id = ${userId}
        `);

        logger.debug(`[REFERRAL] ✅ Wallet ajustada para afiliado ${userId} - R$ ${(adjustment.totalEarnedAmount / 100).toFixed(2)} adicionado a totalRefunded (totalEarned preservado)`);
      }

      if (transactionsToCreate.length > 0) {
        await tx.insert(referralTransactions).values(transactionsToCreate);
      }

      logger.debug(`[REFERRAL] ${commissionsToUpdate.length} comissões canceladas com sucesso`);
    });
  }

  // ==================== SUBSCRIPTION REFUND REQUESTS ====================

  async createSubscriptionRefundRequest(data: InsertSubscriptionRefundRequest): Promise<SubscriptionRefundRequest> {
    const [request] = await db.insert(subscriptionRefundRequests).values(data).returning();
    return request;
  }

  async getSubscriptionRefundRequest(id: string): Promise<SubscriptionRefundRequest | undefined> {
    const [request] = await db.select().from(subscriptionRefundRequests).where(eq(subscriptionRefundRequests.id, id));
    return request;
  }

  async getSubscriptionRefundRequestBySubscriptionId(subscriptionId: string): Promise<SubscriptionRefundRequest | undefined> {
    const [request] = await db
      .select()
      .from(subscriptionRefundRequests)
      .where(eq(subscriptionRefundRequests.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionRefundRequests.createdAt))
      .limit(1);
    return request;
  }

  async getSubscriptionRefundRequestByUserId(userId: string): Promise<SubscriptionRefundRequest | undefined> {
    const [request] = await db
      .select()
      .from(subscriptionRefundRequests)
      .where(
        and(
          eq(subscriptionRefundRequests.userId, userId),
          or(
            eq(subscriptionRefundRequests.status, 'pending'),
            eq(subscriptionRefundRequests.status, 'processing')
          )
        )
      )
      .orderBy(desc(subscriptionRefundRequests.createdAt))
      .limit(1);
    return request;
  }

  async listSubscriptionRefundRequests(status?: string): Promise<SubscriptionRefundRequestWithRelations[]> {
    const conditions = status ? [eq(subscriptionRefundRequests.status, status)] : [];
    
    const requests = await db
      .select({
        request: subscriptionRefundRequests,
        subscription: lowfySubscriptions,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(subscriptionRefundRequests)
      .innerJoin(lowfySubscriptions, eq(subscriptionRefundRequests.subscriptionId, lowfySubscriptions.id))
      .innerJoin(users, eq(subscriptionRefundRequests.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(subscriptionRefundRequests.createdAt));

    return requests.map(r => ({
      ...r.request,
      subscription: r.subscription,
      user: r.user as any,
    }));
  }

  async updateSubscriptionRefundRequest(id: string, data: Partial<SubscriptionRefundRequest>): Promise<SubscriptionRefundRequest | undefined> {
    const [request] = await db
      .update(subscriptionRefundRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptionRefundRequests.id, id))
      .returning();
    return request;
  }

  async isSubscriptionEligibleForRefund(subscriptionId: string): Promise<{ eligible: boolean; reason?: string; daysFromFirstPayment?: number }> {
    const [subscription] = await db
      .select()
      .from(lowfySubscriptions)
      .where(eq(lowfySubscriptions.id, subscriptionId));

    if (!subscription) {
      return { eligible: false, reason: 'Assinatura não encontrada' };
    }

    if (subscription.status !== 'canceled') {
      return { eligible: false, reason: 'Assinatura deve estar cancelada para solicitar reembolso' };
    }

    if ((subscription.currentPeriod || 1) > 1) {
      return { eligible: false, reason: 'Reembolso disponível apenas para o primeiro período de assinatura' };
    }

    const existingRequest = await this.getSubscriptionRefundRequestBySubscriptionId(subscriptionId);
    if (existingRequest) {
      return { eligible: false, reason: 'Já existe uma solicitação de reembolso para esta assinatura' };
    }

    const paidAt = subscription.paidAt || subscription.createdAt;
    if (!paidAt) {
      return { eligible: false, reason: 'Data de pagamento não encontrada' };
    }

    const daysSincePaid = Math.floor((getNowSaoPaulo().getTime() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSincePaid > 7) {
      return { eligible: false, reason: 'Prazo de 7 dias para reembolso expirado', daysFromFirstPayment: daysSincePaid };
    }

    return { eligible: true, daysFromFirstPayment: daysSincePaid };
  }

  // ==================== OPENAI TOKEN USAGE OPERATIONS ====================

  async logTokenUsage(data: InsertOpenAITokenUsage): Promise<OpenAITokenUsage> {
    const [usage] = await db.insert(openaiTokenUsage).values(data).returning();
    return usage;
  }

  async getTokenUsageSummary(startDate: Date, endDate: Date): Promise<{
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    totalCostBrl: number;
    totalCalls: number;
  }> {
    const result = await db
      .select({
        totalPromptTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.completionTokens}), 0)::int`,
        totalTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.totalTokens}), 0)::int`,
        totalCostUsd: sql<number>`COALESCE(SUM(${openaiTokenUsage.costUsd}), 0)::float`,
        totalCostBrl: sql<number>`COALESCE(SUM(${openaiTokenUsage.costBrl}), 0)::float`,
        totalCalls: sql<number>`COUNT(*)::int`,
      })
      .from(openaiTokenUsage)
      .where(
        and(
          gte(openaiTokenUsage.usageDate, startDate),
          lte(openaiTokenUsage.usageDate, endDate)
        )
      );

    return result[0] || {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalCostBrl: 0,
      totalCalls: 0,
    };
  }

  async getTokenUsageByUser(startDate: Date, endDate: Date): Promise<Array<{
    userId: string | null;
    userName: string;
    userEmail: string;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    totalCostBrl: number;
    callCount: number;
  }>> {
    const result = await db
      .select({
        userId: openaiTokenUsage.userId,
        userName: sql<string>`COALESCE(${users.name}, 'Processos Internos')`,
        userEmail: sql<string>`COALESCE(${users.email}, 'sistema@lowfy.com.br')`,
        totalPromptTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.completionTokens}), 0)::int`,
        totalTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.totalTokens}), 0)::int`,
        totalCostUsd: sql<number>`COALESCE(SUM(${openaiTokenUsage.costUsd}), 0)::float`,
        totalCostBrl: sql<number>`COALESCE(SUM(${openaiTokenUsage.costBrl}), 0)::float`,
        callCount: sql<number>`COUNT(*)::int`,
      })
      .from(openaiTokenUsage)
      .leftJoin(users, eq(openaiTokenUsage.userId, users.id))
      .where(
        and(
          gte(openaiTokenUsage.usageDate, startDate),
          lte(openaiTokenUsage.usageDate, endDate)
        )
      )
      .groupBy(openaiTokenUsage.userId, users.name, users.email)
      .orderBy(desc(sql`SUM(${openaiTokenUsage.totalTokens})`));

    return result;
  }

  async getTokenUsageLogs(startDate: Date, endDate: Date, userId?: string): Promise<OpenAITokenUsage[]> {
    const conditions = [
      gte(openaiTokenUsage.usageDate, startDate),
      lte(openaiTokenUsage.usageDate, endDate),
    ];

    if (userId) {
      conditions.push(eq(openaiTokenUsage.userId, userId));
    }

    return await db
      .select()
      .from(openaiTokenUsage)
      .where(and(...conditions))
      .orderBy(desc(openaiTokenUsage.usageDate));
  }

  async getTokenUsageByOperation(startDate: Date, endDate: Date): Promise<Array<{
    operation: string;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    totalCostBrl: number;
    callCount: number;
  }>> {
    const result = await db
      .select({
        operation: openaiTokenUsage.operation,
        totalPromptTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.promptTokens}), 0)::int`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.completionTokens}), 0)::int`,
        totalTokens: sql<number>`COALESCE(SUM(${openaiTokenUsage.totalTokens}), 0)::int`,
        totalCostUsd: sql<number>`COALESCE(SUM(${openaiTokenUsage.costUsd}), 0)::float`,
        totalCostBrl: sql<number>`COALESCE(SUM(${openaiTokenUsage.costBrl}), 0)::float`,
        callCount: sql<number>`COUNT(*)::int`,
      })
      .from(openaiTokenUsage)
      .where(
        and(
          gte(openaiTokenUsage.usageDate, startDate),
          lte(openaiTokenUsage.usageDate, endDate)
        )
      )
      .groupBy(openaiTokenUsage.operation)
      .orderBy(desc(sql`SUM(${openaiTokenUsage.totalTokens})`));

    return result;
  }

  // ==================== WHATSAPP CAMPAIGN OPERATIONS ====================

  async createWhatsappCampaign(data: InsertWhatsappCampaign): Promise<WhatsappCampaign> {
    const [campaign] = await db.insert(whatsappCampaigns).values(data).returning();
    return campaign;
  }

  async getWhatsappCampaign(id: string): Promise<WhatsappCampaign | undefined> {
    const [campaign] = await db.select().from(whatsappCampaigns).where(eq(whatsappCampaigns.id, id));
    return campaign;
  }

  async getWhatsappCampaigns(): Promise<WhatsappCampaign[]> {
    return await db.select().from(whatsappCampaigns).orderBy(desc(whatsappCampaigns.createdAt));
  }

  async updateWhatsappCampaign(id: string, data: Partial<WhatsappCampaign>): Promise<WhatsappCampaign | undefined> {
    const [campaign] = await db
      .update(whatsappCampaigns)
      .set({ ...data, updatedAt: getNowSaoPaulo() })
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return campaign;
  }

  async deleteWhatsappCampaign(id: string): Promise<boolean> {
    await db.delete(whatsappCampaignRecipients).where(eq(whatsappCampaignRecipients.campaignId, id));
    const result = await db.delete(whatsappCampaigns).where(eq(whatsappCampaigns.id, id));
    return true;
  }

  async incrementCampaignSentCount(id: string): Promise<void> {
    await db
      .update(whatsappCampaigns)
      .set({ 
        sentCount: sql`${whatsappCampaigns.sentCount} + 1`,
        currentRecipientIndex: sql`${whatsappCampaigns.currentRecipientIndex} + 1`,
        updatedAt: getNowSaoPaulo()
      })
      .where(eq(whatsappCampaigns.id, id));
  }

  async incrementCampaignErrorCount(id: string): Promise<void> {
    await db
      .update(whatsappCampaigns)
      .set({ 
        errorCount: sql`${whatsappCampaigns.errorCount} + 1`,
        currentRecipientIndex: sql`${whatsappCampaigns.currentRecipientIndex} + 1`,
        updatedAt: getNowSaoPaulo()
      })
      .where(eq(whatsappCampaigns.id, id));
  }

  async incrementCampaignOptOutCount(id: string): Promise<void> {
    await db
      .update(whatsappCampaigns)
      .set({ 
        optOutCount: sql`${whatsappCampaigns.optOutCount} + 1`,
        updatedAt: getNowSaoPaulo()
      })
      .where(eq(whatsappCampaigns.id, id));
  }

  // ==================== WHATSAPP CAMPAIGN RECIPIENT OPERATIONS ====================

  async createWhatsappCampaignRecipient(data: InsertWhatsappCampaignRecipient): Promise<WhatsappCampaignRecipient> {
    const [recipient] = await db.insert(whatsappCampaignRecipients).values(data).returning();
    return recipient;
  }

  async createWhatsappCampaignRecipients(data: InsertWhatsappCampaignRecipient[]): Promise<WhatsappCampaignRecipient[]> {
    if (data.length === 0) return [];
    return await db.insert(whatsappCampaignRecipients).values(data).returning();
  }

  async deleteCampaignRecipients(campaignId: string): Promise<void> {
    await db.delete(whatsappCampaignRecipients).where(eq(whatsappCampaignRecipients.campaignId, campaignId));
  }

  async getCampaignRecipients(campaignId: string): Promise<WhatsappCampaignRecipient[]> {
    return await db
      .select()
      .from(whatsappCampaignRecipients)
      .where(eq(whatsappCampaignRecipients.campaignId, campaignId))
      .orderBy(whatsappCampaignRecipients.createdAt);
  }

  async getPendingCampaignRecipients(campaignId: string): Promise<WhatsappCampaignRecipient[]> {
    return await db
      .select()
      .from(whatsappCampaignRecipients)
      .where(and(
        eq(whatsappCampaignRecipients.campaignId, campaignId),
        eq(whatsappCampaignRecipients.status, 'pending')
      ))
      .orderBy(whatsappCampaignRecipients.createdAt);
  }

  async updateCampaignRecipient(id: string, data: Partial<WhatsappCampaignRecipient>): Promise<WhatsappCampaignRecipient | undefined> {
    const [recipient] = await db
      .update(whatsappCampaignRecipients)
      .set(data)
      .where(eq(whatsappCampaignRecipients.id, id))
      .returning();
    return recipient;
  }

  async getCampaignRecipientStats(campaignId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    error: number;
    optedOut: number;
    skipped: number;
  }> {
    const result = await db
      .select({
        status: whatsappCampaignRecipients.status,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(whatsappCampaignRecipients)
      .where(eq(whatsappCampaignRecipients.campaignId, campaignId))
      .groupBy(whatsappCampaignRecipients.status);

    const stats = { total: 0, pending: 0, sent: 0, error: 0, optedOut: 0, skipped: 0 };
    result.forEach(r => {
      stats.total += r.count;
      if (r.status === 'pending') stats.pending = r.count;
      if (r.status === 'sent') stats.sent = r.count;
      if (r.status === 'error') stats.error = r.count;
      if (r.status === 'opted_out') stats.optedOut = r.count;
      if (r.status === 'skipped') stats.skipped = r.count;
    });
    return stats;
  }

  // ==================== WHATSAPP OPT-OUT OPERATIONS ====================

  async createWhatsappOptOut(data: InsertWhatsappOptOut): Promise<WhatsappOptOut> {
    const [optOut] = await db.insert(whatsappOptOuts).values(data).returning();
    return optOut;
  }

  async getWhatsappOptOut(phone: string): Promise<WhatsappOptOut | undefined> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const [optOut] = await db.select().from(whatsappOptOuts).where(eq(whatsappOptOuts.phone, normalizedPhone));
    return optOut;
  }

  async getWhatsappOptOuts(): Promise<WhatsappOptOut[]> {
    return await db.select().from(whatsappOptOuts).orderBy(desc(whatsappOptOuts.optedOutAt));
  }

  async isPhoneOptedOut(phone: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const [optOut] = await db.select().from(whatsappOptOuts).where(eq(whatsappOptOuts.phone, normalizedPhone));
    return !!optOut;
  }

  async deleteWhatsappOptOut(id: string): Promise<boolean> {
    await db.delete(whatsappOptOuts).where(eq(whatsappOptOuts.id, id));
    return true;
  }

  async getOptOutCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`COUNT(*)::int` }).from(whatsappOptOuts);
    return result[0]?.count || 0;
  }

  async getEligibleRecipientsForCampaign(): Promise<Array<{ userId: string; phone: string; userName: string }>> {
    const optedOutPhones = db.select({ phone: whatsappOptOuts.phone }).from(whatsappOptOuts);
    
    const result = await db
      .select({
        userId: users.id,
        phone: users.phone,
        userName: users.name,
      })
      .from(users)
      .where(and(
        sql`${users.phone} IS NOT NULL`,
        sql`${users.phone} != ''`,
        sql`${users.phone} NOT IN (${optedOutPhones})`
      ));

    return result.filter(r => r.phone).map(r => ({
      userId: r.userId,
      phone: r.phone!,
      userName: r.userName,
    }));
  }
}

export const storage = new DatabaseStorage();