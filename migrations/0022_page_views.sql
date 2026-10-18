-- Páginas visitadas na plataforma (Admin → Analytics) e "visto por último" de cada usuário.
CREATE TABLE IF NOT EXISTS page_views (
  id bigserial PRIMARY KEY,
  user_id varchar,
  session_id varchar(64),
  path varchar(300) NOT NULL,
  referrer varchar(300),
  device varchar(16),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_views_created_idx ON page_views (created_at);
CREATE INDEX IF NOT EXISTS page_views_user_idx ON page_views (user_id, created_at);
CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path, created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
