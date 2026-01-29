import { customAlphabet } from 'nanoid';
import { logger } from './utils/logger';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

/**
 * Gera um slug único para uma página clonada
 * Formato: usrabc123-nome-da-pagina-xyz456de
 * Inclui identificador do usuário para isolamento entre usuários
 */
export function generateUniqueSlug(pageName: string, userId?: string): string {
  // Sanitizar nome da página
  const sanitized = pageName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Gerar código único de usuário se não fornecido
  const userCode = userId ? userId.substring(0, 10).toLowerCase() : generateUserCode();
  
  // Adicionar código único da página
  const uniqueCode = nanoid();
  
  // Formato: usercode-pagename-uniquecode
  return `${userCode}-${sanitized}-${uniqueCode}`;
}

/**
 * Gera um código de usuário único
 * Formato: usr8char (ex: usra1b2c3d4)
 */
export function generateUserCode(): string {
  return `usr${nanoid()}`;
}

/**
 * Remove scripts perigosos do HTML
 */
export function sanitizeHtml(html: string): string {
  // Remove scripts inline
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers inline
  sanitized = sanitized.replace(/\son\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/\son\w+='[^']*'/gi, '');
  
  // Remove elementos SVG vazios ou corrompidos que causam overlay visual
  sanitized = sanitized.replace(/<svg[^>]*><\/svg>/gi, '');
  
  // Remove divs absolutas sem conteúdo (comum em loaders/overlays)
  sanitized = sanitized.replace(/<div[^>]*position:\s*absolute[^>]*><\/div>/gi, '');
  
  return sanitized;
}

/**
 * Remove pixels e scripts de rastreamento antigos do HTML
 * Remove scripts externos E inline de tracking de forma mais eficaz
 * PRESERVA scripts do usuário marcados com comentários <!-- START: Tracking Code -->
 */
