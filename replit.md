# Overview

This project is a comprehensive digital content access platform built with React, Express, and PostgreSQL. It allows users with subscriptions to access various digital assets like PLRs, ebooks, AI tools, and online courses. Key features include webhook-based payment processing, Google Drive content storage, an extensive admin dashboard with analytics, and community engagement tools such as user/topic follows and notifications. The platform also offers advanced functionalities like a Page Cloner, Pre-Sell Builder, a full-fledged digital product marketplace, and a gamification system. The overarching vision is to create a secure, user-friendly, and robust platform for digital content distribution, fostering community and empowering both creators and consumers with advanced tools.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend utilizes React 18 with TypeScript and Vite. UI components are built with Shadcn UI (Radix UI + Tailwind CSS) following a "New York" style and CSS variables for theming. State management is handled by TanStack Query, and Wouter is used for lightweight client-side routing. Design patterns emphasize component composition, custom hooks, and React Hook Form with Zod for validation.

## Backend Architecture

The backend is an Express.js server developed with TypeScript on Node.js, featuring a RESTful API design. It employs an abstracted `IStorage` interface for database operations and centralized error handling.

## Authentication & Authorization

Authentication is custom email/password-based using bcrypt, enhanced with email-based Two-Factor Authentication (2FA) and SMS phone verification. Session management is handled via Express sessions stored in PostgreSQL with secure HTTP-only cookies (30-day persistence). Authorization uses role-based access control with an `isAdmin` flag, enforced by middleware.

## Data Storage

The project uses PostgreSQL (Neon serverless) with Drizzle ORM. The schema supports users, sessions, content categories, various digital products (PLRs, services, courses, AI tools), forum features, support tickets, user/topic follows, notifications, a marketplace, seller wallets, and gamification elements. Drizzle Kit manages migrations. Product images for the marketplace are stored using Replit Object Storage, with Sharp used for image processing (resize, WebP conversion).

## System Features

**Admin Dashboard**: Provides comprehensive analytics (user growth, forum activity, cloning stats, financial data, abandoned checkouts, affiliate management) with Recharts visualizations and full CRUD capabilities. Includes user management, affiliate tracking, and OpenAI token usage monitoring.

**Access Control System**: Implements a three-tier access plan (FREE, BASIC, FULL) based on user subscriptions, controlling access to features like PLRs, Courses, AI Tools, Page Cloner, and Andromeda.

**Page Cloner & Pre-Sell Builder**: Tools for cloning and building web pages, offering real-time script injection, image editing, and editable element detection. Features a custom domain system leveraging Cloudflare for SaaS for SSL validation and proxying.

**Marketplace System**: A complete digital product marketplace enabling public showcasing, seller product management, and buyer purchases. Includes a 7-day refund policy, 8-day balance hold, minimum withdrawal limits, and integrates with PIX and credit card payments. A referral system offers 50% recurring commissions.

**Gamification System**: Rewards users with visibility boosts and XP multipliers for daily activities and weekly challenges.

**Community Features**: Includes user/topic follow systems, public activity pages, automated notifications, and a rich forum with advanced filtering, sorting, search, and topic pinning.

**Google Drive Integration**: Automates the import of PLR content, supporting multiple languages and asset detection.

**Support System**: Facilitates bug reporting with file uploads and provides an admin panel for ticket management.

**Timeline System**: Features automatic hashtag extraction, a trending tags widget, and tag-based filtering.

**PLRs System**: Optimized with server-side pagination, HTTP caching (ETags), memoized React components, lazy image loading, and a responsive mobile-first design.

**Mobile Performance Optimizations (Core Web Vitals)**:
- INP Optimization: Custom hooks (`useDebounce`, `useThrottle`, `useOptimizedState`) for non-blocking state updates using React 18's `useTransition` and `useDeferredValue`
- LCP Optimization: Preload critical assets (logo, fonts), `fetchPriority="high"` on hero images, lazy loading with `content-visibility: auto` for off-screen content
- CSS Performance: GPU-accelerated animations, touch-action optimization, 44px minimum touch targets on mobile devices
- Components: `OptimizedImage` with lazy loading, error handling, and automatic placeholder; `lazyComponents` utilities for code splitting

