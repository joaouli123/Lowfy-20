import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  unique,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  uuid, // Import uuid for defaultRandom()
  json, // Import json for extraLinks
  real, // Import real for orcamentoDiario
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with custom authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  name: varchar("name").notNull(),
  phone: varchar("phone").unique(),
  cpf: varchar("cpf").unique(),
  phoneVerified: boolean("phone_verified").default(false),
  phoneVerifiedAt: timestamp("phone_verified_at"),
  profileImageUrl: varchar("profile_image_url"),
  profession: varchar("profession"),
  areaAtuacao: varchar("area_atuacao"),
  location: varchar("location"),
  bio: text("bio"),
  website: varchar("website"),
  isAdmin: boolean("is_admin").default(false),
  testingAsNonAdmin: boolean("testing_as_non_admin").default(false), // Flag for admin to test as non-admin user
  accountStatus: varchar("account_status").default("pending"), // pending, active, blocked, expired
  subscriptionStatus: varchar("subscription_status").default("none"), // none, trial, active, canceled, expired
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  accessPlan: varchar("access_plan").default("basic"), // full = all features (com assinatura), basic = limited (contas grátis)
  caktoCustomerId: varchar("cakto_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for custom auth
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    token: varchar("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("IDX_session_expires").on(table.expiresAt)],
);

// Phone Verifications for SMS OTP
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    subscriptionId: varchar("subscription_id"), // Vincula OTP à assinatura específica para segurança
    phone: varchar("phone").notNull(),
    codeHash: varchar("code_hash").notNull(), // BCrypt hashed OTP
    expiresAt: timestamp("expires_at").notNull(),
    attemptCount: integer("attempt_count").default(0),
    lastSentAt: timestamp("last_sent_at").defaultNow(),
    status: varchar("status").default("pending"), // pending, verified, expired, failed
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_phone_verifications_user").on(table.userId),
    index("IDX_phone_verifications_status").on(table.status),
    index("IDX_phone_verifications_subscription").on(table.subscriptionId),
  ],
);

// Email Verifications for Email OTP (Login Security)
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    email: varchar("email").notNull(),
    codeHash: varchar("code_hash").notNull(), // BCrypt hashed OTP
    expiresAt: timestamp("expires_at").notNull(),
    attemptCount: integer("attempt_count").default(0),
    lastSentAt: timestamp("last_sent_at").defaultNow(),
    status: varchar("status").default("pending"), // pending, verified, expired, failed
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_email_verifications_user").on(table.userId),
    index("IDX_email_verifications_status").on(table.status),
  ],
);

// Password Reset Tokens
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    email: varchar("email").notNull(),
    token: varchar("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    used: boolean("used").default(false),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_password_reset_tokens_user").on(table.userId),
    index("IDX_password_reset_tokens_token").on(table.token),
  ],
);