export function removeOldTrackingScripts(html: string): string {
  let cleanedHtml = html;
  let scriptsRemoved = 0;
  
  logger.debug('[RemoveTracking] 🔍 Iniciando remoção de pixels antigos...');
  logger.debug('[RemoveTracking] 📄 Tamanho do HTML original:', html.length);
  
  // PASSO 1: Extrair e preservar blocos de tracking do usuário (marcados com comentários)
  const userTrackingBlocks: { placeholder: string; content: string }[] = [];
  const trackingBlockRegex = /<!--\s*START:\s*Tracking Code[^>]*-->[\s\S]*?<!--\s*END:\s*Tracking Code[^>]*-->/gi;
  
  cleanedHtml = cleanedHtml.replace(trackingBlockRegex, (match) => {
    const placeholder = `__USER_TRACKING_BLOCK_${userTrackingBlocks.length}__`;
    userTrackingBlocks.push({ placeholder, content: match });
    logger.debug(`[RemoveTracking] 🔒 Preservando bloco de tracking do usuário: ${match.substring(0, 80)}...`);
    return placeholder;
  });
  
  // Também preservar GTM noscript do usuário
  const gtmNoscriptRegex = /<!--\s*Google Tag Manager \(noscript\)[^>]*-->[\s\S]*?<!--\s*End Google Tag Manager \(noscript\)[^>]*-->/gi;
  cleanedHtml = cleanedHtml.replace(gtmNoscriptRegex, (match) => {
    const placeholder = `__USER_TRACKING_BLOCK_${userTrackingBlocks.length}__`;
    userTrackingBlocks.push({ placeholder, content: match });
    logger.debug(`[RemoveTracking] 🔒 Preservando GTM noscript do usuário`);
    return placeholder;
  });
  
  // Lista EXPANDIDA de padrões de rastreamento a remover
  const trackingPatterns = [
    // Facebook Pixel (PRIORIDADE MÁXIMA - remover tudo relacionado)
    'fbq', 'facebook.com/tr', 'Meta Pixel', '_fbq', 'fbevents', 'connect.facebook.net',
    'facebook-jssdk', 'fb-root', 'fb.', 'facebook.net', 
    '585567379246219', '1040581861230888', // IDs específicos de pixels do Facebook
    
    // Google Tag Manager
    'googletagmanager.com', 'GTM-', "dataLayer.push({'gtm.start'", 'dataLayer.push',
    
    // Google Analytics
    'google-analytics.com', 'gtag(', 'ga(', 'analytics.js', 'ga.js',
    'googletagservices', '_gaq', '_ga', 'ga.create',
    
    // TikTok
    'analytics.tiktok.com', 'ttq(', 'tiktok-pixel',
    
    // Pinterest
    'pintrk', 'ct.pinterest.com', 'pinterest.com/ct',
    
    // LinkedIn
    'snap.licdn.com', 'linkedin.com/px',
    
    // Hotjar
    'static.hotjar.com', 'hjid', 'hjsv', 'hj(',
    
    // Microsoft Clarity
    'clarity.ms', 'clarity(', 'microsoft.clarity',
    
    // Twitter/X
    'static.ads-twitter.com', 'twq(', 'twitter.com/i/adsct',
    
    // Snapchat
    'sc-static.net', 'snaptr(', 'snap.licdn.com',
    
    // Outros trackers comuns
    'adroll.com', 'doubleclick.net', 'criteo.com', 'outbrain.com',
    'taboola.com', 'quantserve.com', 'scorecardresearch.com',
    
    // Plugins WordPress de tracking
    'pixelyoursite', 'pys-', 'pysOptions', 'PixelYourSite'
  ];
  
  // Lista de CDNs e frameworks ESSENCIAIS (apenas em src) que NÃO devem ser removidos
  const essentialSrcPatterns = [
    'jquery', 'bootstrap', 'react', 'vue', 'angular', 'lodash', 'moment.js',
    'axios', 'tailwind', 'fontawesome', 'cdn.jsdelivr.net', 'unpkg.com',
    'cdnjs.cloudflare.com', 'code.jquery.com', 'maxcdn.bootstrapcdn.com',
    'stackpath.bootstrapcdn.com', 'ajax.googleapis.com/ajax/libs',
    'polyfill.io', 'webpack', 'vite'
  ];
  
  // Remover scripts de tracking (verificar src para proteger frameworks)
  cleanedHtml = cleanedHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptTag) => {
    // Extrair atributo src se existir
    const srcMatch = scriptTag.match(/src\s*=\s*["']([^"']+)["']/i);
    const scriptSrc = srcMatch ? srcMatch[1].toLowerCase() : '';
    
    // Verificar se o SRC é de um framework/biblioteca essencial
    if (scriptSrc) {
      const isEssentialSrc = essentialSrcPatterns.some(pattern => 
        scriptSrc.includes(pattern.toLowerCase())
      );
      
      if (isEssentialSrc) {
        logger.debug(`[RemoveTracking] ✅ Preservando script essencial: ${scriptSrc.substring(0, 80)}...`);
        return scriptTag; // Preservar frameworks e bibliotecas
      }
    }
    
    // Verificar se é um script de tracking (inline OU externo)
    const scriptContent = scriptTag.toLowerCase();
    const shouldRemove = trackingPatterns.some(pattern => 
      scriptContent.includes(pattern.toLowerCase())
    );
    
    if (shouldRemove) {
      scriptsRemoved++;
      const preview = scriptTag.substring(0, 150).replace(/\n/g, ' ');
      logger.debug(`[RemoveTracking] 🗑️ Removendo script: ${preview}...`);
      return ''; // Remove completamente
    }
    
    return scriptTag;
  });
  
  // Remover noscript tags de tracking
  let noscriptsRemoved = 0;
  cleanedHtml = cleanedHtml.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, (noscriptTag) => {
    const shouldRemove = trackingPatterns.some(pattern => 
      noscriptTag.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldRemove) {
      noscriptsRemoved++;
      logger.debug(`[RemoveTracking] 🗑️ Removendo noscript: ${noscriptTag.substring(0, 100)}...`);
      return ''; // Remove completamente
    }
    
    return noscriptTag;
  });
  
  logger.debug(`[RemoveTracking] ✅ ${scriptsRemoved} scripts de rastreamento removidos`);
  logger.debug(`[RemoveTracking] ✅ ${noscriptsRemoved} noscripts de rastreamento removidos`);
  
  // PASSO FINAL: Restaurar blocos de tracking do usuário
  for (const block of userTrackingBlocks) {
    cleanedHtml = cleanedHtml.replace(block.placeholder, block.content);
  }
  
  if (userTrackingBlocks.length > 0) {
    logger.debug(`[RemoveTracking] 🔓 ${userTrackingBlocks.length} blocos de tracking do usuário restaurados`);
  }
  
  logger.debug('[RemoveTracking] 📄 Tamanho do HTML após limpeza:', cleanedHtml.length);
  
  return cleanedHtml;
}