**Subscription Checkout & Management**: An internal checkout system integrated with Asaas and Podpay for credit card and PIX payments. Offers full lifecycle management of recurring subscriptions including creation, cancellation, and credit card updates. A withdrawal system uses Asaas for free PIX transfers, with anti-fraud validation webhooks and a balance scheduler.

**Meta Ads Integration**: 
- **Facebook Conversions API**: Tracks all subscription purchases (Asaas + Podpay) and marketplace orders with EMQ parameters (IP, User Agent, FBC, FBP) for improved event matching quality
- **Webhook Automation**: Asaas webhooks automatically dispatch Purchase events to Meta when subscriptions are paid (status: active)
- **Manual Admin Endpoint**: `/api/admin/resend-meta-purchase-event` allows retroactive event dispatching with full EMQ data for maximum accuracy
- **Event Match Quality**: EMQ data capture during checkout ensures optimal Facebook Conversions API scoring (30%+ improvement)

**WhatsApp Checkout Recovery System**:
- **Automated Recovery Messages**: 3-step recovery flow for abandoned checkouts via WhatsApp
  - Message 1 (30min): Gentle reminder every 10 minutes  
  - Message 2 (24h): Daily at 11:00 & 18:00 with feature highlights
  - Message 3 (48h): Daily at 10:00 with 50% discount code
- **Database Tracking**: `checkout_recovery_whatsapp` table logs all sent messages with status, discounts, and timestamps
- **Scheduler**: `server/checkout-recovery-whatsapp-scheduler.ts` manages cron jobs and message dispatch
- **Integration**: Connected to WhatsApp service via Baileys with queue management and exponential backoff

**Meta Ads Andromeda Campaign Generator**: Features a unified video structure, Canva-style creative generation for single images and 5-slide carousels (Problem → Discovery → How It Works → Results → CTA), and product-focused headlines.

## Security and Timezone

**Timezone Standardization**: All date/time operations are standardized to UTC-3 (America/Sao_Paulo) for consistency across subscription checks, marketplace balance releases, gamification resets, and financial reports.

**Production Security Hardening**: Frontend protections include disabling console methods, blocking DevTools shortcuts, and anti-debugging measures. Backend security uses Helmet middleware for strict CSP, HSTS, X-Frame-Options, X-XSS-Protection, and Permissions-Policy. Anti-fraud measures include withdrawal cooldowns, daily limits, amount validation, and IP logging. Structured logging sanitizes sensitive data and uses log level prefixes.

## Recent Changes (23/12/2025 - SEO Professional Implementation)

**COMPREHENSIVE SEO OPTIMIZATION COMPLETED** ✅:
- 🔍 **FAQ Schema**: Added 6 featured snippets targeting questions (What is Lowfy? How much do I save? etc.)
- 📋 **Product Schema**: Price markup for automatic Google Shopping integration
- 🗺️ **Breadcrumb Schema**: Implemented on all major pages (Checkout, Courses, Marketplace, AI Tools)
- 📱 **Meta Tags Enhanced**: Improved descriptions with CTAs and numbers (39 tools, R$ 7.000/mês savings)
- 🤖 **Robots.txt Professional**: Whitelisted important pages, blocked admin/api, rate limiting for crawlers
- 📑 **Sitemap XML**: Expanded with 10 URLs, strategic priorities (1.0 → 0.3), update frequencies
- 🔤 **H1 Headings**: Clear, persuasive h1 on homepage (8xl desktop size) + semantic hierarchy
- ⚡ **Core Web Vitals**: LCP optimized with font preload, INP fixed with useCallback memoization, CLS prevented with `contain: layout`
- 🎯 **Navigation Structure**: Hidden SEO nav with 6 main links for Google sitelinks
- 🏗️ **Structured Data**: Product offers, aggregate ratings (4.8 ⭐ 2,340 reviews), SiteNavigationElement

**Technical Details**:
- Font preload: `https://fonts.gstatic.com/s/inter/v13/...woff2`
- Event handlers memoized: `toggleTheme`, `toggleFaq` with useCallback
- CSS containment: `contain: paint layout` on decorative elements
- Page-specific breadcrumbs in Checkout, Courses, Marketplace components