// @deprecated - Cakto integration removed November 2024. Tables kept for historical data only.
// Use lowfySubscriptions for new subscription management
export const caktoOrders = pgTable("cakto_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caktoOrderId: varchar("cakto_order_id").notNull().unique(),
  caktoRefId: varchar("cakto_ref_id"),
  userId: varchar("user_id").references(() => users.id),
  customerEmail: varchar("customer_email").notNull(),
  customerName: varchar("customer_name").notNull(),
  customerPhone: varchar("customer_phone"),
  productId: varchar("product_id"),
  productName: varchar("product_name"),
  offerId: varchar("offer_id"),
  offerName: varchar("offer_name"),
  status: varchar("status").notNull(), // paid, waiting_payment, refused, refunded, chargeback
  paymentMethod: varchar("payment_method"), // pix, credit_card, boleto, picpay
  amount: integer("amount").notNull(), // in cents
  baseAmount: integer("base_amount"),
  discount: integer("discount").default(0),
  fees: integer("fees").default(0),
  isSubscription: boolean("is_subscription").default(false),
  subscriptionId: varchar("subscription_id"),
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  chargedbackAt: timestamp("charged_back_at"),
  webhookData: jsonb("webhook_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// @deprecated - Cakto integration removed November 2024. Tables kept for historical data only.
export const caktoSubscriptions = pgTable("cakto_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caktoSubscriptionId: varchar("cakto_subscription_id").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  status: varchar("status").notNull(), // active, canceled, expired
  currentPeriod: integer("current_period").default(1),
  recurrencePeriod: integer("recurrence_period"),
  amount: integer("amount").notNull(), // in cents
  paymentMethod: varchar("payment_method"),
  nextPaymentDate: timestamp("next_payment_date"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lowfy Internal Subscriptions (Asaas + PodPay)
export const lowfySubscriptions = pgTable("lowfy_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  provider: varchar("provider").notNull(), // 'asaas' or 'podpay'
  providerCustomerId: varchar("provider_customer_id"),
  providerSubscriptionId: varchar("provider_subscription_id"),
  providerTransactionId: varchar("provider_transaction_id"),
  plan: varchar("plan").notNull(), // 'mensal' or 'anual'
  status: varchar("status").notNull().default("pending"), // pending, awaiting_payment, active, canceled, expired, refunded
  statusChangedAt: timestamp("status_changed_at").defaultNow(), // tracks when status last changed
  amount: integer("amount").notNull(), // in cents
  paymentMethod: varchar("payment_method").notNull(), // 'credit_card' or 'pix'
  currentPeriod: integer("current_period").default(1),
  nextPaymentDate: timestamp("next_payment_date"),
  paidAt: timestamp("paid_at"),
  canceledAt: timestamp("canceled_at"),
  buyerName: varchar("buyer_name").notNull(),
  buyerEmail: varchar("buyer_email").notNull(),
  buyerCpf: varchar("buyer_cpf").notNull(),
  buyerPhone: varchar("buyer_phone"),
  buyerPostalCode: varchar("buyer_postal_code"),
  buyerAddressNumber: varchar("buyer_address_number"),
  activationToken: varchar("activation_token").unique(),
  referralCode: varchar("referral_code"),
  qrCodeData: text("qr_code_data"),
  qrCodeImage: text("qr_code_image"),
  pixExpiresAt: timestamp("pix_expires_at"),
  webhookData: jsonb("webhook_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  accessValidUntil: timestamp("access_valid_until"),
  cancelReason: varchar("cancel_reason"),
}, (table) => [
  index("IDX_lowfy_subscriptions_user").on(table.userId),
  index("IDX_lowfy_subscriptions_email").on(table.buyerEmail),
  index("IDX_lowfy_subscriptions_status").on(table.status),
  index("IDX_lowfy_subscriptions_provider_sub").on(table.providerSubscriptionId),
  index("IDX_lowfy_subscriptions_provider_tx").on(table.providerTransactionId),
  index("IDX_lowfy_subscriptions_activation_token").on(table.activationToken),
]);

// Lowfy Subscription Payment History (for tracking all payments)
export const lowfySubscriptionPayments = pgTable("lowfy_subscription_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => lowfySubscriptions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: varchar("provider").notNull(), // 'asaas' or 'podpay'
  providerPaymentId: varchar("provider_payment_id"),
  status: varchar("status").notNull(), // 'paid', 'pending', 'failed', 'refunded'
  amount: integer("amount").notNull(), // in cents
  paymentMethod: varchar("payment_method").notNull(), // 'credit_card' or 'pix'
  billingPeriod: integer("billing_period").default(1),
  cardBrand: varchar("card_brand"),
  cardLast4: varchar("card_last4"),
  pixQrCode: text("pix_qr_code"),
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_subscription_payments_subscription").on(table.subscriptionId),
  index("IDX_subscription_payments_user").on(table.userId),
  index("IDX_subscription_payments_status").on(table.status),
]);

// Webhook logs for debugging
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  event: varchar("event").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").default(false),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories for PLRs and Forum
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Languages
export const languages = pgTable("languages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  code: varchar("code", { length: 5 }).notNull().unique(),
  flagEmoji: varchar("flag_emoji", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// PLR Tags
export const plrTags = pgTable("plr_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  slug: varchar("slug").notNull().unique(),
  color: varchar("color").default("gray"),
  createdAt: timestamp("created_at").defaultNow(),
});

// PLRs
export const plrs = pgTable("plrs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  coverImageUrl: varchar("cover_image_url").notNull(),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: "set null" }),
  countryCode: varchar("country_code", { length: 2 }).default("BR"),
  price: integer("price_cents").default(0), // Price in cents
  isFree: boolean("is_free").default(true),
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  baseLikes: integer("base_likes").default(0), // Base fake likes count (initial engagement)
  extraLinks: jsonb("extra_links").$type<{ title: string; url: string }[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_plrs_category").on(table.categoryId),
  index("IDX_plrs_active").on(table.isActive),
  index("IDX_plrs_title").on(table.title),
]);

// PLR Downloads (arquivos disponíveis)
export const plrDownloads = pgTable("plr_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plrId: varchar("plr_id").references(() => plrs.id).notNull(),
  type: varchar("type").notNull(), // capa, ebook, vsl, criativos, quiz, landingpage
  languageId: varchar("language_id").references(() => languages.id).notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// PLR Tag Relations (many-to-many)
export const plrTagRelations = pgTable("plr_tag_relations", {
  plrId: varchar("plr_id").references(() => plrs.id).notNull(),
  tagId: varchar("tag_id").references(() => plrTags.id).notNull(),
}, (table) => ({
  pk: {
    name: 'plr_tag_relations_pk',
    columns: [table.plrId, table.tagId]
  }
}));

// PLR Likes
export const plrLikes = pgTable("plr_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plrId: varchar("plr_id").references(() => plrs.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_plr_likes_plr").on(table.plrId),
  index("IDX_plr_likes_user").on(table.userId),
]);

// PLR Purchases
export const plrPurchases = pgTable("plr_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plrId: varchar("plr_id").references(() => plrs.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  status: varchar("status").default("completed"), // completed, refunded
  caktoOrderId: varchar("cakto_order_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_plr_purchases_user").on(table.userId),
  index("IDX_plr_purchases_plr").on(table.plrId),
]);

// Services
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  benefits: jsonb("benefits").$type<string[]>(),
  imageUrl: text("image_url"),
  serviceUrl: text("service_url"),
  isActive: boolean("is_active").default(true),
  isPopular: boolean("is_popular").default(false),
  caktoProductId: varchar("cakto_product_id"),
  caktoOfferId: varchar("cakto_offer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Courses
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category"),
  duration: varchar("duration"),
  lessonCount: integer("lesson_count"),
  thumbnailUrl: text("thumbnail_url"),
  courseUrl: text("course_url"),
  driveFolderId: varchar("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  sourceType: varchar("source_type").default("url"),
  isActive: boolean("is_active").default(true),
  isNew: boolean("is_new").default(false),
  isPopular: boolean("is_popular").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Tools
export const aiTools = pgTable("ai_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  toolUrl: text("tool_url").notNull(),
  iconType: varchar("icon_type").default("default"),
  category: varchar("category").notNull().default("outros"),
  logoUrl: text("logo_url"),
  videoUrl: text("video_url"),
  instructions: text("instructions"),
  accessCredentials: jsonb("access_credentials").$type<Array<{ label: string; login: string; password: string }>>(),
  isActive: boolean("is_active").default(true),
  isUnderMaintenance: boolean("is_under_maintenance").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Global AI Access Credentials
export const globalAIAccess = pgTable("global_ai_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: varchar("label").notNull(),
  login: varchar("login").notNull(),
  password: varchar("password").notNull(),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quiz Interativo Settings
export const quizInterativoSettings = pgTable("quiz_interativo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  login: varchar("login").notNull(),
  password: varchar("password").notNull(),
  platformUrl: text("platform_url").notNull(),
  videoUrl: text("video_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum Tags
export const forumTags = pgTable("forum_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  slug: varchar("slug").notNull().unique(),
  color: varchar("color").default("gray"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum Topics (improved)
export const forumTopics = pgTable("forum_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  content: text("content").notNull(),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  videoLink: varchar("video_link"),
  attachments: jsonb("attachments"),
  viewCount: integer("view_count").default(0),
  replyCount: integer("reply_count").default(0),
  likeCount: integer("like_count").default(0),
  shareCount: integer("share_count").default(0),
  isSticky: boolean("is_sticky").default(false),
  isClosed: boolean("is_closed").default(false),
  bestAnswerId: varchar("best_answer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_forum_topics_slug").on(table.slug),
]);

// Forum Topic Tags (many-to-many)
export const forumTopicTags = pgTable("forum_topic_tags", {
  topicId: varchar("topic_id").references(() => forumTopics.id).notNull(),
  tagId: varchar("tag_id").references(() => forumTags.id).notNull(),
}, (table) => ({
  pk: {
    name: 'forum_topic_tags_pk',
    columns: [table.topicId, table.tagId]
  }
}));

// Forum Replies (improved)
export const forumReplies = pgTable("forum_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  topicId: varchar("topic_id").notNull().references(() => forumTopics.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  parentCommentId: varchar('parent_comment_id'),
  likeCount: integer("like_count").default(0),
  isAccepted: boolean("is_accepted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum Reaction Types
export const reactionTypes = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'] as const;
export type ReactionType = typeof reactionTypes[number];

// Forum Likes (for topics and replies)
export const forumLikes = pgTable("forum_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  topicId: varchar("topic_id").references(() => forumTopics.id),
  replyId: varchar("reply_id").references(() => forumReplies.id),
  reactionType: varchar("reaction_type").notNull().default('like'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum Topic Shares
export const forumTopicShares = pgTable("forum_topic_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => forumTopics.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sharedWith: varchar("shared_with"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_forum_topic_shares_topic").on(table.topicId),
  index("IDX_forum_topic_shares_user").on(table.userId),
]);

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  actorId: varchar("actor_id").references(() => users.id), // Quem gerou a notificação
  type: varchar("type").notNull(), // reply, like, best_answer, mention, comment, reaction, share, topic_reply
  message: text("message").notNull(),
  relatedTopicId: varchar("related_topic_id").references(() => forumTopics.id),
  relatedReplyId: varchar("related_reply_id").references(() => forumReplies.id),
  relatedPostId: varchar("related_post_id").references(() => timelinePosts.id),
  relatedCommentId: varchar("related_comment_id").references(() => postComments.id),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Follows
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_user_follows_follower").on(table.followerId),
  index("IDX_user_follows_following").on(table.followingId),
]);

// Topic Follows
export const topicFollows = pgTable("topic_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  topicId: varchar("topic_id").references(() => forumTopics.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_topic_follows_user").on(table.userId),
  index("IDX_topic_follows_topic").on(table.topicId),
]);

// Support Tickets
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  userId: varchar("user_id").references(() => users.id),
  email: varchar("email").notNull(),
  name: varchar("name").notNull(),
  attachments: jsonb("attachments").$type<Array<{
    id: string;
    url: string;
    type: 'image' | 'video';
    name: string;
    size: number;
  }>>().default(sql`'[]'::jsonb`),
  status: varchar("status").default("open"), // open, closed, in_progress
  priority: varchar("priority").default("medium"), // low, medium, high
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Points & Gamification
export const userPoints = pgTable("user_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  points: integer("points").default(0),
  level: integer("level").default(1),
  topicsCreated: integer("topics_created").default(0),
  repliesCreated: integer("replies_created").default(0),
  likesReceived: integer("likes_received").default(0),
  bestAnswers: integer("best_answers").default(0),
  postsCreated: integer("posts_created").default(0),
  commentsCreated: integer("comments_created").default(0),
  sharesGiven: integer("shares_given").default(0),
  followersGained: integer("followers_gained").default(0),
  dailyLoginStreak: integer("daily_login_streak").default(0),
  totalLoginDays: integer("total_login_days").default(0),
  lastLoginDate: timestamp("last_login_date"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Badges/Achievements
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  icon: varchar("icon"),
  color: varchar("color").default("gray"),
  requirement: integer("requirement").notNull(),
  type: varchar("type").notNull(), // topics, replies, likes, best_answers, points
  createdAt: timestamp("created_at").defaultNow(),
});

// User Badges
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  badgeId: varchar("badge_id").references(() => badges.id).notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
});

// Daily Activities Definitions
export const dailyActivities = pgTable("daily_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  activityType: varchar("activity_type").notNull(), // login, create_post, comment, like, reply_topic, follow
  requirementCount: integer("requirement_count").default(1),
  xpReward: integer("xp_reward").notNull(),
  icon: varchar("icon").default("Target"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Weekly Challenges Definitions
export const weeklyChallenges = pgTable("weekly_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  challengeType: varchar("challenge_type").notNull(), // posts_count, likes_count, topics_count, connections_count, complete_course
  requirementCount: integer("requirement_count").notNull(),
  xpReward: integer("xp_reward").notNull(),
  rewardType: varchar("reward_type"), // featured_member, badge, xp_multiplier, profile_badge
  rewardValue: text("reward_value"), // JSON or text describing reward
  icon: varchar("icon").default("Trophy"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Daily Progress
export const userDailyProgress = pgTable("user_daily_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  activityId: varchar("activity_id").references(() => dailyActivities.id).notNull(),
  currentProgress: integer("current_progress").default(0),
  isCompleted: boolean("is_completed").default(false),
  isClaimed: boolean("is_claimed").default(false),
  progressDate: timestamp("progress_date").defaultNow(),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
}, (table) => [
  index("IDX_user_daily_progress_user").on(table.userId),
  index("IDX_user_daily_progress_date").on(table.progressDate),
]);

// User Weekly Progress
export const userWeeklyProgress = pgTable("user_weekly_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  challengeId: varchar("challenge_id").references(() => weeklyChallenges.id).notNull(),
  currentProgress: integer("current_progress").default(0),
  isCompleted: boolean("is_completed").default(false),
  isClaimed: boolean("is_claimed").default(false),
  weekStartDate: timestamp("week_start_date").notNull(),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
}, (table) => [
  index("IDX_user_weekly_progress_user").on(table.userId),
  index("IDX_user_weekly_progress_week").on(table.weekStartDate),
]);

// User Rewards (Active rewards like featured status, XP multipliers, etc)
export const userRewards = pgTable("user_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rewardType: varchar("reward_type").notNull(), // featured_member, xp_multiplier, profile_border, weekly_champion
  rewardValue: text("reward_value"), // JSON with reward details
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_user_rewards_user").on(table.userId),
  index("IDX_user_rewards_active").on(table.isActive),
]);

// Featured Members (Weekly highlights)
export const featuredMembers = pgTable("featured_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reason: varchar("reason"), // top_contributor, weekly_champion, most_helpful
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  pointsEarned: integer("points_earned").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_featured_members_week").on(table.weekStartDate),
  index("IDX_featured_members_active").on(table.isActive),
]);

// Marketplace Products
export const marketplaceProducts = pgTable("marketplace_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  title: varchar("title").notNull(),
  slug: varchar("slug").notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(), // in cents
  category: varchar("category"),
  images: jsonb("images").$type<string[]>(),
  productUrl: text("product_url"), // URL do produto digital
  isDigital: boolean("is_digital").default(true),
  isActive: boolean("is_active").default(true),
  isBlocked: boolean("is_blocked").default(false),
  blockReason: text("block_reason"),
  blockedAt: timestamp("blocked_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete timestamp
  deletedReason: text("deleted_reason"), // Reason for deletion by admin
  salesCount: integer("sales_count").default(0),
  rating: integer("rating").default(0), // 0-5 scale * 10 (50 = 5.0 stars)
  reviewCount: integer("review_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_marketplace_products_slug").on(table.slug),
  index("IDX_marketplace_products_seller").on(table.sellerId),
  index("IDX_marketplace_products_active").on(table.isActive),
  index("IDX_marketplace_products_blocked").on(table.isBlocked),
]);

// Marketplace Orders
export const marketplaceOrders = pgTable("marketplace_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: integer("order_number").notNull().unique(),
  buyerId: varchar("buyer_id").references(() => users.id).notNull(),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => marketplaceProducts.id).notNull(),
  amount: integer("amount").notNull(), // Total amount paid by buyer (deprecated, use grossAmountCents)
  originalPriceCents: integer("original_price_cents"), // Pre\u00e7o original do produto (antes de descontos)
  discountCents: integer("discount_cents").default(0), // Desconto aplicado (cupom, promo\u00e7\u00e3o, etc)
  grossAmountCents: integer("gross_amount_cents"), // Total paid by buyer (ap\u00f3s desconto)
  systemFixedFeeCents: integer("system_fixed_fee_cents").default(0), // Fixed fee (R$ 2,49)
  systemPercentFeeCents: integer("system_percent_fee_cents").default(0), // Percentage fee (9.99%)
  systemFeeCents: integer("system_fee_cents").default(0), // Total system fee
  netAmountCents: integer("net_amount_cents"), // Amount seller receives (gross - system fee)
  status: varchar("status").default("pending"), // pending, completed, refunded, refund_requested, cancelled
  paymentMethod: varchar("payment_method"), // pix, card
  podpayTransactionId: varchar("podpay_transaction_id"),
  asaasTransactionId: varchar("asaas_transaction_id"),
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  refundRequestedAt: timestamp("refund_requested_at"),
  refundCompletedAt: timestamp("refund_completed_at"),
  refundReason: text("refund_reason"),
  caktoOrderId: varchar("cakto_order_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_marketplace_orders_number").on(table.orderNumber),
  index("IDX_marketplace_orders_buyer").on(table.buyerId),
  index("IDX_marketplace_orders_seller").on(table.sellerId),
  index("IDX_marketplace_orders_status").on(table.status),
]);

// Seller Wallet & Transactions (Controle financeiro do vendedor)
export const sellerWallet = pgTable("seller_wallet", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull().unique(),
  balancePending: integer("balance_pending").default(0), // Saldo bloqueado (8 dias)
  balanceAvailable: integer("balance_available").default(0), // Saldo disponível para saque
  totalEarned: integer("total_earned").default(0), // Total ganho (histórico)
  totalWithdrawn: integer("total_withdrawn").default(0), // Total sacado
  pixKey: varchar("pix_key"),
  pixKeyType: varchar("pix_key_type"), // cpf, cnpj, email, phone, random
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Seller Transactions (Histórico de transações)
export const sellerTransactions = pgTable("seller_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // sale, refund, withdrawal
  amount: integer("amount").notNull(), // in cents (deprecated, use grossAmountCents)
  originalPriceCents: integer("original_price_cents"), // Pre\u00e7o original (para auditoria)
  discountCents: integer("discount_cents").default(0), // Desconto aplicado
  grossAmountCents: integer("gross_amount_cents"), // Total amount before fees (ap\u00f3s desconto)
  systemFixedFeeCents: integer("system_fixed_fee_cents").default(0), // Fixed fee (R$ 2,49) for sales
  systemPercentFeeCents: integer("system_percent_fee_cents").default(0), // Percentage fee (9.99%) for sales
  systemFeeCents: integer("system_fee_cents").default(0), // Total system fee
  withdrawalFeeCents: integer("withdrawal_fee_cents").default(0), // Withdrawal fee (R$ 2,49) for withdrawals
  netAmountCents: integer("net_amount_cents"), // Final amount after all fees
  orderId: varchar("order_id").references(() => marketplaceOrders.id),
  status: varchar("status").default("pending"), // pending, completed, failed
  description: text("description"),
  releasedAt: timestamp("released_at"), // Quando o saldo foi liberado (8 dias após venda)
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_seller_transactions_seller").on(table.sellerId),
  index("IDX_seller_transactions_type").on(table.type),
  index("IDX_seller_transactions_released").on(table.releasedAt),
]);

// Podpay Transactions (PIX Payments)
export const podpayTransactions = pgTable("podpay_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => marketplaceOrders.id),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  buyerId: varchar("buyer_id").references(() => users.id).notNull(),
  amountCents: integer("amount_cents").notNull(),
  podpayTransactionId: varchar("podpay_transaction_id"),
  status: varchar("status").default("pending"), // pending, paid, expired, failed
  qrCodeData: text("qr_code_data"), // QR Code payload
  qrCodeImage: text("qr_code_image"), // QR Code image URL/base64
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_podpay_transactions_order").on(table.orderId),
  index("IDX_podpay_transactions_seller").on(table.sellerId),
]);

// Withdrawals (Saques) - Suporta Podpay e Asaas
export const podpayWithdrawals = pgTable("podpay_withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  source: varchar("source").default("marketplace"), // marketplace, referral
  amountCents: integer("amount_cents").notNull(),
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  pixKey: varchar("pix_key").notNull(),
  pixKeyType: varchar("pix_key_type").notNull(),
  provider: varchar("provider").default("podpay"), // podpay, asaas
  podpayTransferId: varchar("podpay_transfer_id"),
  asaasTransferId: varchar("asaas_transfer_id"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  initiatedAt: timestamp("initiated_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_podpay_withdrawals_seller").on(table.sellerId),
  index("IDX_podpay_withdrawals_status").on(table.status),
  index("IDX_podpay_withdrawals_source").on(table.source),
  index("IDX_podpay_withdrawals_provider").on(table.provider),
]);

// Appmax Transactions (Card Payments)
export const appmaxTransactions = pgTable("appmax_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => marketplaceOrders.id),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  buyerId: varchar("buyer_id").references(() => users.id).notNull(),
  amountCents: integer("amount_cents").notNull(),
  appmaxTransactionId: varchar("appmax_transaction_id"),
  status: varchar("status").default("pending"), // pending, approved, declined, refunded, cancelled
  installments: integer("installments").default(1),
  authorizationCode: varchar("authorization_code"),
  cardBrand: varchar("card_brand"),
  cardLastDigits: varchar("card_last_digits"),
  paidAt: timestamp("paid_at"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_appmax_transactions_order").on(table.orderId),
  index("IDX_appmax_transactions_seller").on(table.sellerId),
]);

// Product Reviews
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => marketplaceProducts.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").references(() => marketplaceOrders.id),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shopping Cart Items
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => marketplaceProducts.id).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_cart_items_user").on(table.userId),
  index("IDX_cart_items_product").on(table.productId),
]);

