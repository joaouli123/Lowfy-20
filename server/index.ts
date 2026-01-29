import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite";
import { logger } from "./utils/logger";
import { verifySmtpConnection } from "./email";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import fs from "fs";

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

app.set('trust proxy', 1);
app.set('etag', false);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

if (isProduction) {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://connect.facebook.net", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://googleads.g.doubleclick.net", "https://www.googleadservices.com", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://static.cloudflareinsights.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        connectSrc: ["'self'", "https://googleads.g.doubleclick.net", "https://www.googleadservices.com", "https://www.google-analytics.com", "https://www.googletagmanager.com", "https:", "wss:", "ws:"],
        frameSrc: ["'self'", "https://www.youtube.com", "https://player.vimeo.com", "https://www.facebook.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
  }));
  
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
}

app.use(cookieParser());

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

// Middleware para servir vídeos com suporte a Range Requests
app.use('/videos', (req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  next();
});

import { referralTrackingMiddleware } from "./middleware/referral-tracking";
app.use(referralTrackingMiddleware);

// ==================== CUSTOM DOMAIN ROUTING MIDDLEWARE ====================
// Detecta domínios personalizados e serve páginas clonadas/presell correspondentes

// Lista de sufixos de domínios conhecidos do app (bypass rápido)
const KNOWN_APP_DOMAIN_SUFFIXES = [
  'localhost',
  '127.0.0.1',
  '.replit.dev',
  '.replit.app',
  '.repl.co',
  'lowfy.com.br',
  '.lowfy.com.br'
];

// Cache de domínios personalizados para evitar I/O excessivo
// Formato: { [domain]: { type, slug, htmlPath, lastChecked } }
const customDomainCache = new Map<string, { type: 'cloned' | 'presell', slug: string, htmlPath: string, metadataPath: string } | null>();
const CACHE_TTL = 60000; // 1 minuto
let lastCacheRefresh = 0;

function isKnownAppDomain(hostname: string): boolean {
  if (!hostname) return true; // Se não tem hostname, tratar como app
  const h = hostname.toLowerCase();
  return KNOWN_APP_DOMAIN_SUFFIXES.some(suffix => 
    h === suffix.replace(/^\./, '') || h.endsWith(suffix) || h.includes('replit')
  );
}

// Atualiza cache de domínios personalizados
function refreshDomainCache(): void {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL) return;
  
  lastCacheRefresh = now;
  customDomainCache.clear();
  
  // Scan páginas clonadas
  const clonedDir = path.join(process.cwd(), 'cloned-pages');
  if (fs.existsSync(clonedDir)) {
    try {
      const files = fs.readdirSync(clonedDir).filter(f => f.endsWith('.metadata.json'));
      for (const file of files) {
        try {
          const metadataPath = path.join(clonedDir, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.customDomain && metadata.isActive !== false) {
            const domain = metadata.customDomain.replace(/^www\./, '').toLowerCase();
            const slug = file.replace('.metadata.json', '');
            customDomainCache.set(domain, {
              type: 'cloned',
              slug,
              htmlPath: path.join(clonedDir, `${slug}.html`),
              metadataPath
            });
          }
        } catch {}
      }
    } catch {}
  }
  
  // Scan páginas presell
  const presellDir = path.join(process.cwd(), 'presell-pages');
  if (fs.existsSync(presellDir)) {
    try {
      const files = fs.readdirSync(presellDir).filter(f => f.endsWith('.metadata.json'));
      for (const file of files) {
        try {
          const metadataPath = path.join(presellDir, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          if (metadata.customDomain && metadata.isActive !== false) {
            const domain = metadata.customDomain.replace(/^www\./, '').toLowerCase();
            const slug = file.replace('.metadata.json', '');
            customDomainCache.set(domain, {
              type: 'presell',
              slug,
              htmlPath: path.join(presellDir, `${slug}.html`),
              metadataPath
            });
          }
        } catch {}
      }
    } catch {}
  }
  
  logger.debug(`🔄 [CUSTOM DOMAIN] Cache atualizado: ${customDomainCache.size} domínios registrados`);
}