/**
 * Desativa scripts não essenciais (chatbots, widgets, etc)
 * Remove scripts de terceiros que não são de rastreamento
 * PRESERVA scripts do usuário marcados com comentários <!-- START: Tracking Code -->
 */
export function deactivateNonEssentialScripts(html: string): string {
  let processedHtml = html;
  let scriptsDeactivated = 0;
  
  logger.debug('[DeactivateScripts] 🔍 Iniciando desativação de scripts não essenciais...');
  logger.debug('[DeactivateScripts] 📄 Tamanho do HTML original:', html.length);
  
  // PASSO 1: Extrair e preservar blocos de tracking do usuário (marcados com comentários)
  const userTrackingBlocks: { placeholder: string; content: string }[] = [];
  const trackingBlockRegex = /<!--\s*START:\s*Tracking Code[^>]*-->[\s\S]*?<!--\s*END:\s*Tracking Code[^>]*-->/gi;
  
  processedHtml = processedHtml.replace(trackingBlockRegex, (match) => {
    const placeholder = `__USER_TRACKING_BLOCK_${userTrackingBlocks.length}__`;
    userTrackingBlocks.push({ placeholder, content: match });
    logger.debug(`[DeactivateScripts] 🔒 Preservando bloco de tracking do usuário`);
    return placeholder;
  });
  
  // Também preservar GTM noscript do usuário
  const gtmNoscriptRegex = /<!--\s*Google Tag Manager \(noscript\)[^>]*-->[\s\S]*?<!--\s*End Google Tag Manager \(noscript\)[^>]*-->/gi;
  processedHtml = processedHtml.replace(gtmNoscriptRegex, (match) => {
    const placeholder = `__USER_TRACKING_BLOCK_${userTrackingBlocks.length}__`;
    userTrackingBlocks.push({ placeholder, content: match });
    logger.debug(`[DeactivateScripts] 🔒 Preservando GTM noscript do usuário`);
    return placeholder;
  });
  
  // Lista EXPANDIDA de domínios/serviços a desativar
  const nonEssentialDomains = [
    // Chatbots
    'tawk.to', 'drift.com', 'intercom.com', 'crisp.chat', 'zendesk.com', 
    'livechat', 'olark', 'tidio.com', 'userlike.com', 'liveperson.com',
    'freshchat', 'helpscout', 'chatwoot', 'gorgias.com',
    
    // Pop-ups e widgets
    'optimizely', 'optimonk', 'sumo', 'hello-bar', 'popupsmart',
    'privy.com', 'justuno.com', 'wheelio.com', 'wisepops', 'optinmonster',
    
    // Scripts de comentários
    'disqus.com', 'facebook.com/plugins', 'intensedebate.com',
    
    // Analytics de terceiros (não essenciais)
    'mouseflow.com', 'fullstory.com', 'logrocket.com', 'smartlook.com',
    'inspectlet.com', 'sessioncam.com', 'clicktale.com',
    
    // A/B Testing
    'vwo.com', 'convert.com', 'kameleoon.com', 'ab-tasty.com',
    
    // Outros widgets
    'addthis.com', 'sharethis.com', 'addtoany.com'
  ];
  
  // Lista de CDNs e frameworks ESSENCIAIS (apenas em src) que NÃO devem ser desativados
  const essentialSrcPatterns = [
    'jquery', 'bootstrap', 'react', 'vue', 'angular', 'lodash', 'moment.js',
    'axios', 'tailwind', 'fontawesome', 'cdn.jsdelivr.net', 'unpkg.com',
    'cdnjs.cloudflare.com', 'code.jquery.com', 'maxcdn.bootstrapcdn.com',
    'stackpath.bootstrapcdn.com', 'ajax.googleapis.com/ajax/libs',
    'polyfill.io', 'webpack', 'vite'
  ];
  
  // Processar cada script tag individualmente
  processedHtml = processedHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptTag) => {
    // Extrair atributo src se existir
    const srcMatch = scriptTag.match(/src\s*=\s*["']([^"']+)["']/i);
    const scriptSrc = srcMatch ? srcMatch[1].toLowerCase() : '';
    
    // Verificar se o SRC é de um framework/biblioteca essencial
    if (scriptSrc) {
      const isEssentialSrc = essentialSrcPatterns.some(pattern => 
        scriptSrc.includes(pattern.toLowerCase())
      );
      
      if (isEssentialSrc) {
        logger.debug(`[DeactivateScripts] ✅ Preservando script essencial: ${scriptSrc.substring(0, 80)}...`);
        return scriptTag; // Preservar frameworks e bibliotecas
      }
    }
    
    // Verificar se o script contém algum domínio não essencial
    const shouldDeactivate = nonEssentialDomains.some(domain => 
      scriptTag.toLowerCase().includes(domain.toLowerCase())
    );
    
    if (shouldDeactivate) {
      scriptsDeactivated++;
      logger.debug(`[DeactivateScripts] 🚫 Desativando script: ${scriptTag.substring(0, 100)}...`);
      return ''; // Remove completamente
    }
    
    return scriptTag;
  });
  
  logger.debug(`[DeactivateScripts] ✅ ${scriptsDeactivated} scripts não essenciais foram desativados`);
  
  // PASSO FINAL: Restaurar blocos de tracking do usuário
  for (const block of userTrackingBlocks) {
    processedHtml = processedHtml.replace(block.placeholder, block.content);
  }
  
  if (userTrackingBlocks.length > 0) {
    logger.debug(`[DeactivateScripts] 🔓 ${userTrackingBlocks.length} blocos de tracking do usuário restaurados`);
  }
  
  logger.debug('[DeactivateScripts] 📄 Tamanho do HTML após desativação:', processedHtml.length);
  
  return processedHtml;
}

