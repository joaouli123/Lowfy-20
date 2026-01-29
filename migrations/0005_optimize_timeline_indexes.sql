-- Timeline Performance Optimization Indexes
-- Criado para otimizar queries de posts e comentários

-- Índice composto para buscar comentários raiz mais curtidos/recentes por post
CREATE INDEX IF NOT EXISTS "IDX_post_comments_post_parent_likes" 
  ON "post_comments" ("post_id", "like_count" DESC, "created_at" DESC) 
  WHERE "parent_comment_id" IS NULL;

-- Índice composto para verificação rápida de likes em comentários
CREATE INDEX IF NOT EXISTS "IDX_comment_likes_comment_user" 
  ON "comment_likes" ("comment_id", "user_id");

-- Índice para buscar posts por tag (usado em trending tags)
CREATE INDEX IF NOT EXISTS "IDX_post_tag_relations_tag" 
  ON "post_tag_relations" ("tag_id");

-- Índice composto otimizado para query principal de timeline
CREATE INDEX IF NOT EXISTS "IDX_timeline_posts_active_created" 
  ON "timeline_posts" ("is_active", "created_at" DESC) 
  WHERE "is_active" = true;

-- Índice para shared posts lookup
CREATE INDEX IF NOT EXISTS "IDX_timeline_posts_shared" 
  ON "timeline_posts" ("shared_post_id") 
  WHERE "shared_post_id" IS NOT NULL;

-- Índice para user_points lookup rápido
CREATE INDEX IF NOT EXISTS "IDX_user_points_user" 
  ON "user_points" ("user_id");