// Busca página por domínio usando cache
function findPageByCustomDomain(hostname: string): { type: 'cloned' | 'presell', slug: string, html: string } | null {
  // Normalizar hostname
  const normalizedHost = hostname.replace(/^www\./, '').split(':')[0].toLowerCase();
  
  // Atualizar cache se necessário
  refreshDomainCache();
  
  // Buscar no cache
  const cached = customDomainCache.get(normalizedHost);
  if (!cached) return null;
  
  // Verificar se arquivo HTML existe e ler
  try {
    if (fs.existsSync(cached.htmlPath)) {
      const html = fs.readFileSync(cached.htmlPath, 'utf-8');
      
      // Incrementar view count assíncronamente (não bloqueia resposta)
      setImmediate(() => {
        try {
          const metadata = JSON.parse(fs.readFileSync(cached.metadataPath, 'utf-8'));
          metadata.viewCount = (metadata.viewCount || 0) + 1;
          fs.writeFileSync(cached.metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        } catch {}
      });
      
      logger.debug(`🌐 [CUSTOM DOMAIN] Servindo página ${cached.type} "${cached.slug}" para ${normalizedHost}`);
      return { type: cached.type, slug: cached.slug, html };
    }
  } catch {}
  
  return null;
}

// Middleware para detectar e servir páginas de domínios personalizados
app.use((req, res, next) => {
  // Apenas processar requisições GET na raiz ou paths específicos
  if (req.method !== 'GET') return next();
  
  // Ignorar rotas de API, assets e outros recursos
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/uploads/') || 
      req.path.startsWith('/assets/') ||
      req.path.startsWith('/_') ||
      req.path.includes('.')) {
    return next();
  }
  
  // Obter hostname (priorizar X-Original-Host de Worker)
  const originalHost = req.headers['x-original-host'] as string || req.headers['x-forwarded-host'] as string;
  const hostname = (originalHost || req.hostname || req.headers.host?.split(':')[0] || '').toLowerCase();
  
  // Fast path: domínios conhecidos do app
  if (!hostname || isKnownAppDomain(hostname)) {
    return next();
  }
  
  // Tentar servir página de domínio customizado
  try {
    const page = findPageByCustomDomain(hostname);
    
    if (page) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Served-By', 'Lowfy-Custom-Domain');
      res.setHeader('X-Page-Type', page.type);
      res.setHeader('X-Page-Slug', page.slug);
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
      return res.send(page.html);
    }
    
    // Domínio não encontrado - continuar para rotas normais
    return next();
  } catch (error) {
    logger.error(`❌ [CUSTOM DOMAIN] Erro ao processar ${hostname}:`, error);
    return next();
  }
});

// Middleware para servir arquivos .blob com tipo MIME correto baseado no conteúdo
app.use('/uploads', (req, res, next) => {
  if (req.path.endsWith('.blob')) {
    // Sanitize path to prevent path traversal attacks
    const sanitizedPath = path.normalize(req.path).replace(/^(\.\.(\/|\\|$))+/, '');
    if (sanitizedPath.includes('..') || sanitizedPath.startsWith('/')) {
      return res.status(400).send('Invalid path');
    }
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadsDir, sanitizedPath);
    
    // Ensure file is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(400).send('Invalid path');
    }
    
    if (fs.existsSync(filePath)) {
      try {
        // Detectar tipo MIME pelos primeiros bytes (magic bytes)
        const buffer = Buffer.alloc(8);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        
        let mimeType = 'application/octet-stream';
        
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          mimeType = 'image/png';
        }
        // JPEG: FF D8 FF
        else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          mimeType = 'image/jpeg';
        }
        // GIF: 47 49 46 38
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
          mimeType = 'image/gif';
        }
        // WebP: 52 49 46 46 ... 57 45 42 50
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
          mimeType = 'image/webp';
        }
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(filePath);
      } catch (err) {
        // Fall through to static middleware
      }
    }
  }
  next();
});