// Timeline/Social Feed
export const timelinePosts = pgTable("timeline_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  media: jsonb("media").$type<{type: 'image' | 'video' | 'document', url: string, name?: string, size?: number}[]>(),
  videoLink: varchar("video_link"), // Link do YouTube, Vimeo, etc.
  linkPreview: jsonb("link_preview").$type<{url: string, title?: string, description?: string, image?: string}>(), // Preview de links externos
  sharedPostId: varchar("shared_post_id").references(() => timelinePosts.id), // Reference to original post if this is a share
  likeCount: integer("like_count").default(0),
  dislikeCount: integer("dislike_count").default(0),
  commentCount: integer("comment_count").default(0),
  shareCount: integer("share_count").default(0),
  viewCount: integer("view_count").default(0),
  engagementRate: integer("engagement_rate").default(0), // percentage * 100
  isPinned: boolean("is_pinned").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_timeline_posts_user").on(table.userId),
  index("IDX_timeline_posts_created").on(table.createdAt),
]);

export const postReactions = pgTable("post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => timelinePosts.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").default("like"), // like, love, celebrate, support, insightful
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_post_reactions_post").on(table.postId),
  index("IDX_post_reactions_user").on(table.userId),
]);

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => timelinePosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  parentCommentId: varchar("parent_comment_id"),
  likeCount: integer("like_count").default(0),
  replyCount: integer("reply_count").default(0),
  isPinned: boolean("is_pinned").default(false),
  isBestAnswer: boolean("is_best_answer").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_post_comments_post").on(table.postId),
  index("IDX_post_comments_user").on(table.userId),
]);