/**
 * Injeta código de modal no HTML
 */
export function injectModalCode(html: string, modalConfig: any): string {
  if (!modalConfig || !modalConfig.enabled) return html;
  
  const modalHtml = `
  <div id="custom-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 99999; justify-content: center; align-items: center;">
    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; position: relative;">
      <button onclick="document.getElementById('custom-modal-overlay').style.display='none'" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      <h2 style="margin-top: 0;">${modalConfig.title || 'Atenção!'}</h2>
      <p>${modalConfig.content || ''}</p>
      ${modalConfig.buttonText ? `<button onclick="document.getElementById('custom-modal-overlay').style.display='none'" style="background: #0079F2; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 16px;">${modalConfig.buttonText}</button>` : ''}
    </div>
  </div>
  <script>
    setTimeout(() => {
      document.getElementById('custom-modal-overlay').style.display = 'flex';
    }, ${modalConfig.delay || 3000});
  </script>
  `;
  
  // Injeta antes do </body>
  if (html.includes('</body>')) {
    return html.replace('</body>', `${modalHtml}\n</body>`);
  }
  
  return html + '\n' + modalHtml;
}

/**
 * Interface para tracking codes
 */
interface TrackingCodes {
  head?: string | null;
  body?: string | null;
  footer?: string | null;
}

/**
 * Método fallback para processar HTML quando OpenAI não está disponível
 */
