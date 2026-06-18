-- ============================================================================
-- 0015_audit_hardening.sql
-- Gerado pela auditoria total (segurança/performance/banco).
--
-- IMPORTANTE: este projeto NÃO possui um migrator automático no deploy
-- (não há script db:migrate e o journal só registra 0000/0001). Aplique este
-- arquivo MANUALMENTE com psql/cliente SQL, ou configure um migrator.
--
-- Parte A (índices aditivos) é SEGURA e idempotente — pode rodar a qualquer momento.
-- Parte B (FKs onDelete) e Parte C (tipos monetários) são mudanças estruturais —
-- REVISE e rode em janela de manutenção, com backup.
--
-- STATUS DE APLICAÇÃO (produção Railway, 2026-06-17):
--   ✅ PARTE A — os 10 índices abaixo foram APLICADOS via CREATE INDEX CONCURRENTLY.
--   ⏸️ PARTE D (DROP meta_ads_campaigns) — NÃO aplicado. A tabela foi dropada e
--      RESTAURADA porque o código em produção ainda referencia a tabela. Rodar o
--      DROP somente APÓS o deploy do novo código (que removeu a feature meta-ads).
--   ⏸️ PARTE B (FKs) e PARTE C (tipos monetários) — adiados (locks exclusivos /
--      precisam de mudança coordenada de código). openai_token_usage tem só 3 linhas,
--      mas numeric retorna como string no node-postgres → exige ajuste no app.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE A — Índices de performance ausentes (SEGURO / idempotente)
-- ----------------------------------------------------------------------------

-- FKs de notificação frequentemente filtradas em JOIN/WHERE
CREATE INDEX IF NOT EXISTS "IDX_notifications_actor" ON "notifications" ("actor_id");
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created" ON "notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "IDX_notifications_user_unread" ON "notifications" ("user_id", "is_read");

-- Árvores de respostas/comentários (self-joins por parent)
CREATE INDEX IF NOT EXISTS "IDX_forum_replies_parent" ON "forum_replies" ("parent_comment_id");
CREATE INDEX IF NOT EXISTS "IDX_forum_replies_topic" ON "forum_replies" ("topic_id");
CREATE INDEX IF NOT EXISTS "IDX_post_comments_parent" ON "post_comments" ("parent_comment_id");

-- Listagens admin e de fórum ordenadas por data (evita seq scan + sort em disco)
CREATE INDEX IF NOT EXISTS "IDX_users_created" ON "users" ("created_at");
CREATE INDEX IF NOT EXISTS "IDX_forum_topics_sticky_updated" ON "forum_topics" ("is_sticky", "updated_at");

-- Reviews de produto por usuário/pedido
CREATE INDEX IF NOT EXISTS "IDX_product_reviews_user" ON "product_reviews" ("user_id");

-- Mapeamento de domínio customizado: filtro por is_active no refresh de cache
CREATE INDEX IF NOT EXISTS "IDX_cdm_active" ON "custom_domain_mappings" ("is_active") WHERE "is_active" = true;

-- ----------------------------------------------------------------------------
-- Unicidade de phone/cpf (consolida db/migrations/0014, que está num diretório
-- que o drizzle.config NÃO lê). Normaliza antes de criar a constraint.
-- ----------------------------------------------------------------------------
-- UPDATE "users" SET "cpf"   = regexp_replace("cpf", '[^0-9]', '', 'g') WHERE "cpf" ~ '[^0-9]';
-- UPDATE "users" SET "phone" = regexp_replace("phone", '[^0-9]', '', 'g') WHERE "phone" ~ '[^0-9]';
-- -- (Desduplicar manualmente registros conflitantes antes do passo abaixo.)
-- CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_cpf"   ON "users" ("cpf")   WHERE "cpf"   IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone" ON "users" ("phone") WHERE "phone" IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Busca de marketplace (substring) — requer extensão pg_trgm.
-- ilike('%termo%') não usa índice btree; trigram resolve.
-- ----------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS "IDX_marketplace_products_title_trgm"
--   ON "marketplace_products" USING gin ("title" gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- PARTE B — Integridade referencial (REVISAR — rodar em manutenção, com backup)
-- Hoje quase todas as FKs usam NO ACTION, exigindo deleção manual tabela a tabela
-- (ver deleteUserAndRelatedData) e gerando risco de órfãos. Ajuste por semântica.
-- Exemplos (descomente após revisar nomes reais das constraints com \d <tabela>):
-- ----------------------------------------------------------------------------
-- ALTER TABLE "notifications"  DROP CONSTRAINT IF EXISTS "notifications_actor_id_users_id_fk",
--   ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;
-- ALTER TABLE "post_comments" DROP CONSTRAINT IF EXISTS "post_comments_post_id_timeline_posts_id_fk",
--   ADD CONSTRAINT "post_comments_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "timeline_posts"("id") ON DELETE CASCADE;
-- ALTER TABLE "post_reactions" DROP CONSTRAINT IF EXISTS "post_reactions_post_id_timeline_posts_id_fk",
--   ADD CONSTRAINT "post_reactions_post_id_timeline_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "timeline_posts"("id") ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- PARTE C — Tipos monetários como `real` (float) → erros de arredondamento.
-- Migrar para inteiro (centavos) ou numeric. REVISAR e converter dados existentes.
-- ----------------------------------------------------------------------------
-- ALTER TABLE "meta_ads_campaigns" ALTER COLUMN "product_price" TYPE integer USING round("product_price" * 100);
-- ALTER TABLE "openai_token_usage" ALTER COLUMN "cost_usd"      TYPE numeric(12,4);
-- ALTER TABLE "openai_token_usage" ALTER COLUMN "cost_brl"      TYPE numeric(12,4);
-- ALTER TABLE "openai_token_usage" ALTER COLUMN "exchange_rate" TYPE numeric(10,6);

-- ----------------------------------------------------------------------------
-- Limpeza de sessões/tokens expirados agora é feita pelo job
-- session-cleanup-scheduler.ts (diário às 04:00). Nenhuma ação manual necessária.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- PARTE D — Remoção da feature "Meta Ads Andromeda" (criação de campanha).
-- O código (rotas, página, wizard, storage, schema) foi REMOVIDO. A tabela
-- pode ser dropada após backup dos dados históricos, se houver. DESTRUTIVO.
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS "meta_ads_campaigns";