export const commentLikes = pgTable("comment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").references(() => postComments.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_comment_likes_comment").on(table.commentId),
  index("IDX_comment_likes_user").on(table.userId),
]);

export const postShares = pgTable("post_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => timelinePosts.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sharedWith: varchar("shared_with"), // 'public', 'connections', or specific user id
  comment: text("comment"), // Optional comment when sharing
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_post_shares_post").on(table.postId),
  index("IDX_post_shares_user").on(table.userId),
]);

export const timelineTags = pgTable("timeline_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  slug: varchar("slug").notNull().unique(),
  postCount: integer("post_count").default(0),
  trendingScore: integer("trending_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postTagRelations = pgTable("post_tag_relations", {
  postId: varchar("post_id").references(() => timelinePosts.id).notNull(),
  tagId: varchar("tag_id").references(() => timelineTags.id).notNull(),
}, (table) => ({
  pk: {
    name: 'post_tag_relations_pk',
    columns: [table.postId, table.tagId]
  }
}));

export const userConnections = pgTable("user_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  connectedUserId: varchar("connected_user_id").references(() => users.id).notNull(),
  status: varchar("status").default("pending"), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
}, (table) => [
  index("IDX_user_connections_user").on(table.userId),
  index("IDX_user_connections_connected").on(table.connectedUserId),
]);

// Post Reports/Denúncias
export const postReports = pgTable("post_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => timelinePosts.id).notNull(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  reason: varchar("reason").notNull(), // spam, harassment, inappropriate, misinformation, other
  description: text("description"),
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
}, (table) => [
  index("IDX_post_reports_post").on(table.postId),
  index("IDX_post_reports_reporter").on(table.reporterId),
]);

// Comment Reports/Denúncias de Comentários
export const commentReports = pgTable("comment_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").references(() => postComments.id).notNull(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  reason: varchar("reason").notNull(), // spam, harassment, inappropriate, misinformation, other
  description: text("description"),
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
}, (table) => [
  index("IDX_comment_reports_comment").on(table.commentId),
  index("IDX_comment_reports_reporter").on(table.reporterId),
]);

// Forum Topic Reports/Denúncias de Tópicos do Fórum
export const forumTopicReports = pgTable("forum_topic_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").references(() => forumTopics.id).notNull(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  reason: varchar("reason").notNull(), // spam, harassment, inappropriate, misinformation, other
  description: text("description"),
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
}, (table) => [
  index("IDX_forum_topic_reports_topic").on(table.topicId),
  index("IDX_forum_topic_reports_reporter").on(table.reporterId),
]);

// Forum Reply Reports/Denúncias de Respostas do Fórum
export const forumReplyReports = pgTable("forum_reply_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  replyId: varchar("reply_id").references(() => forumReplies.id).notNull(),
  reporterId: varchar("reporter_id").references(() => users.id).notNull(),
  reason: varchar("reason").notNull(), // spam, harassment, inappropriate, misinformation, other
  description: text("description"),
  status: varchar("status").default("pending"), // pending, reviewed, resolved, dismissed
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
}, (table) => [
  index("IDX_forum_reply_reports_reply").on(table.replyId),
  index("IDX_forum_reply_reports_reporter").on(table.reporterId),
]);

// ============================================
// TABELAS DE NOTIFICAÇÕES
// ============================================

// Relations
export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(caktoOrders),
  subscriptions: many(caktoSubscriptions),
  forumTopics: many(forumTopics),
  forumReplies: many(forumReplies),
  notifications: many(notifications)
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const plrRelations = relations(plrs, ({ one, many }) => ({
  category: one(categories, {
    fields: [plrs.categoryId],
    references: [categories.id],
  }),
  downloads: many(plrDownloads),
  tags: many(plrTagRelations),
  likes: many(plrLikes),
}));

export const plrDownloadRelations = relations(plrDownloads, ({ one }) => ({
  plr: one(plrs, {
    fields: [plrDownloads.plrId],
    references: [plrs.id],
  }),
  language: one(languages, {
    fields: [plrDownloads.languageId],
    references: [languages.id],
  }),
}));

export const plrTagRelations2 = relations(plrTags, ({ many }) => ({
  plrs: many(plrTagRelations),
}));

export const forumTopicRelations = relations(forumTopics, ({ one, many }) => ({
  author: one(users, {
    fields: [forumTopics.authorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [forumTopics.categoryId],
    references: [categories.id],
  }),
  replies: many(forumReplies),
  likes: many(forumLikes),
  tags: many(forumTopicTags),
}));

export const forumReplyRelations = relations(forumReplies, ({ one, many }) => ({
  author: one(users, {
    fields: [forumReplies.authorId],
    references: [users.id],
  }),
  topic: one(forumTopics, {
    fields: [forumReplies.topicId],
    references: [forumTopics.id],
  }),
  likes: many(forumLikes),
}));

export const forumTagRelations = relations(forumTags, ({ many }) => ({
  topics: many(forumTopicTags),
}));

export const supportTicketRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  accountStatus: true,
  subscriptionStatus: true,
  phoneVerified: true,
  phoneVerifiedAt: true,
}).extend({
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  phone: z.string().min(10).refine(
    (val) => /^\d{10,11}$/.test(val.replace(/\D/g, '')),
    { message: "Telefone inválido. Use DDD + número (ex: 11999999999)" }
  ),
  cpf: z.string().min(11).refine(
    (val) => val.replace(/\D/g, '').length === 11,
    { message: "CPF deve ter 11 dígitos" }
  ),
});

export const sendPhoneVerificationSchema = z.object({
  userId: z.string().uuid(),
  phone: z.string().min(10).refine(
    (val) => /^\d{10,11}$/.test(val.replace(/\D/g, '')),
    { message: "Telefone inválido" }
  ),
});

export const verifyPhoneCodeSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, "Código deve ter 6 dígitos"),
});

