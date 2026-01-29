CREATE TABLE "ai_tools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"tool_url" text NOT NULL,
	"icon_type" varchar DEFAULT 'default',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"icon" varchar,
	"color" varchar DEFAULT 'gray',
	"requirement" integer NOT NULL,
	"type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cakto_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cakto_order_id" varchar NOT NULL,
	"cakto_ref_id" varchar,
	"user_id" varchar,
	"customer_email" varchar NOT NULL,
	"customer_name" varchar NOT NULL,
	"customer_phone" varchar,
	"product_id" varchar,
	"product_name" varchar,
	"offer_id" varchar,
	"offer_name" varchar,
	"status" varchar NOT NULL,
	"payment_method" varchar,
	"amount" integer NOT NULL,
	"base_amount" integer,
	"discount" integer DEFAULT 0,
	"fees" integer DEFAULT 0,
	"is_subscription" boolean DEFAULT false,
	"subscription_id" varchar,
	"paid_at" timestamp,
	"refunded_at" timestamp,
	"charged_back_at" timestamp,
	"webhook_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cakto_orders_cakto_order_id_unique" UNIQUE("cakto_order_id")
);
--> statement-breakpoint
CREATE TABLE "cakto_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cakto_subscription_id" varchar NOT NULL,
	"user_id" varchar,
	"status" varchar NOT NULL,
	"current_period" integer DEFAULT 1,
	"recurrence_period" integer,
	"amount" integer NOT NULL,
	"payment_method" varchar,
	"next_payment_date" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "cakto_subscriptions_cakto_subscription_id_unique" UNIQUE("cakto_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"duration" varchar,
	"lesson_count" integer,
	"thumbnail_url" text,
	"course_url" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_new" boolean DEFAULT false,
	"is_popular" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"topic_id" varchar,
	"reply_id" varchar,
	"reaction_type" varchar DEFAULT 'like' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"topic_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"like_count" integer DEFAULT 0,
	"is_accepted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "forum_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"color" varchar DEFAULT 'gray',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "forum_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "forum_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "forum_topic_tags" (
	"topic_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"author_id" varchar NOT NULL,
	"category_id" varchar,
	"view_count" integer DEFAULT 0,
	"reply_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"is_sticky" boolean DEFAULT false,
	"is_closed" boolean DEFAULT false,
	"best_answer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar(5) NOT NULL,
	"flag_emoji" varchar(10),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "marketplace_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" varchar NOT NULL,
	"seller_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"cakto_order_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"category" varchar,
	"images" jsonb,
	"file_url" text,
	"is_digital" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"sales_count" integer DEFAULT 0,
	"rating" integer DEFAULT 0,
	"review_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"message" text NOT NULL,
	"related_topic_id" varchar,
	"related_reply_id" varchar,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plr_downloads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plr_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"language_id" varchar NOT NULL,
	"file_url" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plr_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plr_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plr_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plr_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar DEFAULT 'completed',
	"cakto_order_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plr_tag_relations" (
	"plr_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plr_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"color" varchar DEFAULT 'gray',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "plr_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "plr_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plrs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"cover_image_url" text,
	"category_id" varchar,
	"country_code" varchar(5),
	"creator_id" varchar,
	"like_count" integer DEFAULT 0,
	"price" integer DEFAULT 0,
	"is_free" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"extra_links" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar DEFAULT 'like',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"shared_with" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_tag_relations" (
	"post_id" varchar NOT NULL,
	"tag_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"benefits" jsonb,
	"is_active" boolean DEFAULT true,
	"is_popular" boolean DEFAULT false,
	"cakto_product_id" varchar,
	"cakto_offer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar NOT NULL,
	"message" text NOT NULL,
	"user_id" varchar,
	"email" varchar NOT NULL,
	"name" varchar NOT NULL,
	"status" varchar DEFAULT 'open',
	"priority" varchar DEFAULT 'medium',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timeline_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"media" jsonb,
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"engagement_rate" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timeline_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"post_count" integer DEFAULT 0,
	"trending_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "timeline_tags_name_unique" UNIQUE("name"),
	CONSTRAINT "timeline_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topic_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"topic_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"badge_id" varchar NOT NULL,
	"earned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"connected_user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_points" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"points" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"topics_created" integer DEFAULT 0,
	"replies_created" integer DEFAULT 0,
	"likes_received" integer DEFAULT 0,
	"best_answers" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"name" varchar NOT NULL,
	"phone" varchar,
	"profile_image_url" varchar,
	"profession" varchar,
	"area_atuacao" varchar,
	"is_admin" boolean DEFAULT false,
	"account_status" varchar DEFAULT 'pending',
	"subscription_status" varchar DEFAULT 'none',
	"subscription_expires_at" timestamp,
	"cakto_customer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cakto_orders" ADD CONSTRAINT "cakto_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cakto_subscriptions" ADD CONSTRAINT "cakto_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_likes" ADD CONSTRAINT "forum_likes_reply_id_forum_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topic_tags" ADD CONSTRAINT "forum_topic_tags_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topic_tags" ADD CONSTRAINT "forum_topic_tags_tag_id_forum_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."forum_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_product_id_marketplace_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."marketplace_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_products" ADD CONSTRAINT "marketplace_products_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_topic_id_forum_topics_id_fk" FOREIGN KEY ("related_topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_reply_id_forum_replies_id_fk" FOREIGN KEY ("related_reply_id") REFERENCES "public"."forum_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_downloads" ADD CONSTRAINT "plr_downloads_plr_id_plrs_id_fk" FOREIGN KEY ("plr_id") REFERENCES "public"."plrs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_downloads" ADD CONSTRAINT "plr_downloads_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_likes" ADD CONSTRAINT "plr_likes_plr_id_plrs_id_fk" FOREIGN KEY ("plr_id") REFERENCES "public"."plrs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_likes" ADD CONSTRAINT "plr_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_purchases" ADD CONSTRAINT "plr_purchases_plr_id_plrs_id_fk" FOREIGN KEY ("plr_id") REFERENCES "public"."plrs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_purchases" ADD CONSTRAINT "plr_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_tag_relations" ADD CONSTRAINT "plr_tag_relations_plr_id_plrs_id_fk" FOREIGN KEY ("plr_id") REFERENCES "public"."plrs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plr_tag_relations" ADD CONSTRAINT "plr_tag_relations_tag_id_plr_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."plr_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plrs" ADD CONSTRAINT "plrs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plrs" ADD CONSTRAINT "plrs_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_shares" ADD CONSTRAINT "post_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tag_relations" ADD CONSTRAINT "post_tag_relations_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tag_relations" ADD CONSTRAINT "post_tag_relations_tag_id_timeline_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."timeline_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_marketplace_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."marketplace_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_marketplace_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."marketplace_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_posts" ADD CONSTRAINT "timeline_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_connected_user_id_users_id_fk" FOREIGN KEY ("connected_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_plr_likes_plr" ON "plr_likes" USING btree ("plr_id");--> statement-breakpoint
CREATE INDEX "IDX_plr_likes_user" ON "plr_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_plr_purchases_user" ON "plr_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_plr_purchases_plr" ON "plr_purchases" USING btree ("plr_id");--> statement-breakpoint
CREATE INDEX "IDX_post_comments_post" ON "post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "IDX_post_comments_user" ON "post_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_post_reactions_post" ON "post_reactions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "IDX_post_reactions_user" ON "post_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_post_shares_post" ON "post_shares" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "IDX_post_shares_user" ON "post_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_timeline_posts_user" ON "timeline_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_timeline_posts_created" ON "timeline_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "IDX_topic_follows_user" ON "topic_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_topic_follows_topic" ON "topic_follows" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "IDX_user_connections_user" ON "user_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "IDX_user_connections_connected" ON "user_connections" USING btree ("connected_user_id");--> statement-breakpoint
CREATE INDEX "IDX_user_follows_follower" ON "user_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "IDX_user_follows_following" ON "user_follows" USING btree ("following_id");