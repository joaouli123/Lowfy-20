
-- Índices para PLRs
CREATE INDEX IF NOT EXISTS "IDX_plrs_category" ON "plrs" ("category_id");
CREATE INDEX IF NOT EXISTS "IDX_plrs_active" ON "plrs" ("is_active");
CREATE INDEX IF NOT EXISTS "IDX_plrs_free" ON "plrs" ("is_free");
CREATE INDEX IF NOT EXISTS "IDX_plrs_created" ON "plrs" ("created_at" DESC);

-- Índices para Downloads
CREATE INDEX IF NOT EXISTS "IDX_downloads_plr" ON "plr_downloads" ("plr_id");
CREATE INDEX IF NOT EXISTS "IDX_downloads_language" ON "plr_downloads" ("language_id");

-- Índices para Tags
CREATE INDEX IF NOT EXISTS "IDX_tag_relations_plr" ON "plr_tag_relations" ("plr_id");
CREATE INDEX IF NOT EXISTS "IDX_tag_relations_tag" ON "plr_tag_relations" ("tag_id");

-- Índices para Likes
CREATE INDEX IF NOT EXISTS "IDX_likes_plr_user" ON "plr_likes" ("plr_id", "user_id");

-- Índices para Purchases
CREATE INDEX IF NOT EXISTS "IDX_purchases_plr_user" ON "plr_purchases" ("plr_id", "user_id");
CREATE INDEX IF NOT EXISTS "IDX_purchases_user" ON "plr_purchases" ("user_id");

-- Índices para Users
CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "IDX_users_status" ON "users" ("account_status");
