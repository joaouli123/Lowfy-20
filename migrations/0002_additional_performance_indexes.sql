
-- Additional Performance Indexes

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "IDX_plrs_category_active" ON "plrs" ("category_id", "is_active") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "IDX_plrs_search" ON "plrs" USING gin(to_tsvector('portuguese', "title"));

-- Indexes for forum performance
CREATE INDEX IF NOT EXISTS "IDX_forum_topics_category" ON "forum_topics" ("category_id");
CREATE INDEX IF NOT EXISTS "IDX_forum_topics_author_created" ON "forum_topics" ("author_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "IDX_forum_replies_topic_created" ON "forum_replies" ("topic_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "IDX_forum_likes_user" ON "forum_likes" ("user_id");

-- Indexes for marketplace
CREATE INDEX IF NOT EXISTS "IDX_marketplace_products_seller" ON "marketplace_products" ("seller_id");
CREATE INDEX IF NOT EXISTS "IDX_marketplace_products_category_active" ON "marketplace_products" ("category", "is_active") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "IDX_marketplace_orders_buyer" ON "marketplace_orders" ("buyer_id");
CREATE INDEX IF NOT EXISTS "IDX_marketplace_orders_seller" ON "marketplace_orders" ("seller_id");
CREATE INDEX IF NOT EXISTS "IDX_product_reviews_product" ON "product_reviews" ("product_id");

-- Indexes for timeline/social features
CREATE INDEX IF NOT EXISTS "IDX_timeline_posts_user_created" ON "timeline_posts" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "IDX_post_reactions_post_user" ON "post_reactions" ("post_id", "user_id");
CREATE INDEX IF NOT EXISTS "IDX_post_comments_post_created" ON "post_comments" ("post_id", "created_at" DESC);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread" ON "notifications" ("user_id", "is_read") WHERE "is_read" = false;
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC);

-- Indexes for courses
CREATE INDEX IF NOT EXISTS "IDX_courses_category_active" ON "courses" ("category", "is_active") WHERE "is_active" = true;

-- Indexes for AI tools
CREATE INDEX IF NOT EXISTS "IDX_ai_tools_category_active" ON "ai_tools" ("category", "is_active") WHERE "is_active" = true;

-- Indexes for webhook logs (for monitoring and debugging)
CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_event" ON "webhook_logs" ("event");
CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_processed" ON "webhook_logs" ("processed");
CREATE INDEX IF NOT EXISTS "IDX_webhook_logs_created" ON "webhook_logs" ("created_at" DESC);

-- Indexes for Cakto orders and subscriptions
CREATE INDEX IF NOT EXISTS "IDX_cakto_orders_user" ON "cakto_orders" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_cakto_orders_status" ON "cakto_orders" ("status");
CREATE INDEX IF NOT EXISTS "IDX_cakto_orders_created" ON "cakto_orders" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "IDX_cakto_subscriptions_user" ON "cakto_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_cakto_subscriptions_status" ON "cakto_subscriptions" ("status");
