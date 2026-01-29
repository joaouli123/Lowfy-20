# Lowfy Custom Domain Proxy - Cloudflare Worker

Este Worker permite que usuários do Lowfy usem seus próprios domínios para acessar páginas clonadas e pre-sell, sem precisar adicionar cada domínio manualmente no Replit.

## Como funciona

```
[Domínio do Usuário] → CNAME → [Worker] → Consulta API Lowfy → [Proxy para lowfy.com.br]
```

1. O usuário configura o domínio com CNAME apontando para `proxy.lowfy.com.br`
2. O Worker recebe a requisição e consulta `/api/domain-lookup/:domain` no Lowfy
3. Se o domínio estiver configurado, o Worker faz proxy da página correspondente
4. O HTML é servido no domínio customizado do usuário

## Deploy no Cloudflare Workers

### Passo 1: Criar o Worker

1. Acesse https://dash.cloudflare.com
2. Vá em **Workers & Pages** no menu lateral
3. Clique em **Create Worker**
4. Escolha um nome (ex: `lowfy-proxy`)
5. Cole o código do arquivo `lowfy-proxy.js`
6. Clique em **Save and Deploy**

### Passo 2: Configurar Custom Domain

Para que o Worker responda em `proxy.lowfy.com.br`:

1. No painel do Worker, vá em **Settings** → **Triggers**
2. Em **Custom Domains**, clique em **Add Custom Domain**
3. Digite `proxy.lowfy.com.br`
4. O Cloudflare vai verificar o domínio (você precisa ter o domínio lowfy.com.br no Cloudflare)

### Passo 3: Testar

Após o deploy, acesse:
```
https://proxy.lowfy.com.br
```

Deve retornar um JSON de status:
```json
{
  "status": "ok",
  "service": "Lowfy Custom Domain Proxy",
  "version": "1.0.0",
  "instructions": "Configure seu domínio com CNAME apontando para este endpoint"
}
```

## Configuração para Usuários

Os usuários do Lowfy devem:

1. **No Lowfy**: Configurar o domínio customizado na página clonada/presell
2. **No DNS**: Criar um registro CNAME:
   - **Nome**: `@` (raiz) ou `www` ou subdomínio desejado
   - **Valor**: `proxy.lowfy.com.br`

### Exemplo de configuração DNS

Para `meusite.com`:
```
Tipo: CNAME
Nome: @
Valor: proxy.lowfy.com.br
```

Para `oferta.meusite.com`:
```
Tipo: CNAME
Nome: oferta
Valor: proxy.lowfy.com.br
```

## API de Lookup

O Worker usa o endpoint:
```
GET https://lowfy.com.br/api/domain-lookup/:domain
```

Resposta quando encontrado:
```json
{
  "found": true,
  "type": "cloned",
  "slug": "minha-pagina",
  "path": "/pages/minha-pagina",
  "domain": "meusite.com"
}
```

Resposta quando não encontrado:
```json
{
  "found": false
}
```

## Troubleshooting

### Domínio não está funcionando

1. Verifique se o CNAME está propagado: `dig meusite.com CNAME`
2. Verifique se o domínio está configurado no Lowfy
3. Teste a API: `curl https://lowfy.com.br/api/domain-lookup/meusite.com`

### Página mostra "Domínio não configurado"

O domínio não está registrado em nenhuma página no Lowfy. Verifique:
- Se o domínio foi salvo corretamente na configuração da página
- Se a página está ativa

### Erro 502

O Worker não conseguiu conectar ao Lowfy. Possíveis causas:
- Lowfy temporariamente indisponível
- Problema de rede

## Limites do Cloudflare Workers (Plano Gratuito)

- 100,000 requisições/dia
- 10ms CPU time por requisição
- Sem custo para este volume

Para volumes maiores, considere o plano Workers Paid ($5/mês para 10 milhões de requisições).
