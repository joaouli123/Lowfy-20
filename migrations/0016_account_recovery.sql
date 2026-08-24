-- ============================================================================
-- 0016_account_recovery.sql
-- Agente de IA de recuperação de conta via WhatsApp.
--
-- IMPORTANTE: este projeto NÃO possui um migrator automático no deploy.
-- Aplique este arquivo MANUALMENTE com psql/cliente SQL (é idempotente e
-- puramente aditivo — seguro para rodar a qualquer momento).
--
-- Tabelas:
--   account_recovery_requests — estado da conversa + auditoria completa
--   account_recovery_locks    — anti-brute-force persistente por telefone
--   account_change_requests   — troca de email/telefone com janela de contestação
-- ============================================================================

CREATE TABLE IF NOT EXISTS "account_recovery_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone" varchar NOT NULL,
  "normalized_phone" varchar NOT NULL,
  "state" varchar NOT NULL DEFAULT 'collecting',
  "goal" varchar,
  "collected_name" varchar,
  "collected_email" varchar,
  "collected_cpf" varchar,
  "collected_phone" varchar,
  "requested_new_email" varchar,
  "requested_new_phone" varchar,
  "matched_user_id" varchar REFERENCES "users"("id"),
  "match_score" integer DEFAULT 0,
  "match_details" jsonb,
  "possession_factor" varchar DEFAULT 'none',
  "risk_flags" jsonb DEFAULT '[]'::jsonb,
  "conversation" jsonb DEFAULT '[]'::jsonb,
  "message_count" integer DEFAULT 0,
  "verify_attempts" integer DEFAULT 0,
  "otp_verification_id" varchar,
  "decision" varchar,
  "decision_reason" text,
  "decided_by" varchar REFERENCES "users"("id"),
  "decided_at" timestamp,
  "reset_token_id" varchar REFERENCES "password_reset_tokens"("id"),
  "outcome_delivered" boolean DEFAULT false,
  "last_message_at" timestamp DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_account_recovery_phone_state" ON "account_recovery_requests" ("phone", "state");
CREATE INDEX IF NOT EXISTS "IDX_account_recovery_state" ON "account_recovery_requests" ("state");
CREATE INDEX IF NOT EXISTS "IDX_account_recovery_expires" ON "account_recovery_requests" ("expires_at");
CREATE INDEX IF NOT EXISTS "IDX_account_recovery_user" ON "account_recovery_requests" ("matched_user_id");

CREATE TABLE IF NOT EXISTS "account_recovery_locks" (
  "phone" varchar PRIMARY KEY,
  "failed_count" integer DEFAULT 0,
  "sessions_today" integer DEFAULT 0,
  "day_bucket" varchar,
  "locked_until" timestamp,
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "account_recovery_config" (
  "id" varchar PRIMARY KEY DEFAULT 'default',
  "enabled" boolean DEFAULT true,
  "auto_approve_enabled" boolean DEFAULT true,
  "threshold_auto" integer DEFAULT 55,
  "threshold_min" integer DEFAULT 40,
  "max_sessions_per_day" integer DEFAULT 3,
  "updated_by" varchar REFERENCES "users"("id"),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "account_change_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "recovery_request_id" varchar REFERENCES "account_recovery_requests"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "field" varchar NOT NULL,
  "old_value" varchar,
  "new_value" varchar NOT NULL,
  "status" varchar NOT NULL DEFAULT 'pending',
  "contest_token_hash" varchar,
  "contest_expires_at" timestamp,
  "apply_after" timestamp,
  "applied_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_account_change_status_apply" ON "account_change_requests" ("status", "apply_after");
CREATE INDEX IF NOT EXISTS "IDX_account_change_user" ON "account_change_requests" ("user_id");
