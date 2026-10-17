-- Consumo de IA por chamada (custo estimado em US$) e configurações da plataforma.
CREATE TABLE IF NOT EXISTS ai_usage (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  tool varchar(40) NOT NULL,
  provider varchar(20) NOT NULL,
  model varchar(60),
  kind varchar(16) NOT NULL,
  units real NOT NULL DEFAULT 0,
  unit varchar(16),
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  meta jsonb
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tool ON ai_usage (tool);

CREATE TABLE IF NOT EXISTS platform_settings (
  key varchar(60) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
