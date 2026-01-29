
-- Criar tabela de automações N8N
CREATE TABLE IF NOT EXISTS "n8n_automations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" varchar NOT NULL,
  "title_en" varchar NOT NULL,
  "description" text NOT NULL,
  "description_en" text NOT NULL,
  "category" varchar NOT NULL,
  "category_en" varchar NOT NULL,
  "department" varchar,
  "template_url" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "view_count" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS "IDX_n8n_automations_category" ON "n8n_automations" ("category");
CREATE INDEX IF NOT EXISTS "IDX_n8n_automations_active" ON "n8n_automations" ("is_active");
CREATE INDEX IF NOT EXISTS "IDX_n8n_automations_created" ON "n8n_automations" ("created_at");
