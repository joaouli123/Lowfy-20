# Railway - Variáveis de Ambiente (Lowfy)

Este arquivo lista as variáveis realmente necessárias para subir o projeto no Railway com estabilidade para escala.

## 1) Obrigatórias (core)

- `NODE_ENV=production`
- `PORT` (Railway normalmente injeta automaticamente)
- `DATABASE_URL`

## 2) Obrigatórias para funcionalidades de pagamento

### Asaas
- `ASAAS_TOKEN`
- `ASAAS_ENVIRONMENT` (`sandbox` ou `production`)
- `ASAAS_WEBHOOK_SECRET`
- `ASAAS_TRANSFER_WEBHOOK_SECRET`
- `ASAAS_SUBSCRIPTION_WEBHOOK_SECRET`

### Podpay
- `PODPAY_PUBLIC_KEY`
- `PODPAY_SECRET_KEY`
- `PODPAY_WITHDRAW_KEY`
- `PODPAY_BASE_URL` (se não informar, usa `https://api.podpay.co`)
- `PODPAY_SUBSCRIPTION_WEBHOOK_SECRET`

## 3) Obrigatórias para email/SMS

### SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_NAME` (recomendado)

### SMS (Comtele)
- `COMTELE_API_KEY`
- `COMTELE_API_URL` (opcional, default já existe)

## 4) Obrigatórias para integrações específicas

### OpenAI
- `OPENAI_API_KEY`

### Cloudflare (domínios customizados)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ACCOUNT_ID`

### Meta/Facebook CAPI (se usar evento de compra)
- `META_ACCESS_TOKEN`

## 5) Recomendadas para produção

- `ADMIN_EMAIL`
- `VITE_BASE_URL` (ex: `https://lowfy.com.br`)
- `APP_DOMAIN`
- `LANDING_DOMAIN`
- `CHECKOUT_DOMAIN`

## 6) Novas variáveis de escala (implementadas)

- `RUN_SCHEDULERS=true`
  - Em arquitetura com múltiplas instâncias, pode ficar `true` em todas; a liderança já é controlada por advisory lock no Postgres.
- `SOCKET_IO_ALLOWED_ORIGINS=https://lowfy.com.br,https://www.lowfy.com.br`
  - Lista separada por vírgula.
- `CUSTOM_DOMAIN_FS_FALLBACK=false`
  - Recomendado em produção quando mapeamento em DB estiver íntegro.
- `ENABLE_DOMAIN_LOOKUP_FS_FALLBACK=false`
  - Mantém lookup principal em DB para menor latência.

## 7) Variáveis de contexto Replit (não obrigatórias no Railway)

Só use se você realmente depender de conectores Replit:
- `REPLIT_CONNECTORS_HOSTNAME`
- `REPL_IDENTITY`
- `WEB_REPL_RENEWAL`
- `REPL_ID`
- `REPLIT_DOMAINS`

## 8) Object Storage (se usar)

- `PUBLIC_OBJECT_SEARCH_PATHS`
- `PRIVATE_OBJECT_DIR`

## 9) Checklist rápido antes do deploy

1. Confirmar `DATABASE_URL` funcional.
2. Confirmar segredos de webhook (`ASAAS_*_SECRET`, `PODPAY_SUBSCRIPTION_WEBHOOK_SECRET`).
3. Definir `SOCKET_IO_ALLOWED_ORIGINS` para seus domínios reais.
4. Definir `CUSTOM_DOMAIN_FS_FALLBACK=false` e `ENABLE_DOMAIN_LOOKUP_FS_FALLBACK=false`.
5. Validar `/healthz`, `/readyz` e `/metricsz` após subir.