function useFallbackMethod(
  html: string,
  trackingCodes: TrackingCodes,
  removeOldPixels: boolean,
  deactivateOtherScripts: boolean
): string {
  logger.debug('[AI-Injection-Fallback] 🔧 Usando método fallback (regex + injeção manual)');
  let processedHtml = html;
  
  logger.debug('[AI-Injection-Fallback] 🔍 HTML original - Tamanho:', html.length);
  
  // VALIDAÇÃO: Verificar se o HTML não está vazio ou corrompido
  if (!html || html.trim().length === 0) {
    logger.error('[AI-Injection-Fallback] ❌ ERRO: HTML vazio ou inválido!');
    return html;
  }
  
  // Verificar se tem estrutura HTML básica
  if (!html.includes('<html') && !html.includes('<head') && !html.includes('<body')) {
    logger.error('[AI-Injection-Fallback] ⚠️ AVISO: HTML sem estrutura básica!');
    return html;
  }
  
  // PASSO 1: Remover pixels antigos se configurado
  if (removeOldPixels) {
    logger.debug('[AI-Injection-Fallback] 🗑️ Removendo pixels antigos...');
    processedHtml = removeOldTrackingScripts(processedHtml);
  }
  
  // PASSO 2: Desativar scripts não essenciais se configurado
  if (deactivateOtherScripts) {
    logger.debug('[AI-Injection-Fallback] 🚫 Desativando scripts não essenciais...');
    processedHtml = deactivateNonEssentialScripts(processedHtml);
  }
  
  // VALIDAÇÃO PÓS-PROCESSAMENTO: Verificar se o HTML não ficou vazio
  if (!processedHtml || processedHtml.trim().length === 0) {
    logger.error('[AI-Injection-Fallback] ❌ ERRO: HTML ficou vazio após processamento! Retornando original.');
    return html;
  }
  
  // DEBUG: Verificar se tags existem
  logger.debug('[AI-Injection-Fallback] 🔍 Debug - HTML tem </head>?', processedHtml.includes('</head>'));
  logger.debug('[AI-Injection-Fallback] 🔍 Debug - HTML tem <body?', processedHtml.includes('<body'));
  logger.debug('[AI-Injection-Fallback] 🔍 Debug - Tamanho do HTML:', processedHtml.length);
  
  // PASSO 3: Injetar novos códigos de tracking
  // Verificar se GTM foi detectado no HEAD para evitar duplicação no BODY
  let gtmDetectedInHead = false;
  
  // Injetar código HEAD antes do </head> (case insensitive)
  if (trackingCodes.head && trackingCodes.head.trim() !== '') {
    const headRegex = /<\/head>/i;
    const headMatch = processedHtml.match(headRegex);
    logger.debug('[AI-Injection-Fallback] 🔍 HeadMatch encontrado?', !!headMatch);
    if (headMatch) {
      const headIndex = processedHtml.indexOf(headMatch[0]);
      processedHtml = processedHtml.substring(0, headIndex) + 
        '\n<!-- START: Tracking Code (HEAD) -->\n' + 
        trackingCodes.head + 
        '\n<!-- END: Tracking Code (HEAD) -->\n' + 
        processedHtml.substring(headIndex);
      logger.debug('[AI-Injection-Fallback] ✅ Código HEAD injetado');

      // Auto-detectar GTM e adicionar noscript no body
      const gtmMatch = trackingCodes.head.match(/GTM-[A-Z0-9]+/);
      if (gtmMatch && gtmMatch[0]) {
        gtmDetectedInHead = true;
        const gtmId = gtmMatch[0];
        logger.debug(`[AI-Injection-Fallback] 🎯 GTM ID detectado: ${gtmId}`);

        // Criar o noscript correto
        const noscriptGTM = `\n<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n<!-- End Google Tag Manager (noscript) -->`;

        // Encontrar tag de abertura do body
        const bodyRegex = /<body[^>]*>/i;
        const bodyMatch = processedHtml.match(bodyRegex);
        if (bodyMatch) {
          const bodyIndex = processedHtml.indexOf(bodyMatch[0]) + bodyMatch[0].length;
          processedHtml = processedHtml.substring(0, bodyIndex) + noscriptGTM + processedHtml.substring(bodyIndex);
          logger.debug(`[AI-Injection-Fallback] ✅ GTM noscript injetado automaticamente logo após <body> para ${gtmId}`);
        } else {
          logger.debug(`[AI-Injection-Fallback] ⚠️ Tag <body> não encontrada para injetar GTM noscript`);
        }
      }
    } else {
      logger.debug('[AI-Injection-Fallback] ⚠️ Tag </head> não encontrada');
    }
  }

  // Injetar código BODY logo após <body> (SE NÃO FOR GTM já injetado automaticamente)
  if (trackingCodes.body && trackingCodes.body.trim() !== '') {
    // Verificar se o código BODY é um noscript GTM que já foi injetado
    const isGTMNoscript = trackingCodes.body.includes('googletagmanager.com/ns.html');
    
    if (!gtmDetectedInHead || !isGTMNoscript) {
      const bodyMatch = processedHtml.match(/<body[^>]*>/i);
      if (bodyMatch) {
        const bodyIndex = processedHtml.indexOf(bodyMatch[0]) + bodyMatch[0].length;
        processedHtml = processedHtml.substring(0, bodyIndex) + 
          '\n<!-- START: Tracking Code (BODY) -->\n' + 
          trackingCodes.body + 
          '\n<!-- END: Tracking Code (BODY) -->\n' + 
          processedHtml.substring(bodyIndex);
        logger.debug('[AI-Injection-Fallback] ✅ Código BODY injetado');
      } else {
        logger.debug('[AI-Injection-Fallback] ⚠️ Tag <body> não encontrada');
      }
    } else {
      logger.debug('[AI-Injection-Fallback] ⏭️ Código BODY (GTM noscript) pulado - já foi injetado automaticamente');
    }
  }

  // Injetar código FOOTER antes do </body>
  if (trackingCodes.footer && trackingCodes.footer.trim() !== '') {
    const bodyCloseIndex = processedHtml.toLowerCase().indexOf('</body>');
    if (bodyCloseIndex !== -1) {
      processedHtml = processedHtml.substring(0, bodyCloseIndex) + 
        '\n<!-- START: Tracking Code (FOOTER) -->\n' + 
        trackingCodes.footer + 
        '\n<!-- END: Tracking Code (FOOTER) -->\n' + 
        processedHtml.substring(bodyCloseIndex);
      logger.debug('[AI-Injection-Fallback] ✅ Código FOOTER injetado');
    } else {
      logger.debug('[AI-Injection-Fallback] ⚠️ Tag </body> não encontrada');
    }
  }
  
  // VALIDAÇÃO FINAL: Verificar novamente se o HTML não ficou vazio
  if (!processedHtml || processedHtml.trim().length === 0) {
    logger.error('[AI-Injection-Fallback] ❌ ERRO FINAL: HTML ficou vazio! Retornando original.');
    return html;
  }
  
  logger.debug('[AI-Injection-Fallback] ✅ PROCESSAMENTO FALLBACK CONCLUÍDO COM SUCESSO');
  logger.debug('[AI-Injection-Fallback] 📄 Tamanho do HTML final:', processedHtml.length);
  logger.debug('='.repeat(80));
  
  return processedHtml;
}

