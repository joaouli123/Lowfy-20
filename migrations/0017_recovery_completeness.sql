-- 0017: robustez do agente de recuperação + senha provisória via WhatsApp
-- Idempotente (mesmo padrão de 0015/0016) — não há migrator automático.

-- Senha provisória entregue pelo WhatsApp quando o link não chega:
-- expira sozinha e obriga a troca no primeiro login.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamp;

-- Estado extra da conversa: o que a pessoa disse não lembrar, se já recebeu
-- senha provisória e quantas tentativas de entrega já houve.
ALTER TABLE account_recovery_requests ADD COLUMN IF NOT EXISTS unknown_fields jsonb DEFAULT '[]'::jsonb;
ALTER TABLE account_recovery_requests ADD COLUMN IF NOT EXISTS temp_password_sent_at timestamp;
ALTER TABLE account_recovery_requests ADD COLUMN IF NOT EXISTS delivery_attempts integer DEFAULT 0;

-- Kill-switch específico da senha provisória (independente do auto-approve).
ALTER TABLE account_recovery_config ADD COLUMN IF NOT EXISTS allow_whatsapp_password boolean DEFAULT true;
ALTER TABLE account_recovery_config ADD COLUMN IF NOT EXISTS temp_password_ttl_minutes integer DEFAULT 60;

-- Sessões que ficaram esperando a pessoa responder se o link funcionou.
CREATE INDEX IF NOT EXISTS "IDX_account_recovery_temp_password"
  ON account_recovery_requests (temp_password_sent_at)
  WHERE temp_password_sent_at IS NOT NULL;
