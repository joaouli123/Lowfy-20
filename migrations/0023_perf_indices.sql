-- Índices que faltavam (auditoria de performance, out/2026).
-- sessions: o login consulta por user_id (lista/encerra sessões) e o Analytics agrupa por usuário.
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON sessions (user_id, created_at);
-- forum_replies: contagem de respostas por autor (perfil, gamificação, Analytics).
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_created ON forum_replies (author_id, created_at);
