-- Optimize authentication performance

-- Index for session token lookups (most common auth query)
-- Simple index without volatile function in predicate
CREATE INDEX IF NOT EXISTS "IDX_sessions_token" ON "sessions" ("token");

-- Composite index for session token + expires_at (covers the auth query)
CREATE INDEX IF NOT EXISTS "IDX_sessions_token_expires" ON "sessions" ("token", "expires_at");

-- Index for session cleanup queries
CREATE INDEX IF NOT EXISTS "IDX_sessions_expires" ON "sessions" ("expires_at");

-- Index for user authentication lookups
CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");

-- Index for categories (frequently queried, rarely changes)
CREATE INDEX IF NOT EXISTS "IDX_categories_name" ON "categories" ("name");

-- Index for languages (frequently queried, rarely changes)
CREATE INDEX IF NOT EXISTS "IDX_languages_code" ON "languages" ("code");
