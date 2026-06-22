# Domínios próprios dos clientes com Caddy (on-demand TLS)

Permite que cada usuário conecte **seu próprio domínio/subdomínio** ao funil, com
**SSL automático e ilimitado** — o Caddy emite e renova os certificados sozinho.

## Como funciona

```
Cliente (DNS)  →  Caddy (TLS automático)  →  App Node (8080)
   CNAME            on-demand cert             serve o funil pelo host
```

1. O cliente aponta o domínio dele para o Caddy (CNAME/A).
2. No primeiro acesso HTTPS, o Caddy pergunta ao app: `GET /api/internal/tls-check?domain=<domínio>`.
   - O app responde **200** se o domínio estiver vinculado a um funil (já implementado), senão **403**.
3. Autorizado, o Caddy emite o certificado (Let's Encrypt) e faz proxy pro app.
4. O app resolve o host → funil (`/api/q/resolve`) e serve o funil **na raiz** do domínio.

Tudo já está pronto no app:
- `GET /api/internal/tls-check` (autoriza o cert)
- `GET /api/q/resolve` (host → funil) e o roteamento por host
- UI de conectar domínio em **Configurações › Geral** (mostra o CNAME)

## Deploy do Caddy

Edite o `deploy/Caddyfile` e troque `APP_UPSTREAM` pelo host:porta do app e o e-mail.

### Opção A — Caddy como serviço no Railway (recomendado)
1. Crie um novo serviço no projeto a partir da imagem `caddy:2`.
2. Monte o `Caddyfile` (variável `CADDYFILE_CONTENT` ou volume) e um volume persistente em `/data` (guarda os certificados).
3. `APP_UPSTREAM` = host interno do app, ex.: `lowfy-20.railway.internal:8080` (rede privada do Railway).
4. Aponte o domínio público (e o wildcard `*.lowfy.com.br`) para o serviço Caddy.

### Opção B — docker-compose (self-host / VPS)
```yaml
services:
  app:
    build: .
    environment: [ NODE_ENV=production ]   # + DATABASE_URL etc.
    expose: ["8080"]
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
volumes: { caddy_data: {}, caddy_config: {} }
```
Aqui `APP_UPSTREAM = app:8080`.

## DNS do cliente
- **Subdomínio** (`quiz.cliente.com`): `CNAME quiz → seu-dominio-do-caddy`.
- **Domínio raiz** (`cliente.com`): `A`/`ALIAS` → IP/host do Caddy.

Propagação até 24h; o certificado sai automático no primeiro acesso autorizado.