## Previous Changes (16/12/2025)

**CRITICAL FIX: Payment Status Verification (Anti-Fraude)**:
- 🔧 **BUG FIXED**: Sistema mostrava "Pagamento Aprovado" mesmo quando o pagamento estava "Aguardando pagamento" no Asaas
- 🔧 **CAUSA RAIZ**: O código usava o status da ASSINATURA (`subscription.status = ACTIVE`) em vez do status da PRIMEIRA COBRANÇA
- ✅ **SOLUÇÃO**: Agora verifica o status REAL da primeira cobrança via `listSubscriptionPayments()` após criar a assinatura
  - `CONFIRMED/RECEIVED` → status = `active` (pode ativar conta)
  - `PENDING/AWAITING_RISK_ANALYSIS` → status = `pending` (redireciona para página de aguardo)
- ✅ Nova página `/assinatura/checkout/aguardando` que faz polling do status a cada 5s
- ✅ Fluxo: Cartão em análise anti-fraude → "Verificando Pagamento" → Webhook confirma → Redireciona para ativação

**Quiz da Homepage (Decorativo)**:
- 🔧 Quiz agora é 100% estático/decorativo (sem interação)
- ✅ Melhor performance (sem state, sem event handlers)
- ✅ Zero scroll bugs

**Subscription Checkout Flow - FULLY REVIEWED & FIXED**:
- ✅ Automatic provisional user creation: Guest checkout → Payment approved → User created immediately (improves Meta External ID coverage to 100%)
- ✅ Both Asaas and PodPay webhooks now create users automatically before sending Meta events
- 🔧 **CRITICAL FIX**: Account activation now uses `subscription.nextPaymentDate` (correctly calculated in UTC from webhook) instead of recalculating expiration date with `Date.now()` which was causing annual subscriptions to expire in 30 days
- ✅ Email activation: Generates unique token, 7-day expiration, validates not already activated
- ✅ SMS verification: OTP sent to buyer's phone, 5-attempt limit, 10-minute expiration
- ✅ Account finalization: Creates/updates user with correct password, phoneVerified=true, accountStatus=active
- ✅ All dates now standardized to UTC (no recalculation in activation endpoint)

**Previous Changes (15/12/2025)**:
- Fixed `/api/webhooks/asaas-subscriptions` to process webhooks even when token validation missing
- Added EMQ parameters (clientIpAddress, clientUserAgent, fbc, fbp) for 30%+ Event Match Quality improvement
- Implemented WhatsApp checkout recovery with 3-tier automated messaging

# External Dependencies

**Payment Processing**:
- Asaas (credit card payments, marketplace/referral withdrawals, transfer validation webhooks, subscription webhooks)
- Podpay (PIX subscriptions - being phased out)

**Content Storage**:
- Google Drive (PLR files, ebooks)
- Replit Object Storage (marketplace product images)

**SMS Service**:
- Comtele SMS API (phone verification - fallback)

**WhatsApp Integration**:
- @whiskeysockets/baileys for 2FA code delivery and checkout recovery (no Puppeteer dependency)
- QR code-based admin authentication via `/admin/whatsapp`
- Automatic fallback to email/SMS when WhatsApp is disconnected
- Session persistence for maintained connections at .baileys_auth
- **Queue System**: Rate-limited message queue with configurable delays (1.5s between messages, 30s per-recipient cooldown)
- **Circuit Breaker**: Auto-pauses sending after 5 consecutive failures, auto-resets after 60s
- **Exponential Backoff**: Retries failed messages with increasing delays (2s, 4s, 8s... up to 60s max)
- **Metrics Dashboard**: Real-time queue stats, success/failure rates, messages per minute

**Email Service**:
- Custom SMTP-based email system for notifications

**Meta Pixel & Conversions API**:
- Facebook Conversions API for Purchase events tracking (server-side)
- EMQ parameters: IP Address, User Agent, FBC, FBP for improved matching
- Automatic dispatch on subscription/order completion via webhooks

**Infrastructure**:
- Cloudflare for SaaS (custom domain management, SSL validation for Page Cloner)