// Servir arquivos estáticos da pasta public (uploads de imagens, etc)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Servir arquivos do diretório attached_assets
app.use('/api/assets', express.static(path.join(process.cwd(), 'attached_assets')));

// Servir arquivos estáticos da raiz public (logos, etc)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

if (!isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });
}

(async () => {
  const server = await registerRoutes(app);

  // Verificar SMTP no startup
  const smtpOk = await verifySmtpConnection();
  if (!smtpOk) {
    logger.warn('⚠️ [STARTUP] SMTP não está funcionando - emails não serão enviados!');
  }

  async function migrateLegacyCPFs() {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      await db.execute(sql`
        UPDATE users 
        SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
        WHERE cpf IS NOT NULL 
        AND cpf ~ '[^0-9]'
      `);
      
      logger.info('CPF migration completed');
    } catch (error) {
      logger.error('CPF migration error:', error);
    }
  }
  
  // Executar migração de CPFs no startup
  await migrateLegacyCPFs();
  
  // Inicializar sequence de order numbers
  const { initializeOrderNumberSequence } = await import('./utils/order-utils.js');
  await initializeOrderNumberSequence();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error('Unhandled error:', { status, message, stack: err.stack });
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // PRODUCTION: Serve compiled frontend from dist/public
    const distPublicPath = path.join(process.cwd(), 'dist', 'public');
    
    logger.info(`[Production] Serving frontend from: ${distPublicPath}`);
    
    if (!fs.existsSync(distPublicPath)) {
      logger.error(`Build directory not found: ${distPublicPath}. Run "npm run build" first.`);
      throw new Error(`Build directory not found: ${distPublicPath}`);
    }
    
    // Serve static assets with caching
    app.use(express.static(distPublicPath, {
      maxAge: '1d',
      etag: true,
      index: false
    }));
    
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket')) {
        return res.status(404).json({ message: 'Not found' });
      }
      res.sendFile(path.join(distPublicPath, 'index.html'));
    });
    
    logger.info('[Production] Static file serving configured successfully');
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    import('./sync-scheduler').then(({ startWeeklySync }) => {
      startWeeklySync();
    }).catch(error => {
      logger.error('Sync scheduler error:', error);
    });
    
    import('./gamification-scheduler').then(async ({ startGamificationSchedulers }) => {
      await startGamificationSchedulers();
    }).catch(error => {
      logger.error('Gamification scheduler error:', error);
    });
    
    import('./balance-scheduler').then(({ startBalanceReleaseScheduler }) => {
      startBalanceReleaseScheduler();
    }).catch(error => {
      logger.error('Balance scheduler error:', error);
    });
    
    import('./subscription-scheduler').then(({ startSubscriptionScheduler }) => {
      startSubscriptionScheduler();
    }).catch(error => {
      logger.error('Subscription scheduler error:', error);
    });
    
    import('./cron/subscriptionPageManager').then(async ({ initSubscriptionPageManager, runInitialSubscriptionSync }) => {
      initSubscriptionPageManager();
      // Executar sincronização inicial após 10 segundos (dar tempo do servidor estabilizar)
      setTimeout(async () => {
        await runInitialSubscriptionSync();
      }, 10000);
    }).catch(error => {
      logger.error('Page manager error:', error);
    });
    
    import('./checkout-recovery-scheduler').then(({ startCheckoutRecoveryScheduler }) => {
      startCheckoutRecoveryScheduler();
    }).catch(error => {
      logger.error('Checkout recovery scheduler error:', error);
    });
    
    import('./checkout-recovery-whatsapp-scheduler').then(({ startWhatsAppRecoveryScheduler }) => {
      startWhatsAppRecoveryScheduler();
    }).catch(error => {
      logger.error('WhatsApp recovery scheduler error:', error);
    });
  });
})();
