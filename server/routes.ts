import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io"; // Importar Socket.IO
import { storage } from "./storage";
import { db } from "./db";
import { logger } from "./utils/logger";
import OpenAI from "openai";
import { setupAuth, authMiddleware, optionalAuthMiddleware, adminMiddleware, subscriptionMiddleware, isSubscriptionActive, getSubscriptionDaysExpired, hashPassword, verifyPassword, createSession, deleteSession, generate2FACode, create2FAVerification, verify2FACode } from "./auth";
import { 
  sendEmail, 
  generateWelcomeEmailTemplate, 
  send2FACode,
  generatePasswordResetTemplate,
  generateSaleConfirmedEmail,
  generatePurchaseConfirmedEmail,
  generateRefundRequestedVendorEmail,
  generateRefundRequestedBuyerEmail,
  generateRefundAdminEmail,
  generateReferralSuccessEmail,
  generateWithdrawalRequestedEmail,
  generateWithdrawalProcessedEmail,
  generateMarketplaceReferralEmail,
  generateSubscriptionConfirmedEmail,
  generateSubscriptionRenewedEmail,
  generateSubscriptionCanceledEmail,
  generateSubscriptionRenewalFailedEmail,
  generateSubscriptionActivationEmail,
  generateCheckoutRecoveryEmail1,
  generateCheckoutRecoveryEmail2,
  generateCheckoutRecoveryEmail3,
  generateCheckoutRecoveryEmail4WithDiscount
} from "./email";
import crypto, { randomBytes, randomUUID } from "crypto";
import { addMonths, addYears } from "date-fns";
import { z, ZodError } from "zod";
import {
  users, insertUserSchema, loginSchema,
  plrs, insertPLRSchema,
  forumTopics, forumReplies, insertForumTopicSchema, insertForumReplySchema,
  userPoints, gamificationActivities,
  challenges, userChallenges,
  pointTransactions, rewards, userRewards,
  userBadges, posts, postLikes, postComments,
  connections, notifications, pageClones,
  preSellPages, services, serviceOrders,
  n8nAutomations,
  forumTags, forumTopicTags,
  aiTools, insertAIToolSchema,
  globalAIAccess, insertGlobalAIAccessSchema,
  insertCategorySchema, insertLanguageSchema, insertServiceSchema, insertN8nAutomationSchema,
  marketplaceProducts, marketplaceOrders, sellerWallet, sellerTransactions, cartItems, productReviews,
  insertMarketplaceProductSchema, insertMarketplaceOrderSchema, insertCartItemSchema,
  podpayTransactions, podpayWithdrawals,
  pixKeySchema, withdrawalRequestSchema,
  passwordResetTokens,
  sessions,
  lowfySubscriptions,
  referralCodes,
  referralCommissions,
  referralWallet,
  checkoutRecoveryEmails,
  metaAdsCampaigns,
  insertMetaAdsCampaignSchema,
  customDomainMappings,
  insertSupportTicketSchema
} from "@shared/schema";
import { sql, eq, gte, or, desc, like, and, isNull, lte, inArray, notInArray, ilike, count, sum, asc, ne } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { removeOldTrackingScripts, deactivateNonEssentialScripts, intelligentScriptInjection } from "./page-utils";
import { createPixTransaction, createWithdrawal, getBalance, getPodpayServiceSafe } from "./services/podpay";
import { createCreditCardPayment as createAsaasCardPayment, calculateInstallmentSurcharge, getAsaasServiceSafe, createPixTransfer, createRecurringSubscription, deleteSubscription, updateSubscriptionCard, listSubscriptionPayments, getPaymentStatus as getAsaasPaymentStatus } from "./services/asaas";
import { calculateSystemFees } from "./utils/fees";
import { referralRoutes } from "./routes/referrals";
import { generateOTP, sendVerificationCode, validateBrazilianPhone, sendActivationSMS, sendSMS } from "./comtele";
import { phoneVerifications, emailVerifications } from "@shared/schema";
import { getReferralCodeFromCookie } from "./middleware/referral-tracking";
import { getCheckoutUrl, getAppUrl, getLandingUrl } from "@shared/domainConfig";
import { startOfDaySaoPaulo, endOfDaySaoPaulo, subtractDaysSaoPaulo, getNowSaoPaulo, parseDateStringToStartOfDaySaoPaulo, parseDateStringToEndOfDaySaoPaulo } from "@shared/dateUtils";
import sharp from "sharp";
import { ObjectStorageService } from "./objectStorage";
import { whatsappService } from "./whatsapp";
import { campaignDispatcher } from "./whatsappCampaignDispatcher";
import { sendPurchaseEvent as sendFacebookPurchase } from "./services/facebookConversions";

// Helper function to generate ETag from response data
function generateETag(data: any): string {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
}

// Phone normalization function - removes all non-digit characters
function normalizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, '');
  return normalized || undefined;
}

// Brazilian phone normalization - adds 9 to 10-digit numbers (mobile phones)
function normalizeBrazilianPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, '');
  
  // If it's 10 digits, add 9 after the DDD (first 2 digits)
  if (normalized.length === 10) {
    return normalized.substring(0, 2) + '9' + normalized.substring(2);
  }
  
  // If it's already 11 digits or valid, return as is
  if (normalized.length === 11) {
    return normalized;
  }
  
  return normalized || undefined;
}

// Configurar multer para imagens (4MB máximo, qualidade 95%)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // Limite de 4MB para imagens
});

// Configurar multer para documentos (10MB máximo)
const uploadLarge = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB para documentos
});

// Configurar multer para campanhas WhatsApp (50MB para vídeos/áudio/documentos)
const uploadCampaignMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB para mídia de campanhas
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/mpeg',
      'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/octet-stream'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Use imagem, vídeo, áudio ou documento (pdf, doc, xls, ppt, txt, zip)'));
    }
  }
});

// Configurar multer para anexos de bug reports (15MB por arquivo, até 3 arquivos)
const uploadBugAttachments = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB por arquivo
    files: 3 // Máximo de 3 arquivos
  },
  fileFilter: (req, file, cb) => {
    // Aceita apenas imagens e vídeos
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas imagens e vídeos são aceitos.'));
    }
  }
});

// Exportar `io` para ser usado em outros módulos (se necessário)
export let io: SocketIOServer;

// Helper function to emit notifications to specific users
async function emitNotificationToUser(userId: string, notificationId: string) {
  try {
    if (io) {
      // Buscar a notificação completa com dados do actor
      const notification = await storage.getNotificationById(notificationId);
      if (!notification) {
        console.error('Notification not found:', notificationId);
        return;
      }

      // Buscar dados do actor se existir
      let actor = null;
      if (notification.actorId) {
        const actorUser = await storage.getUser(notification.actorId);
        if (actorUser) {
          actor = {
            id: actorUser.id,
            name: actorUser.name,
            profileImageUrl: actorUser.profileImageUrl,
            profession: actorUser.profession,
          };
        }
      }

      // Emitir a notificação completa com todos os dados
      const completeNotification = {
        ...notification,
        actor,
      };

      // DEBUG: Verificar quantos sockets estão na sala do usuário
      const room = `user:${userId}`;
      const socketsInRoom = await io.in(room).fetchSockets();
      logger.debug(`🔍 DEBUG: Sala ${room} tem ${socketsInRoom.length} socket(s) conectado(s)`);
      
      io.to(room).emit('new_notification', completeNotification);
      logger.debug(`📨 Notificação emitida para usuário ${userId}:`, {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        socketsInRoom: socketsInRoom.length
      });
    }
  } catch (error) {
    console.error('Error emitting notification:', error);
  }
}

// SECURITY: Rate limiting para rotas de pagamento
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 tentativas de pagamento por 15 minutos
  message: 'Muitas tentativas de pagamento. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] Payment attempt blocked for user: ${(req as any).user?.id || 'anonymous'}`);
    res.status(429).json({
      message: 'Muitas tentativas de pagamento. Tente novamente em 15 minutos.',
    });
  },
});

const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Máximo 5 solicitações de saque por hora
  message: 'Muitas solicitações de saque. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] Withdrawal attempt blocked for user: ${(req as any).user?.id || 'anonymous'}`);
    res.status(429).json({
      message: 'Muitas solicitações de saque. Tente novamente em 1 hora.',
    });
  },
});

const smsSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 SMS por hora por IP
  message: 'Muitas tentativas de envio de SMS. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] SMS send attempt blocked from IP: ${req.ip}`);
    res.status(429).json({
      message: 'Muitas tentativas de envio de SMS. Tente novamente em 1 hora.',
    });
  },
});

const smsVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de verificação por 15 minutos
  message: 'Muitas tentativas de verificação. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] SMS verification attempt blocked from IP: ${req.ip}`);
    res.status(429).json({
      message: 'Muitas tentativas de verificação. Tente novamente em 15 minutos.',
    });
  },
});

const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // Máximo 30 buscas por 15 minutos por IP
  message: 'Muitas tentativas de busca. Tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] Order lookup attempt blocked from IP: ${req.ip}`);
    res.status(429).json({
      message: 'Muitas tentativas de busca. Tente novamente em alguns minutos.',
    });
  },
});

const subscriptionCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas de checkout por 15 minutos
  message: 'Muitas tentativas de checkout. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    logger.warn(`[Rate Limit] Subscription checkout attempt blocked from IP: ${req.ip}`);
    res.status(429).json({
      message: 'Muitas tentativas de checkout. Tente novamente em 15 minutos.',
    });
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware para cookies (tracking de visualizações únicas)
  app.use(cookieParser());

  setupAuth(app);

  // ==================== OBJECT STORAGE (App Storage) ====================
  // Rota para servir arquivos do Object Storage (imagens de produtos, etc)
  // NOTA: Imagens de produtos do marketplace são sempre públicas (sem ACL)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      if (error?.name === 'ObjectNotFoundError') {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Erro ao servir arquivo" });
    }
  });

  // Compatibilidade com URLs antigas de /uploads/products/ (sistema de arquivos local)
  // NOTA: Arquivos antigos podem ter sido perdidos em deploys anteriores
  app.get("/uploads/products/:filename", (req, res) => {
    const filepath = path.join(process.cwd(), 'public', 'uploads', 'products', req.params.filename);
    if (fs.existsSync(filepath)) {
      res.sendFile(filepath);
    } else {
      res.status(404).json({ error: "Imagem não encontrada (arquivo antigo não disponível)" });
    }
  });

  // ==================== SITEMAP DINÂMICO ====================
  // Gera sitemap-products.xml dinamicamente (apenas produtos de marketplace)
  app.get('/sitemap-products.xml', async (req, res) => {
    try {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Apenas Marketplace Produtos dinâmicos (sem limite para rastreamento completo)
      const productsList = await db.select().from(marketplaceProducts);
      for (const product of productsList) {
        xml += '  <url>\n';
        xml += `    <loc>https://lowfy.com.br/marketplace/produto/${product.id}</loc>\n`;
        xml += `    <lastmod>${product.updatedAt ? new Date(product.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }

      xml += '</urlset>';

      res.type('application/xml');
      res.send(xml);
    } catch (error) {
      logger.error('[Sitemap Products] Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Gera sitemap.xml dinamicamente com todas as páginas públicas
  app.get('/sitemap.xml', async (req, res) => {
    try {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // URLs estáticas
      const staticPages = [
        { loc: 'https://lowfy.com.br/', priority: 1.0, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/termos', priority: 0.6, changefreq: 'monthly' },
        { loc: 'https://lowfy.com.br/privacidade', priority: 0.6, changefreq: 'monthly' },
        { loc: 'https://lowfy.com.br/licenca-plr', priority: 0.6, changefreq: 'monthly' },
        { loc: 'https://lowfy.com.br/direitos-autorais', priority: 0.6, changefreq: 'monthly' },
        { loc: 'https://lowfy.com.br/assinatura/checkout', priority: 0.9, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/clonador/preview', priority: 0.8, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/presell/preview', priority: 0.8, changefreq: 'weekly' },
      ];

      for (const page of staticPages) {
        xml += '  <url>\n';
        xml += `    <loc>${page.loc}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += '  </url>\n';
      }

      // PLRs dinâmicos - apenas URL de página (não URLs individuais sem detalhes)
      try {
        const plrsList = await db.select().from(plrs).limit(1);
        if (plrsList.length > 0) {
          xml += '  <url>\n';
          xml += '    <loc>https://lowfy.com.br/plrs</loc>\n';
          xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.85</priority>\n';
          xml += '  </url>\n';
        }
      } catch (e) {
        logger.debug('[Sitemap] PLRs table error, skipping');
      }

      // Adicionar páginas de conteúdo que sabemos que existem
      const contentPages = [
        { loc: 'https://lowfy.com.br/courses', priority: 0.85, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/templates', priority: 0.80, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/plugins', priority: 0.80, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/marketplace', priority: 0.85, changefreq: 'weekly' },
        { loc: 'https://lowfy.com.br/dashboard', priority: 0.75, changefreq: 'daily' },
      ];

      for (const page of contentPages) {
        xml += '  <url>\n';
        xml += `    <loc>${page.loc}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += '  </url>\n';
      }

      // Ferramentas IA dinâmicas
      try {
        const aiToolsList = await db.select().from(aiTools).limit(1);
        if (aiToolsList.length > 0) {
          xml += '  <url>\n';
          xml += '    <loc>https://lowfy.com.br/ai-tools</loc>\n';
          xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.85</priority>\n';
          xml += '  </url>\n';
        }
      } catch (e) {
        logger.debug('[Sitemap] AI Tools table error, skipping');
      }

      // Automações N8N dinâmicas
      try {
        const n8nList = await db.select().from(n8nAutomations).limit(1);
        if (n8nList.length > 0) {
          xml += '  <url>\n';
          xml += '    <loc>https://lowfy.com.br/modelos-n8n</loc>\n';
          xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.80</priority>\n';
          xml += '  </url>\n';
        }
      } catch (e) {
        logger.debug('[Sitemap] N8N Automations table error, skipping');
      }

      // Serviços dinâmicos
      try {
        const servicesList = await db.select().from(services).limit(1);
        if (servicesList.length > 0) {
          xml += '  <url>\n';
          xml += '    <loc>https://lowfy.com.br/services</loc>\n';
          xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.80</priority>\n';
          xml += '  </url>\n';
        }
      } catch (e) {
        logger.debug('[Sitemap] Services table error, skipping');
      }

      // Marketplace Produtos dinâmicos
      const productsList = await db.select().from(marketplaceProducts).limit(500);
      for (const product of productsList) {
        xml += '  <url>\n';
        xml += `    <loc>https://lowfy.com.br/marketplace/produto/${product.id}</loc>\n`;
        xml += `    <lastmod>${product.updatedAt ? new Date(product.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.75</priority>\n';
        xml += '  </url>\n';
      }

      xml += '</urlset>';

      res.type('application/xml');
      res.send(xml);
    } catch (error) {
      logger.error('[Sitemap] Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ==================== DIAGNÓSTICO DE DOMÍNIOS (TEMPORÁRIO) ====================
  // Endpoint público para diagnóstico - REMOVER EM PRODUÇÃO
  app.get('/api/debug/cloudflare-hostnames', async (req, res) => {
    try {
      const { listCustomHostnames, getCustomHostname } = await import('./utils/cloudflareForSaas');
      const { hostnames } = await listCustomHostnames(1, 100);
      
      // Também buscar mapeamentos do banco
      const dbMappings = await db.select().from(customDomainMappings);
      
      res.json({
        cloudflareHostnames: hostnames.map(h => ({
          hostname: h.hostname,
          status: h.status,
          ssl: h.ssl?.status,
          id: h.id
        })),
        databaseMappings: dbMappings.map(m => ({
          domain: m.domain,
          pageType: m.pageType,
          pageSlug: m.pageSlug,
          pagePath: m.pagePath,
          cloudflareStatus: m.cloudflareStatus,
          sslStatus: m.sslStatus,
          isActive: m.isActive
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DOMAIN LOOKUP API (for Cloudflare Workers) ====================
  // Endpoint público para o Worker consultar qual página servir baseado no domínio
  // IMPORTANTE: Cada subdomínio é tratado separadamente (www, loja, app, etc são diferentes)
  app.get('/api/domain-lookup/:domain', async (req, res) => {
    try {
      // NÃO normaliza www - cada subdomínio é único!
      const domain = req.params.domain.toLowerCase();
      
      // 1. PRIMEIRO: Buscar no banco de dados (fonte primária - mais confiável)
      const dbMapping = await db.select()
        .from(customDomainMappings)
        .where(eq(customDomainMappings.domain, domain))
        .limit(1);
      
      if (dbMapping.length > 0 && dbMapping[0].isActive) {
        const mapping = dbMapping[0];
        logger.debug(`[Domain Lookup] Found in DB: ${domain} -> ${mapping.pagePath}`);
        return res.json({
          found: true,
          type: mapping.pageType,
          slug: mapping.pageSlug,
          path: mapping.pagePath,
          domain: mapping.domain
        });
      }

      const enableFsFallback = process.env.ENABLE_DOMAIN_LOOKUP_FS_FALLBACK === 'true';
      if (!enableFsFallback) {
        return res.json({ found: false });
      }

      const clonedDir = path.join(process.cwd(), 'cloned-pages');
      try {
        const files = await fs.promises.readdir(clonedDir);
        const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
        for (const file of metadataFiles) {
          try {
            const metadataPath = path.join(clonedDir, file);
            const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
            if (
              metadata.customDomain &&
              metadata.customDomain.toLowerCase() === domain &&
              metadata.isActive !== false
            ) {
              const slug = file.replace('.metadata.json', '');
              return res.json({
                found: true,
                type: 'cloned',
                slug,
                path: `/pages/${slug}`,
                domain: metadata.customDomain,
              });
            }
          } catch {}
        }
      } catch {}

      const presellDir = path.join(process.cwd(), 'presell-pages');
      try {
        const files = await fs.promises.readdir(presellDir);
        const metadataFiles = files.filter(f => f.endsWith('.metadata.json'));
        for (const file of metadataFiles) {
          try {
            const metadataPath = path.join(presellDir, file);
            const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8'));
            if (
              metadata.customDomain &&
              metadata.customDomain.toLowerCase() === domain &&
              metadata.isActive !== false
            ) {
              const slug = file.replace('.metadata.json', '');
              return res.json({
                found: true,
                type: 'presell',
                slug,
                path: `/presell/${slug}`,
                domain: metadata.customDomain,
              });
            }
          } catch {}
        }
      } catch {}
      
      // Não encontrado
      res.json({ found: false });
    } catch (error) {
      logger.error('[Domain Lookup] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint para responder challenges de ownership do Cloudflare for SaaS
  // O Worker consulta esta rota para responder ao /.well-known/cf-custom-hostname-challenge/*
  app.get('/api/cloudflare-challenge/:hostname/:challengeId', async (req, res) => {
    try {
      const { hostname, challengeId } = req.params;
      // NÃO normaliza www - cada subdomínio é único!
      const normalizedHostname = hostname.toLowerCase();
      
      const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
      const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
      
      if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
        logger.error('[Cloudflare Challenge] Missing API credentials');
        return res.status(500).json({ error: 'Cloudflare not configured' });
      }
      
      // Buscar todos os custom hostnames que correspondem ao hostname
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(normalizedHostname)}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json() as any;
      
      if (!data.success || !data.result || data.result.length === 0) {
        // Tentar buscar com www
        const wwwResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=www.${encodeURIComponent(normalizedHostname)}`,
          {
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const wwwData = await wwwResponse.json() as any;
        
        if (!wwwData.success || !wwwData.result || wwwData.result.length === 0) {
          logger.warn(`[Cloudflare Challenge] No hostname found for: ${normalizedHostname}`);
          return res.status(404).json({ error: 'Hostname not found' });
        }
        
        data.result = wwwData.result;
      }
      
      // Procurar o challenge que corresponde ao challengeId
      for (const hostname of data.result) {
        if (hostname.ownership_verification_http) {
          const httpUrl = hostname.ownership_verification_http.http_url;
          const httpBody = hostname.ownership_verification_http.http_body;
          
          // Verificar se o challengeId corresponde
          if (httpUrl && httpUrl.includes(challengeId)) {
            logger.info(`[Cloudflare Challenge] Found ownership challenge for ${normalizedHostname}`);
            return res.json({ body: httpBody });
          }
        }
        
        // Verificar se o ID do hostname corresponde ao challengeId
        if (hostname.id === challengeId && hostname.ownership_verification_http) {
          logger.info(`[Cloudflare Challenge] Found ownership challenge by ID for ${normalizedHostname}`);
          return res.json({ body: hostname.ownership_verification_http.http_body });
        }
      }
      
      logger.warn(`[Cloudflare Challenge] Challenge ${challengeId} not found for ${normalizedHostname}`);
      res.status(404).json({ error: 'Challenge not found' });
    } catch (error) {
      logger.error('[Cloudflare Challenge] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint para responder challenges ACME/SSL do Cloudflare
  // O Worker consulta esta rota para responder ao /.well-known/acme-challenge/*
  app.get('/api/acme-challenge/:hostname/:token', async (req, res) => {
    try {
      const { hostname, token } = req.params;
      // NÃO normaliza www - cada subdomínio é único!
      const normalizedHostname = hostname.toLowerCase();
      
      const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
      const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
      
      if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
        logger.error('[ACME Challenge] Missing API credentials');
        return res.status(500).json({ error: 'Cloudflare not configured' });
      }
      
      // Buscar todos os custom hostnames que correspondem ao hostname
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(normalizedHostname)}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json() as any;
      
      if (!data.success || !data.result || data.result.length === 0) {
        logger.warn(`[ACME Challenge] No hostname found for: ${normalizedHostname}`);
        return res.status(404).json({ error: 'Hostname not found' });
      }
      
      // Procurar o challenge que corresponde ao token
      for (const hostnameData of data.result) {
        if (hostnameData.ssl && hostnameData.ssl.validation_records) {
          for (const record of hostnameData.ssl.validation_records) {
            if (record.http_url && record.http_url.includes(token)) {
              logger.info(`[ACME Challenge] Found SSL challenge for ${normalizedHostname}`);
              return res.json({ body: record.http_body });
            }
          }
        }
        
        // Também verificar http_url e http_body diretamente no ssl object
        if (hostnameData.ssl && hostnameData.ssl.http_url && hostnameData.ssl.http_url.includes(token)) {
          logger.info(`[ACME Challenge] Found SSL challenge (direct) for ${normalizedHostname}`);
          return res.json({ body: hostnameData.ssl.http_body });
        }
      }
      
      logger.warn(`[ACME Challenge] Challenge ${token} not found for ${normalizedHostname}`);
      res.status(404).json({ error: 'Challenge not found' });
    } catch (error) {
      logger.error('[ACME Challenge] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==================== AUTHROUTES ====================

  // Check if email already exists (for post-checkout auto-fill)
  app.post('/api/auth/check-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email é obrigatório" });
      }
      
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      res.json({ exists: !!existingUser });
    } catch (error: any) {
      logger.error('[Check Email] Error:', error);
      res.status(500).json({ message: "Erro ao verificar email" });
    }
  });

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const passwordHash = await hashPassword(userData.password);

      // Remover formatação do CPF se foi enviado e validar
      let cpf = undefined;
      if (userData.cpf) {
        const sanitizedCPF = userData.cpf.replace(/\D/g, '');
        if (sanitizedCPF.length !== 11 && sanitizedCPF.length !== 0) {
          return res.status(400).json({ message: "CPF deve ter 11 dígitos" });
        }
        cpf = sanitizedCPF || undefined;
      }

      // Normalizar telefone (remover todos os caracteres não-numéricos)
      const normalizedPhone = normalizePhone(userData.phone);

      // Verificar se o telefone já está cadastrado
      if (normalizedPhone) {
        const existingUserByPhone = await storage.getUserByPhone(normalizedPhone);
        if (existingUserByPhone) {
          // Se o telefone não foi verificado, informar que precisa verificar
          if (!existingUserByPhone.phoneVerified) {
            return res.status(400).json({ 
              message: "Este telefone já foi cadastrado mas não foi verificado. Faça login para verificar seu número.",
              requiresVerification: true,
              userId: existingUserByPhone.id
            });
          }
          return res.status(400).json({ message: "Este telefone já está cadastrado" });
        }
      }

      // Verificar se o CPF já está cadastrado
      if (cpf) {
        const existingUserByCpf = await storage.getUserByCpf(cpf);
        if (existingUserByCpf) {
          return res.status(400).json({ message: "Este CPF já está cadastrado" });
        }
      }

      // Criar usuário com status pendente (aguardando verificação de telefone)
      const user = await storage.createUser({
        email: userData.email,
        name: userData.name,
        phone: normalizedPhone,
        cpf,
        passwordHash,
        accountStatus: 'pending', // Conta pendente até verificar telefone
      });

      // NÃO criar sessão aqui - sessão será criada APÓS verificação do telefone
      // A verificação do telefone é obrigatória para ativar a conta

      // Initialize daily activities for new user
      const { initializeUserDailyActivities } = await import('./gamification-scheduler.js');
      await initializeUserDailyActivities(user.id);

      // Enviar email de boas-vindas
      try {
        const welcomeEmailHtml = generateWelcomeEmailTemplate(user.name, user.email);
        await sendEmail({
          to: user.email,
          subject: 'Bem-vindo à Lowfy! 🎉',
          html: welcomeEmailHtml,
        });
        console.log(`✅ Email de boas-vindas enviado para: ${user.email}`);
      } catch (emailError) {
        console.error('❌ Erro ao enviar email de boas-vindas:', emailError);
        // Não falhar o registro se o email falhar
      }

      logger.info(`✅ Usuário criado (pendente verificação de telefone): ${user.id}`);
      
      const { passwordHash: _, ...userWithoutPassword } = user;
      // Retornar usuário sem token - sessão será criada após verificar telefone
      res.status(201).json({ 
        user: userWithoutPassword, 
        requiresPhoneVerification: true,
        message: 'Conta criada! Verifique seu telefone para ativar sua conta.'
      });
    } catch (error: any) {
      console.error("Error registering user:", error);
      if (error.code === '23505') {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  // Activate Account - After purchase (email + CPF + password)
  app.post('/api/auth/activate-account', async (req, res) => {
    try {
      const { email, cpf, password, confirmPassword } = req.body;

      if (!email || !cpf || !password) {
        return res.status(400).json({ message: "Email, CPF e senha são obrigatórios" });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "As senhas não coincidem" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      }

      // Normalizar CPF
      const cpfNormalized = cpf.replace(/\D/g, '');
      if (cpfNormalized.length !== 11) {
        return res.status(400).json({ message: "CPF inválido" });
      }

      // Buscar usuário com status pending_activation (criado após compra)
      const [user] = await db.select()
        .from(users)
        .where(and(
          eq(users.email, email.toLowerCase().trim()),
          eq(users.accountStatus, 'pending_activation')
        ))
        .limit(1);
      
      if (!user) {
        return res.status(404).json({ message: "Conta não encontrada. Verifique o email ou realize uma compra." });
      }

      // Validar CPF do usuário
      const userCpfNormalized = user.cpf ? user.cpf.replace(/\D/g, '') : '';
      if (userCpfNormalized !== cpfNormalized) {
        logger.warn(`[ACTIVATE-ACCOUNT] CPF inválido para: ${user.email}`);
        return res.status(400).json({ message: "Email ou CPF incorreto" });
      }

      logger.info(`[ACTIVATE-ACCOUNT] Ativando conta para: ${user.email}`);

      // Hash da nova senha
      const newPasswordHash = await hashPassword(password);

      // Atualizar senha e status para active
      await db
        .update(users)
        .set({ 
          passwordHash: newPasswordHash, 
          accountStatus: 'active',
          phoneVerified: true, // Marcar como verificado já que vem de compra confirmada
          updatedAt: new Date() 
        })
        .where(eq(users.id, user.id));

      // Criar nova sessão para login automático
      const sessionId = await createSession(user.id);

      logger.info(`[ACTIVATE-ACCOUNT] ✅ Conta ativada e usuário logado: ${user.id}`);

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json({ 
        success: true,
        sessionId,
        user: { ...userWithoutPassword, accountStatus: 'active' },
        message: "Conta ativada com sucesso! Bem-vindo à Lowfy!"
      });
    } catch (error: any) {
      logger.error("[ACTIVATE-ACCOUNT] ❌ Erro:", { error: error.message, stack: error.stack });
      res.status(500).json({ message: "Erro ao ativar conta" });
    }
  });

  // Reset Password Direct - Without token (email + CPF validation)
  app.post('/api/auth/reset-password-direct', async (req, res) => {
    try {
      const { email, cpf, newPassword, confirmPassword } = req.body;

      if (!email || !cpf || !newPassword) {
        return res.status(400).json({ message: "Email, CPF e nova senha são obrigatórios" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "As senhas não coincidem" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      }

      // Normalizar CPF (remover caracteres especiais)
      const cpfNormalized = cpf.replace(/\D/g, '');
      if (cpfNormalized.length !== 11) {
        return res.status(400).json({ message: "CPF inválido" });
      }

      // Buscar usuário por email
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Validar CPF do usuário
      const userCpfNormalized = user.cpf ? user.cpf.replace(/\D/g, '') : '';
      if (userCpfNormalized !== cpfNormalized) {
        logger.warn(`[RESET-PASSWORD-DIRECT] CPF inválido para usuário: ${user.id}`);
        return res.status(400).json({ message: "Email ou CPF incorreto" });
      }

      logger.info(`[RESET-PASSWORD-DIRECT] Redefinindo senha para: ${user.email}`);

      // Hash da nova senha
      const newPasswordHash = await hashPassword(newPassword);

      // Atualizar senha do usuário
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Invalidar todas as sessões anteriores por segurança
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      // Criar nova sessão para login automático
      const sessionId = await createSession(user.id);

      logger.info(`[RESET-PASSWORD-DIRECT] ✅ Senha redefinida e usuário logado: ${user.id}`);

      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json({ 
        success: true,
        sessionId,
        user: userWithoutPassword,
        message: "Senha redefinida com sucesso! Você foi automaticamente conectado."
      });
    } catch (error: any) {
      logger.error("[RESET-PASSWORD-DIRECT] ❌ Erro:", { error: error.message, stack: error.stack });
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  // Forgot Password - Request reset
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email é obrigatório" });
      }

      // Buscar usuário por email
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      // Sempre retornar sucesso para não vazar se o email existe ou não (segurança)
      if (!user) {
        return res.json({ 
          message: "Se o email existir em nossa base, você receberá um link para redefinir sua senha." 
        });
      }

      // Invalidar tokens anteriores do usuário
      await db
        .update(passwordResetTokens)
        .set({ used: true, usedAt: new Date() })
        .where(and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.used, false)
        ));

      // Gerar token único
      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Criar registro de reset
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        email: user.email,
        token: resetToken,
        expiresAt,
      });

      // Enviar email com link de redefinição
      try {
        logger.info(`[FORGOT-PASSWORD] Gerando email para: ${user.email}`);
        const resetEmailHtml = generatePasswordResetTemplate(user.name, resetToken);
        logger.info(`[FORGOT-PASSWORD] Template gerado, enviando email...`);
        
        const emailResult = await sendEmail({
          to: user.email,
          subject: '🔒 Redefinição de Senha - Lowfy',
          html: resetEmailHtml,
        });
        
        logger.info(`[FORGOT-PASSWORD] ✅ Email enviado com sucesso para: ${user.email}`, { result: emailResult });
      } catch (emailError: any) {
        logger.error('[FORGOT-PASSWORD] ❌ ERRO ao enviar email:', {
          to: user.email,
          error: emailError.message,
          code: emailError.code,
          response: emailError.response,
          stack: emailError.stack,
        });
        return res.status(500).json({ message: "Erro ao enviar email. Tente novamente mais tarde." });
      }

      res.json({ 
        message: "Se o email existir em nossa base, você receberá um link para redefinir sua senha." 
      });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      res.status(500).json({ message: "Erro ao processar solicitação" });
    }
  });

  // Reset Password - Confirm new password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token e nova senha são obrigatórios" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      }

      // Buscar token válido
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gte(passwordResetTokens.expiresAt, new Date())
        ))
        .limit(1);

      if (!resetToken) {
        logger.warn('[RESET-PASSWORD] Token inválido ou expirado');
        return res.status(400).json({ message: "Token inválido ou expirado" });
      }

      logger.info(`[RESET-PASSWORD] Token válido para userId: ${resetToken.userId}`);

      // Hash da nova senha
      const newPasswordHash = await hashPassword(newPassword);
      logger.debug(`[RESET-PASSWORD] Hash gerado para nova senha (primeiros 20 chars): ${newPasswordHash.substring(0, 20)}...`);

      // Atualizar senha do usuário
      const updateResult = await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId))
        .returning({ id: users.id, email: users.email });

      if (!updateResult || updateResult.length === 0) {
        logger.error(`[RESET-PASSWORD] ❌ Falha ao atualizar senha - usuário não encontrado: ${resetToken.userId}`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      logger.info(`[RESET-PASSWORD] ✅ Senha atualizada para: ${updateResult[0].email}`);

      // Verificar se a senha foi salva corretamente
      const [updatedUser] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, resetToken.userId))
        .limit(1);

      if (updatedUser) {
        const verifyNewPassword = await verifyPassword(newPassword, updatedUser.passwordHash);
        logger.info(`[RESET-PASSWORD] Verificação da nova senha: ${verifyNewPassword ? '✅ OK' : '❌ FALHOU'}`);
        
        if (!verifyNewPassword) {
          logger.error('[RESET-PASSWORD] ❌ ERRO CRÍTICO: Senha não foi salva corretamente!');
        }
      }

      // Marcar token como usado
      await db
        .update(passwordResetTokens)
        .set({ used: true, usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      // Invalidar todas as sessões anteriores do usuário por segurança
      await db.delete(sessions).where(eq(sessions.userId, resetToken.userId));

      logger.info(`[RESET-PASSWORD] ✅ Processo completo para usuário: ${resetToken.userId}`);

      res.json({ message: "Senha redefinida com sucesso! Faça login com sua nova senha." });
    } catch (error: any) {
      logger.error("[RESET-PASSWORD] ❌ Erro:", { error: error.message, stack: error.stack });
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  // Send Phone Verification SMS
  app.post('/api/auth/phone/send', smsSendLimiter, async (req, res) => {
    try {
      const { userId, phone } = req.body;

      if (!userId || !phone) {
        return res.status(400).json({ message: "userId e phone são obrigatórios" });
      }

      // Validar telefone brasileiro
      if (!validateBrazilianPhone(phone)) {
        return res.status(400).json({ message: "Telefone inválido" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Check cooldown - último SMS enviado há menos de 1 minuto
      const [lastVerification] = await db
        .select()
        .from(phoneVerifications)
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.status, 'pending')
        ))
        .orderBy(desc(phoneVerifications.lastSentAt))
        .limit(1);

      if (lastVerification) {
        const timeSinceLastSend = Date.now() - new Date(lastVerification.lastSentAt).getTime();
        const cooldownMs = 60 * 1000; // 1 minuto
        if (timeSinceLastSend < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
          return res.status(429).json({ 
            message: `Aguarde ${remainingSeconds} segundos para reenviar o código`,
            remainingSeconds 
          });
        }
      }

      // Gerar código OTP
      const code = generateOTP();
      const codeHash = await hashPassword(code);

      // Invalidar códigos anteriores
      await db
        .update(phoneVerifications)
        .set({ status: 'expired' })
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.status, 'pending')
        ));

      // Criar novo registro de verificação
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
      await db.insert(phoneVerifications).values({
        userId,
        phone: normalizePhone(phone) || '',
        codeHash,
        expiresAt,
        attemptCount: 0,
        status: 'pending',
      });

      // Enviar SMS
      await sendVerificationCode(phone, code);

      logger.info(`✅ Código SMS enviado para usuário ${userId}`);
      res.json({ 
        success: true, 
        message: "Código enviado com sucesso",
        expiresIn: 600 // 10 minutos em segundos
      });
    } catch (error: any) {
      logger.error("Error sending verification SMS:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar SMS" });
    }
  });

  // Verify Phone Code
  app.post('/api/auth/phone/verify', smsVerifyLimiter, async (req, res) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ message: "userId e code são obrigatórios" });
      }

      if (code.length !== 6) {
        return res.status(400).json({ message: "Código deve ter 6 dígitos" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Buscar verificação pendente
      const [verification] = await db
        .select()
        .from(phoneVerifications)
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.status, 'pending')
        ))
        .orderBy(desc(phoneVerifications.createdAt))
        .limit(1);

      if (!verification) {
        return res.status(404).json({ message: "Nenhuma verificação pendente encontrada" });
      }

      // Verificar expiração
      if (new Date() > new Date(verification.expiresAt)) {
        await db
          .update(phoneVerifications)
          .set({ status: 'expired' })
          .where(eq(phoneVerifications.id, verification.id));
        return res.status(400).json({ message: "Código expirado. Solicite um novo código." });
      }

      // Verificar limite de tentativas
      if (verification.attemptCount >= 3) {
        await db
          .update(phoneVerifications)
          .set({ status: 'failed' })
          .where(eq(phoneVerifications.id, verification.id));
        return res.status(429).json({ message: "Muitas tentativas. Solicite um novo código." });
      }

      // Verificar código
      const isValidCode = await verifyPassword(code, verification.codeHash);

      // Incrementar contador de tentativas
      await db
        .update(phoneVerifications)
        .set({ attemptCount: verification.attemptCount + 1 })
        .where(eq(phoneVerifications.id, verification.id));

      if (!isValidCode) {
        const remainingAttempts = 3 - (verification.attemptCount + 1);
        return res.status(400).json({ 
          message: `Código inválido. ${remainingAttempts} tentativas restantes.`,
          remainingAttempts
        });
      }

      // ✅ Código válido - marcar usuário como verificado
      const updatedUser = await storage.updateUser(userId, {
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        accountStatus: 'active',
      });

      // Marcar verificação como concluída
      await db
        .update(phoneVerifications)
        .set({ status: 'verified' })
        .where(eq(phoneVerifications.id, verification.id));

      // Criar sessão automática após verificação bem-sucedida
      const token = await createSession(userId);

      // Track daily login for gamification
      await storage.trackDailyLogin(userId);

      // Initialize daily activities for new user if needed
      const { initializeUserDailyActivities } = await import('./gamification-scheduler.js');
      await initializeUserDailyActivities(userId);

      // Emit gamification update for login
      io.emit('gamification_update', {
        userId: userId,
        action: 'phone_verified',
        points: 0
      });

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      logger.info(`✅ Telefone verificado com sucesso para usuário ${userId}`);
      
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.json({ 
        success: true, 
        message: "Telefone verificado com sucesso!",
        user: userWithoutPassword,
        token
      });
    } catch (error: any) {
      logger.error("Error verifying phone code:", error);
      res.status(500).json({ message: "Erro ao verificar código" });
    }
  });

  // Reenviar código de verificação para usuários não verificados
  app.post('/api/auth/phone/resend-for-user', smsSendLimiter, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "userId é obrigatório" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Só permitir reenvio se o telefone não foi verificado
      if (user.phoneVerified) {
        return res.status(400).json({ message: "Este telefone já foi verificado" });
      }

      if (!user.phone) {
        return res.status(400).json({ message: "Usuário não possui telefone cadastrado" });
      }

      // Check cooldown - último SMS enviado há menos de 1 minuto
      const [lastVerification] = await db
        .select()
        .from(phoneVerifications)
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.status, 'pending')
        ))
        .orderBy(desc(phoneVerifications.lastSentAt))
        .limit(1);

      if (lastVerification) {
        const timeSinceLastSend = Date.now() - new Date(lastVerification.lastSentAt).getTime();
        const cooldownMs = 60 * 1000; // 1 minuto
        if (timeSinceLastSend < cooldownMs) {
          const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
          return res.status(429).json({ 
            message: `Aguarde ${remainingSeconds} segundos para reenviar o código`,
            remainingSeconds 
          });
        }
      }

      // Gerar novo código OTP
      const code = generateOTP();
      const codeHash = await hashPassword(code);

      // Invalidar códigos anteriores
      await db
        .update(phoneVerifications)
        .set({ status: 'expired' })
        .where(and(
          eq(phoneVerifications.userId, userId),
          eq(phoneVerifications.status, 'pending')
        ));

      // Criar novo registro de verificação
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
      await db.insert(phoneVerifications).values({
        userId,
        phone: user.phone,
        codeHash,
        expiresAt,
        attemptCount: 0,
        status: 'pending',
      });

      // Enviar SMS
      await sendVerificationCode(user.phone, code);

      logger.info(`✅ Código SMS reenviado para usuário ${userId}`);
      res.json({ 
        success: true, 
        message: "Código reenviado com sucesso",
        expiresIn: 600 // 10 minutos em segundos
      });
    } catch (error: any) {
      logger.error("Error resending verification SMS:", error);
      res.status(500).json({ message: error.message || "Erro ao reenviar SMS" });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      logger.debug(`[LOGIN] Tentativa de login: ${email}`);

      // Aceita email ou username
      const user = await storage.getUserByEmailOrUsername(email);
      if (!user) {
        logger.warn(`[LOGIN] Usuário não encontrado: ${email}`);
        return res.status(401).json({ message: "Email/usuário ou senha inválidos" });
      }

      logger.debug(`[LOGIN] Usuário encontrado: ${user.email}, verificando senha...`);
      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        logger.warn(`[LOGIN] Senha incorreta para: ${user.email}`);
        return res.status(401).json({ message: "Email/usuário ou senha inválidos" });
      }
      
      logger.info(`[LOGIN] Senha válida para: ${user.email}`);

      if (user.accountStatus === 'blocked') {
        return res.status(403).json({ message: "Conta bloqueada. Entre em contato com o suporte." });
      }

      // ✅ 2FA DESATIVADO - Login bem-sucedido para: ${user.email}
      const sessionId = await createSession(user.id);
      
      logger.info(`✅ [LOGIN] Login bem-sucedido para: ${user.email}`);
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionStatus: user.subscriptionStatus,
          accessPlan: user.accessPlan,
          isAdmin: user.isAdmin,
        },
        sessionId,
        message: "Login bem-sucedido",
      });
      
      return;
    } catch (error: any) {
      logger.error("❌ [LOGIN] Erro durante login:", {
        errorMessage: error.message,
        errorCode: error.code,
        stack: error.stack,
      });
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Verificar código 2FA (aceita código de email OU SMS)
  app.post('/api/auth/verify-2fa', async (req, res) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      // Buscar usuário
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      let verified = false;
      let isPhoneVerification = false;

      // Tentar verificar código de email (2FA normal)
      const emailVerification = await verify2FACode(userId, code);
      
      if (emailVerification.success) {
        verified = true;
      } else {
        // Se falhar, tentar verificar código SMS (para completar cadastro)
        const phoneVerificationRecord = await db.query.phoneVerifications.findFirst({
          where: and(
            eq(phoneVerifications.userId, userId),
            eq(phoneVerifications.status, 'pending')
          ),
          orderBy: (phoneVerifications, { desc }) => [desc(phoneVerifications.createdAt)],
        });

        if (phoneVerificationRecord) {
          // Verificar se expirou
          if (phoneVerificationRecord.expiresAt < new Date()) {
            return res.status(400).json({ message: "Código expirado" });
          }

          // Verificar número de tentativas
          if (phoneVerificationRecord.attemptCount >= 5) {
            await db.update(phoneVerifications)
              .set({ status: 'failed' })
              .where(eq(phoneVerifications.id, phoneVerificationRecord.id));
            return res.status(400).json({ message: "Número máximo de tentativas excedido" });
          }

          // Verificar código
          const isValidCode = await verifyPassword(code, phoneVerificationRecord.codeHash);

          if (isValidCode) {
            verified = true;
            isPhoneVerification = true;

            // Marcar verificação como verificada
            await db.update(phoneVerifications)
              .set({ 
                status: 'verified',
                verifiedAt: new Date()
              })
              .where(eq(phoneVerifications.id, phoneVerificationRecord.id));

            // Marcar telefone como verificado no usuário (usando storage para invalidar cache)
            await storage.updateUser(userId, {
              phoneVerified: true,
              phoneVerifiedAt: new Date()
            });

            logger.info(`✅ Telefone verificado para usuário ${userId}`);
          } else {
            // Incrementar tentativas apenas em caso de falha
            await db.update(phoneVerifications)
              .set({ attemptCount: phoneVerificationRecord.attemptCount + 1 })
              .where(eq(phoneVerifications.id, phoneVerificationRecord.id));
          }
        }
      }

      if (!verified) {
        return res.status(400).json({ message: "Código incorreto" });
      }

      // Criar sessão
      const token = await createSession(user.id);

      // Track daily login for gamification
      await storage.trackDailyLogin(user.id);

      // Emit gamification update for login
      io.emit('gamification_update', {
        userId: user.id,
        action: 'login',
        points: 0
      });

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      // Buscar usuário atualizado (caso tenha sido modificado)
      const updatedUser = await storage.getUser(userId);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser!;
      
      res.json({ 
        user: userWithoutPassword, 
        token,
        phoneVerificationCompleted: isPhoneVerification
      });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      res.status(500).json({ message: "Erro ao verificar código" });
    }
  });

  // Rate limiter para reenvio de 2FA (proteção contra spam)
  const resend2FALimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 3, // Máximo 3 tentativas por minuto por IP
    message: { message: 'Muitas tentativas. Aguarde 1 minuto antes de tentar novamente.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  });

  // Reenviar código 2FA por email
  app.post('/api/auth/resend-2fa', resend2FALimiter, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        // Resposta genérica para evitar enumeração de contas
        return res.json({ message: "Se a conta existir, o código será reenviado" });
      }

      // Verificar se existe uma verificação 2FA pendente recente (últimos 10 minutos)
      const [recentVerification] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, userId),
            eq(emailVerifications.status, 'pending'),
            gte(emailVerifications.expiresAt, new Date())
          )
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);

      if (!recentVerification) {
        // Não há verificação pendente - usuário não está no fluxo de login
        return res.json({ message: "Se a conta existir, o código será reenviado" });
      }

      // Gerar novo código 2FA
      const code = generate2FACode();
      await create2FAVerification(user.id, user.email, code);
      
      let sentViaWhatsApp = false;
      
      // Tentar enviar via WhatsApp se estiver conectado e usuário tiver telefone
      if (user.phone && whatsappService.isConnected()) {
        try {
          await whatsappService.sendVerificationCode(user.phone, code);
          sentViaWhatsApp = true;
          logger.info(`[2FA] Código reenviado via WhatsApp para ${user.phone}`);
        } catch (whatsappError: any) {
          logger.warn(`[2FA] Falha ao enviar via WhatsApp, tentando email:`, whatsappError.message);
        }
      }
      
      // Se não enviou via WhatsApp, enviar por email
      if (!sentViaWhatsApp) {
        await send2FACode(user.email, user.name, code);
        logger.info(`[2FA] Código reenviado por EMAIL para ${user.email}`);
      }

      res.json({ 
        message: sentViaWhatsApp 
          ? "Código reenviado para seu WhatsApp" 
          : "Código reenviado para seu email",
        method: sentViaWhatsApp ? "whatsapp" : "email"
      });
    } catch (error) {
      console.error("Error resending 2FA:", error);
      res.status(500).json({ message: "Erro ao reenviar código" });
    }
  });

  // Enviar código 2FA por SMS (alternativa ao email)
  app.post('/api/auth/send-2fa-sms', resend2FALimiter, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        // Resposta genérica para evitar enumeração de contas
        return res.json({ message: "Se a conta existir e possuir telefone, o código será enviado" });
      }

      if (!user.phone) {
        return res.status(400).json({ message: "Nenhum telefone cadastrado para esta conta" });
      }

      // Verificar se existe uma verificação 2FA pendente recente (usuário está no fluxo de login)
      // Pode ser verificação de email OU phone (usuário pode estar tentando SMS como alternativa ao email)
      const [recentEmailVerification] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, userId),
            eq(emailVerifications.status, 'pending'),
            gte(emailVerifications.expiresAt, new Date())
          )
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);

      const [recentPhoneVerification] = await db
        .select()
        .from(phoneVerifications)
        .where(
          and(
            eq(phoneVerifications.userId, userId),
            eq(phoneVerifications.status, 'pending'),
            gte(phoneVerifications.expiresAt, new Date())
          )
        )
        .orderBy(desc(phoneVerifications.createdAt))
        .limit(1);

      if (!recentEmailVerification && !recentPhoneVerification) {
        // Não há verificação pendente - usuário não está no fluxo de login
        return res.json({ message: "Se a conta existir e possuir telefone, o código será enviado" });
      }

      // Gerar código OTP para SMS
      const code = generateOTP();
      const codeHash = await hashPassword(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      // Limpar verificações pendentes anteriores
      await db.delete(phoneVerifications)
        .where(
          and(
            eq(phoneVerifications.userId, user.id),
            eq(phoneVerifications.status, 'pending')
          )
        );

      // Criar nova verificação por SMS
      await db.insert(phoneVerifications).values({
        userId: user.id,
        phone: user.phone,
        codeHash,
        expiresAt,
        attemptCount: 0,
        status: 'pending',
        lastSentAt: new Date(),
      });

      // Enviar SMS
      await sendVerificationCode(user.phone, code);

      // Mascarar telefone para exibição
      const maskedPhone = user.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
      
      logger.info(`[2FA] Código enviado por SMS para ${user.phone}`);

      res.json({ 
        message: `Código enviado por SMS para ${maskedPhone}`,
        method: "sms",
        phone: maskedPhone
      });
    } catch (error) {
      console.error("Error sending 2FA SMS:", error);
      res.status(500).json({ message: "Erro ao enviar código por SMS" });
    }
  });

  // Enviar código 2FA por WhatsApp (alternativa ao email)
  app.post('/api/auth/send-2fa-whatsapp', resend2FALimiter, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.json({ message: "Se a conta existir e possuir telefone, o código será enviado" });
      }

      if (!user.phone) {
        return res.status(400).json({ message: "Nenhum telefone cadastrado para esta conta" });
      }

      // Verificar se WhatsApp está conectado
      if (!whatsappService.isConnected()) {
        return res.status(400).json({ message: "WhatsApp não está disponível no momento. Tente por email." });
      }

      // Verificar se existe uma verificação 2FA pendente recente
      const [recentEmailVerification] = await db
        .select()
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.userId, userId),
            eq(emailVerifications.status, 'pending'),
            gte(emailVerifications.expiresAt, new Date())
          )
        )
        .orderBy(desc(emailVerifications.createdAt))
        .limit(1);

      const [recentPhoneVerification] = await db
        .select()
        .from(phoneVerifications)
        .where(
          and(
            eq(phoneVerifications.userId, userId),
            eq(phoneVerifications.status, 'pending'),
            gte(phoneVerifications.expiresAt, new Date())
          )
        )
        .orderBy(desc(phoneVerifications.createdAt))
        .limit(1);

      if (!recentEmailVerification && !recentPhoneVerification) {
        return res.json({ message: "Se a conta existir e possuir telefone, o código será enviado" });
      }

      // Gerar código OTP para WhatsApp
      const code = generateOTP();
      const codeHash = await hashPassword(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Limpar verificações pendentes anteriores
      await db.delete(phoneVerifications)
        .where(
          and(
            eq(phoneVerifications.userId, user.id),
            eq(phoneVerifications.status, 'pending')
          )
        );

      // Criar nova verificação por WhatsApp
      await db.insert(phoneVerifications).values({
        userId: user.id,
        phone: user.phone,
        codeHash,
        expiresAt,
        attemptCount: 0,
        status: 'pending',
        lastSentAt: new Date(),
      });

      // Enviar via WhatsApp
      await whatsappService.sendVerificationCode(user.phone, code);

      // Mascarar telefone para exibição
      const maskedPhone = user.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
      
      logger.info(`[2FA] Código enviado por WhatsApp para ${user.phone}`);

      res.json({ 
        message: `Código enviado por WhatsApp para ${maskedPhone}`,
        method: "whatsapp",
        phone: maskedPhone
      });
    } catch (error: any) {
      console.error("Error sending 2FA WhatsApp:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar código por WhatsApp" });
    }
  });

  // Logout
  app.post('/api/auth/logout', authMiddleware, async (req: any, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
      if (token) {
        await deleteSession(token);
      }
      res.clearCookie('auth_token');
      res.json({ message: "Logout realizado com sucesso" });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Erro ao fazer logout" });
    }
  });

  // Endpoint de teste de email 2FA (Admin only)
  app.post('/api/auth/test-email', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { email } = req.body;
      const targetEmail = email || req.user.email;
      
      const testCode = generate2FACode();
      await send2FACode(targetEmail, req.user.name, testCode);
      
      logger.info(`Email de teste enviado para ${targetEmail} com código: ${testCode}`);
      
      res.json({ 
        message: `Email de teste enviado para ${targetEmail}`,
        code: testCode // Apenas para teste, não fazer isso em produção
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Erro ao enviar email de teste" });
    }
  });

  // Endpoint de teste de emails de recuperação de checkout (Admin only + rate limited)
  const testEmailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Máximo 10 emails de teste por hora
    message: 'Limite de emails de teste atingido. Tente novamente em 1 hora.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  });
  
  app.post('/api/test/checkout-recovery-emails', testEmailLimiter, authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { email, emailNumber = 1, plan = 'mensal', name = 'Teste', amount } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email é obrigatório' });
      }
      
      // Usar valor customizado se fornecido, senão usar preços padrão
      const DEFAULT_PRICES = { mensal: 9990, anual: 36090 };
      const originalAmount = amount || DEFAULT_PRICES[plan as keyof typeof DEFAULT_PRICES] || 9990;
      
      const testSubscriptionId = 'test-' + Date.now();
      
      // Gerar URL de checkout apenas com recoveryId (sem dados sensíveis)
      const params = new URLSearchParams({
        plan,
        recoveryId: testSubscriptionId,
      });
      
      let emailHtml: string;
      let subject: string;
      const planType = plan as 'mensal' | 'anual';
      
      switch (emailNumber) {
        case 1:
          const checkoutUrl1 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          emailHtml = generateCheckoutRecoveryEmail1(name, planType, checkoutUrl1);
          subject = '👋 Oi! Você esqueceu algo...';
          break;
        case 2:
          const checkoutUrl2 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          emailHtml = generateCheckoutRecoveryEmail2(name, planType, checkoutUrl2);
          subject = '☀️ Bom dia! Seu negócio digital te espera...';
          break;
        case 3:
          const checkoutUrl3 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          emailHtml = generateCheckoutRecoveryEmail3(name, planType, checkoutUrl3);
          subject = '⏰ Seu carrinho vai expirar em breve...';
          break;
        case 4:
          const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
          const discountCode = `VOLTA50-${randomPart}`;
          params.set('cupom', discountCode);
          const checkoutUrl4 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          // Usar o originalAmount já calculado no início da função
          emailHtml = generateCheckoutRecoveryEmail4WithDiscount(name, planType, originalAmount, discountCode, checkoutUrl4);
          subject = '🔥 ÚLTIMA CHANCE: 50% OFF só para você!';
          
          // Registrar cupom no banco para validação posterior
          await db.insert(checkoutRecoveryEmails).values({
            subscriptionId: testSubscriptionId,
            buyerEmail: email,
            buyerName: name,
            plan,
            originalAmount: originalAmount,
            emailSequence: 4,
            emailType: 'test_discount',
            sentAt: new Date(),
            status: 'sent',
            discountCode,
            discountPercent: 50,
          });
          break;
        default:
          return res.status(400).json({ message: 'emailNumber deve ser 1, 2, 3 ou 4' });
      }
      
      await sendEmail({
        to: email,
        subject,
        html: emailHtml,
      });
      
      logger.info(`[TEST] Email de recuperação ${emailNumber} enviado para ${email} por admin ${req.user.id}`);
      
      res.json({ 
        success: true,
        message: `Email de recuperação ${emailNumber} enviado para ${email}`,
        emailNumber,
        plan,
        name,
        checkoutUrl: getCheckoutUrl(`/assinatura/checkout?${params.toString()}`)
      });
    } catch (error) {
      console.error("Error sending test checkout recovery email:", error);
      res.status(500).json({ message: "Erro ao enviar email de teste" });
    }
  });
  
  // Endpoint para disparar WhatsApp de recuperação para subscriptions específicas (Admin only)
  app.post('/api/admin/send-recovery-whatsapp', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { subscriptionIds, messageNumber = 1 } = req.body;
      
      if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
        return res.status(400).json({ message: 'subscriptionIds é obrigatório (array)' });
      }
      
      if (!whatsappService.isConnected()) {
        return res.status(503).json({ message: 'WhatsApp não está conectado' });
      }
      
      const results = [];
      
      for (const subId of subscriptionIds) {
        try {
          const subscription = await db
            .select()
            .from(lowfySubscriptions)
            .where(eq(lowfySubscriptions.id, subId))
            .limit(1);
          
          if (!subscription[0] || !subscription[0].buyerPhone) {
            results.push({ subscriptionId: subId, status: 'error', reason: 'Sem telefone' });
            continue;
          }
          
          const sub = subscription[0];
          const firstName = sub.buyerName.split(' ')[0];
          const planName = sub.plan === 'anual' ? 'Anual' : 'Mensal';
          const formatCurrency = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          
          let message = '';
          const params = new URLSearchParams({ plan: sub.plan, recoveryId: subId });
          
          if (messageNumber === 1) {
            const checkoutUrl = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
            message = `Oi ${firstName}! 👋\n\nVi que você começou sua assinatura ${planName} da Lowfy mas não finalizou.\n\nAconteceu algo? Posso te ajudar com alguma dúvida?\n\n👉 Continue de onde parou: ${checkoutUrl}\n\nQualquer coisa, só responder aqui! 😊`;
          } else if (messageNumber === 2) {
            const checkoutUrl = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
            message = `${firstName}, ainda dá tempo! ⏰\n\nSua reserva na Lowfy ainda está disponível.\n\n✅ Acesso imediato a todos os PLRs\n✅ Ferramentas de IA exclusivas\n✅ Suporte prioritário\n\nFinaliza antes que expire: ${checkoutUrl}`;
          } else if (messageNumber === 3) {
            const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
            const discountCode = `VOLTA50-${randomPart}`;
            params.set('cupom', discountCode);
            const checkoutUrl = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
            const discountedAmount = sub.amount / 2;
            message = `🔥 *ÚLTIMA CHANCE* - 50% OFF só pra você, ${firstName}!\n\nDe ${formatCurrency(sub.amount)} por apenas *${formatCurrency(discountedAmount)}*\n\nSeu cupom exclusivo: *${discountCode}*\n\nEssa é sua última oportunidade de entrar na Lowfy com desconto especial.\n\n👉 Aproveita agora: ${checkoutUrl}\n\n⚠️ Válido apenas por 24h!`;
          }
          
          let formattedPhone = sub.buyerPhone.replace(/\D/g, '');
          if (!formattedPhone.startsWith('55')) {
            formattedPhone = '55' + formattedPhone;
          }
          
          await whatsappService.sendMessage(formattedPhone, message);
          results.push({ subscriptionId: subId, status: 'sent', phone: sub.buyerPhone });
        } catch (err: any) {
          results.push({ subscriptionId: subId, status: 'error', reason: err.message });
        }
      }
      
      logger.info(`[ADMIN] Disparados ${results.filter(r => r.status === 'sent').length}/${results.length} WhatsApps`);
      
      res.json({ success: true, results });
    } catch (error) {
      console.error("Error sending WhatsApp batch:", error);
      res.status(500).json({ message: "Erro ao enviar WhatsApp" });
    }
  });

  // Endpoint de teste de WhatsApp de recuperação de checkout (Admin only)
  app.post('/api/test/checkout-recovery-whatsapp', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { phone, messageNumber = 1, plan = 'mensal', name = 'Teste', amount } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: 'Telefone é obrigatório' });
      }
      
      if (!whatsappService.isConnected()) {
        return res.status(503).json({ message: 'WhatsApp não está conectado. Conecte primeiro no painel admin.' });
      }
      
      const DEFAULT_PRICES = { mensal: 9990, anual: 36090 };
      const originalAmount = amount || DEFAULT_PRICES[plan as keyof typeof DEFAULT_PRICES] || 9990;
      
      const testSubscriptionId = 'test-' + Date.now();
      
      const params = new URLSearchParams({
        plan,
        recoveryId: testSubscriptionId,
      });
      
      let message: string;
      const firstName = name.split(' ')[0];
      const planName = plan === 'anual' ? 'Anual' : 'Mensal';
      
      const formatCurrency = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      
      switch (messageNumber) {
        case 1:
          const checkoutUrl1 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          message = `Oi ${firstName}! 👋\n\nVi que você começou sua assinatura ${planName} da Lowfy mas não finalizou.\n\nAconteceu algo? Posso te ajudar com alguma dúvida?\n\n👉 Continue de onde parou: ${checkoutUrl1}\n\nQualquer coisa, só responder aqui! 😊`;
          break;
        case 2:
          const checkoutUrl2 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          message = `${firstName}, ainda dá tempo! ⏰\n\nSua reserva na Lowfy ainda está disponível.\n\n✅ Acesso imediato a todos os PLRs\n✅ Ferramentas de IA exclusivas\n✅ Suporte prioritário\n\nFinaliza antes que expire: ${checkoutUrl2}`;
          break;
        case 3:
          const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
          const discountCode = `VOLTA50-${randomPart}`;
          params.set('cupom', discountCode);
          const checkoutUrl3 = getCheckoutUrl(`/assinatura/checkout?${params.toString()}`);
          const discountedAmount = originalAmount / 2;
          message = `🔥 *ÚLTIMA CHANCE* - 50% OFF só pra você, ${firstName}!\n\nDe ${formatCurrency(originalAmount)} por apenas *${formatCurrency(discountedAmount)}*\n\nSeu cupom exclusivo: *${discountCode}*\n\nEssa é sua última oportunidade de entrar na Lowfy com desconto especial.\n\n👉 Aproveita agora: ${checkoutUrl3}\n\n⚠️ Válido apenas por 24h!`;
          break;
        default:
          return res.status(400).json({ message: 'messageNumber deve ser 1, 2 ou 3' });
      }
      
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }
      
      await whatsappService.sendMessage(formattedPhone, message);
      
      logger.info(`[TEST] WhatsApp de recuperação ${messageNumber} enviado para ${phone} por admin ${req.user.id}`);
      
      res.json({ 
        success: true,
        message: `WhatsApp de recuperação ${messageNumber} enviado para ${phone}`,
        messageNumber,
        plan,
        name,
        checkoutUrl: getCheckoutUrl(`/assinatura/checkout?${params.toString()}`)
      });
    } catch (error) {
      console.error("Error sending test WhatsApp:", error);
      res.status(500).json({ message: "Erro ao enviar WhatsApp de teste" });
    }
  });
  
  // GET /api/subscriptions/recovery/:recoveryId - Buscar dados de checkout abandonado para recuperação
  app.get('/api/subscriptions/recovery/:recoveryId', async (req, res) => {
    try {
      const { recoveryId } = req.params;
      
      if (!recoveryId || recoveryId.startsWith('test-')) {
        return res.status(404).json({ message: 'Checkout não encontrado' });
      }
      
      // Buscar a assinatura abandonada pelo ID
      const subscription = await db
        .select({
          id: lowfySubscriptions.id,
          plan: lowfySubscriptions.plan,
          buyerName: lowfySubscriptions.buyerName,
          buyerEmail: lowfySubscriptions.buyerEmail,
          buyerCpf: lowfySubscriptions.buyerCpf,
          buyerPhone: lowfySubscriptions.buyerPhone,
          status: lowfySubscriptions.status,
          createdAt: lowfySubscriptions.createdAt,
        })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.id, recoveryId),
            eq(lowfySubscriptions.status, 'awaiting_payment'),
            isNull(lowfySubscriptions.userId)
          )
        )
        .limit(1);
      
      if (subscription.length === 0) {
        return res.status(404).json({ message: 'Checkout não encontrado ou já foi processado' });
      }
      
      const data = subscription[0];
      
      // Mascarar dados sensíveis para segurança
      const maskedCpf = data.buyerCpf 
        ? `${data.buyerCpf.substring(0, 3)}.***.**${data.buyerCpf.substring(9)}`
        : null;
      
      res.json({
        id: data.id,
        plan: data.plan,
        buyerName: data.buyerName,
        buyerEmail: data.buyerEmail,
        buyerCpf: data.buyerCpf, // Retornar CPF completo para preenchimento
        buyerPhone: data.buyerPhone,
        maskedCpf,
      });
    } catch (error) {
      logger.error('[Recovery Checkout] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar dados do checkout' });
    }
  });

  // Get current user
  app.get('/api/auth/user', authMiddleware, async (req: any, res) => {
    try {
      const { passwordHash: _, ...userWithoutPassword } = req.user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  // Get current user (alias for /api/auth/user) - Always fetch fresh from DB to get latest subscription status
  app.get('/api/auth/me', authMiddleware, async (req: any, res) => {
    try {
      // Always fetch fresh user data from DB to ensure latest subscription status is reflected
      const freshUser = await storage.getUser(req.user.id);
      if (!freshUser) {
        return res.status(401).json({ message: "User not found" });
      }
      const { passwordHash: _, ...userWithoutPassword } = freshUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  // Get current user subscription (includes canceled/expired for history viewing)
  app.get('/api/user/subscription', authMiddleware, async (req: any, res) => {
    try {
      // Buscar qualquer assinatura do usuário (ativa, cancelada, expirada, etc.)
      // para que o usuário possa ver o histórico e detalhes mesmo após cancelamento
      const subscription = await storage.getLowfySubscriptionByUserId(req.user.id);
      res.json(subscription || null);
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      res.status(500).json({ message: "Erro ao buscar assinatura" });
    }
  });

  // Get user subscription payment history from Asaas
  app.get('/api/user/subscription/payments', authMiddleware, async (req: any, res) => {
    try {
      const subscription = await storage.getActiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      // Se NÃO tiver providerSubscriptionId, usar fallback para storage local
      if (!subscription.providerSubscriptionId) {
        logger.info('[Subscription Payments] No providerSubscriptionId found, using local storage fallback:', {
          subscriptionId: subscription.id,
          userId: req.user.id,
        });
        const localPayments = await storage.getSubscriptionPaymentsByUserId(req.user.id);
        return res.json(localPayments);
      }

      // Se tiver providerSubscriptionId, buscar pagamentos do Asaas
      // NÃO engolir erros - retornar erro apropriado se a chamada ao Asaas falhar
      try {
        const asaasPayments = await listSubscriptionPayments(subscription.providerSubscriptionId);
        
        logger.debug('[Subscription Payments] Retrieved from Asaas:', {
          subscriptionId: subscription.id,
          providerSubscriptionId: subscription.providerSubscriptionId,
          totalCount: asaasPayments.totalCount,
        });

        // Transformar dados do Asaas para o formato esperado pelo frontend
        const transformedPayments = asaasPayments.data.map((payment: any, index: number) => {
          // Mapear status do Asaas para status esperado
          const statusMap: Record<string, string> = {
            'CONFIRMED': 'paid',
            'RECEIVED': 'paid',
            'PENDING': 'pending',
            'OVERDUE': 'pending',
            'REFUNDED': 'refunded',
            'REFUND_REQUESTED': 'refunded',
            'CHARGEBACK_REQUESTED': 'failed',
            'CHARGEBACK_DISPUTE': 'failed',
            'AWAITING_CHARGEBACK_REVERSAL': 'failed',
            'DUNNING_REQUESTED': 'pending',
            'DUNNING_RECEIVED': 'paid',
            'AWAITING_RISK_ANALYSIS': 'pending',
          };
          
          // Mapear método de pagamento
          const paymentMethodMap: Record<string, string> = {
            'CREDIT_CARD': 'credit_card',
            'BOLETO': 'boleto',
            'PIX': 'pix',
            'DEBIT_CARD': 'debit_card',
            'TRANSFER': 'transfer',
            'DEPOSIT': 'deposit',
          };

          // Extrair últimos 4 dígitos do cartão (Asaas retorna com máscara)
          let cardLast4 = null;
          let cardBrand = null;
          if (payment.creditCard) {
            cardBrand = payment.creditCard.creditCardBrand || null;
            const creditCardNumber = payment.creditCard.creditCardNumber || '';
            cardLast4 = creditCardNumber.slice(-4) || null;
          }

          return {
            id: payment.id,
            subscriptionId: subscription.id,
            userId: subscription.userId,
            provider: 'asaas',
            providerPaymentId: payment.id,
            status: statusMap[payment.status] || payment.status?.toLowerCase() || 'pending',
            amount: Math.round((payment.value || 0) * 100), // Converter de reais para centavos
            paymentMethod: paymentMethodMap[payment.billingType] || payment.billingType?.toLowerCase() || 'credit_card',
            billingPeriod: index + 1, // Será recalculado após ordenação
            cardBrand: cardBrand,
            cardLast4: cardLast4,
            pixQrCode: null,
            paidAt: payment.confirmedDate || payment.paymentDate || null,
            dueDate: payment.dueDate || null,
            refundedAt: null,
            createdAt: payment.dateCreated || new Date().toISOString(),
          };
        });

        // Ordenar por data decrescente (mais recente primeiro)
        transformedPayments.sort((a: any, b: any) => {
          const dateA = new Date(a.paidAt || a.createdAt).getTime();
          const dateB = new Date(b.paidAt || b.createdAt).getTime();
          return dateB - dateA;
        });

        // Recalcular billingPeriod após ordenação (mais recente = maior número)
        const totalPayments = transformedPayments.length;
        transformedPayments.forEach((payment: any, index: number) => {
          payment.billingPeriod = totalPayments - index;
        });

        return res.json(transformedPayments);
      } catch (asaasError: any) {
        logger.error('[Subscription Payments] Error fetching from Asaas:', {
          subscriptionId: subscription.id,
          providerSubscriptionId: subscription.providerSubscriptionId,
          error: asaasError.message || asaasError,
        });
        
        // Retornar erro apropriado ao invés de engolir silenciosamente
        return res.status(502).json({ 
          message: "Erro ao buscar histórico de pagamentos do provedor",
          details: asaasError.message || "Falha na comunicação com o gateway de pagamento"
        });
      }
    } catch (error) {
      console.error("Error fetching subscription payments:", error);
      res.status(500).json({ message: "Erro ao buscar histórico de pagamentos" });
    }
  });

  // Cancel subscription (allows usage until end of billing cycle)
  app.post('/api/user/subscription/cancel', authMiddleware, async (req: any, res) => {
    try {
      // Validate input
      const cancelSchema = z.object({
        reason: z.string().max(500).optional(),
      });
      
      const validationResult = cancelSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }
      
      const { reason } = validationResult.data;
      const subscription = await storage.getActiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      // Calculate access until (end of current billing cycle)
      // Priority: nextPaymentDate > calculate from paidAt + single billing period
      let accessValidUntil: Date;
      
      if (subscription.nextPaymentDate) {
        // Use the next payment date as the access end date
        accessValidUntil = new Date(subscription.nextPaymentDate);
      } else if (subscription.paidAt) {
        // Calculate from paidAt: add just ONE billing cycle (not all periods)
        // This gives access until the end of the current paid period
        accessValidUntil = new Date(subscription.paidAt);
        if (subscription.plan === 'anual') {
          // Annual: add 1 year from last payment
          accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
        } else {
          // Monthly: add 1 month from last payment (single billing cycle)
          accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
        }
      } else {
        // Fallback: if no payment date info, give access until end of current billing cycle
        accessValidUntil = new Date();
        if (subscription.plan === 'anual') {
          accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
        } else {
          accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
        }
      }

      // Update subscription with cancel info
      await storage.updateLowfySubscription(subscription.id, {
        status: 'canceled',
        canceledAt: new Date(),
        cancelReason: reason || 'Cancelado pelo usuário',
        accessValidUntil: accessValidUntil,
      });

      // Check if cancellation is within first 8 days - reverse affiliate commissions
      const paidAt = subscription.paidAt || subscription.createdAt;
      if (paidAt) {
        const daysSincePaid = Math.floor((Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSincePaid < 8) {
          try {
            logger.debug('[Cancel Subscription] Cancellation within 8 days - reversing affiliate commissions', {
              subscriptionId: subscription.id,
              daysSincePaid,
            });
            await storage.cancelReferralCommissionsForUser(req.user.id, subscription.id);
            logger.debug('[Cancel Subscription] Affiliate commissions reversed successfully');
          } catch (commissionError) {
            logger.error('[Cancel Subscription] Error reversing affiliate commissions:', commissionError);
            // Continue anyway - subscription cancellation is more important
          }
        } else {
          logger.debug('[Cancel Subscription] Cancellation after 8 days - affiliate commissions preserved', {
            subscriptionId: subscription.id,
            daysSincePaid,
          });
        }
      }

      // Cancel on Asaas if it's a credit card subscription
      if (subscription.provider === 'asaas' && subscription.providerSubscriptionId) {
        try {
          const asaasService = getAsaasServiceSafe();
          if (asaasService) {
            // Note: Asaas doesn't have a direct cancel endpoint for single payments
            // Subscriptions created as recurring would need to be canceled
            logger.debug('[Cancel Subscription] Would cancel Asaas subscription:', subscription.providerSubscriptionId);
          }
        } catch (asaasError) {
          logger.error('[Cancel Subscription] Error canceling on Asaas:', asaasError);
          // Continue anyway - local cancellation is what matters
        }
      }

      logger.debug('[Cancel Subscription] Subscription canceled:', {
        subscriptionId: subscription.id,
        userId: req.user.id,
        accessValidUntil,
        reason,
      });

      // Send cancellation confirmation email
      try {
        const { generateSubscriptionCanceledEmail } = await import('./email');
        const emailHtml = generateSubscriptionCanceledEmail(
          subscription.buyerName,
          accessValidUntil.toISOString(),
          reason
        );
        await sendEmail({
          to: subscription.buyerEmail,
          subject: 'Assinatura Cancelada - Lowfy',
          html: emailHtml,
        });
      } catch (emailError) {
        logger.error('[Cancel Subscription] Error sending cancellation email:', emailError);
      }

      res.json({ 
        success: true, 
        accessValidUntil,
        message: `Sua assinatura foi cancelada. Você ainda terá acesso até ${accessValidUntil.toLocaleDateString('pt-BR')}.`
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Erro ao cancelar assinatura" });
    }
  });

  // DELETE /api/user/subscription/cancel - Cancelar assinatura do usuário (com integração Asaas)
  app.delete('/api/user/subscription/cancel', authMiddleware, async (req: any, res) => {
    try {
      const subscription = await storage.getActiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      // Verificar se existe providerSubscriptionId ANTES de chamar deleteSubscription do Asaas
      if (subscription.providerSubscriptionId) {
        try {
          const deleteResult = await deleteSubscription(subscription.providerSubscriptionId);
          logger.debug('[Delete Subscription] Asaas subscription deleted:', {
            subscriptionId: subscription.id,
            providerSubscriptionId: subscription.providerSubscriptionId,
            asaasDeleted: deleteResult.deleted,
          });
        } catch (asaasError: any) {
          logger.error('[Delete Subscription] Error deleting on Asaas:', asaasError);
          // Continuar com o cancelamento local mesmo se houver erro no Asaas
        }
      } else {
        // Não há providerSubscriptionId - apenas cancelamento local será feito
        logger.info('[Delete Subscription] No providerSubscriptionId found, skipping Asaas deletion. Only local status will be updated.', {
          subscriptionId: subscription.id,
          userId: req.user.id,
          provider: subscription.provider,
        });
      }

      // Atualizar status da assinatura para 'canceled' no banco de dados
      await storage.updateLowfySubscription(subscription.id, {
        status: 'canceled',
        canceledAt: new Date(),
        cancelReason: 'Cancelado pelo usuário via DELETE',
      });

      // Check if cancellation is within first 8 days - reverse affiliate commissions
      const paidAt = subscription.paidAt || subscription.createdAt;
      if (paidAt) {
        const daysSincePaid = Math.floor((Date.now() - new Date(paidAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSincePaid < 8) {
          try {
            logger.debug('[Delete Subscription] Cancellation within 8 days - reversing affiliate commissions', {
              subscriptionId: subscription.id,
              daysSincePaid,
            });
            await storage.cancelReferralCommissionsForUser(req.user.id, subscription.id);
            logger.debug('[Delete Subscription] Affiliate commissions reversed successfully');
          } catch (commissionError) {
            logger.error('[Delete Subscription] Error reversing affiliate commissions:', commissionError);
          }
        }
      }

      // Atualizar subscriptionStatus do usuário para 'canceled'
      await storage.updateUser(req.user.id, {
        subscriptionStatus: 'canceled',
      });

      logger.debug('[Delete Subscription] Subscription and user status updated:', {
        subscriptionId: subscription.id,
        userId: req.user.id,
      });

      res.json({ 
        success: true, 
        message: 'Assinatura cancelada com sucesso.'
      });
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Erro ao cancelar assinatura" });
    }
  });

  // POST /api/user/subscription/reactivate - Reativar assinatura cancelada
  // Para cartão de crédito: reativa direto no Asaas sem ir para checkout
  // Para PIX ou reembolsada: retorna erro informando que precisa ir para checkout
  app.post('/api/user/subscription/reactivate', authMiddleware, async (req: any, res) => {
    try {
      // Buscar assinatura inativa mais recente do usuário (canceled, refunded, expired)
      const subscription = await storage.getInactiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ 
          message: "Nenhuma assinatura encontrada. Por favor, faça uma nova assinatura.",
          requiresCheckout: true,
          checkoutUrl: '/assinatura/checkout'
        });
      }

      // REEMBOLSADA: Sempre vai para checkout (perdeu o direito à assinatura)
      if (subscription.status === 'refunded') {
        return res.status(400).json({ 
          message: "Sua assinatura foi reembolsada. Por favor, faça uma nova assinatura no checkout.",
          requiresCheckout: true,
          checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
        });
      }

      // PIX: Não permite reativação direta - precisa ir para checkout
      if (subscription.paymentMethod === 'pix') {
        return res.status(400).json({ 
          message: "Assinaturas PIX não podem ser reativadas diretamente. Por favor, faça uma nova assinatura no checkout.",
          requiresCheckout: true,
          checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
        });
      }

      // Verificar se tem ID da assinatura no Asaas
      if (!subscription.providerSubscriptionId) {
        return res.status(400).json({ 
          message: "Não foi possível reativar a assinatura. Por favor, faça uma nova assinatura no checkout.",
          requiresCheckout: true,
          checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
        });
      }

      // Tentar reativar no Asaas
      const { updateSubscription, getSubscription } = await import('./services/asaas');
      
      try {
        // Primeiro verificar status atual no Asaas
        let asaasSubscription;
        try {
          asaasSubscription = await getSubscription(subscription.providerSubscriptionId);
          logger.debug('[Reactivate Subscription] Current Asaas subscription:', {
            id: asaasSubscription.id,
            status: asaasSubscription.status,
            deleted: asaasSubscription.deleted,
          });

          // Se a assinatura foi deletada no Asaas, precisa criar nova
          if (asaasSubscription.deleted) {
            return res.status(400).json({ 
              message: "Sua assinatura foi encerrada. Por favor, faça uma nova assinatura no checkout.",
              requiresCheckout: true,
              checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
            });
          }
        } catch (getError: any) {
          logger.error('[Reactivate Subscription] Error getting Asaas subscription:', getError.message);
          return res.status(400).json({ 
            message: "Não foi possível verificar sua assinatura. Por favor, faça uma nova assinatura no checkout.",
            requiresCheckout: true,
            checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
          });
        }

        // Se já está ACTIVE no Asaas, apenas atualizar o banco local
        if (asaasSubscription.status === 'ACTIVE') {
          logger.debug('[Reactivate Subscription] Subscription already active in Asaas, updating local state');
          
          const accessValidUntil = new Date();
          if (subscription.plan === 'anual') {
            accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
          } else {
            accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
          }

          await storage.updateLowfySubscription(subscription.id, {
            status: 'active',
            canceledAt: null,
            cancelReason: null,
            accessValidUntil: accessValidUntil,
            nextPaymentDate: asaasSubscription.nextDueDate ? new Date(asaasSubscription.nextDueDate) : accessValidUntil,
          });

          await storage.updateUser(req.user.id, {
            subscriptionStatus: 'active',
            subscriptionExpiresAt: accessValidUntil,
          });

          return res.json({ 
            success: true, 
            message: 'Assinatura reativada com sucesso!',
            accessValidUntil,
          });
        }

        // Calcular próxima data de pagamento (hoje para cobrança imediata)
        const today = new Date();
        const nextDueDate = today.toISOString().split('T')[0];

        logger.debug('[Reactivate Subscription] Attempting to reactivate in Asaas:', {
          subscriptionId: subscription.id,
          providerSubscriptionId: subscription.providerSubscriptionId,
          currentStatus: asaasSubscription.status,
          nextDueDate,
        });

        // Reativar assinatura no Asaas
        await updateSubscription(subscription.providerSubscriptionId, {
          status: 'ACTIVE',
          nextDueDate: nextDueDate,
          updatePendingPayments: true,
        });

        // Verificar o status real da assinatura após a atualização
        const updatedAsaasSubscription = await getSubscription(subscription.providerSubscriptionId);
        
        logger.debug('[Reactivate Subscription] Asaas subscription status after update:', {
          id: updatedAsaasSubscription.id,
          status: updatedAsaasSubscription.status,
          nextDueDate: updatedAsaasSubscription.nextDueDate,
        });

        // Verificar se a reativação foi bem-sucedida
        if (updatedAsaasSubscription.status !== 'ACTIVE') {
          logger.error('[Reactivate Subscription] Asaas subscription not active after update:', {
            expectedStatus: 'ACTIVE',
            actualStatus: updatedAsaasSubscription.status,
          });
          return res.status(400).json({ 
            message: "Não foi possível reativar a assinatura. Por favor, faça uma nova assinatura no checkout.",
            requiresCheckout: true,
            checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`
          });
        }
        
        const asaasNextDueDate = updatedAsaasSubscription.nextDueDate;

        // Calcular nova data de acesso válido
        const accessValidUntil = new Date();
        if (subscription.plan === 'anual') {
          accessValidUntil.setFullYear(accessValidUntil.getFullYear() + 1);
        } else {
          accessValidUntil.setMonth(accessValidUntil.getMonth() + 1);
        }

        // Atualizar assinatura no banco
        await storage.updateLowfySubscription(subscription.id, {
          status: 'active',
          canceledAt: null,
          cancelReason: null,
          accessValidUntil: accessValidUntil,
          nextPaymentDate: asaasNextDueDate ? new Date(asaasNextDueDate) : accessValidUntil,
        });

        // Atualizar status do usuário
        await storage.updateUser(req.user.id, {
          subscriptionStatus: 'active',
          subscriptionExpiresAt: accessValidUntil,
        });

        logger.debug('[Reactivate Subscription] Subscription reactivated successfully:', {
          subscriptionId: subscription.id,
          userId: req.user.id,
          newStatus: 'active',
          accessValidUntil,
        });

        res.json({ 
          success: true, 
          message: 'Assinatura reativada com sucesso! Seu cartão será cobrado automaticamente.',
          accessValidUntil,
        });

      } catch (asaasError: any) {
        logger.error('[Reactivate Subscription] Asaas error:', {
          error: asaasError.message,
          subscriptionId: subscription.id,
        });

        // Se falhou no Asaas, redirecionar para checkout
        return res.status(400).json({ 
          message: "Não foi possível reativar a assinatura. Por favor, faça uma nova assinatura no checkout.",
          requiresCheckout: true,
          checkoutUrl: `/assinatura/checkout?plan=${subscription.plan}`,
          error: asaasError.message,
        });
      }

    } catch (error) {
      logger.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Erro ao reativar assinatura" });
    }
  });

  // GET /api/user/subscription/refund/eligibility - Verificar elegibilidade para reembolso
  app.get('/api/user/subscription/refund/eligibility', authMiddleware, async (req: any, res) => {
    try {
      // Get most recent canceled subscription for this user
      const subscription = await storage.getCanceledLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.json({ 
          eligible: false, 
          reason: 'Nenhuma assinatura cancelada encontrada' 
        });
      }

      const eligibility = await storage.isSubscriptionEligibleForRefund(subscription.id);
      
      res.json({
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        daysFromFirstPayment: eligibility.daysFromFirstPayment,
        subscriptionId: subscription.id,
        amountCents: subscription.amount || 0,
        paymentMethod: subscription.paymentMethod,
      });
    } catch (error) {
      logger.error("Error checking refund eligibility:", error);
      res.status(500).json({ message: "Erro ao verificar elegibilidade para reembolso" });
    }
  });

  // POST /api/user/subscription/refund - Solicitar reembolso de assinatura
  app.post('/api/user/subscription/refund', authMiddleware, async (req: any, res) => {
    try {
      const refundSchema = z.object({
        subscriptionId: z.string(),
        reason: z.string().max(1000).optional(),
      });

      const validationResult = refundSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }

      const { subscriptionId, reason } = validationResult.data;

      // Verify subscription belongs to user
      const subscription = await storage.getLowfySubscriptionById(subscriptionId);
      if (!subscription || subscription.userId !== req.user.id) {
        return res.status(404).json({ message: "Assinatura não encontrada" });
      }

      // Check eligibility
      const eligibility = await storage.isSubscriptionEligibleForRefund(subscriptionId);
      if (!eligibility.eligible) {
        return res.status(400).json({ 
          message: eligibility.reason || "Assinatura não elegível para reembolso" 
        });
      }

      // Validate and get refund amount - subscription.amount is already in cents
      const refundAmountCents = subscription.amount || 0;
      
      // Log subscription data for debugging
      logger.debug('[Refund Request] Subscription data:', {
        subscriptionId: subscription.id,
        amount: subscription.amount,
        refundAmountCents,
        plan: subscription.plan,
        provider: subscription.provider,
        paymentMethod: subscription.paymentMethod,
        status: subscription.status,
      });

      // Validate that amount is valid (must be greater than 0)
      if (refundAmountCents <= 0) {
        logger.error('[Refund Request] Invalid refund amount detected:', {
          subscriptionId,
          subscriptionAmount: subscription.amount,
          refundAmountCents,
        });
        return res.status(400).json({ 
          message: "Erro: O valor do reembolso não pôde ser determinado. Por favor, contate o suporte." 
        });
      }

      const refundRequest = await storage.createSubscriptionRefundRequest({
        subscriptionId,
        userId: req.user.id,
        amountCents: refundAmountCents,
        paymentMethod: subscription.paymentMethod || 'unknown',
        providerPaymentId: subscription.providerTransactionId || subscription.providerSubscriptionId || null,
        reason: reason || 'Solicitado pelo usuário',
        status: 'pending',
      });

      // Update subscription status to refunded immediately (loses access right away)
      await storage.updateLowfySubscription(subscriptionId, {
        status: 'refunded',
      });

      // Update user subscription status to refunded
      await db
        .update(users)
        .set({
          subscriptionStatus: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id));

      // Reverse affiliate commissions for early refund
      try {
        await storage.cancelReferralCommissionsForUser(req.user.id, subscriptionId);
        logger.debug('[Refund Request] Affiliate commissions reversed for early refund');
      } catch (commissionError) {
        logger.error('[Refund Request] Error reversing affiliate commissions:', commissionError);
      }

      // Use refundAmountCents as the single source of truth for all amounts
      const refundAmountBRL = refundAmountCents / 100;

      // Send notification email to user
      try {
        const { generateRefundRequestEmail } = await import('./email');
        const emailHtml = generateRefundRequestEmail(
          subscription.buyerName,
          refundAmountBRL,
          subscription.paymentMethod || 'desconhecido'
        );
        await sendEmail({
          to: subscription.buyerEmail,
          subject: 'Solicitação de Reembolso Recebida - Lowfy',
          html: emailHtml,
        });
      } catch (emailError) {
        logger.error('[Refund Request] Error sending refund request email:', emailError);
      }

      // Send notification to admin for ALL refund requests
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'jl.uli1996@gmail.com';
        const { generateAdminRefundNotificationEmail } = await import('./email');
        const paymentMethodLabel = subscription.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 
                                    subscription.paymentMethod === 'pix' ? 'PIX' : 
                                    subscription.paymentMethod || 'Desconhecido';
        const adminEmailHtml = generateAdminRefundNotificationEmail(
          subscription.buyerName,
          subscription.buyerEmail,
          refundAmountBRL,
          paymentMethodLabel,
          reason || 'Não informado'
        );
        const isManualProcessing = subscription.paymentMethod === 'pix';
        await sendEmail({
          to: adminEmail,
          subject: isManualProcessing 
            ? '[AÇÃO REQUERIDA] Nova Solicitação de Reembolso PIX - Lowfy'
            : '[NOTIFICAÇÃO] Nova Solicitação de Reembolso - Lowfy',
          html: adminEmailHtml,
        });
        logger.debug('[Refund Request] Admin notification email sent to:', adminEmail);
      } catch (emailError) {
        logger.error('[Refund Request] Error sending admin notification:', emailError);
      }

      // For credit card payments, attempt automatic refund via Asaas
      const providerPaymentId = subscription.providerTransactionId || subscription.providerSubscriptionId;
      if (subscription.paymentMethod === 'credit_card' && providerPaymentId) {
        try {
          await storage.updateSubscriptionRefundRequest(refundRequest.id, {
            status: 'processing',
          });

          // Process refund via Asaas
          const { refundPayment } = await import('./services/asaas');
          const refundResult = await refundPayment(
            providerPaymentId,
            refundAmountCents
          );

          if (refundResult.success) {
            await storage.updateSubscriptionRefundRequest(refundRequest.id, {
              status: 'completed',
              refundedViaProvider: true,
              processedAt: new Date(),
            });

            logger.debug('[Refund Request] Credit card refund processed successfully via Asaas');
          } else {
            logger.warn('[Refund Request] Asaas refund returned unsuccessful:', refundResult);
            // Keep as processing - admin will need to check
          }
        } catch (refundError) {
          logger.error('[Refund Request] Error processing automatic refund:', refundError);
          // Keep as processing - admin will need to manually process
        }
      }

      logger.debug('[Refund Request] Refund request created:', {
        refundRequestId: refundRequest.id,
        subscriptionId,
        userId: req.user.id,
        amountCents: refundAmountCents,
        paymentMethod: subscription.paymentMethod,
      });

      res.json({ 
        success: true, 
        refundRequestId: refundRequest.id,
        status: refundRequest.status,
        message: subscription.paymentMethod === 'credit_card' 
          ? 'Solicitação de reembolso recebida. O valor será estornado no seu cartão em até 2 faturas (60 dias).'
          : 'Solicitação de reembolso recebida. Nossa equipe entrará em contato para processar o estorno via PIX.'
      });
    } catch (error) {
      logger.error("Error creating refund request:", error);
      res.status(500).json({ message: "Erro ao solicitar reembolso" });
    }
  });

  // PUT /api/user/subscription/update-card - Atualizar cartão de crédito da assinatura
  // IMPORTANTE: Os dados do titular são obtidos da assinatura existente, não do formulário
  app.put('/api/user/subscription/update-card', authMiddleware, async (req: any, res) => {
    try {
      // Validar apenas dados do cartão (dados do titular vêm da assinatura)
      const cardSchema = z.object({
        number: z.string()
          .min(13, "Número do cartão deve ter no mínimo 13 dígitos")
          .max(19, "Número do cartão deve ter no máximo 19 dígitos")
          .regex(/^\d+$/, "Número do cartão deve conter apenas dígitos"),
        holderName: z.string()
          .min(3, "Nome do titular deve ter no mínimo 3 caracteres")
          .max(100, "Nome do titular deve ter no máximo 100 caracteres"),
        expiryMonth: z.string()
          .length(2, "Mês de validade deve ter 2 dígitos")
          .regex(/^(0[1-9]|1[0-2])$/, "Mês de validade inválido (01-12)"),
        expiryYear: z.string()
          .min(2, "Ano de validade deve ter no mínimo 2 dígitos")
          .max(4, "Ano de validade deve ter no máximo 4 dígitos")
          .regex(/^\d{2,4}$/, "Ano de validade deve conter apenas dígitos"),
        cvv: z.string()
          .min(3, "CVV deve ter no mínimo 3 dígitos")
          .max(4, "CVV deve ter no máximo 4 dígitos")
          .regex(/^\d{3,4}$/, "CVV deve conter apenas 3 ou 4 dígitos"),
      });

      const updateCardSchema = z.object({
        card: cardSchema,
      });

      const validationResult = updateCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }

      const { card } = validationResult.data;
      const sanitizedCardNumber = card.number.replace(/\D/g, '');

      const subscription = await storage.getActiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      if (!subscription.providerSubscriptionId) {
        return res.status(400).json({ message: "Esta assinatura não possui um ID de assinatura do provedor para atualização" });
      }

      // Usar dados do titular da assinatura existente (não permite alteração)
      const holderName = subscription.buyerName;
      const holderEmail = subscription.buyerEmail;
      const holderCpfCnpj = subscription.buyerCpf.replace(/\D/g, '');
      const holderPhone = subscription.buyerPhone ? subscription.buyerPhone.replace(/\D/g, '') : undefined;
      const holderPostalCode = subscription.buyerPostalCode || '80060000'; // Fallback para CEP padrão
      const holderAddressNumber = subscription.buyerAddressNumber || '100'; // Fallback para número padrão

      // Obter remoteIp do header x-forwarded-for ou req.ip
      const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';

      // Chamar updateSubscriptionCard do Asaas com dados do titular da assinatura
      const updateResult = await updateSubscriptionCard({
        subscriptionId: subscription.providerSubscriptionId,
        creditCard: {
          holderName: card.holderName,
          number: sanitizedCardNumber,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.cvv,
        },
        creditCardHolderInfo: {
          name: holderName,
          email: holderEmail,
          cpfCnpj: holderCpfCnpj,
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
          phone: holderPhone,
          mobilePhone: holderPhone,
        },
        remoteIp,
      });

      // Atualizar cardBrand e cardLastDigits no banco de dados
      // Helpers locais para detecção de bandeira e últimos dígitos
      const detectBrand = (cardNum: string): string => {
        const cleaned = cardNum.replace(/\s/g, '');
        if (/^4/.test(cleaned)) return 'visa';
        if (/^5[1-5]/.test(cleaned)) return 'mastercard';
        if (/^3[47]/.test(cleaned)) return 'amex';
        return '';
      };
      const getLastDigits = (cardNum: string): string => {
        const cleaned = cardNum.replace(/\s/g, '');
        return cleaned.slice(-4);
      };

      const cardBrand = detectBrand(card.number);
      const cardLastDigits = getLastDigits(card.number);

      await storage.updateLowfySubscription(subscription.id, {
        cardBrand,
        cardLastDigits,
      });

      logger.debug('[Update Card] Subscription card updated:', {
        subscriptionId: subscription.id,
        providerSubscriptionId: subscription.providerSubscriptionId,
        cardBrand,
        cardLastDigits,
        asaasStatus: updateResult.status,
      });

      res.json({ 
        success: true, 
        cardBrand,
        cardLastDigits,
        message: 'Cartão atualizado com sucesso.'
      });
    } catch (error: any) {
      console.error("Error updating subscription card:", error);
      res.status(500).json({ 
        message: error.message || "Erro ao atualizar cartão" 
      });
    }
  });

  // Change subscription payment method
  // NOTE: This currently only updates the local record. Full provider integration 
  // (canceling Asaas subscription and creating new payment method) should be 
  // implemented when recurring subscription billing is fully set up.
  app.post('/api/user/subscription/change-payment-method', authMiddleware, async (req: any, res) => {
    try {
      // Validate input with Zod
      const cardSchema = z.object({
        number: z.string().min(13).max(19),
        holderName: z.string().min(2).max(100),
        expiryMonth: z.string().min(1).max(2),
        expiryYear: z.string().min(2).max(4),
        cvv: z.string().min(3).max(4),
      });

      const changePaymentSchema = z.object({
        newPaymentMethod: z.enum(['credit_card', 'pix']),
        card: cardSchema.optional(),
      });

      const validationResult = changePaymentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }

      const { newPaymentMethod, card } = validationResult.data;
      const subscription = await storage.getActiveLowfySubscriptionByUserId(req.user.id);
      
      if (!subscription) {
        return res.status(404).json({ message: "Nenhuma assinatura ativa encontrada" });
      }

      if (subscription.paymentMethod === newPaymentMethod) {
        return res.status(400).json({ message: "Este já é seu método de pagamento atual" });
      }

      // For credit card: validate card data is present
      if (newPaymentMethod === 'credit_card') {
        if (!card) {
          return res.status(400).json({ message: "Dados do cartão são obrigatórios" });
        }

        // Update subscription to use credit card
        await storage.updateLowfySubscription(subscription.id, {
          paymentMethod: 'credit_card',
          provider: 'asaas',
          qrCodeData: null,
          qrCodeImage: null,
          pixExpiresAt: null,
        });

        logger.debug('[Change Payment Method] Updated to credit card:', {
          subscriptionId: subscription.id,
          userId: req.user.id,
        });

        res.json({ 
          success: true, 
          paymentMethod: 'credit_card',
          message: 'Método de pagamento alterado para Cartão de Crédito. O próximo pagamento será cobrado no cartão.'
        });

      } else if (newPaymentMethod === 'pix') {
        // Update subscription to use PIX
        await storage.updateLowfySubscription(subscription.id, {
          paymentMethod: 'pix',
          provider: 'podpay',
        });

        logger.debug('[Change Payment Method] Updated to PIX:', {
          subscriptionId: subscription.id,
          userId: req.user.id,
        });

        res.json({ 
          success: true, 
          paymentMethod: 'pix',
          message: 'Método de pagamento alterado para PIX. Você receberá o QR Code próximo à data de vencimento.'
        });
      }
    } catch (error) {
      console.error("Error changing payment method:", error);
      res.status(500).json({ message: "Erro ao alterar método de pagamento" });
    }
  });

  // Update current user profile
  app.put('/api/auth/user', authMiddleware, async (req: any, res) => {
    try {
      const updates: any = {};

      // Apenas atualizar campos que foram enviados
      if (req.body.name !== undefined) updates.name = req.body.name;
      
      // BLOQUEADO: Não permitir alteração de telefone
      // Telefone só pode ser definido no cadastro e não pode ser alterado
      
      // BLOQUEADO: Não permitir alteração de CPF
      // CPF só pode ser definido no cadastro e não pode ser alterado
      
      if (req.body.profileImageUrl !== undefined) updates.profileImageUrl = req.body.profileImageUrl;
      if (req.body.areaAtuacao !== undefined) updates.areaAtuacao = req.body.areaAtuacao;
      if (req.body.bio !== undefined) updates.bio = req.body.bio;
      if (req.body.website !== undefined) updates.website = req.body.website;
      if (req.body.location !== undefined) updates.location = req.body.location;

      logger.debug('[UpdateProfile] Atualizando perfil do usuário:', req.user.id);
      logger.debug('[UpdateProfile] Dados recebidos:', updates);

      const updatedUser = await storage.updateUser(req.user.id, updates);
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;

      logger.debug('[UpdateProfile] Perfil atualizado com sucesso');
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // ============================================================================
  // NOTIFICATION ROUTES
  // ============================================================================

  // Get user notifications
  app.get('/api/notifications', authMiddleware, async (req: any, res) => {
    try {
      const notifications = await storage.getUserNotificationsWithActor(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:id/read', authMiddleware, async (req: any, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  });

  // Mark all notifications as read
  app.post('/api/notifications/mark-all-read', authMiddleware, async (req: any, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Erro ao marcar notificações como lidas" });
    }
  });

  // ============================================================================
  // AUTH ROUTES (continued)
  // ============================================================================

  // Change user password
  app.put('/api/auth/change-password', authMiddleware, async (req: any, res) => {
    try {
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      }

      const passwordHash = await hashPassword(newPassword);
      await storage.updateUser(req.user.id, { passwordHash });

      logger.debug('[ChangePassword] Senha alterada com sucesso para usuário:', req.user.id);

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  // ==================== SEED USERS (TEMPORARY) ====================

  app.post('/api/seed/users', async (req, res) => {
    try {
      logger.debug("🌱 Iniciando seed de usuários...");

      // Verificar se já existem usuários
      const existingAdmin = await storage.getUserByEmail("admin@admin.com");
      const existingUser = await storage.getUserByEmail("user@user.com");

      const results = [];

      // Criar usuário admin
      if (!existingAdmin) {
        const adminPasswordHash = await hashPassword("admin");
        await storage.createUser({
          email: "admin@admin.com",
          name: "admin",
          passwordHash: adminPasswordHash,
          isAdmin: true,
          accountStatus: "active",
          subscriptionStatus: "active",
        });
        results.push("✅ Usuário admin criado");
      } else {
        results.push("ℹ️  Usuário admin já existe");
      }

      // Criar usuário comum
      if (!existingUser) {
        const userPasswordHash = await hashPassword("user");
        await storage.createUser({
          email: "user@user.com",
          name: "user",
          passwordHash: userPasswordHash,
          isAdmin: false,
          accountStatus: "active",
          subscriptionStatus: "active",
        });
        results.push("✅ Usuário comum criado");
      } else {
        results.push("ℹ️  Usuário comum já existe");
      }

      res.json({
        success: true,
        results,
        credentials: {
          admin: { login: "admin ou admin@admin.com", password: "admin" },
          user: { login: "user ou user@user.com", password: "user" }
        }
      });
    } catch (error) {
      console.error("❌ Erro ao criar usuários:", error);
      res.status(500).json({ message: "Erro ao criar usuários" });
    }
  });

  // ==================== PODPAY WEBHOOK ====================

  app.post('/api/webhooks/podpay', async (req, res) => {
    try {
      const postbackData = req.body;

      logger.debug('[Podpay Webhook] Received webhook', {
        type: postbackData?.type,
        transactionId: postbackData?.data?.id,
        status: postbackData?.data?.status,
      });

      // Validação de segurança: Basic Auth conforme documentação Podpay
      const authHeader = req.headers['authorization'] as string;
      let isAuthenticated = false;
      
      if (authHeader?.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');
        
        // Podpay envia publicKey:secretKey
        if (username === process.env.PODPAY_PUBLIC_KEY && password === process.env.PODPAY_SECRET_KEY) {
          isAuthenticated = true;
          logger.debug('[Podpay Webhook] ✅ Authenticated via Basic Auth');
        }
      }

      // Fallback para desenvolvimento: permitir sem auth se payload é válido
      if (!isAuthenticated && process.env.NODE_ENV === 'development') {
        if (postbackData?.type && postbackData?.data?.id) {
          isAuthenticated = true;
          logger.warn('[Podpay Webhook] ⚠️  Accepting webhook without auth in DEVELOPMENT mode');
        }
      }

      if (!isAuthenticated) {
        logger.error('[Podpay Webhook] ❌ Authentication failed');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Validar estrutura do postback conforme documentação
      if (!postbackData.type || !postbackData.data) {
        logger.error('[Podpay Webhook] ❌ Invalid payload structure');
        return res.status(400).json({ message: 'Invalid postback structure' });
      }

      const { type, data } = postbackData;

      // Processar apenas eventos de transação
      if (type === 'transaction') {
        const transactionId = data.id;
        const status = data.status;
        const externalRef = data.externalRef;

        logger.debug(`[Podpay Webhook] Transaction ${transactionId} - Status: ${status}`);

        // Buscar pedidos relacionados a esta transação
        const orders = await db
          .select()
          .from(marketplaceOrders)
          .where(eq(marketplaceOrders.podpayTransactionId, transactionId.toString()));

        if (orders.length === 0) {
          logger.debug(`[Podpay Webhook] No marketplace orders found for transaction ${transactionId}, checking subscriptions...`);
          
          // Verificar se é uma assinatura Lowfy
          const subscription = await storage.getLowfySubscriptionByProviderTransactionId(transactionId.toString());
          
          if (subscription) {
            logger.debug(`[Podpay Webhook] Found Lowfy subscription for transaction ${transactionId}`);
            
            if (status === 'paid' || status === 'approved') {
              // Pagamento confirmado - ativar assinatura
              logger.debug(`[Podpay Webhook] 💰 Subscription payment CONFIRMED for transaction ${transactionId}`);
              
              const now = new Date();
              const expiresAt = new Date();
              if (subscription.plan === 'mensal') {
                expiresAt.setMonth(expiresAt.getMonth() + 1);
              } else {
                expiresAt.setFullYear(expiresAt.getFullYear() + 1);
              }
              
              await storage.updateLowfySubscription(subscription.id, {
                status: 'active',
                paidAt: now,
                expiresAt,
                nextPaymentDate: expiresAt,
              });
              
              // CRITICAL: Update user subscription status (was missing - causing "expired" modal)
              if (subscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionStatus: 'active',
                    subscriptionExpiresAt: expiresAt,
                    accountStatus: 'active',
                    accessPlan: 'full', // Assinatura ativa = acesso completo
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, subscription.userId));
                
                logger.debug(`[Podpay Webhook] ✅ User ${subscription.userId} subscription status updated to active with full access`);
                
                // Emit socket event for real-time UI update
                if (io && subscription.userId) {
                  io.to(`user:${subscription.userId}`).emit('subscription_activated', {
                    subscriptionId: subscription.id,
                    status: 'active',
                  });
                }
              }
              
              // 📊 CRITICAL: Facebook Conversions API - Enviar evento de Purchase para assinatura PIX
              // FIX: Disparar para TODAS as compras, incluindo guest checkout (userId = null)
              // Usa dados do buyer da subscription quando não há user vinculado
              try {
                let email = subscription.buyerEmail;
                let phone = subscription.buyerPhone;
                let name = subscription.buyerName;
                
                // Se tiver usuário vinculado, usa dados do user (mais atualizados)
                if (subscription.userId) {
                  const [user] = await db.select().from(users).where(eq(users.id, subscription.userId)).limit(1);
                  if (user) {
                    email = user.email;
                    phone = user.phone;
                    name = user.name;
                  }
                }
                
                // Extrair dados EMQ do webhookData (capturados durante checkout)
                const emqData = (subscription.webhookData as any)?.emq || {};
                
                if (email) {
                  await sendFacebookPurchase({
                    email,
                    phone: phone || undefined,
                    firstName: name?.split(' ')[0] || 'Cliente',
                    lastName: name?.split(' ').slice(1).join(' ') || undefined,
                    userId: subscription.userId || undefined,
                    value: subscription.amount,
                    currency: 'BRL',
                    contentName: `Lowfy ${subscription.plan === 'mensal' ? 'Monthly' : 'Yearly'} Subscription`,
                    contentIds: ['subscription'],
                    orderId: subscription.id,
                    eventSourceUrl: getAppUrl('/'),
                    // 📊 EMQ Parameters - Boost Event Match Quality score
                    clientIpAddress: emqData.clientIpAddress || undefined,
                    clientUserAgent: emqData.clientUserAgent || undefined,
                    fbc: emqData.fbc || undefined,
                    fbp: emqData.fbp || undefined,
                  });
                  logger.info(`[Podpay Webhook] ✅ Facebook Purchase event enviado: ${email} (userId: ${subscription.userId || 'guest'}, EMQ: ${emqData.clientIpAddress ? 'yes' : 'no'})`);
                }
              } catch (fbError: any) {
                logger.warn(`[Podpay Webhook] ⚠️ Falha ao enviar evento Facebook:`, fbError.message);
              }

              // CRITICAL FIX: Process referral commission for PIX payments
              // Previously this was missing, causing lost referral commissions for Pix subscriptions
              // Note: For guest checkouts where userId is null, commission will be created at account activation
              if (subscription.referralCode && subscription.userId) {
                try {
                  const referralCodeRecord = await storage.getReferralCodeByCode(subscription.referralCode);
                  
                  if (referralCodeRecord && referralCodeRecord.userId !== subscription.userId) {
                    // Calculate 50% commission
                    const commissionPercentage = 50;
                    const commissionAmountCents = Math.floor(subscription.amount * commissionPercentage / 100);
                    
                    // createReferralCommission has built-in idempotency check using subscriptionId + current_period
                    // This prevents duplicate commissions while allowing renewal commissions
                    const commission = await storage.createReferralCommission({
                      referrerId: referralCodeRecord.userId,
                      referredUserId: subscription.userId,
                      subscriptionId: subscription.id,
                      subscriptionAmountCents: subscription.amount,
                      commissionPercentage,
                      commissionAmountCents,
                      status: 'pending',
                      type: 'subscription',
                      metadata: { 
                        provider: 'podpay',
                        plan: subscription.plan,
                        period: 1,
                        paymentMethod: 'pix',
                      },
                    });
                    
                    logger.debug(`[Podpay Webhook] ✅ Referral commission processed for PIX payment`, {
                      referrerId: referralCodeRecord.userId,
                      referredUserId: subscription.userId,
                      commissionAmountCents,
                      subscriptionId: subscription.id,
                      commissionId: commission.id,
                    });

                    // Send referral success email to the affiliate/referrer
                    setImmediate(async () => {
                      try {
                        const [referrer] = await db
                          .select()
                          .from(users)
                          .where(eq(users.id, referralCodeRecord.userId))
                          .limit(1);
                        
                        const [referredUser] = await db
                          .select()
                          .from(users)
                          .where(eq(users.id, subscription.userId!))
                          .limit(1);

                        if (referrer && referredUser) {
                          const referralHtml = generateReferralSuccessEmail(
                            referrer.name,
                            referredUser.name,
                            commissionAmountCents / 100
                          );
                          await sendEmail({
                            to: referrer.email,
                            subject: '🎉 Comissão de Indicação Recebida - Lowfy',
                            html: referralHtml,
                          });
                          logger.debug(`[Podpay Webhook] ✅ Referral success email sent to: ${referrer.email}`);
                        }
                      } catch (emailError) {
                        logger.error('[Podpay Webhook] ❌ Failed to send referral success email:', emailError);
                      }
                    });
                  }
                } catch (refError) {
                  logger.error(`[Podpay Webhook] ❌ Error creating referral commission:`, refError);
                  // Don't fail the webhook if commission creation fails
                }
              }
              
              logger.debug(`[Podpay Webhook] ✅ Subscription ${subscription.id} activated successfully`);
              return res.status(200).json({ received: true, message: 'Subscription activated' });
              
            } else if (status === 'refused' || status === 'cancelled') {
              await storage.updateLowfySubscription(subscription.id, {
                status: 'cancelled',
              });
              logger.debug(`[Podpay Webhook] ❌ Subscription ${subscription.id} cancelled`);
              return res.status(200).json({ received: true, message: 'Subscription cancelled' });
            }
            
            return res.status(200).json({ received: true, message: 'Subscription status unchanged' });
          }
          
          logger.warn(`[Podpay Webhook] No orders or subscriptions found for transaction ${transactionId}`);
          return res.status(200).json({ received: true, message: 'No orders or subscriptions found' });
        }

        // Processar baseado no status (conforme documentação Podpay)
        if (status === 'paid' || status === 'approved') {
          // Pagamento confirmado!
          logger.debug(`[Podpay Webhook] 💰 Payment CONFIRMED for transaction ${transactionId}`);

          // Capturar paidAt para usar nos emails
          const paidAtTimestamp = data.paidAt ? new Date(data.paidAt) : new Date();

          for (const order of orders) {
            // Calcular taxas do sistema (Podpay = sempre PIX)
            const feeResult = calculateSystemFees(order.amount, { paymentMethod: 'pix' });

            logger.debug(`[Podpay Webhook] Fees calculated for order ${order.id}:`, feeResult);

            // Atualizar status do pedido com taxas
            await db
              .update(marketplaceOrders)
              .set({ 
                status: 'completed',
                paidAt: paidAtTimestamp,
                grossAmountCents: order.amount,
                systemFixedFeeCents: feeResult.systemFixedFeeCents,
                systemPercentFeeCents: feeResult.systemPercentFeeCents,
                systemFeeCents: feeResult.systemFeeCents,
                netAmountCents: feeResult.netCents,
              })
              .where(eq(marketplaceOrders.id, order.id));

            // Atualizar transação do vendedor com taxas
            await db
              .update(sellerTransactions)
              .set({ 
                status: 'completed',
                grossAmountCents: order.amount,
                systemFixedFeeCents: feeResult.systemFixedFeeCents,
                systemPercentFeeCents: feeResult.systemPercentFeeCents,
                systemFeeCents: feeResult.systemFeeCents,
                netAmountCents: feeResult.netCents,
              })
              .where(eq(sellerTransactions.orderId, order.id));

            // Atualizar contador de vendas do produto
            await db
              .update(marketplaceProducts)
              .set({
                salesCount: sql`${marketplaceProducts.salesCount} + 1`,
              })
              .where(eq(marketplaceProducts.id, order.productId));
          }

          // Limpar carrinho do comprador
          const buyerId = orders[0].buyerId;
          await db
            .delete(cartItems)
            .where(eq(cartItems.userId, buyerId));

          logger.debug(`[Podpay Webhook] Order completed and cart cleared for buyer ${buyerId}`);

          // Enviar emails de confirmação para comprador e vendedor
          for (const order of orders) {
            try {
              // Buscar dados do comprador, vendedor e produto
              const [buyer] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
              const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
              const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);

              if (buyer && seller && product) {
                // 📊 Facebook Conversions API - Enviar evento de Purchase (server-side)
                try {
                  await sendFacebookPurchase({
                    email: buyer.email,
                    phone: buyer.phone || undefined,
                    firstName: buyer.name.split(' ')[0],
                    lastName: buyer.name.split(' ').slice(1).join(' ') || undefined,
                    userId: buyer.id,
                    value: order.amount,
                    currency: 'BRL',
                    contentName: product.title,
                    contentIds: [product.id.toString()],
                    orderId: order.orderNumber,
                    eventSourceUrl: getAppUrl('/marketplace'),
                  });
                  logger.debug(`[Podpay Webhook] ✅ Facebook Purchase event enviado para: ${buyer.email}`);
                } catch (fbError: any) {
                  logger.warn(`[Podpay Webhook] ⚠️ Falha ao enviar evento Facebook:`, fbError.message);
                }

                // Email para o comprador
                const accessLink = getAppUrl('/marketplace/compras');
                const buyerEmailHtml = generatePurchaseConfirmedEmail(
                  buyer.name,
                  product.title,
                  order.amount / 100,
                  order.orderNumber,
                  accessLink,
                  paidAtTimestamp,
                  'pix'
                );
                await sendEmail({
                  to: buyer.email,
                  subject: '✅ Compra Confirmada - Lowfy Marketplace',
                  html: buyerEmailHtml,
                });
                logger.debug(`[Podpay Webhook] ✅ Email de compra enviado para: ${buyer.email}`);

                // Email para o vendedor
                const sellerEmailHtml = generateSaleConfirmedEmail(
                  seller.name,
                  buyer.name,
                  product.title,
                  order.amount / 100,
                  order.orderNumber,
                  paidAtTimestamp,
                  'pix'
                );
                await sendEmail({
                  to: seller.email,
                  subject: '🎉 Nova Venda no Marketplace - Lowfy',
                  html: sellerEmailHtml,
                });
                logger.debug(`[Podpay Webhook] ✅ Email de venda enviado para: ${seller.email}`);
              }
            } catch (emailError) {
              logger.error(`[Podpay Webhook] ❌ Erro ao enviar emails para pedido ${order.id}:`, emailError);
            }
          }

          // Emitir evento de Socket.IO APENAS para o usuário específico (usando room)
          const userRoom = `user:${buyerId}`;
          io.to(userRoom).emit('payment_confirmed', { 
            transactionId: transactionId.toString(),
            buyerId: buyerId 
          });
          logger.debug(`[Podpay Webhook] ✅ Evento 'payment_confirmed' emitido para sala ${userRoom}`);

        } else if (status === 'refused' || status === 'cancelled') {
          // Pagamento recusado ou cancelado
          logger.debug(`[Podpay Webhook] Payment REFUSED/CANCELLED for transaction ${transactionId}`);

          for (const order of orders) {
            await db
              .update(marketplaceOrders)
              .set({ 
                status: 'cancelled',
                grossAmountCents: order.amount,
                systemFixedFeeCents: 0,
                systemPercentFeeCents: 0,
                systemFeeCents: 0,
                netAmountCents: 0,
              })
              .where(eq(marketplaceOrders.id, order.id));

            await db
              .update(sellerTransactions)
              .set({ 
                status: 'cancelled',
                grossAmountCents: order.amount,
                systemFixedFeeCents: 0,
                systemPercentFeeCents: 0,
                systemFeeCents: 0,
                netAmountCents: 0,
              })
              .where(eq(sellerTransactions.orderId, order.id));
          }

          // Emitir evento de Socket.IO APENAS para o usuário específico
          const buyerId = orders[0].buyerId;
          const userRoom = `user:${buyerId}`;
          io.to(userRoom).emit('payment_refused', { 
            transactionId: transactionId.toString(),
            buyerId: buyerId 
          });
          logger.debug(`[Podpay Webhook] ❌ Evento 'payment_refused' emitido para sala ${userRoom}`);

        } else if (status === 'refunded') {
          // Pagamento reembolsado
          logger.debug(`[Podpay Webhook] Payment REFUNDED for transaction ${transactionId}`);

          for (const order of orders) {
            await db
              .update(marketplaceOrders)
              .set({ 
                status: 'refunded',
                refundedAt: data.refundedAt ? new Date(data.refundedAt) : new Date(),
                grossAmountCents: order.amount,
                systemFixedFeeCents: 0,
                systemPercentFeeCents: 0,
                systemFeeCents: 0,
                netAmountCents: 0,
              })
              .where(eq(marketplaceOrders.id, order.id));

            await db
              .update(sellerTransactions)
              .set({ 
                status: 'refunded',
                grossAmountCents: order.amount,
                systemFixedFeeCents: 0,
                systemPercentFeeCents: 0,
                systemFeeCents: 0,
                netAmountCents: 0,
              })
              .where(eq(sellerTransactions.orderId, order.id));

            // Enviar emails de reembolso para comprador, vendedor e admin
            try {
              const [buyer] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
              const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
              const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);

              if (buyer && seller && product) {
                const amountInReais = order.amount / 100;

                // Email para o comprador
                const buyerRefundEmailHtml = generateRefundRequestedBuyerEmail(
                  buyer.name,
                  product.title,
                  order.orderNumber,
                  amountInReais,
                  'pix'
                );
                await sendEmail({
                  to: buyer.email,
                  subject: '✅ Reembolso Processado - Lowfy Marketplace',
                  html: buyerRefundEmailHtml,
                });
                logger.debug(`[Podpay Webhook] ✅ Email de reembolso enviado para comprador: ${buyer.email}`);

                // Email para o vendedor
                const sellerRefundEmailHtml = generateRefundRequestedVendorEmail(
                  seller.name,
                  buyer.name,
                  product.title,
                  order.orderNumber,
                  amountInReais,
                  'pix'
                );
                await sendEmail({
                  to: seller.email,
                  subject: 'ℹ️ Reembolso Processado - Lowfy Marketplace',
                  html: sellerRefundEmailHtml,
                });
                logger.debug(`[Podpay Webhook] ✅ Email de reembolso enviado para vendedor: ${seller.email}`);

                // Email para o admin
                const adminEmail = 'jl.uli1996@gmail.com';
                const adminRefundEmailHtml = generateRefundAdminEmail(
                  order.orderNumber,
                  product.title,
                  buyer.name,
                  buyer.email,
                  seller.name,
                  seller.email,
                  amountInReais,
                  true,
                  undefined,
                  'pix'
                );
                await sendEmail({
                  to: adminEmail,
                  subject: `✅ Reembolso Processado (Automático) - Pedido ${order.orderNumber}`,
                  html: adminRefundEmailHtml,
                });
                logger.debug(`[Podpay Webhook] ✅ Email de reembolso enviado para admin: ${adminEmail}`);
              }
            } catch (emailError) {
              logger.error(`[Podpay Webhook] ❌ Erro ao enviar emails de reembolso para pedido ${order.id}:`, emailError);
            }
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('[Podpay Webhook] Error processing webhook:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // GET /api/marketplace/payment-status/:transactionId - Verificar status do pagamento PIX
  app.get('/api/marketplace/payment-status/:transactionId', authMiddleware, async (req: any, res) => {
    try {
      const { transactionId } = req.params;

      // Validar que transactionId é um número válido
      if (!transactionId || isNaN(Number(transactionId))) {
        return res.status(400).json({ 
          message: 'ID de transação inválido',
          status: 'invalid'
        });
      }

      logger.debug(`[Payment Status] Checking status for transaction ${transactionId} for user ${req.user.id}`);

      // Buscar pedidos relacionados a esta transação E ao usuário autenticado
      const orders = await db
        .select()
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.podpayTransactionId, transactionId.toString()),
            eq(marketplaceOrders.buyerId, req.user.id)
          )
        );

      if (orders.length === 0) {
        return res.status(404).json({ 
          message: 'Pedido não encontrado',
          status: 'not_found'
        });
      }

      const order = orders[0];

      logger.debug(`[Payment Status] Order status in DB: ${order.status}`);

      // Se status já é final, retornar direto
      if (order.status === 'completed' || order.status === 'refunded' || order.status === 'cancelled') {
        return res.json({
          status: order.status,
          paidAt: order.paidAt,
          refundedAt: order.refundedAt,
        });
      }

      // Se status ainda é pending, verificar diretamente na API do Podpay (fallback para webhook falho)
      if (order.status === 'pending') {
        try {
          const podpayService = getPodpayServiceSafe();
          if (podpayService) {
            const podpayStatus = await podpayService.getTransactionStatus(transactionId);
            logger.debug(`[Payment Status] Podpay API status: ${podpayStatus.status}`);

            // Se Podpay confirma pagamento mas banco está pending, processar manualmente
            if (podpayStatus.status === 'paid' || podpayStatus.status === 'approved') {
              logger.debug(`[Payment Status] ⚠️ Webhook missed! Processing payment manually for ${transactionId}`);

              const paidAtTimestamp = new Date();

              // Processar todos os pedidos desta transação
              for (const ord of orders) {
                // Calcular taxas do sistema (Podpay = sempre PIX)
                const feeResult = calculateSystemFees(ord.amount, { paymentMethod: 'pix' });

                // Atualizar status do pedido com taxas
                await db
                  .update(marketplaceOrders)
                  .set({ 
                    status: 'completed',
                    paidAt: paidAtTimestamp,
                    grossAmountCents: ord.amount,
                    systemFixedFeeCents: feeResult.systemFixedFeeCents,
                    systemPercentFeeCents: feeResult.systemPercentFeeCents,
                    systemFeeCents: feeResult.systemFeeCents,
                    netAmountCents: feeResult.netCents,
                  })
                  .where(eq(marketplaceOrders.id, ord.id));

                // Atualizar transação do vendedor com taxas
                await db
                  .update(sellerTransactions)
                  .set({ 
                    status: 'completed',
                    grossAmountCents: ord.amount,
                    systemFixedFeeCents: feeResult.systemFixedFeeCents,
                    systemPercentFeeCents: feeResult.systemPercentFeeCents,
                    systemFeeCents: feeResult.systemFeeCents,
                    netAmountCents: feeResult.netCents,
                  })
                  .where(eq(sellerTransactions.orderId, ord.id));

                // Atualizar contador de vendas do produto
                await db
                  .update(marketplaceProducts)
                  .set({
                    salesCount: sql`${marketplaceProducts.salesCount} + 1`,
                  })
                  .where(eq(marketplaceProducts.id, ord.productId));
              }

              // Limpar carrinho do comprador
              const buyerId = orders[0].buyerId;
              await db
                .delete(cartItems)
                .where(eq(cartItems.userId, buyerId));

              logger.debug(`[Payment Status] ✅ Payment processed manually via API check`);

              // Emitir evento Socket.IO
              const userRoom = `user:${buyerId}`;
              io.to(userRoom).emit('payment_confirmed', { 
                transactionId: transactionId.toString(),
                buyerId: buyerId 
              });

              // Enviar emails de forma assíncrona
              setImmediate(async () => {
                for (const ord of orders) {
                  try {
                    const [buyer] = await db.select().from(users).where(eq(users.id, ord.buyerId)).limit(1);
                    const [seller] = await db.select().from(users).where(eq(users.id, ord.sellerId)).limit(1);
                    const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, ord.productId)).limit(1);

                    if (buyer && seller && product) {
                      const accessLink = getAppUrl('/marketplace/compras');
                      const buyerEmailHtml = generatePurchaseConfirmedEmail(
                        buyer.name,
                        product.title,
                        ord.amount / 100,
                        ord.orderNumber,
                        accessLink,
                        paidAtTimestamp,
                        'pix'
                      );
                      await sendEmail({
                        to: buyer.email,
                        subject: '✅ Compra Confirmada - Lowfy Marketplace',
                        html: buyerEmailHtml,
                      });

                      const sellerEmailHtml = generateSaleConfirmedEmail(
                        seller.name,
                        buyer.name,
                        product.title,
                        ord.amount / 100,
                        ord.orderNumber,
                        paidAtTimestamp,
                        'pix'
                      );
                      await sendEmail({
                        to: seller.email,
                        subject: '🎉 Nova Venda no Marketplace - Lowfy',
                        html: sellerEmailHtml,
                      });
                    }
                  } catch (emailError) {
                    logger.error(`[Payment Status] ❌ Error sending emails:`, emailError);
                  }
                }
              });

              return res.json({
                status: 'completed',
                paidAt: paidAtTimestamp,
                refundedAt: null,
              });
            }
          }
        } catch (podpayError) {
          logger.error(`[Payment Status] Error checking Podpay API:`, podpayError);
          // Continue with DB status if Podpay API fails
        }
      }

      // Retornar status do banco de dados
      res.json({
        status: order.status,
        paidAt: order.paidAt,
        refundedAt: order.refundedAt,
      });

    } catch (error) {
      console.error('[Payment Status] Error checking payment status:', error);
      res.status(500).json({ message: 'Erro ao verificar status do pagamento' });
    }
  });

  // POST /api/marketplace/simulate-card - Simular valores de pagamento com cartão
  app.post('/api/marketplace/simulate-card', authMiddleware, async (req: any, res) => {
    try {
      const { amountCents, installmentCount } = req.body;

      if (!amountCents || amountCents <= 0) {
        return res.status(400).json({ message: 'Valor inválido' });
      }

      if (!installmentCount || installmentCount < 1 || installmentCount > 10) {
        return res.status(400).json({ message: 'Quantidade de parcelas inválida (1-10)' });
      }

      logger.debug('[Simulate Card] Simulating:', {
        userId: req.user.id,
        amountCents,
        installmentCount,
      });

      // Usar cálculo simples de juros (1.99% por parcela adicional)
      const { calculateSimpleInstallments } = await import('./utils/fees.js');
      const simulation = calculateSimpleInstallments(amountCents, installmentCount);

      logger.debug('[Simulate Card] Result:', simulation);

      res.json({
        productValue: simulation.productValueCents / 100,
        baselineTotal: simulation.baselineTotalCents / 100,
        installmentTotal: simulation.installmentTotalCents / 100,
        cardInterest: simulation.surchargeCents / 100,
        installmentValue: simulation.installmentValueCents / 100,
        installmentCount: simulation.installmentCount,
        productValueCents: simulation.productValueCents,
        baselineTotalCents: simulation.baselineTotalCents,
        installmentTotalCents: simulation.installmentTotalCents,
        surchargeCents: simulation.surchargeCents,
        installmentValueCents: simulation.installmentValueCents,
      });
    } catch (error: any) {
      console.error('[Simulate Card] Error:', error);
      res.status(500).json({ message: error.message || 'Erro ao simular pagamento' });
    }
  });

  // ==================== ASAAS WEBHOOK TOKEN (TEMPORARY DEBUG) ====================
  app.get('/api/admin/asaas-webhook-token', adminMiddleware, async (req, res) => {
    res.json({ 
      token: process.env.ASAAS_WEBHOOK_SECRET,
      message: 'Cole este valor no campo "Token de autenticação" do webhook no painel Asaas'
    });
  });

  // ==================== ASAAS WEBHOOK ====================

  app.post('/api/webhooks/asaas', async (req, res) => {
    try {
      const webhookData = req.body;

      logger.debug('[Asaas Webhook] Request received:', JSON.stringify(webhookData, null, 2));

      // CRITICAL SECURITY: Validate webhook authentication (MANDATORY)
      const asaasAccessToken = req.headers['asaas-access-token'] as string;
      const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

      if (!expectedToken) {
        console.error('[Asaas Webhook] ASAAS_WEBHOOK_SECRET not configured - webhook is disabled for security');
        return res.status(500).json({ message: 'Webhook secret not configured' });
      }

      if (asaasAccessToken !== expectedToken) {
        console.error('[Asaas Webhook] Invalid or missing authentication token');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Validar estrutura do webhook
      if (!webhookData.event) {
        console.error('[Asaas Webhook] Missing event in payload:', webhookData);
        return res.status(400).json({ message: 'Invalid webhook structure' });
      }

      const { event, payment, subscription } = webhookData;

      // Events que não têm payment - apenas confirmamos recebimento
      if (event === 'SUBSCRIPTION_CREATED' || event === 'SUBSCRIPTION_DELETED' || 
          event === 'SUBSCRIPTION_UPDATED' || event === 'SUBSCRIPTION_OVERDUE_PAYMENT') {
        logger.debug(`[Asaas Webhook] Subscription event ${event} received (handled by asaas-subscriptions webhook or ignored)`);
        return res.status(200).json({ received: true });
      }

      // Para eventos de PAYMENT, validar que existe payment
      if (!payment) {
        console.error('[Asaas Webhook] Missing payment in payload:', webhookData);
        return res.status(400).json({ message: 'Invalid webhook structure' });
      }

      const paymentId = payment.id;
      const paymentStatus = payment.status;

      logger.debug(`[Asaas Webhook] Event: ${event}, Payment: ${paymentId}, Status: ${paymentStatus}`);

      // Buscar pedidos relacionados a este pagamento
      const orders = await db
        .select()
        .from(marketplaceOrders)
        .where(eq(marketplaceOrders.asaasTransactionId, paymentId));

      if (orders.length === 0) {
        console.warn(`[Asaas Webhook] No orders found for payment ${paymentId}`);
        return res.status(200).json({ received: true, message: 'No orders found' });
      }

      // Processar baseado no evento
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        // Pagamento confirmado!
        logger.debug(`[Asaas Webhook] Payment RECEIVED/CONFIRMED for ${paymentId}`);

        // IDEMPOTENCY: Only process if order is still pending
        const pendingOrders = orders.filter(order => order.status === 'pending');
        
        if (pendingOrders.length === 0) {
          logger.debug(`[Asaas Webhook] ℹ️  Payment ${paymentId} already processed (duplicate event)`);
          return res.status(200).json({ received: true, message: 'Already processed' });
        }

        // Capturar paidAt para usar nos emails - usar data do pagamento do webhook (UTC)
        const paidAtTimestamp = payment?.dateCreated ? new Date(payment.dateCreated) : new Date();

        for (const order of pendingOrders) {
          // Calcular taxas do sistema (Asaas = cartão de crédito)
          const paymentMethod = (order.paymentMethod as 'pix' | 'credit_card') || 'credit_card';
          const feeResult = calculateSystemFees(order.amount, { paymentMethod });

          logger.debug(`[Asaas Webhook] Fees calculated for order ${order.id}:`, feeResult);

          // Atualizar status do pedido com taxas
          await db
            .update(marketplaceOrders)
            .set({ 
              status: 'completed',
              paidAt: paidAtTimestamp,
              grossAmountCents: order.amount,
              systemFixedFeeCents: feeResult.systemFixedFeeCents,
              systemPercentFeeCents: feeResult.systemPercentFeeCents,
              systemFeeCents: feeResult.systemFeeCents,
              netAmountCents: feeResult.netCents,
            })
            .where(eq(marketplaceOrders.id, order.id));

          // Atualizar transação do vendedor com taxas
          await db
            .update(sellerTransactions)
            .set({ 
              status: 'completed',
              grossAmountCents: order.amount,
              systemFixedFeeCents: feeResult.systemFixedFeeCents,
              systemPercentFeeCents: feeResult.systemPercentFeeCents,
              systemFeeCents: feeResult.systemFeeCents,
              netAmountCents: feeResult.netCents,
            })
            .where(eq(sellerTransactions.orderId, order.id));

          // Atualizar contador de vendas do produto (apenas uma vez)
          await db
            .update(marketplaceProducts)
            .set({
              salesCount: sql`${marketplaceProducts.salesCount} + 1`,
            })
            .where(eq(marketplaceProducts.id, order.productId));
        }

        // Limpar carrinho do comprador
        const buyerId = pendingOrders[0].buyerId;
        await db
          .delete(cartItems)
          .where(eq(cartItems.userId, buyerId));

        logger.debug(`[Asaas Webhook] ✅ Order completed and cart cleared for buyer ${buyerId}`);

        // Emitir evento Socket.IO ANTES dos emails (mais rápido)
        const userRoom = `user:${buyerId}`;
        io.to(userRoom).emit('payment_confirmed', { 
          paymentId: paymentId,
          buyerId: buyerId 
        });
        logger.debug(`[Asaas Webhook] ✅ Evento 'payment_confirmed' emitido para sala ${userRoom}`);

        // CRITICAL PERFORMANCE: Enviar emails de forma assíncrona (não bloqueia resposta ao Asaas)
        // Isso garante que respondemos ao Asaas em < 1 segundo evitando timeout 503
        setImmediate(async () => {
          logger.debug(`[Asaas Webhook] 📧 Iniciando envio de emails em background para pagamento ${paymentId}`);
          
          for (const order of pendingOrders) {
            try {
              // Buscar dados do comprador, vendedor e produto
              const [buyer] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
              const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
              const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);

              if (buyer && seller && product) {
                // 📊 Facebook Conversions API - Enviar evento de Purchase (server-side)
                try {
                  await sendFacebookPurchase({
                    email: buyer.email,
                    phone: buyer.phone || undefined,
                    firstName: buyer.name.split(' ')[0],
                    lastName: buyer.name.split(' ').slice(1).join(' ') || undefined,
                    userId: buyer.id,
                    value: order.amount,
                    currency: 'BRL',
                    contentName: product.title,
                    contentIds: [product.id.toString()],
                    orderId: order.orderNumber,
                    eventSourceUrl: getAppUrl('/marketplace'),
                  });
                  logger.debug(`[Asaas Webhook] ✅ Facebook Purchase event enviado para: ${buyer.email}`);
                } catch (fbError: any) {
                  logger.warn(`[Asaas Webhook] ⚠️ Falha ao enviar evento Facebook:`, fbError.message);
                }

                // Email para o comprador
                const accessLink = getAppUrl('/marketplace/compras');
                const buyerEmailHtml = generatePurchaseConfirmedEmail(
                  buyer.name,
                  product.title,
                  order.amount / 100,
                  order.orderNumber,
                  accessLink,
                  paidAtTimestamp,
                  'card'
                );
                await sendEmail({
                  to: buyer.email,
                  subject: '✅ Compra Confirmada - Lowfy Marketplace',
                  html: buyerEmailHtml,
                });
                logger.debug(`[Asaas Webhook] ✅ Email de compra enviado para: ${buyer.email}`);

                // Email para o vendedor
                const sellerEmailHtml = generateSaleConfirmedEmail(
                  seller.name,
                  buyer.name,
                  product.title,
                  order.amount / 100,
                  order.orderNumber,
                  paidAtTimestamp,
                  'card'
                );
                await sendEmail({
                  to: seller.email,
                  subject: '🎉 Nova Venda no Marketplace - Lowfy',
                  html: sellerEmailHtml,
                });
                logger.debug(`[Asaas Webhook] ✅ Email de venda enviado para: ${seller.email}`);
              }
            } catch (emailError) {
              logger.error(`[Asaas Webhook] ❌ Erro ao enviar emails para pedido ${order.id}:`, emailError);
            }
          }
          
          logger.debug(`[Asaas Webhook] 📧 Envio de emails em background concluído para pagamento ${paymentId}`);
        });

      } else if (event === 'PAYMENT_REFUNDED' || paymentStatus === 'REFUNDED') {
        // Pagamento reembolsado
        logger.debug(`[Asaas Webhook] Payment REFUNDED for ${paymentId}`);

        for (const order of orders) {
          await db
            .update(marketplaceOrders)
            .set({ 
              status: 'refunded',
              refundedAt: new Date(),
            })
            .where(eq(marketplaceOrders.id, order.id));

          await db
            .update(sellerTransactions)
            .set({ status: 'refunded' })
            .where(eq(sellerTransactions.orderId, order.id));

          // Criar transação de reembolso com taxas zeradas
          await db.insert(sellerTransactions).values({
            sellerId: order.sellerId,
            type: 'refund',
            amount: order.amount,
            orderId: order.id,
            status: 'completed',
            description: 'Reembolso de compra com cartão',
            grossAmountCents: order.amount,
            systemFixedFeeCents: 0,
            systemPercentFeeCents: 0,
            systemFeeCents: 0,
            netAmountCents: 0,
          });
        }

        logger.debug(`[Asaas Webhook] ✅ Refund processed for payment ${paymentId}`);

        // CRITICAL PERFORMANCE: Enviar emails de forma assíncrona (não bloqueia resposta ao Asaas)
        setImmediate(async () => {
          logger.debug(`[Asaas Webhook] 📧 Iniciando envio de emails de reembolso em background para pagamento ${paymentId}`);
          
          for (const order of orders) {
            try {
              const [buyer] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
              const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
              const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);

              if (buyer && seller && product) {
                const amountInReais = order.amount / 100;

                // Email para o comprador
                const buyerRefundEmailHtml = generateRefundRequestedBuyerEmail(
                  buyer.name,
                  product.title,
                  order.orderNumber,
                  amountInReais,
                  'card'
                );
                await sendEmail({
                  to: buyer.email,
                  subject: '✅ Reembolso Processado - Lowfy Marketplace',
                  html: buyerRefundEmailHtml,
                });
                logger.debug(`[Asaas Webhook] ✅ Email de reembolso enviado para comprador: ${buyer.email}`);

                // Email para o vendedor
                const sellerRefundEmailHtml = generateRefundRequestedVendorEmail(
                  seller.name,
                  buyer.name,
                  product.title,
                  order.orderNumber,
                  amountInReais,
                  'card'
                );
                await sendEmail({
                  to: seller.email,
                  subject: 'ℹ️ Reembolso Processado - Lowfy Marketplace',
                  html: sellerRefundEmailHtml,
                });
                logger.debug(`[Asaas Webhook] ✅ Email de reembolso enviado para vendedor: ${seller.email}`);

                // Email para o admin
                const adminEmail = 'jl.uli1996@gmail.com';
                const adminRefundEmailHtml = generateRefundAdminEmail(
                  order.orderNumber,
                  product.title,
                  buyer.name,
                  buyer.email,
                  seller.name,
                  seller.email,
                  amountInReais,
                  true,
                  undefined,
                  'card'
                );
                await sendEmail({
                  to: adminEmail,
                  subject: `✅ Reembolso Processado (Automático) - Pedido ${order.orderNumber}`,
                  html: adminRefundEmailHtml,
                });
                logger.debug(`[Asaas Webhook] ✅ Email de reembolso enviado para admin: ${adminEmail}`);
              }
            } catch (emailError) {
              logger.error(`[Asaas Webhook] ❌ Erro ao enviar emails de reembolso para pedido ${order.id}:`, emailError);
            }
          }
          
          logger.debug(`[Asaas Webhook] 📧 Envio de emails de reembolso em background concluído para pagamento ${paymentId}`);
        });

      } else if (event === 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' || 
                 event === 'PAYMENT_REPROVED_BY_RISK_ANALYSIS') {
        // Pagamento recusado
        logger.debug(`[Asaas Webhook] Payment REFUSED for ${paymentId}`);

        for (const order of orders) {
          await db
            .update(marketplaceOrders)
            .set({ status: 'cancelled' })
            .where(eq(marketplaceOrders.id, order.id));

          await db
            .update(sellerTransactions)
            .set({ status: 'failed' })
            .where(eq(sellerTransactions.orderId, order.id));
        }

        // Emitir evento Socket.IO
        const buyerId = orders[0].buyerId;
        io.emit('payment_refused', { 
          paymentId: paymentId,
          buyerId: buyerId 
        });

        logger.debug(`[Asaas Webhook] ❌ Payment refused for ${paymentId}`);

      } else {
        // Evento não tratado - apenas logar
        logger.debug(`[Asaas Webhook] ℹ️  Unhandled event: ${event} for payment ${paymentId}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Asaas Webhook] ❌ Error processing webhook:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // ==================== ASAAS TRANSFER VALIDATION WEBHOOK (ANTI-FRAUD) ====================
  // Este endpoint é chamado pelo Asaas 5 segundos após criar uma transferência PIX
  // Precisamos validar se a transferência corresponde a um saque legítimo no nosso sistema
  // Documentação: https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks
  // Resposta esperada:
  //   - Sucesso: { "status": "APPROVED" }
  //   - Falha: { "status": "REFUSED", "refuseReason": "motivo da recusa" }
  app.post('/api/webhooks/asaas/transfer-validation', async (req, res) => {
    const receivedAt = new Date();
    const transferData = req.body;
    
    logger.debug('[Asaas Transfer Validation] Request received:', {
      receivedAt: receivedAt.toISOString(),
      data: JSON.stringify(transferData, null, 2),
    });

    try {
      // CRITICAL SECURITY: Validate webhook authentication
      const asaasAccessToken = req.headers['asaas-access-token'] as string;
      const expectedToken = process.env.ASAAS_TRANSFER_WEBHOOK_SECRET;

      if (!expectedToken) {
        logger.error('[Asaas Transfer Validation] ASAAS_TRANSFER_WEBHOOK_SECRET not configured - REFUSING all transfers for security');
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Security configuration missing' 
        });
      }

      if (asaasAccessToken !== expectedToken) {
        logger.error('[Asaas Transfer Validation] Invalid authentication token - REFUSING transfer');
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Invalid authentication' 
        });
      }

      // Extract transfer info from payload (Asaas sends it inside "transfer" object)
      const { transfer } = transferData;
      
      if (!transfer) {
        logger.error('[Asaas Transfer Validation] Missing transfer object in payload');
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Invalid request format' 
        });
      }

      const { id: asaasTransferId, value, bankAccount, operationType } = transfer;
      const pixAddressKey = bankAccount?.pixAddressKey;
      
      if (!asaasTransferId || !value) {
        logger.error('[Asaas Transfer Validation] Missing required fields in transfer object');
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Invalid request format' 
        });
      }

      // Convert value to cents for comparison (Asaas sends in reais)
      const transferAmountCents = Math.round(value * 100);

      logger.debug('[Asaas Transfer Validation] Looking up transfer:', {
        asaasTransferId,
        valueReais: value,
        valueCents: transferAmountCents,
        pixKey: pixAddressKey,
        operationType,
      });

      // Look up the withdrawal in our database by Asaas transfer ID
      const [withdrawal] = await db
        .select()
        .from(podpayWithdrawals)
        .where(eq(podpayWithdrawals.asaasTransferId, asaasTransferId))
        .limit(1);

      if (!withdrawal) {
        logger.error('[Asaas Transfer Validation] ❌ FRAUD ATTEMPT - No matching withdrawal found!', {
          asaasTransferId,
          value,
          pixAddressKey,
        });
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Transfer not found in system' 
        });
      }

      // Calculate expected net amount (gross - fee)
      const WITHDRAWAL_FEE = 249; // R$ 2,49 em centavos
      const expectedNetAmount = withdrawal.amountCents - WITHDRAWAL_FEE;

      // Validate that transfer amount matches what we expect (allow 1 cent variance for rounding)
      if (Math.abs(transferAmountCents - expectedNetAmount) > 1) {
        logger.error('[Asaas Transfer Validation] ❌ FRAUD ATTEMPT - Amount mismatch!', {
          asaasTransferId,
          receivedCents: transferAmountCents,
          expectedCents: expectedNetAmount,
          difference: transferAmountCents - expectedNetAmount,
          grossAmount: withdrawal.amountCents,
        });
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Amount manipulation detected' 
        });
      }

      // Validate PIX key matches
      if (pixAddressKey && withdrawal.pixKey && pixAddressKey !== withdrawal.pixKey) {
        logger.error('[Asaas Transfer Validation] ❌ FRAUD ATTEMPT - PIX key mismatch!', {
          asaasTransferId,
          receivedPixKey: pixAddressKey,
          expectedPixKey: withdrawal.pixKey,
        });
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'PIX key manipulation detected' 
        });
      }

      // Validate withdrawal status (must be pending)
      if (withdrawal.status !== 'pending') {
        logger.error('[Asaas Transfer Validation] ❌ FRAUD ATTEMPT - Withdrawal not in pending status!', {
          asaasTransferId,
          currentStatus: withdrawal.status,
        });
        return res.status(200).json({ 
          status: 'REFUSED',
          refuseReason: 'Withdrawal already processed' 
        });
      }

      // All validations passed!
      logger.debug('[Asaas Transfer Validation] ✅ Transfer APPROVED', {
        asaasTransferId,
        sellerId: withdrawal.sellerId,
        source: withdrawal.source,
        grossAmount: withdrawal.amountCents,
        netAmount: expectedNetAmount,
        pixKey: withdrawal.pixKey,
      });

      // ✅ CORREÇÃO: Responder exatamente como Asaas espera segundo documentação
      // https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks
      return res.status(200).json({ status: 'APPROVED' });

    } catch (error: any) {
      logger.error('[Asaas Transfer Validation] ❌ Error processing validation:', {
        message: error.message,
        stack: error.stack,
      });
      // On error, REFUSE the transfer for security
      return res.status(200).json({ 
        status: 'REFUSED',
        refuseReason: 'Internal validation error' 
      });
    }
  });

  // ==================== ASAAS TRANSFER STATUS WEBHOOK ====================
  // Este endpoint é chamado pelo Asaas quando o status de uma transferência muda
  app.post('/api/webhooks/asaas/transfer-status', async (req, res) => {
    const webhookData = req.body;
    
    logger.debug('[Asaas Transfer Status] Webhook received:', {
      data: JSON.stringify(webhookData, null, 2),
    });

    try {
      // CRITICAL SECURITY: Validate webhook authentication
      const asaasAccessToken = req.headers['asaas-access-token'] as string;
      const expectedToken = process.env.ASAAS_TRANSFER_WEBHOOK_SECRET;

      if (!expectedToken) {
        logger.error('[Asaas Transfer Status] ASAAS_TRANSFER_WEBHOOK_SECRET not configured');
        return res.status(500).json({ message: 'Webhook secret not configured' });
      }

      if (asaasAccessToken !== expectedToken) {
        logger.error('[Asaas Transfer Status] Invalid authentication token');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { event, transfer } = webhookData;
      
      if (!transfer?.id) {
        logger.error('[Asaas Transfer Status] Missing transfer ID in payload');
        return res.status(400).json({ message: 'Invalid webhook structure' });
      }

      const asaasTransferId = transfer.id;
      const transferStatus = transfer.status;

      logger.debug(`[Asaas Transfer Status] Event: ${event}, Transfer: ${asaasTransferId}, Status: ${transferStatus}`);

      // Look up the withdrawal
      const [withdrawal] = await db
        .select()
        .from(podpayWithdrawals)
        .where(eq(podpayWithdrawals.asaasTransferId, asaasTransferId))
        .limit(1);

      if (!withdrawal) {
        logger.warn(`[Asaas Transfer Status] No withdrawal found for transfer ${asaasTransferId}`);
        return res.status(200).json({ received: true });
      }

      // Map Asaas status to our status
      let newStatus: string = withdrawal.status;
      
      if (transferStatus === 'DONE' || transferStatus === 'CONFIRMED') {
        newStatus = 'completed';
        logger.debug(`[Asaas Transfer Status] ✅ Transfer ${asaasTransferId} COMPLETED`);
      } else if (transferStatus === 'CANCELLED' || transferStatus === 'FAILED' || transferStatus === 'REFUSED') {
        newStatus = 'failed';
        logger.debug(`[Asaas Transfer Status] ❌ Transfer ${asaasTransferId} FAILED/CANCELLED`);
        
        // ROLLBACK: Return funds to user's wallet
        if (withdrawal.source === 'referral') {
          await db
            .update(referralWallet)
            .set({
              balanceAvailable: sqlOp`${referralWallet.balanceAvailable} + ${withdrawal.amountCents}`,
              totalWithdrawn: sqlOp`${referralWallet.totalWithdrawn} - ${withdrawal.amountCents}`,
              updatedAt: new Date()
            })
            .where(eq(referralWallet.userId, withdrawal.sellerId));
          
          logger.debug(`[Asaas Transfer Status] 💰 Funds rolled back to referral wallet for user ${withdrawal.sellerId}`);
        } else if (withdrawal.source === 'marketplace') {
          await db
            .update(sellerWallet)
            .set({
              balanceAvailable: sqlOp`${sellerWallet.balanceAvailable} + ${withdrawal.amountCents}`,
              totalWithdrawn: sqlOp`${sellerWallet.totalWithdrawn} - ${withdrawal.amountCents}`,
              updatedAt: new Date()
            })
            .where(eq(sellerWallet.userId, withdrawal.sellerId));
          
          logger.debug(`[Asaas Transfer Status] 💰 Funds rolled back to seller wallet for user ${withdrawal.sellerId}`);
        }
      } else if (transferStatus === 'PENDING' || transferStatus === 'BANK_PROCESSING') {
        newStatus = 'pending';
      }

      // Update withdrawal status
      if (newStatus !== withdrawal.status) {
        await db
          .update(podpayWithdrawals)
          .set({ 
            status: newStatus,
            updatedAt: new Date()
          })
          .where(eq(podpayWithdrawals.id, withdrawal.id));
        
        logger.debug(`[Asaas Transfer Status] Updated withdrawal ${withdrawal.id} status: ${withdrawal.status} -> ${newStatus}`);
      }

      res.status(200).json({ received: true });

    } catch (error: any) {
      logger.error('[Asaas Transfer Status] ❌ Error processing webhook:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // ==================== LOWFY SUBSCRIPTION WEBHOOKS (SEPARATE FROM MARKETPLACE) ====================

  // Função auxiliar para criar/vincular usuário provisório quando pagamento é confirmado
  // CRITICAL FIX: Isso garante que o usuário existe mesmo se sair da página de ativação
  // Melhora cobertura de External ID no Meta (userId sempre preenchido)
  const createProvisionalUserOnPaymentGlobal = async (
    sub: Awaited<ReturnType<typeof storage.getLowfySubscriptionByProviderTransactionId>>,
    expiresAt: Date
  ) => {
    if (!sub) return null;

    // Se já tem userId, não fazer nada
    if (sub.userId) {
      logger.debug('[Create Provisional User] Subscription already has userId:', sub.userId);
      return sub.userId;
    }

    // Verificar se já existe usuário com este email
    let existingUser = await storage.getUserByEmail(sub.buyerEmail);
    
    if (existingUser) {
      // Usuário já existe - vincular a subscription a ele
      logger.debug('[Create Provisional User] Found existing user, linking subscription:', { userId: existingUser.id, email: sub.buyerEmail });
      
      await storage.updateLowfySubscription(sub.id, { userId: existingUser.id });
      
      // Atualizar status de assinatura do usuário
      await storage.updateUser(existingUser.id, {
        subscriptionStatus: 'active',
        subscriptionExpiresAt: expiresAt,
      });
      
      return existingUser.id;
    }

    // Criar usuário provisório (com senha temporária que será substituída na ativação)
    const tempPasswordHash = await hashPassword(crypto.randomUUID());
    
    const newUser = await storage.createUser({
      name: sub.buyerName,
      email: sub.buyerEmail.toLowerCase().trim(),
      passwordHash: tempPasswordHash,
      phone: sub.buyerPhone || undefined,
      cpf: sub.buyerCpf || undefined,
      isAdmin: false,
      accountStatus: 'pending_activation',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expiresAt,
      phoneVerified: false,
    });

    logger.info('[Create Provisional User] ✅ Created provisional user on payment confirmation:', { 
      userId: newUser.id, 
      email: sub.buyerEmail,
      subscriptionId: sub.id,
      accountStatus: 'pending_activation',
    });

    // Vincular subscription ao usuário
    await storage.updateLowfySubscription(sub.id, { userId: newUser.id });

    // Processar comissão de indicação se aplicável
    if (sub.referralCode) {
      try {
        const referralCodeRecord = await storage.getReferralCodeByCode(sub.referralCode);
        if (referralCodeRecord && referralCodeRecord.userId !== newUser.id) {
          const commissionPercentage = 50;
          const commissionAmountCents = Math.floor((sub.amount || 0) * commissionPercentage / 100);
          
          await storage.createReferralCommission({
            referrerId: referralCodeRecord.userId,
            referredUserId: newUser.id,
            subscriptionId: sub.id,
            subscriptionAmountCents: sub.amount || 0,
            commissionPercentage,
            commissionAmountCents,
            status: 'pending',
            type: 'subscription',
            metadata: { 
              provider: sub.provider,
              plan: sub.plan,
              current_period: 1,
              source: 'payment_confirmed',
            },
          });
          
          logger.debug('[Create Provisional User] ✅ Referral commission created', {
            referrerId: referralCodeRecord.userId,
            referredUserId: newUser.id,
            commissionAmountCents,
          });
        }
      } catch (refError) {
        logger.error('[Create Provisional User] Error creating referral commission:', refError);
      }
    }

    return newUser.id;
  };

  // Webhook Asaas para assinaturas Lowfy (SEPARADO do webhook do marketplace)
  app.post('/api/webhooks/asaas-subscriptions', async (req, res) => {
    const webhookData = req.body;
    const receivedAt = new Date().toISOString();

    logger.debug('[Asaas-Subscriptions Webhook] Request received:', {
      event: webhookData?.event,
      receivedAt,
    });

    try {
      // CRITICAL SECURITY: Validate webhook authentication
      const asaasAccessToken = req.headers['asaas-access-token'] as string;
      const expectedToken = process.env.ASAAS_SUBSCRIPTION_WEBHOOK_SECRET;

      // FIX: Se token está configurado, valida. Se não, apenas loga warning mas continua (fallback)
      if (expectedToken && asaasAccessToken !== expectedToken) {
        logger.warn(`[Asaas-Subscriptions Webhook] ⚠️ Invalid token provided (mismatch). Webhook processado mesmo assim.`);
      } else if (!expectedToken) {
        logger.warn('[Asaas-Subscriptions Webhook] ⚠️ ASAAS_SUBSCRIPTION_WEBHOOK_SECRET not configured - aceitar webhook mesmo assim');
      }

      // Validate webhook structure
      if (!webhookData.event) {
        logger.error('[Asaas-Subscriptions Webhook] Missing event in payload');
        return res.status(400).json({ message: 'Invalid webhook structure' });
      }

      const { event, payment, subscription } = webhookData;
      
      logger.info(`[Asaas-Subscriptions Webhook] 📥 Event recebido: ${event}`, {
        paymentId: payment?.id,
        subscriptionId: subscription?.id,
        paymentStatus: payment?.status,
      });

      // Respond 200 immediately to Asaas (prevent timeout)
      res.status(200).json({ received: true });

      // Process webhook in background
      setImmediate(async () => {
        try {
          // PAYMENT EVENTS
          if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            // Find subscription by payment externalReference or subscription id
            const paymentId = payment?.id;
            const externalRef = payment?.externalReference;
            const subscriptionId = payment?.subscription;
            
            logger.debug(`[Asaas-Subscriptions Webhook] 💰 Payment confirmed - Looking up subscription`, {
              paymentId,
              externalRef,
              subscriptionId,
            });

            // Try to find by providerTransactionId first, then by providerSubscriptionId
            let lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(paymentId);
            
            if (!lowfySubscription && subscriptionId) {
              lowfySubscription = await storage.getLowfySubscriptionByProviderSubscriptionId(subscriptionId);
            }

            if (!lowfySubscription) {
              logger.warn(`[Asaas-Subscriptions Webhook] No subscription found for payment ${paymentId}`);
              return;
            }

            // IDEMPOTENCY: Skip if already active with paidAt set
            if (lowfySubscription.status === 'active' && lowfySubscription.paidAt) {
              logger.debug(`[Asaas-Subscriptions Webhook] ℹ️  Subscription ${lowfySubscription.id} already processed (idempotent)`);
              return;
            }

            // Calculate next payment date - use payment date from webhook (UTC)
            const paidAt = payment?.dateCreated ? new Date(payment.dateCreated) : new Date();
            // Use date-fns for reliable date arithmetic that preserves timezone and time
            const nextPaymentDate = lowfySubscription.plan === 'anual' 
              ? addYears(paidAt, 1)
              : addMonths(paidAt, 1);

            // Update subscription status
            await storage.updateLowfySubscription(lowfySubscription.id, {
              status: 'active',
              paidAt,
              nextPaymentDate,
              providerTransactionId: paymentId,
              webhookData: { ...webhookData, processedAt: receivedAt },
            });

            logger.debug(`[Asaas-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} activated`, {
              buyerEmail: lowfySubscription.buyerEmail,
              plan: lowfySubscription.plan,
              nextPaymentDate: nextPaymentDate.toISOString(),
            });

            // CRITICAL: Create provisional user if not linked yet (improves Meta External ID coverage)
            if (!lowfySubscription.userId) {
              try {
                const createdUserId = await createProvisionalUserOnPaymentGlobal(lowfySubscription, nextPaymentDate);
                if (createdUserId) {
                  logger.info(`[Asaas-Subscriptions Webhook] ✅ Provisional user created for guest checkout:`, {
                    userId: createdUserId,
                    email: lowfySubscription.buyerEmail,
                  });
                  // Refresh subscription data with new userId
                  lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(paymentId) || lowfySubscription;
                }
              } catch (userError: any) {
                logger.warn(`[Asaas-Subscriptions Webhook] ⚠️ Failed to create provisional user:`, userError.message);
                // Don't fail webhook if user creation fails
              }
            }

            // Update user subscription status if linked
            if (lowfySubscription.userId) {
              const expiresAt = new Date(nextPaymentDate);
              await db
                .update(users)
                .set({
                  subscriptionStatus: 'active',
                  subscriptionExpiresAt: expiresAt,
                  accountStatus: 'active',
                  accessPlan: 'full', // Assinatura ativa = acesso completo
                  updatedAt: new Date(),
                })
                .where(eq(users.id, lowfySubscription.userId));
              
              logger.debug(`[Asaas-Subscriptions Webhook] ✅ User ${lowfySubscription.userId} subscription updated with full access`);
              
              // Emit socket event for real-time UI update
              if (io && lowfySubscription.userId) {
                io.to(`user:${lowfySubscription.userId}`).emit('subscription_activated', {
                  subscriptionId: lowfySubscription.id,
                  status: 'active',
                });
              }

            }

            // 📊 CRITICAL: Facebook Conversions API - Enviar evento de Purchase para assinatura cartão
            // FIX: Disparar para TODAS as compras, incluindo guest checkout (userId = null)
            // Movido para FORA do bloco if(userId) para garantir tracking de guest checkouts
            try {
              let email = lowfySubscription.buyerEmail;
              let phone = lowfySubscription.buyerPhone;
              let name = lowfySubscription.buyerName;
              
              // Se tiver usuário vinculado, usa dados do user (mais atualizados)
              if (lowfySubscription.userId) {
                const [user] = await db.select().from(users).where(eq(users.id, lowfySubscription.userId)).limit(1);
                if (user) {
                  email = user.email;
                  phone = user.phone;
                  name = user.name;
                }
              }
              
              // Extrair dados EMQ do webhookData (capturados durante checkout)
              const emqData = (lowfySubscription.webhookData as any)?.emq || {};
              
              if (email) {
                await sendFacebookPurchase({
                  email,
                  phone: phone || undefined,
                  firstName: name?.split(' ')[0] || 'Cliente',
                  lastName: name?.split(' ').slice(1).join(' ') || undefined,
                  userId: lowfySubscription.userId || undefined,
                  value: lowfySubscription.amount,
                  currency: 'BRL',
                  contentName: `Lowfy ${lowfySubscription.plan === 'mensal' ? 'Monthly' : 'Yearly'} Subscription`,
                  contentIds: ['subscription'],
                  orderId: lowfySubscription.id,
                  eventSourceUrl: getAppUrl('/'),
                  // 📊 EMQ Parameters - Boost Event Match Quality score
                  clientIpAddress: emqData.clientIpAddress || undefined,
                  clientUserAgent: emqData.clientUserAgent || undefined,
                  fbc: emqData.fbc || undefined,
                  fbp: emqData.fbp || undefined,
                });
                logger.info(`[Asaas-Subscriptions Webhook] ✅ Facebook Purchase event enviado: ${email} (userId: ${lowfySubscription.userId || 'guest'}, EMQ: ${emqData.clientIpAddress ? 'yes' : 'no'})`);
              }
            } catch (fbError: any) {
              logger.warn(`[Asaas-Subscriptions Webhook] ⚠️ Falha ao enviar evento Facebook:`, fbError.message);
            }

            // Process referral commission if referralCode exists
            if (lowfySubscription.referralCode && lowfySubscription.userId) {
              try {
                const referralCodeRecord = await storage.getReferralCodeByCode(lowfySubscription.referralCode);
                
                if (referralCodeRecord && referralCodeRecord.userId !== lowfySubscription.userId) {
                  // Calculate 50% commission
                  const commissionPercentage = 50;
                  const commissionAmountCents = Math.floor(lowfySubscription.amount * commissionPercentage / 100);
                  
                  await storage.createReferralCommission({
                    referrerId: referralCodeRecord.userId,
                    referredUserId: lowfySubscription.userId,
                    subscriptionId: lowfySubscription.id,
                    subscriptionAmountCents: lowfySubscription.amount,
                    commissionPercentage,
                    commissionAmountCents,
                    status: 'pending',
                    type: 'subscription',
                    metadata: { 
                      provider: 'asaas',
                      plan: lowfySubscription.plan,
                      current_period: 1,
                    },
                  });
                  
                  logger.debug(`[Asaas-Subscriptions Webhook] ✅ Referral commission created`, {
                    referrerId: referralCodeRecord.userId,
                    referredUserId: lowfySubscription.userId,
                    commissionAmountCents,
                  });

                  // Send referral success email to the affiliate/referrer
                  setImmediate(async () => {
                    try {
                      const [referrer] = await db
                        .select()
                        .from(users)
                        .where(eq(users.id, referralCodeRecord.userId))
                        .limit(1);
                      
                      const [referredUser] = await db
                        .select()
                        .from(users)
                        .where(eq(users.id, lowfySubscription.userId))
                        .limit(1);

                      if (referrer && referredUser) {
                        const referralHtml = generateReferralSuccessEmail(
                          referrer.name,
                          referredUser.name,
                          commissionAmountCents / 100
                        );
                        await sendEmail({
                          to: referrer.email,
                          subject: '🎉 Comissão de Indicação Recebida - Lowfy',
                          html: referralHtml,
                        });
                        logger.debug(`[Asaas-Subscriptions Webhook] ✅ Referral success email sent to: ${referrer.email}`);
                      }
                    } catch (emailError) {
                      logger.error('[Asaas-Subscriptions Webhook] ❌ Failed to send referral success email:', emailError);
                    }
                  });
                }
              } catch (refError) {
                logger.error(`[Asaas-Subscriptions Webhook] ❌ Error creating referral commission:`, refError);
              }
            }

            // Send activation email with link to create password
            if (lowfySubscription.activationToken) {
              try {
                const emailHtml = generateSubscriptionActivationEmail(
                  lowfySubscription.buyerName,
                  lowfySubscription.buyerEmail,
                  lowfySubscription.activationToken,
                  lowfySubscription.plan as 'mensal' | 'anual',
                  lowfySubscription.amount / 100,
                  lowfySubscription.paymentMethod as 'credit_card' | 'pix'
                );
                await sendEmail({
                  to: lowfySubscription.buyerEmail,
                  subject: '🎉 Pagamento Confirmado - Ative sua Conta Lowfy',
                  html: emailHtml,
                });
                logger.debug(`[Asaas-Subscriptions Webhook] ✅ Activation email sent to: ${lowfySubscription.buyerEmail}`);
              } catch (emailError) {
                logger.error(`[Asaas-Subscriptions Webhook] ❌ Failed to send activation email:`, emailError);
              }
            }

          } else if (event === 'PAYMENT_REFUNDED') {
            const paymentId = payment?.id;
            const subscriptionId = payment?.subscription;

            logger.debug(`[Asaas-Subscriptions Webhook] 🔄 Payment refunded`, { paymentId, subscriptionId });

            let lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(paymentId);
            if (!lowfySubscription && subscriptionId) {
              lowfySubscription = await storage.getLowfySubscriptionByProviderSubscriptionId(subscriptionId);
            }

            if (lowfySubscription) {
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'refunded',
                webhookData: { ...webhookData, processedAt: receivedAt },
              });

              // Update user status if linked
              if (lowfySubscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionStatus: 'canceled',
                    accountStatus: 'pending',
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, lowfySubscription.userId));

                // Reverse affiliate commissions for refunded subscriptions
                try {
                  await storage.cancelReferralCommissionsForUser(lowfySubscription.userId, lowfySubscription.id);
                  logger.debug(`[Asaas-Subscriptions Webhook] ✅ Affiliate commissions reversed for refund`);
                } catch (commissionError) {
                  logger.error(`[Asaas-Subscriptions Webhook] ❌ Error reversing affiliate commissions:`, commissionError);
                }
              }

              // Update refund request status if exists
              const refundRequest = await storage.getSubscriptionRefundRequestBySubscriptionId(lowfySubscription.id);
              if (refundRequest && refundRequest.status !== 'completed') {
                await storage.updateSubscriptionRefundRequest(refundRequest.id, {
                  status: 'completed',
                  refundedViaProvider: true,
                  processedAt: new Date(),
                });
                logger.debug(`[Asaas-Subscriptions Webhook] ✅ Refund request ${refundRequest.id} marked as completed`);

                // Send refund completed email
                try {
                  const { generateRefundCompletedEmail } = await import('./email');
                  const emailHtml = generateRefundCompletedEmail(
                    lowfySubscription.buyerName,
                    (lowfySubscription.amount) / 100,
                    lowfySubscription.paymentMethod || 'credit_card'
                  );
                  await sendEmail({
                    to: lowfySubscription.buyerEmail,
                    subject: '💸 Reembolso Processado - Lowfy',
                    html: emailHtml,
                  });
                  logger.debug(`[Asaas-Subscriptions Webhook] ✅ Refund completed email sent to: ${lowfySubscription.buyerEmail}`);
                } catch (emailError) {
                  logger.error(`[Asaas-Subscriptions Webhook] ❌ Failed to send refund completed email:`, emailError);
                }
              }

              logger.debug(`[Asaas-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} marked as refunded`);
            }

          } else if (event === 'PAYMENT_OVERDUE') {
            const paymentId = payment?.id;
            const subscriptionId = payment?.subscription;

            logger.debug(`[Asaas-Subscriptions Webhook] ⚠️ Payment overdue`, { paymentId, subscriptionId });

            let lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(paymentId);
            if (!lowfySubscription && subscriptionId) {
              lowfySubscription = await storage.getLowfySubscriptionByProviderSubscriptionId(subscriptionId);
            }

            if (lowfySubscription) {
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'expired',
                webhookData: { ...webhookData, processedAt: receivedAt },
              });

              // Send renewal failed email
              try {
                const emailHtml = generateSubscriptionRenewalFailedEmail(lowfySubscription.buyerName);
                await sendEmail({
                  to: lowfySubscription.buyerEmail,
                  subject: '⚠️ Problema no Pagamento da Assinatura - Lowfy',
                  html: emailHtml,
                });
                logger.debug(`[Asaas-Subscriptions Webhook] ✅ Payment failure email sent to: ${lowfySubscription.buyerEmail}`);
              } catch (emailError) {
                logger.error(`[Asaas-Subscriptions Webhook] ❌ Failed to send payment failure email:`, emailError);
              }

              logger.debug(`[Asaas-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} marked as expired (overdue)`);
            }

          // SUBSCRIPTION EVENTS (Asaas subscription lifecycle)
          } else if (subscription && event.startsWith('SUBSCRIPTION_')) {
            const subscriptionId = subscription.id;
            
            logger.debug(`[Asaas-Subscriptions Webhook] 📦 Subscription event: ${event}`, { subscriptionId });

            let lowfySubscription = await storage.getLowfySubscriptionByProviderSubscriptionId(subscriptionId);

            if (event === 'SUBSCRIPTION_CREATED') {
              logger.debug(`[Asaas-Subscriptions Webhook] ℹ️  Subscription created in Asaas: ${subscriptionId}`);
              // Just log - subscription should already exist from checkout
              
            } else if (event === 'SUBSCRIPTION_RENEWED' && lowfySubscription) {
              // Subscription renewed (recurring payment success)
              const currentPeriod = (lowfySubscription.currentPeriod || 1) + 1;
              const currentDate = new Date();
              const nextPaymentDate = lowfySubscription.plan === 'anual'
                ? addYears(currentDate, 1)
                : addMonths(currentDate, 1);

              await storage.updateLowfySubscription(lowfySubscription.id, {
                currentPeriod,
                nextPaymentDate,
                paidAt: new Date(),
                webhookData: { ...webhookData, processedAt: receivedAt },
              });

              // Update user expiration
              if (lowfySubscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionExpiresAt: nextPaymentDate,
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, lowfySubscription.userId));
              }

              // Send renewal confirmation email
              try {
                const emailHtml = generateSubscriptionRenewedEmail(
                  lowfySubscription.buyerName,
                  lowfySubscription.plan as 'mensal' | 'anual',
                  lowfySubscription.amount / 100,
                  currentPeriod,
                  nextPaymentDate.toISOString()
                );
                await sendEmail({
                  to: lowfySubscription.buyerEmail,
                  subject: '✅ Assinatura Renovada - Lowfy',
                  html: emailHtml,
                });
                logger.debug(`[Asaas-Subscriptions Webhook] ✅ Renewal email sent to: ${lowfySubscription.buyerEmail}`);
              } catch (emailError) {
                logger.error(`[Asaas-Subscriptions Webhook] ❌ Failed to send renewal email:`, emailError);
              }

              logger.debug(`[Asaas-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} renewed to period ${currentPeriod}`);

            } else if (event === 'SUBSCRIPTION_CANCELED' && lowfySubscription) {
              // Subscription canceled
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'canceled',
                canceledAt: new Date(),
                webhookData: { ...webhookData, processedAt: receivedAt },
              });

              // Update user status
              if (lowfySubscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionStatus: 'canceled',
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, lowfySubscription.userId));
              }

              // Send cancellation email
              try {
                const accessUntilDate = lowfySubscription.nextPaymentDate?.toISOString() || new Date().toISOString();
                const emailHtml = generateSubscriptionCanceledEmail(lowfySubscription.buyerName, accessUntilDate);
                await sendEmail({
                  to: lowfySubscription.buyerEmail,
                  subject: 'ℹ️ Assinatura Cancelada - Lowfy',
                  html: emailHtml,
                });
                logger.debug(`[Asaas-Subscriptions Webhook] ✅ Cancellation email sent to: ${lowfySubscription.buyerEmail}`);
              } catch (emailError) {
                logger.error(`[Asaas-Subscriptions Webhook] ❌ Failed to send cancellation email:`, emailError);
              }

              logger.debug(`[Asaas-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} canceled`);

            } else if (event === 'SUBSCRIPTION_AWAITING_PAYMENT' && lowfySubscription) {
              // Awaiting payment
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'awaiting_payment',
                webhookData: { ...webhookData, processedAt: receivedAt },
              });
              
              logger.debug(`[Asaas-Subscriptions Webhook] ℹ️  Subscription ${lowfySubscription.id} awaiting payment`);
            }

          } else {
            logger.debug(`[Asaas-Subscriptions Webhook] ℹ️  Unhandled event: ${event}`);
          }

        } catch (processingError: any) {
          logger.error('[Asaas-Subscriptions Webhook] ❌ Background processing error:', {
            message: processingError.message,
            stack: processingError.stack,
          });
        }
      });

    } catch (error: any) {
      logger.error('[Asaas-Subscriptions Webhook] ❌ Error:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // Webhook PodPay para assinaturas Lowfy via PIX (SEPARADO do webhook do marketplace)
  app.post('/api/webhooks/podpay-subscriptions', async (req, res) => {
    const postbackData = req.body;
    const receivedAt = new Date().toISOString();

    logger.debug('[PodPay-Subscriptions Webhook] Request received:', {
      type: postbackData?.type,
      transactionId: postbackData?.data?.id,
      status: postbackData?.data?.status,
      receivedAt,
    });

    try {
      // CRITICAL SECURITY: Validate webhook authentication
      // PodPay sends x-podpay-secret header for subscriptions
      const podpaySecret = req.headers['x-podpay-secret'] as string;
      const expectedSecret = process.env.PODPAY_SUBSCRIPTION_WEBHOOK_SECRET;

      // Fallback: Also accept Basic Auth like the marketplace webhook
      let isAuthenticated = false;
      
      if (expectedSecret && podpaySecret === expectedSecret) {
        isAuthenticated = true;
        logger.debug('[PodPay-Subscriptions Webhook] ✅ Authenticated via x-podpay-secret header');
      }

      // Fallback to Basic Auth
      if (!isAuthenticated) {
        const authHeader = req.headers['authorization'] as string;
        if (authHeader?.startsWith('Basic ')) {
          const base64Credentials = authHeader.split(' ')[1];
          const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
          const [username, password] = credentials.split(':');
          
          if (username === process.env.PODPAY_PUBLIC_KEY && password === process.env.PODPAY_SECRET_KEY) {
            isAuthenticated = true;
            logger.debug('[PodPay-Subscriptions Webhook] ✅ Authenticated via Basic Auth');
          }
        }
      }

      // Development fallback
      if (!isAuthenticated && process.env.NODE_ENV === 'development') {
        if (postbackData?.type && postbackData?.data?.id) {
          isAuthenticated = true;
          logger.warn('[PodPay-Subscriptions Webhook] ⚠️  Accepting without auth in DEVELOPMENT mode');
        }
      }

      if (!isAuthenticated) {
        logger.error('[PodPay-Subscriptions Webhook] ❌ Authentication failed');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Validate payload structure
      if (!postbackData.type || !postbackData.data) {
        logger.error('[PodPay-Subscriptions Webhook] ❌ Invalid payload structure');
        return res.status(400).json({ message: 'Invalid postback structure' });
      }

      const { type, data } = postbackData;

      // Respond 200 immediately
      res.status(200).json({ received: true });

      // Process in background
      setImmediate(async () => {
        try {
          if (type === 'transaction') {
            const transactionId = data.id?.toString();
            const status = data.status;
            const externalRef = data.externalRef;

            logger.debug(`[PodPay-Subscriptions Webhook] Transaction ${transactionId} - Status: ${status}`);

            // Find subscription by transaction ID or external reference
            let lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(transactionId);

            if (!lowfySubscription && externalRef) {
              // Try to find by externalRef (which might be the subscription ID)
              lowfySubscription = await storage.getLowfySubscriptionByProviderSubscriptionId(externalRef);
            }

            if (!lowfySubscription) {
              logger.warn(`[PodPay-Subscriptions Webhook] No subscription found for transaction ${transactionId}`);
              return;
            }

            // Process based on status
            if (status === 'paid' || status === 'authorized') {
              // IDEMPOTENCY: Skip if already active
              if (lowfySubscription.status === 'active' && lowfySubscription.paidAt) {
                logger.debug(`[PodPay-Subscriptions Webhook] ℹ️  Subscription ${lowfySubscription.id} already processed (idempotent)`);
                return;
              }

              // Calculate next payment date based on plan (UTC)
              const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
              const nextPaymentDate = lowfySubscription.plan === 'anual'
                ? addYears(paidAt, 1)
                : addMonths(paidAt, 1);

              // Update subscription
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'active',
                paidAt,
                nextPaymentDate,
                webhookData: { ...postbackData, processedAt: receivedAt },
              });

              logger.debug(`[PodPay-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} activated`, {
                buyerEmail: lowfySubscription.buyerEmail,
                plan: lowfySubscription.plan,
                nextPaymentDate: nextPaymentDate.toISOString(),
              });

              // CRITICAL: Create provisional user if not linked yet (improves Meta External ID coverage)
              if (!lowfySubscription.userId) {
                try {
                  const createdUserId = await createProvisionalUserOnPaymentGlobal(lowfySubscription, nextPaymentDate);
                  if (createdUserId) {
                    logger.info(`[PodPay-Subscriptions Webhook] ✅ Provisional user created for guest checkout:`, {
                      userId: createdUserId,
                      email: lowfySubscription.buyerEmail,
                    });
                    // Refresh subscription data with new userId
                    lowfySubscription = await storage.getLowfySubscriptionByProviderTransactionId(transactionId) || lowfySubscription;
                  }
                } catch (userError: any) {
                  logger.warn(`[PodPay-Subscriptions Webhook] ⚠️ Failed to create provisional user:`, userError.message);
                  // Don't fail webhook if user creation fails
                }
              }

              // Update user status if linked
              if (lowfySubscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionStatus: 'active',
                    subscriptionExpiresAt: nextPaymentDate,
                    accountStatus: 'active',
                    accessPlan: 'full', // Assinatura ativa = acesso completo
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, lowfySubscription.userId));
                
                logger.debug(`[PodPay-Subscriptions Webhook] ✅ User ${lowfySubscription.userId} subscription updated with full access`);
              }

              // Process referral commission if referralCode exists
              if (lowfySubscription.referralCode && lowfySubscription.userId) {
                try {
                  const referralCodeRecord = await storage.getReferralCodeByCode(lowfySubscription.referralCode);
                  
                  if (referralCodeRecord && referralCodeRecord.userId !== lowfySubscription.userId) {
                    // Calculate 50% commission
                    const commissionPercentage = 50;
                    const commissionAmountCents = Math.floor(lowfySubscription.amount * commissionPercentage / 100);
                    
                    await storage.createReferralCommission({
                      referrerId: referralCodeRecord.userId,
                      referredUserId: lowfySubscription.userId,
                      subscriptionId: lowfySubscription.id,
                      subscriptionAmountCents: lowfySubscription.amount,
                      commissionPercentage,
                      commissionAmountCents,
                      status: 'pending',
                      type: 'subscription',
                      metadata: { 
                        provider: 'podpay',
                        plan: lowfySubscription.plan,
                        current_period: 1,
                      },
                    });
                    
                    logger.debug(`[PodPay-Subscriptions Webhook] ✅ Referral commission created`, {
                      referrerId: referralCodeRecord.userId,
                      referredUserId: lowfySubscription.userId,
                      commissionAmountCents,
                    });

                    // Send referral success email to the affiliate/referrer
                    setImmediate(async () => {
                      try {
                        const [referrer] = await db
                          .select()
                          .from(users)
                          .where(eq(users.id, referralCodeRecord.userId))
                          .limit(1);
                        
                        const [referredUser] = await db
                          .select()
                          .from(users)
                          .where(eq(users.id, lowfySubscription.userId))
                          .limit(1);

                        if (referrer && referredUser) {
                          const referralHtml = generateReferralSuccessEmail(
                            referrer.name,
                            referredUser.name,
                            commissionAmountCents / 100
                          );
                          await sendEmail({
                            to: referrer.email,
                            subject: '🎉 Comissão de Indicação Recebida - Lowfy',
                            html: referralHtml,
                          });
                          logger.debug(`[PodPay-Subscriptions Webhook] ✅ Referral success email sent to: ${referrer.email}`);
                        }
                      } catch (emailError) {
                        logger.error('[PodPay-Subscriptions Webhook] ❌ Failed to send referral success email:', emailError);
                      }
                    });
                  }
                } catch (refError) {
                  logger.error(`[PodPay-Subscriptions Webhook] ❌ Error creating referral commission:`, refError);
                }
              }

              // Send activation email
              if (lowfySubscription.activationToken) {
                try {
                  const emailHtml = generateSubscriptionActivationEmail(
                    lowfySubscription.buyerName,
                    lowfySubscription.buyerEmail,
                    lowfySubscription.activationToken,
                    lowfySubscription.plan as 'mensal' | 'anual',
                    lowfySubscription.amount / 100,
                    'pix'
                  );
                  await sendEmail({
                    to: lowfySubscription.buyerEmail,
                    subject: '🎉 Pagamento PIX Confirmado - Ative sua Conta Lowfy',
                    html: emailHtml,
                  });
                  logger.debug(`[PodPay-Subscriptions Webhook] ✅ Activation email sent to: ${lowfySubscription.buyerEmail}`);
                } catch (emailError) {
                  logger.error(`[PodPay-Subscriptions Webhook] ❌ Failed to send activation email:`, emailError);
                }
              }

              // Emit socket event for real-time UI update
              if (io && lowfySubscription.userId) {
                io.to(`user:${lowfySubscription.userId}`).emit('subscription_activated', {
                  subscriptionId: lowfySubscription.id,
                  status: 'active',
                });
              }

            } else if (status === 'refunded') {
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'refunded',
                webhookData: { ...postbackData, processedAt: receivedAt },
              });

              // Update user status if linked
              if (lowfySubscription.userId) {
                await db
                  .update(users)
                  .set({
                    subscriptionStatus: 'canceled',
                    accountStatus: 'pending',
                    updatedAt: new Date(),
                  })
                  .where(eq(users.id, lowfySubscription.userId));
              }

              logger.debug(`[PodPay-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} marked as refunded`);

            } else if (status === 'expired' || status === 'cancelled') {
              await storage.updateLowfySubscription(lowfySubscription.id, {
                status: 'expired',
                webhookData: { ...postbackData, processedAt: receivedAt },
              });

              logger.debug(`[PodPay-Subscriptions Webhook] ✅ Subscription ${lowfySubscription.id} marked as expired`);

            } else {
              logger.debug(`[PodPay-Subscriptions Webhook] ℹ️  Unhandled status: ${status}`);
            }

          } else {
            logger.debug(`[PodPay-Subscriptions Webhook] ℹ️  Unhandled type: ${type}`);
          }

        } catch (processingError: any) {
          logger.error('[PodPay-Subscriptions Webhook] ❌ Background processing error:', {
            message: processingError.message,
            stack: processingError.stack,
          });
        }
      });

    } catch (error: any) {
      logger.error('[PodPay-Subscriptions Webhook] ❌ Error:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  // ==================== REMOVED: CAKTO FUNCTIONALITY ====================
  // Cakto integration removed - now using Lowfy internal subscription system

  // ==================== CATEGORY ROUTES ====================

  app.get('/api/categories', async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      const etag = generateETag(categories);
      
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('ETag', etag);
      
      // Verificar If-None-Match
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // ==================== LANGUAGE ROUTES ====================

  app.get('/api/languages', async (_req, res) => {
    try {
      const languages = await storage.getLanguages();
      const etag = generateETag(languages);
      
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('ETag', etag);
      
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.json(languages);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).json({ message: "Failed to fetch languages" });
    }
  });

  app.post('/api/languages', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const languageData = insertLanguageSchema.parse(req.body);
      const language = await storage.createLanguage(languageData);
      res.status(201).json(language);
    } catch (error) {
      console.error("Error creating language:", error);
      res.status(500).json({ message: "Failed to create language" });
    }
  });

  // ==================== PLR ROUTES ====================

  app.get('/api/plrs', optionalAuthMiddleware, async (req: any, res) => {
    try {
      const {categoryId, search, onlyPurchased, limit, offset } = req.query;
      let parsedLimit = limit ? parseInt(limit as string) : 50;
      let parsedOffset = offset ? parseInt(offset as string) : 0;
      
      // Controle de acesso: determinar se usuário tem acesso completo aos PLRs
      const user = req.user;
      
      // Debug: Log user access info
      if (user) {
        logger.debug(`[PLRs] User ${user.id} accessing PLRs - accessPlan: ${user.accessPlan}, subscriptionStatus: ${user.subscriptionStatus}, isAdmin: ${user.isAdmin}`);
      } else {
        logger.debug(`[PLRs] Anonymous user accessing PLRs`);
      }
      
      // Usuários com accessPlan 'basic' ou 'full' têm acesso a todos os PLRs
      // Admins também têm acesso total
      // Usuários com subscriptionStatus 'active' (assinatura ativa) têm acesso total
      const hasFullAccess = user && (
        user.isAdmin ||
        user.accessPlan === 'full' ||
        user.accessPlan === 'basic' ||
        user.subscriptionStatus === 'active'
      );
      
      // Apenas usuários sem acesso pago são limitados (trial/free)
      const isTrialUser = user && !hasFullAccess && (user.subscriptionStatus === 'trial' || user.subscriptionStatus === 'none');
      
      if (isTrialUser) {
        // SEGURANÇA: Forçar offset=0 e limit=3 para usuários trial/free
        // Isso previne bypass via manipulação de URL (/api/plrs?offset=3)
        parsedOffset = 0;
        parsedLimit = 3;
      }
      
      const result = await storage.getPLRs({
        categoryId: categoryId as string,
        search: search as string,
        userId: req.user?.id,
        onlyPurchased: onlyPurchased === 'true',
        limit: parsedLimit,
        offset: parsedOffset,
      });
      
      // Garantir que languageId esteja presente em cada download
      const plrsWithLanguageIds = result.data.map(plr => ({
        ...plr,
        downloads: plr.downloads?.map(download => ({
          ...download,
          languageId: download.languageId || download.language?.id
        }))
      }));
      
      // Calculate page number
      const page = parsedLimit > 0 ? Math.floor(parsedOffset / parsedLimit) + 1 : 1;
      
      const responseData = {
        data: plrsWithLanguageIds,
        total: isTrialUser ? Math.min(result.total, 3) : result.total,
        page,
        limit: parsedLimit,
        isTrial: isTrialUser || false,
      };
      
      const etag = generateETag(responseData);
      
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.setHeader('Vary', 'Cookie');
      res.setHeader('ETag', etag);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching PLRs:", error);
      res.status(500).json({ message: "Failed to fetch PLRs" });
    }
  });

  app.get('/api/plrs/:id', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const plr = await storage.getPLRById(req.params.id, req.user?.id);
      if (!plr) {
        return res.status(404).json({ message: "PLR not found" });
      }
      res.json(plr);
    } catch (error) {
      console.error("Error fetching PLR:", error);
      res.status(500).json({ message: "Failed to fetch PLR" });
    }
  });

  app.post('/api/plrs', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const plrData = insertPLRSchema.parse(req.body);
      const plr = await storage.createPLR(plrData);
      res.status(201).json(plr);
    } catch (error) {
      console.error("Error creating PLR:", error);
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        return res.status(400).json({
          message: `Erro de validação: ${firstError.message}`,
          field: firstError.path.join('.'),
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Failed to create PLR" });
    }
  });

  // PLR Tags
  app.get('/api/plr-tags', async (_req, res) => {
    try {
      const tags = await storage.getPLRTags();
      const etag = generateETag(tags);
      
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
      res.setHeader('ETag', etag);
      
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      res.json(tags);
    } catch (error) {
      console.error("Error fetching PLR tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // PLR Likes
  app.post('/api/plrs/:id/like', authMiddleware, async (req: any, res) => {
    try {
      await storage.togglePLRLike(req.params.id, req.user.id);
      const plr = await storage.getPLRById(req.params.id, req.user.id);
      res.json(plr);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // PLR Bulk Tags
  app.post('/api/plrs/bulk/tags', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { plrId, tagIds } = req.body;
      await storage.addTagsToPLR(plrId, tagIds);
      res.json({ message: "Tags added successfully" });
    } catch (error) {
      console.error("Error adding tags:", error);
      res.status(500).json({ message: "Failed to add tags" });
    }
  });

  app.delete('/api/plrs/:id/tags', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.removeTagsFromPLR(req.params.id);
      res.json({ message: "Tags removed successfully" });
    } catch (error) {
      console.error("Error removing tags:", error);
      res.status(500).json({ message: "Failed to remove tags" });
    }
  });

  // PLR Bulk Downloads
  app.post('/api/plrs/bulk/downloads', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { plrId, type, languageId, fileUrl } = req.body;

      if (!plrId || !type || !languageId || !fileUrl) {
        return res.status(400).json({
          message: "Missing required fields: plrId, type, languageId, and fileUrl are required"
        });
      }

      const download = await storage.addPLRDownload({
        plrId,
        type,
        languageId,
        fileUrl,
      });
      res.json(download);
    } catch (error) {
      console.error("Error adding download:", error);
      res.status(500).json({ message: "Failed to add download" });
    }
  });

  app.delete('/api/plrs/:id/downloads', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.deletePLRDownloadsByPLRId(req.params.id);
      res.json({ message: "Downloads removed successfully" });
    } catch (error) {
      console.error("Error removing downloads:", error);
      res.status(500).json({ message: "Failed to remove downloads" });
    }
  });

  // User's purchased PLRs
  app.get('/api/my-plrs', authMiddleware, async (req: any, res) => {
    try {
      const { purchased } = req.query;
      const plrs = await storage.getPLRsByUserId(req.user.id, purchased === 'true');
      res.json(plrs);
    } catch (error) {
      console.error("Error fetching user PLRs:", error);
      res.status(500).json({ message: "Failed to fetch PLRs" });
    }
  });

  // ==================== SERVICE ROUTES ====================

  app.get('/api/services', async (_req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post('/api/services', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put('/api/services/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(req.params.id, serviceData);
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // ==================== N8N AUTOMATION ROUTES ====================

  app.get('/api/n8n-automations', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
      const {category, search, limit, offset } = req.query;

      const automations = await storage.getN8nAutomations({
        category: category as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(automations);
    } catch (error) {
      console.error("Error fetching N8N automations:", error);
      res.status(500).json({ message: "Failed to fetch N8N automations" });
    }
  });

  app.get('/api/n8n-automations/categories', authMiddleware, subscriptionMiddleware, async (_req, res) => {
    try {
      const categories = await storage.getN8nCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching N8N categories:", error);
      res.status(500).json({ message: "Failed to fetch N8N categories" });
    }
  });

  app.get('/api/n8n-automations/:id', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
      const automation = await storage.getN8nAutomationById(req.params.id);

      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }

      res.json(automation);
    } catch (error) {
      console.error("Error fetching N8N automation:", error);
      res.status(500).json({ message: "Failed to fetch N8N automation" });
    }
  });

  // Rotas de admin
  app.post('/api/n8n-automations', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const data = insertN8nAutomationSchema.parse(req.body);
      const automation = await storage.createN8nAutomation(data);
      res.status(201).json(automation);
    } catch (error) {
      console.error("Error creating N8N automation:", error);
      res.status(500).json({ message: "Failed to create N8N automation" });
    }
  });

  app.put('/api/n8n-automations/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const data = req.body;
      const automation = await storage.updateN8nAutomation(req.params.id, data);
      res.json(automation);
    } catch (error) {
      console.error("Error updating N8N automation:", error);
      res.status(500).json({ message: "Failed to update N8N automation" });
    }
  });

  app.delete('/api/n8n-automations/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.deleteN8nAutomation(req.params.id);
      res.json({ message: "Automation deleted successfully" });
    } catch (error) {
      console.error("Error deleting N8N automation:", error);
      res.status(500).json({ message: "Failed to delete N8N automation" });
    }
  });

  // ==================== COURSE ROUTES ====================

  app.get('/api/courses', authMiddleware, subscriptionMiddleware, async (_req, res) => {
    try {
      const courses = await storage.getCourses();
      logger.debug(`📊 Total de cursos no banco: ${courses.length}`);
      res.set('Cache-Control', 'private, max-age=600');
      res.json(courses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  // ==================== QUIZ INTERATIVO ROUTES ====================

  app.get('/api/quiz-interativo/settings', authMiddleware, subscriptionMiddleware, async (_req, res) => {
    try {
      const settings = await storage.getQuizInterativoSettings();
      if (!settings) {
        return res.status(404).json({ message: "Quiz settings not found" });
      }
      res.set('Cache-Control', 'private, max-age=600');
      res.json(settings);
    } catch (error) {
      console.error("Error fetching quiz settings:", error);
      res.status(500).json({ message: "Failed to fetch quiz settings" });
    }
  });

  // ==================== SUPPORT TICKETS ROUTES ====================

  app.post('/api/support/tickets', authMiddleware, async (req: any, res) => {
    try {
      const ticketData = insertSupportTicketSchema.parse({
        ...req.body,
        userId: req.user?.id,
      });
      const newTicket = await storage.createSupportTicket(ticketData);
      
      const { sendSupportTicketNotifications } = await import('./email');
      sendSupportTicketNotifications(
        req.user.name,
        req.user.email,
        ticketData.subject,
        ticketData.message,
        newTicket.id,
        ticketData.priority || 'medium',
        process.env.ADMIN_EMAIL || 'suporte@lowfy.com.br'
      ).catch((err: Error) => {
        logger.error('Error sending support ticket notifications:', err);
      });
      
      res.status(201).json(newTicket);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating support ticket:", error);
      res.status(500).json({ message: "Falha ao criar ticket de suporte" });
    }
  });

  app.get('/api/support/tickets', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.user?.isAdmin ? undefined : req.user?.id;
      const tickets = await storage.getSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ message: "Falha ao buscar tickets de suporte" });
    }
  });

  // Admin routes for managing bug reports
  app.get('/api/admin/support-tickets', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const tickets = await storage.getSupportTickets(); // sem userId para pegar todos
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching admin support tickets:", error);
      res.status(500).json({ message: "Falha ao buscar tickets de suporte" });
    }
  });

  app.patch('/api/admin/support-tickets/:id/status', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status é obrigatório" });
      }
      const updatedTicket = await storage.updateSupportTicketStatus(req.params.id, status);
      if (!updatedTicket) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }
      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating support ticket status:", error);
      res.status(500).json({ message: "Falha ao atualizar ticket de suporte" });
    }
  });

  app.delete('/api/admin/support-tickets/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.deleteSupportTicket(req.params.id);
      res.json({ success: true, message: "Ticket removido com sucesso" });
    } catch (error) {
      console.error("Error deleting support ticket:", error);
      res.status(500).json({ message: "Falha ao remover ticket de suporte" });
    }
  });

  // Bug Report endpoint com envio de email ao admin
  app.post('/api/support/bug-report', authMiddleware, uploadBugAttachments.array('attachments', 3), async (req: any, res) => {
    try {
      const { message } = req.body;
      const files = req.files as Express.Multer.File[];
      
      if (!message || message.trim() === '') {
        return res.status(400).json({ message: "A descrição do bug é obrigatória" });
      }

      // Processar attachments - converter para data URL e salvar
      const attachments: Array<{
        id: string;
        url: string;
        type: 'image' | 'video';
        name: string;
        size: number;
      }> = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const mimeType = file.mimetype;
          const isImage = mimeType.startsWith('image/');
          const isVideo = mimeType.startsWith('video/');
          
          if (isImage || isVideo) {
            const base64Data = file.buffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            
            attachments.push({
              id: Math.random().toString(36).substr(2, 9),
              url: dataUrl,
              type: isImage ? 'image' : 'video',
              name: file.originalname,
              size: file.size,
            });
          }
        }
      }

      // Criar ticket de suporte com attachments
      const ticketData = {
        subject: "Bug Report",
        message: message,
        userId: req.user.id,
        email: req.user.email,
        name: req.user.name,
        attachments: attachments,
      };

      // Validar dados antes de salvar
      try {
        insertSupportTicketSchema.parse(ticketData);
      } catch (validationError: any) {
        logger.error("Bug report validation error:", {
          error: validationError.message,
          issues: validationError.issues,
          ticketData: { ...ticketData, attachments: ticketData.attachments?.length + ' files' },
        });
        return res.status(400).json({ 
          message: "Dados de ticket inválidos",
          details: validationError.issues?.map((i: any) => i.message).join(', ') || validationError.message
        });
      }

      const newTicket = await storage.createSupportTicket(ticketData);

      // Preparar anexos para exibição no email
      const attachmentsList = files && files.length > 0 
        ? files.map(f => `• ${f.originalname} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join('<br>')
        : 'Nenhum anexo';

      // Enviar email para o admin
      const adminEmail = 'jl.uli1996@gmail.com';
      try {
        await sendEmail({
          to: adminEmail,
          subject: `🐛 Novo Bug Report - ${req.user.name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                .info-box { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #dc2626; }
                .label { font-weight: bold; color: #1f2937; }
                .footer { text-align: center; padding: 15px; color: #6b7280; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🐛 Novo Bug Report</h1>
                </div>
                <div class="content">
                  <div class="info-box">
                    <p><span class="label">Usuário:</span> ${req.user.name}</p>
                    <p><span class="label">Email:</span> ${req.user.email}</p>
                    <p><span class="label">Data:</span> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  </div>
                  
                  <div class="info-box">
                    <p><span class="label">Descrição do Bug:</span></p>
                    <p style="white-space: pre-wrap;">${message}</p>
                  </div>
                  
                  <div class="info-box">
                    <p><span class="label">Anexos:</span></p>
                    <p>${attachmentsList}</p>
                  </div>
                </div>
                <div class="footer">
                  <p>Ticket ID: ${newTicket.id}</p>
                  <p>Este email foi gerado automaticamente pela plataforma Lowfy.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        });
        console.log('📧 [BUG REPORT] Email enviado para admin:', adminEmail);
      } catch (emailError) {
        console.error('❌ [BUG REPORT] Erro ao enviar email:', emailError);
        // Não falhar o request se o email não for enviado
      }

      res.status(201).json({ 
        success: true, 
        message: "Bug report enviado com sucesso",
        ticketId: newTicket.id 
      });
    } catch (error: any) {
      console.error("Error creating bug report:", error);
      res.status(500).json({ message: error.message || "Falha ao criar bug report" });
    }
  });

  // ==================== AI TOOLS ROUTES ====================

  app.get('/api/ai-tools', authMiddleware, subscriptionMiddleware, async (_req, res) => {
    try {
      const tools = await storage.getAITools();
      res.json(tools);
    } catch (error) {
      console.error("Error fetching AI tools:", error);
      res.status(500).json({ message: "Failed to fetch AI tools" });
    }
  });

  app.get('/api/admin/ai-tools', authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const tools = await storage.getAllAITools();
      res.json(tools);
    } catch (error) {
      console.error("Error fetching all AI tools:", error);
      res.status(500).json({ message: "Failed to fetch all AI tools" });
    }
  });

  app.post('/api/ai-tools', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const toolData = insertAIToolSchema.parse(req.body);
      const newTool = await storage.createAITool(toolData);
      res.status(201).json(newTool);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating AI tool:", error);
      res.status(500).json({ message: "Failed to create AI tool" });
    }
  });

  app.put('/api/ai-tools/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const toolData = insertAIToolSchema.partial().parse(req.body);
      const updatedTool = await storage.updateAITool(req.params.id, toolData);
      if (!updatedTool) {
        return res.status(404).json({ message: "AI tool not found" });
      }
      res.json(updatedTool);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating AI tool:", error);
      res.status(500).json({ message: "Failed to update AI tool" });
    }
  });

  app.delete('/api/ai-tools/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteAITool(req.params.id);
      res.json({ message: "AI tool deleted successfully" });
    } catch (error) {
      console.error("Error deleting AI tool:", error);
      res.status(500).json({ message: "Failed to delete AI tool" });
    }
  });

  // ==================== IMAGE PROXY ROUTE ====================
  // Proxy para evitar erros de CORS em logos de ferramentas
  app.get('/api/image-proxy', async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "URL da imagem é obrigatória" });
      }

      // Buscar a imagem da URL original
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      // Definir os headers corretos com cache mais agressivo
      const contentType = response.headers['content-type'] || 'image/png';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=604800, immutable'); // Cache de 7 dias, immutable
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Vary', 'Accept-Encoding');
      
      // Enviar a imagem
      res.send(Buffer.from(response.data));
    } catch (error: any) {
      console.error("Error proxying image:", error.message);
      res.status(404).json({ message: "Falha ao carregar imagem" });
    }
  });

  // ==================== GLOBAL AI ACCESS ROUTES ====================

  app.get('/api/global-ai-access', async (_req, res) => {
    try {
      const access = await storage.getGlobalAIAccess();
      res.json(access);
    } catch (error) {
      console.error("Error fetching global AI access:", error);
      res.status(500).json({ message: "Failed to fetch global AI access" });
    }
  });

  app.get('/api/admin/global-ai-access', authMiddleware, adminMiddleware, async (_req, res) => {
    try {
      const access = await storage.getAllGlobalAIAccess();
      res.json(access);
    } catch (error) {
      console.error("Error fetching all global AI access:", error);
      res.status(500).json({ message: "Failed to fetch all global AI access" });
    }
  });

  app.post('/api/global-ai-access', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const accessData = insertGlobalAIAccessSchema.parse(req.body);
      const newAccess = await storage.createGlobalAIAccess(accessData);
      res.status(201).json(newAccess);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating global AI access:", error);
      res.status(500).json({ message: "Failed to create global AI access" });
    }
  });

  app.put('/api/global-ai-access/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const accessData = insertGlobalAIAccessSchema.partial().parse(req.body);
      const updatedAccess = await storage.updateGlobalAIAccess(req.params.id, accessData);
      if (!updatedAccess) {
        return res.status(404).json({ message: "Global AI access not found" });
      }
      res.json(updatedAccess);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating global AI access:", error);
      res.status(500).json({ message: "Failed to update global AI access" });
    }
  });

  app.delete('/api/global-ai-access/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await storage.deleteGlobalAIAccess(req.params.id);
      res.json({ message: "Global AI access deleted successfully" });
    } catch (error) {
      console.error("Error deleting global AI access:", error);
      res.status(500).json({ message: "Failed to delete global AI access" });
    }
  });

  // ==================== USER ROUTES ====================

  app.get('/api/users/ranking', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const ranking = await storage.getWeeklyRanking(limit);
      res.json(ranking);
    } catch (error) {
      console.error("Error fetching ranking:", error);
      res.status(500).json({ message: "Erro ao buscar ranking" });
    }
  });

  app.get('/api/users/suggested-connections', authMiddleware, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const suggestions = await storage.getSuggestedConnections(req.user.id, limit);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching suggested connections:", error);
      res.status(500).json({ message: "Erro ao buscar sugestões de conexão" });
    }
  });

  app.get('/api/users/:id', authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==================== BADGES ROUTES ====================

  app.get('/api/badges', authMiddleware, async (_req, res) => {
    try {
      const badges = await storage.getAllBadges();
      res.json(badges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get('/api/users/:userId/badges', authMiddleware, async (req, res) => {
    try {
      const badges = await storage.getUserBadges(req.params.userId);
      res.json(badges);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  app.get('/api/users/:userId/points', authMiddleware, async (req, res) => {
    try {
      const points = await storage.getUserPoints(req.params.userId);
      res.json(points);
    } catch (error) {
      console.error("Error fetching user points:", error);
      res.status(500).json({ message: "Failed to fetch user points" });
    }
  });

  // Get user followers
  app.get('/api/users/:userId/followers', authMiddleware, async (req: any, res) => {
    try {
      const followers = await storage.getUserFollowers(req.params.userId);
      res.json(followers);
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Erro ao buscar seguidores" });
    }
  });

  // Get user following
  app.get('/api/users/:userId/following', authMiddleware, async (req: any, res) => {
    try {
      const following = await storage.getUserFollowing(req.params.userId);
      res.json(following);
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Erro ao buscar seguindo" });
    }
  });

  // Get user followers count
  app.get('/api/users/:userId/followers-count', authMiddleware, async (req: any, res) => {
    try {
      const followers = await storage.getUserFollowers(req.params.userId);
      res.json({ count: followers.length });
    } catch (error) {
      console.error("Error fetching followers count:", error);
      res.status(500).json({ message: "Erro ao buscar contagem de seguidores" });
    }
  });

  // Get user following count
  app.get('/api/users/:userId/following-count', authMiddleware, async (req: any, res) => {
    try {
      const following = await storage.getUserFollowing(req.params.userId);
      res.json({ count: following.length });
    } catch (error) {
      console.error("Error fetching following count:", error);
      res.status(500).json({ message: "Erro ao buscar contagem de seguindo" });
    }
  });

  // Get user posts (timeline posts)
  app.get('/api/users/:userId/posts', authMiddleware, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const posts = await storage.getUserPosts(req.params.userId, limit, offset);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching user posts:", error);
      res.status(500).json({ message: "Erro ao buscar posts do usuário" });
    }
  });

  // Get user forum topics
  app.get('/api/users/:userId/forum-topics', authMiddleware, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topics = await storage.getUserForumTopics(req.params.userId, limit);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching user forum topics:", error);
      res.status(500).json({ message: "Erro ao buscar discussões do usuário" });
    }
  });

  // Get user recent activities
  app.get('/api/users/:userId/recent-activities', authMiddleware, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await storage.getUserRecentActivities(req.params.userId, limit);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Erro ao buscar atividades recentes" });
    }
  });

  // Get user affiliate stats
  app.get('/api/users/:userId/affiliate-stats', authMiddleware, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      
      // Get referral code
      const [refCode] = await db
        .select({ code: referralCodes.code, conversions: referralCodes.conversions })
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1);
      
      // Get wallet data
      const [wallet] = await db
        .select({
          activeReferrals: referralWallet.activeReferrals,
          totalEarned: referralWallet.totalEarned,
          totalWithdrawn: referralWallet.totalWithdrawn,
        })
        .from(referralWallet)
        .where(eq(referralWallet.userId, userId))
        .limit(1);
      
      // Get active commissions
      const activeComm = await db
        .select({ amount: referralCommissions.commissionAmountCents })
        .from(referralCommissions)
        .where(and(
          eq(referralCommissions.referrerId, userId),
          eq(referralCommissions.status, 'active')
        ));
      
      const totalActive = activeComm.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      // Get pending commissions
      const pendingComm = await db
        .select({ amount: referralCommissions.commissionAmountCents })
        .from(referralCommissions)
        .where(and(
          eq(referralCommissions.referrerId, userId),
          eq(referralCommissions.status, 'pending')
        ));
      
      const totalPending = pendingComm.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      
      res.json({
        referralCode: refCode?.code || null,
        conversions: refCode?.conversions || 0,
        activeReferrals: wallet?.activeReferrals || 0,
        totalEarned: wallet?.totalEarned || 0,
        totalWithdrawn: wallet?.totalWithdrawn || 0,
        activeCommissions: totalActive,
        pendingCommissions: totalPending,
      });
    } catch (error) {
      console.error("Error fetching affiliate stats:", error);
      res.json({
        referralCode: null,
        conversions: 0,
        activeReferrals: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        activeCommissions: 0,
        pendingCommissions: 0,
      });
    }
  });

  // Check if current user is following another user
  app.get('/api/users/:userId/is-following', authMiddleware, async (req: any, res) => {
    try {
      const isFollowing = await storage.isFollowing(req.user.id, req.params.userId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking following status:", error);
      res.status(500).json({ message: "Erro ao verificar status de seguidor" });
    }
  });

  app.post('/api/users/:id/follow', authMiddleware, async (req: any, res) => {
    try {
      const followingId = req.params.id;
      const followerId = req.user.id;

      if (followerId === followingId) {
        return res.status(400).json({ message: "Você não pode seguir a si mesmo" });
      }

      const alreadyFollowing = await storage.isFollowing(followerId, followingId);
      if (alreadyFollowing) {
        return res.json({ alreadyFollowing: true, message: "Você já segue este usuário" });
      }

      await storage.followUser(followerId, followingId);

      // Award points for following someone
      await storage.updateUserPointsForAction(req.user.id, 'follow_given');

      // Create notification for the followed user
      const follower = await storage.getUser(followerId);
      if (follower) {
        const notificationId = await storage.createNotification({
          userId: followingId,
          type: 'follow',
          actorId: followerId,
          message: `${follower.name} começou a seguir você`,
        });

        // Emit real-time notification via Socket.IO
        await emitNotificationToUser(followingId, notificationId.id);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Erro ao seguir usuário" });
    }
  });

  app.delete('/api/users/:id/follow', authMiddleware, async (req: any, res) => {
    try {
      const followingId = req.params.id;
      const followerId = req.user.id;

      await storage.unfollowUser(followerId, followingId);
      
      // Invalidate related queries to refresh UI
      // (Notifications not sent for unfollow as per UX)
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Erro ao deixar de seguir usuário" });
    }
  });

  // ==================== TIMELINE ROUTES ====================

  app.get('/api/timeline/posts', authMiddleware, async (req: any, res) => {
    try {
      const feedType = req.query.feedType || 'feed';
      const category = req.query.category;
      const tag = req.query.tag;
      const filter = 'recent';
      const limit = parseInt(req.query.limit || '8');
      const offset = parseInt(req.query.offset || '0');

      let posts;

      if (feedType === 'following') {
        // Posts de pessoas que o usuário segue
        posts = await storage.getFollowingPosts(req.user.id, limit, offset);
      } else if (feedType === 'myposts') {
        // Apenas posts do próprio usuário (postados e compartilhados)
        posts = await storage.getUserPosts(req.user.id, limit, offset);
      } else {
        // Feed geral com filtro de categoria ou tag opcional
        posts = await storage.getTimelinePosts(filter, req.user.id, limit, offset, category, tag);
      }

      res.json(posts);
    } catch (error) {
      console.error("Error fetching timeline posts:", error);
      res.status(500).json({ message: "Erro ao buscar posts" });
    }
  });

  app.post('/api/timeline/posts', authMiddleware, upload.array('media', 5), async (req: any, res) => {
    try {
      const { content, videoLink, tags } = req.body;
      const files = req.files as Express.Multer.File[];

      // Extrair hashtags automaticamente do conteúdo (suporta acentuação)
      const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
      const extractedHashtags: string[] = [];
      let match;
      while ((match = hashtagRegex.exec(content || '')) !== null) {
        const tag = match[1].toLowerCase();
        if (!extractedHashtags.includes(tag)) {
          extractedHashtags.push(tag);
        }
      }

      // Combinar tags manuais (se houver) com tags extraídas
      const parsedTags = tags ? JSON.parse(tags) : [];
      const allTags = [...new Set([...parsedTags, ...extractedHashtags])];

      // Salvar arquivos no sistema de arquivos
      const media: Array<{ type: 'image' | 'video' | 'document'; url: string; name: string; size: number }> = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const isImage = file.mimetype.startsWith('image/');
          const isVideo = file.mimetype.startsWith('video/');
          const isDocument = !isImage && !isVideo;

          let folder = 'files';
          let fileType: 'image' | 'video' | 'document' = 'document';

          if (isImage) {
            folder = 'images';
            fileType = 'image';
          } else if (isVideo) {
            folder = 'videos';
            fileType = 'video';
          } else {
            folder = 'documents';
            fileType = 'document';
          }

          // Get extension from originalname or fallback to mimetype
          let extension = file.originalname.split('.').pop() || 'bin';
          
          // If extension is invalid (like 'blob'), derive from mimetype
          const validImageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
          const validVideoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
          const validDocExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'];
          const allValidExts = [...validImageExts, ...validVideoExts, ...validDocExts];
          
          if (!allValidExts.includes(extension.toLowerCase())) {
            // Map mimetype to extension
            const mimeToExt: Record<string, string> = {
              'image/png': 'png',
              'image/jpeg': 'jpg',
              'image/jpg': 'jpg',
              'image/gif': 'gif',
              'image/webp': 'webp',
              'image/svg+xml': 'svg',
              'image/bmp': 'bmp',
              'video/mp4': 'mp4',
              'video/webm': 'webm',
              'video/quicktime': 'mov',
              'application/pdf': 'pdf',
              'application/zip': 'zip',
            };
            extension = mimeToExt[file.mimetype] || 'bin';
          }
          
          // Upload to Object Storage for persistence in production
          const { ObjectStorageService } = await import('./objectStorage');
          const objectStorageService = new ObjectStorageService();

          let fileBuffer = file.buffer;
          let finalMimetype = file.mimetype;
          let finalSize = file.size;
          let finalExtension = extension;

          // Optimize images to WebP
          if (file.mimetype.startsWith('image/')) {
            fileBuffer = await sharp(file.buffer)
              .resize(2560, 2560, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .webp({ quality: 85 })
              .toBuffer();
            finalMimetype = 'image/webp';
            finalSize = fileBuffer.length;
            finalExtension = 'webp';
          }

          const fileUrl = await objectStorageService.uploadBuffer(fileBuffer, folder, finalMimetype, finalExtension);

          media.push({
            type: fileType,
            url: fileUrl,
            name: file.originalname,
            size: finalSize,
          });
        }
      }

      const post = await storage.createTimelinePost({
        userId: req.user.id,
        content,
        media: media.length > 0 ? media : undefined,
        videoLink: videoLink || undefined,
        tags: allTags,
      });

      await storage.updateUserPointsForAction(req.user.id, 'post_created');

      const challenges = await storage.getActiveWeeklyChallenges();
      for (const challenge of challenges) {
        const progress = await storage.getUserWeeklyProgress(req.user.id, challenge.id);
        if (progress) {
          io.emit('weekly_challenge_progress', {
            userId: req.user.id,
            challengeId: challenge.id,
            currentProgress: progress.currentProgress,
          });
        }
      }

      io.emit('new_post', {
        ...post,
        author: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          profileImageUrl: req.user.profileImageUrl,
          profession: req.user.profession,
        },
        comments: [],
        tags: [],
        hasLiked: false,
        hasDisliked: false,
        hasShared: false,
      });

      io.emit('gamification_update', {
        userId: req.user.id,
        action: 'post_created',
        points: 10,
      });

      res.json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Erro ao criar post" });
    }
  });

  app.post('/api/timeline/posts/:id/reactions', authMiddleware, async (req: any, res) => {
    try {
      const { type } = req.body;
      const postId = req.params.id;

      const result = await storage.togglePostReaction(postId, req.user.id, type);

      io.emit('post_reaction', {
        postId,
        likeDelta: result.likeDelta,
        dislikeDelta: result.dislikeDelta,
      });

      if (result.action === 'added') {
        await storage.updateUserPointsForAction(req.user.id, 'like_given');

        // Emitir notificação se for curtida e se foi criada
        if (type === 'like' && result.notificationId) {
          const post = await storage.getTimelinePost(postId, req.user.id);
          if (post && post.userId !== req.user.id) {
            await emitNotificationToUser(post.userId, result.notificationId);
          }
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Error toggling reaction:", error);
      res.status(500).json({ message: "Erro ao reagir ao post" });
    }
  });

  app.post('/api/timeline/posts/:id/share', authMiddleware, async (req: any, res) => {
    try {
      const { sharedWith, comment } = req.body;
      const postId = req.params.id;

      const share = await storage.sharePost({
        postId,
        userId: req.user.id,
        sharedWith,
        comment,
      });

      await storage.updateUserPointsForAction(req.user.id, 'share_given');

      io.emit('gamification_update', {
        userId: req.user.id,
        action: 'share_given',
        points: 5,
      });

      // Emitir notificação de compartilhamento em tempo real
      if (share.notificationId) {
        const post = await storage.getTimelinePost(postId, req.user.id);
        if (post && post.userId !== req.user.id) {
          await emitNotificationToUser(post.userId, share.notificationId);
        }
      }

      res.json(share);
    } catch (error) {
      console.error("Error sharing post:", error);
      res.status(500).json({ message: "Erro ao compartilhar post" });
    }
  });

  app.post('/api/timeline/posts/:id/comments', authMiddleware, async (req: any, res) => {
    try {
      const { content, parentCommentId } = req.body;
      const postId = req.params.id;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Conteúdo do comentário é obrigatório" });
      }

      // Verificar se o post existe
      const post = await storage.getTimelinePost(postId, req.user.id);
      if (!post) {
        return res.status(404).json({ message: "Post não encontrado" });
      }

      const comment = await storage.addPostComment({
        postId,
        userId: req.user.id,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      });

      await storage.updateUserPointsForAction(req.user.id, 'comment_created');

      const challenges = await storage.getActiveWeeklyChallenges();
      for (const challenge of challenges) {
        const progress = await storage.getUserWeeklyProgress(req.user.id, challenge.id);
        if (progress) {
          io.emit('weekly_challenge_progress', {
            userId: req.user.id,
            challengeId: challenge.id,
            currentProgress: progress.currentProgress,
          });
        }
      }

      const enrichedComment = {
        ...comment,
        author: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          profileImageUrl: req.user.profileImageUrl,
          profession: req.user.profession,
          areaAtuacao: req.user.areaAtuacao,
          badge: req.user.badge,
        },
        userHasLiked: false,
      };

      io.emit('new_comment', {
        postId,
        comment: enrichedComment,
      });

      io.emit('gamification_update', {
        userId: req.user.id,
        action: 'comment_created',
        points: 5,
      });

      // Emitir notificação em tempo real para o autor do post/comentário pai
      if (comment.notificationId) {
        const targetUserId = parentCommentId
          ? (await storage.getComment(parentCommentId))?.userId
          : post.userId;

        if (targetUserId && targetUserId !== req.user.id) {
          logger.debug(`📨 Emitindo notificação de comentário para usuário ${targetUserId}`);
          await emitNotificationToUser(targetUserId, comment.notificationId);
        }
      }

      res.json(enrichedComment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Erro ao criar comentário" });
    }
  });

  app.post('/api/timeline/posts/:postId/comments/:commentId/like', authMiddleware, async (req: any, res) => {
    try {
      const { postId, commentId } = req.params;

      // Rejeitar IDs temporários (comentários otimistas que ainda não estão no banco)
      if (commentId.startsWith('temp-')) {
        return res.status(400).json({ message: "Aguarde o comentário ser salvo antes de curtir" });
      }

      const result = await storage.toggleCommentLike(commentId, req.user.id);

      io.emit('comment_like', {
        postId,
        commentId,
        likeCount: result.likeCount,
        userHasLiked: result.hasLiked,
      });

      // Se foi adicionada uma curtida (não removida), emitir notificação
      if (result.userHasLiked && result.notificationId) {
        const comment = await storage.getComment(commentId);
        if (comment && comment.userId !== req.user.id) {
          await emitNotificationToUser(comment.userId, result.notificationId);
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Error liking comment:", error);
      res.status(500).json({ message: "Erro ao curtir comentário" });
    }
  });

  app.post('/api/timeline/posts/:postId/comments/:commentId/pin', authMiddleware, async (req: any, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await storage.getTimelinePost(postId, req.user.id);
      if (!post) {
        return res.status(404).json({ message: "Post não encontrado" });
      }

      if (post.userId !== req.user.id) {
        return res.status(403).json({ message: "Apenas o autor do post pode fixar comentários" });
      }

      await storage.pinPostComment(commentId, true);
      res.json({ success: true });
    } catch (error) {
      console.error("Error pinning comment:", error);
      res.status(500).json({ message: "Erro ao fixar comentário" });
    }
  });

  app.delete('/api/timeline/posts/:postId/comments/:commentId/pin', authMiddleware, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      await storage.pinPostComment(commentId, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unpinning comment:", error);
      res.status(500).json({ message: "Erro ao desfixar comentário" });
    }
  });


  app.post('/api/timeline/posts/:id/report', authMiddleware, async (req: any, res) => {
    try {
      const { reason, description } = req.body;
      const postId = req.params.id;

      const report = await storage.createPostReport({
        postId,
        reporterId: req.user.id,
        reason,
        description,
      });

      res.json(report);
    } catch (error) {
      console.error("Error reporting post:", error);
      res.status(500).json({ message: "Erro ao reportar post" });
    }
  });

  app.post('/api/timeline/posts/:id/pin', authMiddleware, async (req: any, res) => {
    try {
      const postId = req.params.id;

      const post = await storage.getTimelinePost(postId, req.user.id);
      if (!post) {
        return res.status(404).json({ message: "Post não encontrado" });
      }

      if (post.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Sem permissão para fixar este post" });
      }

      await storage.pinTimelinePost(postId, true);
      res.json({ success: true });
    } catch (error) {
      console.error("Error pinning post:", error);
      res.status(500).json({ message: "Erro ao fixar post" });
    }
  });

  app.delete('/api/timeline/posts/:id/pin', authMiddleware, async (req: any, res) => {
    try {
      const postId = req.params.id;
      await storage.pinTimelinePost(postId, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unpinning post:", error);
      res.status(500).json({ message: "Erro ao desfixar post" });
    }
  });

  app.delete('/api/timeline/posts/:id', authMiddleware, async (req: any, res) => {
    try {
      const postId = req.params.id;

      const post = await storage.getTimelinePost(postId, req.user.id);
      if (!post) {
        return res.status(404).json({ message: "Post não encontrado" });
      }

      if (post.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Sem permissão para deletar este post" });
      }

      await storage.deleteTimelinePost(postId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Erro ao deletar post" });
    }
  });

  app.delete('/api/timeline/posts/:postId/comments/:commentId', authMiddleware, async (req: any, res) => {
    try {
      const { commentId } = req.params;

      const comment = await storage.getPostComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comentário não encontrado" });
      }

      if (comment.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Sem permissão para deletar este comentário" });
      }

      await storage.deletePostComment(commentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Erro ao deletar comentário" });
    }
  });

  app.post('/api/timeline/posts/:postId/comments/:commentId/report', authMiddleware, async (req: any, res) => {
    try {
      const { reason, description } = req.body;
      const { commentId } = req.params;

      const report = await storage.createCommentReport({
        commentId,
        reporterId: req.user.id,
        reason,
        description,
      });

      res.json(report);
    } catch (error) {
      console.error("Error reporting comment:", error);
      res.status(500).json({ message: "Erro ao reportar comentário" });
    }
  });

  app.get('/api/timeline/weekly-summary', authMiddleware, async (req: any, res) => {
    try {
      const userPoints = await storage.getUserPoints(req.user.id);
      const summary = {
        postsCreated: userPoints?.postsCreated || 0,
        commentsCreated: userPoints?.commentsCreated || 0,
        likesReceived: userPoints?.likesReceived || 0,
        points: userPoints?.points || 0,
      };
      res.json(summary);
    } catch (error) {
      console.error("Error fetching weekly summary:", error);
      res.status(500).json({ message: "Erro ao buscar resumo semanal" });
    }
  });

  app.get('/api/timeline/trending-tags', async (_req, res) => {
    try {
      const tags = await storage.getTrendingTags(10);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching trending tags:", error);
      res.status(500).json({ message: "Erro ao buscar tags em alta" });
    }
  });

  // Endpoint administrativo para processar posts existentes e extrair tags
  app.post('/api/timeline/process-hashtags', authMiddleware, async (req: any, res) => {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      let processedCount = 0;
      const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
      const batchSize = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Buscar posts em lotes
        const allPosts = await storage.getTimelinePosts('recent', req.user.id, batchSize, offset);

        if (allPosts.length === 0) {
          hasMore = false;
          break;
        }

        for (const post of allPosts) {
          if (!post.content) continue;

          const extractedHashtags: string[] = [];
          let match;
          hashtagRegex.lastIndex = 0; // Reset regex

          while ((match = hashtagRegex.exec(post.content)) !== null) {
            const tag = match[1].toLowerCase();
            if (!extractedHashtags.includes(tag)) {
              extractedHashtags.push(tag);
            }
          }

          if (extractedHashtags.length > 0) {
            // Atualizar post com tags extraídas
            await storage.updatePostTags(post.id, extractedHashtags);
            processedCount++;
          }
        }

        offset += batchSize;

        // Se retornou menos que o tamanho do lote, não há mais posts
        if (allPosts.length < batchSize) {
          hasMore = false;
        }
      }

      res.json({
        message: `${processedCount} posts processados com sucesso`,
        processed: processedCount
      });
    } catch (error) {
      console.error("Error processing hashtags:", error);
      res.status(500).json({ message: "Erro ao processar hashtags" });
    }
  });

  // ==================== FORUM ROUTES ====================

  app.get('/api/forum/tags', authMiddleware, async (_req, res) => {
    try {
      const tags = await storage.getForumTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching forum tags:", error);
      res.status(500).json({ message: "Failed to fetch forum tags" });
    }
  });

  // Search forum tags
  app.get('/api/forum/tags/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query || query.trim().length === 0) {
        return res.json([]);
      }

      const tags = await db.select({
        id: forumTags.id,
        name: forumTags.name,
        slug: forumTags.slug,
        color: forumTags.color,
        usageCount: sql<number>`cast(count(distinct ${forumTopicTags.topicId}) as integer)`,
      })
        .from(forumTags)
        .leftJoin(forumTopicTags, eq(forumTags.id, forumTopicTags.tagId))
        .where(like(forumTags.name, `%${query.trim().toLowerCase()}%`))
        .groupBy(forumTags.id)
        .orderBy(desc(sql`count(distinct ${forumTopicTags.topicId})`))
        .limit(limit);

      res.json(tags);
    } catch (error) {
      console.error('Error searching tags:', error);
      res.status(500).json({ error: 'Failed to search tags' });
    }
  });

  // Get trending forum tags (tags mais usadas)
  app.get('/api/forum/trending-tags', async (req, res) => {
    try {
      // Buscar todas as tags com contagem real de tópicos
      const tagsWithCounts = await db.select({
        id: forumTags.id,
        name: forumTags.name,
        slug: forumTags.slug,
        color: forumTags.color,
        topicCount: sql<number>`cast(count(distinct ${forumTopicTags.topicId}) as integer)`,
      })
        .from(forumTags)
        .leftJoin(forumTopicTags, eq(forumTags.id, forumTopicTags.tagId))
        .groupBy(forumTags.id)
        .orderBy(desc(sql`count(distinct ${forumTopicTags.topicId})`))
        .limit(20);

      res.json(tagsWithCounts);
    } catch (error) {
      console.error('Error fetching trending tags:', error);
      res.status(500).json({ error: 'Failed to fetch trending tags' });
    }
  });

  // GET /api/forum/stats - Estatísticas do fórum
  app.get('/api/forum/stats', async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const topics = await storage.getForumTopics(undefined, userId); // Fetch all topics to use in mock

      // Estatísticas temporárias do fórum (até implementar a query real)
      const forumStats = {
        activeTopics: topics?.filter((t: any) => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return new Date(t.updatedAt) >= thirtyDaysAgo;
        }).length || 0,
        onlineUsers: Math.floor(Math.random() * 20) + 5,
        repliesToday: Math.floor(Math.random() * 50) + 10
      };

      // Original implementation (commented out due to missing getForumStats):
      // Contar discussões ativas (com atividade nos últimos 30 dias)
      // const thirtyDaysAgo = new Date();
      // thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // const activeTopics = await db
      //   .select({ count: sql<number>`count(*)` })
      //   .from(forumTopics)
      //   .where(gte(forumTopics.updatedAt, thirtyDaysAgo))
      //   .then(rows => Number(rows[0]?.count || 0));

      // Contar membros online (usuários com atividade nas últimas 24 horas)
      // const twentyFourHoursAgo = new Date();
      // twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      // const onlineUsers = await db
      //   .select({ count: sql<number>`count(distinct ${users.id})` })
      //   .from(users)
      //   .leftJoin(posts, eq(users.id, posts.authorId))
      //   .leftJoin(forumReplies, eq(users.id, forumReplies.authorId))
      //   .where(
      //     or(
      //       gte(posts.createdAt, twentyFourHoursAgo),
      //       gte(forumReplies.createdAt, twentyFourHoursAgo)
      //     )
      //   )
      //   .then(rows => Number(rows[0]?.count || 0));

      // Contar respostas hoje
      // const today = new Date();
      // today.setHours(0, 0, 0, 0);

      // const repliesToday = await db
      //   .select({ count: sql<number>`count(*)` })
      //   .from(forumReplies)
      //   .where(gte(forumReplies.createdAt, today))
      //   .then(rows => Number(rows[0]?.count || 0));

      res.json(forumStats);
    } catch (error: any) {
      console.error('[Forum Stats Error]', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas do fórum' });
    }
  });

  app.get('/api/forum/topics', authMiddleware, async (req: any, res) => {
    try {
      const {categoryId} = req.query;
      const topics = await storage.getForumTopics(categoryId, req.user.id);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching forum topics:", error);
      res.status(500).json({ message: "Failed to fetch forum topics" });
    }
  });

  app.get('/api/forum/topics/:idOrSlug', authMiddleware, async (req: any, res) => {
    try {
      const { idOrSlug } = req.params;
      let topic;

      logger.debug('[Forum API] ============================================');
      logger.debug('[Forum API] Requisição recebida para:', idOrSlug);
      logger.debug('[Forum API] User ID:', req.user?.id);

      // Check if parameter is a valid UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

      if (isUUID) {
        // Fetch by ID
        logger.debug('[Forum API] Detectado como UUID, buscando por ID');
        topic = await storage.getForumTopicById(idOrSlug, req.user?.id);
      } else {
        // Try to fetch by slug first
        logger.debug('[Forum API] Detectado como slug, buscando por slug');
        topic = await storage.getForumTopicBySlug(idOrSlug, req.user?.id);
      }

      if (!topic) {
        logger.debug('[Forum API] ❌ Tópico não encontrado:', idOrSlug);
        return res.status(404).json({ message: "Tópico não encontrado" });
      }

      // Incrementar visualizações de forma única por usuário usando cookies
      const viewCookieName = `forum_viewed_${topic.id}`;
      const hasViewed = req.cookies?.[viewCookieName] === 'true';

      if (!hasViewed) {
        // Incrementar viewCount
        await storage.incrementTopicViewCount(topic.id);

        // Definir cookie para marcar que o usuário já visualizou (válido por 24h)
        res.cookie(viewCookieName, 'true', {
          maxAge: 24 * 60 * 60 * 1000, // 24 horas
          httpOnly: true,
          sameSite: 'lax'
        });

        // Atualizar o viewCount no objeto retornado
        topic.viewCount = (topic.viewCount || 0) + 1;
        logger.debug('[Forum API] 👁️ Visualização única registrada para:', topic.title);
      }

      logger.debug('[Forum API] ✅ Tópico encontrado:', topic.title, '- Visualizações:', topic.viewCount);
      logger.debug('[Forum API] ============================================');
      res.json(topic);
    } catch (error) {
      console.error("[Forum API] ❌ Error fetching forum topic:", error);
      res.status(500).json({ message: "Erro ao buscar tópico" });
    }
  });

  // Rota alternativa para compatibilidade
  app.get('/api/forum/:idOrSlug', authMiddleware, async (req: any, res) => {
    try {
      const { idOrSlug } = req.params;
      let topic;

      // Check if parameter looks like a slug (contains hyphens) or a UUID
      const isSlug = idOrSlug.includes('-') && !idOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      if (isSlug) {
        // Try to fetch by slug first
        topic = await storage.getForumTopicBySlug(idOrSlug, req.user?.id);
      } else {
        // Fetch by ID for backward compatibility
        topic = await storage.getForumTopicById(idOrSlug, req.user?.id);
      }

      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      console.error("Error fetching forum topic:", error);
      res.status(500).json({ message: "Failed to fetch forum topic" });
    }
  });

  app.post('/api/forum/topics', authMiddleware, upload.single('attachment'), async (req: any, res) => {
    try {
      // Parse tags if they come as JSON string
      let tags = [];
      if (req.body.tags) {
        try {
          tags = JSON.parse(req.body.tags);
        } catch (e) {
          return res.status(400).json({ message: "Invalid tags format" });
        }
      }

      // Handle file attachment
      let attachments: any[] = [];
      if (req.file) {
        // Validate file type - only allow safe file types
        const allowedMimetypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
          'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip', 'application/x-rar-compressed'
        ];

        if (!allowedMimetypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            message: "Tipo de arquivo não permitido. Apenas imagens, PDF, DOC, XLS, TXT, ZIP e RAR são permitidos."
          });
        }

        // Validate file extension
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar'];
        const extension = (req.file.originalname.split('.').pop() || '').toLowerCase();

        if (!allowedExtensions.includes(extension)) {
          return res.status(400).json({
            message: "Extensão de arquivo não permitida."
          });
        }

        // Upload to Object Storage for persistence in production
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();

        let fileBuffer = req.file.buffer;
        let finalMimetype = req.file.mimetype;
        let finalSize = req.file.size;
        let finalExtension = extension;

        // Optimize images to WebP
        if (req.file.mimetype.startsWith('image/')) {
          fileBuffer = await sharp(req.file.buffer)
            .resize(2560, 2560, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toBuffer();
          finalMimetype = 'image/webp';
          finalSize = fileBuffer.length;
          finalExtension = 'webp';
        }

        const fileUrl = await objectStorageService.uploadBuffer(fileBuffer, 'forum', finalMimetype, finalExtension);
        
        attachments.push({
          url: fileUrl,
          filename: req.file.originalname,
          mimetype: finalMimetype,
          size: finalSize
        });
      }

      const topicData = insertForumTopicSchema.omit({ slug: true }).parse({
        ...req.body,
        tags,
        authorId: req.user.id,
        videoLink: req.body.videoLink || null,
        attachments: attachments.length > 0 ? attachments : null,
      });
      const topic = await storage.createForumTopic(topicData);

      // Award points for creating forum topic
      const { POINTS } = await import('./gamification');
      await storage.awardPoints(req.user.id, POINTS.CREATE_TOPIC, 'create_topic', 'topicsCreated');

      // Emit gamification update
      io.emit('gamification_update', {
        userId: req.user.id,
        action: 'create_topic',
        points: POINTS.CREATE_TOPIC
      });

      res.status(201).json(topic);
    } catch (error) {
      console.error("Error creating forum topic:", error);
      res.status(500).json({ message: "Failed to create forum topic" });
    }
  });

  app.put('/api/forum/topics/:id', authMiddleware, upload.single('attachment'), async (req: any, res) => {
    try {
      const topic = await storage.getForumTopicById(req.params.id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      if (topic.authorId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { title, content, categoryId, tags, videoLink } = req.body;

      // Parse tags if it's a JSON string
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags;
        }
      }

      const updateData: any = {
        title,
        content,
        categoryId,
        tags: parsedTags,
        videoLink: videoLink || null,
      };

      // Check if user explicitly wants to remove attachment
      const removeAttachment = req.body.removeAttachment === 'true' || req.body.removeAttachment === true;

      if (removeAttachment) {
        // Delete old attachment files (from disk or Object Storage)
        if (topic.attachments && Array.isArray(topic.attachments)) {
          for (const attachment of topic.attachments) {
            try {
              if (attachment.url.startsWith('/objects/')) {
                // Delete from Object Storage (async, don't wait)
                const { ObjectStorageService } = await import('./objectStorage');
                const objectStorageService = new ObjectStorageService();
                try {
                  const objectFile = await objectStorageService.getObjectEntityFile(attachment.url);
                  await objectFile.delete();
                  logger.debug(`Deleted attachment from Object Storage: ${attachment.url}`);
                } catch (err) {
                  console.warn(`Failed to delete from Object Storage: ${attachment.url}`, err);
                }
              } else {
                // Delete from local filesystem (legacy)
                const filePath = path.join(process.cwd(), 'public', attachment.url);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.debug(`Deleted attachment file: ${filePath}`);
                }
              }
            } catch (error) {
              console.warn(`Failed to delete attachment file: ${attachment.url}`, error);
              // Continue execution even if file deletion fails
            }
          }
        }
        updateData.attachments = null;
      } else if (req.file) {
        // Handle attachment upload if present
        const file = req.file;

        // Validate file type
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
          'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip', 'application/x-rar-compressed'
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            message: 'Tipo de arquivo não permitido. Use: imagens, PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR'
          });
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ message: 'Arquivo muito grande. Tamanho máximo: 10MB' });
        }

        // Upload to Object Storage for persistence in production
        const { ObjectStorageService } = await import('./objectStorage');
        const objectStorageService = new ObjectStorageService();

        let fileBuffer = file.buffer;
        let finalMimetype = file.mimetype;
        let finalSize = file.size;
        const extension = (file.originalname.split('.').pop() || 'bin').toLowerCase();
        let finalExtension = extension;

        // Optimize images to WebP
        if (file.mimetype.startsWith('image/')) {
          fileBuffer = await sharp(file.buffer)
            .resize(2560, 2560, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toBuffer();
          finalMimetype = 'image/webp';
          finalSize = fileBuffer.length;
          finalExtension = 'webp';
        }

        const fileUrl = await objectStorageService.uploadBuffer(fileBuffer, 'forum', finalMimetype, finalExtension);

        updateData.attachments = [{
          url: fileUrl,
          filename: file.originalname,
          mimetype: finalMimetype,
          size: finalSize,
        }];
      }

      const updatedTopic = await storage.updateForumTopic(req.params.id, updateData);

      io.emit('forum_topic_updated', {
        topicId: updatedTopic.id,
        topic: updatedTopic
      });

      res.json(updatedTopic);
    } catch (error) {
      console.error("Error updating forum topic:", error);
      res.status(500).json({ message: "Failed to update forum topic" });
    }
  });

  app.post('/api/forum/topics/:id/toggle-sticky', authMiddleware, async (req: any, res) => {
    try {
      const topic = await storage.getForumTopicById(req.params.id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Only admins can pin topics" });
      }

      const updatedTopic = await storage.updateForumTopic(req.params.id, {
        isSticky: !topic.isSticky
      });

      res.json({ isSticky: updatedTopic.isSticky });
    } catch (error) {
      console.error("Error toggling sticky:", error);
      res.status(500).json({ message: "Failed to toggle sticky" });
    }
  });

  app.delete('/api/forum/topics/:id', authMiddleware, async (req: any, res) => {
    try {
      const topic = await storage.getForumTopicById(req.params.id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      if (topic.authorId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Delete attachment files from disk before deleting topic
      if (topic.attachments && Array.isArray(topic.attachments)) {
        for (const attachment of topic.attachments) {
          try {
            const filePath = path.join(process.cwd(), 'public', attachment.url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              logger.debug(`Deleted attachment file: ${filePath}`);
            }
          } catch (error) {
            console.warn(`Failed to delete attachment file: ${attachment.url}`, error);
            // Continue execution even if file deletion fails
          }
        }
      }

      await storage.deleteForumTopic(req.params.id);
      res.json({ message: "Topic deleted" });
    } catch (error) {
      console.error("Error deleting forum topic:", error);
      res.status(500).json({ message: "Failed to delete forum topic" });
    }
  });

  app.post('/api/forum/topics/:id/save', authMiddleware, async (req: any, res) => {
    try {
      // TODO: Implementar lógica de salvamento (criar tabela saved_topics se necessário)
      res.json({ message: "Topic saved successfully" });
    } catch (error) {
      console.error("Error saving topic:", error);
      res.status(500).json({ message: "Failed to save topic" });
    }
  });

  app.post('/api/forum/topics/:id/report', authMiddleware, async (req: any, res) => {
    try {
      const { reason, description } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Motivo é obrigatório" });
      }
      
      await storage.createForumTopicReport({
        topicId: req.params.id,
        reporterId: req.user.id,
        reason,
        description: description || null,
        reviewedBy: null,
      });
      
      res.json({ message: "Tópico denunciado com sucesso" });
    } catch (error) {
      console.error("Error reporting topic:", error);
      res.status(500).json({ message: "Falha ao denunciar tópico" });
    }
  });

  app.post('/api/forum/topics/:topicId/replies/:replyId/report', authMiddleware, async (req: any, res) => {
    try {
      const { reason, description } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Motivo é obrigatório" });
      }
      
      await storage.createForumReplyReport({
        replyId: req.params.replyId,
        reporterId: req.user.id,
        reason,
        description: description || null,
        reviewedBy: null,
      });
      
      res.json({ message: "Comentário denunciado com sucesso" });
    } catch (error) {
      console.error("Error reporting reply:", error);
      res.status(500).json({ message: "Falha ao denunciar comentário" });
    }
  });

  app.get('/api/forum/topics/:id/replies', authMiddleware, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const replies = await storage.getForumReplies(req.params.id, req.user.id, limit, offset);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching forum replies:", error);
      res.status(500).json({ message: "Failed to fetch forum replies" });
    }
  });

  app.post('/api/forum/topics/:id/replies', authMiddleware, async (req: any, res) => {
    try {
      const replyData = insertForumReplySchema.parse({
        content: req.body.content,
        parentCommentId: req.body.parentCommentId || null,
        topicId: req.params.id,
        authorId: req.user.id,
      });
      const reply = await storage.createForumReply(replyData);

      // Award points for forum reply
      const { POINTS } = await import('./gamification');
      await storage.awardPoints(req.user.id, POINTS.REPLY_TOPIC, 'reply_topic', 'repliesCreated');

      // Emit gamification update
      io.emit('gamification_update', {
        userId: req.user.id,
        action: 'reply_topic',
        points: POINTS.REPLY_TOPIC
      });

      // ✅ Emitir evento WebSocket para atualização em tempo real no fórum
      io.emit('forum_new_reply', {
        topicId: req.params.id,
        reply: reply
      });
      logger.debug('📡 Reply do fórum emitido via WebSocket:', req.params.id);

      // Emitir notificações em tempo real para todos os usuários afetados
      if (reply.notificationIds && reply.notificationIds.length > 0) {
        for (const notificationId of reply.notificationIds) {
          const notification = await storage.getNotificationById(notificationId);
          if (notification) {
            await emitNotificationToUser(notification.userId, notificationId);
          }
        }
      }

      res.status(201).json(reply);
    } catch (error) {
      console.error("Error creating forum reply:", error);
      res.status(500).json({ message: "Failed to create forum reply" });
    }
  });

  // Endpoint específico para curtir comentários do fórum
  app.post('/api/forum/topics/:topicId/comments/:commentId/like', authMiddleware, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      const result = await storage.toggleLike(req.user.id, 'like', null, commentId);

      // Emitir evento WebSocket para atualização em tempo real
      io.emit('forum_reaction', {
        replyId: commentId,
        reactionType: 'like',
        userId: req.user.id,
        result
      });

      // Emitir notificação em tempo real se foi adicionada uma reação
      if (result.action === 'added' && result.notificationId && result.targetUserId && result.targetUserId !== req.user.id) {
        await emitNotificationToUser(result.targetUserId, result.notificationId);
      }

      res.json({ userHasLiked: result.userHasReacted, likeCount: result.reactionCount });
    } catch (error) {
      console.error("Error liking comment:", error);
      res.status(500).json({ message: "Failed to like comment" });
    }
  });

  app.post('/api/forum/like', authMiddleware, async (req: any, res) => {
    try {
      const { topicId, replyId, reactionType = 'like' } = req.body;

      const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
      if (!validReactions.includes(reactionType)) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      const result = await storage.toggleLike(req.user.id, reactionType, topicId, replyId);

      // ✅ Emitir evento WebSocket para atualização em tempo real de curtidas no fórum
      io.emit('forum_reaction', {
        topicId,
        replyId,
        reactionType,
        userId: req.user.id,
        result
      });
      logger.debug('📡 Reação do fórum emitida via WebSocket:', topicId || replyId);

      // Emitir notificação em tempo real se foi adicionada uma reação
      if (result.action === 'added' && result.notificationId && result.targetUserId && result.targetUserId !== req.user.id) {
        await emitNotificationToUser(result.targetUserId, result.notificationId);
      }

      res.json(result);
    } catch (error) {
      console.error("Error toggling reaction:", error);
      res.status(500).json({ message: "Failed to toggle reaction" });
    }
  });

  app.get('/api/forum/reactions/:type/:id', authMiddleware, async (req: any, res) => {
    try {
      const { type, id } = req.params;
      const topicId = type === 'topic' ? id : undefined;
      const replyId = type === 'reply' ? id : undefined;

      const counts = await storage.getReactionCounts(topicId, replyId);
      const userReaction = await storage.getUserReaction(req.user.id, topicId, replyId);

      res.json({ counts, userReaction });
    } catch (error) {
      console.error("Error fetching reactions:", error);
      res.status(500).json({ message: "Failed to fetch reactions" });
    }
  });

  app.post('/api/forum/topics/:topicId/best-answer/:replyId', authMiddleware, async (req: any, res) => {
    try {
      const { topicId, replyId } = req.params;
      const topic = await storage.getForumTopicById(topicId);

      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      if (topic.authorId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Only topic author can mark best answer" });
      }

      await storage.markBestAnswer(topicId, replyId);

      // Emitir evento WebSocket para atualização em tempo real
      io.emit('forum_best_answer', {
        topicId,
        replyId
      });

      res.json({ message: "Best answer marked" });
    } catch (error) {
      console.error("Error marking best answer:", error);
      res.status(500).json({ message: "Failed to mark best answer" });
    }
  });

  app.delete('/api/forum/topics/:topicId/best-answer', authMiddleware, async (req: any, res) => {
    try {
      const { topicId } = req.params;
      const topic = await storage.getForumTopicById(topicId);

      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      if (topic.authorId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Only topic author can remove best answer" });
      }

      await storage.unmarkAllBestAnswers(topicId);

      // Emitir evento WebSocket para atualização em tempo real
      io.emit('forum_best_answer_removed', {
        topicId
      });

      res.json({ message: "Best answer removed" });
    } catch (error) {
      console.error("Error removing best answer:", error);
      res.status(500).json({ message: "Failed to remove best answer" });
    }
  });

  // ==================== GAMIFICATION & SOCIAL ROUTES ====================

  app.get('/api/daily-activities', authMiddleware, async (req: any, res) => {
    try {
      const activities = await storage.getDailyActivities();
      const progress = await storage.getUserDailyProgress(req.user.id);

      const activitiesWithProgress = activities.map(activity => {
        const userProgress = progress.find(p => p.activityId === activity.id);
        return {
          ...activity,
          progress: userProgress?.progress || 0,
          isCompleted: userProgress?.isCompleted || false,
        };
      });

      res.json(activitiesWithProgress);
    } catch (error) {
      console.error("Error fetching daily activities:", error);
      res.status(500).json({ message: "Erro ao buscar atividades diárias" });
    }
  });

  app.get('/api/forum/trending-topics', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const topics = await storage.getTrendingTopics(limit);
      res.json(topics);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      res.status(500).json({ message: "Erro ao buscar tópicos em alta" });
    }
  });

  app.get('/api/users/:id/stats', authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas do usuário" });
    }
  });

  // ==================== GAMIFICATIONROUTES (NEW) ====================

  // Get user's daily activities with progress
  app.get('/api/gamification/daily-activities', authMiddleware, async (req: any, res) => {
    try {
      const { DAILY_ACTIVITIES, getTimeUntilReset, formatTimeRemaining } = await import('./gamification');
      const userId = req.user.id;
      const progress = await storage.getUserDailyActivities(userId);

      const activitiesWithProgress = DAILY_ACTIVITIES.map(activity => {
        const userProgress = progress.find(p => p.activity.id === activity.id);
        return {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          xpReward: activity.xpReward,
          icon: activity.icon,
          requirementCount: activity.requirementCount,
          currentProgress: userProgress?.currentProgress || 0,
          isCompleted: userProgress?.isCompleted || false,
          isClaimed: userProgress?.isClaimed || false,
          progressId: userProgress?.id,
        };
      });

      const timeUntilReset = getTimeUntilReset('daily');
      const timeFormatted = formatTimeRemaining(timeUntilReset);

      res.json({
        activities: activitiesWithProgress,
        resetIn: timeFormatted,
        resetTimestamp: Date.now() + timeUntilReset,
      });
    } catch (error) {
      console.error("Error fetching daily activities:", error);
      res.status(500).json({ message: "Erro ao buscar atividades diárias" });
    }
  });

  // Claim daily activity reward
  app.post('/api/gamification/daily-activities/:progressId/claim', authMiddleware, async (req: any, res) => {
    try {
      const { progressId } = req.params;
      const userId = req.user.id;

      // Get progress
      const activities = await storage.getUserDailyActivities(userId);
      const progress = activities.find(a => a.id === progressId);

      if (!progress) {
        return res.status(404).json({ message: "Atividade não encontrada" });
      }

      if (!progress.isCompleted) {
        return res.status(400).json({ message: "Atividade ainda não completada" });
      }

      if (progress.isClaimed) {
        return res.status(400).json({ message: "Recompensa já reivindicada" });
      }

      // Get active rewards to check for XP multiplier
      const activeRewards = await storage.getUserActiveRewards(userId);
      const { getActiveXpMultiplier, calculateXpWithMultiplier } = await import('./gamification');
      const multiplier = getActiveXpMultiplier(activeRewards);
      const xpToAward = calculateXpWithMultiplier(progress.activity.xpReward, multiplier);

      // Award points and mark as claimed
      await storage.awardPoints(userId, xpToAward, 'activity_completed');
      await storage.updateDailyProgress(progressId, {
        isClaimed: true,
        claimedAt: new Date(),
      });

      res.json({
        message: "Recompensa reivindicada com sucesso!",
        xpEarned: xpToAward,
        multiplier: multiplier > 1 ? multiplier : null,
      });
    } catch (error) {
      console.error("Error claiming activity reward:", error);
      res.status(500).json({ message: "Erro ao reivindicar recompensa" });
    }
  });

  // Get weekly challenges with progress (OPTIMIZED - single query for all progress)
  app.get('/api/gamification/weekly-challenges', authMiddleware, async (req: any, res) => {
    try {
      const { getTimeUntilReset, formatTimeRemaining, getCurrentWeekBoundaries } = await import('./gamification');
      const userId = req.user.id;
      
      const [challenges, allProgress] = await Promise.all([
        storage.getActiveWeeklyChallenges(),
        storage.getAllUserWeeklyProgress(userId)
      ]);

      const progressMap = new Map(allProgress.map(p => [p.challengeId, p]));

      const challengesWithProgress = challenges.map((challenge) => {
        const progress = progressMap.get(challenge.id);
        return {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          xpReward: challenge.xpReward,
          icon: challenge.icon,
          requirementCount: challenge.requirementCount,
          currentProgress: progress?.currentProgress || 0,
          isCompleted: progress?.isCompleted || false,
          isClaimed: progress?.isClaimed || false,
          progressId: progress?.id,
          rewardType: challenge.rewardType,
          rewardValue: challenge.rewardValue,
        };
      });

      const timeUntilReset = getTimeUntilReset('weekly');
      const timeFormatted = formatTimeRemaining(timeUntilReset);
      const weekBoundaries = getCurrentWeekBoundaries();

      res.json({
        challenges: challengesWithProgress,
        resetIn: timeFormatted,
        resetTimestamp: Date.now() + timeUntilReset,
        weekStart: weekBoundaries.start,
        weekEnd: weekBoundaries.end,
      });
    } catch (error) {
      console.error("Error fetching weekly challenges:", error);
      res.status(500).json({ message: "Erro ao buscar desafios semanais" });
    }
  });

  // Claim weekly challenge reward
  app.post('/api/gamification/weekly-challenges/:progressId/claim', authMiddleware, async (req: any, res) => {
    try {
      const { progressId } = req.params;
      const userId = req.user.id;

      // Get challenge progress
      const challenges = await storage.getActiveWeeklyChallenges();
      let challengeProgress: any = null;
      let challenge: any = null;

      for (const ch of challenges) {
        const prog = await storage.getUserWeeklyProgress(userId, ch.id);
        if (prog?.id === progressId) {
          challengeProgress = prog;
          challenge = ch;
          break;
        }
      }

      if (!challengeProgress || !challenge) {
        return res.status(404).json({ message: "Desafio não encontrado" });
      }

      if (!challengeProgress.isCompleted) {
        return res.status(400).json({ message: "Desafio ainda não completado" });
      }

      if (challengeProgress.isClaimed) {
        return res.status(400).json({ message: "Recompensa já reivindicada" });
      }

      // Award XP
      await storage.awardPoints(userId, challenge.xpReward, 'challenge_completed');

      // If challenge has special reward, create it
      if (challenge.rewardType) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 7 days from now

        await storage.createUserReward({
          userId,
          rewardType: challenge.rewardType,
          rewardValue: challenge.rewardValue || null,
          startDate: new Date(),
          endDate,
          isActive: true,
        });
      }

      // Mark as claimed
      await storage.updateWeeklyProgress(progressId, {
        isClaimed: true,
        claimedAt: new Date(),
      });

      res.json({
        message: "Recompensa reivindicada com sucesso!",
        xpEarned: challenge.xpReward,
        specialReward: challenge.rewardType ? {
          type: challenge.rewardType,
          value: challenge.rewardValue,
        } : null,
      });
    } catch (error) {
      console.error("Error claiming challenge reward:", error);
      res.status(500).json({ message: "Erro ao reivindicar recompensa" });
    }
  });

  // Get user active rewards
  app.get('/api/gamification/rewards', authMiddleware, async (req: any, res) => {
    try {
      const rewards = await storage.getUserActiveRewards(req.user.id);
      res.json(rewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ message: "Erro ao buscar recompensas" });
    }
  });

  // Get featured members
  app.get('/api/gamification/featured-members', async (_req, res) => {
    try {
      const featuredMembers = await storage.getFeaturedMembers();
      res.json(featuredMembers);
    } catch (error) {
      console.error("Error fetching featured members:", error);
      res.status(500).json({ message: "Erro ao buscar membros em destaque" });
    }
  });

  // ==================== GOOGLE DRIVE IMPORT ====================

  app.post('/api/admin/import-from-drive', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json({ message: "Importação iniciada em segundo plano. Verifique os logs do servidor." });

      // Executar importação em segundo plano
      (async () => {
        try {
          // Importar e executar o script de importação
          const importModule = await import('./import-from-drive-api');
          logger.debug('✅ Script de importação executado com sucesso!');
        } catch (error) {
          console.error('❌ Erro ao executar script de importação:', error);
        }
      })();
    } catch (error) {
      console.error("Error starting import:", error);
      res.status(500).json({ message: "Erro ao iniciar importação" });
    }
  });

  // Endpoint para forçar sincronização manual (com autenticação)
  app.post('/api/admin/sync-drive-content', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      res.json({ message: "Sincronização iniciada em segundo plano. Verifique os logs do servidor." });

      // Executar sincronização em segundo plano
      (async () => {
        try {
          const { syncDriveContent } = await import('./sync-scheduler');
          const result = await syncDriveContent();
          logger.debug('✅ Sincronização manual concluída:', result);
        } catch (error) {
          console.error('❌ Erro ao executar sincronização:', error);
        }
      })();
    } catch (error) {
      console.error("Error starting sync:", error);
      res.status(500).json({ message: "Erro ao iniciar sincronização" });
    }
  });

  // Endpoint de teste sem autenticação (APENAS PARA DESENVOLVIMENTO)
  app.post('/api/sync-drive-test', async (req, res) => {
    try {
      res.json({ message: "Sincronização de teste iniciada. Verifique os logs do servidor." });

      // Executar sincronização em segundo plano
      (async () => {
        try {
          const { syncDriveContent } = await import('./sync-scheduler');
          const result = await syncDriveContent();
          logger.debug('✅ Sincronização de teste concluída:', result);
        } catch (error) {
          console.error('❌ Erro ao executar sincronização de teste:', error);
        }
      })();
    } catch (error) {
      console.error("Error starting test sync:", error);
      res.status(500).json({ message: "Erro ao iniciar sincronização de teste" });
    }
  });

  // ==================== GOOGLE DRIVE OLD ROUTE (BACKUP) ====================

  app.post('/api/admin/import-from-drive-old', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { folderId } = req.body;

      if (!folderId) {
        return res.status(400).json({ message: "ID da pasta do Drive é obrigatório" });
      }

      res.json({ message: "Importação iniciada em segundo plano. Verifique os logs do servidor." });

      (async () => {
        try {
          const { listFilesInFolder, buildDirectFileUrl } = await import('./drive-client');

          // Idiomas disponíveis (apenas os que existem no Drive)
          const idiomas = [
            { nome: 'Português', codigo: 'pt-BR', sufixo: 'BR' },
            { nome: 'Inglês', codigo: 'en-US', sufixo: 'EN' },
            { nome: 'Espanhol', codigo: 'es-ES', sufixo: 'ES' },
            { nome: 'Francês', codigo: 'fr-FR', sufixo: 'FR' },
            { nome: 'Árabe', codigo: 'ar-SA', sufixo: 'AR' },
            { nome: 'Chinês', codigo: 'zh-CN', sufixo: 'CN' },
            { nome: 'Hindi', codigo: 'hi-IN', sufixo: 'HI' },
          ];

          interface PLRFiles {
            folderId?: string;
            coverUrl?: string;
            certificateUrl?: string;
            landingPageFolderId?: string;
          }

          logger.debug('\n🚀 Iniciando importação dos PLRs do Google Drive...');
          logger.debug('📂 ID da pasta:', folderId);
          logger.debug('\n⏳ Listando arquivos...\n');

          const plrMap = new Map<string, PLRFiles>();

          const files = await listFilesInFolder(folderId, (file) => {
            const pathParts = file.path.split('/');

            if (pathParts.length < 1) return;

            const plrName = pathParts[0];

            // Ignorar pastas específicas
            if (plrName.includes('Plugins atualizados') ||
                plrName.includes('Templates kits elementor')) {
              return;
            }

            if (!plrMap.has(plrName)) {
              plrMap.set(plrName, {});
            }

            const plrFiles = plrMap.get(plrName)!;

            // Salvar o ID da pasta do PLR (primeiro nível é a pasta)
            if (pathParts.length === 1 && file.mimeType === 'application/vnd.google-apps.folder') {
              plrFiles.folderId = file.id;
              logger.debug(`  📁 Pasta PLR encontrada: ${plrName} (${file.id})`);
            }

            if (file.name.toLowerCase().includes('certificado') &&
                (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'))) {
              plrFiles.certificateUrl = buildDirectFileUrl(file.id);
              logger.debug(`  📄 Certificado encontrado: ${plrName}/${file.name}`);
            }

            if (file.name.toLowerCase().includes('capa') &&
                (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg'))) {
              plrFiles.coverUrl = buildDirectFileUrl(file.id);
              logger.debug(`  🖼️  Capa encontrada: ${plrName}/${file.name}`);
            }

            // Detectar a pasta "⭐Página wordpress"
            if (file.mimeType === 'application/vnd.google-apps.folder' &&
                pathParts.length === 2 &&
                (file.name.includes('Página wordpress') || file.name.includes('página wordpress'))) {
              plrFiles.landingPageFolderId = file.id;
              logger.debug(`  🌐 Pasta Página encontrada: ${plrName}/${file.name} (${file.id})`);
            }
          });

          logger.debug(`\n✅ Total de arquivos processados: ${files.length}`);
          logger.debug(`📦 Total de PLRs encontrados: ${plrMap.size}\n`);
          logger.debug('════════════════════════════════════════════════════════\n');

          // Função para determinar categoria baseada no nome do PLR
          async function getOrCreateCategory(plrName: string) {
            const name = plrName.toLowerCase();

            let categoryName = 'Diversos';
            let categorySlug = 'diversos';
            let categoryDesc = 'Conteúdos diversos';

            if (name.includes('ansiedade') || name.includes('depressão') || name.includes('stress') || name.includes('estresse')) {
              categoryName = 'Saúde Mental';
              categorySlug = 'saude-mental';
              categoryDesc = 'PLRs sobre saúde mental e bem-estar emocional';
            } else if (name.includes('autismo') || name.includes('saúde') || name.includes('doença')) {
              categoryName = 'Saúde';
              categorySlug = 'saude';
              categoryDesc = 'PLRs sobre saúde e bem-estar';
            } else if (name.includes('alfabetização') || name.includes('educação') || name.includes('ensino') || name.includes('aprendizado')) {
              categoryName = 'Educação';
              categorySlug = 'educacao';
              categoryDesc = 'PLRs sobre educação e aprendizado';
            } else if (name.includes('pets') || name.includes('cachorro') || name.includes('gato') || name.includes('animal')) {
              categoryName = 'Pets';
              categorySlug = 'pets';
              categoryDesc = 'PLRs sobre cuidados com animais de estimação';
            } else if (name.includes('bebê') || name.includes('bebe') || name.includes('infantil') || name.includes('criança')) {
              categoryName = 'Infantil';
              categorySlug = 'infantil';
              categoryDesc = 'PLRs sobre cuidados infantis';
            } else if (name.includes('receita') || name.includes('culinária') || name.includes('alimento')) {
              categoryName = 'Culinária';
              categorySlug = 'culinaria';
              categoryDesc = 'PLRs sobre culinária e receitas';
            } else if (name.includes('fitness') || name.includes('exercício') || name.includes('treino') || name.includes('musculação')) {
              categoryName = 'Fitness';
              categorySlug = 'fitness';
              categoryDesc = 'PLRs sobre fitness e exercícios';
            } else if (name.includes('negócio') || name.includes('empreendedorismo') || name.includes('vendas')) {
              categoryName = 'Negócios';
              categorySlug = 'negocios';
              categoryDesc = 'PLRs sobre negócios e empreendedorismo';
            }

            const categories = await storage.getCategories();
            let category = categories.find(c => c.slug === categorySlug);

            if (!category) {
              category = await storage.createCategory({
                name: categoryName,
                slug: categorySlug,
                description: categoryDesc,
              });
              logger.debug(`  📂 Nova categoria criada: ${categoryName}`);
            }

            return category;
          }

          let imported = 0;
          let failed = 0;

          for (const [plrName, plrFiles] of plrMap.entries()) {
            try {
              logger.debug(`
🚀 Importando: ${plrName}`);

              if (!plrFiles.coverUrl) {
                logger.debug(`  ⚠️  Sem capa, pulando...`);
                failed++;
                continue;
              }

              // Determinar categoria automaticamente
              const category = await getOrCreateCategory(plrName);
              logger.debug(`  📂 Categoria: ${category.name}`);

              const extraLinks = [];

              if (plrFiles.certificateUrl) {
                extraLinks.push({
                  title: 'Certificado',
                  url: plrFiles.certificateUrl
                });
              }

              if (plrFiles.landingPageFolderId) {
                extraLinks.push({
                  title: 'Página de Vendas',
                  url: `https://drive.google.com/drive/folders/${plrFiles.landingPageFolderId}`
                });
              }

              const plr = await storage.createPLR({
                title: plrName,
                description: `PLR - ${plrName}`,
                coverImageUrl: plrFiles.coverUrl,
                categoryId: category.id,
                countryCode: 'BR',
                price: 0,
                isFree: true,
                isActive: true,
                extraLinks,
              });

              logger.debug(`  ✅ PLR criado: ${plr.id}`);

              // Usar o link da pasta do PLR para todos os idiomas
              if (plrFiles.folderId) {
                const folderUrl = `https://drive.google.com/drive/folders/${plrFiles.folderId}`;
                logger.debug(`  📁 Usando link da pasta: ${folderUrl}`);

                // Criar VSL e EBOOK para todos os idiomas do LANGUAGE_MAP
                for (const [languageName, languageCode] of Object.entries(idiomas)) {
                  const languages = await storage.getLanguages();
                  let language = languages.find(l => l.code === languageCode.codigo);

                  if (!language) {
                    language = await storage.createLanguage({
                      name: languageCode.nome,
                      code: languageCode.codigo,
                    });
                  }

                  // Adicionar E-book
                  await storage.addPLRDownload({
                    plrId: plr.id,
                    type: 'ebook',
                    languageId: language.id,
                    fileUrl: folderUrl,
                  });

                  // Adicionar VSL
                  await storage.addPLRDownload({
                    plrId: plr.id,
                    type: 'vsl',
                    languageId: language.id,
                    fileUrl: folderUrl,
                  });

                  logger.debug(`  ✅ VSL + E-book adicionados: ${languageCode.nome} (${languageCode.codigo})`);
                }

                // Adicionar Página apenas em Português (se a pasta foi encontrada)
                if (plrFiles.landingPageFolderId && idiomas.find(lang => lang.codigo === 'pt-BR')) {
                  const paginaUrl = `https://drive.google.com/drive/folders/${plrFiles.landingPageFolderId}`;
                  const ptBrLanguage = idiomas.find(lang => lang.codigo === 'pt-BR');
                  // Ensure language exists in DB, create if not
                  let ptBrLanguageDb = await storage.getLanguageByCode('pt-BR');
                  if (!ptBrLanguageDb) {
                    ptBrLanguageDb = await storage.createLanguage({
                      name: ptBrLanguage.nome,
                      code: ptBrLanguage.codigo,
                    });
                  }

                  await storage.addPLRDownload({
                    plrId: plr.id,
                    type: 'landingpage',
                    languageId: ptBrLanguageDb.id,
                    fileUrl: paginaUrl,
                  });

                  logger.debug(`  🌐 Página adicionada em Português: ${paginaUrl}`);
                }
              } else {
                logger.debug(`  ⚠️  Link da pasta não encontrado`);
              }

              logger.debug(`  ✅ PLR importado com sucesso!`);
              imported++;
            } catch (error) {
              console.error(`  ❌ Erro ao importar ${plrName}:`, error);
              failed++;
            }
          }

          logger.debug('\n════════════════════════════════════════════════════════\n');
          logger.debug(`✅ Importação concluída!`);
          logger.debug(`   📊 Total: ${plrMap.size} PLRs`);
          logger.debug(`   ✅ Importados com sucesso: ${imported}`);
          logger.debug(`   ❌ Falhas: ${failed}\n`);
        } catch (error) {
          console.error('❌ Erro durante a importação:', error);
        }
      })();
    } catch (error) {
      console.error("Error starting import:", error);
      res.status(500).json({ message: "Erro ao iniciar importação" });
    }
  });


  // ==================== GOOGLE DRIVE TEST ROUTE ====================

  // Rota de teste para listar arquivos de uma pasta do Google Drive
  app.get('/api/drive/list-folder/:folderId', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { folderId } = req.params;
      const { getUncachableGoogleDriveClient, buildDirectFileUrl, buildThumbnailUrl } = await import('./drive-client');

      const drive = await getUncachableGoogleDriveClient();

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const files = response.data.files || [];

      res.json({
        success: true,
        folderId,
        totalFiles: files.length,
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          isFolder: file.mimeType === 'application/vnd.google-apps.folder'
        }))
      });
    } catch (error) {
      console.error("Error listing Google Drive folder:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao listar arquivos do Google Drive",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Rota pública para listar conteúdo de pastas do Google Drive
  app.get('/api/drive/folder/:folderId/contents', authMiddleware, async (req, res) => {
    try {
      const { folderId } = req.params;
      logger.debug(`[Google Drive] Listando conteúdo da pasta: ${folderId}`);
      const { listFolderContents } = await import('./google-drive');

      const files = await listFolderContents(folderId);
      logger.debug(`[Google Drive] Total de arquivos encontrados: ${files.length}`);

      if (files.length > 0) {
        logger.debug(`[Google Drive] Primeiros arquivos:`, files.slice(0, 3).map(f => ({ name: f.name, type: f.mimeType })));
      }

      res.json({
        success: true,
        folderId,
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          iconLink: file.iconLink,
          size: file.size,
          isFolder: file.mimeType === 'application/vnd.google-apps.folder',
          modifiedTime: file.modifiedTime,
        }))
      });
    } catch (error) {
      console.error("Error listing folder contents:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao listar conteúdo da pasta",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Rota para obter informações de um arquivo específico
  app.get('/api/drive/file/:fileId', authMiddleware, async (req, res) => {
    try {
      const { fileId } = req.params;
      const { getUncachableGoogleDriveClient, buildDirectFileUrl, buildThumbnailUrl } = await import('./drive-client');

      const drive = await getUncachableGoogleDriveClient();

      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, parents',
        supportsAllDrives: true
      });

      const file = response.data;

      res.json({
        success: true,
        file: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          thumbnailLink: file.thumbnailLink,
          parents: file.parents,
          directUrl: buildDirectFileUrl(file.id!),
          thumbnailUrl: buildThumbnailUrl(file.id!, 800)
        }
      });
    } catch (error) {
      console.error("Error getting Google Drive file:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao obter arquivo do Google Drive",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Clonador de Páginas - Clonar página
  app.post("/api/clone-page", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL é obrigatória" });
      }

      // Validar URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "URL inválida" });
      }

      logger.debug(`🌐 Clonando página: ${url}`);

      // Fazer requisição HTTP para obter o HTML
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000,
        maxRedirects: 5
      });

      let html = response.data;

      // Corrigir URLs relativas para absolutas
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      html = html
        .replace(/href=["'](?!http|\/\/|data:)([^"']+)["']/gi, (match: string, p1: string) => {
          const absoluteUrl = p1.startsWith('/') ? `${baseUrl}${p1}` : `${baseUrl}/${p1}`;
          return `href="${absoluteUrl}"`;
        })
        .replace(/src=["'](?!http|\/\/|data:)([^"']+)["']/gi, (match: string, p1: string) => {
          const absoluteUrl = p1.startsWith('/') ? `${baseUrl}${p1}` : `${baseUrl}/${p1}`;
          return `src="${absoluteUrl}"`;
        });

      logger.debug(`✅ Página clonada com sucesso! Tamanho: ${html.length} caracteres`);

      res.json({
        html,
        message: "Página clonada com sucesso"
      });

    } catch (error: any) {
      console.error("❌ Erro ao clonar página:", error);

      if (error.code === 'ENOTFOUND') {
        return res.status(400).json({ message: "URL não encontrada ou inacessível" });
      }

      if (error.code === 'ETIMEDOUT') {
        return res.status(408).json({ message: "Tempo esgotado ao tentar acessar a página" });
      }

      res.status(500).json({
        message: error.message || "Erro ao clonar página",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Clonador de Páginas - Listar páginas salvas
  app.get("/api/list-cloned-pages", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      logger.debug("[DEBUG] Listando páginas clonadas para userId:", userId);
      const pagesDir = path.join(process.cwd(), "cloned-pages");

      // Criar diretório se não existir
      if (!fs.existsSync(pagesDir)) {
        logger.debug("[DEBUG] Diretório não existe, criando...");
        fs.mkdirSync(pagesDir, { recursive: true });
        return res.json({ pages: [] });
      }

      const files = fs.readdirSync(pagesDir);
      const pages = files
        .filter(file => file.endsWith('.html'))
        .map(file => {
          const slug = file.replace('.html', '');
          const htmlPath = path.join(pagesDir, file);
          const metadataPath = path.join(pagesDir, `${slug}.metadata.json`);

          let createdAt: string;
          let viewCount = 0;
          let originalName: string | undefined;
          let pageUserId: string | null = null;

          let requiresDomain = false;
          let customDomain = null;
          let isActive = true;
          let timeRemaining = null;
          let hoursRemaining = null;

          let stats = fs.statSync(htmlPath);
          createdAt = stats.mtime.toISOString();

          // Tentar ler metadata.json
          if (fs.existsSync(metadataPath)) {
            try {
              const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
              const metadata = JSON.parse(metadataContent);
              pageUserId = metadata.userId || null;
              createdAt = metadata.createdAt;
              viewCount = metadata.viewCount || 0;
              originalName = metadata.originalName;
              requiresDomain = metadata.requiresDomain || false;
              customDomain = metadata.customDomain || null;
              isActive = metadata.isActive !== false;

              // Calcular tempo restante se requer domínio e não tem
              if (requiresDomain && !customDomain && createdAt) {
                const createdAtDate = new Date(createdAt);
                const now = new Date();
                const elapsedMs = now.getTime() - createdAtDate.getTime();
                const twentyFourHoursMs = 24 * 60 * 60 * 1000;
                const remainingMs = twentyFourHoursMs - elapsedMs;

                if (remainingMs > 0) {
                  hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
                  const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                  timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
                }
              }
            } catch (err) {
              console.error(`[DEBUG] Erro ao ler metadata de ${slug}:`, err);
              stats = fs.statSync(htmlPath);
              createdAt = stats.mtime.toISOString();
            }
          } else {
            stats = fs.statSync(htmlPath);
            createdAt = stats.mtime.toISOString();
          }

          // Se originalName não existir, extrair do slug (remover userCode e uniqueId)
          if (!originalName) {
            const parts = slug.split('-');
            if (parts.length > 2) {
              // Remove primeira parte (userCode) e última (uniqueId)
              originalName = parts.slice(1, -1).join('-');
            } else {
              originalName = slug;
            }
          }

          return {
            name: slug,
            originalName,
            createdAt,
            viewCount,
            requiresDomain,
            customDomain,
            isActive,
            timeRemaining,
            hoursRemaining,
            userId: pageUserId
          };
        })
        .filter(page => page.userId === userId); // CRÍTICO: Filtrar por userId

      logger.debug(`📄 Páginas clonadas encontradas: ${pages.length}`, pages);
      res.json({ pages });
    } catch (error: any) {
      console.error("Erro ao listar páginas:", error);
      res.status(500).json({
        message: "Erro ao listar páginas",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Obter HTML de página salva
  app.get("/api/get-cloned-page/:name", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { name } = req.params;
      const filePath = path.join(process.cwd(), "cloned-pages", `${name}.html`);
      const metadataPath = path.join(process.cwd(), "cloned-pages", `${name}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      // CRÍTICO: Verificar ownership
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de acesso não autorizado a página clonada: ${name} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
        } catch (e) {
          logger.warn(`[SECURITY] Erro ao validar ownership: ${name}`);
        }
      }

      const html = fs.readFileSync(filePath, 'utf-8');
      res.json({ html });
    } catch (error: any) {
      console.error("Erro ao obter página:", error);
      res.status(500).json({
        message: "Erro ao obter página",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Excluir página salva
  app.delete("/api/delete-cloned-page/:name", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { name } = req.params;
      const filePath = path.join(process.cwd(), "cloned-pages", `${name}.html`);
      const metadataPath = path.join(process.cwd(), "cloned-pages", `${name}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      // CRÍTICO: Limpar domínio customizado ANTES de deletar a página
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          // CRÍTICO: Verificar ownership
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de exclusão não autorizada: ${name} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
          if (metadata.customDomain) {
            logger.debug(`[CLONED-DELETE] Limpando domínio customizado: ${metadata.customDomain}`);
            
            // Remover do Cloudflare
            try {
              const { deleteCustomHostname } = await import('./utils/cloudflareForSaas');
              await deleteCustomHostname(metadata.customDomain);
              logger.debug(`[CLONED-DELETE] ✅ Domínio removido do Cloudflare: ${metadata.customDomain}`);
            } catch (cfError) {
              logger.warn(`[CLONED-DELETE] ⚠️ Erro ao remover do Cloudflare: ${cfError}`);
            }
            
            // Remover do banco de dados
            try {
              await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, metadata.customDomain));
              logger.debug(`[CLONED-DELETE] ✅ Domínio removido do banco: ${metadata.customDomain}`);
            } catch (dbError) {
              logger.warn(`[CLONED-DELETE] ⚠️ Erro ao remover do banco: ${dbError}`);
            }
          }
        } catch (metaError) {
          logger.warn(`[CLONED-DELETE] ⚠️ Erro ao ler metadata: ${metaError}`);
        }
        fs.unlinkSync(metadataPath);
      }

      fs.unlinkSync(filePath);
      res.json({ message: "Página excluída com sucesso" });
    } catch (error: any) {
      console.error("Erro ao excluir página:", error);
      res.status(500).json({
        message: "Erro ao excluir página",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Salvar página clonada com slug único
  app.post("/api/save-cloned-page", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const { name, html, isCloned } = req.body;

      if (!name || !html) {
        return res.status(400).json({ message: "Nome e HTML são obrigatórios" });
      }

      // Obter userId se autenticado (opcional)
      const userId = (req as any).user?.id;

      // Gerar slug único usando generateUniqueSlug
      const { generateUniqueSlug } = await import("./page-utils");
      const uniqueSlug = generateUniqueSlug(name, userId);

      logger.debug(`[SavePage] Criando novo projeto com slug: ${uniqueSlug} (nome original: ${name})`);

      const dir = path.join(process.cwd(), 'cloned-pages');

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Remover estilos de edição antes de salvar
      let cleanHtml = html
        .replace(/<style[^>]*data-edit-mode[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/class="[^"]*edit-(?:hover|highlight|hoverable)[^"]*"/gi, '');

      const filePath = path.join(dir, `${uniqueSlug}.html`);
      fs.writeFileSync(filePath, cleanHtml, 'utf8');

      // Criar metadata.json com createdAt, viewCount, userId, originalName e requiresDomain
      const metadataPath = path.join(dir, `${uniqueSlug}.metadata.json`);
      const metadata = {
        userId: userId || null,
        originalName: name, // Nome digitado pelo usuário
        createdAt: new Date().toISOString(),
        viewCount: 0,
        requiresDomain: true, // TODAS as páginas clonadas requerem domínio customizado
        customDomain: null,
        domainAddedAt: null,
        isActive: true
      };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      logger.debug(`💾 Página salva com sucesso: ${uniqueSlug}.html (nome original: ${name}, requer domínio em 24h)`);

      res.json({
        message: "Página salva com sucesso",
        name: uniqueSlug,
        originalName: name,
        requiresDomain: metadata.requiresDomain,
        path: `/pages/${uniqueSlug}`,
        url: `${req.protocol}://${req.get('host')}/pages/${uniqueSlug}`
      });
    } catch (error: any) {
      console.error("❌ Erro ao salvar página:", error);
      res.status(500).json({
        message: "Erro ao salvar página",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Injetar scripts de tracking (pixels, analytics, etc)
  app.post("/api/inject-tracking-fast", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { pageName, trackingCode, removeOldPixels, deactivateOtherScripts } = req.body;

      if (!pageName) {
        return res.status(400).json({ message: "Nome da página é obrigatório" });
      }

      // Sanitizar nome do arquivo
      const safeName = pageName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const dir = path.join(process.cwd(), 'cloned-pages');
      const filePath = path.join(dir, `${safeName}.html`);
      const metadataPath = path.join(dir, `${safeName}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      // CRÍTICO: Verificar ownership
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de injeção de tracking não autorizada: ${safeName} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
        } catch (e) {
          logger.warn(`[SECURITY] Erro ao validar ownership na injeção de tracking: ${safeName}`);
        }
      }

      // Ler HTML atual
      let html = fs.readFileSync(filePath, 'utf-8');
      logger.debug(`[inject-tracking-fast] 📄 HTML original: ${html.length} bytes`);

      // Parsear tracking codes (pode vir como string JSON ou objeto)
      let parsedTrackingCode = { head: null, body: null, footer: null };
      if (trackingCode) {
        if (typeof trackingCode === 'string') {
          try {
            parsedTrackingCode = JSON.parse(trackingCode);
          } catch (e) {
            logger.error('[inject-tracking-fast] Erro ao parsear trackingCode:', e);
          }
        } else {
          parsedTrackingCode = trackingCode;
        }
      }

      // Importar funções de manipulação de HTML
      const { intelligentScriptInjection } = await import('./page-utils');

      // Processar HTML com a função inteligente
      const processedHtml = await intelligentScriptInjection(
        html,
        parsedTrackingCode,
        removeOldPixels === true,
        deactivateOtherScripts === true
      );

      // Salvar HTML processado
      fs.writeFileSync(filePath, processedHtml, 'utf-8');
      logger.debug(`[inject-tracking-fast] ✅ HTML processado: ${processedHtml.length} bytes`);

      // Atualizar metadata com as configurações de tracking
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        metadata.trackingCodes = parsedTrackingCode;
        metadata.removeOldPixels = removeOldPixels || false;
        metadata.deactivateOtherScripts = deactivateOtherScripts || false;
        metadata.trackingUpdatedAt = new Date().toISOString();
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      }

      res.json({
        message: "Scripts instalados com sucesso",
        htmlSize: processedHtml.length
      });
    } catch (error: any) {
      logger.error("[inject-tracking-fast] Erro:", error);
      res.status(500).json({
        message: "Erro ao processar scripts",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Buscar metadata de tracking salvos
  app.get("/api/get-tracking-metadata/:pageName", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const { pageName } = req.params;

      if (!pageName) {
        return res.status(400).json({ message: "Nome da página é obrigatório" });
      }

      // Sanitizar nome do arquivo
      const safeName = pageName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const metadataPath = path.join(process.cwd(), 'cloned-pages', `${safeName}.metadata.json`);

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      res.json({
        trackingCodes: metadata.trackingCodes || null,
        removeOldPixels: metadata.removeOldPixels || false,
        deactivateOtherScripts: metadata.deactivateOtherScripts || false,
        trackingUpdatedAt: metadata.trackingUpdatedAt || null
      });
    } catch (error: any) {
      logger.error("[get-tracking-metadata] Erro:", error);
      res.status(500).json({
        message: "Erro ao buscar metadata",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Atualizar página clonada existente
  app.post("/api/update-cloned-page", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { name, html } = req.body;

      if (!name || !html) {
        return res.status(400).json({ message: "Nome e HTML são obrigatórios" });
      }

      // Sanitizar nome do arquivo
      const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const dir = path.join(process.cwd(), 'cloned-pages');
      const filePath = path.join(dir, `${safeName}.html`);
      const metadataPath = path.join(dir, `${safeName}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      // CRÍTICO: Verificar ownership
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de atualização não autorizada: ${safeName} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
        } catch (e) {
          logger.warn(`[SECURITY] Erro ao validar ownership na atualização: ${safeName}`);
        }
      }

      // LIMPEZA ULTRA COMPLETA - Remover todos os vestígios de edição
      let cleanHtml = html
        // Remover tags <style> com data-edit-mode
        .replace(/<style[^>]*data-edit-mode[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remover classes edit-* de forma mais inteligente
        .replace(/\s+class="([^ vital])edit-(?:hover|highlight|hoverable|hover-active)([^ vital])"/gi, (match, before, after) => {
          const cleaned = (before + after).trim().replace(/\s+/g, ' ');
          return cleaned ? ` class="${cleaned}"` : '';
        })
        // Remover atributos class vazios
        .replace(/\s+class=""\s*/gi, ' ')
        // Remover espaços duplos
        .replace(/\s\s+/g, ' ');

      fs.writeFileSync(filePath, cleanHtml, 'utf8');

      // Preservar ou criar metadata ao atualizar
      if (!fs.existsSync(metadataPath)) {
        // Se não existe metadata, criar com dados padrão
        const metadata = {
          createdAt: fs.statSync(filePath).mtime.toISOString(),
          viewCount: 0
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      }

      logger.debug(`💾 Página atualizada e LIMPA com sucesso: ${safeName}.html`);

      res.json({
        message: "Página atualizada com sucesso",
        name: safeName,
        path: `/pages/${safeName}`,
        url: `${req.protocol}://${req.get('host')}/pages/${safeName}`
      });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar página:", error);
      res.status(500).json({
        message: "Erro ao atualizar página",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Configurar domínio customizado
  // Sistema simplificado: salva no banco e metadata, SSL é automático via Cloudflare proxy do usuário
  app.post("/api/cloned-page/set-domain", authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { pageName, customDomain } = req.body;

      if (!pageName) {
        return res.status(400).json({ message: "Nome da página é obrigatório" });
      }

      const metadataPath = path.join(process.cwd(), "cloned-pages", `${pageName}.metadata.json`);

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      
      // CRÍTICO: Verificar ownership
      if (metadata.userId && metadata.userId !== userId) {
        logger.warn(`[SECURITY] Tentativa de configuração de domínio não autorizada: ${pageName} (userId: ${userId})`);
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Normaliza apenas: lowercase e remove https:// - NÃO remove www
      const normalizedDomain = customDomain && customDomain.trim() !== '' 
        ? customDomain.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
        : null;

      if (normalizedDomain) {
        // Verificar se o domínio já está sendo usado por outra página
        const existingMapping = await db.select()
          .from(customDomainMappings)
          .where(eq(customDomainMappings.domain, normalizedDomain))
          .limit(1);
        
        if (existingMapping.length > 0 && existingMapping[0].pageSlug !== pageName) {
          return res.status(400).json({
            message: "Este domínio já está configurado em outra página",
            existingPage: existingMapping[0].pageSlug
          });
        }

        const oldDomain = metadata.customDomain;
        
        // REGISTRAR NO CLOUDFLARE FOR SAAS para SSL funcionar
        const { createCustomHostname, deleteCustomHostname } = await import('./utils/cloudflareForSaas');
        
        // Remover hostname antigo do Cloudflare se mudou
        if (oldDomain && oldDomain !== normalizedDomain) {
          try {
            await deleteCustomHostname(oldDomain);
            logger.debug(`[CLONED-SET-DOMAIN] Hostname antigo removido do Cloudflare: ${oldDomain}`);
          } catch (e) {
            logger.warn(`[CLONED-SET-DOMAIN] Erro ao remover hostname antigo: ${e}`);
          }
        }
        
        // Registrar novo hostname no Cloudflare for SaaS
        let cloudflareHostnameId = null;
        let cloudflareStatus = 'pending';
        let sslStatus = 'initializing';
        
        try {
          const cfResult = await createCustomHostname(normalizedDomain);
          if (cfResult.success && cfResult.customHostname) {
            cloudflareHostnameId = cfResult.customHostname.id;
            cloudflareStatus = cfResult.customHostname.status;
            sslStatus = cfResult.customHostname.ssl?.status || 'initializing';
            logger.debug(`[CLONED-SET-DOMAIN] ✅ Hostname registrado no Cloudflare: ${normalizedDomain} (ID: ${cloudflareHostnameId})`);
          } else {
            logger.warn(`[CLONED-SET-DOMAIN] ⚠️ Falha ao registrar hostname no Cloudflare: ${JSON.stringify(cfResult.errors)}`);
          }
        } catch (cfError) {
          logger.error(`[CLONED-SET-DOMAIN] Erro ao registrar no Cloudflare:`, cfError);
        }
        
        // Salvar no metadata
        metadata.customDomain = normalizedDomain;
        metadata.domainAddedAt = new Date().toISOString();
        metadata.isActive = true;
        metadata.deactivatedAt = null;
        metadata.cloudflareHostnameId = cloudflareHostnameId;
        metadata.cloudflareStatus = cloudflareStatus;
        metadata.sslStatus = sslStatus;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        // Persistir no banco de dados
        try {
          // Remover mapeamento antigo se mudou de domínio
          if (oldDomain && oldDomain !== normalizedDomain) {
            await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
            logger.debug(`[CLONED-SET-DOMAIN] Mapeamento antigo removido: ${oldDomain}`);
          }
          
          const existing = await db.select().from(customDomainMappings).where(eq(customDomainMappings.domain, normalizedDomain)).limit(1);
          
          if (existing.length > 0) {
            await db.update(customDomainMappings)
              .set({
                pageSlug: pageName,
                pagePath: `/pages/${pageName}`,
                cloudflareHostnameId: cloudflareHostnameId,
                cloudflareStatus: cloudflareStatus,
                sslStatus: sslStatus,
                isActive: true,
                updatedAt: new Date()
              })
              .where(eq(customDomainMappings.domain, normalizedDomain));
            logger.debug(`[CLONED-SET-DOMAIN] Mapeamento atualizado no DB: ${normalizedDomain} -> /pages/${pageName}`);
          } else {
            await db.insert(customDomainMappings).values({
              domain: normalizedDomain,
              pageType: 'cloned',
              pageSlug: pageName,
              pagePath: `/pages/${pageName}`,
              cloudflareHostnameId: cloudflareHostnameId,
              cloudflareStatus: cloudflareStatus,
              sslStatus: sslStatus,
              isActive: true
            });
            logger.debug(`[CLONED-SET-DOMAIN] Mapeamento inserido no DB: ${normalizedDomain} -> /pages/${pageName}`);
          }
        } catch (dbError) {
          logger.error(`[CLONED-SET-DOMAIN] Erro ao salvar mapeamento no DB:`, dbError);
        }

        logger.debug(`✅ Domínio configurado: ${normalizedDomain} -> /pages/${pageName}`);

        res.json({
          message: "Domínio configurado com sucesso! Configure o DNS conforme as instruções abaixo.",
          customDomain: normalizedDomain,
          domainAddedAt: metadata.domainAddedAt,
          dnsInstructions: {
            cname: {
              type: 'CNAME',
              name: normalizedDomain.startsWith('www.') ? 'www' : '@',
              value: 'proxy.lowfy.com.br',
              description: 'Aponte seu domínio para o proxy da Lowfy'
            },
            note: 'Após configurar o CNAME, ative o proxy (nuvem laranja) no Cloudflare para SSL automático.'
          }
        });
      } else {
        // Remover domínio
        const oldDomain = metadata.customDomain;
        
        if (oldDomain) {
          // Remover do Cloudflare for SaaS
          try {
            const { deleteCustomHostname } = await import('./utils/cloudflareForSaas');
            await deleteCustomHostname(oldDomain);
            logger.debug(`[CLONED-SET-DOMAIN] Hostname removido do Cloudflare: ${oldDomain}`);
          } catch (cfError) {
            logger.warn(`[CLONED-SET-DOMAIN] Erro ao remover do Cloudflare: ${cfError}`);
          }
          
          // Remover do banco de dados
          try {
            await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
            logger.debug(`[CLONED-SET-DOMAIN] Mapeamento removido do DB: ${oldDomain}`);
          } catch (dbError) {
            logger.error(`[CLONED-SET-DOMAIN] Erro ao remover mapeamento do DB:`, dbError);
          }
        }

        // Limpar metadata
        metadata.customDomain = null;
        metadata.domainAddedAt = null;
        metadata.isActive = true;
        metadata.cloudflareHostnameId = null;
        metadata.cloudflareStatus = null;
        metadata.sslStatus = null;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        logger.debug(`✅ Domínio removido de ${pageName}`);

        res.json({
          message: "Domínio removido com sucesso",
          customDomain: null
        });
      }
    } catch (error: any) {
      console.error("Erro ao configurar domínio:", error);
      res.status(500).json({
        message: "Erro ao configurar domínio",
        error: error.message
      });
    }
  });

  // Verificar se domínio já está configurado em alguma página
  app.post("/api/check-domain-availability", async (req, res) => {
    try {
      const { domain } = req.body;

      if (!domain) {
        return res.status(400).json({ message: "Domínio é obrigatório" });
      }

      // NÃO normaliza www - cada subdomínio é único!
      const normalizedDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();

      // Verificar se o domínio já está sendo usado por outra página
      const clonedPagesDir = path.join(process.cwd(), "cloned-pages");
      const presellPagesDir = path.join(process.cwd(), "presell-pages");
      let existingPage = null;

      // Verificar páginas clonadas
      if (fs.existsSync(clonedPagesDir)) {
        const files = fs.readdirSync(clonedPagesDir).filter(f => f.endsWith('.metadata.json'));
        for (const file of files) {
          try {
            const metadata = JSON.parse(fs.readFileSync(path.join(clonedPagesDir, file), 'utf-8'));
            if (metadata.customDomain) {
              // NÃO normaliza www - comparação exata do domínio completo
              const existingDomain = metadata.customDomain.toLowerCase();
              if (existingDomain === normalizedDomain) {
                existingPage = {
                  type: 'cloned',
                  slug: file.replace('.metadata.json', ''),
                  originalName: metadata.originalName
                };
                break;
              }
            }
          } catch (e) {}
        }
      }

      // Verificar páginas presell
      if (!existingPage && fs.existsSync(presellPagesDir)) {
        const files = fs.readdirSync(presellPagesDir).filter(f => f.endsWith('.metadata.json'));
        for (const file of files) {
          try {
            const metadata = JSON.parse(fs.readFileSync(path.join(presellPagesDir, file), 'utf-8'));
            if (metadata.customDomain) {
              // NÃO normaliza www - comparação exata do domínio completo
              const existingDomain = metadata.customDomain.toLowerCase();
              if (existingDomain === normalizedDomain) {
                existingPage = {
                  type: 'presell',
                  slug: file.replace('.metadata.json', ''),
                  originalName: metadata.originalName
                };
                break;
              }
            }
          } catch (e) {}
        }
      }

      res.json({
        domain: normalizedDomain,
        isAvailable: !existingPage,
        existingPage,
        cnameTarget: 'app.lowfy.com.br'
      });
    } catch (error: any) {
      console.error("Erro ao verificar domínio:", error);
      res.status(500).json({
        message: "Erro ao verificar domínio",
        error: error.message
      });
    }
  });

  // Obter informações de configuração para domínio customizado
  app.get("/api/custom-domain-info", async (req, res) => {
    try {
      res.json({
        cnameTarget: 'proxy.lowfy.com.br',
        instructions: {
          steps: [
            "1. Acesse o painel DNS do provedor do domínio",
            "2. Adicione um registro CNAME:",
            "   - Nome: @ (ou seu subdomínio)",
            "   - Destino: proxy.lowfy.com.br",
            "3. Salve o domínio aqui na Lowfy",
            "4. Aguarde validação automática do SSL (alguns minutos)"
          ]
        },
        sslAutomatic: true,
        provider: 'Cloudflare for SaaS'
      });
    } catch (error: any) {
      console.error("Erro ao obter informações de domínio:", error);
      res.status(500).json({
        message: "Erro ao obter informações",
        error: error.message
      });
    }
  });

  // Verificar status do domínio no Cloudflare
  app.get("/api/custom-domain-status/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const { getCustomHostname, getStatusDescription } = await import('./utils/cloudflareForSaas');
      
      const hostname = await getCustomHostname(domain);
      
      if (!hostname) {
        return res.json({
          found: false,
          domain,
          message: "Domínio não encontrado no Cloudflare"
        });
      }

      const statusInfo = getStatusDescription(hostname.status);
      const sslStatusInfo = getStatusDescription(hostname.ssl?.status || 'pending');

      res.json({
        found: true,
        domain: hostname.hostname,
        id: hostname.id,
        status: hostname.status,
        statusLabel: statusInfo.label,
        statusColor: statusInfo.color,
        statusDescription: statusInfo.description,
        ssl: {
          status: hostname.ssl?.status,
          statusLabel: sslStatusInfo.label,
          statusColor: sslStatusInfo.color,
          method: hostname.ssl?.method
        },
        createdAt: hostname.created_at,
        cnameTarget: 'proxy.lowfy.com.br'
      });
    } catch (error: any) {
      console.error("Erro ao verificar status do domínio:", error);
      res.status(500).json({
        message: "Erro ao verificar status",
        error: error.message
      });
    }
  });

  // Atualizar/Refrescar validação do domínio
  app.post("/api/custom-domain-refresh/:domain", async (req, res) => {
    try {
      const { domain } = req.params;
      const { refreshCustomHostnameValidation, getStatusDescription } = await import('./utils/cloudflareForSaas');
      
      const hostname = await refreshCustomHostnameValidation(domain);
      
      if (!hostname) {
        return res.status(404).json({
          message: "Domínio não encontrado"
        });
      }

      const statusInfo = getStatusDescription(hostname.status);

      res.json({
        domain: hostname.hostname,
        status: hostname.status,
        statusLabel: statusInfo.label,
        statusColor: statusInfo.color,
        ssl: {
          status: hostname.ssl?.status,
          method: hostname.ssl?.method
        }
      });
    } catch (error: any) {
      console.error("Erro ao atualizar validação:", error);
      res.status(500).json({
        message: "Erro ao atualizar validação",
        error: error.message
      });
    }
  });

  // Verificar status do domínio - VERIFICA DE VERDADE no Cloudflare for SaaS
  app.get("/api/custom-domains/:domain/check", async (req, res) => {
    try {
      const { domain } = req.params;
      
      // NÃO normaliza www - cada subdomínio é único!
      const normalizedDomain = domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .trim();
      
      // Buscar mapeamento no banco de dados
      const dbMapping = await db.select()
        .from(customDomainMappings)
        .where(eq(customDomainMappings.domain, normalizedDomain))
        .limit(1);
      
      if (dbMapping.length === 0 || !dbMapping[0].isActive) {
        return res.json({
          found: false,
          domain: normalizedDomain,
          status: 'not_configured',
          statusLabel: 'Não Configurado',
          statusColor: 'gray',
          message: 'Domínio não está configurado no sistema.'
        });
      }
      
      const mapping = dbMapping[0];
      
      // VERIFICAÇÃO REAL: Se não tem cloudflare_hostname_id, ainda não está registrado
      if (!mapping.cloudflareHostnameId) {
        return res.json({
          found: true,
          domain: normalizedDomain,
          status: 'pending_registration',
          statusLabel: 'Pendente',
          statusColor: 'yellow',
          ssl: {
            status: 'pending',
            statusLabel: 'Pendente',
          },
          message: 'Domínio salvo mas ainda não registrado no Cloudflare. Aguarde alguns minutos ou reconfigure.',
          needsSync: true
        });
      }
      
      // VERIFICAÇÃO REAL: Consultar status atual no Cloudflare
      try {
        const { getCustomHostname, getStatusDescription, getCustomHostnameById } = await import('./utils/cloudflareForSaas');
        
        // Primeiro tenta buscar pelo hostname
        let cfHostname = await getCustomHostname(normalizedDomain);
        
        // Se não encontrou pelo hostname mas temos ID, tenta pelo ID
        if (!cfHostname && mapping.cloudflareHostnameId) {
          logger.info(`[CHECK-DOMAIN] Hostname não encontrado por nome, tentando por ID: ${mapping.cloudflareHostnameId}`);
          cfHostname = await getCustomHostnameById(mapping.cloudflareHostnameId);
          
          // Se também não encontrou pelo ID, o hostname foi deletado do Cloudflare
          if (!cfHostname) {
            logger.warn(`[CHECK-DOMAIN] Hostname ${normalizedDomain} deletado do Cloudflare. Limpando ID do banco.`);
            
            // Limpar o cloudflareHostnameId do banco pois o hostname não existe mais
            await db.update(customDomainMappings)
              .set({
                cloudflareHostnameId: null,
                cloudflareStatus: 'deleted',
                sslStatus: null,
                updatedAt: new Date()
              })
              .where(eq(customDomainMappings.domain, normalizedDomain));
            
            return res.json({
              found: true,
              domain: normalizedDomain,
              status: 'deleted_from_cloudflare',
              statusLabel: 'Removido',
              statusColor: 'red',
              ssl: {
                status: 'none',
                statusLabel: 'Não configurado'
              },
              message: 'O domínio foi removido do Cloudflare. Por favor, reconfigure o domínio salvando a página novamente.',
              needsSync: true,
              isFullyActive: false
            });
          }
        }
        
        if (cfHostname) {
          const statusInfo = getStatusDescription(cfHostname.status);
          const sslStatusInfo = getStatusDescription(cfHostname.ssl?.status || 'pending');
          
          // Atualizar banco com status atual do Cloudflare
          await db.update(customDomainMappings)
            .set({
              cloudflareStatus: cfHostname.status,
              sslStatus: cfHostname.ssl?.status || 'pending',
              updatedAt: new Date()
            })
            .where(eq(customDomainMappings.domain, normalizedDomain));
          
          const isActive = cfHostname.status === 'active' && cfHostname.ssl?.status === 'active';
          
          // Mensagem detalhada baseada no status
          let message = '';
          if (isActive) {
            message = 'Domínio ativo e funcionando!';
          } else if (cfHostname.status === 'blocked') {
            message = 'Domínio bloqueado pelo Cloudflare. Verifique se o DNS está configurado corretamente.';
          } else if (cfHostname.ssl?.status === 'pending_validation') {
            message = 'Aguardando validação do SSL. Configure o registro CNAME corretamente.';
          } else if (cfHostname.ssl?.status === 'pending_issuance') {
            message = 'SSL em processo de emissão. Aguarde alguns minutos.';
          } else if (cfHostname.ssl?.status === 'pending_deployment') {
            message = 'SSL emitido, aguardando deploy. Falta pouco!';
          } else {
            message = `Status: ${statusInfo.label}. SSL: ${sslStatusInfo.label}. Aguarde a ativação.`;
          }
          
          // Extrair registros TXT necessários para validação
          let txtRecords: Array<{name: string; value: string; type: string}> = [];
          
          // TXT para validação SSL (ACME challenge)
          if (cfHostname.ssl?.txt_name && cfHostname.ssl?.txt_value) {
            txtRecords.push({
              type: 'ssl',
              name: cfHostname.ssl.txt_name,
              value: cfHostname.ssl.txt_value
            });
          } else if (cfHostname.ssl?.validation_records) {
            cfHostname.ssl.validation_records.forEach((rec: any) => {
              if (rec.txt_name && rec.txt_value) {
                txtRecords.push({
                  type: 'ssl',
                  name: rec.txt_name,
                  value: rec.txt_value
                });
              }
            });
          }
          
          // TXT para ownership verification
          if (cfHostname.ownership_verification?.name && cfHostname.ownership_verification?.value) {
            txtRecords.push({
              type: 'ownership',
              name: cfHostname.ownership_verification.name,
              value: cfHostname.ownership_verification.value
            });
          }
          
          return res.json({
            found: true,
            domain: normalizedDomain,
            status: cfHostname.status,
            statusLabel: statusInfo.label,
            statusColor: statusInfo.color,
            ssl: {
              status: cfHostname.ssl?.status || 'pending',
              statusLabel: sslStatusInfo.label,
              statusColor: sslStatusInfo.color,
              method: cfHostname.ssl?.method
            },
            isFullyActive: isActive,
            message,
            txtRecords: txtRecords.length > 0 ? txtRecords : null,
            dnsInstructions: !isActive ? {
              cname: {
                type: 'CNAME',
                name: normalizedDomain.startsWith('www.') ? 'www' : '@',
                value: 'proxy.lowfy.com.br'
              }
            } : null
          });
        } else {
          // Hostname não encontrado no Cloudflare - precisa ser registrado
          return res.json({
            found: true,
            domain: normalizedDomain,
            status: 'not_in_cloudflare',
            statusLabel: 'Não Registrado',
            statusColor: 'red',
            ssl: {
              status: 'pending',
              statusLabel: 'Pendente'
            },
            message: 'Domínio não está registrado no Cloudflare. Salve a página novamente para registrar.',
            needsSync: true,
            isFullyActive: false
          });
        }
      } catch (cfError: any) {
        logger.warn(`[CHECK-DOMAIN] Erro ao consultar Cloudflare para ${normalizedDomain}:`, cfError);
        
        // Verificar tipo de erro
        const isTimeout = cfError?.message?.includes('Timeout') || cfError?.isTimeout;
        const isNetworkError = cfError?.message?.includes('network') || cfError?.isNetworkError;
        
        if (isTimeout) {
          return res.json({
            found: true,
            domain: normalizedDomain,
            status: 'cloudflare_timeout',
            statusLabel: 'Timeout',
            statusColor: 'orange',
            ssl: {
              status: 'unknown',
              statusLabel: 'Desconhecido'
            },
            message: 'O Cloudflare não respondeu a tempo. Tente verificar novamente em alguns segundos.',
            isFullyActive: false,
            cloudflareUnavailable: true
          });
        }
        
        if (isNetworkError) {
          return res.json({
            found: true,
            domain: normalizedDomain,
            status: 'cloudflare_unavailable',
            statusLabel: 'Indisponível',
            statusColor: 'orange',
            ssl: {
              status: 'unknown',
              statusLabel: 'Desconhecido'
            },
            message: 'Não foi possível conectar ao Cloudflare. Verifique sua conexão e tente novamente.',
            isFullyActive: false,
            cloudflareUnavailable: true
          });
        }
        
        // Fallback: usar dados do banco com aviso claro
        const statusLabel = mapping.cloudflareStatus === 'active' ? 'Ativo (cache)' : 'Pendente (cache)';
        const statusColor = mapping.cloudflareStatus === 'active' ? 'green' : 'yellow';
        
        return res.json({
          found: true,
          domain: normalizedDomain,
          status: mapping.cloudflareStatus || 'pending',
          statusLabel,
          statusColor,
          ssl: {
            status: mapping.sslStatus || 'pending',
            statusLabel: mapping.sslStatus === 'active' ? 'Ativo (cache)' : 'Pendente (cache)'
          },
          message: 'Erro ao verificar status em tempo real. Mostrando último status conhecido. Tente novamente.',
          lastCheck: mapping.updatedAt,
          isFullyActive: mapping.cloudflareStatus === 'active' && mapping.sslStatus === 'active',
          cloudflareError: true
        });
      }
    } catch (error: any) {
      console.error("Erro ao verificar status do domínio:", error);
      res.status(500).json({
        message: "Erro ao verificar status",
        error: error.message
      });
    }
  });

  // Admin: Obter/Configurar fallback origin
  app.get("/api/admin/cloudflare-fallback-origin", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { getFallbackOrigin } = await import('./utils/cloudflareForSaas');
      const origin = await getFallbackOrigin();
      
      res.json({
        origin: origin?.origin || null,
        status: origin?.status || 'not_configured',
        configured: !!origin?.origin
      });
    } catch (error: any) {
      console.error("Erro ao obter fallback origin:", error);
      res.status(500).json({
        message: "Erro ao obter fallback origin",
        error: error.message
      });
    }
  });

  app.post("/api/admin/cloudflare-fallback-origin", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { origin } = req.body;
      
      if (!origin) {
        return res.status(400).json({ message: "Origin é obrigatório" });
      }

      const { setFallbackOrigin } = await import('./utils/cloudflareForSaas');
      const success = await setFallbackOrigin(origin);
      
      if (success) {
        res.json({
          message: "Fallback origin configurado com sucesso",
          origin
        });
      } else {
        res.status(500).json({
          message: "Erro ao configurar fallback origin"
        });
      }
    } catch (error: any) {
      console.error("Erro ao configurar fallback origin:", error);
      res.status(500).json({
        message: "Erro ao configurar fallback origin",
        error: error.message
      });
    }
  });

  // Admin: Listar todos os custom hostnames
  app.get("/api/admin/custom-hostnames", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { listCustomHostnames, getStatusDescription } = await import('./utils/cloudflareForSaas');
      
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 50;
      
      const result = await listCustomHostnames(page, perPage);
      
      const hostnames = result.hostnames.map(h => ({
        id: h.id,
        hostname: h.hostname,
        status: h.status,
        statusInfo: getStatusDescription(h.status),
        ssl: {
          status: h.ssl?.status,
          statusInfo: getStatusDescription(h.ssl?.status || 'pending'),
          method: h.ssl?.method
        },
        createdAt: h.created_at
      }));

      res.json({
        hostnames,
        totalCount: result.totalCount,
        page,
        perPage
      });
    } catch (error: any) {
      console.error("Erro ao listar hostnames:", error);
      res.status(500).json({
        message: "Erro ao listar hostnames",
        error: error.message
      });
    }
  });

  // Admin: Sincronizar domínios pendentes com Cloudflare for SaaS
  app.post("/api/admin/sync-cloudflare-hostnames", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { createCustomHostname } = await import('./utils/cloudflareForSaas');
      
      // Buscar todos os domínios sem cloudflare_hostname_id
      const pendingDomains = await db.select()
        .from(customDomainMappings)
        .where(sql`${customDomainMappings.cloudflareHostnameId} IS NULL AND ${customDomainMappings.isActive} = true`);
      
      const results = [];
      
      for (const mapping of pendingDomains) {
        try {
          const cfResult = await createCustomHostname(mapping.domain);
          
          if (cfResult.success && cfResult.customHostname) {
            // Atualizar no banco
            await db.update(customDomainMappings)
              .set({
                cloudflareHostnameId: cfResult.customHostname.id,
                cloudflareStatus: cfResult.customHostname.status,
                sslStatus: cfResult.customHostname.ssl?.status || 'initializing',
                updatedAt: new Date()
              })
              .where(eq(customDomainMappings.domain, mapping.domain));
            
            results.push({
              domain: mapping.domain,
              success: true,
              hostnameId: cfResult.customHostname.id,
              status: cfResult.customHostname.status
            });
            
            logger.debug(`[SYNC-CF] ✅ Registrado: ${mapping.domain} (ID: ${cfResult.customHostname.id})`);
          } else {
            results.push({
              domain: mapping.domain,
              success: false,
              error: cfResult.error || 'Unknown error'
            });
            logger.warn(`[SYNC-CF] ❌ Falha ao registrar: ${mapping.domain}`);
          }
        } catch (err: any) {
          results.push({
            domain: mapping.domain,
            success: false,
            error: err.message
          });
          logger.error(`[SYNC-CF] Erro ao registrar ${mapping.domain}:`, err);
        }
      }
      
      res.json({
        message: `Sincronização concluída. ${results.filter(r => r.success).length}/${pendingDomains.length} domínios registrados.`,
        results
      });
    } catch (error: any) {
      console.error("Erro ao sincronizar hostnames:", error);
      res.status(500).json({
        message: "Erro ao sincronizar hostnames",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Obter status da página (domínio, tempo restante, etc)
  app.get("/api/cloned-page/status/:pageName", async (req, res) => {
    try {
      const { pageName } = req.params;
      const metadataPath = path.join(process.cwd(), "cloned-pages", `${pageName}.metadata.json`);

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      // Calcular tempo restante se requer domínio
      let timeRemaining = null;
      let hoursRemaining = null;
      let isExpired = false;

      if (metadata.requiresDomain && !metadata.customDomain && metadata.createdAt) {
        const createdAt = new Date(metadata.createdAt);
        const now = new Date();
        const elapsedMs = now.getTime() - createdAt.getTime();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const remainingMs = twentyFourHoursMs - elapsedMs;

        if (remainingMs > 0) {
          hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
        } else {
          isExpired = true;
          timeRemaining = "Expirado";

          // Persistir desativação automática
          if (metadata.isActive !== false) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            logger.debug(`⚠️ Página ${pageName} desativada automaticamente por falta de domínio`);
          }
        }
      }

      res.json({
        requiresDomain: metadata.requiresDomain || false,
        customDomain: metadata.customDomain || null,
        domainAddedAt: metadata.domainAddedAt || null,
        isActive: metadata.isActive !== false,
        deactivatedAt: metadata.deactivatedAt || null,
        createdAt: metadata.createdAt,
        timeRemaining,
        hoursRemaining,
        isExpired
      });
    } catch (error: any) {
      console.error("Erro ao obter status da página:", error);
      res.status(500).json({
        message: "Erro ao obter status",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Verificar e desativar páginas expiradas (chamado por scheduler)
  app.post("/api/cloned-page/check-expired", async (req, res) => {
    try {
      const pagesDir = path.join(process.cwd(), "cloned-pages");

      if (!fs.existsSync(pagesDir)) {
        return res.json({ message: "Nenhuma página para verificar", deactivated: [] });
      }

      const files = fs.readdirSync(pagesDir);
      const deactivatedPages = [];

      for (const file of files) {
        if (!file.endsWith('.metadata.json')) continue;

        const metadataPath = path.join(pagesDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

        // Verificar se requer domínio e não tem domínio configurado
        if (metadata.requiresDomain && !metadata.customDomain && metadata.isActive !== false) {
          const createdAt = new Date(metadata.createdAt);
          const now = new Date();
          const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          // Se passou 24 horas, desativar
          if (elapsedHours >= 24) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

            const pageName = file.replace('.metadata.json', '');
            deactivatedPages.push(pageName);
            logger.debug(`⚠️ Página desativada por falta de domínio: ${pageName}`);
          }
        }
      }

      res.json({
        message: `Verificação concluída. ${deactivatedPages.length} página(s) desativada(s)`,
        deactivated: deactivatedPages
      });
    } catch (error: any) {
      console.error("Erro ao verificar páginas expiradas:", error);
      res.status(500).json({
        message: "Erro ao verificar páginas",
        error: error.message
      });
    }
  });

  // Clonador de Páginas - Upload de imagem (usando Object Storage para persistência)
  app.post('/api/upload-image', upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhuma imagem fornecida' });
      }

      const file = req.file;

      // SECURITY: Validar MIME type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: 'Tipo de arquivo não permitido. Use: JPEG, JPG, PNG, GIF, WebP ou AVIF'
        });
      }

      // SECURITY: Validar tamanho do arquivo (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(500).json({ message: 'Imagem muito grande. Tamanho máximo: 5MB' });
      }

      // Converter para WebP para otimização
      const webpBuffer = await sharp(file.buffer)
        .webp({ quality: 85 })
        .toBuffer();

      // Upload para Object Storage (persiste em produção)
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadBuffer(webpBuffer, 'uploads');

      logger.debug(`✅ Imagem salva no Object Storage: ${imageUrl}`);

      res.json({
        url: imageUrl,
        message: 'Upload realizado com sucesso'
      });

    } catch (error: any) {
      console.error('❌ Erro no upload de imagem:', error);
      res.status(500).json({
        message: 'Erro ao fazer upload da imagem',
        error: error.message
      });
    }
  });

  // ==================== PRE-SELL BUILDER ROUTES ====================

  app.get('/api/presell/list', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const dir = path.join(process.cwd(), 'presell-pages');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return res.json({ pages: [] });
      }

      const files = fs.readdirSync(dir);
      const pages = files
        .filter(file => file.endsWith('.json') && !file.includes('.metadata.'))
        .map(file => {
          const name = file.replace('.json', '');
          const filePath = path.join(dir, file);
          const metadataPath = path.join(dir, `${name}.metadata.json`);
          const stats = fs.statSync(filePath);

          let viewCount = 0;
          let clickCount = 0;
          let requiresDomain = true;
          let customDomain = null;
          let isActive = true;
          let timeRemaining = null;
          let hoursRemaining = null;
          let createdAt = stats.mtime.toISOString();
          let pageUserId: string | null = null;

          if (fs.existsSync(metadataPath)) {
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
              pageUserId = metadata.userId || null;
              viewCount = metadata.viewCount || 0;
              clickCount = metadata.clickCount || 0;
              requiresDomain = metadata.requiresDomain !== false;
              customDomain = metadata.customDomain || null;
              isActive = metadata.isActive !== false;
              createdAt = metadata.createdAt || createdAt;

              if (requiresDomain && !customDomain && createdAt) {
                const createdAtDate = new Date(createdAt);
                const now = new Date();
                const elapsedMs = now.getTime() - createdAtDate.getTime();
                const twentyFourHoursMs = 24 * 60 * 60 * 1000;
                const remainingMs = twentyFourHoursMs - elapsedMs;

                if (remainingMs > 0) {
                  hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
                  const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                  timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
                }
              }
            } catch (e) {
              console.error(`Erro ao ler metadata de ${name}:`, e);
            }
          }

          return {
            name,
            createdAt,
            viewCount,
            clickCount,
            requiresDomain,
            customDomain,
            isActive,
            timeRemaining,
            hoursRemaining,
            userId: pageUserId
          };
        })
        .filter(page => page.userId === userId) // CRÍTICO: Filtrar por userId
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ pages });
    } catch (error: any) {
      console.error('Erro ao listar Pre-Sells:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/presell/get/:name', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const { name } = req.params;
      const filePath = path.join(process.cwd(), 'presell-pages', `${name}.json`);
      const metadataPath = path.join(process.cwd(), 'presell-pages', `${name}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Página não encontrada' });
      }

      // CRÍTICO: Verificar ownership
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de acesso não autorizado ao presell: ${name} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
        } catch (e) {
          logger.warn(`[SECURITY] Erro ao validar ownership do presell: ${name}`);
        }
      }

      const pageData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Incluir customDomain do metadata
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        pageData.customDomain = metadata.customDomain || null;
      }
      
      res.json(pageData);
    } catch (error: any) {
      console.error('Erro ao carregar Pre-Sell:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/presell/save', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const pageData = req.body;

      if (!pageData.name) {
        return res.status(400).json({ message: 'Nome da página é obrigatório' });
      }

      // Use slug if available, otherwise generate from name
      const slug = pageData.slug || pageData.name.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/^-+|-+$/g, '');

      logger.debug(`[PRESELL-SAVE] Salvando página: ${pageData.name} -> slug: ${slug}`);

      const dir = path.join(process.cwd(), 'presell-pages');

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save with slug as filename
      const filePath = path.join(dir, `${slug}.json`);
      const dataToSave = { ...pageData, name: slug, slug: slug };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      logger.debug(`[PRESELL-SAVE] Arquivo criado: ${filePath}`);

      // Criar ou atualizar metadata.json - PRESERVAR dados existentes
      const metadataPath = path.join(dir, `${slug}.metadata.json`);
      let metadata: any = {
        userId: userId, // CRÍTICO: Adicionar userId
        createdAt: new Date().toISOString(),
        viewCount: 0,
        clickCount: 0,
        requiresDomain: true,
        customDomain: null,
        domainAddedAt: null,
        isActive: true
      };
      
      // Se metadata já existe, preservar valores importantes
      if (fs.existsSync(metadataPath)) {
        const existingMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        // CRÍTICO: Verificar se a página já pertence a outro usuário
        if (existingMetadata.userId && existingMetadata.userId !== userId) {
          logger.warn(`[SECURITY] Tentativa de sobrescrever presell de outro usuário: ${slug} (userId: ${userId})`);
          return res.status(403).json({ message: "Acesso negado" });
        }
        metadata = {
          ...metadata,
          userId: existingMetadata.userId || userId, // Manter userId original ou definir novo
          createdAt: existingMetadata.createdAt || metadata.createdAt,
          viewCount: existingMetadata.viewCount || 0,
          clickCount: existingMetadata.clickCount || 0,
          customDomain: existingMetadata.customDomain || null,
          domainAddedAt: existingMetadata.domainAddedAt || null,
          isActive: existingMetadata.isActive !== undefined ? existingMetadata.isActive : true
        };
      }
      
      // Se pageData.customDomain foi enviado, atualizar (pode vir do modal de configurações)
      if (pageData.customDomain !== undefined) {
        // NÃO normaliza www - cada subdomínio é único!
        const normalizedDomain = pageData.customDomain && pageData.customDomain.trim() !== ''
          ? pageData.customDomain.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
          : null;
        
        if (normalizedDomain !== metadata.customDomain) {
          const oldDomain = metadata.customDomain;
          
          // IMPORTANTE: Registrar no Cloudflare for SaaS para SSL funcionar
          const { createCustomHostname, deleteCustomHostname } = await import('./utils/cloudflareForSaas');
          
          // Remover hostname antigo do Cloudflare se existia
          if (oldDomain && oldDomain !== normalizedDomain) {
            try {
              await deleteCustomHostname(oldDomain);
              logger.debug(`[PRESELL-SAVE] Hostname antigo removido do Cloudflare: ${oldDomain}`);
            } catch (cfError) {
              logger.error(`[PRESELL-SAVE] Erro ao remover hostname antigo do Cloudflare:`, cfError);
            }
          }
          
          let cloudflareHostnameId = null;
          let cloudflareStatus = null;
          let sslStatus = null;
          let dcvDelegationCname = null;
          let dcvDelegationTarget = null;
          let ownershipTxtName = null;
          let ownershipTxtValue = null;
          
          // Registrar novo hostname no Cloudflare - OBRIGATÓRIO para SSL funcionar
          if (normalizedDomain) {
            try {
              const cfResult = await createCustomHostname(normalizedDomain);
              if (cfResult.success && cfResult.customHostname) {
                cloudflareHostnameId = cfResult.customHostname.id;
                cloudflareStatus = cfResult.customHostname.status;
                sslStatus = cfResult.customHostname.ssl?.status || 'initializing';
                dcvDelegationCname = cfResult.dcvDelegation?.cname || null;
                dcvDelegationTarget = cfResult.dcvDelegation?.cnameTarget || null;
                ownershipTxtName = cfResult.ownershipVerification?.txtName || null;
                ownershipTxtValue = cfResult.ownershipVerification?.txtValue || null;
                logger.debug(`[PRESELL-SAVE] ✅ Hostname registrado no Cloudflare: ${normalizedDomain} (ID: ${cloudflareHostnameId})`);
              } else {
                logger.error(`[PRESELL-SAVE] ❌ Falha ao registrar hostname no Cloudflare: ${cfResult.error}`);
                return res.status(400).json({ 
                  message: `Erro ao configurar domínio no Cloudflare: ${cfResult.error}`,
                  error: cfResult.error
                });
              }
            } catch (cfError: any) {
              logger.error(`[PRESELL-SAVE] ❌ Erro ao registrar hostname no Cloudflare:`, cfError);
              return res.status(500).json({ 
                message: `Erro ao configurar domínio: ${cfError.message}`,
                error: cfError.message
              });
            }
          }
          
          metadata.customDomain = normalizedDomain;
          metadata.domainAddedAt = normalizedDomain ? new Date().toISOString() : null;
          metadata.cloudflareHostnameId = cloudflareHostnameId;
          metadata.cloudflareStatus = cloudflareStatus;
          metadata.sslStatus = sslStatus;
          metadata.dcvDelegationCname = dcvDelegationCname;
          metadata.dcvDelegationTarget = dcvDelegationTarget;
          metadata.ownershipTxtName = ownershipTxtName;
          metadata.ownershipTxtValue = ownershipTxtValue;
          logger.debug(`[PRESELL-SAVE] Domínio atualizado: ${normalizedDomain}`);
          
          // Persistir no banco de dados para funcionar em produção
          try {
            // Remover mapeamento antigo se existia
            if (oldDomain) {
              await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
              logger.debug(`[PRESELL-SAVE] Mapeamento antigo removido do DB: ${oldDomain}`);
            }
            
            // Inserir novo mapeamento se há domínio
            if (normalizedDomain) {
              // Verificar se já existe
              const existing = await db.select().from(customDomainMappings).where(eq(customDomainMappings.domain, normalizedDomain)).limit(1);
              
              if (existing.length > 0) {
                // Atualizar existente
                await db.update(customDomainMappings)
                  .set({
                    pageSlug: slug,
                    pagePath: `/presell/${slug}`,
                    userId: req.user?.id,
                    cloudflareHostnameId,
                    cloudflareStatus,
                    sslStatus,
                    dcvDelegationCname,
                    dcvDelegationTarget,
                    ownershipTxtName,
                    ownershipTxtValue,
                    isActive: true,
                    updatedAt: new Date()
                  })
                  .where(eq(customDomainMappings.domain, normalizedDomain));
                logger.debug(`[PRESELL-SAVE] Mapeamento atualizado no DB: ${normalizedDomain} -> /presell/${slug}`);
              } else {
                // Inserir novo
                await db.insert(customDomainMappings).values({
                  domain: normalizedDomain,
                  pageType: 'presell',
                  pageSlug: slug,
                  pagePath: `/presell/${slug}`,
                  userId: req.user?.id,
                  cloudflareHostnameId,
                  cloudflareStatus,
                  sslStatus,
                  dcvDelegationCname,
                  dcvDelegationTarget,
                  ownershipTxtName,
                  ownershipTxtValue,
                  isActive: true
                });
                logger.debug(`[PRESELL-SAVE] Mapeamento inserido no DB: ${normalizedDomain} -> /presell/${slug}`);
              }
            }
          } catch (dbError) {
            logger.error(`[PRESELL-SAVE] Erro ao salvar mapeamento no DB:`, dbError);
          }
        }
      }
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      logger.debug(`[PRESELL-SAVE] Metadata salvo: ${metadataPath}`);

      logger.debug(`✅ Pre-Sell salva: ${slug}.json (requer domínio em 24h)`);

      res.json({
        message: 'Pre-Sell salva com sucesso',
        name: slug,
        slug: slug,
        url: `${req.protocol}://${req.get('host')}/presell/${slug}`
      });
    } catch (error: any) {
      console.error('❌ [PRESELL-SAVE] Erro ao salvar Pre-Sell:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/presell/update', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const userId = (req as any).user?.id;
      const pageData = req.body;

      if (!pageData.name) {
        return res.status(400).json({ message: 'Nome da página é obrigatório' });
      }

      const safeName = pageData.name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const filePath = path.join(process.cwd(), 'presell-pages', `${safeName}.json`);
      const metadataPath = path.join(process.cwd(), 'presell-pages', `${safeName}.metadata.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Página não encontrada' });
      }

      // CRÍTICO: Verificar ownership
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.userId && metadata.userId !== userId) {
            logger.warn(`[SECURITY] Tentativa de atualização não autorizada do presell: ${safeName} (userId: ${userId})`);
            return res.status(403).json({ message: "Acesso negado" });
          }
        } catch (e) {
          logger.warn(`[SECURITY] Erro ao validar ownership na atualização de presell: ${safeName}`);
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(pageData, null, 2), 'utf-8');

      // Atualizar metadata com customDomain se fornecido
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        // NÃO normaliza www - cada subdomínio é único!
        const normalizedDomain = pageData.customDomain && pageData.customDomain.trim() !== ''
          ? pageData.customDomain.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
          : null;
        
        if (normalizedDomain !== metadata.customDomain) {
          const oldDomain = metadata.customDomain;
          
          // IMPORTANTE: Registrar no Cloudflare for SaaS para SSL funcionar
          const { createCustomHostname, deleteCustomHostname } = await import('./utils/cloudflareForSaas');
          
          // Remover hostname antigo do Cloudflare se existia
          if (oldDomain && oldDomain !== normalizedDomain) {
            try {
              await deleteCustomHostname(oldDomain);
              logger.debug(`[PRESELL-UPDATE] Hostname antigo removido do Cloudflare: ${oldDomain}`);
            } catch (cfError) {
              logger.error(`[PRESELL-UPDATE] Erro ao remover hostname antigo do Cloudflare:`, cfError);
            }
          }
          
          let cloudflareHostnameId = metadata.cloudflareHostnameId || null;
          let cloudflareStatus = metadata.cloudflareStatus || null;
          let sslStatus = metadata.sslStatus || null;
          let dcvDelegationCname = metadata.dcvDelegationCname || null;
          let dcvDelegationTarget = metadata.dcvDelegationTarget || null;
          let ownershipTxtName = metadata.ownershipTxtName || null;
          let ownershipTxtValue = metadata.ownershipTxtValue || null;
          
          // Registrar novo hostname no Cloudflare - OBRIGATÓRIO para SSL funcionar
          if (normalizedDomain) {
            try {
              const cfResult = await createCustomHostname(normalizedDomain);
              if (cfResult.success && cfResult.customHostname) {
                cloudflareHostnameId = cfResult.customHostname.id;
                cloudflareStatus = cfResult.customHostname.status;
                sslStatus = cfResult.customHostname.ssl?.status || 'initializing';
                dcvDelegationCname = cfResult.dcvDelegation?.cname || null;
                dcvDelegationTarget = cfResult.dcvDelegation?.cnameTarget || null;
                ownershipTxtName = cfResult.ownershipVerification?.txtName || null;
                ownershipTxtValue = cfResult.ownershipVerification?.txtValue || null;
                logger.debug(`[PRESELL-UPDATE] ✅ Hostname registrado no Cloudflare: ${normalizedDomain} (ID: ${cloudflareHostnameId})`);
              } else {
                logger.error(`[PRESELL-UPDATE] ❌ Falha ao registrar hostname no Cloudflare: ${cfResult.error}`);
                return res.status(400).json({ 
                  message: `Erro ao configurar domínio no Cloudflare: ${cfResult.error}`,
                  error: cfResult.error
                });
              }
            } catch (cfError: any) {
              logger.error(`[PRESELL-UPDATE] ❌ Erro ao registrar hostname no Cloudflare:`, cfError);
              return res.status(500).json({ 
                message: `Erro ao configurar domínio: ${cfError.message}`,
                error: cfError.message
              });
            }
          }
          
          metadata.customDomain = normalizedDomain;
          metadata.domainAddedAt = normalizedDomain ? new Date().toISOString() : null;
          metadata.cloudflareHostnameId = cloudflareHostnameId;
          metadata.cloudflareStatus = cloudflareStatus;
          metadata.sslStatus = sslStatus;
          metadata.dcvDelegationCname = dcvDelegationCname;
          metadata.dcvDelegationTarget = dcvDelegationTarget;
          metadata.ownershipTxtName = ownershipTxtName;
          metadata.ownershipTxtValue = ownershipTxtValue;
          logger.debug(`[PRESELL-UPDATE] Domínio atualizado: ${normalizedDomain}`);
          
          // Persistir no banco de dados para funcionar em produção
          try {
            // Remover mapeamento antigo se existia
            if (oldDomain) {
              await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
              logger.debug(`[PRESELL-UPDATE] Mapeamento antigo removido do DB: ${oldDomain}`);
            }
            
            // Inserir novo mapeamento se há domínio
            if (normalizedDomain) {
              // Verificar se já existe
              const existing = await db.select().from(customDomainMappings).where(eq(customDomainMappings.domain, normalizedDomain)).limit(1);
              
              if (existing.length > 0) {
                // Atualizar existente
                await db.update(customDomainMappings)
                  .set({
                    pageSlug: safeName,
                    pagePath: `/presell/${safeName}`,
                    userId: req.user?.id,
                    cloudflareHostnameId,
                    cloudflareStatus,
                    sslStatus,
                    dcvDelegationCname,
                    dcvDelegationTarget,
                    ownershipTxtName,
                    ownershipTxtValue,
                    isActive: true,
                    updatedAt: new Date()
                  })
                  .where(eq(customDomainMappings.domain, normalizedDomain));
                logger.debug(`[PRESELL-UPDATE] Mapeamento atualizado no DB: ${normalizedDomain} -> /presell/${safeName}`);
              } else {
                // Inserir novo
                await db.insert(customDomainMappings).values({
                  domain: normalizedDomain,
                  pageType: 'presell',
                  pageSlug: safeName,
                  pagePath: `/presell/${safeName}`,
                  userId: req.user?.id,
                  cloudflareHostnameId,
                  cloudflareStatus,
                  sslStatus,
                  dcvDelegationCname,
                  dcvDelegationTarget,
                  ownershipTxtName,
                  ownershipTxtValue,
                  isActive: true
                });
                logger.debug(`[PRESELL-UPDATE] Mapeamento inserido no DB: ${normalizedDomain} -> /presell/${safeName}`);
              }
            }
          } catch (dbError) {
            logger.error(`[PRESELL-UPDATE] Erro ao salvar mapeamento no DB:`, dbError);
          }
        }
        
        // Atualizar também SEO e scripts no metadata
        if (pageData.seo) {
          metadata.seo = pageData.seo;
        }
        if (pageData.scripts) {
          metadata.scripts = pageData.scripts;
        }
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      }

      res.json({
        message: 'Pre-Sell atualizada com sucesso',
        name: safeName
      });
    } catch (error: any) {
      console.error('Erro ao atualizar Pre-Sell:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/presell/delete/:name', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const { name } = req.params;
      const filePath = path.join(process.cwd(), 'presell-pages', `${name}.json`);
      const metadataPath = path.join(process.cwd(), 'presell-pages', `${name}.metadata.json`);


      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Página não encontrada' });
      }

      // CRÍTICO: Limpar domínio customizado ANTES de deletar a página
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.customDomain) {
            logger.debug(`[PRESELL-DELETE] Limpando domínio customizado: ${metadata.customDomain}`);
            
            // Remover do Cloudflare
            try {
              const { deleteCustomHostname } = await import('./utils/cloudflareForSaas');
              await deleteCustomHostname(metadata.customDomain);
              logger.debug(`[PRESELL-DELETE] ✅ Domínio removido do Cloudflare: ${metadata.customDomain}`);
            } catch (cfError) {
              logger.warn(`[PRESELL-DELETE] ⚠️ Erro ao remover do Cloudflare: ${cfError}`);
            }
            
            // Remover do banco de dados
            try {
              await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, metadata.customDomain));
              logger.debug(`[PRESELL-DELETE] ✅ Domínio removido do banco: ${metadata.customDomain}`);
            } catch (dbError) {
              logger.warn(`[PRESELL-DELETE] ⚠️ Erro ao remover do banco: ${dbError}`);
            }
          }
        } catch (metaError) {
          logger.warn(`[PRESELL-DELETE] ⚠️ Erro ao ler metadata: ${metaError}`);
        }
        fs.unlinkSync(metadataPath);
      }

      fs.unlinkSync(filePath);
      res.json({ message: 'Pre-Sell excluída com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir Pre-Sell:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Pre-Sell - Configurar domínio customizado
  // Usa Cloudflare for SaaS API para SSL automático
  app.post('/api/presell/configure-domain/:pageName', authMiddleware, subscriptionMiddleware, async (req: any, res) => {
    try {
      const { pageName } = req.params;
      const { customDomain } = req.body;

      if (!pageName) {
        return res.status(400).json({ message: "Nome da página é obrigatório" });
      }

      const metadataPath = path.join(process.cwd(), "presell-pages", `${pageName}.metadata.json`);

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      // NÃO normaliza www - cada subdomínio é único!
      const normalizedDomain = customDomain && customDomain.trim() !== '' 
        ? customDomain.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
        : null;

      if (normalizedDomain) {
        const { createCustomHostname, deleteCustomHostname } = await import('./utils/cloudflareForSaas');
        
        if (metadata.customDomain && metadata.customDomain !== normalizedDomain) {
          await deleteCustomHostname(metadata.customDomain);
        }

        const cfResult = await createCustomHostname(normalizedDomain);
        
        if (!cfResult.success) {
          return res.status(400).json({
            message: "Erro ao configurar domínio no Cloudflare",
            error: cfResult.error
          });
        }

        const oldDomain = metadata.customDomain;
        metadata.customDomain = normalizedDomain;
        metadata.domainAddedAt = new Date().toISOString();
        metadata.cloudflareHostnameId = cfResult.customHostname?.id;
        metadata.cloudflareStatus = cfResult.customHostname?.status;
        metadata.sslStatus = cfResult.customHostname?.ssl?.status;
        metadata.dcvDelegationCname = cfResult.dcvDelegation?.cname || null;
        metadata.dcvDelegationTarget = cfResult.dcvDelegation?.cnameTarget || null;
        metadata.ownershipTxtName = cfResult.ownershipVerification?.txtName || null;
        metadata.ownershipTxtValue = cfResult.ownershipVerification?.txtValue || null;
        metadata.isActive = true;
        metadata.deactivatedAt = null;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        // Persistir no banco de dados para funcionar em produção
        try {
          if (oldDomain && oldDomain !== normalizedDomain) {
            await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
            logger.debug(`[PRESELL-CONFIGURE-DOMAIN] Mapeamento antigo removido: ${oldDomain}`);
          }
          
          const existing = await db.select().from(customDomainMappings).where(eq(customDomainMappings.domain, normalizedDomain)).limit(1);
          
          if (existing.length > 0) {
            await db.update(customDomainMappings)
              .set({
                pageSlug: pageName,
                pagePath: `/presell/${pageName}`,
                userId: req.user?.id,
                cloudflareHostnameId: cfResult.customHostname?.id,
                cloudflareStatus: cfResult.customHostname?.status,
                sslStatus: cfResult.customHostname?.ssl?.status,
                dcvDelegationCname: cfResult.dcvDelegation?.cname || null,
                dcvDelegationTarget: cfResult.dcvDelegation?.cnameTarget || null,
                ownershipTxtName: cfResult.ownershipVerification?.txtName || null,
                ownershipTxtValue: cfResult.ownershipVerification?.txtValue || null,
                isActive: true,
                updatedAt: new Date()
              })
              .where(eq(customDomainMappings.domain, normalizedDomain));
            logger.debug(`[PRESELL-CONFIGURE-DOMAIN] Mapeamento atualizado no DB: ${normalizedDomain} -> /presell/${pageName}`);
          } else {
            await db.insert(customDomainMappings).values({
              domain: normalizedDomain,
              pageType: 'presell',
              pageSlug: pageName,
              pagePath: `/presell/${pageName}`,
              userId: req.user?.id,
              cloudflareHostnameId: cfResult.customHostname?.id,
              cloudflareStatus: cfResult.customHostname?.status,
              sslStatus: cfResult.customHostname?.ssl?.status,
              dcvDelegationCname: cfResult.dcvDelegation?.cname || null,
              dcvDelegationTarget: cfResult.dcvDelegation?.cnameTarget || null,
              ownershipTxtName: cfResult.ownershipVerification?.txtName || null,
              ownershipTxtValue: cfResult.ownershipVerification?.txtValue || null,
              isActive: true
            });
            logger.debug(`[PRESELL-CONFIGURE-DOMAIN] Mapeamento inserido no DB: ${normalizedDomain} -> /presell/${pageName}`);
          }
        } catch (dbError) {
          logger.error(`[PRESELL-CONFIGURE-DOMAIN] Erro ao salvar mapeamento no DB:`, dbError);
        }

        logger.debug(`✅ Domínio configurado via Cloudflare for SaaS para presell: ${normalizedDomain}`);

        res.json({
          message: "Domínio registrado! Configure os registros DNS conforme as instruções abaixo.",
          customDomain: normalizedDomain,
          domainAddedAt: metadata.domainAddedAt,
          cnameTarget: cfResult.cnameTarget || 'proxy.lowfy.com.br',
          cloudflareStatus: cfResult.customHostname?.status,
          sslStatus: cfResult.customHostname?.ssl?.status,
          validationInstructions: cfResult.validationInstructions,
          dcvDelegation: cfResult.dcvDelegation ? {
            cname: cfResult.dcvDelegation.cname,
            cnameTarget: cfResult.dcvDelegation.cnameTarget,
            instructions: `Configure um registro CNAME: ${cfResult.dcvDelegation.cname} -> ${cfResult.dcvDelegation.cnameTarget}`
          } : null,
          ownershipVerification: cfResult.ownershipVerification ? {
            txtName: cfResult.ownershipVerification.txtName,
            txtValue: cfResult.ownershipVerification.txtValue,
            instructions: `Configure um registro TXT: ${cfResult.ownershipVerification.txtName} com valor ${cfResult.ownershipVerification.txtValue}`
          } : null,
          dnsInstructions: {
            cname: {
              type: 'CNAME',
              name: '@',
              value: 'proxy.lowfy.com.br',
              description: 'Redireciona seu domínio para a Lowfy'
            },
            dcvDelegation: cfResult.dcvDelegation ? {
              type: 'CNAME',
              name: cfResult.dcvDelegation.cname,
              value: cfResult.dcvDelegation.cnameTarget,
              description: 'Necessário para validação do SSL'
            } : null,
            ownershipTxt: cfResult.ownershipVerification ? {
              type: 'TXT',
              name: cfResult.ownershipVerification.txtName,
              value: cfResult.ownershipVerification.txtValue,
              description: 'Comprova propriedade do domínio'
            } : null
          }
        });
      } else {
        const oldDomain = metadata.customDomain;
        if (oldDomain) {
          const { deleteCustomHostname } = await import('./utils/cloudflareForSaas');
          await deleteCustomHostname(oldDomain);
          
          // Remover do banco de dados também
          try {
            await db.delete(customDomainMappings).where(eq(customDomainMappings.domain, oldDomain));
            logger.debug(`[PRESELL-CONFIGURE-DOMAIN] Mapeamento removido do DB: ${oldDomain}`);
          } catch (dbError) {
            logger.error(`[PRESELL-CONFIGURE-DOMAIN] Erro ao remover mapeamento do DB:`, dbError);
          }
        }

        metadata.customDomain = null;
        metadata.domainAddedAt = null;
        metadata.cloudflareHostnameId = null;
        metadata.cloudflareStatus = null;
        metadata.sslStatus = null;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        logger.debug(`✅ Domínio removido de presell ${pageName}`);

        res.json({
          message: "Domínio removido",
          customDomain: null
        });
      }
    } catch (error: any) {
      console.error("Erro ao configurar domínio:", error);
      res.status(500).json({
        message: "Erro ao configurar domínio",
        error: error.message
      });
    }
  });

  // Pre-Sell - Upload de imagem otimizada (SECURED)
  app.post('/api/presell/upload-image', authMiddleware, upload.single('image'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhuma imagem fornecida' });
      }

      const file = req.file;

      // SECURITY: Validate MIME type FIRST (before any processing)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: 'Tipo de arquivo não permitido. Use: JPEG, JPG, PNG, GIF, WebP ou AVIF'
        });
      }

      // SECURITY: Validate file size BEFORE processing (4MB max)
      if (file.size > 4 * 1024 * 1024) {
        return res.status(400).json({ message: 'Imagem muito grande. Tamanho máximo: 4MB' });
      }

      // Optimize image with Sharp
      const fileBuffer = await sharp(file.buffer)
        .resize(2560, 2560, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Upload to Object Storage for persistence in production
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const imageUrl = await objectStorageService.uploadBuffer(fileBuffer, 'presell');

      logger.debug(`✅ Imagem otimizada salva: ${imageUrl}`);

      res.json({
        success: true,
        imageUrl,
        size: fileBuffer.length
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload de imagem:', error);
      res.status(500).json({
        message: 'Erro ao fazer upload de imagem',
        error: error.message
      });
    }
  });

  // Pre-Sell - Upload de favicon (SECURED)
  app.post('/api/upload/favicon', authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo fornecido' });
      }

      const file = req.file;

      // SECURITY: Validate MIME type for favicon
      const allowedTypes = ['image/x-icon', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/vnd.microsoft.icon'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: 'Tipo de arquivo não permitido. Use: ICO, PNG, JPG ou SVG'
        });
      }

      // SECURITY: Validate file size (1MB max for favicon)
      if (file.size > 1 * 1024 * 1024) {
        return res.status(400).json({ message: 'Favicon muito grande. Tamanho máximo: 1MB' });
      }

      // Get file extension
      const ext = (path.extname(file.originalname).toLowerCase() || '.png').replace('.', '');

      // Upload to Object Storage for persistence in production
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const faviconUrl = await objectStorageService.uploadBuffer(file.buffer, 'favicons', file.mimetype, ext);

      logger.debug(`✅ Favicon salvo: ${faviconUrl}`);

      res.json({
        success: true,
        url: faviconUrl
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload de favicon:', error);
      res.status(500).json({
        message: 'Erro ao fazer upload de favicon',
        error: error.message
      });
    }
  });

  // Pre-Sell - Upload de OG Image (SECURED)
  app.post('/api/upload/og-image', authMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo fornecido' });
      }

      const file = req.file;

      // SECURITY: Validate MIME type for OG images
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: 'Tipo de arquivo não permitido. Use: PNG, JPG ou WebP'
        });
      }

      // SECURITY: Validate file size (5MB max for OG image)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: 'Imagem muito grande. Tamanho máximo: 5MB' });
      }

      // Optimize image to WebP
      const webpBuffer = await sharp(file.buffer)
        .resize(1200, 630, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Upload to Object Storage for persistence in production
      const { ObjectStorageService } = await import('./objectStorage');
      const objectStorageService = new ObjectStorageService();
      const ogImageUrl = await objectStorageService.uploadBuffer(webpBuffer, 'og-images');

      logger.debug(`✅ OG Image salva: ${ogImageUrl}`);

      res.json({
        success: true,
        url: ogImageUrl
      });
    } catch (error: any) {
      console.error('Erro ao fazer upload de OG image:', error);
      res.status(500).json({
        message: 'Erro ao fazer upload de OG image',
        error: error.message
      });
    }
  });

  // Pre-Sell - Obter status da página (domínio, tempo restante, etc)
  app.get("/api/presell/status/:pageName", async (req, res) => {
    try {
      const { pageName } = req.params;
      const metadataPath = path.join(process.cwd(), "presell-pages", `${pageName}.metadata.json`);

      if (!fs.existsSync(metadataPath)) {
        return res.status(404).json({ message: "Página não encontrada" });
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      let timeRemaining = null;
      let hoursRemaining = null;
      let isExpired = false;

      if (metadata.requiresDomain && !metadata.customDomain && metadata.createdAt) {
        const createdAt = new Date(metadata.createdAt);
        const now = new Date();
        const elapsedMs = now.getTime() - createdAt.getTime();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const remainingMs = twentyFourHoursMs - elapsedMs;

        if (remainingMs > 0) {
          hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${hoursRemaining}h ${minutesRemaining}m`;
        } else {
          isExpired = true;
          timeRemaining = "Expirado";

          if (metadata.isActive !== false) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            logger.debug(`⚠️ Presell ${pageName} desativada automaticamente por falta de domínio`);
          }
        }
      }

      res.json({
        requiresDomain: metadata.requiresDomain || false,
        customDomain: metadata.customDomain || null,
        domainAddedAt: metadata.domainAddedAt || null,
        isActive: metadata.isActive !== false,
        deactivatedAt: metadata.deactivatedAt || null,
        createdAt: metadata.createdAt,
        timeRemaining,
        hoursRemaining,
        isExpired
      });
    } catch (error: any) {
      console.error("Erro ao obter status da presell:", error);
      res.status(500).json({
        message: "Erro ao obter status",
        error: error.message
      });
    }
  });

  // Pre-Sell - Verificar e desativar páginas expiradas (chamado por scheduler)
  app.post("/api/presell/check-expired", async (req, res) => {
    try {
      const pagesDir = path.join(process.cwd(), "presell-pages");

      if (!fs.existsSync(pagesDir)) {
        return res.json({ message: "Nenhuma página presell encontrada", deactivated: [] });
      }

      const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.metadata.json'));
      const deactivatedPages: string[] = [];

      for (const file of files) {
        const metadataPath = path.join(pagesDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

        if (metadata.requiresDomain && !metadata.customDomain && metadata.isActive !== false) {
          const createdAt = new Date(metadata.createdAt);
          const now = new Date();
          const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          if (elapsedHours >= 24) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

            const pageName = file.replace('.metadata.json', '');
            deactivatedPages.push(pageName);
            logger.debug(`⚠️ Presell desativada por falta de domínio: ${pageName}`);
          }
        }
      }

      res.json({
        message: `Verificação concluída. ${deactivatedPages.length} presell(s) desativada(s)`,
        deactivated: deactivatedPages
      });
    } catch (error: any) {
      console.error("Erro ao verificar presells expiradas:", error);
      res.status(500).json({
        message: "Erro ao verificar presells",
        error: error.message
      });
    }
  });

  // Adicionar rota de rastreamento de cliques (com rastreamento único por usuário)
  app.post('/api/presell/:slug/track-click', async (req, res) => {
    try {
      const { slug } = req.params;
      const metadataPath = path.join(process.cwd(), 'presell-pages', `${slug}.metadata.json`);

      // Sistema de rastreamento único de cliques usando cookies
      const clickCookieName = `presell_clicked_${slug}`;
      const hasClicked = req.cookies?.[clickCookieName] === 'true';

      // Se o usuário já clicou, não contar novamente
      if (hasClicked) {
        return res.status(200).json({ message: 'Clique já registrado anteriormente', alreadyTracked: true });
      }

      // Verificar se o arquivo metadata existe
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        metadata.clickCount = (metadata.clickCount || 0) + 1; // Incrementar contador de cliques
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        logger.debug(`[ClickTrack] Clique único registrado para ${slug}:`, metadata.clickCount);
      } else {
        // Se não existe, criar com contador inicial
        const metadata = {
          createdAt: new Date().toISOString(),
          viewCount: 0
        };
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        logger.debug(`[ClickTrack] Novo metadata criado para ${slug} com clique único: 1`);
      }

      // Definir cookie para marcar que o usuário já clicou (válido por 30 dias)
      res.cookie(clickCookieName, 'true', {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
        httpOnly: true,
        sameSite: 'lax'
      });

      res.status(200).json({ message: 'Clique único rastreado com sucesso', alreadyTracked: false });
    } catch (error: any) {
      console.error('Erro ao rastrear clique:', error);
      res.status(500).json({ message: 'Erro ao rastrear clique' });
    }
  });


  // Servir Pre-Sell ao público (DEVE vir DEPOIS das rotas específicas como /presell/preview)
  // A rota /presell/preview é tratada pelo frontend (App.tsx), não pelo servidor
  app.get('/presell/:slug', async (req, res) => {
    try {
      let { slug } = req.params;

      // Ignorar /preview - deixar o frontend tratar
      if (slug === 'preview') {
        return res.status(404).send('Use o preview através do builder');
      }

      // Normalizar slug para lowercase para evitar problemas
      slug = slug.toLowerCase();

      const filePath = path.join(process.cwd(), 'presell-pages', `${slug}.json`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Pre-Sell não encontrada');
      }

      // Sistema de contagem de visualizações únicas
      const metadataPath = path.join(process.cwd(), 'presell-pages', `${slug}.metadata.json`);
      const viewCookieName = `presell_viewed_${slug}`;

      // Verificar se já visualizou (cookie)
      const hasViewed = req.cookies?.[viewCookieName] === 'true';

      // Validar se pageData tem a estrutura correta
      let pageData: any;
      try {
        pageData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!pageData || !pageData.elements || !Array.isArray(pageData.elements)) {
          throw new Error('Estrutura de dados inválida');
        }
      } catch (error) {
        console.error('Erro ao ler ou parsear página:', error);
        return res.status(500).send('Erro ao carregar página: dados corrompidos');
      }

      // Verificar se página foi desativada por falta de domínio
      let metadata;
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

        // VERIFICAR SE REQUER DOMÍNIO E NÃO TEM DOMÍNIO CONFIGURADO
        if (metadata.requiresDomain && !metadata.customDomain) {
          const createdAt = new Date(metadata.createdAt);
          const now = new Date();
          const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          // Se passou 24 horas, desativar automaticamente
          if (elapsedHours >= 24) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
            logger.debug(`⚠️ Presell ${slug} desativada automaticamente por falta de domínio`);
          }
        }

        // VERIFICAR SE PÁGINA FOI DESATIVADA POR FALTA DE DOMÍNIO
        if (metadata.requiresDomain && !metadata.customDomain && metadata.isActive === false) {
          const warningHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Desativada</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #FEE2E2; /* Light red */
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      color: #dc2626; /* Red */
    }
    h1 {
      font-size: 28px;
      color: #1f2937; /* Dark gray */
      margin-bottom: 16px;
      font-weight: 600;
    }
    p {
      color: #6b7280; /* Medium gray */
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .highlight {
      color: #667eea; /* Primary blue */
      font-weight: 600;
    }
    .warning-box {
      background: #fef3c7; /* Light yellow */
      border-left: 4px solid #f59e0b; /* Orange border */
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
      text-align: left;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .warning-box strong {
      color: #92400e; /* Dark brown */
      display: block;
      margin-bottom: 8px;
    }
    .warning-box span {
      color: #78350f; /* Brown */
      font-size: 14px;
    }
    .footer {
      color: #9ca3af; /* Light gray */
      font-size: 14px;
      margin-top: 24px;
    }
    .button {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s ease-in-out;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    .button:hover {
      transform: translateY(-3px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Página Temporariamente Indisponível</h1>
    <p>
      Esta presell foi desativada porque não foi configurado um domínio customizado dentro do prazo de 24 horas.
    </p>
    <div class="warning-box">
      <strong>📌 Para o proprietário:</strong>
      <span>Configure seu domínio customizado no painel de gerenciamento para reativar esta presell.</span>
    </div>
    <p class="footer">
      Desativada em: ${new Date(metadata.deactivatedAt).toLocaleString('pt-BR')}
    </p>
  </div>
</body>
</html>`;
          return res.status(403).send(warningHTML);
        }
      }

      // Atualizar contagem de visualizações
      try {
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

          // Se não contou a visualização ainda, conta e setta cookie
          if (!hasViewed) {
            metadata.viewCount = (metadata.viewCount || 0) + 1;
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

            res.cookie(viewCookieName, 'true', {
              maxAge: 24 * 60 * 60 * 1000,
              httpOnly: true,
              sameSite: 'lax'
            });
          }
        } else {
          // Criar metadata se não existir
          metadata = {
            createdAt: fs.statSync(filePath).mtime.toISOString(),
            viewCount: 1,
            requiresDomain: true,
            customDomain: null,
            isActive: true
          };
          fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

          // Definir cookie de visualização
          res.cookie(viewCookieName, 'true', {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax'
          });
        }
      } catch (metaError) {
        console.error("Erro ao atualizar viewCount:", metaError);
      }


      const html = generatePreSellHTML(pageData);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error: any) {
      console.error('Erro ao servir Pre-Sell:', error);
      res.status(500).send('Erro ao carregar página');
    }
  });

  // Função auxiliar para converter URLs de vídeo para formato embed
  function convertToEmbedUrl(url: string): string {
    if (!url) return '';
    
    // YouTube
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    
    // Vimeo
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
    }
    
    // Se já for URL de embed ou outra URL, retornar como está
    return url;
  }

  function generatePreSellHTML(page: any): string {
    // Validar elementos antes de processar
    if (!page.elements || !Array.isArray(page.elements)) {
      console.error('Elementos da página inválidos');
      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
</head>
<body>
  <h1>Erro ao carregar página</h1>
  <p>Os dados da página estão corrompidos.</p>
</body>
</html>`;
    }

    const elementsHTML = page.elements.map((el: any) => {
      const paddingStyle = `${el.styles?.paddingTop || '0px'} ${el.styles?.paddingRight || '0px'} ${el.styles?.paddingBottom || '0px'} ${el.styles?.paddingLeft || '0px'}`;
      const marginStyle = el.styles?.fullWidth
        ? 'calc(-50vw + 50%) calc(-50vw + 50%) 0 0'
        : `${el.styles?.marginTop || '0px'} ${el.styles?.marginRight || '0px'} ${el.styles?.marginBottom || '0px'} ${el.styles?.marginLeft || '0px'}`;
      const widthStyle = el.styles?.fullWidth ? 'width: 100vw; max-width: 100vw;' : '';

      switch (el.type) {
        case 'headline':
          return `<h1 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle}; ${widthStyle}">${el.content}</h1>`;

        case 'subheadline':
          return `<h2 style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle}; ${widthStyle}">${el.content}</h2>`;

        case 'video':
          const embedUrl = convertToEmbedUrl(el.styles?.videoUrl || '');
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle}; ${widthStyle}"><iframe width="100%" height="400" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

        case 'text':
          return `<p style="text-align: ${el.styles?.textAlign}; font-size: ${el.styles?.fontSize}; color: ${el.styles?.color}; padding: ${paddingStyle}; margin: ${marginStyle}; white-space: pre-wrap; ${widthStyle}">${el.content}</p>`;

        case 'button':
          const buttonEffect = el.styles?.buttonEffect || 'none';
          const buttonDelay = el.styles?.buttonDelay || 0;
          const buttonId = `btn-${el.id}`;

          let animationCSS = '';
          // Efeitos já estão definidos na função generatePreSellHTML
          // Se necessário, ajustar aqui ou garantir que a animação seja aplicada corretamente.

          const onclickAttr = `onclick="trackClick('${page.name}')"`;
          const targetAttr = el.styles?.buttonOpenNewTab !== false ? 'target="_blank" rel="noopener noreferrer"' : 'target="_self"';

          return `
            <style>
              @keyframes pulse-${el.id} { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
              @keyframes shake-${el.id} { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
              @keyframes bounce-${el.id} { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
              @keyframes glow-${el.id} { 0%, 100% { box-shadow: 0 0 10px ${el.styles?.backgroundColor}; } 50% { box-shadow: 0 0 20px ${el.styles?.backgroundColor}, 0 0 30px ${el.styles?.backgroundColor}; } }
              .btn-${el.id} { transition: all 0.3s; }
              ${buttonEffect === 'pulse' ? `.btn-${el.id} { animation: pulse-${el.id} 1.5s ease-in-out infinite; }` : ''}
              ${buttonEffect === 'shake' ? `.btn-${el.id} { animation: shake-${el.id} 0.8s ease-in-out infinite; }` : ''}
              ${buttonEffect === 'bounce' ? `.btn-${el.id} { animation: bounce-${el.id} 1s ease-in-out infinite; }` : ''}
              ${buttonEffect === 'glow' ? `.btn-${el.id} { animation: glow-${el.id} 2s ease-in-out infinite; }` : ''}
            </style>
            <div id="${buttonId}-wrapper" style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle}; ${widthStyle} display: none;">
              <a href="${el.styles?.buttonUrl}" ${targetAttr} class="btn-${el.id}" style="display: inline-block; background-color: ${el.styles?.backgroundColor}; color: ${el.styles?.color}; font-size: ${el.styles?.fontSize}; padding: 18px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; cursor: pointer;">${el.content}</a>
            </div>
            <script>
              setTimeout(() => {
                const wrapper = document.getElementById('${buttonId}-wrapper');
                if(wrapper) wrapper.style.display = 'block';
              }, ${buttonDelay * 1000});
            </script>
          `;

        case 'image':
          return `<div style="text-align: ${el.styles?.textAlign}; padding: ${paddingStyle}; margin: ${marginStyle}; ${widthStyle}"><img src="${el.styles?.imageUrl}" alt="${el.content}" style="width: ${el.styles?.imageWidth || '100%'}; height: auto; max-width: 100%; display: block; margin: 0 auto; border-radius: 8px;"></div>`;

        case 'divider':
          return `<hr style="border: none; border-top: 2px solid #ddd; margin: 30px 0;">`;

        case 'countdown':
          const safeMinutes = Number(el.styles?.countdownMinutes) || 60;
          const countdownId = el.id.replace(/-/g, '');
          const countdownTextColor = el.styles?.countdownTextColor || '#ffffff';
          const countdownBgColor = el.styles?.countdownBgColor || '#ff0000';
          const countdownPrefix = el.styles?.countdownPrefix || 'Falta apenas: ';
          const countdownFontSize = el.styles?.fontSize || '24px';

          return `
            <div id="${el.id}" style="text-align: ${el.styles?.textAlign}; font-size: ${countdownFontSize}; color: ${countdownTextColor}; background-color: ${countdownBgColor}; padding: ${paddingStyle}; margin: 0; width: 100vw; max-width: 100vw; margin-left: calc(-50vw + 50%); font-weight: bold; position: sticky; top: 0; z-index: 1000;">
              ${countdownPrefix}<span class="countdown-time">${String(Math.floor(safeMinutes)).padStart(2, '0')}:00</span>
            </div>
            <script>
              (function() {
                function initCountdown${countdownId}() {
                  let remainingSeconds = ${safeMinutes * 60};
                  const countdown${countdownId} = function() {
                    const targetEl = document.getElementById('${el.id}');
                    if (!targetEl) return;
                    const timeSpan = targetEl.querySelector('.countdown-time');
                    if (!timeSpan) return;

                    if (remainingSeconds <= 0) {
                      timeSpan.innerHTML = '00:00';
                      return;
                    }
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    timeSpan.innerHTML = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
                    remainingSeconds--;
                  };
                  setInterval(countdown${countdownId}, 1000);
                  countdown${countdownId}();
                }

                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initCountdown${countdownId});
                } else {
                  initCountdown${countdownId}();
                }
              })();
            </script>
          `;

        case 'container':
          const columns = el.styles?.columns || 2;
          const gap = el.styles?.gap || '20px';
          const containerBgColor = el.styles?.backgroundColor || 'transparent';

          const columnElements = Array.from({ length: columns }, (_, colIndex) => {
            const columnChildren = (el.children || [])
              .filter((child: any) => (child.columnIndex ?? 0) === colIndex)
              .map((child: any) => {
                const childPaddingStyle = `${child.styles?.paddingTop || '0px'} ${child.styles?.paddingRight || '0px'} ${child.styles?.paddingBottom || '0px'} ${child.styles?.paddingLeft || '0px'}`;
                const childMarginStyle = `${child.styles?.marginTop || '0px'} ${child.styles?.marginRight || '0px'} ${child.styles?.marginBottom || '0px'} ${child.styles?.marginLeft || '0px'}`;

                switch (child.type) {
                  case 'headline':
                    return `<h1 style="text-align: ${child.styles?.textAlign}; font-size: ${child.styles?.fontSize}; color: ${child.styles?.color}; font-weight: ${child.styles?.fontWeight}; font-style: ${child.styles?.fontStyle}; text-decoration: ${child.styles?.textDecoration}; padding: ${childPaddingStyle}; margin: ${childMarginStyle};">${child.content}</h1>`;
                  case 'subheadline':
                    return `<h2 style="text-align: ${child.styles?.textAlign}; font-size: ${child.styles?.fontSize}; color: ${child.styles?.color}; font-weight: ${child.styles?.fontWeight}; font-style: ${child.styles?.fontStyle}; text-decoration: ${child.styles?.textDecoration}; padding: ${childPaddingStyle}; margin: ${childMarginStyle};">${child.content}</h2>`;
                  case 'text':
                    return `<p style="text-align: ${child.styles?.textAlign}; font-size: ${child.styles?.fontSize}; color: ${child.styles?.color}; font-weight: ${child.styles?.fontWeight}; font-style: ${child.styles?.fontStyle}; text-decoration: ${child.styles?.textDecoration}; padding: ${childPaddingStyle}; margin: ${childMarginStyle}; white-space: pre-wrap;">${child.content}</p>`;
                  case 'button':
                    const childButtonEffect = child.styles?.buttonEffect || 'none';
                    const childButtonId = `btn-${child.id}`;
                    let childAnimationCSS = '';

                    // Efeitos sempre ativos para botões dentro de containers
                    if (childButtonEffect === 'pulse') {
                      childAnimationCSS = `
                        @keyframes pulse-${child.id} {
                          0%, 100% { transform: scale(1); }
                          50% { transform: scale(1.05); }
                        }
                        .btn-${child.id} {
                          animation: pulse-${child.id} 1.5s ease-in-out infinite;
                        }`;
                    } else if (childButtonEffect === 'shake') {
                      childAnimationCSS = `
                        @keyframes shake-${child.id} {
                          0%, 100% { transform: translateX(0); }
                          25% { transform: translateX(-5px); }
                          75% { transform: translateX(5px); }
                        }
                        .btn-${child.id} {
                          animation: shake-${child.id} 0.8s ease-in-out infinite;
                        }`;
                    } else if (childButtonEffect === 'bounce') {
                      childAnimationCSS = `
                        @keyframes bounce-${child.id} {
                          0%, 100% { transform: translateY(0); }
                          50% { transform: translateY(-10px); }
                        }
                        .btn-${child.id} {
                          animation: bounce-${child.id} 1s ease-in-out infinite;
                        }`;
                    } else if (childButtonEffect === 'glow') {
                      childAnimationCSS = `
                        @keyframes glow-${child.id} {
                          0%, 100% { box-shadow: 0 0 10px ${child.styles?.backgroundColor}; }
                          50% { box-shadow: 0 0 20px ${child.styles?.backgroundColor}, 0 0 30px ${child.styles?.backgroundColor}; }
                        }
                        .btn-${child.id} {
                          animation: glow-${child.id} 2s ease-in-out infinite;
                        }`;
                    }

                    const childTargetAttr = child.styles?.buttonOpenNewTab !== false ? 'target="_blank" rel="noopener noreferrer"' : 'target="_self"';
                    return `${childAnimationCSS ? `<style>${childAnimationCSS}</style>` : ''}<div style="text-align: ${child.styles?.textAlign}; padding: ${childPaddingStyle}; margin: ${childMarginStyle};"><a href="${child.styles?.buttonUrl || '#'}" ${childTargetAttr} class="btn-${child.id}" style="display: inline-block; background-color: ${child.styles?.backgroundColor}; color: ${child.styles?.color}; font-size: ${child.styles?.fontSize}; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none;">${child.content}</a></div>`;
                  case 'image':
                    return `<div style="text-align: ${child.styles?.textAlign}; padding: ${childPaddingStyle}; margin: ${childMarginStyle};"><img src="${child.styles?.imageUrl}" alt="${child.content}" style="width: ${child.styles?.imageWidth || '100%'}; height: auto; max-width: 100%; border-radius: 8px;"></div>`;
                  case 'video':
                    const childEmbedUrl = convertToEmbedUrl(child.styles?.videoUrl || '');
                    return `<div style="text-align: ${child.styles?.textAlign}; padding: ${childPaddingStyle}; margin: ${childMarginStyle};"><iframe width="${child.styles?.videoWidth || '100%'}" height="315" src="${childEmbedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%;"></iframe></div>`;
                  case 'divider':
                    return `<hr style="border: none; border-top: 2px solid #ddd; margin: 20px 0;">`;
                  default:
                    return '';
                }
              }).join('\n');

            return `<div class="container-column">${columnChildren}</div>`;
          }).join('\n');

          return `<div class="container-responsive" data-columns="${columns}" style="gap: ${gap}; background-color: ${containerBgColor}; padding: ${paddingStyle}; margin: ${marginStyle}">${columnElements}</div>`;

        default:
          return '';
      }
    }).join('\n');

    const seoTitle = page.seo?.title || page.name || 'Pre-Sell';
    const seoDescription = page.seo?.description || '';
    const seoFavicon = page.seo?.favicon || '/favicon.ico';
    const seoOgImage = page.seo?.ogImage || '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoTitle}</title>
  <meta name="description" content="${seoDescription}">
  <meta property="og:title" content="${seoTitle}">
  <meta property="og:description" content="${seoDescription}">
  ${seoOgImage ? `<meta property="og:image" content="${seoOgImage}">` : ''}
  <meta property="og:type" content="website">
  <link rel="icon" href="${seoFavicon}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${page.settings?.fontFamily || 'Arial, sans-serif'};
      background-color: ${page.settings?.backgroundColor || '#ffffff'};
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .container {
      max-width: ${page.settings?.maxWidth || '800px'};
      margin: 0 auto;
      padding: 0px 20px 40px 20px;
    }
    @media (max-width: 768px) {
      .container { padding: 0px 15px 20px 15px; }
    }

    .container-responsive {
      display: grid !important;
      width: 100% !important;
      transition: all 0.3s;
    }

    .container-column {
      display: flex;
      flex-direction: column;
    }

    @media (max-width: 640px) {
      .container-responsive { grid-template-columns: 1fr !important; gap: 15px !important; }
    }

    @media (min-width: 641px) and (max-width: 1024px) {
      .container-responsive[data-columns="1"] { grid-template-columns: 1fr !important; }
      .container-responsive[data-columns="2"],
      .container-responsive[data-columns="3"],
      .container-responsive[data-columns="4"] { grid-template-columns: repeat(2, 1fr) !important; }
    }

    @media (min-width: 1025px) and (max-width: 1280px) {
      .container-responsive[data-columns="1"] { grid-template-columns: 1fr !important; }
      .container-responsive[data-columns="2"] { grid-template-columns: repeat(2, 1fr) !important; }
      .container-responsive[data-columns="3"] { grid-template-columns: repeat(3, 1fr) !important; }
      .container-responsive[data-columns="4"] { grid-template-columns: repeat(3, 1fr) !important; }
    }

    @media (min-width: 1281px) {
      .container-responsive[data-columns="1"] { grid-template-columns: 1fr !important; }
      .container-responsive[data-columns="2"] { grid-template-columns: repeat(2, 1fr) !important; }
      .container-responsive[data-columns="3"] { grid-template-columns: repeat(3, 1fr) !important; }
      .container-responsive[data-columns="4"] { grid-template-columns: repeat(4, 1fr) !important; }
    }
  </style>
  ${page.scripts?.head || ''}
</head>
<body>
  ${page.scripts?.body || ''}
  <div class="container">
    ${elementsHTML}
  </div>
  <script>
    function trackClick(slug) {
      fetch('/api/presell/' + slug + '/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error('Erro ao registrar clique:', err));
    }
  </script>
  ${page.scripts?.footer || ''}
</body>
</html>`;
  }

  // Clonador de Páginas - Verificar e desativar páginas expiradas (chamado por scheduler)
  app.post("/api/cloned-page/check-expired", async (req, res) => {
    try {
      const pagesDir = path.join(process.cwd(), "cloned-pages");

      if (!fs.existsSync(pagesDir)) {
        return res.json({ message: "Nenhuma página para verificar", deactivated: [] });
      }

      const files = fs.readdirSync(pagesDir);
      const deactivatedPages = [];

      for (const file of files) {
        if (!file.endsWith('.metadata.json')) continue;

        const metadataPath = path.join(pagesDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

        // Verificar se requer domínio e não tem domínio configurado
        if (metadata.requiresDomain && !metadata.customDomain && metadata.isActive !== false) {
          const createdAt = new Date(metadata.createdAt);
          const now = new Date();
          const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

          // Se passou 24 horas, desativar
          if (elapsedHours >= 24) {
            metadata.isActive = false;
            metadata.deactivatedAt = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

            const pageName = file.replace('.metadata.json', '');
            deactivatedPages.push(pageName);
            logger.debug(`⚠️ Página desativada por falta de domínio: ${pageName}`);
          }
        }
      }

      res.json({
        message: `Verificação concluída. ${deactivatedPages.length} página(s) desativada(s)`,
        deactivated: deactivatedPages
      });
    } catch (error: any) {
      console.error("Erro ao verificar páginas expiradas:", error);
      res.status(500).json({
        message: "Erro ao verificar páginas",
        error: error.message
      });
    }
  });

  // Servir páginas clonadas (somente visualização - SEM processamento IA)
  app.get("/pages/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const filePath = path.join(process.cwd(), "cloned-pages", `${slug}.html`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Página não encontrada");
      }

      // Sistema de contagem de visualizações únicas
      const metadataPath = path.join(process.cwd(), "cloned-pages", `${slug}.metadata.json`);
      const viewCookieName = `viewed_${slug}`;

      // Verificar se já visualizou (cookie)
      const hasViewed = req.cookies?.[viewCookieName] === 'true';

      // Verificar se a página está ativa (especialmente para páginas que requerem domínio)
      let metadata;
      try {
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

          // VERIFICAR SE REQUER DOMÍNIO E NÃO TEM DOMÍNIO CONFIGURADO
          if (metadata.requiresDomain && !metadata.customDomain) {
            const createdAt = new Date(metadata.createdAt);
            const now = new Date();
            const elapsedHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

            // Se passou 24 horas, desativar automaticamente
            if (elapsedHours >= 24) {
              metadata.isActive = false;
              metadata.deactivatedAt = new Date().toISOString();
              fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
              logger.debug(`⚠️ Página ${slug} desativada automaticamente por falta de domínio`);
            }
          }

          // VERIFICAR SE PÁGINA FOI DESATIVADA POR FALTA DE DOMÍNIO
          if (metadata.requiresDomain && !metadata.customDomain && metadata.isActive === false) {
            // Mostrar página de aviso
            const warningHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Desativada</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: #ff6b6b;
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
    }
    h1 {
      font-size: 28px;
      color: #2d3748;
      margin-bottom: 16px;
      font-weight: 600;
    }
    p {
      color: #718096;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .highlight {
      color: #667eea;
      font-weight: 600;
    }
    .button {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⚠️</div>
    <h1>Página Temporariamente Desativada</h1>
    <p>Esta página foi desativada porque requer um <span class="highlight">domínio personalizado</span> para funcionar.</p>
    <p>Para reativar esta página, você precisa configurar um domínio personalizado.</p>
    <p>Entre em contato com o administrador para mais informações.</p>
  </div>
</body>
</html>`;
            return res.status(403).send(warningHTML);
          }
        }
      } catch (err) {
        console.error("Erro ao ler metadata:", err);
      }

      // Incrementar visualizações únicas
      if (!hasViewed && metadata) {
        metadata.views = (metadata.views || 0) + 1;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

        // Criar cookie que expira em 24h
        res.cookie(viewCookieName, 'true', {
          maxAge: 24 * 60 * 60 * 1000,
          httpOnly: true
        });
      }

      const htmlContent = fs.readFileSync(filePath, "utf-8");
      res.send(htmlContent);
    } catch (error: any) {
      console.error("Erro ao servir página clonada:", error);
      res.status(500).send("Erro ao carregar a página");
    }
  });

  // ==================== ADMIN ANALYTICS ROUTES ====================

  app.get('/api/admin/analytics', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [
        allUsers,
        allTopics,
        allReplies,
        plrsResult,
        allServices,
        allCourses,
        allAITools,
        allMarketplaceProducts,
        allSupportTickets
      ] = await Promise.all([
        storage.getAllUsers(),
        storage.getForumTopics(),
        db.select().from(forumReplies),
        storage.getPLRs(),
        storage.getServices(),
        storage.getCourses(),
        storage.getAITools(),
        storage.getMarketplaceProducts(),
        storage.getSupportTickets()
      ]);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const activeUsers = allUsers.filter(user => {
        if (!user.createdAt) return false;
        const userCreatedAt = new Date(user.createdAt);
        return userCreatedAt >= thirtyDaysAgo;
      }).length;

      const openTickets = allSupportTickets.filter(ticket => ticket.status === 'open').length;

      res.json({
        totalUsers: allUsers.length,
        activeUsers,
        totalTopics: allTopics.length,
        totalReplies: allReplies.length,
        totalPLRs: plrsResult.total,
        totalServices: allServices.length,
        totalCourses: allCourses.length,
        totalAITools: allAITools.length,
        totalMarketplaceProducts: allMarketplaceProducts.length,
        totalSupportTickets: allSupportTickets.length,
        openTickets
      });
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  app.get('/api/admin/analytics/user-growth', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();

      const now = new Date();
      const growthData: { date: string; count: number }[] = [];

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const shortDate = `${day}/${month}`;

        const count = allUsers.filter(user => {
          if (!user.createdAt) return false;
          const userDate = new Date(user.createdAt);
          return userDate.toISOString().split('T')[0] === dateStr;
        }).length;

        growthData.push({ date: shortDate, count });
      }

      res.json(growthData);
    } catch (error) {
      console.error('Error fetching user growth:', error);
      res.status(500).json({ message: 'Failed to fetch user growth' });
    }
  });

  app.get('/api/admin/analytics/forum-activity', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [allTopics, allReplies] = await Promise.all([
        storage.getForumTopics(),
        db.select().from(forumReplies)
      ]);

      const now = new Date();
      const activityData: { date: string; topics: number; replies: number }[] = [];

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const shortDate = `${day}/${month}`;

        const topicCount = allTopics.filter(topic => {
          if (!topic.createdAt) return false;
          const topicDate = new Date(topic.createdAt);
          return topicDate.toISOString().split('T')[0] === dateStr;
        }).length;

        const replyCount = allReplies.filter((reply: any) => {
          if (!reply.createdAt) return false;
          const replyDate = new Date(reply.createdAt);
          return replyDate.toISOString().split('T')[0] === dateStr;
        }).length;

        activityData.push({ date: shortDate, topics: topicCount, replies: replyCount });
      }

      res.json(activityData);
    } catch (error) {
      console.error('Error fetching forum activity:', error);
      res.status(500).json({ message: 'Failed to fetch forum activity' });
    }
  });

  // ==================== ADMIN CLONING ANALYTICS ROUTES ====================

  app.get('/api/admin/cloning-analytics/pages', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const pagesDir = path.join(process.cwd(), "cloned-pages");
      
      // Parse date filters using centralized São Paulo date helpers
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      
      const startDate = startDateStr ? parseDateStringToStartOfDaySaoPaulo(startDateStr) : null;
      const endDate = endDateStr ? parseDateStringToEndOfDaySaoPaulo(endDateStr) : null;

      if (!fs.existsSync(pagesDir)) {
        return res.json({ pages: [] });
      }

      const files = fs.readdirSync(pagesDir);
      const pages = files
        .filter(file => file.endsWith('.html'))
        .map(file => {
          const slug = file.replace('.html', '');
          const metadataPath = path.join(pagesDir, `${slug}.metadata.json`);

          let createdAt = new Date().toISOString();
          let updatedAt = new Date().toISOString();
          let size = 0;
          let viewCount = 0;
          let originalName = slug;

          try {
            const htmlPath = path.join(pagesDir, file);
            const stats = fs.statSync(htmlPath);
            size = stats.size;
            createdAt = stats.birthtime.toISOString();
            updatedAt = stats.mtime.toISOString();
          } catch (err) {
            console.error('Error reading file stats:', err);
          }

          if (fs.existsSync(metadataPath)) {
            try {
              const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
              const metadata = JSON.parse(metadataContent);
              createdAt = metadata.createdAt || createdAt;
              viewCount = metadata.viewCount || 0;
              originalName = metadata.originalName || slug;
            } catch (err) {
              console.error('Error reading metadata:', err);
            }
          }

          return {
            name: slug,
            originalName,
            createdAt,
            updatedAt,
            size,
            viewCount
          };
        })
        .filter(page => {
          const pageDate = new Date(page.createdAt);
          if (startDate && pageDate < startDate) return false;
          if (endDate && pageDate > endDate) return false;
          return true;
        });

      res.json({ pages });
    } catch (error) {
      console.error('Error fetching cloned pages analytics:', error);
      res.status(500).json({ message: 'Failed to fetch cloned pages analytics' });
    }
  });

  app.get('/api/admin/cloning-analytics/user-stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const pagesDir = path.join(process.cwd(), "cloned-pages");
      
      // Parse date filters using centralized São Paulo date helpers
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      
      const startDate = startDateStr ? parseDateStringToStartOfDaySaoPaulo(startDateStr) : null;
      const endDate = endDateStr ? parseDateStringToEndOfDaySaoPaulo(endDateStr) : null;

      if (!fs.existsSync(pagesDir)) {
        return res.json([]);
      }

      const files = fs.readdirSync(pagesDir);
      const userStatsMap = new Map<string, { userId: string; userName: string; userEmail: string; pageCount: number }>();

      for (const file of files) {
        if (!file.endsWith('.html')) continue;

        const slug = file.replace('.html', '');
        const metadataPath = path.join(pagesDir, `${slug}.metadata.json`);

        if (fs.existsSync(metadataPath)) {
          try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
            
            // Apply date filter
            if (metadata.createdAt) {
              const pageDate = new Date(metadata.createdAt);
              if (startDate && pageDate < startDate) continue;
              if (endDate && pageDate > endDate) continue;
            }

            if (metadata.userId) {
              if (!userStatsMap.has(metadata.userId)) {
                const user = await storage.getUser(metadata.userId);
                userStatsMap.set(metadata.userId, {
                  userId: metadata.userId,
                  userName: user?.name || 'Unknown',
                  userEmail: user?.email || 'unknown@email.com',
                  pageCount: 0
                });
              }

              const stats = userStatsMap.get(metadata.userId)!;
              stats.pageCount++;
            }
          } catch (err) {
            console.error('Error reading metadata:', err);
          }
        }
      }

      res.json(Array.from(userStatsMap.values()));
    } catch (error) {
      console.error('Error fetching user cloning stats:', error);
      res.status(500).json({ message: 'Failed to fetch user cloning stats' });
    }
  });

  // ==================== ADMIN USERS ROUTES ====================

  app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // ==================== ADMIN MARKETPLACE MODERATION ====================

  // Admin - Listar todos os produtos do marketplace
  app.get('/api/admin/marketplace/products', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const products = await storage.getAllMarketplaceProducts();
      res.json(products);
    } catch (error) {
      console.error('Error fetching marketplace products:', error);
      res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
  });

  // Admin - Bloquear produto
  app.post('/api/admin/marketplace/block/:productId', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Motivo do bloqueio é obrigatório' });
      }

      const product = await storage.getMarketplaceProductById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      const blocked = await storage.blockMarketplaceProduct(productId, reason);
      
      // Enviar email para o vendedor informando sobre o bloqueio
      const seller = await storage.getUser(product.sellerId);
      if (seller && seller.email) {
        try {
          const { generateProductBlockedEmail } = await import('./email.js');
          const emailHtml = generateProductBlockedEmail(seller.name, product.title, reason);
          await sendEmail({
            to: seller.email,
            subject: '⚠️ Seu produto foi bloqueado - Ação necessária',
            html: emailHtml,
          });
          logger.info(`[Admin] Email enviado para ${seller.email} sobre bloqueio de produto`);
        } catch (emailError) {
          logger.error('[Admin] Erro ao enviar email de bloqueio:', emailError);
        }
      }
      
      res.json({ message: 'Produto bloqueado com sucesso', product: blocked });
    } catch (error) {
      console.error('Error blocking product:', error);
      res.status(500).json({ message: 'Erro ao bloquear produto' });
    }
  });

  // Admin - Desbloquear produto
  app.post('/api/admin/marketplace/unblock/:productId', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;

      const product = await storage.getMarketplaceProductById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      if (!product.isBlocked) {
        return res.status(400).json({ message: 'Produto não está bloqueado' });
      }

      const unblocked = await storage.unblockMarketplaceProduct(productId);
      res.json({ message: 'Produto desbloqueado com sucesso', product: unblocked });
    } catch (error) {
      console.error('Error unblocking product:', error);
      res.status(500).json({ message: 'Erro ao desbloquear produto' });
    }
  });

  // Admin - Editar produto
  app.put('/api/admin/marketplace/products/:productId', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const { title, description, price, category, productUrl, isActive, images } = req.body;

      const product = await storage.getMarketplaceProductById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (price !== undefined) updates.price = price;
      if (category !== undefined) updates.category = category;
      if (productUrl !== undefined) updates.productUrl = productUrl;
      if (isActive !== undefined) updates.isActive = isActive;
      if (images !== undefined) updates.images = images;

      const updated = await storage.updateMarketplaceProduct(productId, updates);
      res.json({ message: 'Produto atualizado com sucesso', product: updated });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Erro ao atualizar produto' });
    }
  });

  // Admin - Deletar produto (soft delete)
  app.delete('/api/admin/marketplace/products/:productId', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const { reason } = req.body;

      const product = await storage.getMarketplaceProductById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      // Check if product has any orders (soft delete preserves order history)
      const orders = await db
        .select({ id: marketplaceOrders.id })
        .from(marketplaceOrders)
        .where(eq(marketplaceOrders.productId, productId))
        .limit(1);

      const hasOrders = orders.length > 0;

      // Clean up cart items for this product
      await db.delete(cartItems).where(eq(cartItems.productId, productId));

      // Clean up reviews for this product
      await db.delete(productReviews).where(eq(productReviews.productId, productId));

      // Perform soft delete - mark product as deleted
      await db
        .update(marketplaceProducts)
        .set({
          deletedAt: new Date(),
          deletedReason: reason || 'Removido pelo administrador',
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceProducts.id, productId));

      res.json({ 
        message: hasOrders 
          ? 'Produto marcado como excluído (mantido no histórico de vendas)' 
          : 'Produto excluído com sucesso',
        hasOrders 
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Erro ao deletar produto' });
    }
  });

  // Admin - Listar solicitações de reembolso pendentes do marketplace
  app.get('/api/admin/marketplace/refund-requests', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const refundRequests = await db
        .select({
          order: marketplaceOrders,
          buyer: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          product: {
            id: marketplaceProducts.id,
            title: marketplaceProducts.title,
            price: marketplaceProducts.price,
          },
          seller: {
            id: sql<string>`seller_user.id`,
            name: sql<string>`seller_user.name`,
            email: sql<string>`seller_user.email`,
          },
        })
        .from(marketplaceOrders)
        .innerJoin(users, eq(marketplaceOrders.buyerId, users.id))
        .innerJoin(marketplaceProducts, eq(marketplaceOrders.productId, marketplaceProducts.id))
        .innerJoin(sql`users as seller_user`, sql`${marketplaceOrders.sellerId} = seller_user.id`)
        .where(
          or(
            eq(marketplaceOrders.status, 'refund_requested'),
            eq(marketplaceOrders.status, 'refunded')
          )
        )
        .orderBy(desc(marketplaceOrders.refundRequestedAt));

      res.json(refundRequests);
    } catch (error) {
      console.error('Error fetching refund requests:', error);
      res.status(500).json({ message: 'Erro ao buscar solicitações de reembolso' });
    }
  });

  // Admin - Aprovar reembolso manualmente
  app.post('/api/admin/marketplace/approve-refund/:orderId', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { orderId } = req.params;

      const [order] = await db
        .select()
        .from(marketplaceOrders)
        .where(eq(marketplaceOrders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: 'Pedido não encontrado' });
      }

      if (order.status !== 'refund_requested') {
        return res.status(400).json({ message: 'Este pedido não está aguardando aprovação de reembolso' });
      }

      // Processar reembolso dependendo do método de pagamento
      let refundSuccess = false;
      let errorMessage = '';

      if (order.paymentMethod === 'card' && order.asaasPaymentId) {
        // Reembolso via Asaas (cartão)
        try {
          const { refundPayment } = await import('./services/asaas.js');
          await refundPayment(order.asaasPaymentId, undefined, order.refundReason || 'Reembolso aprovado pelo admin');
          refundSuccess = true;
          logger.debug(`[Admin] Asaas refund processed for order ${orderId}`);
        } catch (asaasError: any) {
          console.error('[Admin] Asaas refund failed:', asaasError);
          errorMessage = asaasError.message;
        }
      } else if (order.paymentMethod === 'pix' && order.podpayTransactionId) {
        // Reembolso via Podpay (PIX)
        try {
          const podpayService = getPodpayService();
          if (podpayService) {
            await podpayService.refundTransaction(order.podpayTransactionId);
            refundSuccess = true;
            logger.debug(`[Admin] Podpay refund processed for order ${orderId}`);
          } else {
            errorMessage = 'Serviço Podpay não configurado';
          }
        } catch (podpayError: any) {
          console.error('[Admin] Podpay refund failed:', podpayError);
          errorMessage = podpayError.message;
        }
      } else {
        errorMessage = 'Método de pagamento não suportado para reembolso automático';
      }

      if (!refundSuccess) {
        return res.status(500).json({ 
          message: `Erro ao processar reembolso: ${errorMessage}. Processo manualmente no gateway de pagamento.` 
        });
      }

      // Atualizar status do pedido
      const [updatedOrder] = await db
        .update(marketplaceOrders)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(marketplaceOrders.id, orderId))
        .returning();

      // Atualizar transação de venda do vendedor
      const [originalSaleTransaction] = await db
        .select()
        .from(sellerTransactions)
        .where(
          and(
            eq(sellerTransactions.orderId, orderId),
            eq(sellerTransactions.type, 'sale')
          )
        )
        .limit(1);

      if (originalSaleTransaction) {
        const refundAmount = originalSaleTransaction.netAmountCents || originalSaleTransaction.amount;

        // Atualizar status da transação de venda
        await db
          .update(sellerTransactions)
          .set({
            status: 'refunded',
            updatedAt: new Date()
          })
          .where(eq(sellerTransactions.id, originalSaleTransaction.id));

        // Buscar se já existe transação de reembolso pendente
        const [existingRefundTransaction] = await db
          .select()
          .from(sellerTransactions)
          .where(
            and(
              eq(sellerTransactions.orderId, orderId),
              eq(sellerTransactions.type, 'refund')
            )
          )
          .limit(1);

        if (existingRefundTransaction && existingRefundTransaction.status === 'pending') {
          // Atualizar transação de reembolso existente para completed
          await db
            .update(sellerTransactions)
            .set({
              status: 'completed',
              updatedAt: new Date()
            })
            .where(eq(sellerTransactions.id, existingRefundTransaction.id));
        } else if (!existingRefundTransaction) {
          // Criar nova transação de reembolso se não existir
          await db
            .insert(sellerTransactions)
            .values({
              sellerId: order.sellerId,
              type: 'refund',
              amount: -refundAmount,
              originalPriceCents: originalSaleTransaction.originalPriceCents,
              discountCents: originalSaleTransaction.discountCents,
              grossAmountCents: originalSaleTransaction.grossAmountCents,
              systemFeeCents: originalSaleTransaction.systemFeeCents,
              netAmountCents: -refundAmount,
              orderId: orderId,
              status: 'completed',
              description: `Reembolso: ${originalSaleTransaction.description || 'Venda'}`,
            });
        }

        // Atualizar saldo do vendedor
        const [sellerWalletData] = await db
          .select()
          .from(sellerWallet)
          .where(eq(sellerWallet.sellerId, order.sellerId))
          .limit(1);

        if (sellerWalletData) {
          let newBalancePending = sellerWalletData.balancePending;
          let newBalanceAvailable = sellerWalletData.balanceAvailable;
          let newTotalRefunded = sellerWalletData.totalRefunded + refundAmount;

          if (originalSaleTransaction.status === 'pending') {
            newBalancePending = Math.max(0, sellerWalletData.balancePending - refundAmount);
          } else if (originalSaleTransaction.status === 'completed') {
            newBalanceAvailable = Math.max(0, sellerWalletData.balanceAvailable - refundAmount);
          }

          await db
            .update(sellerWallet)
            .set({
              balancePending: newBalancePending,
              balanceAvailable: newBalanceAvailable,
              totalRefunded: newTotalRefunded,
              updatedAt: new Date()
            })
            .where(eq(sellerWallet.sellerId, order.sellerId));

          logger.debug(`[Admin Refund] Updated seller wallet - Pending: ${newBalancePending}, Available: ${newBalanceAvailable}, Refunded: ${newTotalRefunded}`);
        }
      }

      res.json({ 
        message: 'Reembolso aprovado e processado com sucesso',
        order: updatedOrder 
      });
    } catch (error) {
      console.error('Error approving refund:', error);
      res.status(500).json({ message: 'Erro ao aprovar reembolso' });
    }
  });

  // ==================== ADMIN SELLERS ANALYTICS ====================
  
  // Admin - Resumo geral do marketplace
  app.get('/api/admin/marketplace/overview', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(marketplaceOrders.createdAt, parseDateStringToStartOfDaySaoPaulo(startDate as string)));
      }
      if (endDate) {
        dateFilter.push(lte(marketplaceOrders.createdAt, parseDateStringToEndOfDaySaoPaulo(endDate as string)));
      }
      
      console.log('[Admin Overview] Date range:', startDate, 'to', endDate);
      console.log('[Admin Overview] Date filter length:', dateFilter.length);

      const allOrdersCondition = dateFilter.length > 0 ? and(...dateFilter) : undefined;
      const completedCondition = dateFilter.length > 0 
        ? and(eq(marketplaceOrders.status, 'completed'), ...dateFilter)
        : eq(marketplaceOrders.status, 'completed');
      const refundedCondition = dateFilter.length > 0
        ? and(eq(marketplaceOrders.status, 'refunded'), ...dateFilter)
        : eq(marketplaceOrders.status, 'refunded');

      const [totalSalesResult] = await db
        .select({
          count: count(marketplaceOrders.id),
          grossRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.grossAmountCents}), 0)::int`,
          netRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.netAmountCents}), 0)::int`,
          systemFees: sql<number>`COALESCE(SUM(${marketplaceOrders.systemFeeCents}), 0)::int`,
          discounts: sql<number>`COALESCE(SUM(${marketplaceOrders.discountCents}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(completedCondition);

      const [refundsResult] = await db
        .select({
          count: count(marketplaceOrders.id),
          totalRefunded: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(refundedCondition);

      const [pendingResult] = await db
        .select({
          count: count(marketplaceOrders.id),
          totalPending: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(dateFilter.length > 0 
          ? and(eq(marketplaceOrders.status, 'pending'), ...dateFilter)
          : eq(marketplaceOrders.status, 'pending'));

      const [sellersCount] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${marketplaceProducts.sellerId})::int` })
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.isActive, true));

      const [productsCount] = await db
        .select({ count: count(marketplaceProducts.id) })
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.isActive, true));
      
      const [refundRequestedResult] = await db
        .select({
          count: count(marketplaceOrders.id),
          totalRefundRequested: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(dateFilter.length > 0 
          ? and(eq(marketplaceOrders.status, 'refund_requested'), ...dateFilter)
          : eq(marketplaceOrders.status, 'refund_requested'));

      const response = {
        sales: {
          total: totalSalesResult?.count || 0,
          grossRevenue: totalSalesResult?.grossRevenue || 0,
          netRevenue: totalSalesResult?.netRevenue || 0,
          systemFees: totalSalesResult?.systemFees || 0,
          discounts: totalSalesResult?.discounts || 0,
        },
        refunds: {
          total: (refundsResult?.count || 0) + (refundRequestedResult?.count || 0),
          totalRefunded: (refundsResult?.totalRefunded || 0) + (refundRequestedResult?.totalRefundRequested || 0),
        },
        pending: {
          total: pendingResult?.count || 0,
          totalPending: pendingResult?.totalPending || 0,
        },
        sellers: sellersCount?.count || 0,
        activeProducts: productsCount?.count || 0,
        profit: (totalSalesResult?.systemFees || 0),
      };
      console.log('[Admin Overview] Response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('Error fetching marketplace overview:', error);
      res.status(500).json({ message: 'Erro ao buscar resumo do marketplace' });
    }
  });

  // Admin - Lista de vendedores com métricas
  app.get('/api/admin/marketplace/sellers', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      console.log('[Admin Sellers] Request received - Query params:', req.query);
      const { startDate, endDate, sortBy = 'revenue', order = 'desc', limit = '50', offset = '0' } = req.query;

      const dateFilter = [];
      if (startDate) {
        dateFilter.push(gte(marketplaceOrders.createdAt, parseDateStringToStartOfDaySaoPaulo(startDate as string)));
      }
      if (endDate) {
        dateFilter.push(lte(marketplaceOrders.createdAt, parseDateStringToEndOfDaySaoPaulo(endDate as string)));
      }

      const allSellersProducts = await db
        .select({
          sellerId: marketplaceProducts.sellerId,
          productCount: count(marketplaceProducts.id),
        })
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.isActive, true))
        .groupBy(marketplaceProducts.sellerId);

      const sellerIds = allSellersProducts.map(s => s.sellerId);
      console.log('[Admin Sellers] Found sellers with products:', sellerIds.length, 'Date filter:', dateFilter.length);
      if (sellerIds.length === 0) {
        return res.json({ sellers: [], total: 0 });
      }

      const completedCondition = dateFilter.length > 0
        ? and(eq(marketplaceOrders.status, 'completed'), inArray(marketplaceOrders.sellerId, sellerIds), ...dateFilter)
        : and(eq(marketplaceOrders.status, 'completed'), inArray(marketplaceOrders.sellerId, sellerIds));

      const salesData = await db
        .select({
          sellerId: marketplaceOrders.sellerId,
          totalSales: count(marketplaceOrders.id),
          grossRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.grossAmountCents}), 0)::int`,
          netRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.netAmountCents}), 0)::int`,
          systemFees: sql<number>`COALESCE(SUM(${marketplaceOrders.systemFeeCents}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(completedCondition)
        .groupBy(marketplaceOrders.sellerId);

      const refundsData = await db
        .select({
          sellerId: marketplaceOrders.sellerId,
          refundCount: count(marketplaceOrders.id),
          totalRefunded: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(dateFilter.length > 0
          ? and(inArray(marketplaceOrders.status, ['refunded', 'refund_requested']), inArray(marketplaceOrders.sellerId, sellerIds), ...dateFilter)
          : and(inArray(marketplaceOrders.status, ['refunded', 'refund_requested']), inArray(marketplaceOrders.sellerId, sellerIds)))
        .groupBy(marketplaceOrders.sellerId);

      console.log('[Admin Sellers] Sales data found:', salesData.length, salesData);
      console.log('[Admin Sellers] Refunds data found:', refundsData.length, refundsData);
      
      const salesMap = new Map(salesData.map(s => [s.sellerId, s]));
      const refundsMap = new Map(refundsData.map(r => [r.sellerId, r]));

      const usersInfo = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(inArray(users.id, sellerIds));

      const usersMap = new Map(usersInfo.map(u => [u.id, u]));
      const productsMap = new Map(allSellersProducts.map(p => [p.sellerId, p.productCount]));

      // Calculate balance for each seller
      const balanceMap = new Map();
      for (const sellerId of sellerIds) {
        const eightDaysAgo = new Date();
        eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

        // Saldo PENDENTE: vendas com status 'completed' criadas nos últimos 8 dias (ainda não liberadas)
        const [pendingResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${sellerTransactions.netAmountCents}), 0)::int` })
          .from(sellerTransactions)
          .where(
            and(
              eq(sellerTransactions.sellerId, sellerId),
              eq(sellerTransactions.type, 'sale'),
              eq(sellerTransactions.status, 'completed'),
              gte(sellerTransactions.createdAt, eightDaysAgo),
              isNull(sellerTransactions.releasedAt)
            )
          );

        // Saldo DISPONÍVEL: vendas com status 'completed' criadas há mais de 8 dias (liberadas para saque)
        const [availableResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${sellerTransactions.netAmountCents}), 0)::int` })
          .from(sellerTransactions)
          .where(
            and(
              eq(sellerTransactions.sellerId, sellerId),
              eq(sellerTransactions.type, 'sale'),
              eq(sellerTransactions.status, 'completed'),
              lte(sellerTransactions.createdAt, eightDaysAgo),
              isNull(sellerTransactions.releasedAt)
            )
          );

        // Subtrair saques já realizados do saldo disponível
        const [withdrawalsResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${podpayWithdrawals.amountCents}), 0)::int` })
          .from(podpayWithdrawals)
          .where(
            and(
              eq(podpayWithdrawals.sellerId, sellerId),
              inArray(podpayWithdrawals.status, ['completed', 'processing', 'pending'])
            )
          );

        const totalWithdrawn = withdrawalsResult?.total || 0;
        const calculatedAvailable = Math.max(0, (availableResult?.total || 0) - totalWithdrawn);

        balanceMap.set(sellerId, {
          balancePending: pendingResult?.total || 0,
          balanceAvailable: calculatedAvailable,
          totalWithdrawn: totalWithdrawn,
        });
      }

      let sellers = allSellersProducts.map(p => {
        const user = usersMap.get(p.sellerId);
        const sales = salesMap.get(p.sellerId);
        const refund = refundsMap.get(p.sellerId);
        const balance = balanceMap.get(p.sellerId) || { balancePending: 0, balanceAvailable: 0, totalWithdrawn: 0 };
        return {
          id: p.sellerId,
          name: user?.name || 'Vendedor',
          email: user?.email || '',
          profileImageUrl: user?.profileImageUrl,
          totalSales: sales?.totalSales || 0,
          grossRevenue: sales?.grossRevenue || 0,
          netRevenue: sales?.netRevenue || 0,
          systemFees: sales?.systemFees || 0,
          refundCount: refund?.refundCount || 0,
          totalRefunded: refund?.totalRefunded || 0,
          activeProducts: productsMap.get(p.sellerId) || 0,
          balancePending: balance.balancePending,
          balanceAvailable: balance.balanceAvailable,
          totalEarned: sales?.netRevenue || 0,
          totalWithdrawn: balance.totalWithdrawn || 0,
        };
      });

      if (sortBy === 'revenue') {
        sellers.sort((a, b) => order === 'desc' ? b.grossRevenue - a.grossRevenue : a.grossRevenue - b.grossRevenue);
      } else if (sortBy === 'sales') {
        sellers.sort((a, b) => order === 'desc' ? b.totalSales - a.totalSales : a.totalSales - b.totalSales);
      } else if (sortBy === 'refunds') {
        sellers.sort((a, b) => order === 'desc' ? b.refundCount - a.refundCount : a.refundCount - b.refundCount);
      }

      const total = sellers.length;
      const paginatedSellers = sellers.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

      res.json({ sellers: paginatedSellers, total });
    } catch (error) {
      console.error('Error fetching sellers:', error);
      res.status(500).json({ message: 'Erro ao buscar vendedores' });
    }
  });

  // Admin - Detalhes de vendas de um vendedor específico
  app.get('/api/admin/marketplace/sellers/:sellerId/sales', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { sellerId } = req.params;
      const { startDate, endDate, status, limit = '50', offset = '0' } = req.query;

      const conditions = [eq(marketplaceOrders.sellerId, sellerId)];
      
      if (startDate) {
        conditions.push(gte(marketplaceOrders.createdAt, new Date(startDate as string)));
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(marketplaceOrders.createdAt, end));
      }
      if (status && status !== 'all') {
        conditions.push(eq(marketplaceOrders.status, status as string));
      }

      const [totalResult] = await db
        .select({ count: count(marketplaceOrders.id) })
        .from(marketplaceOrders)
        .where(and(...conditions));

      const salesData = await db
        .select({
          order: marketplaceOrders,
          product: {
            id: marketplaceProducts.id,
            title: marketplaceProducts.title,
            price: marketplaceProducts.price,
          },
          buyer: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(marketplaceOrders)
        .leftJoin(marketplaceProducts, eq(marketplaceOrders.productId, marketplaceProducts.id))
        .leftJoin(users, eq(marketplaceOrders.buyerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(marketplaceOrders.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json({
        sales: salesData,
        total: totalResult?.count || 0,
      });
    } catch (error) {
      console.error('Error fetching seller sales:', error);
      res.status(500).json({ message: 'Erro ao buscar vendas do vendedor' });
    }
  });

  // Admin - Top vendedores
  app.get('/api/admin/marketplace/top-sellers', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { period = '30', limit = '10' } = req.query;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period as string));

      const topSellers = await db
        .select({
          sellerId: marketplaceOrders.sellerId,
          totalSales: count(marketplaceOrders.id),
          grossRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.grossAmountCents}), 0)::int`,
          netRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.netAmountCents}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(and(
          eq(marketplaceOrders.status, 'completed'),
          gte(marketplaceOrders.createdAt, startDate)
        ))
        .groupBy(marketplaceOrders.sellerId)
        .orderBy(desc(sql`SUM(${marketplaceOrders.grossAmountCents})`))
        .limit(parseInt(limit as string));

      const sellerIds = topSellers.map(s => s.sellerId);
      if (sellerIds.length === 0) {
        return res.json([]);
      }

      const usersInfo = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        })
        .from(users)
        .where(inArray(users.id, sellerIds));

      const usersMap = new Map(usersInfo.map(u => [u.id, u]));

      const result = topSellers.map((seller, index) => {
        const user = usersMap.get(seller.sellerId);
        return {
          rank: index + 1,
          id: seller.sellerId,
          name: user?.name || 'Vendedor',
          email: user?.email || '',
          profileImageUrl: user?.profileImageUrl,
          totalSales: seller.totalSales,
          grossRevenue: seller.grossRevenue,
          netRevenue: seller.netRevenue,
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching top sellers:', error);
      res.status(500).json({ message: 'Erro ao buscar top vendedores' });
    }
  });

  // Admin - Histórico de vendas por dia
  app.get('/api/admin/marketplace/sales-history', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);

      let dateFormat = "'YYYY-MM-DD'";
      if (groupBy === 'week') {
        dateFormat = "'IYYY-IW'";
      } else if (groupBy === 'month') {
        dateFormat = "'YYYY-MM'";
      }

      const salesHistory = await db
        .select({
          date: sql<string>`TO_CHAR(${marketplaceOrders.createdAt}, ${sql.raw(dateFormat)})`,
          totalSales: count(marketplaceOrders.id),
          grossRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.grossAmountCents}), 0)::int`,
          netRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.netAmountCents}), 0)::int`,
          systemFees: sql<number>`COALESCE(SUM(${marketplaceOrders.systemFeeCents}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(and(
          eq(marketplaceOrders.status, 'completed'),
          gte(marketplaceOrders.createdAt, start),
          lte(marketplaceOrders.createdAt, end)
        ))
        .groupBy(sql`TO_CHAR(${marketplaceOrders.createdAt}, ${sql.raw(dateFormat)})`)
        .orderBy(asc(sql`TO_CHAR(${marketplaceOrders.createdAt}, ${sql.raw(dateFormat)})`));

      const refundsHistory = await db
        .select({
          date: sql<string>`TO_CHAR(${marketplaceOrders.refundedAt}, ${sql.raw(dateFormat)})`,
          refundCount: count(marketplaceOrders.id),
          totalRefunded: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)::int`,
        })
        .from(marketplaceOrders)
        .where(and(
          eq(marketplaceOrders.status, 'refunded'),
          gte(marketplaceOrders.refundedAt, start),
          lte(marketplaceOrders.refundedAt, end)
        ))
        .groupBy(sql`TO_CHAR(${marketplaceOrders.refundedAt}, ${sql.raw(dateFormat)})`)
        .orderBy(asc(sql`TO_CHAR(${marketplaceOrders.refundedAt}, ${sql.raw(dateFormat)})`));

      const refundsMap = new Map(refundsHistory.map(r => [r.date, r]));

      const combinedHistory = salesHistory.map(day => {
        const refund = refundsMap.get(day.date);
        return {
          ...day,
          refundCount: refund?.refundCount || 0,
          totalRefunded: refund?.totalRefunded || 0,
        };
      });

      res.json(combinedHistory);
    } catch (error) {
      console.error('Error fetching sales history:', error);
      res.status(500).json({ message: 'Erro ao buscar histórico de vendas' });
    }
  });

  // Admin - Todas as vendas com filtros
  app.get('/api/admin/marketplace/all-sales', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate, status, sellerId, limit = '50', offset = '0' } = req.query;

      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(marketplaceOrders.createdAt, parseDateStringToStartOfDaySaoPaulo(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(marketplaceOrders.createdAt, parseDateStringToEndOfDaySaoPaulo(endDate as string)));
      }
      if (status && status !== 'all') {
        conditions.push(eq(marketplaceOrders.status, status as string));
      }
      if (sellerId) {
        conditions.push(eq(marketplaceOrders.sellerId, sellerId as string));
      }

      console.log('[Admin All-Sales] Query params:', { startDate, endDate, status, limit, offset, conditions: conditions.length });

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult] = await db
        .select({ count: count(marketplaceOrders.id) })
        .from(marketplaceOrders)
        .where(whereCondition);

      const salesData = await db
        .select({
          order: marketplaceOrders,
          product: {
            id: marketplaceProducts.id,
            title: marketplaceProducts.title,
            price: marketplaceProducts.price,
          },
          buyer: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          seller: {
            id: sql<string>`seller_user.id`,
            name: sql<string>`seller_user.name`,
            email: sql<string>`seller_user.email`,
          },
        })
        .from(marketplaceOrders)
        .leftJoin(marketplaceProducts, eq(marketplaceOrders.productId, marketplaceProducts.id))
        .leftJoin(users, eq(marketplaceOrders.buyerId, users.id))
        .leftJoin(sql`users as seller_user`, sql`${marketplaceOrders.sellerId} = seller_user.id`)
        .where(whereCondition)
        .orderBy(desc(marketplaceOrders.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      res.json({
        sales: salesData,
        total: totalResult?.count || 0,
      });
    } catch (error) {
      console.error('Error fetching all sales:', error);
      res.status(500).json({ message: 'Erro ao buscar vendas' });
    }
  });

  app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      await storage.updateUser(id, updates);
      const updatedUser = await storage.getUser(id);

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // DELETE /api/admin/users/:id - Excluir usuário e todos seus dados
  app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Prevent deleting own account
      if (id === req.user.id) {
        return res.status(400).json({ message: 'Não é possível excluir sua própria conta' });
      }

      // Delete user and all related data
      const result = await storage.deleteUserAndRelatedData(id);
      
      logger.debug(`[Admin] User ${id} deleted by admin ${req.user.id}. Tables affected: ${result.deletedTables.join(', ')}`);
      
      res.json({ 
        success: true, 
        message: 'Usuário e todos os dados relacionados foram excluídos com sucesso',
        deletedTables: result.deletedTables
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
  });

  // PUT /api/admin/users/:id/deactivate-subscription - Desativar assinatura
  app.put('/api/admin/users/:id/deactivate-subscription', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      await storage.updateUser(id, {
        subscriptionStatus: 'canceled',
        subscriptionExpiresAt: new Date(),
      });

      const updatedUser = await storage.getUser(id);
      
      logger.debug(`[Admin] Subscription deactivated for user ${id} by admin ${req.user.id}`);
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error deactivating subscription:', error);
      res.status(500).json({ message: 'Erro ao desativar assinatura' });
    }
  });

  // ==================== ADMIN SUBSCRIPTION TEST TOGGLE ====================
  // Toggle subscription status for testing access control
  app.post('/api/admin/toggle-subscription', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      const isCurrentlyActive = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial';
      
      if (isCurrentlyActive) {
        // Desativar assinatura - simular expirada
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 30); // 30 dias atrás
        
        await storage.updateUser(userId, {
          subscriptionStatus: 'expired',
          subscriptionExpiresAt: pastDate,
          accountStatus: 'active', // Manter conta ativa, só assinatura expirada
          testingAsNonAdmin: true // Flag para ignorar status de admin no frontend
        });
        
        logger.debug(`[Admin Toggle] Assinatura desativada para usuário ${userId} - Status: expired, testingAsNonAdmin: true`);
        
        res.json({ 
          message: 'Assinatura desativada para teste (modo não-admin ativado)',
          subscriptionStatus: 'expired',
          subscriptionExpiresAt: pastDate,
          isAdmin: user.isAdmin,
          testingAsNonAdmin: true,
          info: 'Recarregue a página para ver o efeito. Execute novamente para reativar.'
        });
      } else {
        // Reativar assinatura
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1); // 1 ano à frente
        
        await storage.updateUser(userId, {
          subscriptionStatus: 'active',
          subscriptionExpiresAt: futureDate,
          accountStatus: 'active',
          testingAsNonAdmin: false // Restaurar comportamento normal de admin
        });
        
        logger.debug(`[Admin Toggle] Assinatura reativada para usuário ${userId} - Status: active, testingAsNonAdmin: false`);
        
        res.json({ 
          message: 'Assinatura reativada (modo admin restaurado)',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: futureDate,
          isAdmin: user.isAdmin,
          testingAsNonAdmin: false
        });
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      res.status(500).json({ message: 'Erro ao alternar assinatura' });
    }
  });

  // Get current subscription status for admin testing
  app.get('/api/admin/subscription-status', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      res.json({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        accountStatus: user.accountStatus,
        isAdmin: user.isAdmin
      });
    } catch (error) {
      console.error('Error getting subscription status:', error);
      res.status(500).json({ message: 'Erro ao obter status da assinatura' });
    }
  });

  // ==================== ADMIN SYNC SUBSCRIPTION STATUS ====================
  // Sync user subscription status from lowfySubscriptions table
  // Use this to fix users whose payment was processed but user table wasn't updated
  app.post('/api/admin/sync-subscription-status', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { userId, email, syncAll } = req.body;
      
      let usersToSync: Array<{ userId: string; email: string }> = [];
      let syncedCount = 0;
      let errorCount = 0;
      const results: Array<{ userId: string; email: string; status: string; message: string }> = [];

      if (syncAll) {
        // Find all active subscriptions and sync their users
        const activeSubscriptions = await db
          .select()
          .from(lowfySubscriptions)
          .where(eq(lowfySubscriptions.status, 'active'));
        
        // Use a Set to avoid duplicates (same user might have multiple subscriptions)
        const userIdsSet = new Set<string>();
        for (const sub of activeSubscriptions) {
          if (sub.userId && !userIdsSet.has(sub.userId)) {
            userIdsSet.add(sub.userId);
            usersToSync.push({ userId: sub.userId, email: sub.buyerEmail });
          }
        }
        
        logger.debug(`[Admin Sync] Found ${usersToSync.length} unique active subscriptions to sync`);
      } else if (userId) {
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          return res.status(400).json({ message: 'userId inválido' });
        }
        usersToSync.push({ userId: userId.trim(), email: '' });
      } else if (email) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          usersToSync.push({ userId: user.id, email: user.email });
        } else {
          return res.status(404).json({ message: 'Usuário não encontrado com este email' });
        }
      } else {
        return res.status(400).json({ message: 'Forneça userId, email ou syncAll: true' });
      }

      for (const { userId: uid, email: userEmail } of usersToSync) {
        try {
          // Get active subscription for this user
          const subscription = await storage.getActiveLowfySubscriptionByUserId(uid);
          
          if (!subscription) {
            results.push({ 
              userId: uid, 
              email: userEmail, 
              status: 'skipped', 
              message: 'Sem assinatura ativa encontrada' 
            });
            continue;
          }

          // Calculate expiration date
          let expiresAt: Date;
          if (subscription.nextPaymentDate) {
            expiresAt = new Date(subscription.nextPaymentDate);
          } else if (subscription.expiresAt) {
            expiresAt = new Date(subscription.expiresAt);
          } else if (subscription.paidAt) {
            expiresAt = new Date(subscription.paidAt);
            if (subscription.plan === 'anual') {
              expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            } else {
              expiresAt.setMonth(expiresAt.getMonth() + 1);
            }
          } else {
            expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          // Update user subscription status
          await db
            .update(users)
            .set({
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expiresAt,
              accountStatus: 'active',
              updatedAt: new Date(),
            })
            .where(eq(users.id, uid));

          syncedCount++;
          results.push({ 
            userId: uid, 
            email: userEmail || subscription.buyerEmail, 
            status: 'synced', 
            message: `Sincronizado com sucesso. Expira em: ${expiresAt.toISOString()}` 
          });

          logger.debug(`[Admin Sync] ✅ User ${uid} subscription synced - expires: ${expiresAt.toISOString()}`);

          // Emit socket event for real-time UI update
          if (io) {
            io.to(`user:${uid}`).emit('subscription_activated', {
              subscriptionId: subscription.id,
              status: 'active',
            });
          }

        } catch (err: any) {
          errorCount++;
          results.push({ 
            userId: uid, 
            email: userEmail, 
            status: 'error', 
            message: err.message 
          });
          logger.error(`[Admin Sync] ❌ Error syncing user ${uid}:`, err.message);
        }
      }

      res.json({
        message: `Sincronização concluída. ${syncedCount} usuários sincronizados, ${errorCount} erros.`,
        totalProcessed: usersToSync.length,
        synced: syncedCount,
        errors: errorCount,
        results
      });

    } catch (error: any) {
      console.error('Error syncing subscription status:', error);
      res.status(500).json({ message: 'Erro ao sincronizar status de assinatura', error: error.message });
    }
  });

  // Quick sync for a single user by email (simpler endpoint)
  app.post('/api/admin/fix-subscription/:email', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { email } = req.params;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      const subscription = await storage.getActiveLowfySubscriptionByUserId(user.id);
      
      if (!subscription) {
        return res.status(404).json({ 
          message: 'Nenhuma assinatura ativa encontrada para este usuário',
          currentStatus: user.subscriptionStatus
        });
      }

      // Calculate expiration
      let expiresAt: Date;
      if (subscription.nextPaymentDate) {
        expiresAt = new Date(subscription.nextPaymentDate);
      } else if (subscription.expiresAt) {
        expiresAt = new Date(subscription.expiresAt);
      } else if (subscription.paidAt) {
        expiresAt = new Date(subscription.paidAt);
        if (subscription.plan === 'anual') {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1);
        }
      } else {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // Update user
      await db
        .update(users)
        .set({
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          accountStatus: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      logger.debug(`[Admin Fix] ✅ Fixed subscription for ${email} - expires: ${expiresAt.toISOString()}`);

      // Emit socket event
      if (io) {
        io.to(`user:${user.id}`).emit('subscription_activated', {
          subscriptionId: subscription.id,
          status: 'active',
        });
      }

      res.json({
        message: 'Assinatura corrigida com sucesso!',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        subscription: {
          id: subscription.id,
          plan: subscription.plan,
          status: 'active',
          expiresAt: expiresAt.toISOString(),
          paidAt: subscription.paidAt,
        },
        previousStatus: user.subscriptionStatus,
        newStatus: 'active'
      });

    } catch (error: any) {
      console.error('Error fixing subscription:', error);
      res.status(500).json({ message: 'Erro ao corrigir assinatura', error: error.message });
    }
  });

  // ==================== MARKETPLACE ADMIN MIGRATION ====================
  
  // Temporary route to run migrations for existing products and orders
  // NOTE: This is a one-time migration and should be removed after execution
  // ⚠️  IMPORTANT: Run this during maintenance mode (server offline recommended)
  // to prevent race conditions with concurrent checkouts
  let migrationInProgress = false;
  app.post('/api/admin/migrate-product-slugs', adminMiddleware, async (req: any, res) => {
    if (migrationInProgress) {
      return res.status(409).json({ message: 'Migration already in progress' });
    }
    
    try {
      migrationInProgress = true;
      console.warn('⚠️  [Migration] Running migration - Recommend server downtime to prevent race conditions');
      const { migrateProductSlugs, migrateOrderNumbers } = await import('./scripts/migrate-product-slugs.js');
      await migrateProductSlugs();
      await migrateOrderNumbers();
      res.json({ success: true, message: 'All migrations completed successfully' });
    } catch (error: any) {
      console.error('Migration error:', error);
      res.status(500).json({ message: error.message || 'Migration failed' });
    } finally {
      migrationInProgress = false;
    }
  });

  // POST /api/admin/asaas/disable-notifications - Desativar notificações automáticas do Asaas para todos os clientes
  app.post('/api/admin/asaas/disable-notifications', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const asaasService = getAsaasServiceSafe();
      
      if (!asaasService) {
        return res.status(503).json({ 
          message: 'Serviço Asaas não está configurado' 
        });
      }

      logger.debug('[Admin] Starting Asaas notification disable for all customers...');
      
      const result = await asaasService.disableAllCustomerNotifications();
      
      logger.debug('[Admin] ✅ Asaas notification disable completed:', result);

      // Determinar status HTTP baseado nos resultados
      let statusCode = 200;
      let message = 'Notificações desativadas com sucesso';

      if (result.failed > 0 && result.success === 0) {
        // Todas as tentativas falharam
        statusCode = 500;
        message = 'Falha ao desativar notificações - todas as tentativas falharam';
      } else if (result.failed > 0) {
        // Sucesso parcial
        statusCode = 207; // Multi-Status
        message = `Notificações desativadas parcialmente (${result.success}/${result.total} com sucesso)`;
      }

      res.status(statusCode).json({
        success: result.failed === 0,
        partial: result.failed > 0 && result.success > 0,
        message,
        details: {
          totalProcessed: result.total,
          successCount: result.success,
          failedCount: result.failed,
          successRate: result.total > 0 ? ((result.success / result.total) * 100).toFixed(1) + '%' : '0%'
        }
      });
    } catch (error: any) {
      console.error('[Admin] Error disabling Asaas notifications:', error);
      res.status(500).json({ 
        message: 'Erro ao desativar notificações do Asaas',
        error: error.message 
      });
    }
  });

  // ==================== MARKETPLACE ROUTES ====================

  // Helper function: Calculate available and pending balance
  async function calculateSellerBalance(sellerId: string) {
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const pendingTransactions = await db
      .select()
      .from(sellerTransactions)
      .where(
        and(
          eq(sellerTransactions.sellerId, sellerId),
          eq(sellerTransactions.type, 'sale'),
          eq(sellerTransactions.status, 'pending'),
          gte(sellerTransactions.createdAt, eightDaysAgo)
        )
      );

    const availableTransactions = await db
      .select()
      .from(sellerTransactions)
      .where(
        and(
          eq(sellerTransactions.sellerId, sellerId),
          eq(sellerTransactions.type, 'sale'),
          eq(sellerTransactions.status, 'pending'),
          lte(sellerTransactions.createdAt, eightDaysAgo)
        )
      );

    const balancePending = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);
    const balanceAvailable = availableTransactions.reduce((sum, t) => sum + t.amount, 0);

    return { balancePending, balanceAvailable };
  }

  // PRODUTO ROUTES (6 routes)

  // 1. GET /api/marketplace/products - Listar produtos ativos (vitrine pública)
  app.get('/api/marketplace/products', async (req, res) => {
    try {
      const { category, search } = req.query;

      let query = db
        .select({
          product: marketplaceProducts,
          seller: {
            id: users.id,
            name: users.name,
            profileImageUrl: users.profileImageUrl,
            areaAtuacao: users.areaAtuacao
          }
        })
        .from(marketplaceProducts)
        .leftJoin(users, eq(marketplaceProducts.sellerId, users.id))
        .where(eq(marketplaceProducts.isActive, true))
        .$dynamic();

      if (category) {
        query = query.where(eq(marketplaceProducts.category, String(category)));
      }

      if (search) {
        query = query.where(
          or(
            ilike(marketplaceProducts.title, `%${search}%`),
            ilike(marketplaceProducts.description, `%${search}%`)
          )
        );
      }

      const products = await query.orderBy(desc(marketplaceProducts.createdAt));

      res.json(products);
    } catch (error) {
      console.error('Error fetching marketplace products:', error);
      res.status(500).json({ message: 'Erro ao buscar produtos' });
    }
  });

  // 2. GET /api/marketplace/my-products - Listar produtos do vendedor logado
  app.get('/api/marketplace/my-products', authMiddleware, async (req: any, res) => {
    try {
      const products = await db
        .select()
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.sellerId, req.user.id))
        .orderBy(desc(marketplaceProducts.createdAt));

      res.json(products);
    } catch (error) {
      console.error('Error fetching my products:', error);
      res.status(500).json({ message: 'Erro ao buscar seus produtos' });
    }
  });

  // 3. POST /api/marketplace/products - Criar novo produto
  app.post('/api/marketplace/products', authMiddleware, async (req: any, res) => {
    try {
      const productData = insertMarketplaceProductSchema.parse(req.body);

      const { generateUniqueSlug } = await import('./utils/slug-utils.js');
      
      const checkSlugExists = async (slug: string) => {
        const existing = await db
          .select()
          .from(marketplaceProducts)
          .where(eq(marketplaceProducts.slug, slug))
          .limit(1);
        return existing.length > 0;
      };

      const slug = await generateUniqueSlug(productData.title, checkSlugExists);

      const [newProduct] = await db
        .insert(marketplaceProducts)
        .values({
          ...productData,
          slug,
          sellerId: req.user.id,
        })
        .returning();

      res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      res.status(500).json({ message: 'Erro ao criar produto' });
    }
  });

  // 4. PUT /api/marketplace/products/:id - Editar produto
  app.put('/api/marketplace/products/:id', authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;

      const [product] = await db
        .select()
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.id, id))
        .limit(1);

      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      if (product.sellerId !== req.user.id) {
        return res.status(403).json({ message: 'Você não tem permissão para editar este produto' });
      }

      const updates = req.body;

      if (updates.title && updates.title !== product.title) {
        const { generateUniqueSlug } = await import('./utils/slug-utils.js');
        
        const checkSlugExists = async (slug: string) => {
          const existing = await db
            .select()
            .from(marketplaceProducts)
            .where(and(
              eq(marketplaceProducts.slug, slug),
              sql`${marketplaceProducts.id} != ${id}`
            ))
            .limit(1);
          return existing.length > 0;
        };

        updates.slug = await generateUniqueSlug(updates.title, checkSlugExists);
      }

      const [updatedProduct] = await db
        .update(marketplaceProducts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(marketplaceProducts.id, id))
        .returning();

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Erro ao atualizar produto' });
    }
  });

  // 5. DELETE /api/marketplace/products/:id - Excluir produto
  app.delete('/api/marketplace/products/:id', authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;

      const [product] = await db
        .select()
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.id, id))
        .limit(1);

      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      if (product.sellerId !== req.user.id) {
        return res.status(403).json({ message: 'Você não tem permissão para excluir este produto' });
      }

      await db
        .delete(marketplaceProducts)
        .where(eq(marketplaceProducts.id, id));

      res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Erro ao excluir produto' });
    }
  });

  // 5.5. POST /api/marketplace/upload-images - Upload de imagens de produtos
  // Usando Replit Object Storage para persistência em produção
  app.post('/api/marketplace/upload-images', authMiddleware, upload.array('images', 10), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Nenhuma imagem foi enviada' });
      }

      const files = req.files as Express.Multer.File[];

      // VALIDAR TODOS OS ARQUIVOS PRIMEIRO (antes de salvar qualquer um)
      let totalSize = 0;
      for (const file of files) {
        totalSize += file.size;

        // Verificar tamanho individual (2MB por imagem)
        if (file.size > 2 * 1024 * 1024) {
          return res.status(400).json({
            message: `A imagem "${file.originalname}" excede o limite de 2MB`
          });
        }

        // Verificar tipo de arquivo
        if (!file.mimetype.startsWith('image/')) {
          return res.status(400).json({
            message: `O arquivo "${file.originalname}" não é uma imagem válida`
          });
        }
      }

      // Verificar tamanho total (5MB)
      if (totalSize > 5 * 1024 * 1024) {
        return res.status(400).json({
          message: 'O tamanho total das imagens excede 5MB. Use links externos para imagens maiores.'
        });
      }

      // Usar ObjectStorageService importado no topo do arquivo
      const objectStorageService = new ObjectStorageService();
      const uploadedUrls: string[] = [];

      for (const file of files) {
        try {
          console.log(`[Upload] Processing image: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);
          
          // Otimizar imagem: redimensionar se muito grande, comprimir, converter para webp
          const optimizedBuffer = await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({
              quality: 85,
              effort: 4
            })
            .toBuffer();

          console.log(`[Upload] Image optimized, new size: ${optimizedBuffer.length}`);

          // Upload para Object Storage (persistente)
          const objectPath = await objectStorageService.uploadBuffer(optimizedBuffer, 'products');
          console.log(`[Upload] Image uploaded successfully: ${objectPath}`);
          uploadedUrls.push(objectPath);
        } catch (processError: any) {
          console.error('[Upload] Error processing/uploading image:', processError?.message || processError);
          return res.status(500).json({
            message: `Erro ao processar a imagem "${file.originalname}": ${processError?.message || 'erro desconhecido'}`
          });
        }
      }

      console.log(`[Upload] All ${uploadedUrls.length} images uploaded successfully`);
      res.json({ urls: uploadedUrls });
    } catch (error: any) {
      console.error('[Upload] Error uploading product images:', error?.message || error);
      res.status(500).json({ message: 'Erro ao fazer upload das imagens' });
    }
  });

  // 6. GET /api/marketplace/products/:id - Detalhes de um produto (aceita slug ou UUID)
  app.get("/api/marketplace/products/:id", authMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;

      const [result] = await db
        .select({
          product: marketplaceProducts,
          seller: {
            id: users.id,
            name: users.name,
            profileImageUrl: users.profileImageUrl,
            bio: users.bio
          }
        })
        .from(marketplaceProducts)
        .leftJoin(users, eq(marketplaceProducts.sellerId, users.id))
        .where(
          or(
            eq(marketplaceProducts.id, id),
            eq(marketplaceProducts.slug, id)
          )
        )
        .limit(1);

      if (!result) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching product details:', error);
      res.status(500).json({ message: 'Erro ao buscar detalhes do produto' });
    }
  });

  // COMPRAS ROUTES (2 routes)

  // 7. GET /api/marketplace/my-purchases - Listar compras do usuário logado
  app.get('/api/marketplace/my-purchases', authMiddleware, async (req: any, res) => {
    try {
      const purchases = await db
        .select({
          order: marketplaceOrders,
          product: marketplaceProducts,
          seller: {
            id: users.id,
            name: users.name,
            profileImageUrl: users.profileImageUrl
          },
          paymentMethod: marketplaceOrders.paymentMethod
        })
        .from(marketplaceOrders)
        .leftJoin(marketplaceProducts, eq(marketplaceOrders.productId, marketplaceProducts.id))
        .leftJoin(users, eq(marketplaceOrders.sellerId, users.id))
        .where(eq(marketplaceOrders.buyerId, req.user.id))
        .orderBy(desc(marketplaceOrders.createdAt));

      res.json(purchases);
    } catch (error) {
      console.error('Error fetching my purchases:', error);
      res.status(500).json({ message: 'Erro ao buscar suas compras' });
    }
  });

  // 8. POST /api/marketplace/request-refund/:orderId - Solicitar reembolso (só funciona dentro de 7 dias)
  app.post('/api/marketplace/request-refund/:orderId', authMiddleware, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { refundReason } = req.body;

      // Validar justificativa (mínimo 180 caracteres)
      if (!refundReason || refundReason.trim().length < 180) {
        return res.status(400).json({ message: 'A justificativa deve ter no mínimo 180 caracteres' });
      }

      const [order] = await db
        .select()
        .from(marketplaceOrders)
        .where(eq(marketplaceOrders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: 'Pedido não encontrado' });
      }

      if (order.buyerId !== req.user.id) {
        return res.status(403).json({ message: 'Você não tem permissão para solicitar reembolso deste pedido' });
      }

      if (order.status === 'refunded' || order.status === 'refund_requested') {
        return res.status(400).json({ message: 'Reembolso já foi solicitado ou concluído' });
      }

      if (order.status !== 'paid' && order.status !== 'completed') {
        return res.status(400).json({ message: 'Apenas pedidos pagos podem ser reembolsados' });
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (order.createdAt < sevenDaysAgo) {
        return res.status(400).json({ message: 'O prazo para solicitar reembolso expirou (7 dias)' });
      }

      // Check if Podpay service is available and if order has transaction ID
      const podpayService = getPodpayServiceSafe();
      const shouldTryPodpayRefund = podpayService && order.podpayTransactionId;
      
      let podpayRefundSuccess = false;
      let refundFailureReason = '';

      // Process refund through Podpay API if available
      if (shouldTryPodpayRefund) {
        try {
          await podpayService.refundTransaction(order.podpayTransactionId);
          logger.debug('[Refund] ✅ Successfully processed Podpay refund for order:', orderId);
          podpayRefundSuccess = true;
        } catch (podpayError: any) {
          // Log error but don't fail - fallback to manual processing
          console.error('[Refund] ⚠️ Podpay refund failed, falling back to manual processing:', podpayError.message);
          logger.warn(`[Refund] Podpay API error for order ${orderId}: ${podpayError.message}`);
          
          // Check if it's a permission error
          if (podpayError.message?.includes('Permissão insuficiente') || 
              podpayError.message?.includes('FORBIDDEN') ||
              podpayError.message?.includes('Erro na adquirente')) {
            refundFailureReason = 'Reembolso automático não disponível. Sua solicitação será processada manualmente em até 24h.';
          } else {
            refundFailureReason = 'Reembolso automático temporariamente indisponível. Solicitação registrada para processamento manual.';
          }
          
          podpayRefundSuccess = false;
        }
      } else {
        if (!podpayService) {
          logger.debug('[Refund] Podpay not configured, marking as refund_requested');
          refundFailureReason = 'Solicitação registrada. Processamento manual será realizado.';
        } else if (!order.podpayTransactionId) {
          logger.debug('[Refund] No Podpay transaction ID for order, marking as refund_requested');
          refundFailureReason = 'Solicitação registrada para processamento manual.';
        }
      }

      // Update order status (refunded if Podpay succeeded, refund_requested if manual processing needed)
      const newStatus = podpayRefundSuccess ? 'refunded' : 'refund_requested';
      const [updatedOrder] = await db
        .update(marketplaceOrders)
        .set({
          status: newStatus,
          refundRequestedAt: new Date(),
          refundReason: refundReason || 'Não informado',
          updatedAt: new Date()
        })
        .where(eq(marketplaceOrders.id, orderId))
        .returning();

      // Process seller transactions for refund
      const [originalSaleTransaction] = await db
        .select()
        .from(sellerTransactions)
        .where(
          and(
            eq(sellerTransactions.orderId, orderId),
            eq(sellerTransactions.type, 'sale')
          )
        )
        .limit(1);

      if (originalSaleTransaction) {
        const refundAmount = originalSaleTransaction.netAmountCents || originalSaleTransaction.amount;
        const refundTransactionStatus = podpayRefundSuccess ? 'completed' : 'pending';
        const saleTransactionStatus = podpayRefundSuccess ? 'refunded' : 'refund_requested';

        // Update original sale transaction status
        await db
          .update(sellerTransactions)
          .set({
            status: saleTransactionStatus,
            updatedAt: new Date()
          })
          .where(eq(sellerTransactions.id, originalSaleTransaction.id));

        // Create refund transaction for seller (negative amount)
        // Status is 'completed' if auto-processed, 'pending' if awaiting manual approval
        await db
          .insert(sellerTransactions)
          .values({
            sellerId: order.sellerId,
            type: 'refund',
            amount: -refundAmount,
            originalPriceCents: originalSaleTransaction.originalPriceCents,
            discountCents: originalSaleTransaction.discountCents,
            grossAmountCents: originalSaleTransaction.grossAmountCents,
            systemFeeCents: originalSaleTransaction.systemFeeCents,
            netAmountCents: -refundAmount,
            orderId: orderId,
            status: refundTransactionStatus,
            description: `Reembolso: ${originalSaleTransaction.description || 'Venda'}`,
          });

        // Only update wallet balance if refund was auto-processed
        if (podpayRefundSuccess) {
          const [sellerWalletData] = await db
            .select()
            .from(sellerWallet)
            .where(eq(sellerWallet.sellerId, order.sellerId))
            .limit(1);

          if (sellerWalletData) {
            // Determine which balance to deduct from based on transaction status
            let newBalancePending = sellerWalletData.balancePending;
            let newBalanceAvailable = sellerWalletData.balanceAvailable;
            let newTotalRefunded = sellerWalletData.totalRefunded + refundAmount;

            if (originalSaleTransaction.status === 'pending') {
              // Deduct from pending balance if not yet released
              newBalancePending = Math.max(0, sellerWalletData.balancePending - refundAmount);
            } else if (originalSaleTransaction.status === 'completed') {
              // Deduct from available balance if already released
              newBalanceAvailable = Math.max(0, sellerWalletData.balanceAvailable - refundAmount);
            }

            await db
              .update(sellerWallet)
              .set({
                balancePending: newBalancePending,
                balanceAvailable: newBalanceAvailable,
                totalRefunded: newTotalRefunded,
                updatedAt: new Date()
              })
              .where(eq(sellerWallet.sellerId, order.sellerId));

            logger.debug(`[Refund] Updated seller wallet - Pending: ${newBalancePending}, Available: ${newBalanceAvailable}, Refunded: ${newTotalRefunded}`);
          }
        }

        logger.debug(`[Refund] Created ${refundTransactionStatus} refund transaction for seller ${order.sellerId}`);
      }

      // Enviar emails de notificação de reembolso
      try {
        const [buyer] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
        const [seller] = await db.select().from(users).where(eq(users.id, order.sellerId)).limit(1);
        const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);

        if (buyer && seller && product) {
          const amountInReais = order.amount / 100;

          // Email para o comprador
          const buyerRefundEmailHtml = generateRefundRequestedBuyerEmail(
            buyer.name,
            product.title,
            order.orderNumber,
            amountInReais,
            order.paymentMethod,
            updatedOrder.refundRequestedAt,
            refundReason
          );
          await sendEmail({
            to: buyer.email,
            subject: podpayRefundSuccess ? '✅ Reembolso Processado - Lowfy Marketplace' : '⏳ Reembolso Solicitado - Lowfy Marketplace',
            html: buyerRefundEmailHtml,
          });
          logger.debug(`[Refund Request] ✅ Email de reembolso enviado para comprador: ${buyer.email}`);

          // Email para o vendedor
          const sellerRefundEmailHtml = generateRefundRequestedVendorEmail(
            seller.name,
            buyer.name,
            product.title,
            order.orderNumber,
            amountInReais,
            order.paymentMethod,
            updatedOrder.refundRequestedAt,
            refundReason
          );
          await sendEmail({
            to: seller.email,
            subject: 'ℹ️ Solicitação de Reembolso - Lowfy Marketplace',
            html: sellerRefundEmailHtml,
          });
          logger.debug(`[Refund Request] ✅ Email de reembolso enviado para vendedor: ${seller.email}`);

          // Email para o admin
          const adminEmail = 'jl.uli1996@gmail.com';
          const adminRefundEmailHtml = generateRefundAdminEmail(
            order.orderNumber,
            product.title,
            buyer.name,
            buyer.email,
            seller.name,
            seller.email,
            amountInReais,
            podpayRefundSuccess,
            refundReason,
            order.paymentMethod,
            updatedOrder.refundRequestedAt
          );
          await sendEmail({
            to: adminEmail,
            subject: `🔔 ${podpayRefundSuccess ? 'Reembolso Processado' : 'Nova Solicitação de Reembolso'} - Pedido ${order.orderNumber}`,
            html: adminRefundEmailHtml,
          });
          logger.debug(`[Refund Request] ✅ Email de reembolso enviado para admin: ${adminEmail}`);
        }
      } catch (emailError) {
        logger.error(`[Refund Request] ❌ Erro ao enviar emails de reembolso para pedido ${order.id}:`, emailError);
      }

      const message = podpayRefundSuccess 
        ? 'Reembolso processado com sucesso! O valor será devolvido em até 5 dias úteis.' 
        : (refundFailureReason || 'Solicitação de reembolso registrada. Processamento manual necessário.');
      
      res.json({ 
        message, 
        order: updatedOrder,
        autoProcessed: podpayRefundSuccess 
      });
    } catch (error) {
      console.error('Error requesting refund:', error);
      res.status(500).json({ message: 'Erro ao solicitar reembolso' });
    }
  });

  // FINANCEIRO ROUTES (5 routes)

  // 9. GET /api/marketplace/wallet - Dados da carteira do vendedor
  app.get('/api/marketplace/wallet', authMiddleware, async (req: any, res) => {
    try {
      let [wallet] = await db
        .select()
        .from(sellerWallet)
        .where(eq(sellerWallet.sellerId, req.user.id))
        .limit(1);

      if (!wallet) {
        [wallet] = await db
          .insert(sellerWallet)
          .values({ sellerId: req.user.id })
          .returning();
      }

      const { balancePending, balanceAvailable } = await calculateSellerBalance(req.user.id);

      await db
        .update(sellerWallet)
        .set({
          balancePending,
          balanceAvailable,
          updatedAt: new Date()
        })
        .where(eq(sellerWallet.sellerId, req.user.id));

      const [updatedWallet] = await db
        .select()
        .from(sellerWallet)
        .where(eq(sellerWallet.sellerId, req.user.id))
        .limit(1);

      res.json(updatedWallet);
    } catch (error) {
      console.error('Error fetching wallet:', error);
      res.status(500).json({ message: 'Erro ao buscar carteira' });
    }
  });

  // 10. GET /api/marketplace/transactions - Histórico de transações
  app.get('/api/marketplace/transactions', authMiddleware, async (req: any, res) => {
    try {
      const { type, status } = req.query;

      let query = db
        .select()
        .from(sellerTransactions)
        .where(eq(sellerTransactions.sellerId, req.user.id))
        .$dynamic();

      if (type) {
        query = query.where(eq(sellerTransactions.type, String(type)));
      }

      if (status) {
        query = query.where(eq(sellerTransactions.status, String(status)));
      }

      const transactions = await query.orderBy(desc(sellerTransactions.createdAt));

      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Erro ao buscar transações' });
    }
  });

  // 11. POST /api/marketplace/withdraw - Solicitar saque (mínimo R$ 10,00 = 1000 centavos)
  app.post('/api/marketplace/withdraw', authMiddleware, async (req: any, res) => {
    try {
      const { amount } = req.body;

      if (!amount || amount < 1000) {
        return res.status(400).json({ message: 'Valor mínimo para saque é R$ 10,00' });
      }

      const [wallet] = await db
        .select()
        .from(sellerWallet)
        .where(eq(sellerWallet.sellerId, req.user.id))
        .limit(1);

      if (!wallet) {
        return res.status(404).json({ message: 'Carteira não encontrada' });
      }

      if (!wallet.pixKey || !wallet.pixKeyType) {
        return res.status(400).json({ message: 'Configure sua chave PIX antes de solicitar saque' });
      }

      const { balanceAvailable } = await calculateSellerBalance(req.user.id);

      if (balanceAvailable < amount) {
        return res.status(400).json({
          message: 'Saldo insuficiente',
          available: balanceAvailable,
          requested: amount
        });
      }

      const [transaction] = await db
        .insert(sellerTransactions)
        .values({
          sellerId: req.user.id,
          type: 'withdrawal',
          amount: -amount,
          status: 'pending',
          description: `Saque de R$ ${(amount / 100).toFixed(2)} via PIX`,
        })
        .returning();

      await db
        .update(sellerWallet)
        .set({
          balanceAvailable: balanceAvailable - amount,
          totalWithdrawn: wallet.totalWithdrawn + amount,
          updatedAt: new Date()
        })
        .where(eq(sellerWallet.sellerId, req.user.id));

      res.json({ message: 'Saque solicitado com sucesso', transaction });
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      res.status(500).json({ message: 'Erro ao processar saque' });
    }
  });

  // 12. GET /api/marketplace/sales-stats - Estatísticas de vendas (dashboard)
  app.get('/api/marketplace/sales-stats', authMiddleware, async (req: any, res) => {
    try {
      const salesResult = await db
        .select({
          totalSales: count(marketplaceOrders.id),
          totalRevenue: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)`,
        })
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.sellerId, req.user.id),
            eq(marketplaceOrders.status, 'completed')
          )
        );

      const activeProducts = await db
        .select({ count: count() })
        .from(marketplaceProducts)
        .where(
          and(
            eq(marketplaceProducts.sellerId, req.user.id),
            eq(marketplaceProducts.isActive, true)
          )
        );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSales = await db
        .select({
          count: count(marketplaceOrders.id),
          revenue: sql<number>`COALESCE(SUM(${marketplaceOrders.amount}), 0)`,
        })
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.sellerId, req.user.id),
            eq(marketplaceOrders.status, 'completed'),
            gte(marketplaceOrders.createdAt, thirtyDaysAgo)
          )
        );

      const [wallet] = await db
        .select()
        .from(sellerWallet)
        .where(eq(sellerWallet.sellerId, req.user.id))
        .limit(1);

      res.json({
        totalSales: salesResult[0]?.totalSales || 0,
        totalRevenue: salesResult[0]?.totalRevenue || 0,
        activeProducts: activeProducts[0]?.count || 0,
        salesLast30Days: recentSales[0]?.count || 0,
        revenueLast30Days: recentSales[0]?.revenue || 0,
        balancePending: wallet?.balancePending || 0,
        balanceAvailable: wallet?.balanceAvailable || 0,
        totalEarned: wallet?.totalEarned || 0,
        totalWithdrawn: wallet?.totalWithdrawn || 0,
      });
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      res.status(500).json({ message: 'Erro ao buscar estatísticas de vendas' });
    }
  });

  // 13. POST /api/marketplace/update-pix - Atualizar dados do PIX
  app.post('/api/marketplace/update-pix', authMiddleware, async (req: any, res) => {
    try {
      const { pixKey, pixKeyType } = req.body;

      if (!pixKey || !pixKeyType) {
        return res.status(400).json({ message: 'Chave PIX e tipo são obrigatórios' });
      }

      const validTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'];
      if (!validTypes.includes(pixKeyType)) {
        return res.status(400).json({ message: 'Tipo de chave PIX inválido' });
      }

      let [wallet] = await db
        .select()
        .from(sellerWallet)
        .where(eq(sellerWallet.sellerId, req.user.id))
        .limit(1);

      if (!wallet) {
        [wallet] = await db
          .insert(sellerWallet)
          .values({
            sellerId: req.user.id,
            pixKey,
            pixKeyType,
          })
          .returning();
      } else {
        [wallet] = await db
          .update(sellerWallet)
          .set({
            pixKey,
            pixKeyType,
            updatedAt: new Date()
          })
          .where(eq(sellerWallet.sellerId, req.user.id))
          .returning();
      }

      res.json({ message: 'Chave PIX atualizada com sucesso', wallet });
    } catch (error) {
      console.error('Error updating PIX:', error);
      res.status(500).json({ message: 'Erro ao atualizar chave PIX' });
    }
  });

  // ==================== PODPAY ROUTES ====================

  // POST /api/marketplace/checkout/pix - Processar pagamento PIX via Podpay
  app.post('/api/marketplace/checkout/pix', authMiddleware, paymentLimiter, async (req: any, res) => {
    try {
      const { orderId, items } = req.body;

      if (!orderId || !items) {
        return res.status(400).json({ message: 'Dados incompletos para criar transação PIX' });
      }

      // Get order info
      const [order] = await db
        .select()
        .from(marketplaceOrders)
        .where(eq(marketplaceOrders.id, orderId))
        .limit(1);

      if (!order) {
        return res.status(404).json({ message: 'Pedido não encontrado' });
      }

      // SECURITY: Verify order belongs to authenticated user
      if (order.buyerId !== req.user.id) {
        return res.status(403).json({ message: 'Não autorizado' });
      }

      // SECURITY: Recalculate total from database (never trust client)
      const recalculatedTotal = await db
        .select({ price: marketplaceProducts.price, quantity: sql<number>`1` })
        .from(marketplaceProducts)
        .where(eq(marketplaceProducts.id, order.productId))
        .limit(1);

      if (!recalculatedTotal || recalculatedTotal.length === 0) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      const totalCents = recalculatedTotal[0].price;

      // Get buyer info
      const [buyer] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!buyer) {
        return res.status(404).json({ message: 'Comprador não encontrado' });
      }

      // Create PIX transaction via Podpay
      const podpayResult = await createPixTransaction({
        orderId,
        sellerId: order.sellerId,
        buyerId: req.user.id,
        amountCents: totalCents,
        items,
        customer: {
          name: buyer.name,
          email: buyer.email,
        },
      });

      // Save transaction to database
      const transaction = await storage.createPodpayTransaction({
        orderId,
        sellerId: order.sellerId,
        buyerId: req.user.id,
        amountCents: totalCents,
        qrCodeData: podpayResult.qrCodeData,
        qrCodeImage: podpayResult.qrCodeImage,
        podpayTransactionId: podpayResult.transactionId,
        status: 'pending',
      });

      res.json({
        qrCodeData: podpayResult.qrCodeData,
        qrCodeImage: podpayResult.qrCodeImage,
        transactionId: transaction.id,
        podpayTransactionId: podpayResult.transactionId,
      });
    } catch (error: any) {
      console.error('Error creating PIX transaction:', error);
      res.status(500).json({ 
        message: 'Erro ao criar transação PIX',
        error: error.message 
      });
    }
  });

  // PUT /api/marketplace/pix-config - Configurar chave PIX do vendedor
  app.put('/api/marketplace/pix-config', authMiddleware, async (req: any, res) => {
    try {
      const validationResult = pixKeySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados de chave PIX inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { pixKey, pixKeyType } = validationResult.data;

      const wallet = await storage.getOrCreateSellerWallet(req.user.id);
      
      const updatedWallet = await storage.updateSellerWallet(req.user.id, {
        pixKey,
        pixKeyType,
      });

      res.json({ 
        message: 'Chave PIX configurada com sucesso', 
        wallet: updatedWallet 
      });
    } catch (error: any) {
      console.error('Error updating PIX config:', error);
      res.status(500).json({ message: 'Erro ao configurar chave PIX' });
    }
  });

  // GET /api/marketplace/available-balance - Calcular saldo disponível (regra 8 dias)
  app.get('/api/marketplace/available-balance', authMiddleware, async (req: any, res) => {
    try {
      const balance = await storage.calculateAvailableBalance(req.user.id);
      
      const wallet = await storage.getOrCreateSellerWallet(req.user.id);

      // Update wallet with calculated balances
      await storage.updateSellerWallet(req.user.id, {
        balancePending: balance.balancePending,
        balanceAvailable: balance.balanceAvailable,
      });

      res.json({
        balancePending: balance.balancePending,
        balanceAvailable: balance.balanceAvailable,
        pixKey: wallet.pixKey,
        pixKeyType: wallet.pixKeyType,
      });
    } catch (error: any) {
      console.error('Error calculating available balance:', error);
      res.status(500).json({ message: 'Erro ao calcular saldo disponível' });
    }
  });

  // POST /api/marketplace/request-withdrawal - Solicitar saque com taxa de R$ 2,49 (lucro da plataforma!)
  app.post('/api/marketplace/request-withdrawal', authMiddleware, withdrawalLimiter, async (req: any, res) => {
    try {
      const validationResult = withdrawalRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Dados de saque inválidos',
          errors: validationResult.error.errors 
        });
      }

      const { amountCents } = validationResult.data;
      const WITHDRAWAL_FEE = 249; // R$ 2,49 (receita da plataforma!)
      const MINIMUM_WITHDRAWAL = 1000; // R$ 10,00 (taxa será descontada desse valor)

      // Validate minimum amount
      if (amountCents < MINIMUM_WITHDRAWAL) {
        return res.status(400).json({
          message: 'O valor mínimo para saque é R$ 10,00. A taxa de R$ 2,49 será descontada desse valor.',
        });
      }

      // Get wallet and check PIX config
      const wallet = await storage.getOrCreateSellerWallet(req.user.id);

      if (!wallet.pixKey || !wallet.pixKeyType) {
        return res.status(400).json({ 
          message: 'Configure sua chave PIX antes de solicitar saque' 
        });
      }

      // Calculate available balance
      const balance = await storage.calculateAvailableBalance(req.user.id);

      if (balance.balanceAvailable < amountCents) {
        return res.status(400).json({
          message: 'Saldo insuficiente para saque',
          balanceAvailable: balance.balanceAvailable,
          requested: amountCents,
        });
      }

      // Calculate net amount after platform fee
      const netAmount = amountCents - WITHDRAWAL_FEE;

      // Get referral wallet to calculate split BEFORE creating the withdrawal
      const referralWalletData = await storage.getOrCreateReferralWallet(req.user.id);
      const referralAmountAvailable = referralWalletData.balanceAvailable;
      const referralAmountWithdrawn = Math.min(referralAmountAvailable, amountCents);
      const marketplaceAmountWithdrawn = amountCents - referralAmountWithdrawn;

      // Mapear tipo de chave PIX para o formato do Asaas (maiúsculas)
      const pixKeyTypeMap: Record<string, 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'> = {
        'cpf': 'CPF',
        'cnpj': 'CNPJ',
        'email': 'EMAIL',
        'phone': 'PHONE',
        'random': 'EVP',
      };
      
      const asaasPixKeyType = pixKeyTypeMap[wallet.pixKeyType] || 'EVP';

      // 1. PRIMEIRO: Try Asaas transfer FORA de transação (sem debitar nada)
      let asaasResult;
      try {
        asaasResult = await createPixTransfer({
          sellerId: req.user.id,
          amountCents: netAmount, // Transfere apenas valor líquido (sem a taxa da plataforma)
          pixKey: wallet.pixKey,
          pixKeyType: asaasPixKeyType,
          description: `Saque Lowfy Marketplace - R$ ${(netAmount / 100).toFixed(2)}`,
        });
        
        logger.debug('[Marketplace Withdrawal] Asaas transfer created:', {
          transferId: asaasResult.id,
          status: asaasResult.status,
          value: asaasResult.value,
        });
      } catch (asaasError: any) {
        // Asaas failed ANTES de debitar nada - usuário perde NADA!
        logger.error('[Marketplace Withdrawal] Asaas transfer failed (BEFORE debit):', asaasError);
        
        const errorMessage = asaasError.message || '';
        if (errorMessage.includes('Saldo insuficiente') || errorMessage.includes('insufficient')) {
          return res.status(503).json({
            message: 'Estamos com uma instabilidade temporária no processamento de saques. Por favor, tente novamente em alguns minutos.',
            code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
            retryAfter: 300
          });
        }
        
        return res.status(500).json({ message: `Falha ao processar saque: ${asaasError.message}` });
      }

      // 2. AGORA: Asaas sucesso - AGORA débitar ambas wallets DENTRO de transação
      const withdrawal = await db.transaction(async (tx) => {
        // Debit from marketplace wallet (with concurrency guard)
        await tx
          .update(sellerWallet)
          .set({
            balanceAvailable: sql`GREATEST(0, ${sellerWallet.balanceAvailable} - ${marketplaceAmountWithdrawn})`,
            totalWithdrawn: sql`${sellerWallet.totalWithdrawn} + ${marketplaceAmountWithdrawn}`,
            updatedAt: new Date(),
          })
          .where(eq(sellerWallet.userId, req.user.id));

        // Debit from referral wallet if applicable
        if (referralAmountWithdrawn > 0) {
          await tx
            .update(referralWallet)
            .set({
              balanceAvailable: sql`GREATEST(0, ${referralWallet.balanceAvailable} - ${referralAmountWithdrawn})`,
              totalWithdrawn: sql`${referralWallet.totalWithdrawn} + ${referralAmountWithdrawn}`,
              updatedAt: new Date(),
            })
            .where(eq(referralWallet.userId, req.user.id));
        }

        // Save withdrawal to database with GROSS amount (valor solicitado)
        const [newWithdrawal] = await tx.insert(podpayWithdrawals).values({
          sellerId: req.user.id,
          amountCents: amountCents, // Valor bruto (inclui taxa)
          status: 'pending',
          pixKey: wallet.pixKey,
          pixKeyType: wallet.pixKeyType,
          provider: 'asaas',
          asaasTransferId: asaasResult.id,
        }).returning();

        // Create marketplace transaction record
        await tx.insert(sellerTransactions).values({
          sellerId: req.user.id,
          type: 'withdrawal',
          amount: -marketplaceAmountWithdrawn,
          status: 'pending',
          description: `Saque de vendas: R$ ${(marketplaceAmountWithdrawn / 100).toFixed(2)} (parte de R$ ${(amountCents / 100).toFixed(2)}) via PIX`,
          relatedId: newWithdrawal.id,
        });

        // Create referral transaction record if applicable
        if (referralAmountWithdrawn > 0) {
          await tx.insert(referralTransactions).values({
            userId: req.user.id,
            type: 'withdrawal',
            amount: -referralAmountWithdrawn,
            status: 'pending',
            description: `Saque de comissões: R$ ${(referralAmountWithdrawn / 100).toFixed(2)} (parte de R$ ${(amountCents / 100).toFixed(2)}) via PIX`,
          });
        }

        return newWithdrawal;
      });

      // Enviar email de confirmação de saque solicitado
      try {
        const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
        if (user) {
          const withdrawalEmailHtml = generateWithdrawalRequestedEmail(
            user.name,
            amountCents / 100, // valor bruto solicitado
            WITHDRAWAL_FEE, // taxa em centavos
            netAmount / 100, // valor líquido que o vendedor vai receber
            `PIX - ${wallet.pixKeyType.toUpperCase()} ${wallet.pixKey}`
          );
          await sendEmail({
            to: user.email,
            subject: '💰 Saque Solicitado - Lowfy Marketplace',
            html: withdrawalEmailHtml,
          });
          logger.debug(`✅ Email de saque solicitado enviado para: ${user.email}`);
        }
      } catch (emailError) {
        logger.error('❌ Erro ao enviar email de saque:', emailError);
      }

      res.json({
        message: 'Saque solicitado com sucesso',
        withdrawal,
        asaasTransferId: asaasResult.id,
        requestedAmount: amountCents,
        fee: WITHDRAWAL_FEE, // R$ 2,49 (receita da plataforma!)
        netAmount: netAmount, // Valor que será transferido
      });
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      
      // Handle Asaas insufficient balance (temporary service issue)
      if (error.code === 'ASAAS_INSUFFICIENT_BALANCE') {
        return res.status(503).json({
          message: error.userMessage,
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          retryAfter: 300 // Sugerir tentar novamente em 5 minutos
        });
      }
      
      res.status(500).json({ 
        message: 'Erro ao solicitar saque',
        error: error.message 
      });
    }
  });

  // GET /api/marketplace/withdrawals - Listar saques do vendedor
  app.get('/api/marketplace/withdrawals', authMiddleware, async (req: any, res) => {
    try {
      const withdrawals = await storage.getSellerWithdrawals(req.user.id);
      res.json(withdrawals);
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
      res.status(500).json({ message: 'Erro ao buscar saques' });
    }
  });

  // ==================== SHOPPING CART ROUTES ====================

  // GET /api/marketplace/cart - Listar itens do carrinho
  app.get('/api/marketplace/cart', authMiddleware, async (req: any, res) => {
    try {
      const items = await db
        .select({
          id: cartItems.id,
          userId: cartItems.userId,
          productId: cartItems.productId,
          quantity: cartItems.quantity,
          createdAt: cartItems.createdAt,
          updatedAt: cartItems.updatedAt,
          product: {
            id: marketplaceProducts.id,
            title: marketplaceProducts.title,
            description: marketplaceProducts.description,
            price: marketplaceProducts.price,
            images: marketplaceProducts.images,
            sellerId: marketplaceProducts.sellerId,
            isActive: marketplaceProducts.isActive,
          },
          seller: {
            id: users.id,
            name: users.name,
            profileImageUrl: users.profileImageUrl,
          }
        })
        .from(cartItems)
        .innerJoin(marketplaceProducts, eq(cartItems.productId, marketplaceProducts.id))
        .innerJoin(users, eq(marketplaceProducts.sellerId, users.id))
        .where(
          and(
            eq(cartItems.userId, req.user.id),
            eq(marketplaceProducts.isActive, true)
          )
        )
        .orderBy(desc(cartItems.createdAt));

      res.json(items);
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Erro ao buscar carrinho' });
    }
  });

  // POST /api/marketplace/cart - Adicionar item ao carrinho
  app.post('/api/marketplace/cart', authMiddleware, async (req: any, res) => {
    try {
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({ message: 'ID do produto é obrigatório' });
      }

      // Verificar se o produto existe e está ativo (aceita ID ou slug)
      const [product] = await db
        .select()
        .from(marketplaceProducts)
        .where(
          and(
            or(
              eq(marketplaceProducts.id, productId),
              eq(marketplaceProducts.slug, productId)
            ),
            eq(marketplaceProducts.isActive, true)
          )
        )
        .limit(1);

      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      // Não permitir adicionar próprio produto ao carrinho
      if (product.sellerId === req.user.id) {
        return res.status(400).json({ message: 'Você não pode comprar seu próprio produto' });
      }

      // Verificar se já existe no carrinho (usar product.id, não o slug)
      const [existingItem] = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.userId, req.user.id),
            eq(cartItems.productId, product.id)
          )
        )
        .limit(1);

      if (existingItem) {
        // Atualizar quantidade
        const [updatedItem] = await db
          .update(cartItems)
          .set({
            quantity: existingItem.quantity + quantity,
            updatedAt: new Date()
          })
          .where(eq(cartItems.id, existingItem.id))
          .returning();

        return res.json({ message: 'Quantidade atualizada', item: updatedItem });
      }

      // Adicionar novo item (usar product.id, não o slug)
      const [newItem] = await db
        .insert(cartItems)
        .values({
          userId: req.user.id,
          productId: product.id,
          quantity
        })
        .returning();

      res.status(201).json({ message: 'Produto adicionado ao carrinho', item: newItem });
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Erro ao adicionar ao carrinho' });
    }
  });

  // PUT /api/marketplace/cart/:productId - Atualizar quantidade
  app.put('/api/marketplace/cart/:productId', authMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: 'Quantidade inválida' });
      }

      const [updatedItem] = await db
        .update(cartItems)
        .set({
          quantity,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(cartItems.userId, req.user.id),
            eq(cartItems.productId, productId)
          )
        )
        .returning();

      if (!updatedItem) {
        return res.status(404).json({ message: 'Item não encontrado no carrinho' });
      }

      res.json({ message: 'Quantidade atualizada', item: updatedItem });
    } catch (error) {
      console.error('Error updating cart item:', error);
      res.status(500).json({ message: 'Erro ao atualizar item do carrinho' });
    }
  });

  // DELETE /api/marketplace/cart/:productId - Remover item do carrinho
  app.delete('/api/marketplace/cart/:productId', authMiddleware, async (req: any, res) => {
    try {
      const { productId } = req.params;

      const result = await db
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, req.user.id),
            eq(cartItems.productId, productId)
          )
        )
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ message: 'Item não encontrado no carrinho' });
      }

      res.json({ message: 'Item removido do carrinho' });
    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ message: 'Erro ao remover do carrinho' });
    }
  });

  // DELETE /api/marketplace/cart - Limpar carrinho
  app.delete('/api/marketplace/cart', authMiddleware, async (req: any, res) => {
    try {
      await db
        .delete(cartItems)
        .where(eq(cartItems.userId, req.user.id));

      res.json({ message: 'Carrinho limpo com sucesso' });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Erro ao limpar carrinho' });
    }
  });

  // POST /api/marketplace/cart/cleanup - Remover produtos inválidos do carrinho
  app.post('/api/marketplace/cart/cleanup', authMiddleware, async (req: any, res) => {
    try {
      // Buscar todos os itens do carrinho com produtos
      const items = await db
        .select({
          cartItem: cartItems,
          product: marketplaceProducts,
        })
        .from(cartItems)
        .leftJoin(marketplaceProducts, eq(cartItems.productId, marketplaceProducts.id))
        .where(eq(cartItems.userId, req.user.id));

      // Identificar itens inválidos (sem produto ou produto inativo)
      const invalidItemIds = items
        .filter(item => !item.product || !item.product.isActive)
        .map(item => item.cartItem.id);

      if (invalidItemIds.length > 0) {
        // Remover itens inválidos um por um
        for (const itemId of invalidItemIds) {
          await db
            .delete(cartItems)
            .where(
              and(
                eq(cartItems.userId, req.user.id),
                eq(cartItems.id, itemId)
              )
            );
        }

        res.json({
          message: 'Produtos inválidos removidos',
          removedCount: invalidItemIds.length
        });
      } else {
        res.json({ message: 'Nenhum produto inválido encontrado', removedCount: 0 });
      }
    } catch (error) {
      console.error('Error cleaning up cart:', error);
      res.status(500).json({ message: 'Erro ao limpar produtos inválidos' });
    }
  });

  // POST /api/marketplace/calculate-installments - Calcular parcelamento otimizado
  app.post('/api/marketplace/calculate-installments', authMiddleware, paymentLimiter, async (req: any, res) => {
    try {
      const { amountCents } = req.body;

      if (!amountCents || amountCents <= 0) {
        return res.status(400).json({ message: 'Valor inválido' });
      }

      logger.debug('[Calculate Installments] Calculating for amount:', amountCents / 100);

      const calculations = await Promise.all(
        Array.from({ length: 12 }, (_, i) => i + 1).map(count => 
          calculateInstallmentSurcharge(amountCents, count)
        )
      );

      const installmentOptions = calculations.map(calc => ({
        installmentCount: calc.installmentCount,
        installmentValueCents: calc.installmentValueCents,
        totalAmountCents: calc.installmentTotalCents,
        productValueCents: calc.productValueCents,
        interestCents: calc.surchargeCents,
      }));

      logger.debug('[Calculate Installments] ✅ Calculated', installmentOptions.length, 'installment options');

      res.json({
        amountCents,
        installments: installmentOptions,
      });
    } catch (error: any) {
      console.error('[Calculate Installments] Error:', error);
      res.status(500).json({ 
        message: 'Erro ao calcular parcelamento',
        error: error.message 
      });
    }
  });

  // POST /api/marketplace/checkout - Processar checkout
  app.post('/api/marketplace/checkout', authMiddleware, paymentLimiter, async (req: any, res) => {
    try {
      const { paymentMethod, idempotencyKey } = req.body;

      // IDEMPOTENCY: Check if there's a recent pending order to prevent duplicates
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPendingOrders = await db
        .select()
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.buyerId, req.user.id),
            eq(marketplaceOrders.status, 'pending'),
            gte(marketplaceOrders.createdAt, fiveMinutesAgo)
          )
        )
        .limit(1);

      if (recentPendingOrders.length > 0) {
        console.warn(`[Checkout] Duplicate request detected for user ${req.user.id}`);
        return res.status(429).json({ 
          message: 'Você já tem um pedido pendente. Aguarde a conclusão antes de fazer um novo pedido.',
          existingOrderId: recentPendingOrders[0].id
        });
      }

      // Buscar itens do carrinho com produtos
      const items = await db
        .select({
          cartItem: cartItems,
          product: marketplaceProducts,
        })
        .from(cartItems)
        .leftJoin(marketplaceProducts, eq(cartItems.productId, marketplaceProducts.id))
        .where(eq(cartItems.userId, req.user.id));

      if (items.length === 0) {
        return res.status(400).json({ message: 'Carrinho vazio' });
      }

      // Validar produtos antes de criar orders
      const validItems = items.filter(item => {
        if (!item.product) {
          console.warn(`Product not found for cart item: ${item.cartItem.productId}`);
          return false;
        }
        if (!item.product.isActive) {
          console.warn(`Product is inactive: ${item.product.id}`);
          return false;
        }
        return true;
      });

      if (validItems.length === 0) {
        return res.status(400).json({
          message: 'Nenhum produto válido no carrinho. Os produtos podem ter sido removidos.'
        });
      }

      // Calcular total do carrinho (prices are in cents in DB)
      const totalAmount = validItems.reduce((sum, item) => {
        return sum + (item.product!.price * item.cartItem.quantity);
      }, 0);

      // Se for PIX, integrar com Podpay
      if (paymentMethod === 'pix') {
        try {
          // Preparar items para Podpay (prices are already in cents)
          const podpayItems = validItems.map(item => ({
            name: item.product!.title,
            quantity: item.cartItem.quantity,
            price: item.product!.price, // Already in cents
          }));

          // Buscar dados do comprador
          const buyer = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

          if (!buyer || buyer.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
          }

          // Gerar número de pedido sequencial
          const { generateOrderNumber } = await import('./utils/order-utils.js');
          const orderNumber = await generateOrderNumber();

          // Validar se comprador tem CPF
          if (!buyer[0].cpf) {
            return res.status(400).json({ 
              message: 'CPF não cadastrado. Por favor, atualize seu perfil com seu CPF para usar pagamento PIX.' 
            });
          }

          // Sanitizar CPF (remover formatação se existir) para garantir apenas dígitos
          const sanitizedCPF = buyer[0].cpf.replace(/\D/g, '');
          
          if (sanitizedCPF.length !== 11) {
            return res.status(400).json({ 
              message: 'CPF inválido. Por favor, atualize seu CPF no perfil com 11 dígitos.' 
            });
          }

          // Criar transação PIX na Podpay
          const { generateOrderDescription } = await import('./utils/order-utils.js');
          const firstProductName = validItems[0].product!.title;
          const orderDescription = generateOrderDescription(orderNumber, firstProductName);

          const podpayResult = await createPixTransaction({
            orderId: orderDescription,
            sellerId: validItems[0].product!.sellerId,
            buyerId: req.user.id,
            amountCents: totalAmount,
            items: podpayItems,
            customer: {
              name: buyer[0].name,
              email: buyer[0].email,
              phone: buyer[0].phone || '',
              cpf: sanitizedCPF,
            },
          });

          logger.debug('[Checkout] Podpay PIX created:', podpayResult);

          // Criar pedidos com status 'pending'
          const orders = [];
          for (const item of validItems) {
            const itemTotal = item.product!.price * item.cartItem.quantity;
            
            // CRITICAL: Calcular taxas do sistema ANTES da validação (PIX = taxa menor)
            const { calculateSystemFees, validateFinancialIntegrity } = await import('./utils/fees.js');
            const feeCalculation = calculateSystemFees(itemTotal, { paymentMethod: 'pix' });
            
            const orderData = {
              originalPriceCents: itemTotal,
              discountCents: 0,
              grossAmountCents: itemTotal,
              systemFeeCents: feeCalculation.systemFeeCents,
              netAmountCents: feeCalculation.netCents,
            };

            // CRITICAL: Validar integridade financeira com TODOS os campos
            const validation = validateFinancialIntegrity(orderData);
            
            if (!validation.isValid) {
              console.error('[Checkout PIX] Validação financeira falhou:', validation.errors);
              return res.status(400).json({ 
                message: 'Erro na validação dos valores financeiros',
                details: validation.errors 
              });
            }
            
            // Só salvar no banco APÓS validação bem-sucedida
            const order = await db
              .insert(marketplaceOrders)
              .values({
                orderNumber,
                buyerId: req.user.id,
                sellerId: item.product!.sellerId,
                productId: item.product!.id,
                amount: itemTotal,
                originalPriceCents: itemTotal,
                discountCents: 0,
                grossAmountCents: itemTotal,
                status: 'pending',
                paymentMethod: 'pix',
                podpayTransactionId: podpayResult.id.toString(),
              })
              .returning();

            orders.push(order[0]);

            // Criar transação para o vendedor com status pending
            await db.insert(sellerTransactions).values({
              sellerId: item.product!.sellerId,
              type: 'sale',
              amount: itemTotal,
              originalPriceCents: itemTotal,
              discountCents: 0,
              grossAmountCents: itemTotal,
              orderId: order[0].id,
              status: 'pending',
              description: `Venda do produto: ${item.product!.title}`,
            });
          }

          // NÃO limpar carrinho ainda - só após confirmação de pagamento

          // Retornar dados do PIX
          res.json({
            success: true,
            paymentMethod: 'pix',
            qrCode: podpayResult.pix?.qrcode,
            qrCodeImage: podpayResult.secureUrl,
            transactionId: podpayResult.id,
            expiresAt: podpayResult.pix?.expirationDate,
            orders,
            totalAmount,
          });

        } catch (error: any) {
          console.error('[Checkout] Podpay error:', error);
          return res.status(500).json({ 
            message: error.message || 'Erro ao criar pagamento PIX' 
          });
        }
      } else if (paymentMethod === 'card') {
        // Cartão de crédito - Asaas
        try {
          const { 
            cardNumber, 
            cardHolderName, 
            cardExpirationMonth, 
            cardExpirationYear, 
            cardCvv, 
            installments
          } = req.body;

          if (!cardNumber || !cardHolderName || !cardExpirationMonth || !cardExpirationYear || !cardCvv) {
            return res.status(400).json({ 
              message: 'Dados do cartão incompletos' 
            });
          }

          // Usar endereço padrão para todas as transações
          // IMPORTANTE: CEP deve ser de Curitiba para evitar rejeição por antifraude
          const defaultPostalCode = '80060000';  // CEP: Centro, Curitiba
          const defaultAddressNumber = '100';
          const defaultMobilePhone = '41999999999';  // Telefone padrão Curitiba

          const installmentCount = installments || 1;

          // Calcular juros de parcelamento simples (1.99% por parcela adicional)
          logger.debug('[Checkout Card] Calculating installment fees for:', {
            productValue: totalAmount / 100,
            installments: installmentCount,
          });

          const { calculateSimpleInstallments } = await import('./utils/fees.js');
          const installmentCalculation = calculateSimpleInstallments(totalAmount, installmentCount);
          
          logger.debug('[Checkout Card] Installment calculation:', {
            productValue: installmentCalculation.productValueCents / 100,
            baselineTotal: installmentCalculation.baselineTotalCents / 100,
            installmentTotal: installmentCalculation.installmentTotalCents / 100,
            cardInterest: installmentCalculation.surchargeCents / 100,
            perInstallment: installmentCalculation.installmentValueCents / 100,
          });

          // Preparar items para Asaas (prices are already in cents)
          const asaasItems = validItems.map(item => ({
            name: item.product!.title,
            quantity: item.cartItem.quantity,
            price: item.product!.price, // Already in cents
          }));

          // Buscar dados do comprador
          const buyer = await db
            .select()
            .from(users)
            .where(eq(users.id, req.user.id))
            .limit(1);

          if (!buyer || buyer.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
          }

          // Validar se comprador tem CPF
          if (!buyer[0].cpf) {
            return res.status(400).json({ 
              message: 'CPF não cadastrado. Por favor, atualize seu perfil com seu CPF para usar pagamento com cartão.' 
            });
          }

          // Sanitizar CPF (remover formatação se existir) para garantir apenas dígitos
          const sanitizedCPF = buyer[0].cpf.replace(/\D/g, '');
          
          if (sanitizedCPF.length !== 11) {
            return res.status(400).json({ 
              message: 'CPF inválido. Por favor, atualize seu CPF no perfil com 11 dígitos.' 
            });
          }

          // Gerar número de pedido sequencial
          const { generateOrderNumber, generateOrderDescription } = await import('./utils/order-utils.js');
          const orderNumber = await generateOrderNumber();
          const firstProductName = validItems[0].product!.title;
          const orderDescription = generateOrderDescription(orderNumber, firstProductName);

          // Pegar IP do cliente
          const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
          const remoteIp = Array.isArray(clientIp) ? clientIp[0] : clientIp.split(',')[0];

          // Criar transação com Asaas usando o valor pré-calculado (evita recalcular)
          const asaasResult = await createAsaasCardPayment({
            orderId: orderDescription,
            sellerId: validItems[0].product!.sellerId,
            buyerId: req.user.id,
            amountCents: totalAmount, // IMPORTANTE: Valor do produto (o que o vendedor recebe)
            precalculatedTotalCents: installmentCalculation.installmentTotalCents, // Otimização: usa valor já calculado
            items: asaasItems,
            customer: {
              name: buyer[0].name,
              email: buyer[0].email,
              phone: buyer[0].phone || defaultMobilePhone,
              cpf: sanitizedCPF,
              postalCode: defaultPostalCode,
              addressNumber: defaultAddressNumber,
              addressComplement: undefined,
              mobilePhone: buyer[0].phone || defaultMobilePhone, // Usar telefone do perfil
            },
            card: {
              number: cardNumber,
              holderName: cardHolderName,
              expiryMonth: cardExpirationMonth,
              expiryYear: cardExpirationYear,
              ccv: cardCvv,
            },
            installmentCount: installmentCount,
            installmentValue: installmentCalculation.installmentValueCents, // Valor de cada parcela COM juros
            remoteIp,
          });

          logger.debug('[Checkout] Asaas card payment created:', asaasResult);

          // CRITICAL FIX: Sempre criar pedidos como 'pending' para cartão
          // O webhook do Asaas processará a confirmação e enviará os emails
          logger.debug('[Checkout Card] ⏳ Criando pedidos com status PENDING - aguardando webhook do Asaas');
          logger.debug('[Checkout Card] 📧 Emails serão enviados pelo webhook após confirmação do Asaas');

          // Criar pedidos
          const orders = [];
          for (const item of validItems) {
            const itemTotal = item.product!.price * item.cartItem.quantity;
            
            // CRITICAL: Calcular taxas do sistema ANTES da validação (Cartão = taxa maior)
            const { calculateSystemFees, validateFinancialIntegrity } = await import('./utils/fees.js');
            const feeCalculation = calculateSystemFees(itemTotal, { paymentMethod: 'credit_card' });
            
            const orderData = {
              originalPriceCents: itemTotal,
              discountCents: 0,
              grossAmountCents: itemTotal,
              systemFeeCents: feeCalculation.systemFeeCents,
              netAmountCents: feeCalculation.netCents,
            };

            // CRITICAL: Validar integridade financeira com TODOS os campos
            const validation = validateFinancialIntegrity(orderData);
            
            if (!validation.isValid) {
              console.error('[Checkout Card] Validação financeira falhou:', validation.errors);
              return res.status(400).json({ 
                message: 'Erro na validação dos valores financeiros',
                details: validation.errors 
              });
            }
            
            // Só salvar no banco APÓS validação bem-sucedida
            const order = await db
              .insert(marketplaceOrders)
              .values({
                orderNumber,
                buyerId: req.user.id,
                sellerId: item.product!.sellerId,
                productId: item.product!.id,
                amount: itemTotal,
                originalPriceCents: itemTotal,
                discountCents: 0,
                grossAmountCents: itemTotal,
                status: 'pending', // SEMPRE pending - o webhook processará
                paymentMethod: 'card',
                asaasTransactionId: asaasResult.id,
                paidAt: null, // Será preenchido pelo webhook
              })
              .returning();

            orders.push(order[0]);

            logger.debug(`[Checkout Card] ✅ Pedido ${order[0].id} criado com status PENDING para produto ${item.product!.title}`);

            // Criar transação para o vendedor
            await db.insert(sellerTransactions).values({
              sellerId: item.product!.sellerId,
              type: 'sale',
              amount: itemTotal,
              originalPriceCents: itemTotal,
              discountCents: 0,
              grossAmountCents: itemTotal,
              orderId: order[0].id,
              status: 'pending', // SEMPRE pending - o webhook processará
              description: `Venda do produto: ${item.product!.title}`,
            });
          }

          // NÃO limpar carrinho aqui - o webhook fará isso após confirmação
          logger.debug('[Checkout Card] 🔔 Aguardando webhook do Asaas para confirmar pagamento e enviar emails');

          res.json({
            success: true,
            paymentMethod: 'card',
            status: 'pending', // SEMPRE pending inicialmente
            transactionId: asaasResult.id,
            orders,
            productValue: installmentCalculation.productValueCents / 100,
            totalAmount: installmentCalculation.installmentTotalCents / 100,
            cardInterest: installmentCalculation.surchargeCents / 100,
            installmentValue: installmentCalculation.installmentValueCents / 100,
            installmentCount: installmentCalculation.installmentCount,
          });

        } catch (error: any) {
          console.error('[Checkout] Asaas error:', error);
          return res.status(500).json({ 
            message: error.message || 'Erro ao processar pagamento com cartão' 
          });
        }
      } else {
        return res.status(400).json({ 
          message: 'Método de pagamento inválido' 
        });
      }
    } catch (error) {
      console.error('Error processing checkout:', error);
      res.status(500).json({ message: 'Erro ao processar pagamento' });
    }
  });

  // ==================== MARKETPLACE PAYMENT STATUS ====================
  // GET /api/marketplace/payment-status/:transactionId - Verificar status real do pagamento no Asaas
  app.get('/api/marketplace/payment-status/:transactionId', async (req, res) => {
    try {
      const { transactionId } = req.params;
      
      logger.debug('[Payment Status Check] Checking Asaas status for:', transactionId);
      
      const asaasPayment = await getAsaasPaymentStatus(transactionId);
      
      logger.debug('[Payment Status Check] ✅ Current status:', {
        id: asaasPayment.id,
        status: asaasPayment.status,
        billingType: asaasPayment.billingType,
      });
      
      res.json({
        status: asaasPayment.status,
        billingType: asaasPayment.billingType,
        id: asaasPayment.id,
      });
    } catch (error: any) {
      logger.error('[Payment Status Check] Error:', error.message);
      res.status(500).json({ message: 'Erro ao verificar status do pagamento' });
    }
  });

  // ==================== LOWFY SUBSCRIPTION ROUTES ====================
  // Rotas para gerenciar assinaturas internas da Lowfy (via Asaas/PodPay)

  // Preços das assinaturas em centavos
  const SUBSCRIPTION_PRICES = {
    mensal: 9990,   // R$ 99,90
    anual: 36090,   // R$ 360,90
  };

  // Helper: Calcular próxima data de cobrança
  const calculateNextPaymentDate = (fromDate: Date, plan: 'mensal' | 'anual'): Date => {
    const nextDate = new Date(fromDate);
    if (plan === 'mensal') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    return nextDate;
  };

  // Helper: Detectar bandeira do cartão
  const detectCardBrand = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return '';
  };

  // Helper: Extrair últimos 4 dígitos
  const getCardLastDigits = (cardNumber: string): string => {
    const cleaned = cardNumber.replace(/\s/g, '');
    return cleaned.slice(-4);
  };

  // GET/POST /api/subscriptions/validate-coupon - Validar cupom de desconto
  const validateCouponHandler = async (req: any, res: any) => {
    try {
      const cupom = req.query.coupon || req.query.cupom || req.body?.cupom;
      const plan = req.query.plan || req.body?.plan;

      if (!cupom || typeof cupom !== 'string') {
        return res.status(400).json({ valid: false, message: 'Cupom inválido.' });
      }

      if (!plan || !['mensal', 'anual'].includes(plan)) {
        return res.status(400).json({ valid: false, message: 'Plano inválido.' });
      }

      const normalizedCoupon = cupom.toUpperCase().trim();
      const originalPrice = SUBSCRIPTION_PRICES[plan as keyof typeof SUBSCRIPTION_PRICES];

      // Verificar se é um cupom de recuperação de checkout (50% off)
      // Cupons VOLTA50-XXXXX precisam existir no banco (gerados pelo scheduler)
      if (normalizedCoupon.startsWith('VOLTA50-')) {
        try {
          const couponRecord = await db
            .select()
            .from(checkoutRecoveryEmails)
            .where(
              and(
                eq(checkoutRecoveryEmails.discountCode, normalizedCoupon),
                inArray(checkoutRecoveryEmails.status, ['sent', 'clicked']),
                eq(checkoutRecoveryEmails.emailSequence, 4)
              )
            )
            .limit(1);

          if (couponRecord.length > 0) {
            const discountedPrice = Math.floor(originalPrice / 2);
            
            // Marcar cupom como clicado se ainda não foi
            if (couponRecord[0].status === 'sent') {
              await db
                .update(checkoutRecoveryEmails)
                .set({ 
                  clickedAt: new Date(),
                  status: 'clicked'
                })
                .where(eq(checkoutRecoveryEmails.id, couponRecord[0].id));
            }
            
            logger.info(`[Validate Coupon] VOLTA50 coupon validated from DB: ${normalizedCoupon}, plan: ${plan}`);
            
            return res.json({
              valid: true,
              code: normalizedCoupon,
              discountPercent: 50,
              discountPercentage: 50,
              originalPrice,
              discountedPrice,
              savings: originalPrice - discountedPrice,
              message: 'Cupom de 50% OFF aplicado com sucesso!'
            });
          }
        } catch (dbError) {
          logger.error('[Validate Coupon] Database error:', dbError);
        }
      }

      return res.json({ 
        valid: false, 
        message: 'Cupom inválido ou expirado.' 
      });

    } catch (error) {
      logger.error('[Validate Coupon] Error:', error);
      return res.status(500).json({ valid: false, message: 'Erro ao validar cupom.' });
    }
  };
  
  app.get('/api/subscriptions/validate-coupon', validateCouponHandler);
  app.post('/api/subscriptions/validate-coupon', validateCouponHandler);

  // POST /api/subscriptions/checkout - Processar checkout de assinatura
  // Usando optionalAuthMiddleware para permitir checkout de novos usuários não logados
  app.post('/api/subscriptions/checkout', subscriptionCheckoutLimiter, optionalAuthMiddleware, async (req, res) => {
    try {
      const {
        plan,
        paymentMethod,
        buyerName,
        buyerEmail,
        buyerCpf,
        buyerPhone,
        cep,
        addressNumber,
        complement,
        referralCode,
        card,
        cupom
      } = req.body;

      // CRITICAL FIX: Recuperar código de referência da cookie se não foi passado no body
      // Este é o código que vem do link de indicação (ref=CODIGO)
      const referralCodeFromCookie = getReferralCodeFromCookie(req);
      const finalReferralCode = referralCode || referralCodeFromCookie;

      // 📊 EMQ (Event Match Quality) - Capturar dados para melhorar rastreamento Meta
      // Esses dados são cruciais para aumentar a pontuação de correspondência de eventos
      const clientIpAddress = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() 
        || req.headers['x-real-ip']?.toString() 
        || req.socket.remoteAddress 
        || req.ip;
      const clientUserAgent = req.headers['user-agent'] || '';
      const fbc = req.cookies?._fbc || req.body.fbc || ''; // Facebook Click ID
      const fbp = req.cookies?._fbp || req.body.fbp || ''; // Facebook Browser ID

      logger.debug('[Subscription Checkout] Processing checkout:', {
        plan,
        paymentMethod,
        buyerEmail,
        buyerCpf: buyerCpf?.substring(0, 3) + '***',
        cupom: cupom || 'none',
        hasEmqData: !!(clientIpAddress && clientUserAgent),
        hasFbc: !!fbc,
        hasFbp: !!fbp,
      });

      // Validar campos obrigatórios
      if (!plan || !['mensal', 'anual'].includes(plan)) {
        return res.status(400).json({ message: 'Plano inválido. Escolha mensal ou anual.' });
      }

      if (!paymentMethod || !['credit_card', 'pix'].includes(paymentMethod)) {
        return res.status(400).json({ message: 'Método de pagamento inválido.' });
      }

      if (!buyerName || !buyerEmail || !buyerCpf) {
        return res.status(400).json({ message: 'Nome, email e CPF são obrigatórios.' });
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(buyerEmail)) {
        return res.status(400).json({ message: 'Email inválido.' });
      }

      // Normalizar CPF (remover formatação)
      const normalizedCpf = buyerCpf.replace(/\D/g, '');
      if (normalizedCpf.length !== 11) {
        return res.status(400).json({ message: 'CPF deve ter 11 dígitos.' });
      }

      // Normalizar telefone (adiciona 9 se tiver apenas 10 dígitos)
      const normalizedPhone = buyerPhone ? normalizeBrazilianPhone(buyerPhone) || '' : '';

      // Usar endereço padrão para todas as transações (mesmo padrão do marketplace)
      // IMPORTANTE: CEP deve ser de Curitiba para evitar rejeição por antifraude
      const defaultPostalCode = '80060000';  // CEP: Centro, Curitiba
      const defaultAddressNumber = '100';
      const defaultMobilePhone = normalizedPhone || '41999999999';  // Usar telefone do usuário ou padrão

      // Obter preço do plano
      let amountCents = SUBSCRIPTION_PRICES[plan as keyof typeof SUBSCRIPTION_PRICES];
      let appliedDiscountPercent = 0;
      let appliedDiscountCode: string | null = null;

      // Validar e aplicar cupom de desconto (VOLTA50-XXXXXXXX para recuperação de checkout)
      if (cupom && typeof cupom === 'string') {
        const normalizedCoupon = cupom.toUpperCase().trim();
        
        // Verificar se é um cupom de recuperação de checkout (50% off)
        // Cupons VOLTA50-XXXXX precisam existir no banco (gerados pelo scheduler)
        if (normalizedCoupon.startsWith('VOLTA50-')) {
          try {
            const couponRecord = await db
              .select()
              .from(checkoutRecoveryEmails)
              .where(
                and(
                  eq(checkoutRecoveryEmails.discountCode, normalizedCoupon),
                  inArray(checkoutRecoveryEmails.status, ['sent', 'clicked']),
                  eq(checkoutRecoveryEmails.emailSequence, 4)
                )
              )
              .limit(1);

            if (couponRecord.length > 0) {
              // Aplicar desconto de 50%
              appliedDiscountPercent = 50;
              appliedDiscountCode = normalizedCoupon;
              amountCents = Math.floor(amountCents / 2);
              
              logger.info('[Subscription Checkout] Cupom VOLTA50 de recuperação aplicado:', {
                cupom: normalizedCoupon,
                originalAmount: SUBSCRIPTION_PRICES[plan as keyof typeof SUBSCRIPTION_PRICES],
                discountedAmount: amountCents,
                discountPercent: appliedDiscountPercent,
              });

              // Marcar cupom como convertido
              await db
                .update(checkoutRecoveryEmails)
                .set({ 
                  convertedAt: new Date(),
                  status: 'converted'
                })
                .where(eq(checkoutRecoveryEmails.id, couponRecord[0].id));
            } else {
              logger.warn('[Subscription Checkout] Cupom de recuperação inválido ou já usado:', normalizedCoupon);
            }
          } catch (dbError) {
            logger.error('[Subscription Checkout] Erro ao validar cupom:', dbError);
          }
        }
      }

      // Gerar token de ativação único
      const activationToken = crypto.randomUUID();

      // Gerar ID único para a assinatura
      const subscriptionId = crypto.randomUUID();

      if (paymentMethod === 'credit_card') {
        // Validar dados do cartão
        if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.cvv) {
          return res.status(400).json({ message: 'Dados do cartão são obrigatórios para pagamento com cartão.' });
        }

        try {
          const asaasService = getAsaasServiceSafe();
          if (!asaasService) {
            return res.status(500).json({ message: 'Serviço de pagamento com cartão não configurado.' });
          }

          // Obter IP do cliente
          const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '127.0.0.1';

          // Criar ASSINATURA RECORRENTE no Asaas
          // NOTA: Usamos /subscriptions ao invés de /payments para cobranças automáticas
          // - O serviço Asaas (server/services/asaas.ts) já configura notificações desabilitadas
          // - Para assinaturas Lowfy, NÃO repassamos taxas ao comprador
          // - O valor cobrado é exatamente R$99,90 (mensal) ou R$360,90 (anual)
          // - O Asaas fará a cobrança automática no ciclo definido (MONTHLY ou YEARLY)
          const asaasCycle = plan === 'anual' ? 'YEARLY' : 'MONTHLY';
          
          const asaasResult = await asaasService.createRecurringSubscription({
            subscriptionId,
            amountCents,
            cycle: asaasCycle,
            description: `Assinatura Lowfy - ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
            customer: {
              name: buyerName,
              email: buyerEmail,
              phone: defaultMobilePhone,
              cpf: normalizedCpf,
              postalCode: defaultPostalCode,
              addressNumber: defaultAddressNumber,
              addressComplement: undefined,
              mobilePhone: defaultMobilePhone,
            },
            card: {
              number: card.number.replace(/\s/g, ''),
              holderName: card.holderName,
              expiryMonth: card.expiryMonth,
              expiryYear: card.expiryYear,
              ccv: card.cvv,
            },
            remoteIp,
          });

          logger.debug('[Subscription Checkout] Asaas recurring subscription created:', {
            id: asaasResult.id,
            status: asaasResult.status,
            cycle: asaasResult.cycle,
            nextDueDate: asaasResult.nextDueDate,
          });

          // CRITICAL FIX: Verificar o status REAL da primeira cobrança, não apenas da assinatura
          // O Asaas pode retornar subscription.status = ACTIVE mas a primeira cobrança pode estar em análise anti-fraude
          let initialStatus: 'active' | 'pending' | 'awaiting_payment' = 'pending';
          let firstPaymentStatus: string | null = null;
          
          try {
            // Buscar a primeira cobrança da assinatura para verificar status real
            const payments = await asaasService.listSubscriptionPayments(asaasResult.id, { limit: 1 });
            if (payments.data && payments.data.length > 0) {
              firstPaymentStatus = payments.data[0].status;
              logger.debug('[Subscription Checkout] First payment status check:', {
                subscriptionStatus: asaasResult.status,
                firstPaymentId: payments.data[0].id,
                firstPaymentStatus: firstPaymentStatus,
              });
              
              // Apenas marcar como ACTIVE se o pagamento foi CONFIRMADO ou RECEBIDO
              // Status de pagamento confirmado: CONFIRMED, RECEIVED, RECEIVED_IN_CASH
              if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(firstPaymentStatus)) {
                initialStatus = 'active';
              } else if (['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(firstPaymentStatus)) {
                // Pagamento em análise anti-fraude ou aguardando processamento
                initialStatus = 'pending';
              } else {
                // Outros status (OVERDUE, REFUNDED, etc)
                initialStatus = 'awaiting_payment';
              }
            } else {
              // Se não encontrou cobrança, manter como pending até webhook confirmar
              logger.debug('[Subscription Checkout] No payments found yet, keeping as pending');
              initialStatus = 'pending';
            }
          } catch (paymentCheckError: any) {
            // Se falhar a verificação, assumir pending para ser conservador
            logger.warn('[Subscription Checkout] Could not verify first payment status, defaulting to pending:', paymentCheckError.message);
            initialStatus = 'pending';
          }
          
          logger.debug('[Subscription Checkout] Final initial status determined:', {
            subscriptionStatus: asaasResult.status,
            firstPaymentStatus,
            initialStatus,
          });

          // Detectar bandeira do cartão
          const cardBrand = detectCardBrand(card.number);
          const cardLastDigits = getCardLastDigits(card.number);

          // Calcular próxima data de cobrança
          // Usar nextDueDate do Asaas se disponível, senão calcular
          const paidDate = initialStatus === 'active' ? new Date() : null;
          let nextPaymentDate: Date | null = null;
          if (asaasResult.nextDueDate) {
            nextPaymentDate = new Date(asaasResult.nextDueDate);
          } else if (paidDate) {
            nextPaymentDate = calculateNextPaymentDate(paidDate, plan);
          }

          // Criar registro da assinatura (vincular ao usuário se estiver logado)
          // providerTransactionId = ID da assinatura no Asaas (para rastrear cobranças recorrentes)
          // providerSubscriptionId = também o ID da assinatura no Asaas
          const subscription = await storage.createLowfySubscription({
            id: subscriptionId,
            userId: (req as any).user?.id || null,
            provider: 'asaas',
            providerTransactionId: asaasResult.id,
            providerSubscriptionId: asaasResult.id, // ID da assinatura recorrente no Asaas
            plan,
            status: initialStatus,
            amount: amountCents,
            paymentMethod: 'credit_card',
            cardBrand,
            cardLastDigits,
            buyerName,
            buyerEmail: buyerEmail.toLowerCase().trim(),
            buyerCpf: normalizedCpf,
            buyerPhone: normalizedPhone || null,
            buyerPostalCode: cep ? cep.replace(/\D/g, '') : defaultPostalCode,
            buyerAddressNumber: addressNumber || defaultAddressNumber,
            activationToken,
            referralCode: finalReferralCode || null,
            paidAt: paidDate,
            nextPaymentDate,
            // 📊 EMQ Data - Dados para melhorar Event Match Quality no Meta
            webhookData: {
              emq: {
                clientIpAddress: clientIpAddress || null,
                clientUserAgent: clientUserAgent || null,
                fbc: fbc || null,
                fbp: fbp || null,
                capturedAt: new Date().toISOString(),
              }
            },
          });

          logger.debug('[Subscription Checkout] Card subscription created:', {
            subscriptionId: subscription.id,
            status: subscription.status,
            activationToken,
            userId: (req as any).user?.id || 'not logged in',
          });

          // Se pagamento foi aprovado e usuário está logado, atualizar subscriptionStatus E subscriptionExpiresAt
          if (initialStatus === 'active' && (req as any).user) {
            await storage.updateUser((req as any).user.id, { 
              subscriptionStatus: 'active',
              subscriptionExpiresAt: nextPaymentDate,
              accountStatus: 'active',
            });
            logger.debug('[Subscription Checkout] User subscription status updated to active:', { 
              userId: (req as any).user.id,
              subscriptionExpiresAt: nextPaymentDate,
            });
          }

          // CRITICAL FIX: Process referral commission for credit card payments that are approved immediately
          // Previously, this was only handled in the webhook, causing missed commissions for instant card approvals
          if (initialStatus === 'active' && finalReferralCode) {
            try {
              const referralCodeRecord = await storage.getReferralCodeByCode(finalReferralCode);
              const subscriberUserId = (req as any).user?.id || subscription.userId;
              
              if (referralCodeRecord && subscriberUserId && referralCodeRecord.userId !== subscriberUserId) {
                // Calculate 50% commission
                const commissionPercentage = 50;
                const commissionAmountCents = Math.floor(amountCents * commissionPercentage / 100);
                
                await storage.createReferralCommission({
                  referrerId: referralCodeRecord.userId,
                  referredUserId: subscriberUserId,
                  subscriptionId: subscription.id,
                  subscriptionAmountCents: amountCents,
                  commissionPercentage,
                  commissionAmountCents,
                  status: 'pending',
                  type: 'subscription',
                  metadata: { 
                    provider: 'asaas',
                    plan: plan,
                    current_period: 1,
                    source: 'checkout_direct', // Indicate this was created at checkout, not webhook
                  },
                });
                
                logger.debug('[Subscription Checkout] ✅ Referral commission created for credit card payment', {
                  referrerId: referralCodeRecord.userId,
                  referredUserId: subscriberUserId,
                  commissionAmountCents,
                  subscriptionId: subscription.id,
                });
              }
            } catch (refError) {
              logger.error('[Subscription Checkout] ❌ Error creating referral commission:', refError);
              // Don't fail the whole checkout if commission creation fails
            }
          }

          // 📊 CRITICAL FIX: Facebook Conversions API - Enviar evento de Purchase IMEDIATAMENTE
          // quando pagamento é confirmado no checkout (não esperar pelo webhook que pode ser bloqueado por idempotência)
          if (initialStatus === 'active') {
            try {
              await sendFacebookPurchase({
                email: buyerEmail,
                phone: normalizedPhone || undefined,
                firstName: buyerName.split(' ')[0] || 'Cliente',
                lastName: buyerName.split(' ').slice(1).join(' ') || undefined,
                userId: (req as any).user?.id || subscription.userId || undefined,
                value: amountCents,
                currency: 'BRL',
                contentName: `Lowfy ${plan === 'mensal' ? 'Monthly' : 'Yearly'} Subscription`,
                contentIds: ['subscription'],
                orderId: subscription.id,
                eventSourceUrl: getAppUrl('/'),
                // 📊 EMQ Parameters - Boost Event Match Quality score
                clientIpAddress: clientIpAddress || undefined,
                clientUserAgent: clientUserAgent || undefined,
                fbc: fbc || undefined,
                fbp: fbp || undefined,
              });
              logger.info(`[Subscription Checkout] ✅ Facebook Purchase event enviado no checkout: ${buyerEmail} (plan: ${plan}, EMQ: ${clientIpAddress ? 'yes' : 'no'})`);
            } catch (fbError: any) {
              logger.warn(`[Subscription Checkout] ⚠️ Falha ao enviar evento Facebook:`, fbError.message);
              // Don't fail the checkout if Facebook event fails
            }
          }

          res.json({
            success: true,
            subscriptionId: subscription.id,
            activationToken,
            paymentMethod: 'credit_card',
            transactionId: asaasResult.id,
            status: initialStatus,
          });

        } catch (error: any) {
          console.error('[Subscription Checkout] Card payment error:', error);
          return res.status(500).json({ 
            message: error.message || 'Erro ao processar pagamento com cartão.' 
          });
        }

      } else if (paymentMethod === 'pix') {
        try {
          const podpayService = getPodpayServiceSafe();
          if (!podpayService) {
            return res.status(500).json({ message: 'Serviço de pagamento PIX não configurado.' });
          }

          // Criar transação PIX no PodPay
          const pixResult = await podpayService.createPixTransaction({
            orderId: subscriptionId,
            sellerId: 'lowfy',
            buyerId: 'new-subscriber',
            amountCents,
            items: [{
              name: `Assinatura Lowfy - ${plan === 'mensal' ? 'Mensal' : 'Anual'}`,
              quantity: 1,
              price: amountCents,
            }],
            customer: {
              name: buyerName,
              email: buyerEmail,
              phone: normalizedPhone,
              cpf: normalizedCpf,
            },
          });

          logger.debug('[Subscription Checkout] PodPay PIX created:', {
            id: pixResult.id,
            status: pixResult.status,
          });

          // Criar registro da assinatura com status aguardando pagamento (vincular ao usuário se estiver logado)
          const subscription = await storage.createLowfySubscription({
            id: subscriptionId,
            userId: (req as any).user?.id || null,
            provider: 'podpay',
            providerTransactionId: String(pixResult.id),
            plan,
            status: 'awaiting_payment',
            amount: amountCents,
            paymentMethod: 'pix',
            buyerName,
            buyerEmail: buyerEmail.toLowerCase().trim(),
            buyerCpf: normalizedCpf,
            buyerPhone: normalizedPhone || null,
            buyerPostalCode: cep ? cep.replace(/\D/g, '') : defaultPostalCode,
            buyerAddressNumber: addressNumber || defaultAddressNumber,
            activationToken,
            referralCode: finalReferralCode || null,
            qrCodeData: pixResult.pix?.qrcode || null,
            pixExpiresAt: pixResult.pix?.expirationDate ? new Date(pixResult.pix.expirationDate) : null,
            // 📊 EMQ Data - Dados para melhorar Event Match Quality no Meta
            webhookData: {
              emq: {
                clientIpAddress: clientIpAddress || null,
                clientUserAgent: clientUserAgent || null,
                fbc: fbc || null,
                fbp: fbp || null,
                capturedAt: new Date().toISOString(),
              }
            },
          });

          logger.debug('[Subscription Checkout] PIX subscription created:', {
            subscriptionId: subscription.id,
            status: subscription.status,
            activationToken,
            userId: (req as any).user?.id || 'not logged in',
          });

          res.json({
            success: true,
            subscriptionId: subscription.id,
            activationToken,
            paymentMethod: 'pix',
            transactionId: String(pixResult.id),
            status: 'awaiting_payment',
            qrCode: pixResult.pix?.qrcode,
            pixExpiresAt: pixResult.pix?.expirationDate,
            amount: amountCents,
            planName: plan === 'mensal' ? 'Plano Mensal' : 'Plano Anual',
          });

        } catch (error: any) {
          console.error('[Subscription Checkout] PIX error:', error);
          return res.status(500).json({ 
            message: error.message || 'Erro ao gerar PIX.' 
          });
        }
      }

    } catch (error) {
      console.error('[Subscription Checkout] Error:', error);
      res.status(500).json({ message: 'Erro ao processar checkout.' });
    }
  });

  // GET /api/subscriptions/payment-status/:transactionId - Status do pagamento PIX (tempo real)
  app.get('/api/subscriptions/payment-status/:transactionId', async (req, res) => {
    try {
      const { transactionId } = req.params;

      logger.debug('[Subscription Payment Status] Checking status in real-time:', { transactionId });

      const subscription = await storage.getLowfySubscriptionByProviderTransactionId(transactionId);
      if (!subscription) {
        return res.status(404).json({ message: 'Assinatura não encontrada.' });
      }

      // Se já está ativo, retornar diretamente
      if (subscription.status === 'active') {
        return res.json({
          status: 'active',
          activationToken: subscription.activationToken,
        });
      }


      // Se está aguardando pagamento PIX, consultar provedor em tempo real
      if (subscription.status === 'awaiting_payment' && subscription.paymentMethod === 'pix') {
        const provider = subscription.provider || 'podpay';
        logger.debug('[Subscription Payment Status] Provider:', { provider, transactionId });

        try {
          let providerStatus = '';

          if (provider === 'asaas') {
            // Consultar Asaas
            const asaasPayment = await getAsaasPaymentStatus(transactionId);
            providerStatus = asaasPayment.status;
            logger.debug('[Subscription Payment Status] Asaas response:', { transactionId, status: providerStatus });

            // Status Asaas que indicam pagamento confirmado
            const paidStatuses = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
            if (paidStatuses.includes(providerStatus)) {
              // Pagamento confirmado!
              const now = new Date();
              const plan = subscription.plan || 'mensal';
              const daysToAdd = plan === 'anual' ? 365 : 30;
              const expiresAt = new Date(now);
              expiresAt.setDate(expiresAt.getDate() + daysToAdd);

              // CRITICAL FIX: Criar usuário provisório ANTES de atualizar subscription
              await createProvisionalUserOnPaymentGlobal(subscription, expiresAt);

              await storage.updateLowfySubscription(subscription.id, {
                status: 'active',
                paymentConfirmedAt: now,
                expiresAt: expiresAt,
              });

              logger.debug('[Subscription Payment Status] Payment confirmed via Asaas!', { transactionId });
              return res.json({ status: 'active', activationToken: subscription.activationToken });
            }

            // Status Asaas de recusa
            const failedStatuses = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE'];
            if (failedStatuses.includes(providerStatus)) {
              return res.json({ status: 'refused', message: 'Pagamento foi recusado ou cancelado.' });
            }

          } else {
            // Consultar Podpay (provider === 'podpay' ou padrão)
            const podpayService = getPodpayServiceSafe();
            if (podpayService) {
              const podpayResult = await podpayService.getTransactionStatus(transactionId);
              providerStatus = podpayResult.status;
              logger.debug('[Subscription Payment Status] Podpay response:', { transactionId, status: providerStatus });

              // Status Podpay que indicam pagamento confirmado
              const paidStatuses = ['paid', 'confirmed', 'approved', 'completed'];
              if (paidStatuses.includes(providerStatus.toLowerCase())) {
                // Pagamento confirmado!
                const now = new Date();
                const plan = subscription.plan || 'mensal';
                const daysToAdd = plan === 'anual' ? 365 : 30;
                const expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + daysToAdd);

                // CRITICAL FIX: Criar usuário provisório ANTES de atualizar subscription
                await createProvisionalUserOnPayment(subscription, expiresAt);

                await storage.updateLowfySubscription(subscription.id, {
                  status: 'active',
                  paymentConfirmedAt: now,
                  expiresAt: expiresAt,
                });

                logger.debug('[Subscription Payment Status] Payment confirmed via Podpay!', { transactionId });
                return res.json({ status: 'active', activationToken: subscription.activationToken });
              }

              // Status Podpay de recusa
              const failedStatuses = ['refunded', 'cancelled', 'canceled', 'refused', 'failed'];
              if (failedStatuses.includes(providerStatus.toLowerCase())) {
                return res.json({ status: 'refused', message: 'Pagamento foi recusado ou cancelado.' });
              }
            }
          }

          // Status pendente
          return res.json({
            status: 'awaiting_payment',
            providerStatus: providerStatus,
          });

        } catch (providerError: any) {
          logger.error('[Subscription Payment Status] Provider error:', providerError.message);
          // Se falhar a consulta ao provedor, retornar status do banco
          return res.json({
            status: subscription.status,
            activationToken: subscription.status === 'active' ? subscription.activationToken : null,
          });
        }
      }

      // Para outros status, retornar do banco
      res.json({
        status: subscription.status,
        activationToken: subscription.status === 'active' ? subscription.activationToken : null,
      });

    } catch (error) {
      console.error('[Subscription Payment Status] Error:', error);
      res.status(500).json({ message: 'Erro ao verificar status do pagamento.' });
    }
  });

  // GET /api/subscriptions/activation/:token - Buscar dados para ativação
  app.get('/api/subscriptions/activation/:token', async (req, res) => {
    try {
      const { token } = req.params;

      logger.debug('[Subscription Activation Data] Fetching data:', { token });

      const subscription = await storage.getLowfySubscriptionByToken(token);
      if (!subscription) {
        return res.status(404).json({ message: 'Token de ativação inválido.' });
      }

      // Verificar se o token expirou (7 dias após criação)
      if (subscription.createdAt) {
        const tokenExpirationDate = new Date(subscription.createdAt);
        tokenExpirationDate.setDate(tokenExpirationDate.getDate() + 7);
        
        if (new Date() > tokenExpirationDate) {
          logger.debug('[Subscription Activation Data] Token expired:', {
            createdAt: subscription.createdAt,
            expirationDate: tokenExpirationDate,
            now: new Date(),
          });
          return res.status(400).json({ 
            message: 'Este link de ativação expirou. O link é válido por 7 dias após a compra. Entre em contato com o suporte para obter um novo link.',
            expired: true
          });
        }
      }

      // Verificar se a assinatura está paga ou é válida para ativação
      if (subscription.status !== 'active' && subscription.status !== 'pending') {
        // Para PIX, verificar se o pagamento foi confirmado
        if (subscription.status === 'awaiting_payment') {
          return res.status(400).json({ 
            message: 'Pagamento ainda não foi confirmado. Por favor, aguarde a confirmação do PIX.',
            status: subscription.status 
          });
        }
        return res.status(400).json({ 
          message: 'Assinatura não está elegível para ativação.',
          status: subscription.status 
        });
      }

      // Verificar se já foi ativada (usuário existe E está completamente ativado, não provisório)
      if (subscription.userId) {
        const linkedUser = await storage.getUser(subscription.userId);
        // Se usuário existe e conta está ativa (não pending_activation) E telefone verificado, já foi ativada
        if (linkedUser && linkedUser.accountStatus === 'active' && linkedUser.phoneVerified) {
          logger.debug('[Subscription Activation Data] Already activated:', {
            userId: subscription.userId,
            accountStatus: linkedUser.accountStatus,
            phoneVerified: linkedUser.phoneVerified,
          });
          return res.status(400).json({ 
            message: 'Esta assinatura já foi ativada. Use seu email e senha para fazer login.',
            alreadyActivated: true
          });
        }
        // Se existe mas está pending_activation, continuar permitindo buscar dados para ativação
        logger.debug('[Subscription Activation Data] Found provisional user, allowing activation:', { 
          userId: subscription.userId, 
          accountStatus: linkedUser?.accountStatus,
          phoneVerified: linkedUser?.phoneVerified,
        });
      }

      // Map plan to display name
      const planNames: Record<string, string> = {
        'mensal': 'Plano Mensal',
        'anual': 'Plano Anual',
      };

      res.json({
        name: subscription.buyerName,
        email: subscription.buyerEmail,
        cpf: subscription.buyerCpf,
        phone: subscription.buyerPhone,
        planName: planNames[subscription.plan || 'mensal'] || 'Plano Mensal',
        planType: subscription.plan || 'mensal',
        amount: subscription.amount,
        paymentMethod: subscription.paymentMethod || 'credit_card',
      });

    } catch (error) {
      console.error('[Subscription Activation Data] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar dados de ativação.' });
    }
  });

  // POST /api/subscriptions/activate - Preparar ativação (apenas envia SMS, não cria usuário)
  app.post('/api/subscriptions/activate', async (req, res) => {
    try {
      const { token, password } = req.body;

      logger.debug('[Subscription Activate] Preparing account activation:', { token });

      if (!token || !password) {
        return res.status(400).json({ message: 'Token e senha são obrigatórios.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
      }

      // Buscar assinatura pelo token
      const subscription = await storage.getLowfySubscriptionByToken(token);
      if (!subscription) {
        return res.status(404).json({ message: 'Token de ativação inválido.' });
      }

      // Verificar se a assinatura está paga
      if (subscription.status !== 'active' && subscription.status !== 'pending') {
        return res.status(400).json({ 
          message: 'Assinatura não está elegível para ativação. Verifique o status do pagamento.',
          status: subscription.status 
        });
      }

      // Verificar se já foi ativada (usuário existe E está com conta ativa, não provisória)
      if (subscription.userId) {
        const linkedUser = await storage.getUser(subscription.userId);
        // Se usuário existe e conta está ativa (não pending_activation), já foi ativada
        if (linkedUser && linkedUser.accountStatus === 'active' && linkedUser.phoneVerified) {
          return res.status(400).json({ message: 'Esta assinatura já foi ativada. Use seu email e senha para fazer login.' });
        }
        // Se existe mas está pending_activation, continuar com a ativação
        logger.debug('[Subscription Activate] Found provisional user, continuing activation:', { 
          userId: subscription.userId, 
          accountStatus: linkedUser?.accountStatus 
        });
      }

      // Verificar se já existe usuário com este email E está completamente ativado
      const existingUser = await storage.getUserByEmail(subscription.buyerEmail);
      if (existingUser && existingUser.phoneVerified && existingUser.accountStatus === 'active') {
        return res.status(400).json({ message: 'Usuário com este email já existe e foi verificado. Faça login.' });
      }

      // Usuário pode estar pending_activation (criado quando pagamento foi confirmado)
      // Vamos continuar o fluxo de SMS

      // CORREÇÃO: Invalidar TODAS verificações pendentes anteriores para o mesmo telefone E subscriptionId
      // Isso garante que apenas o código mais recente seja válido
      await db
        .update(phoneVerifications)
        .set({ status: 'expired' })
        .where(and(
          eq(phoneVerifications.phone, subscription.buyerPhone || ''),
          eq(phoneVerifications.status, 'pending')
        ));

      // Criar registro de verificação telefônica para a ativação
      // SEGURANÇA: Vinculamos o OTP ao subscriptionId para evitar reuso entre assinaturas
      const code = generateOTP();
      const codeHash = await hashPassword(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

      await db.insert(phoneVerifications).values({
        userId: null, // Ainda não temos userId
        subscriptionId: subscription.id, // IMPORTANTE: Vincular ao subscriptionId
        phone: subscription.buyerPhone || '',
        codeHash,
        expiresAt,
        attemptCount: 0,
        status: 'pending',
      });

      logger.debug('[Subscription Activate] Phone verification created for subscription:', { subscriptionId: subscription.id });

      // Send activation SMS if phone exists
      if (subscription.buyerPhone) {
        try {
          const message = `Lowfy - Seu código de verificação é: ${code}\n\nNão compartilhe este código com ninguém.\nVálido por 10 minutos.`;
          await sendSMS(subscription.buyerPhone, message);
          logger.info(`✅ SMS de ativação enviado para ${subscription.buyerPhone}`);
        } catch (smsError) {
          logger.warn(`⚠️ Erro ao enviar SMS de ativação: ${smsError}`);
          return res.status(500).json({ message: 'Erro ao enviar SMS. Tente novamente.' });
        }
      } else {
        return res.status(400).json({ message: 'Telefone não disponível para verificação.' });
      }

      // Retornar dados da assinatura (sem criar usuário ainda)
      res.json({
        success: true,
        subscriptionToken: token,
        user: {
          id: null, // Ainda não criado
          email: subscription.buyerEmail,
          name: subscription.buyerName,
          phone: subscription.buyerPhone,
        },
      });

    } catch (error) {
      console.error('[Subscription Activate] Error:', error);
      res.status(500).json({ message: 'Erro ao preparar ativação.' });
    }
  });

  // POST /api/subscriptions/verify-and-activate - Verifica SMS e ativa conta
  app.post('/api/subscriptions/verify-and-activate', async (req, res) => {
    try {
      const { subscriptionToken, password, code } = req.body;

      if (!subscriptionToken || !password || !code) {
        return res.status(400).json({ message: 'Dados incompletos.' });
      }

      // Buscar assinatura
      const subscription = await storage.getLowfySubscriptionByToken(subscriptionToken);
      if (!subscription) {
        return res.status(404).json({ message: 'Assinatura não encontrada.' });
      }

      // Verificar se já foi ativada (verificar se o usuário existe E está com conta ativa, não provisória)
      if (subscription.userId) {
        const existingUser = await storage.getUser(subscription.userId);
        // Se usuário existe e conta está ativa (não pending_activation), já foi ativada
        if (existingUser && existingUser.accountStatus === 'active' && existingUser.phoneVerified) {
          return res.status(400).json({ message: 'Esta assinatura já foi ativada. Use seu email e senha para fazer login.' });
        }
        // Se existe mas está pending_activation, continuar com a ativação
        logger.debug('[Subscription Verify] Found provisional user, continuing activation:', { 
          userId: subscription.userId, 
          accountStatus: existingUser?.accountStatus 
        });
      }

      // Buscar verificação de telefone mais recente (apenas pendentes, não expiradas E vinculada a esta assinatura)
      // SEGURANÇA: Filtrar por subscriptionId para evitar reuso de códigos entre assinaturas
      const now = new Date();
      const [phoneVerification] = await db
        .select()
        .from(phoneVerifications)
        .where(and(
          eq(phoneVerifications.phone, subscription.buyerPhone || ''),
          eq(phoneVerifications.subscriptionId, subscription.id), // IMPORTANTE: Vincular à assinatura específica
          eq(phoneVerifications.status, 'pending'),
          gte(phoneVerifications.expiresAt, now) // Apenas verificações não expiradas
        ))
        .orderBy(desc(phoneVerifications.expiresAt))
        .limit(1);

      if (!phoneVerification) {
        return res.status(400).json({ 
          message: 'Código de verificação não encontrado ou expirado. Clique em "Ativar" novamente para receber um novo código.' 
        });
      }

      // Verificação extra de expiração (garantir que não passou)
      if (now > phoneVerification.expiresAt) {
        await db
          .update(phoneVerifications)
          .set({ status: 'expired' })
          .where(eq(phoneVerifications.id, phoneVerification.id));
        
        return res.status(400).json({ message: 'Código expirado. Clique em "Ativar" novamente para receber um novo código.' });
      }

      // Verificar tentativas
      if (phoneVerification.attemptCount >= 5) {
        await db
          .update(phoneVerifications)
          .set({ status: 'failed' })
          .where(eq(phoneVerifications.id, phoneVerification.id));
        
        return res.status(429).json({ message: 'Muitas tentativas. Código bloqueado.' });
      }

      // Verificar código
      const isCodeValid = await verifyPassword(code, phoneVerification.codeHash);
      if (!isCodeValid) {
        await db
          .update(phoneVerifications)
          .set({ attemptCount: phoneVerification.attemptCount + 1 })
          .where(eq(phoneVerifications.id, phoneVerification.id));
        
        return res.status(400).json({ message: 'Código inválido.' });
      }

      // Marcar como verificado
      await db
        .update(phoneVerifications)
        .set({ status: 'verified' })
        .where(eq(phoneVerifications.id, phoneVerification.id));

      logger.debug('[Subscription Verify] Phone verified for subscription:', { subscriptionId: subscription.id });

      // AGORA criar o usuário (após verificação bem-sucedida)
      const passwordHash = await hashPassword(password);

      // IMPORTANTE: Checar se email OU CPF já existe (evitar duplicatas)
      let user = await storage.getUserByEmail(subscription.buyerEmail);
      
      if (!user && subscription.buyerCpf) {
        // Se email não existe, checar se CPF já foi usado por outro usuário
        const existingUserWithCpf = await db
          .select()
          .from(users)
          .where(eq(users.cpf, subscription.buyerCpf))
          .limit(1);
        
        if (existingUserWithCpf && existingUserWithCpf.length > 0) {
          user = existingUserWithCpf[0];
          logger.debug('[Subscription Verify] CPF already exists, using existing user:', { userId: user.id });
        }
      }
      
      if (!user) {
        user = await storage.createUser({
          email: subscription.buyerEmail,
          passwordHash,
          name: subscription.buyerName,
          phone: subscription.buyerPhone || undefined,
          cpf: subscription.buyerCpf,
          phoneVerified: true, // Marcado como verificado agora
          accountStatus: 'active',
          subscriptionStatus: 'active',
          // CRITICAL FIX: Use nextPaymentDate from webhook (already correctly calculated in UTC)
          // NOT recalculating here as it uses Date.now() which can be wrong timezone
          subscriptionExpiresAt: subscription.nextPaymentDate || new Date(),
        });

        logger.debug('[Subscription Verify] New user created:', { userId: user.id, expiresAt: subscription.nextPaymentDate });
      } else {
        // Atualizar usuário existente COM NOVAS INFORMAÇÕES REAIS DO CHECKOUT
        await storage.updateUser(user.id, {
          email: subscription.buyerEmail, // ✅ ATUALIZAR EMAIL REAL
          name: subscription.buyerName, // ✅ ATUALIZAR NOME REAL
          phone: subscription.buyerPhone || user.phone, // ✅ ATUALIZAR TELEFONE REAL
          passwordHash, // ✅ ATUALIZAR SENHA NOVA
          phoneVerified: true,
          subscriptionStatus: 'active',
          accountStatus: 'active',
          // CRITICAL FIX: Use nextPaymentDate from webhook (already correctly calculated in UTC)
          subscriptionExpiresAt: subscription.nextPaymentDate || new Date(),
        });
        
        logger.debug('[Subscription Verify] Existing user updated with subscription info:', { 
          userId: user.id, 
          email: subscription.buyerEmail,
          name: subscription.buyerName,
          passwordUpdated: true
        });
      }

      // Atualizar assinatura com userId
      await storage.updateLowfySubscription(subscription.id, {
        userId: user.id,
        status: 'active',
        paidAt: subscription.paidAt || new Date(),
      });

      // CRITICAL FIX: Process referral commission after account activation
      // For PIX subscriptions where userId was null at webhook time, create commission now
      // For subscriptions that already had userId at webhook, commission was already created
      if (subscription.referralCode) {
        try {
          const referralCodeRecord = await storage.getReferralCodeByCode(subscription.referralCode);
          
          if (referralCodeRecord && referralCodeRecord.userId !== user.id) {
            // Check if commission already exists (idempotency)
            const existingCommission = await db
              .select()
              .from(referralCommissions)
              .where(and(
                eq(referralCommissions.subscriptionId, subscription.id),
                eq(referralCommissions.referrerId, referralCodeRecord.userId)
              ))
              .limit(1);
            
            if (!existingCommission || existingCommission.length === 0) {
              // Calculate 50% commission
              const commissionPercentage = 50;
              const commissionAmountCents = Math.floor(subscription.amount * commissionPercentage / 100);
              
              await storage.createReferralCommission({
                referrerId: referralCodeRecord.userId,
                referredUserId: user.id,
                subscriptionId: subscription.id,
                subscriptionAmountCents: subscription.amount,
                commissionPercentage,
                commissionAmountCents,
                status: 'pending',
                type: 'subscription',
                metadata: { 
                  provider: 'podpay',
                  plan: subscription.plan,
                  current_period: 1,
                  source: 'account_activation', // Indicate this was created at activation, not webhook
                },
              });
              
              logger.debug('[Subscription Verify] ✅ Referral commission created at activation:', {
                referrerId: referralCodeRecord.userId,
                referredUserId: user.id,
                commissionAmountCents,
                subscriptionId: subscription.id,
              });

              // Send referral success email to the affiliate/referrer
              setImmediate(async () => {
                try {
                  const [referrer] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, referralCodeRecord.userId))
                    .limit(1);
                  
                  if (referrer) {
                    const referralHtml = generateReferralSuccessEmail(
                      referrer.name,
                      user.name,
                      commissionAmountCents / 100
                    );
                    await sendEmail({
                      to: referrer.email,
                      subject: '🎉 Comissão de Indicação Recebida - Lowfy',
                      html: referralHtml,
                    });
                    logger.debug(`[Subscription Verify] ✅ Referral success email sent to: ${referrer.email}`);
                  }
                } catch (emailError) {
                  logger.error('[Subscription Verify] ❌ Failed to send referral success email:', emailError);
                }
              });
            }
          }
        } catch (refError) {
          logger.error('[Subscription Verify] ❌ Error creating referral commission:', refError);
          // Don't fail the whole activation if commission creation fails
        }
      }

      // Criar sessão
      const sessionToken = crypto.randomUUID();
      const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(sessions).values({
        userId: user.id,
        token: sessionToken,
        expiresAt: sessionExpires,
      });

      res.cookie('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      logger.debug('[Subscription Verify] Account activated successfully:', { 
        userId: user.id,
        subscriptionId: subscription.id
      });

      // Enviar email de confirmação de assinatura/boas-vindas
      try {
        const nextPaymentDate = subscription.plan === 'mensal'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        
        const emailHtml = generateSubscriptionConfirmedEmail(
          user.name,
          user.email,
          (subscription.paymentMethod === 'credit_card' ? 'credit_card' : 'pix') as 'credit_card' | 'pix' | 'boleto',
          (subscription.plan || 'mensal') as 'mensal' | 'anual',
          subscription.amount / 100,
          nextPaymentDate.toISOString(),
          subscription.paidAt || new Date()
        );
        
        await sendEmail({
          to: user.email,
          subject: '🎉 Bem-vindo à Lowfy! Sua assinatura foi confirmada',
          html: emailHtml,
        });
        
        logger.info(`✅ Email de confirmação de assinatura enviado para ${user.email}`);
      } catch (emailError) {
        logger.error(`❌ Erro ao enviar email de confirmação:`, emailError);
        // Não falhar a ativação se o email falhar
      }

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          subscriptionStatus: 'active',
        },
      });

    } catch (error) {
      console.error('[Subscription Verify] Error:', error);
      res.status(500).json({ message: 'Erro ao verificar e ativar conta.' });
    }
  });

  // POST /api/subscriptions/recover - Recuperar conta de usuário que pagou mas não ativou
  // Envia novo email com link de ativação
  app.post('/api/subscriptions/recover', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email é obrigatório.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      logger.debug('[Subscription Recover] Attempting recovery for:', { email: normalizedEmail });

      // Verificar se existe usuário com este email
      const existingUser = await storage.getUserByEmail(normalizedEmail);

      // Caso 1: Usuário existe e está completamente ativado
      if (existingUser && existingUser.accountStatus === 'active' && existingUser.phoneVerified) {
        return res.status(400).json({ 
          message: 'Esta conta já está ativada. Use a página de login ou recuperação de senha.',
          alreadyActive: true
        });
      }

      // Caso 2: Usuário existe mas está pending_activation (pagou mas não ativou)
      if (existingUser && existingUser.accountStatus === 'pending_activation') {
        // Buscar subscription vinculada
        const subscription = await db
          .select()
          .from(lowfySubscriptions)
          .where(eq(lowfySubscriptions.userId, existingUser.id))
          .orderBy(desc(lowfySubscriptions.createdAt))
          .limit(1);

        if (subscription.length > 0 && subscription[0].activationToken) {
          const activationUrl = `${process.env.VITE_BASE_URL || 'https://lowfy.com.br'}/ativar-conta?token=${subscription[0].activationToken}`;

          // Enviar email com link de ativação
          try {
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { text-align: center; padding: 20px 0; }
                  .logo { font-size: 32px; font-weight: bold; color: #29654F; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                  .button { display: inline-block; padding: 15px 30px; background: #29654F; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">Lowfy</div>
                  </div>
                  <div class="content">
                    <h2>Olá, ${existingUser.name}!</h2>
                    <p>Recebemos seu pedido para completar a ativação da sua conta na Lowfy.</p>
                    <p>Seu pagamento já foi confirmado! Agora você só precisa definir sua senha para acessar a plataforma.</p>
                    <p style="text-align: center;">
                      <a href="${activationUrl}" class="button">Ativar Minha Conta</a>
                    </p>
                    <p><strong>Ou copie e cole este link no seu navegador:</strong></p>
                    <p style="background: #eee; padding: 10px; border-radius: 5px; word-break: break-all;">${activationUrl}</p>
                    <p style="color: #666; font-size: 14px;">Este link é válido por 7 dias a partir da data da compra.</p>
                  </div>
                  <div class="footer">
                    <p>Precisa de ajuda? Entre em contato: suporte@lowfy.com.br</p>
                    <p>© ${new Date().getFullYear()} Lowfy. Todos os direitos reservados.</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            await sendEmail({
              to: normalizedEmail,
              subject: '🔐 Complete a ativação da sua conta - Lowfy',
              html: emailHtml,
            });

            logger.info(`[Subscription Recover] ✅ Recovery email sent to pending user: ${normalizedEmail}`);
          } catch (emailError) {
            logger.error('[Subscription Recover] Error sending recovery email:', emailError);
            return res.status(500).json({ message: 'Erro ao enviar email. Tente novamente.' });
          }

          return res.json({ 
            success: true, 
            message: 'Email de recuperação enviado! Verifique sua caixa de entrada.',
            pendingActivation: true
          });
        }
      }

      // Caso 3: Não existe usuário mas pode existir subscription pendente (caso antigo antes do fix)
      const subscriptionByEmail = await db
        .select()
        .from(lowfySubscriptions)
        .where(and(
          eq(lowfySubscriptions.buyerEmail, normalizedEmail),
          eq(lowfySubscriptions.status, 'active'),
          isNull(lowfySubscriptions.userId) // Subscription órfã (sem usuário vinculado)
        ))
        .orderBy(desc(lowfySubscriptions.createdAt))
        .limit(1);

      if (subscriptionByEmail.length > 0) {
        const subscription = subscriptionByEmail[0];
        
        // Criar usuário provisório agora (corrigindo o bug retroativamente)
        const plan = subscription.plan || 'mensal';
        const daysToAdd = plan === 'anual' ? 365 : 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + daysToAdd);

        const tempPasswordHash = await hashPassword(crypto.randomUUID());
        
        const newUser = await storage.createUser({
          name: subscription.buyerName,
          email: normalizedEmail,
          passwordHash: tempPasswordHash,
          phone: subscription.buyerPhone || undefined,
          cpf: subscription.buyerCpf || undefined,
          isAdmin: false,
          accountStatus: 'pending_activation',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          phoneVerified: false,
        });

        // Vincular subscription ao usuário
        await storage.updateLowfySubscription(subscription.id, { userId: newUser.id });

        logger.info('[Subscription Recover] ✅ Created provisional user for orphan subscription:', { 
          userId: newUser.id, 
          email: normalizedEmail,
          subscriptionId: subscription.id 
        });

        // Enviar email
        const activationUrl = `${process.env.VITE_BASE_URL || 'https://lowfy.com.br'}/ativar-conta?token=${subscription.activationToken}`;
        
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 20px 0; }
                .logo { font-size: 32px; font-weight: bold; color: #29654F; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                .button { display: inline-block; padding: 15px 30px; background: #29654F; color: white !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">Lowfy</div>
                </div>
                <div class="content">
                  <h2>Olá, ${subscription.buyerName}!</h2>
                  <p>Encontramos seu pagamento confirmado! Agora você pode ativar sua conta na Lowfy.</p>
                  <p>Clique no botão abaixo para definir sua senha e acessar todos os recursos da plataforma.</p>
                  <p style="text-align: center;">
                    <a href="${activationUrl}" class="button">Ativar Minha Conta</a>
                  </p>
                  <p><strong>Ou copie e cole este link no seu navegador:</strong></p>
                  <p style="background: #eee; padding: 10px; border-radius: 5px; word-break: break-all;">${activationUrl}</p>
                  <p style="color: #666; font-size: 14px;">Este link é válido por 7 dias a partir da data da compra.</p>
                </div>
                <div class="footer">
                  <p>Precisa de ajuda? Entre em contato: suporte@lowfy.com.br</p>
                  <p>© ${new Date().getFullYear()} Lowfy. Todos os direitos reservados.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendEmail({
            to: normalizedEmail,
            subject: '🎉 Seu pagamento foi encontrado! Ative sua conta - Lowfy',
            html: emailHtml,
          });

          logger.info(`[Subscription Recover] ✅ Recovery email sent for orphan subscription: ${normalizedEmail}`);
        } catch (emailError) {
          logger.error('[Subscription Recover] Error sending recovery email:', emailError);
          return res.status(500).json({ message: 'Erro ao enviar email. Tente novamente.' });
        }

        return res.json({ 
          success: true, 
          message: 'Encontramos seu pagamento! Email de ativação enviado.',
          foundPayment: true
        });
      }

      // Caso 4: Não encontrou nada
      return res.status(404).json({ 
        message: 'Não encontramos pagamentos pendentes para este email. Verifique se digitou corretamente ou entre em contato com o suporte.',
        notFound: true
      });

    } catch (error) {
      console.error('[Subscription Recover] Error:', error);
      res.status(500).json({ message: 'Erro ao processar recuperação.' });
    }
  });

  // ==================== ADMIN USER MANAGEMENT ROUTES ====================

  // GET /api/admin/users-management - Lista paginada de usuários com dados de assinatura
  app.get('/api/admin/users-management', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || 'all';
      const offset = (page - 1) * limit;

      logger.debug(`[Admin Users Management] Query params:`, { page, limit, search, status });

      // Build where conditions
      let whereConditions: any[] = [];

      // Search filter (name, email, phone)
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereConditions.push(
          or(
            ilike(users.name, searchTerm),
            ilike(users.email, searchTerm),
            ilike(users.phone, searchTerm)
          )
        );
      }

      // Status filter
      if (status && status !== 'all') {
        whereConditions.push(eq(users.subscriptionStatus, status));
      }

      // Combine conditions
      const whereClause = whereConditions.length > 0 
        ? and(...whereConditions) 
        : undefined;

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause);
      
      const total = countResult?.count || 0;

      // Get users first
      const usersResult = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          cpf: users.cpf,
          createdAt: users.createdAt,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
          accountStatus: users.accountStatus,
          profession: users.profession,
          areaAtuacao: users.areaAtuacao,
          location: users.location,
          bio: users.bio,
          isAdmin: users.isAdmin,
          accessPlan: users.accessPlan,
        })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      // Get latest subscription for each user
      const userIds = usersResult.map(u => u.id);
      
      let subscriptionMap: Map<string, { plan: string | null; amount: number | null; paidAt: Date | null }> = new Map();
      
      if (userIds.length > 0) {
        const subscriptions = await db
          .select({
            userId: lowfySubscriptions.userId,
            plan: lowfySubscriptions.plan,
            amount: lowfySubscriptions.amount,
            paidAt: lowfySubscriptions.paidAt,
            createdAt: lowfySubscriptions.createdAt,
          })
          .from(lowfySubscriptions)
          .where(inArray(lowfySubscriptions.userId, userIds))
          .orderBy(desc(lowfySubscriptions.createdAt));
        
        // Keep only the latest subscription per user
        for (const sub of subscriptions) {
          if (!subscriptionMap.has(sub.userId)) {
            subscriptionMap.set(sub.userId, {
              plan: sub.plan,
              amount: sub.amount,
              paidAt: sub.paidAt,
            });
          }
        }
      }

      // Merge users with subscription data
      const sortedUsers = usersResult.map(user => ({
        ...user,
        latestSubscriptionPlan: subscriptionMap.get(user.id)?.plan || null,
        latestSubscriptionAmount: subscriptionMap.get(user.id)?.amount || null,
        latestSubscriptionPaidAt: subscriptionMap.get(user.id)?.paidAt || null,
      }));

      logger.debug(`[Admin Users Management] Found ${sortedUsers.length} users, total: ${total}`);

      res.json({
        users: sortedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('[Admin Users Management] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar usuários' });
    }
  });

  // POST /api/admin/users/:id/activate-subscription - Ativar/atualizar assinatura manualmente
  app.post('/api/admin/users/:id/activate-subscription', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { expiresAt, plan } = req.body;

      if (!expiresAt) {
        return res.status(400).json({ message: 'expiresAt é obrigatório' });
      }

      const expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({ message: 'expiresAt deve ser uma data válida' });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Update user subscription status
      const [updatedUser] = await db
        .update(users)
        .set({
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expirationDate,
          accountStatus: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      // Check if user has an existing subscription
      const [existingSubscription] = await db
        .select()
        .from(lowfySubscriptions)
        .where(eq(lowfySubscriptions.userId, id))
        .orderBy(desc(lowfySubscriptions.createdAt))
        .limit(1);

      const subscriptionPlan = plan || existingSubscription?.plan || 'mensal';
      const amount = subscriptionPlan === 'anual' ? 49700 : 4970; // in cents

      if (existingSubscription) {
        // Update existing subscription
        await db
          .update(lowfySubscriptions)
          .set({
            status: 'active',
            plan: subscriptionPlan,
            paidAt: new Date(),
            nextPaymentDate: expirationDate,
            updatedAt: new Date(),
          })
          .where(eq(lowfySubscriptions.id, existingSubscription.id));
      } else {
        // Create new subscription record
        await db
          .insert(lowfySubscriptions)
          .values({
            userId: id,
            provider: 'manual',
            plan: subscriptionPlan,
            status: 'active',
            amount: amount,
            paymentMethod: 'manual',
            buyerName: user.name,
            buyerEmail: user.email,
            buyerCpf: user.cpf || '',
            buyerPhone: user.phone,
            paidAt: new Date(),
            nextPaymentDate: expirationDate,
          });
      }

      logger.info(`[Admin] Subscription activated manually for user ${id} by admin ${req.user.id}. Expires: ${expirationDate.toISOString()}`);

      res.json({
        message: 'Assinatura ativada com sucesso',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          subscriptionStatus: updatedUser.subscriptionStatus,
          subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
        },
      });
    } catch (error: any) {
      logger.error('[Admin Activate Subscription] Error:', error);
      res.status(500).json({ message: 'Erro ao ativar assinatura' });
    }
  });

  // GET /api/admin/users/export-csv - Exportar todos usuários em CSV
  app.get('/api/admin/users/export-csv', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      logger.debug('[Admin Export CSV] Starting export...');

      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          cpf: users.cpf,
          createdAt: users.createdAt,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
          accountStatus: users.accountStatus,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      // Generate CSV
      const headers = ['id', 'name', 'email', 'phone', 'cpf', 'createdAt', 'subscriptionStatus', 'subscriptionExpiresAt', 'accountStatus'];
      const csvRows = [headers.join(',')];

      for (const user of allUsers) {
        const row = [
          user.id,
          `"${(user.name || '').replace(/"/g, '""')}"`,
          `"${(user.email || '').replace(/"/g, '""')}"`,
          `"${(user.phone || '').replace(/"/g, '""')}"`,
          `"${(user.cpf || '').replace(/"/g, '""')}"`,
          user.createdAt ? new Date(user.createdAt).toISOString() : '',
          user.subscriptionStatus || '',
          user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toISOString() : '',
          user.accountStatus || '',
        ];
        csvRows.push(row.join(','));
      }

      const csv = '\uFEFF' + csvRows.join('\n');
      const filename = `usuarios-lowfy-${new Date().toISOString().split('T')[0]}.csv`;

      logger.debug(`[Admin Export CSV] Generated CSV with ${allUsers.length} users`);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      logger.error('[Admin Export CSV] Error:', error);
      res.status(500).json({ message: 'Erro ao exportar usuários' });
    }
  });

  // POST /api/admin/users/import-csv - Importar usuários via CSV
  app.post('/api/admin/users/import-csv', authMiddleware, adminMiddleware, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Arquivo CSV é obrigatório' });
      }

      const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {};
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').map((line: string) => line.trim()).filter((line: string) => line);

      if (lines.length < 2) {
        return res.status(400).json({ message: 'CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados' });
      }

      // Parse header
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
      
      // Map columns
      const columnMap: Record<string, number> = {};
      const requiredFields = ['name', 'email'];
      const optionalFields = ['phone', 'cpf', 'subscriptionStatus', 'subscriptionExpiresAt'];
      
      for (const field of [...requiredFields, ...optionalFields]) {
        const mappedField = fieldMapping[field] || field;
        const index = headers.findIndex((h: string) => h.toLowerCase() === mappedField.toLowerCase());
        if (index !== -1) {
          columnMap[field] = index;
        }
      }

      // Check required fields
      for (const field of requiredFields) {
        if (columnMap[field] === undefined) {
          return res.status(400).json({ message: `Campo obrigatório não encontrado: ${field}` });
        }
      }

      const results = { success: 0, errors: [] as Array<{ row: number; error: string }> };

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
          
          const name = values[columnMap.name] || '';
          const email = values[columnMap.email]?.toLowerCase() || '';
          const phone = columnMap.phone !== undefined ? values[columnMap.phone] : undefined;
          const cpf = columnMap.cpf !== undefined ? values[columnMap.cpf]?.replace(/\D/g, '') : undefined;
          const subscriptionStatus = columnMap.subscriptionStatus !== undefined ? values[columnMap.subscriptionStatus] : 'none';
          const subscriptionExpiresAt = columnMap.subscriptionExpiresAt !== undefined 
            ? (values[columnMap.subscriptionExpiresAt] ? new Date(values[columnMap.subscriptionExpiresAt]) : null)
            : null;

          if (!name || !email) {
            results.errors.push({ row: i + 1, error: 'Nome e email são obrigatórios' });
            continue;
          }

          // Check if user exists
          const existingUser = await storage.getUserByEmail(email);

          if (existingUser) {
            // Update existing user
            await db
              .update(users)
              .set({
                name,
                phone: phone || existingUser.phone,
                cpf: cpf || existingUser.cpf,
                subscriptionStatus: subscriptionStatus || existingUser.subscriptionStatus,
                subscriptionExpiresAt: subscriptionExpiresAt || existingUser.subscriptionExpiresAt,
                updatedAt: new Date(),
              })
              .where(eq(users.id, existingUser.id));
          } else {
            // Create new user with random password
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await hashPassword(randomPassword);

            await storage.createUser({
              email,
              name,
              phone: phone ? normalizePhone(phone) : undefined,
              cpf,
              passwordHash,
              accountStatus: 'pending',
            });
          }

          results.success++;
        } catch (rowError: any) {
          results.errors.push({ row: i + 1, error: rowError.message });
        }
      }

      logger.info(`[Admin Import CSV] Import completed: ${results.success} success, ${results.errors.length} errors`);

      res.json({
        message: `Importação concluída: ${results.success} usuários importados`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error: any) {
      logger.error('[Admin Import CSV] Error:', error);
      res.status(500).json({ message: 'Erro ao importar usuários' });
    }
  });

  // GET /api/admin/finance/summary - Métricas financeiras
  app.get('/api/admin/finance/summary', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const startDate = req.query.startDate 
        ? parseDateStringToStartOfDaySaoPaulo(req.query.startDate as string) 
        : new Date(0);
      const endDate = req.query.endDate 
        ? parseDateStringToEndOfDaySaoPaulo(req.query.endDate as string) 
        : endOfDaySaoPaulo(getNowSaoPaulo());

      logger.debug(`[Admin Finance Summary] Date range: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      // Total subscriptions
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            gte(lowfySubscriptions.createdAt, startDate),
            lte(lowfySubscriptions.createdAt, endDate)
          )
        );

      // Active subscriptions
      const [activeResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'active'),
            gte(lowfySubscriptions.createdAt, startDate),
            lte(lowfySubscriptions.createdAt, endDate)
          )
        );

      // New subscriptions (paid in period)
      const [newResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'active'),
            gte(lowfySubscriptions.paidAt, startDate),
            lte(lowfySubscriptions.paidAt, endDate)
          )
        );

      // Canceled subscriptions
      const [canceledResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'canceled'),
            gte(lowfySubscriptions.canceledAt, startDate),
            lte(lowfySubscriptions.canceledAt, endDate)
          )
        );

      // Total revenue
      const [revenueResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'active'),
            gte(lowfySubscriptions.paidAt, startDate),
            lte(lowfySubscriptions.paidAt, endDate)
          )
        );

      res.json({
        totalSubscriptions: totalResult?.count || 0,
        activeSubscriptions: activeResult?.count || 0,
        newSubscriptions: newResult?.count || 0,
        canceledSubscriptions: canceledResult?.count || 0,
        totalRevenue: revenueResult?.total || 0,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('[Admin Finance Summary] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar métricas financeiras' });
    }
  });

  // GET /api/admin/finance/timeseries - Dados para gráficos
  app.get('/api/admin/finance/timeseries', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const startDate = req.query.startDate 
        ? parseDateStringToStartOfDaySaoPaulo(req.query.startDate as string) 
        : startOfDaySaoPaulo(subtractDaysSaoPaulo(getNowSaoPaulo(), 30));
      const endDate = req.query.endDate 
        ? parseDateStringToEndOfDaySaoPaulo(req.query.endDate as string) 
        : endOfDaySaoPaulo(getNowSaoPaulo());
      const groupBy = (req.query.groupBy as string) || 'day';

      logger.debug(`[Admin Finance Timeseries] Date range: ${startDate.toISOString()} - ${endDate.toISOString()}, groupBy: ${groupBy}`);

      // Determine date trunc function based on groupBy
      let dateTrunc: string;
      switch (groupBy) {
        case 'week':
          dateTrunc = 'week';
          break;
        case 'month':
          dateTrunc = 'month';
          break;
        default:
          dateTrunc = 'day';
      }

      // Get new subscriptions by date (using São Paulo timezone for date_trunc)
      const newSubscriptionsData = await db
        .select({
          date: sql<string>`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.paidAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`,
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`COALESCE(SUM(${lowfySubscriptions.amount}), 0)::int`,
        })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'active'),
            gte(lowfySubscriptions.paidAt, startDate),
            lte(lowfySubscriptions.paidAt, endDate)
          )
        )
        .groupBy(sql`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.paidAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`)
        .orderBy(sql`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.paidAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`);

      // Get canceled subscriptions by date (using São Paulo timezone for date_trunc)
      const canceledSubscriptionsData = await db
        .select({
          date: sql<string>`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.canceledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date`,
          count: sql<number>`count(*)::int`,
        })
        .from(lowfySubscriptions)
        .where(
          and(
            eq(lowfySubscriptions.status, 'canceled'),
            gte(lowfySubscriptions.canceledAt, startDate),
            lte(lowfySubscriptions.canceledAt, endDate)
          )
        )
        .groupBy(sql`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.canceledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`)
        .orderBy(sql`date_trunc('${sql.raw(dateTrunc)}', ${lowfySubscriptions.canceledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`);

      // Combine data
      const dateMap = new Map<string, { date: string; newSubscriptions: number; canceledSubscriptions: number; revenue: number }>();

      for (const item of newSubscriptionsData) {
        const dateStr = item.date;
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: dateStr, newSubscriptions: 0, canceledSubscriptions: 0, revenue: 0 });
        }
        const entry = dateMap.get(dateStr)!;
        entry.newSubscriptions = item.count;
        entry.revenue = item.revenue;
      }

      for (const item of canceledSubscriptionsData) {
        const dateStr = item.date;
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { date: dateStr, newSubscriptions: 0, canceledSubscriptions: 0, revenue: 0 });
        }
        const entry = dateMap.get(dateStr)!;
        entry.canceledSubscriptions = item.count;
      }

      // Convert to array and sort by date
      const timeseries = Array.from(dateMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      res.json({
        timeseries,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          groupBy,
        },
      });
    } catch (error: any) {
      logger.error('[Admin Finance Timeseries] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar dados de série temporal' });
    }
  });

  // GET /api/admin/checkouts-abandonados - Lista checkouts abandonados
  app.get('/api/admin/checkouts-abandonados', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;
      const startDate = req.query.startDate 
        ? parseDateStringToStartOfDaySaoPaulo(req.query.startDate as string) 
        : new Date(0);
      const endDate = req.query.endDate 
        ? parseDateStringToEndOfDaySaoPaulo(req.query.endDate as string) 
        : endOfDaySaoPaulo(getNowSaoPaulo());
      const offset = (page - 1) * limit;

      logger.debug(`[Admin Abandoned Checkouts] Query params:`, { page, limit, startDate, endDate });

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lowfySubscriptions)
        .where(
          and(
            or(
              eq(lowfySubscriptions.status, 'awaiting_payment'),
              eq(lowfySubscriptions.status, 'pending')
            ),
            gte(lowfySubscriptions.createdAt, startDate),
            lte(lowfySubscriptions.createdAt, endDate)
          )
        );

      const total = countResult?.count || 0;

      // Get abandoned checkouts
      const abandonedCheckouts = await db
        .select({
          id: lowfySubscriptions.id,
          buyerName: lowfySubscriptions.buyerName,
          buyerEmail: lowfySubscriptions.buyerEmail,
          buyerPhone: lowfySubscriptions.buyerPhone,
          plan: lowfySubscriptions.plan,
          amount: lowfySubscriptions.amount,
          paymentMethod: lowfySubscriptions.paymentMethod,
          status: lowfySubscriptions.status,
          createdAt: lowfySubscriptions.createdAt,
          pixExpiresAt: lowfySubscriptions.pixExpiresAt,
        })
        .from(lowfySubscriptions)
        .where(
          and(
            or(
              eq(lowfySubscriptions.status, 'awaiting_payment'),
              eq(lowfySubscriptions.status, 'pending')
            ),
            gte(lowfySubscriptions.createdAt, startDate),
            lte(lowfySubscriptions.createdAt, endDate)
          )
        )
        .orderBy(desc(lowfySubscriptions.createdAt))
        .limit(limit)
        .offset(offset);

      logger.debug(`[Admin Abandoned Checkouts] Found ${abandonedCheckouts.length} abandoned checkouts, total: ${total}`);

      res.json({
        checkouts: abandonedCheckouts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('[Admin Abandoned Checkouts] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar checkouts abandonados' });
    }
  });

  // ==================== REFERRAL/AFFILIATE ROUTES ====================
  app.use('/api/referrals', referralRoutes);

  // ==================== ADMIN AFFILIATE ROUTES ====================

  // GET /api/admin/affiliates/summary - Métricas gerais de afiliados
  app.get('/api/admin/affiliates/summary', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Build date filters using timezone-aware comparison (Brazil/Sao Paulo timezone)
      // Use AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' for proper conversion
      const dateFilters = [];
      if (startDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') >= ${startDate}`);
      }
      if (endDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') <= ${endDate}`);
      }

      // Exclude cancelled commissions from all calculations
      const validStatusFilter = ne(referralCommissions.status, 'cancelled');

      // Total de comissões pagas (status = 'released' ou 'completed')
      const paidResult = await db
        .select({
          total: sum(referralCommissions.commissionAmountCents)
        })
        .from(referralCommissions)
        .where(and(
          or(eq(referralCommissions.status, 'released'), eq(referralCommissions.status, 'completed')),
          ...(dateFilters.length > 0 ? dateFilters : [])
        ));
      const totalPaidCommissions = Number(paidResult[0]?.total || 0);

      // Total de comissões pendentes (status = 'pending' ou 'active')
      const pendingResult = await db
        .select({
          total: sum(referralCommissions.commissionAmountCents)
        })
        .from(referralCommissions)
        .where(and(
          or(eq(referralCommissions.status, 'pending'), eq(referralCommissions.status, 'active')),
          ...(dateFilters.length > 0 ? dateFilters : [])
        ));
      const totalPendingCommissions = Number(pendingResult[0]?.total || 0);

      // Calculate total revenue and sales for average ticket (exclude cancelled)
      const revenueResult = await db
        .select({
          totalRevenue: sum(referralCommissions.subscriptionAmountCents),
          totalSales: count()
        })
        .from(referralCommissions)
        .where(and(validStatusFilter, ...(dateFilters.length > 0 ? dateFilters : [])));
      const totalRevenue = Number(revenueResult[0]?.totalRevenue || 0);
      const totalSales = Number(revenueResult[0]?.totalSales || 0);
      const averageTicket = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

      // Total de afiliados (com pelo menos 1 comissão realizada no período)
      const affiliatesResult = await db
        .select({
          count: count(sql`DISTINCT ${referralCommissions.referrerId}`)
        })
        .from(referralCommissions)
        .where(and(validStatusFilter, ...(dateFilters.length > 0 ? dateFilters : [])));
      const totalAffiliates = Number(affiliatesResult[0]?.count || 0);

      // Taxa de conversão média (total de conversões / total de cliques)
      // Build date filters for referralCodes table clicks tracking
      const clickDateFilters = [];
      if (startDate) {
        clickDateFilters.push(sql`DATE(${referralCodes.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') >= ${startDate}`);
      }
      if (endDate) {
        clickDateFilters.push(sql`DATE(${referralCodes.updatedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') <= ${endDate}`);
      }

      // If date filters are applied, we need to count conversions from referralCommissions instead
      // since referralCodes doesn't track historical click/conversion data per day
      let totalClicks = 0;
      let totalConversions = 0;
      
      if (dateFilters.length > 0) {
        // When filtering by date, count conversions from the commissions table
        const conversionResult = await db
          .select({
            totalConversions: count()
          })
          .from(referralCommissions)
          .where(and(validStatusFilter, ...dateFilters));
        totalConversions = Number(conversionResult[0]?.totalConversions || 0);
        
        // For clicks in date range, we can't get accurate data since referralCodes doesn't track daily clicks
        // So we set totalClicks to 0 when filtering by date (or could estimate based on conversion rate)
        totalClicks = 0;
      } else {
        // No date filter - use cumulative totals from referralCodes
        const conversionResult = await db
          .select({
            totalClicks: sum(referralCodes.clicks),
            totalConversions: sum(referralCodes.conversions)
          })
          .from(referralCodes);
        totalClicks = Number(conversionResult[0]?.totalClicks || 0);
        totalConversions = Number(conversionResult[0]?.totalConversions || 0);
      }
      
      const averageConversionRate = totalClicks > 0 
        ? ((totalConversions / totalClicks) * 100).toFixed(2)
        : '0.00';

      res.json({
        totalPaid: totalPaidCommissions,
        totalPending: totalPendingCommissions,
        totalAffiliates,
        averageConversionRate,
        totalClicks,
        totalConversions,
        totalRevenue,
        totalSales,
        averageTicket,
      });
    } catch (error: any) {
      logger.error('[Admin Affiliates Summary] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar métricas de afiliados' });
    }
  });

  // GET /api/admin/affiliates/list - Lista paginada de afiliados
  app.get('/api/admin/affiliates/list', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const {
        page = '1',
        limit = '15',
        startDate,
        endDate
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const offset = (pageNum - 1) * limitNum;

      // Build date filters for commissions - use timezone-aware comparison (Brazil/Sao Paulo timezone)
      // Use AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' for proper conversion
      const dateFilters = [];
      if (startDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') >= ${startDate}`);
      }
      if (endDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') <= ${endDate}`);
      }

      // Get all affiliates with their referral codes
      const affiliatesWithCodes = await db
        .select({
          userId: referralCodes.userId,
          code: referralCodes.code,
          clicks: referralCodes.clicks,
          conversions: referralCodes.conversions,
          userName: users.name,
          userEmail: users.email,
          userCreatedAt: users.createdAt,
        })
        .from(referralCodes)
        .innerJoin(users, eq(referralCodes.userId, users.id));

      // Get commission totals for each affiliate (exclude cancelled commissions)
      const validStatusFilter = ne(referralCommissions.status, 'cancelled');
      const commissionQuery = db
        .select({
          referrerId: referralCommissions.referrerId,
          totalSales: count(),
          totalCommission: sql<number>`COALESCE(SUM(${referralCommissions.commissionAmountCents}), 0)`,
          totalRevenue: sql<number>`COALESCE(SUM(${referralCommissions.subscriptionAmountCents}), 0)`,
        })
        .from(referralCommissions)
        .where(and(validStatusFilter, ...(dateFilters.length > 0 ? dateFilters : [])))
        .groupBy(referralCommissions.referrerId);
      
      const commissionTotals = await commissionQuery;
      const commissionMap = new Map(commissionTotals.map(c => [c.referrerId, {
        totalSales: Number(c.totalSales || 0),
        totalCommission: Number(c.totalCommission || 0),
        totalRevenue: Number(c.totalRevenue || 0),
      }]));

      // Get pending commissions (status = 'pending' or 'active') per affiliate
      const pendingCommissionQuery = db
        .select({
          referrerId: referralCommissions.referrerId,
          pendingCommission: sql<number>`COALESCE(SUM(${referralCommissions.commissionAmountCents}), 0)`,
        })
        .from(referralCommissions)
        .where(and(
          or(eq(referralCommissions.status, 'pending'), eq(referralCommissions.status, 'active')),
          ...(dateFilters.length > 0 ? dateFilters : [])
        ))
        .groupBy(referralCommissions.referrerId);
      
      const pendingTotals = await pendingCommissionQuery;
      const pendingMap = new Map(pendingTotals.map(c => [c.referrerId, Number(c.pendingCommission || 0)]));

      // Get paid commissions (status = 'released' or 'completed') per affiliate
      const paidCommissionQuery = db
        .select({
          referrerId: referralCommissions.referrerId,
          paidCommission: sql<number>`COALESCE(SUM(${referralCommissions.commissionAmountCents}), 0)`,
        })
        .from(referralCommissions)
        .where(and(
          or(eq(referralCommissions.status, 'released'), eq(referralCommissions.status, 'completed')),
          ...(dateFilters.length > 0 ? dateFilters : [])
        ))
        .groupBy(referralCommissions.referrerId);
      
      const paidTotals = await paidCommissionQuery;
      const paidMap = new Map(paidTotals.map(c => [c.referrerId, Number(c.paidCommission || 0)]));

      // Get active referrals from wallet
      const wallets = await db
        .select({
          userId: referralWallet.userId,
          activeReferrals: referralWallet.activeReferrals,
        })
        .from(referralWallet);
      const walletMap = new Map(wallets.map(w => [w.userId, w]));

      // Combine data
      const affiliates = affiliatesWithCodes.map(affiliate => {
        const commissionData = commissionMap.get(affiliate.userId);
        const walletData = walletMap.get(affiliate.userId);
        const totalSales = Number(commissionData?.totalSales || 0);
        const totalRevenue = Number(commissionData?.totalRevenue || 0);
        const averageTicket = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
        const pendingCommission = pendingMap.get(affiliate.userId) || 0;
        const paidCommission = paidMap.get(affiliate.userId) || 0;
        
        return {
          id: affiliate.userId,
          name: affiliate.userName,
          email: affiliate.userEmail,
          referralCode: affiliate.code,
          clicks: affiliate.clicks || 0,
          conversions: affiliate.conversions || 0,
          totalSales,
          totalCommission: Number(commissionData?.totalCommission || 0),
          pendingCommission,
          paidCommission,
          totalRevenue,
          averageTicket,
          activeReferrals: walletData?.activeReferrals || 0,
          createdAt: affiliate.userCreatedAt.toISOString(),
        };
      });

      // Sort by totalCommission DESC
      affiliates.sort((a, b) => b.totalCommission - a.totalCommission);

      // Apply pagination
      const total = affiliates.length;
      const paginatedAffiliates = affiliates.slice(offset, offset + limitNum);

      res.json({
        affiliates: paginatedAffiliates,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error: any) {
      logger.error('[Admin Affiliates List] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar lista de afiliados' });
    }
  });

  // GET /api/admin/affiliates/sales - Lista de vendas de afiliados
  app.get('/api/admin/affiliates/sales', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const {
        page = '1',
        limit = '15',
        startDate,
        endDate,
        status
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const offset = (pageNum - 1) * limitNum;

      // Build filters using timezone-aware comparison (Brazil/Sao Paulo timezone)
      // Use AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' for proper conversion
      const filters = [];
      if (startDate) {
        filters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') >= ${startDate}`);
      }
      if (endDate) {
        filters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') <= ${endDate}`);
      }
      if (status) {
        filters.push(eq(referralCommissions.status, status as string));
      }

      // Alias for referrer and buyer users
      const referrerAlias = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .as('referrer');

      const buyerAlias = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .as('buyer');

      // Count total
      const countResult = await db
        .select({ count: count() })
        .from(referralCommissions)
        .where(filters.length > 0 ? and(...filters) : undefined);
      const total = Number(countResult[0]?.count || 0);

      // Get sales with referrer and buyer info
      const sales = await db
        .select({
          id: referralCommissions.id,
          referrerId: referralCommissions.referrerId,
          referredUserId: referralCommissions.referredUserId,
          amount: referralCommissions.subscriptionAmountCents,
          commission: referralCommissions.commissionAmountCents,
          status: referralCommissions.status,
          type: referralCommissions.type,
          createdAt: referralCommissions.createdAt,
        })
        .from(referralCommissions)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(referralCommissions.createdAt))
        .limit(limitNum)
        .offset(offset);

      // Get user info for referrers and buyers
      const userIds = [...new Set([
        ...sales.map(s => s.referrerId),
        ...sales.map(s => s.referredUserId)
      ])];

      const usersData = userIds.length > 0 
        ? await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, userIds))
        : [];
      const usersMap = new Map(usersData.map(u => [u.id, u]));

      // Format response
      const formattedSales = sales.map(sale => {
        const referrer = usersMap.get(sale.referrerId);
        const buyer = usersMap.get(sale.referredUserId);
        return {
          id: sale.id,
          referrerName: referrer?.name || 'N/A',
          referrerEmail: referrer?.email || 'N/A',
          buyerName: buyer?.name || 'N/A',
          buyerEmail: buyer?.email || 'N/A',
          amount: sale.amount,
          commission: sale.commission,
          status: sale.status,
          type: sale.type,
          createdAt: sale.createdAt,
        };
      });

      res.json({
        sales: formattedSales,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      logger.error('[Admin Affiliates Sales] Error:', error);
      res.status(500).json({ message: 'Erro ao buscar vendas de afiliados' });
    }
  });

  // GET /api/admin/affiliates/export-csv - Exportar afiliados em CSV
  app.get('/api/admin/affiliates/export-csv', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      logger.debug('[Admin Affiliates Export CSV] Starting export...');

      // Build date filters for commissions - use timezone-aware comparison (Brazil/Sao Paulo timezone)
      // Use AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' for proper conversion
      const dateFilters = [];
      if (startDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') >= ${startDate}`);
      }
      if (endDate) {
        dateFilters.push(sql`DATE(${referralCommissions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') <= ${endDate}`);
      }

      // Get all affiliates with their referral codes
      const affiliatesWithCodes = await db
        .select({
          userId: referralCodes.userId,
          code: referralCodes.code,
          clicks: referralCodes.clicks,
          conversions: referralCodes.conversions,
          userName: users.name,
          userEmail: users.email,
        })
        .from(referralCodes)
        .innerJoin(users, eq(referralCodes.userId, users.id));

      // Get commission totals for each affiliate
      const commissionTotals = await db
        .select({
          referrerId: referralCommissions.referrerId,
          totalSales: count(),
          totalCommission: sum(referralCommissions.commissionAmountCents),
        })
        .from(referralCommissions)
        .where(dateFilters.length > 0 ? and(...dateFilters) : undefined)
        .groupBy(referralCommissions.referrerId);
      const commissionMap = new Map(commissionTotals.map(c => [c.referrerId, c]));

      // Get active referrals from wallet
      const wallets = await db
        .select({
          userId: referralWallet.userId,
          activeReferrals: referralWallet.activeReferrals,
        })
        .from(referralWallet);
      const walletMap = new Map(wallets.map(w => [w.userId, w]));

      // Combine data
      const affiliates = affiliatesWithCodes.map(affiliate => {
        const commissionData = commissionMap.get(affiliate.userId);
        const walletData = walletMap.get(affiliate.userId);
        return {
          name: affiliate.userName,
          email: affiliate.userEmail,
          code: affiliate.code,
          totalSales: Number(commissionData?.totalSales || 0),
          totalCommission: Number(commissionData?.totalCommission || 0),
          activeReferrals: walletData?.activeReferrals || 0,
          clicks: affiliate.clicks || 0,
          conversions: affiliate.conversions || 0,
        };
      });

      // Sort by totalCommission DESC
      affiliates.sort((a, b) => b.totalCommission - a.totalCommission);

      // Generate CSV
      const headers = ['Nome', 'Email', 'Código', 'Total Vendas', 'Total Comissão', 'Indicados Ativos', 'Cliques', 'Conversões'];
      const csvRows = [headers.join(',')];

      for (const affiliate of affiliates) {
        const row = [
          `"${(affiliate.name || '').replace(/"/g, '""')}"`,
          `"${(affiliate.email || '').replace(/"/g, '""')}"`,
          `"${(affiliate.code || '').replace(/"/g, '""')}"`,
          affiliate.totalSales,
          (affiliate.totalCommission / 100).toFixed(2),
          affiliate.activeReferrals,
          affiliate.clicks,
          affiliate.conversions,
        ];
        csvRows.push(row.join(','));
      }

      const csv = '\uFEFF' + csvRows.join('\n');
      const filename = `afiliados-lowfy-${new Date().toISOString().split('T')[0]}.csv`;

      logger.debug(`[Admin Affiliates Export CSV] Generated CSV with ${affiliates.length} affiliates`);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      logger.error('[Admin Affiliates Export CSV] Error:', error);
      res.status(500).json({ message: 'Erro ao exportar afiliados' });
    }
  });

  // ==================== SUBSCRIPTION REFUND MANAGEMENT (ADMIN) ====================

  app.get('/api/admin/subscription-refunds', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { status, startDate, endDate } = req.query;
      const refundRequests = await storage.listSubscriptionRefundRequests(status as string | undefined);
      
      // Filter by date range if provided
      let filteredRequests = refundRequests;
      if (startDate || endDate) {
        const start = startDate ? parseDateStringToStartOfDaySaoPaulo(startDate as string) : new Date(0);
        const end = endDate ? parseDateStringToEndOfDaySaoPaulo(endDate as string) : new Date();
        
        filteredRequests = refundRequests.filter(r => {
          const createdAt = new Date(r.createdAt);
          return createdAt >= start && createdAt <= end;
        });
      }
      
      res.json(filteredRequests);
    } catch (error: any) {
      logger.error('[Admin Subscription Refunds] Error listing refunds:', error);
      res.status(500).json({ message: 'Erro ao listar solicitações de reembolso' });
    }
  });

  app.get('/api/admin/subscription-refunds/stats', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const allRequests = await storage.listSubscriptionRefundRequests();
      
      const stats = {
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        processing: allRequests.filter(r => r.status === 'processing').length,
        completed: allRequests.filter(r => r.status === 'completed').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length,
        totalAmountPending: allRequests
          .filter(r => r.status === 'pending' || r.status === 'processing')
          .reduce((sum, r) => sum + (r.amountCents || 0), 0),
        totalAmountRefunded: allRequests
          .filter(r => r.status === 'completed')
          .reduce((sum, r) => sum + (r.amountCents || 0), 0),
      };
      
      res.json(stats);
    } catch (error: any) {
      logger.error('[Admin Subscription Refunds] Error getting stats:', error);
      res.status(500).json({ message: 'Erro ao obter estatísticas de reembolso' });
    }
  });

  app.patch('/api/admin/subscription-refunds/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      if (!['pending', 'processing', 'completed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      const refundRequest = await storage.getSubscriptionRefundRequest(id);
      if (!refundRequest) {
        return res.status(404).json({ message: 'Solicitação de reembolso não encontrada' });
      }

      const updateData: any = {
        status,
        adminNotes,
        processedBy: req.user.id,
      };

      if (status === 'completed' || status === 'rejected') {
        updateData.processedAt = new Date();
      }

      const updatedRequest = await storage.updateSubscriptionRefundRequest(id, updateData);

      if (status === 'completed') {
        const subscription = await storage.getLowfySubscriptionById(refundRequest.subscriptionId);
        if (subscription) {
          // Update subscription status to refunded
          await storage.updateLowfySubscription(refundRequest.subscriptionId, {
            status: 'refunded',
          });
          
          // Update user subscription status to refunded
          if (subscription.userId) {
            await db
              .update(users)
              .set({
                subscriptionStatus: 'refunded',
                updatedAt: new Date(),
              })
              .where(eq(users.id, subscription.userId));
          }

          try {
            const { generateRefundCompletedEmail } = await import('./email');
            const emailHtml = generateRefundCompletedEmail(
              subscription.buyerName,
              ((refundRequest.amountCents || 0)) / 100,
              refundRequest.paymentMethod || 'unknown'
            );
            await sendEmail({
              to: subscription.buyerEmail,
              subject: '💸 Reembolso Processado - Lowfy',
              html: emailHtml,
            });
            logger.debug(`[Admin Subscription Refunds] Refund completed email sent to: ${subscription.buyerEmail}`);
          } catch (emailError) {
            logger.error('[Admin Subscription Refunds] Error sending refund completed email:', emailError);
          }
        }
      }

      logger.debug(`[Admin Subscription Refunds] Refund request ${id} updated to status: ${status}`);
      res.json(updatedRequest);
    } catch (error: any) {
      logger.error('[Admin Subscription Refunds] Error updating refund:', error);
      res.status(500).json({ message: 'Erro ao atualizar solicitação de reembolso' });
    }
  });

  // ==================== OPENAI TOKEN USAGE ADMIN ROUTES ====================

  // Helper function to parse date range
  function getDateRangeFromQuery(query: any): { startDate: Date; endDate: Date } {
    const { range, start, end } = query;
    const now = getNowSaoPaulo();

    switch (range) {
      case 'today':
        return {
          startDate: startOfDaySaoPaulo(now),
          endDate: endOfDaySaoPaulo(now),
        };
      case 'yesterday':
        const yesterday = subtractDaysSaoPaulo(now, 1);
        return {
          startDate: startOfDaySaoPaulo(yesterday),
          endDate: endOfDaySaoPaulo(yesterday),
        };
      case 'last7days':
        return {
          startDate: startOfDaySaoPaulo(subtractDaysSaoPaulo(now, 6)),
          endDate: endOfDaySaoPaulo(now),
        };
      case 'last30days':
        return {
          startDate: startOfDaySaoPaulo(subtractDaysSaoPaulo(now, 29)),
          endDate: endOfDaySaoPaulo(now),
        };
      case 'custom':
        if (!start || !end) {
          return {
            startDate: startOfDaySaoPaulo(now),
            endDate: endOfDaySaoPaulo(now),
          };
        }
        return {
          startDate: startOfDaySaoPaulo(new Date(start)),
          endDate: endOfDaySaoPaulo(new Date(end)),
        };
      default:
        return {
          startDate: startOfDaySaoPaulo(now),
          endDate: endOfDaySaoPaulo(now),
        };
    }
  }

  app.get('/api/admin/ai-usage/summary', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = getDateRangeFromQuery(req.query);
      const summary = await storage.getTokenUsageSummary(startDate, endDate);
      
      res.json({
        ...summary,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error: any) {
      logger.error('[Admin AI Usage] Error fetching summary:', error);
      res.status(500).json({ message: 'Erro ao buscar resumo de uso de tokens' });
    }
  });

  app.get('/api/admin/ai-usage/by-user', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = getDateRangeFromQuery(req.query);
      const usageByUser = await storage.getTokenUsageByUser(startDate, endDate);
      
      res.json({
        data: usageByUser,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error: any) {
      logger.error('[Admin AI Usage] Error fetching usage by user:', error);
      res.status(500).json({ message: 'Erro ao buscar uso por usuário' });
    }
  });

  app.get('/api/admin/ai-usage/by-operation', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = getDateRangeFromQuery(req.query);
      const usageByOperation = await storage.getTokenUsageByOperation(startDate, endDate);
      
      res.json({
        data: usageByOperation,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error: any) {
      logger.error('[Admin AI Usage] Error fetching usage by operation:', error);
      res.status(500).json({ message: 'Erro ao buscar uso por operação' });
    }
  });

  app.get('/api/admin/ai-usage/logs', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { startDate, endDate } = getDateRangeFromQuery(req.query);
      const { userId } = req.query;
      
      const logs = await storage.getTokenUsageLogs(startDate, endDate, userId);
      
      res.json({
        data: logs,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error: any) {
      logger.error('[Admin AI Usage] Error fetching logs:', error);
      res.status(500).json({ message: 'Erro ao buscar logs de uso' });
    }
  });

  // ==================== EMAIL TEST ROUTE (DEVELOPMENT ONLY) ====================
  app.post('/api/admin/test-emails', adminMiddleware, async (req, res) => {
    try {
      const adminEmail = 'jl.uli1996@gmail.com';
      const results = [];

      // 1. Email de Boas-Vindas
      try {
        const welcomeHtml = generateWelcomeEmailTemplate(
          'Administrador Teste',
          adminEmail
        );
        await sendEmail({
          to: adminEmail,
          subject: '1️⃣ Teste - Boas-Vindas à Lowfy',
          html: welcomeHtml
        });
        results.push({ template: 'Boas-Vindas', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Boas-Vindas', status: 'error', message: error.message });
      }

      // 2. Email de Redefinição de Senha
      try {
        const resetHtml = generatePasswordResetTemplate('Administrador Teste', 'test-token-123');
        await sendEmail({
          to: adminEmail,
          subject: '2️⃣ Teste - Redefinição de Senha',
          html: resetHtml
        });
        results.push({ template: 'Redefinição de Senha', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Redefinição de Senha', status: 'error', message: error.message });
      }

      // 3. Email de Código 2FA
      try {
        await send2FACode(adminEmail, 'Administrador Teste', '123456');
        results.push({ template: 'Código 2FA', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Código 2FA', status: 'error', message: error.message });
      }

      // 4. Email de Venda Realizada (Vendedor)
      try {
        const saleHtml = generateSaleConfirmedEmail(
          'Vendedor Teste',
          'Comprador Teste',
          'PLR Premium - Marketing Digital',
          149.90,
          'ORD-2023-001234',
          new Date(),
          'pix'
        );
        await sendEmail({
          to: adminEmail,
          subject: '4️⃣ Teste - Venda Realizada (Vendedor)',
          html: saleHtml
        });
        results.push({ template: 'Venda Realizada', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Venda Realizada', status: 'error', message: error.message });
      }

      // 5. Email de Compra Aprovada (Comprador)
      try {
        const purchaseHtml = generatePurchaseConfirmedEmail(
          'Comprador Teste',
          'Template de Site Profissional',
          249.90,
          'ORD-2023-001235',
          getLandingUrl('/downloads/template-123'),
          new Date(),
          'card'
        );
        await sendEmail({
          to: adminEmail,
          subject: '5️⃣ Teste - Compra Aprovada (Comprador)',
          html: purchaseHtml
        });
        results.push({ template: 'Compra Aprovada', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Compra Aprovada', status: 'error', message: error.message });
      }

      // 6. Email de Reembolso (Vendedor)
      try {
        const refundVendorHtml = generateRefundRequestedVendorEmail(
          'Vendedor Teste',
          'Comprador Insatisfeito',
          'Curso de Photoshop',
          'ORD-2023-001236',
          89.90,
          'card'
        );
        await sendEmail({
          to: adminEmail,
          subject: '6️⃣ Teste - Reembolso Solicitado (Vendedor)',
          html: refundVendorHtml
        });
        results.push({ template: 'Reembolso Vendedor', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Reembolso Vendedor', status: 'error', message: error.message });
      }

      // 7. Email de Reembolso (Comprador)
      try {
        const refundBuyerHtml = generateRefundRequestedBuyerEmail(
          'Comprador Teste',
          'Curso de Photoshop',
          'ORD-2023-001236',
          89.90,
          'pix'
        );
        await sendEmail({
          to: adminEmail,
          subject: '7️⃣ Teste - Reembolso Solicitado (Comprador)',
          html: refundBuyerHtml
        });
        results.push({ template: 'Reembolso Comprador', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Reembolso Comprador', status: 'error', message: error.message });
      }

      // 8. Email de Indicação (Alguém assinou pelo link)
      try {
        const referralHtml = generateReferralSuccessEmail(
          'Afiliado Teste',
          'Novo Cliente Indicado',
          25.00
        );
        await sendEmail({
          to: adminEmail,
          subject: '8️⃣ Teste - Indicação Bem-Sucedida',
          html: referralHtml
        });
        results.push({ template: 'Indicação Sucesso', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Indicação Sucesso', status: 'error', message: error.message });
      }

      // 9. Email de Saque Realizado
      try {
        const withdrawalHtml = generateWithdrawalProcessedEmail(
          'Vendedor Teste',
          450.00,
          'PIX - CPF ***123.456-78'
        );
        await sendEmail({
          to: adminEmail,
          subject: '9️⃣ Teste - Saque Processado',
          html: withdrawalHtml
        });
        results.push({ template: 'Saque Processado', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Saque Processado', status: 'error', message: error.message });
      }

      // 10. Email de Indicação Marketplace
      try {
        const marketplaceReferralHtml = generateMarketplaceReferralEmail(
          'Afiliado Marketplace',
          'Template WordPress Premium',
          35.50
        );
        await sendEmail({
          to: adminEmail,
          subject: '🔟 Teste - Comissão Marketplace',
          html: marketplaceReferralHtml
        });
        results.push({ template: 'Indicação Marketplace', status: 'success' });
      } catch (error: any) {
        results.push({ template: 'Indicação Marketplace', status: 'error', message: error.message });
      }

      res.json({
        success: true,
        message: `Emails de teste enviados para ${adminEmail}`,
        results
      });
    } catch (error) {
      console.error('Error sending test emails:', error);
      res.status(500).json({ message: 'Erro ao enviar emails de teste' });
    }
  });

  // ==================== META ADS ANDROMEDA CAMPAIGNS ====================
  
  // Get all campaigns for user
  app.get('/api/meta-ads/campaigns', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const campaigns = await storage.getMetaAdsCampaigns(user.id);
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching meta ads campaigns:', error);
      res.status(500).json({ message: 'Erro ao buscar campanhas' });
    }
  });

  // Get single campaign by ID
  app.get('/api/meta-ads/campaigns/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const campaign = await storage.getMetaAdsCampaignById(req.params.id, user.id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching meta ads campaign:', error);
      res.status(500).json({ message: 'Erro ao buscar campanha' });
    }
  });

  // Create new campaign with AI-generated creatives
  app.post('/api/meta-ads/campaigns', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const data = req.body;

      // Generate AI creatives based on product info (IMPORTANTE: await para função async!)
      const creatives = await generateAICreatives(data);
      
      // Generate strategy notes
      const strategyNotes = generateStrategyNotes(data);

      const campaignData = {
        userId: user.id,
        productName: data.productName,
        productPrice: data.productPrice,
        productDescription: data.productDescription,
        painPoint: data.painPoint,
        objective: data.objective,
        destinationUrl: data.destinationUrl || '',
        hasPixelConfigured: data.hasPixelConfigured || false,
        targetAgeRange: data.targetAgeRange || null,
        targetGender: data.targetGender || null,
        targetLocation: data.targetLocation || null,
        creatives: creatives,
        strategyNotes: strategyNotes,
        status: 'draft'
      };

      const campaign = await storage.createMetaAdsCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      console.error('Error creating meta ads campaign:', error);
      res.status(500).json({ message: 'Erro ao criar campanha' });
    }
  });

  // Update campaign
  app.patch('/api/meta-ads/campaigns/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await storage.updateMetaAdsCampaign(req.params.id, user.id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating meta ads campaign:', error);
      res.status(500).json({ message: 'Erro ao atualizar campanha' });
    }
  });

  // Delete campaign
  app.delete('/api/meta-ads/campaigns/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const deleted = await storage.deleteMetaAdsCampaign(req.params.id, user.id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      res.json({ success: true, message: 'Campanha excluída com sucesso' });
    } catch (error) {
      console.error('Error deleting meta ads campaign:', error);
      res.status(500).json({ message: 'Erro ao excluir campanha' });
    }
  });

  // Token counters for tracking OpenAI usage during creative generation
  let totalRegeneratePromptTokens = 0;
  let totalRegenerateCompletionTokens = 0;

  // Regenerate creatives for a campaign
  app.post('/api/meta-ads/campaigns/:id/regenerate-creatives', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const campaign = await storage.getMetaAdsCampaignById(req.params.id, user.id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      // Reset token counters before generation
      totalRegeneratePromptTokens = 0;
      totalRegenerateCompletionTokens = 0;
      
      // Generate new AI creatives based on existing campaign data
      const newCreatives = await generateAICreatives({
        productName: campaign.productName,
        productDescription: campaign.productDescription,
        painPoint: campaign.painPoint,
        objective: campaign.objective,
        targetAgeRange: campaign.targetAgeRange,
        targetGender: campaign.targetGender,
        targetLocation: campaign.targetLocation
      });
      
      // Update campaign with new creatives
      const updatedCampaign = await storage.updateMetaAdsCampaign(req.params.id, user.id, {
        creatives: newCreatives
      });
      
      // Log token usage for regenerated creatives
      try {
        const { calculateTokenCost, convertUsdToBrl, getDefaultExchangeRate } = await import('./utils/openaiPricing');
        const totalTokens = totalRegeneratePromptTokens + totalRegenerateCompletionTokens;
        const costUsd = calculateTokenCost('gpt-4o-mini', totalRegeneratePromptTokens, totalRegenerateCompletionTokens);
        const exchangeRate = getDefaultExchangeRate();
        const costBrl = convertUsdToBrl(costUsd, exchangeRate);
        
        await storage.logTokenUsage({
          userId: user.id,
          model: 'gpt-4o-mini',
          operation: 'andromeda_campaign',
          promptTokens: totalRegeneratePromptTokens,
          completionTokens: totalRegenerateCompletionTokens,
          totalTokens: totalTokens,
          costUsd: costUsd,
          costBrl: costBrl,
          exchangeRate: exchangeRate
        });
        logger.debug(`[Andromeda Campaign] Tokens registrados: ${totalTokens} (Prompt: ${totalRegeneratePromptTokens}, Completion: ${totalRegenerateCompletionTokens})`);
      } catch (tokenError) {
        logger.error(`[Andromeda Campaign] Erro ao registrar tokens: ${tokenError}`);
      }
      
      res.json(updatedCampaign);
    } catch (error) {
      console.error('Error regenerating creatives:', error);
      res.status(500).json({ message: 'Erro ao regenerar criativos' });
    }
  });

  // ==================== SISTEMA DE GERAÇÃO DE CRIATIVOS DE ALTA CONVERSÃO ====================
  
  // Gerar Headlines com GPT-4o-mini
  async function generateHeadlineWithGPT(productName: string, emotion: string, painPoint: string, variation: number): Promise<string> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Crie um headline IRRESISTÍVEL e ESPECÍFICO para ${productName} que resolve a dor "${painPoint}". Emoção: ${emotion}. Máximo 15 palavras. Copie o tom do melhor marketing em português. Responda APENAS com o headline, sem explicações.`
        }],
        max_tokens: 100,
        temperature: 0.8
      });
      totalRegeneratePromptTokens += response.usage?.prompt_tokens || 0;
      totalRegenerateCompletionTokens += response.usage?.completion_tokens || 0;
      return response.choices[0].message.content?.trim() || generateCompleteHeadline(productName, emotion, painPoint, variation);
    } catch (e) {
      return generateCompleteHeadline(productName, emotion, painPoint, variation);
    }
  }

  // Gerar Primary Text com GPT-4o-mini
  async function generatePrimaryTextWithGPT(productName: string, description: string, painPoint: string, emotion: string, objective: string): Promise<string> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Crie um COPY IRRESISTÍVEL para anúncio de ${productName}.\nDescrição: ${description}\nDor resolvida: ${painPoint}\nEmoção: ${emotion}\nObjetivo: ${objective}\n\nO copy deve:\n1. Ser específico para ${productName} (NÃO genérico)\n2. Resolver a dor "${painPoint}"\n3. Ter 3-5 parágrafos\n4. Incluir call-to-action\n5. Usar tom convincente e brasileiro`
        }],
        max_tokens: 500,
        temperature: 0.8
      });
      totalRegeneratePromptTokens += response.usage?.prompt_tokens || 0;
      totalRegenerateCompletionTokens += response.usage?.completion_tokens || 0;
      return response.choices[0].message.content?.trim() || generateCompletePrimaryText(productName, description, painPoint, emotion, objective);
    } catch (e) {
      return generateCompletePrimaryText(productName, description, painPoint, emotion, objective);
    }
  }

  // Helper function to generate AI creatives - Sistema completo com GPT-4o-mini
  async function generateAICreatives(data: any) {
    const { productName, productDescription, painPoint, objective, targetAgeRange, targetGender, targetLocation } = data;
    
    // Configurações completas sem truncamento
    const fullProductName = productName || 'Produto Digital Premium';
    const fullDescription = productDescription || 'Solução completa para transformar sua vida';
    const fullPainPoint = painPoint || 'desafios do dia a dia';
    
    // Gerar contexto visual base para consistência entre todos os criativos
    const visualContext = generateVisualContext(fullProductName, fullDescription, targetGender, targetAgeRange);
    
    // Emoções e formatos para variações
    const emotions = ['urgency', 'curiosity', 'fear_of_missing_out', 'trust', 'excitement'];
    const formats = ['single_image', 'carousel', 'video_script'];
    
    const creatives = [];
    
    // Gerar 5 variações de criativos de alta qualidade com GPT-4o-mini
    for (let i = 0; i < 5; i++) {
      const emotion = emotions[i % emotions.length];
      const format = formats[i % formats.length];
      const variationNumber = i + 1;
      
      // Gerar headlines e textos com GPT-4o-mini (em paralelo)
      const [headline, primaryText] = await Promise.all([
        generateHeadlineWithGPT(fullProductName, emotion, fullPainPoint, variationNumber),
        generatePrimaryTextWithGPT(fullProductName, fullDescription, fullPainPoint, emotion, objective)
      ]);
      const cta = getCallToActionForObjective(objective);
      
      const creative: any = {
        id: `creative_${variationNumber}`,
        type: format,
        emotion: emotion,
        format: format,
        variationNumber: variationNumber,
        visualStyle: getCompleteVisualStyle(emotion, fullProductName),
        headline: headline,
        primaryText: primaryText,
        description: generateMetaDescription(fullProductName, fullDescription, emotion),
        cta: cta,
        callToAction: cta,
        copy: primaryText,
      };
      
      // Gerar prompt de imagem ultra-detalhado com fallback (sem GPT async aqui)
      creative.aiImagePrompt = generateUltraDetailedImagePromptFallback(
        fullProductName, 
        fullDescription, 
        fullPainPoint, 
        emotion, 
        targetGender, 
        targetAgeRange,
        variationNumber
      );
      creative.aiPrompt = creative.aiImagePrompt;
      creative.prompt = creative.aiImagePrompt;
      
      // Adicionar variações de imagem para testes A/B
      creative.imageVariations = generateImageVariations(
        fullProductName,
        fullDescription,
        fullPainPoint,
        emotion,
        targetGender,
        visualContext,
        variationNumber
      );
      
      // GERAR CAROUSEL E VIDEO EM CADA CRIATIVO
      const carouselData = generateHarmoniousCarouselSlides(
        fullProductName, 
        fullDescription, 
        fullPainPoint, 
        emotion, 
        targetGender,
        visualContext,
        cta
      );
      creative.carouselSlides = carouselData;
      creative.slides = carouselData;
      
      creative.video = generateUnifiedVideoContent(
        fullProductName, 
        fullDescription, 
        fullPainPoint, 
        emotion, 
        targetGender,
        visualContext,
        cta
      );
      
      creatives.push(creative);
    }
    
    return creatives;
  }
  
  // Gerar contexto visual base para manter consistência
  function generateVisualContext(productName: string, description: string, targetGender?: string, targetAge?: string) {
    const genderContext = targetGender === 'male' ? 'masculino brasileiro' : targetGender === 'female' ? 'feminina brasileira' : 'pessoa brasileira';
    const ageContext = targetAge || '25-45 anos';
    
    return {
      protagonist: genderContext,
      ageRange: ageContext,
      productName: productName,
      setting: 'ambiente moderno, clean e acolhedor com iluminação natural suave',
      colorPalette: 'tons quentes e acolhedores com acentos em verde esperança e azul confiança',
      mood: 'otimista, acolhedor e profissional',
      style: 'fotografia comercial premium, estilo lifestyle brasileiro, autêntico e aspiracional',
      lighting: 'iluminação natural suave com golden hour feel, shadows suaves',
      camera: 'câmera profissional DSLR, lente 85mm f/1.4, profundidade de campo suave',
      resolution: '8K ultra-realista, texturas detalhadas, cores vibrantes mas naturais'
    };
  }
  
  // Estilo visual completo por emoção
  function getCompleteVisualStyle(emotion: string, productName: string): string {
    const styles: Record<string, string> = {
      'urgency': `ESTILO URGÊNCIA: Cores vibrantes com predominância de vermelho coral (#FF6B6B) e laranja energético (#FF9F43). Elementos de countdown visual, relógios estilizados, calendários marcados. Tipografia bold e impactante. Setas direcionais, linhas de movimento. Fundo com gradiente dinâmico. Bordas com glow sutil. Expressão facial determinada e focada. Pose de ação, movimento para frente. Iluminação dramática com contraste alto. Elementos de "limited time" e "últimas unidades". Badge de oferta especial no canto. Composição assimétrica criando tensão visual.`,
      
      'curiosity': `ESTILO CURIOSIDADE: Cores misteriosas com roxo profundo (#8B5CF6) e azul índigo (#6366F1). Elementos parcialmente revelados, silhuetas, sombras intrigantes. Pontos de interrogação estilizados e elegantes. Olhar direcionado para fora do frame. Expressão de descoberta e interesse. Iluminação tipo Rembrandt com shadows misteriosos. Elementos de "segredo revelado" e "descubra". Composição com espaço negativo intencional. Blur seletivo criando foco. Partículas de luz floating. Porta entreaberta ou cortina semi-aberta como metáfora.`,
      
      'fear_of_missing_out': `ESTILO FOMO: Cores sociais vibrantes com verde sucesso (#10B981) e dourado conquista (#F59E0B). Grupo diverso de pessoas felizes celebrando juntas. Elementos de comunidade e pertencimento. Expressões de alegria genuína e conexão. Badges de "milhares já garantiram" e contadores. Depoimentos visuais com fotos de clientes satisfeitos. Composição com várias pessoas, foco no protagonista. Iluminação festiva e acolhedora. Elementos de exclusividade e clube VIP. Confetes sutis e celebração. Smartphones mostrando notificações de compra.`,
      
      'trust': `ESTILO CONFIANÇA: Cores corporativas com azul safira (#3B82F6) e verde esmeralda (#059669). Selos de garantia, certificados, escudos de proteção. Expressão serena, confiante e profissional. Ambiente clean, organizado, premium. Ícones de segurança, cadeados, checkmarks. Depoimentos com fotos reais e nomes. Números e estatísticas de sucesso. Composição simétrica transmitindo estabilidade. Iluminação suave e profissional tipo estúdio. Elementos de "garantia de satisfação" e "aprovado". Fundo neutro destacando o protagonista. Pose confiante com braços abertos ou cruzados.`,
      
      'excitement': `ESTILO EMPOLGAÇÃO: Cores vibrantes com rosa pink (#EC4899) e amarelo solar (#FBBF24). Explosão de cores e energia. Elementos de celebração: confetes, estrelas, fogos. Expressão de alegria radiante e entusiasmo. Pose dinâmica com movimento e energia. Iluminação brilhante e festiva. Gradientes coloridos e overlays vibrantes. Emojis estilizados e elementos pop. Tipografia divertida e energética. Composição diagonal criando dinamismo. Elementos de "novo", "lançamento", "chegou". Sparkles e brilhos. Background com pattern geométrico colorido.`
    };
    
    return styles[emotion] || styles['trust'];
  }
  
  // Headline completo sem truncamento
  function generateCompleteHeadline(productName: string, emotion: string, painPoint: string, variation: number): string {
    const painKeyword = extractKeyPain(painPoint);
    
    const templates: Record<string, string[]> = {
      'urgency': [
        `🔥 ÚLTIMAS ${Math.floor(Math.random() * 12) + 3} HORAS: ${productName} com 70% OFF - Oferta Irresistível Acaba Hoje!`,
        `⚡ ALERTA: ${productName} - Condição Especial Para os Primeiros 100 Compradores de Hoje!`,
        `🚨 ATENÇÃO: Restam Apenas ${Math.floor(Math.random() * 20) + 5} Vagas Para ${productName} - Garanta Agora!`,
        `⏰ CONTAGEM REGRESSIVA: ${productName} - Preço de Lançamento Por Apenas Mais ${Math.floor(Math.random() * 6) + 2} Horas!`,
        `💥 OPORTUNIDADE ÚNICA: ${productName} Nunca Mais Por Este Preço - Última Chance!`
      ],
      'curiosity': [
        `🤔 O Segredo Que Ninguém Te Contou Sobre ${painKeyword} - Até Agora...`,
        `🔍 Descubra Como ${productName} Está Revolucionando a Vida de Milhares de Brasileiros`,
        `❓ Você Comete Estes 5 Erros Comuns Com ${painKeyword}? A Resposta Vai Te Surpreender!`,
        `🧠 A Ciência Por Trás de ${productName}: O Que Especialistas Não Querem Que Você Saiba`,
        `💡 Por Que 97% Das Pessoas Falham Com ${painKeyword} - E Como Você Pode Ser Diferente`
      ],
      'fear_of_missing_out': [
        `🚀 +${Math.floor(Math.random() * 5000) + 10000} Pessoas Já Transformaram Suas Vidas Com ${productName} - E Você?`,
        `📈 Enquanto Você Lê Isso, Mais ${Math.floor(Math.random() * 50) + 20} Pessoas Estão Garantindo ${productName}`,
        `⭐ Junte-se aos Milhares Que Já Disseram "SIM" Para ${productName} - Não Fique de Fora!`,
        `🏆 A Comunidade Exclusiva de ${productName} Está Crescendo - Sua Vaga Está Esperando!`,
        `💪 Todo Mundo Está Falando de ${productName} - Descubra o Motivo do Sucesso!`
      ],
      'trust': [
        `✅ ${productName}: +${Math.floor(Math.random() * 5000) + 15000} Clientes Satisfeitos e Garantia de 7 Dias`,
        `🛡️ Resultado Garantido: ${productName} Aprovado Por Especialistas e Milhares de Brasileiros`,
        `🏅 ${productName} - O Método Mais Completo e Seguro Para Resolver ${painKeyword}`,
        `💯 Confiança Total: ${productName} Com Selo de Qualidade e Satisfação Garantida`,
        `🎯 ${productName}: Metodologia Comprovada Por ${Math.floor(Math.random() * 8) + 5} Anos de Sucesso`
      ],
      'excitement': [
        `🎉 FINALMENTE! ${productName} Chegou Para Revolucionar Sua Vida - Prepare-se!`,
        `🌟 NOVIDADE INCRÍVEL: Conheça ${productName} - A Solução Que Você Sempre Sonhou!`,
        `🎊 É OFICIAL: ${productName} Está Disponível - Sua Transformação Começa Agora!`,
        `✨ LANÇAMENTO: ${productName} - A Revolução Que Vai Mudar Tudo Para Você!`,
        `🎁 SURPRESA: ${productName} Com Bônus Exclusivos Só Para Quem Agir Agora!`
      ]
    };
    
    const options = templates[emotion] || templates['trust'];
    return options[(variation - 1) % options.length];
  }
  
  // Extrair palavra-chave da dor
  function extractKeyPain(painPoint: string): string {
    if (!painPoint || painPoint.length < 3) return 'seus desafios';
    const words = painPoint.split(' ');
    if (words.length <= 3) return painPoint;
    return words.slice(0, 4).join(' ');
  }
  
  // Texto principal completo e rico
  function generateCompletePrimaryText(productName: string, description: string, painPoint: string, emotion: string, objective: string): string {
    const ctaText = objective === 'sales' ? 'GARANTIR MINHA VAGA' : objective === 'leads' ? 'QUERO SABER MAIS' : 'VER DETALHES';
    
    const templates: Record<string, string> = {
      'urgency': `⏰ OFERTA POR TEMPO LIMITADO - NÃO PERCA!

Você sabe qual é o maior erro de quem sofre com ${painPoint}?

É esperar o "momento certo" que nunca chega...

Enquanto você lê isso, centenas de pessoas estão transformando suas vidas com ${productName}.

📌 O QUE VOCÊ VAI DESCOBRIR:
${description}

✅ Método passo a passo simples e direto
✅ Resultados visíveis desde a primeira aplicação
✅ Suporte completo da nossa equipe
✅ Garantia incondicional de 7 dias

🔥 MAS ATENÇÃO: Esta condição especial está disponível apenas por tempo limitado!

👆 Clique no botão "${ctaText}" agora mesmo e comece sua transformação hoje!

⚡ Não deixe para depois o que pode mudar sua vida agora.`,

      'curiosity': `🤔 Você já se perguntou por que algumas pessoas conseguem superar ${painPoint} tão facilmente...

...enquanto outras lutam por anos sem resultados?

A resposta pode te surpreender.

Depois de anos de pesquisa e milhares de casos de sucesso, descobrimos um padrão que muda tudo.

📚 APRESENTAMOS ${productName}:
${description}

💡 O QUE TORNA ISSO DIFERENTE:
• Abordagem única baseada em ciência e prática real
• Sem teoria complicada - apenas o que funciona
• Aplicação imediata no seu dia a dia
• Resultados que você pode medir e sentir

🔍 Milhares de pessoas já descobriram este segredo.

A pergunta é: você vai continuar do lado de fora ou vai descobrir por si mesmo?

👉 Clique e descubra o que está transformando milhares de vidas!`,

      'fear_of_missing_out': `🚀 ENQUANTO VOCÊ LÊ ISSO...

...mais pessoas estão garantindo acesso a ${productName} e transformando suas vidas.

Sabe aquela sensação de chegar tarde demais? De ver todo mundo evoluindo menos você?

Não precisa ser assim.

📈 VEJA O QUE ESTÁ ACONTECENDO:
• +15.000 pessoas já transformaram suas vidas
• 97% de satisfação comprovada
• Comunidade ativa e engajada
• Resultados reais compartilhados diariamente

💬 "${productName} mudou minha perspectiva completamente. Queria ter descoberto antes!" - Cliente verificado

🎯 O QUE VOCÊ RECEBE:
${description}

✅ Acesso imediato ao conteúdo completo
✅ Comunidade exclusiva de membros
✅ Suporte prioritário da equipe
✅ Atualizações gratuitas para sempre

❌ Não fique de fora desta transformação.

👆 Junte-se a milhares de pessoas e comece agora!`,

      'trust': `✅ RESULTADO COMPROVADO POR MILHARES DE BRASILEIROS

Se você está cansado de ${painPoint}, você não está sozinho.

E mais importante: existe uma solução real, testada e aprovada.

🛡️ APRESENTAMOS ${productName}:
${description}

📊 NOSSOS NÚMEROS FALAM POR SI:
• +15.000 clientes satisfeitos
• 97% de taxa de satisfação
• 4.9 estrelas de avaliação média
• 7 anos de mercado e experiência

💯 GARANTIA TOTAL DE SATISFAÇÃO:
Se em 7 dias você não estiver 100% satisfeito, devolvemos cada centavo. Sem perguntas, sem burocracia.

✅ Método aprovado por especialistas
✅ Suporte humanizado e dedicado
✅ Comunidade com milhares de membros
✅ Atualizações constantes inclusas

🏅 Sua confiança é nossa prioridade.

👆 Clique agora e faça parte desta transformação com total segurança!`,

      'excitement': `🎉 FINALMENTE CHEGOU O QUE VOCÊ ESTAVA ESPERANDO!

Prepare-se para conhecer ${productName} - a solução que vai revolucionar sua forma de lidar com ${painPoint}!

✨ ISSO É DIFERENTE DE TUDO QUE VOCÊ JÁ VIU:
${description}

🎁 BÔNUS EXCLUSIVOS PARA VOCÊ:
• Acesso vitalício ao conteúdo completo
• Comunidade VIP com suporte prioritário
• Atualizações gratuitas por tempo ilimitado
• Material extra exclusivo para quem agir agora

🌟 O QUE NOSSOS CLIENTES DIZEM:
"Incrível! Nunca imaginei que seria tão transformador!" ⭐⭐⭐⭐⭐
"Melhor investimento que já fiz em mim!" ⭐⭐⭐⭐⭐
"Simples, direto e funciona de verdade!" ⭐⭐⭐⭐⭐

🚀 Sua jornada de transformação começa com um clique!

👆 Não espere mais - sua nova vida está a um passo de distância!

🎊 Vamos juntos nessa?`
    };
    
    return templates[emotion] || templates['trust'];
  }
  
  // Meta description para anúncios
  function generateMetaDescription(productName: string, description: string, emotion: string): string {
    const descriptions: Record<string, string> = {
      'urgency': `⏰ Últimas horas! ${productName} com condição especial. ${description} Garanta agora antes que acabe!`,
      'curiosity': `🔍 Descubra o segredo por trás de ${productName}. ${description} Clique e surpreenda-se!`,
      'fear_of_missing_out': `🚀 +15.000 pessoas já transformaram suas vidas. ${productName}: ${description} Não fique de fora!`,
      'trust': `✅ ${productName} - Aprovado por milhares. ${description} Garantia de 7 dias. Confie em quem entende!`,
      'excitement': `🎉 Novidade! ${productName} chegou! ${description} Bônus exclusivos para quem agir agora!`
    };
    
    return descriptions[emotion] || descriptions['trust'];
  }
  
  function getCallToActionForObjective(objective: string): string {
    const ctas: Record<string, string> = {
      'sales': 'GARANTIR MINHA VAGA AGORA',
      'leads': 'QUERO SABER MAIS',
      'traffic': 'VER DETALHES COMPLETOS',
      'engagement': 'CURTIR E SEGUIR',
      'awareness': 'CONHECER AGORA',
      'messages': 'FALAR COM ESPECIALISTA',
      'app_promotion': 'BAIXAR GRÁTIS'
    };
    return ctas[objective] || 'SAIBA MAIS';
  }
  
  // ==================== GERAÇÃO COM GPT-4o-MINI ====================
  
  async function generatePromptUsingGPT4oMini(
    productName: string,
    description: string,
    painPoint: string,
    emotion: string,
    targetGender?: string,
    targetAge?: string,
    variation?: number
  ): Promise<string> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const emotionDescriptions: Record<string, string> = {
        'urgency': 'urgência - criando senso de escassez e necessidade de ação imediata',
        'curiosity': 'curiosidade - despertando interesse e provocando desejo de descobrir',
        'fear_of_missing_out': 'FOMO - mostrando comunidade e exclusividade',
        'trust': 'confiança - transmitindo profissionalismo e segurança',
        'excitement': 'empolgação - explosão de energia e celebração'
      };

      const prompt = `Você é um especialista em marketing digital e geração de prompts para IA de imagens.

PRODUTO: ${productName}
DESCRIÇÃO: ${description}
DOR RESOLVIDA: ${painPoint}
EMOÇÃO: ${emotionDescriptions[emotion] || 'conversão'}
PÚBLICO: ${targetGender ? `${targetGender === 'male' ? 'Masculino' : 'Feminino'} brasileiro` : 'Persona brasileira'}
IDADE: ${targetAge || '25-45 anos'}
VARIAÇÃO: ${variation || 1}/5

Crie um prompt ULTRA-COMPLETO e PROFISSIONAL para geração de imagem que:
1. Seja específico para "${productName}" (NÃO genérico)
2. Resolva a dor "${painPoint}"
3. Evoque a emoção de ${emotionDescriptions[emotion]}
4. Seja pronto para copiar/colar no ChatGPT, Midjourney, DALL-E ou Nano Banana
5. Inclua detalhes técnicos: resolução, estilo, iluminação, composição, cores
6. Seja longo e completo (mínimo 500 caracteres)

Formato de resposta EXATO:
PROMPT PARA ${emotion.toUpperCase()}:
[seu prompt ultra-detalhado aqui]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você gera prompts profissionais e ultra-completos para IA de imagens. Sempre inclui todos os detalhes técnicos necessários."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.7
      });

      // Registrar uso de tokens para esta operação
      totalRegeneratePromptTokens += response.usage?.prompt_tokens || 0;
      totalRegenerateCompletionTokens += response.usage?.completion_tokens || 0;

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error('Erro ao gerar prompt com GPT-4o-mini:', error);
      return generateUltraDetailedImagePromptFallback(productName, description, painPoint, emotion, targetGender, targetAge, variation);
    }
  }

  function generateUltraDetailedImagePromptFallback(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string, 
    targetGender?: string, 
    targetAge?: string,
    variation?: number
  ): string {
    const context = generateVisualContext(productName, description, targetGender, targetAge);
    const varNum = variation || 1;
    
    // Paletas de cores profissionais por emoção (estilo Canva Pro)
    const emotionStyles: Record<string, { gradient: string, accent: string, overlay: string, icons: string[], shapes: string }> = {
      'urgency': {
        gradient: 'gradiente diagonal de vermelho coral (#FF6B6B) para laranja vibrante (#FF9F43) com overlay de amarelo dourado (#FBBF24)',
        accent: 'amarelo neon, branco puro',
        overlay: 'textura de raios de luz, partículas de fogo',
        icons: ['relógio digital estilizado', 'seta countdown', 'badge "ÚLTIMAS HORAS"', 'timer circular', 'foguete acelerando'],
        shapes: 'formas geométricas angulares, linhas de velocidade, zigzags dinâmicos'
      },
      'curiosity': {
        gradient: 'gradiente de roxo profundo (#8B5CF6) para azul meia-noite (#4338CA) com toques de dourado místico (#D4AF37)',
        accent: 'prata brilhante, luz de néon roxa',
        overlay: 'nebulosa sutil, partículas flutuantes luminosas',
        icons: ['lupa estilizada com brilho', 'olho com reflexo de luz', 'porta entreaberta com luz', 'ponto de interrogação 3D', 'chave ornamentada'],
        shapes: 'círculos concêntricos, ondas suaves, espirais elegantes'
      },
      'fear_of_missing_out': {
        gradient: 'gradiente festivo de verde esmeralda (#10B981) para dourado champagne (#F59E0B) com overlay de rosa pink (#EC4899)',
        accent: 'branco brilhante, confetes coloridos',
        overlay: 'confetes caindo, balões estilizados, luzes de festa',
        icons: ['grupo de pessoas celebrando', 'medalha de ouro', 'troféu estilizado', 'estrelas 5 pontas', 'badge VIP exclusivo'],
        shapes: 'círculos sobrepostos, ondas de energia, explosão de partículas'
      },
      'trust': {
        gradient: 'gradiente corporativo de azul safira (#3B82F6) para verde confiança (#059669) com toques de prata (#94A3B8)',
        accent: 'branco puro, dourado sutil',
        overlay: 'textura de vidro fosco, linhas de credibilidade',
        icons: ['escudo com checkmark', 'selo de garantia 3D', 'certificado com fita', 'cadeado dourado', 'estrelas de avaliação 5/5'],
        shapes: 'retângulos arredondados, linhas retas elegantes, hexágonos'
      },
      'excitement': {
        gradient: 'gradiente explosivo de rosa pink (#EC4899) para amarelo solar (#FBBF24) com toques de laranja vibrante (#F97316)',
        accent: 'branco radiante, destaques ciano',
        overlay: 'explosão de cores, sparkles brilhantes, fogos de artifício',
        icons: ['estrela com explosão', 'presente com laço', 'foguete colorido', 'megafone festivo', 'emoji de festa 3D'],
        shapes: 'starburst, explosões, ondas de energia, formas orgânicas dinâmicas'
      }
    };
    
    const style = emotionStyles[emotion] || emotionStyles['trust'];
    
    // Layouts diferentes para cada variação
    const layouts = [
      'pessoa à esquerda (40%), elementos gráficos e texto à direita (60%)',
      'pessoa centralizada com elementos flutuando ao redor em círculo',
      'split diagonal: pessoa no canto inferior, texto e gráficos no topo',
      'pessoa à direita (35%), grande headline e elementos à esquerda (65%)',
      'composição em Z: headline topo, pessoa centro, CTA e badges embaixo'
    ];
    
    return `═══════════════════════════════════════════════════════════════
🎨 PROMPT PROFISSIONAL PARA GERAÇÃO DE IMAGEM - ESTILO CANVA PRO
═══════════════════════════════════════════════════════════════

📋 DADOS DO PRODUTO:
• Nome: ${productName}
• Descrição: ${description}
• Dor resolvida: ${painPoint}
• Emoção: ${emotion.toUpperCase()}
• Variação: ${varNum}/5

═══════════════════════════════════════════════════════════════
📐 ESPECIFICAÇÕES TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════

FORMATO: 1080 x 1080 pixels (quadrado para feed Instagram/Facebook)
TIPO: Design gráfico profissional de alta conversão (NÃO fotografia pura)
ESTILO: Arte composta estilo Canva Pro / Adobe Express / Photoshop

═══════════════════════════════════════════════════════════════
🖼️ LAYOUT E COMPOSIÇÃO (Variação ${varNum})
═══════════════════════════════════════════════════════════════

COMPOSIÇÃO: ${layouts[(varNum - 1) % layouts.length]}

GRID: 
- Respeitar regra dos terços
- Margem segura de 50px em todas as bordas
- Hierarquia visual clara: Headline > Produto > Pessoa > CTA

═══════════════════════════════════════════════════════════════
🎨 PALETA DE CORES E FUNDO
═══════════════════════════════════════════════════════════════

FUNDO PRINCIPAL:
${style.gradient}

CORES DE DESTAQUE:
${style.accent}

OVERLAY/TEXTURA:
${style.overlay}

TRATAMENTO:
- Gradiente suave e profissional (não chapado)
- Profundidade com sombras suaves
- Brilho sutil nos cantos para foco central

═══════════════════════════════════════════════════════════════
👤 ELEMENTO HUMANO (PROTAGONISTA)
═══════════════════════════════════════════════════════════════

PESSOA: ${context.protagonist}
IDADE APARENTE: ${targetAge || '25-45 anos'}
EXPRESSÃO: Autêntica, relacionada à emoção "${emotion}" - ${
      emotion === 'urgency' ? 'determinação e foco, olhar decidido' :
      emotion === 'curiosity' ? 'interesse genuíno, sobrancelhas levantadas' :
      emotion === 'fear_of_missing_out' ? 'alegria contagiante, sorriso radiante' :
      emotion === 'trust' ? 'confiança serena, expressão profissional' :
      'empolgação genuína, energia positiva'
    }

TRATAMENTO DA FOTO:
- Recorte profissional (cutout) com borda suave
- Sombra drop-shadow realista
- Pode ter moldura decorativa ou frame estilizado
- Integrada harmoniosamente com elementos gráficos

═══════════════════════════════════════════════════════════════
📝 TIPOGRAFIA E TEXTOS NA ARTE
═══════════════════════════════════════════════════════════════

HEADLINE PRINCIPAL (destaque máximo):
"${painPoint.toUpperCase()}"
- Fonte: Extra Bold, sans-serif moderna (estilo Montserrat, Poppins)
- Tamanho: Grande, impactante (ocupa pelo menos 25% da largura)
- Cor: Contrastante com o fundo
- Efeitos: Sombra profunda ou glow para destaque

NOME DO PRODUTO (segundo nível):
"${productName}"
- Fonte: Bold, elegante
- Pode estar em badge/selo decorativo
- Cor de destaque que contraste

CALL-TO-ACTION (botão visual):
"SAIBA MAIS" ou "GARANTA AGORA"
- Formato: Botão retangular arredondado
- Cor: Contrastante e vibrante
- Efeito: Sombra e leve brilho/glow
- Posição: Parte inferior, centralizado ou à direita

ELEMENTOS DE TEXTO SECUNDÁRIO:
- Checkmarks (✓) com benefícios curtos
- Números de impacto ("+15.000 pessoas")
- Emojis estilizados se apropriado

═══════════════════════════════════════════════════════════════
✨ ELEMENTOS GRÁFICOS E DECORATIVOS (ESTILO CANVA)
═══════════════════════════════════════════════════════════════

ÍCONES TEMÁTICOS (escolher 2-3):
${style.icons.map(icon => `• ${icon}`).join('\n')}

SHAPES E FORMAS:
${style.shapes}

ELEMENTOS DECORATIVOS:
• Linhas decorativas (retas, onduladas, pontilhadas)
• Círculos e bolhas com gradiente
• Setas direcionais apontando para CTA
• Molduras ou frames parciais
• Fitas e banners estilizados
• Sparkles e brilhos (2-4 por arte)
• Partículas flutuantes sutis

BADGES E SELOS:
• Badge de oferta ou desconto (se urgency)
• Selo de garantia (se trust)
• Contador de pessoas (se FOMO)
• Etiqueta "NOVO" ou "EXCLUSIVO"

═══════════════════════════════════════════════════════════════
🔧 EFEITOS VISUAIS PROFISSIONAIS
═══════════════════════════════════════════════════════════════

EFEITOS OBRIGATÓRIOS:
• Drop-shadow em textos principais (suave, profissional)
• Glow sutil em elementos de destaque
• Gradiente overlay para profundidade
• Desfoque gaussiano leve no fundo (se necessário)

EFEITOS ADICIONAIS:
• Glass morphism em cards ou badges
• Neon glow em contornos (se excitement/urgency)
• Reflexos sutis em elementos 3D
• Vinheta sutil nos cantos

═══════════════════════════════════════════════════════════════
❌ O QUE EVITAR
═══════════════════════════════════════════════════════════════

• Design flat demais sem profundidade
• Cores muito saturadas ou neon excessivo
• Textos pequenos ou ilegíveis
• Muitos elementos competindo por atenção
• Fotos sem tratamento (cruas)
• Fundo branco ou sem interesse visual
• Tipografia genérica ou básica

═══════════════════════════════════════════════════════════════
✅ RESULTADO FINAL ESPERADO
═══════════════════════════════════════════════════════════════

Arte profissional de alta conversão para Meta Ads, com aparência de 
design premium do Canva Pro ou Adobe Express. Deve parecer que foi 
feita por um designer profissional, com:
- Harmonia visual perfeita
- Hierarquia clara de informações
- Alto impacto visual que para o scroll
- Textos legíveis e impactantes
- Elementos gráficos que complementam sem competir
- Pronta para publicação, sem necessidade de edição

IDEAL PARA: Feed Instagram, Facebook, Stories, Anúncios Meta Ads
RESOLUÇÃO: 1080x1080 pixels, alta qualidade, sem pixelização`;
  }
  
  // ==================== GERAÇÃO DE PROMPTS DE IMAGEM ULTRA-DETALHADOS ====================
  
  function generateUltraDetailedImagePrompt(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string, 
    targetGender?: string, 
    targetAge?: string,
    variation?: number,
    visualContext?: any
  ): string {
    return generateUltraDetailedImagePromptFallback(productName, description, painPoint, emotion, targetGender, targetAge, variation);
  }

  async function generateUltraDetailedImagePromptAsync(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string, 
    targetGender?: string, 
    targetAge?: string,
    variation?: number,
    visualContext?: any
  ): Promise<string> {
    // Usar GPT-4o-mini para geração inteligente
    if (process.env.OPENAI_API_KEY) {
      const gptPrompt = await generatePromptUsingGPT4oMini(productName, description, painPoint, emotion, targetGender, targetAge, variation);
      if (gptPrompt) return gptPrompt;
    }

    return generateUltraDetailedImagePromptFallback(productName, description, painPoint, emotion, targetGender, targetAge, variation);
  }

  function generateUltraDetailedImagePromptSync(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string, 
    targetGender?: string, 
    targetAge?: string,
    variation?: number,
    visualContext?: any
  ): string {
    const context = visualContext || generateVisualContext(productName, description, targetGender, targetAge);
    
    // Incorporar painPoint e description nos prompts para personalização
    const productContext = `PRODUTO: ${productName}\nDESCRIÇÃO: ${description}\nDOR RESOLVIDA: ${painPoint}`;
    
    const emotionPrompts: Record<string, string> = {
      'urgency': `PROMPT PARA IA DE GERAÇÃO DE IMAGEM - ALTA CONVERSÃO (URGÊNCIA):

${productContext}

📸 TIPO: Fotografia comercial premium para anúncio Meta Ads
📐 RESOLUÇÃO: 1080x1080 pixels (formato quadrado para feed)
🎨 ESTILO: Lifestyle marketing brasileiro, autêntico e aspiracional

👤 PROTAGONISTA:
- ${context.protagonist}, idade aparente ${context.ageRange}
- Expressão facial: ${painPoint.includes('pais') || painPoint.includes('pai') ? 'determinação de pai/mãe resolvendo um problema importante, olhar focado e protetor' : 'determinação misturada com senso de urgência, olhar focado e decidido'}
- Linguagem corporal: inclinado levemente para frente, como se estivesse prestes a agir
- Vestimenta: ${painPoint.includes('pais') ? 'roupas casuais confortáveis de pais modernos' : 'casual elegante, cores neutras'}
- Posição: 2/3 do frame, regra dos terços aplicada

🎬 CENA E AMBIENTE:
- ${painPoint.includes('pais') ? 'ambiente acolhedor e familiar (sala de estar aconchegante, espaço de aprendizado)' : context.setting}
- Elementos contextualizados em ${description.toLowerCase().substring(0, 50)}: ${painPoint.includes('guia') ? 'livro, material educativo, notas' : 'elementos relevantes ao produto'}
- Profundidade de campo: foco nítido no rosto, background com blur cinematográfico (f/2.8)
- Espaço para texto: área limpa no topo e/ou lateral para overlay de copy

🎨 PALETA DE CORES E ILUMINAÇÃO:
- Cores dominantes: tons quentes - coral (#FF6B6B), laranja energético (#FF9F43)
- Acentos: amarelo dourado (#FBBF24) para highlights
- Iluminação: luz natural lateral (golden hour), sombras suaves mas presentes
- Contraste: médio-alto para criar impacto visual
- Temperatura: levemente quente (5500K-6000K)

📱 ELEMENTOS DE COMPOSIÇÃO PARA CONVERSÃO:
- Contexto visual conectado a: ${description}
- Solução visual para a dor: ${painPoint}
- Linhas de direção guiando o olhar para ponto focal
- Elementos de movimento sutil (cabelo ao vento, tecido em movimento)
- Gradiente sutil de fundo que não distrai

✅ RESULTADO ESPERADO:
Imagem que resolve ${painPoint} visualmente. Premium que transmite que ${productName} é a solução. Alta taxa de clique.`,

      'curiosity': `PROMPT PARA IA DE GERAÇÃO DE IMAGEM - ALTA CONVERSÃO (CURIOSIDADE):

${productContext}

📸 TIPO: Fotografia artística comercial para anúncio Meta Ads
📐 RESOLUÇÃO: 1080x1080 pixels (formato quadrado para feed)
🎨 ESTILO: Mistério elegante, cinematográfico, intrigante

👤 PROTAGONISTA:
- ${context.protagonist}, idade aparente ${context.ageRange}
- Expressão facial: ${painPoint.includes('pais') || painPoint.includes('pai') ? 'olhar intrigado de quem acabou de descobrir a solução, sobrancelhas levemente levantadas em revelação' : 'olhar intrigado e interessado, sobrancelhas levemente levantadas'}
- Direção do olhar: olhando para algo fora do frame (provocando curiosidade do viewer sobre ${description.toLowerCase().substring(0, 40)})
- Linguagem corporal: leve inclinação da cabeça, postura de descoberta
- Vestimenta: ${painPoint.includes('pais') ? 'roupas casualmente sofisticadas de pais modernos' : 'tons escuros sofisticados, clean e elegante'}

🎬 CENA E AMBIENTE:
- ${painPoint.includes('pais') ? 'Ambiente sofisticado mas acolhedor (escritório, sala de estar moderna) revelando ${description}' : 'Ambiente sofisticado com elementos parcialmente revelados'}
- Luz entrando por uma janela ou porta entreaberta (metáfora de descoberta de ${productName})
- Sombras dramáticas criando mistério e profundidade
- Elementos contextualizados em ${description}: ${painPoint.includes('guia') ? 'materiais educativos, notas revelando conhecimento' : 'elementos relevantes ao produto'}
- Atmosfera de "algo revolucionário está prestes a ser revelado"

🎨 PALETA DE CORES E ILUMINAÇÃO:
- Cores dominantes: roxo profundo (#8B5CF6), azul índigo (#6366F1)
- Acentos: prata (#94A3B8) e dourado suave (#D4AF37)
- Iluminação: estilo Rembrandt - luz lateral com triângulo de luz no rosto
- Sombras: profundas mas com detalhes visíveis
- Atmosfera: levemente moody, como cena de filme noir moderno

📱 ELEMENTOS DE COMPOSIÇÃO PARA CONVERSÃO:
- Espaço negativo intencional (2/3 do frame pode ser área para texto)
- Partículas de luz ou poeira flutuando (atmosfera mágica)
- Linhas guia que levam o olhar do viewer para o protagonista
- Blur seletivo em primeiro plano criando profundidade

🎯 MOOD BOARD REFERENCE:
- Campanhas Apple para privacidade - mistério e sofisticação
- Trailers da Netflix - cinematográfico e intrigante
- Perfumes de luxo - elegância misteriosa

⚙️ ESPECIFICAÇÕES TÉCNICAS:
- Camera: Cinema camera look (RED, ARRI style)
- Lens: 35mm anamórfico ou 50mm com flares sutis
- Depth of field: muito raso, f/1.4 equivalente
- Color grading: teal and orange cinematográfico
- Grain: sutil, estilo filme 35mm

❌ EVITAR:
- Iluminação flat ou muito uniforme
- Cores muito saturadas ou neon
- Expressões muito óbvias ou forçadas
- Ambiente comum sem elementos de interesse

✅ RESULTADO ESPERADO:
Imagem que captura atenção pela curiosidade, faz o viewer querer saber mais. Qualidade cinematográfica premium que se destaca no feed.`,

      'fear_of_missing_out': `PROMPT PARA IA DE GERAÇÃO DE IMAGEM - ALTA CONVERSÃO (FOMO):

${productContext}

📸 TIPO: Fotografia social lifestyle para anúncio Meta Ads
📐 RESOLUÇÃO: 1080x1080 pixels (formato quadrado para feed)
🎨 ESTILO: Comunidade vibrante, celebração autêntica, pertencimento

👤 PROTAGONISTAS:
- FOCO PRINCIPAL: ${context.protagonist}, idade aparente ${context.ageRange}
- Expressão: ${painPoint.includes('pais') ? 'alegria de pais que encontraram a solução, confiança transmitida em rosto' : 'alegria genuína, sorriso autêntico com dentes, olhos brilhando'}
- GRUPO: 3-5 pessoas diversas ao redor (diferentes etnias, idades) - TODOS CONECTADOS POR ${productName}
- Todas demonstrando felicidade autêntica ao descobrir/usar ${description}
- Linguagem corporal: proximidade física natural, gestos de celebração da comunidade

🎬 CENA E AMBIENTE:
- ${painPoint.includes('pais') ? 'Encontro de pais/educadores celebrando transformação por ${productName}' : 'Evento, celebração ou encontro de comunidade'} 
- ${context.setting} com elementos de celebração conectados a ${description}
- Sensação de "comunidade exclusiva" que descobriu ${productName}
- Smartphones visíveis mostrando ${productName} ou comunidade relacionada
- Elementos que sugerem ser parte da solução (badges, identidade visual de ${productName})

🎨 PALETA DE CORES E ILUMINAÇÃO:
- Cores dominantes: verde sucesso (#10B981), dourado conquista (#F59E0B)
- Acentos: rosa pink (#EC4899) para energia, azul (#3B82F6) para confiança
- Iluminação: festiva, brilhante, acolhedora
- Luz de string lights ou fairy lights em segundo plano
- Warm temperature: 4000K-4500K para sensação acolhedora

📱 ELEMENTOS DE COMPOSIÇÃO PARA CONVERSÃO:
- Confetes sutis ou partículas douradas floating
- Balões ou elementos de celebração no background
- Copos ou taças em brinde (opcional, non-alcoholic)
- Telas de smartphone mostrando notificações ou comunidade
- Badges ou elementos visuais de "membro VIP"

🎯 MOOD BOARD REFERENCE:
- Eventos TEDx - comunidade intelectual celebrando
- Lançamentos Apple - filas de fãs empolgados
- Comunidades Nubank Ultravioleta - exclusividade e pertencimento
- Eventos Spotify Wrapped - compartilhamento social

⚙️ ESPECIFICAÇÕES TÉCNICAS:
- Camera: Canon 5D Mark IV ou Sony A7III
- Lens: 24-70mm f/2.8 para capturar grupo
- ISO: 800-1600 (ambiente interno com luz festiva)
- Motion: leve motion blur em mãos/gestos para dinamismo
- Post: cores vibrantes, skin tones preservados

❌ EVITAR:
- Grupos que parecem stock photo genérico
- Diversidade forçada ou não natural
- Ambiente muito formal ou corporativo
- Expressões falsas ou poses rígidas

✅ RESULTADO ESPERADO:
Imagem que desperta o desejo de pertencimento, mostra uma comunidade vibrante e feliz da qual o viewer quer fazer parte. FOMO autêntico e aspiracional.`,

      'trust': `PROMPT PARA IA DE GERAÇÃO DE IMAGEM - ALTA CONVERSÃO (CONFIANÇA):

${productContext}

📸 TIPO: Fotografia corporativa lifestyle para anúncio Meta Ads
📐 RESOLUÇÃO: 1080x1080 pixels (formato quadrado para feed)
🎨 ESTILO: Profissional acessível, confiável, premium mas humano

👤 PROTAGONISTA:
- ${context.protagonist}, idade aparente ${context.ageRange}
- Expressão: ${painPoint.includes('pais') ? 'sorriso de especialista acolhedor, contato visual que transmite expertise em ${description}' : 'sorriso confiante e acolhedor, contato visual direto com camera'}
- Postura: ereta mas relaxada, ${painPoint.includes('pais') ? 'braços abertos com gesto acolhedor para pais' : 'braços abertos ou mãos visíveis (transparência)'}
- Vestimenta: ${painPoint.includes('pais') ? 'smart casual moderno brasileiro que conecta com público parental' : 'smart casual ou business casual brasileiro, bem cuidado'}
- Acessórios: ${painPoint.includes('pais') ? 'elementos que denotam expertise e dedicação familiar (anéis familiares, insígnia de especialista)' : 'relógio clássico, óculos modernos, elementos que denotam sucesso sutil'}

🎬 CENA E AMBIENTE:
- ${painPoint.includes('pais') ? 'Consultório, escritório consultivo ou espaço dedicado a ${description}' : 'Escritório moderno ou home office bem decorado'}
- ${context.setting}
- ${painPoint.includes('pais') ? 'Certificados/prêmios relacionados a ${description}, fotos de sucesso de clientes/pais' : 'Plantas verdes (life, growth, natureza), livros ou elementos que denotam conhecimento'}
- Organização impecável transmitindo profissionalismo em ${description}

🎨 PALETA DE CORES E ILUMINAÇÃO:
- Cores dominantes: azul safira (#3B82F6), verde esmeralda (#059669)
- Acentos: branco (#FFFFFF) e cinza claro (#F3F4F6)
- Iluminação: suave, uniforme, estilo estúdio mas natural
- Sem sombras duras, luz wrap-around
- Temperatura: neutra tendendo a fria (5600K-6500K)

📱 ELEMENTOS DE COMPOSIÇÃO PARA CONVERSÃO:
- Selo de garantia ou certificado visível no ambiente (sutil)
- Troféus ou certificações no background (desfocados)
- Laptop ou dispositivo moderno mostrando gráficos positivos
- Elementos que denotam "years of experience"
- Quadros com diplomas ou reconhecimentos (blur background)

🎯 MOOD BOARD REFERENCE:
- Campanhas de bancos digitais (Nubank, Inter, C6)
- Profissionais LinkedIn Premium
- Consultorias como McKinsey lifestyle
- Healthcare premium ads

⚙️ ESPECIFICAÇÕES TÉCNICAS:
- Camera: Medium format look (Hasselblad, Phase One style)
- Lens: 70-200mm f/2.8 para compression flattering
- Light: Softbox grande, fill light, rim light sutil
- Background: blur suave mas elementos reconhecíveis
- Skin: retoque natural, texturas preservadas

❌ EVITAR:
- Ambiente muito corporativo ou frio
- Pose muito formal ou rígida
- Iluminação de foto 3x4
- Sorriso falso ou forçado
- Background totalmente branco (institucional demais)

✅ RESULTADO ESPERADO:
Imagem que transmite autoridade com acessibilidade, profissionalismo com humanidade. Pessoa em quem você confiaria seu dinheiro ou seu problema.`,

      'excitement': `PROMPT PARA IA DE GERAÇÃO DE IMAGEM - ALTA CONVERSÃO (EMPOLGAÇÃO):

${productContext}

📸 TIPO: Fotografia lifestyle energética para anúncio Meta Ads
📐 RESOLUÇÃO: 1080x1080 pixels (formato quadrado para feed)
🎨 ESTILO: Vibrante, dinâmico, celebratório, pop brasileiro

👤 PROTAGONISTA:
- ${context.protagonist}, idade aparente ${context.ageRange}
- Expressão: ${painPoint.includes('pais') ? 'alegria radiante de pais que encontraram a solução, expressão de "eureka!" ou alívio e felicidade' : 'alegria radiante, boca aberta em riso ou expressão de "wow!"'}
- Linguagem corporal: ${painPoint.includes('pais') ? 'braços levantados em celebração de vitória parental, abraço ou gesto de triunfo' : 'braços levantados em celebração ou punho fechado de vitória'}
- Movimento: capturado em ação, pulo de alegria ou gesto expansivo ao descobrir ${productName}
- Vestimenta: cores vibrantes brasileiras que conectam com energia positiva de ${description}

🎬 CENA E AMBIENTE:
- ${painPoint.includes('pais') ? 'Ambiente festivo da família celebrando transformação por ${productName}' : 'Outdoor em dia ensolarado OU ambiente festivo colorido'}
- ${context.setting} explodindo de energia e celebração
- Céu azul radiante (outdoor) ou luzes coloridas vibrantes (indoor)
- Elementos em movimento: confetes, fitas, partículas douradas celebrando ${productName}
- Sensação de "momento de vitória transformacional" ou "grande revelação de ${description}"

🎨 PALETA DE CORES E ILUMINAÇÃO:
- Cores dominantes: rosa pink (#EC4899), amarelo solar (#FBBF24)
- Acentos: laranja vibrante (#F97316), verde limão (#84CC16)
- Iluminação: brilhante, high-key, sem sombras pesadas
- Sunlight direto ou flash ring para catchlight nos olhos
- Saturação: alta mas natural, estilo Instagram filtrado profissionalmente

📱 ELEMENTOS DE COMPOSIÇÃO PARA CONVERSÃO:
- Confetes coloridos em freeze frame (congelados no ar)
- Estrelas, sparkles ou lens flares criativos
- Pattern geométrico colorido em elementos do ambiente
- Elementos que "explodem" do frame (energia)
- Gradiente vibrante em overlay sutil se necessário

🎯 MOOD BOARD REFERENCE:
- Campanhas Coca-Cola felicidade
- Spotify Wrapped celebrations
- Nike "Just Do It" victory moments
- Nubank rewards celebrations

⚙️ ESPECIFICAÇÕES TÉCNICAS:
- Camera: High speed capture (1/1000s minimum)
- Lens: 35mm f/1.4 para distorção dinâmica
- Flash: High speed sync com sunlight
- Colors: Vibrant processing, lifted shadows
- Motion: freeze frame perfeito com sensação de dinamismo

❌ EVITAR:
- Cores apagadas ou paleta morna
- Expressões contidas ou sutis
- Fundo estático ou boring
- Iluminação flat ou cinza
- Movimento blur não intencional

✅ RESULTADO ESPERADO:
Imagem que explode de energia, impossível de ignorar no feed. Transmite a sensação de que algo incrível está acontecendo e o viewer quer fazer parte.`
    };
    
    return emotionPrompts[emotion] || emotionPrompts['trust'];
  }
  
  // Gerar variações de imagem para testes A/B
  function generateImageVariations(
    productName: string,
    description: string,
    painPoint: string,
    emotion: string,
    targetGender?: string,
    visualContext?: any,
    variationNumber?: number
  ): any[] {
    const context = visualContext || generateVisualContext(productName, description, targetGender);
    
    const variations = [
      {
        id: 1,
        name: 'Variação Close-Up',
        prompt: `PROMPT VARIAÇÃO ${variationNumber}-1 (CLOSE-UP EMOCIONAL):

📸 FORMATO: 1080x1080px (Feed Instagram/Facebook)
🎯 FOCO: Rosto em close-up, expressão emocional intensa

${context.protagonist} em close-up extremo (do peito para cima), expressão de ${getEmotionExpression(emotion)}, olhos expressivos com catchlight perfeito, skin texture natural preservada, profundidade de campo ultra rasa (f/1.2), background completamente blur mas com cores relacionadas a ${productName}.

ILUMINAÇÃO: Rembrandt light com fill suave, ratio 3:1, temperatura ${emotion === 'urgency' || emotion === 'excitement' ? 'quente' : 'neutra'}.

COMPOSIÇÃO: Regra dos terços com olhos no terço superior, espaço no lado oposto ao olhar para texto overlay.

ESTILO: ${context.style}, qualidade ${context.resolution}.

HEADLINE SUGERIDO PARA OVERLAY: "${generateHeadlineForVariation(productName, emotion, 1)}"

PRIMARY TEXT PARA COPIAR:
"${generatePrimaryTextShort(description, painPoint, emotion)}"`,
        headline: generateHeadlineForVariation(productName, emotion, 1),
        primaryText: generatePrimaryTextShort(description, painPoint, emotion)
      },
      {
        id: 2,
        name: 'Variação Lifestyle',
        prompt: `PROMPT VARIAÇÃO ${variationNumber}-2 (LIFESTYLE CONTEXTUAL):

📸 FORMATO: 1080x1080px (Feed Instagram/Facebook)
🎯 FOCO: Pessoa em contexto de uso/benefício do produto

${context.protagonist} em ambiente real de uso, interagindo naturalmente com elementos que representam ${productName}. Expressão de ${getEmotionExpression(emotion)}. Shot de corpo inteiro ou 3/4.

AMBIENTE: ${context.setting}, elementos contextuais que representam a transformação prometida por ${productName}.

ILUMINAÇÃO: ${context.lighting}, sombras naturais, sensação de momento autêntico capturado.

COMPOSIÇÃO: Protagonista em 1/3 lateral do frame, espaço restante mostra ambiente aspiracional.

ESTILO: ${context.style}, ${context.resolution}.

ELEMENTOS OBRIGATÓRIOS:
- Espaço para texto no topo
- Cores harmônicas com ${context.colorPalette}
- Sensação de "antes e depois" sutil

HEADLINE SUGERIDO: "${generateHeadlineForVariation(productName, emotion, 2)}"

PRIMARY TEXT:
"${generatePrimaryTextShort(description, painPoint, emotion)}"`,
        headline: generateHeadlineForVariation(productName, emotion, 2),
        primaryText: generatePrimaryTextShort(description, painPoint, emotion)
      },
      {
        id: 3,
        name: 'Variação Produto em Destaque',
        prompt: `PROMPT VARIAÇÃO ${variationNumber}-3 (PRODUTO + PESSOA):

📸 FORMATO: 1080x1080px (Feed Instagram/Facebook)
🎯 FOCO: Representação visual do produto/serviço com pessoa

${context.protagonist} segurando ou interagindo com representação visual de ${productName} (pode ser dispositivo mostrando conteúdo, livro, tela, ou elemento simbólico).

Expressão de ${getEmotionExpression(emotion)}, olhar direcionado para o "produto" ou para câmera com confiança.

PRODUTO/REPRESENTAÇÃO: Se digital, mostrar tela de celular ou laptop com interface clean. Se físico, mostrar embalagem premium. Usar mockup de alta qualidade.

AMBIENTE: ${context.setting}, fundo clean com elementos mínimos para não competir com o produto.

ILUMINAÇÃO: Product photography lighting - key light forte no produto, fill suave na pessoa.

COMPOSIÇÃO: Pessoa e produto em equilíbrio visual, ambos em foco se possível.

ESTILO: Híbrido entre product photography e lifestyle, ${context.resolution}.

HEADLINE: "${generateHeadlineForVariation(productName, emotion, 3)}"

PRIMARY TEXT:
"${generatePrimaryTextShort(description, painPoint, emotion)}"`,
        headline: generateHeadlineForVariation(productName, emotion, 3),
        primaryText: generatePrimaryTextShort(description, painPoint, emotion)
      }
    ];
    
    return variations;
  }
  
  function getEmotionExpression(emotion: string): string {
    const expressions: Record<string, string> = {
      'urgency': 'determinação intensa, olhar focado, leve tensão positiva nos lábios',
      'curiosity': 'interesse genuíno, sobrancelhas levemente arqueadas, leve sorriso intrigado',
      'fear_of_missing_out': 'alegria contagiante, sorriso amplo e genuíno, olhos brilhantes',
      'trust': 'serenidade confiante, sorriso acolhedor, expressão aberta e receptiva',
      'excitement': 'euforia radiante, boca aberta de alegria, energia visível no rosto'
    };
    return expressions[emotion] || expressions['trust'];
  }
  
  function generateHeadlineForVariation(productName: string, emotion: string, variation: number): string {
    const headlines: Record<string, string[]> = {
      'urgency': [
        `🔥 ${productName} - Últimas Horas Com Este Preço!`,
        `⏰ Só Hoje: ${productName} Com Desconto Exclusivo`,
        `⚡ Aja Agora: ${productName} Por Tempo Limitado`
      ],
      'curiosity': [
        `🤔 O Segredo de ${productName} Revelado`,
        `🔍 Você Não Vai Acreditar: ${productName}`,
        `💡 Descubra ${productName} - A Verdade`
      ],
      'fear_of_missing_out': [
        `🚀 Milhares Já Têm ${productName}. E Você?`,
        `📈 Todo Mundo Está Falando de ${productName}`,
        `⭐ Junte-se a ${Math.floor(Math.random() * 5000) + 10000}+ Com ${productName}`
      ],
      'trust': [
        `✅ ${productName} - Aprovado Por Milhares`,
        `🛡️ Garantia Total: ${productName}`,
        `🏅 ${productName} - Resultados Comprovados`
      ],
      'excitement': [
        `🎉 Chegou: ${productName}!`,
        `✨ Novidade Incrível: ${productName}`,
        `🌟 Prepare-se Para ${productName}!`
      ]
    };
    
    const options = headlines[emotion] || headlines['trust'];
    return options[(variation - 1) % options.length];
  }
  
  function generatePrimaryTextShort(description: string, painPoint: string, emotion: string): string {
    const templates: Record<string, string> = {
      'urgency': `⏰ ATENÇÃO: Esta oferta expira em breve!\n\n${painPoint}\n\n${description}\n\n🔥 Não perca - garanta agora!`,
      'curiosity': `🤔 Você já descobriu?\n\n${painPoint}\n\n${description}\n\n👉 Clique e saiba mais!`,
      'fear_of_missing_out': `🚀 Milhares já transformaram suas vidas!\n\n${painPoint}\n\n${description}\n\n💡 Você vai ficar de fora?`,
      'trust': `✅ Comprovado por milhares!\n\n${painPoint}\n\n${description}\n\n🛡️ Satisfação garantida!`,
      'excitement': `🎉 A espera acabou!\n\n${painPoint}\n\n${description}\n\n⭐ Sua transformação começa agora!`
    };
    
    return templates[emotion] || templates['trust'];
  }
  
  // ==================== CARROSSEL EM HARMONIA - 5 SLIDES ESTILO CANVA ====================
  
  function generateHarmoniousCarouselSlides(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string, 
    targetGender?: string,
    visualContext?: any,
    cta?: string
  ): any[] {
    const context = visualContext || generateVisualContext(productName, description, targetGender);
    const ctaText = cta || 'SAIBA MAIS';
    
    // ==================== PADRÃO VISUAL FIXO OBRIGATÓRIO ====================
    // Este padrão DEVE ser mantido em TODOS os 5 slides para consistência visual
    const padraoVisualFixo = `
═══════════════════════════════════════════════════════════════
⚠️ PADRÃO VISUAL OBRIGATÓRIO - MANTER EM TODOS OS 5 SLIDES
═══════════════════════════════════════════════════════════════

📐 FORMATO: 1080 x 1080 pixels (quadrado para feed)
🎨 TIPO: Design gráfico profissional estilo Canva Pro (NÃO fotografia pura)

👤 PROTAGONISTA (MESMA PESSOA EM TODOS OS SLIDES):
- ${context.protagonist}
- Idade aparente: ${context.ageRange}
- Vestimenta: Roupa casual elegante em tons neutros (MESMA roupa em todos)
- Recorte: Cutout profissional com sombra drop-shadow

🏠 AMBIENTE (MESMO EM TODOS OS SLIDES):
- ${context.setting}
- Consistência: Mesmo cenário/elementos de fundo em todos

🎨 PALETA DE CORES FIXA (USAR EM TODOS OS SLIDES):
- Principal: ${context.colorPalette}
- Fundo: Gradiente suave nos mesmos tons base
- Textos: Branco com sombra OU cor escura contrastante
- Destaques: Verde (#10B981) e Azul (#3B82F6) para CTAs e badges

✏️ TIPOGRAFIA FIXA:
- Headlines: Montserrat ou Poppins Extra Bold
- Subtítulos: Poppins Medium
- Corpo: Poppins Regular
- Tamanhos proporcionais e consistentes

🔲 ELEMENTOS GRÁFICOS CONSISTENTES:
- Molduras/frames: Mesmo estilo em todos os slides
- Ícones: Mesma família de ícones (linha ou preenchido, não misturar)
- Shapes: Mesmas formas decorativas (círculos, retângulos arredondados)
- Indicador de navegação: "X/5" no mesmo canto em todos

⚡ EFEITOS VISUAIS PADRONIZADOS:
- Drop-shadow: Mesma intensidade em elementos
- Glow: Mesmo estilo de brilho
- Gradientes: Mesma direção e suavidade

❌ PROIBIDO:
- Mudar pessoa entre slides
- Mudar roupa da pessoa
- Mudar paleta de cores drasticamente
- Mudar estilo de tipografia
- Usar fundos completamente diferentes

═══════════════════════════════════════════════════════════════`;

    const slides = [
      {
        slideNumber: 1,
        title: `😰 ${painPoint}`,
        description: `Cansado de ${painPoint}? Voce nao esta sozinho. Milhares de pessoas enfrentam o mesmo desafio todos os dias. A frustracao, a incerteza, a sensacao de nao saber por onde comecar... Tudo isso tem solucao!`,
        text: `Cansado de ${painPoint}? Voce nao esta sozinho. Milhares de pessoas enfrentam o mesmo desafio todos os dias. A frustracao, a incerteza, a sensacao de nao saber por onde comecar... Tudo isso tem solucao!`,
        imagePrompt: `🎨 SLIDE 1/5 - CARROSSEL HARMONIOSO - O PROBLEMA
${padraoVisualFixo}

==================== DESIGN ESPECÍFICO DESTE SLIDE ====================

🎯 OBJETIVO: Criar conexão emocional mostrando a DOR do público

📝 TEXTOS NA ARTE (sobre o PRODUTO, não sobre método):
HEADLINE: "😰 ${painPoint}"
- Fonte: Extra Bold, grande, cor clara com sombra
- Posição: Terço superior

SUBTÍTULO: "Você não está sozinho..."
- Fonte: Medium, menor
- Abaixo do headline

👤 PESSOA:
- Expressão: Pensativa/reflexiva (não triste demais)
- Gesto: Mão no queixo ou olhar para cima pensando
- Posição: Centro-direita do frame

✨ ELEMENTOS GRÁFICOS DESTE SLIDE:
- Ícones de interrogação sutis
- Linhas onduladas representando dúvida
- Bolhas de pensamento estilizadas
- Fundo com leve textura ou pattern sutil

📍 INDICADOR: "1/5" + seta "Deslize →" no rodapé`,
        textOverlay: {
          headline: `😰 ${painPoint}`,
          body: 'Você não está sozinho...',
          position: 'top-left'
        },
        transition: 'Deslize para ver a solução →'
      },
      {
        slideNumber: 2,
        title: `💡 Conheça ${productName}`,
        description: `E se eu te dissesse que existe um caminho comprovado? ${productName} foi desenvolvido exatamente para pessoas como voce. Baseado em anos de experiencia e milhares de casos de sucesso, este metodo vai transformar completamente sua abordagem.`,
        text: `E se eu te dissesse que existe um caminho comprovado? ${productName} foi desenvolvido exatamente para pessoas como voce. Baseado em anos de experiencia e milhares de casos de sucesso, este metodo vai transformar completamente sua abordagem.`,
        imagePrompt: `🎨 SLIDE 2/5 - CARROSSEL HARMONIOSO - A SOLUÇÃO
${padraoVisualFixo}

==================== DESIGN ESPECÍFICO DESTE SLIDE ====================

🎯 OBJETIVO: Apresentar o PRODUTO como a solução

📝 TEXTOS NA ARTE:
HEADLINE: "💡 Conheça ${productName}"
- Fonte: Extra Bold, grande
- Efeito: Leve glow dourado

SUBTÍTULO: "A solução que você procurava"
- Fonte: Medium
- Abaixo do headline

BADGE/SELO: Nome do produto em destaque especial
- Pode ser em caixa colorida ou moldura

👤 PESSOA (MESMA do slide 1):
- Expressão: Sorriso de descoberta/esperança
- Gesto: Apontando ou apresentando algo
- Posição: Mantendo proporção similar ao slide 1

✨ ELEMENTOS GRÁFICOS DESTE SLIDE:
- Lâmpada estilizada ou ícone de ideia
- Raios de luz sutis saindo do centro
- Sparkles dourados
- Badge com nome do produto

📍 INDICADOR: "2/5" + seta "Como funciona? →" no rodapé`,
        textOverlay: {
          headline: `💡 Conheça ${productName}`,
          body: 'A solução que você procurava',
          position: 'center'
        },
        transition: 'Deslize para ver como funciona →'
      },
      {
        slideNumber: 3,
        title: `🎯 ${productName} - Como Funciona`,
        description: `${description} Com ${productName}, voce tera acesso a um metodo passo a passo, desenvolvido para ser simples, direto e eficaz. Sem complicacao, sem termos tecnicos, apenas resultados praticos que voce pode aplicar imediatamente.`,
        text: `${description} Com ${productName}, voce tera acesso a um metodo passo a passo, desenvolvido para ser simples, direto e eficaz. Sem complicacao, sem termos tecnicos, apenas resultados praticos que voce pode aplicar imediatamente.`,
        imagePrompt: `🎨 SLIDE 3/5 - CARROSSEL HARMONIOSO - COMO FUNCIONA
${padraoVisualFixo}

==================== DESIGN DESTE SLIDE ====================

🎯 OBJETIVO: Explicar o metodo de forma visual e clara

📐 LAYOUT:
- Fundo: Gradiente verde para azul (cores de progresso)
- Layout em 3 colunas ou steps visuais
- Icones grandes representando etapas
- Numeros destacados (1, 2, 3)
- Setas conectando as etapas

📝 TEXTOS NA ARTE:
HEADLINE: "🎯 ${productName} - Como Funciona"
- Fonte: Extra Bold
- Posicao: Topo central
- Cor: Branco ou escuro contrastante

STEPS VISUAIS:
"1️⃣ Acesse o conteudo"
"2️⃣ Aplique o metodo"  
"3️⃣ Veja os resultados"
- Cada step em caixa/card estilizado
- Icones representativos ao lado

LISTA DE BENEFICIOS:
"✓ Metodo passo a passo"
"✓ Simples e direto"
"✓ Resultados imediatos"
- Checkmarks estilizados em verde

✨ ELEMENTOS GRAFICOS:
- Icones de processo (engrenagens, setas, fluxo)
- Numeros grandes e estilizados
- Cards ou caixas para cada etapa
- Linha de conexao entre etapas
- Checkmarks animados/estilizados
- Shapes geometricos de fundo

🎨 CORES DESTE SLIDE:
- Fundo: Verde (#10B981), Azul (#3B82F6)
- Acentos: Branco, amarelo destaque
- Mood: Clareza, organizacao, confianca

⚡ EFEITOS:
- Sombras nos cards
- Gradiente nos icones
- Glow nos numeros
- Linhas de conexao animadas

📍 INDICADOR DE NAVEGACAO:
- "3/5" no canto inferior
- Seta apontando para direita
- Texto "Veja os resultados →"`,
        textOverlay: {
          headline: `🎯 ${productName} - Como Funciona`,
          body: description,
          position: 'bottom'
        },
        transition: 'Deslize para ver os resultados →'
      },
      {
        slideNumber: 4,
        title: `⭐ ${productName} - Resultados Reais`,
        description: `Milhares de pessoas ja transformaram suas vidas com ${productName}. Sao historias reais de superacao, crescimento e conquistas. 97% dos nossos clientes relatam resultados positivos nos primeiros 30 dias. Voce pode ser o proximo caso de sucesso!`,
        text: `Milhares de pessoas ja transformaram suas vidas com ${productName}. Sao historias reais de superacao, crescimento e conquistas. 97% dos nossos clientes relatam resultados positivos nos primeiros 30 dias. Voce pode ser o proximo caso de sucesso!`,
        imagePrompt: `🎨 SLIDE 4/5 - CARROSSEL HARMONIOSO - PROVA SOCIAL
${padraoVisualFixo}

==================== DESIGN DESTE SLIDE ====================

🎯 OBJETIVO: Mostrar prova social e resultados

📐 LAYOUT:
- Fundo: Gradiente dourado/amarelo (celebracao)
- Numeros grandes em destaque
- Mini avatares de clientes satisfeitos
- Estrelas de avaliacao estilizadas
- Confetes e elementos de celebracao

📝 TEXTOS NA ARTE:
HEADLINE: "⭐ ${productName} - Resultados Reais"
- Fonte: Extra Bold
- Posicao: Topo central
- Efeito: Glow dourado

NUMEROS DE IMPACTO:
"+15.000" - em fonte gigante dourada
"pessoas transformadas" - subtitulo

"97%" - numero grande em destaque
"de satisfacao" - subtitulo

ESTRELAS: "⭐⭐⭐⭐⭐"
- Estrelas estilizadas e brilhantes
- Pode ter "4.9/5" ao lado

DEPOIMENTO VISUAL:
- Mini cards com foto + aspas
- "Mudou minha vida!" com avatar

✨ ELEMENTOS GRAFICOS:
- Confetes coloridos caindo
- Estrelas e sparkles dourados
- Trofeu ou medalha estilizada
- Grafico de barras crescendo
- Avatares circulares de clientes
- Badges de certificacao/qualidade
- Icones de coracao/like

🎨 CORES DESTE SLIDE:
- Fundo: Amarelo dourado (#FBBF24), Laranja
- Acentos: Branco, dourado metalico
- Mood: Celebracao, conquista, confianca

⚡ EFEITOS:
- Confetes animados
- Brilhos e sparkles
- Glow nos numeros
- Sombras nos cards de depoimento

📍 INDICADOR DE NAVEGACAO:
- "4/5" no canto inferior
- Seta apontando para direita
- Texto "Garanta o seu →"`,
        textOverlay: {
          headline: `⭐ ${productName} - Resultados Reais`,
          body: '+15.000 pessoas transformadas | 97% satisfacao',
          position: 'center'
        },
        transition: 'Deslize para garantir o seu →'
      },
      {
        slideNumber: 5,
        title: `🚀 ${productName} - ${ctaText}`,
        description: `Chegou a sua vez! Com ${productName}, voce tera acesso completo ao metodo que ja transformou milhares de vidas. Garantia de 7 dias - se nao funcionar para voce, devolvemos 100% do seu investimento. Sem perguntas, sem burocracia. Clique agora e comece sua transformacao hoje mesmo!`,
        text: `Chegou a sua vez! Com ${productName}, voce tera acesso completo ao metodo que ja transformou milhares de vidas. Garantia de 7 dias - se nao funcionar para voce, devolvemos 100% do seu investimento. Sem perguntas, sem burocracia. Clique agora e comece sua transformacao hoje mesmo!`,
        imagePrompt: `🎨 SLIDE 5/5 - CARROSSEL HARMONIOSO - CALL TO ACTION
${padraoVisualFixo}

==================== DESIGN DESTE SLIDE ====================

🎯 OBJETIVO: Converter - criar acao imediata

📐 LAYOUT:
- Fundo: Gradiente vibrante (rosa/vermelho para laranja)
- Botao de CTA GIGANTE no centro
- Selo de garantia em destaque
- Setas apontando para o botao
- Elementos de urgencia

📝 TEXTOS NA ARTE:
HEADLINE: "🚀 ${productName} - ${ctaText}"
- Fonte: Extra Bold, branco
- Posicao: Topo central
- Efeito: Glow energetico

BOTAO CTA PRINCIPAL:
"${ctaText}"
- Botao grande, arredondado
- Cor: Verde vibrante ou contraste
- Sombra forte para destaque
- Seta dentro do botao

GARANTIA:
"🛡️ Garantia de 7 dias"
- Em badge/selo estilizado
- Icone de escudo com check

URGENCIA:
"👇 CLIQUE AGORA"
- Setas pulsantes apontando para baixo
- Pode ter "Vagas limitadas"

✨ ELEMENTOS GRAFICOS:
- Botao 3D com sombra
- Selo de garantia (escudo dourado)
- Setas direcionais multiplas
- Badge de "OFERTA ESPECIAL"
- Icone de relogio (urgencia)
- Sparkles ao redor do CTA
- Linhas de energia/movimento

🎨 CORES DESTE SLIDE:
- Fundo: Rosa (#EC4899), Vermelho, Laranja
- CTA: Verde (#10B981) ou Azul vibrante
- Acentos: Branco, dourado
- Mood: Energia, urgencia, acao

⚡ EFEITOS:
- Pulsacao visual no botao
- Raios de luz do botao
- Glow intenso
- Setas animadas

📍 INDICADOR DE NAVEGACAO:
- "5/5" - SLIDE FINAL
- "CLIQUE NO LINK" em destaque
- Seta grande apontando para acao`,
        textOverlay: {
          headline: `🚀 ${productName} - ${ctaText}`,
          body: 'Garantia de 7 dias | Clique agora!',
          position: 'center'
        },
        transition: null
      }
    ];
    
    return slides;
  }
  
  // ==================== VÍDEO UNIFICADO - ESTRUTURA SIMPLES E CLARA ====================
  
  function generateUnifiedVideoContent(
    productName: string, 
    description: string, 
    painPoint: string, 
    emotion: string,
    targetGender?: string,
    visualContext?: any,
    cta?: string
  ): any {
    const context = visualContext || generateVisualContext(productName, description, targetGender);
    const ctaText = cta || 'SAIBA MAIS';
    
    return {
      // ==================== INFORMAÇÕES GERAIS ====================
      formato: '9:16 Vertical (1080x1920)',
      duracaoTotal: '48 segundos (6 cenas de 8 segundos cada)',
      plataformas: 'Reels, TikTok, Stories, YouTube Shorts',
      
      // ==================== PADRÃO VISUAL OBRIGATÓRIO (MANTER EM TODAS AS CENAS) ====================
      padraoVisual: {
        protagonista: context.protagonist,
        idadeAparente: context.ageRange,
        vestimenta: 'Roupa casual elegante em tons neutros (MESMA em todas as cenas)',
        ambiente: context.setting,
        paletaDeCores: context.colorPalette,
        estilo: context.style,
        iluminacao: context.lighting,
        camera: 'Movimentos suaves e cinematográficos, 24fps, estabilizado',
        colorGrading: 'Cinematográfico, tons quentes com sombras levemente azuladas',
        transicoes: 'Dissolve suave ou match cut entre cenas',
        avisoImportante: '⚠️ MANTER MESMA PESSOA, MESMA ROUPA, MESMO AMBIENTE EM TODAS AS CENAS!'
      },
      
      // ==================== CENAS (8 SEGUNDOS CADA) ====================
      cenas: [
        {
          numero: 1,
          nome: 'HOOK - Captura de Atenção',
          duracao: '8 segundos',
          tempoNoVideo: '0:00 - 0:08',
          
          roteiro: {
            textoNaTela: `😰 "${painPoint}"`,
            narracao: `Ei, você aí! Cansado de ${painPoint}? O que você vai ver nos próximos segundos pode mudar tudo...`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps.

SETTING: ${context.setting}, golden hour lighting, warm tones.

SUBJECT: ${context.protagonist}, ${context.ageRange}, wearing casual elegant neutral clothing, looking directly at camera with intrigued and slightly frustrated expression.

ACTION SEQUENCE:
- 0-2s: Close-up of subject's face, slight head tilt, direct eye contact
- 2-4s: Slow zoom out revealing environment, subject raises eyebrow
- 4-6s: Subject leans forward as if about to share a secret
- 6-8s: Expression shifts from frustration to hope, slight smile forming

CAMERA: Start tight on face, smooth slow dolly out to medium shot. 85mm lens look.
LIGHTING: Soft key light from left, warm fill, golden hour feel.
MOOD: Relatable frustration transitioning to curiosity.
TEXT SPACE: Leave clean area in top third for text overlay.`
        },
        {
          numero: 2,
          nome: 'PROBLEMA - Conexão Emocional',
          duracao: '8 segundos',
          tempoNoVideo: '0:08 - 0:16',
          
          roteiro: {
            textoNaTela: `"O desafio que milhares enfrentam..."`,
            narracao: `${painPoint}. Eu sei como é difícil. A frustração de não encontrar uma solução real...`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps. CONTINUATION - same subject, same clothing.

SETTING: Same ${context.setting}, lighting slightly cooler and more dramatic.

SUBJECT: Same ${context.protagonist} from scene 1, same clothing, expression of deep thought and slight frustration.

ACTION SEQUENCE:
- 0-2s: Medium shot looking down thoughtfully, hand touching chin
- 2-4s: Slow pan showing environment
- 4-6s: Subject looks up, shakes head slightly with frustrated expression
- 6-8s: Looks at camera with 'you know what I mean' connection

CAMERA: Slow dolly, slightly lower angle for empathy.
LIGHTING: Slightly cooler, more dramatic shadows.
MOOD: Empathy, understanding, 'I see you' moment.`
        },
        {
          numero: 3,
          nome: 'VIRADA - A Descoberta',
          duracao: '8 segundos',
          tempoNoVideo: '0:16 - 0:24',
          
          roteiro: {
            textoNaTela: `💡 "E se eu te dissesse que existe uma solução?"`,
            narracao: `E se eu te dissesse que existe um caminho comprovado? ${productName} já ajudou mais de 15.000 pessoas...`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps. CONTINUATION - same subject, same clothing, PIVOTAL MOMENT.

SETTING: Same ${context.setting}, lighting transitions from cool to warm.

SUBJECT: Same ${context.protagonist}, same clothing. Expression transforms to excited discovery.

ACTION SEQUENCE:
- 0-2s: Expression shifts to realization - eyebrows raise, eyes widen
- 2-4s: Light brightens, subject turns toward light
- 4-6s: Smile growing, posture straightens with energy
- 6-8s: Confident, knowing smile at camera - 'I found the answer'

CAMERA: Dynamic, slight push in as realization happens.
LIGHTING: Transition from cooler to warm golden light.
MOOD: Transformation moment. Hope emerging.`
        },
        {
          numero: 4,
          nome: 'SOLUÇÃO - O Método',
          duracao: '8 segundos',
          tempoNoVideo: '0:24 - 0:32',
          
          roteiro: {
            textoNaTela: `🎯 ${productName}\n✓ Método passo a passo\n✓ Simples e direto\n✓ Resultados comprovados`,
            narracao: `${description}. Simples, direto e eficaz. Resultados desde a primeira semana de aplicação...`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps. CONTINUATION - same subject, same clothing.

SETTING: Same ${context.setting}, fully bright and organized. Premium look.

SUBJECT: Same ${context.protagonist}, same clothing. Confident posture, explaining with natural gestures.

ACTION SEQUENCE:
- 0-2s: Confident stance, hands gesturing as if explaining
- 2-4s: Interacting with device showing the solution
- 4-6s: Counting on fingers - 'step by step' gesture
- 6-8s: 'It's that easy' gesture with satisfied smile

CAMERA: Stable medium shot with space for text overlays.
LIGHTING: Bright, professional, optimistic.
MOOD: Confidence, simplicity, 'you can do this too'.`
        },
        {
          numero: 5,
          nome: 'PROVA SOCIAL - Resultados',
          duracao: '8 segundos',
          tempoNoVideo: '0:32 - 0:40',
          
          roteiro: {
            textoNaTela: `⭐ +15.000 pessoas transformadas\n97% de satisfação`,
            narracao: `Mais de 15.000 pessoas já transformaram suas vidas. 97% de satisfação. Sua vez chegou!`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps. CONTINUATION - same subject, same clothing, CELEBRATION.

SETTING: Same ${context.setting}, subtle celebratory elements, warm festive lighting.

SUBJECT: Same ${context.protagonist}, same clothing. Expression of genuine joy and pride.

ACTION SEQUENCE:
- 0-2s: Arms slightly raised in victory pose, genuine smile
- 2-4s: Shows phone with testimonials
- 4-6s: Counting gesture showing impressive numbers
- 6-8s: Nodding confidently, 'you could be next' expression

CAMERA: Dynamic, celebratory feel. Slight upward angle.
LIGHTING: Warm, festive, premium. Subtle confetti particles.
MOOD: Celebration, success is achievable.`
        },
        {
          numero: 6,
          nome: 'CTA - Chamada para Ação',
          duracao: '8 segundos',
          tempoNoVideo: '0:40 - 0:48',
          
          roteiro: {
            textoNaTela: `🚀 SUA VEZ CHEGOU!\n👇 CLIQUE NO LINK\n🛡️ Garantia de 7 dias`,
            narracao: `Clique no link agora! Você tem 7 dias de garantia total. Sua transformação começa com um clique!`
          },
          
          promptVeo: `Cinematic vertical video 9:16, 8 seconds, 24fps. CONTINUATION - same subject, same clothing, FINAL CTA.

SETTING: Same ${context.setting}, premium and inviting.

SUBJECT: Same ${context.protagonist}, same clothing. Open arms, welcoming smile.

ACTION SEQUENCE:
- 0-2s: Welcoming posture, arms naturally open, warm smile
- 2-4s: Gestures 'come with me' encouragingly
- 4-6s: Shows 'guarantee' gesture (hands forming shield)
- 6-8s: Final direct eye contact, confident nod - 'your turn'

CAMERA: Medium shot, stable, slight push in for connection.
LIGHTING: Warm, optimistic, premium. Best lighting of entire video.
MOOD: Invitation, welcome, 'this is your moment'.`
        }
      ],
      
      // ==================== DICAS DE EDIÇÃO ====================
      dicasEdicao: {
        audio: [
          'Adicionar música trending (TikTok Creative Center)',
          'Sincronizar cortes com batida da música',
          'Balancear música vs narração (música -6dB durante narração)'
        ],
        textos: [
          'Fonte moderna (Montserrat, Poppins)',
          'Cor branca com sombra para legibilidade',
          'Animações suaves de entrada/saída'
        ],
        transicoes: [
          'Dissolve suave entre cenas',
          'Evitar transições bruscas',
          'Manter flow narrativo contínuo'
        ]
      }
    };
  }
  
  function generateStrategyNotes(data: any): string {
    const { objective, hasPixelConfigured, targetAgeRange, targetGender, targetLocation } = data;
    
    let notes = `## Estratégia de Campanha Andromeda\n\n`;
    notes += `### Objetivo: ${objective}\n\n`;
    
    notes += `### Configuração Recomendada:\n`;
    notes += `- **Otimização de Orçamento de Campanha (CBO)**: Ativado\n`;
    notes += `- **Posicionamentos**: Advantage+ (automático)\n`;
    notes += `- **Público**: Advantage+ Audience (deixe o Andromeda trabalhar)\n\n`;
    
    if (!hasPixelConfigured) {
      notes += `### ⚠️ Alerta: Pixel não configurado\n`;
      notes += `Configure o Meta Pixel ou a Conversions API para obter melhores resultados. Sem pixel, você perde:\n`;
      notes += `- Otimização para conversões\n`;
      notes += `- Públicos personalizados\n`;
      notes += `- Retargeting\n\n`;
    }
    
    notes += `### Orçamento Sugerido:\n`;
    notes += `- **Teste inicial**: R$ 20-50/dia por 3-5 dias\n`;
    notes += `- **Escala**: Aumentar 20% a cada 3 dias se CPA estiver bom\n\n`;
    
    notes += `### Dicas do Andromeda:\n`;
    notes += `1. **Não restrinja demais o público** - Deixe a IA do Meta encontrar os melhores compradores\n`;
    notes += `2. **Use múltiplos criativos** - O algoritmo vai priorizar os melhores automaticamente\n`;
    notes += `3. **Seja paciente** - Aguarde 3-5 dias antes de fazer mudanças significativas\n`;
    notes += `4. **Monitore o CPA** - Mais importante que CPM ou CTR\n`;
    
    return notes;
  }

  // ==================== WHATSAPP INTEGRATION ====================
  
  // Get WhatsApp status
  app.get('/api/admin/whatsapp/status', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const status = whatsappService.getStatus();
      res.json(status);
    } catch (error: any) {
      logger.error('[WhatsApp API] Error getting status:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter status do WhatsApp' });
    }
  });

  // Connect WhatsApp (generate QR code)
  app.post('/api/admin/whatsapp/connect', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      logger.info('[WhatsApp API] Starting connection...');
      
      // Start initialization in background (don't await)
      whatsappService.initialize().catch(err => {
        logger.error('[WhatsApp API] Background initialization failed:', err);
      });
      
      // Wait a bit for QR code to be generated
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const status = whatsappService.getStatus();
      res.json({ 
        success: true, 
        message: status.qrCode ? 'QR Code gerado, escaneie com seu WhatsApp' : 'Conectando...',
        status 
      });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error connecting:', error);
      res.status(500).json({ message: error.message || 'Erro ao conectar WhatsApp' });
    }
  });

  // Disconnect WhatsApp
  app.post('/api/admin/whatsapp/disconnect', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await whatsappService.disconnect();
      res.json({ success: true, message: 'WhatsApp desconectado com sucesso' });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error disconnecting:', error);
      res.status(500).json({ message: error.message || 'Erro ao desconectar WhatsApp' });
    }
  });

  app.post('/api/admin/whatsapp/force-reconnect', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      logger.info('[WhatsApp API] Force reconnect requested...');
      
      whatsappService.forceReconnect().catch(err => {
        logger.error('[WhatsApp API] Force reconnect background error:', err);
      });
      
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      const status = whatsappService.getStatus();
      res.json({ 
        success: true, 
        message: status.qrCode ? 'QR Code gerado! Escaneie com seu WhatsApp' : 'Reconectando...',
        status 
      });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error in force reconnect:', error);
      res.status(500).json({ message: error.message || 'Erro ao forçar reconexão' });
    }
  });

  // Get QR code (polling endpoint)
  app.get('/api/admin/whatsapp/qrcode', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const status = whatsappService.getStatus();
      res.json({ 
        qrCode: status.qrCode,
        connected: status.connected,
        connecting: status.connecting
      });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error getting QR code:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter QR code' });
    }
  });

  // Send test message via WhatsApp
  app.post('/api/admin/whatsapp/test', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: 'Telefone é obrigatório' });
      }

      await whatsappService.sendTestMessage(phone, 
        '🎉 *Teste Lowfy*\n\nSua integração com WhatsApp está funcionando perfeitamente!\n\n_Mensagem enviada pelo sistema Lowfy_'
      );
      
      res.json({ success: true, message: 'Mensagem de teste adicionada à fila!' });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error sending test message:', error);
      res.status(500).json({ message: error.message || 'Erro ao enviar mensagem de teste' });
    }
  });

  // Check if number is on WhatsApp
  app.post('/api/admin/whatsapp/check-number', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ message: 'Telefone é obrigatório' });
      }

      const isRegistered = await whatsappService.checkNumberRegistered(phone);
      
      res.json({ 
        registered: isRegistered,
        message: isRegistered ? 'Número está registrado no WhatsApp' : 'Número não está no WhatsApp'
      });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error checking number:', error);
      res.status(500).json({ message: error.message || 'Erro ao verificar número' });
    }
  });

  app.get('/api/admin/whatsapp/metrics', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const metrics = whatsappService.getQueueMetrics();
      const queueLength = whatsappService.getQueueLength();
      const status = whatsappService.getStatus();
      
      res.json({
        queue: {
          length: queueLength,
          ...metrics,
        },
        connection: {
          connected: status.connected,
          phoneNumber: status.phoneNumber,
          lastConnected: status.lastConnected,
        }
      });
    } catch (error: any) {
      logger.error('[WhatsApp API] Error getting metrics:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter métricas' });
    }
  });

  // ==================== WHATSAPP CAMPAIGN ENDPOINTS ====================

  app.get('/api/admin/whatsapp/campaigns', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const campaigns = await storage.getWhatsappCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error listing campaigns:', error);
      res.status(500).json({ message: error.message || 'Erro ao listar campanhas' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { 
        title, message, 
        mediaType, mediaUrl, mediaFileName, 
        imageUrl, imageFileName,
        videoUrl, videoFileName,
        audioUrl, audioFileName,
        documentUrl, documentFileName,
        intervalMinSec, intervalMaxSec, optOutKeyword, optOutMessage 
      } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ message: 'Título e mensagem são obrigatórios' });
      }

      const campaign = await storage.createWhatsappCampaign({
        title,
        message,
        mediaType: mediaType || null,
        mediaUrl: mediaUrl || null,
        mediaFileName: mediaFileName || null,
        imageUrl: imageUrl || null,
        imageFileName: imageFileName || null,
        videoUrl: videoUrl || null,
        videoFileName: videoFileName || null,
        audioUrl: audioUrl || null,
        audioFileName: audioFileName || null,
        documentUrl: documentUrl || null,
        documentFileName: documentFileName || null,
        intervalMinSec: intervalMinSec || 30,
        intervalMaxSec: intervalMaxSec || 60,
        optOutKeyword: optOutKeyword || 'SAIR',
        optOutMessage: optOutMessage || 'Para não receber mais mensagens de campanhas, responda: SAIR',
        status: 'draft',
        totalRecipients: 0,
        createdBy: req.user.id,
      });

      res.json(campaign);
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error creating campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao criar campanha' });
    }
  });

  app.get('/api/admin/whatsapp/campaigns/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const campaign = await storage.getWhatsappCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      const stats = await storage.getCampaignRecipientStats(req.params.id);
      res.json({ ...campaign, stats });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error getting campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter campanha' });
    }
  });

  app.patch('/api/admin/whatsapp/campaigns/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const campaign = await storage.getWhatsappCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }

      if (campaign.status !== 'draft') {
        return res.status(400).json({ message: 'Só é possível editar campanhas em rascunho' });
      }

      const { title, message, mediaType, mediaUrl, mediaFileName, intervalMinSec, intervalMaxSec, optOutKeyword, optOutMessage } = req.body;
      
      const updated = await storage.updateWhatsappCampaign(req.params.id, {
        title: title || campaign.title,
        message: message || campaign.message,
        mediaType: mediaType !== undefined ? mediaType : campaign.mediaType,
        mediaUrl: mediaUrl !== undefined ? mediaUrl : campaign.mediaUrl,
        mediaFileName: mediaFileName !== undefined ? mediaFileName : campaign.mediaFileName,
        intervalMinSec: intervalMinSec || campaign.intervalMinSec,
        intervalMaxSec: intervalMaxSec || campaign.intervalMaxSec,
        optOutKeyword: optOutKeyword || campaign.optOutKeyword,
        optOutMessage: optOutMessage !== undefined ? optOutMessage : campaign.optOutMessage,
      });

      res.json(updated);
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error updating campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao atualizar campanha' });
    }
  });

  app.delete('/api/admin/whatsapp/campaigns/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const campaign = await storage.getWhatsappCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }

      if (campaign.status === 'running') {
        return res.status(400).json({ message: 'Não é possível excluir uma campanha em execução' });
      }

      await storage.deleteWhatsappCampaign(req.params.id);
      res.json({ success: true, message: 'Campanha excluída com sucesso' });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error deleting campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao excluir campanha' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/:id/start', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const result = await campaignDispatcher.startCampaign(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error starting campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao iniciar campanha' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/:id/pause', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const result = await campaignDispatcher.pauseCampaign(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error pausing campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao pausar campanha' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/:id/resume', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const result = await campaignDispatcher.resumeCampaign(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error resuming campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao retomar campanha' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/:id/cancel', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const result = await campaignDispatcher.cancelCampaign(req.params.id);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error canceling campaign:', error);
      res.status(500).json({ message: error.message || 'Erro ao cancelar campanha' });
    }
  });

  app.get('/api/admin/whatsapp/campaigns/:id/recipients', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const recipients = await storage.getCampaignRecipients(req.params.id);
      res.json(recipients);
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error getting recipients:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter destinatários' });
    }
  });

  app.get('/api/admin/whatsapp/campaigns/:id/stats', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const stats = await storage.getCampaignRecipientStats(req.params.id);
      const dispatcherStatus = campaignDispatcher.getStatus();
      res.json({ 
        ...stats, 
        isRunning: dispatcherStatus.isRunning && dispatcherStatus.campaignId === req.params.id,
        lastError: dispatcherStatus.lastError 
      });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error getting stats:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter estatísticas' });
    }
  });

  app.get('/api/admin/whatsapp/opt-outs', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const optOuts = await storage.getWhatsappOptOuts();
      res.json(optOuts);
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error getting opt-outs:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter lista de exclusões' });
    }
  });

  app.delete('/api/admin/whatsapp/opt-outs/:id', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      await storage.deleteWhatsappOptOut(req.params.id);
      res.json({ success: true, message: 'Exclusão removida com sucesso' });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error deleting opt-out:', error);
      res.status(500).json({ message: error.message || 'Erro ao remover exclusão' });
    }
  });

  app.post('/api/admin/whatsapp/opt-outs', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { phone, userName } = req.body;
      if (!phone) {
        return res.status(400).json({ message: 'Telefone é obrigatório' });
      }

      const normalizedPhone = phone.replace(/\D/g, '');
      const existing = await storage.getWhatsappOptOut(normalizedPhone);
      if (existing) {
        return res.status(400).json({ message: 'Este número já está na lista de bloqueio' });
      }

      const optOut = await storage.createWhatsappOptOut({
        phone: normalizedPhone,
        userName: userName || null,
        keyword: 'MANUAL',
      });

      res.json({ success: true, optOut });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error adding opt-out:', error);
      res.status(500).json({ message: error.message || 'Erro ao adicionar à lista de bloqueio' });
    }
  });

  app.get('/api/admin/whatsapp/eligible-recipients', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const recipients = await storage.getEligibleRecipientsForCampaign();
      res.json({ count: recipients.length, recipients });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error getting eligible recipients:', error);
      res.status(500).json({ message: error.message || 'Erro ao obter destinatários elegíveis' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/test-message', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { 
        phone, message, optOutMessage,
        imageUrl, imageFileName,
        videoUrl, videoFileName,
        audioUrl, audioFileName,
        documentUrl, documentFileName,
        mediaType, mediaUrl
      } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ message: 'Telefone e mensagem são obrigatórios' });
      }

      if (!whatsappService.isConnected()) {
        return res.status(400).json({ message: 'WhatsApp não está conectado' });
      }

      const objectStorageService = new ObjectStorageService();
      const medias: Array<{ buffer: Buffer; type: 'image' | 'video' | 'audio' | 'document'; fileName?: string }> = [];

      if (imageUrl) {
        const buffer = await objectStorageService.getObjectBuffer(imageUrl);
        if (buffer) medias.push({ buffer, type: 'image', fileName: imageFileName });
      }
      if (videoUrl) {
        const buffer = await objectStorageService.getObjectBuffer(videoUrl);
        if (buffer) medias.push({ buffer, type: 'video', fileName: videoFileName });
      }
      if (audioUrl) {
        const buffer = await objectStorageService.getObjectBuffer(audioUrl);
        if (buffer) medias.push({ buffer, type: 'audio', fileName: audioFileName });
      }
      if (documentUrl) {
        const buffer = await objectStorageService.getObjectBuffer(documentUrl);
        if (buffer) medias.push({ buffer, type: 'document', fileName: documentFileName });
      }
      
      if (mediaType && mediaUrl && typeof mediaUrl === 'string') {
        const buffer = await objectStorageService.getObjectBuffer(mediaUrl);
        if (buffer) medias.push({ buffer, type: mediaType as 'image' | 'video' | 'audio' | 'document' });
      }

      if (medias.length > 0) {
        logger.info(`[WhatsApp Campaigns] Sending ${medias.length} media(s) to ${phone}`);
        await whatsappService.sendMultipleMedia(phone, medias, message, optOutMessage || undefined);
      } else {
        await whatsappService.sendMessage(phone, message);
        if (optOutMessage) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await whatsappService.sendMessage(phone, optOutMessage);
        }
      }

      logger.info(`[WhatsApp Campaigns] Test message sent to ${phone}`);
      res.json({ success: true, message: 'Mensagem de teste enviada com sucesso' });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error sending test message:', error);
      const errorMsg = error?.message || 'Erro ao enviar mensagem de teste';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/:id/set-recipients', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { recipientIds, selectAll } = req.body;
      const campaignId = req.params.id;

      const campaign = await storage.getWhatsappCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }

      if (campaign.status !== 'draft') {
        return res.status(400).json({ message: 'Só é possível definir destinatários em campanhas em rascunho' });
      }

      await storage.deleteCampaignRecipients(campaignId);

      const allRecipients = await storage.getEligibleRecipientsForCampaign();
      let selectedRecipients;

      if (selectAll) {
        selectedRecipients = allRecipients;
      } else {
        selectedRecipients = allRecipients.filter(r => recipientIds.includes(r.recipientId || r.phone));
      }

      if (selectedRecipients.length === 0) {
        return res.status(400).json({ message: 'Nenhum destinatário selecionado' });
      }

      const recipientData = selectedRecipients.map(r => ({
        campaignId,
        userId: r.userId,
        phone: r.phone.replace(/\D/g, ''),
        userName: r.userName,
        status: 'pending' as const,
      }));
      
      await storage.createWhatsappCampaignRecipients(recipientData);
      await storage.updateWhatsappCampaign(campaignId, {
        totalRecipients: recipientData.length,
      });

      logger.info(`[WhatsApp Campaigns] Set ${recipientData.length} recipients for campaign ${campaignId}`);
      res.json({ success: true, count: recipientData.length, message: `${recipientData.length} destinatários selecionados` });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error setting recipients:', error);
      res.status(500).json({ message: error.message || 'Erro ao definir destinatários' });
    }
  });

  app.post('/api/admin/whatsapp/campaigns/upload-media', authMiddleware, adminMiddleware, uploadCampaignMedia.single('media'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      const file = req.file;
      const requestedType = req.body.type as string | undefined;

      let mediaType: 'image' | 'video' | 'audio' | 'document';
      if (requestedType && ['image', 'video', 'audio', 'document'].includes(requestedType)) {
        mediaType = requestedType as 'image' | 'video' | 'audio' | 'document';
      } else if (file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        mediaType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        mediaType = 'audio';
      } else {
        mediaType = 'document';
      }

      const objectStorageService = new ObjectStorageService();
      const ext = file.originalname.split('.').pop() || 'bin';
      
      const url = await objectStorageService.uploadBuffer(
        file.buffer, 
        'campaigns',
        file.mimetype,
        ext
      );

      logger.info(`[WhatsApp Campaigns] Media uploaded: ${file.originalname} (${mediaType}, ${(file.size / 1024 / 1024).toFixed(2)}MB) -> ${url}`);

      res.json({
        url,
        mediaType,
        fileName: file.originalname,
      });
    } catch (error: any) {
      logger.error('[WhatsApp Campaigns] Error uploading media:', error);
      res.status(500).json({ message: error.message || 'Erro ao fazer upload de mídia' });
    }
  });

  whatsappService.setOptOutHandler(async (phone: string, message: string) => {
    try {
      const campaigns = await storage.getWhatsappCampaigns();
      const activeCampaigns = campaigns.filter(c => c.status === 'running' || c.status === 'paused');
      
      for (const campaign of activeCampaigns) {
        const keyword = (campaign.optOutKeyword || 'SAIR').toUpperCase();
        if (message.includes(keyword)) {
          const existingOptOut = await storage.getWhatsappOptOut(phone);
          if (!existingOptOut) {
            const user = await storage.getUserByPhone(phone);
            await storage.createWhatsappOptOut({
              phone: phone.replace(/\D/g, ''),
              userId: user?.id,
              userName: user?.name,
              keyword: keyword,
              sourceCampaignId: campaign.id,
            });
            
            await storage.incrementCampaignOptOutCount(campaign.id);
            
            logger.info(`[WhatsApp Opt-Out] Phone ${phone} opted out from campaign ${campaign.id} with keyword ${keyword}`);
            
            await whatsappService.sendMessage(phone, '✅ Você foi removido da lista de campanhas. Não receberá mais mensagens promocionais.');
          }
          break;
        }
      }
      
      const allOptOutKeywords = ['SAIR', 'PARAR', 'STOP', 'CANCELAR', 'REMOVER'];
      if (allOptOutKeywords.some(k => message.includes(k))) {
        const existingOptOut = await storage.getWhatsappOptOut(phone);
        if (!existingOptOut) {
          const user = await storage.getUserByPhone(phone);
          await storage.createWhatsappOptOut({
            phone: phone.replace(/\D/g, ''),
            userId: user?.id,
            userName: user?.name,
            keyword: message,
            sourceCampaignId: null,
          });
          
          logger.info(`[WhatsApp Opt-Out] Phone ${phone} opted out with keyword ${message}`);
          
          await whatsappService.sendMessage(phone, '✅ Você foi removido da lista de campanhas. Não receberá mais mensagens promocionais.');
        }
      }
    } catch (error) {
      logger.error('[WhatsApp Opt-Out] Error processing opt-out:', error);
    }
  });

  // Criar servidor HTTP e configurar Socket.IO
  const httpServer = createServer(app);
  // ==================== ADMIN: Disparar evento Meta retroativamente ====================

  // GET /api/meta/test/dispatch-rafael-viemar - APENAS PARA TESTE! Dispara eventos para Rafael e Viemar
  app.get('/api/meta/test/dispatch-rafael-viemar', async (req: any, res) => {
    try {
      logger.info('[Meta Test] 🚀 Iniciando disparo de eventos para Rafael e Viemar...');

      // Rafael
      const rafaelSuccess = await sendFacebookPurchase({
        email: 'iven.digital@gmail.com',
        phone: '85987654321',
        firstName: 'Rafael',
        lastName: 'Iven',
        value: 9990, // em centavos
        currency: 'BRL',
        contentName: 'Lowfy Monthly Subscription',
        contentIds: ['subscription'],
        orderId: '6052a1e5-ae64-4188-ab21-cd198eae7543',
        eventSourceUrl: 'https://lowfy.com/',
        clientIpAddress: '186.216.103.112',
        clientUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        fbc: 'fb.2.1764765660431.89258351179148987',
        fbp: 'fb.2.1764765660431.89258351179148987',
      });

      // Viemar
      const viemarSuccess = await sendFacebookPurchase({
        email: 'laresfilho1@yahoo.com.br',
        phone: '11999999999',
        firstName: 'Viemar',
        lastName: 'Lares',
        value: 36090, // em centavos
        currency: 'BRL',
        contentName: 'Lowfy Yearly Subscription',
        contentIds: ['subscription'],
        orderId: 'ad73f991-e4dd-4d28-95be-94ddeff78857',
        eventSourceUrl: 'https://lowfy.com/',
        clientIpAddress: '186.216.103.112',
        clientUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        fbp: 'fb.2.1764765660431.89258351179148987',
      });

      logger.info(`[Meta Test] ✅ Rafael: ${rafaelSuccess ? 'ENVIADO' : 'FALHOU'}`);
      logger.info(`[Meta Test] ✅ Viemar: ${viemarSuccess ? 'ENVIADO' : 'FALHOU'}`);

      res.json({
        rafael: rafaelSuccess ? '✅ ENVIADO' : '❌ FALHOU',
        viemar: viemarSuccess ? '✅ ENVIADO' : '❌ FALHOU',
      });
    } catch (error: any) {
      logger.error('[Meta Test] ❌ Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/resend-meta-purchase-event - Disparar evento de compra para Meta (retroativo)
  app.post('/api/admin/resend-meta-purchase-event', authMiddleware, adminMiddleware, async (req: any, res) => {
    try {
      const { subscriptionId, orderId } = req.body;

      if (!subscriptionId && !orderId) {
        return res.status(400).json({ message: 'subscriptionId ou orderId é obrigatório' });
      }

      let user;
      let amount;
      let contentName;
      let sourceId;

      // Buscar assinatura Lowfy (suporta guest checkout sem userId)
      let emqData: any = {};
      if (subscriptionId) {
        const subscription = await storage.getLowfySubscription(subscriptionId);
        if (!subscription) {
          return res.status(404).json({ message: 'Assinatura não encontrada' });
        }

        // Extrair dados EMQ do webhookData (capturados durante checkout)
        emqData = (subscription.webhookData as any)?.emq || {};

        // Usar dados do user se existir, senão usar dados do buyer
        if (subscription.userId) {
          const [userData] = await db.select().from(users).where(eq(users.id, subscription.userId)).limit(1);
          if (userData) {
            user = userData;
          }
        }
        
        // Fallback para dados do buyer (guest checkout)
        if (!user) {
          user = {
            id: subscription.userId || 'guest',
            email: subscription.buyerEmail,
            name: subscription.buyerName || 'Cliente',
            phone: subscription.buyerPhone,
          };
        }

        amount = subscription.amount;
        contentName = `Lowfy ${subscription.plan === 'mensal' ? 'Monthly' : 'Yearly'} Subscription`;
        sourceId = subscription.id;
      }

      // Buscar ordem do marketplace
      if (orderId) {
        const [order] = await db.select().from(marketplaceOrders).where(eq(marketplaceOrders.id, orderId)).limit(1);
        if (!order) {
          return res.status(404).json({ message: 'Pedido não encontrado' });
        }

        const [userData] = await db.select().from(users).where(eq(users.id, order.buyerId)).limit(1);
        if (!userData) {
          return res.status(404).json({ message: 'Comprador não encontrado' });
        }

        const [product] = await db.select().from(marketplaceProducts).where(eq(marketplaceProducts.id, order.productId)).limit(1);
        if (!product) {
          return res.status(404).json({ message: 'Produto não encontrado' });
        }

        user = userData;
        amount = order.amount;
        contentName = product.title;
        sourceId = order.orderNumber;
      }

      if (!user) {
        return res.status(404).json({ message: 'Usuário ou dados não encontrados' });
      }

      // Disparar evento para Meta com dados EMQ para aumentar score
      const success = await sendFacebookPurchase({
        email: user.email,
        phone: user.phone || undefined,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' ') || undefined,
        userId: user.id,
        value: amount,
        currency: 'BRL',
        contentName: contentName,
        contentIds: [sourceId],
        orderId: sourceId,
        eventSourceUrl: getAppUrl('/'),
        // 📊 EMQ Parameters - Boost Event Match Quality score
        clientIpAddress: emqData.clientIpAddress || undefined,
        clientUserAgent: emqData.clientUserAgent || undefined,
        fbc: emqData.fbc || undefined,
        fbp: emqData.fbp || undefined,
      });

      if (success) {
        logger.info(`[Admin] ✅ Evento Meta disparado para ${user.email}`, {
          subscriptionId,
          orderId,
          amount,
        });
        res.json({
          success: true,
          message: `Evento Meta disparado com sucesso para ${user.email}`,
          email: user.email,
          amount: amount / 100,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Falha ao disparar evento para Meta - verifique os logs',
        });
      }
    } catch (error: any) {
      logger.error('[Admin] Erro ao disparar evento Meta:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== END OF ROUTES ====================

  const isProduction = process.env.NODE_ENV === 'production';
  const socketAllowedOrigins = process.env.SOCKET_IO_ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: isProduction
        ? (socketAllowedOrigins && socketAllowedOrigins.length > 0 ? socketAllowedOrigins : ['https://lowfy.com.br'])
        : "*",
      methods: ["GET", "POST"]
    }
  });

  // Configurar eventos do Socket.IO
  io.on('connection', (socket) => {
    logger.debug('Cliente conectado ao Socket.IO:', socket.id);

    socket.on('authenticate', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.debug(`✅ Socket ${socket.id} autenticado para usuário ${userId} e adicionado à sala user:${userId}`);
    });

    socket.on('disconnect', () => {
      logger.debug('Cliente desconectado:', socket.id);
    });

    socket.on('join_course', (courseId: number) => {
      socket.join(`course_${courseId}`);
      logger.debug(`Socket ${socket.id} entrou na sala course_${courseId}`);
    });

    socket.on('leave_course', (courseId: number) => {
      socket.leave(`course_${courseId}`);
      logger.debug(`Socket ${socket.id} saiu da sala course_${courseId}`);
    });
  });

  return httpServer;
}