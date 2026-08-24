# Documentação Completa da Plataforma Lowfy

> Documento gerado por varredura completa do código-fonte (`client/src`, `server`, `shared/schema.ts`) em 2026-07-21. Cobre visão de produto, arquitetura técnica, modelo de dados/API e **todas as páginas** do app (públicas, autenticadas e admin), com inventário de UI, fluxos de usuário, regras de negócio e integrações de cada tela. Use como referência única para desenhar/recriar as interfaces.

## 1. Visão Geral do Produto

**Lowfy** é uma plataforma SaaS brasileira "tudo-em-um" para empreendedores de dropshipping, marketing digital, afiliados e criadores de conteúdo/infoproduto. A proposta de venda central (ver landing page, `/`): *"O Marketing Digital Ficou Covarde"* — substituir dezenas de assinaturas de ferramentas pagas (IA, design, SEO, mineração de anúncios) por um único painel, com hospedagem inclusa e comunidade gamificada.

Módulos principais reunidos num único login/assinatura:

- **Estúdio de Criação com IA** (`/ai-studio`) — geração de imagem, copy, narração (TTS), vídeo e avatar falante via múltiplos provedores de IA (OpenAI, Gemini, ElevenLabs, fal.ai, D-ID), com camada gratuita (fallback ffmpeg/Google Translate TTS) e camada premium (chave própria do usuário ou créditos da plataforma). Inclui também Criador de Ebooks IA (`/ebooks`).
- **Quiz Builder** (`/quiz-builder`, `/quiz-interativo`) — construtor de funil/quiz interativo por drag-and-drop (estilo Interact/Involve.me), com lógica condicional, pontuação e player público hospedado em domínio próprio ou subdomínio Lowfy (`/q/:slug`).
- **Clonador de Páginas** (`/clonador`) — importa uma URL concorrente, limpa scripts/pixels de terceiros, permite edição visual (editor tipo Monaco) e republica com domínio próprio.
- **Criador de Páginas de Pré-venda** (`/presell-builder`) — page builder por blocos (texto, imagem, timer, prova social, CTA) para Pre-Sells, VSLs e páginas de obrigado.
- **Catálogo de Recursos** (`/plrs`, `/templates`, `/plugins`, `/services`, `/courses`) — biblioteca de PLRs (Private Label Rights) multilíngue (7 idiomas), templates de landing page, plugins WordPress, serviços white-label e mais de 350 cursos.
- **Marketplace interno** (`/marketplace/*`) — compra e venda de produtos digitais entre usuários da própria plataforma, com carrinho, checkout (PIX/cartão), painel do vendedor, saldo "disponível" vs. "a liberar" (hold de 8 dias) e saque via PIX.
- **Comunidade** — Fórum de discussão (`/forum`) + Timeline social estilo feed (`/`, `/timeline`) com posts, curtidas, comentários — tudo gamificado com XP, níveis, badges e metas semanais.
- **Programa de Indicação/Afiliados** (`/indicacoes`) — comissão recorrente de 50% sobre assinaturas indicadas, com saldo e liberação em 8 dias.
- **Campanhas em massa via WhatsApp** (admin) — envio de campanhas usando o número WhatsApp do próprio usuário/empresa via conexão multi-dispositivo (Baileys), gerenciado no painel admin.
- **Automações prontas para N8N** (`/modelos-n8n`) — mais de 150 templates de automação para importar.
- **Central de Suporte** (`/support`) e **Notificações** (`/notifications`).
- **Painel de Assinatura** (`/assinatura`) — gestão do próprio plano, upgrade/downgrade, histórico de cobrança.

**Modelo de negócio**: assinatura mensal (R$ 99,99) ou anual (R$ 360,90) via **Asaas** (cartão/PIX/recorrência) ou **PodPay** (PIX secundário/saques do marketplace). Acesso é controlado por `accessPlan` (`basic` = free/limitado vs. `full` = assinante pago) com gate de feature-lock nas telas premium. Garantia declarada de 7 dias com reembolso integral.

**Painel administrativo** completo cobre: analytics de uso, moderação de usuários e conteúdo (PLRs/cursos/marketplace/fórum/tickets), financeiro (assinaturas, reembolsos, checkouts abandonados), gestão de afiliados e vendedores, uso de IA (custos por provedor/usuário) e campanhas de WhatsApp — ao todo 16 rotas `/admin/*`, cada uma protegida por `<AdminRoute>`.

## 2. Arquitetura Técnica

Monorepo full-stack em TypeScript, sem etapa de build no ambiente de desenvolvimento (roda direto via `tsx`).

**Frontend** (`client/src`)
- React 18.3.1 como SPA (Single Page Application) servida pelo **Vite**; roteamento client-side via **wouter** (não é Next.js — não há SSR nem roteamento por sistema de arquivos).
- Estado de servidor via **TanStack Query** (`@tanstack/react-query`); formulários com **react-hook-form** + validação **zod**.
- UI: **Radix UI** (padrão shadcn/ui) + **Tailwind CSS**; animações com **Framer Motion**; ícones **lucide-react**.
- **Monaco Editor** (`@monaco-editor/react`, carregado via CDN — não bundlado) usado no editor de código do Clonador de Páginas.
- **dnd-kit** (`@dnd-kit/core`, `sortable`) para drag-and-drop no Quiz Builder e no Pre-Sell Builder.
- Gráficos administrativos com **Chart.js**/`react-chartjs-2` e **Recharts**.
- Tempo real via **socket.io-client**.

**Backend** (`server`)
- **Express 4.21.2** + TypeScript, executado diretamente via **tsx** (sem build em dev; `npm start` também usa `tsx` em produção).
- ~360 rotas registradas majoritariamente em um único arquivo `server/routes.ts` (20.470 linhas), mais um router modular dedicado a indicações (`server/routes/referrals.ts`, 543 linhas).
- Tempo real via **socket.io**.
- Autenticação: sessão custom baseada em **cookie httpOnly** (tabela `sessions` no Postgres) + **bcryptjs** para hash de senha; 2FA opcional por código enviado via SMS/WhatsApp/e-mail no login; verificação de telefone (OTP) obrigatória no cadastro.

**Banco de dados**
- **Postgres** via **Neon serverless** (`@neondatabase/serverless`), acessado com **Drizzle ORM** 0.39.1 (~78 tabelas, ver `shared/schema.ts`, 2.230 linhas). Migrações via `drizzle-kit` (`db:generate`/`db:push`/`db:migrate`).

**Inteligência Artificial** (`server/services/aiStudio.ts` + `ebookStudio.ts`)
- Motor multi-provedor: **OpenAI** (`openai` 6.9.1 — imagem, copy via GPT, TTS), **Google Gemini** (`@google/genai` 1.43.0 — fallback de texto), **ElevenLabs** (TTS premium + clonagem de voz), **fal.ai** (vídeo premium), **D-ID** (avatar falante), Google Translate TTS não-oficial (voz gratuita) e **ffmpeg** (`ffmpeg-static`, efeito Ken Burns como fallback gratuito de vídeo). Processamento de imagem com **sharp**.

**Pagamentos**
- **Asaas** (`server/services/asaas.ts`, 1.465 linhas) — gateway principal: cartão, PIX, assinaturas recorrentes, reembolsos, transferências PIX.
- **PodPay** (`server/services/podpay.ts`, 309 linhas) — gateway secundário: transações/saques PIX do marketplace.
- Integrações legadas mantidas só para histórico: **Cakto** (removida) e tabela de transações **Appmax**.

**WhatsApp**
- `@whiskeysockets/baileys` 7.0.0-rc.9 (WhatsApp Web multi-dispositivo) para o painel admin de campanhas em massa, usando o número de WhatsApp do próprio usuário/empresa.

**Armazenamento de arquivos**
- **Google Cloud Storage** (`@google-cloud/storage`) + pasta local `objects-data/` como fallback; upload via **multer**; compactação/pacotes com **adm-zip**/**jszip**.

**Domínios customizados**
- Usuários podem conectar domínio próprio a quizzes, páginas clonadas e páginas de pré-venda. Integração via API GraphQL da **Railway** (`server/services/railwayDomains.ts`) para provisionamento de hostname + um **Cloudflare Worker** próprio (`cloudflare-worker/lowfy-proxy.js`) para proxy/roteamento de DNS e SSL.
- Roteamento especial no frontend: `client/src/App.tsx` detecta, via `isCustomQuizHost()`, se o hostname atual **não** é `lowfy.com.br`/`localhost`/subdomínio de hospedagem conhecido (`.railway.app`, `.replit.dev`, `.repl.co`, `.vercel.app`) — nesse caso, renderiza **apenas** o componente `HostQuizPlay` em tela cheia (sem o shell do app), ou seja: domínios customizados servem diretamente o funil/quiz do cliente.

**Tracking/Analytics**
- **Meta Pixel** + **Meta Conversions API** server-side (`server/services/facebookConversions.ts`) e **Google Analytics**, inicializados globalmente em `App.tsx` (`MetaPixelInitializer`, `GoogleAnalyticsInitializer`) e disparados a cada mudança de rota e em eventos-chave (cadastro, compra, ativação).

**Deploy**
- Preparado para **Railway** e **Replit** (checks de hostname específicos no roteamento do frontend); plugins de dev do Replit (`@replit/vite-plugin-*`) presentes como devDependencies.

---

## Sumário

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura Técnica](#2-arquitetura-técnica)
3. [Modelo de Dados, API e Serviços de Backend](#modelo-de-dados)
4. [Casca da Aplicação (Shell / Navegação)](#casca-da-aplicação-shell--navegação)
5. [Páginas Públicas: Home, Login/Cadastro e Legal](#páginas-públicas-home-logincadastro-e-legal)
6. [Dashboard e Timeline (Feed Social)](#dashboard-e-timeline-feed-social)
7. [Comunidade e Suporte (Fórum, Tópicos, Tickets, Notificações)](#comunidade-e-suporte-fórum-tópicos-tickets-notificações)
8. [Perfil de Usuário e Indicações (Afiliados)](#perfil-de-usuário-e-indicações-afiliados)
9. [Estúdio de Criação IA (Imagem, Copy, Voz, Vídeo, Avatar, Ebooks)](#estúdio-de-criação-ia-imagem-copy-voz-vídeo-avatar-ebooks)
10. [Quiz Builder e Funil Interativo](#quiz-builder-e-funil-interativo)
11. [Clonador de Páginas](#clonador-de-páginas)
12. [Criador de Páginas de Pré-venda (Pre-Sell Builder)](#criador-de-páginas-de-pré-venda-pre-sell-builder)
13. [Catálogo: PLRs, Templates, Plugins, Serviços e Cursos](#catálogo-plrs-templates-plugins-serviços-e-cursos)
14. [Marketplace — Comprar](#marketplace--comprar)
15. [Marketplace — Vender](#marketplace--vender)
16. [Assinatura e Automações N8N](#assinatura-e-automações-n8n)
17. [Painel Admin — Analytics, Usuários e Bugs](#painel-admin--analytics-usuários-e-bugs)
18. [Painel Admin — Conteúdo, Cursos, Marketplace e Serviços](#painel-admin--conteúdo-cursos-marketplace-e-serviços)
19. [Painel Admin — Financeiro, Afiliados, Vendedores, IA e WhatsApp](#painel-admin--financeiro-afiliados-vendedores-ia-e-whatsapp)

---

---

## Modelo de Dados

O arquivo `shared/schema.ts` (2230 linhas) define o esquema completo via Drizzle ORM/Postgres, com ~78 tabelas. `shared/domainConfig.ts` não define tabelas — é um helper de URLs (app/landing/checkout) que resolve domínios de produção (`lowfy.com.br`) vs. desenvolvimento (`localhost:5000`) a partir de env vars (`APP_DOMAIN`, `LANDING_DOMAIN`, `CHECKOUT_DOMAIN`).

### Identidade, autenticação e sessão
- **users** — conta central. Campos-chave: `email`, `passwordHash`, `phone`/`cpf` (únicos), `isAdmin`, `accountStatus` (pending/active/blocked/expired), `subscriptionStatus` (none/trial/active/canceled/expired), `accessPlan` (`basic` = grátis limitado, `full` = assinante), `subscriptionExpiresAt`, `caktoCustomerId` (legado), `testingAsNonAdmin` (flag de teste do admin).
- **sessions** — tokens de sessão custom (`token`, `expiresAt`, FK `userId`).
- **phoneVerifications** / **emailVerifications** — OTP via SMS/e-mail (`codeHash` bcrypt, `attemptCount`, `status`, vínculo opcional a `subscriptionId`).
- **passwordResetTokens** — tokens de recuperação de senha com expiração e flag `used`.

### Pagamentos e assinaturas Lowfy
- **caktoOrders** / **caktoSubscriptions** — *deprecated* (integração Cakto removida em nov/2024), mantidas só para histórico.
- **lowfySubscriptions** — assinatura interna atual (provider `asaas`/`podpay`), `plan` (mensal/anual), `status` (pending/awaiting_payment/active/canceled/expired/refunded), dados do comprador (nome/email/CPF/telefone/CEP), `activationToken`, `referralCode`, dados de PIX (`qrCodeData`/`qrCodeImage`), `accessValidUntil`.
- **lowfySubscriptionPayments** — histórico de cobranças por assinatura (status, método, bandeira/últimos 4 dígitos do cartão, PIX QR code).
- **subscriptionRefundRequests** — pedidos de reembolso de assinatura (status pending/processing/completed/rejected, `processedBy` admin).
- **webhookLogs** — log genérico de eventos de webhook recebidos (evento, payload, `processed`, erro).
- **checkoutRecoveryEmails** / **checkoutRecoveryWhatsapp** — sequência de recuperação de checkout abandonado (4 e-mails / 3 WhatsApp), com `emailSequence`/`messageSequence`, `discountCode`, tracking de clique/conversão.

### Conteúdo/catálogo (PLRs, serviços, cursos, ferramentas IA)
- **categories** — categorias compartilhadas por PLRs e fórum.
- **languages** — idiomas para downloads de PLR (nome, código ISO, emoji de bandeira).
- **plrTags** / **plrTagRelations** — tags e relação N:N com PLRs.
- **plrs** — produtos PLR (título, capa, categoria, preço em centavos, `isFree`, contagem de views/likes, `extraLinks` jsonb).
- **plrDownloads** — arquivos por tipo (capa/ebook/vsl/criativos/quiz/landingpage) e idioma.
- **plrLikes** / **plrPurchases** — curtidas e compras de PLR.
- **services** — serviços vendidos na plataforma (preço, benefícios jsonb, IDs de produto/oferta Cakto legados).
- **courses** — cursos (categoria, duração, nº de aulas, origem Google Drive ou URL).
- **aiTools** — catálogo de ferramentas de IA externas (URL, categoria, credenciais de acesso jsonb, `isUnderMaintenance`).
- **globalAIAccess** — credenciais globais de acesso a IA compartilhadas (login/senha, ordem).
- **quizInterativoSettings** — configuração de acesso a uma ferramenta externa de "quiz interativo" (login/senha/URL da plataforma) — distinta do Quiz Builder interno.
- **n8nAutomations** — templates de automação n8n (título/descrição PT+EN, categoria, departamento, URL do template).

### Fórum e comunidade
- **forumTags** / **forumTopicTags** — tags do fórum e relação N:N com tópicos.
- **forumTopics** — tópicos (slug único, `authorId`, `categoryId`, `viewCount`/`replyCount`/`likeCount`/`shareCount`, `isSticky`, `isClosed`, `bestAnswerId`).
- **forumReplies** — respostas (`parentCommentId` para threads, `isAccepted`).
- **forumLikes** — reações (like/love/laugh/wow/sad/angry) em tópicos ou respostas.
- **forumTopicShares** — compartilhamentos de tópico.
- **forumTopicReports** / **forumReplyReports** — denúncias (reason, status pending/reviewed/resolved/dismissed, `reviewedBy`).
- **notifications** — notificações polimórficas (type: reply/like/best_answer/mention/comment/reaction/share/topic_reply), com FKs opcionais para tópico/resposta/post/comentário.
- **userFollows** / **topicFollows** — seguir usuários e tópicos.

### Rede social / Timeline
- **timelinePosts** — posts (mídia jsonb, `linkPreview`, `sharedPostId` para republicação, contadores de like/dislike/comentário/share/view, `engagementRate`, `isPinned`).
- **postReactions** — reações tipadas (like/love/celebrate/support/insightful).
- **postComments** — comentários com threads (`parentCommentId`), `isPinned`, `isBestAnswer`.
- **commentLikes** / **postShares** — curtidas de comentário e compartilhamentos de post.
- **timelineTags** / **postTagRelations** — hashtags/trending e relação N:N com posts.
- **userConnections** — conexões entre usuários (status pending/accepted/blocked).
- **postReports** / **commentReports** — denúncias de post/comentário (mesmo padrão do fórum).

### Gamificação
- **userPoints** — XP, nível, contadores (tópicos, respostas, likes recebidos, posts, comentários, shares, seguidores, streak de login).
- **badges** / **userBadges** — conquistas e vínculo usuário↔badge.
- **dailyActivities** / **weeklyChallenges** — definições de missões diárias/semanais (tipo, requisito, recompensa em XP).
- **userDailyProgress** / **userWeeklyProgress** — progresso do usuário nas missões (isCompleted/isClaimed).
- **userRewards** — recompensas ativas temporárias (featured_member, xp_multiplier, profile_border etc., com `endDate`).
- **featuredMembers** — destaques semanais (top_contributor/weekly_champion/most_helpful).

### Marketplace
- **marketplaceProducts** — produtos digitais dos vendedores (`sellerId`, slug único, preço em centavos, imagens jsonb, `isBlocked`/`blockReason` (moderação admin), soft delete `deletedAt`, rating, `salesCount`).
- **marketplaceOrders** — pedidos (breakdown financeiro: `originalPriceCents`, `discountCents`, `grossAmountCents`, `systemFixedFeeCents`, `systemPercentFeeCents`, `netAmountCents`; status pending/completed/refunded/refund_requested/cancelled; `podpayTransactionId`/`asaasTransactionId`).
- **sellerWallet** — saldo do vendedor (`balancePending` bloqueado por 8 dias, `balanceAvailable`, chave PIX).
- **sellerTransactions** — histórico financeiro (type sale/refund/withdrawal, mesmo breakdown de taxas, `releasedAt`).
- **podpayTransactions** — transações PIX via PodPay (QR code, status, `rawResponse`).
- **podpayWithdrawals** — saques (`source` marketplace/referral, `provider` podpay/asaas, chave PIX, `failureReason`).
- **appmaxTransactions** — pagamentos via cartão (Appmax), parcelas, bandeira, autorização.
- **productReviews** — avaliações 1-5 de produtos, vinculadas a `orderId`.
- **cartItems** — carrinho de compras do marketplace.

### Indicação/Afiliados (referral)
- **referralCodes** — código único por usuário, contadores de clique/conversão.
- **referralClicks** — rastreamento de cliques (IP, user agent, se converteu, `convertedUserId`).
- **referralCommissions** — comissões (50% recorrente), `subscriptionAmountCents`/`commissionAmountCents`, status pending/active/canceled/refunded/completed, type subscription/renewal, liberação em 8 dias.
- **referralWallet** — carteira do afiliado (saldo pendente/disponível, `totalEarned`, `totalRefunded`, `totalWithdrawn`, contagem de referidos ativos/cancelados, chave PIX).
- **referralTransactions** — histórico (commission/withdrawal/refund).

### Páginas, domínios e clonagem
- **clonedPages** — páginas clonadas pelo usuário (HTML completo, `pixelCode`, `modalConfig` jsonb, domínio customizado, `requiresDomain`/`deactivatedAt`).
- **customDomainMappings** — mapeamento domínio→página (cloned/presell), integração Cloudflare (hostname ID, status SSL, registros DNS de validação DCV/ownership TXT).

### WhatsApp (campanhas em massa)
- **whatsappCampaigns** — campanha (mensagem, mídia — imagem/vídeo/áudio/documento —, intervalo entre envios, palavra-chave de opt-out, status draft/running/paused/completed/cancelled, contadores de envio/erro/opt-out).
- **whatsappCampaignRecipients** — destinatários por campanha (status pending/sent/error/opted_out/skipped).
- **whatsappOptOuts** — lista global de opt-out (telefone único, palavra-chave usada, campanha de origem).

### Suporte e observabilidade
- **supportTickets** — tickets (assunto, mensagem, anexos jsonb, status open/closed/in_progress, priority).
- **openaiTokenUsage** — consumo de tokens de IA por operação (prompt/completion/total tokens, custo em USD e BRL, taxa de câmbio usada) — usado para o painel admin de custo de IA.

---

## Superfície da API (backend)

`server/routes.ts` (20.470 linhas) registra **cerca de 360 rotas Express** via `app.get/post/put/patch/delete`. Abaixo, agrupadas por prefixo/funcionalidade.

- **Estáticos/SEO** (`/objects/:objectPath*`, `/uploads/products/:filename`, `/sitemap-products.xml`, `/sitemap.xml`) — 4 endpoints. Servem arquivos do object storage e geram sitemaps dinâmicos de produtos.
- **Domínio/Cloudflare debug** (`/api/debug/cloudflare-hostnames`, `/api/domain-lookup/:domain`, `/api/cloudflare-challenge/*`, `/api/acme-challenge/*`) — 4 endpoints de diagnóstico e desafios de validação de domínio customizado (ACME/Cloudflare).
- **`/api/auth/*`** — ~19 endpoints. Registro, ativação de conta, login com 2FA (SMS/WhatsApp/e-mail), reset/esqueci senha, verificação de telefone por OTP, logout, troca de senha, dados do usuário logado (`/user`, `/me`). Protegido por rate limiters dedicados por rota (register/login/SMS/2FA/reset).
- **`/api/user/subscription*`** — ~9 endpoints. Consulta de assinatura e pagamentos, cancelamento/reativação, elegibilidade e solicitação de reembolso, troca de cartão/forma de pagamento.
- **`/api/notifications*`** — 3 endpoints (listar, marcar como lida, marcar todas).
- **`/api/webhooks/*`** — 6 endpoints. Recebem callbacks do PodPay, Asaas (pagamento, validação/status de transferência) e assinaturas recorrentes de ambos os provedores — motor central de atualização de status de pedidos/assinaturas.
- **`/api/categories`, `/api/languages`** — 8 endpoints de CRUD (admin) usados por PLRs e fórum.
- **`/api/plrs*`, `/api/plr-tags`, `/api/my-plrs`** — ~14 endpoints. Catálogo de PLRs com like, download por idioma/tipo, tags e downloads em lote (admin), controle de acesso por assinatura.
- **`/api/services`, `/api/courses`, `/api/n8n-automations`, `/api/ai-tools`, `/api/global-ai-access`** — ~25 endpoints de catálogo (CRUD admin + leitura para assinantes) para serviços contratáveis, cursos, automações n8n, ferramentas de IA externas e credenciais globais compartilhadas.
- **`/api/quiz-interativo/settings`** — 3 endpoints de configuração de acesso à ferramenta externa de quiz.
- **`/api/ai-studio/*`** — 10 endpoints: `capabilities`, geração de `image`/`copy`/`tts`/`avatar`/`video`, `history` (listar/excluir), `voices` (listar vozes ElevenLabs) e `clone-voice` (clonagem de voz). É a API do motor de IA descrito na seção 3.
- **Uploads** (`/api/upload/image`, `/api/upload-image`, `/api/upload/favicon`, `/api/upload/og-image`) — 4 endpoints de upload de arquivos para object storage.
- **Quiz Builder** (`/api/quiz/*` — list/save/generate/get/delete/leads/connect-domain/disconnect-domain/domain-status) + runtime público (`/api/q/resolve`, `/api/q/:slug`, `/start`, `/complete`, `/lead`) + `/api/internal/tls-check` — ~15 endpoints. Criação/edição de funis de quiz com IA, captura de leads e domínio próprio por quiz.
- **`/api/landing/generate`, `/api/landing/vibe`** — 2 endpoints de geração de landing/pre-sell por IA (modo blocos e modo HTML "vibe code").
- **`/api/ebook/*`** — 6 endpoints (generate/save/gen-image/list/get/delete) do gerador de e-books com IA.
- **`/api/support/*`, `/api/admin/support-tickets*`** — 5 endpoints de tickets de suporte e relatório de bugs (com upload de anexos).
- **`/api/image-proxy`** — proxy de imagens autenticado.
- **Perfil/social** (`/api/users/*`) — ~18 endpoints: ranking, sugestões de conexão, perfil público, badges, pontos, seguidores/seguindo (+contagens), posts/tópicos do usuário, atividades recentes, estatísticas de afiliado, follow/unfollow.
- **`/api/timeline/*`** — ~17 endpoints. Feed social: CRUD de posts (com upload de mídia), reações, compartilhamento, comentários (com like/pin/denúncia), pin de post, resumo semanal, tags em alta, processamento de hashtags.
- **`/api/forum/*`** — ~25 endpoints. Tags (com busca/trending), estatísticas, CRUD de tópicos (com anexo, sticky, fechamento), respostas, curtidas/reações, melhor resposta, denúncias de tópico/resposta, tópicos em alta.
- **`/api/daily-activities`, `/api/gamification/*`** — 7 endpoints de missões diárias/semanais (com claim de recompensa), recompensas ativas e membros em destaque.
- **Importação Google Drive** (`/api/admin/import-from-drive*`, `/api/sync-drive-test`, `/api/drive/*`) — 7 endpoints admin para importar/sincronizar conteúdo (cursos/PLRs) a partir do Google Drive.
- **Clonador de páginas** (`/api/clone-page`, `/api/*cloned-page*`, `/api/custom-domain*`, `/pages/:slug`) — ~24 endpoints. CRUD de páginas clonadas, injeção de pixel de rastreamento, configuração de domínio próprio (incl. status/expiração/Cloudflare hostnames admin) e renderização pública da página clonada.
- **Pre-Sell / Criador de Páginas** (`/api/presell/*`, `/presell/:slug`) — ~12 endpoints. CRUD de páginas de pré-venda por blocos, upload de imagem/favicon/og-image, configuração de domínio, tracking de clique e renderização pública.
- **Admin — Analytics** (`/api/admin/analytics*`, `/api/admin/cloning-analytics/*`) — 5 endpoints de métricas de crescimento, atividade do fórum e clonagem de páginas.
- **Admin — Marketplace** (`/api/admin/marketplace/*`) — ~13 endpoints. Moderação de produtos (bloquear/desbloquear/editar/excluir), aprovação de reembolsos, visão geral financeira, ranking de vendedores, histórico de vendas.
- **Admin — Usuários/Assinaturas** (`/api/admin/users*`, `/api/admin/toggle-subscription`, `/api/admin/subscription-status`, `/api/admin/sync-subscription-status`, `/api/admin/fix-subscription/:email`, `/api/admin/migrate-product-slugs`, `/api/admin/asaas/disable-notifications`) — ~13 endpoints de gestão manual de contas e assinaturas.
- **Marketplace (loja)** (`/api/marketplace/*`) — ~30 endpoints. Produtos (CRUD + upload de imagens), compras, carrinho, checkout (PIX e cartão com parcelamento), carteira do vendedor, transações, saque, avaliações, status de pagamento.
- **Subscriptions (planos Lowfy)** (`/api/subscriptions/*`) — ~8 endpoints. Validação de cupom, checkout, status de pagamento, ativação de conta via token, verificação/ativação, recuperação de assinatura abandonada.
- **Admin — Gestão avançada/Financeiro/Afiliados** (`/api/admin/users-management`, `/api/admin/finance/*`, `/api/admin/checkouts-abandonados`, `/api/admin/affiliates/*`, `/api/admin/subscription-refunds*`, `/api/admin/ai-usage/*`, `/api/admin/test-emails`) — ~19 endpoints. Exportação CSV de usuários/afiliados, séries temporais financeiras, funil de checkout abandonado, resumo/lista/vendas de afiliados, gestão de reembolsos de assinatura, consumo de IA (custo por usuário/operação).
- **Admin — WhatsApp** (`/api/admin/whatsapp/*`) — ~24 endpoints. Conexão/QR code/status da sessão WhatsApp, envio de teste, métricas, CRUD completo de campanhas em massa (start/pause/resume/cancel, destinatários, upload de mídia), opt-outs.
- **Meta/Facebook** (`/api/meta/test/dispatch-rafael-viemar`, `/api/admin/resend-meta-purchase-event`) — 2 endpoints de teste/reenvio de eventos de conversão ao Facebook.

### `server/routes/referrals.ts` (arquivo separado, 543 linhas)
Router Express dedicado (`referralRoutes`, montado sob `/api/referrals`) com 9 endpoints: `GET /current` (código de referral do cookie no checkout), `GET /my-code` (obtém/cria código do usuário e monta o link de indicação), `GET /wallet`, `GET /commissions` (paginado com filtro de data/status/tipo), `GET /transactions`, `GET /stats`, `GET /referred-users` (lista de indicados com status de assinatura), `GET /complete-stats`, `GET /balance`, `PUT /pix-config` e `POST /request-withdrawal`. O saque de comissões é a rota mais complexa: aplica cooldown de 60s por usuário, limite diário de R$ 50.000, taxa fixa de R$ 2,49, cria a transferência PIX via Asaas **antes** de debitar o saldo (para não perder saldo em caso de falha do provedor), debita o `referralWallet` dentro de uma transação de banco com guarda de concorrência (`WHERE balanceAvailable >= amountCents`), registra o saque em `podpayWithdrawals`/`referralTransactions` e dispara e-mail de confirmação de forma assíncrona.

---

## Serviços e Integrações de Backend

### `server/services/aiStudio.ts` (705 linhas) — motor de IA
- **Propósito**: motor multi-provedor de geração de conteúdo com IA para o "Estúdio IA" da Lowfy — imagem, copy, TTS/narração, clonagem de voz, vídeo e avatar falante. Filosofia "premium quando a chave existe, fallback gratuito quando ausente" (exceto imagem, vídeo e avatar premium, que exigem chave e lançam erro se ausente).
- **Provedores/APIs externas**: OpenAI (`images.generate` com `gpt-image-1`, `chat.completions` com `gpt-4o` para copy/quiz/landing/ebook, `audio.speech` TTS), Google Gemini (`@google/genai`, fallback de texto/copy), ElevenLabs (TTS premium, clonagem de voz "Instant Voice Cloning", listagem/remoção de vozes), Google Translate TTS não-oficial (`translate_tts`, narração gratuita robótica pt-BR), fal.ai (Seedance 2.0/Kling — vídeo premium image-to-video/text-to-video via polling), D-ID (avatar falante com lip-sync via `/talks`, polling), HeyGen (referenciado, ainda não implementado — lança "pronto para implementar"), ffmpeg (via `ffmpeg-static`, usado para o fallback gratuito de vídeo/avatar: efeito Ken Burns combinando imagem+áudio em MP4).
- **Principais funções exportadas**: `aiStudioCapabilities()` (retorna quais provedores estão prontos, por env var); `generateAdImage()` (imagem via gpt-image, sem fallback grátis); `buildAdImagePrompt()`/`langName()` (helpers de prompt/idioma); `generateCopy()` (copy persuasiva com frameworks AIDA/PAS/BAB/4P/FAB, retorna variações); `generateQuizFunnel()` (gera estrutura completa de funil de quiz a partir de um tema); `llmJson()`/`llmText()` (wrappers genéricos OpenAI→Gemini); `generateLandingPage()` (modo blocos) e `generateLandingHtml()` (modo "vibe code" HTML+Tailwind); `generateNarration()` (TTS, cascata ElevenLabs→OpenAI); `cloneVoice()`, `listVoices()`, `deleteVoice()` (gestão de vozes ElevenLabs); `generateAdVideo()` (vídeo premium via fal.ai, exige `FAL_KEY`); `generateTalkingAvatar()` (avatar premium via D-ID/HeyGen, exige chave); funções internas `imageAudioToMp4()`/`runFfmpeg()` (fallback Ken Burns) e `falTextToVideo()`/`premiumTalkingAvatar()` (chamadas aos provedores premium).
- **Env vars esperadas**: `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_COPY_MODEL`, `OPENAI_TTS_MODEL`, `GEMINI_API_KEY` (ou `GOOGLE_AI_API_KEY`), `GEMINI_COPY_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`, `IDEOGRAM_API_KEY` (não implementado), `HEYGEN_API_KEY`, `DID_API_KEY`, `FAL_KEY`, `FAL_VIDEO_MODEL`, `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `FFMPEG_PATH`.

### `server/services/ebookStudio.ts` (145 linhas)
- **Propósito**: gera e-books diagramados em página (estilo Gamma) a partir de uma descrição do usuário, em pipeline de 3 etapas (outline → expansão por capítulo → montagem final com capa/sumário/conteúdo/CTA).
- **Provedores externos**: nenhum diretamente — reutiliza `llmJson()` de `aiStudio.ts` (portanto depende, indiretamente, de OpenAI ou Gemini).
- **Função exportada principal**: `generateEbook(input: EbookInput)` — calcula nº de capítulos/páginas a partir do parâmetro `paginas` (6–60), chama a IA para o outline, depois uma chamada por capítulo para gerar os blocos de conteúdo (`heading`/`subheading`/`paragraph`/`list`/`callout`/`quote`/`stats`/`image`/`divider`, sanitizados e limitados por `sanitizeBlocks()`), e monta o e-book final com página de capa, sumário e CTA de encerramento.
- **Env vars esperadas**: nenhuma direta (herda `OPENAI_API_KEY`/`GEMINI_API_KEY` via `aiStudio.ts`).

### `server/services/asaas.ts` (1465 linhas) — gateway de pagamento principal
- **Propósito**: cliente completo da API Asaas (v3) para cobrança com cartão de crédito, PIX, assinaturas recorrentes, transferências PIX (saques) e reembolsos — é o provedor de pagamento primário da Lowfy (assinaturas, marketplace e saques de comissão de afiliados).
- **Provedor externo**: Asaas (`api.asaas.com`/`api-sandbox.asaas.com`), via `axios`.
- **Principais métodos/funções**: `simulatePayment()` (simula taxas de venda, com fallback para tabela de taxas conhecida se a API falhar/retornar incompleto — 2,99%+R$0,49 à vista, 3,99% em 2-6x, 4,99% em 7-12x); `calculateTotalWithFees()` (calcula valor bruto que o comprador paga para o vendedor receber um valor líquido desejado); `calculateInstallmentSurcharge()` (calcula os juros de parcelamento repassados ao comprador, comparando baseline 1x vs Nx); `createCreditCardPayment()` (cria cliente + cobrança tokenizada); `getPaymentStatus()`, `refundPayment()`; `createPixTransfer()` (usado nos saques de marketplace e de referral); `createRecurringSubscription()`, `getSubscription()`, `updateSubscription()`, `deleteSubscription()`, `updateSubscriptionCard()`, `listSubscriptionPayments()` (motor de assinaturas recorrentes); `listAllCustomers()`, `disableCustomerNotifications()`/`disableAllCustomerNotifications()` (administrativo, evita notificações duplicadas do Asaas). Expõe `getAsaasService()` (singleton, lança erro se não configurado) e `getAsaasServiceSafe()` (retorna `null`).
- **Env vars esperadas**: `ASAAS_TOKEN`, `ASAAS_ENVIRONMENT` (`sandbox`|`production`).

### `server/services/podpay.ts` (309 linhas) — gateway de pagamento secundário
- **Propósito**: cliente da API PodPay, usado para transações PIX do marketplace e saques (alternativa/complemento ao Asaas).
- **Provedor externo**: PodPay (`api.podpay.co`), via `axios` com Basic Auth (base64 de `publicKey:secretKey`).
- **Principais métodos**: `createPixTransaction()` (cria transação PIX de pedido do marketplace, com `postbackUrl` apontando para `/api/webhooks/podpay`); `createWithdrawal()` (saque via chave `x-withdraw-key` separada); `getBalance()`; `getTransactionStatus()`; `refundTransaction()`. Expõe `getPodpayService()` (singleton, lança se faltar config) e `getPodpayServiceSafe()`.
- **Env vars esperadas**: `PODPAY_PUBLIC_KEY`, `PODPAY_SECRET_KEY`, `PODPAY_WITHDRAW_KEY`, `PODPAY_BASE_URL` (opcional, default `https://api.podpay.co`), além de `REPLIT_DOMAINS` (usado para montar a URL de postback do webhook).

### `server/services/facebookConversions.ts` (248 linhas) — Meta Conversions API
- **Propósito**: envia eventos de conversão server-side (Purchase, Lead) para a Meta Conversions API, complementando o pixel do navegador para melhorar a qualidade de correspondência de eventos (EMQ).
- **Provedor externo**: Facebook/Meta Graph API (`graph.facebook.com/v21.0`), pixel ID fixo no código (`1097300724975493`).
- **Funções exportadas**: `sendPurchaseEvent()` (hasheia e-mail/telefone/nome via SHA-256, envia `value`, `currency`, `content_ids`, `order_id`, e parâmetros de EMQ como IP, user agent, `fbc`/`fbp`); `sendLeadEvent()` (mesmo padrão para eventos de Lead). Ambas retornam `false` silenciosamente se a chave não estiver configurada.
- **Env vars esperadas**: `META_ACCESS_TOKEN`.

### `server/services/railwayDomains.ts` (60 linhas) — domínios customizados via Railway
- **Propósito**: automatiza a conexão de domínios próprios dos clientes ao serviço hospedado no Railway (adiciona o domínio, Railway emite o certificado SSL e retorna os registros DNS que o cliente deve configurar).
- **Provedor externo**: Railway GraphQL API (`backboard.railway.com/graphql/v2`).
- **Funções exportadas**: `railwayConfigured()` (checa se há token); `addCustomDomain()` (mutation `customDomainCreate`, retorna `id`/`domain`/`dnsRecords`); `deleteCustomDomain()` (mutation `customDomainDelete`, com log em caso de falha); `getDomainStatus()` (query `domains` filtrando pelo domínio, para consultar status de DNS/certificado).
- **Env vars esperadas**: `RAILWAY_API_TOKEN` (obrigatória — sem ela, `railwayConfigured()` retorna `false`), `RAILWAY_API_URL` (opcional), `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID` (todas com defaults fixos do projeto atual no código).

---

**Arquivos-fonte usados**: `shared/schema.ts`, `shared/domainConfig.ts`, `server/routes.ts` (grep estrutural), `server/routes/referrals.ts`, `server/services/aiStudio.ts`, `server/services/ebookStudio.ts`, `server/services/asaas.ts`, `server/services/podpay.ts`, `server/services/facebookConversions.ts`, `server/services/railwayDomains.ts` — todos em `C:\Users\joao lucas\Desktop\Contratos e projetos\Lowfy\Lowfy-20`.

---

## Casca da Aplicação (Shell / Navegação)

### Visão geral

- **Arquivo raiz:** `client/src/App.tsx`.
- No topo da árvore, `App()` faz uma checagem de host antes de montar qualquer coisa: `isCustomQuizHost()` compara `window.location.hostname` contra a lista de hosts do próprio app (`lowfy.com.br`, `www.lowfy.com.br`, `localhost`, `127.0.0.1` e subdomínios `*.railway.app`, `*.replit.dev`, `*.repl.co`, `*.vercel.app`). Qualquer outro hostname (domínio próprio configurado por um cliente para seu funil) faz o `App` renderizar **apenas** `<HostQuizPlay />` dentro de `ErrorBoundary` + `Suspense` — sem `QueryClientProvider`, sem `SidebarProvider`, sem `Layout`, sem sidebar/topbar algum. É o funil do quiz servido "puro" naquele domínio.
- Nos hosts do app principal, a árvore de providers é: `ErrorBoundary` → `QueryClientProvider` → `SocketProvider` → `SidebarProvider` → `SubscriptionProvider` → `TooltipProvider` → `SEOProvider` → (`MetaPixelInitializer`, `GoogleAnalyticsInitializer`, `Toaster`, `Router`).
- `Router()` usa `wouter` (`Switch`/`Route`). Chama `useAuthRedirect()` (redireciona não-autenticado para `/login?redirect=...` quando a rota não está na lista pública) e `usePreloadPages(isAuthenticated)` (pré-carrega chunks lazy). Enquanto `isLoading` (auth carregando), renderiza `PageLoader` de tela cheia (logo Lowfy + spinner + "Carregando...").
- A rota `/q/:slug` (quiz público por slug, dentro do domínio do app) é declarada **fora** de qualquer verificação de autenticação — sempre acessível, fullscreen, via `QuizPlay`.
- Quando **não autenticado**, apenas rotas públicas são montadas sem `Layout`: `/`, `/login`, `/reset-password`, previews de clonador/presell, páginas legais (`/termos`, `/privacidade`, `/licenca-plr`, `/direitos-autorais`), checkout de assinatura (`/assinatura/checkout*`, `/subscription/checkout*`, páginas de PIX/sucesso/aguardando) e `/ativar-conta`.
- Quando **autenticado**, várias rotas continuam fullscreen (sem `Layout`): previews de clonador/presell, `/checkout` (via `CheckoutRouter`, que redireciona para `/assinatura/checkout` se a query tiver `plan`/`cupom`, senão mostra o `Checkout` do marketplace), PIX do marketplace, tela de "aguardando confirmação", políticas do marketplace, sucesso/falha de pedido, todo o fluxo de checkout de assinatura, e `/ativar-conta`. Todas as demais rotas ficam dentro de `<Layout><ProtectedContent>...</ProtectedContent></Layout>`.
- `ProtectedContent` é um wrapper que lê a `location` atual via `useLocation()` e envolve as `Route`s internas com `<ProtectedRoute currentPath={location}>`.
- Rotas `/admin/*` são adicionalmente envolvidas por `<AdminRoute>`.
- Qualquer caminho não mapeado cai no `<Route component={NotFound} />` final.

### Layout (`client/src/components/Layout.tsx`)

- Estrutura: `<div class="min-h-screen flex">` contendo `<Sidebar />` (fixa/sticky à esquerda) + coluna à direita (`flex-1 flex-col`) com `<TopBar />` no topo e `<main>` rolável abaixo, envolvendo o conteúdo em um container centralizado (`max-w-7xl`) com padding. O conteúdo da página (`children`) é envolto em `Suspense` com fallback `ContentLoader` (spinner + "Carregando...", ocupando 60vh) — usado para o code-splitting das páginas lazy, mantendo sidebar/topbar visíveis durante a troca de rota.
- `<BugReportButton />` é renderizado fixo (bottom-right) em todas as telas que usam `Layout`.

### Sidebar (`client/src/components/Sidebar.tsx`)

Comportamento geral:
- Responsiva: em mobile é um drawer (`fixed`, `translate-x-full/0`, largura `w-72`) com overlay escuro fechável por clique; em desktop é `sticky`, largura `lg:w-72` (expandida) ou `lg:w-20` (colapsada, com toggle persistido em `localStorage['sidebar-collapsed']`).
- Cabeçalho: logo Lowfy (`lowfy-logo-dark.webp` expandida / `lowfy-logo-green.webp` apenas ícone quando colapsada), botão de colapsar (`PanelLeftClose`/`PanelLeftOpen`) e botão de fechar no mobile (`X`).
- Label de seção "Plataforma" acima da navegação principal (oculto quando colapsada).
- Cada item usa hover-preload de página (`preloadOnHover`) e destaque visual quando ativo (`isNavLinkActive`, comparação exata de rota).

**Itens de menu, na ordem:**

1. **Navegação principal (`mainNav`)** — sempre visível:
   - Timeline — ícone `Home` — `/`
   - Meus PLRs — ícone `BookOpen` — `/plrs`
   - Ferramentas IA — ícone `Sparkles` — `/ai-tools`
   - Estúdio IA — ícone `Wand2` — `/ai-studio`
   - Criador de Ebooks — ícone `BookOpen` — `/ebooks`
   - Quiz Builder — ícone `MousePointerClick` — `/quiz-builder`
   - Cursos Online — ícone `GraduationCap` — `/courses`
   - White Label — ícone `Briefcase` — `/services`
   - **Painel Admin** (só se `user.isAdmin`) — ícone `Shield` — item pai colapsável (clique alterna `isAdminExpanded`, mostra `ChevronDown`/`ChevronRight`); ao expandir mostra sub-itens indentados (ícones menores `w-4 h-4`, texto `text-xs`):
     - Analytics — `BarChart3` — `/admin/analytics`
     - Analytics de Clonagem — `Globe` — `/admin/clonagem-analytics`
     - Usuários — `Users` — `/admin/usuarios`
     - Conteúdo — `Database` — `/admin/conteudo`
     - Cursos Online — `GraduationCap` — `/admin/cursos`
     - Marketplace — `ShoppingBag` — `/admin/marketplace`
     - Comunidade — `MessageCircle` — `/admin/comunidade`
     - White Label e Tools IA — `Wrench` — `/admin/servicos`
     - Bugs Reportados — `Bug` — `/admin/bugs`
     - Financeiro — `Wallet` — `/admin/financeiro`
     - Checkouts Abandonados — `ShoppingCart` — `/admin/checkout-abandonado`
     - Afiliados — `Users` — `/admin/afiliados`
     - Vendedores — `TrendingUp` — `/admin/vendedores`
     - Reembolsos de Assinatura — `DollarSign` — `/admin/subscription-refunds`
     - Uso de IA (OpenAI) — `Sparkles` — `/admin/ai-usage`
     - WhatsApp — `Phone` — `/admin/whatsapp`

2. **Seção "Utilidades"** (separador com borda; item pai colapsável, ícone `Wrench`, toggle `isUtilitiesExpanded`):
   - Plugins — `Puzzle` — `/plugins`
   - Páginas e Templates — `FileText` — `/templates`
   - Modelos N8N — `Wrench` — `/modelos-n8n`
   - Clonador de Páginas — `Globe` — `/clonador`
   - Criador de Páginas — `Layout` — `/presell-dashboard`
   - Agente de IA — ícone `Sparkles` — `href: null` (não navegável), badge secundário **"em breve"**, estilo esmaecido/`cursor-default`
   - Hack Ads — ícone `Target` — `href: null`, badge **"em breve"**, mesmo estado desabilitado

3. **Seção Comunidade** (novo separador):
   - Fórum — `MessageSquare` — `/forum`
   - Marketplace — `ShoppingBag` — `/marketplace` — item especial: clique **previne navegação** e alterna (`isMarketplaceExpanded`) um submenu com `ChevronDown`/`ChevronRight`. Sub-itens (indentados):
     - Vitrine — `ShoppingBag` — `/marketplace/vitrine`
     - Meus Produtos — `Target` — `/marketplace/meus-produtos`
     - Compras — `ShoppingCart` — `/marketplace/compras`
     - Financeiro — `Wallet` — `/marketplace/financeiro`
   - Suporte — `HelpCircle` — `/support`

4. **Seção do usuário** (novo separador):
   - Indicações — `Users` — `/indicacoes`
   - Assinatura — `CreditCard` — `/assinatura`
   - Perfil — `User` — `/profile`

5. **Rodapé (perfil do usuário)**: avatar circular (`user.profileImageUrl` ou iniciais geradas a partir de `user.name`), nome (`user.name || user.email || "Usuário"`), email, e botão de logout (ícone `LogOut`, vermelho) que dispara `logoutMutation` (`POST /api/auth/logout`), limpa `localStorage['auth_token']`, invalida cache de `/api/auth/user`, mostra toast e redireciona (`window.location.href = "/"`). Quando colapsada, mostra só avatar + botão de logout empilhados.

Quando a sidebar está colapsada (`isSidebarCollapsed`), todos os itens somem os textos/badges/chevrons, mostram apenas ícone centralizado com `title` (tooltip nativo), e os submenus expansíveis não são renderizados.

### TopBar (`client/src/components/TopBar.tsx`)

Barra fixa (`sticky top-0`, altura `h-14`, fundo semi-transparente com blur). Da esquerda para a direita:
- Botão de menu mobile (`Menu`, só `lg:hidden`) que chama `toggleSidebar()` do `SidebarContext`.
- Campo de busca (`Input` com ícone `Search`, placeholder "Buscar...") — visível apenas em telas `sm:` ou maiores; **não há lógica de busca conectada** (sem `onChange`/mutation visível no arquivo).
- **Notificações**: `<NotificationsModal />` (ver componente abaixo) renderizado como ícone de sino com badge de contagem.
- **Carrinho**: ícone `ShoppingCart` linkando para `/marketplace/cart`, com badge de contagem (soma `quantity` dos itens de `GET /api/marketplace/cart`, capado em "99+").
- **Badge de XP/Gamificação** (`hidden lg:flex`, só desktop): ícone `Trophy` (âmbar), texto `"{xpInCurrentLevel} / {xpNeededForNextLevel} XP"` e `"Nv {level}"`, mais uma barra `Progress` com `progressPercentage` — todos vindos do hook `useGamification()`. Link para `/profile`.
- **Avatar do usuário**: círculo com foto (`user.profileImageUrl`) ou iniciais; também linka para `/profile`. Não há dropdown de conta — é um link direto para o perfil.
- Escuta eventos de socket `points_updated` (via `SocketContext`) para invalidar a query de pontos do usuário quando o `userId` bate.
- Não há seletor de idioma na TopBar em si (o app é pt-BR fixo no shell; seletor de idioma existe dentro do Estúdio IA, por página).

### NotificationsModal (`client/src/components/NotificationsModal.tsx`)

- Ícone de sino (`Bell`) com `Badge` de contagem de não lidas, dentro de um `Popover` (não é um `Dialog` — apesar do nome do componente).
- Ao abrir (`isOpen=true`): busca `GET /api/notifications` (com `refetchInterval` de 30s só enquanto aberto) e dispara `POST /api/notifications/mark-all-read` automaticamente se houver não lidas.
- Conteúdo do popover: cabeçalho "Notificações" + badge "{n} novas"; lista das 6 notificações mais recentes, cada uma com avatar do ator (ou emoji por tipo: ❤️ like/reaction, 💬 comment/reply, 👤 follow, 🔄 share, 🏆 badge, 🔔 default), mensagem, tempo relativo (`formatTimeAgo`) e ponto indicador de não lida.
- Clique em uma notificação: marca como lida (`POST /api/notifications/:id/read`), fecha o popover e navega para o destino calculado por `getNotificationLink` (varia por tipo: follow → `/timeline`; tópico de fórum → `/forum/:id#reply-:id`; post → `/timeline?post=:id#comment-:id`; badge/achievement → `/profile`; fallback `/timeline`), com scroll suave e destaque temporário (`ring`) no elemento alvo quando aplicável.
- Estado vazio: ícone `Bell` grande + "Nenhuma notificação". Estado de carregamento: texto "Carregando notificações...".
- Rodapé: botão "Ver todas as notificações" linkando para `/notifications`.

### Gate de assinatura / feature-lock

Duas camadas cooperam:

**1. `ProtectedRoute` (`client/src/components/ProtectedRoute.tsx`)** — envolve todas as rotas dentro do `Layout`.
- Mapeia caminho → `FeatureType` via `ROUTE_TO_FEATURE_MAP` (ex.: `/plrs` → `plrs`, `/clonador` → `clonador`, etc.) e usa `useFeatureAccess()` para checar `hasAccess(feature)`.
- Rotas em `FREEMIUM_ROUTES` (`/timeline`, `/forum`, `/marketplace`, `/indicacao`, `/perfil`, `/assinaturas`, `/suporte`, `/white-label`, `/configuracoes`, `/notificacoes`, `/login`, `/register`, `/forgot-password`, `/reset-password`) sempre renderizam o conteúdo, ignorando o gate.
- Enquanto `useAuth().isLoading`, mostra spinner central ("Carregando...").
- Se a rota exige uma feature bloqueada:
  - Se o usuário está com assinatura expirada/cancelada **e** plano é "free" → mostra `<SubscriptionExpiredModal isOpen daysExpired={0} />` sobre um placeholder "Acesso restrito".
  - Caso contrário → mostra `<FeatureLockedOverlay>` com o nome amigável da feature (mapa `featureNames`) e descrição diferenciada para features premium (`clonador`, `presell-builder`, `quiz`, `n8n`: "disponível apenas para assinantes... Assine agora") vs. outras ("Atualize seu plano...").

**2. `SubscriptionExpiredModal` (`client/src/components/SubscriptionExpiredModal.tsx`)**
- Modal customizado (não usa `Dialog` do design system) posicionado para respeitar a largura da sidebar (`left: sidebarWidth`), com overlay escuro/blur.
- Conteúdo: ícone `Lock` em círculo vermelho; título "Sua assinatura expirou"; badge de "Expirada há N dia(s)" se `daysExpired > 0`; texto de renovação citando "R$ 99,90/mês"; lista de benefícios (✓ +39 Ferramentas de IA Premium, ✓ Criador e Clonador de Páginas, ✓ +350 Cursos Exclusivos, ✓ PLRs Globais em 7 idiomas, ✓ E muito mais...); aviso extra em vermelho se `daysExpired >= 10` ("Suas páginas serão excluídas em breve. Renove agora!"); botão fechar (`X`) no canto.
- Botões: **"Renovar Agora"** (`CreditCard`, verde) → fecha modal e navega para `/assinatura/checkout?plan=mensal`; **"Voltar para Timeline"** → fecha modal e navega para `/timeline`.
- Também é disparado globalmente pelo `SubscriptionContext` (`showExpiredModal`/`handleSubscriptionError`) quando uma chamada de API lança `SubscriptionExpiredError` (ver `lib/queryClient`), independente da rota — fechado automaticamente se a rota atual virar freemium (`isFreemiumRoute`).

**3. `FeatureLockedOverlay` (`client/src/components/FeatureLockedOverlay.tsx`)**
- Tela cheia (`min-h-screen`) com `Card` centralizado: ícone `Lock`, título = nome da feature, descrição passada por prop, bloco de benefícios "Benefícios do Plano Completo" (ícone `Crown` + lista: Clonador de Páginas ilimitado, Criador de Pre-Sells automático, Meta Ads Andromeda - Campanhas completas, Quiz Interativo para vendas, Automações N8N prontas), e botão **"Desbloquear Agora"** (`ArrowRight`) → navega para `/assinatura`.

**4. `useFeatureAccess` (`client/src/hooks/useFeatureAccess.ts`)** — regra de negócio central:
- `getUserPlan()`: admin → sempre `"full"`; senão prioridade 1 é `user.accessPlan` (`"full"` ou `"basic"`); prioridade 2 é `user.subscriptionStatus === "active"` → `"full"`; senão `"free"`.
- Plano `"free"` só acessa `FREE_PLAN_ALLOWED_FEATURES` (timeline, forum, marketplace, indicacao, assinatura, perfil, white-label, suporte).
- Plano `"basic"` adiciona plrs, cursos, plugins, templates, ferramentas-ia.
- Plano `"full"` acessa tudo, incluindo as `PREMIUM_ONLY_FEATURES` (clonador, presell-builder, quiz, n8n) que nenhum outro plano libera.

**5. `useAccessControl` (`client/src/hooks/useAccessControl.ts`)** — lógica paralela de expiração de assinatura (usada por outras partes do app, com sua própria lista de `FREEMIUM_ROUTES`/`PROTECTED_ROUTES`):
- Admin sem `testingAsNonAdmin` sempre tem acesso.
- `accountStatus === 'blocked'` → sem acesso a nada, nem freemium.
- `accountStatus === 'inactive'` → só freemium.
- `subscriptionStatus === 'refunded'` → perde acesso pago imediatamente (sem checar data de expiração), mantém freemium.
- `'active'`/`'trial'`: ativo até `subscriptionExpiresAt`; depois disso vira inativo e calcula `daysExpired`.
- `'canceled'`: mantém acesso até `subscriptionExpiresAt` (fim do período já pago); depois disso, inativo.
- `'expired'`: calcula `daysExpired` a partir de `subscriptionExpiresAt`.

### ProtectedRoute vs. AdminRoute vs. useAuthRedirect (checagem em camadas)

- **`useAuthRedirect`** (nível mais alto, roda em todo `Router`): se não autenticado e a rota não estiver na lista pública (`/`, `/login`, `/reset-password`, previews, páginas legais, checkout de assinatura, `/ativar-conta`), redireciona para `/login?redirect=<rota>`.
- **`ProtectedRoute`**: já documentado acima — trata bloqueio por *feature/plano*, não por autenticação.
- **`AdminRoute`** (`client/src/components/AdminRoute.tsx`): usado apenas nas rotas `/admin/*`. Enquanto `isLoading`, não renderiza nada (`null`). Se carregado e `!user || !user.isAdmin`, redireciona silenciosamente para `/` via `useEffect` e também não renderiza nada nesse frame. Só renderiza `children` quando `user.isAdmin === true`.

### Loading global e Error Boundary

- **`PageLoader`** (definido em `App.tsx`): usado como fallback do `Suspense` que envolve todo o `Router` e durante `isLoading` de auth — tela cheia com gradiente, logo Lowfy e spinner + "Carregando...".
- **`ContentLoader`** (duplicado em `App.tsx` e em `Layout.tsx`): fallback de `Suspense` usado dentro do `Layout` para transições de página lazy — mantém sidebar/topbar visíveis, spinner + "Carregando..." ocupando 60vh da área de conteúdo.
- **`ErrorBoundary`** (`client/src/components/ErrorBoundary.tsx`): class component React que envolve todo o `App` (tanto o branch de host customizado de quiz quanto o app principal). Em caso de erro não tratado, renderiza tela cheia com ícone `AlertTriangle`, título "Algo deu errado", mensagem genérica, `<details>` expansível com `error.message`, e botão "Recarregar página" que reseta o estado e faz `window.location.reload()`.

### Comportamentos especiais de roteamento (resumo)

- **Domínio próprio do cliente**: qualquer hostname fora da whitelist do app serve `HostQuizPlay` diretamente na raiz, sem nenhum chrome do app (sem sidebar/topbar/providers de app).
- **Quiz público por slug dentro do app**: `/q/:slug` sempre acessível via `QuizPlay`, fora do `Switch` condicional de autenticação, sem `Layout`.
- **Rotas fullscreen (sem `Layout`)**: previews de clonador (`/clonador/preview`) e pre-sell (`/presell/preview`); todo o fluxo de checkout — marketplace (`/checkout`, `/marketplace/checkout/pix/:transactionId?`, `/marketplace/checkout/awaiting-confirmation`, `/marketplace/order/success`, `/marketplace/order/failure`, `/marketplace/politicas`) e assinatura (`/assinatura/checkout`, `/subscription/checkout`, variantes de PIX, sucesso, aguardando); e `/ativar-conta`. O objetivo declarado no comentário do código é "checkout fullscreen para alta conversão".
- **`CheckoutRouter`**: componente que decide, na própria rota `/checkout`, se redireciona para o checkout de assinatura (`/assinatura/checkout?plan=...&cupom=...`) quando a query string traz `plan` ou `cupom`, ou renderiza o checkout normal do marketplace (`Checkout`) caso contrário.

---

## Páginas Públicas: Home, Login/Cadastro e Legal

### Página: / — Home (Landing Page de Marketing)

- **Arquivo fonte**: `client/src/pages/Home.tsx` (1504 linhas).
- **Rota**: `/` — registrada em `client/src/App.tsx` (`<Route path="/" component={Home} />`, componente carregado via `lazy(() => import("@/pages/Home"))`).
- **Componentes de `client/src/components/landing/` importados por `Home.tsx`**: `Navbar.tsx` (import direto), `InfiniteCarousel.tsx`, `UiCarousel.tsx`, `BentoFeatures.tsx` (named export `BentoFeatures`), `Testimonials.tsx` (todos via `lazy()`). Não são importados: `FeatureCard.tsx`, `GridBeam.tsx`, `HeroSection.tsx`, `Spotlight.tsx` (não referenciados em `Home.tsx`). `Testimonials.tsx` por sua vez importa `client/src/components/landing/ui/testimonials-columns-1.tsx` (`TestimonialsColumn`).
- Constantes de conteúdo vêm de `client/src/lib/landing-constants.ts` (`STATS`, `AI_TOOL_CATEGORIES`, `FAQ_ITEMS`, `COURSE_CATEGORIES`, `PLR_LANGUAGES`, `PLR_INCLUDES`, `SELLABLE_ITEMS`, `CLONER_PROCESS_STEPS`, `FORUM_TOPICS`, `FORUM_CATEGORIES`, `QUIZ_FEATURES`, `QUIZ_USE_CASES`, `BENEFITS_GRID`, `CAROUSEL_LOGOS`).

#### 2. Objetivo

Landing page pública de vendas para visitantes não autenticados. Vende assinatura única da "Lowfy" — um pacote "tudo em um" que substitui dezenas de ferramentas pagas de marketing digital (IA, design, SEO, mineração de anúncios), acrescido de um clonador/criador de páginas, biblioteca de PLR multilíngue, +350 cursos, marketplace interno, comunidade/fórum gamificado e programa de afiliados com comissão recorrente de 50%. A proposta central, no hero: **"O Marketing Digital Ficou Covarde."** — construir, lançar e escalar no mesmo dia, "economizando mais de R$ 7.000/mês".

#### 3. Layout geral (ordem das seções)

1. Navbar fixa (`Navbar.tsx`)
2. Hero cinemático (badge de oferta, headline, subheadline, CTAs, stats)
3. `InfiniteCarousel` — carrossel infinito de logos de ferramentas (prova social/parceiros)
4. Bento Grid de Benefícios ("Por que a Lowfy?") — `id="por-que-lowfy"`
5. Showcase/Arsenal de Ferramentas com abas por categoria + `UiCarousel` — `id="features"`
6. PLR Global (internacionalização, 7 idiomas) — `id="plr"`
7. Lowfy Academy (cursos) com `UiCarousel` — `id="academy"`
8. Quiz Interativo (simulador estático) — `id="quiz"`
9. Clonador & Criador de Páginas (abas com vídeo demo) — `id="cloner"`
10. Comunidade (Fórum / Timeline / Gamificação, abas verticais) — `id="community"`
11. `BentoFeatures` — bônus exclusivo (plugins, automações N8N, templates)
12. Marketplace (venda de produtos dentro da Lowfy) — `id="marketplace"`
13. Afiliados (comissão 50% recorrente) — `id="afiliado"`
14. `Testimonials` — depoimentos em colunas animadas — `id="testimonials"`
15. Pricing (planos mensal/anual + lista de benefícios + bônus + garantia) — `id="pricing"`
16. FAQ (acordeão) — `id="faq"`
17. Footer completo (marca, links, legal, contato, copyright)

#### 4. Inventário completo de UI

**Navbar (`Navbar.tsx`)**
- Logo "Lowfy" (`/logo-dark.webp`, alterna claro/escuro).
- Link direto "Início" (`href="#"`).
- Dropdown "Ferramentas" (hover no desktop, acordeão no mobile) com itens: Arsenal de Ferramentas (`#features`, "+39 ferramentas premium"), Pack de Plugins (`#bonus`, "Plugins WordPress inclusos"), +250 Landing Pages (`#bonus`, "Modelos prontos"), +150 N8N Automações (`#bonus`, "Automações inteligentes"), Criador de Site (`#cloner`, "Crie sites profissionais"), Clonador de Páginas (`#cloner`, "Clone qualquer página"), Quiz Interativo (`#quiz`, "Engajamento viral"), PLR Global (`#plr`, "Ganhe em dólar com PLRs"), Academy (`#academy`, "+350 cursos disponíveis").
- Dropdown "Comunidade" com itens: Comunidade Black (`#community`, "Networking exclusivo"), Marketplace (`#marketplace`, "Venda seus produtos"), Afiliado (`#afiliado`, "Lucre 50% recorrente").
- Links diretos: "Depoimentos" (`#testimonials`), "Preço" (`#pricing`), "FAQ" (`#faq`).
- Botão de alternância de tema claro/escuro (ícone Sol/Lua).
- Link "Login" (`/login`).
- Botão CTA "Começar Agora" (`#pricing`).
- Menu mobile hamburguer com acordeão equivalente + mesmos CTAs (Login, Começar Agora).

**Hero Section**
- Badge vermelho: "OFERTA DE FINAL DE ANO" (com ponto pulsante).
- H1: "O Marketing Digital" / "Ficou Covarde." (gradiente verde no segundo trecho).
- Subheadline: "+39 Ferramentas de IA Premium, Criador e Clonador de Páginas, IA, templates e plugins, +350 Cursos e Automação Total." seguido de "Economize mais de R$ 7.000/mês" e "Construa, lance e escale no mesmo dia."
- Botão primário: "Desbloquear Meu Acesso Agora" + ícone Rocket → `href="#pricing"`.
- Botão secundário: "Ver Tudo Por Dentro" + ícone Play (sem `href`/ação definida no código, é um `<button>` decorativo).
- Texto de urgência: "Garanta seu acesso exclusivo antes que a oferta acabe!" (ícone Zap).
- Fundo: imagem de banco de imagens do Unsplash (`moneyBg`, placeholder pós-limpeza do código) com overlay escuro e grade sutil decorativa.
- Bloco de estatísticas (`STATS`): "R$ 7k+ / Economia Mensal", "39+ / Ferramentas", "350+ / Cursos", "+500 / Membros Ativos".

**InfiniteCarousel** — faixa horizontal contínua (auto-scroll CSS) com logos de ferramentas parceiras/mercado (ChatGPT-4, Midjourney, SemRush, Canva Pro, CapCut, HeyGen, Sora, SpyHero, PipiAds, Envato, Elementor, SimilarWeb, Adspower, Grok AI, Runway, Gamma, Leonardo AI, BigSpy, Social Peta, AdsParo, SeaArt, You.com); no mobile exibe só os 8 primeiros. Logos ficam em preto/branco conforme o tema.

**Bento de Benefícios ("Por que a Lowfy?", `BENEFITS_GRID`)**
- Título: "Por que a **Lowfy**?" / subtítulo: "Tudo em um só lugar."
- Cards (ícone + título + descrição):
  1. Box — "Tudo em Um Lugar" — "Pare de pagar por múltiplas assinaturas e centralize suas ferramentas, cursos e vendas em um único sistema." (ocupa 2 colunas)
  2. Wallet — "Economia Brutal" — "Economize até R$ 7.000/mês em ferramentas profissionais e softwares essenciais."
  3. Banknote — "Renda Passiva" — "Ganhe 50% de comissão recorrente para sempre, ao indicar pessoas para a plataforma. Renda passiva garantida!"
  4. Globe — "Internacional" — "Venda seus produtos em Dólar, Euro, Peso, Franco e outras moedas com PLRs globalmente testados e traduzidos para diversos mercados." (ocupa 2 colunas)

**Arsenal de Ferramentas (`#features`)**
- Título: "Arsenal de **Ferramentas**" / subtítulo: "Mais de 39 ferramentas premium, +250 landing pages, +150 automações N8N, pack de plugins — tudo que você precisa para criar, vender e escalar — segurança e perfis prontos."
- Abas de categoria (`AI_TOOL_CATEGORIES`, botão ativo em verde):
  - "Inteligência Artificial (15)" — 15 ferramentas: ChatGPT-5 (US$ 20, "Modelo de Linguagem Avançado"), Sora AI (US$ 99, "Geração de Vídeo Realista"), Leonardo AI (US$ 12, "Geração de Arte Digital"), Hey Gen (US$ 24, "Avatares Falantes para VSL"), Midjourney (US$ 10, "Imagens Artísticas de Alta Qualidade"), Runway (US$ 15, "Edição de Vídeo com IA"), Copilot Pro (US$ 20, "Assistente Microsoft Integrado"), Perplexity AI (US$ 20, "Motor de Busca Inteligente"), Gamma App (US$ 15, "Slides e Apresentações Automáticas"), SeaArt (US$ 99, "Arte Anime e Ilustração"), Ideogram (US$ 99, "Textos em Imagens Perfeitos"), Grok AI (US$ 16, "IA do X/Twitter em Tempo Real"), Synthesia (US$ 30, "Vídeos com Avatares AI"), You.com (US$ 15, "Buscador com Chat AI"), Flaticon (US$ 10, "Ícones e Stickers Vetoriais").
  - "Design & Edição (6)" — 5 ferramentas listadas no array (rótulo do título diz "6" mas o array tem 5 itens): Canva Pro (R$ 34, "Design Gráfico (4 Links)"), CapCut Pro (R$ 40, "Editor de Vídeo Completo"), Envato Elements (US$ 16, "Downloads Ilimitados"), Freepik Premium (R$ 60, "Vetores e PSDs"), Remini Pro (R$ 30, "Restauração de Fotos IA").
  - "SEO & Analytics (3)" — SemRush (US$ 129, "Suite Completa de SEO"), RankerFox +80 (US$ 50, "Pack com 80 ferramentas SEO"), SimilarWeb (US$ 125, "Análise de Tráfego Web").
  - "Mineração (8)" — AdsParo (R$ 497, "Espionagem de Anúncios e Trends"), American Swipe (US$ 49, "Arquivos de Referência de Marketing"), GuruKiller (R$ 297, "Minerador de PLRs e Infoprodutos"), BigSpy (US$ 99, "Spy Multi-plataforma (FB, IG, TT)"), SpyHero (R$ 497, "Inteligência para Afiliados"), Social Peta (US$ 69, "Análise de Ads e Tendências"), ShopHunter (US$ 50, "Mineração para Dropshipping"), PipiAds (US$ 165, "Espionagem Exclusiva TikTok").
- Cada card de ferramenta (dentro do `UiCarousel`, com setas de navegação `prev`/`next`): logo, nome, descrição curta, selo "Incluso" (check verde) e badge de preço de mercado (verde se "Free", vermelho caso contrário — atualmente nenhum item usa "Free").

**PLR Global (`#plr`)**
- Badge: "INTERNACIONALIZAÇÃO".
- Título: "**Ganhe em Dólar** com PLRs Globais."
- Texto: "Esqueça a saturação do mercado brasileiro. Nossa biblioteca oferece PLRs validados, com estruturas completas, tradução nativa e prontas para gerar lucros em diversos mercados internacionais."
- "Como Funciona:" lista numerada: 1) "Baixe o pacote completo (JSON + MP4 + PDF)"; 2) "Suba no WordPress com Elementor Pro em 1 clique (fácil e rápido)"; 3) "Comece a vender em Dólar, Euro ou outras moedas imediatamente".
- Card "Disponível em 7 Idiomas" com bandeiras (`PLR_LANGUAGES`: BR, US, ES, FR, AE, CN, IN) e lista do que cada PLR inclui (`PLR_INCLUDES`): Página de Vendas, VSL Cinematográfica, Ebook Diagramado, Quiz de Alta Conversão, Certificado de Revenda (cada item com check verde).

**Lowfy Academy (`#academy`)**
- Badge: "LOWFY ACADEMY".
- Título: A "**Netflix**" do Digital.
- Subtítulo: "Acesso a mais de 350 cursos do mercado, com conteúdo exclusivo dos maiores players do marketing digital."
- Carrossel (`UiCarousel`) de categorias de curso (`COURSE_CATEGORIES`), cada card com imagem de fundo, ícone, nome e contagem, e call-to-action "Assistir Trilha →": Tráfego Pago (45 Cursos), Copywriting (32 Cursos), Dropshipping (28 Cursos), Marketing Viral (15 Cursos), Automação & IA (50 Cursos), Design & VSL (40 Cursos).

**Quiz Interativo (`#quiz`)**
- Badge: "ENGAJAMENTO MÁXIMO".
- Título: "Quiz Interativo **Viral**."
- Textos: "Transforme visitantes frios em leads quentes e aumente suas conversões com quizzes altamente engajadores." / "Crie quizzes personalizados de diagnóstico, recomendação de produtos ou personalidade em minutos e conquiste seu público de forma viral."
- "Benefícios Imediatos:" (`QUIZ_FEATURES`): Captura de Leads ("Integre diretamente com seu CRM favorito e capture dados preciosos."), Segmentação Inteligente ("Separe clientes por nível de consciência e entregue a mensagem certa para cada um."), Engajamento Máximo ("Aumente 3x a conversão em comparação com landing pages tradicionais."), Analytics Avançado ("Veja os padrões de respostas e optimize sua estratégia.").
- Simulador de quiz **puramente decorativo/estático** (`pointer-events-none`, não interativo apesar de existirem estados `quizStep`/`quizAnswers`/`quizQuestions` no componente que não são usados nesta seção): pergunta fixa "Qual seu maior objetivo?", "Pergunta 1 de 3", barra de progresso em 33%, três opções ("Vender sem aparecer (PLR)" selecionada, "Criar minha marca pessoal", "Prestar serviços (Freelancer)"), botão "Próximo" (sem ação).

**Clonador & Criador de Páginas (`#cloner`)**
- Duas abas pill (fundo escuro): "Clonador de páginas" (ativa por padrão) e "Clonador de Página" (rotulagem idêntica no código, segunda aba na prática corresponde ao builder/criador).
- Aba Cloner: título "**Clonagem** Profissional de Páginas", texto "Importe, limpe, edite e publique — tudo em menos de 20 segundos."; coluna "Como Funciona" (`CLONER_PROCESS_STEPS`): 1) Importar Página ("Cole a URL (ex: concorrente). O sistema baixa o HTML/CSS completo."), 2) Limpeza Automática ("Remove scripts espiões, Pixels antigos do Facebook e Google Analytics."), 3) Edição Inteligente ("Troque textos, imagens e links dos botões sem tocar em código."), 4) Publicação ("Salve com seu domínio próprio e publique em 3s."); vídeo demo lazy-loaded (`/clonador-demo-compressed.mp4`, autoplay em loop mudo ao entrar em viewport).
- Aba Builder: título "Páginas de **Alta Conversão** em Segundos", texto "Crie Pre-Sells, VSLs e Páginas de Obrigado profissionais com gatilhos de escassez, urgência e persuasão — sem código."; passos: 1) Monte com Blocos ("Arraste e solte textos, imagens, timers, provas sociais e CTAs."), 2) Personalize Fácil ("Edite cores, layout e estrutura visual com total liberdade."), 3) Gatilhos que Vendem ("Escassez, urgência e elementos persuasivos integrados."), 4) Publique em Segundos ("Coloque sua página no ar e rode tráfego imediatamente. (hospedagem inclusa)"); vídeo demo lazy-loaded (`/adobe-express-demo-compressed.mp4`).

**Comunidade (`#community`)**
- Badge: "COMUNIDADE LOWFY".
- Título: "Fórum, Timeline e **Gamificação**" / subtítulo: "A Comunidade onde você evolui todos os dias."
- Três abas verticais (não fazem auto-avanço — o `useEffect` de auto-advance está comentado/desabilitado no código):
  1. **Discussões Profundas** (ícone MessageCircle) — "Conversas estruturadas sobre estratégia, tráfego, PLR, IA e escala. Aprenda diretamente com membros experientes e tópicos avançados." Conteúdo: lista de 6 tópicos de fórum (`FORUM_TOPICS`, avatares aleatórios via randomuser.me), cada card com título do tópico, tag colorida por categoria (`FORUM_CATEGORIES`: Geral, Tráfego Pago, PLRs & Dropshipping, Copy & VSL, Black Hat, Ferramentas IA) e contagem de respostas gerada aleatoriamente (`Math.floor(Math.random()*50)`, ou seja, número decorativo recalculado a cada render).
  2. **Timeline em Tempo Real** (ícone Zap) — "Feed ao estilo Facebook para interações rápidas, postagens, comentários, insights e networking com o restante da comunidade." Conteúdo simulado: card de perfil "Lucas Felipe" (Professional) com XP "3 / 100 XP", nível "Nv 1" (barra 3%), estatísticas fixas (0 Posts, 1 Nível, 0 Seguidores), "Metas Semanais" (Criador de Conteúdo +50XP 3/5, Influenciador +40XP 0/20, Iniciador de Discussões +30XP 0/2); caixa de composição de post ("Compartilhe algo interessante... Use # para adicionar hashtags!", botão "Publicar"); feed com 2 posts fictícios de "Usuário #1"/"Usuário #2" ("Compartilhou uma estratégia incrível", contadores ❤/💬/↗ zerados).
  3. **Gamificação** (ícone Trophy) — "Ganhe XP, suba de nível, desbloqueie badges e conquiste posições no ranking. A evolução vira um jogo — e você é recompensado por participar." Conteúdo: tabela de 5 níveis (Novato 0-99XP, Aprendiz 100-299XP, Contribuidor 300-599XP, Mentor 600-999XP, Mestre 1000+XP), cada um com ícone, faixa de XP e descrição.

**BentoFeatures (bônus exclusivo)**
- Badge: "Bônus Exclusivo".
- Título: "Achou que tinha acabado? Ainda tem **muito mais…**"
- Texto: "Além de tudo que você já viu que a Lowfy vai te entregar, você ainda desbloqueia um pacote EXTRA de recursos exclusivos — feito para aumentar sua performance e encurtar seu caminho até os resultados:"
- 3 cards com imagem + título + descrição:
  1. "O Arsenal Premium Que Todo Site Profissional Precisa" — "Acesse mais de 17 plugins premium atualizados Elementor Pro, JetEngine, WP Rocket, Smush Pro e muito mais. Tudo o que seu WordPress precisa para ficar rápido, poderoso e ilimitado." (imagem `/wordpress-arsenal.webp`)
  2. "Automatize Tudo com N8N e Escale Sem Limites" — "153 templates prontos de automação para N8N. Organize e-mails, integre Telegram, automatize WordPress e conecte tudo o que importa instantaneamente." (imagem `/n8n-automation.webp`)
  3. "Templates Prontos Que Transformam Seu Site em Máquina de Vendas" — "Acesse mais de 250 landing pages, sites e templates profissionais para WordPress e Elementor. Designs prontos para negócios, produtos e serviços — basta editar e publicar." (imagem `/templates-collection.webp`)
- Rodapé da seção: "Tudo isso incluso, sem custos adicionais — porque a Lowfy foi criada para você competir como os **grandes players**."

**Marketplace (`#marketplace`)**
- Badge: "MARKETPLACE".
- Título: "Lucre Dentro da **Lowfy**." / texto: "Se você tem algo para vender, a Lowfy tem quem compre. Publique, alcance usuários e gere vendas rapidamente."
- Card "O que vender?" (`SELLABLE_ITEMS`): E-books, Cursos, Templates, Planilhas, Softwares, Áudios, Mentoria, Automações.
- Mockup de painel/dashboard "Minha Loja" (decorativo, dados fixos): status "Online"; card "Disponível" com "R$ 3.240,00" e botão "SACAR →" (sem ação real); card "A Liberar" com "R$ 1.450,90"; rodapé com selos "Seguro", "Pix/Card", "Acesso imediato".

**Afiliados (`#afiliado`)**
- Título: "Lucre **50% Recorrente**"
- Texto: "Indique a Lowfy e ganhe metade do valor da assinatura todo mês." + "2 Indicações = Sua assinatura sai de graça."
- 3 cards de simulação de ganhos por indicações: "10 Indicações" → R$ 500/mês no seu bolso; card em destaque (badge "META RECOMENDADA") "50 Indicações" → R$ 2.500/mês ("Salário Júnior"); "100 Indicações" → R$ 5.000/mês ("Liberdade").

**Testimonials (`Testimonials.tsx`)**
- Badge: "Depoimentos".
- Título: "O que nossos **usuários dizem**" / texto: "Veja como a Lowfy está transformando a vida de empreendedores digitais por todo o Brasil."
- 3 colunas de cards de depoimento em scroll vertical automático contínuo (`animate-testimonial-scroll`, velocidades/atraso diferentes por coluna, cada coluna duplica os itens para loop infinito), com máscara de fade no topo/base. 23 depoimentos no total, cada um com texto (citação), nome e cargo/papel, avatar circular colorido com inicial do nome. Exemplos literais: Carlos Eduardo (Empreendedor) — "Sou da época que a Lowfy era só uns PDFs perdidos! Ver essa plataforma virar esse monstro com IA, clonador e rede social é surreal. Orgulho de ter crescido junto e lucrado em cada fase!"; Juliana Martins (Criadora de Conteúdo) — "Só de cancelar meu Canva Pro e o Semrush já paguei a assinatura da Lowfy..."; demais depoimentos cobrem PLR/clonador, networking no fórum, comissão de afiliados, ferramentas de IA (ChatGPT-4/Midjourney), gamificação, marketplace, mineração de anúncios, suporte, PLRs em espanhol/mercado LATAM, velocidade das páginas clonadas, etc. Animação via `framer-motion` (`motion.div` com `initial`/`whileInView`/`viewport once`) no cabeçalho da seção.
- Animação de entrada (`framer-motion`, `Testimonials.tsx`): fade+slide-up (`opacity:0,y:20 → opacity:1,y:0`, duração 0.8s, easing custom, `viewport={{once:true}}`) no bloco de título.

**Pricing (`#pricing`)**
- Badge vermelho pulsante: "OFERTA DE FINAL DE ANO:"
- Título: "Acesso Total Lowfy" / subtítulo: "A única assinatura que você precisa para viver de internet."
- Seletor de plano (pill tabs): "Mensal" / "Anual" (badge "-50%" no botão Anual).
- Plano Mensal: preço riscado "De R$ 997,00", badge "ECONOMIZE 90%", preço "R$ 99,99/mês", texto "Menos de R$ 3,40 por dia".
- Plano Anual: preço riscado "De R$ 11.988,00", badge "ECONOMIZE 70%", preço "R$ 360,90/ano", texto "Apenas R$ 30,07 por mês (desconto de 70%)".
- Botão CTA (dinâmico por plano): "QUERO MEU ACESSO IMEDIATO →" + subtexto "Compra segura e liberação automática" → `href="/assinatura/checkout?plan=mensal"` ou `?plan=anual` conforme aba selecionada.
- Logos de formas de pagamento: imagem `/payments-logo.webp` (alt indica Pix, Visa, MasterCard, American Express, Elo, Hipercard, Diners).
- Lista "O QUE VOCÊ VAI RECEBER:" (com preço de referência riscado quando aplicável): "+39 Ferramentas Premium (IA, Design e SEO)" (R$8.000), "Biblioteca de PLR estruturados em 7 idiomas (Baixe e Venda)", "Clonador de Páginas" (R$99,90), "Criador de Páginas" (R$99,90), "Quiz interativo" (R$99,90), "+350 Cursos dos maiores players do mundo" (R$50.000), "Marketplace: Venda seus produtos dentro da plataforma Lowfy", "Fórum de Networking VIP", "Atualizações e novos recursos sem custos".
- Bloco "+ BONUS EXCLUSIVOS" (`id="bonus"`): "+15 plugins Premium e atualizados" (R$4.000), "+150 automações N8N" (R$10.000), "+250 landing pages para wordpress" (R$5.000).
- Selo de garantia: "**RISCO ZERO:** Entre, use as ferramentas e baixe os PLRs. Se em 7 dias não gostar, devolvemos cada centavo." + texto secundário "Cancele a qualquer momento" (sem link/ação associada no código).

**FAQ (`#faq`, `FAQ_ITEMS`, acordeão)**
1. "O que está incluso na assinatura?" → "Absolutamente tudo: 39 Ferramentas Premium, 350+ Cursos dos maiores players do mundo, Plugins WordPress, Clonador de Páginas, Criador de Páginas, Sistema de PLRs Globais, Quiz Interativo, Marketplace, Fórum Secreto e muito mais. Sem upsells ou taxas ocultas."
2. "Como acesso as 39 ferramentas?" → "Dentro da Lowfy você encontrará as instruções completas e um vídeo explicativo. Geralmente os acessos funcionam via AdsPower (com perfis compartilhados) ou via login e senha direto em cada ferramenta."
3. "Posso vender meus produtos no Marketplace?" → "Sim! Você pode cadastrar seus produtos e usar nossa estrutura de pagamentos. O saque é via Pix e cai na sua conta instantaneamente. Consulte a tabela de taxas e prazo de saque na plataforma."
4. "O que vem nesses PLRs?" → "Cada PLR inclui: eBook completo, VSL (Vídeo Sales Letter), Página de Vendas, Quiz Interativo e Certificado de Conclusão. Tudo disponível em 7 idiomas diferentes para você vender globalmente."
5. "Os PLRs realmente funcionam em outros idiomas?" → "Sim. Nossa biblioteca foi traduzida e localizada nativamente para 7 idiomas, permitindo que você ganhe em Dólar e Euro sem saber falar a língua."
6. "Após a Black Friday meu plano mudará de valor?" → "Não! O valor permanecerá o mesmo sempre. Você garante o preço de R$ 99,90/mês ou R$ 360,90/ano vitaliciamente enquanto mantiver sua assinatura ativa." (nota: texto do FAQ cita R$ 99,90, enquanto a vitrine de preços exibe R$ 99,99 — divergência literal do código-fonte).
7. "Como ganho XP no Fórum?" → "Você ganha XP criando tópicos (+15), respondendo (+10) e tendo respostas marcadas como 'Melhor Resposta' (+25). Suba de nível para desbloquear áreas exclusivas e benefícios especiais."
8. "E a hospedagem dos sites que clono ou crio?" → "A hospedagem está totalmente inclusa na sua assinatura! Seus sites clonados e páginas criadas ficam hospedados nos servidores Lowfy com segurança garantida e velocidade máxima. O domínio não está incluído, mas você pode comprar a partir de R$ 2,99/ano e apontar para sua página em segundos."

**Footer**
- Coluna marca: logo Lowfy (`/logo-white.webp` no dark, `/logo-dark.webp` no light), texto "O ecossistema definitivo para quem quer dominar o marketing digital sem gastar uma fortuna. Todas as ferramentas que você precisa em um só lugar.", ícones sociais Instagram (`https://www.instagram.com/lowfybr/`), Facebook (`https://www.facebook.com/p/Lowfy-61551759668769/`), YouTube (`https://www.youtube.com/@lowfy_plrs`) — todos `target="_blank"`.
- Coluna "Plataforma": Ferramentas (`#features`), Clonador de Páginas (`#cloner`), Comunidade Black (`#community`), Benefícios (`#benefits` — âncora não existe fisicamente na página, a seção correspondente usa `id="por-que-lowfy"`), Assinar Agora (`#pricing`).
- Coluna "Legal": Termos de Uso (`/termos`), Política de Privacidade (`/privacidade`), Licença de PLR (`/licenca-plr`), Direitos Autorais (`/direitos-autorais`).
- Coluna "Contato": e-mail `contato@lowfy.com.br`, telefone `+55 (41) 99907-7637`, texto "Atendimento de Segunda a Sexta das 09h às 18h."
- Linha final: "© 2025 Lowfy Tecnologia Ltda. CNPJ 47.394.596/0001-15. Todos os direitos reservados."

**Animações relevantes (framer-motion e afins)**
- `Testimonials.tsx`: `motion.div` com fade+slide-up no cabeçalho (`framer-motion`), `whileInView`/`viewport once`.
- Fora do framer-motion, mas relevantes à experiência: scroll infinito CSS (`animate-carousel-scroll`) no `InfiniteCarousel`; scroll vertical infinito CSS (`animate-testimonial-scroll`) nas colunas de depoimentos; auto-scroll via `requestAnimationFrame` no `UiCarousel` (pausa no hover/scroll manual); `IntersectionObserver` para lazy-render de seções (`LazySection`) e lazy-play de vídeos (`LazyVideo`); badges pulsantes (`animate-pulse`) na oferta e no CTA de pricing.

#### 5. Fluxos do usuário (destino de cada CTA)

- Botão hero "Desbloquear Meu Acesso Agora" → âncora `#pricing` (mesma página).
- Botão hero "Ver Tudo Por Dentro" → sem `href`/handler (puramente visual).
- Navbar "Login" (desktop e mobile) → `/login`.
- Navbar "Começar Agora" (desktop e mobile) → âncora `#pricing`.
- Todos os links do dropdown "Ferramentas"/"Comunidade" da navbar → âncoras internas (`#features`, `#bonus`, `#cloner`, `#quiz`, `#plr`, `#academy`, `#community`, `#marketplace`, `#afiliado`).
- CTA de pricing "QUERO MEU ACESSO IMEDIATO" → `/assinatura/checkout?plan=mensal` ou `/assinatura/checkout?plan=anual` (conforme aba de plano selecionada).
- Botão "SACAR" no mockup do Marketplace → decorativo, sem ação.
- Botão "Próximo" no simulador de quiz → decorativo, sem ação (`pointer-events-none` no container).
- Botões de post/curtir/comentar na Timeline da Comunidade → decorativos, sem handlers reais.
- Ícones sociais do footer → abrem em nova aba (Instagram, Facebook, YouTube da Lowfy).
- Links legais do footer → `/termos`, `/privacidade`, `/licenca-plr`, `/direitos-autorais`.
- Não há nenhum CTA apontando para WhatsApp nesta página (contato exibido no footer é e-mail e telefone, sem link `wa.me`).

#### 6. Regras de negócio visíveis

- Plano **Mensal**: de R$ 997,00 por R$ 99,99/mês ("ECONOMIZE 90%"), equivalente a "menos de R$ 3,40 por dia".
- Plano **Anual**: de R$ 11.988,00 por R$ 360,90/ano ("ECONOMIZE 70%"), equivalente a "R$ 30,07 por mês"; badge de aba mostra "-50%".
- Garantia declarada: 7 dias, reembolso integral ("RISCO ZERO... devolvemos cada centavo").
- Cancelamento "a qualquer momento" (texto sem link funcional).
- FAQ afirma que o preço trava vitaliciamente após a Black Friday em "R$ 99,90/mês ou R$ 360,90/ano" — nota: R$ 99,90 no FAQ diverge do valor exibido no card de preços (R$ 99,99).
- Programa de afiliados: 50% de comissão recorrente; "2 Indicações = Sua assinatura sai de graça"; projeções de ganho: 10 indicações → R$ 500/mês; 50 indicações (meta recomendada) → R$ 2.500/mês; 100 indicações → R$ 5.000/mês.
- Hospedagem de páginas clonadas/criadas está inclusa na assinatura; domínio próprio não incluso, "a partir de R$ 2,99/ano" (segundo o FAQ).
- Marketplace interno: saque via Pix, "cai na sua conta instantaneamente" (taxas e prazos remetidos à plataforma, não detalhados nesta página).
- PLRs disponíveis em 7 idiomas (BR, US, ES, FR, AE, CN, IN), cada um incluindo página de vendas, VSL, ebook, quiz e certificado de revenda.

#### 7. Integrações

- **Meta Pixel** e **Google Analytics**: não são inicializados dentro do código de `Home.tsx` nem dos componentes de landing lidos; a inicialização acontece globalmente em `client/src/App.tsx` via `MetaPixelInitializer` (chama `initMetaPixel()` e `trackPageView()` a cada mudança de rota) e `GoogleAnalyticsInitializer` (chama `initGoogleAnalytics()`/`trackGAPageView()`), montados na raiz da árvore de componentes (`<SEOProvider><MetaPixelInitializer /><GoogleAnalyticsInitializer /><Toaster /><Router /></SEOProvider>`). Como `Router` inclui a rota `/`, ambos os trackings se aplicam à Home, mas não são código específico desta página.
- **Links externos**: Instagram (`instagram.com/lowfybr`), Facebook (`facebook.com/p/Lowfy-61551759668769`), YouTube (`youtube.com/@lowfy_plrs`) no footer.
- Imagens de terceiros carregadas via CDN público: logos de ferramentas (diversos domínios de hotlink), bandeiras via `flagcdn.com`, avatares de usuários via `randomuser.me` (mockups de comunidade) e `ui-avatars.com` (variáveis `lucasImg`/`mariaImg`/`pedroImg` declaradas no topo do arquivo, mas não utilizadas em nenhum JSX renderizado — código morto), imagem de fundo do hero via Unsplash, mapa-múndi via Wikimedia Commons (seção PLR).
- Nenhuma chamada a API própria do backend Lowfy (`fetch`/`useQuery`) é feita em `Home.tsx`.

#### 8. Dados exibidos

Confirmado: a página é inteiramente estática/mockada — não há chamadas a API (`fetch`, `useQuery`, etc.) nem dados vindos do backend. Todo o conteúdo vem de constantes hardcoded (`landing-constants.ts`) ou de literais no próprio `Home.tsx`. Elementos que parecem "dinâmicos" mas são apenas simulação client-side, sem persistência ou dado real:
- Contagem de respostas de tópicos do fórum: `Math.floor(Math.random() * 50)` — recalculada aleatoriamente a cada renderização, não vem de nenhuma fonte de dados real.
- Todo o mockup de Timeline/Gamificação/Marketplace (XP, saldo "R$ 3.240,00", posts, curtidas) é estático, com valores fixos no JSX.
- Preferência de tema (claro/escuro) é o único estado que persiste, via `localStorage` (`lowfy-theme`), controlado localmente em `Home.tsx` (não é dado de API).

### Página: /login — Landing (autenticação: login, cadastro, recuperação e ativação)

- **Arquivo fonte e rota(s)**
  - `client/src/pages/Landing.tsx` (1645 linhas), registrado em `client/src/App.tsx` como `<Route path="/login" component={Landing} />`, dentro do bloco de rotas exibido apenas quando o usuário **não** está autenticado.
  - É também o destino padrão de redirecionamento do hook `useAuthRedirect` (`client/src/hooks/useAuthRedirect.ts`) para qualquer rota protegida acessada sem sessão (`/login?redirect=<rota original>`).
  - A mesma página concentra 6 "sub-telas" controladas por um estado interno `authView: 'login' | 'register' | 'forgot' | 'forgotSuccess' | 'reset' | 'resetDirect'`. O sub-fluxo `reset` é ativado automaticamente quando a URL contém `?token=...` (link de redefinição por email); os sub-fluxos `tab=register`/`cadastro`/`register` na querystring abrem a aba de cadastro direto.

- **Objetivo**
  - Ponto único de entrada de autenticação: login de usuários existentes, cadastro de novos usuários (com verificação de telefone por SMS/OTP), recuperação/redefinição de senha, e conclusão de cadastro (ativação) de quem acabou de pagar uma assinatura e chegou até `/login` com dados de checkout na URL.

- **Layout geral**
  - Tela cheia centralizada (`min-h-screen`, `flex items-center justify-center`), fundo em gradiente cinza claro/escuro.
  - Logo Lowfy (`lowfy-logo-green.webp`) no topo, título (h1) e subtítulo (p) que mudam conforme `authView`.
  - Um único `Card` branco translúcido (`bg-white/95`, `backdrop-blur`, `max-w-md`) contém o formulário ativo.
  - Duas modais (`Dialog`) sobrepostas: verificação OTP por telefone (cadastro) e verificação 2FA por email/WhatsApp (login).
  - `<nav className="hidden" aria-hidden="true">` só para SEO/crawlers, com links para `/ai-tools`, `/clonador`, `/assinatura/checkout`, `/plrs`, `/login`, `/courses`.
  - Componente `<SEO>` com `title`/`description`/`canonicalUrl` de `seoConfig.login`.

- **Inventário completo de UI**

  **Tabs** (quando `authView` é `login` ou `register`): `TabsList` com `TabsTrigger` "Entrar" (`tab-login`) e "Cadastrar" (`tab-register`).

  **Aba "Entrar"** — form `loginForm` (schema `loginSchema` de `shared/schema.ts`):
  - Campo **Email**: `Input type=email`, ícone `Mail`, placeholder "Email", `autoComplete=email`. Validação: `email` string `.min(1)` — mensagem "Email ou usuário é obrigatório" (**não** valida formato de e-mail no login, só não-vazio).
  - Campo **Senha**: `Input` password/text alternável, ícone de cadeado (svg), placeholder "••••••••", botão olho (`toggle-login-password`). Validação: `password` string `.min(1)` — "Senha é obrigatória".
  - Botão **"Entrar"** (`button-login-submit`): desabilitado durante `loginMutation.isPending`; spinner + "Entrando...".
  - Link **"Esqueci minha senha"** (`button-forgot-password`): muda `authView` para `forgot`.
  - Bloco condicional **"Ativar Conta da Compra"** (só quando `showActivationForm=true`): título; campos **Email (da compra)** e **CPF (da compra)** somente leitura/desabilitados e pré-preenchidos; **"Defina uma senha"** e **"Confirmar senha"** (`required`, `minLength=6`, sem zod, com botão olho cada); botão **"Ativar Conta"** (spinner "Ativando...").

  **Aba "Cadastrar"** — form `registerForm` (schema local `registerSchema`):
  - **Nome completo**: `Input text`, ícone usuário; trava (disabled/readOnly, fundo cinza) quando `lockedFields.name=true`. Validação: `.min(3)` "Nome deve ter no mínimo 3 caracteres".
  - **Email**: `Input email`, ícone `Mail`; trava quando `lockedFields.email=true`. Validação: `.email()` "Email inválido".
  - **Telefone**: `Input tel`, ícone `Phone`, placeholder "(11) 99999-9999"; máscara `(XX) XXXXX-XXXX` aplicada via `watch()`/`setValue`; trava quando `lockedFields.phone=true`; `maxLength=15`. Validação: `.min(10)` "Telefone é obrigatório" + `.refine` regex `/^\d{10,11}$/` sobre dígitos, "Telefone inválido. Use DDD + número (ex: 11999999999)".
  - **CPF**: `Input text`, ícone (svg), placeholder "000.000.000-00"; máscara `XXX.XXX.XXX-XX`; trava quando `lockedFields.cpf=true`; `maxLength=14`. Validação: `.min(11)` "CPF é obrigatório" + `.refine` comprimento de dígitos ===11 "CPF deve ter 11 dígitos" (**sem** cálculo de dígito verificador).
  - **Senha**: password/text alternável, ícone cadeado, placeholder "Mínimo 6 caracteres", botão olho (`toggle-register-password`). Validação: `.min(6)`.
  - **Repetir Senha**: password/text alternável, ícone `CheckCircle2`, botão olho (`toggle-register-confirm-password`). Validação: `.min(6)` + `.refine` cross-field `password === confirmPassword`, "As senhas não coincidem" (path `confirmPassword`).
  - Botão **"Criar conta"** (`button-register-submit`): spinner "Criando conta...".

  **Form "forgot"** (`authView==='forgot'`) — form `resetPasswordDirectForm` (schema `resetPasswordDirectSchema`):
  - **Email** (`.email()`), **CPF** (`.min(11)` + `.refine` 11 dígitos, com máscara), **Nova Senha** (`.min(6)`, botão olho), **Confirmar Senha** (`.min(6)` + `.refine` igualdade). Botão **"Redefinir Senha"** (`button-reset-password-direct`, spinner "Redefinindo..."). Link **"Voltar ao login"** (`button-back-to-login`, ícone `ArrowLeft`).

  **Form "reset"** (`authView==='reset'`, ativo com `?token=`) — form `resetPasswordForm` (schema `resetPasswordSchema`):
  - **Nova Senha** (`.min(6)`, texto auxiliar "Mínimo de 6 caracteres"), **Confirmar Senha** (`.min(6)` + `.refine` igualdade). Botão **"Redefinir Senha"** (`button-reset-password`). Link **"Voltar ao login"** (`button-back-to-login-reset`) que também limpa `resetToken` e a query string.

  **Modal OTP** (telefone, `Dialog open=showOTPModal`): ícone `Phone`, título "Verifique seu telefone", descrição com `{pendingPhone}`; `InputOTP` de 6 slots (`input-otp`, auto-submit ao completar); indicador "Verificando código..."; botão **"Reenviar código"** (`button-resend-otp`, cooldown "Reenviar em Ns").

  **Modal 2FA** (email, `Dialog open=show2FAModal`): ícone `CheckCircle2`, título "Verificação de Segurança"; `InputOTP` 6 slots (`input-2fa-code`); indicador "Verificando código..."; botão **"Reenviar por email"** (`button-resend-2fa-email`, cooldown 60s) e botão **"Tentar por WhatsApp"** (`button-send-2fa-whatsapp`, mesmo cooldown); texto "O código é válido por 10 minutos".

- **Fluxos do usuário**
  - **Login**: envia email/senha → `POST /api/auth/login` → se `success`: sessão via cookie httpOnly, toast, redireciona `/timeline`; se `requiresVerification`: abre modal 2FA; se `token` (fallback legado): mesmo resultado de sucesso; erro: toast destrutivo. No modal 2FA, 6 dígitos → `POST /api/auth/verify-2fa` → sucesso fecha modal e redireciona; erro limpa o código. Reenvio por email (`POST /api/auth/resend-2fa`) ou WhatsApp (`POST /api/auth/send-2fa-whatsapp`), cooldown 60s.
  - **Cadastro**: envia dados → `POST /api/auth/register` → dispara pixels (Meta `trackCompleteRegistration`, GA `trackUserSignup`, Google Ads `trackAdLead`), guarda `pendingUserId`/`pendingPhone`, chama automaticamente `POST /api/auth/phone/send` e abre modal OTP; 6 dígitos → `POST /api/auth/phone/verify` → sucesso marca `localStorage.show_welcome_confetti=true` e redireciona `/timeline`; erro limpa o OTP. Reenvio via botão no modal repete `POST /api/auth/phone/send` (mensagens "Aguarde N segundos" do backend são parseadas por regex para sincronizar o cooldown local).
  - **Recuperação de senha (fluxo "forgot", email+CPF)**: clique em "Esqueci minha senha" → preenche email, CPF, nova senha, confirmação → `POST /api/auth/reset-password-direct` → em sucesso, toast informa que um **link de redefinição foi enviado por email** (fluxo sem auto-login, conforme comentário no código), form reseta e volta para `login`.
    - Observação de código: existe um segundo caminho (`forgotPasswordSchema`/`forgotPasswordForm`/`forgotPasswordMutation`, endpoint `/api/auth/forgot-password`, e o valor `authView='forgotSuccess'`) declarado no componente mas **sem nenhum `<form>` ou bloco JSX que o utilize** — não é alcançável pela interface renderizada atualmente.
  - **Definição de nova senha via link/token**: chegada em `/login?token=...` seta `resetToken` e `authView='reset'` automaticamente → preenche nova senha/confirmação → `POST /api/auth/reset-password` com `{token, newPassword}` → sucesso: toast, volta para `login`, remove o token da URL (`history.replaceState` para `/login`); erro: toast com mensagem do servidor ou "Token inválido ou expirado".
  - **Ativação de conta pós-compra** (dentro da própria `/login`): um `useEffect` lê parâmetros de checkout na URL (`name`/`customer_name`, `email`/`customer_email`, `phone`/`customer_phone`, `doc`/`customer_doc`/`cpf`), ignorando valores vazios ou template literals (`{{...}}`). Com dados válidos, chama `fetch POST /api/auth/check-email`: se o email já existe, preenche `activationEmail`/`activationCpf`, ativa `showActivationForm` e mantém `authView='login'` (mostra o bloco "Ativar Conta da Compra"); se não existe, preenche e trava os campos de cadastro e muda para a aba "Cadastrar". A URL é limpa em seguida. No bloco de ativação, senha+confirmação são enviadas via `POST /api/auth/activate-account` com `{email, cpf (só dígitos), password, confirmPassword}` → sucesso: sessão via cookie, toast "Conta ativada!", redireciona `/timeline`.

- **Regras de negócio visíveis**
  - Login não valida formato de e-mail no frontend (apenas não-vazio); toda validação de formato fica a cargo do backend.
  - Cadastro: nome ≥3 caracteres, email com formato válido, senha ≥6 com confirmação igual, telefone com 10–11 dígitos, CPF com exatamente 11 dígitos (sem dígito verificador).
  - Campos vindos de checkout ficam bloqueados para edição (`lockedFields`).
  - Verificação de telefone (SMS/OTP) é obrigatória após cadastro antes de liberar a conta.
  - Login pode exigir 2FA por email (`requiresVerification`), código de 6 dígitos válido por 10 minutos, com alternativa de reenvio por WhatsApp.
  - Rate limiting percebido: cooldown de 60s no cliente para reenvio de SMS/2FA; mensagens de erro do backend com "Aguarde N segundos" são parseadas via regex para sincronizar o cooldown exibido.
  - Redefinição de senha "direta" (email+CPF) **não** troca a senha imediatamente — apenas envia um link por email, evitando login automático por quem só sabe email+CPF.
  - Redefinição via token: nenhuma validação prévia do token no cliente; a UI apenas tenta o POST e exibe o erro retornado ("Token inválido ou expirado" como mensagem padrão).
  - Ativação pós-compra depende de o email da compra já existir como usuário `pending_activation` no backend (checado via `/api/auth/check-email`); caso contrário, cai no cadastro normal.
  - Nenhuma senha (cadastro/reset/ativação) exige mais que 6 caracteres; não há medidor de força de senha.

- **Integrações/chamadas de API**
  - `POST /api/auth/login`, `POST /api/auth/verify-2fa`, `POST /api/auth/resend-2fa`, `POST /api/auth/send-2fa-whatsapp`
  - `POST /api/auth/register`, `POST /api/auth/activate-account`
  - `POST /api/auth/phone/send`, `POST /api/auth/phone/verify`
  - `POST /api/auth/phone/resend-for-user` — mutation declarada (`resendOTPForUserMutation`) mas sem nenhum handler que a chame na UI renderizada
  - `POST /api/auth/forgot-password` — mutation declarada (`forgotPasswordMutation`) mas não usada (ver seção de fluxos)
  - `POST /api/auth/reset-password` (fluxo com token) e `POST /api/auth/reset-password-direct` (fluxo email+CPF)
  - `fetch POST /api/auth/check-email` (fora de `useMutation`, usado na detecção de dados de checkout)
  - `queryClient.invalidateQueries(["/api/auth/user"])` após login/2FA/OTP/ativação bem-sucedidos

- **Dados exibidos**
  - Nenhum dado de conta pré-existente é exibido no login. No cadastro/ativação, dados vindos de checkout (nome, email, telefone, CPF) são exibidos formatados (máscaras de telefone/CPF). No modal OTP, exibe o telefone (`pendingPhone`) para o qual o SMS foi enviado.

### Página: /set-password — SetPassword

- **Arquivo fonte e rota**: `client/src/pages/SetPassword.tsx`, registrado em `App.tsx` como `<Route path="/set-password" component={SetPassword} />`, mas **apenas dentro do bloco de rotas para usuários autenticados** (`<Layout><ProtectedContent>`). O hook `useAuthRedirect` não inclui `/set-password` na lista `publicRoutes`; logo, um usuário **não autenticado** que tente acessar essa URL é redirecionado para `/login?redirect=/set-password` antes de o componente ser renderizado — mesmo a lógica interna do componente (login com senha temporária) pressupondo alguém ainda não logado.
- **Objetivo**: permitir que um usuário com senha temporária (recebida por email, via `?email=` e `?temp=` na querystring) defina sua senha definitiva.
- **Layout geral**: tela centralizada com gradiente azul/índigo (`from-blue-50 to-indigo-100`), `Card` único com ícone `ShieldCheck` em círculo, título "Defina sua Senha".
- **Inventário completo de UI**:
  - Campo **Email**: `Input type=email`, valor vindo de `?email=` na URL, `disabled`, fundo cinza (somente leitura).
  - Campo **Nova Senha**: `Input` password/text alternável, `onChange` controla estado `newPassword`, botão olho (Eye/EyeOff) para alternar visibilidade, `required`.
  - Campo **Confirmar Senha**: `Input` do mesmo tipo (segue a visibilidade da senha acima), `onChange` controla `confirmPassword`, `required` — sem botão de olho próprio.
  - Aviso informativo (ícone `Lock`): "Sua senha deve ter no mínimo 6 caracteres".
  - Botão **"Definir Senha e Entrar"**: `disabled` durante `setPasswordMutation.isPending`; texto muda para "Salvando...".
  - Não há react-hook-form/zod — os campos são `useState` simples e a validação é manual dentro da `mutationFn`.
- **Fluxos do usuário**: usuário informa nova senha e confirmação → submit → a `mutationFn` primeiro valida (`newPassword !== confirmPassword` lança erro "As senhas não coincidem"; `newPassword.length < 6` lança "A senha deve ter no mínimo 6 caracteres") → faz `POST /api/auth/login` com `{email, password: tempPassword}` (login usando a senha temporária) → em seguida `PUT /api/auth/change-password` com `{currentPassword: tempPassword, newPassword}` → sucesso: toast "✅ Senha definida com sucesso!", aguarda 1,5s, navega para `/dashboard` e recarrega a página (`window.location.reload()`); erro: toast destrutivo com a mensagem lançada.
- **Regras de negócio visíveis**: senha mínima de 6 caracteres; sem medidor de força; a troca de senha depende de primeiro autenticar com a senha temporária (login), depois trocar via endpoint de mudança de senha autenticado.
- **Integrações/chamadas de API**: `POST /api/auth/login`, `PUT /api/auth/change-password`.
- **Dados exibidos**: email (somente leitura, vindo da URL).

### Página: /reset-password — ResetPassword

- **Arquivo fonte e rota**: `client/src/pages/ResetPassword.tsx`, `<Route path="/reset-password" component={ResetPassword} />` no bloco de rotas públicas de `App.tsx` (também listada em `publicRoutes` do `useAuthRedirect` e em `ProtectedRoute.tsx`). Nota: esta página duplica parcialmente a funcionalidade do sub-fluxo "reset" de `Landing.tsx` (ambas chamam `POST /api/auth/reset-password` com `token`+`newPassword`); são implementações independentes e coexistentes no código.
- **Objetivo**: permitir redefinir a senha a partir de um link de email contendo `?token=...`.
- **Layout geral**: tela cheia com imagem de fundo `/login-bg.jpg` (`background-size: cover`) — visual diferente do gradiente cinza de `Landing.tsx` e do gradiente azul de `SetPassword.tsx`. Ícone genérico `BookOpen` (não o logotipo Lowfy) em quadrado arredondado `bg-primary`, título "Redefinir Senha", `Card` translúcido com o formulário.
- **Inventário completo de UI**:
  - Estado sem token: bloco central com ícone `AlertCircle` e texto "Link de redefinição inválido ou expirado" (sem botão de ação nesse card).
  - Campo **Nova Senha** (`input-new-password`): `Input password`, `required`, `minLength=6`, texto auxiliar "Mínimo de 6 caracteres"; desabilitado durante o envio.
  - Campo **Confirmar Senha** (`input-confirm-password`): `Input password`, `required`, `minLength=6`; desabilitado durante o envio.
  - Botão **"Redefinir Senha"** (`button-reset-password`): spinner + "Redefinindo..." quando pendente.
  - Link **"Voltar para o login"** (`link-back-login`): navega para `/login`.
  - Tela de sucesso alternativa (quando `resetSuccess=true`): ícone `CheckCircle2` em círculo verde, título "Senha Redefinida!", texto "Sua senha foi alterada com sucesso. Redirecionando para o login...".
  - Não usa react-hook-form/zod — `useState` simples com validação manual em `handleSubmit`.
- **Fluxos do usuário**: ao montar, um `useEffect` lê `?token=` da URL; se ausente, toast "Token inválido" e redireciona para `/login` após 3s. Com token presente, usuário preenche nova senha/confirmação → `handleSubmit` valida tamanho mínimo (6) e igualdade das senhas via toasts (sem exibir erro inline nos campos) → `resetPasswordMutation` → `POST /api/auth/reset-password` com `{token, newPassword}` → sucesso: toast "Senha redefinida!", ativa a tela de sucesso e, após 3s, navega para `/login`; erro: toast "Erro ao redefinir senha" com mensagem do servidor ou "Token inválido ou expirado".
- **Regras de negócio visíveis**: senha mínima de 6 caracteres; sem token válido na URL, o formulário nem é exibido (some, substituído pelo aviso de link inválido) — não há tentativa de submissão possível nesse caso; nenhuma validação de robustez de senha além do tamanho.
- **Integrações/chamadas de API**: `POST /api/auth/reset-password`.
- **Dados exibidos**: nenhum dado pessoal — apenas os dois campos de senha e o token (invisível, só na URL).

### Página: /ativar-conta — ActivateAccount (subscription)

- **Arquivo fonte e rota**: `client/src/pages/subscription/ActivateAccount.tsx` (557 linhas), registrado **duas vezes** em `App.tsx` — `<Route path="/ativar-conta">{() => <ActivateAccount />}</Route>` — tanto no bloco de rotas públicas quanto no bloco de rotas autenticadas, ou seja, acessível independentemente do estado de login. Também está em `publicRoutes` do `useAuthRedirect`.
- **Objetivo**: concluir o cadastro de um cliente que já pagou uma assinatura (link recebido por email com `?token=...`), definindo senha e confirmando via SMS.
- **Layout geral**: fundo gradiente cinza claro (`from-gray-50 to-white`), coluna central `max-w-xl`. Dois cartões empilhados: (1) cartão verde de confirmação de pagamento com detalhes da compra; (2) cartão de formulário "Complete seu Cadastro". Modal OTP sobreposta para verificação de telefone.
- **Inventário completo de UI**:
  - **Estado de carregamento**: spinner `Loader2` central com texto "Carregando dados de ativação..." enquanto a `useQuery` busca os dados do token.
  - **Estado de erro/token inválido**: `Card` com ícone `Lock` em círculo vermelho, título "Link Inválido", mensagem de erro (do backend ou "Este link de ativação é inválido ou já foi utilizado."), botão **"Voltar para o início"** (`button-go-home`) → navega para `/`.
  - **Cartão "Pagamento Aprovado!"**: ícone `CheckCircle` verde, texto "Compra confirmada com sucesso", e um bloco com **Plano escolhido**, **Data e hora** (formatada em `pt-BR`/`America/Sao_Paulo`, calculada no cliente no momento da renderização — não vem da API), **Forma de pagamento** ("PIX" ou "Cartão de Crédito").
  - **Seção "Seus Dados"** (somente leitura, vindos da API de ativação): **Nome** (`input-name-readonly`, ícone `User`), **Email** (`input-email-readonly`, ícone `Mail`), **CPF** (`input-cpf-readonly`, ícone `CreditCard`, formatado `XXX.XXX.XXX-XX`), **Telefone** (`input-phone-readonly`, ícone `Phone`, formatado `(XX) XXXXX-XXXX`).
  - **Seção "Crie sua Senha"**: campo **Senha** (`input-password`, password/text alternável, botão `button-toggle-password`) e campo **Confirmar Senha** (`input-confirm-password`, password/text alternável, botão `button-toggle-confirm-password`) — sem react-hook-form/zod, `useState` simples.
  - **Checkbox de termos** (`checkbox-terms`): "Li e aceito os **Termos de Uso** [link `/termos`, `target=_blank`] e a **Política de Privacidade** [link `/privacidade`, `target=_blank`]".
  - Botão **"Ativar Minha Conta"** (`button-activate`, ícone `CheckCircle`): `disabled` durante `activateMutation.isPending`; spinner + "Ativando conta...".
  - Nota de segurança: ícone `Lock` + "Seus dados estão protegidos".
  - **Modal OTP** (`Dialog open=showOTPModal`): ícone `Phone`, título "Verifique seu telefone", descrição "Enviamos um código de 6 dígitos para {telefone formatado}"; `InputOTP` de 6 slots (`input-otp-activation`, auto-submit ao completar); indicador "Verificando código..."; texto "O código é válido por 10 minutos" (sem botão de reenvio nesta modal).
- **Fluxos do usuário**:
  1. Usuário chega via `/ativar-conta?token=...`; se não houver `token` na URL, toast "Token não encontrado" e redireciona para `/`.
  2. `useQuery` busca `GET /api/subscriptions/activation/{token}` (`enabled: !!token`, `retry: false`); em erro, exibe o cartão "Link Inválido".
  3. Assim que os dados de ativação carregam, dispara rastreamento de conversão (Meta Pixel `trackCompleteRegistration`, Google Ads `trackAdConversion`, Google Analytics `trackPurchase`) com valor calculado por `planType` (`mensal` = R$99,90 / `anual` = R$360,90, valores fixos no código).
  4. Usuário define senha + confirmação e marca aceite dos termos → `validatePassword()` checa tamanho ≥6, igualdade das senhas e aceite dos termos (toasts para cada falha) → submit chama `activateMutation` → `POST /api/subscriptions/activate` com `{token, password}`.
  5. Sucesso: toast "SMS enviado!", guarda `subscriptionToken`/`passwordHash` retornados pela API, abre o modal OTP.
  6. Usuário digita os 6 dígitos → `verifyOTPMutation` → `POST /api/subscriptions/verify-and-activate` com `{subscriptionToken, password, code}`.
  7. Sucesso: fecha o modal, dispara confete (`canvas-confetti`), toast "Conta ativada com sucesso!", marca `localStorage.show_welcome_confetti=true`, invalida cache `/api/auth/user`, e após 1,5s navega para `/timeline` (sessão mantida via cookie httpOnly definido pelo servidor).
  8. Erro na verificação: toast "Erro na verificação" e limpa o campo OTP.
- **Regras de negócio visíveis**: senha mínima de 6 caracteres; aceite obrigatório dos Termos de Uso/Privacidade antes de ativar; nome/email/CPF/telefone são somente leitura (não editáveis nesta tela — vêm fixos da compra); verificação de telefone por SMS é etapa obrigatória para concluir a ativação; se o token for inválido/expirado/já utilizado, a API retorna erro e a tela mostra "Link Inválido" com botão para voltar à página inicial (nenhuma tentativa de reenvio de link nesta página).
- **Integrações/chamadas de API**: `GET /api/subscriptions/activation/{token}` (query), `POST /api/subscriptions/activate`, `POST /api/subscriptions/verify-and-activate`, `queryClient.invalidateQueries(["/api/auth/user"])`.
- **Dados exibidos**: nome, email, CPF (mascarado), telefone (mascarado), nome/tipo do plano contratado, forma de pagamento (PIX ou cartão), data/hora atual formatada como "data do pagamento" (gerada no cliente, não vinda da API).

### Página: 404 (catch-all) — not-found.tsx

- **Arquivo fonte e rota(s)**: `client/src/pages/not-found.tsx`, importado como `NotFound` em `App.tsx` e usado como última rota do `<Switch>` (`<Route component={NotFound} />`, sem `path`), funcionando como catch-all para qualquer URL não reconhecida pelas rotas anteriores (inclusive, por exemplo, `/set-password` quando acessado sem autenticação, embora nesse caso o `useAuthRedirect` normalmente intercepte antes com um redirect para `/login`).
- **Objetivo**: informar que a URL acessada não existe e oferecer caminhos de retorno.
- **Layout geral**: página simples e estática (sem componentes de UI compartilhados, estilos inline em vez de Tailwind/shadcn), fundo cinza claro, conteúdo centralizado vertical e horizontalmente.
- **Inventário de UI**:
  - Título grande "404".
  - Subtítulo "Página Não Encontrada".
  - Parágrafo "Desculpe, a página que você está procurando não existe ou foi removida."
  - Botão **"Ir para Timeline"** (verde): `onClick` faz `window.location.href = '/'` — note-se que o rótulo do botão menciona "Timeline", mas o destino real é a raiz `/`, não `/timeline`.
  - Botão **"Voltar"** (cinza/outline): `onClick` faz `window.history.back()`.
  - Rodapé de texto pequeno: "Se acredita que isso é um erro, entre em contato com o suporte." (sem link clicável).
- **Fluxos do usuário**: usuário acessa uma URL inexistente → vê a página 404 → pode clicar em "Ir para Timeline" (vai para `/`) ou "Voltar" (histórico do navegador).
- **Regras de negócio / integrações**: nenhuma chamada de API; página inteiramente estática, sem estado.
- **Dados exibidos**: nenhum dado dinâmico.

### Página: /termos — TermsOfUse

- **Arquivo fonte e rota**: `client/src/pages/legal/TermsOfUse.tsx`, `<Route path="/termos" component={TermsOfUse} />` (rota pública).
- **Objetivo**: apresentar os Termos de Uso da plataforma.
- **Layout geral**: usa o componente compartilhado `Navbar` (`client/src/components/landing/Navbar.tsx`) — barra fixa no topo com logo, menus suspensos "Ferramentas" e "Comunidade", botão de alternância de tema claro/escuro (persistido em `localStorage.lowfy-theme`, padrão `dark`) e menu mobile. Conteúdo em coluna única (`max-w-4xl`), título "Termos de Uso" com data "Última atualização: Novembro 2024", seções sequenciais (sem sumário/índice clicável — apenas rolagem). Rodapé completo compartilhado (colunas "Plataforma", "Legal", "Contato", redes sociais, copyright "© 2025 Lowfy Tecnologia Ltda. CNPJ 47.394.596/0001-15").
- **Estrutura de seções** (numeradas como `<h2>`; há duplicidade de numeração no código — duas seções usam "6." e duas usam "7."): 1) Aceitação dos Termos; 2) Acesso à Plataforma; 3) Assinatura e Pagamentos (planos mensal/anual, pagamento via PIX/cartão por Podpay e Asaas, renovação automática, sem reembolso salvo falha técnica, prazo de 7 dias para ativar a conta após pagamento); 4) Marketplace e Comissões (comissão de 20% da Lowfy, 80% ao vendedor, liberação em 7 dias, transferência via PIX); 5) Programa de Afiliados (comissão de 30% sobre assinaturas indicadas, pagamento mensal via PIX); 6) Uso Aceitável (proibições de conteúdo ilegal, fraude, múltiplas contas, revenda não autorizada); 7) Propriedade Intelectual; 8) Cancelamento e Suspensão (sem reembolso, acesso até fim do período); "6." (segunda ocorrência) Limitação de Responsabilidade; "7." (segunda ocorrência) Modificações dos Termos; 8) Obrigações Fiscais (usuário responsável por declarar/recolher tributos); 9) Contato (email `contato@lowfy.com.br`).
- **Dados exibidos**: texto jurídico estático, email e telefone de contato, CNPJ da empresa no rodapé.

### Página: /privacidade — PrivacyPolicy

- **Arquivo fonte e rota**: `client/src/pages/legal/PrivacyPolicy.tsx`, `<Route path="/privacidade" component={PrivacyPolicy} />` (rota pública).
- **Objetivo**: apresentar a Política de Privacidade / conformidade com a LGPD.
- **Layout geral**: idêntico às demais páginas legais (mesmo `Navbar`, mesma estrutura de seções em coluna única, mesmo rodapé compartilhado). Título "Política de Privacidade", data "Última atualização: Novembro 2024". Sem sumário clicável.
- **Estrutura de seções**: 1) Informações que Coletamos (dados de cadastro, financeiros, de uso, de conteúdo, cookies — cita explicitamente a LGPD/Lei 13.709/2018); 2) Como Usamos Suas Informações; 3) Compartilhamento de Dados (processadores de pagamento Podpay/Asaas, serviço de SMS Comtele, armazenamento Google Drive, autoridades por ordem judicial; declara não vender dados); 3.1) Conformidade com LGPD (lista os direitos do titular: confirmação, acesso, correção, anonimização/bloqueio/eliminação, portabilidade, eliminação, revogação de consentimento); 4) Segurança de Dados; 5) Cookies e Tecnologias Similares; 6) Seus Direitos; 7) Retenção de Dados; 8) Alterações nesta Política; 9) Contato (`contato@lowfy.com.br`).
- **Dados exibidos**: texto jurídico estático, email e telefone de contato, CNPJ no rodapé.

### Página: /licenca-plr — PLRLicense

- **Arquivo fonte e rota**: `client/src/pages/legal/PLRLicense.tsx`, `<Route path="/licenca-plr" component={PLRLicense} />` (rota pública).
- **Objetivo**: explicar os termos de uso do conteúdo PLR (Private Label Rights) vendido/distribuído na plataforma.
- **Layout geral**: mesma estrutura (Navbar + coluna única + rodapé compartilhado). Título "Licença de PLR", subtítulo "Direitos Private Label Rights (PLR) - Termos e Condições". Sem sumário clicável.
- **Estrutura de seções**: 1) O Que é PLR? (definição); 2) O Que Você Pode Fazer Com PLR (modificar, usar em produtos próprios, vender no marketplace, reempacotar, traduzir); 3) O Que Você NÃO Pode Fazer (revender original sem modificação, distribuir cópias idênticas, transferir direitos, compartilhar acesso, download massivo para revenda externa); 4) Garantias (Lowfy garante originalidade do conteúdo); 5) Revenda em Marketplace (comissão de 20%, produto deve ser significativamente modificado, pagamento liberado em 7 dias via PIX); 6) Responsabilidade (usuário responde pelo uso do conteúdo); 7) Suporte e Dúvidas (`contato@lowfy.com.br`).
- **Dados exibidos**: texto jurídico estático, email e telefone de contato, CNPJ no rodapé.

### Página: /direitos-autorais — Copyright

- **Arquivo fonte e rota**: `client/src/pages/legal/Copyright.tsx`, `<Route path="/direitos-autorais" component={Copyright} />` (rota pública).
- **Objetivo**: declarar direitos autorais/propriedade intelectual da plataforma e o procedimento para denúncia de violação.
- **Layout geral**: mesma estrutura (Navbar + coluna única + rodapé compartilhado). Título "Direitos Autorais", subtítulo "Copyright © 2025 Lowfy Tecnologia Ltda. Todos os direitos reservados." Sem sumário clicável.
- **Estrutura de seções**: 1) Propriedade Intelectual (todo conteúdo é propriedade da Lowfy ou licenciadores); 2) Restrições de Uso (proibido reproduzir/distribuir sem autorização, exceto uso pessoal não comercial, fins educacionais permitidos, ou conforme licença PLR); 3) Aviso de Detenção de Direitos Autorais; 4) Garantias Sobre PLR; 5) Lei de Direitos Autorais Brasileira (cita Lei 9.610/98; lista o que incluir numa notificação de violação: dados completos, descrição da obra, local da violação, prova de titularidade, declaração de boa-fé; prazo de análise de até 5 dias úteis); 6) Procedimento para Denúncia de Violação (passo a passo por email); 7) Marcas Registradas; 8) Contato para Questões de Copyright (email e telefone).
- **Dados exibidos**: texto jurídico estático, email e telefone de contato, CNPJ no rodapé.

---

## Dashboard e Timeline (Feed Social)

### Página: /dashboard — Painel Principal (Dashboard)

- **Arquivo fonte**: `client/src/pages/Dashboard.tsx` — rota `/dashboard` (definida em `client/src/App.tsx`, linha 245).
- **Objetivo**: Tela de boas-vindas/visão geral que mostra atalhos e contadores rápidos das principais áreas da plataforma (PLRs, ferramentas de IA, cursos, white label, membros/fórum) e ações rápidas de navegação, além de um mural de novidades/anúncios.
- **Layout geral**: Container centralizado (`max-w-7xl`), sem sidebar própria (usa o layout global do app). No topo, cabeçalho com título e botão de tour guiado. Abaixo, um grid de 6 cards de estatística (1 coluna no mobile, 2 no tablet, 3 no desktop). Em seguida, um grid de 2 colunas (desktop) com dois cards: "Ações Rápidas" (lista de links) e "Novidades" (lista de anúncios estáticos).
- **Inventário completo de UI**:
  - **Tour overlay** (`TourOverlay`) — sobreposição guiada controlada pelo hook `useTour(dashboardTour)`, com navegação Próximo/Anterior/Pular.
  - **Botão "Conhecer a plataforma"** (`TourButton`, variant outline) — visível apenas quando o tour não está ativo; inicia o tour (`tour.start`).
  - **Título "Painel Principal"** e subtítulo "Bem-vindo à sua plataforma de conteúdo digital".
  - **6 cards de estatística rápida** (cada um é um `Link` clicável para outra rota), com ícone, valor numérico/texto e cor temática:
    1. "PLRs Disponíveis" — valor de `stats.totalPLRs` (API), ícone `BookOpen`, link `/plrs`.
    2. "Ferramentas IA" — valor fixo "6", ícone `Zap`, link `/ai-tools`.
    3. "Cursos Online" — valor fixo "12", ícone `GraduationCap`, link `/courses`.
    4. "White Label" — valor de `stats.totalServices`, ícone `Briefcase`, link `/services`.
    5. "Membros" — valor de `stats.totalUsers`, ícone `Users`, link `/forum`.
    6. "Crescimento" — valor fixo "+15%", ícone `TrendingUp`, link `/admin`.
  - **Card "Ações Rápidas"** com 4 itens clicáveis (ícone + texto, cada um é um `Link`):
    - "Explorar PLRs" → `/plrs`
    - "Ferramentas de IA" → `/ai-tools`
    - "Cursos Online" → `/courses`
    - "Suporte" → `/support`
  - **Card "Novidades"** com 3 blocos de anúncio estático (título + descrição, sem interatividade):
    - "Novos PLRs Adicionados"
    - "Ferramentas de IA Atualizadas"
    - "Fórum da Comunidade"
  - **Estado de carregamento**: enquanto `isLoading` (query `/api/admin/stats`), renderiza 6 `Card` com skeleton pulsante (`animate-pulse`) simulando os cards de estatística.
  - Não há estado de erro tratado explicitamente nem estado vazio dedicado (os valores caem para `0` via `stats?.totalPLRs || 0` etc.).
- **Fluxos do usuário**:
  - Usuário acessa `/dashboard`, vê estatísticas carregando (skeleton) e depois os números reais.
  - Clica em qualquer card de estatística ou item de "Ações Rápidas" → navega para a respectiva rota (`/plrs`, `/ai-tools`, `/courses`, `/services`, `/forum`, `/admin`, `/support`).
  - Clica em "Conhecer a plataforma" → inicia tour guiado passo a passo pela tela.
- **Regras de negócio visíveis no código**: nenhuma checagem de plano/permissão nesta tela — todos os cards e ações são exibidos incondicionalmente. Não há gating visível de features pagas.
- **Integrações e chamadas de API**: consome `GET /api/admin/stats` (via `useQuery`, `retry: false`) retornando `{ totalPLRs, totalUsers, totalServices, monthlyRevenue }` (campo `monthlyRevenue` não é exibido na tela). Nenhuma integração externa direta (ElevenLabs/OpenAI/etc.) nesta página.
- **Dados exibidos**: `totalPLRs`, `totalUsers`, `totalServices` (do endpoint de stats); os demais números ("6" ferramentas IA, "12" cursos, "+15%" crescimento) são valores fixos no código, não vindos do banco.

### Página: / e /timeline — Timeline (Feed Social)

- **Arquivo fonte**: `client/src/pages/Timeline.tsx` — rotas `/` e `/timeline` (App.tsx linhas 243-244).
- **Objetivo**: Feed social interno estilo rede social, onde o usuário publica posts (texto, imagem, documento, vídeo, link), reage, comenta, segue outros usuários, acompanha gamificação (XP, missões, desafios, ranking) e navega por hashtags/tópicos em alta.
- **Layout geral**: Fundo cinza claro/escuro em tela cheia. Container central (`max-w-7xl`) com grid de 12 colunas (visível só em desktop `lg`):
  - Coluna esquerda (3/12, oculta no mobile): `UserCard`, `DailyMissions`, `ActiveChallenges`, `WeeklyGoals`.
  - Coluna central (6/12): `CreatePost`, `FeedTabs` (abas), `TagFilters` (só na aba "feed"), lista infinita de `PostCard`.
  - Coluna direita (3/12, oculta no mobile): `WeeklyRanking`, `SuggestedConnections`, `TrendingTopics`.
  - No topo: botão de tour guiado (`TourButton` + `TourOverlay`).
  - Modal global `CommentsModal` (fora do grid), acionado ao abrir comentários de um post pela URL/notificação.
- **Inventário completo de UI**:
  - **Botão "Conhecer a plataforma"** — inicia tour da timeline (`timelineTour`).
  - **`UserCard`** (sidebar esquerda): banner com gradiente, avatar do usuário (borda branca), badge de troféu, nome, área de atuação, localização (se houver), barra de progresso de XP (`xpInCurrentLevel / xpNeededForNextLevel`), nível atual, badge com nome do nível (levelName), 3 estatísticas (Posts, Nível, Seguidores) e até 6 "Conquistas" (badges de gamificação com ícone, tooltip com nome/descrição ao hover). Escuta WebSocket `points_awarded` para toast "+X XP" e animação da barra.
  - **`DailyMissions`** ("Metas Diárias"): lista de atividades diárias, cada uma com título, descrição, recompensa "+X XP", barra de progresso (`currentProgress/requirementCount`) e contador textual. Escuta WebSocket `gamification_update`. Componente oculta-se (`return null`) se não houver atividades. (Possui mutação de "claim" no código, embora não haja botão de claim renderizado visivelmente no JSX atual.)
  - **`ActiveChallenges`** ("Desafios Ativos"): até 2 desafios ativos exibidos, cada um com ícone (mapeado por emoji: 🎯⭐🏆🏅⚡), título, descrição, badge "X XP", barra de progresso e contador. Botão "Ver todos os desafios" → link para `/challenges`.
  - **`WeeklyGoals`** ("Metas Semanais"): lista de desafios semanais com título, descrição, "+X XP", barra de progresso e contador `atual/meta`. Oculta-se se vazio.
  - **`CreatePost`** (composer de post):
    - Textarea com placeholder "Compartilhe algo interessante... Use # para adicionar hashtags!", com emoji picker embutido (`showEmojiPicker`).
    - Autocomplete de hashtags: ao digitar `#`, mostra dropdown com até 5 sugestões de tags populares (nome + contagem de posts), filtradas conforme digitação; tecla Esc fecha a lista.
    - Preview automático de link: ao colar uma URL no texto, faz debounce de 1,5s e chama `POST /api/link-preview` para buscar título/descrição/imagem (não ativa para links de vídeo do YouTube/Vimeo/Dailymotion). Exibe spinner "Carregando preview do link..." e depois um card com imagem, título, descrição e botão remover (X).
    - Botão "Adicionar imagem" (ícone `ImagePlus`) → input de arquivo (JPG/PNG/GIF/WEBP/AVIF, máx. 4MB); a imagem é comprimida no navegador (`browser-image-compression`, qualidade 95%, convertida para WebP, máx. 2560px) antes do preview e upload; preview exibido com botão "Remover".
    - Botão "Adicionar documento" (ícone `FileText`) → input de arquivo (PDF, TXT, ZIP, DOC, DOCX, RAR; máx. 10MB); mostra nome do arquivo + botão remover (X).
    - Botão "Adicionar vídeo" (ícone `Video`) → abre **Dialog "Adicionar Vídeo"** com campo de link (YouTube/Vimeo/Dailymotion) e botões "Cancelar"/"Adicionar"; valida domínio suportado; após adicionar, exibe chip com o link e botão remover.
    - Botão "Publicar" (submit) — desabilitado enquanto pendente, mostra "Publicando..."; exige pelo menos um de: texto, imagem, documento, link de vídeo ou preview de link. Extrai hashtags do texto (`#palavra`) e envia como `tags` no FormData junto com `content`, `media`, `videoLink`, `linkPreview`.
    - Toast de sucesso "Publicado!" ou erro "❌ Conteúdo bloqueado" (moderação de conteúdo no backend).
  - **`FeedTabs`**: 3 abas — "Feed" (Home), "Seguindo" (Users), "Meus" (User) — controla `feedType` da query de posts.
  - **`TagFilters`** (exibido só na aba "Feed"): se há tag ativa, mostra chip da tag com botão de remover (X); senão, lista de até 10 "Tags populares" (botões com ícone `#`, nome e badge de contagem de posts), com botão "Ver mais (N)"/"Ver menos" para expandir em blocos de 10.
  - **Lista de posts** (`PostCard`, um por post, ordenados por página/infinite scroll):
    - Skeleton de carregamento (3 placeholders com avatar+linhas) enquanto `isLoading`.
    - Estado vazio: "Nenhum post encontrado. Seja o primeiro a compartilhar algo!"
    - Scroll infinito via `IntersectionObserver` em elemento sentinela; spinner `Loader2` enquanto busca próxima página; mensagem final "Você viu todos os posts disponíveis" quando não há mais páginas.
  - **`WeeklyRanking`** ("Top Usuários"): lista dos top 5 do ranking semanal (`GET /api/users/ranking?limit=5`), com ícone de posição (troféu ouro/medalha prata/prêmio bronze para os 3 primeiros, número para os demais), avatar, nome e nível. Estado vazio: "Nenhum usuário no ranking ainda".
  - **`SuggestedConnections`** ("Sugestões para Você"): lista de usuários sugeridos com avatar, nome, área de atuação, nível, e botão circular Seguir (ícone `Plus`→`Check` após seguir, com opacidade reduzida no item seguido); atualização otimista e toast "Seguindo!". Componente oculta-se se não houver sugestões.
  - **`TrendingTopics`** ("# Tags em Alta"): grid 2 colunas com até 4 tags visíveis inicialmente (nome + contagem de posts), botão "Ver mais (N tags)"/"Ver menos" para expandir tudo; clicar em uma tag navega para `/timeline?tag=<nome>`. Estado vazio: "Nenhum tópico em alta ainda".
  - **`CommentsModal`** (Dialog "Comentários"): aberto via `selectedPostId` (ex.: ao clicar em um post referenciado por notificação e não encontrado na tela). Mostra autor+conteúdo do post, lista rolável de comentários (avatar, nome, tempo relativo, conteúdo) com estado vazio "Nenhum comentário ainda. Seja o primeiro a comentar!", e campo de novo comentário com botão de enviar (ícone `Send`).
  - **Confete de boas-vindas**: se `localStorage.show_welcome_confetti === 'true'`, dispara animação de confetti (canvas-confetti) por 3s ao carregar a página (apenas na primeira visita pós-onboarding).

  **Dentro de cada `PostCard` (elemento central do feed)**:
  - Avatar do autor (com `Link` para `/users/:id`), nome, área de atuação/profissão, badge do autor (se houver), indicador "Compartilhou um post" (se for repost), timestamp relativo (`formatTimeAgo`).
  - **Menu de opções do post** (ícone `MoreVertical`, dropdown):
    - "Fixar no topo" / "Desafixar" (`Pin`/`PinOff`) — só para o autor do post.
    - "Excluir post" (`Trash2`, vermelho) — para autor ou admin (`currentUser.isAdmin`).
    - "Denunciar" (`Flag`, vermelho) — para quem não é o autor.
  - Badge "Post Fixado" (com ícone `Pin`) quando `post.isPinned`.
  - Conteúdo do post com **hashtags clicáveis** (renderizadas como botões `#tag` que navegam para `/timeline?tag=...`), texto sanitizado (`sanitizeUserHtml`).
  - **Mídia do post**: imagens (grid, clique abre modal de imagem em tela cheia; proxy `/api/image-proxy` para imagens externas), vídeos (`<video controls>`), documentos (card com ícone, nome, tamanho e botão "Download").
  - **Vídeo incorporado** (iframe embed convertido automaticamente de links do YouTube/Vimeo/Dailymotion).
  - **Preview de link** (card clicável com imagem, título, descrição, hostname).
  - **Post compartilhado** (bloco com borda destacada mostrando autor original, conteúdo, mídia e vídeo do post compartilhado).
  - **Anexos genéricos** (`attachments`): imagem, vídeo ou "artigo" (ícone + nome).
  - **Barra de reações/ações**:
    - Botão "Curtir" (`ThumbsUp`, azul quando ativo) com contador.
    - Botão "Descurtir" (`ThumbsDown`, vermelho quando ativo) com contador. (Reações mutuamente exclusivas: curtir remove descurtida e vice-versa.)
    - Botão "Comentar" (`MessageCircle`) com contador — expande/recolhe seção de comentários inline.
    - Botão "Compartilhar" (`Share2`) com contador — abre **Dialog "Compartilhar Post"** com preview do conteúdo original, campo opcional "Adicionar comentário" e botões "Cancelar"/"Compartilhar".
  - **Seção de comentários inline** (ao clicar em Comentar):
    - Lista de comentários principais (até `commentsToShow`, começando em 5), cada um com: avatar, nome (link para perfil), profissão, badge do autor, tempo relativo, menu de opções (Excluir para autor próprio / Denunciar para os demais), texto com **menções `@usuário` destacadas e linkadas**, botão "Curtir" (com contador e preenchimento do ícone quando curtido), botão "Responder (N)" (preenche o campo com `@nome`), e — apenas para o autor do post — botão "Fixar"/"Desfixar" comentário (fixados vão para o topo, ordenados por curtidas/data).
    - **Respostas/threads**: comentários filhos (`parentCommentId`) exibidos recuados com borda lateral, mesmo padrão de avatar/nome/menções/curtir.
    - Campo de novo comentário/resposta (Textarea com emoji picker) + botão enviar (`Send`); atualização otimista imediata (comentário temporário `temp-...` substituído pelo real do servidor).
  - **Modal de imagem em tela cheia** (Dialog escuro/blur) ao clicar em qualquer imagem do post.
- **Fluxos do usuário**:
  - **Criar post**: digitar texto no composer (opcionalmente usando `#` para hashtags sugeridas) e/ou anexar imagem, documento ou vídeo (link) e/ou colar um link (gera preview automático) → clicar "Publicar" → post aparece no topo do feed via WebSocket (`new_post`) sem precisar recarregar.
  - **Reagir a um post**: clicar em Curtir/Descurtir → contador atualiza instantaneamente (otimista) e replica via WebSocket para outros usuários (`post_reaction`).
  - **Comentar**: clicar em "Comentar" para expandir a seção → escrever no campo → enviar → comentário aparece imediatamente (otimista) e é sincronizado via WebSocket (`new_comment`) para outros clientes.
  - **Responder a um comentário**: clicar "Responder" em um comentário → campo é pré-preenchido com `@nome do autor` → enviar cria uma resposta em thread.
  - **Curtir comentário**: clicar no ícone de like do comentário → contador e estado atualizam otimisticamente, sincronizado via WebSocket (`comment_like`).
  - **Fixar comentário/post**: autor do post fixa um comentário no topo, ou fixa o próprio post no topo do perfil.
  - **Compartilhar post**: abrir diálogo de compartilhamento, opcionalmente adicionar comentário, confirmar → post republicado, contador de compartilhamentos incrementado.
  - **Filtrar por hashtag**: clicar em uma tag (no post, no `TrendingTopics` ou no `TagFilters`) → URL muda para `/timeline?tag=X` → feed recarrega filtrado; chip de tag ativa permite remover o filtro.
  - **Trocar aba do feed**: alternar entre "Feed" (todos), "Seguindo" (apenas quem o usuário segue) e "Meus" (posts próprios).
  - **Seguir usuário sugerido**: clicar no botão "+" em `SuggestedConnections` → usuário passa a "seguindo" (ícone check), some da lista de sugestões.
  - **Scroll infinito**: rolar até o fim da lista de posts carrega automaticamente a próxima página (12 posts por vez).
  - **Navegação a partir de notificação**: acessar `/timeline?post=<id>#comment-<id>` faz a página rolar/destacar o post e o comentário específicos, ou abrir `CommentsModal` se o post não estiver na página carregada.
- **Regras de negócio visíveis no código**:
  - Exclusão de post: permitida ao autor do post ou a usuário com `currentUser.isAdmin`.
  - Denúncia de post/comentário: disponível apenas para quem não é o autor.
  - Fixar/desafixar comentário: disponível apenas para o autor do post (`isPostAuthor`).
  - Fixar/desafixar o próprio post: disponível apenas para o autor do post.
  - Reação (like/dislike) é exclusiva — aplicar uma remove a outra automaticamente.
  - Upload de imagem: tipos aceitos JPG/PNG/GIF/WEBP/AVIF, limite 4MB (compressão client-side para caber no limite); documento: PDF/TXT/ZIP/DOC/DOCX/RAR, limite 10MB.
  - Vídeo por link: apenas domínios YouTube, Vimeo, Dailymotion são aceitos.
  - Publicação exige ao menos um conteúdo (texto, imagem, documento, vídeo ou link).
  - Moderação de conteúdo no backend: post pode ser bloqueado com toast "❌ Conteúdo bloqueado" e sugestão de correção.
  - Pontuação/XP (gamificação) é concedida por ações como criar post, curtir, comentar, responder, compartilhar, melhor resposta, criar tópico — refletida em `UserCard`, `DailyMissions` e `WeeklyGoals`, com eventos WebSocket em tempo real.
- **Integrações e chamadas de API**:
  - `GET /api/auth/user`, `GET /api/auth/me` — usuário autenticado.
  - `GET /api/timeline/posts` (paginada, `feedType`, `tag`, `limit`, `offset`) — feed principal (infinite query).
  - `POST /api/timeline/posts` (multipart FormData: `content`, `media`, `videoLink`, `linkPreview`, `tags`) — criar post.
  - `GET /api/timeline/posts/:id` — post individual (usado pelo `CommentsModal`).
  - `DELETE /api/timeline/posts/:id` — excluir post.
  - `POST/DELETE /api/timeline/posts/:id/pin` — fixar/desafixar post.
  - `POST /api/timeline/posts/:id/reactions` (`{ type: 'like'|'dislike' }`) — reagir.
  - `POST /api/timeline/posts/:id/share` (`{ sharedWith, comment }`) — compartilhar.
  - `POST /api/timeline/posts/:id/report` (`{ reason, description }`) — denunciar post.
  - `POST /api/timeline/posts/:id/comments` (`{ content, parentCommentId }`) — comentar/responder.
  - `DELETE /api/timeline/posts/:id/comments/:commentId` — excluir comentário.
  - `POST /api/timeline/posts/:id/comments/:commentId/like` — curtir comentário.
  - `POST/DELETE /api/timeline/posts/:id/comments/:commentId/pin` — fixar/desafixar comentário.
  - `POST /api/timeline/posts/:id/comments/:commentId/report` — denunciar comentário.
  - `GET /api/timeline/trending-tags` — tags populares/em alta (usado em `CreatePost`, `TagFilters`, `TrendingTopics`).
  - `POST /api/link-preview` (`{ url }`) — gerar preview de link (título/descrição/imagem).
  - `GET /api/image-proxy?url=...` — proxy de imagens externas para exibição segura.
  - `GET /api/users/suggested-connections` — sugestões de conexão.
  - `POST /api/users/:id/follow` — seguir usuário.
  - `GET /api/users/ranking?limit=5` — ranking semanal.
  - `GET /api/users/:id/points`, `GET /api/users/:id/badges`, `GET /api/users/:id/stats` — dados de gamificação/perfil do `UserCard`.
  - `GET /api/gamification/daily-activities` — metas diárias; `POST /api/gamification/daily-activities/:id/claim` — resgatar recompensa.
  - `GET /api/gamification/weekly-challenges` — metas semanais.
  - `GET /api/challenges/active` — desafios ativos.
  - **WebSocket** (via `SocketContext`/`useSocket`): eventos `new_post`, `post_reaction`, `new_comment`, `comment_like`, `points_awarded`, `gamification_update` — atualizam o cache do React Query em tempo real sem novas requisições HTTP.
  - Biblioteca externa `browser-image-compression` (client-side, sem chamada de rede) e `canvas-confetti` (efeito visual local). Nenhuma integração com ElevenLabs/OpenAI/Gemini/Asaas/WhatsApp nesta página.
- **Dados exibidos**: posts (`content`, `media[]`, `videoLink`, `linkPreview`, `tags`, `likeCount`, `dislikeCount`, `commentCount`, `shareCount`, `isPinned`, `createdAt`, `author` com `name`/`profileImageUrl`/`areaAtuacao`/`badge`, `sharedPost`, `attachments`), comentários (`content`, `author`, `createdAt`, `likeCount`, `userHasLiked`, `isPinned`, `replies[]`, `parentCommentId`), dados de usuário/gamificação (`points`, `level`, `levelName`, XP, `stats.postsCount`, `followersCount`, `badges[]`), tags em alta (`name`, `postCount`), ranking (`name`, `profileImageUrl`, `points.level`), desafios/metas (`title`, `description`, `xpReward`/`reward`, `currentProgress`, `requirementCount`/`targetProgress`, `isCompleted`, `isClaimed`).

---

### Componente: BadgeCard (não é uma página, é reutilizável)

- **Arquivo fonte**: `client/src/components/BadgeCard.tsx` — não corresponde a nenhuma rota própria; é um componente de exibição de conquista/badge (recebe `badge`, `earned`, `size` como props) usado em outras telas (ex.: perfil, listagem de conquistas).
- **Inventário de UI**: círculo com gradiente âmbar/laranja (conquistado) ou cinza (não conquistado, com opacidade reduzida e escala de cinza), ícone central (mapeado a partir de `badge.icon`: award, star, trophy, zap, medal, crown, target, sparkles — padrão `Award`), nome do badge, descrição opcional, e requisito em pontos opcional ("`N` pontos"). Efeito hover de escala (`scale-hover`) e sombra ampliada quando conquistado. Três tamanhos disponíveis: sm/md/lg.
- **Observação**: este componente não é usado diretamente em `Timeline.tsx` (que usa sua própria renderização inline de badges dentro de `UserCard.tsx`), nem em `Dashboard.tsx`. É um bloco de UI genérico de gamificação reutilizado em outras partes do app não cobertas nesta leitura.

---

## Comunidade e Suporte (Fórum, Tópicos, Tickets, Notificações)

### Página: /forum — Fórum da Comunidade (lista de tópicos)

- **Arquivo fonte**: `client/src/pages/Forum.tsx` — rota `/forum` (registrada em `client/src/App.tsx`, linha 268).
- **Objetivo**: permite ao usuário navegar pelas discussões do fórum, filtrar/buscar tópicos, ver estatísticas e ranking da comunidade, e criar uma nova discussão (tópico) com editor rico, tags, anexo e link de vídeo.
- **Layout geral**: grid de 12 colunas (`lg:grid-cols-12`) — coluna principal com 9/12 (header + filtros + formulário inline de criação + lista de tópicos) e sidebar direita com 3/12 (busca, categorias, top contribuidores, tags em alta, estatísticas). Página com fundo cinza claro/escuro.

- **Inventário completo de UI**:
  - **Header** (Card):
    - Título "Fórum da Comunidade" + subtítulo "Compartilhe conhecimento e tire suas dúvidas".
    - Botão "Nova Discussão" / "Fechar" (ícone `Plus`/`ChevronUp`) — alterna exibição do formulário de criação inline (`data-testid="button-new-topic"`).
    - Barra de filtros de ordenação (botões toggle, um ativo por vez): "Em Alta" (ícone `Flame`, valor `recentes`), "Tendências" (`TrendingUp`, valor `em-alta`), "Fixados" (`Pin`, valor `fixados`), "Sem Resposta" (`MessageCircle`, valor `sem-resposta`). Nota: os rótulos visuais não correspondem exatamente ao valor interno (ex.: botão rotulado "Em Alta" usa o filtro `recentes`, que ordena por mais recente).
    - Indicador de filtros ativos (aparece só quando há categoria ou tag selecionada): badges removíveis de "Categoria: X" e "#tag", e botão "Limpar filtros".
  - **Formulário de criação inline** (Card, só quando aberto):
    - Campo "Título" (Input texto).
    - Campo "Categoria" (Select, opções vindas de `/api/categories`).
    - Campo "Conteúdo" — editor rich text Quill (toolbar: negrito/itálico/sublinhado/tachado, blockquote/code-block, listas ordenada/não ordenada, headers H1-H3, link, limpar formatação).
    - Campo de Tags: input com autocomplete (busca em `/api/forum/tags/search?q=`, debounce 300ms), tags selecionadas exibidas como chips removíveis (`#tag` com X), limite de 5 tags, contador "x/5", suporte a adicionar via Enter/vírgula e remover via Backspace, dropdown de sugestões com contagem de uso, opção de criar tag nova quando não encontrada, lista de "Tags populares" (top 10) quando campo vazio.
    - Campo "Anexar Documento" (opcional): botão de upload, preview de imagem (com botão "Remover") ou card de arquivo genérico (ícone + nome, com X para remover); tipos aceitos: imagens (jpeg/png/gif/webp/avif), PDF, DOC/DOCX, XLS/XLSX, TXT, ZIP, RAR; limite de 10MB (valida tipo e tamanho, com toast de erro).
    - Campo "Link de Vídeo" (opcional) — Input texto (YouTube, Vimeo etc.).
    - Preview automático de link (link preview): ao colar uma URL no conteúdo (não-vídeo), busca `/api/link-preview` (POST) após 1.5s de debounce, mostra card com imagem/título/descrição e botão de remover; spinner de carregamento enquanto busca.
    - Botões de rodapé: "Cancelar" (`button-cancel-topic`) e "Criar Discussão"/"Criando..." (`button-create-topic`, desabilitado durante envio).
  - **Lista de tópicos** (`topics-list`):
    - Estado de carregamento: card com texto "Carregando discussões...".
    - Estado vazio: ícone `MessageSquare`, mensagem condicional (busca sem resultado vs. nenhum tópico ainda).
    - Card por tópico (clicável, navega para `/forum/:slug`): borda lateral âmbar se `isSticky`; avatar do autor; título (2 linhas); resumo do conteúdo (HTML stripado, 150 caracteres); linha de metadados (nome do autor com link para perfil, tempo relativo, badge de categoria clicável que filtra); linha de tags (até 3 badges `#tag` clicáveis que filtram + indicador "+N"); stats à direita: curtidas (`ThumbsUp`), comentários (`MessageSquare`), visualizações (`Eye`).
  - **Sidebar direita**:
    - Card "Buscar": Input de busca por texto (filtra título/conteúdo).
    - Card "Categoria": botão "Todas as Categorias" (com contador total de tópicos) + botão por categoria (lista rolável, `max-h-96`).
    - Card "Top Contributors": lista dos 4 primeiros do ranking (`/api/users/ranking`), com ícones de posição (troféu ouro/prata/bronze para top 3, número para os demais), avatar, nome (link para perfil), nível de gamificação.
    - Card "Tags em Alta": lista de até 10 tags mais usadas (`/api/forum/trending-tags`), cada uma clicável para filtrar, mostrando contagem de tópicos entre parênteses.
    - Card "Estatísticas": três métricas (`/api/forum/stats`) — "Discussões Ativas", "Membros Online", "Respostas Hoje".

- **Fluxos do usuário**:
  - **Criar tópico**: clica "Nova Discussão" → preenche título, categoria (obrigatória), conteúdo via Quill (obrigatório), opcionalmente adiciona até 5 tags, anexa um arquivo e/ou cola um link de vídeo → clica "Criar Discussão" → POST multipart para `/api/forum/topics` → em sucesso, invalida cache da lista, reseta formulário, mostra toast e redireciona (após 500ms) para `/forum/:slug` do tópico criado.
  - **Filtrar/buscar**: digita na busca lateral, seleciona categoria na sidebar ou clica em badge de categoria/tag no card de um tópico, ou clica filtro de ordenação no topo — lista é recalculada client-side (filter + sort) sobre os tópicos já carregados.
  - **Navegar para tópico**: clique em qualquer card de tópico leva para a página de detalhe.

- **Regras de negócio visíveis no código**:
  - Título e conteúdo obrigatórios; categoria obrigatória (toasts de erro se ausentes).
  - Máximo de 5 tags por tópico.
  - Anexo: whitelist de MIME types e limite de 10MB.
  - Link preview não é buscado para URLs de vídeo (YouTube/Vimeo/Dailymotion) — nesses casos o vídeo é tratado separadamente pelo campo de vídeo/embed.
  - Filtro "Fixados" ordena por `isSticky` mas exibe todos os tópicos (não restringe apenas os fixados); filtro "Sem Resposta" ordena por `replyCount` crescente (não filtra estritamente tópicos com zero respostas).

- **Integrações e chamadas de API**:
  - `GET /api/categories` (categorias do fórum, compartilhadas via query key `/api/categories`).
  - `GET /api/forum/topics` (lista de tópicos).
  - `GET /api/forum/trending-tags` (tags em alta).
  - `GET /api/users/ranking` (top contribuidores).
  - `GET /api/forum/stats` (estatísticas do fórum).
  - `GET /api/forum/tags/search?q=&limit=10` (autocomplete de tags).
  - `POST /api/link-preview` (gera preview de link colado no conteúdo).
  - `POST /api/forum/topics` (criação de tópico, `multipart/form-data` com title, content, categoryId, tags (JSON), attachment, videoLink, linkPreview (JSON)).

- **Dados exibidos**: tópico (id, title, content, author {id, username/name, avatarUrl/profileImageUrl}, category {id, name}, tags[], isPinned/isSticky, viewCount, likeCount, commentCount/replyCount, createdAt, slug); categorias; tags e usageCount/topicCount; ranking de usuários (id, name, profileImageUrl, points.level); estatísticas agregadas do fórum (activeTopics, onlineUsers, repliesToday).

---

### Página: /forum/:idOrSlug — Tópico do Fórum (detalhe + comentários)

- **Arquivo fonte**: `client/src/pages/ForumTopic.tsx` — rota `/forum/:idOrSlug` (App.tsx linha 269).
- **Objetivo**: exibir o conteúdo completo de um tópico do fórum, permitir curtir, comentar, responder em threads aninhadas, marcar melhor resposta, fixar/denunciar/excluir comentários, editar/excluir o próprio tópico, e mostrar informações do autor e tópicos relacionados. Atualização em tempo real via WebSocket.
- **Layout geral**: breadcrumb no topo (Fórum > Categoria > Título); grid de 12 colunas com conteúdo principal (8/12: card do tópico + card de comentários) e sidebar (4/12: card do autor, estatísticas do tópico, discussões relacionadas).

- **Inventário completo de UI**:
  - **Breadcrumb**: link "Fórum" → link da categoria (se houver) → título do tópico (truncado).
  - **Card do Tópico**:
    - Título (H1) e, se o usuário atual for o autor ou admin, menu de ações (`⋮` dropdown): "Editar" (ícone `Edit`), "Excluir" (ícone `Trash2`, com `confirm()` nativo antes de deletar), "Denunciar" (ícone `Flag`, presente no menu mas sem handler de clique implementado).
    - Badges de tags do tópico.
    - Bloco do autor: avatar (link para perfil), nome (link para perfil), tempo relativo de criação.
    - **Modo visualização** (quando não está editando):
      - Conteúdo HTML sanitizado com DOMPurify (`dangerouslySetInnerHTML`), com suporte a embed de iframes de vídeo (YouTube/Vimeo) detectados no texto.
      - Embed de vídeo dedicado (`VideoEmbed`) se `topic.videoLink` estiver preenchido (extrai ID do YouTube/Vimeo e renderiza iframe responsivo).
      - Lista de anexos: imagens exibidas inline (`<img>`), outros arquivos exibidos como card com ícone `FileText`, nome, tamanho em MB e link externo (`ExternalLink`) para abrir/baixar.
      - Rodapé de ações: botão "Curtir" (ícone `ThumbsUp`, preenchido quando `hasLiked`, contador), botão "N comentários" (somente exibição), botão "Salvar" (ícone `Bookmark`, sem mutation associada — apenas visual).
    - **Modo edição inline** (`isEditingInline`, só autor/admin):
      - Campo "Título" (Input).
      - Campo "Conteúdo" (editor Quill, mesma toolbar do formulário de criação).
      - Campo "Categoria" (Select).
      - Campo "Tags" (mesmo padrão de chips + autocomplete + limite de 5 do Forum.tsx).
      - Campo "Anexar Documento": mostra anexo existente (imagem ou card de arquivo) com botão "Remover imagem"/substituir, ou permite anexar novo, mesmas validações de tipo/tamanho do formulário de criação.
      - Campo "Link de Vídeo" (Input).
      - Botões "Cancelar" e "Salvar Alterações" (com spinner durante `updateTopicMutation`).
  - **Card de Comentários**:
    - Cabeçalho "N Comentário(s)".
    - Formulário de novo comentário: avatar do usuário atual + Textarea "O que você está pensando?" + botão "Comentar"/"Enviando..." (desabilitado se vazio ou pendente).
    - Estado vazio: ícone `MessageSquare` + "Nenhuma resposta ainda. Seja o primeiro a comentar!".
    - Lista de comentários (árvore construída via `buildCommentTree`, paginada 10 em 10 client-side com botão "Ver mais comentários (N restantes)"; mensagem "✓ Todos os comentários foram carregados" quando esgotado). Comentários carregados via scroll infinito (`useInfiniteQuery`, 10 por página) do backend com Intersection Observer.
    - Cada comentário raiz: avatar, nome do autor (link), tempo relativo, badge "Melhor Resposta" (ícone `Award`) se `isAccepted`, indicador de fixado (ícone `Pin` preenchido) se `isPinned`, menu `⋮` com ações condicionais:
      - Se autor do comentário é o usuário atual: "Excluir" (vermelho).
      - Senão: "Denunciar" (vermelho).
      - Se o usuário atual é o autor do tópico (`isPostAuthor`): opção "Fixar"/"Desfixar".
    - Conteúdo do comentário sanitizado (DOMPurify + embed de vídeo).
    - Ações do comentário: "Curtir" (contador, desabilitado para comentários otimistas com id `temp-`) e "Responder" (abre formulário inline de resposta).
    - Formulário de resposta inline: Textarea + botões "Responder"/"Enviando..." e "Cancelar".
    - Respostas aninhadas (nested replies) renderizadas recursivamente pelo componente `RenderReply`, indentadas com borda esquerda, suportando múltiplos níveis de profundidade (cada resposta pode ter suas próprias respostas e seu próprio formulário inline de resposta).
  - **Sidebar**:
    - Card "Sobre o Autor": avatar grande, nome, área de atuação, badge de nível de gamificação (ícone + nome do nível), badges de conquista (até 3 + "+N"), bio, localização (`MapPin`), website (`Globe`, link externo), link "Ver Perfil Completo".
    - Card "Estatísticas": Visualizações (`Eye`), Curtidas (`ThumbsUp`), Respostas (`MessageSquare`), Criado (tempo relativo), Atualizado (se diferente de criado, `Clock`).
    - Card "Discussões Relacionadas" (até 4 tópicos da mesma categoria, excluindo o atual): título, contadores de visualizações e respostas, clicável.
  - **Estados**: loading (spinner + "Carregando discussão..."), erro (mensagem + botão "Voltar ao Fórum"), não encontrado (mensagem + botão "Voltar ao Fórum").

- **Fluxos do usuário**:
  - **Comentar**: escreve no textarea principal → "Comentar" → POST `/api/forum/topics/:id/replies` sem `parentCommentId` → limpa campo, invalida queries de replies/tópico/gamificação, toast de sucesso (ou toast "Conteúdo bloqueado" em caso de moderação automática rejeitar).
  - **Responder a um comentário/resposta**: clica "Responder" em qualquer nível → abre textarea inline associado àquele id → envia → POST com `parentCommentId` do comentário/resposta pai → comentário aparece aninhado.
  - **Curtir tópico/comentário**: clique otimista (atualiza contador/estado instantaneamente via `onMutate`, reverte em `onError`).
  - **Fixar/desfixar comentário**: apenas autor do tópico, via menu do comentário.
  - **Denunciar comentário**: qualquer usuário que não seja o autor do comentário, via menu (`POST /api/forum/comments/:id/report`).
  - **Excluir comentário próprio**: via menu (`DELETE /api/forum/comments/:id`).
  - **Editar tópico**: autor/admin abre menu "⋮" → "Editar" → formulário inline substitui a visualização, com atualização otimista imediata da UI enquanto salva no servidor.
  - **Excluir tópico**: autor/admin → menu → "Excluir" → `confirm()` do navegador → `DELETE /api/forum/topics/:id` → redireciona para `/forum`.
  - **Marcar/remover melhor resposta**: mutations `markBestAnswerMutation`/`removeBestAnswerMutation` existem no código (POST/DELETE em `/api/forum/topics/:id/best-answer[/:commentId]`), mas não há botão visível no JSX renderizado que as dispare diretamente (apenas a exibição do badge "Melhor Resposta" quando `comment.isAccepted`).
  - **Scroll direto para uma resposta**: se a URL tiver hash `#reply-:id` ou vier de uma notificação, a página rola até o elemento e o destaca temporariamente com anel colorido.

- **Regras de negócio visíveis no código**:
  - Ações de editar/excluir tópico e o menu de ações do tópico só aparecem se `currentUser.id === topic.author.id` ou `currentUser.isAdmin`.
  - Opção "Fixar/Desfixar" comentário só aparece para o autor do tópico (`isPostAuthor`).
  - Ação "Excluir" comentário só para o próprio autor do comentário; "Denunciar" para os demais.
  - Curtida em comentários otimistas (ainda não persistidos, id prefixado com `temp-`) fica desabilitada.
  - Todo conteúdo HTML (tópico e comentários) passa por `DOMPurify.sanitize` antes de renderizar, com tags/atributos extras liberados apenas para iframes de vídeo.
  - Tags limitadas a 5 no formulário de edição, igual à criação.
  - Anexos: mesma whitelist de tipos/tamanho (10MB) do fluxo de criação.
  - Comentários exibidos em lotes de 10 (paginação client-side sobre a árvore já carregada via infinite query).

- **Integrações e chamadas de API**:
  - `GET /api/forum/topics/:idOrSlug` (dados do tópico).
  - `GET /api/forum/topics` (para calcular tópicos relacionados).
  - `GET /api/users/:authorId/badges` (badges do autor).
  - `GET /api/categories` (para o select de edição).
  - `GET /api/forum/topics/:id/replies?limit=10&offset=N` (comentários paginados, com header `Authorization: Bearer <auth_token>` do localStorage).
  - `POST /api/forum/like` (curtir tópico, body `{ topicId }`).
  - `POST /api/forum/topics/:id/replies` (criar comentário/resposta, body `{ content, parentCommentId }`).
  - `POST /api/forum/topics/:id/comments/:commentId/like` (curtir comentário).
  - `POST /api/forum/topics/:id/best-answer/:commentId` e `DELETE /api/forum/topics/:id/best-answer` (marcar/remover melhor resposta).
  - `POST`/`DELETE /api/forum/topics/:id/comments/:commentId/pin` (fixar/desfixar comentário).
  - `POST /api/forum/comments/:commentId/report` (denunciar comentário).
  - `DELETE /api/forum/comments/:commentId` (excluir comentário).
  - `PUT /api/forum/topics/:id` (editar tópico, multipart/form-data).
  - `DELETE /api/forum/topics/:id` (excluir tópico).
  - WebSocket (via `useSocket`/`SocketContext`): eventos `forum_new_reply`, `forum_reaction`, `forum_topic_updated` — disparam invalidação/atualização otimista de cache em tempo real.
  - Hook `useGamification` para nível/pontos do autor; `getLevelIcon`/`getLevelColor`/`getLevelName` de `@/lib/levelIcons`.

- **Dados exibidos**: tópico completo (title, content, slug, videoLink, attachments[], author {id, name, email, profileImageUrl, bio, location, website, profession, areaAtuacao}, category {id, name, slug}, tags[], isSticky, isClosed, viewCount, likeCount, replyCount, createdAt, updatedAt, hasLiked, authorId); comentários (id, content, author, likeCount, hasLiked, createdAt, isAccepted, parentCommentId, isPinned); badges do autor; nível de gamificação do autor; tópicos relacionados (title, viewCount, replyCount, slug).

---

### Página: /support — Central de Suporte

- **Arquivo fonte**: `client/src/pages/Support.tsx` — rota `/support` (App.tsx linha 267).
- **Objetivo**: oferecer canais de contato com o suporte (chat, e-mail, WhatsApp) e uma FAQ com busca. O envio de e-mail abre um formulário que cria um ticket de suporte no backend.
- **Layout geral**: header simples (título + subtítulo) seguido de uma grade de 3 colunas com "cards de contato". Não há listagem de tickets já abertos pelo usuário nem exibição de status/prioridade na tela — o schema do banco tem esses campos (`status`, `priority`, `attachments`), mas esta tela só cria tickets, não os lista/acompanha.

- **Inventário completo de UI**:
  - Título "Central de Suporte" + subtítulo "Encontre respostas rápidas e suporte personalizado para todas as suas necessidades".
  - **Card "Chat ao Vivo"**: ícone `MessageCircle`, descrição "Resposta imediata com nossa equipe", horário "Segundas a 6hs às 18h" (ícone `Clock`), status "Online agora" (ícone `Check`), botão "Iniciar Chat" (`data-testid="button-start-chat"`) — sem `onClick` implementado (botão decorativo/não funcional no código lido).
  - **Card "E-mail"** (é o `DialogTrigger` de um Dialog): ícone `Mail`, descrição "Envie sua dúvida detalhadamente", "Resposta em até 24h", "Disponível", botão "Enviar E-mail" (`button-send-email`) que abre o modal.
    - **Dialog "Enviar E-mail"** (título H2 "Enviar E-mail"), contém um formulário (`react-hook-form` + `zodResolver` sobre `insertSupportTicketSchema`):
      - Campo "Nome Completo" (Input texto, obrigatório pelo schema).
      - Campo "E-mail" (Input type=email, obrigatório).
      - Campo "Assunto" (Select obrigatório) com opções: Dúvidas, Sugestão, Suporte, Financeiro, Vagas, Outro.
      - Campo "Mensagem" (Textarea, 6 linhas, obrigatório).
      - Botão "Enviar Mensagem"/"Enviando..." (submit, desabilitado durante `mutation.isPending`).
      - Validação de erros exibida via `FormMessage` em cada campo.
  - **Card "WhatsApp"**: ícone `MessageSquare`, descrição "Suporte direto via mensagem", "Resposta em até 2h", "Online agora", botão "Abrir WhatsApp" (`button-whatsapp`) que abre `https://wa.me/5541999077637?text=...` em nova aba (número e mensagem-modelo fixos no código).
  - **FAQ**: existe um array `faqItems` (6 perguntas/respostas fixas sobre acesso a ferramentas IA, login com problema, ferramentas offline, acesso a cursos, horário de atendimento, sistema de PLR) e lógica de filtro `filteredFAQs`/`searchQuery`, porém no JSX renderizado a seção de FAQ (grid/acordeão) não aparece — apenas os três cards de contato e o dialog de e-mail são efetivamente exibidos na página.

- **Fluxos do usuário**:
  - **Abrir chat**: clique em "Iniciar Chat" (sem ação implementada visível no código).
  - **Enviar e-mail/ticket**: clica no card "E-mail" ou botão "Enviar E-mail" → abre modal → preenche nome, e-mail, assunto (select), mensagem → "Enviar Mensagem" → `POST /api/support/tickets` → toast "Mensagem enviada!" → reset do formulário e fechamento do modal.
  - **WhatsApp**: clique em "Abrir WhatsApp" → abre link `wa.me` com mensagem pré-preenchida em nova aba.

- **Regras de negócio visíveis no código**:
  - Validação via Zod (`insertSupportTicketSchema`, com refinamento extra tornando `subject` obrigatório e não vazio).
  - Ticket criado sempre com `status: "open"` e `priority: "medium"` por padrão no schema (defaults do banco); a tela não permite ao usuário escolher prioridade nem visualizar status.

- **Integrações e chamadas de API**:
  - `POST /api/support/tickets` (criação do ticket, body conforme `InsertSupportTicket`: name, email, subject, message).
  - Link externo estático para WhatsApp (`wa.me`), não é uma API da aplicação.

- **Dados exibidos**: nenhum dado dinâmico do banco é listado na tela (é majoritariamente estático/formulário); os únicos dados "do usuário" são os que ele próprio digita no formulário de e-mail. Campos do modelo `supportTickets` usados no formulário: `name`, `email`, `subject`, `message` (campos `status`, `priority`, `attachments`, `userId` existem na tabela mas não são manipulados nesta tela).

---

### Página: /notifications — Central de Notificações

- **Arquivo fonte**: `client/src/pages/Notifications.tsx` — rota `/notifications` (App.tsx linha 266).
- **Objetivo**: listar todas as notificações do usuário (respostas no fórum, curtidas, badges, seguidores, menções etc.), permitir filtrar por data, marcar notificações individuais ou todas como lidas, e navegar até o conteúdo relacionado ao clicar.
- **Layout geral**: página simples de coluna única — cabeçalho com título e ação em massa, barra de filtros, e lista vertical de cards de notificação.

- **Inventário completo de UI**:
  - Cabeçalho: ícone `Bell` + título "Notificações", subtítulo "Fique por dentro de tudo que acontece".
  - Botão "Marcar todas como lidas" (ícone `CheckCheck`, `data-testid="button-mark-all-read"`) — só aparece quando `unreadCount > 0`; desabilitado durante o envio.
  - Filtro de data (Select, `select-notifications-filter`, ícone `Calendar`): opções "Todas" (`all`), "Hoje" (`today`), "Última semana" (`week`), "Data específica" (`custom`).
  - Quando filtro = "Data específica": campo adicional `Input type="date"` (`input-custom-date`) para escolher a data exata.
  - Badge de contagem: "{N filtrado} de {total} notificações", exibido só se há notificações carregadas.
  - **Lista de notificações**:
    - Estado de carregamento: spinner + "Carregando notificações...".
    - Estado vazio (`empty-notifications`): ícone `Bell` grande, "Nenhuma notificação", "Você está em dia com tudo!".
    - Card por notificação (clicável, `notification-{id}`): destaque visual diferente se não lida (borda + `card-glow`) vs. lida (`opacity-75`); emoji de ícone por tipo (❤️ like, 💬 reply, 🏆 badge, 👤 follow, 🔔 default); texto da mensagem (`notification.message`); tempo relativo formatado (função local `formatTimeAgo`, granularidade min/h/dia); badge "Nova" se não lida; botão de marcar individual como lida (ícone `Check`, aparece só se não lida, `mark-read-{id}`, com `stopPropagation` para não disparar a navegação do card).

- **Fluxos do usuário**:
  - **Ver notificações filtradas**: seleciona um período no Select (ou escolhe data específica) — lista é recalculada client-side sobre as notificações já carregadas (`useMemo`).
  - **Marcar uma notificação como lida**: clica no ícone de check no card → `POST /api/notifications/:id/read` → invalida query e recarrega.
  - **Marcar todas como lidas**: clica no botão do cabeçalho → `POST /api/notifications/read-all` → invalida query, toast de confirmação.
  - **Abrir notificação (navegar ao conteúdo relacionado)**: clique em qualquer parte do card (exceto o botão de check) → se não lida, marca como lida automaticamente antes de navegar → roteamento condicional pelo tipo/relacionamento:
    - `type === 'follow'` com `relatedUserId` → `/profile/:relatedUserId`.
    - `relatedTopicId` presente → `/forum/:relatedTopicId` (nota: usa o id, não o slug).
    - `relatedPostId` presente → `/timeline?post=:relatedPostId`, e após navegar faz scroll suave até o post e o destaca temporariamente com anel.
    - `type` `badge` ou `achievement` → `/profile/:userId` (perfil do próprio usuário).
    - Caso nenhum se aplique → fallback para `/timeline`.

- **Regras de negócio visíveis no código**:
  - O botão "Marcar todas como lidas" só é renderizado quando existe ao menos uma notificação não lida.
  - O botão individual "marcar como lida" só aparece em notificações não lidas.
  - Filtro "Hoje" usa início do dia atual; "Última semana" usa 7 dias corridos anteriores a hoje; "Data específica" filtra pelo intervalo do dia inteiro escolhido.
  - Notificação é marcada como lida automaticamente ao ser clicada (mesmo se o usuário não usar o botão de check), antes de navegar.

- **Integrações e chamadas de API**:
  - `GET /api/notifications` (lista completa de notificações do usuário logado).
  - `POST /api/notifications/:id/read` (marcar uma como lida).
  - `POST /api/notifications/read-all` (marcar todas como lidas).

- **Dados exibidos**: cada notificação (`Notification` do schema): `id`, `userId`, `actorId`, `type` (reply, like, best_answer, mention, comment, reaction, share, topic_reply, follow, badge, achievement etc.), `message`, `relatedTopicId`, `relatedReplyId`, `relatedPostId`, `relatedCommentId`, `isRead`, `createdAt`.

---

## Perfil de Usuário e Indicações (Afiliados)

### Página: /profile e /users/:id — Perfil de Usuário

- **Arquivo fonte**: `client/src/pages/Profile.tsx` (1424 linhas). Rotas: `/profile` (perfil próprio, sem parâmetro) e `/users/:id` (perfil de outro usuário, com parâmetro `id`).
- **Objetivo**: exibir o perfil público de um usuário (bio, localização, progresso de gamificação, posts, tópicos de fórum, atividades) e, quando é o próprio usuário logado, permitir editar dados pessoais e avatar.

- **Distinção "próprio perfil" vs "perfil de outro usuário"**:
  - `isOwnProfile = !userIdParam || userIdParam === currentUser?.id` — verdadeiro em `/profile` (sem param) ou quando `:id` bate com o usuário logado.
  - Quando `isOwnProfile` é `true`: dados vêm de `currentUser` (hook `useAuth`), não dispara a query `/api/users/:id`; mostra bloco de informações privadas (e-mail e telefone); mostra botão "Editar Perfil" (abre modal); mostra botão de câmera sobre o avatar para trocar a foto.
  - Quando `isOwnProfile` é `false`: dados vêm da query `/api/users/:id` (`profileUser`); NÃO mostra e-mail/telefone privados; mostra botões "Mensagem" e "Seguir"/"Seguindo" (toggle de follow) em vez de "Editar Perfil"; dispara query extra `is-following` para saber se o usuário logado já segue o perfil visitado.
  - Em ambos os casos são exibidos: seguidores, seguindo, posts, curtidas, melhores respostas, badges, XP/nível, posts, tópicos de fórum e atividades recentes — ou seja, o conteúdo "público" das abas é o mesmo; o que muda é a camada de edição/interação social.

- **Layout geral**:
  - Container central `max-w-5xl`.
  - Card de cabeçalho estilo LinkedIn: faixa de capa (cor sólida verde `#29654f`), avatar grande sobreposto (128px) com botão de câmera (só dono), nome, badge de nível de gamificação, "@handle" derivado do nome, especialidade (`areaAtuacao`), bio, localização, website, data de entrada; bloco separado com informações privadas (só dono); botões de ação à direita (Mensagem/Seguir ou Editar Perfil).
  - Grid de 5 cards de estatísticas (2 colunas em mobile, 5 em desktop): Seguidores, Seguindo, Posts, Curtidas, Melhores Respostas.
  - Card único com `Tabs` de 4 abas: Gamificação, Posts, Fórum, Atividade.
  - Dois modais (Dialog): Editar Perfil e Atualizar Foto de Perfil.

- **Inventário completo de UI**:
  - **Cabeçalho / Avatar**
    - Avatar 128x128 com `AvatarImage`/`AvatarFallback` (iniciais do nome).
    - Botão flutuante de câmera (ícone `Camera`) sobre o avatar — abre modal de avatar (visível só se `isOwnProfile`).
    - Título `h1` com nome do usuário.
    - Badge de nível de gamificação (gradiente âmbar/amarelo) com `levelName`, exibido se existir.
    - Texto "@handle" (nome em minúsculas sem espaços).
    - Especialidade (`areaAtuacao`), se preenchida.
    - Bio, se preenchida.
    - Linha de info pública: localização (ícone `MapPin`), website (ícone `Globe`, link externo `target=_blank`), data de entrada formatada em pt-BR (ícone `Calendar`).
    - Bloco de info privada (fundo tracejado), só dono: e-mail (ícone `Mail`), telefone formatado (ícone `Phone`), se houver.
    - Botão "Mensagem" (outline, ícone `MessageCircle`) — visível só se não for próprio perfil (sem ação de clique implementada além do botão em si).
    - Botão "Seguir"/"Seguindo" (ícone `UserPlus`/`UserCheck`, spinner quando pendente) — visível só se não for próprio perfil; dispara follow/unfollow.
    - Botão "Editar Perfil" (ícone `Edit2`) — visível só se dono; abre `isEditDialogOpen`.
  - **Cards de estatísticas** (5): Seguidores (`followersCount`), Seguindo (`followingCount`), Posts (`stats.postsCount`), Curtidas (`userPoints.likesReceived`), Melhores Respostas (`userPoints.bestAnswers`, com ícone `Award`).
  - **Aba "Gamificação"**:
    - Texto explicativo do sistema de XP.
    - Card de progresso (se `userPoints` existir): "Nível X", "pontos XP / (nível×100) XP", barra `Progress`, texto "N XP para o próximo nível".
    - Bloco "Níveis e Progressão": 5 cards fixos de níveis — Novato (Nível 1, 0-99 XP, ícone `Sparkles`), Aprendiz (Nível 2, 100-299 XP, ícone `BookOpen`), Contribuidor (Nível 3, 300-599 XP, ícone `Users`), Mentor (Nível 4, 600-999 XP, ícone `Award`), Mestre (Nível 5, 1000+ XP, ícone `Trophy`) — cada um com nome, badge de nível, faixa de XP e descrição curta.
    - Bloco "Atividades Diárias" (resetam à meia-noite), lista fixa de 6 cards com nome, descrição e recompensa: Login Diário (+3 XP), Criar Postagem (+10 XP), Comentar em Posts (3 posts, +15 XP), Curtir Conteúdo (5 curtidas, +10 XP), Participar do Fórum (+10 XP), Expandir Rede (seguir 2 membros, +4 XP).
    - Tabela "Tabela de Pontuação" com colunas Ação / XP, linhas fixas: Criar postagem (+10), Comentar em post (+5), Dar curtida (+2), Receber curtida (+3), Compartilhar post (+4), Seguir usuário (+2), Ganhar seguidor (+5), Criar tópico no fórum (+15), Responder tópico (+10), Melhor resposta (+25, destacada com ícone `Award`), Login diário (+3).
    - Bloco "Dicas para Ganhar Mais XP" (fundo azul) com lista de 4 dicas fixas.
  - **Aba "Posts"**:
    - Título "Posts Publicados".
    - Lista de cards de post (paginada, 15 por página): conteúdo do post renderizado via `dangerouslySetInnerHTML` (sanitizado por `sanitizeUserHtml`), contadores de curtidas (`ThumbsUp`), comentários (`MessageCircle`), compartilhamentos (`Share2`), data formatada à direita.
    - Paginação (`Pagination`/`PaginationItem`) com botões Anterior/Próximo e botões numerados.
    - Estado vazio: ícone `MessageCircle`, "Nenhum post publicado", texto de incentivo.
  - **Aba "Fórum"**:
    - Título "Discussões no Fórum".
    - Lista de cards de tópico (paginada, 15 por página): título do tópico, badge de categoria (se houver), contadores de visualizações (`Eye`), respostas (`MessageCircle`), curtidas (`ThumbsUp`), data.
    - Paginação igual ao padrão acima.
    - Estado vazio: ícone `Trophy`, "Nenhuma discussão criada".
  - **Aba "Atividade"**:
    - Título "Atividade Recente".
    - Lista de cards de atividade (paginada, 15 por página), cada um com ícone conforme tipo (`post_created`/`comment_created`/`forum_reply_created` → `MessageCircle`; `topic_created` → `Trophy`; `post_liked` → `Heart`), texto da ação, conteúdo truncado (2 linhas), timestamp formatado (data + hora) posicionado no canto superior direito do card.
    - Paginação igual ao padrão acima.
    - Estado vazio: ícone `TrendingUp`, "Nenhuma atividade registrada".
  - **Modal "Editar Perfil"** (só dono, `isEditDialogOpen`):
    - Campo Nome Completo (obrigatório, validação zod).
    - Campo Especialidade (`areaAtuacao`, texto livre).
    - Campo Localização com autocomplete de cidades brasileiras (busca via API do IBGE, debounce de 300ms, mínimo 2 caracteres, dropdown com até 10 sugestões nome+UF).
    - Campo Telefone (privado) — **desabilitado/bloqueado** (`disabled`, fundo cinza), com aviso "Este campo não pode ser alterado"; exibido formatado.
    - Campo CPF (privado) — **desabilitado/bloqueado**, mesmo aviso, exibido formatado (mask 000.000.000-00).
    - Campo Website (texto livre).
    - Campo Bio/"Sobre você" (textarea, 4 linhas).
    - Botões "Cancelar" e "Salvar Alterações" (mostra "Salvando..." durante a mutation).
  - **Modal "Atualizar Foto de Perfil"** (só dono, `isAvatarDialogOpen`):
    - Preview do avatar atual (128px, com anel destacado).
    - Input de arquivo oculto (`accept="image/*"`), acionado por botão "Escolher Nova Foto" (ícone `ImageIcon`).
    - Validação de tamanho máximo de 5MB (toast de erro se exceder).
    - Compressão automática da imagem no navegador (`browser-image-compression`): max 1MB, max 1024px, qualidade 95%, convertida para WebP, sem preservar EXIF; toasts de progresso "Otimizando..." e "Pronto!"; erro tratado com toast.
    - Texto de ajuda "JPG, PNG, GIF ou WEBP (máx. 5MB)".
    - Botões "Cancelar" e "Salvar Avatar" (mostra "Salvando..." durante a mutation).
  - **Estado de carregamento**: spinner central "Carregando perfil..." enquanto `isLoadingUser`.

- **Fluxos do usuário**:
  - Ver próprio perfil: acessa `/profile` → vê dados de `currentUser`, e-mail/telefone privados, pode clicar em "Editar Perfil" ou no ícone de câmera.
  - Editar perfil: clica em "Editar Perfil" → modal abre com dados pré-preenchidos → edita nome/especialidade/localização/website/bio (telefone e CPF são bloqueados) → digitar localização dispara busca de cidades no IBGE e permite selecionar sugestão → clica "Salvar Alterações" → mutation `PUT /api/auth/user` (envia tudo exceto phone/cpf) → toast de sucesso → fecha modal → invalida cache de `/api/auth/user` e `/api/users/:id`.
  - Trocar avatar: clica no ícone de câmera → modal abre → clica "Escolher Nova Foto" → seleciona arquivo → valida tamanho → comprime/converte para WebP → preview atualizado → clica "Salvar Avatar" → mutation `PUT /api/auth/user` com a imagem em base64 → toast de sucesso → fecha modal.
  - Ver perfil de outro usuário: acessa `/users/:id` → vê dados públicos (sem e-mail/telefone) → pode clicar em "Seguir"/"Seguindo" (toggle follow/unfollow) ou "Mensagem" (botão presente, sem handler de navegação visível no código lido) → contador de seguidores/seguindo e status de follow são invalidados/recarregados após a ação.
  - Navegar pelas abas: Gamificação (padrão), Posts, Fórum, Atividade — cada uma pagina seu próprio conjunto de dados (15 itens por página) de forma independente.

- **Regras de negócio visíveis no código**:
  - Telefone e CPF são exibidos mas **não podem ser editados** pelo usuário (campos `disabled` no form) — mesmo se alterados no estado do form, são removidos explicitamente do payload antes do PUT (`const { phone, cpf, ...allowedData } = data`).
  - Validação zod: nome obrigatório; CPF (se preenchido) deve ter 11 dígitos; demais campos opcionais.
  - Avatar: limite de 5MB no arquivo original; compressão client-side obrigatória antes do upload (via `browser-image-compression`, convertendo para WebP).
  - Botões de interação social (Seguir/Mensagem) só aparecem para usuários que não são o dono do perfil (`!isOwnProfile`).
  - Bloco de e-mail/telefone só é renderizado para o dono (`isOwnProfile`), tratando esses dados como privados/não públicos para outros usuários.
  - Paginação de Posts, Fórum e Atividade é feita client-side (fatiamento do array) com 15 itens por página, não via parâmetros de API.
  - Cálculo de nível/XP e barra de progresso vêm do hook `useGamification(userId)`.

- **Integrações e chamadas de API**:
  - `GET /api/users/:id` (perfil de outro usuário, via `queryKey ["/api/users", userId]`, só quando `!isOwnProfile`).
  - `GET /api/users/:id/points` — pontos/XP/nível.
  - `GET /api/users/:id/badges` — badges conquistados.
  - `GET /api/users/:id/posts` — posts do usuário.
  - `GET /api/users/:id/forum-topics` — tópicos de fórum criados.
  - `GET /api/users/:id/recent-activities` — atividades recentes.
  - `GET /api/users/:id/is-following` — se o usuário logado segue este perfil (só perfis de terceiros).
  - `GET /api/users/:id/followers` — lista de seguidores (usada para contagem).
  - `GET /api/users/:id/following` — lista de quem o usuário segue (usada para contagem).
  - `GET /api/users/:id/stats` — estatísticas (contagem de posts).
  - `POST /api/users/:id/follow` — seguir usuário.
  - `DELETE /api/users/:id/follow` — deixar de seguir.
  - `PUT /api/auth/user` — atualizar dados do perfil (nome, especialidade, localização, bio, website) e, separadamente, avatar (`profileImageUrl`).
  - Serviço externo: API pública do IBGE (`https://servicodados.ibge.gov.br/api/v1/localidades/municipios`) para autocomplete de cidades brasileiras.
  - Biblioteca `browser-image-compression` para processar imagem de avatar no navegador antes do upload.

- **Dados exibidos**: `User` (name, email, phone, cpf, areaAtuacao, location, bio, website, profileImageUrl, createdAt), `UserPoints` (points, level, likesReceived, bestAnswers), `Badge[]`, posts (content, likeCount, commentCount, shareCount, createdAt), tópicos de fórum (title, category.name, viewCount, replyCount, likeCount, createdAt), atividades recentes (type, action, content, timestamp), seguidores/seguindo (listas de `User`), status de follow (`isFollowing`), estatísticas (`postsCount`).

---

### Página: /indicacoes — Sistema de Indicações (Programa de Afiliados)

- **Arquivo fonte**: `client/src/pages/Referrals.tsx` (1189 linhas). Rota: `/indicacoes`.
- **Objetivo**: permitir que o usuário compartilhe seu link de indicação, acompanhe cliques/conversões/comissões geradas por assinaturas de indicados, configure uma chave PIX e solicite saques do saldo de comissões disponível.

- **Layout geral**:
  - Container `container mx-auto`, título "Sistema de Indicações" com subtítulo "Compartilhe seu link e ganhe 50% de comissão recorrente nas assinaturas".
  - `Tabs` com 4 abas: Visão Geral, Indicados, Comissões, Saques.
  - Duas modais (Dialog): Configurar Chave PIX e Solicitar Saque.

- **Inventário completo de UI**:
  - **Aba "Visão Geral"**:
    - Card "Seu Link de Indicação": input somente leitura com o link de indicação (ou "Carregando..."), botão "Copiar" (ícone `Copy`/`Check` ao copiar, com feedback de 2s) que usa `navigator.clipboard`; bloco informativo azul "Como funciona" listando: compartilhar o link; ganhar 50% do valor da assinatura quando alguém assina pelo link; comissão recorrente (50% a cada renovação); saldo bloqueado por 8 dias (lei de reembolso) antes de ficar disponível para saque.
    - 4 cards de estatística (skeleton de loading enquanto `statsLoading`):
      - "Total de Cliques" (ícone `Eye`).
      - "Conversões" + taxa de conversão em % (ícone `Percent`).
      - "Saldo a Liberar" (ícone `Clock`, texto "8 dias de reembolso").
      - "Disponível para Saque" (ícone `DollarSign`) — mostra botão "Sacar Agora" somente se saldo disponível ≥ R$10,00 (1000 centavos) **e** chave PIX configurada.
    - 4 cards de contagem de indicações por status: "Assinaturas Ativas" (ícone `UserCheck`, verde), "Aguardando Liberação" (ícone `Clock`, amarelo), "Cancelados" (ícone `UserX`, vermelho), "Reembolsados" (ícone `RefreshCw`, laranja).
    - Card "Resumo Financeiro": Total Ganho (Bruto), Total Estornado, Total Líquido, Total Sacado, Saldo Atual (pendente + disponível somados).
    - Card "Gerenciamento de Saques":
      - Botão "Configurar PIX" / "Atualizar PIX" (ícone `CreditCard`) — abre modal de PIX, pré-preenchido se já houver chave salva.
      - Botão "Solicitar Saque" (ícone `DollarSign`) — desabilitado se não houver chave PIX configurada ou saldo disponível < R$10,00.
      - Bloco de aviso com "Taxa de Saque: R$ 2,49" e "Mínimo para Saque: R$ 10,00".
      - Indicador de status do PIX: se configurado, mostra badge verde com tipo da chave e a chave mascarada/completa; se não configurado, aviso amarelo pedindo para configurar.
  - **Aba "Indicados"**:
    - Filtro de período (Select): Todos os períodos / Hoje / Últimos 7 dias / Últimos 30 dias.
    - Card "Usuários Indicados":
      - Filtro de status (Select com ícone `Filter`): Todos / Ativos / Pendentes / Cancelados / Reembolsados.
      - 4 mini-cards de contagem por status (Ativos, Pendentes, Cancelados, Reembolsados) vindos de `byStatus`.
      - Skeleton de loading (5 linhas) enquanto carrega.
      - Estado vazio: ícone `Users`, mensagem contextual conforme filtro aplicado ou mensagem padrão de incentivo a compartilhar o link.
      - Tabela com colunas: Usuário (avatar + nome + e-mail), Status (badge colorido conforme status: Bloqueado/8 dias, Ativo, Cancelado, Reembolsado, Disponível), Total Comissões (valor formatado em R$), Data Indicação, Última Comissão (ou "-" se nunca houve).
      - Paginação (`TablePagination`), 15 itens por página.
  - **Aba "Comissões"**:
    - Mesmo filtro de período (Select) da aba Indicados.
    - Card "Histórico de Comissões":
      - Skeleton de loading; estado vazio com ícone `Users` e mensagem de incentivo.
      - Tabela com colunas: Indicado (nome + e-mail), Tipo (badge "1ª" para `subscription` ou "Renov." para renovação), Valor Retido (mostrado só se status `pending`, senão R$ 0,00), Disponível (mostrado só se status `completed`/`active`, senão R$ 0,00), Status (badge), Data (data e hora).
      - Paginação (`TablePagination`), 15 itens por página.
  - **Aba "Saques"**:
    - Mesmo filtro de período (Select).
    - Card "Histórico de Saques":
      - Estado vazio: ícone `DollarSign`, "Você ainda não realizou nenhum saque."
      - Tabela com colunas: Valor, Chave PIX (fonte monoespaçada), Status (badge: Concluído/Processando/Falhou), Data.
      - Paginação (`TablePagination`), 15 itens por página.
  - **Modal "Configurar Chave PIX"**:
    - Select "Tipo de Chave": CPF, CNPJ, E-mail, Telefone, Chave Aleatória.
    - Input "Chave PIX" (texto livre).
    - Validação zod: tipo obrigatório, chave obrigatória.
    - Botões "Cancelar" e "Salvar" (mostra "Salvando..." durante a mutation).
  - **Modal "Solicitar Saque de Comissões"**:
    - Exibe saldo disponível atual e "Taxa de saque: R$ 2,49" no cabeçalho.
    - Input "Valor do Saque (R$)" (texto livre, placeholder "Ex: 50,00", aceita formato brasileiro com vírgula).
    - Validação zod: valor obrigatório, mínimo R$ 10,00 (após normalização do formato numérico brasileiro).
    - Validações adicionais no submit (fora do zod): saldo insuficiente (toast de erro se valor pedido > saldo disponível); chave PIX não configurada (toast de erro pedindo para configurar antes).
    - Botões "Cancelar" e "Solicitar Saque" (mostra "Processando..." durante a mutation).
    - Tratamento de erro especial: se a API retornar HTTP 503 ou código `SERVICE_TEMPORARILY_UNAVAILABLE`, mostra toast "⚠️ Instabilidade Temporária" com mensagem para tentar novamente em alguns minutos; outros erros mostram a mensagem retornada ou uma genérica.

- **Fluxos do usuário**:
  - Compartilhar link: aba Visão Geral → clica em "Copiar" → link copiado para a área de transferência → toast de confirmação.
  - Configurar PIX: clica em "Configurar PIX"/"Atualizar PIX" → modal abre com dados atuais (se houver) → seleciona tipo de chave → digita a chave → "Salvar" → `PUT /api/referrals/pix-config` → toast de sucesso → fecha modal → invalida saldo e wallet.
  - Solicitar saque: clica em "Solicitar Saque" (ou "Sacar Agora" no card de saldo) → modal abre mostrando saldo disponível → digita valor (mínimo R$10) → sistema valida saldo suficiente e existência de chave PIX antes de enviar → `POST /api/referrals/request-withdrawal` com valor em centavos → toast de sucesso ou erro (incluindo caso de indisponibilidade temporária do serviço) → fecha modal → invalida wallet, saldo, lista de saques e estatísticas completas.
  - Consultar indicados: aba Indicados → filtra por período e/ou status → navega pelas páginas da tabela → vê detalhamento de cada indicado (status da assinatura, total de comissões geradas, datas).
  - Consultar comissões: aba Comissões → filtra por período → navega pelas páginas → vê cada lançamento de comissão (primeira assinatura vs renovação), valor retido/disponível conforme status.
  - Consultar saques: aba Saques → filtra por período → navega pelas páginas → vê histórico de saques com status (Concluído/Processando/Falhou).

- **Regras de negócio visíveis no código**:
  - Comissão de indicação: **50% recorrente** sobre o valor da assinatura, inclusive em renovações (não é comissão única).
  - Saldo de comissão fica **bloqueado por 8 dias** após a venda (janela de reembolso legal) antes de tornar-se "disponível" para saque; status intermediário chamado "Bloqueado (8 dias)" / `pending`.
  - Saque mínimo: **R$ 10,00** (1000 centavos) — tanto na validação do formulário (zod) quanto na condição de habilitar os botões "Sacar Agora"/"Solicitar Saque".
  - Taxa de saque fixa: **R$ 2,49** (exibida como informação, não deduzida no formulário visível).
  - Saque exige chave PIX previamente configurada — botões de saque ficam desabilitados sem isso, e há checagem extra no submit.
  - Validação de saldo suficiente antes de enviar o pedido de saque (comparação client-side com `balance.balanceAvailable`).
  - Status possíveis de comissão/indicação mapeados: `pending` (Bloqueado/8 dias), `active` (Ativo), `canceled`/`cancelled` (Cancelado), `refunded` (Reembolsado), `completed` (Disponível) — cada um com variante visual de badge própria (default/secondary/destructive).
  - Tipos de comissão: `subscription` (primeira assinatura, badge "1ª") vs renovação (badge "Renov.").
  - Filtro de período (Hoje / 7 dias / 30 dias / Todos) é aplicado a indicados, comissões e saques de forma independente por aba, cada um resetando a paginação ao mudar o filtro.
  - Tratamento diferenciado de erro 503 / código `SERVICE_TEMPORARILY_UNAVAILABLE` no saque, sugerindo instabilidade temporária no processamento (indício de integração com processador de pagamento externo).

- **Integrações e chamadas de API**:
  - `GET /api/referrals/my-code` — código/link de indicação do usuário.
  - `GET /api/referrals/complete-stats` — estatísticas completas (cliques, conversões, taxa de conversão, financeiro, contagem por status).
  - `GET /api/referrals/balance` — saldo pendente/disponível e dados de PIX configurado.
  - `GET /api/referrals/commissions` (paginado via `limit`/`offset`, com filtros de data) — histórico de comissões.
  - `GET /api/referrals/referred-users` (paginado, com filtro de `status` e de data) — lista de usuários indicados.
  - `GET /api/referrals/withdrawals` (com filtro de data) — histórico de saques.
  - `PUT /api/referrals/pix-config` — salvar/atualizar chave PIX.
  - `POST /api/referrals/request-withdrawal` — solicitar saque (envia `amountCents`).
  - Não há chamadas a serviços externos de IA/mensageria nesta página; a menção a possível gateway de pagamento é inferida apenas pelo tratamento de erro 503/`SERVICE_TEMPORARILY_UNAVAILABLE` no saque (provável processador PIX, sem nome exposto no front-end).

- **Dados exibidos**: `ReferralCode` (código + `referralLink`), `ReferralWallet`/saldo (`balancePending`, `balanceAvailable`, `pixKey`, `pixKeyType`), estatísticas agregadas (`overview`: totalClicks, totalConversions, conversionRate, totalReferredUsers; `financial`: totalEarned, totalRefunded, totalWithdrawn, balancePending, balanceAvailable, netEarnings; `referrals`: active/pending/cancelled/refunded; `commissionsByStatus`), lista de usuários indicados (`referredUser` com id/name/email/profileImageUrl, subscriptionStatus, totalCommissions, activeCommissions, createdAt, lastCommissionAt) com contagem por status, `ReferralCommissionWithRelations` (referredUser, type, commissionAmountCents, status, createdAt), lista de saques (amountCents, pixKey, status, createdAt).

---

## Estúdio de Criação IA (Imagem, Copy, Voz, Vídeo, Avatar, Ebooks)

### Página: /ai-studio — Estúdio de Criação IA

- **Arquivo fonte**: `client/src/pages/AIStudio.tsx` (861 linhas). **Rota**: `/ai-studio` (registrada em `client/src/App.tsx`, componente `AIStudio` carregado via `lazy()`).
- **Objetivo**: central única onde o usuário gera criativos (imagem), copywriting, narração (TTS), vídeo com avatar (lip-sync), vídeo de produto e clona/gerencia vozes, tudo com idioma configurável e histórico persistente de gerações.
- **Layout geral**: Hero header com gradiente (ícone `Sparkles`, título, subtítulo) + seletor de idioma global + badge "Qualidade premium — conecte suas chaves de API". Abaixo, um componente `Tabs` **vertical** (`orientation="vertical"`): lista de abas fixa à esquerda (sidebar, `lg:sticky lg:top-20`) e conteúdo à direita ocupando o restante da largura. Em telas menores as abas viram uma barra horizontal rolável no topo. Ao final da página (fora das tabs), aparece uma "Galeria de criações recentes" (carrossel horizontal) da sessão atual.
- **Inventário completo de UI**:
  - **Header/Hero**:
    - Ícone `Sparkles` num quadrado com gradiente primary→emerald.
    - Título "Estúdio de Criação IA" + subtítulo descritivo.
    - Seletor de **idioma global** (`<select>` com ícone `Languages`): opções Português (BR) [padrão `pt-BR`], English, Español, Français, Italiano, Deutsch. Esse `lang` é enviado como `idioma` em todas as chamadas de geração (imagem, copy, tts, avatar, vídeo).
    - Badge informativo com bolinha pulsante verde: "Qualidade premium — conecte suas chaves de API".
  - **TabsList** (7 abas, cada uma com ícone lucide): Criativo (`ImageIcon`), Copy (`Type`), Narração (`Mic`), Avatar (`UserSquare2`), Vídeo (`Video`), Clonar Voz (`AudioWaveform`), Histórico (`History`). Rótulo de seção "Ferramentas" acima da lista (visível apenas em telas ≥lg).
  - **Aba Criativo** (grid 2 colunas — formulário | preview):
    - Badge de provider: "GPT-Image" (componente `ProviderBadge`, ícone `Sparkles`).
    - Campo "Produto / oferta *" (Input texto, placeholder "Ex.: tênis esportivo branco premium").
    - Campo "Headline na imagem" (Input texto).
    - Campo "Proporção": chips 1:1, 4:5, 9:16, 16:9 (cada um mapeia para `aspect-*` do preview e para `size` enviado à API: 16:9→1536x1024, 9:16/4:5→1024x1536, senão 1024x1024).
    - Campo "Estilo visual": chips preset (Fotográfico, Minimalista, Gradiente, Estúdio, 3D realista, Vibrante, Cinematográfico, Flat/clean) + Input livre.
    - Campo "Público-alvo" (Input texto).
    - "Qualidade": chips Alta/Média/Baixa.
    - "Formato": chips PNG/JPEG/WEBP.
    - "Fundo": chips Automático/Opaco/Transparente (hint: transparente exige PNG/WebP; selecionar "transparent" força o formato para "png" se estava em "jpeg").
    - Botão "Gerar criativo" / "Gerar novamente" (desabilitado sem `produto`; ícone `Wand2`/spinner `Loader2`).
    - Painel de preview (`CanvasShell`): estado de loading (`Loading` — spinner + "Gerando seu criativo…"), estado com imagem (`<img>`), estado vazio (`EmptyState` — "Seu criativo aparecerá aqui").
    - Após gerar: botões "Baixar" (download), "Variar" (regenera), "Canva" (abre toast "Edição no Canva — Conecte sua conta Canva nas configurações", não integrado de fato).
  - **Aba Copy** (grid 2 colunas):
    - Badge provider: "GPT-4o".
    - Campo "Produto / oferta *" (Input).
    - "Tipo de copy": chips — Headlines, Texto de anúncio, Roteiro de VSL, E-mail de vendas, Legenda p/ redes, CTA.
    - "Framework de copywriting": chips — Automático, AIDA, PAS, BAB, 4P, FAB.
    - "Público-alvo" (Input) e "Dor principal" (Input), lado a lado.
    - "Benefícios / oferta" (Textarea).
    - "Variações": chips 3, 5, 8, 10 (default 5).
    - Botão "Gerar copy" (desabilitado sem produto).
    - Resultado: lista de cards com cada variação de texto; hover mostra botão de copiar (`Copy`) que copia para clipboard e mostra toast "Copiado!". Skeleton de loading (3 blocos pulsantes) enquanto gera. Estado vazio: "Suas copies aparecerão aqui".
  - **Aba Narração** (TTS, grid 2 colunas):
    - Badge provider: "ElevenLabs".
    - "Texto para narrar *" (Textarea, 5 linhas).
    - "Voz": chips combinando (a) vozes clonadas do usuário (`clonedVoices`, ícone `AudioWaveform`) e (b) vozes padrão `TTS_VOICES` (Nova, Shimmer, Alloy, Echo, Fable, Onyx, Verse, Ballad; ícone `Volume2`). Hint "Inclui suas vozes clonadas" quando existirem.
    - "Modelo (ElevenLabs)": chips — v3 · expressivo (`eleven_v3`), Multilingual v2 (`eleven_multilingual_v2`, default), Flash · rápido (`eleven_flash_v2_5`).
    - "Ajustes de voz": 4 sliders (`Slider` custom, `<input type=range>` com valor numérico exibido): Estabilidade (0–1, padrão 0.5), Similaridade (0–1, padrão 0.75), Estilo (0–1, padrão 0), Velocidade (0.7–1.2, padrão 1).
    - "Tom (emoção)": chips preset (Animado e persuasivo, Calmo e confiável, Urgente, Amigável, Profissional, Storytelling) + Input livre para instruções customizadas.
    - Botão "Gerar narração" (desabilitado sem texto; ícone `Mic`).
    - Painel de resultado: loading ("Gerando narração…"), ou player de áudio (`<audio controls>` dentro de card com ícone `Volume2` grande) + botão "Baixar MP3" (download), ou estado vazio.
  - **Aba Avatar** (foto + roteiro → vídeo lip-sync, grid 2 colunas):
    - Badge provider: "HeyGen / D-ID lip-sync".
    - "Foto da pessoa *": dropzone (`<label>` com borda tracejada) — clique abre `<input type=file accept=image/*>`; mostra preview da foto enviada (máx. 8MB, valida e mostra toast de erro se maior).
    - "O que a pessoa vai falar *" (Textarea 4 linhas).
    - "Voz": chips `TTS_VOICES` (mesma lista de 8 vozes da Narração, sem incluir vozes clonadas nesta aba).
    - "Formato": chips `VIDEO_FORMATS` — Quadrado/Feed (1080x1080), Vertical/Story-Reels (1080x1920), Horizontal/YouTube (1920x1080).
    - Botão "Gerar avatar" (desabilitado sem foto e sem texto).
    - Resultado: loading ("Gerando seu avatar… pode levar alguns segundos"), `<video controls>` + botão "Baixar vídeo", ou estado vazio.
  - **Aba Vídeo** (Seedance 2.0, grid 2 colunas):
    - Badge provider: "Seedance 2.0 (vídeo + áudio nativo)".
    - "Descrição do vídeo / produto *" (Textarea 3 linhas).
    - "Roteiro de narração" (Textarea 4 linhas, opcional — hint "deixe vazio para vídeo sem áudio").
    - "Voz": chips `TTS_VOICES`.
    - "Formato": chips `VIDEO_FORMATS` (mesmos 3 do Avatar).
    - "Resolução": chips 480p/720p/1080p.
    - "Duração": chips Auto, 5s, 8s, 10s, 12s.
    - "Imagem base (opcional)": componente `ImageUpload` em modo `compact` (permite upload de arquivo via `/api/upload/image` com otimização/compressão no servidor, ou colar URL diretamente) — usado para animar image-to-video.
    - Botão "Gerar vídeo" (desabilitado se não houver nem `prompt` nem `imageUrl`).
    - Resultado: loading ("Renderizando seu vídeo…"), `<video controls>` + "Baixar vídeo", ou estado vazio.
  - **Aba Clonar Voz** (ElevenLabs Instant Voice Cloning, grid 2 colunas):
    - Badge provider: "ElevenLabs Instant Voice Cloning" (sem opção grátis, `free="—"`).
    - Texto explicativo: "Envie 1–5 amostras de áudio limpas da voz (total ~1 min). A voz clonada aparece automaticamente na aba Narração."
    - "Nome da voz *" (Input).
    - "Amostras de áudio *" (hint: MP3/WAV/M4A, até 5 arquivos, 12MB cada):
      - Dropzone de upload (`<input type=file accept=audio/* multiple>`), valida tamanho por arquivo (máx. 12MB, toast de erro se exceder) e limita a 5 amostras; cada arquivo é convertido para base64 (FileReader) e guardado em `cloneSamples`.
      - **Botão de gravação de voz na hora**: "Gravar agora pelo microfone" — usa `navigator.mediaDevices.getUserMedia({audio:true})` + `MediaRecorder`. Ao clicar, inicia gravação (botão muda para estado vermelho pulsante "Gravando… clique para parar"); ao parar, converte o blob (`audio/webm`) em base64 e adiciona à lista de amostras como `gravacao-N.webm`; solicita permissão de microfone e mostra toast de erro se negada/indisponível.
      - Lista das amostras já adicionadas: cada uma em uma linha com ícone `Volume2`, nome do arquivo e botão `X` para remover.
    - Botão "Clonar voz" (desabilitado sem nome ou sem amostras).
    - Painel direito "Vozes disponíveis": botão "Atualizar" (refetch); mensagem de sucesso pós-clonagem ("Voz clonada criada! Já dá pra usar na Narração"); lista rolável de vozes (`voiceList`) — cada item mostra ícone `AudioWaveform`, nome, categoria (uppercase), botão de **tocar prévia** (`Volume2`, toca `previewUrl` via `new Audio().play()`, funciona sem depender de chave de API — usa catálogo público do ElevenLabs quando não há vozes vindas do servidor) e botão "Usar" (seleciona a voz para a aba Narração e mostra toast). Estado vazio: "Nenhuma voz disponível — Conecte a chave ElevenLabs para ouvir e usar as vozes (as amostras são grátis)".
  - **Aba Histórico** (gerações persistentes, todas as ações salvas no backend):
    - Campo de busca "Buscar por título ou prompt…" + botão "Atualizar" (refetch, ícone `RefreshCw` com spin durante loading).
    - Filtros por tipo: chips Todos, Imagens, Copy, Áudio, Vídeo.
    - Grid de cards (3 colunas em telas grandes): cada card mostra thumbnail (imagem, vídeo, ícone de áudio, ou trecho de texto para copy), título, data de criação (`toLocaleDateString("pt-BR")`), botão de ação (copiar texto para itens tipo "copy", ou baixar/abrir em nova aba para os demais) e botão "Excluir" (`Trash2`, chama `DELETE /api/ai-studio/history/:id`).
    - Estado vazio: "Nenhuma criação ainda — Suas gerações aparecem aqui automaticamente".
  - **Galeria de criações recentes** (fora das tabs, aparece só se houver itens na sessão atual): carrossel horizontal de miniaturas (até 12, mais recentes primeiro) de imagem/vídeo/áudio geradas na sessão, cada uma linkando para a URL em nova aba, com overlay de hover.
- **Fluxos do usuário**:
  - Gerar criativo: preenche produto/headline/estilo/proporção/qualidade/formato/fundo → clica "Gerar criativo" → vê preview → pode baixar, variar (regenerar) ou (placeholder) editar no Canva.
  - Gerar copy: preenche produto/tipo/framework/público/dor/benefícios/nº variações → clica "Gerar copy" → recebe lista de variações → copia a que quiser.
  - Narrar texto: cola texto, escolhe voz (própria clonada ou catálogo padrão), ajusta modelo/sliders/tom → "Gerar narração" → ouve no player → baixa MP3.
  - Criar avatar: envia foto de rosto, escreve o que a pessoa vai falar, escolhe voz e formato → "Gerar avatar" → recebe vídeo com lip-sync.
  - Gerar vídeo de produto: descreve o vídeo, opcionalmente cola roteiro de narração e/ou envia imagem base → escolhe voz/formato/resolução/duração → "Gerar vídeo".
  - Clonar voz: dá nome, envia amostras de áudio (upload de arquivo(s) e/ou grava direto pelo microfone) → "Clonar voz" → voz aparece na lista da direita e passa a estar disponível na aba Narração.
  - Consultar histórico: filtra por tipo/busca, baixa/copia itens antigos ou exclui.
- **Regras de negócio visíveis no código**:
  - Não há checagem explícita de plano/assinatura (`useFeatureAccess`) dentro deste arquivo — ao contrário de `AITools.tsx`, o Estúdio de IA não bloqueia a página por feature flag no próprio componente.
  - Não há exibição de "custo em créditos" por ação no código desta tela — nenhuma referência a "crédito(s)" foi encontrada.
  - Todas as gerações (imagem, copy, tts, avatar, vídeo) enviam `idioma: lang` (o idioma global selecionado).
  - Modo "premium-only": cada `ProviderBadge` mostra apenas o provider premium (ex.: GPT-Image, GPT-4o, ElevenLabs, HeyGen/D-ID, Seedance 2.0, ElevenLabs Instant Voice Cloning) — não há mais badge de opção "grátis" (o componente `ProviderBadge` recebe uma prop `free` mas não a renderiza, só usa `premium`).
  - Prévia de vozes toca independente de chave de servidor configurada — usa `previewUrl` público do catálogo `ELEVEN_VOICES` (`client/src/lib/elevenVoices.ts`, 15 vozes premade do ElevenLabs) quando a API `/api/ai-studio/voices` não retorna vozes da conta; a geração de narração final, porém, depende da chave `ELEVENLABS_API_KEY` no servidor.
  - Limites client-side: amostras de clonagem de voz — até 5 arquivos, 12MB cada; foto do avatar — até 8MB.
  - Fundo transparente força automaticamente o formato para PNG (JPEG não suporta transparência).
  - Botão de imagem/vídeo/avatar fica desabilitado enquanto a mutation está pendente ou os campos obrigatórios (`*`) não estão preenchidos.
- **Integrações e chamadas de API**:
  - `GET /api/ai-studio/history?type=&q=` — lista histórico (react-query, `staleTime: 0`).
  - `DELETE /api/ai-studio/history/:id` — exclui item do histórico.
  - `POST /api/ai-studio/image` — gera imagem (envia produto, estilo, headline, publico, ratio, quality, format, background, size calculado, idioma).
  - `POST /api/ai-studio/copy` — gera copy (produto, publico, dor, beneficios, oferta, tipo, framework, variacoes, idioma).
  - `POST /api/ai-studio/tts` — gera narração (text, voice, instructions, modelId, stability, similarityBoost, style, speed, idioma).
  - `POST /api/ai-studio/avatar` — gera vídeo avatar (imageUrl, text, voice, size, idioma).
  - `POST /api/ai-studio/video` — gera vídeo de produto (prompt, script, voice, size, resolution, duration, imageUrl, idioma).
  - `GET /api/ai-studio/voices` — lista vozes da conta ElevenLabs (se configurada no servidor).
  - `POST /api/ai-studio/clone-voice` — clona voz (name, samples base64).
  - `POST /api/upload/image` (via componente `ImageUpload`) — upload/otimização de imagem base do vídeo.
  - Serviços externos percebidos pelos textos/badges: ElevenLabs (TTS + clonagem de voz), GPT-Image (imagem), GPT-4o (copy), HeyGen/D-ID (avatar lip-sync), Seedance 2.0 (vídeo).
- **Dados exibidos**: itens de histórico de geração (`id`, `type`, `title`/`text`, `url`, `createdAt`) vindos de `/api/ai-studio/history`; lista de vozes (`voiceId`, `name`, `category`, `previewUrl`) vinda da API ou do catálogo estático local.

### Página: /ai-tools — Ferramentas IA Disponíveis

- **Arquivo fonte**: `client/src/pages/AITools.tsx` (706 linhas). **Rota**: `/ai-tools`.
- **Diferenciação importante**: esta NÃO é uma tela de geração por IA como o AIStudio. É uma **central/catálogo de acesso a ferramentas de terceiros** (SaaS de IA, design, SEO, mineração etc.) usando contas/credenciais compartilhadas via navegadores anti-detecção (AdsPower/Dicloak) — o usuário não gera nada aqui, apenas navega o catálogo e copia logins/senhas para acessar ferramentas externas.
- **Objetivo**: dar ao usuário acesso a mais de 30 ferramentas de IA/produtividade de terceiros por meio de contas compartilhadas (credenciais globais ou por ferramenta), com tutoriais de como usar navegadores anti-detecção para logar sem conflito.
- **Layout geral**: página com `SEO`/schema markup, header com título + botão de tour guiado (`TourButton`); card de instruções com abas (AdsPower / Dicloak) contendo vídeo tutorial + texto passo a passo; card de "Acessos Globais" com grid de credenciais; catálogo de ferramentas agrupado por categoria em grids de cards pequenos; modal de detalhes por ferramenta; overlay de tour guiado.
- **Inventário completo de UI**:
  - **Bloqueio de feature**: se `isFeatureBlocked("ferramentas-ia")` (usuário no plano gratuito), a página inteira é substituída por `<FeatureLockedOverlay featureName="Ferramentas de IA" description="Acesse ferramentas de inteligência artificial premium. Disponível para assinantes e compradores." />` — cartão central com ícone de cadeado, lista de benefícios do plano completo (Clonador de Páginas, Pre-Sells, Meta Ads Andromeda, Quiz Interativo, Automações N8N) e call-to-action.
  - **Header**: título "Ferramentas IA Disponíveis", subtítulo "Acesse mais de 30 ferramentas premium com os logins disponibilizados", botão "Conhecer Ferramentas" (inicia tour guiado `aiToolsTour`) — posicionado acima do título em mobile, ao lado em desktop.
  - **Card "Como Acessar as Ferramentas"**:
    - `Tabs` com 2 abas: **AdsPower** e **Dicloak** (navegadores anti-detecção usados para logar em múltiplas contas sem bloqueio).
    - Cada aba: player de vídeo tutorial (`<video controls>` com poster, sem opção de download — `controlsList="nodownload"`) + bloco de texto com instruções (assistir o vídeo, baixar/instalar o app via link externo com ícone `ExternalLink`, logar com um dos acessos abaixo, trocar de conta se algo não funcionar, contato para suporte).
  - **Card "Acessos Globais via AdsPower"** (ícone `Key`):
    - Grid 2 colunas de cards de credencial (um por `GlobalAIAccess`), cada um com: Badge com ícone `Lock` + `label`; campo "Login" (mono, copiável — botão `Copy`/`Check` ao copiar); campo "Senha" (mono, copiável); botão vermelho "Reportar Problema" (ícone `AlertCircle`) que dispara mutation e mostra toast de confirmação.
    - Estados: "Carregando acessos…" (loading), "Nenhum acesso disponível no momento" (vazio).
  - **Separator** (linha divisória).
  - **Catálogo de Ferramentas por categoria** (18 categorias possíveis: Inteligência Artificial, Design, Ferramentas de Mineração, SEO, Cortesia, Infoprodutos, Brinde, Manutenção, IA Conversacional, Criação de Imagens e Vídeos, Edição, Apresentações, Banco de Imagens, Texto, Vídeo, Áudio, Código, Análise, Outros — só renderiza categorias com pelo menos 1 ferramenta):
    - Cada seção: título da categoria + Badge com contagem (ferramentas ativas + "em breve" da categoria, quando aplicável).
    - Grid de cards pequenos (3 a 6 colunas conforme breakpoint) por ferramenta: logo (via `LazyImage` com proxy `/api/image-proxy?url=`, fallback com inicial do nome se sem logo), nome (remove emojis de bandeira 🇧🇷/🇺🇸 do início), descrição curta (até 2 linhas), botão "Acesso" (abre modal de detalhes) — desabilitado e com selo laranja "EM MANUTENÇÃO" se `tool.isUnderMaintenance`.
    - Cards "Em Breve" (apenas na categoria "ia", hardcoded): "Agente de IA" e "Hack Ads" — visual acinzentado, badge "Em Breve", botão desabilitado "Em Breve".
    - Skeleton de loading: 2 seções fake com 6 cards cinza cada, enquanto `isLoadingTools`/`isLoadingAccess`.
  - **Modal "Detalhes da Ferramenta"** (`Dialog`, abre ao clicar "Acesso"):
    - Header: logo/inicial + nome + descrição.
    - Seção "Instruções de Uso" (texto livre, se existir).
    - Seção "Vídeo Tutorial": se a URL for YouTube/Vimeo reconhecida, embed via `<iframe>`; senão, botão "Assistir Vídeo" que abre em nova aba.
    - Seção "Credenciais de Acesso" (se a ferramenta tiver credenciais próprias, diferentes das globais): lista de cards com Login/Senha copiáveis (mesmo padrão dos acessos globais).
    - Botão final "Acessar {nome}" (abre `tool.toolUrl` em nova aba; desabilitado se em manutenção).
  - **Tour guiado** (`TourOverlay` + `TourButton`): overlay com passos (`aiToolsTour`), destaca elementos como o primeiro card de ferramenta (`.ai-tool-card-first`) e o botão de reportar problema (`.tour-report-button`).
- **Fluxos do usuário**:
  - Primeiro acesso: assiste tutorial (AdsPower ou Dicloak) → instala o app → copia login/senha de um "Acesso Global" → loga no navegador anti-detecção.
  - Usar uma ferramenta específica: navega pelo catálogo por categoria → clica "Acesso" num card → modal mostra instruções/vídeo/credenciais específicas (se houver) → clica "Acessar {nome}" → abre a ferramenta externa em nova aba já logado via AdsPower/Dicloak.
  - Login não funciona: clica "Reportar Problema" no card do acesso global → equipe é notificada.
- **Regras de negócio visíveis no código**:
  - Gate de plano: feature `"ferramentas-ia"` — bloqueada para plano `free`, liberada para `basic` e `full` (ver `useFeatureAccess`/`FREE_PLAN_ALLOWED_FEATURES` vs `BASIC_PLAN_ALLOWED_FEATURES`).
  - Ferramentas em manutenção (`isUnderMaintenance`) ficam com botão de acesso desabilitado e selo visual.
  - Categorias sem nenhuma ferramenta cadastrada não são exibidas.
  - "Em Breve" é uma lista hardcoded no frontend (não vem do banco).
- **Integrações e chamadas de API**:
  - `GET /api/ai-tools` — lista de ferramentas (`AITool[]`, staleTime 5min).
  - `GET /api/global-ai-access` — lista de credenciais globais (`GlobalAIAccess[]`, staleTime 2min).
  - `POST /api/support/login-issue` — reporta problema de login (mensagem automática citando o label do acesso).
  - `GET /api/image-proxy?url=` — proxy usado para carregar logos das ferramentas.
  - Serviços/apps externos citados: AdsPower, Dicloak (navegadores anti-detecção), YouTube/Vimeo (embeds de tutorial), e as próprias ferramentas de terceiros linkadas em `toolUrl` (não há chamada de API de IA generativa nesta página).
- **Dados exibidos**: da entidade `AITool` (schema `shared/schema.ts`): `id`, `name`, `description`, `toolUrl`, `iconType`, `category`, `logoUrl`, `videoUrl`, `instructions`, `accessCredentials` (array de `{label, login, password}`), `isActive`, `isUnderMaintenance`. Da entidade `GlobalAIAccess`: `id`, `label`, `login`, `password`, `order`, `isActive`.

### Página: /ebooks — Criador de Ebooks IA

- **Arquivo fonte**: `client/src/pages/EbookStudio.tsx` (553 linhas). **Rota**: `/ebooks`.
- **Objetivo**: o usuário descreve o tema de um ebook e a IA escreve, ilustra e diagrama automaticamente um ebook completo (capa, sumário, capítulos), que pode ser editado inline, ter imagens regeneradas e ser exportado em PDF, HTML ou EPUB.
- **Layout geral**: dois modos de visualização (`view` = "list" | "create"):
  - **Lista** ("Meus Ebooks"): hero + grid de cards dos ebooks já salvos.
  - **Criar/Editar**: layout de 2 colunas — wizard fixo à esquerda (`lg:sticky`) com os parâmetros de geração, e à direita um preview/editor em grid de páginas estilo "folha A4" com toolbar fixa.
- **Inventário completo de UI**:
  - **Hero**: ícone `BookOpen`, título "Criador de Ebooks IA", subtítulo; botão alternante — "Criar ebook" (`Plus`, na lista) ou "Meus Ebooks" (`ArrowLeft`, no modo criar).
  - **Modo Lista**:
    - Loading: spinner central.
    - Vazio: "Você ainda não criou nenhum ebook" + botão "Criar meu primeiro ebook".
    - Grid de cards (3 colunas): ícone `BookOpen`, badge com contagem de páginas, título, subtítulo (2 linhas), botões "Abrir" e excluir (`Trash2`, com `confirm()` nativo do navegador).
  - **Modo Criar — Wizard** (coluna esquerda, formulário):
    - "Assunto do ebook *" (input texto).
    - "Público-alvo" (input texto).
    - "Autor" (input texto).
    - "Nº de páginas" — slider 6 a 50, mostra valor atual ao lado do label.
    - "Tom": chips — Didático, Inspirador, Técnico, Conversacional, Persuasivo.
    - "Tema visual": chips — Editorial, Moderno, Corporativo, Minimal (cada um com paleta de cor/fonte própria: `THEMES` — accent, accentSoft, gradiente de capa, fonte).
    - Checkbox "Gerar imagens com IA" (liga/desliga geração de imagens durante a criação).
    - Botão "Gerar ebook" / "Gerar novamente" (spinner enquanto `generating`).
    - Botão "Salvar ebook" (aparece só depois de gerado; spinner enquanto `saving`).
    - Texto de rodapé explicativo: "PDF usa o diálogo de impressão do navegador (salve como PDF). EPUB e HTML baixam direto. Geração de texto usa sua chave GPT/Gemini; imagens funcionam no gerador grátis."
  - **Modo Criar — Preview/Editor** (coluna direita):
    - Estado "gerando": borda tracejada, spinner, "Escrevendo e diagramando seu ebook…".
    - Estado vazio (antes de gerar): "Seu ebook aparecerá aqui".
    - Estado com ebook gerado:
      - **Toolbar sticky**: título do ebook + contagem de páginas + status "salvo"/"não salvo"; botões — "Editando"/"Editar" (toggle modo de edição inline, ícone `Check`/`Wand2`), "Gerar imagens" (gera em lote todas as imagens pendentes, spinner `genImages`), separador visual, "PDF" (botão primário, ícone `FileDown`), botão ícone "Baixar HTML" (`FileCode`), botão ícone "Baixar EPUB" (`FileText`).
      - **Barra de tema** (só em modo edição): chips de tema (Editorial/Moderno/Corporativo/Minimal) para trocar o tema visual do ebook já gerado + botão "Adicionar página" (`Plus`, insere página nova antes da última).
      - **Grid de páginas** (2 colunas, proporção A4 `aspect-[1/1.414]`, cada página um cartão com sombra):
        - **Página capa**: gradiente de fundo do tema, tag "Ebook", título (`h1`), subtítulo, nome do autor.
        - **Página sumário (toc)**: título + lista de itens com borda tracejada inferior; em modo edição mostra controles de mover/excluir (exceto capa, que é fixa).
        - **Páginas de conteúdo/capítulo**: rótulo "Capítulo N" (se aplicável) + blocos de conteúdo renderizados por `BlockView`, tipos de bloco suportados:
          - `heading` (h3 editável inline via `contentEditable`),
          - `subheading` (h4 editável),
          - `paragraph` (texto editável),
          - `list` (bullets com marcador colorido pelo tema),
          - `callout` (caixa destacada com borda colorida + label opcional + ícone `Lightbulb`, editável),
          - `quote` (citação com aspas + atribuição opcional),
          - `stats` (grid de estatísticas: valor grande + label),
          - `image` (se `imageUrl` presente, mostra imagem + botão "Regerar" no hover; se ausente, mostra placeholder com o `imagePrompt` e botão "Gerar"),
          - `divider` (linha horizontal).
        - Cada página de conteúdo em modo edição ganha controles flutuantes no hover: subir (`ArrowUp`), descer (`ArrowDown`), excluir (`Trash2`) — desabilitados/ocultos para a capa.
        - Numeração de página no rodapé de cada card ("— N —").
- **Fluxos do usuário**:
  - Criar ebook: clica "Criar ebook" → preenche assunto/público/autor/páginas/tom/tema/checkbox de imagens → "Gerar ebook" → aguarda geração → revisa preview em grid → opcionalmente ativa "Editar" para alterar textos inline, reordenar/excluir páginas, adicionar página nova ou trocar tema → clica "Gerar imagens" para preencher blocos de imagem pendentes (ou regenera individualmente) → "Salvar ebook" (grava no backend e recebe slug) → exporta em PDF (abre nova aba com HTML de impressão e chama `window.print()`), HTML (download direto) ou EPUB (gera .epub via `jszip` no client e baixa).
  - Reabrir ebook salvo: na lista, clica "Abrir" → carrega dados salvos, entra no editor com dados preenchidos.
  - Excluir ebook: clica ícone de lixeira no card da lista → confirmação nativa → exclui e recarrega lista.
- **Regras de negócio visíveis no código**:
  - Nenhuma checagem de plano/feature (`useFeatureAccess`) é feita diretamente neste arquivo.
  - A página de capa e a lógica de reordenação/exclusão sempre preservam a capa como primeira página fixa (não pode ser movida/excluída).
  - Geração de imagens em lote (`genAllImages`) processa no máximo 12 imagens pendentes por vez.
  - Exportação PDF depende de pop-ups permitidos no navegador (mostra toast se bloqueado) e usa o diálogo de impressão nativo — não é geração de PDF real no servidor.
  - Exportação EPUB é montada inteiramente no cliente (biblioteca `jszip`, import dinâmico) com estrutura OPF/NCX válida.
  - Texto explícito no rodapé indica que a geração de texto "usa sua chave GPT/Gemini" (premium/BYOK) e "imagens funcionam no gerador grátis" — únicas menções de camada grátis/paga nesta tela.
- **Integrações e chamadas de API**:
  - `GET /api/ebook/list` — lista ebooks salvos do usuário.
  - `POST /api/ebook/generate` — gera o ebook (assunto, publico, autor, paginas, tom, tema, comImagens).
  - `POST /api/ebook/save` — salva/atualiza ebook (ebook completo + slug opcional).
  - `GET /api/ebook/get/:slug` — carrega ebook salvo específico.
  - `DELETE /api/ebook/:slug` — exclui ebook.
  - `POST /api/ebook/gen-image` — gera uma imagem individual (prompt, theme, cover).
  - Bibliotecas client-side: `jszip` (montagem do arquivo .epub no navegador).
  - Serviços externos percebidos: GPT/Gemini (texto), gerador de imagem "grátis" (não nomeado explicitamente no código desta página, ao contrário do AIStudio que cita GPT-Image).
- **Dados exibidos**: estrutura `Ebook` (`title`, `subtitle`, `author`, `theme`, `withImages`, `pageCount`, `pages[]`), onde cada `Page` tem `type` (cover/toc/chapter/content), `title`, `subtitle`, `chapter`, `blocks[]`; cada `Block` tem `type`, `content`, `items[]`, `imagePrompt`, `imageUrl`, `label`, `stats[]`. Na lista, cada item mostra `slug`, `title`, `subtitle`, `pageCount`.

---

## Quiz Builder e Funil Interativo

### Página: `/quiz-builder` — Quiz Builder

- **Arquivo fonte**: `client/src/pages/QuizBuilder.tsx` (1321 linhas), rota `/quiz-builder` (registrada em `client/src/App.tsx`, linha 250). Usa componentes auxiliares de `client/src/components/quiz/ComponentView.tsx` (renderizador de blocos) e `client/src/components/quiz/ImageUpload.tsx`, além de `client/src/lib/quizSchema.ts` (tipos, catálogo de componentes/paleta, helpers de score/variáveis/visibilidade) e `client/src/lib/quizTemplates.ts` (modelos prontos).
- **Objetivo**: criar, editar e publicar funis de quiz interativos (estilo Typeform/Inlead/Movify) com drag-and-drop de blocos, lógica condicional entre etapas, captura de leads e acompanhamento de resultados/analytics.
- **Layout geral**: dois modos principais.
  1. **Lista de funis** (tela inicial): header com título "Quiz Builder", toggle de visualização Cards/Lista, botão "Criar Funil"; corpo em grid de cards ou tabela.
  2. **Editor** (tela cheia, `fixed inset-0`): header fixo (voltar, nome do funil editável, undo/redo, botão de variáveis `f(x)`, tabs de navegação "Construtor / Fluxo / Design / Leads / Configurações", toggle Publicado, seletor de dispositivo mobile/desktop, compartilhar, preview, salvar). Corpo muda conforme a tab: Construtor = 3 colunas (rail de etapas + paleta de componentes + canvas central em mockup de iPhone/navegador + painel de propriedades à direita); Design = mesmo layout mas painel direito mostra tema global; Fluxo = visão vertical das etapas com ramificações; Leads = dashboard com sub-tabs; Configurações = sidebar de seções (Geral/Pixel/SEO/Webhooks).

- **Inventário completo de UI**:

  **Tela de lista de funis**
  - Header: ícone de app, título "Quiz Builder", subtítulo "Crie funis de quiz interativos — arraste, solte e publique."
  - Toggle de visualização (ícones `LayoutGrid`/`List`), visível só se houver funis.
  - Botão "Criar Funil" (`Plus`) — abre `CreateFunnelModal`.
  - Estado de carregamento: spinner central (`Loader2`).
  - Estado vazio: borda tracejada, ícone `LayoutTemplate`, texto "Crie seu primeiro funil", botão "Criar Funil".
  - **Modo Grid**: cards com ícone `ListChecks`, badge "Publicado"/"Rascunho", nome do funil, estatísticas (`Eye` views, `Users` leads), botões "Editar", abrir link público (`ExternalLink`, nova aba `/q/:slug`), excluir (`Trash2`, com `confirm()`).
  - **Modo Lista**: tabela com colunas Funil / Status / Views / Leads / Ações, mesmas ações do card.
  - **Modal "Criar funil" (`CreateFunnelModal`)**: campo texto "Título do seu funil"; grade de modelos (do `TEMPLATES`: Em branco, Quiz de recomendação, Captura de leads, Diagnóstico (score), VSL + Oferta) cada card com ícone/nome/descrição selecionável; bloco "Gerar com IA" com textarea (limite 280 caracteres, contador), botão "Gerar funil" (chama `/api/quiz/generate`, com fallback para o template "reco" caso a IA falhe); botões "Cancelar" e "Criar funil".

  **Editor — Header**
  - Botão voltar (`ArrowLeft`).
  - Input inline do nome do funil.
  - Botões Desfazer/Refazer (`Undo2`/`Redo2`, histórico local com até 50 estados).
  - Botão "f(x)" — abre `VarsModal` (lista variáveis `{{...}}` disponíveis: `score` + `name` de cada componente `opcoes`/`video_resposta` + campos de `captura`; clique copia para clipboard).
  - Tabs: Construtor (`LayoutGrid`), Fluxo (`GitBranch`), Design (`Palette`), Leads (`Users`), Configurações (`Settings`).
  - Checkbox "Publicado".
  - Toggle dispositivo Celular/Computador (`Smartphone`/`Monitor`).
  - Botão "Compartilhar" (`Share2`) — exige funil salvo, abre `ShareModal`.
  - Botão "Preview" (`Eye`) — alterna modo interativo dentro do editor.
  - Botão "Salvar" (`Save`, com spinner ao salvar) — POST `/api/quiz/save`.

  **Modal Compartilhar (`ShareModal`)**
  - Aviso se não publicado.
  - Campo URL somente-leitura + botão copiar.
  - Grade de botões de redes sociais: Facebook, Twitter/X, LinkedIn, WhatsApp, Telegram, E-mail (links de compartilhamento externos).

  **Modal Variáveis (`VarsModal`)**
  - Lista de chips `{{variável}}` clicáveis (copiam para a área de transferência).

  **Rail de etapas (`StepsRail`, coluna esquerda no Construtor/Design)**
  - Campo de busca de etapas.
  - Lista de etapas arrastável (drag nativo HTML5) para reordenar, clique para selecionar, botão remover etapa (`X`, oculto se só há 1 etapa).
  - Botão "Nova etapa" (`Plus`).

  **Paleta de componentes** (só na tab Construtor) — painel de 240px com componentes agrupados por categoria (`CATEGORIES` derivado de `PALETTE`): **Quiz** (Escolha Única, Múltipla Escolha, Sim/Não, Escolha de Imagem, Opções, Vídeo Resposta — badge "novo"), **Formulário** (Captura, Botão, Altura, Peso — "novo"), **Mídia e conteúdo** (Texto, Imagem, Vídeo, Áudio, Galeria), **Argumentação** (Benefícios, Argumentos, Depoimentos, Garantia, FAQ, Preço, Antes/Depois, Carrossel), **Atenção** (Alerta, Notificação — "novo", Timer, Loading, Nível), **Gráficos** (Gráficos, Barras, Cartesiano, Resultado), **Personalização** (Espaço, Script). Cada item é arrastável (dnd-kit `useDraggable`) e também clicável para adicionar direto no fim do canvas.

  **Canvas central** (dentro de um mockup `Frame`: `Phone` estilo iPhone 16 Pro com Dynamic Island/status bar, ou `DesktopFrame` estilo janela de navegador)
  - `QuizChrome`: logo, barra de progresso, botão voltar (conforme config de cabeçalho da etapa/tema).
  - Estado vazio: área tracejada "Arraste componentes aqui ou clique em um item da paleta" (destaca ao arrastar por cima — `useDroppable`).
  - Lista de componentes ordenável (`SortableContext`/`useSortable`) — cada item (`CanvasItem`) mostra a renderização real via `ComponentView`, com botões flutuantes ao passar o mouse: duplicar (`Copy`), remover (`Trash2`), arrastar (`GripVertical`); clique seleciona (abre painel de propriedades).
  - Modo Preview: renderiza a etapa interativamente dentro do mockup (`RuntimePreview`), sem persistir estado.

  **Painel de propriedades (`PropsPanel`, 320px direita)** — aparece ao selecionar um componente; abas internas **Componente / Estilo / Exibição**:
  - **Componente** (campos variam por tipo, listados por tipo de bloco):
    - `texto`: editor rich-text (`RichTextEditor` com toolbar: estilo H1/H2/parágrafo, negrito, itálico, sublinhado, cor de texto, realce, alinhar esquerda/centro/direita, lista, link), alinhamento geral.
    - `imagem`: upload de imagem, arredondamento (px), largura (%).
    - `video`/`audio`: campo URL.
    - `galeria`: layout (Grade/Lista), lista editável de imagens.
    - `opcoes`: ID/Name (variável), Pergunta, Ajuda, Layout (Itens em lista/Grade/Espalhados), Direção (vertical/horizontal), Disposição (Texto/Imagem+texto/Apenas imagem/Emoji+texto), lista de opções (rótulo, emoji, pontuação, valor A/B, imagem, etapa destino), checkboxes "Seleção obrigatória", "Permitir múltipla escolha", "Redirecionar apenas ao clicar no botão".
    - `video_resposta`: ID/Name, Pergunta, Ajuda, Duração máxima (s), Texto do botão.
    - `captura`: Título, Descrição, Texto do botão, "Ao enviar, ir para" (etapa), lista de campos (tipo Nome/E-mail/Telefone/Número/Data/Texto longo/Texto, variável, rótulo, obrigatório).
    - `botao`: Texto do botão, Tipo de navegação (Próxima etapa/Etapa específica/URL), destino condicional, "Abrir em nova aba", Estilo (Sólido/Contorno), "Fixar no rodapé", "Com animação".
    - `nivel`: Rótulo, "Usar score do quiz", Porcentagem manual.
    - `loading`: Título, Subtítulo, Duração (s), "Mostrar barra de progresso", "Ir para" (etapa) ou "Redirecionar p/ URL".
    - `timer`: Minutos, Texto, Texto ao expirar.
    - `alerta`: Texto, Tipo (Info/Aviso/Sucesso/Perigo).
    - `notificacao`: Avatar, Título, Texto.
    - `depoimentos`: Layout (Lista/Grade), lista de itens (avatar, nome, localização, texto, estrelas).
    - `argumentos`: lista de até 4 itens (imagem, título, texto).
    - `preco`: Preço, Parcelas, Texto do botão, URL de checkout.
    - `espaco`: Altura (px).
    - `faq`: Modo de abertura (Único/Múltiplos), lista de perguntas/respostas.
    - `carrossel`: Disposição, Autoplay, Paginação, lista de itens (imagem, título, descrição).
    - `antes_depois`: imagens Antes/Depois, rótulos.
    - `graficos`: Layout (Itens em lista/Grade 2 col/Barras verticais), lista de itens (tipo circular/barra, cor tema/verde/vermelho, valor %, rótulo, legenda secundária).
    - `garantia`: Título, Texto.
    - `beneficios`: Título, lista de textos de benefício.
    - `resultado`: Título, Resultado, Rótulo do marcador, "Posição pela pontuação (score)" ou percentual manual, lista de níveis (rótulos da régua).
    - `script`: campo de código HTML/JS embutido.
    - `regua` (altura/peso): Pergunta/rótulo, Unidade (cm/kg/anos/sem unidade), Mín/Máx/Inicial, "Campo obrigatório".
    - `cartesiano`: Título, checkboxes Área/Eixo X/Eixo Y, lista de pontos (rótulo, valor, marcar como "Você").
    - Seção avançada (collapsible "+ Avançado"): campo ID/Name genérico (CSS/pixel/variáveis).
  - **Estilo**: margem superior/inferior (px); para `texto`: cor e alinhamento; para `opcoes`: avançar automático sim/não.
  - **Exibição** (`VisibilityEditor`): "Exibição condicional" — modo Sempre visível / Por pontuação (operadores `>`, `<`, `>=`, `<=`, `==` + valor) / Após X segundos.

  **Painel de etapa/tema (`StepPanel`)** — mostrado quando nada está selecionado (tab Construtor) ou fixo na tab Design/Configurações:
  - Modo etapa: nome da etapa, mover ← →, excluir etapa, checkboxes de cabeçalho (Mostrar logo, Mostrar progresso, Permitir voltar).
  - Modo Design (aplica-se a todo o funil): upload de Logo, cores (Primária, Fundo, Texto, Títulos, Texto do botão — cada uma com color-picker + campo hex), Fonte (select: Padrão/Inter/Poppins/Montserrat/Roboto/Georgia), "Mostrar barra de progresso" padrão.
  - Modo Configurações (dentro do editor de etapa): Redirect final (URL), Meta Pixel ID, Webhook (lead), URL pública com botão copiar.

  **Tab Fluxo (`FlowOverview`)**
  - Lista vertical de cards de etapas (número, nome, contagem de componentes, tags dos tipos de bloco usados, ramificações detectadas — ex.: "Opção X → Etapa Y", "Botão → Etapa Z"); seta `ChevronDown` conectando etapas em sequência; clique no card volta para o Construtor naquela etapa.

  **Tab Configurações (`ConfigPanel`)** — sidebar com 4 seções:
  - **Geral**: Título do funil, Redirect final (URL), URL pública (copiar), bloco "Domínio próprio" (`DomainConnect`): campo de domínio, botão "Conectar" (POST `/api/quiz/:slug/connect-domain`, valida regex de domínio), botão "Desconectar domínio", exibição de registros DNS retornados (tipo, host, valor, botão copiar) e aviso de propagação/SSL.
  - **Pixel & Scripts**: Meta (Facebook) Pixel ID, Google Analytics ID, Scripts personalizados (`<head>`), nota que o Pixel dispara PageView/Lead automaticamente.
  - **SEO & Favicon**: Título SEO, Descrição SEO, upload de Favicon, upload de Imagem de compartilhamento (Open Graph).
  - **Webhooks**: campo Webhook de lead (POST), nota do payload enviado (nome, e-mail, respostas, score).

  **Tab Leads (`LeadsDashboard`)** — sub-tabs **Performance / Resultados / Respostas**:
  - Performance: 5 cards de métricas — Visitantes (`Eye`), Leads adquiridos (`UserPlus`), Taxa de interação (`TrendingUp`, starts/views), Leads qualificados (`Star`, score > 0), Fluxos completos (`CheckCircle2`).
  - Resultados: para cada pergunta (variável), distribuição percentual das respostas em barras de progresso.
  - Respostas: tabela de leads (colunas Data, Nome, Contato, Score, Respostas resumidas) + botão "Exportar CSV"; estado vazio "Nenhum lead ainda".
  - Estado sem funil salvo: "Salve o funil para ver os leads."; estado de carregamento: spinner.

- **Fluxos do usuário**:
  - **Criar funil**: clica "Criar Funil" → escolhe nome + modelo pronto (ou descreve tema para IA gerar via `/api/quiz/generate`) → clica "Criar funil" → abre o Editor com o spec inicial.
  - **Montar etapa**: seleciona etapa no rail (ou cria nova) → arrasta ou clica em item da paleta → componente aparece no canvas → clica no componente → ajusta em Componente/Estilo/Exibição no painel direito.
  - **Configurar lógica condicional**: em blocos de `opcoes`, `captura`, `loading` ou `botao`, define o campo "próxima etapa" ou depende do score para redirecionar; visualiza tudo agregado na tab Fluxo.
  - **Personalizar aparência**: tab Design → ajusta logo, cores, fonte, cabeçalho padrão (aplica-se globalmente).
  - **Publicar**: marca checkbox "Publicado" → clica "Salvar" (POST `/api/quiz/save`) → recebe slug → compartilha link via `ShareModal` ou copia URL.
  - **Conectar domínio próprio**: tab Configurações → Geral → insere domínio → "Conectar" → configura DNS conforme instruções exibidas.
  - **Acompanhar performance**: tab Leads → alterna sub-tabs para ver métricas, distribuição de respostas ou tabela de leads capturados; exporta CSV.
  - **Editar/excluir/pré-visualizar funil existente**: na lista, "Editar" reabre no Editor, ícone de link externo abre `/q/:slug`, "Excluir" confirma e chama `DELETE /api/quiz/:slug`.

- **Regras de negócio visíveis no código**:
  - Não é possível excluir a última etapa restante (`spec.steps.length <= 1`).
  - Ao excluir uma etapa, todas as referências a ela (`nextStepId`/`stepId` em opções, captura, botão) são limpas automaticamente.
  - `dedupeNames` garante nomes de variável únicos entre componentes `opcoes`/`video_resposta` antes de salvar (evita sobrescrita de respostas).
  - Salvar exige nome do funil preenchido.
  - Compartilhar exige funil já salvo (slug existente).
  - Regra de avanço: escolha múltipla nunca avança sozinha — precisa de um botão; escolha única avança automaticamente a menos que "Redirecionar apenas ao clicar no botão" esteja marcado.
  - Validação de domínio customizado via regex antes de enviar ao backend.
  - Sem verificação explícita de plano/assinatura dentro deste arquivo (diferente de `QuizInterativo.tsx`).

- **Integrações e chamadas de API**:
  - `GET /api/quiz/list` — lista de funis.
  - `GET /api/quiz/get/:slug` — carrega spec de um funil (usado ao abrir para editar e também dentro do Leads Dashboard para pegar `meta`).
  - `DELETE /api/quiz/:slug` — exclui funil.
  - `POST /api/quiz/generate` — geração de funil via IA a partir de prompt de texto.
  - `POST /api/quiz/save` — salva/publica o funil.
  - `GET /api/quiz/:slug/leads` — lista de leads capturados.
  - `POST /api/quiz/:slug/connect-domain` — conecta domínio próprio (retorna registros DNS e flag `railway`).
  - `POST /api/quiz/:slug/disconnect-domain` — desconecta domínio.
  - Google Fonts carregada dinamicamente (`ensureGoogleFont`) conforme fonte escolhida no tema.
  - Compartilhamento social usa links externos (Facebook, Twitter/X, LinkedIn, WhatsApp, Telegram, mailto).

- **Dados exibidos**: `QuizSpec` (nome, slug, steps, theme, pixelId, webhookUrl, redirectUrl, isPublished, customDomain, gaId, headScript, seoTitle, seoDescription, faviconUrl, shareImage), `QuizStep` (id, nome, header, components), `QComponent` (id, type, props, visibility), metadados de funil (`meta.views`, `meta.leads`, `meta.starts`, `meta.completions`) e registros de lead (`at`, `nome/name`, `email/phone/telefone/whatsapp/celular`, `score`, `respostas`).

---

### Componente central: `ComponentView.tsx` (renderizador de blocos)

- **Arquivo**: `client/src/components/quiz/ComponentView.tsx`. Não é uma página, mas é o motor visual compartilhado entre o Canvas do builder e o `QuizPlay` público — renderiza cada `QComponent` conforme seu `type`, usando estilos inline (independentes do Tailwind) para ficar idêntico nos dois contextos.
- Tipos suportados (25): `texto`, `imagem`, `video` (detecta YouTube/mp4/iframe embed), `audio`, `galeria`, `opcoes` (com seleção visual, disposição em texto/imagem/emoji, indicador de múltipla escolha), `video_resposta` (captura de arquivo de vídeo via `<input type=file capture>`), `captura` (formulário com validação de obrigatórios), `botao` (fixo no rodapé opcional, animação de pulso opcional), `nivel` (barra de progresso simples), `loading` (barra de progresso animada com contagem de tempo e avanço automático ao concluir), `timer` (contagem regressiva mm:ss), `alerta` (4 variantes de cor), `notificacao`, `depoimentos` (com estrelas), `argumentos`, `preco` (com CTA redirecionando para URL), `espaco`, `faq` (accordion único/múltiplo), `carrossel` (com autoplay e paginação), `antes_depois`, `graficos` (circular, barra, ou barras verticais tipo evolução), `script` (injeta HTML/JS bruto, reexecuta `<script>`), `regua` (slider estilo "altura/peso" com alternância de unidade cm/pol, kg/lb), `garantia`, `beneficios`, `resultado` (barra de "régua" com marcador de posição pelo score), `cartesiano` (gráfico de linha SVG customizado). Todos os textos passam por `resolveVars` (substitui `{{variável}}`).

---

### Página: `/quiz-interativo` — Funil Interativo (XQuiz)

- **Arquivo fonte**: `client/src/pages/QuizInterativo.tsx` (292 linhas), rota `/quiz-interativo` (`App.tsx`, linha 254).
- **Objetivo**: não é um construtor próprio — é uma tela de **acesso a uma ferramenta terceira white-label ("XQuiz")**: mostra credenciais de login (fornecidas por conta compartilhada com pasta exclusiva do usuário) e um botão para acessar a plataforma externa, além de um vídeo tutorial.
- **Layout geral**: página com scroll vertical (`h-full overflow-y-auto`), largura máx. `max-w-7xl`; header com título e botão de tour; grid de 2 colunas (cards de recursos à esquerda, card de acesso à direita); seção de vídeo abaixo; overlay de tour guiado.
- **Inventário completo de UI**:
  - **Overlay de bloqueio (`FeatureLockedOverlay`)**: exibido inteiro no lugar da página se `isFeatureBlocked("quiz")` for verdadeiro, com nome da feature "Quiz Interativo" e descrição "Crie funis interativos para capturar leads. Disponível apenas para assinantes."
  - **Estado de carregamento**: skeletons (título, subtítulo, dois blocos grandes).
  - **Estado sem dados**: mensagem "Configurações não disponíveis no momento."
  - **Header**: `TourButton` "Como Usar" (mobile e desktop), título "Funil Interativo", subtítulo com destaque em verde "custo por lead cair drasticamente".
  - **Coluna de recursos** (3 cards, ícone + título + descrição): "Simples, prático e intuitivo" (`MousePointerClick`) — "Construa o seu funil com um Flow 100% arrasta e solta"; "Rápido e Flexível" (`Zap`); "Tudo em um só lugar" (`Users`) — "não precisa mais de hospedagem ou qualquer outro serviço".
  - **Card "Acesso à Plataforma"** (ícone `ExternalLink`):
    - Campo E-mail (somente leitura, fonte mono) + botão copiar (`Copy`/`Check` ao copiar).
    - Campo Senha (somente leitura, fonte mono) + botão copiar.
    - Botão "Acessar Plataforma" (`ExternalLink`) — abre `settings.platformUrl` em nova aba.
    - Caixa de observação azul (ícone `Info`): explica que o acesso é rateado (pasta compartilhada de ferramenta) mas de uso ilimitado e exclusivo por usuário.
  - **Seção "Veja como funciona"** (ícone `Video`): player de vídeo local (`/xquiz-demo.mp4`, controles, sem download); botão "Ver um Exemplo" (`ExternalLink`) que abre `https://conhecer.xpages.co/` em nova aba.
  - **Tour guiado** (`TourOverlay`): passos definidos em `quizInterativoTour` (config em `@/config/tours`), navegação Próximo/Anterior/Pular, destaca elementos via `data-tour-*`.
- **Fluxos do usuário**:
  - Usuário bloqueado por plano vê apenas o overlay de bloqueio.
  - Usuário com acesso: copia e-mail/senha da conta compartilhada → clica "Acessar Plataforma" → é redirecionado para a ferramenta externa em nova aba, fora do domínio Lowfy.
  - Pode assistir ao vídeo demonstrativo ou abrir um exemplo externo.
  - Pode iniciar o tour guiado clicando em "Como Usar".
- **Regras de negócio visíveis no código**:
  - Gate de feature via `useFeatureAccess().isFeatureBlocked("quiz")` — acesso restrito a assinantes.
  - Cache de query agressivo (staleTime 10 min, gcTime 30 min, sem refetch ao focar janela) — dados tratados como raramente mutáveis.
  - Texto explicita que a conta é compartilhada ("rateio da ferramenta") mas com pasta exclusiva e uso ilimitado por usuário.
- **Integrações e chamadas de API**:
  - `GET /api/quiz-interativo/settings` — retorna `QuizInterativoSettings` (login, password, platformUrl) da ferramenta terceira.
  - Nenhuma chamada de IA/TTS/pagamento nesta tela; é puramente uma tela de credenciais + redirecionamento externo.
- **Dados exibidos**: `settings.login`, `settings.password`, `settings.platformUrl` (schema `QuizInterativoSettings` de `@shared/schema`).

---

### Página: `/q/:slug` (e host próprio "/") — Player Público do Quiz

- **Arquivo fonte**: `client/src/pages/QuizPlay.tsx` (209 linhas). Rota `/q/:slug` (`App.tsx` linha 187) renderiza `QuizPlay`; a rota raiz `/` em domínios customizados do cliente renderiza `HostQuizPlay` (linha 375), que resolve o slug pelo hostname e delega para `QuizPlay` via prop `slugOverride`.
- **Objetivo**: experiência do respondente final — visualizar e responder o funil publicado, etapa por etapa, acumulando score, preenchendo captura de lead e sendo redirecionado ao final.
- **Layout geral**: página única full-height, sem sidebar; coluna central (máx. 520px) com cabeçalho (voltar + logo), barra de progresso, lista vertical dos componentes visíveis da etapa atual (via `ComponentView`), rodapé fixo "Feito com Lowfy".
- **Inventário completo de UI**:
  - **Estado de erro**: "Quiz não encontrado." (funil inexistente/GET falhou).
  - **Estado de carregamento**: "Carregando…" (enquanto `spec` ou `step` não estão prontos).
  - **Cabeçalho**: botão "Voltar" (‹, aparece apenas se `allowBack` e há histórico de navegação), logo do tema (se configurado), barra de progresso (baseada em `(idx+1)/total etapas`, cor primária do tema).
  - **Corpo**: renderização sequencial de todos os componentes visíveis da etapa (`isVisible` filtra por condição de score/tempo), cada um via `ComponentView` com espaçamento configurável (`_mt`/`_mb`).
  - **Estado "Etapa vazia."** quando nenhum componente é visível na etapa atual.
  - **Rodapé**: "Feito com Lowfy".
  - Todos os tipos de bloco interativo descritos acima (opções clicáveis, formulário de captura, régua deslizante, upload/gravação de vídeo-resposta, FAQ expansível, carrossel navegável, timer regressivo, loading com avanço automático, etc.) funcionam de fato aqui (diferente do preview do builder, que é somente leitura).
- **Fluxos do usuário (do início ao fim)**:
  1. Ao carregar, faz `GET /api/q/:slug` para buscar o `QuizSpec`; aplica metadados de SEO/favicon/GA/scripts customizados (`applyMeta`) e injeta o Pixel do Meta se configurado (`injectPixel`); dispara `POST /api/q/:slug/start` (registra visita/start).
  2. Exibe a primeira etapa; um cronômetro por etapa (`elapsed`, resetado a cada troca de etapa) alimenta blocos de exibição condicional por tempo.
  3. Usuário interage com blocos:
     - **Opções (`opcoes`)**: clique registra a seleção (`onPick`) acumulando pontuação por opção (`score`) e gravando a resposta em `answers` (rótulo único ou lista, se múltipla escolha); se for escolha única sem "avançar só no botão", avança automaticamente após 220ms para a etapa definida na opção (`nextStepId`) ou a próxima etapa sequencial.
     - **Captura (`captura`)**: ao enviar, valida campos obrigatórios, grava valores em `vars`, envia o lead (`sendLead` → `POST /api/q/:slug/lead` com nome/e-mail/telefone, respostas acumuladas e score; dispara evento `fbq('track','Lead')` se Pixel presente) e avança para a etapa configurada.
     - **Botão (`botao`)**: bloqueia avanço se alguma opção obrigatória não foi selecionada (`requiredSatisfied`); prioriza o destino de uma opção de escolha única selecionada sobre a ação própria do botão; senão executa a ação configurada — redirecionar para URL (mesma aba ou nova aba), ir para etapa específica, ou avançar padrão.
     - **Loading (`loading`) e outros blocos com `onAdvance`**: avançam automaticamente ao fim da animação/duração, ou redirecionam para URL se configurado.
     - **Voltar**: navega para a etapa anterior via pilha de histórico (`history`), preservando as seleções já feitas (não zera score).
  4. Ao atingir a última etapa (sem próximo destino), chama `finish()`: `POST /api/q/:slug/complete` (registra conclusão) e, se houver `redirectUrl` configurada no funil, redireciona o navegador para essa URL.
  5. `HostQuizPlay`: quando acessado por domínio próprio do cliente, primeiro resolve `GET /api/q/resolve?host=<hostname>` para descobrir qual slug está publicado naquele domínio, exibindo "Carregando…" ou "Nenhum funil publicado neste domínio." antes de montar o `QuizPlay`.
- **Regras de negócio visíveis no código**:
  - Score é **derivado** (soma de todas as seleções acumuladas nos `picks`), nunca aplicado por delta manual — evita duplicação de pontuação ao navegar para trás/frente.
  - Em componentes de múltipla escolha, o roteamento de próxima etapa **não** pode vir da opção — só do botão (comentário explícito no código: "regra Movify").
  - Lead é enviado uma única vez por sessão (`sentLead` ref trava reenvio).
  - Cabeçalho, logo, progresso e botão voltar podem ser sobrepostos por etapa (`step.header`) em relação ao tema global.
  - Fontes do Google carregadas dinamicamente conforme tema do funil.
- **Integrações e chamadas de API**:
  - `GET /api/q/:slug` — carrega o spec público do funil.
  - `POST /api/q/:slug/start` — registra início/visita.
  - `POST /api/q/:slug/complete` — registra conclusão do funil.
  - `POST /api/q/:slug/lead` — envia lead capturado (payload: `lead`, `respostas`, `score`).
  - `GET /api/q/resolve?host=` — resolve slug a partir do hostname customizado (usado por `HostQuizPlay`).
  - Meta (Facebook) Pixel injetado dinamicamente via script externo (`connect.facebook.net/en_US/fbevents.js`), disparando `PageView` no carregamento e `Lead` na captura.
  - Google Analytics (`gtag.js`) injetado se `gaId` estiver configurado.
  - Scripts customizados do `<head>` (`headScript`) injetados e reexecutados.
- **Dados exibidos**: mesmo `QuizSpec` do builder (steps, theme, pixelId, webhookUrl, redirectUrl, seoTitle/seoDescription/faviconUrl, gaId, headScript), estado de sessão do respondente (`answers`, `vars`, `picks`, `score`, `elapsed`, `history`).

---

## Clonador de Páginas

### Página: /clonador — Clonador de Páginas

- **Arquivo fonte**: `client/src/pages/PageCloner.tsx` — rota `/clonador` (registrada em `App.tsx` linha 251).
- **Objetivo**: permitir que o usuário clone o HTML de qualquer página pública via URL, salve o clone com um nome, gerencie a lista de páginas clonadas (visualizar, editar, duplicar, apagar), configure domínio personalizado e instale scripts de rastreamento (pixels) nas páginas salvas.
- **Layout geral**: página com cabeçalho (título "Clonador de Páginas" + subtítulo) seguida de um grid de 2 colunas (`lg:grid-cols-2`) com dois Cards lado a lado — "1. Clonar Página" e "2. Configurar Domínio e Pixel". Abaixo, quando há páginas salvas, um Card de largura total com uma tabela "Suas Páginas Clonadas". Vários Dialogs (modais) sobrepostos para edição inline, configuração de tracking, clonagem de página existente, nomear nova página, configuração de domínio e tutorial em vídeo. Se o feature estiver bloqueado por plano, a tela inteira é substituída por `FeatureLockedOverlay`.

- **Inventário completo de UI**:
  - **Bloqueio de feature**: se `isFeatureBlocked("clonador")` for true, renderiza somente `<FeatureLockedOverlay featureName="Clonador de Páginas" description="Clone páginas de alta conversão em segundos. Disponível apenas para assinantes." />` (nada mais é exibido).
  - **SEO**: componente `<SEO>` com título/descrição/canonical de `seoConfig.clonador`.
  - **Card 1 — "1. Clonar Página"**:
    - Descrição: "Digite a URL da página que deseja clonar".
    - Campo `Input` (id `url`, tipo `url`, placeholder `https://exemplo.com`) — label "URL da Página".
    - Botão "Clonar Página" (ícone `Globe`) — dispara `clonePage()`.
    - Link de texto "Veja como clonar um site fácil" (ícone `Eye`, `data-testid="link-video-tutorial"`) — abre o modal de vídeo tutorial.
  - **Card 2 — "2. Configurar Domínio e Pixel"**:
    - Descrição: "Configure domínio personalizado e adicione códigos de rastreamento".
    - Texto explicativo estático.
    - **Estado vazio**: se `savedPages.length === 0`, mostra bloco cinza com ícone `Globe` grande, "Nenhuma página clonada ainda" e instrução para clonar primeiro.
    - Caso existam páginas: botão "Configurar" (ícone `Settings`, `data-testid="button-configure"`) — seleciona a primeira página salva como `currentPage` e abre o dialog de tracking/domínio.
  - **Tabela "Suas Páginas Clonadas"** (só renderiza se `savedPages.length > 0`):
    - Cabeçalho do Card: contagem "Total de N página(s) criada(s)".
    - Colunas da tabela: **Nome**, **Data de Criação**, **Visualizações**, **URL**, **Ações**.
    - Coluna Nome: nome original da página + badge condicional quando `requiresDomain && !customDomain`: badge âmbar "⏳ {timeRemaining || 'Configure domínio'}" (ícone `Info`) se `isActive`, ou badge vermelho "Desativada" se não ativa.
    - Coluna Data: formatada `dd/MM/yyyy` via `date-fns`.
    - Coluna Visualizações: ícone `Eye` + `viewCount` (padrão 0).
    - Coluna URL: se tem `customDomain`, mostra `https://{customDomain}` em badge verde; senão mostra `{origin}/pages/{name}` truncado (45 chars) em `code` cinza; botão ícone "Copiar URL" (`Copy`) ao lado.
    - Coluna Ações: `DropdownMenu` (trigger com ícone `MoreVertical`) contendo:
      - "Editar" (ícone `Edit`) → `editPage(name)`.
      - "Ver Página" (ícone `Eye`) → abre em nova aba a URL (domínio custom ou `/pages/{name}`).
      - "Configurações de Domínio" (ícone `Globe`) → `openDomainConfig(name)`.
      - "Configurar Scripts" (ícone `Settings`) → seta `currentPage` e abre dialog de tracking.
      - "Duplicar" (ícone `Copy`) → `startClonePage(name)`.
      - "Apagar" (ícone `Trash2`, texto vermelho) → `deletePage(name)` (com `confirm()` nativo do navegador).
  - **Dialog "Editar Texto/Link/Imagem"** (aberto quando `selectedElement` existe, mecanismo legado de edição inline de iframe embutido nesta página, embora o iframe de preview em si não seja renderizado na tela principal):
    - Título dinâmico conforme tipo: "Editar Texto" / "Editar Link" / "Editar Imagem".
    - Campo `Input` para novo valor (texto simples ou URL, conforme tipo).
    - Botões "Aplicar Alteração" e "Cancelar".
  - **Dialog "Configurar Página Clonada"** (`showTrackingDialog`, largura `max-w-3xl`):
    - `Select` "Selecionar Página" (`data-testid="select-page"`) listando `savedPages` (rótulo = `originalName` ou `name`).
    - Quando uma página está selecionada, três seções de código com `Switch` + `Textarea` cada:
      - **Código no `<head>`** (switch `enable-head-code`) — textarea `head-code` (placeholder sobre pixels Meta/GA/GTM).
      - **Código no início do `<body>`** (switch `enable-body-code`) — textarea `body-code`.
      - **Código antes do `</body>` (Footer)** (switch `enable-footer-code`) — textarea `footer-code`.
    - Duas opções adicionais com `Switch`:
      - "Substituir pixels antigos" (`remove-old-pixels`) — remove GA/FB Pixel/GTM antigos antes de inserir novos.
      - "Desativar outros scripts" (`deactivate-other-scripts`) — desativa scripts de terceiros não essenciais.
    - Bloco informativo "Como Funciona" (ícone `Sparkles`) explicando que o sistema instala/analisa automaticamente.
    - Botões: "Instalar Scripts"/"Aplicar Configurações" (texto varia conforme se algum código está habilitado; ícone `Save`, loading spinner quando `isProcessing`) → `installPixel()`; "Cancelar" → fecha dialog e limpa os campos de código.
    - Estado vazio: se nenhuma página selecionada, mensagem "Selecione uma página acima para começar a configurar".
  - **Dialog "Clonar Página: {pageToClone}"** (`showCloneDialog`):
    - Campo `Input` "Nome da Nova Página" (`data-testid="input-cloned-page-name"`, placeholder "minha-pagina-clonada").
    - Nota: "A página será clonada e o editor será aberto automaticamente".
    - Botões: "Clonar e Editar" (ícone `Save`, `data-testid="button-clone-confirm"`) → `cloneExistingPage()`; "Cancelar".
  - **Dialog "Salvar Página Clonada"** (`showNameDialog`, aberto logo após clonar uma URL):
    - Campo `Input` "Nome do Projeto" (`data-testid="input-new-page-name"`, placeholder "minha-pagina").
    - Nota: "A página será salva e o editor será aberto em nova guia".
    - Botões: "Salvar e Editar" (`data-testid="button-save-and-edit"`) → `saveAndOpenEditor()`; "Cancelar".
  - **Dialog "Domínio Personalizado"** (`showDomainDialog`, `max-w-2xl`):
    - Campo `Input` domínio (`data-testid="input-custom-domain-cloner"`, placeholder "meusite.com ou app.meusite.com") + botão "Salvar" (`data-testid="button-save-domain-cloner"`, spinner quando `isSavingDomain`) → `saveDomainConfig()`.
    - Lista numerada de instruções (1 a 4: digitar domínio/salvar, configurar DNS, aguardar SSL, clicar em Verificar).
    - **Tabela de registros DNS** (só se `customDomain` preenchido): colunas Tipo/Nome/Valor/(botão copiar).
      - Linha fixa CNAME: nome = resultado de `getDnsHostName(customDomain)`, valor = `proxy.lowfy.com.br`, botão copiar (`data-testid="button-copy-cname-cloner"`).
      - Linhas dinâmicas TXT vindas de `txtRecords` (retornados pela API de verificação), cada uma com botões de copiar nome e copiar valor.
      - Rodapé da tabela: "Configure no Cloudflare com proxy ativado (nuvem laranja)".
    - Aviso azul de propagação DNS (quando `customDomain` preenchido e status ≠ 'active').
    - Link "Assista ao vídeo tutorial e veja como é fácil!" (`data-testid="button-video-tutorial-cloner"`) → abre modal de vídeo.
    - **Bloco de status** (quando `domainStatus !== 'idle'`):
      - `active`: ícone check verde + mensagem + link "Abrir" (`data-testid="link-open-domain"`) que abre `https://{customDomain}`.
      - `pending`: spinner + mensagem de aguardo + nota sobre propagação até 24h.
      - `error`: ícone `AlertCircle` + mensagem de erro.
    - Botões finais: "Fechar" (`data-testid="button-cancel-domain-cloner"`); "Verificar" (`data-testid="button-check-domain"`, ícone `RefreshCw`/spinner) → `handleVerifyDomain()`.
    - Ao fechar o dialog (`onOpenChange`), se o domínio foi digitado e mudou, salva automaticamente antes de fechar.
  - **Dialog "Como Clonar um Site Facilmente"** (`showVideoTutorialDialog`, `max-w-3xl`):
    - Player de vídeo HTML5 (`data-testid="video-tutorial-cloner"`) com poster `/videos/cloner-tutorial-thumb.jpg` e fonte `/videos/cloner-tutorial.mp4`.
    - Botão "Fechar".

- **Fluxos do usuário**:
  1. **Clonar nova página**: usuário digita URL no Card 1 → clica "Clonar Página" → `clonePage()` valida a URL e chama `POST /api/clone-page` → recebe HTML clonado → abre automaticamente o dialog "Salvar Página Clonada" → usuário digita nome → clica "Salvar e Editar" → `saveAndOpenEditor()` chama `POST /api/save-cloned-page` → fecha modal, recarrega lista de páginas e abre `/clonador/preview?session=...&page=...` em nova aba.
  2. **Editar página existente**: no dropdown de ações da tabela, clica "Editar" → `editPage(name)` abre `/clonador/preview?session=...&page=...` em nova aba (HTML buscado do servidor pelo editor).
  3. **Duplicar página**: clica "Duplicar" → abre dialog de clonagem com nome pré-preenchido do `pageToClone` → digita novo nome → "Clonar e Editar" → `cloneExistingPage()` busca HTML da página original (`GET /api/get-cloned-page/:name`), salva com novo nome (`POST /api/save-cloned-page`, `isCloned: true`) → abre editor em nova aba.
  4. **Configurar domínio**: clica "Configurações de Domínio" no dropdown → `openDomainConfig(name)` preenche estado e abre dialog → digita domínio → "Salvar" (`saveDomainConfig` → `POST /api/cloned-page/set-domain`) → configura DNS conforme tabela exibida → clica "Verificar" → `handleVerifyDomain()` chama `GET /api/custom-domains/:domain/check` e atualiza status (ativo/pendente/erro) e SSL.
  5. **Instalar/configurar scripts de rastreamento**: clica "Configurar Scripts" (dropdown) ou "Configurar" (Card 2) → seleciona página no `Select` → ativa switches de head/body/footer e cola códigos, e/ou ativa opções de limpeza de pixels → clica "Instalar Scripts"/"Aplicar Configurações" → `installPixel()` chama `POST /api/inject-tracking-fast`.
  6. **Apagar página**: clica "Apagar" → `confirm()` nativo → `deletePage(name)` chama `DELETE /api/delete-cloned-page/:name` → recarrega lista.
  7. **Copiar link**: botão de copiar na coluna URL → `copyPageLink(name)` copia URL (custom domain ou `/pages/{name}`) para a área de transferência.

- **Regras de negócio visíveis no código**:
  - Acesso à feature inteira é controlado por `useFeatureAccess()` / `isFeatureBlocked("clonador")` — se bloqueado, tela inteira vira overlay de bloqueio (indicando gating por plano/assinatura).
  - Páginas clonadas via "Duplicar" são marcadas com `isCloned: true` e no backend aparentemente resultam em `requiresDomain: true` (usado para exibir badges "Configure domínio"/"Desativada" na tabela).
  - Badge "Desativada" (vermelho) aparece quando `requiresDomain && !customDomain && !isActive` — sugerindo que páginas duplicadas sem domínio configurado dentro de um prazo (`timeRemaining`) ficam inativas.
  - Todas as chamadas de API tratam `response.status === 401` redirecionando para `/login` com toast de "Sessão expirada".
  - Autenticação usa tanto cookie (`credentials: 'include'`) quanto header `Authorization: Bearer` via `getAuthHeaders()` (token de `localStorage`).

- **Integrações e chamadas de API**:
  - `POST /api/clone-page` — clona HTML de uma URL.
  - `POST /api/save-cloned-page` — salva página clonada (nome, html, originalName, isCloned opcional).
  - `POST /api/update-cloned-page` — atualiza página existente.
  - `GET /api/list-cloned-pages` — lista páginas salvas do usuário.
  - `GET /api/get-cloned-page/:name` — busca HTML de uma página salva (usado ao duplicar).
  - `DELETE /api/delete-cloned-page/:name` — exclui página.
  - `GET /api/cloned-page/status/:pageName` — status da página (domínio, tempo restante, ativo/expirado).
  - `GET /api/get-tracking-metadata/:pageName` — carrega códigos de tracking já salvos (head/body/footer, flags de remoção/desativação).
  - `POST /api/inject-tracking-fast` — injeta/instala códigos de rastreamento e aplica opções de limpeza de pixels.
  - `POST /api/cloned-page/set-domain` — define domínio personalizado da página.
  - `GET /api/custom-domains/:domain/check` — verifica status DNS/SSL do domínio (Cloudflare), retorna `isFullyActive`, `needsSync`, `found`, `status`, `ssl`, `txtRecords`, possíveis flags `cloudflareUnavailable`/`cloudflareError`.
  - Serviço externo percebido: **Cloudflare** (proxy DNS/SSL, CNAME alvo fixo `proxy.lowfy.com.br`).

- **Dados exibidos**: por página salva — `name`, `originalName`, `createdAt`, `viewCount`, `customDomain`, `requiresDomain`, `timeRemaining`, `isActive`; no status de domínio — `hoursRemaining`, `isExpired`; nos registros DNS — `name`, `value`, `type` (TXT) e CNAME fixo.

---

### Página: /clonador/preview — Editor Visual de Página Clonada

- **Arquivo fonte**: `client/src/pages/PageClonerPreview.tsx` — rota `/clonador/preview` (registrada duas vezes em `App.tsx`, linhas 194 e 215, aparentemente em dois grupos de rotas distintos, e também referenciada indiretamente pela página `/clonador`).
- **Objetivo**: editor visual em tela cheia da página clonada — permite clicar diretamente em qualquer elemento do HTML renderizado (dentro de um iframe) para editar texto, link, botão ou imagem, além de oferecer um editor de código-fonte HTML (Monaco) para edições avançadas, e salvar as alterações de volta ao servidor. Também suporta um modo somente-visualização.
- **Layout geral**: tela cheia (`h-screen flex flex-col`). Barra superior fixa com título e botões de ação à direita. Abaixo, área de preview ocupando o restante da tela com um `<iframe>` renderizando o HTML da página via `srcDoc`. Vários Dialogs sobrepostos: edição de texto/link/botão, edição de imagem (com upload) e editor de código Monaco em tela modal grande.

- **Inventário completo de UI**:
  - **Barra superior**:
    - Título: "Visualização de Página" (modo view) ou "Editor Visual de Página" (modo edição).
    - Badge azul (só fora do modo view) com ícone `Edit` mostrando "Modo Edição Ativo - Clique em qualquer elemento" ou "Modo Visualização" conforme `editMode`.
    - Botões (ocultos em modo view):
      - "Desativar Edição"/"Ativar Edição" (ícone `Edit`, variante muda conforme `editMode`) → toggle `editMode`.
      - "Ver Código" (ícone `Code2`, `data-testid="button-view-code"`) → `openCodeModal()`, abre editor Monaco com HTML atual.
      - "Salvar Alterações" (ícone `Save`, `data-testid="button-save-changes"`) → `savePage()`.
    - Botão "X" (fechar, sempre visível) → `setLocation('/clonador')`.
  - **Área de preview**: `<iframe>` de tela cheia com `srcDoc={editedHtml}`. Estado de carregamento: se `editedHtml` ainda vazio, mostra "Carregando página..." + dica "Se a página não carregar, volte e clone novamente".
  - **Dialog "Editar Texto/Link/Botão"** (aberto quando `selectedElement` existe e tipo ≠ imagem):
    - Título dinâmico com ícone: "Editar Texto" (`Type`), "Editar Link" (`LinkIcon`), "Editar Botão" (`Type`).
    - Campo "Texto do Link/Botão" (`Input`) — só para tipo link/botão.
    - Campo "URL do Link/Botão" (`Input` tipo url) — só para tipo link/botão.
    - Campo "Novo Texto" (`Input`) — só para tipo texto simples.
    - Botões "Aplicar Alteração" (desabilitado durante `uploadingImage`) → `applyEdit()`; "Cancelar".
  - **Dialog "Editar Imagem"** (`showImageEditDialog`, `max-w-2xl`):
    - Campo "URL da Imagem" (`Input` tipo url, id `imageUrl`) — atualiza preview com cache-bust a cada digitação.
    - **Preview da imagem**: bloco com ícone `ImageIcon`, "Preview da Imagem:", `<img>` (fallback para placeholder em caso de erro de carregamento) e nota "✓ Imagem carregada - Clique em Aplicar Alteração para substituir".
    - Separador "OU".
    - **Área de upload**: label clicável estilo dropzone (borda tracejada) com ícone `ImageIcon`, texto "Clique para fazer upload de uma imagem", nota "JPG, PNG, GIF, WEBP até 5MB"; `<input type="file">` oculto aceitando jpeg/jpg/png/gif/webp.
    - Botões: "Aplicar Alteração" (ícone `Check`, desabilitado se URL vazia) → `applyImageEdit()`; "Cancelar" (reseta todos os estados de imagem).
  - **Dialog "Visualizar/Editar Código HTML"** (`isCodeModalOpen`, `max-w-4xl`):
    - Barra de ferramentas: "Tema do Editor" com botão alternando Claro/Escuro (ícones `Sun`/`Moon`) → `editorTheme` (`vs-dark`/`vs`); botão "Indentar" (ícone `Wand2`) → `formatCodeInEditor()` (roda ação `editor.action.formatDocument` do Monaco); botão "Buscar" (ícone `Search`) → `openSearchInEditor()` (roda ação `actions.find`).
    - Dicas de atalhos: `Ctrl+F` (Busca), `Shift+Alt+F` (Formatar).
    - **Editor Monaco** (`@monaco-editor/react`, carregado via CDN jsDelivr — nota no código menciona otimização de bundle): linguagem padrão `html`, altura `45vh`, opções: minimap habilitado, fontSize 13, números de linha, tabSize 2, wordWrap off, folding, formatOnPaste/formatOnType, bracketPairColorization, autoIndent full, scrollbars visíveis. Loading placeholder: "Carregando editor...".
    - Botões: "Cancelar" (`data-testid="button-cancel-code"`) fecha sem salvar; "Aplicar Alterações" (`data-testid="button-apply-code"`) → `applyCodeChanges()` grava o código do editor em `editedHtml` e fecha modal (toast indicando que ainda precisa clicar em "Salvar" para persistir no servidor).
  - **Estados de erro/carregamento**: toasts de erro para sessão inválida, nome de página ausente, falha ao carregar página do servidor (com redirecionamento automático a `/clonador` após 2s); toast "Fazendo upload..." durante envio de imagem.

- **Fluxos do usuário**:
  1. **Entrada no editor**: página é aberta via `window.open` a partir de `/clonador` com query params `session` e `page` (e opcionalmente `view=true` para modo somente-leitura). No `useEffect` inicial, valida `session`/`page`; se ausentes, toast de erro e redireciona para `/clonador` em 2s. Busca o HTML via `GET /api/get-cloned-page/:page` e popula `html`/`editedHtml`.
  2. **Edição visual de elemento**: com `editMode` ativo, `setupEditMode()` roda no `onload` do iframe — adiciona classe de hover (`edit-hoverable`) a elementos básicos (p, h1-h6, span, a, img, button, div, li, td, th, etc.) e também a qualquer elemento com `background-image` computado; ao clicar num elemento dentro do iframe, identifica o tipo (imagem, imagem de fundo, link, botão, ou texto) e abre o dialog apropriado (imagem → `showImageEditDialog`; demais → dialog de texto/link/botão).
  3. **Editar texto**: clica em texto → dialog abre com valor atual → edita → "Aplicar Alteração" → `applyEdit()` localiza elemento via XPath no iframe e atualiza `innerText`, regrava `editedHtml`.
  4. **Editar link**: clica em `<a>` → dialog com campos texto e URL → aplica → atualiza `href` e `textContent` do elemento.
  5. **Editar botão**: clica em `<button>`/`input[button/submit]` → dialog com texto e URL opcional → aplica → atualiza `textContent`; se URL informada, seta `href` (se for `<a>`) ou `onclick` com redirecionamento (se `button`/`input`).
  6. **Editar imagem por URL**: clica em `<img>` ou elemento com background-image → dialog de imagem abre com URL atual e preview → digita nova URL (preview atualiza automaticamente) → "Aplicar Alteração" → `applyImageEdit()` → `handleImageChange()` localiza elemento via XPath, aplica cache-bust, atualiza `src` ou `background-image`, força reload completo do iframe (reset `srcdoc` para vazio e depois para o HTML atualizado) e reconfigura modo de edição.
  7. **Editar imagem por upload**: no mesmo dialog, clica na dropzone → seleciona arquivo → valida tipo (jpeg/png/gif/webp) e tamanho (máx. 5MB) → `handleImageUpload()` envia via `POST /api/upload-image` (FormData) → preenche `editImageUrl`/preview com a URL retornada → usuário confirma com "Aplicar Alteração" (mesmo fluxo do item 6).
  8. **Editar código HTML diretamente**: clica "Ver Código" → abre editor Monaco com HTML atual → edita livremente (pode formatar com "Indentar" ou buscar com "Buscar"/Ctrl+F) → "Aplicar Alterações" → grava no estado `editedHtml` em memória (ainda não persiste no servidor).
  9. **Salvar no servidor**: clica "Salvar Alterações" → `savePage()` chama `POST /api/update-cloned-page` com `name` e `editedHtml` → toast de sucesso → após 1.5s tenta fechar a aba (`window.close()`) e, como fallback (bloqueio de popup pelo navegador), redireciona para `/clonador`.
  10. **Sair sem salvar**: clica no "X" → `setLocation('/clonador')` sem persistir alterações pendentes.

- **Regras de negócio visíveis no código**:
  - Modo `view=true` na query string desativa toda a interface de edição (barra de botões some, `editMode` fica `false`) — usado para visualização somente-leitura.
  - Upload de imagem restrito a tipos `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp` e tamanho máximo de 5MB, validados no cliente antes do envio.
  - Todas as edições visuais (texto/link/botão/imagem) são aplicadas primeiro em memória no DOM do iframe (via XPath) e refletidas em `editedHtml`; a persistência real no banco só ocorre ao clicar em "Salvar Alterações".
  - Autenticação: mesmas convenções de `getAuthHeaders()` (Bearer token) + cookie `credentials: 'include'`; qualquer resposta 401 redireciona para `/login`.
  - HTML nunca é armazenado em `localStorage` (comentário explícito no código: "não usa localStorage - muito grande") — é sempre buscado do servidor pelo nome da página.

- **Integrações e chamadas de API**:
  - `GET /api/get-cloned-page/:page` — carrega HTML da página a ser editada.
  - `POST /api/upload-image` — upload de imagem (FormData) para substituição de imagens no clone.
  - `POST /api/update-cloned-page` — persiste as alterações (`name`, `html`) no servidor.
  - Serviço externo: **Monaco Editor** carregado via CDN jsDelivr (`@monaco-editor/react`) para o editor de código HTML.

- **Dados exibidos**: HTML completo da página clonada (`html`/`editedHtml`), nome da página (`pageName`/`currentPageName`), `sessionId` da URL, elemento selecionado (`type`, `content`, `xpath`, `href`, `text` opcional) durante edição inline, tema do editor Monaco (`vs-dark`/`vs`).

---

## Criador de Páginas de Pré-venda (Pre-Sell Builder)

### Página: `/presell-dashboard` — Dashboard de Pre-Sell (Criador de Páginas)

- **Arquivo fonte**: `client/src/pages/PreSellDashboard.tsx` (543 linhas) — rota `/presell-dashboard` (registrada em `client/src/App.tsx`, componente `PreSellDashboard`, lazy-loaded).
- **Objetivo**: listar todas as páginas de pré-venda ("Pre-Sell") já criadas pelo usuário, mostrar métricas básicas (visualizações e cliques), e servir de ponto de entrada para criar, editar, visualizar, configurar domínio, duplicar ou apagar páginas.
- **Layout geral**: página de container único (`container mx-auto`), sem sidebar interna. Cabeçalho com título/ícone + botão de ação primária à direita. Abaixo, ou um estado vazio (card centralizado) ou uma tabela única listando as páginas. Há dois `Dialog` (modais): configuração de domínio e tutorial em vídeo.
- **Inventário completo de UI**:
  - **Header**: ícone `FileText` + título "Pre-Sell Builder"; subtítulo "Crie páginas de pré-venda de alta conversão"; botão primário `Nova Pre-Sell` (ícone `Plus`, `data-testid="button-create-presell"`) que navega para `/presell-builder?new=true`.
  - **Estado vazio** (quando `pages.length === 0`): Card com ícone grande `FileText`, texto "Nenhuma Pre-Sell criada", descrição, botão `Criar Primeira Pre-Sell` (`data-testid="button-create-first-presell"`); abaixo, link de texto "Veja como criar uma página fácil" (ícone `Eye`) que abre o modal de tutorial em vídeo.
  - **Estado com páginas**: Card "Suas Páginas Pre-Sell" com descrição "Total de N página(s) criada(s)". Contém uma `Table` com colunas: **Nome** (nome + badge condicional de status de domínio — badge âmbar "Configure domínio"/tempo restante quando `requiresDomain && !customDomain && isActive`, ou badge vermelho "Desativada" quando `!isActive`), **Data de Criação** (formatada `dd/MM/yyyy` em pt-BR via `date-fns`), **Visualizações** (ícone `Eye` + `viewCount`), **Cliques no Botão** (ícone `MousePointer` + `clickCount`, destacado em cor primária), **URL** (código truncado com a URL pública da página — domínio customizado se houver, senão `origin/presell/slug` — mais botão "copiar" com ícone `Copy`), **Ações** (menu dropdown `MoreVertical` com: Editar, Ver Página, Configurações de Página, Duplicar, Apagar em vermelho).
  - Abaixo da tabela: mesmo link "Veja como criar uma página fácil" que abre o tutorial.
  - **Modal "Configurar Domínio Customizado"** (`showDomainDialog`): título, descrição com nome da página selecionada, corpo contém o componente `<DomainConnectWizard pageName pageType="presell" currentDomain onDomainChange>` (componente externo não detalhado aqui), rodapé com botão "Fechar".
  - **Modal "Como Criar uma Página Fácil"** (`showVideoTutorialDialog`): título, descrição, player `<video>` com poster `/videos/page-creator-tutorial-thumb.jpg` e fonte `/videos/page-creator-tutorial.mp4`, botão "Fechar".
  - **Estado bloqueado por plano**: se `isFeatureBlocked("presell-builder")` for verdadeiro, a página inteira é substituída por `<FeatureLockedOverlay featureName="Pre-Sell Builder" description="Crie páginas de pré-venda de alta conversão. Disponível apenas para assinantes." />` (sem renderizar dashboard).
  - Não há estados de loading/skeleton explícitos nem estado de erro visual dedicado (erros de fetch falham silenciosamente, exceto 401 que redireciona para `/login` com toast "Sessão expirada").
- **Fluxos do usuário**:
  - **Criar nova página**: clica "Nova Pre-Sell" → navega para `/presell-builder?new=true` (abre lá o diálogo de nome).
  - **Editar**: menu de ações → "Editar" → navega para `/presell-builder?edit={nome}`.
  - **Configurações de página**: menu de ações → "Configurações de Página" → navega para `/presell-builder?edit={nome}&settings=true` (abre builder já com o modal de Configurações aberto).
  - **Ver página**: menu de ações → "Ver Página" → abre `/presell/{slug-minúsculo}` em nova aba.
  - **Copiar URL**: botão de copiar ao lado da URL → copia para clipboard e mostra toast "URL copiada!".
  - **Duplicar**: busca dados da página original (`GET /api/presell/get/:name`), gera novo nome `{name}-copia-{timestamp}`, salva via `POST /api/presell/save`, recarrega lista.
  - **Apagar**: confirma via `window.confirm`, chama `DELETE /api/presell/delete/:name`, recarrega lista.
  - **Configurar domínio**: abre modal, usa o wizard interno (não detalhado); ao concluir, recarrega lista de páginas.
- **Regras de negócio visíveis no código**:
  - Acesso à feature "presell-builder" é checado via `useFeatureAccess()`/`isFeatureBlocked`; se bloqueado, a tela inteira vira overlay de bloqueio ("apenas para assinantes").
  - Páginas sem domínio próprio (`requiresDomain && !customDomain`) exibem contagem regressiva/aviso de expiração (`timeRemaining`/`hoursRemaining`), e se `isActive === false`, aparecem como "Desativada" — indicando uma regra de expiração automática de páginas publicadas sem domínio custom (24h, confirmada mais adiante no builder).
  - Requisições autenticadas via header `Authorization: Bearer <auth_token>` (localStorage) e `credentials: 'include'`; qualquer resposta 401 força logout (redirect para `/login`).
- **Integrações e chamadas de API**:
  - `GET /api/presell/list` — carrega lista de páginas.
  - `GET /api/presell/get/:name` — carrega dados de uma página (usado na duplicação).
  - `POST /api/presell/save` — salva página duplicada.
  - `DELETE /api/presell/delete/:name` — apaga página.
  - `POST /api/presell/configure-domain/:name` — configura/remove domínio customizado (body `{ customDomain }`).
  - Componente `DomainConnectWizard` (import de `@/components/DomainConnectWizard`) provavelmente chama endpoints adicionais de domínio (não detalhado — fora do escopo "1 nível" já que é o wizard central de domínio, mas seu conteúdo interno não foi expandido nesta leitura).
- **Dados exibidos**: por página — `name`, `createdAt`, `viewCount`, `clickCount`, `customDomain`, `requiresDomain`, `isActive`, `timeRemaining`, `hoursRemaining`.

---

### Página: `/presell-builder` — Construtor de Páginas Pre-Sell (Criador de Páginas por blocos)

- **Arquivo fonte**: `client/src/pages/PreSellBuilderSimple.tsx` (3675 linhas) — rota `/presell-builder` (App.tsx, componente `PreSellBuilder` = `PreSellBuilderSimple`, lazy-loaded). Parâmetros de query suportados: `?new=true` (abre diálogo de nome para página nova), `?edit={nome}` (carrega página existente), `&settings=true` (abre automaticamente o modal de Configurações após carregar).
- **Objetivo**: editor visual drag-and-drop ("page builder") para montar páginas de pré-venda/landing pages a partir de blocos de conteúdo, com painel de propriedades por bloco, biblioteca de templates prontos, seções prontas, geração de página por IA (blocos ou HTML "vibe code"), preview responsivo, configurações de SEO, domínio customizado e scripts de tracking.
- **Layout geral**: tela cheia (`h-screen flex flex-col`). Barra superior (header) fixa com navegação e ações. Corpo dividido em: **painel esquerdo** (largura fixa `w-80`) que alterna entre "Elementos" (paleta de blocos, quando nada está selecionado) e "Propriedades" (accordion de configuração do elemento selecionado); **canvas central** (área rolável com fundo xadrez quando vazio) onde os blocos são renderizados e reordenados via drag-and-drop (`@dnd-kit`). Vários `Dialog`s sobrepostos: Nome da página, Templates, Criar com IA, Configurações (com abas Geral/SEO/Domínio/Scripts).
- **Inventário completo de UI**:

  **Cabeçalho (topo)**:
  - Botão "Voltar" (`ArrowLeft`) → navega para `/presell-dashboard`.
  - Título dinâmico: nome da página atual ou "Nova Pre-Sell".
  - **Controles de viewport**: 3 botões (Desktop `Monitor`, Tablet `Tablet`, Mobile `Smartphone`) que alternam a largura simulada do canvas (`max-w-4xl` / `max-w-2xl` / `max-w-md`).
  - Botões **Desfazer** (`Undo2`) e **Refazer** (`Redo2`) — histórico local (até 50 estados) de `elements`.
  - Botão **Templates** (`LayoutTemplate`) → abre modal de galeria de templates.
  - Botão **Criar com IA** (`Sparkles`, destaque em gradiente verde) → abre modal de geração por IA.
  - Botão **Configurações** (`Settings`) → abre modal de configurações da página.
  - Botão **Preview** (`Eye`) → abre `/presell/{slug}` em nova aba (exige que a página já tenha sido salva/tenha slug; senão mostra toast de erro).
  - Botão **Salvar** (`Save`) → persiste a página.

  **Painel esquerdo — modo "Elementos" (paleta de blocos)** — cabeçalho "Elementos" com dica "Clique para adicionar" (ícone `GripVertical`), organizado em grupos com botões arrastáveis (`DraggableElementButton`, drag via `@dnd-kit` + clique direto adiciona ao final da página):
  - **Texto**: Título (`headline`), Subtítulo (`subheadline`), Parágrafo (`text`).
  - **Mídia**: Vídeo (`video`), Imagem (`image`).
  - **Interação**: Botão CTA (`button`), Contador (`countdown`).
  - **Layout**: Divisor (`divider`), Container (`container` — bloco com colunas internas, tipo "grid"/layout de colunas, aceita 1-4 colunas e recebe outros blocos arrastados dentro de cada coluna via `DroppableColumn`).
  - **Seções prontas** (blocos de "Seção", inserem múltiplos elementos pré-montados de uma vez, definidos em `SECOES`): Hero, Benefícios, Depoimentos, Oferta/Preço, FAQ, Garantia, Vídeo depoimento, Contador, Selos/Logos. Cada uma é um botão com ícone e nome que chama `addSection()`.

  **Tipos de bloco (elementos) disponíveis e suas propriedades no editor** (definidos no `type PreSellElement`, tipos: `'headline' | 'subheadline' | 'video' | 'text' | 'button' | 'image' | 'divider' | 'countdown' | 'container'`):
  1. **Headline (Título)** — conteúdo: texto (Input); estilo: alinhamento (esquerda/centro/direita), negrito/itálico/sublinhado, tamanho da fonte, cor do texto, padding (4 lados) e margin (4 lados).
  2. **Subheadline (Subtítulo)** — mesmas opções do headline.
  3. **Text (Parágrafo)** — conteúdo: textarea multi-linha; mesmas opções de estilo do headline (fonte, cor, alinhamento, negrito/itálico/sublinhado, padding/margin).
  4. **Video** — conteúdo: URL do vídeo (YouTube/Vimeo, convertido de `watch?v=` para `embed/`); estilo: largura (Select: 50%/75%/100%/560px/800px), alinhamento, padding/margin. Sem opção de cor de texto/fonte (bloco de mídia).
  5. **Image (Imagem)** — conteúdo: texto alternativo (alt); estilo: largura (Select: 25%/50%/75%/100%/300px/500px/800px), alinhamento, padding/margin; **URL da imagem** (input texto) OU **upload de arquivo** (JPEG/PNG/GIF/WebP/AVIF, máx 4MB, validado no cliente, enviado para `/api/presell/upload-image`, com preview e fallback de imagem quebrada via `onError`). Quando sem imagem, mostra placeholder ilustrado ("Adicione uma imagem").
  6. **Button (Botão CTA)** — conteúdo: texto do botão; propriedades específicas: **Link do Botão** (URL), **Abrir em Nova Guia** (Switch), **Tempo para Aparecer** em segundos (delay de exibição via `setTimeout`/script gerado no HTML final), **Efeito do Botão** (Select: Sem efeito / Pulsar / Tremer / Pular / Brilho — animações CSS geradas dinamicamente); estilo: alinhamento, tamanho da fonte, cor do texto, **cor de fundo**, padding/margin.
  7. **Divider (Divisor)** — sem conteúdo nem accordion de "Conteúdo"/"Estilo" (apenas elemento visual `<hr>`), só é posicionável/removível/duplicável.
  8. **Countdown (Contador regressivo)** — conteúdo: campo "Tempo em Minutos" (número); estilo: cor do texto, cor de fundo, alinhamento, padding/margin (prefixo de texto e outras opções de estilo herdadas de `countdownPrefix`/`countdownBgColor`/`countdownTextColor` também presentes no modelo de dados, embora só "Tempo em Minutos", "Cor do Texto" e "Cor de Fundo" tenham inputs visíveis no painel). Ao publicar, gera script JS de contagem regressiva embutido no HTML.
  9. **Container (bloco de colunas)** — conteúdo: **Número de Colunas** (botões 1/2/3/4); estilo: **Espaçamento entre Colunas** (gap, px), **Cor de Fundo**, padding/margin. Cada coluna é uma área "droppable" (`DroppableColumn`) que aceita elementos arrastados de outros blocos (exceto outro container).

  **Painel esquerdo — modo "Propriedades" (quando um elemento está selecionado)**:
  - Cabeçalho "Propriedades" com subtítulo = nome amigável do tipo selecionado; botões **Duplicar** (`Copy`) e **Voltar** (`ArrowLeft`, desseleciona).
  - `Accordion` com duas seções (abertas por padrão): **"Conteúdo"** (campos específicos do tipo, listados acima) e **"Estilo & Aparência"** (alinhamento, formatação bold/italic/underline quando aplicável, tamanho de fonte, cor do texto, cor de fundo quando aplicável, largura para vídeo/imagem, cor de texto/fundo para contador, colunas/gap/fundo para container, e os dois blocos de espaçamento **Padding** (Topo/Direita/Baixo/Esquerda) e **Margin** (Topo/Direita/Baixo/Esquerda), cada um com input numérico + sufixo "px").

  **Canvas central**:
  - Estado vazio: ícone `Layout`, texto "Canvas vazio" + instrução para clicar nos elementos à esquerda.
  - Estado com elementos: `DndContext` (dnd-kit) envolvendo `MainDroppableArea`, que renderiza cada elemento via `SortableElement` (com handle de arrastar `GripVertical`, botões de mover para cima/baixo `ChevronUp/ChevronDown`, botão de configurações `Settings` que seleciona o elemento, botão de excluir `Trash2`) e trata containers de forma especial (mostra colunas `DroppableColumn` com indicadores visuais de "Solte aqui"/"Solte na Col N" durante o arraste). Lógica de drag-and-drop cobre: adicionar novo elemento da sidebar (solto no nível raiz ou dentro de uma coluna de container), mover elemento entre colunas/containers, mover elemento para fora do container (via área "main-droppable-area"), e reordenar elementos dentro do mesmo nível/coluna.

  **Modal "Nome da Pre-Sell"** (`showNameDialog`): input de texto (nome da página) + botões "Salvar" e "Cancelar". Ao salvar, gera `slug` (kebab-case, sanitizado) e persiste via `POST /api/presell/save`.

  **Modal "Escolha um template"** (`showTemplates`): grade de cards clicáveis (2-3 colunas) com ícone, nome e descrição, para os templates definidos em `PRESELL_TEMPLATES`:
  - **Em branco** — começa do zero (limpa elementos).
  - **VSL + Oferta** — headline, subheadline, vídeo, botão CTA, contador de escassez.
  - **Advertorial** — estilo notícia/artigo: headline+subheadline alinhados à esquerda, imagem, corpo de texto, CTA.
  - **Captura de Lead** — headline, subheadline, botão CTA "QUERO RECEBER GRÁTIS", texto de segurança/anti-spam.
  - **Oferta de Produto** — headline, imagem do produto, subheadline, CTA com desconto, contador de expiração.
  - Ao escolher, substitui todos os elementos da página atual e reseta o histórico de undo/redo.

  **Modal "Criar página com IA"** (`showAI`): toggle entre dois modos:
  - **Blocos editáveis** (`aiMode='blocks'`): textarea de prompt + botão "Gerar página" (`Sparkles`/spinner) → chama `/api/landing/generate`, popula `currentPage.elements` com blocos editáveis no builder.
  - **Vibe Code (HTML)** (`aiMode='vibe'`): textarea de prompt + botões "Gerar página" / "Iterar" (`RefreshCw`) → chama `/api/landing/vibe`, retorna HTML completo renderizado num `<iframe>` de preview; possui botões **Baixar HTML** (download local via Blob) e **Abrir em nova aba** (`window.open` + `document.write`). O modo Vibe não integra os blocos ao builder — é um HTML autônomo.

  **Modal "Configurações da Página"** (`showSettingsDialog`), com `Tabs` de 4 abas:
  - **Geral**: Cor de Fundo da Página (color picker), Largura Máxima do Conteúdo (Select: 800px/1000px/1200px/1400px/100%), Fonte Padrão (Select: Arial, Times New Roman, Courier New, Montserrat, Poppins, Roboto).
  - **SEO** (`Search` ícone): Título da Página / Meta Title (Input, máx 60 caracteres, contador), Descrição / Meta Description (Textarea, máx 160 caracteres, contador), Favicon (upload de imagem .ico/.png/.jpg/.svg via `/api/upload/favicon`, com preview e botão remover), Imagem de Compartilhamento / OG Image (upload via `/api/presell/upload-image`, preview, botão remover, recomendação 1200x630px).
  - **Domínio** (`Globe` ícone): aviso de que páginas sem domínio próprio ficam ativas só 24h (SSL automático via Cloudflare); campo de input do domínio customizado + botão "Salvar" (desabilitado se vazio); instruções passo-a-passo (digitar domínio → salvar → configurar DNS → aguardar 2-5min → verificar); quando há domínio configurado, mostra tabela de registros DNS (CNAME apontando para `proxy.lowfy.com.br`, mais registros TXT retornados pela API, cada linha com botão de copiar); avisos de propagação DNS; bloco de status do domínio (`domainStatus`) com ícones de sucesso (`Check` verde, com link "Abrir"), erro de sincronização (`AlertCircle`) ou aguardando ativação (`RefreshCw` girando); botão "Verificar" (spinner enquanto `isCheckingDomain`).
  - **Scripts** (`Code` ícone): três `Textarea` de código para **Scripts no Head** (Meta Pixel, GTM, etc — inserido após `<head>`), **Scripts no Body** (tracking/analytics — inserido após `<body>`), **Scripts no Footer** (chat/widgets — inserido antes de `</body>`).
  - Rodapé do modal: botões "Fechar" e "Salvar" (salva a página e fecha o modal, com toast "Configurações salvas!").

  **Estado de bloqueio por plano**: mesma lógica do dashboard — `isFeatureBlocked("presell-builder")` renderiza `<FeatureLockedOverlay>` no lugar de todo o builder.

- **Fluxos do usuário**:
  - **Criar página do zero**: entra via `?new=true` → modal de nome aparece automaticamente → digita nome → "Salvar" → gera slug e persiste em `/api/presell/save` → URL atualizada para `?edit={slug}` (via `history.replaceState`) → editor pronto para montar blocos.
  - **Adicionar bloco**: clica ou arrasta um item da paleta de "Elementos" → elemento é inserido no canvas com conteúdo/estilo padrão e automaticamente selecionado (abre painel de Propriedades).
  - **Editar bloco**: clica no elemento no canvas (ou no botão de engrenagem) → painel muda para "Propriedades" → ajusta conteúdo e estilo via accordion.
  - **Reorganizar**: arrasta pelo "grip handle" para reordenar dentro do mesmo nível/coluna, mover para dentro/fora de um Container, ou mover entre colunas de um Container; alternativamente usa os botões de mover para cima/baixo.
  - **Duplicar bloco**: botão "Duplicar" no painel de propriedades clona o elemento selecionado (e filhos, se houver) logo após o original.
  - **Excluir bloco**: botão de lixeira no elemento (remove recursivamente, inclusive de dentro de containers).
  - **Desfazer/Refazer**: botões de header ou histórico automático a cada mudança em `elements` (últimos 50 estados).
  - **Aplicar template**: abre "Templates" → clica em um card → confirma substituição de todos os elementos (reset de histórico).
  - **Gerar com IA (blocos)**: abre "Criar com IA" → modo Blocos → descreve a página → "Gerar página" → blocos populam o canvas, editáveis normalmente.
  - **Gerar com IA (Vibe Code)**: modo Vibe Code → descreve → "Gerar página" → visualiza HTML completo no iframe → pode "Iterar" (regenerar mantendo contexto), baixar o HTML ou abrir em nova aba (não é integrado como blocos do builder).
  - **Configurar SEO/Domínio/Scripts**: abre "Configurações" → navega pelas abas → preenche campos/envia uploads → "Salvar".
  - **Conectar domínio próprio**: aba Domínio → digita domínio → "Salvar" → copia os registros DNS (CNAME + TXT) para configurar no provedor (Cloudflare) → clica "Verificar" para checar status até ficar `isFullyActive`.
  - **Salvar página**: botão "Salvar" no header (ou nos modais) → `POST /api/presell/update` (se já tem nome) ou `/api/presell/save` (nova).
  - **Pré-visualizar**: botão "Preview" no header → abre `/presell/{slug}` em nova aba (renderizado por `PreSellPreview.tsx`/rota pública `/presell/:slug`, fora do escopo desta página mas consumindo os mesmos dados).

- **Regras de negócio visíveis no código**:
  - Acesso via `useFeatureAccess()`/`isFeatureBlocked("presell-builder")` — feature bloqueada para não-assinantes (mesma trava do dashboard).
  - Ao salvar, se a página **já tinha** um domínio customizado configurado (`originalCustomDomain`) e o usuário tenta deixar o campo de domínio vazio, o salvamento é bloqueado com toast "Domínio obrigatório" — é necessário informar um novo domínio para trocar, não é permitido simplesmente remover.
  - Upload de imagem de bloco: valida tipo (`image/jpeg|jpg|png|gif|webp|avif`) e tamanho máximo de 4MB no cliente antes de enviar.
  - Sessão expirada (401) em qualquer chamada força logout imediato (`window.location.href = '/login'`) com toast "Sessão expirada".
  - Página publicada sem domínio próprio permanece ativa apenas por 24 horas (aviso explícito na aba Domínio); com domínio próprio conectado, fica permanente, com SSL emitido automaticamente via Cloudflare assim que o DNS propagar.
  - Efeitos de botão (pulse/shake/bounce/glow) e delay de exibição (`buttonDelay`) são resolvidos em runtime via CSS/`<script>` gerados dinamicamente no HTML final publicado, não apenas no editor.
- **Integrações e chamadas de API**:
  - `GET /api/presell/get/:name` — carregar página para edição.
  - `POST /api/presell/save` — criar/duplicar página.
  - `POST /api/presell/update` — atualizar página existente.
  - `POST /api/presell/upload-image` — upload de imagem de bloco e de OG Image (multipart/form-data).
  - `POST /api/upload/favicon` — upload de favicon (multipart/form-data, `type=presell`).
  - `POST /api/landing/generate` — geração de página por IA em blocos editáveis (recebe `{ prompt }`, retorna `{ name, elements }`).
  - `POST /api/landing/vibe` — geração/iteração de página por IA como HTML completo ("Vibe Code", recebe `{ prompt, currentHtml? }`, retorna `{ html }`).
  - `GET /api/custom-domains/:domain/check` — verificação de status de propagação/SSL do domínio customizado (retorna status, ssl, dcvDelegation, ownershipVerification, txtRecords, isFullyActive, needsSync, message).
  - Serviço externo percebido: **Cloudflare** (proxy/SSL para domínios customizados, `proxy.lowfy.com.br` como alvo do CNAME); geração de conteúdo por IA (provedor não identificado no client, chamado via endpoints internos `/api/landing/*`).
- **Dados exibidos**: estrutura completa de `PreSellPage` — `name`, `slug`, `elements[]` (cada um com `id`, `type`, `content`, `children?`, `columnIndex?`, `styles` com dezenas de propriedades: alinhamento, fonte, cor, padding/margin em 4 lados, propriedades específicas de botão/vídeo/imagem/contador/container), `settings` (`backgroundColor`, `maxWidth`, `fontFamily`), `customDomain`, `scripts` (`head`/`body`/`footer`), `seo` (`title`, `description`, `favicon`, `ogImage`).

---

### Página: `/presell/preview` — Pré-visualização de Pre-Sell (janela de preview responsivo)

- **Arquivo fonte**: `client/src/pages/PreSellPreview.tsx` (186 linhas) — rota `/presell/preview` (App.tsx, componente `PreSellPreview`, registrada duas vezes no roteador — linhas 195 e 216 — provavelmente em dois grupos de rotas distintos, ex. autenticado/público).
- **Objetivo**: renderizar, em uma janela isolada com toolbar de viewport, o HTML final gerado a partir dos dados de uma página Pre-Sell (recebidos via `localStorage`/`sessionStorage`), permitindo alternar entre visualização Desktop, Tablet e Mobile antes de publicar. (Nota: este mecanismo é diferente do botão "Preview" do builder, que abre diretamente `/presell/{slug}` — a rota `/presell/preview?session={id}` parece ser um caminho alternativo de pré-visualização por sessão, não usado diretamente no fluxo atual do `PreSellBuilderSimple.tsx` lido, que sempre abre `/presell/{slug}`.)
- **Layout geral**: tela cheia (`h-screen flex flex-col`), toolbar horizontal fixa no topo, área de preview abaixo com `<iframe>` centralizado que muda de largura conforme o viewport selecionado.
- **Inventário completo de UI**:
  - **Toolbar** (topo, fundo branco, borda inferior): três botões de viewport — **Desktop** (`Monitor`, largura `w-full`), **Tablet** (`Tablet`, `w-[768px]`), **Mobile** (`Smartphone`, `w-[375px]`) — o botão ativo usa variante `default`, os demais `outline`.
  - **Área de preview**: `<iframe srcDoc={html}>` com sombra e cantos arredondados, exibindo o HTML gerado dinamicamente da página.
  - **Estado de carregamento**: enquanto `html` não está pronto, mostra spinner central (`animate-spin`) com texto "Carregando preview...".
  - Sem tabelas, gráficos, formulários ou modais nesta tela — é uma página utilitária somente de visualização.
- **Fluxos do usuário**:
  - Página é acessada com um parâmetro de query `?session={sessionId}`; se ausente, redireciona imediatamente para `/presell-builder`.
  - Busca os dados da página primeiro em `localStorage` (chave `presell-preview-{sessionId}`), com fallback para `sessionStorage`; se não encontrar em nenhum dos dois, redireciona para `/presell-builder`.
  - Ao carregar os dados com sucesso, gera o HTML completo via função interna `generateHTML(pageData)` e o exibe no iframe; após 1 segundo, remove os dados de `localStorage`/`sessionStorage` para evitar acúmulo.
  - Usuário pode alternar entre Desktop/Tablet/Mobile clicando nos botões da toolbar, redimensionando o iframe.
- **Regras de negócio visíveis no código**:
  - Dados de preview são efêmeros (expiram/são limpos automaticamente 1s após carregamento) e passados via storage do navegador (não via API), indicando comunicação entre abas/janelas (o builder provavelmente grava esses dados antes de abrir esta rota em alguns fluxos — não presente na versão atual lida do `PreSellBuilderSimple.tsx`).
  - Sem sessão válida ou dados salvos, sempre redireciona de volta ao builder — não há tela de erro dedicada.
- **Integrações e chamadas de API**: nenhuma chamada de rede — 100% client-side, lendo `localStorage`/`sessionStorage` e montando o HTML localmente (mesma lógica de geração de HTML de blocos vista em `PreSellBuilderSimple.tsx`, porém reimplementada aqui de forma mais simples e sem os scripts customizados de `head`/`body`/`footer` da página completa, exceto que também injeta `page.scripts?.head/body/footer` se presentes).
- **Dados exibidos**: mesmo formato de `elements[]` e `settings` de uma `PreSellPage` (headline, subheadline, video, text, button, image, divider, countdown — mesmos 8 tipos de bloco, sem suporte a `container` nesta função de geração local, diferente do builder que também suporta `container`), renderizados como HTML puro dentro do iframe.

---

## Catálogo: PLRs, Templates, Plugins, Serviços e Cursos

### Página: /plrs — PLRs Lowfy

- **Arquivo fonte**: `client/src/pages/PLRs.tsx` (889 linhas), com subcomponentes internos `PLRCard`, `PLRGrid` e `PLRSheet` definidos no mesmo arquivo. Rota: `/plrs` (registrada em `App.tsx` como `<Route path="/plrs" component={PLRs} />`).
- **Objetivo**: permitir que o usuário navegue, pesquise e filtre um catálogo de PLRs (produtos com direitos de revenda — e-books, VSLs, quizzes, landing pages, criativos, capas), veja detalhes de cada um e baixe os arquivos disponíveis por idioma/tipo.
- **Layout geral**: cabeçalho de página (título + subtítulo + botão de tour) → barra de filtros (busca + select de categoria) → contador de resultados → grid responsivo de cards (1/2/3 colunas conforme breakpoint) → paginação inferior → um `Sheet` (painel lateral direito) que abre com os detalhes do PLR selecionado → overlay de tour guiado.
- **Inventário completo de UI**:
  - Header: título "PLRs Lowfy", subtítulo "Baixe produtos com direitos de revenda", `TourButton` com label "Conhecer PLRs" (inicia tour guiado `plrsTour`).
  - Campo de busca (`Input`, placeholder "Buscar PLRs...", ícone de lupa) — atualiza `searchTerm` e reseta paginação.
  - `Select` de categoria (opções: "Todas" + todas as `categories` vindas da API) — atualiza `selectedCategory` e reseta paginação.
  - Texto informativo "Exibindo X-Y de Z PLRs" (só aparece quando não está carregando e há itens).
  - Estado de carregamento: grid de 6 `Card` com `Skeleton` (imagem 320px + linhas de texto simuladas).
  - Grid de cards (`PLRGrid`/`PLRCard`), cada card contendo:
    - Imagem de capa (`OptimizedImage`, proporção 3:4, com fallback de ícone `BookOpen` se não houver imagem ou der erro).
    - Badge de preço no canto superior esquerdo (gradiente amarelo/laranja) quando `!plr.isFree && plr.price`, formatado "R$ X,XX".
    - Fileira de bandeiras de idiomas disponíveis (componentes de `country-flag-icons`, mapeados por código de idioma → país; fallback textual com sigla se a bandeira não existir).
    - Badge de categoria (gradiente verde/primary).
    - Título do PLR (`line-clamp-2`).
    - Botão de curtir (ícone `Heart`, preenchido em vermelho quando curtido, com contador de curtidas ao lado; animação de pulso ao clicar).
    - Descrição (`line-clamp-3`).
    - Badges dos tipos de conteúdo disponíveis (VSL, Quiz, Página, Criativos, Capa, E-book — mapeados via `TYPE_LABELS`), deduplicados por tipo.
    - Bloco do criador: avatar (imagem ou iniciais), nome e profissão.
    - Botão "Ver Detalhes" (ícone `Eye`) que abre o `PLRSheet`.
    - Overlay de bloqueio (para usuários trial a partir do 4º card): fundo escuro com blur, ícone de cadeado, texto "Conteúdo Bloqueado" / "Assine para ter acesso ilimitado a todos os PLRs", botão "Assinar Agora" que redireciona para `/planos`.
  - Paginação: botões "Anterior" / números de página / "Próximo" (desabilitados nos extremos), só aparece se `totalPages > 1`.
  - `PLRSheet` (painel lateral, abre ao clicar em "Ver Detalhes"):
    - Cabeçalho: título do PLR, badge de categoria, contador de curtidas.
    - Imagem de capa grande (proporção 3:2) com fallback.
    - Bloco "Sobre este PLR" (fundo verde claro) com a descrição completa.
    - Seção "Downloads Disponíveis": `Accordion` agrupado por tipo de conteúdo (cada item do accordion mostra badge do tipo + contagem de idiomas); ao expandir, lista de downloads por idioma (bandeira, nome do idioma, botão "Baixar" com ícone `Download`). Se não houver downloads: texto "Nenhum download disponível".
    - Seção "Links Extras" (se existirem): lista de links externos com ícone, título e URL truncada, abrindo em nova aba.
    - Bloco do criador: avatar, nome, profissão.
    - Bloco de compra (se `!plr.isFree && plr.price`): preço formatado + botão "Comprar Agora".
  - `TourOverlay`: overlay de tour guiado com navegação (próximo/anterior/pular), posicionado conforme passos definidos em `plrsTour`.
  - Estados vazios/erro: não há estado vazio explícito de "nenhum PLR encontrado" nesta página (apenas o skeleton de carregamento e a lista vazia implícita).
- **Fluxos do usuário**:
  1. Buscar PLR: digita no campo de busca → lista refiltra via nova query à API → paginação reseta para página 1.
  2. Filtrar por categoria: seleciona categoria no dropdown → lista refiltra → paginação reseta.
  3. Curtir um PLR: clica no ícone de coração → atualização otimista do contador/estado de "curtido" → chamada `POST /api/plrs/:id/like` → em caso de erro, reverte estado.
  4. Ver detalhes e baixar: clica em "Ver Detalhes" → abre `Sheet` lateral → expande o accordion do tipo de conteúdo desejado → clica em "Baixar" no idioma desejado → para tipo "quiz", força download via link `<a download>`; para outros tipos, abre `fileUrl` em nova aba.
  5. Navegar entre páginas: clica nos botões de paginação numerada, "Anterior" ou "Próximo".
  6. Usuário trial tentando acessar PLR bloqueado (a partir do 4º item): vê overlay de cadeado → clica em "Assinar Agora" → é redirecionado para `/planos`.
  7. Tour guiado: clica em "Conhecer PLRs" → overlay percorre elementos-chave (bandeiras de idioma, tipos de conteúdo, botão de detalhes, seção de downloads), abrindo automaticamente o Sheet do primeiro PLR no passo correspondente.
- **Regras de negócio visíveis no código**:
  - `isTrial` é calculado como: usuário existe, não tem `accessPlan`, não é admin, e (`subscriptionStatus` é `trial`, `none` ou ausente).
  - Para usuários trial, apenas os 3 primeiros PLRs da listagem ficam desbloqueados (`isBlocked={isTrial && index >= 3}`); os demais mostram overlay de bloqueio com CTA para `/planos`.
  - `useFeatureAccess().isFeatureBlocked("plrs")` é computado (`featureBlocked`), mas não há bloqueio de página inteira aplicado neste componente (diferente de Templates/Plugins/Courses) — a variável é calculada mas não usada para renderizar um `FeatureLockedOverlay`.
  - Paginação é feita no servidor (`limit`/`offset`), 9 itens por página.
  - Preços são armazenados em centavos e exibidos divididos por 100.
- **Integrações e chamadas de API**:
  - `GET /api/categories` (cache permanente/`staleTime: Infinity`).
  - `GET /api/plr-tags` (cache permanente).
  - `GET /api/plrs?categoryId=&search=&limit=9&offset=` — listagem paginada, retorna `{ data, total }`.
  - `POST /api/plrs/:id/like` — curtir/descurtir, com atualização otimista via React Query e invalidação de `/api/plrs` e `/api/my-plrs`.
  - Sem integrações de IA externas nesta página.
- **Dados exibidos**: `PLRWithRelations` — `id`, `title`, `description`, `coverImageUrl`, `isFree`, `price`, `likeCount`, `hasLiked`, `category` (nome), `creator` (nome, profissão, foto de perfil), `downloads[]` (cada um com `id`, `type`, `fileUrl`, `language.code`, `language.name`), `extraLinks[]` (`title`, `url`); `Category` (`id`, `name`); `PLRTag`.

### Página: /templates — Páginas e Templates

- **Arquivo fonte**: `client/src/pages/Templates.tsx` (88 linhas). Rota: `/templates`.
- **Objetivo**: dar acesso a coleções de templates/kits Elementor prontos, hospedadas em pastas do Google Drive, para o usuário baixar e usar em seus projetos.
- **Layout geral**: página simples com título/subtítulo no topo e uma lista vertical de cards (uma coleção por linha), sem grid, sem filtros.
- **Inventário completo de UI**:
  - Título "Páginas e Templates" e subtítulo descritivo.
  - Lista de 2 cards fixos (dados hardcoded em `TEMPLATE_COLLECTIONS`, não vêm de API):
    - Card "+100 templates kits elementor (premium)" — descrição "Coleção premium de templates Elementor".
    - Card "+200 templates kits elementor (diversos)" — descrição "Coleção diversificada de templates Elementor".
  - Cada card: ícone `Folder`, nome, descrição, botão "Acessar" com ícone `ExternalLink`. O card inteiro também é clicável (mesma ação do botão).
  - Estado de bloqueio de feature: se `isFeatureBlocked("templates")`, a página inteira é substituída por `FeatureLockedOverlay` com título "Templates" e descrição "Acesse mais de 300 templates profissionais. Disponível para assinantes e compradores."
  - Não há busca, filtro, tabela, gráfico, modal ou estado de carregamento/erro (dados são estáticos, não há chamada de API).
- **Fluxos do usuário**:
  1. Usuário com acesso liberado: clica no card (ou no botão "Acessar") → abre em nova aba a URL do Google Drive correspondente à coleção.
  2. Usuário bloqueado por plano: vê apenas o `FeatureLockedOverlay` no lugar do conteúdo.
- **Regras de negócio visíveis no código**:
  - Gating total de página via `useFeatureAccess().isFeatureBlocked("templates")` — bloqueia toda a tela (não é gating por item como em PLRs).
  - As duas coleções apontam para a mesma URL de pasta do Google Drive (`https://drive.google.com/drive/folders/1a3bztWWiTVUmi0-I9RqeJXsqy-CIzR2k`).
- **Integrações e chamadas de API**: nenhuma chamada de API — dados hardcoded no componente. Integração externa: link direto para Google Drive.
- **Dados exibidos**: nenhum dado de banco; apenas o array estático `TEMPLATE_COLLECTIONS` (`id`, `name`, `description`, `url`).

### Página: /plugins — Plugins WordPress

- **Arquivo fonte**: `client/src/pages/Plugins.tsx` (296 linhas). Rota: `/plugins`.
- **Objetivo**: apresentar um catálogo de plugins premium de WordPress (com logo, categoria e descrição) para o usuário pesquisar e baixar via link único do Google Drive.
- **Layout geral**: título/subtítulo → campo de busca → contador de resultados → grid responsivo de cards (1/2/3 colunas) com logo, categoria, nome, descrição e botão de download; estado vazio dedicado quando a busca não encontra nada.
- **Inventário completo de UI**:
  - Título "Plugins WordPress", subtítulo "Acesse nossa coleção completa de plugins premium para WordPress".
  - Campo de busca (`Input`, placeholder "Pesquisar plugins...", ícone de lupa) — filtra por nome, descrição ou categoria (case-insensitive, client-side sobre `PLUGIN_DATABASE`).
  - Contador de resultados: "N plugin(s) encontrado(s)".
  - Catálogo de 17 plugins hardcoded em `PLUGIN_DATABASE` (não vem de API), cada um com `name`, `description`, `logo` (imagem local em `/plugin-logos/*.webp` ou ícone do repositório oficial `ps.w.org`), `category`, `downloadUrl` (mesmo link para todos): All-in-One WP Migration Unlimited Extension, Clonador de Páginas, Elementor Pro, Essential Addons for Elementor Pro, JetElements, JetEngine, JetSearch, JetSmartFilters, JetWooBuilder, OptinMonster, Presto Player Pro, Rank Math SEO Pro, Really Simple SSL Pro, Smush Pro, TranslatePress Multilingual, W3 Total Cache Pro, WP Mail SMTP Pro, WP Rocket.
  - Cada card: logo (com container maior/retangular só para plugins cujo id começa com "jet"; fallback para SVG de ícone genérico via `onError`), badge de categoria (ex.: "Migration", "Page Builder", "Elementor Addons", "Development", "Search", "Filters", "WooCommerce", "Marketing", "Media", "SEO", "Security", "Optimization", "Translation", "Performance", "Email"), nome, descrição (`line-clamp-3`), botão "Baixar Plugin" (ícones `Download` + `ExternalLink`). Card inteiro clicável (mesma ação do botão).
  - Estado vazio: `Card` central com ícone `Puzzle`, texto "Nenhum plugin encontrado" e mensagem contextual (com o termo buscado, se houver).
  - Estado de bloqueio de feature: se `isFeatureBlocked("plugins")`, página inteira vira `FeatureLockedOverlay` com título "Plugins WordPress" e descrição "Acesse mais de 20 plugins premium. Disponível para assinantes e compradores."
  - Não há estado de carregamento/skeleton (dados estáticos, sem fetch).
- **Fluxos do usuário**:
  1. Pesquisar plugin: digita termo → lista filtra em tempo real (client-side).
  2. Baixar plugin: clica no card ou no botão "Baixar Plugin" → abre em nova aba o link único do Google Drive (`PLUGINS_DOWNLOAD_URL`) — o mesmo link para qualquer plugin escolhido.
  3. Usuário bloqueado por plano: vê `FeatureLockedOverlay`.
- **Regras de negócio visíveis no código**:
  - Gating total de página via `useFeatureAccess().isFeatureBlocked("plugins")`.
  - Todos os 17 plugins direcionam para a mesma URL de download (não há arquivos individuais por plugin).
- **Integrações e chamadas de API**: nenhuma chamada de API — catálogo estático no código. Logos carregados de CDN oficial do WordPress.org (`ps.w.org`) ou de assets locais (`/plugin-logos/`). Download final aponta para Google Drive.
- **Dados exibidos**: nenhum dado de banco; apenas o objeto estático `PLUGIN_DATABASE`.

### Página: /services — White Label

- **Arquivo fonte**: `client/src/pages/Services.tsx` (65 linhas), usando o componente `client/src/components/ServiceCard.tsx`. Rota: `/services`.
- **Objetivo**: listar serviços "White Label" contratáveis (sistemas prontos para revenda com marca própria) que o usuário pode comprar com pontos/créditos.
- **Layout geral**: título/subtítulo no topo → grid de 3 colunas (desktop) com um card por serviço; sem filtros ou busca.
- **Inventário completo de UI**:
  - Título "White Label", subtítulo "Não perca tempo criando ou desenvolvendo do zero um sistema, compre pontos e use sua marca muito mais barato e venda como Seu".
  - Estado de erro: `Card` central com texto "Erro ao carregar serviços. Tente novamente." (cor destrutiva) quando a query falha.
  - Estado de carregamento: grid de 3 `Card` com skeleton animado (ícone, preço, título, descrição, 3 linhas de benefícios, botão) via `animate-pulse`.
  - Estado vazio (`services.length === 0`): `Card` central com ícone `Briefcase`, título "White Label em breve", texto "Estamos preparando soluções de White Label exclusivas para você. Aguarde!".
  - Grid de `ServiceCard` (um por serviço retornado pela API). Cada `ServiceCard` contém:
    - Badge "Mais Popular" (se `service.isPopular`), posicionado no topo do card, com borda destacada no card inteiro.
    - Imagem do serviço (se `imageUrl` existir), altura fixa, `object-cover`.
    - Ícone contextual (`Users` se nome contém "consultoria", `Shield` se "mentoria", `Briefcase` se "coaching", padrão `Briefcase`).
    - Preço formatado "R$ X,XX" (a partir de `priceCents`).
    - Nome do serviço.
    - Descrição.
    - Lista de benefícios (`benefits[]`), cada item com ícone de check verde.
    - Botão "Contratar Serviço" — o handler `handlePurchase` está vazio (sem ação implementada no código).
- **Fluxos do usuário**:
  1. Usuário visualiza a lista de serviços disponíveis (carregamento automático ao entrar na página).
  2. Clica em "Contratar Serviço" — atualmente não dispara nenhuma ação (função vazia no código-fonte).
- **Regras de negócio visíveis no código**:
  - Não há checagem de `useFeatureAccess`/gating de plano nesta página (diferente de PLRs/Templates/Plugins/Courses).
  - Preços armazenados em centavos (`priceCents`) e exibidos divididos por 100.
  - Estado vazio explícito informando que o catálogo ainda não tem serviços publicados ("em breve").
- **Integrações e chamadas de API**:
  - `GET /api/services` — lista de serviços via React Query.
  - Nenhuma outra integração externa perceptível (o botão de compra não chama nenhum endpoint).
- **Dados exibidos**: `Service` — `id`, `name`, `description`, `priceCents`, `imageUrl`, `isPopular`, `benefits[]`.

### Página: /courses — Cursos Online Especializados

- **Arquivo fonte**: `client/src/pages/Courses.tsx` (277 linhas). Rota: `/courses`.
- **Objetivo**: permitir que o usuário pesquise e filtre por categoria um catálogo de cursos em vídeo (Marketing Digital, Low Ticket, Afiliados, IA, YouTube, TikTok etc.) e acesse o conteúdo, hospedado em uma pasta compartilhada do Google Drive.
- **Layout geral**: título/subtítulo (com SEO/schema markup) → linha de filtros (busca + select de categoria) → contador de resultados → lista vertical em formato de tabela/linha (um `Card` contendo linhas divididas por `divide-y`, cada linha é um curso) → botão "Carregar Mais Cursos" (paginação client-side incremental).
- **Inventário completo de UI**:
  - `SEO` component com título/descrição/canonical de `seoConfig.cursos`, e um `<script type="application/ld+json">` com schema `BreadcrumbList` (Lowfy → Cursos Online).
  - Título "Cursos Online Especializados", subtítulo descrevendo mais de 380 cursos.
  - Campo de busca (`Input`, placeholder "Pesquisar cursos...", ícone de lupa) — filtra por `title`/`description`.
  - `Select` de categoria com opção "Todas as Categorias" + 9 categorias fixas: Low Ticket, Afiliados, Mentorias e Formações, Conteúdos dos Membros, Desenvolvimento Pessoal, Inteligência Artificial, iGaming, YouTube, TikTok.
  - Contador de resultados: "Carregando..." durante fetch, ou "N curso(s) encontrado(s)".
  - Estado de carregamento: spinner central (`Loader2` girando).
  - Lista de cursos (dentro de um único `Card`, linhas separadas por divisor): cada linha mostra ícone `Folder`, título do curso, descrição (`line-clamp-1`, se houver), badge de categoria (oculto em telas pequenas), botão "Acessar" com ícone `ExternalLink` (texto do botão oculto em telas médias/pequenas, só ícone). Linha inteira é clicável.
  - Botão "Carregar Mais Cursos" — exibido quando há mais cursos do que os atualmente exibidos (paginação client-side de 25 em 25, via `displayedItems`).
  - Estado vazio: `Card` central com ícone `Folder`, "Nenhum curso encontrado" e mensagem contextual (com termo de busca, se houver).
  - Estado de bloqueio de feature: se `isFeatureBlocked("cursos")`, página inteira vira `FeatureLockedOverlay` com título "Cursos Online" e descrição "Acesse mais de 380 cursos de alta qualidade. Disponível para assinantes e compradores."
- **Fluxos do usuário**:
  1. Pesquisar curso: digita no campo → lista filtra client-side por título/descrição.
  2. Filtrar por categoria: seleciona categoria no dropdown → lista filtra client-side.
  3. Ver mais cursos: clica em "Carregar Mais Cursos" → incrementa `displayedItems` em 25, revelando mais itens da lista já carregada (sem nova chamada de API).
  4. Acessar curso: clica na linha do curso ou no botão "Acessar" → abre em nova aba a mesma pasta do Google Drive (`https://drive.google.com/drive/folders/123aQZBYZQUypRggZl1cYrm3hmRLGn0YP`) para qualquer curso clicado.
  5. Usuário bloqueado por plano: vê `FeatureLockedOverlay`.
- **Regras de negócio visíveis no código**:
  - Gating total de página via `useFeatureAccess().isFeatureBlocked("cursos")`.
  - Todos os cursos, independentemente de qual for clicado, abrem a mesma pasta única do Google Drive (não há link individual por curso, apesar do schema ter campos `courseUrl`/`driveFolderUrl`/`driveFolderId`).
  - Lista é ordenada alfabeticamente pelo título (`localeCompare`) antes de exibir.
  - Paginação de exibição é 100% client-side (25 itens por "página"/carregamento), a busca inicial traz todos os cursos de uma vez via API.
- **Integrações e chamadas de API**:
  - `GET /api/courses` — lista completa de cursos sincronizados no banco (cache de 10 min, sem refetch ao focar janela).
  - Link externo fixo para Google Drive como destino de acesso.
- **Dados exibidos**: `Course` — `id`, `title`, `description`, `category`, `duration`, `lessonCount`, `thumbnailUrl`, `courseUrl`, `driveFolderId`, `driveFolderUrl`, `sourceType`, `isActive`, `isNew`, `isPopular`, `createdAt`, `updatedAt` (apenas `title`, `description`, `category` são efetivamente renderizados na UI; os demais campos existem na interface TypeScript mas não aparecem visualmente).

---

## Marketplace — Comprar

### Página: /marketplace — Marketplace (redirecionador)

- **Arquivo fonte**: `client/src/pages/Marketplace.tsx` — rota `/marketplace` (registrada em `App.tsx` linha 259, componente `Marketplace`).
- **Objetivo**: Não é uma tela de conteúdo; existe apenas para redirecionar automaticamente qualquer acesso a `/marketplace` para `/marketplace/vitrine`.
- **Layout geral**: Tela cheia centralizada com um spinner de carregamento e o texto "Redirecionando...". O componente `export default function Marketplace()` executa `window.location.href = "/marketplace/vitrine"` no corpo da função (fora de um `useEffect`) e em seguida renderiza o spinner — na prática o navegador troca de URL quase instantaneamente.
- **Inventário completo de UI**:
  - Spinner circular animado (`div` com `animate-spin`, borda inferior preta).
  - Texto estático "Redirecionando..." em cinza.
  - Não há botões, formulários, tabelas ou outros elementos interativos nesta tela (o redirecionamento é imediato).
- **Fluxos do usuário**: Usuário acessa `/marketplace` → é redirecionado automaticamente para `/marketplace/vitrine` (a Vitrine real).
- **Regras de negócio visíveis no código**: Nenhuma — é puro redirecionamento client-side via `window.location.href`.
- **Integrações e chamadas de API**: Nenhuma chamada de API é feita por este componente.
- **Dados exibidos**: Nenhum dado de banco é exibido.
- **Observação sobre código morto no arquivo**: O arquivo `Marketplace.tsx` (1412 linhas) contém, além do componente `Marketplace` (linhas 141–153) que é o `export default` efetivamente roteado, quatro funções adicionais não exportadas e não referenciadas em nenhuma rota do `App.tsx`:
  - `VitrineSection()` (linhas 157–341) — uma versão de grid de produtos com busca e filtro de categoria, card com imagem/categoria/rating/vendedor/preço/botão "Comprar".
  - `MeusProdutosSection()` (linhas 345–745) — CRUD completo de produtos do vendedor: tabela (colunas Produto, Categoria, Preço, Vendas, Status, Ações), dialog de criação/edição de produto (campos: título, descrição, preço, categoria, URL do produto, upload de imagens via `ImageUpload`, links externos de imagem, switch "Produto Ativo"), menu de ações (Editar, Ativar/Desativar) via `DropdownMenu`.
  - `ComprasSection()` (linhas 749–1010) — grid de cards de compras do usuário com badge de status (Pendente/Concluído/Reembolsado/Reembolso Solicitado), Sheet lateral de detalhes do pedido com botão "Acessar Produto", botão "Solicitar Reembolso" (regra: só disponível até 7 dias da compra, via função `canRefund`).
  - `FinanceiroSection()` (linhas 1014–1412) — painel financeiro do vendedor com 4 cards de estatísticas (Saldo Bloqueado 8 dias, Saldo Disponível, Total Ganho, Total Sacado), botões "Configurar/Atualizar PIX" e "Solicitar Saque", tabela de transações com abas (Vendas/Reembolsos/Saques), dialogs de configuração de chave PIX (tipos: CPF, CNPJ, E-mail, Telefone, Chave Aleatória) e de solicitação de saque (valor mínimo R$ 10,00, validação contra saldo disponível).
  Essas quatro seções funcionalmente equivalem (e provavelmente foram a origem histórica de) às páginas hoje separadas em `client/src/pages/marketplace/Vitrine.tsx`, `MeusProdutos.tsx`, `Compras.tsx` e `Financeiro.tsx`, roteadas individualmente em `/marketplace/vitrine`, `/marketplace/meus-produtos`, `/marketplace/compras` e `/marketplace/financeiro`. Como não são importadas/renderizadas por nenhum componente ativo, essas seções não fazem parte da experiência real do usuário hoje — documentei-as apenas porque estão fisicamente no arquivo solicitado.

---

### Página: /marketplace/vitrine — Vitrine

- **Arquivo fonte**: `client/src/pages/marketplace/Vitrine.tsx` — rota `/marketplace/vitrine` (`App.tsx` linha 260).
- **Objetivo**: Permitir ao usuário navegar, buscar e filtrar produtos digitais/serviços do marketplace, visualizar um preview rápido e adicionar ao carrinho ou comprar diretamente.
- **Layout geral**: Página de largura máxima `max-w-7xl` com cabeçalho ("Vitrine" + subtítulo), barra de busca + filtro de categoria lado a lado, grid responsivo de cards de produto (1/2/3 colunas conforme breakpoint), scroll infinito via `IntersectionObserver`, e um modal (Dialog) de "quick view" do produto.
- **Inventário completo de UI**:
  - Campo de busca "Buscar produtos..." com ícone de lupa (`input-search-products`).
  - Select "Todas Categorias" com ícone de filtro (`select-category-filter`), opções: Todas Categorias, Produtos Digitais, Serviços, Templates, Cursos, Ferramentas, E-books, Plugins, Outros.
  - Grid de cards de produto, cada um com: imagem (ou placeholder `Package` se sem imagem), badge de categoria no canto superior direito, botão flutuante "quick view" (ícone `Eye`, aparece no hover) que abre o modal sem navegar, título (line-clamp-2), descrição (line-clamp-2), avatar do vendedor (foto ou iniciais) + nome + área de atuação, preço formatado em R$, botão "Adicionar" (ícone carrinho, texto muda para "Adicionando..." durante a mutation).
  - Clique no card (fora dos botões) navega para `/marketplace/produto/:slugOuId`.
  - Estado de carregamento: spinner central "Carregando produtos...".
  - Estado vazio: ícone `ShoppingBag`, título "Nenhum produto encontrado", mensagem varia se há filtro ativo ("Tente ajustar os filtros de busca") ou não ("Seja o primeiro a vender um produto!").
  - Scroll infinito: gatilho invisível (`load-more-trigger`) observado por `IntersectionObserver`; enquanto carrega mostra "Carregando mais produtos..." com spinner; ao final mostra "Você viu todos os N produtos disponíveis". Paginação client-side de 15 em 15 itens (`ITEMS_PER_PAGE = 15`).
  - **Modal Quick View** (Dialog): título do produto, imagem grande, badge de categoria, descrição completa, separador, bloco de vendedor (avatar/ícone `User`, nome, área de atuação), separador, preço grande, três botões: "Comprar Agora" (`button-modal-buy-now` — adiciona ao carrinho e navega para `/checkout`), "Adicionar ao Carrinho" (`button-modal-add-to-cart` — adiciona e fecha modal), "Ver detalhes completos" (`button-modal-view-details` — navega para a página do produto).
- **Fluxos do usuário**:
  - Buscar/filtrar: digita no campo de busca ou seleciona categoria → grid recarrega (debounce implícito via query key) e contador de paginação reseta para 15.
  - Comprar direto do card: clica "Adicionar" → mutation `POST /api/marketplace/cart` → toast de sucesso, evento de tracking `trackAdAddToCart`.
  - Quick view: clica no ícone de olho → abre modal → pode comprar agora, adicionar ao carrinho ou ver detalhes completos.
  - Navegar para produto: clica no card (fora dos botões) → dispara `trackAdViewItem` e navega para `/marketplace/produto/:id` (usa `slug` se existir, senão `id`).
  - Scroll infinito: rola até o fim da lista visível → carrega mais 15 produtos automaticamente.
- **Regras de negócio visíveis no código**: Nenhuma checagem de plano/assinatura nesta tela; qualquer usuário pode navegar e adicionar ao carrinho.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/products` (com query params `category` e `search`) — carrega lista de produtos com vendedor embutido.
  - `POST /api/marketplace/cart` (mutation `addToCartMutation`) — adiciona produto ao carrinho, `productId` + `quantity: 1`.
  - Tracking: `trackAdAddToCart`, `trackAdViewItem` (hook `useGoogleAnalytics`, Google Ads).
- **Dados exibidos**: `product.id`, `title`, `description`, `price` (centavos), `category`, `images[]`, `slug`; `seller.name`, `seller.profileImageUrl`, `seller.areaAtuacao`.

---

### Página: /marketplace/produto/:id — Detalhes do Produto (ProductDetails)

- **Arquivo fonte**: `client/src/pages/ProductDetails.tsx` — rota `/marketplace/produto/:id` (`App.tsx` linha 265).
- **Objetivo**: Exibir a ficha completa de um produto (galeria, descrição, avaliações) e permitir comprar/adicionar ao carrinho, além de deixar uma avaliação.
- **Layout geral**: Botão "Voltar ao Marketplace" no topo, grid de 3 colunas em telas grandes (2 colunas para informações do produto + 1 coluna de sidebar de compra sticky), seção de avaliações abaixo em largura total, modal de imagem em tela cheia.
- **Inventário completo de UI**:
  - `SEO` component com título, descrição, OG tags e URL canônica dinâmicos; schema.org de produto injetado via hook `useProductSchema` (nome, descrição, imagem, preço, moeda BRL, rating, contagem de reviews, disponibilidade `InStock`/`OutOfStock`, vendedor).
  - Botão "Voltar ao Marketplace" (`button-back`, ícone seta esquerda) — link para `/marketplace`.
  - **Galeria de imagens**: imagem principal (`product-main-image`) clicável (abre modal de imagem em tela cheia); setas de navegação prev/next (`button-prev-image`/`button-next-image`) aparecem no hover se houver mais de uma imagem; tira de miniaturas (`image-thumbnails`, `thumbnail-{index}`) clicáveis para trocar a imagem principal. Imagens são filtradas por validação de URL (`validImages`).
  - Título do produto (`product-title`), badge de categoria, preço (`product-price`).
  - Estrelas de rating (0–5, calculadas a partir de `product.rating/10`) + contagem de avaliações — só aparece se `product.rating > 0`.
  - Descrição completa do produto (`product-description`, com fallback "Sem descrição disponível").
  - **Sidebar "Comprar Produto"** (sticky): bloco de preço destacado, botão "Comprar Agora" (`button-buy-now`, adiciona ao carrinho e vai para `/checkout`), botão "Adicionar ao Carrinho" (`button-add-to-cart`), bloco "Vendedor" com avatar (imagem ou iniciais), nome (`seller-name`) e profissão/área de atuação, data de publicação (ícone calendário), texto "Entrega Digital Instantânea" (ícone pacote), seção "Formas de Pagamento" (`payment-methods-section`) listando Cartão de Crédito e PIX (cada com check verde), seção "Garantia" (`warranty-section`) listando "7 dias para reembolso", "Suporte do vendedor", "Acesso vitalício ao produto".
  - **Seção de Avaliações**: título "Avaliações (N)" com ícone `MessageSquare`; formulário "Deixe sua avaliação" com seleção de 1–5 estrelas interativas (hover destaca, clique seleciona — `star-{1..5}`), textarea de comentário (`input-review-text`), botão "Enviar Avaliação" (`button-submit-review`, desabilitado sem nota ou texto); lista de reviews existentes, cada uma com avatar genérico, nome fixo "Usuário", data, estrelas e comentário; estado vazio "Nenhuma avaliação ainda. Seja o primeiro a avaliar!".
  - **Modal de imagem em tela cheia** (Dialog): imagem grande sobre fundo preto, setas prev/next, contador "X / N" no rodapé.
  - Estados de carregamento (spinner "Carregando produto...") e "Produto não encontrado" (com botão para voltar ao marketplace).
- **Fluxos do usuário**:
  - Ver produto: abre a página, navega pela galeria de imagens (miniaturas, setas, clique para abrir modal).
  - Comprar: clica "Comprar Agora" → adiciona ao carrinho → redireciona para `/checkout`.
  - Adicionar ao carrinho: clica "Adicionar ao Carrinho" → mutation, toast de sucesso, permanece na página.
  - Avaliar: seleciona estrelas, escreve comentário, envia → `POST` de review → toast, campos limpos, lista de reviews e produto (para atualizar rating agregado) são invalidados/recarregados.
- **Regras de negócio visíveis no código**: Filtro de imagens inválidas (`validImages`) — remove entradas vazias, `undefined`/`null` como string, ou não-URLs que não comecem com `/`. Rating exibido como `product.rating / 10` (escala de 0–100 armazenada, exibida em 0–5 estrelas).
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/products/:productId` — dados do produto e vendedor.
  - `GET /api/marketplace/products/:productId/reviews` — lista de avaliações.
  - `POST /api/marketplace/products/:productId/review` — envia avaliação (`rating` 1–5, `comment`).
  - `POST /api/marketplace/cart` — adicionar ao carrinho.
  - Hook `useProductSchema` para dados estruturados SEO; componente `SEO` para meta tags.
- **Dados exibidos**: `product.title`, `description`, `price`, `category`, `images[]`, `rating`, `reviewCount`, `createdAt`, `stock`; `seller.name`, `profileImageUrl`, `areaAtuacao`/`profession`; `ProductReview.rating`, `comment`, `createdAt`.

---

### Página: /marketplace/cart — Carrinho de Compras (Cart)

- **Arquivo fonte**: `client/src/pages/marketplace/Cart.tsx` — rota `/marketplace/cart` (`App.tsx` linha 264).
- **Objetivo**: Revisar os itens adicionados ao carrinho, ajustar quantidades, remover itens e avançar para o checkout.
- **Layout geral**: Cabeçalho "Carrinho de Compras" com contagem de produtos; grid de 3 colunas (2 colunas de lista de itens + 1 coluna de resumo do pedido sticky). Estados dedicados para carregando e carrinho vazio.
- **Inventário completo de UI**:
  - Estado de carregamento: spinner "Carregando carrinho...".
  - Estado vazio: ícone `ShoppingCart`, "Seu carrinho está vazio", texto explicativo, botão "Ir para Vitrine" (`button-go-to-vitrine`) → `/marketplace/vitrine`.
  - **Lista de itens** (`cart-item-{productId}`): imagem do produto (ou placeholder), título, descrição (line-clamp-2, oculta em mobile), "Vendido por {seller.name}", preço total do item (`text-price-{productId}`), controles de quantidade: botão diminuir (`button-decrease-{productId}`, desabilitado se quantidade ≤ 1), display da quantidade (`text-quantity-{productId}`), botão aumentar (`button-increase-{productId}`, desabilitado se quantidade ≥ 99), botão remover (`button-remove-{productId}`, ícone lixeira).
  - **Resumo do Pedido** (sidebar sticky): linha "Total" destacada (`text-total`), botão "Finalizar Compra" (`button-checkout`, ícone seta) → navega para `/checkout`, botão "Continuar Comprando" (`button-continue-shopping`) → `/marketplace/vitrine`.
- **Fluxos do usuário**:
  - Ajustar quantidade: clica +/- → mutation `PUT /api/marketplace/cart/:productId` atualiza quantidade (limite 1–99) → recalcula total.
  - Remover item: clica lixeira → mutation `DELETE /api/marketplace/cart/:productId` → toast "Removido".
  - Finalizar compra: clica "Finalizar Compra" → vai para `/checkout`.
  - Ao sair da página com itens no carrinho (fechar aba/navegar para fora): evento `beforeunload` dispara `trackAdAbandonedCheckout` com valor total.
- **Regras de negócio visíveis no código**: Somente itens de produtos ativos aparecem (o backend já filtra via inner join, conforme comentário no código: "Since backend filters inactive products with innerJoin, cartItems only contains valid products"). Não há taxa de plataforma para o comprador (`total = subtotal`, comentário "No platform fee for buyers"). Quantidade limitada entre 1 e 99.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/cart` — lista de itens do carrinho com produto e vendedor.
  - `PUT /api/marketplace/cart/:productId` — atualizar quantidade.
  - `DELETE /api/marketplace/cart/:productId` — remover item.
  - Tracking: `trackAdAbandonedCheckout` (Google Ads, hook `useGoogleAnalytics`).
- **Dados exibidos**: `CartItemWithProduct`: `product.title`, `description`, `images[]`, `price`; `quantity`; `seller.name`.

---

### Página: /checkout — Checkout (pagamento)

- **Arquivo fonte**: `client/src/pages/Checkout.tsx` — rota `/checkout`, servida através do wrapper `CheckoutRouter` (`App.tsx` linha 219, definido nas linhas 147–166) que redireciona para checkout de assinatura se aplicável, ou renderiza `Checkout` (checkout do marketplace) por padrão.
- **Objetivo**: Coletar os dados de pagamento (cartão de crédito ou PIX) para finalizar a compra dos itens do carrinho.
- **Layout geral**: Header minimalista com botão "Voltar" e selo "Pagamento seguro"; timer regressivo de 15 minutos centralizado; grid de 5 colunas (3 colunas de formulário de pagamento com abas Cartão/PIX + 2 colunas de resumo do pedido sticky).
- **Inventário completo de UI**:
  - Botão "Voltar" (`button-back-to-cart`) → `/marketplace/cart`.
  - Indicador "Pagamento seguro" com ícone de cadeado.
  - Timer "Finalize em MM:SS" (`timeLeft` inicia em 900s = 15 min, fica vermelho abaixo de 2 minutos).
  - **Abas de pagamento** (`Tabs`): "Cartão" (`tab-credit-card`) e "PIX" (`tab-pix`, ícone SVG PIX customizado).
  - **Aba Cartão**:
    - Campo "Número do Cartão" (`input-card-number`, máscara de 4 em 4 dígitos, até 16 dígitos) com logo de bandeira detectada automaticamente (Visa, Mastercard, Amex, renderizados via SVG inline conforme prefixo do número) ou ícone genérico de cartão.
    - Campo "Nome no Cartão" (`input-card-name`, forçado a maiúsculas).
    - Campo "Validade" (`input-card-expiry`, formato MM/AA, máscara automática).
    - Campo "CVV" (`input-card-cvv`, até 4 dígitos).
    - Select "Parcelas" (`select-installments`) — de 1x a 10x, calculado localmente: 1x–3x sem juros, 4x–6x com 1,99% a.m., 7x–10x com 2,49% a.m. (juros compostos), cada opção mostra valor da parcela e se tem juros.
    - Botão "Pagar {valor}" (`button-pay-card`) — texto muda conforme parcelas e exibe "Processando pagamento..." durante o envio.
  - **Aba PIX**: painel com ícone PIX, "Pagamento via PIX", "Aprovação instantânea", valor total em destaque, botão "Gerar QR Code PIX" (`button-pay-pix`, mostra "Gerando QR Code..." durante processamento).
  - Selo de rodapé "Pagamento seguro" / "Dados protegidos".
  - **Resumo do pedido** (sidebar): lista de itens (`summary-item-{productId}`) com miniatura, título, quantidade, preço; Subtotal; linha de "Juros (X% a.m.)" (`text-card-interest`, só aparece se parcela selecionada tem juros); Total final; bloco "Garantia de 7 dias".
- **Fluxos do usuário**:
  - Ao carregar: se carrinho vazio, redireciona automaticamente para `/marketplace/cart`; dispara `trackMarketplaceCheckoutStart` (Meta Pixel) se há itens.
  - Pagar com cartão: preenche número/nome/validade/CVV, escolhe parcelas, clica "Pagar" → validações client-side (campos obrigatórios, formato MM/AA, mês 1–12) → se usuário não tem CPF cadastrado, mostra toast e redireciona para `/profile` → senão envia `POST /api/marketplace/checkout` com `paymentMethod: "card"` e dados do cartão/parcelas/cookies Meta (`fbc`/`fbp`) → se resposta `status === 'paid'`, dispara `trackMarketplacePurchase` e vai para `/marketplace/order/success`; se `status === 'pending'`, salva dados em `sessionStorage` e vai para `/marketplace/checkout/awaiting-confirmation`.
  - Pagar com PIX: clica "Gerar QR Code PIX" → mesma validação de CPF → `POST /api/marketplace/checkout` com `paymentMethod: "pix"` → salva resposta em `sessionStorage('pixPaymentData')` e navega para `/marketplace/checkout/pix`.
  - Erro no pagamento: toast de erro, mensagem salva em `sessionStorage('paymentError')`; se erro indica carrinho inválido/vazio, redireciona para `/marketplace/cart`; senão redireciona para `/marketplace/order/failure`.
- **Regras de negócio visíveis no código**: CPF obrigatório no perfil do usuário antes de pagar (qualquer método). Detecção de bandeira do cartão por prefixo (regex: `4` = Visa, `5[1-5]` = Mastercard, `3[47]` = Amex). Cálculo de parcelamento com juros compostos definido em tabela fixa no frontend (1–3x sem juros, 4–6x 1,99% a.m., 7–10x 2,49% a.m.). Total sem taxa adicional de plataforma para o comprador. Apenas produtos ativos (`item.product.isActive`) entram no cálculo do total.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/cart` — itens do carrinho.
  - `GET /api/auth/user` — dados do usuário logado (para checar CPF).
  - `POST /api/marketplace/checkout` — processa pagamento (cartão ou PIX); resposta inclui `paymentMethod`, `status`, `orderId`, e para PIX inclui dados de QR code repassados para a próxima tela.
  - Serviço de pagamento subjacente não é chamado diretamente do frontend, mas o fluxo (cartão pendente aguardando "webhook do Asaas", tela de espera renomeada como "aguardando confirmação do Asaas") indica gateway **Asaas** no backend.
  - Tracking: `trackMarketplaceCheckoutStart`, `trackMarketplacePurchase`, `trackAddPaymentInfo` (Meta Pixel, via cookies `_fbc`/`_fbp` de Event Match Quality).
- **Dados exibidos**: itens do carrinho (`product.title`, `images`, `price`, `quantity`), CPF do usuário (`currentUser.cpf`, só usado para validação, não exibido em campo), totais calculados.

---

### Página: /marketplace/checkout/pix/:transactionId? — Aguardando pagamento PIX (CheckoutPix)

- **Arquivo fonte**: `client/src/pages/CheckoutPix.tsx` — rota `/marketplace/checkout/pix/:transactionId?` (`App.tsx` linha 220, parâmetro opcional).
- **Objetivo**: Exibir o QR Code PIX gerado para o pedido e aguardar a confirmação do pagamento em tempo real (polling + WebSocket), redirecionando automaticamente para a página de sucesso quando confirmado.
- **Layout geral**: Layout estreito (`max-w-lg`) centralizado, mobile-first e compacto; header fixo com botão voltar; timer; card único contendo ícone, indicador de "tempo real", valor, QR code, código copia-e-cola, instruções passo a passo.
- **Inventário completo de UI**:
  - Botão "Voltar" (`button-back-to-cart`) → `/marketplace/cart`.
  - Timer "Tempo: MM:SS" (`timeLeft` inicia em 1800s = 30 min; fica vermelho abaixo de 5 minutos); ao chegar a zero, mostra toast "QR Code expirado" e redireciona para o carrinho.
  - Ícone PIX (SVG customizado) em círculo azul, título "Pagamento via PIX", subtítulo "Escaneie o QR Code".
  - **Indicador de tempo real** (`realtime-indicator`): badge verde pulsante "Aguardando pagamento • Atualização em tempo real".
  - Bloco de valor a pagar formatado em R$.
  - **QR Code** (`qrcode-pix`): renderizado via `QRCodeSVG` (biblioteca `qrcode.react`) a partir do payload `pixData.qrCode`; enquanto não disponível, mostra placeholder cinza com spinner.
  - Legenda "Escaneie com o app do banco".
  - **Código PIX copia-e-cola**: bloco de texto monoespaçado com o código completo, botão "Copiar"/"Copiado!" (`button-copy-pix`, usa `navigator.clipboard`, feedback visual por 2s).
  - **Instruções "Como pagar"**: lista numerada (Abra o app do banco → Escolha pagar com PIX → Escaneie o QR Code → Confirme o pagamento) + linha "✓ Confirmação automática".
  - Estado inicial: spinner de carregamento em tela cheia ("Carregando...") enquanto os dados do PIX não são recuperados do `sessionStorage`.
- **Fluxos do usuário**:
  - Ao entrar, recupera `pixPaymentData` do `sessionStorage`; se ausente ou incompleto, redireciona para o carrinho com toast de erro.
  - Atualiza a URL para incluir o `transactionId` via `window.history.replaceState` (sem navegação real).
  - **Polling**: a cada 3 segundos (até 600 tentativas / 30 min), chama `GET /api/marketplace/payment-status/:transactionId`; se status é `paid`/`approved`/`completed`/`active`, invalida caches de compras/carrinho, dispara `trackMarketplacePurchase`, mostra toast "Pagamento confirmado!", limpa `sessionStorage` e navega para `/marketplace/order/success`; se status é `refused`/`cancelled`/`refunded`, mostra toast de recusa e volta ao carrinho; erros 401/404/403 tratados com toasts específicos e redirecionamentos (login expirado → `/`, pedido não encontrado/sem permissão → carrinho).
  - **WebSocket** (via `useSocket`/`SocketContext`): escuta eventos `payment_confirmed` e `payment_refused` para o mesmo `transactionId`, com o mesmo efeito do polling — reação instantânea sem esperar o próximo ciclo de 3s.
  - Copiar código: clica "Copiar" → copia string do PIX para a área de transferência, toast de confirmação.
- **Regras de negócio visíveis no código**: Prazo do QR Code de 30 minutos, expirado redireciona ao carrinho. Confirmação usa dupla via (polling REST + WebSocket) para reduzir latência de detecção.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/payment-status/:transactionId` — checagem de status do pagamento (com header `Authorization: Bearer` se houver token em `localStorage`).
  - WebSocket via `SocketContext` (eventos `payment_confirmed`, `payment_refused`).
  - Tracking: `trackMarketplacePurchase`, `trackCompleteRegistration` (Meta Pixel).
  - Biblioteca `qrcode.react` para renderizar o QR Code a partir do payload `qrCode` (provavelmente BR Code/Pix Copia-e-Cola gerado pelo gateway **Asaas** no backend).
- **Dados exibidos**: `pixData.qrCode` (payload PIX), `pixData.totalAmount`, `pixData.transactionId`, `pixData.orderId`, `pixData.productName`.

---

### Página: /marketplace/checkout/awaiting-confirmation — Aguardando confirmação de cartão (CheckoutAwaitingConfirmation)

- **Arquivo fonte**: `client/src/pages/marketplace/CheckoutAwaitingConfirmation.tsx` — rota `/marketplace/checkout/awaiting-confirmation` (`App.tsx` linha 221).
- **Objetivo**: Tela intermediária exibida quando o pagamento por cartão foi enviado ao gateway mas ainda está `pending`, aguardando confirmação assíncrona (webhook), com polling de status até aprovação ou rejeição.
- **Layout geral**: Tela cheia centralizada, largura `max-w-md`, com dois estados visuais alternativos: "aguardando" (padrão) e "pagamento rejeitado" (`paymentFailed`).
- **Inventário completo de UI**:
  - **Estado aguardando** (padrão):
    - Ícone `Clock` grande girando (amarelo).
    - Título "Confirmando Pagamento", texto "Seu pagamento foi enviado para processamento. Estamos aguardando a confirmação do Asaas...".
    - Caixa azul de aviso: "Por favor, NÃO feche esta página" / "A confirmação pode levar até 2 minutos. Você receberá um email quando o pagamento for confirmado."
    - Bloco cinza "Tempo decorrido" com cronômetro crescente MM:SS.
    - Botão "Ir para Minhas Compras" (verde, ícone check) → `/marketplace/compras`.
    - Botão "Continuar Comprando" (outline) → `/marketplace`.
    - Rodapé com o `transactionId` exibido (ou "N/A").
  - **Estado rejeitado** (`paymentFailed = true`):
    - Ícone `X` vermelho grande.
    - Título "Pagamento Rejeitado", texto explicativo.
    - Caixa vermelha "Motivo da rejeição": "Verifique com seu banco se o cartão está bloqueado para compras online ou se há saldo disponível."
    - Botão "Voltar e Tentar Novamente" (azul) → `/marketplace/cart`.
    - Botão "Continuar Comprando" (outline) → `/marketplace`.
- **Fluxos do usuário**: Ao carregar, recupera `transactionId` de `sessionStorage('cardPaymentData')`; a cada 5 segundos (e imediatamente ao montar) chama `GET /api/marketplace/payment-status/:transactionId`; se `status === 'CONFIRMED'/'confirmed'`, marca `sessionStorage('payment_success', 'true')` e navega para `/marketplace/order/success`; se `status === 'FAILED'/'failed'/'REJECTED'`, alterna a tela para o estado de rejeição (sem redirecionamento automático, usuário decide a ação).
- **Regras de negócio visíveis no código**: Confirmação de cartão depende de webhook assíncrono do gateway (mencionado explicitamente como **Asaas** no texto da tela); enquanto isso, a tela faz polling client-side a cada 5s sem limite de tentativas explícito no código (loop indefinido enquanto o componente estiver montado).
- **Integrações e chamadas de API**: `GET /api/marketplace/payment-status/:transactionId` (sem tratamento de erro de rede visível além de `console.error`).
- **Dados exibidos**: `transactionId` recuperado do `sessionStorage`.

---

### Página: /marketplace/order/success — Pedido Concluído (OrderSuccess)

- **Arquivo fonte**: `client/src/pages/marketplace/OrderSuccess.tsx` — rota `/marketplace/order/success` (`App.tsx` linha 225).
- **Objetivo**: Confirmar visualmente ao comprador que a compra foi concluída com sucesso e orientar os próximos passos.
- **Layout geral**: Tela cheia centralizada com fundo em gradiente verde/esmeralda, card único (`max-w-2xl`) sem borda com sombra.
- **Inventário completo de UI**:
  - Ícone de sucesso: círculo verde claro com `CheckCircle`.
  - Título "Compra Realizada!", subtítulo "Seu pagamento foi processado com sucesso. Você já pode acessar seus produtos."
  - Bloco cinza "Detalhes do Pedido": número do pedido gerado no client (`#ORD-{timestamp}`), data atual formatada em pt-BR, badge de status "Pago" (verde).
  - Bloco azul "Próximos Passos": lista com 3 itens marcados com check verde — "Um e-mail de confirmação foi enviado para você", "Acesse seus produtos na área 'Minhas Compras'", "Você tem 7 dias de garantia para solicitar reembolso".
  - Botão "Ver Meus Produtos" (`button-view-purchases`, verde, ícone download) → `/marketplace/compras`.
  - Botão "Continuar Comprando" (`button-continue-shopping`, outline) → `/marketplace/vitrine`.
  - Rodapé "Precisa de ajuda? Entre em contato com o suporte" (`link-support`) → `/support`.
- **Fluxos do usuário**: Ao montar, limpa `sessionStorage` de dados de PIX/sucesso, invalida caches de compras/carrinho para refletir a compra imediatamente, dispara eventos de tracking de conversão, e apresenta as opções de navegação ao usuário (ver compras ou continuar comprando).
- **Regras de negócio visíveis no código**: O número do pedido exibido (`#ORD-{Date.now()...}`) e a data são gerados no client apenas para exibição — não vêm de uma consulta ao pedido real; não há busca de detalhes reais do pedido nesta tela.
- **Integrações e chamadas de API**: Nenhuma chamada de leitura de dados; apenas invalidação de cache (`queryClient.invalidateQueries` para `/api/marketplace/my-purchases` e `/api/marketplace/cart`) e tracking: `trackCustomEvent('MarketplacePurchaseComplete')`, `trackCompleteRegistration` (Meta Pixel), `trackPurchase`, `trackAdConversion` (Google Analytics/Ads).
- **Dados exibidos**: Nenhum dado real de banco — todos os "detalhes do pedido" mostrados são placeholders gerados no client (número de pedido fictício, data atual, status fixo "Pago").

---

### Página: /marketplace/order/failure — Pedido com Falha (OrderFailure)

- **Arquivo fonte**: `client/src/pages/marketplace/OrderFailure.tsx` — rota `/marketplace/order/failure` (`App.tsx` linha 226).
- **Objetivo**: Informar ao comprador que o pagamento falhou, mostrar o motivo (quando disponível) e oferecer caminhos para tentar novamente.
- **Layout geral**: Tela cheia centralizada com fundo em gradiente vermelho/laranja, card único (`max-w-2xl`).
- **Inventário completo de UI**:
  - Ícone de falha (varia conforme `failureReason`, mas no código o estado é sempre inicializado como `"unknown"` e nunca alterado — portanto sempre exibe o ícone/mensagem de `unknown`: `XCircle` vermelho).
  - Tabela de mensagens possíveis por motivo (`FAILURE_MESSAGES`), definidas mas só a variante `unknown` é usada na prática:
    - `card_declined`: "Cartão Recusado" / "Seu cartão foi recusado pela operadora..."
    - `insufficient_funds`: "Saldo Insuficiente" / "Não há saldo disponível no cartão..."
    - `pix_expired`: "PIX Expirado" / "O código PIX expirou..."
    - `unknown`: "Erro no Pagamento" / "Ocorreu um erro ao processar seu pagamento..."
  - Título e descrição dinâmicos (usa `errorMessage` do `sessionStorage('paymentError')` se presente, senão a descrição padrão do motivo).
  - **Alert vermelho** "Detalhes do erro" — só aparece se houver `errorMessage` salvo (mensagem literal do backend).
  - **Alert azul** "Problemas comuns e soluções": lista com 4 dicas (dados do cartão corretos, saldo disponível, tentar outro cartão, contatar o banco).
  - Bloco cinza "Detalhes da Tentativa": data/hora atual formatada, badge "Falhou" (vermelho), motivo (título da mensagem).
  - Botão "Tentar Novamente" (`button-try-again`, preto) → `/checkout`.
  - Botão "Voltar ao Carrinho" (`button-back-to-cart`, outline) → `/marketplace/cart`.
  - Bloco verde "Experimente o PIX! Pagamento instantâneo".
  - Rodapé "Continua com problemas? Fale com nosso suporte" (`link-support`) → `/support`.
- **Fluxos do usuário**: Ao montar, lê `sessionStorage('paymentError')` (mensagem de erro específica vinda do fluxo de checkout) e a exibe, removendo-a do storage em seguida; também lê `sessionStorage('cartTotal')` para disparar tracking de checkout abandonado. Usuário pode tentar novamente (volta ao checkout) ou voltar ao carrinho.
- **Regras de negócio visíveis no código**: `failureReason` é um `useState` inicializado como `"unknown"` e nunca reatribuído no código — logo, mesmo que a infraestrutura de mensagens específicas (`card_declined`, `insufficient_funds`, `pix_expired`) exista, a tela sempre usa a mensagem genérica "Erro no Pagamento", complementada pela mensagem de erro real vinda do backend quando disponível.
- **Integrações e chamadas de API**: Nenhuma chamada de API nesta tela; apenas leitura de `sessionStorage` e tracking `trackAdAbandonedCheckout` (Google Analytics/Ads).
- **Dados exibidos**: Mensagem de erro textual vinda do backend (armazenada em `sessionStorage.paymentError` pela tela de Checkout), data/hora da tentativa gerada no client.

---

### Página: /marketplace/politicas — Políticas do Marketplace (MarketplacePolicies)

- **Arquivo fonte**: `client/src/pages/marketplace/Politicas.tsx` — rota `/marketplace/politicas` (`App.tsx` linha 222, componente exportado como `MarketplacePolicies`).
- **Objetivo**: Página estática informativa que expõe as regras do marketplace para vendedores e compradores (produtos proibidos/permitidos, direitos e responsabilidades, consequências de violações, canal de denúncia).
- **Layout geral**: Página de conteúdo (`max-w-4xl`) com botão de voltar, cabeçalho com ícone e título, seguida de uma pilha vertical de `Card`s temáticos, cada um com cor de destaque própria (vermelho para proibições, verde para permissões, âmbar para consequências, azul/neutro para as demais).
- **Inventário completo de UI**:
  - Botão "Voltar ao Marketplace" (`button-back`) → `/marketplace`.
  - Cabeçalho: ícone `ShieldCheck`, título "Políticas do Marketplace" (`page-title`), subtítulo "Regras e diretrizes para vendedores e compradores".
  - **Card "Sobre o Marketplace"**: texto introdutório único.
  - **Card "Produtos Proibidos"** (borda/fundo vermelho): grade de 11 itens, cada um com ícone `XCircle`, título e descrição curta: Armas e Munições; Drogas e Substâncias Ilícitas; Conteúdo Adulto; Conteúdo Pirata; Dados Pessoais; Malware e Vírus; Produtos Falsificados; Conteúdo de Ódio; Jogos de Azar Ilegais; Fraudes e Golpes.
  - **Card "Produtos Permitidos"** (borda/fundo verde): grade de 6 itens com ícone `CheckCircle`: Plugins e Extensões; Templates e Temas; Cursos e E-books; Software e SaaS; Design e Gráficos; Scripts e Código.
  - **Card "Direitos e Responsabilidades"**: duas listas — "Para Vendedores" (4 itens: não violar direitos autorais, descrições precisas, suporte básico, manter produtos atualizados) e "Para Compradores" (3 itens: reembolso em até 7 dias se produto não funcionar como descrito, proibição de redistribuir/revender, respeitar termos de licença do vendedor).
  - **Card "Consequências de Violações"** (borda/fundo âmbar): 3 linhas com badges de severidade — "1ª Violação" (âmbar) → advertência e bloqueio temporário do produto; "2ª Violação" (laranja) → bloqueio permanente do produto e suspensão temporária da conta; "3ª Violação" (`destructive`, vermelho) → banimento permanente. Nota de rodapé: violações graves (armas, drogas, conteúdo ilegal) resultam em banimento imediato sem aviso prévio.
  - **Card "Denúncias e Contato"**: e-mail `suporte@lowfy.com.br` (link `mailto:`), instrução de assunto ([Denúncia] ou [Dúvida sobre políticas]), aviso de prazo de análise de até 48 horas úteis.
  - Rodapé de texto: "Última atualização: Novembro de 2025" e "Ao utilizar o marketplace, você concorda com estas políticas."
- **Fluxos do usuário**: Página somente leitura — usuário rola o conteúdo, pode voltar ao marketplace ou clicar no link de e-mail para denunciar/tirar dúvidas.
- **Regras de negócio visíveis no código**: Conteúdo é 100% estático (hardcoded no componente), não há busca a nenhuma API; as regras de reembolso de 7 dias e a progressão de penalidades (advertência → suspensão → banimento) são as mesmas mencionadas em outras telas do marketplace (Compras, OrderSuccess).
- **Integrações e chamadas de API**: Nenhuma.
- **Dados exibidos**: Nenhum dado dinâmico de banco — texto estático institucional.

---

## Marketplace — Vender

### Página: /marketplace/meus-produtos — Meus Produtos (Painel do Vendedor)

- **Arquivo fonte**: `client/src/pages/marketplace/MeusProdutos.tsx` — rota `/marketplace/meus-produtos` (registrada em `client/src/App.tsx`, linha 261, componente `MarketplaceMeusProdutos`, carregado via `lazy()`).
- **Objetivo**: Permite que o usuário vendedor cadastre, edite, ative/desative os produtos digitais que ele coloca à venda no marketplace da plataforma.
- **Layout geral**: Página de largura máxima `max-w-7xl`, sem sidebar interna. Header simples com título "Meus Produtos", subtítulo e botão de ação no canto superior direito. Corpo é uma única `Card` contendo uma tabela de produtos, com paginação abaixo. Não há abas. O cadastro/edição de produto acontece em um `Dialog` modal (não em página separada), aberto pelo botão "Novo Produto" ou pela ação "Editar" de cada linha.
- **Inventário completo de UI**:
  - **Header**: título "Meus Produtos", texto "Gerencie seus produtos à venda", botão **"Novo Produto"** (ícone `Plus`, `data-testid="button-create-product"`) que abre o dialog de criação.
  - **Estado de carregamento**: spinner circular centralizado (`animate-spin`) enquanto `isLoading` é `true`.
  - **Estado vazio**: quando não há produtos — ícone `Package` grande, título "Nenhum produto cadastrado", texto "Comece a vender criando seu primeiro produto", botão **"Criar Primeiro Produto"** (`data-testid="button-create-first-product"`).
  - **Tabela de produtos** (dentro de `Card`), colunas:
    - **Produto**: miniatura 12x12 (imagem da primeira foto do array `images`, ou ícone `Package` em placeholder cinza se não houver imagem) + título do produto como link para `/marketplace/produto/{slug ou id}`.
    - **Categoria**: label traduzido da categoria (via array `CATEGORIES`) ou "-" se vazio.
    - **Preço**: valor formatado em BRL (`Intl.NumberFormat`, convertido de centavos).
    - **Vendas**: contador `salesCount` (ou 0).
    - **Status**: badge — "Bloqueado" (variante destrutiva vermelha, quando `isBlocked` é true), ou "Ativo"/"Inativo" (badge default/secondary conforme `isActive`).
    - **Ações**: dropdown menu (ícone `MoreVertical`) com:
      - **Editar** (ícone `Pencil`) — abre dialog preenchido com os dados do produto.
      - Separador.
      - **Ativar/Desativar** (ícone `Power`/`PowerOff`, texto colorido verde/laranja) — alterna `isActive` via mutation.
  - **Paginação**: texto "Mostrando X a Y de Z produtos" + componente `TablePagination` (15 itens por página, `ITEMS_PER_PAGE = 15`).
  - **Dialog "Novo Produto" / "Editar Produto"** (título muda conforme modo), descrição "Preencha os dados do produto. Campos obrigatórios estão marcados com *.". Campos do formulário:
    - **Título*** (`Input` texto, obrigatório).
    - **Descrição** (`Textarea`, 4 linhas, opcional).
    - **Preço (R$)*** (`Input` numérico, step 0.01, min 0, obrigatório).
    - **Categoria** (`Select` com opções: Produtos Digitais, Serviços, Templates, Cursos, Ferramentas, E-books, Plugins, Outros — valores `digital`, `service`, `template`, `course`, `tool`, `ebook`, `plugin`, `other`).
    - **URL do Produto*** (`Input` tipo url, obrigatório) — com texto de ajuda "Link onde o comprador acessará o produto após a compra".
    - **Imagens do Produto**: componente `ImageUpload` (upload local, `maxImages={10}`, `maxSizeMB={5}`, `maxSizePerImageMB={2}`, desabilitado durante o envio).
    - **Links Externos (opcional)**: `Textarea` de 2 linhas para URLs separadas por vírgula (ex.: links do Google Drive) — texto de ajuda "Use links externos para imagens maiores que 5MB. Separe múltiplas URLs por vírgula."
    - **Produto Ativo**: `Switch` + label, controla `isActive`.
    - Rodapé do dialog: botão **Cancelar** (fecha e limpa o formulário) e botão **Salvar** (texto muda para "Salvando..." durante o envio, desabilitado enquanto `productMutation.isPending`).
- **Fluxos do usuário**:
  - **Criar produto**: clica em "Novo Produto" → dialog abre vazio → preenche título, preço e URL (obrigatórios), opcionalmente descrição, categoria, imagens (upload ou links externos) e status ativo → clica "Salvar" → `POST /api/marketplace/products` → toast "Produto criado!" → dialog fecha, lista é invalidada/recarregada.
  - **Editar produto**: clica no menu de ações de uma linha → "Editar" → dialog abre pré-preenchido (o código separa imagens internas — que começam com `/uploads/`, `/objects/` ou não são URL http — das imagens externas, que são URLs http completas fora desses paths) → altera campos → "Salvar" → `PUT /api/marketplace/products/{id}` → toast "Produto atualizado!".
  - **Ativar/Desativar produto**: menu de ações → "Ativar"/"Desativar" → `PUT /api/marketplace/products/{id}` com `{ isActive }` → toast de confirmação, lista e o feed público do marketplace são invalidados.
  - Validação client-side: se título, preço ou URL do produto estiverem vazios ao submeter, exibe toast "Campos obrigatórios" e bloqueia o envio.
- **Regras de negócio visíveis no código**:
  - Preço digitado em reais é convertido para centavos (`Math.round(parseFloat(price) * 100)`) antes de enviar à API.
  - Imagens finais enviadas ao backend combinam array de uploads (`images`) + URLs externas digitadas (separadas por vírgula, trimadas e filtradas de valores vazios).
  - Produto com `isBlocked = true` exibe badge "Bloqueado" e sobrepõe o badge normal de Ativo/Inativo (sugere moderação/aprovação administrativa, embora a ação de bloquear não esteja nesta tela).
  - Sem indicação de limite de quantidade de produtos por vendedor no código desta página.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/my-products` — lista os produtos do vendedor logado (query key `["/api/marketplace/my-products"]`).
  - `POST /api/marketplace/products` — cria produto novo.
  - `PUT /api/marketplace/products/{id}` — atualiza produto (usado tanto para edição completa quanto para o toggle de `isActive`).
  - Ao salvar/alternar status, invalida também `["/api/marketplace/products"]` (feed público do marketplace).
  - Upload de imagens é feito pelo componente `ImageUpload` (não inspecionado em profundidade — é peça de `components/ui`).
- **Dados exibidos**: `id`, `title`, `description`, `price` (centavos), `category`, `productUrl`, `images[]`, `isActive`, `isBlocked`, `salesCount`, `slug` — campos do produto do marketplace (`InsertMarketplaceProduct` / entidade de produto).

---

### Página: /marketplace/compras — Minhas Compras

- **Arquivo fonte**: `client/src/pages/marketplace/Compras.tsx` — rota `/marketplace/compras` (`App.tsx` linha 262, componente `MarketplaceCompras`).
- **Objetivo**: Permite ao usuário (como comprador) visualizar o histórico de compras feitas no marketplace, ver detalhes de cada pedido, acessar o produto adquirido e solicitar reembolso dentro do prazo.
- **Layout geral**: Header com título/subtítulo e um alternador de modo de visualização (Cards / Tabela) no canto superior direito. Corpo principal alterna entre grid de cards (padrão) e uma tabela, conforme `viewMode`. Detalhes do pedido abrem em um painel lateral (`Sheet`) deslizante pela direita. Solicitação de reembolso abre em `Dialog` modal separado, disparado a partir do Sheet.
- **Inventário completo de UI**:
  - **Header**: título "Minhas Compras", subtítulo "Acompanhe seus pedidos e produtos adquiridos".
  - **Alternador de visualização**: dois botões toggle — **"Cards"** (ícone `LayoutGrid`) e **"Tabela"** (ícone `List`), destaca o modo ativo com variante `default`.
  - **Estado de carregamento**: skeleton com barras pulsantes (`animate-pulse`).
  - **Estado vazio**: ícone `Package`, título "Nenhuma compra encontrada", texto "Você ainda não realizou nenhuma compra.", botão **"Explorar Marketplace"** (link para `/marketplace`).
  - **Modo Cards** (grid responsivo 1/2/3 colunas): para cada compra, um `Card` com:
    - Imagem do produto (topo, altura 40, com placeholder `Package` se não houver imagem) e badge de status sobreposto no canto superior direito.
    - Título do produto (link para página do produto).
    - Valor pago (formatado em BRL) e data da compra (ícone `Calendar`).
    - Botão **"Ver Detalhes"** (ícone `Eye`) que abre o Sheet lateral.
  - **Modo Tabela**: tabela dentro de `Card`, colunas: **Data**, **Produto** (miniatura + link), **Valor**, **Status** (badge), **Vendedor** (ícone `User` + nome), **Ações** (botão "Ver" com ícone `Eye`; botão **"Acessar"** com ícone `ExternalLink`, exibido somente se `productUrl` existir e status for `completed`).
  - **Badges de status** (função `getStatusBadge`): Pendente (secondary), Concluído (default), Reembolsado (destructive), Reembolso Solicitado (outline).
  - **Sheet "Detalhes da Compra"** (lateral, scroll interno):
    - Seção **Produto**: imagem (ou placeholder), título (link), descrição.
    - Seção **Vendedor** (se disponível): avatar (ou ícone `User` placeholder), nome do vendedor.
    - Seção **Informações do Pedido**: Valor Pago, Data da Compra (data+hora), Forma de Pagamento (ícone `Banknote`, rótulos: PIX, Cartão de Crédito, Boleto, PicPay, ou "Não informado"), Status (badge).
    - Área de ações condicionais:
      - Botão **"Acessar Produto"** (ícone `ExternalLink`) — se `productUrl` existir e status `completed`, abre em nova aba.
      - Botão **"Solicitar Reembolso"** (ícone `AlertCircle`) — visível se `canRefund` (compra com até 7 dias) e status não é `refunded`/`refund_requested`; abre o dialog de reembolso.
      - Aviso "O prazo para solicitar reembolso (7 dias) expirou." — se prazo expirado e status `completed`.
      - Aviso azul "Seu reembolso está sendo processado." — se status `refund_requested`.
      - Aviso verde "Reembolso concluído." — se status `refunded`.
  - **Dialog "Solicitar Reembolso"**:
    - Descrição: "Por favor, descreva detalhadamente o motivo do reembolso."
    - Campo **Motivo do Reembolso*** (`Textarea`, `min-h-[150px]`, placeholder detalhado pedindo descrição do problema).
    - Contador de caracteres "X/180 caracteres" (mínimo obrigatório de 180 caracteres).
    - Botões: **Cancelar** e **Solicitar Reembolso** (desabilitado enquanto pendente ou até atingir 180 caracteres; texto muda para "Enviando...").
- **Fluxos do usuário**:
  - **Ver detalhes de uma compra**: clica em "Ver Detalhes"/"Ver" (card ou tabela) → Sheet lateral abre com dados completos do pedido, produto e vendedor.
  - **Acessar produto comprado**: no Sheet ou na tabela, clica em "Acessar Produto"/"Acessar" (só aparece se pedido `completed` e produto tiver `productUrl`) → abre link em nova aba.
  - **Solicitar reembolso**: dentro do Sheet, clica "Solicitar Reembolso" (só visível se dentro do prazo de 7 dias e sem reembolso já solicitado/concluído) → dialog abre → digita motivo com no mínimo 180 caracteres → clica "Solicitar Reembolso" → `POST /api/marketplace/request-refund/{orderId}` com `{ refundReason }` → toast "Reembolso solicitado!" → dialog e sheet fecham, lista de compras é recarregada.
  - **Alternar visualização**: clica "Cards" ou "Tabela" para trocar o layout da listagem.
- **Regras de negócio visíveis no código**:
  - Reembolso só pode ser solicitado até 7 dias após a data do pedido (`canRefund`: `orderDate >= hoje - 7 dias`).
  - Justificativa do reembolso deve ter no mínimo 180 caracteres (validado tanto no botão desabilitado quanto ao submeter, com toast de erro "Justificativa incompleta").
  - Acesso ao produto (botão/link "Acessar Produto") só é liberado quando o status do pedido é `completed`.
  - Reembolso não pode ser solicitado novamente se o status já é `refunded` ou `refund_requested`.
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/my-purchases` — lista as compras do usuário logado (retorna objetos com `order`, `product`, `seller`, `paymentMethod`).
  - `POST /api/marketplace/request-refund/{orderId}` — envia solicitação de reembolso com `{ refundReason }`; invalida `["/api/marketplace/my-purchases"]` no sucesso.
- **Dados exibidos**: `order.id`, `order.amount`, `order.status` (`pending`/`completed`/`refunded`/`refund_requested`), `order.createdAt`, `order.paymentMethod` (`pix`/`credit_card`/`boleto`/`picpay`); `product.title`, `product.description`, `product.images[]`, `product.productUrl`, `product.slug`/`id`; `seller.name`, `seller.profileImageUrl`.

---

### Página: /marketplace/financeiro — Financeiro (Painel do Vendedor)

- **Arquivo fonte**: `client/src/pages/marketplace/Financeiro.tsx` — rota `/marketplace/financeiro` (`App.tsx` linha 263, componente `MarketplaceFinanceiro`).
- **Objetivo**: Central financeira do vendedor — consultar saldo (bloqueado/disponível), configurar chave PIX, solicitar saques, acompanhar vendas, reembolsos, histórico de saques e relatórios agregados.
- **Layout geral**: Header simples ("Financeiro" / "Gerencie seus ganhos e saques") seguido por um componente `Tabs` com 6 abas horizontais (`grid grid-cols-6` em telas maiores, ícone + label, label escondido em telas pequenas). Não há sidebar interna nem wizard — navegação é só por abas. Dois `Dialog`s globais (Configurar PIX e Solicitar Saque) compartilhados entre as abas.
- **Inventário completo de UI**:
  - **Abas** (`TabsList`): **Visão Geral** (`BarChart3`), **Taxas** (`Receipt`), **Vendas** (`TrendingUp`), **Reembolsos** (`RefreshCw`), **Recebimento** (`Settings`), **Relatórios** (`FileText`). Cada `data-testid="tab-<nome>"`.

  - **Aba Visão Geral**:
    - 4 cards de estatística (grid 1/2/4 colunas):
      1. **Saldo Bloqueado (8 dias)** — valor em BRL, ícone `Clock` amarelo, nota "Liberado em até 8 dias após venda" (`data-testid="balance-pending"`).
      2. **Saldo Disponível para Saque** — valor em verde, ícone `Wallet` verde, nota "Pronto para saque via PIX" (`data-testid="balance-available"`).
      3. **Total Ganho** — valor total, ícone `TrendingUp` azul.
      4. **Total Sacado** — valor total, ícone `ArrowUpRight` roxo.
    - Card **"Ações Rápidas"**:
      - Botão **"Configurar PIX"/"Atualizar PIX"** (ícone `CreditCard`) — abre dialog de PIX, pré-preenchido se já configurado.
      - Botão **"Solicitar Saque"** (ícone `DollarSign`) — abre dialog de saque; desabilitado se não houver chave PIX configurada ou saldo disponível < R$ 10,00 (1000 centavos).
      - Indicador verde "PIX configurado: {tipo} - {chave}" (ícone `CheckCircle`), exibido somente se `wallet.pixKey` existir.

  - **Aba Taxas**:
    - Card "Informações de Taxas" com texto explicativo.
    - Dois blocos lado a lado: **PIX** (ícone colorido customizado) — "R$ 2,49 + 2,99%" por venda; **Cartão de Crédito** (ícone `CreditCard`) — "R$ 2,49 + 6,99%" por venda.
    - Bloco "Exemplo de Cálculo": venda de R$100 via PIX gera taxa de R$5,48 (recebe R$94,52); via cartão gera taxa de R$9,48 (recebe R$90,52).
    - Bloco "Saldo Bloqueado": explica retenção de 8 dias para proteção contra reembolsos.

  - **Aba Vendas**:
    - Card "Histórico de Vendas".
    - Filtro por período: botões toggle **Hoje**, **Últimos 7 dias**, **Últimos 30 dias**, **Período personalizado** (ícone `Filter`).
    - Quando "Período personalizado" selecionado: dois seletores de data (`Popover` + `Calendar`) — **Data inicial** e **Data final** (data final não pode ser anterior à inicial).
    - Tabela de vendas, colunas: **Data**, **Descrição** (remove prefixo "Venda do produto:" da descrição), **Valor** (bruto), **Taxas** (em vermelho, com "-"), **Status** (badge: Aguardando/Concluído/Recusado/Reembolsado/Cancelado/Reembolso Solicitado).
    - Paginação (15 itens/página) com texto "Mostrando X a Y de Z vendas".
    - Estado vazio: "Nenhuma venda encontrada neste período".

  - **Aba Reembolsos**:
    - Card "Solicitações de Reembolso".
    - Tabela: **Data**, **Descrição** ("Reembolso automático" se vazio), **Valor** (vermelho, com "-"), **Status** (badge).
    - Paginação (15 itens/página).
    - Estado vazio: "Nenhum reembolso encontrado".
    - Bloco explicativo: "Sobre os Reembolsos" — compradores têm até 7 dias para solicitar; valor é descontado automaticamente do saldo do vendedor.

  - **Aba Recebimento**:
    - Seção "Chave PIX": se configurada, mostra bloco verde com tipo e chave + botão **"Atualizar Chave PIX"**; se não configurada, botão **"Configurar Chave PIX"**.
    - Seção "Regras de Saque" (texto): valor mínimo R$10,00; taxa de saque R$2,49 (descontada do valor solicitado); processamento imediato; sem limite diário.
    - Seção "Histórico de Saques": tabela com colunas **Data**, **Valor** (vermelho, "-"), **Status** (badge: Pendente/Concluído/Falhou); paginação (15/página); estado vazio "Nenhum saque realizado".

  - **Aba Relatórios**:
    - 3 mini-cards: **Total de Vendas** (contagem), **Total de Reembolsos** (contagem, vermelho), **Total de Saques** (contagem, roxo).
    - "Filtrar Relatórios": mesmo conjunto de botões de período (Hoje/7 dias/30 dias/Personalizado) com seletores de data customizados, independente do filtro da aba Vendas (mesmo estado `dateFilter` é compartilhado entre as abas Vendas e Relatórios).
    - "Resumo Financeiro": linhas — Receita Total (Vendas) em verde, Reembolsos Totais em vermelho, Saques Realizados em roxo, e **Saldo Líquido** (destacado, soma vendas − reembolsos − saques).

  - **Dialog "Configurar PIX"**:
    - Campo **Tipo de Chave** (`Select`: CPF, CNPJ, E-mail, Telefone, Chave Aleatória).
    - Campo **Chave PIX** (`Input` texto, obrigatório).
    - Botões: Cancelar / **Salvar** (texto "Salvando..." durante envio).

  - **Dialog "Solicitar Saque"**:
    - Descrição: mínimo R$10,00, taxa de R$2,49 descontada.
    - Campo **Valor (R$)** (`Input` numérico, min 10, step 0.01) + texto "Saldo disponível: {valor}".
    - Bloco de simulação (aparece ao digitar valor válido ≥10): Valor solicitado, Taxa de saque (-R$2,49), **Você receberá** (valor líquido, em verde).
    - Botões: Cancelar / **Solicitar Saque** (texto "Processando..." durante envio).

- **Fluxos do usuário**:
  - **Configurar chave PIX**: clica "Configurar PIX" (Visão Geral ou aba Recebimento) → dialog abre (vazio ou pré-preenchido) → seleciona tipo de chave e digita a chave → "Salvar" → `PUT /api/marketplace/pix-config` → toast "PIX configurado!" → dialog fecha, saldo/wallet recarregados.
  - **Solicitar saque**: clica "Solicitar Saque" (desabilitado sem PIX configurado ou saldo < R$10) → dialog abre → digita valor → vê simulação da taxa e valor líquido → confirma → validações client-side (valor mínimo R$10, saldo suficiente, PIX configurado) → `POST /api/marketplace/request-withdrawal` com `{ amountCents }` → toast "Saque solicitado!" → wallet, saldo, transações e saques são recarregados.
  - **Consultar vendas por período**: na aba Vendas, escolhe um filtro de período (ou datas customizadas) → tabela filtra as transações do tipo `sale` dentro do intervalo.
  - **Consultar reembolsos/saques**: navega às respectivas abas para ver o histórico paginado.
  - **Ver relatório consolidado**: aba Relatórios exibe contadores e resumo financeiro agregando os mesmos dados filtrados por período.
- **Regras de negócio visíveis no código**:
  - Saldo de cada venda fica **bloqueado por 8 dias** antes de ficar disponível para saque (proteção contra reembolsos).
  - Taxas da plataforma: **PIX** R$2,49 + 2,99% por venda; **Cartão de Crédito** R$2,49 + 6,99% por venda.
  - Taxa de saque: **R$2,49 fixo**, descontada do valor solicitado.
  - Valor mínimo de saque: **R$10,00** (1000 centavos); abaixo disso, toast de erro "Valor mínimo".
  - Não é possível solicitar saque maior que o saldo disponível (toast "Saldo insuficiente").
  - Não é possível solicitar saque sem chave PIX configurada (toast "Configure sua chave PIX").
  - Botão "Solicitar Saque" na Visão Geral fica desabilitado se não houver PIX configurado OU saldo disponível < R$10,00.
  - Reembolsos automáticos descontam do saldo disponível ou bloqueado do vendedor (texto informativo na aba Reembolsos).
- **Integrações e chamadas de API**:
  - `GET /api/marketplace/wallet` — dados da carteira do vendedor (`SellerWallet`: saldo pendente, disponível, total ganho, total sacado, chave PIX).
  - `GET /api/marketplace/available-balance` — saldo disponível/pendente recalculado em tempo real + chave PIX.
  - `GET /api/marketplace/transactions` — lista de transações (`SellerTransaction[]`: vendas, reembolsos, saques).
  - `GET /api/marketplace/withdrawals` — lista de saques.
  - `PUT /api/marketplace/pix-config` — salva/atualiza chave PIX (`{ pixKey, pixKeyType }`).
  - `POST /api/marketplace/request-withdrawal` — solicita saque (`{ amountCents }`).
  - Nenhuma integração de terceiros percebida diretamente no código desta página (processamento de pagamento/PIX real fica no backend).
- **Dados exibidos**: `wallet.balancePending`, `wallet.balanceAvailable`, `wallet.totalEarned`, `wallet.totalWithdrawn`, `wallet.pixKey`, `wallet.pixKeyType`; `SellerTransaction` (`id`, `type`: sale/refund/withdrawal, `amount`, `grossAmountCents`, `systemFeeCents`, `status`, `description`, `createdAt`); lista de `withdrawals`.

---

## Assinatura e Automações N8N

### Página: /assinatura — Minha Assinatura (Subscription)

- **Arquivo fonte**: `client/src/pages/Subscription.tsx` · **Rota**: `/assinatura` (registrada em `client/src/App.tsx`, dentro do `Layout`/`ProtectedContent`, portanto exige usuário autenticado).
- **Objetivo**: central onde o usuário logado visualiza os detalhes da sua assinatura atual (plano, status, cobrança), consulta o histórico de pagamentos, troca o cartão de crédito, cancela ou reativa a assinatura, e solicita reembolso quando elegível. Se o usuário nunca assinou, a página vira uma landing de planos.
- **Layout geral**: coluna única centralizada (`max-w-4xl`), sem tabs/wizard. Título de página + subtítulo, seguido de um banner de alerta condicional (expirada/reembolsada), depois um grid de 2 colunas com dois cards (Detalhes da Assinatura / Informações de Cobrança), um card de Histórico de Pagamentos (tabela), um card de Gerenciar Assinatura (dois botões de ação) e um card de Dados do Assinante. Três `Dialog` (modais) sobrepostos: Cancelar, Trocar Cartão, Solicitar Reembolso. Estado sem assinatura (`!subscription`) renderiza um layout diferente com grid de 2 planos (pricing).

- **Inventário completo de UI**:
  - **Skeleton de carregamento** (`isLoading`): título+subtítulo skeleton, 2 cards com linhas skeleton, 1 card grande skeleton (histórico).
  - **Estado "sem assinatura"** (`!subscription`):
    - Se `user.subscriptionStatus === 'none'`: seção "Escolha seu plano" com 2 `Card`:
      - **Card Plano Mensal**: título "Plano Mensal", descrição "Compromisso mínimo, máxima flexibilidade", preço **R$ 99,90/mês**, texto "Renovação automática. Cancele a qualquer hora.", lista de 6 features (`+39 Ferramentas de IA Premium`, `Criador e Clonador de Páginas`, `+350 Cursos Exclusivos`, `PLRs Globais em 7 idiomas`, `Automações com N8n`, `Suporte prioritário`), botão "Começar agora" (`data-testid=button-subscribe-monthly`) → `/assinatura/checkout?plan=mensal`.
      - **Card Plano Anual** (destacado com borda verde e badge "Melhor valor"): preço **R$ 360,90/ano**, subtexto "Apenas R$ 30,08/mês (economize R$ 83,88)", descrição "Economize + de 70% comparado ao mensal", mesma lista de 6 features, botão "Começar agora" (`button-subscribe-annual`) → `/assinatura/checkout?plan=anual`.
      - 3 "trust badges": Pagamento Seguro (SSL), Cancele a qualquer momento (sem taxas ocultas), Acesso imediato (após confirmação).
    - Se `subscriptionStatus !== 'none'` (ex: cancelada/expirada sem registro local): card tracejado com ícone de cartão, título "Nenhuma assinatura ativa", texto explicativo, botão "Assinar Agora" (`button-subscribe`) → `/assinatura/checkout`.
  - **Banner "Assinatura expirada"** (quando `status === 'expired'` ou `accessValidUntil` no passado): ícone de alerta vermelho, texto "O acesso à plataforma foi bloqueado...", aviso condicional por método de pagamento (cartão será cobrado automaticamente / PIX precisa novo pagamento), botão "Reativar Assinatura Agora" ou "Fazer Novo Pagamento" (`button-reactivate-expired`).
  - **Banner "Assinatura reembolsada"** (status `refunded`): ícone laranja, texto "Você perdeu acesso aos recursos premium...", botão "Assinar Novamente" (`button-resubscribe-after-refund`) → `/assinatura/checkout`.
  - **Card "Detalhes da Assinatura"** (`card-subscription-details`): linhas com `Separator` entre cada uma:
    - Plano: badge de texto "Plano Mensal" ou "Plano Anual" (`badge-subscription-plan`).
    - Status: `Badge` colorido (`badge-subscription-status`) com mapeamento: `active`→"Ativa" (default, ícone check), `pending`→"Pendente" (secondary, clock), `awaiting_payment`→"Aguardando Pagamento" (secondary, alert-circle), `canceled`→"Cancelada" (destructive, X), `expired`→"Expirada" (destructive, alert-triangle), `refunded`→"Reembolsada" (outline, refresh).
    - Método de Pagamento: exibe logo PIX (SVG colorido) ou logo da bandeira do cartão (Visa/Mastercard/Amex/ genérico) + `****{últimos 4 dígitos}`.
    - Valor: `formatCurrency(subscription.amount)` + "/mês" ou "/ano" (`text-subscription-amount`).
  - **Card "Informações de Cobrança"** (`card-billing-info`):
    - Período Atual: `{currentPeriod}º período` (`text-current-period`).
    - Último Pagamento (se `paidAt`): data formatada (`text-last-payment`).
    - Próxima Cobrança: "-" se cancelada/expirada/reembolsada, senão `nextPaymentDate` ou data calculada (`text-next-payment`).
    - Cancelada em (se aplicável): data em vermelho (`text-canceled-at`).
    - Acesso válido até (se cancelada): data em âmbar (`text-access-until`).
  - **Card "Histórico de Pagamentos"** (`card-payment-history`): tabela (`Table`) com colunas **Data, Período, Método, Valor, Status**.
    - Skeleton de 3 linhas enquanto `isLoadingPayments`.
    - Se `payments.length > 0`: uma linha por pagamento (ícone PIX/cartão + bandeira/últimos 4, `getPaymentStatusBadge`: `paid`→"Pago" default, `pending`→"Pendente" secondary, `failed`→"Falhou" destructive, `refunded`→"Reembolsado" outline), mais uma linha extra "Cancelado" em vermelho se `canceledAt` existir.
    - Senão, se `subscription.paidAt` existir (fallback sem tabela de payments): uma linha única com o pagamento inicial + badge "Pago" (verde) e linha extra de cancelamento se aplicável.
    - Estado vazio: ícone de relógio + "Nenhum pagamento registrado ainda".
  - **Card "Gerenciar Assinatura"** (`card-subscription-management`):
    - Botão "Alterar Método de Pagamento" (`button-change-payment-method`, desabilitado se status ≠ active) — abre modal de troca de cartão.
    - Botão "Cancelar Assinatura" (`button-cancel-subscription`, desabilitado se status ≠ active) — abre modal de cancelamento.
    - Bloco condicional de reativação (quando cancelada/expirada e não reembolsada): título "Assinatura expirada"/"Assinatura cancelada", texto de acesso até tal data, aviso por método de pagamento, botão "Reativar Assinatura"/"Fazer Novo Pagamento" (`button-reactivate`), botão "Solicitar Reembolso" (`button-request-refund`, só aparece se `refundEligibility.eligible`) com texto "Você ainda tem X dia(s) para solicitar reembolso" (janela de 7 dias a partir do primeiro pagamento).
  - **Card "Dados do Assinante"** (`card-subscriber-info`): Nome (`text-buyer-name`), E-mail (`text-buyer-email`), CPF formatado (`text-buyer-cpf`), Telefone formatado (`text-buyer-phone`).
  - **Modal "Cancelar Assinatura"**: aviso âmbar "Você continuará tendo acesso... até {data}", campo `Textarea` "Motivo do cancelamento (opcional)" (`input-cancel-reason`), botões "Manter Assinatura" (`button-cancel-modal-close`) e "Confirmar Cancelamento" (`button-confirm-cancel`, destructive, loading state "Cancelando...").
  - **Modal "Trocar Cartão de Crédito"**: formulário (`react-hook-form` + `zod`) com campos: Número do Cartão (13-16 dígitos, `input-card-number`), Nome no Cartão (min 3 chars, uppercase automático, `input-card-holder`), Mês (regex 01-12, `input-card-month`), Ano (2 dígitos, `input-card-year`), CVV (3-4 dígitos, tipo password, `input-card-cvv`). Botões "Cancelar" (`button-payment-modal-close`) e "Atualizar Cartão" (`button-confirm-payment-change`, loading "Atualizando...").
  - **Modal "Solicitar Reembolso"**: descrição "primeiros 7 dias", bloco azul com valor a reembolsar (`formatCurrency(refundEligibility.amountCents)`) e método, bloco âmbar "Restrição de Acesso" listando recursos perdidos (✗ Ferramentas IA, ✗ Meus PLRs, ✗ Cursos Online, ✗ Quiz Interativo, ✗ Plugins, ✗ Templates e Páginas, ✗ Serviços) e recursos mantidos (Timeline, Fórum, Marketplace, Sistema de Afiliados), texto de prazo (cartão: até 2 faturas/60 dias; PIX: até 5 dias úteis via contato da equipe), `Textarea` "Motivo do reembolso (opcional)" (`input-refund-reason`), botões "Cancelar" (`button-refund-modal-close`) e "Confirmar Reembolso" (`button-confirm-refund`, loading "Processando...").

- **Fluxos do usuário**:
  - **Novo usuário sem assinatura**: acessa `/assinatura` → vê os 2 cards de plano → clica "Começar agora" → vai para `/assinatura/checkout?plan=mensal|anual`.
  - **Trocar cartão**: clica "Alterar Método de Pagamento" → modal abre pré-preenchido com nome/email/cpf/telefone do usuário → preenche dados do cartão → "Atualizar Cartão" → `PUT /api/user/subscription/update-card` → toast de sucesso → invalida queries de subscription/payments/user.
  - **Cancelar**: clica "Cancelar Assinatura" → modal com aviso de acesso remanescente → opcionalmente escreve motivo → "Confirmar Cancelamento" → `DELETE /api/user/subscription/cancel` → toast → fecha modal.
  - **Reativar (assinatura cancelada/expirada)**: clica "Reativar Assinatura"/"Fazer Novo Pagamento" → se `paymentMethod === 'pix'` redireciona direto para `/assinatura/checkout?plan={plan}`; se cartão, chama `POST /api/user/subscription/reactivate` — em sucesso reativa in-place; em erro com `requiresCheckout`/`checkoutUrl`, redireciona para checkout.
  - **Solicitar reembolso**: só visível quando `subscription.status === 'canceled'` e API de elegibilidade retorna `eligible: true` (dentro de 7 dias do primeiro pagamento) → abre modal → opcionalmente escreve motivo → "Confirmar Reembolso" → `POST /api/user/subscription/refund` → toast → recarrega a página (`window.location.reload()`) após 1.5s.

- **Regras de negócio visíveis no código**:
  - `canCancel` e `canChangePayment` = `subscription.status === 'active'` (ambos os botões ficam desabilitados fora disso).
  - Reembolso só elegível dentro de **7 dias** do primeiro pagamento (`refundEligibility.eligible`, contagem regressiva `7 - daysFromFirstPayment`).
  - Reembolso bloqueia acesso a: Ferramentas IA, Meus PLRs, Cursos Online, Quiz Interativo, Plugins, Templates e Páginas, Serviços — mantendo apenas Timeline, Fórum, Marketplace e Sistema de Afiliados.
  - Reativação por PIX sempre exige novo checkout (pagamento não pode ser re-tentado automaticamente); reativação por cartão tenta cobrança automática via API antes de cair no checkout.
  - `accessValidUntil` calculado como `nextPaymentDate`, ou `paidAt + 1 mês (mensal)/1 ano (anual)`, ou hoje + 1 mês/ano como fallback.
  - Preços fixos exibidos na tela de pricing: Mensal R$ 99,90/mês; Anual R$ 360,90/ano (R$ 30,08/mês equivalente, economia de R$ 83,88 alegada).

- **Integrações e chamadas de API**:
  - `GET /api/user/subscription` (query `["/api/user/subscription"]`).
  - `GET /api/user/subscription/payments` (query `["/api/user/subscription/payments"]`).
  - `GET /api/user/subscription/refund/eligibility` (habilitada só quando `status === 'canceled'`).
  - `DELETE /api/user/subscription/cancel` (mutation, body `{ reason }` opcional).
  - `PUT /api/user/subscription/update-card` (mutation, body com dados do cartão).
  - `POST /api/user/subscription/refund` (mutation, body `{ subscriptionId, reason }`).
  - `POST /api/user/subscription/reactivate` (fetch manual com header `Authorization: Bearer {auth_token}` do `localStorage`).
  - Nenhuma integração externa direta nesta página (o processamento de pagamento em si ocorre no checkout).

- **Dados exibidos**: entidade `LowfySubscription` (plan, status, paymentMethod, amount, currentPeriod, paidAt, nextPaymentDate, canceledAt, accessValidUntil, cardBrand, cardLastDigits, buyerName, buyerEmail, buyerCpf, buyerPhone) e lista de `LowfySubscriptionPayment` (id, paidAt/createdAt, billingPeriod, paymentMethod, cardBrand, cardLast4, amount, status).

---

### Página: /assinatura/checkout — Checkout de Assinatura (SubscriptionCheckout)

- **Arquivo fonte**: `client/src/pages/subscription/SubscriptionCheckout.tsx` · **Rotas**: `/assinatura/checkout` e `/subscription/checkout` (registradas tanto no bloco de rotas públicas quanto autenticadas, fora do `Layout` — página fullscreen sem sidebar). Aceita query params `plan` (`mensal`|`anual`, default mensal), `cupom` e `recoveryId`.
- **Objetivo**: página fullscreen de checkout onde o usuário (logado ou não) preenche dados pessoais e escolhe entre cartão de crédito ou PIX para assinar um plano.
- **Layout geral**: header simples com botão "Voltar" e indicador "Pagamento seguro"; timer central de contagem regressiva; grid de 5 colunas em telas grandes — formulário ocupa 3 colunas (esquerda), resumo do pedido ocupa 2 colunas (direita, sticky), com versão mobile do resumo mostrada acima/abaixo do formulário. Dentro do formulário, uma seção de dados pessoais e depois um componente `Tabs` com 2 abas (Cartão / PIX).

- **Inventário completo de UI**:
  - **Header**: botão "Voltar" (`button-back-home`, ícone seta) → `setLocation("/")`; indicador "Pagamento seguro" com ícone de cadeado.
  - **Timer**: "Finalize em {mm:ss}" contando de 15:00 (900s) para baixo, texto em vermelho (`text-red-700`), não bloqueia a ação ao chegar a zero (apenas visual).
  - **Resumo do Pedido** (mobile, no topo; desktop, sidebar sticky): logo Lowfy, nome do plano (`text-plan-name`), descrição, badge de economia (se cupom aplicado) `savings`, linha "Total" com preço + período (`text-total`); no desktop inclui também lista "O que está incluso": Acesso completo à plataforma, +39 Ferramentas de IA Premium, +350 Cursos exclusivos, Criador e Clonador de Páginas, Suporte prioritário, e muito mais...
  - **Seção Dados Pessoais** (grid 2 colunas): campos com ícone à esquerda —
    - Nome completo (`input-name`, texto, desabilitado se usuário logado).
    - Email (`input-email`, tipo email, desabilitado se logado).
    - CPF (`input-cpf`, máscara `000.000.000-00`, maxLength 14, desabilitado se logado).
    - Telefone (`input-phone`, máscara `(00) 00000-0000`, maxLength 15, desabilitado se logado).
  - **Tabs de pagamento** (`tab-credit-card` / `tab-pix`):
    - **Aba Cartão**: Número do Cartão (`input-card-number`, com logo de bandeira detectada automaticamente à direita — Visa/Mastercard/Amex/genérico, maxLength 19), Nome no Cartão (`input-card-name`, uppercase automático), grid 2 colunas com Validade `MM/AA` (`input-card-expiry`) e CVV (`input-card-cvv`); botão "Assinar por {preço}{período}" (`button-pay-card`, loading "Processando...").
    - **Aba PIX**: bloco central com ícone PIX, título "Pagamento via PIX", subtítulo "Aprovação instantânea", preço em destaque (`text-pix-price`), botão "Gerar QR Code PIX" (`button-pay-pix`, loading "Gerando QR Code...").
  - **Rodapé do formulário**: ícones "Pagamento seguro" e "Dados protegidos".
  - **Benefícios (mobile)**: card separado com a mesma lista "O que está incluso".
  - **Rodapé da página**: "Compra 100% segura" (ícone escudo verde), aviso reCAPTCHA do Google, links "Política de privacidade" e "Termos de serviço", nota "* Parcelamento com acréscimo", texto "Ao continuar, você concorda com os Termos de Compra" (link).
  - **Toasts**: "Cupom aplicado! 🎉" ao validar cupom com sucesso; "Dados restaurados! ✨" ao carregar dados via `recoveryId`; erros de validação (nome/email/CPF/telefone obrigatórios ou inválidos, dados de cartão incompletos, data de validade/mês inválidos); erro de pagamento genérico.

- **Fluxos do usuário**:
  - **Checkout com cartão**: preenche dados pessoais → aba Cartão → preenche número/nome/validade/CVV → clica "Assinar por..." → validação client-side → `POST /api/subscriptions/checkout` → se `status === 'active'`: usuário logado vai para `/assinatura/checkout/sucesso?plan=X`; usuário novo vai para `/ativar-conta?token=...`; se `status` pendente: salva dados em `sessionStorage` e vai para `/assinatura/checkout/aguardando`.
  - **Checkout com PIX**: preenche dados pessoais → aba PIX → clica "Gerar QR Code PIX" → `POST /api/subscriptions/checkout` (paymentMethod pix) → salva resposta em `sessionStorage.pixSubscriptionData` → redireciona para `/assinatura/checkout/pix`.
  - **Checkout com cupom**: se URL tem `?cupom=CODE`, valida via API ao carregar a página e aplica desconto percentual ao preço exibido automaticamente.
  - **Recuperação de checkout abandonado**: se URL tem `?recoveryId=X` e usuário não está logado, busca dados salvos via API e pré-preenche nome/email/CPF/telefone.
  - **Abandono**: ao fechar/sair da página sem completar o checkout, dispara evento de tracking de checkout abandonado (Google Ads).

- **Regras de negócio visíveis no código**:
  - Preços fixos: Mensal R$ 99,90 (9990 centavos); Anual R$ 360,90 (36090 centavos) — com texto de "Economize R$ 837,90" no objeto de dados (nota: divergente do texto "R$ 83,88" mostrado em Subscription.tsx).
  - Se usuário está logado, os campos de dados pessoais vêm pré-preenchidos e ficam desabilitados (não editáveis).
  - Detecção de bandeira do cartão client-side por regex: Visa (`^4`), Mastercard (`^5[1-5]`), Amex (`^3[47]`).
  - Validações obrigatórias antes de submeter: nome, email com "@", CPF com 11 dígitos, telefone com ao menos 10 dígitos; para cartão, todos os campos preenchidos, validade no formato `MM/AA` ou `MM/AAAA`, mês entre 01-12.
  - Diferenciação de status de resposta do pagamento com cartão: `active` = aprovado imediatamente; qualquer outro status = pendente/análise antifraude, redireciona para tela de aguardando.
  - Código de indicação (`referralCode`) obtido de `/api/referrals/current` e enviado junto no payload de checkout.
  - Parâmetros de Meta EMQ (`fbc`, `fbp`) lidos de cookies e enviados no payload para melhorar correspondência de eventos do Facebook.

- **Integrações e chamadas de API**:
  - `GET /api/subscriptions/validate-coupon?coupon=X&plan=Y` (validação de cupom).
  - `GET /api/subscriptions/recovery/:recoveryId` (dados de checkout abandonado).
  - `GET /api/referrals/current` (código de indicação via cookie).
  - `POST /api/subscriptions/checkout` (mutation principal de processamento de pagamento — cartão ou PIX).
  - Tracking: Meta Pixel (`trackSubscriptionCheckoutStart`, `trackViewContent`, `trackAddPaymentInfo`, `trackSubscriptionPurchase`) e Google Ads (`trackAdBeginCheckout`, `trackAdAbandonedCheckout`).

- **Dados exibidos**: plano selecionado (nome, preço, descrição, economia), dados do usuário logado (name, email, cpf, phone) ou dados de recuperação de checkout (buyerName, buyerEmail, buyerCpf, buyerPhone).

---

### Página: /assinatura/checkout/pix — PIX da Assinatura (SubscriptionPix)

- **Arquivo fonte**: `client/src/pages/subscription/SubscriptionPix.tsx` · **Rotas**: `/assinatura/checkout/pix/:transactionId?` e `/subscription/checkout/pix/:transactionId?` (públicas e autenticadas, fullscreen sem Layout).
- **Objetivo**: exibir o QR Code PIX gerado no checkout e aguardar a confirmação do pagamento em tempo real (polling), redirecionando automaticamente ao ser confirmado.
- **Layout geral**: página fullscreen estreita (`max-w-lg`), header com botão Voltar, timer de expiração, card único central contendo ícone PIX, indicador "tempo real", valor a pagar, QR Code, código copia-e-cola e instruções de pagamento.

- **Inventário completo de UI**:
  - **Estado de carregamento inicial**: spinner + "Carregando..." enquanto lê `sessionStorage.pixSubscriptionData` (se ausente/inválido, mostra toast de erro e redireciona para `/`).
  - **Header**: botão "Voltar" (`button-back-home`) → `/`.
  - **Timer**: "Tempo: {mm:ss}" contando de 30:00 (1800s), badge azul normalmente, vermelho quando `< 5 min` restantes (`text-timer`); ao zerar, toast "QR Code expirado" e redireciona para `/` após 2s.
  - **Card principal**:
    - Ícone PIX circular azul, título "Pagamento via PIX" (`text-pix-title`), subtítulo "Escaneie o QR Code para finalizar sua assinatura".
    - Indicador "tempo real" (`realtime-indicator`): ponto verde pulsante + "Aguardando pagamento • Atualização em tempo real".
    - Bloco de valor: "Valor a pagar" + valor formatado (`text-amount`) + nome do plano opcional.
    - **QR Code** (`qrcode-pix`, componente `QRCodeSVG`, 180px) gerado a partir de `pixData.qrCode`; enquanto não disponível, mostra spinner em placeholder cinza.
    - **Código copia-e-cola**: bloco de código (`text-pix-code`) com botão "Copiar"/"Copiado!" (`button-copy-pix`) que usa `navigator.clipboard`.
    - **Instruções "Como pagar"** (bloco azul): lista numerada — Abra o app do seu banco / Escolha pagar com PIX / Escaneie o QR Code / Confirme o pagamento; nota final "✓ Após o pagamento, você será redirecionado automaticamente para ativar sua conta".

- **Fluxos do usuário**:
  - Chega à página vindo do checkout (dados salvos em `sessionStorage.pixSubscriptionData`); a URL é atualizada via `history.replaceState` para incluir o `transactionId`.
  - Escaneia o QR Code ou copia o código PIX no app do banco.
  - A página faz **polling automático** a cada 2 segundos (`GET /api/subscriptions/payment-status/:transactionId`) verificando o status do pagamento, também revalidando quando a aba/janela ganha foco (`visibilitychange`/`focus`) — útil para quando o usuário volta do app do banco.
  - Quando `status` é `paid`/`approved`/`completed`/`active`: toast "Pagamento confirmado!", limpa `sessionStorage`, dispara tracking de compra, e redireciona: usuário logado → `/assinatura/checkout/sucesso?plan=X`; usuário novo → `/ativar-conta?token=X` (ou toast de erro se faltar token).
  - Quando `status` é `refused`/`cancelled`/`refunded`: toast "Pagamento recusado" e redireciona para `/` após 2s.
  - Se a transação não é encontrada (404): toast "Transação não encontrada" e redireciona para `/`.
  - Polling tem limite de 900 tentativas (30 min) e lógica de backoff (a cada 3 tentativas em vez de todas) após 5 erros consecutivos.

- **Regras de negócio visíveis no código**:
  - Expiração do PIX em 30 minutos (1800s), com alerta visual quando restam menos de 5 minutos.
  - Preço usado no tracking de conversão é recalculado por plano (`mensal` = 9990 centavos, `anual` = 36090 centavos), não vem necessariamente do `pixData`.
  - Fluxo de destino pós-pagamento depende se o usuário já está autenticado (`user` do `useAuth`) ou é um novo cadastro via ativação de conta.

- **Integrações e chamadas de API**:
  - `GET /api/subscriptions/payment-status/:transactionId` (polling de status do pagamento).
  - Tracking: Meta Pixel (`trackSubscriptionPurchase`, `trackCompleteRegistration`).
  - `sessionStorage` para persistência de `pixSubscriptionData` e `subscriptionAwaitingData`.

- **Dados exibidos**: `pixData` (qrCode, transactionId, totalAmount/amount, planName, plan, activationToken) vindo do `sessionStorage`, populado pela resposta do endpoint de checkout.

---

### Página: /assinatura/checkout/aguardando — Aguardando Confirmação (SubscriptionCheckoutAwaiting)

- **Arquivo fonte**: `client/src/pages/subscription/SubscriptionCheckoutAwaiting.tsx` · **Rotas**: `/assinatura/checkout/aguardando` (pública e autenticada, fullscreen).
- **Objetivo**: tela intermediária exibida quando o pagamento com cartão de crédito fica em análise antifraude (status pendente), mostrando progresso e fazendo polling até a confirmação ou rejeição.
- **Layout geral**: página fullscreen centralizada verticalmente, com 3 estados visuais distintos renderizados condicionalmente (confirmado / rejeitado / aguardando), cada um ocupando a tela inteira com fundo gradiente próprio.

- **Inventário completo de UI**:
  - **Estado "Verificando Pagamento" (default, `paymentStatus === 'pending'`)**: card âmbar com ícone de relógio + spinner sobreposto, título "Verificando Pagamento", texto explicativo, bloco "Tempo de espera: {mm:ss}" (contador crescente `timeElapsed`), checklist "O que está acontecendo?": ✓ Dados do cartão enviados (verde), spinner "Verificação anti-fraude em andamento" (âmbar), relógio "Aguardando confirmação do banco" (cinza); nota final "Não feche esta página...".
  - **Estado "Pagamento Confirmado!" (`paymentStatus === 'confirmed'`)**: fundo verde, ícone de check grande, título, texto "Redirecionando para ativação da sua conta...", spinner.
  - **Estado "Pagamento Rejeitado" (`paymentStatus === 'failed'`)**: fundo branco, ícone X vermelho, título, texto explicativo, bloco vermelho "Possíveis motivos": Cartão bloqueado para compras online / Saldo ou limite insuficiente / Dados do cartão incorretos; botão "Tentar Novamente" (`button-try-again`) → `/assinatura`.

- **Fluxos do usuário**:
  - Chega vindo do checkout com cartão quando o pagamento não foi aprovado instantaneamente; dados lidos de `sessionStorage.subscriptionAwaitingData` (se ausentes, redireciona para `/assinatura`).
  - Polling a cada 5 segundos em `GET /api/subscriptions/payment-status/:subscriptionId`.
  - Se `status === 'active'`: muda para estado "confirmado", limpa `sessionStorage`, e após 1.5s redireciona para `/ativar-conta?token=X` (se houver token) ou `/assinatura/checkout/sucesso?plan=X`.
  - Se `status === 'cancelled'` ou `'refunded'`: muda para estado "rejeitado".
  - Usuário pode clicar "Tentar Novamente" no estado de falha para voltar a `/assinatura`.

- **Regras de negócio visíveis no código**: não há timeout automático (o contador de tempo decorrido é apenas informativo, sem limite máximo de polling nesta página, diferente da SubscriptionPix que tem limite de 900 tentativas).

- **Integrações e chamadas de API**: `GET /api/subscriptions/payment-status/:subscriptionId` (polling); `sessionStorage` para leitura de `subscriptionAwaitingData`.

- **Dados exibidos**: `AwaitingData` (subscriptionId, transactionId, activationToken, plan).

---

### Página: /assinatura/checkout/sucesso — Sucesso do Checkout (SubscriptionCheckoutSuccess)

- **Arquivo fonte**: `client/src/pages/subscription/SubscriptionCheckoutSuccess.tsx` · **Rotas**: `/assinatura/checkout/sucesso` e `/subscription/checkout-success` (públicas e autenticadas, fullscreen). Query param `plan` (`mensal`|`anual`).
- **Objetivo**: página final do funil confirmando que a assinatura foi ativada com sucesso, com celebração visual (confete) e atalhos de navegação.
- **Layout geral**: página fullscreen com fundo gradiente esmeralda/teal, conteúdo centralizado (`max-w-2xl`): ícone de sucesso, título, card de resumo, dica informativa, dois botões de ação, link de suporte.

- **Inventário completo de UI**:
  - Ícone de check circular verde grande, título "Pagamento Aprovado!", subtítulo "Compra confirmada com sucesso".
  - **Card de resumo** (grid 2x2): "Plano escolhido" (nome do plano), "Data e hora" (timestamp atual formatado em pt-BR/America-São Paulo), "Valor" (preço + período), "Status" (badge verde "Ativo" com ícone check); rodapé do card: "Sua assinatura está pronta para usar. Aproveite todos os recursos da plataforma!".
  - Bloco azul de dica: "💡 Dica: Acesse sua conta a qualquer momento para gerenciar sua assinatura, alterar métodos de pagamento ou cancelar."
  - Botão "Ir para Timeline" (`button-go-timeline`, verde, com seta) → `/timeline`.
  - Botão "Gerenciar Assinatura" (`button-go-subscription`, outline) → `/assinatura`.
  - Rodapé: "Precisa de ajuda? Entre em contato com nosso suporte" (link `#`, não funcional/placeholder).
  - Efeito de confete disparado via `canvas-confetti` ao carregar a página.

- **Fluxos do usuário**: usuário chega após pagamento confirmado (cartão aprovado na hora ou PIX/cartão confirmado via polling) → vê a confirmação → escolhe ir para a Timeline (uso da plataforma) ou para a página de Gerenciar Assinatura (`/assinatura`).

- **Regras de negócio visíveis no código**:
  - Se não há `user` autenticado, redireciona para `/login` (a página assume que o usuário já está logado/ativado nesse ponto do funil).
  - Preços exibidos são fixos por plano no client (Mensal R$ 99,90/mês; Anual R$ 360,90/ano), não vêm de uma chamada de API.
  - Dispara eventos de conversão (Meta Pixel `trackCompleteRegistration`, Google Analytics `trackPurchase`, Google Ads `trackAdConversion`) no carregamento da página — nota no código: "Purchase event é disparado no momento do checkout" (aqui é registro de conclusão/analytics adicional).

- **Integrações e chamadas de API**: nenhuma chamada de API de dados nesta página; apenas tracking client-side (Meta Pixel, Google Analytics/Ads) e biblioteca `canvas-confetti`.

- **Dados exibidos**: `plan` (nome, preço, período) resolvido estaticamente a partir do param `plan` da URL; `user` (para gate de autenticação); data/hora atual do dispositivo.

---

### Página: /modelos-n8n — Automações N8N (N8nAutomations)

- **Arquivo fonte**: `client/src/pages/N8nAutomations.tsx` · **Rota**: `/modelos-n8n` (dentro do `Layout`/`ProtectedContent`, autenticada).
- **Objetivo**: biblioteca de 153 templates prontos de automação para o N8N, organizados por categoria e departamento, que o usuário pode pesquisar, filtrar e baixar como arquivo JSON para importar no N8N.
- **Layout geral**: página de conteúdo padrão (`max-w-7xl`) com cabeçalho, barra de filtros (busca + 2 selects), contador de resultados, grid responsivo de cards (1/2/3 colunas conforme breakpoint), botão "Carregar Mais" com paginação incremental client-side, e rodapé de créditos.

- **Inventário completo de UI**:
  - **Gate de acesso**: se `isFeatureBlocked("n8n")` (via `useFeatureAccess`), renderiza `<FeatureLockedOverlay>` com título "Automações N8N" e descrição "Acesse 153 templates de automação prontos. Disponível apenas para assinantes." — bloqueando toda a página.
  - **SEO**: componente `<SEO>` com title/description/keywords/og tags sobre "153 Automações N8N Prontas".
  - **Cabeçalho**: título "Automações N8N", texto descritivo "153 templates prontos de automação para usar no N8N. Organize e-mails, integre com Telegram, automatize WordPress e muito mais!".
  - **Barra de filtros**:
    - Campo de busca com ícone de lupa (`input-search-automations`) — filtra por título, descrição ou departamento.
    - `Select` "Categoria" (`select-category`) — opção "Todas as Categorias" + lista de categorias únicas extraídas dos dados.
    - `Select` "Departamento" (`select-department`) — opção "Todos os Departamentos" + lista de departamentos únicos (não-nulos).
  - **Contador de resultados** (`text-automation-count`): "{N} automação(ões) encontrada(s)" + badges secundários mostrando categoria/departamento ativos, se filtrados.
  - **Estado de carregamento**: spinner centralizado (`Loader2`) enquanto `isLoading`.
  - **Grid de cards** (`card-automation-{id}`), um por automação, clicável (todo o card dispara download):
    - Título da automação (`text-automation-title-{id}`, truncado 2 linhas).
    - Descrição (truncada 3 linhas, altura mínima fixa).
    - Badge de categoria (secondary) e badge de departamento (outline, se existir).
    - Botão "Baixar Template" (`button-download-automation-{id}`, com ícone de download; usa `stopPropagation` para não disparar 2x o download ao clicar no card inteiro).
  - **Botão "Carregar Mais Automações"** (`button-load-more`): aparece quando há mais itens do que os exibidos (paginação client-side de 12 em 12, `ITEMS_PER_PAGE = 12`).
  - **Estado vazio**: ícone de download grande, "Nenhuma automação encontrada", mensagem contextual (com termo pesquisado ou genérica "Nenhuma automação disponível no momento").
  - **Rodapé de créditos**: texto "Créditos: Enes Cingoz e colaboradores do repositório awesome-n8n-templates", com links externos para GitHub (`github.com/enescingoz` e `github.com/enescingoz/awesome-n8n-templates`).

- **Fluxos do usuário**:
  - **Buscar/filtrar templates**: digita no campo de busca e/ou seleciona categoria/departamento → grid é refiltrado e reordenado alfabeticamente em tempo real (client-side, `useMemo`).
  - **Baixar um template**: clica no card ou no botão "Baixar Template" → função `handleDownload` faz `fetch(automation.templateUrl)`, converte em blob, cria um link `<a download>` temporário com nome de arquivo slugificado a partir do título (`+ '.json'`) e dispara o download automaticamente; em caso de erro no fetch, abre a URL do template em nova aba (`window.open`) como fallback.
  - **Carregar mais**: clica em "Carregar Mais Automações" → incrementa `displayedItems` em mais 12, revelando mais cards da lista já filtrada (sem nova chamada de API).

- **Regras de negócio visíveis no código**:
  - Feature bloqueada por plano/assinatura (`useFeatureAccess().isFeatureBlocked("n8n")`) — acesso restrito a assinantes ativos; usuários bloqueados veem apenas o overlay, sem acesso ao conteúdo.
  - Paginação é inteiramente client-side (todos os registros vêm em uma única chamada e são fatiados no front).

- **Integrações e chamadas de API**:
  - `GET /api/n8n-automations` (query única, `staleTime` de 5 minutos, carrega toda a lista de automações).
  - `GET {automation.templateUrl}` (fetch direto do arquivo JSON do template no momento do download, provavelmente um asset estático/CDN).
  - Hook `useFeatureAccess` para checar bloqueio de feature por plano.

- **Dados exibidos**: entidade `N8nAutomation` (id, title, titleEn, description, descriptionEn, category, categoryEn, department, templateUrl, viewCount, createdAt) — embora `titleEn`, `descriptionEn`, `categoryEn` e `viewCount` estejam tipados na interface, não são exibidos na UI atual (apenas título/descrição/categoria em português são renderizados).

---

## Painel Admin — Analytics, Usuários e Bugs

### Nota técnica

`grep -r "pages/Admin\"" client/src` não retornou nenhum resultado — `client/src/pages/Admin.tsx` é um painel administrativo monolítico legado, não roteado atualmente (código morto).

As 4 páginas abaixo estão confirmadas em `client/src/App.tsx` (linhas 91-99 e 271-296), todas envolvidas em `<AdminRoute>`.

---

### Página: /admin/analytics — AdminAnalytics

- **Arquivo fonte**: `client/src/pages/admin/AdminAnalytics.tsx` | **rota**: `/admin/analytics`
- **Objetivo**: dar ao admin uma visão geral quantitativa da plataforma (usuários, conteúdo do fórum, catálogo, suporte) e da evolução recente de usuários e atividade do fórum.
- **Layout geral**: página de conteúdo único (sem abas/wizard) com um cabeçalho de título/subtítulo, seguido de um grid de cards de estatística e, abaixo, dois cards de gráfico em largura total, empilhados verticalmente.
- **Inventário completo de UI**:
  - Grid de 6 cards de estatística (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), cada um com ícone, label e valor (`Skeleton` enquanto carrega):
    - "Total de Usuários" (ícone `Users`) + badge secundário "{activeUsers} ativos"
    - "Total de Tópicos" (ícone `MessageSquare`)
    - "Total de PLRs" (ícone `BookOpen`)
    - "Total de Produtos" (ícone `ShoppingBag`) — total de produtos do marketplace
    - "Total de Serviços" (ícone `Briefcase`)
    - "Tickets Abertos" (ícone `TicketIcon`) — card com borda/texto destacados em vermelho (`border-destructive`) quando `openTickets > 0`
  - Card "Crescimento de Usuários (30 dias)": `AreaChart` (Recharts) com gradiente roxo (#8b5cf6), eixo X = `date`, eixo Y = contagem (`allowDecimals={false}`), tooltip, série única `count` ("Novos Usuários"). `Skeleton` de 300px enquanto carrega.
  - Card "Atividade do Fórum (30 dias)": `AreaChart` com duas séries sobrepostas — `topics` (azul #3b82f6, "Tópicos") e `replies` (verde #10b981, "Respostas") — eixo X = `date`, legenda com ícone circular, tooltip. `Skeleton` de 300px enquanto carrega.
  - Não há filtros de período, busca ou seletor de data nesta página (o período de 30 dias é fixo, definido pelo backend).
- **Fluxos do usuário**: admin acessa `/admin/analytics` → dados carregam via 3 queries em paralelo (com skeletons individuais) → visualiza KPIs no topo e gráficos de tendência abaixo. Não há interação de escrita nesta tela (somente leitura).
- **Regras de negócio visíveis no código**: card de tickets abertos muda de estilo (cor vermelha) quando `openTickets > 0`, sinalizando atenção; nenhuma outra regra de plano/permissão além do gate de `AdminRoute` no roteador.
- **Integrações e chamadas de API**:
  - `GET /api/admin/analytics` → objeto com `totalUsers`, `activeUsers`, `totalTopics`, `totalReplies`, `totalPLRs`, `totalServices`, `totalCourses`, `totalAITools`, `totalMarketplaceProducts`, `totalSupportTickets`, `openTickets`
  - `GET /api/admin/analytics/user-growth` → array `{date, count}[]`
  - `GET /api/admin/analytics/forum-activity` → array `{date, topics, replies}[]`
- **Dados exibidos**: contagens agregadas de usuários, tópicos/respostas de fórum, PLRs, produtos do marketplace, serviços, tickets de suporte (total e abertos); séries temporais de novos usuários e de tópicos/respostas por dia.

---

### Página: /admin/clonagem-analytics — AdminClonagemAnalytics

- **Arquivo fonte**: `client/src/pages/admin/AdminClonagemAnalytics.tsx` | **rota**: `/admin/clonagem-analytics`
- **Objetivo**: permitir ao admin auditar o uso da funcionalidade de clonagem de páginas — quantas páginas foram clonadas, por quais usuários, e visualizar/consultar cada página clonada individualmente, com filtro de período.
- **Layout geral**: cabeçalho com título/subtítulo à esquerda e um seletor de período (com ícone de calendário) à direita; abaixo, um grid de 3 cards de estatística; em seguida dois cards em lista vertical de largura total — "Páginas por Usuário" e "Todas as Páginas Clonadas".
- **Inventário completo de UI**:
  - Filtro de período (`Select`, `data-testid="select-date-preset"`) com 8 opções: "Hoje", "Últimos 7 dias", "Últimos 30 dias", "Este mês", "Mês passado", "Esta semana", "Todo período" (padrão), "Personalizado".
  - Quando "Personalizado" é selecionado: dois campos `Input type="date"` (`input-start-date`, `input-end-date`) com separador "até".
  - Badge de texto mostrando o rótulo do período ativo (ex.: "Últimos 7 dias" ou intervalo formatado `dd/MM/yyyy - dd/MM/yyyy`), exceto quando período = "Todo período".
  - 3 cards de estatística (`grid-cols-1 md:grid-cols-3`):
    - "Total de Páginas" (ícone `FileCode`) — com legenda "Páginas clonadas no período/no sistema"
    - "Usuários Ativos" (ícone `Users`, azul) — "Usuários com páginas clonadas [no período]"
    - "Total de Visualizações" (ícone `Clock`, verde) — soma de `viewCount` de todas as páginas
    - Todos com `Skeleton` de loading.
  - Card "Páginas por Usuário": lista de linhas, uma por usuário (`data-testid="user-stats-{userId}"`), mostrando nome (`userName` ou "Usuário Desconhecido"), email (`userEmail` ou "N/A") à esquerda e "Páginas Clonadas: {pageCount}" à direita. Estado vazio: "Nenhum usuário com páginas clonadas [no período selecionado/ainda]". Loading: 3 skeletons de 16px altura.
  - Card "Todas as Páginas Clonadas": lista de linhas, uma por página (`data-testid="page-{name}"`), cada uma mostrando: ícone `Globe` + nome (`originalName` ou `name`), data de criação formatada (pt-BR, fuso America/Sao_Paulo), URL pública em azul monoespaçado (`{origin}/pages/{name}`), e à direita 3 colunas: "Tamanho" (KB, 1 casa decimal), "Visualizações" (`viewCount` ou 0), "Atualizada" (data formatada). Estado vazio: "Nenhuma página clonada [no período selecionado/ainda]". Loading: 3 skeletons.
- **Fluxos do usuário**: admin abre a página (período padrão "Todo período") → vê estatísticas agregadas e listas completas → opcionalmente troca o preset de data (ou define datas customizadas) → os 3 cards e as 2 listas são refeitos automaticamente (queries reagem a `startDate`/`endDate`) → pode inspecionar cada página clonada (nome, tamanho, views, URL pública) e cada usuário com suas contagens.
- **Regras de negócio visíveis no código**: nenhuma ação de escrita/mutação nesta tela — é somente leitura/consulta; cálculo de datas para presets ("thisMonth", "lastMonth", "thisWeek" com semana começando na segunda-feira `weekStartsOn: 1`) é feito no cliente antes de montar a query string.
- **Integrações e chamadas de API**:
  - `GET /api/admin/cloning-analytics/pages?startDate&endDate` → `{ pages: ClonedPage[] }` (campos: `name`, `originalName`, `createdAt`, `updatedAt`, `size`, `viewCount`)
  - `GET /api/admin/cloning-analytics/user-stats?startDate&endDate` → `UserPagesStats[]` (campos: `userId`, `userName`, `userEmail`, `pageCount`)
- **Dados exibidos**: metadados de páginas clonadas (nome, nome original, datas de criação/atualização, tamanho em bytes, contagem de visualizações) e estatísticas de páginas clonadas por usuário (nome, email, quantidade).

---

### Página: /admin/usuarios — AdminUsuarios

- **Arquivo fonte**: `client/src/pages/admin/AdminUsuarios.tsx` | **rota**: `/admin/usuarios`
- **Objetivo**: gestão completa da base de usuários — buscar/filtrar, editar perfil e status, ativar/desativar assinatura, definir plano de acesso, bloquear/desbloquear, excluir, e importar/exportar usuários em massa via CSV.
- **Layout geral**: página com título e componente `UsersManagement` contendo: grid de 5 cards de estatística no topo, depois um único card "Lista de Usuários" com header (título + botões de ação), barra de busca + filtro de status, tabela paginada com menu de ações por linha, paginação, e por fim quatro diálogos (Editar Usuário, Ativar/Editar Assinatura, Confirmar Exclusão, Importar CSV).
- **Inventário completo de UI**:
  - **Cards de estatística** (`grid-cols-1 md:grid-cols-2 lg:grid-cols-5`):
    - "Total de Usuários" (ícone `Users`, azul) — `pagination.total`
    - "Ativa" (ícone `UserCheck`, verde) — contagem de `subscriptionStatus === "active"` na página atual
    - "Vencida" (ícone `UserX`, vermelho) — `subscriptionStatus === "expired"`
    - "Reembolso" (ícone `AlertTriangle`, vermelho) — `subscriptionStatus === "refunded"`
    - "Sem Assinatura" (ícone `AlertCircle`, cinza) — sem status ou `"none"`
    - (Nota: essas contagens são calculadas apenas sobre os usuários da página atual de 15, não sobre o total da base.)
  - **Header do card de lista**: título "Lista de Usuários" / descrição "Gerencie usuários e suas assinaturas"; botões "Exportar CSV" (ícone `Download`) e "Importar CSV" (ícone `Upload`, abre seletor de arquivo oculto aceitando `.csv`).
  - **Busca e filtro**:
    - Campo de texto "Buscar por nome, email ou telefone..." + botão de busca (ícone `Search`, também dispara com Enter).
    - `Select` "Filtrar por status" com opções: Todos os status, Assinatura Ativa, Assinatura Vencida, Assinatura Cancelada, Reembolso, Sem Assinatura.
  - **Tabela de usuários** (`overflow-x-auto`), colunas: Data Criação, Nome (+ badge "Admin" se `isAdmin`), Email, Telefone, Status Assinatura (badge de status + badge "Bloqueado" se aplicável), Data Assinatura (`latestSubscriptionPaidAt`), Vencimento (`subscriptionExpiresAt`), Ações (menu dropdown).
  - **Badges de status de assinatura**: Ativa (verde), Vencida (destrutivo/vermelho), Cancelada (laranja), Reembolso (vermelho escuro), Sem assinatura (outline).
  - **Badges de status de conta**: Ativo (outline verde), Bloqueado (destrutivo), Pendente (secundário), "-" default.
  - **Menu dropdown de ações por usuário** (ícone `MoreVertical`):
    - "Editar Usuário" (ícone `Edit`) → abre diálogo de edição
    - "Ativar Assinatura" (ícone `CheckCircle`) → abre diálogo de ativação
    - "Desativar Assinatura" (ícone `XCircle`) → só aparece se `subscriptionStatus === "active"`; chama mutação direto
    - "Plano Full" (ícone `Crown`, dourado) — marca `✓` se ativo; desabilitado se já é o plano atual
    - "Plano Basic" (ícone `Star`, azul) — idem
    - "Plano Free" (ícone `UserMinus`, cinza) — define `accessPlan: null`; idem
    - "Bloquear Acesso" / "Desbloquear Acesso" (ícones `Lock`/`Unlock`) — alterna `accountStatus`
    - "Excluir Usuário" (ícone `Trash2`, texto vermelho) → abre `AlertDialog` de confirmação
  - **Paginação**: texto "Mostrando X de Y usuários", botões "Anterior" (`ChevronLeft`) e "Próxima" (`ChevronRight`), texto "Página P de N" — 15 usuários por página.
  - **Estados**: loading = 5 `Skeleton` de 16px; sem estado vazio explícito na tabela (renderiza tabela vazia se `users.length === 0`).
  - **Diálogo "Editar Usuário"** (`max-w-2xl`, scroll interno): campos em grid 2 colunas — Nome* (`input-edit-name`), Email* (`input-edit-email`), Telefone (com máscara `(00) 00000-0000`, `input-edit-phone`), CPF (com máscara `000.000.000-00`, `input-edit-cpf`, validação de dígito verificador com mensagem de erro inline), Profissão, Área de Atuação, Localização, Status da Conta (`Select`: Ativo/Pendente/Bloqueado), Status da Assinatura (`Select`: Sem Assinatura/Ativa/Expirada/Cancelada/Reembolsada), checkbox "Administrador" (`checkbox-edit-admin`); campo Bio (`Textarea`, 3 linhas) em largura total. Rodapé: "Cancelar" / "Salvar Alterações" (texto muda para "Salvando..." durante pending).
  - **Diálogo "Ativar/Editar Assinatura"**: `Select` "Plano" com opções "Mensal - R$ 49,70" e "Anual - R$ 497,00"; campo "Data de Vencimento" (`input type="date"`, pré-preenchido com data de expiração existente ou +1 mês a partir de hoje). Rodapé: "Cancelar" / "Ativar Assinatura" (desabilitado sem data; texto "Ativando..." durante pending).
  - **`AlertDialog` "Excluir Usuário"**: título em vermelho com ícone `Trash2`; descrição avisando que a ação é irreversível e lista o que será excluído: assinaturas e pagamentos, posts e comentários, tópicos e respostas do fórum, páginas clonadas, saldo de vendedor, códigos de afiliado, pontos e badges, notificações. Botões "Cancelar" / "Sim, Excluir Usuário" (vermelho, texto "Excluindo..." durante pending).
  - **Diálogo "Importar CSV"**: mostra nome do arquivo selecionado; grid 2 colunas de `Select` de mapeamento de campo → coluna do CSV: "Campo: Nome*", "Campo: Email*" (obrigatórios, sem opção "Nenhum"), "Campo: Telefone" e "Campo: CPF" (com opção "Nenhum" = `__none__`). Rodapé: "Cancelar" / "Importar Usuários" (texto "Importando..." durante pending).
- **Fluxos do usuário**:
  - **Buscar/filtrar**: digita termo → Enter ou clica na lupa → lista refeita (reset para página 1); ou seleciona status no `Select` (reset para página 1).
  - **Editar usuário**: clica em "⋮" → "Editar Usuário" → formulário pré-preenchido abre → altera campos (com validação de CPF ao salvar) → "Salvar Alterações" → toast de sucesso/erro → diálogo fecha e lista é invalidada/recarregada.
  - **Ativar assinatura**: "⋮" → "Ativar Assinatura" → escolhe plano e data → "Ativar Assinatura" → toast → lista atualizada.
  - **Desativar assinatura**: "⋮" → "Desativar Assinatura" (só visível se ativa) → mutação direta, sem confirmação → toast.
  - **Alterar plano de acesso**: "⋮" → escolhe "Plano Full"/"Plano Basic"/"Plano Free" → mutação direta → toast com rótulo do plano.
  - **Bloquear/desbloquear**: "⋮" → "Bloquear/Desbloquear Acesso" → mutação direta (toggle) sem diálogo de confirmação.
  - **Excluir usuário**: "⋮" → "Excluir Usuário" → `AlertDialog` de confirmação com lista de dados afetados → "Sim, Excluir Usuário" → toast mostrando quantas tabelas foram afetadas.
  - **Exportar CSV**: clica "Exportar CSV" → GET ao endpoint → download automático de arquivo `usuarios-lowfy-{data}.csv` → toast de sucesso.
  - **Importar CSV**: clica "Importar CSV" → seleciona arquivo → cabeçalhos lidos do CSV client-side → diálogo de mapeamento abre com mapeamento padrão (nome de campo = nome de coluna) → ajusta mapeamentos → "Importar Usuários" → upload via `FormData` → toast com contagem de sucesso/erros.
- **Regras de negócio visíveis no código**:
  - Validação de CPF: 11 dígitos, rejeita sequências repetidas (`^(\d)\1{10}$`), calcula os 2 dígitos verificadores; bloqueia salvamento se inválido.
  - Plano de acesso (`accessPlan`) tem 3 estados: `full` (Acesso Completo), `basic` (Acesso Intermediário), `null`/free (Gratuito) — mutuamente exclusivos, cada opção desabilitada quando já é a atual.
  - "Desativar Assinatura" só aparece no menu quando `subscriptionStatus === "active"`.
  - Exclusão de usuário é destrutiva e em cascata (documentada na UI: assinaturas/pagamentos, posts/comentários, tópicos/respostas, páginas clonadas, saldo de vendedor, códigos de afiliado, pontos/badges, notificações).
  - Import CSV normaliza o sentinela `"__none__"` de volta para string vazia antes de enviar ao backend.
  - Página protegida por `AdminRoute` (gate de admin) no roteador.
- **Integrações e chamadas de API**:
  - `GET /api/admin/users-management?page&limit=15&search&status` → `{ users: UserWithSubscription[], pagination }`
  - `PUT /api/admin/users/:id` → atualização de usuário (usado tanto para edição completa quanto para bloqueio/desbloqueio e mudança de `accessPlan`)
  - `DELETE /api/admin/users/:id` → exclusão em cascata, retorna `deletedTables`
  - `PUT /api/admin/users/:userId/deactivate-subscription`
  - `POST /api/admin/users/:userId/activate-subscription` (body: `expiresAt`, `plan`)
  - `GET /api/admin/users/export-csv` (download de blob)
  - `POST /api/admin/users/import-csv` (multipart `FormData` com `file` + `fieldMapping`)
- **Dados exibidos**: `id`, `name`, `email`, `phone`, `cpf`, `createdAt`, `subscriptionStatus`, `subscriptionExpiresAt`, `accountStatus`, `latestSubscriptionPlan`, `latestSubscriptionAmount`, `latestSubscriptionPaidAt`, `profession`, `areaAtuacao`, `location`, `bio`, `isAdmin`, `accessPlan`.

---

### Página: /admin/bugs — AdminBugs

- **Arquivo fonte**: `client/src/pages/admin/AdminBugs.tsx` | **rota**: `/admin/bugs`
- **Objetivo**: permitir ao admin visualizar, triar e resolver tickets de suporte/bugs reportados pelos usuários, incluindo anexos de imagem/vídeo.
- **Layout geral**: página de largura máxima (`max-w-7xl`) com título + subtítulo, grid de 3 cards de contagem por status, um card único "Lista de Bugs" contendo uma tabela clicável, e um `Dialog` de detalhes do ticket selecionado.
- **Inventário completo de UI**:
  - 3 cards de contagem (`grid-cols-1 md:grid-cols-3`):
    - "Abertos" (ícone `AlertCircle`, vermelho) — `openTickets.length`
    - "Em Progresso" (ícone `Clock`, amarelo) — `inProgressTickets.length`
    - "Fechados" (ícone `CheckCircle`, verde) — `closedTickets.length`
  - Card "Lista de Bugs" com `Table`, colunas: Assunto, Usuário (nome + email em subtexto), Status (badge), Prioridade (badge), Data (`dd/MM/yyyy HH:mm`), Ações.
  - Badges de **status**: Aberto (destrutivo + ícone `AlertCircle`), Em Progresso (amarelo + ícone `Clock`), Fechado (secundário + ícone `CheckCircle`), fallback outline com o valor bruto.
  - Badges de **prioridade**: Alta (destrutivo), Média (laranja), Baixa (secundário), fallback outline com valor bruto.
  - Linha da tabela é clicável (abre diálogo de detalhes); botão de ação por linha: ícone `Trash2` (vermelho) que exclui o ticket diretamente (sem confirmação, com `stopPropagation` para não abrir o diálogo).
  - Estado vazio: ícone grande `Bug`, título "Nenhum bug reportado", texto "Os bugs reportados aparecerão aqui".
  - Estado de loading (antes de qualquer render de conteúdo): skeleton animado simples (`animate-pulse`) com duas barras (título + área da tabela).
  - **Dialog de detalhes do ticket** (`max-w-2xl`): título com ícone `Bug` + assunto; descrição "Reportado por {name} em {data 'às' hora}"; corpo:
    - Bloco "Mensagem:" com o texto completo do ticket (`whitespace-pre-wrap`, fundo `muted`).
    - Bloco "Anexos (N):" (se houver) — grid de miniaturas quadradas (`grid-cols-2 md:grid-cols-3`); imagens são clicáveis (abrem em nova aba) e vídeos usam elemento `<video controls>`; abaixo de cada miniatura, nome do arquivo e tamanho em MB.
    - Linha com badges de Status e Prioridade lado a lado.
    - Rodapé de ações condicionais por status:
      - Se `status === "open"`: botão "Marcar em Progresso" (ícone `Clock`)
      - Se `status !== "closed"`: botão "Marcar como Resolvido" (verde, ícone `CheckCircle`) — sempre visível enquanto não fechado
      - Se `status === "closed"`: botão "Reabrir" (outline, ícone `AlertCircle`) — volta status para "open"
- **Fluxos do usuário**:
  - **Ver detalhes**: clica em qualquer linha da tabela → diálogo abre com mensagem completa, anexos e ações de status.
  - **Alterar status**: dentro do diálogo, clica em "Marcar em Progresso" (de open→in_progress) ou "Marcar como Resolvido" (→closed) ou "Reabrir" (closed→open) → mutação `PATCH` → toast "Status atualizado" → lista de tickets invalidada/recarregada.
  - **Excluir bug**: na linha da tabela, clica no ícone de lixeira (sem passar pelo diálogo) → mutação `DELETE` direta → toast "Bug removido" → se o ticket excluído era o selecionado, diálogo fecha.
- **Regras de negócio visíveis no código**: transições de status seguem fluxo linear open → in_progress → closed, com possibilidade de reabertura (closed → open); não há validação de permissão adicional além do gate de `AdminRoute`; exclusão de ticket não pede confirmação (diferente da exclusão de usuário em AdminUsuarios).
- **Integrações e chamadas de API**:
  - `GET /api/admin/support-tickets` → `SupportTicket[]`
  - `PATCH /api/admin/support-tickets/:id/status` (body: `{ status }`)
  - `DELETE /api/admin/support-tickets/:id`
- **Dados exibidos**: `id`, `subject`, `message`, `email`, `name`, `phone` (opcional), `status`, `priority`, `createdAt`, `userId` (opcional), `attachments[]` (cada um com `id`, `url`, `type: 'image'|'video'`, `name`, `size`).

---

## Painel Admin — Conteúdo, Cursos, Marketplace e Serviços

### Página: /admin/conteudo — Gestão de Conteúdo (PLRs, Categorias, Idiomas)

- **Arquivo fonte**: `client/src/pages/admin/AdminConteudo.tsx` (1699 linhas) — rota `/admin/conteudo` (protegida por `AdminRoute`, registrada em `client/src/App.tsx` linha 280-282).
- **Objetivo**: gerenciar o catálogo de produtos PLR (Private Label Rights) vendidos/distribuídos na plataforma — cadastro, edição, exclusão em massa, downloads por tipo de conteúdo e idioma — além de gerenciar as tabelas auxiliares de Categorias e Idiomas usadas para classificar os PLRs.
- **Layout geral**: página com `padding: 50px`, componente raiz `ContentManagement` que renderiza um `Tabs` de 3 abas (grid de 3 colunas, fundo branco): "PLRs", "Categorias", "Idiomas". Cada aba renderiza um `Card` branco próprio com `CardHeader` (título + botões de ação) e `CardContent` (tabela).

#### Aba "PLRs" (`PLRsManagement`)

- **Inventário completo de UI**:
  - **Header do card**: título "PLRs"; botão "Importar do Drive" / "Importando..." (outline, `data-testid=button-import-drive`, desabilitado durante `importFromDriveMutation.isPending`); botão "Novo PLR" (`data-testid=button-create-plr`, ícone `Plus`) que abre um `Dialog` grande (max-w-7xl, altura 85vh, dividido em duas colunas: formulário à esquerda + prévia ao vivo à direita, largura fixa 320px).
  - **Dialog "Gerenciar PLR" / "Editar PLR"** — sub-`Tabs` interno com 5 abas (grid de 5 colunas):
    - **Aba "Básico"**: campo "Capa *" (Input URL de imagem, `data-testid=input-plr-cover`); "Categoria *" (Select populado por `/api/categories`, `data-testid=select-plr-category`); "Título do PLR *" (Input, `data-testid=input-plr-title`); "Descrição" (Textarea, 4 linhas, `data-testid=input-plr-description`); toggle "PLR Gratuito" (Switch, `data-testid=switch-plr-free`); se não gratuito, aparece campo "Preço (R$)" (Input number, convertido para centavos, `data-testid=input-plr-price`).
    - **Aba "Conteúdo"**: para cada um dos 5 tipos de conteúdo (E-book/BookOpen, VSL/TrendingUp, Página/Briefcase, Quiz/AlertCircle, Criativos/Settings) exibe um `Card` com: ícone, label, texto "Habilitado"/"Desabilitado", `Switch` para habilitar; quando habilitado, mostra seletor de "Idiomas Disponíveis" — chips clicáveis com bandeira (via `country-flag-icons`) + nome do idioma (populado por `/api/languages`, mapeamento código→bandeira: pt→BR, en→GB, es→ES, fr→FR, de→DE, it→IT, ja→JP, ko→KR, zh→CN, ru→RU, ar→SA, hi→IN) e campo "Link ou Upload" (Input de URL/link do arquivo).
    - **Aba "Links"**: seção "Links Extras" com botão "Adicionar Link" (`Plus`), lista de cards "Link Extra #N" cada um com campos "Título" e "URL" e botão de remover (`Trash2`, ghost); estado vazio "Nenhum link extra adicionado" (borda tracejada).
    - **Aba "Idiomas"**: apenas texto informativo redirecionando para a aba Conteúdo.
    - **Aba "Criativos"**: texto "Em desenvolvimento...".
    - Rodapé do formulário: botão "Cancelar" (outline, fecha dialog) e botão "Criar PLR"/"Atualizar PLR"/"Salvando..." (submit, desabilitado durante mutação).
  - **Painel de Prévia do PLR** (coluna direita, fixa): título "Prévia do PLR" com ícone `BookOpen`; miniatura da capa (aspecto 4:3, com tratamento de erro de imagem exibindo mensagem "Erro ao carregar imagem / Verifique o link do Google Drive"); título digitado; badge verde com nome da categoria; bloco "Descrição" (line-clamp 4); bloco "Downloads Disponíveis" — `Accordion` colapsável por tipo de conteúdo habilitado, mostrando quantidade de idiomas e, expandido, lista de idiomas com bandeira; bloco "Status" — badge verde "Gratuito" ou badge amarelo com preço formatado em R$.
  - **Filtros e busca** (CardContent, acima da tabela): campo "Buscar PLRs" (Input com ícone `Search`, busca por título); Select "Categoria" (Todas + lista de categorias); Select "Status" (Todos/Ativos/Inativos); Select "Preço" (Todos/Gratuitos/Pagos). Todos resetam a paginação ao mudar (`handleFilterChange`/`handleSearchChange`).
  - **Barra de seleção em massa**: aparece quando `selectedPLRs.size > 0`, mostra "N selecionado(s)" e botão "Excluir Selecionados" (destructive, `Trash2`) que pede `confirm()` do navegador antes de disparar `deleteMultipleMutation`.
  - **Contadores**: "Total de PLRs: N" e "Exibindo X-Y de Z" (calculados sobre a lista filtrada).
  - **Tabela de PLRs** — colunas: checkbox (seleção individual/geral), Título, Categoria, Idiomas (bandeiras dos idiomas com download cadastrado, com tooltip do nome), Preço ("Gratuito" ou "R$ X,XX"), Status (badge Ativo/Inativo), Data de Criação (formatada pt-BR, fuso America/Sao_Paulo), Ações (botão editar `Edit` e botão excluir `Trash`, ambos ghost, cada um com `data-testid` por linha).
  - **Paginação**: 10 itens por página; botões "Anterior"/"Próximo" e botões numerados de página.
  - **Estado de carregamento**: `Skeleton` de altura 64 enquanto `isLoading`.
- **Fluxos do usuário**:
  - Criar PLR: clica "Novo PLR" → preenche aba Básico (capa, categoria, título, descrição, gratuito/preço) → vai à aba Conteúdo, habilita tipos de conteúdo, seleciona idiomas e cola link de cada → opcionalmente adiciona Links Extras → clica "Criar PLR" → sistema valida (título, descrição, categoria, capa obrigatórios; cada tipo habilitado precisa de link preenchido; é obrigatório ao menos um e-book em algum idioma; links extras precisam de título e URL) → em sucesso, cria o PLR via `POST /api/plrs` e depois um `POST /api/plrs/bulk/downloads` por combinação tipo×idioma habilitada.
  - Editar PLR: clica ícone de edição na linha → dialog abre pré-preenchido (inclusive downloads agrupados por tipo/idioma) → altera → salva → `PUT /api/plrs/:id`, seguido de `DELETE /api/plrs/:id/downloads` (limpa downloads antigos) e recriação via `POST /api/plrs/bulk/downloads`.
  - Excluir um PLR: botão de lixeira na linha → `DELETE /api/plrs/:id` (sem confirmação de diálogo).
  - Excluir em massa: seleciona checkboxes → botão "Excluir Selecionados" → `confirm()` nativo → `DELETE /api/plrs/:id` para cada id selecionado em paralelo.
  - Importar do Google Drive: clica "Importar do Drive" → `POST /api/admin/import-from-drive` com `folderId` fixo `"1itfq6kODRr77zVLF_xVHtdSsSwkkgUwR"` → toast informando que a importação está em andamento (assíncrona no servidor).
- **Regras de negócio visíveis no código**:
  - Título, descrição, categoria e capa são obrigatórios na criação/edição.
  - Cada tipo de conteúdo habilitado exige idiomas selecionados e link preenchido para ser incluído.
  - É obrigatório existir ao menos um download do tipo "ebook" em algum idioma.
  - Preço é armazenado em centavos (campo exibido em R$ dividido/multiplicado por 100).
  - URLs de imagem/arquivo do Google Drive são normalizadas automaticamente via `convertGoogleDriveUrl` (extrai `fileId` de `/file/d/ID` ou `?id=ID` e converte para `https://drive.google.com/uc?export=view&id=ID`).
  - Links extras exigem título e URL preenchidos.
- **Integrações e chamadas de API**: `GET /api/plrs` (lista paginada `{data, total}`), `GET /api/categories`, `GET /api/languages`, `POST /api/plrs`, `PUT /api/plrs/:id`, `DELETE /api/plrs/:id`, `DELETE /api/plrs/:id/downloads`, `POST /api/plrs/bulk/downloads`, `POST /api/admin/import-from-drive` (integração com Google Drive).
- **Dados exibidos**: entidade `PLRWithRelations` (title, description, coverImageUrl, categoryId/category, countryCode, price, isFree, isActive, extraLinks[{title,url}], downloads[{type, fileUrl, languageId, language}], createdAt), `Category` (id, name, slug, description), `Language` (id, name, code).

#### Aba "Categorias" (`CategoriesManagement`)

- **Inventário completo de UI**: header com título "Categorias" e botão "Nova Categoria" (`Plus`, `data-testid=button-create-category`) que abre `Dialog` simples com formulário: campo "Nome" (Input, `data-testid=input-category-name`), "Slug" (Input, `data-testid=input-category-slug`), "Descrição (opcional)" (Textarea); botão "Criar"/"Atualizar" (`data-testid=button-submit-category`). Tabela com colunas Nome, Slug, Descrição, Ações (botão editar outline + botão excluir destructive, ambos com ícones). `Skeleton` no carregamento.
- **Fluxos**: criar categoria (preenche nome/slug/descrição → `POST /api/categories`); editar (clica editar → dialog pré-preenchido → `PUT /api/categories/:id`); excluir (`DELETE /api/categories/:id`, sem confirmação).
- **Integrações**: `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id`.
- **Dados exibidos**: `Category` (id, name, slug, description).

#### Aba "Idiomas" (`LanguagesManagement`)

- **Inventário completo de UI**: header "Idiomas" + botão "Novo Idioma" (`Plus`, `data-testid=button-create-language`) abrindo `Dialog` com campos "Nome" (Input) e "Código (ex: pt-BR)" (Input); botão "Criar"/"Atualizar" (`data-testid=button-submit-language`). Tabela com colunas: Bandeira (ícone circular de bandeira do país mapeado a partir do código do idioma, com fallback mostrando o código em texto quando não há componente de bandeira), Nome, Código, Ações (editar/excluir). `Skeleton` no carregamento.
- **Fluxos**: criar idioma (`POST /api/languages`); editar (`PUT /api/languages/:id`); excluir (`DELETE /api/languages/:id`).
- **Integrações**: `GET /api/languages`, `POST /api/languages`, `PUT /api/languages/:id`, `DELETE /api/languages/:id`. Uso da lib `country-flag-icons/react/3x2` para renderizar bandeiras.
- **Dados exibidos**: `Language` (id, name, code).

---

### Página: /admin/cursos — Gestão de Cursos

- **Arquivo fonte**: `client/src/pages/admin/AdminCursos.tsx` (499 linhas) — rota `/admin/cursos` (`App.tsx` linha 283-285).
- **Objetivo**: cadastrar, editar, sincronizar (via Google Drive) e remover cursos exibidos na plataforma. Não há gestão de módulos/aulas individuais nesta tela — o curso é tratado como uma unidade única com URL externa, não há upload de vídeo nesta página (apenas campos de URL/thumbnail e sincronização em lote pelo Drive).
- **Layout geral**: `padding: 50px`, um único `Card` branco ("Cursos") com `CardHeader` (título + botões) e `CardContent` (busca + tabela + paginação). Não há abas.
- **Inventário completo de UI**:
  - Botão "Sincronizar do Drive" / "Sincronizando..." (outline, ícone `RefreshCw` com animação de spin durante `syncMutation.isPending`, `data-testid=button-sync-courses`).
  - Botão "Novo Curso" (`Plus`, `data-testid=button-create-course`) abre `Dialog` (max-w-2xl) "Novo Curso"/"Editar Curso" com campos: "Título" (Input, `input-course-title`), "Descrição" (Textarea, `input-course-description`), "Duração" (Input, `input-course-duration`) e "Número de Aulas" (Input number, `input-course-lesson-count`) lado a lado; "URL do Curso" (Input, `input-course-url`); "URL da Thumbnail (opcional)" (Input, `input-course-thumbnail`); três switches lado a lado: "Ativo" (`switch-course-active`), "Novo" (`switch-course-new`), "Popular" (`switch-course-popular`); botão submit "Criar"/"Atualizar" (`button-submit-course`).
  - Barra de busca: Input com ícone `Search`, placeholder "Buscar cursos por título, descrição ou categoria..." (`data-testid=input-search-admin-courses`), filtra por título, descrição ou categoria (client-side, `useMemo`).
  - Texto "Total: N curso(s)" (`data-testid=text-total-courses`).
  - Tabela — colunas: Título, Duração, Aulas, Status (badge Ativo/Inativo), Ações (botão editar outline `Edit`, botão excluir destructive `Trash`, com `data-testid` por curso).
  - Estado vazio: linha "Nenhum curso encontrado" (colSpan 5, texto cinza centralizado).
  - Estado de carregamento: `Skeleton` altura 64.
  - Paginação (10 itens/página, só aparece se `totalPages > 1`): texto "Mostrando X a Y de Z itens" (`text-page-info`); botão "Anterior" (`ChevronLeft`, `button-prev-page`); botões numerados com lógica de reticências (mostra primeira página + "..." se página atual > 3/4; mostra 2 páginas antes/depois da atual; mostra última página + "..." se distante); botão "Próxima" (`ChevronRight`, `button-next-page`).
- **Fluxos do usuário**:
  - Criar curso: clica "Novo Curso" → preenche formulário → "Criar" → `POST /api/courses`.
  - Editar curso: clica ícone de edição → dialog pré-preenchido com dados atuais → "Atualizar" → `PUT /api/courses/:id`.
  - Excluir curso: clica ícone de lixeira → `DELETE /api/courses/:id` (sem diálogo de confirmação).
  - Sincronizar do Drive: clica "Sincronizar do Drive" → `POST /api/sync/courses` → toast com quantidade de cursos sincronizados (`data.coursesCount`).
  - Buscar/paginar: digitar no campo de busca reseta para página 1; navegar entre páginas via botões.
- **Regras de negócio visíveis no código**: schema de validação via `insertCourseSchema` (zod) — campos obrigatórios conforme schema compartilhado; paginação client-side reseta automaticamente para a última página válida se a página atual ultrapassar o total após filtragem (via `useEffect`).
- **Integrações e chamadas de API**: `GET /api/courses`, `POST /api/courses`, `PUT /api/courses/:id`, `DELETE /api/courses/:id`, `POST /api/sync/courses` (sincronização em lote com Google Drive).
- **Dados exibidos**: entidade `Course` (id, title, description, duration, lessonCount, thumbnailUrl, courseUrl, category, isActive, isNew, isPopular).

---

### Página: /admin/marketplace — Moderação de Produtos do Marketplace

- **Arquivo fonte**: `client/src/pages/admin/AdminMarketplace.tsx` (874/875 linhas) — rota `/admin/marketplace` (`App.tsx` linha 286-288).
- **Objetivo**: permitir que o admin visualize, edite, bloqueie/desbloqueie, exclua e compartilhe links de produtos cadastrados por vendedores no marketplace da plataforma, funcionando como painel de moderação/curadoria.
- **Layout geral**: `padding: 24px` (p-6), sem abas — cabeçalho de página com título "Moderação de Produtos" + subtítulo + botão de link para políticas, seguido de um único `Card` com tabela de produtos e vários dialogs/modais acionados por ações.
- **Inventário completo de UI**:
  - **Header da página**: título "Moderação de Produtos" (`data-testid=page-title`), subtítulo "Gerencie e modere todos os produtos do marketplace"; botão "Ver Políticas" (outline, `ExternalLink`, `data-testid=button-view-policies`) que abre `/marketplace/politicas` em nova aba.
  - **Card "Produtos do Marketplace"**: título com badge "N produtos" (secondary) quando há produtos.
  - **Estados**: skeleton (3 barras) durante loading; estado de erro com ícone `AlertTriangle` + "Erro ao carregar produtos" + botão "Tentar novamente" (`button-retry`, chama `refetch()`); estado vazio "Nenhum produto encontrado" (`data-testid=empty-state`).
  - **Tabela de produtos** — colunas: Nome (truncado, max-w-200px), Vendedor (nome + email em duas linhas), Data (formatada pt-BR), Preço (formatado em BRL via `Intl.NumberFormat`), Categoria (badge com label mapeado das `CATEGORIES`: Plugin, Template, Curso, Produto Digital, Outros), Vendas (contagem), Status (badge "Bloqueado" vermelho com motivo do bloqueio truncado abaixo / badge "Ativo" verde / badge "Inativo" secondary), Ações (dropdown menu `MoreHorizontal`).
  - **Dropdown de Ações por produto** (`DropdownMenu`): "Ver Produto" (`Eye`, abre página pública em nova aba), "Ver Links" (`LinkIcon`, abre dialog de links), separador, "Editar" (`Edit2`, abre dialog de edição), condicional: "Desbloquear" (`LockOpen` verde, se bloqueado) ou "Bloquear" (`Lock` âmbar, se não bloqueado), separador, "Excluir" (`Trash2`, vermelho, abre dialog de confirmação).
  - **Dialog "Bloquear Produto"**: ícone `Lock`, descrição "O vendedor será notificado por email sobre o bloqueio"; card com título e vendedor (nome + email) do produto selecionado; campo obrigatório "Motivo do bloqueio *" (Textarea, `textarea-block-reason`); aviso âmbar com `AlertTriangle` explicando que o vendedor recebe e-mail e link para as políticas; botões "Cancelar" e "Bloquear Produto"/"Bloqueando..." (destructive, `button-confirm-block`, valida que o motivo não está vazio antes de enviar).
  - **Dialog "Editar Produto"** (max-w-lg): campos "Nome do Produto" (Input), "Descrição" (Textarea), "Preço (centavos)" (Input number, com preview do valor formatado em R$ abaixo), "Categoria" (Select com as `CATEGORIES`), "URL do Produto" (Input), seção "Imagens do Produto" — grid 3 colunas com miniaturas 20px de altura, botão de remover (X vermelho) em hover, badge numérico de ordem, fallback de imagem quebrada (SVG placeholder inline), campo para colar nova URL de imagem + botão "+" (`ImagePlus`) para adicionar (também aceita Enter), texto de ajuda; toggle "Produto Ativo" (Switch) com texto explicativo "Produtos inativos não aparecem no marketplace"; botões "Cancelar" e "Salvar Alterações"/"Salvando...".
  - **Dialog "Links do Produto"**: lista de cards com Página do Produto, Link Amigável (Slug) (se existir slug), Perfil do Vendedor, URL Externa do Produto (se existir) — cada linha mostra a URL truncada e dois botões: copiar (`Copy`/`Check` ao copiar, via `navigator.clipboard`) e abrir em nova aba (`ExternalLink`); botão "Fechar".
  - **AlertDialog "Excluir Produto"**: confirma exclusão permanente com nome do produto em negrito, aviso "Esta ação não pode ser desfeita"; botões "Cancelar" e "Excluir"/"Excluindo..." (vermelho, `bg-red-600`).
- **Fluxos do usuário**:
  - Bloquear produto: menu de ações → "Bloquear" → preenche motivo obrigatório → "Bloquear Produto" → `POST /api/admin/marketplace/block/:productId` com `{reason}` → toast confirmando envio de e-mail ao vendedor.
  - Desbloquear produto: menu de ações → "Desbloquear" → `POST /api/admin/marketplace/unblock/:productId`.
  - Editar produto: menu de ações → "Editar" → altera campos (incluindo gerenciamento de imagens por URL) → "Salvar Alterações" → `PUT /api/admin/marketplace/products/:productId`.
  - Excluir produto: menu de ações → "Excluir" → confirma no AlertDialog → `DELETE /api/admin/marketplace/products/:productId`.
  - Visualizar/copiar links: menu de ações → "Ver Links" → copia ou abre qualquer um dos links do produto (página pública, slug, perfil do vendedor, URL externa).
  - Ver produto/políticas: abre em nova aba a página pública do produto ou a página de políticas do marketplace.
- **Regras de negócio visíveis no código**:
  - Motivo do bloqueio é obrigatório (validação antes de enviar).
  - Produto bloqueado exibe status distinto de "Inativo"/"Ativo" e tem prioridade visual (badge vermelho + motivo).
  - Produtos inativos (isActive=false) não aparecem no marketplace público (conforme texto explicativo do switch).
  - Preço tratado em centavos (campo bruto exposto no formulário de edição, com conversão de exibição).
  - Categorias restritas a um conjunto fixo: plugin, template, course, digital, other.
- **Integrações e chamadas de API**: `GET /api/admin/marketplace/products`, `POST /api/admin/marketplace/block/:productId`, `POST /api/admin/marketplace/unblock/:productId`, `PUT /api/admin/marketplace/products/:productId`, `DELETE /api/admin/marketplace/products/:productId`; navegação externa para `/marketplace/produto/:id`, `/marketplace/produto/:slug`, `/marketplace/vendedor/:sellerId`, `/marketplace/politicas`. Envio de e-mail ao vendedor é mencionado (efeito colateral do bloqueio) mas o serviço de e-mail em si não é chamado diretamente pelo frontend.
- **Dados exibidos**: `MarketplaceProduct` (id, title, description, sellerId, sellerName, sellerEmail, price, category, images[], productUrl, slug, isDigital, isActive, isBlocked, blockReason, blockedAt, salesCount, rating, reviewCount, createdAt, updatedAt).

---

### Página: /admin/servicos — Gestão de Serviços Contratáveis

- **Arquivo fonte**: `client/src/pages/admin/AdminServicos.tsx` (1344 linhas) — rota `/admin/servicos` (`App.tsx` linha 292-294).
- **Objetivo**: gerenciar quatro conjuntos de dados relacionados a serviços e ferramentas oferecidos pela plataforma: pacotes White Label vendáveis, catálogo de Ferramentas de IA disponíveis aos usuários (com credenciais de acesso compartilhado), acessos globais de IA (credenciais reutilizáveis) e as configurações únicas do produto "Quiz Interativo".
- **Layout geral**: `padding: 50px`, componente raiz `ServicesManagement` com `Tabs` de 4 colunas: "White Label", "FERRAMENTAS IA", "ACESSOS GLOBAIS", "QUIZ INTERATIVO". Cada aba é um `Card` independente.

#### Aba "White Label" (`ServicesTab`)

- **Inventário completo de UI**: header "White Label" + botão "Novo White Label" (`Plus`, `button-create-service`) abrindo `Dialog` (max-w-2xl, scroll vertical) com: campo de imagem — preview 48px altura com botão de remoção (`X`, destructive) se houver imagem, botão "Selecionar Imagem"/"Enviando..." (`Upload`, dispara input de arquivo oculto que faz upload real via `fetch('/api/upload-image', {method:'POST', body: FormData}, credentials:'include')`); "Nome" (Input); "Descrição" (Textarea); "Preço (centavos)" (Input number); "Benefícios (um por linha)" (Textarea, 5 linhas, convertido em array por linha no submit); switches "Ativo" e "Popular" lado a lado; botão submit "Criar"/"Atualizar". Tabela — colunas Nome, Preço (R$ formatado), Status (badge), Ações (editar/excluir). `Skeleton` no loading.
- **Fluxos**: criar/editar/excluir serviço White Label (`POST`/`PUT`/`DELETE /api/services`); upload de imagem separado via endpoint dedicado antes de submeter o formulário.
- **Regras de negócio**: `benefits` é uma lista de strings derivada do texto multilinha (`benefitsText`, filtrando linhas vazias) — o schema real (`insertServiceSchema`) omite `benefits` bruto do formulário, sendo reconstruído no `onSubmit`.
- **Integrações**: `GET /api/services`, `POST /api/services`, `PUT /api/services/:id`, `DELETE /api/services/:id`, `POST /api/upload-image` (upload de arquivo).
- **Dados exibidos**: `Service` (id, name, description, priceCents, benefits[], isActive, isPopular, imageUrl).

#### Aba "FERRAMENTAS IA" (`AIToolsTab`)

- **Inventário completo de UI**: header "FERRAMENTAS IA" + botão "Nova Ferramenta" (`Plus`, `button-create-ai-tool`) abrindo `Dialog` grande (max-w-4xl, scroll) com: "Nome *" e "Categoria *" lado a lado — Select de categoria com 18 opções fixas (Ferramentas de Mineração, Inteligência Artificial, Design, SEO, Cortesia, Infoprodutos, Brinde, Manutenção, IA Conversacional, Criação de Imagens e Vídeos, Edição, Apresentações, Banco de Imagens, Texto, Vídeo, Áudio, Código, Análise, Outros); "Descrição" (Textarea); "URL da Ferramenta *" e "URL do Logo" lado a lado (com texto de ajuda exemplificando URL de logo do CapCut); "URL do Vídeo Tutorial" (Input); "Instruções de Uso" (Textarea); seção "Credenciais de Acesso" — botão "Adicionar Credencial" (`Plus`) cria cartões com campos "Rótulo", "Login/Email", "Senha" (texto plano, tipo `text`) e botão de remover (`X`) por credencial; switch "Ferramenta Ativa"; botão submit "Criar"/"Atualizar". Tabela — colunas Nome, Categoria (badge outline), Credenciais (contagem numérica), Status (badge: "Em Manutenção" laranja / "Ativo" / "Inativo"), Ações (dropdown `MoreVertical`: "Editar", "Colocar em Manutenção"/"Remover Manutenção" com ícone `Wrench`, "Excluir" vermelho).
- **Fluxos**: criar/editar ferramenta IA (`POST`/`PUT /api/ai-tools`), incluindo array de credenciais (`accessCredentials`); alternar manutenção sem abrir o dialog completo (toggle direto via `toggleMaintenanceMutation`, `PUT /api/ai-tools/:id` só com o campo `isUnderMaintenance`); excluir (`DELETE /api/ai-tools/:id`).
- **Regras de negócio**: campo `accessCredentials` é opcional — só enviado se houver ao menos uma credencial adicionada; ferramentas em manutenção têm badge visual distinta (laranja) mesmo se `isActive=true`.
- **Integrações**: `GET /api/admin/ai-tools`, `POST /api/ai-tools`, `PUT /api/ai-tools/:id`, `DELETE /api/ai-tools/:id` (e invalidação também de `/api/ai-tools`, endpoint público consumido pelos usuários).
- **Dados exibidos**: `AITool` (id, name, description, toolUrl, iconType, category, logoUrl, videoUrl, instructions, isActive, isUnderMaintenance, accessCredentials[{label, login, password}]).

#### Aba "ACESSOS GLOBAIS" (`GlobalAccessTab`)

- **Inventário completo de UI**: header "ACESSOS GLOBAIS" + botão "Novo Acesso" (`button-create-global-access`) abrindo `Dialog` com campos "Rótulo/Nome *" (placeholder "Ex: ACESSO 1"), "Login/Email *", "Senha *" (input tipo `password`), "Ordem de Exibição" (Input number), switch "Acesso Ativo"; botão submit. Tabela — colunas Rótulo, Login, Senha (sempre mascarada como "••••••••" independente do valor real), Ordem, Status (badge), Ações (editar/excluir).
- **Fluxos**: criar/editar/excluir credenciais de acesso global (`POST`/`PUT`/`DELETE /api/global-ai-access`).
- **Regras de negócio**: senha nunca é exibida em texto plano na tabela (mascarada), mas é reenviada em texto plano ao editar (campo populado com o valor real vindo da API); campo "Ordem" controla a posição de exibição.
- **Integrações**: `GET /api/admin/global-ai-access`, `POST /api/global-ai-access`, `PUT /api/global-ai-access/:id`, `DELETE /api/global-ai-access/:id` (invalida também `/api/global-ai-access` público).
- **Dados exibidos**: `GlobalAIAccess` (id, label, login, password, order, isActive).

#### Aba "QUIZ INTERATIVO" (`QuizInterativoTab`)

- **Inventário completo de UI**: header com título "Configurações - Quiz Interativo" e subtítulo; botão único que alterna entre "Criar Configurações" (`Plus`, quando não há settings) e "Editar Configurações" (`Edit`, quando já existe), abrindo `Dialog` (max-w-2xl) com: "URL do Vídeo (Opcional)" (Input, placeholder embed do YouTube), "URL da Plataforma *", "Login/Email *", "Senha *" (input tipo `password`), switch "Configuração Ativa"; botão submit "Criar"/"Atualizar"/"Salvando...".
  - Quando já existem configurações salvas: exibição em modo somente leitura (fora do dialog) em grid 2 colunas com blocos "URL do Vídeo", "URL da Plataforma", "Login" e "Senha" (todos exibidos em texto monoespaçado, sem mascaramento), mais um indicador de "Status" com badge.
  - Estado vazio: "Nenhuma configuração cadastrada" + botão "Criar Configurações".
  - `Skeleton` durante loading.
- **Fluxos**: como é uma configuração singular (não uma lista), o botão do header decide entre `createMutation` (`POST /api/quiz-interativo/settings`) se `settings` não existe, ou `updateMutation` (`PUT /api/quiz-interativo/settings/:id`) se já existe um registro.
- **Regras de negócio**: entidade singleton — a tela sempre trata a existência de no máximo um registro de configurações; senha exibida em texto plano na visualização (sem mascaramento, diferente da aba de Acessos Globais).
- **Integrações**: `GET /api/quiz-interativo/settings`, `POST /api/quiz-interativo/settings`, `PUT /api/quiz-interativo/settings/:id`.
- **Dados exibidos**: `QuizInterativoSettings` (id, videoUrl, platformUrl, login, password, isActive).

---

### Página: /admin/comunidade — Moderação de Comunidade (Fórum e Suporte)

- **Arquivo fonte**: `client/src/pages/admin/AdminComunidade.tsx` (221/222 linhas) — rota `/admin/comunidade` (`App.tsx` linha 289-291).
- **Objetivo**: permitir que o admin modere tópicos do fórum da comunidade (fixar, fechar, excluir) e gerencie o status de tickets de suporte abertos pelos usuários. Não há um fluxo de "denúncias" explícito no código — a moderação é feita diretamente sobre os tópicos existentes (não há tabela/lista de reports/flags).
- **Layout geral**: `padding: 50px`, componente raiz `CommunityManagement` com `Tabs` de 2 colunas: "Fórum" e "Tickets de Suporte". Cada aba é um `Card` simples com tabela.

#### Aba "Fórum" (`ForumManagement`)

- **Inventário completo de UI**: header "Moderação do Fórum" (sem botão de criação — não há CRUD de criação de tópicos aqui, apenas moderação de tópicos já criados pelos usuários). Tabela — colunas: Título, Autor (nome), Visualizações (`viewCount`), Respostas (`replyCount`), Status (badges condicionais: "Fixado" secondary se `isSticky`, "Fechado" destructive se `isClosed` — podem aparecer ambos simultaneamente), Ações — três botões por linha: alternar fixado (`Pin`/`PinOff`, outline), alternar fechado (`Lock`/`Unlock`, outline), excluir (`Trash`, destructive). `Skeleton` no loading.
- **Fluxos do usuário**:
  - Fixar/desafixar tópico: clica no botão de pin → `PATCH /api/forum/topics/:id` com `{isSticky: !atual}`.
  - Fechar/reabrir tópico: clica no botão de cadeado → `PATCH /api/forum/topics/:id` com `{isClosed: !atual}`.
  - Excluir tópico: clica no botão de lixeira → `DELETE /api/forum/topics/:id` (sem diálogo de confirmação no código).
- **Regras de negócio**: nenhuma restrição de plano/permissão visível além do acesso à própria rota admin; toggles são otimistas apenas na medida em que a mutação invalida a query após sucesso (não há atualização otimista local).
- **Integrações**: `GET /api/forum/topics`, `PATCH /api/forum/topics/:id`, `DELETE /api/forum/topics/:id`.
- **Dados exibidos**: `ForumTopicWithRelations` (id, title, author{name}, viewCount, replyCount, isSticky, isClosed).

#### Aba "Tickets de Suporte" (`TicketsManagement`)

- **Inventário completo de UI**: header "Tickets de Suporte" (sem botão de criação). Tabela — colunas: Assunto, Usuário (nome), Status (badge: variant `default` se "open", `secondary` se "in_progress", `outline` caso contrário — exibe o valor bruto do status, ex: "open"/"in_progress"/"closed"), Prioridade (badge: `destructive` se "high", `secondary` se "medium", `outline` caso contrário — exibe valor bruto), Ações — `Select` "Alterar Status" com opções "Aberto" (open), "Em Progresso" (in_progress), "Fechado" (closed). `Skeleton` no loading.
- **Fluxos do usuário**: alterar status de um ticket — seleciona nova opção no dropdown da linha → `PATCH /api/admin/support-tickets/:id/status` com `{status}` → toast de confirmação e refresh da lista.
- **Regras de negócio**: nenhuma validação adicional visível; o Select não reflete visualmente o valor atual selecionado (não usa `value` controlado, apenas `onValueChange`, então sempre reabre no placeholder "Alterar Status").
- **Integrações**: `GET /api/admin/support-tickets`, `PATCH /api/admin/support-tickets/:id/status`.
- **Dados exibidos**: `SupportTicketWithRelations` (id, subject, user{name}, status, priority).

---

## Painel Admin — Financeiro, Afiliados, Vendedores, IA e WhatsApp

### Página: /admin/financeiro — Financeiro

- **Arquivo fonte**: `client/src/pages/admin/AdminFinanceiro.tsx` — rota `/admin/financeiro` (App.tsx linha 298).
- **Objetivo**: dar ao administrador uma visão consolidada da saúde financeira da plataforma (assinaturas), permitindo filtrar por período e visualizar receita, novas assinaturas e cancelamentos ao longo do tempo.
- **Layout geral**: página de coluna única (`max-w-7xl`), com cabeçalho (título + botão "Atualizar"), um card de filtros de período, uma grade de 5 stat-cards, dois gráficos lado a lado (grid 2 colunas em telas grandes) e um terceiro gráfico full-width abaixo.
- **Inventário completo de UI**:
  - Header: título "Financeiro", subtítulo "Métricas e análises de assinaturas", botão **Atualizar** (ícone `RefreshCw`) que dispara `refetchSummary()` e `refetchTimeseries()`.
  - Card "Filtros de Período" (ícone `Calendar`):
    - Select **Período Predefinido** com opções: Hoje, Últimos 7 dias, Últimos 30 dias, Este mês, Mês passado, Últimos 3 meses, Últimos 6 meses, Últimos 12 meses, Personalizado.
    - Input **Data Início** (type date).
    - Input **Data Fim** (type date).
    - Select **Agrupar por**: Dia, Semana, Mês (usado nos gráficos).
    - Alterar datas manualmente muda o preset automaticamente para "Personalizado".
  - Grade de 5 stat-cards (com skeleton de loading — 5 placeholders `h-32`):
    - **Receita Total** (ícone `DollarSign`, verde) — `summary.totalRevenue` formatado em BRL (centavos/100).
    - **Total Assinaturas** (ícone `Users`, azul) — `summary.totalSubscriptions`.
    - **Novas** (ícone `TrendingUp`, esmeralda) — `summary.newSubscriptions`.
    - **Ativas** (ícone `BarChart3`, roxo) — `summary.activeSubscriptions`.
    - **Canceladas** (ícone `TrendingDown`, vermelho) — `summary.canceledSubscriptions`.
  - Card "Receita ao Longo do Tempo" — gráfico de área (`AreaChart` do recharts): eixo X = data formatada conforme `groupBy` (dd/MM ou MMM/yy), eixo Y com prefixo "R$", área verde (`#10b981`) plotando `revenueFormatted`. Tooltip mostra "R$ X,XX". Skeleton `h-[300px]` durante loading.
  - Card "Novas vs Canceladas" — gráfico de barras (`BarChart`): duas séries de barras, "Novas" (verde) e "Canceladas" (vermelho), com legenda.
  - Card "Tendência de Assinaturas" — gráfico de linhas (`LineChart`, altura 400px): duas linhas — "Novas Assinaturas" (verde) e "Cancelamentos" (vermelho), com pontos e legenda.
- **Fluxos do usuário**:
  1. Selecionar um período predefinido no dropdown → datas e `groupBy` são recalculados automaticamente → queries reexecutam (via `queryKey` dependente de startDate/endDate/groupBy) → stats e gráficos atualizam.
  2. Editar manualmente Data Início/Fim → preset muda para "Personalizado" → dados atualizam.
  3. Clicar em "Atualizar" → força refetch de summary e timeseries sem mudar filtros.
- **Regras de negócio visíveis no código**: valores monetários armazenados em centavos (divididos por 100 na formatação); nenhuma checagem de permissão visível no componente em si (assume-se proteção de rota em nível superior/admin).
- **Integrações e chamadas de API**:
  - `GET /api/admin/finance/summary?startDate&endDate` → `FinanceSummary`.
  - `GET /api/admin/finance/timeseries?startDate&endDate&groupBy` → `TimeseriesResponse` (série com `date`, `newSubscriptions`, `canceledSubscriptions`, `revenue`).
- **Dados exibidos**: `totalSubscriptions`, `activeSubscriptions`, `newSubscriptions`, `canceledSubscriptions`, `totalRevenue`, período (`startDate`/`endDate`), série temporal (`date`, `newSubscriptions`, `canceledSubscriptions`, `revenue`).

---

### Página: /admin/checkout-abandonado — Checkouts Abandonados

- **Arquivo fonte**: `client/src/pages/admin/AdminCheckoutAbandonado.tsx` — rota `/admin/checkout-abandonado` (App.tsx linha 301).
- **Objetivo**: listar leads que iniciaram (mas não concluíram) o checkout de assinatura, permitindo ao admin fazer remarketing manual (copiar link de recuperação, enviar WhatsApp ou email).
- **Layout geral**: coluna única, header com título/subtítulo e botão Atualizar; grade de 3 stat-cards; card de filtros de período; card com tabela paginada de checkouts abandonados.
- **Inventário completo de UI**:
  - Header: título "Checkouts Abandonados", subtítulo "Leads que iniciaram mas não concluíram o checkout", botão **Atualizar** (`refetch()`).
  - 3 stat-cards:
    - **Total Abandonados** (ícone `ShoppingCart`, laranja) — `pagination.total`.
    - **Aguardando PIX** (ícone `Clock`, azul) — contagem de `paymentMethod === "pix"` na página atual.
    - **Falha no Cartão** (ícone `AlertTriangle`, roxo) — contagem de `paymentMethod === "credit_card"` na página atual.
  - Card "Filtros de Período": Select preset (Hoje, 7 dias, 30 dias, 3 meses, 6 meses, Todos, Personalizado), Input Data Início, Input Data Fim.
  - Card "Lista de Checkouts Abandonados":
    - Tabela com colunas: **Data**, **Nome**, **Email** (link `mailto:`), **Telefone** (link `wa.me` quando presente), **Plano** (badge: Mensal/Anual), **Valor** (BRL), **Método** (PIX/Cartão de Crédito), **Status** (badge: "Aguardando Pagamento" amarelo / "Pendente" cinza / outro), **Ações** (dropdown menu).
    - Dropdown de Ações por linha (ícone `MoreHorizontal`) com itens:
      - **Copiar Link** (ícone `Copy`/`Check` ao copiar) — copia URL de recuperação de checkout para a área de transferência.
      - **Enviar WhatsApp** (verde) — abre `wa.me` com mensagem pré-formatada de recuperação.
      - **Enviar Email** (azul) — abre `mailto:` com assunto/corpo pré-formatados.
    - Paginação: texto "Mostrando X de Y checkouts abandonados", botões **Anterior**/**Próxima**, indicador "Página X de Y".
    - Estado vazio: ícone `ShoppingCart` + "Nenhum checkout abandonado encontrado no período selecionado."
    - Estado de loading: 5 skeletons `h-16`.
- **Fluxos do usuário**:
  1. Filtrar por período → tabela e stats de PIX/cartão da página recalculam.
  2. Clicar em ações de um checkout → menu com Copiar Link / WhatsApp / Email; ao clicar em WhatsApp ou Email, abre nova aba com mensagem pronta contendo o link de recuperação (`/assinatura/checkout?plan=...&recoveryId=...`).
  3. Navegar páginas via botões Anterior/Próxima (15 itens por página).
- **Regras de negócio visíveis no código**: link de recuperação é montado via `getCheckoutUrl` (de `@shared/domainConfig`) com query params `plan` e `recoveryId`; telefone é normalizado (apenas dígitos) e prefixado com `55` para link do WhatsApp; valores em centavos.
- **Integrações e chamadas de API**:
  - `GET /api/admin/checkouts-abandonados?page&limit=15&startDate&endDate`.
  - Integração externa: `wa.me` (WhatsApp Web/App) e `mailto:` (cliente de email padrão do navegador).
- **Dados exibidos**: `id`, `buyerName`, `buyerEmail`, `buyerPhone`, `plan`, `amount`, `paymentMethod`, `status`, `createdAt`, `pixExpiresAt`.

---

### Página: /admin/afiliados — Gestão de Afiliados

- **Arquivo fonte**: `client/src/pages/admin/AdminAfiliados.tsx` — rota `/admin/afiliados` (App.tsx linha 304).
- **Objetivo**: acompanhar performance do programa de afiliados (comissões pagas/pendentes, cliques, conversões) e listar afiliados individualmente com detalhamento expansível.
- **Layout geral**: coluna única; header com título/subtítulo, botões Atualizar e Exportar CSV; card de filtros de período; grade de 8 stat-cards; card único com tabela expansível ("accordion" por linha) de afiliados e paginação.
- **Inventário completo de UI**:
  - Header: título "Gestão de Afiliados", botão **Atualizar** (`RefreshCw`), botão **Exportar CSV** (`Download`) que abre `/api/admin/affiliates/export-csv?startDate&endDate` em nova aba.
  - Card "Filtros de Período": Select preset (Hoje, 7 dias, 30 dias, Este mês, Mês passado, Este ano, Personalizado), Input Data Início, Input Data Fim.
  - 8 stat-cards (com 8 skeletons durante loading):
    - **Total Comissões Pagas** (verde, `DollarSign`).
    - **Comissões Pendentes** (amarelo, `TrendingUp`).
    - **Faturamento Total** (azul, `ShoppingBag`).
    - **Total de Vendas** (índigo, `Hash`).
    - **Ticket Médio** (ciano, `DollarSign`).
    - **Total de Afiliados** (laranja, `Users`).
    - **Taxa de Conversão** (roxo, `Percent`) — exibe também "`conversões` / `cliques`" abaixo.
    - **Total Conversões** (rosa, `UserPlus`).
  - Card "Top Afiliados" com tabela expansível:
    - Colunas visíveis: (seta expandir), **Nome**, **Email**, **Código** (badge com ícone `Hash`), **Comissão Total**, **Indicados Ativos**.
    - Cada linha é clicável (`Collapsible`) e expande um painel de detalhes com 3 grupos de métricas:
      - Grupo 1: Cadastrado em, Email, Código de Referência, Ticket Médio.
      - Grupo 2: Cliques, Conversões, Total Vendas, Faturamento Gerado.
      - Grupo 3: Comissão Total (verde), Comissão Pendente (amarelo), Comissão Paga (azul).
    - Paginação: "Mostrando X de Y afiliados", botões Anterior/Próxima, "Página X de Y".
    - Estado vazio: ícone `Users` + "Nenhum afiliado encontrado no período selecionado."
    - Loading: 5 skeletons `h-16`.
  - Função `getStatusBadge` definida (pending/released/completed/canceled) mas não usada diretamente na tabela atual de afiliados (reservada, aparentemente, para uso em listagens de comissões/saques que não estão renderizadas neste componente).
- **Fluxos do usuário**:
  1. Ajustar filtros de período → stats e lista de afiliados recarregam.
  2. Clicar em uma linha de afiliado → expande detalhes (cliques, conversões, comissões).
  3. Clicar em "Exportar CSV" → download/abertura de relatório CSV no período filtrado.
  4. Navegar páginas da lista de afiliados (15 por página).
- **Regras de negócio visíveis no código**: comissões e valores monetários em centavos; taxa de conversão vem pronta do backend (`averageConversionRate`) como string percentual.
- **Integrações e chamadas de API**:
  - `GET /api/admin/affiliates/summary?startDate&endDate`.
  - `GET /api/admin/affiliates/list?page&limit=15&startDate&endDate`.
  - `GET /api/admin/affiliates/export-csv?startDate&endDate` (download).
- **Dados exibidos**: `AffiliateSummary` (totalPaid, totalPending, totalAffiliates, averageConversionRate, totalClicks, totalConversions, totalRevenue, totalSales, averageTicket); `Affiliate` (id, name, email, referralCode, clicks, conversions, totalSales, totalCommission, pendingCommission, paidCommission, totalRevenue, averageTicket, activeReferrals, createdAt). Não há, neste arquivo, fluxo visível de **aprovação de saques** de afiliados — a página é somente leitura/relatório e exportação.

---

### Página: /admin/vendedores — Análise de Vendedores (Marketplace)

- **Arquivo fonte**: `client/src/pages/admin/AdminVendedores.tsx` — rota `/admin/vendedores` (App.tsx linha 307).
- **Objetivo**: gestão completa do marketplace de vendedores — visão geral financeira, listagem de vendedores com saldo, histórico de todas as vendas, ranking, moderação de reviews e aprovação de reembolsos.
- **Layout geral**: header com título/subtítulo e Select de período (canto direito); card condicional de datas personalizadas; um componente `Tabs` com 6 abas (grid de 6 colunas): **Resumo**, **Vendedores**, **Vendas**, **Ranking**, **Reviews**, **Reembolsos**; um `Dialog` modal de detalhes do vendedor fora das tabs.
- **Inventário completo de UI**:
  - Header: título "Análise de Vendedores", Select **Período** (ícone `Calendar`) com opções: Hoje, Últimos 7 dias, Últimos 30 dias, Este mês, Mês passado, Esta semana, Todo período, Personalizado.
  - Quando preset = "Personalizado": card com Input **Data Inicial** e Input **Data Final**.
  - **Aba Resumo**:
    - 4 cards de destaque (gradiente colorido) com ícone grande: **Receita Bruta** (verde, `DollarSign`, mostra também total de vendas), **Seu Lucro (Taxas)** (azul, `Percent`), **Reembolsos** (vermelho, `RefreshCw`, mostra contagem), **Pendentes** (amarelo, `Clock`, mostra contagem de pedidos).
    - 4 cards menores: **Vendedores Ativos** (`Users`), **Produtos Ativos** (`Package`), **Recebido Vendedores** (receita líquida, `ArrowUpRight`), **Descontos Aplicados** (`ArrowDownRight`).
    - Gráfico "Evolução de Vendas" (`AreaChart`, 300px): duas áreas — "Receita" (verde) e "Lucro" (azul), plotadas por data; só aparece se houver `salesHistory`.
    - Skeletons: 8 placeholders `h-16` durante carregamento do overview.
  - **Aba Vendedores**:
    - Barra de busca (`input-search-seller`, filtra por nome/email), Select **Ordenar por** (Receita, Vendas, Reembolsos).
    - Tabela: colunas Vendedor (avatar+nome+email), Vendas, Receita Bruta, Receita Líquida, Reembolsos (contagem + valor, ou "-"), Produtos, Saldo (mostra Pendente e Disponível empilhados), coluna de ação (botão olho `Eye` abre modal de detalhes).
    - Paginação via componente `TablePagination`.
    - Estados: loading (5 skeletons), erro (mensagem específica se erro contém "401": "Você precisa estar autenticado como administrador..."), vazio ("Nenhum vendedor encontrado para o período selecionado.").
  - **Aba Vendas**:
    - Filtro Select **Status** (Todos, Concluídos, Pendentes, Reembolsados, Solicitado Reembolso).
    - Tabela "Todas as Vendas": colunas Produto, Comprador (nome+email), Vendedor (nome+email), Valor Bruto, Taxa Sistema, Líquido Vendedor, Pagamento (badge PIX/Cartão), Status (badge colorido por status), Data.
    - Paginação via `TablePagination`. Estados vazio/loading análogos.
  - **Aba Ranking**:
    - Lista "Top Vendedores" (não tabela): cada linha com badge de posição numerada (destaque ouro/prata/bronze para top 3, cores diferenciadas), avatar, nome/email, receita bruta e total de vendas à direita.
    - Estados vazio ("Nenhum vendedor com vendas no período selecionado.") e loading.
  - **Aba Reviews** → componente interno `ReviewsManagement`:
    - Tabela "Moderação de Reviews": colunas Produto, Avaliação (X/5), Comentário (truncado), Ações — botão **excluir** (ícone `Trash`, `variant="destructive"`) que chama `DELETE /api/marketplace/products/:productId/reviews/:reviewId`.
    - Estado vazio: "Nenhuma review encontrada".
  - **Aba Reembolsos** → componente interno `RefundManagement`:
    - Card "Solicitações Pendentes (N)": tabela com Comprador, Produto (com preço), Vendedor, Valor (vermelho), Método (badge com ícone `CreditCard`: PIX/Cartão/Boleto), Motivo (truncado), Data, Ações — botão **Aprovar** (verde, ícone `CheckCircle`) que chama `POST /api/admin/marketplace/approve-refund/:orderId`.
    - Card "Reembolsos Processados (N)": tabela similar sem coluna de ações, com badge de status ("Reembolsado" verde / "Pendente" amarelo).
    - Estados vazios para ambas listas; skeleton `h-64` durante loading.
  - **Modal "Detalhes do Vendedor"** (Dialog, aberto ao clicar no ícone olho de um vendedor):
    - Header com avatar, nome, email.
    - 4 mini-cards: Receita Total, Total Vendas, Produtos Ativos, Reembolsos (contagem).
    - 2 cards: Saldo Pendente, Saldo Disponível.
    - Tabela de vendas do vendedor selecionado: Produto, Comprador, Valor, Status, Data — com paginação própria (`sellerSalesPage`).
    - Estado vazio: "Nenhuma venda encontrada".
- **Fluxos do usuário**:
  1. Selecionar período → recalcula overview, top sellers, histórico, lista de vendedores e vendas.
  2. Buscar/ordenar vendedores na aba Vendedores → clicar no ícone de olho abre modal com detalhes e histórico de vendas do vendedor.
  3. Filtrar vendas por status na aba Vendas.
  4. Ver ranking de top vendedores por receita no período.
  5. Moderar reviews: excluir uma avaliação de produto.
  6. Aprovar reembolso: admin revisa solicitações pendentes e clica "Aprovar" para processar o reembolso do pedido.
- **Regras de negócio visíveis no código**: valores monetários em centavos; "taxas do sistema" representam o lucro da plataforma sobre vendas do marketplace; saldo do vendedor dividido em "pendente" e "disponível" (liberação por tempo, presumivelmente); reembolsos passam por fluxo de solicitação (`refund_requested`) → aprovação manual do admin (`refunded`); não há endpoint de rejeição de reembolso visível nesta tela (somente aprovar).
- **Integrações e chamadas de API**:
  - `GET /api/admin/marketplace/overview?startDate&endDate`.
  - `GET /api/admin/marketplace/top-sellers?period` (period = "1"/"7"/"30").
  - `GET /api/admin/marketplace/sales-history?startDate&endDate`.
  - `GET /api/admin/marketplace/sellers?startDate&endDate&sortBy&order&limit&offset`.
  - `GET /api/admin/marketplace/all-sales?startDate&endDate&status&limit&offset`.
  - `GET /api/admin/marketplace/sellers/:id/sales?limit&offset`.
  - `GET /api/marketplace/products` (para reviews).
  - `DELETE /api/marketplace/products/:productId/reviews/:reviewId`.
  - `GET /api/admin/marketplace/refund-requests`.
  - `POST /api/admin/marketplace/approve-refund/:orderId`.
  - Todas as chamadas usam `fetchWithAuth` (fetch nativo com Bearer token de `localStorage` + `credentials: include`), exceto reviews/refunds que usam `apiRequest`.
- **Dados exibidos**: `MarketplaceOverview` (sales.total/grossRevenue/netRevenue/systemFees/discounts, refunds.total/totalRefunded, pending.total/totalPending, sellers, activeProducts, profit); `Seller` (id, name, email, profileImageUrl, totalSales, grossRevenue, netRevenue, systemFees, refundCount, totalRefunded, activeProducts, balancePending, balanceAvailable, totalEarned, totalWithdrawn); `TopSeller` (rank + campos de seller); `SalesHistoryItem` (date, totalSales, grossRevenue, netRevenue, systemFees, refundCount, totalRefunded); `Sale` (order + product + buyer + seller); reviews (`rating`, `comment`, `productName`); `RefundRequest` (order.amount/status/paymentMethod/refundReason/refundRequestedAt/createdAt, buyer, product, seller). Não há campos de KYC (documento, verificação de identidade) visíveis nesta tela.

---

### Página: /admin/subscription-refunds — Reembolsos de Assinatura

- **Arquivo fonte**: `client/src/pages/admin/AdminSubscriptionRefunds.tsx` — rota `/admin/subscription-refunds` (App.tsx linha 310).
- **Objetivo**: gerenciar solicitações de reembolso de assinaturas (diferente dos reembolsos do marketplace), permitindo ao admin revisar detalhes e alterar o status de cada solicitação com anotações internas.
- **Layout geral**: container central; header com título/subtítulo e botão Atualizar; grade de 4 stat-cards; banner de alerta condicional; card de filtros; card com tabela de solicitações; `Dialog` modal de detalhes/edição.
- **Inventário completo de UI**:
  - Header: título "Reembolsos de Assinatura", botão **Atualizar** (`RefreshCw`, refaz `refetchStats`+`refetchRefunds`).
  - 4 stat-cards: **Pendentes** (`Clock`, âmbar), **Processando** (`RefreshCw`, azul, ícone giratório), **Concluídos** (`CheckCircle`, verde), **Total Reembolsado** (`DollarSign`, valor formatado BRL). Skeletons individuais durante loading.
  - Banner de alerta amarelo (só aparece se `stats.pending > 0`): "N solicitação(ões) aguardando processamento" + "Total pendente: R$ X".
  - Card "Filtros de Período" (ícone `Filter`):
    - Select **Período Predefinido**: Hoje, 7 dias, 30 dias, 90 dias, Todos, Personalizado.
    - Input Data Início, Input Data Fim.
    - Select **Status**: Todos, Pendentes, Processando, Concluídos, Rejeitados.
  - Card "Solicitações de Reembolso" (badge com contagem de registros):
    - Tabela: colunas **Usuário** (nome+email), **Valor**, **Método** (badge PIX teal com ícone SVG customizado / badge Cartão azul com `CreditCard`), **Status** (badge: Pendente/Processando/Concluído/Rejeitado, cada um com ícone e cor), **Data**, **Ações** (botão "Detalhes").
    - Estado vazio: ícone `DollarSign` + "Nenhuma solicitação de reembolso encontrada".
    - Loading: 3 skeletons `h-16`.
  - **Modal "Detalhes do Reembolso"** (Dialog):
    - Grid 2 colunas com: Usuário, Email, Valor (destaque), Método (badge), Solicitado em, Status Atual (badge).
    - Se houver `reason` (motivo do usuário): bloco de texto em card cinza.
    - Se `refundedViaProvider`: alerta verde "Reembolso processado automaticamente via provedor de pagamento".
    - Se `paymentMethod === 'pix'` e status ≠ completed: alerta âmbar "Pagamento PIX requer processamento manual do reembolso".
    - Select **Alterar Status**: Pendente, Processando, Concluído, Rejeitado.
    - Textarea **Notas do Admin** (`admin-notes`, placeholder "Adicione notas sobre o processamento...").
    - Footer: botão **Fechar**, botão **Salvar Alterações** (desabilitado se não houver `newStatus` selecionado ou mutação pendente; mostra spinner "Salvando..." durante o processo).
- **Fluxos do usuário**:
  1. Filtrar lista por período/status.
  2. Clicar "Detalhes" em uma linha → abre modal com todas as informações da solicitação.
  3. No modal, selecionar novo status e/ou escrever notas de admin → clicar "Salvar Alterações" → `PATCH /api/admin/subscription-refunds/:id` com `{status, adminNotes}` → toast de sucesso/erro, refetch de stats e lista, modal fecha.
- **Regras de negócio visíveis no código**: reembolsos via PIX exigem processamento manual (alerta explícito); reembolsos processados automaticamente pelo provedor de pagamento são sinalizados (`refundedViaProvider`); estados possíveis: pending, processing, completed, rejected; valores em centavos (`amountCents`).
- **Integrações e chamadas de API**:
  - `GET /api/admin/subscription-refunds/stats`.
  - `GET /api/admin/subscription-refunds?status&startDate&endDate`.
  - `PATCH /api/admin/subscription-refunds/:id` (mutation, body `{status, adminNotes}`).
- **Dados exibidos**: `RefundStats` (total, pending, processing, completed, rejected, totalAmountPending, totalAmountRefunded); `RefundRequest` (id, subscriptionId, userId, amountCents, paymentMethod, providerPaymentId, status, reason, adminNotes, processedBy, processedAt, refundedViaProvider, createdAt, updatedAt, subscription, user.{id,name,email}).

---

### Página: /admin/ai-usage — Uso de IA (OpenAI)

- **Arquivo fonte**: `client/src/pages/admin/AdminAIUsage.tsx` — rota `/admin/ai-usage` (App.tsx linha 313).
- **Objetivo**: monitorar consumo de tokens e custo (USD/BRL) da API OpenAI pela plataforma, detalhado por usuário, por tipo de operação, e em logs individuais de chamadas.
- **Layout geral**: header com título/subtítulo e filtro de período; grade de 4 stat-cards; `Tabs` com 3 abas: **Por Usuário**, **Por Operação**, **Logs Detalhados**.
- **Inventário completo de UI**:
  - Header: título "Uso de IA (OpenAI)", subtítulo "Acompanhe o consumo de tokens e custos da API OpenAI".
  - Select **Período**: Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Personalizado.
  - Quando "Personalizado": dois `Popover` com `Calendar` (date picker) para Data início e Data fim (botões com ícone `CalendarIcon`).
  - 4 stat-cards:
    - **Total de Tokens** (`Zap`) — total, com badges "In: X" e "Out: Y" abaixo.
    - **Custo USD** (`DollarSign`, verde).
    - **Custo BRL** (`TrendingUp`, azul).
    - **Total de Chamadas** (`Activity`, laranja).
    - Todos com skeleton `h-8 w-24` durante loading.
  - **Aba Por Usuário**:
    - Campo de busca (`Search`, filtra por nome/email do usuário).
    - Tabela com cabeçalhos ordenáveis (clicáveis, com ícone `ArrowUpDown` no campo ativo): Usuário (não ordenável), Tokens Input, Tokens Output, Total Tokens, Custo USD, Custo BRL, Chamadas (todas ordenáveis via `handleSort`).
    - Cada linha: nome+email do usuário, tokens formatados (`Intl.NumberFormat pt-BR`), custos formatados em USD/BRL, badge com contagem de chamadas.
    - Estado vazio: ícone `Zap` + "Nenhum uso de IA registrado" + explicação.
    - Loading: 5 skeletons.
  - **Aba Por Operação**:
    - Tabela: Operação (badge com nome traduzido via `formatOperationName` — mapeia `andromeda_campaign`→"Meta Ads Andromeda", `ai_chat`→"Chat IA", `image_generation`→"Geração de Imagens", `quiz_generation`→"Geração de Quiz", `content_moderation`→"Moderação de Conteúdo", `text_completion`→"Completar Texto"), Tokens Input, Tokens Output, Total Tokens, Custo USD, Custo BRL, Chamadas.
    - Estado vazio: ícone `Activity` + "Nenhuma operação registrada".
  - **Aba Logs Detalhados** (só busca dados quando a aba está ativa — `enabled: activeTab === "logs"`):
    - Tabela: Data/Hora, Operação (badge), Modelo (badge), Tokens (formato "input / total"), Custo USD, Custo BRL, Taxa Câmbio (2 casas decimais).
    - Estado vazio: ícone `FileText` + "Nenhum log detalhado disponível".
    - Loading: 10 skeletons.
- **Fluxos do usuário**:
  1. Selecionar período (predefinido ou personalizado via calendário) → todas as queries (summary, by-user, by-operation, logs) atualizam com os novos parâmetros.
  2. Na aba "Por Usuário", buscar por nome/email e clicar em cabeçalhos de coluna para ordenar ascendente/descendente.
  3. Trocar de aba para ver a granularidade "Por Operação" ou "Logs Detalhados" (logs carregam sob demanda ao abrir a aba).
- **Regras de negócio visíveis no código**: custo calculado em USD e convertido para BRL via taxa de câmbio (`exchangeRate`) registrada por chamada; operações nomeadas por chave interna e traduzidas na UI; nenhuma indicação de limite de créditos por usuário nesta tela — é puramente um painel analítico/relatório de custo, sem ação de bloqueio/limite.
- **Integrações e chamadas de API**:
  - `GET /api/admin/ai-usage/summary?range&start&end`.
  - `GET /api/admin/ai-usage/by-user?range&start&end`.
  - `GET /api/admin/ai-usage/by-operation?range&start&end`.
  - `GET /api/admin/ai-usage/logs?range&start&end` (somente quando aba Logs ativa).
  - Serviço externo referenciado: **OpenAI** (nome da página e todos os textos mencionam explicitamente "API OpenAI").
- **Dados exibidos**: `TokenUsageSummary` (totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd, totalCostBrl, totalCalls, startDate, endDate); `UserUsage` (userId, userName, userEmail, totalPromptTokens, totalCompletionTokens, totalTokens, totalCostUsd, totalCostBrl, callCount); `OperationUsage` (operation, tokens, custos, callCount); `UsageLog` (id, userId, model, operation, promptTokens, completionTokens, totalTokens, costUsd, costBrl, exchangeRate, usageDate).

---

### Página: /admin/whatsapp — WhatsApp (Conexão e Campanhas)

- **Arquivo fonte**: `client/src/pages/admin/AdminWhatsApp.tsx` — rota `/admin/whatsapp` (App.tsx linha 316). Maior arquivo do grupo (1837 linhas).
- **Objetivo**: gerenciar a integração de WhatsApp da plataforma (conexão via QR Code, provavelmente Baileys), monitorar a fila de envio, criar e operar campanhas de disparo em massa com mídia, e administrar a lista de opt-out/bloqueio de contatos.
- **Layout geral**: header (título/subtítulo + botão Atualizar); `Tabs` com 3 abas: **Conexão**, **Campanhas**, **Bloqueados**; múltiplos `Dialog` modais fora das tabs (Nova Campanha, Detalhes da Campanha, Lista de Exclusões, Testar Mensagem, Selecionar Destinatários). Estado de loading inicial mostra 2 skeletons grandes lado a lado.
- **Inventário completo de UI**:

  **Header**: título "WhatsApp" (ícone `MessageCircle` verde), subtítulo "Conexão e campanhas de WhatsApp", botão **Atualizar** (`refetch()` do status).

  **Aba Conexão**:
  - 4 mini stat-cards de métricas de fila (`metrics`, refetch a cada 5s): **Na Fila** (`Clock`), **Enviadas** (`CheckCircle2`, verde), **Falharam** (`XCircle`, vermelho), **Msgs/min** (`TrendingUp`).
  - Alerta destrutivo condicional "Circuit Breaker Ativo" (ícone `Zap`) quando `metrics.queue.circuitBreakerOpen` — mostra último erro se houver.
  - Card "Conexão WhatsApp" (ícone `QrCode`):
    - Indicador de status com ícone colorido: `Wifi` verde (conectado), `Loader2` girando amarelo (conectando), `WifiOff` cinza (desconectado).
    - Badge de status: "Conectado" (verde), "Conectando..." (amarelo), "Desconectado" (cinza).
    - Se conectado, mostra número de telefone (`+55 {phoneNumber}`).
    - Alerta destrutivo se `status.error` — trata especialmente erro contendo "Outra sessão" (Conflito de Sessão) com instruções passo a passo (fechar WhatsApp Web em outros dispositivos, desconectar sessões extras no celular) e botão **Forçar Nova Conexão** (`force-reconnect`).
    - QR Code (`<img>`) exibido quando `status.qrCode` presente e não conectado, com instrução de escaneio.
    - Estado "nenhum QR ainda" (não conectado, não conectando, sem QR): ícone `Smartphone` + texto "Clique em Conectar para gerar o QR Code".
    - Botão **Conectar WhatsApp** (verde, ícone `QrCode`) quando desconectado, texto muda para "Aguardando QR Code..." enquanto conectando.
    - Botão **Desconectar** (destrutivo, ícone `WifiOff`) quando conectado.
  - Card "Teste de Envio" (ícone `Send`):
    - Se desconectado: alerta "WhatsApp não conectado".
    - Se conectado: Input **Número para teste** (formatado como telefone BR ao digitar), botão **Enviar Mensagem de Teste** (desabilitado até 10+ dígitos).
    - Alerta amarelo fixo: "Importante — Mantenha seu celular conectado à internet...".

  **Aba Campanhas**:
  - Alerta destrutivo se WhatsApp não conectado: "Conecte o WhatsApp na aba Conexão antes de criar campanhas."
  - Barra superior: contagem "N destinatários elegíveis" (ícone `Users`), botão **Lista de Exclusões** (abre modal `showOptOuts`), botão **Nova Campanha** (desabilitado se não conectado, abre modal `showCreateCampaign`).
  - Card "Campanhas": tabela com colunas Título, Status (badge: Rascunho/Em execução/Pausada/Concluída/Cancelada, cada uma com ícone e cor), Progresso (barra `Progress` + fração "enviadas+erros+skipped/total"), Enviadas (verde), Erros (vermelho), Exclusões (amarelo), Ações.
  - Ações por campanha (ícones, condicionais ao status):
    - **Ver detalhes** (`Eye`, sempre visível) → abre modal de detalhes.
    - Se `draft`: **Selecionar destinatários** (`Users` azul) e **Iniciar** (`Play` verde, desabilitado se sem destinatários ou desconectado).
    - Se `running`: **Pausar** (`Pause` amarelo).
    - Se `paused`: **Retomar** (`Play` verde, desabilitado se desconectado).
    - Se `draft`/`completed`/`cancelled`: **Excluir** (`Trash2` vermelho).
  - Estado vazio: ícone `Megaphone` + "Nenhuma campanha criada ainda" + botão "Criar Primeira Campanha".

  **Aba Bloqueados**:
  - Card "Lista de Bloqueio" com badge de contagem total.
  - Formulário inline de bloqueio manual: Input **Telefone** (formatado), Input **Nome (opcional)**, botão **Bloquear** (desabilitado até telefone válido).
  - Tabela (dentro de `ScrollArea` 400px): Telefone, Nome, Origem (badge "Manual" ou palavra-chave capturada, ex.: "SAIR"), Data, Ações (botão excluir/desbloquear, ícone `Trash2`).
  - Estado vazio: ícone `UserMinus` + "Nenhum número bloqueado" + explicação.
  - Alerta informativo fixo "Como funciona o bloqueio automático?" com lista: resposta à palavra-chave adiciona automaticamente; bloqueados são ignorados em disparos; pode adicionar/remover manualmente; contador de elegíveis já exclui bloqueados.

  **Modal "Nova Campanha"** (`showCreateCampaign`):
  - Input **Título da Campanha**.
  - Textarea **Mensagem** (4 linhas).
  - Seção "Anexos (opcionais - pode enviar todos juntos)": 4 cards de upload independentes — **Imagem** (`Image`, azul), **Vídeo** (`Video`, roxo), **Áudio** (`Music`, verde), **Documento** (`FileText`, laranja). Cada card tem input de arquivo oculto, botão "Selecionar" (upload) e, após upload, badge com nome do arquivo + botão de limpar (`XCircle`). Indicador "Enviando arquivo..." durante upload. Nota: até 4 tipos de mídia podem ser anexados juntos na mesma mensagem.
  - Slider de **Intervalo entre mensagens** (min 20s, max 120s, passo 5s, dois handles — min/max), com texto "{min}s - {max}s entre cada mensagem".
  - Input **Palavra-chave para sair** (uppercase automático, padrão "SAIR").
  - Textarea **Mensagem de descadastramento** (padrão explicando como sair).
  - Footer: botão **Cancelar**, botão **Testar Mensagem** (abre modal de teste, desabilitado sem mensagem/conexão), botão **Criar Campanha** (desabilitado sem título/mensagem, spinner durante criação).

  **Modal "Detalhes da Campanha"** (`showCampaignDetails`, refetch a cada 3s enquanto aberto):
  - Badge de status + botões de ação contextual (Iniciar/Pausar/Retomar+Cancelar/Cancelar conforme status).
  - 5 mini-cards: Total, Enviadas (verde), Erros (vermelho), Exclusões (amarelo), Pendentes (azul).
  - Barra de progresso com percentual calculado.
  - Bloco "Mensagem" (texto completo).
  - Badge de "Anexo" se houver mídia (ícone conforme tipo).
  - Info de Intervalo (min-max segundos) e Palavra de saída (badge).

  **Modal "Lista de Exclusões"** (`showOptOuts`): tabela Telefone/Nome/Palavra-chave/Data/Ações (excluir), estado vazio com ícone `UserMinus`.

  **Modal "Testar Mensagem da Campanha"** (`showTestMessage`):
  - Input **Número para teste**.
  - Preview numerado: "1. Mensagem principal" (texto), "2. Anexos" (badges dos arquivos anexados, se houver), "3. Mensagem de descadastro (enviada por último)" (numeração se ajusta conforme presença de anexos).
  - Footer: Cancelar / **Enviar Teste** (desabilitado até telefone válido).

  **Modal "Selecionar Destinatários"** (`showSelectRecipients`):
  - Dois botões toggle: **Todos (N)** vs **Selecionar específicos**.
  - Se "específicos": campo de busca por nome/telefone + badge "N selecionados"; lista rolável (`ScrollArea` 300px) de destinatários elegíveis, cada item clicável com checkbox visual customizado (não é `<Checkbox>` do design system, é uma div estilizada) que alterna seleção.
  - Footer: Cancelar / **Confirmar Todos (N)** ou **Confirmar N selecionados** (desabilitado se modo "específicos" sem seleção).

- **Fluxos do usuário**:
  1. **Conectar WhatsApp**: clicar "Conectar WhatsApp" → inicia polling do status a cada 2s → QR Code aparece → usuário escaneia no celular → quando `status.connected` vira true, polling para automaticamente (via `useEffect`).
  2. **Reconectar em caso de conflito**: se erro menciona "Outra sessão", seguir instruções e clicar "Forçar Nova Conexão" (limpa sessão anterior e reinicia QR).
  3. **Testar conexão**: digitar número → "Enviar Mensagem de Teste".
  4. **Criar campanha**: clicar "Nova Campanha" → preencher título/mensagem → opcionalmente anexar até 4 tipos de mídia (upload real via `FormData` para `/upload-media`) → ajustar intervalo de envio → opcionalmente testar mensagem em um número → configurar palavra-chave/mensagem de opt-out → "Criar Campanha" (fica em status `draft`).
  5. **Selecionar destinatários**: na tabela de campanhas (status draft), clicar ícone de usuários → escolher "Todos" ou selecionar contatos específicos (busca + checkboxes) → "Confirmar" → `POST .../set-recipients`.
  6. **Iniciar/pausar/retomar/cancelar campanha**: botões de ação na tabela ou no modal de detalhes, conforme status atual.
  7. **Excluir campanha**: permitido apenas em draft/completed/cancelled.
  8. **Gerenciar bloqueios**: adicionar manualmente um telefone à lista de bloqueio, ou remover um bloqueio existente (desbloquear).
- **Regras de negócio visíveis no código**:
  - Fluxo de conexão é assíncrono via QR Code — condiz com biblioteca tipo Baileys (WhatsApp Web multi-device), embora o nome da lib não apareça no frontend.
  - Circuit breaker: sistema pausa envios automaticamente após muitas falhas consecutivas.
  - Fila de mensagens com métricas (enfileiradas, enviadas, falhas, retries, msgs/min) atualizadas a cada 5s.
  - Campanhas passam pelos estados: `draft` → `running` → `paused`/`completed`/`cancelled`.
  - Campanha só pode ser iniciada se houver destinatários definidos (`totalRecipients > 0`) e conexão ativa.
  - Contatos que respondem a palavra-chave de opt-out (customizável por campanha, padrão "SAIR") são automaticamente adicionados à lista de bloqueio e excluídos de disparos futuros.
  - Intervalo de envio randomizado entre min/max segundos (20–120s) para simular comportamento humano/evitar bloqueio pela Meta.
  - Destinatários elegíveis já excluem automaticamente os bloqueados (contagem vem pronta do backend).
  - Upload de mídia validado por tipo (image/*, video/*, audio/*, extensões de documento específicas: pdf, doc(x), xls(x), ppt(x), txt, zip, rar).
  - Não há indicação de autenticação/permissão explícita no componente além de ser uma rota `/admin/*` (presumidamente protegida em nível de roteamento).
- **Integrações e chamadas de API**:
  - `GET /api/admin/whatsapp/status` (polling 2s enquanto conectando).
  - `GET /api/admin/whatsapp/metrics` (polling 5s).
  - `GET /api/admin/whatsapp/campaigns` (polling 5s).
  - `GET /api/admin/whatsapp/eligible-recipients`.
  - `GET /api/admin/whatsapp/opt-outs` (habilitado apenas na aba "bloqueados").
  - `GET /api/admin/whatsapp/campaigns/:id` (detalhes, polling 3s enquanto modal aberto).
  - `POST /api/admin/whatsapp/connect`.
  - `POST /api/admin/whatsapp/disconnect`.
  - `POST /api/admin/whatsapp/force-reconnect`.
  - `POST /api/admin/whatsapp/test` (mensagem de teste de conexão).
  - `POST /api/admin/whatsapp/campaigns` (criar campanha).
  - `POST /api/admin/whatsapp/campaigns/:id/start`.
  - `POST /api/admin/whatsapp/campaigns/:id/pause`.
  - `POST /api/admin/whatsapp/campaigns/:id/resume`.
  - `POST /api/admin/whatsapp/campaigns/:id/cancel`.
  - `DELETE /api/admin/whatsapp/campaigns/:id`.
  - `POST /api/admin/whatsapp/campaigns/upload-media` (multipart/form-data, campos `media` e `type`).
  - `DELETE /api/admin/whatsapp/opt-outs/:id`.
  - `POST /api/admin/whatsapp/opt-outs` (bloqueio manual).
  - `POST /api/admin/whatsapp/campaigns/test-message` (testar mensagem de campanha com mídia).
  - `POST /api/admin/whatsapp/campaigns/:id/set-recipients` (body `{selectAll, recipientIds}`).
  - Serviço externo: WhatsApp (via QR Code / sessão, tipicamente Baileys, embora não citado por nome no frontend).
- **Dados exibidos**: `WhatsAppStatus` (connected, qrCode, phoneNumber, lastConnected, connecting, error); `QueueMetrics` (queue.length/totalEnqueued/totalSent/totalFailed/totalRetries/currentQueueLength/lastSentAt/lastErrorAt/lastError/circuitBreakerOpen/messagesPerMinute, connection.connected/phoneNumber/lastConnected); `WhatsappCampaign` (id, title, message, mediaType, mediaUrl, mediaFileName, intervalMinSec, intervalMaxSec, optOutKeyword, optOutMessage, status, totalRecipients, sentCount, errorCount, optOutCount, skippedCount, currentRecipientIndex, startedAt, completedAt, pausedAt, createdAt, stats{total,pending,sent,error,optedOut,skipped}); `WhatsappOptOut` (id, phone, userName, keyword, sourceCampaignId, optedOutAt); `EligibleRecipient` (recipientId, phone, userName, userId).
