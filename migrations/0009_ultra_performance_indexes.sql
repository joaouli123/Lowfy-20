
-- Ultra Performance Indexes para Timeline
-- Foco em velocidade máxima de queries

-- Índice composto otimizado para busca de posts ativos ordenados por data
-- COVERING INDEX - inclui todas as colunas necessárias para evitar lookup na tabela
CREATE INDEX IF NOT EXISTS "IDX_timeline_posts_ultra_fast" 
  ON "timeline_posts" ("is_active", "created_at" DESC, "user_id", "content", "like_count", "dislike_count", "comment_count", "share_count", "is_pinned") 
  WHERE "is_active" = true;

-- Índice para comentários por post (com INCLUDE para evitar lookups)
CREATE INDEX IF NOT EXISTS "IDX_post_comments_ultra_fast" 
  ON "post_comments" ("post_id", "parent_comment_id", "is_pinned" DESC, "like_count" DESC, "created_at" DESC)
  WHERE "parent_comment_id" IS NULL;

-- Índice para user_points lookup instantâneo
CREATE INDEX IF NOT EXISTS "IDX_user_points_ultra_fast" 
  ON "user_points" ("user_id", "points", "posts_created", "comments_created");

-- Índice para ranking semanal
CREATE INDEX IF NOT EXISTS "IDX_user_points_ranking" 
  ON "user_points" ("points" DESC, "posts_created" DESC)
  WHERE "points" > 0;

-- Vacuum e analyze para otimizar estatísticas
VACUUM ANALYZE timeline_posts;
VACUUM ANALYZE post_comments;
VACUUM ANALYZE user_points;