export const insertPhoneVerificationSchema = createInsertSchema(phoneVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email ou usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertLanguageSchema = createInsertSchema(languages).omit({
  id: true,
  createdAt: true,
});

export const insertPLRSchema = createInsertSchema(plrs, {
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  categoryId: z.string().uuid().optional(),
  countryCode: z.string().length(2).optional(),
  price: z.number().min(0).optional(),
  isFree: z.boolean().optional(),
  isActive: z.boolean().optional(),
  extraLinks: z.array(z.object({
    title: z.string().min(1, 'Título do link é obrigatório'),
    url: z.string().min(1, 'URL é obrigatória').url('URL inválida - deve começar com http:// ou https://')
  })).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true, likeCount: true });

export const insertPLRTagSchema = createInsertSchema(plrTags).omit({
  id: true,
  createdAt: true,
});

export const insertPLRDownloadSchema = createInsertSchema(plrDownloads).omit({
  id: true,
  createdAt: true,
});

export const insertPLRPurchaseSchema = createInsertSchema(plrPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  imageUrl: true,
  serviceUrl: true,
}).extend({
  imageUrl: z.string().or(z.literal('')).nullable().optional(),
  serviceUrl: z.string().url().or(z.literal('')).nullable().optional(),
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAIToolSchema = createInsertSchema(aiTools).pick({
  name: true,
  description: true,
  toolUrl: true,
  iconType: true,
  category: true,
  logoUrl: true,
  videoUrl: true,
  instructions: true,
  accessCredentials: true,
  isActive: true,
  isUnderMaintenance: true,
});

export const insertGlobalAIAccessSchema = createInsertSchema(globalAIAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuizInterativoSettingsSchema = createInsertSchema(quizInterativoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForumTagSchema = createInsertSchema(forumTags).omit({
  id: true,
  createdAt: true,
});

export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({
  id: true,
  viewCount: true,
  replyCount: true,
  likeCount: true,
  shareCount: true,
  createdAt: true,
  updatedAt: true,
  bestAnswerId: true,
}).extend({
  tags: z.array(z.string()).optional(),
});

export const insertForumTopicShareSchema = createInsertSchema(forumTopicShares).omit({
  id: true,
  createdAt: true,
});

export const insertForumReplySchema = createInsertSchema(forumReplies).omit({
  id: true,
  likeCount: true,
  isAccepted: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertUserFollowSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
});

export const insertTopicFollowSchema = createInsertSchema(topicFollows).omit({
  id: true,
  createdAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertMarketplaceProductSchema = createInsertSchema(marketplaceProducts).omit({
  id: true,
  sellerId: true,
  slug: true,
  isBlocked: true,
  blockReason: true,
  blockedAt: true,
  salesCount: true,
  rating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarketplaceOrderSchema = createInsertSchema(marketplaceOrders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSellerWalletSchema = createInsertSchema(sellerWallet).omit({
  id: true,
  updatedAt: true,
});

export const insertSellerTransactionSchema = createInsertSchema(sellerTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  createdAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Podpay Transaction Schema
export const insertPodpayTransactionSchema = createInsertSchema(podpayTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Appmax Transaction Schema
export const insertAppmaxTransactionSchema = createInsertSchema(appmaxTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Podpay Withdrawal Schema
export const insertPodpayWithdrawalSchema = createInsertSchema(podpayWithdrawals).omit({
  id: true,
  createdAt: true,
});

// PIX Key Validation Schema
export const pixKeySchema = z.object({
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  pixKeyType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random'], {
    errorMap: () => ({ message: "Tipo de chave PIX inválido" })
  }),
}).superRefine((data, ctx) => {
  const { pixKey, pixKeyType } = data;

  if (pixKeyType === 'cpf') {
    // Remove non-numeric characters
    const cleaned = pixKey.replace(/\D/g, '');
    if (cleaned.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF deve conter 11 dígitos",
        path: ['pixKey']
      });
    }
  } else if (pixKeyType === 'cnpj') {
    const cleaned = pixKey.replace(/\D/g, '');
    if (cleaned.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CNPJ deve conter 14 dígitos",
        path: ['pixKey']
      });
    }
  } else if (pixKeyType === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(pixKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email inválido",
        path: ['pixKey']
      });
    }
  } else if (pixKeyType === 'phone') {
    const cleaned = pixKey.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone deve conter 10 ou 11 dígitos",
        path: ['pixKey']
      });
    }
  } else if (pixKeyType === 'random') {
    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pixKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chave aleatória deve ser um UUID válido",
        path: ['pixKey']
      });
    }
  }
});

// Withdrawal Request Schema
export const withdrawalRequestSchema = z.object({
  amountCents: z.number().int().min(1000, "Valor mínimo para saque é R$ 10,00"),
});

export const insertTimelinePostSchema = createInsertSchema(timelinePosts).omit({
  id: true,
  likeCount: true,
  commentCount: true,
  shareCount: true,
  viewCount: true,
  engagementRate: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tags: z.array(z.string()).optional(),
});