/**
 * Usa OpenAI para analisar e modificar HTML de forma inteligente
 * Remove scripts de rastreamento/monitoramento existentes e injeta novos códigos
 */
export async function intelligentScriptInjection(
  html: string,
  trackingCodes: TrackingCodes,
  removeOldPixels: boolean,
  deactivateOtherScripts: boolean
): Promise<string> {
  logger.debug('='.repeat(80));
  logger.debug('[AI-Injection] 🚀 INICIANDO PROCESSAMENTO DE SCRIPTS');
  logger.debug('[AI-Injection] 📄 Tamanho do HTML de entrada:', html.length);
  logger.debug('[AI-Injection] 🎯 Configurações:');
  logger.debug('[AI-Injection]    - Remove Old Pixels:', removeOldPixels);
  logger.debug('[AI-Injection]    - Deactivate Scripts:', deactivateOtherScripts);
  logger.debug('[AI-Injection]    - Tem código HEAD?', !!(trackingCodes.head && trackingCodes.head.trim()));
  logger.debug('[AI-Injection]    - Tem código BODY?', !!(trackingCodes.body && trackingCodes.body.trim()));
  logger.debug('[AI-Injection]    - Tem código FOOTER?', !!(trackingCodes.footer && trackingCodes.footer.trim()));
  logger.debug('='.repeat(80));
  
  // VALIDAÇÃO CRÍTICA: Verificar se HTML não está vazio
  if (!html || html.trim().length === 0) {
    logger.error('[AI-Injection] ❌ ERRO CRÍTICO: HTML vazio recebido!');
    return html;
  }
  
  // FORÇAR uso do método fallback (rápido e confiável)
  // OpenAI está muito lento (>20s) e causando timeouts
  logger.debug('[AI-Injection] ⚡ Usando método fallback direto (rápido e eficiente)');
  return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
  
  // Código OpenAI desabilitado temporariamente por questões de performance
  /*
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('[AI-Injection] ⚠️ OPENAI_API_KEY não configurada, usando método fallback');
    return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
  }
  */

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  logger.debug('[AI-Injection] 🤖 Iniciando análise inteligente (ULTRA otimizada) do HTML com OpenAI...');

  // ULTRA OTIMIZAÇÃO: Extrair APENAS scripts/noscripts relevantes
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyOpenMatch = html.match(/(<body[^>]*>)([\s\S]{0,1500})/i); // Reduzido para 1500
  const bodyCloseMatch = html.match(/([\s\S]{0,1500})(<\/body>)/i); // Reduzido para 1500

  if (!headMatch) {
    logger.warn('[AI-Injection] ⚠️ Tag <head> não encontrada, usando fallback');
    return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
  }

  // Extrair APENAS scripts e noscripts do HEAD
  const fullHead = headMatch[1];
  const headScripts = fullHead.match(/<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/gi) || [];
  
  // Limitar a 10 primeiros scripts para evitar enviar muito conteúdo
  const limitedHeadScripts = headScripts.slice(0, 10);
  const headContent = '<head>\n' + limitedHeadScripts.join('\n') + '\n</head>';
  
  const bodyStart = bodyOpenMatch ? bodyOpenMatch[0] : '';
  const bodyEnd = bodyCloseMatch ? bodyCloseMatch[0] : '';

  const totalSize = headContent.length + bodyStart.length + bodyEnd.length;
  
  logger.debug('[AI-Injection] 📊 Extraído (ULTRA OTIMIZADO):', {
    headScriptsTotal: headScripts.length,
    headScriptsUsed: limitedHeadScripts.length,
    headSize: headContent.length,
    bodyStartSize: bodyStart.length,
    bodyEndSize: bodyEnd.length,
    total: totalSize
  });

  // Se ainda estiver muito grande, usar fallback direto
  if (totalSize > 30000) {
    logger.warn('[AI-Injection] ⚠️ Conteúdo muito grande (>30KB), usando fallback direto');
    return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
  }

  // Preparar prompt para OpenAI
  let prompt = `Você é um especialista em análise e modificação de HTML. Sua tarefa é processar APENAS as seções fornecidas do HTML (head completo, início do body e final do body/footer) seguindo estas instruções COM PRECISÃO:

## INSTRUÇÕES CRÍTICAS:

`;

  if (removeOldPixels) {
    prompt += `### 1. REMOVER SCRIPTS DE RASTREAMENTO ANTIGOS (TOTAL):
**ATENÇÃO**: Você DEVE remover COMPLETAMENTE todos os scripts de rastreamento existentes:

- **Facebook Pixel**: Remova TUDO relacionado a fbq, facebook.com/tr, Meta Pixel, connect.facebook.net
  - Exemplo: Scripts com fbq('init', '585567379246219') ou similares
  - Remova também <noscript> do Facebook Pixel

- **Google Tag Manager**: Remova TUDO relacionado a GTM-*, googletagmanager.com, dataLayer
  - Exemplo: Scripts com GTM-PSSS2DP3 ou similares
  - Remova também <noscript> do GTM

- **Google Analytics**: Remova gtag.js, analytics.js, ga.js, ga('create'), _ga

- **Outros Pixels**: TikTok (ttq), Pinterest (pintrk), LinkedIn (snap.licdn.com), Hotjar, Clarity, etc.

**IMPORTANTE**: Se encontrar pixels/scripts antigos, você DEVE removê-los TOTALMENTE. Não deixe vestígios.

`;
  }

  if (deactivateOtherScripts) {
    prompt += `### 2. DESATIVAR SCRIPTS NÃO ESSENCIAIS:
- Identifique e COMENTE (<!-- -->) scripts de terceiros não essenciais como:
  - Chatbots (Tawk.to, Drift, Intercom, Crisp, Zendesk, LiveChat, Olark)
  - Pop-ups e widgets (Optimizely, OptiMonk, Sumo, Hello Bar)
  - Scripts de comentários (Disqus, Facebook plugins)
  - Outros scripts que não sejam essenciais para o funcionamento da página

`;
  }

  // Adicionar instruções para inserção de novos códigos
  const hasNewCodes = trackingCodes.head || trackingCodes.body || trackingCodes.footer;
  
  if (hasNewCodes) {
    prompt += `### 3. INSERIR NOVOS CÓDIGOS DE RASTREAMENTO:

`;
    
    if (trackingCodes.head) {
      prompt += `**Inserir no <head> (antes de </head>):**
\`\`\`
${trackingCodes.head}
\`\`\`

`;
    }

    if (trackingCodes.body) {
      prompt += `**Inserir no início do <body> (logo após <body>):**
\`\`\`
${trackingCodes.body}
\`\`\`

`;
    }

    if (trackingCodes.footer) {
      prompt += `**Inserir no footer (antes de </body>):**
\`\`\`
${trackingCodes.footer}
\`\`\`

`;
    }

    // Verificar se há GTM para adicionar noscript
    const hasGTM = trackingCodes.head?.includes('GTM-') || trackingCodes.head?.includes('googletagmanager.com');
    if (hasGTM) {
      const gtmMatch = trackingCodes.head?.match(/GTM-[A-Z0-9]+/);
      if (gtmMatch) {
        prompt += `**IMPORTANTE - GTM NOSCRIPT:** 
Você detectou um Google Tag Manager com ID ${gtmMatch[0]}. 
Além do script no <head>, você DEVE inserir o seguinte código <noscript> logo após a tag de abertura <body>:

\`\`\`html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmMatch[0]}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
\`\`\`

`;
      }
    }
  }

  prompt += `
## REGRAS IMPORTANTES:
1. Retorne APENAS as 3 seções modificadas no formato JSON:
   {"head": "...", "bodyStart": "...", "bodyEnd": "..."}
2. Preserve toda a estrutura e formatação do HTML original
3. Não adicione comentários explicativos além dos comentários que cercam os códigos inseridos
4. Garanta que todos os novos códigos sejam inseridos nas posições corretas
5. Se um script GTM foi inserido no <head>, certifique-se de que o <noscript> correspondente está no <bodyStart>

SEÇÕES HTML A SEREM PROCESSADAS:

### SEÇÃO 1 - HEAD:
${headContent}

### SEÇÃO 2 - INÍCIO DO BODY:
${bodyStart}

### SEÇÃO 3 - FINAL DO BODY (FOOTER):
${bodyEnd}
`;

  try {
    logger.debug('[AI-Injection] 📤 Enviando para OpenAI (timeout: 20s)');
    
    // Timeout agressivo de 20 segundos - SEM RETRY
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em HTML. Retorna JSON: {"head": "...", "bodyStart": "...", "bodyEnd": "..."}. Seja RÁPIDO.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 4000, // Limitar resposta
    }, {
      timeout: 20000, // 20 segundos - AGRESSIVO
    });

    const result = JSON.parse(response!.choices[0].message.content?.trim() || '{}');
    
    logger.debug('[AI-Injection] ✅ Resposta recebida da IA');
    logger.debug('[AI-Injection] 📊 Tokens usados:', response!.usage?.total_tokens);

    // Reconstruir o HTML completo com as partes modificadas
    let modifiedHtml = html;

    // Substituir HEAD
    if (result.head) {
      modifiedHtml = modifiedHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/i, result.head);
      logger.debug('[AI-Injection] ✅ HEAD substituído');
    }

    // Substituir início do BODY
    if (result.bodyStart && bodyOpenMatch) {
      const originalBodyStart = bodyOpenMatch[0];
      modifiedHtml = modifiedHtml.replace(originalBodyStart, result.bodyStart);
      logger.debug('[AI-Injection] ✅ Início do BODY substituído');
    }

    // Substituir final do BODY (footer)
    if (result.bodyEnd && bodyCloseMatch) {
      const originalBodyEnd = bodyCloseMatch[0];
      modifiedHtml = modifiedHtml.replace(originalBodyEnd, result.bodyEnd);
      logger.debug('[AI-Injection] ✅ Final do BODY substituído');
    }

    // VALIDAÇÃO FINAL: Verificar se o HTML modificado não ficou vazio
    if (!modifiedHtml || modifiedHtml.trim().length === 0) {
      logger.error('[AI-Injection] ❌ ERRO: HTML ficou vazio após processamento da IA!');
      logger.debug('[AI-Injection] ⚠️ Usando fallback para garantir que a página não fique em branco');
      return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
    }

    logger.debug('[AI-Injection] ✅ PROCESSAMENTO CONCLUÍDO COM SUCESSO');
    logger.debug('[AI-Injection] 📄 Tamanho do HTML final:', modifiedHtml.length);
    logger.debug('='.repeat(80));
    
    return modifiedHtml;
  } catch (error: any) {
    logger.error('[AI-Injection] ❌ Erro ao processar com OpenAI:', error.message);
    logger.error('[AI-Injection] 📋 Stack:', error.stack);
    
    logger.debug('[AI-Injection] ⚠️ Usando fallback devido a erro do OpenAI');
    return useFallbackMethod(html, trackingCodes, removeOldPixels, deactivateOtherScripts);
  }
}
