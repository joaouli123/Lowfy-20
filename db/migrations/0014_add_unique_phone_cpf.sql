-- Adicionar constraints UNIQUE para phone e cpf na tabela users
-- Migration: 0014_add_unique_phone_cpf
-- Data: 2025-11-23

-- Step 1: Normalizar todos os telefones existentes (remover caracteres não-numéricos)
UPDATE users
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL AND phone != '';

-- Step 2: Converter telefones vazios (após normalização) para NULL
UPDATE users
SET phone = NULL
WHERE phone = '';

-- Step 3: Para phone duplicados, manter apenas o registro mais antigo
WITH duplicates AS (
  SELECT phone, MIN(created_at) as oldest_created_at
  FROM users
  WHERE phone IS NOT NULL
  GROUP BY phone
  HAVING COUNT(*) > 1
)
UPDATE users
SET phone = NULL
WHERE phone IN (SELECT phone FROM duplicates)
  AND created_at NOT IN (
    SELECT u.created_at
    FROM users u
    INNER JOIN duplicates d ON u.phone = d.phone AND u.created_at = d.oldest_created_at
  );

-- Step 4: Para cpf duplicados, manter apenas o registro mais antigo
WITH duplicates AS (
  SELECT cpf, MIN(created_at) as oldest_created_at
  FROM users
  WHERE cpf IS NOT NULL
  GROUP BY cpf
  HAVING COUNT(*) > 1
)
UPDATE users
SET cpf = NULL
WHERE cpf IN (SELECT cpf FROM duplicates)
  AND created_at NOT IN (
    SELECT u.created_at
    FROM users u
    INNER JOIN duplicates d ON u.cpf = d.cpf AND u.created_at = d.oldest_created_at
  );

-- Step 5: Adicionar as constraints UNIQUE
ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
ALTER TABLE users ADD CONSTRAINT users_cpf_unique UNIQUE (cpf);
