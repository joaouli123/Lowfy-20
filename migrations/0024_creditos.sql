-- Créditos do Estúdio IA (out/2026): carteira, extrato e pedidos de compra de pacotes.
CREATE TABLE IF NOT EXISTS credit_wallets (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  saldo integer NOT NULL DEFAULT 0 CHECK (saldo >= 0),      -- créditos comprados/ajustados
  bonus integer NOT NULL DEFAULT 0 CHECK (bonus >= 0),      -- bônus mensal do assinante (não acumula)
  bonus_mes varchar(7),                                     -- 'AAAA-MM' do último bônus dado
  expira_em timestamptz,                                    -- validade dos créditos comprados
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id bigserial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL,                 -- + entrada / - consumo
  tipo varchar(20) NOT NULL,              -- compra, bonus, uso, estorno, ajuste, expirou
  ferramenta varchar(60),
  descricao text,
  pedido_id varchar(64),
  saldo_depois integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON credit_ledger (created_at);

CREATE TABLE IF NOT EXISTS credit_orders (
  id varchar(64) PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pacote varchar(20) NOT NULL,
  creditos integer NOT NULL,
  valor_centavos integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pendente',   -- pendente, pago, cancelado
  gateway varchar(20) NOT NULL DEFAULT 'podpay',
  gateway_id varchar(64),
  pix_copia_cola text,
  pix_expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  pago_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_credit_orders_user_created ON credit_orders (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_orders_gateway ON credit_orders (gateway, gateway_id) WHERE gateway_id IS NOT NULL;