export const insertPostReactionSchema = createInsertSchema(postReactions).omit({
  id: true,
  createdAt: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  likeCount: true,
  replyCount: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentLikeSchema = createInsertSchema(commentLikes).omit({
  id: true,
  createdAt: true,
});

export const insertPostShareSchema = createInsertSchema(postShares).omit({
  id: true,
  createdAt: true,
});

export const insertTimelineTagSchema = createInsertSchema(timelineTags).omit({
  id: true,
  postCount: true,
  trendingScore: true,
  createdAt: true,
});

export const insertUserConnectionSchema = createInsertSchema(userConnections).omit({
  id: true,
  status: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertDailyActivitySchema = createInsertSchema(dailyActivities).omit({
  id: true,
  createdAt: true,
});

export const insertUserDailyProgressSchema = createInsertSchema(userDailyProgress).omit({
  id: true,
  progressDate: true,
  completedAt: true,
  claimedAt: true,
});

export const insertWeeklyChallengeSchema = createInsertSchema(weeklyChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertUserWeeklyProgressSchema = createInsertSchema(userWeeklyProgress).omit({
  id: true,
  completedAt: true,
  claimedAt: true,
});

export const insertUserRewardSchema = createInsertSchema(userRewards).omit({
  id: true,
  createdAt: true,
});

export const insertFeaturedMemberSchema = createInsertSchema(featuredMembers).omit({
  id: true,
  createdAt: true,
});

export const insertPostReportSchema = createInsertSchema(postReports).omit({
  id: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertForumTopicReportSchema = createInsertSchema(forumTopicReports).omit({
  id: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertForumReplyReportSchema = createInsertSchema(forumReplyReports).omit({
  id: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
});

// Cloned Pages
export const clonedPages = pgTable("cloned_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pageName: varchar("page_name").notNull(),
  slug: varchar("slug").notNull().unique(), // URL-friendly unique identifier
  htmlContent: text("html_content").notNull(),
  originalUrl: text("original_url"),
  pixelCode: text("pixel_code"), // Tracking pixel configuration
  modalConfig: jsonb("modal_config").$type<{
    enabled: boolean;
    title?: string;
    content?: string;
    buttonText?: string;
    delay?: number;
  }>(),
  customDomain: varchar("custom_domain"), // Domínio customizado do usuário
  domainAddedAt: timestamp("domain_added_at"), // Quando o domínio foi adicionado
  requiresDomain: boolean("requires_domain").default(false), // Se é página duplicada que requer domínio
  deactivatedAt: timestamp("deactivated_at"), // Quando foi desativada por falta de domínio
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_cloned_pages_user").on(table.userId),
  index("IDX_cloned_pages_slug").on(table.slug),
]);

export const insertClonedPageSchema = createInsertSchema(clonedPages).omit({
  id: true,
  viewCount: true,
  domainAddedAt: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
});

// OpenAI Token Usage
export const openaiTokenUsage = pgTable("openai_token_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Can be null for internal processes
  model: varchar("model").notNull(), // e.g., "gpt-3.5-turbo", "gpt-4", "dall-e-3"
  operation: varchar("operation").notNull(), // e.g., "andromeda_campaign", "ai_chat", "image_generation"
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0), // Cost in USD
  costBrl: real("cost_brl").notNull().default(0), // Cost in BRL
  exchangeRate: real("exchange_rate").notNull().default(5.0), // USD to BRL exchange rate used
  usageDate: timestamp("usage_date").defaultNow(),
}, (table) => [
  index("IDX_openai_token_usage_user").on(table.userId),
  index("IDX_openai_token_usage_date").on(table.usageDate),
  index("IDX_openai_token_usage_operation").on(table.operation),
]);

export const insertOpenAITokenUsageSchema = createInsertSchema(openaiTokenUsage).omit({
  id: true,
  usageDate: true,
});

export type OpenAITokenUsage = typeof openaiTokenUsage.$inferSelect;
export type InsertOpenAITokenUsage = z.infer<typeof insertOpenAITokenUsageSchema>;

// N8N Automations
export const n8nAutomations = pgTable("n8n_automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  titleEn: varchar("title_en").notNull(), // Título original em inglês
  description: text("description").notNull(),
  descriptionEn: text("description_en").notNull(), // Descrição original em inglês
  category: varchar("category").notNull(),
  categoryEn: varchar("category_en").notNull(), // Categoria original em inglês
  department: varchar("department"),
  templateUrl: text("template_url").notNull(),
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertN8nAutomationSchema = createInsertSchema(n8nAutomations).omit({
  id: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type N8nAutomation = typeof n8nAutomations.$inferSelect;
export type InsertN8nAutomation = z.infer<typeof insertN8nAutomationSchema>;

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type InsertPhoneVerification = z.infer<typeof insertPhoneVerificationSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type CaktoOrder = typeof caktoOrders.$inferSelect;
export type CaktoSubscription = typeof caktoSubscriptions.$inferSelect;
export type LowfySubscription = typeof lowfySubscriptions.$inferSelect;
export type InsertLowfySubscription = typeof lowfySubscriptions.$inferInsert;
export type LowfySubscriptionPayment = typeof lowfySubscriptionPayments.$inferSelect;
export type InsertLowfySubscriptionPayment = typeof lowfySubscriptionPayments.$inferInsert;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Language = typeof languages.$inferSelect;
export type PLR = typeof plrs.$inferSelect;
export type PLRTag = typeof plrTags.$inferSelect;
export type PLRDownload = typeof plrDownloads.$inferSelect;
export type PLRLike = typeof plrLikes.$inferSelect;
export type PLRPurchase = typeof plrPurchases.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type AITool = typeof aiTools.$inferSelect;
export type GlobalAIAccess = typeof globalAIAccess.$inferSelect;
export type QuizInterativoSettings = typeof quizInterativoSettings.$inferSelect;
export type ForumTag = typeof forumTags.$inferSelect;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type ForumReply = typeof forumReplies.$inferSelect;
export type ForumLike = typeof forumLikes.$inferSelect;
export type ForumTopicShare = typeof forumTopicShares.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type TopicFollow = typeof topicFollows.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertLanguage = z.infer<typeof insertLanguageSchema>;
export type InsertPLR = z.infer<typeof insertPLRSchema>;
export type InsertPLRTag = z.infer<typeof insertPLRTagSchema>;
export type InsertPLRDownload = z.infer<typeof insertPLRDownloadSchema>;
export type InsertPLRPurchase = z.infer<typeof insertPLRPurchaseSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertAITool = z.infer<typeof insertAIToolSchema>;
export type InsertGlobalAIAccess = z.infer<typeof insertGlobalAIAccessSchema>;
export type InsertQuizInterativoSettings = z.infer<typeof insertQuizInterativoSettingsSchema>;
export type InsertForumTag = z.infer<typeof insertForumTagSchema>;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type InsertForumTopicShare = z.infer<typeof insertForumTopicShareSchema>;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;
export type InsertTopicFollow = z.infer<typeof insertTopicFollowSchema>;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type InsertMarketplaceProduct = z.infer<typeof insertMarketplaceProductSchema>;
export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type InsertTimelinePost = z.infer<typeof insertTimelinePostSchema>;
export type InsertPostReaction = z.infer<typeof insertPostReactionSchema>;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type InsertCommentLike = z.infer<typeof insertCommentLikeSchema>;
export type InsertPostShare = z.infer<typeof insertPostShareSchema>;
export type InsertTimelineTag = z.infer<typeof insertTimelineTagSchema>;
export type InsertUserConnection = z.infer<typeof insertUserConnectionSchema>;

export type UserPoints = typeof userPoints.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type DailyActivity = typeof dailyActivities.$inferSelect;
export type WeeklyChallenge = typeof weeklyChallenges.$inferSelect;
export type UserDailyProgress = typeof userDailyProgress.$inferSelect;
export type UserWeeklyProgress = typeof userWeeklyProgress.$inferSelect;
export type UserReward = typeof userRewards.$inferSelect;
export type FeaturedMember = typeof featuredMembers.$inferSelect;
export type MarketplaceProduct = typeof marketplaceProducts.$inferSelect;
export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type SellerWallet = typeof sellerWallet.$inferSelect;
export type SellerTransaction = typeof sellerTransactions.$inferSelect;
export type PodpayTransaction = typeof podpayTransactions.$inferSelect;
export type PodpayWithdrawal = typeof podpayWithdrawals.$inferSelect;
export type AppmaxTransaction = typeof appmaxTransactions.$inferSelect;
export type ProductReview = typeof productReviews.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type TimelinePost = typeof timelinePosts.$inferSelect;
export type PostReaction = typeof postReactions.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type PostShare = typeof postShares.$inferSelect;
export type TimelineTag = typeof timelineTags.$inferSelect;
export type UserConnection = typeof userConnections.$inferSelect;
export type PostReport = typeof postReports.$inferSelect;
export type ClonedPage = typeof clonedPages.$inferSelect;
export type InsertClonedPage = z.infer<typeof insertClonedPageSchema>;
export type InsertDailyActivity = z.infer<typeof insertDailyActivitySchema>;
export type InsertUserDailyProgress = z.infer<typeof insertUserDailyProgressSchema>;
export type InsertWeeklyChallenge = z.infer<typeof insertWeeklyChallengeSchema>;
export type InsertUserWeeklyProgress = z.infer<typeof insertUserWeeklyProgressSchema>;
export type InsertUserReward = z.infer<typeof insertUserRewardSchema>;
export type InsertFeaturedMember = z.infer<typeof insertFeaturedMemberSchema>;
export type InsertPostReport = z.infer<typeof insertPostReportSchema>;
export type ForumTopicReport = typeof forumTopicReports.$inferSelect;
export type InsertForumTopicReport = z.infer<typeof insertForumTopicReportSchema>;
export type ForumReplyReport = typeof forumReplyReports.$inferSelect;
export type InsertForumReplyReport = z.infer<typeof insertForumReplyReportSchema>;
export type OpenAITokenUsage = typeof openaiTokenUsage.$inferSelect;
export type InsertOpenAITokenUsage = z.infer<typeof insertOpenAITokenUsageSchema>;

// Extended types for relations
export type PLRDownloadWithLanguage = PLRDownload & {
  language?: Language;
};

export type PLRWithRelations = PLR & {
  category?: Category;
  downloads?: PLRDownloadWithLanguage[];
  tags?: PLRTag[];
  hasLiked?: boolean;
  hasPurchased?: boolean;
};

export type ForumTopicWithRelations = ForumTopic & {
  author?: User;
  category?: Category;
  replies?: ForumReplyWithRelations[];
  likeCount?: number;
  tags?: ForumTag[];
  hasLiked?: boolean;
};

export type ForumReplyWithRelations = ForumReply & {
  author?: User;
  hasLiked?: boolean;
};

export type SupportTicketWithRelations = SupportTicket & {
  user?: User;
};

export type UserWithStats = User & {
  points?: UserPoints;
  badges?: Badge[];
};

export type MarketplaceProductWithRelations = MarketplaceProduct & {
  seller?: User;
  reviews?: ProductReview[];
};

export type MarketplaceOrderWithRelations = MarketplaceOrder & {
  buyer?: User;
  seller?: User;
  product?: MarketplaceProduct;
  canRefund?: boolean; // Calculado: está dentro de 7 dias?
};

export type CartItemWithProduct = CartItem & {
  product?: MarketplaceProduct;
  seller?: User;
};

export type TimelinePostWithRelations = TimelinePost & {
  author?: UserPublic;
  comments?: (PostComment & { author?: UserPublic })[];
  reactions?: PostReaction[];
  tags?: TimelineTag[];
  hasReacted?: boolean;
  reactionType?: string;
};

export type UserPublic = Omit<User, 'passwordHash' | 'caktoCustomerId'>;

// ==================== SISTEMA DE AFILIADOS/INDICAÇÃO ====================

// Referral Codes - Código de indicação único por usuário
export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  code: varchar("code").notNull().unique(), // Slug personalizado (ex: "joao-silva" ou "js2024")
  clicks: integer("clicks").default(0), // Total de cliques no link
  conversions: integer("conversions").default(0), // Total de conversões (assinaturas)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_referral_codes_user").on(table.userId),
  index("IDX_referral_codes_code").on(table.code),
]);

// Referral Clicks - Rastreamento de cliques (para analytics)
export const referralClicks = pgTable("referral_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralCodeId: varchar("referral_code_id").references(() => referralCodes.id).notNull(),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(), // Quem indicou
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  converted: boolean("converted").default(false), // Se resultou em conversão
  convertedUserId: varchar("converted_user_id").references(() => users.id), // ID do usuário que assinou
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_referral_clicks_code").on(table.referralCodeId),
  index("IDX_referral_clicks_referrer").on(table.referrerId),
]);

// Referral Commissions - Comissões geradas (50% recorrente)
export const referralCommissions = pgTable("referral_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").references(() => users.id).notNull(), // Quem indicou
  referredUserId: varchar("referred_user_id").references(() => users.id).notNull(), // Quem foi indicado
  subscriptionId: varchar("subscription_id"), // ID da assinatura Cakto
  caktoOrderId: varchar("cakto_order_id"), // ID do pedido Cakto

  // Valores financeiros
  subscriptionAmountCents: integer("subscription_amount_cents").notNull(), // Valor total da assinatura
  commissionPercentage: integer("commission_percentage").default(50), // 50% de comissão
  commissionAmountCents: integer("commission_amount_cents").notNull(), // Valor da comissão (50%)

  // Status da comissão
  status: varchar("status").default("pending"), // pending, active, canceled, refunded, completed
  type: varchar("type").default("subscription"), // subscription, renewal

  // Metadata adicional (current_period, etc)
  metadata: jsonb("metadata"),

  // Controle de liberação (8 dias igual vendas)
  releasedAt: timestamp("released_at"), // Quando o saldo foi liberado
  canceledAt: timestamp("canceled_at"), // Se a assinatura foi cancelada
  refundedAt: timestamp("refunded_at"), // Se foi reembolsado

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_referral_commissions_referrer").on(table.referrerId),
  index("IDX_referral_commissions_referred").on(table.referredUserId),
  index("IDX_referral_commissions_status").on(table.status),
  index("IDX_referral_commissions_released").on(table.releasedAt),
  index("IDX_referral_commissions_order").on(table.caktoOrderId),
]);

// Referral Wallet - Carteira de comissões do afiliado
export const referralWallet = pgTable("referral_wallet", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  balancePending: integer("balance_pending").default(0), // Saldo bloqueado (8 dias)
  balanceAvailable: integer("balance_available").default(0), // Saldo disponível para saque
  totalEarned: integer("total_earned").default(0), // Total ganho em comissões (lifetime gross - NUNCA subtrair!)
  totalRefunded: integer("total_refunded").default(0), // Total estornado (cancellations/chargebacks)
  totalWithdrawn: integer("total_withdrawn").default(0), // Total sacado
  activeReferrals: integer("active_referrals").default(0), // Assinaturas ativas
  canceledReferrals: integer("canceled_referrals").default(0), // Assinaturas canceladas
  pixKey: varchar("pix_key"), // Chave PIX para saques de comissão
  pixKeyType: varchar("pix_key_type"), // Tipo da chave PIX
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral Transactions - Histórico de transações de comissões
export const referralTransactions = pgTable("referral_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: varchar("type").notNull(), // commission, withdrawal, refund
  amount: integer("amount").notNull(), // in cents
  commissionId: varchar("commission_id").references(() => referralCommissions.id),
  status: varchar("status").default("pending"), // pending, completed, failed
  description: text("description"),
  releasedAt: timestamp("released_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_referral_transactions_user").on(table.userId),
  index("IDX_referral_transactions_type").on(table.type),
]);

// ==================== SUBSCRIPTION REFUND REQUESTS ====================

// Subscription Refund Requests - Solicitações de reembolso de assinaturas Lowfy
export const subscriptionRefundRequests = pgTable("subscription_refund_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => lowfySubscriptions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Dados financeiros
  amountCents: integer("amount_cents").notNull(), // Valor a ser reembolsado
  paymentMethod: varchar("payment_method").notNull(), // 'credit_card' ou 'pix'
  providerPaymentId: varchar("provider_payment_id"), // ID do pagamento no Asaas/PodPay
  
  // Status do reembolso
  status: varchar("status").default("pending"), // pending, processing, completed, rejected
  reason: text("reason"), // Motivo informado pelo usuário
  adminNotes: text("admin_notes"), // Notas do admin
  
  // Controle de processamento
  processedBy: varchar("processed_by").references(() => users.id), // Admin que processou
  processedAt: timestamp("processed_at"), // Quando foi processado
  refundedViaProvider: boolean("refunded_via_provider").default(false), // Se foi via Asaas/PodPay
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_sub_refund_subscription").on(table.subscriptionId),
  index("IDX_sub_refund_user").on(table.userId),
  index("IDX_sub_refund_status").on(table.status),
]);

// Meta Ads Andromeda Campaigns
export const metaAdsCampaigns = pgTable("meta_ads_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),

  // Product Info
  productName: varchar("product_name").notNull(),
  productPrice: real("product_price").notNull(),
  productDescription: text("product_description").notNull(),
  painPoint: text("pain_point").notNull(),

  // Campaign Objective
  objective: varchar("objective").notNull(), // sales, leads, website_visits
  destinationUrl: varchar("destination_url").notNull(),
  hasPixelConfigured: boolean("has_pixel_configured").default(false),

  // Target Audience Basic Info (apenas para os criativos)
  targetAgeRange: varchar("target_age_range"),
  targetGender: varchar("target_gender"),
  targetLocation: varchar("target_location"),

  // Generated Creatives (JSON array with variations)
  // Each creative contains: type, emotion, visualStyle, format, aiPrompt, copy, carouselSlides, videoScript
  creatives: jsonb("creatives"),

  // Strategy Generated by AI
  strategyNotes: text("strategy_notes"),

  // Status
  status: varchar("status").default("draft"), // draft, active, paused, completed

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports
export type MetaAdsCampaign = typeof metaAdsCampaigns.$inferSelect;
export type InsertMetaAdsCampaign = z.infer<typeof insertMetaAdsCampaignSchema>;

// Insert schema
export const insertMetaAdsCampaignSchema = createInsertSchema(metaAdsCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== REFERRAL/AFFILIATE SCHEMAS & TYPES ====================

export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({
  id: true,
  clicks: true,
  conversions: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferralClickSchema = createInsertSchema(referralClicks).omit({
  id: true,
  createdAt: true,
});

export const insertReferralCommissionSchema = createInsertSchema(referralCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferralWalletSchema = createInsertSchema(referralWallet).omit({
  id: true,
  updatedAt: true,
});

export const insertReferralTransactionSchema = createInsertSchema(referralTransactions).omit({
  id: true,
  createdAt: true,
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralClick = typeof referralClicks.$inferSelect;
export type InsertReferralClick = z.infer<typeof insertReferralClickSchema>;
export type ReferralCommission = typeof referralCommissions.$inferSelect;
export type InsertReferralCommission = z.infer<typeof insertReferralCommissionSchema>;
export type ReferralWallet = typeof referralWallet.$inferSelect;
export type InsertReferralWallet = z.infer<typeof insertReferralWalletSchema>;
export type ReferralTransaction = typeof referralTransactions.$inferSelect;
export type InsertReferralTransaction = z.infer<typeof insertReferralTransactionSchema>;

export type ReferralCommissionWithRelations = ReferralCommission & {
  referrer?: User;
  referredUser?: User;
};

// ==================== SUBSCRIPTION REFUND SCHEMAS & TYPES ====================

export const insertSubscriptionRefundRequestSchema = createInsertSchema(subscriptionRefundRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SubscriptionRefundRequest = typeof subscriptionRefundRequests.$inferSelect;
export type InsertSubscriptionRefundRequest = z.infer<typeof insertSubscriptionRefundRequestSchema>;

export type SubscriptionRefundRequestWithRelations = SubscriptionRefundRequest & {
  subscription?: LowfySubscription;
  user?: User;
  processedByUser?: User;
};

// ==================== CHECKOUT RECOVERY EMAILS ====================
// Sistema de recuperação de checkouts abandonados com emails persuasivos

export const checkoutRecoveryEmails = pgTable("checkout_recovery_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => lowfySubscriptions.id).notNull(),
  buyerEmail: varchar("buyer_email").notNull(),
  buyerName: varchar("buyer_name").notNull(),
  plan: varchar("plan").notNull(), // 'mensal' or 'anual'
  originalAmount: integer("original_amount").notNull(), // valor original em centavos
  emailSequence: integer("email_sequence").notNull(), // 1, 2, 3, 4
  emailType: varchar("email_type").notNull(), // '15min', 'morning', 'evening', 'next_day_discount'
  sentAt: timestamp("sent_at"),
  status: varchar("status").default("pending"), // pending, sent, clicked, converted
  discountCode: varchar("discount_code"), // código de desconto para o email 4
  discountPercent: integer("discount_percent"), // 50% para o email 4
  clickedAt: timestamp("clicked_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_checkout_recovery_subscription").on(table.subscriptionId),
  index("IDX_checkout_recovery_email").on(table.buyerEmail),
  index("IDX_checkout_recovery_status").on(table.status),
  index("IDX_checkout_recovery_sequence").on(table.emailSequence),
]);

export const insertCheckoutRecoveryEmailSchema = createInsertSchema(checkoutRecoveryEmails).omit({
  id: true,
  createdAt: true,
});

export type CheckoutRecoveryEmail = typeof checkoutRecoveryEmails.$inferSelect;
export type InsertCheckoutRecoveryEmail = z.infer<typeof insertCheckoutRecoveryEmailSchema>;

// Sistema de recuperação de checkouts abandonados por WhatsApp
export const checkoutRecoveryWhatsapp = pgTable("checkout_recovery_whatsapp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => lowfySubscriptions.id).notNull(),
  buyerPhone: varchar("buyer_phone").notNull(),
  buyerName: varchar("buyer_name").notNull(),
  plan: varchar("plan").notNull(),
  originalAmount: integer("original_amount").notNull(),
  messageSequence: integer("message_sequence").notNull(), // 1, 2, 3
  messageType: varchar("message_type").notNull(), // '30min', '24h', '48h_discount'
  sentAt: timestamp("sent_at"),
  status: varchar("status").default("pending"), // pending, sent, clicked, converted
  discountCode: varchar("discount_code"),
  discountPercent: integer("discount_percent"),
  clickedAt: timestamp("clicked_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_checkout_recovery_whatsapp_subscription").on(table.subscriptionId),
  index("IDX_checkout_recovery_whatsapp_phone").on(table.buyerPhone),
  index("IDX_checkout_recovery_whatsapp_status").on(table.status),
  index("IDX_checkout_recovery_whatsapp_sequence").on(table.messageSequence),
]);

export const insertCheckoutRecoveryWhatsappSchema = createInsertSchema(checkoutRecoveryWhatsapp).omit({
  id: true,
  createdAt: true,
});

export type CheckoutRecoveryWhatsapp = typeof checkoutRecoveryWhatsapp.$inferSelect;
export type InsertCheckoutRecoveryWhatsapp = z.infer<typeof insertCheckoutRecoveryWhatsappSchema>;

// ==================== CUSTOM DOMAIN MAPPINGS ====================
// Mapeamento de domínios customizados para páginas (clonadas e presell)
// Armazenado no banco para evitar problemas de sincronização de filesystem

export const customDomainMappings = pgTable("custom_domain_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: varchar("domain").notNull().unique(), // Domínio sem www (ex: acasadasformulas.com.br)
  pageType: varchar("page_type").notNull(), // 'cloned' ou 'presell'
  pageSlug: varchar("page_slug").notNull(), // Slug da página (ex: ed713124-b-sdsd-fuwt5rng)
  pagePath: varchar("page_path").notNull(), // Path completo (ex: /pages/ed713124-b-sdsd-fuwt5rng)
  userId: varchar("user_id").references(() => users.id),
  cloudflareHostnameId: varchar("cloudflare_hostname_id"), // ID do custom hostname no Cloudflare
  cloudflareStatus: varchar("cloudflare_status").default("pending"), // pending, active, moved, deleted
  sslStatus: varchar("ssl_status").default("initializing"), // initializing, pending_validation, active
  dcvDelegationCname: varchar("dcv_delegation_cname"), // CNAME para validação SSL (ex: _acme-challenge.lp.example.com)
  dcvDelegationTarget: varchar("dcv_delegation_target"), // Target do CNAME (ex: lp.example.com.xxxx.dcv.cloudflare.com)
  ownershipTxtName: varchar("ownership_txt_name"), // Nome do TXT de ownership (ex: _cf-custom-hostname.lp.example.com)
  ownershipTxtValue: varchar("ownership_txt_value"), // Valor do TXT de ownership
  verificationErrors: text("verification_errors"), // Erros de verificação do Cloudflare (JSON)
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_custom_domain_mappings_domain").on(table.domain),
  index("IDX_custom_domain_mappings_slug").on(table.pageSlug),
  index("IDX_custom_domain_mappings_user").on(table.userId),
]);

export const insertCustomDomainMappingSchema = createInsertSchema(customDomainMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomDomainMapping = typeof customDomainMappings.$inferSelect;
export type InsertCustomDomainMapping = z.infer<typeof insertCustomDomainMappingSchema>;

// ==================== WHATSAPP CAMPAIGNS ====================
// Sistema de campanhas em massa via WhatsApp

export const whatsappCampaigns = pgTable("whatsapp_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  mediaType: varchar("media_type"), // DEPRECATED - mantido para compatibilidade
  mediaUrl: varchar("media_url"), // DEPRECATED - mantido para compatibilidade
  mediaFileName: varchar("media_file_name"), // DEPRECATED - mantido para compatibilidade
  imageUrl: varchar("image_url"), // URL da imagem
  imageFileName: varchar("image_file_name"), // Nome original da imagem
  videoUrl: varchar("video_url"), // URL do vídeo
  videoFileName: varchar("video_file_name"), // Nome original do vídeo
  audioUrl: varchar("audio_url"), // URL do áudio
  audioFileName: varchar("audio_file_name"), // Nome original do áudio
  documentUrl: varchar("document_url"), // URL do documento
  documentFileName: varchar("document_file_name"), // Nome original do documento
  intervalMinSec: integer("interval_min_sec").notNull().default(30), // Intervalo mínimo em segundos
  intervalMaxSec: integer("interval_max_sec").notNull().default(60), // Intervalo máximo em segundos
  optOutKeyword: varchar("opt_out_keyword").notNull().default("SAIR"), // Palavra-chave para opt-out
  optOutMessage: text("opt_out_message").default("Para não receber mais mensagens de campanhas, responda: SAIR"), // Mensagem enviada no fim
  status: varchar("status").notNull().default("draft"), // draft, running, paused, completed, cancelled
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  errorCount: integer("error_count").default(0),
  optOutCount: integer("opt_out_count").default(0),
  skippedCount: integer("skipped_count").default(0), // Já opt-out antes da campanha
  currentRecipientIndex: integer("current_recipient_index").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_whatsapp_campaigns_status").on(table.status),
  index("IDX_whatsapp_campaigns_created_by").on(table.createdBy),
]);

export const whatsappCampaignRecipients = pgTable("whatsapp_campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => whatsappCampaigns.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  phone: varchar("phone").notNull(),
  userName: varchar("user_name"),
  status: varchar("status").notNull().default("pending"), // pending, sent, error, opted_out, skipped
  errorMessage: text("error_message"),
  messageId: varchar("message_id"), // ID da mensagem no WhatsApp
  attemptCount: integer("attempt_count").default(0),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_whatsapp_recipients_campaign").on(table.campaignId),
  index("IDX_whatsapp_recipients_status").on(table.status),
  index("IDX_whatsapp_recipients_phone").on(table.phone),
]);

export const whatsappOptOuts = pgTable("whatsapp_opt_outs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: varchar("phone").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  userName: varchar("user_name"),
  keyword: varchar("keyword"), // Palavra-chave usada para sair
  sourceCampaignId: varchar("source_campaign_id").references(() => whatsappCampaigns.id),
  optedOutAt: timestamp("opted_out_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_whatsapp_opt_outs_phone").on(table.phone),
]);

// Insert schemas
export const insertWhatsappCampaignSchema = createInsertSchema(whatsappCampaigns).omit({
  id: true,
  sentCount: true,
  errorCount: true,
  optOutCount: true,
  skippedCount: true,
  currentRecipientIndex: true,
  startedAt: true,
  completedAt: true,
  pausedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappCampaignRecipientSchema = createInsertSchema(whatsappCampaignRecipients).omit({
  id: true,
  sentAt: true,
  createdAt: true,
});

export const insertWhatsappOptOutSchema = createInsertSchema(whatsappOptOuts).omit({
  id: true,
  optedOutAt: true,
  createdAt: true,
});

// Types
export type WhatsappCampaign = typeof whatsappCampaigns.$inferSelect;
export type InsertWhatsappCampaign = z.infer<typeof insertWhatsappCampaignSchema>;
export type WhatsappCampaignRecipient = typeof whatsappCampaignRecipients.$inferSelect;
export type InsertWhatsappCampaignRecipient = z.infer<typeof insertWhatsappCampaignRecipientSchema>;
export type WhatsappOptOut = typeof whatsappOptOuts.$inferSelect;
export type InsertWhatsappOptOut = z.infer<typeof insertWhatsappOptOutSchema>;