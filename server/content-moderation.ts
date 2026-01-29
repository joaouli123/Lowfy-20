
// Sistema de Moderação de Conteúdo
// Detecta e bloqueia conteúdo ofensivo, insultos, spam e conteúdo inadequado

const OFFENSIVE_WORDS = [
  // Palavrões e insultos comuns
  'porra', 'caralho', 'puta', 'merda', 'cu', 'cacete', 'buceta', 'viado', 'bicha',
  'fdp', 'desgraça', 'arrombado', 'corno', 'vagabundo', 'safado', 'piranha',
  'otário', 'idiota', 'burro', 'imbecil', 'retardado', 'filho da puta',
  
  // Variações e tentativas de burlar filtro
  'p0rra', 'c@ralho', 'put@', 'm3rda', 'f.d.p', 'fdp', 'f d p',
  'pqp', 'vsf', 'v@i se fud', 'vai se f',
  
  // Termos ofensivos e preconceituosos
  'vadia', 'vagabunda', 'prostituta', 'puta barata', 'rameira',
  'macaco', 'negão', 'preto', 'favelado', 'judeu sujo',
  
  // Insultos e humilhações
  'lixo', 'inútil', 'fracassado', 'incompetente', 'patético',
  'ridículo', 'miserável', 'nojento', 'escroto', 'babaca',
  
  // Ameaças e violência
  'vou te matar', 'vou te pegar', 'vou te bater', 'morte',
  'suicídio', 'se mata', 'vai morrer',
  
  // Spam e golpes
  'clique aqui', 'ganhe dinheiro fácil', 'promoção imperdível',
  'compre agora', 'oferta limitada', 'ganhe 1000 reais',
];

// Padrões regex para detecção mais avançada
const OFFENSIVE_PATTERNS = [
  /\b(filho|filha)\s*da\s*puta\b/gi,
  /\bvai\s*se\s*fud(er|ar)\b/gi,
  /\bvai\s*tomar\s*no\s*cu\b/gi,
  /\bputa\s*que\s*pariu\b/gi,
  /\bse\s*fod(e|eu)\b/gi,
  /\b(va|vá)\s*pra\s*pqp\b/gi,
  /\bva\s*pro\s*inferno\b/gi,
  /\btoma\s*no\s*cu\b/gi,
  /\benfia\s*no\s*cu\b/gi,
  /\b(seu|sua)\s*(lixo|merda|bosta)\b/gi,
];

// Padrões de spam
const SPAM_PATTERNS = [
  /\d{10,}/g, // Sequências longas de números (telefones, etc)
  /https?:\/\/[^\s]+/gi, // Links externos (exceto domínios permitidos)
  /whatsapp|telegram|discord|kik/gi, // Apps de mensagens suspeitos
  /(compre|compra|venda|oferta)\s+(agora|já|hoje)/gi,
  /ganhe\s+\d+\s+(reais|dinheiro)/gi,
];

// Domínios permitidos para links
const ALLOWED_DOMAINS = [
  'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
  'google.com', 'drive.google.com',
];

export interface ModerationResult {
  isAllowed: boolean;
  reason?: string;
  flaggedWords?: string[];
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

/**
 * Valida conteúdo antes de salvar no banco
 */
export function moderateContent(content: string, context: 'forum' | 'timeline' = 'forum'): ModerationResult {
  const normalizedContent = content.toLowerCase().trim();
  
  // 1. Verificar palavras ofensivas exatas
  const foundOffensiveWords = OFFENSIVE_WORDS.filter(word => 
    normalizedContent.includes(word.toLowerCase())
  );
  
  if (foundOffensiveWords.length > 0) {
    return {
      isAllowed: false,
      reason: 'Conteúdo contém linguagem ofensiva ou insultos',
      flaggedWords: foundOffensiveWords,
      severity: 'high',
      suggestion: 'Por favor, reformule seu texto sem palavrões ou insultos.',
    };
  }
  
  // 2. Verificar padrões ofensivos (regex)
  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(content)) {
      return {
        isAllowed: false,
        reason: 'Conteúdo contém expressões ofensivas',
        severity: 'high',
        suggestion: 'Evite usar expressões agressivas ou desrespeitosas.',
      };
    }
  }
  
  // 3. Verificar spam
  const spamScore = SPAM_PATTERNS.reduce((score, pattern) => {
    return score + (pattern.test(content) ? 1 : 0);
  }, 0);
  
  if (spamScore >= 2) {
    return {
      isAllowed: false,
      reason: 'Conteúdo identificado como spam ou autopromoção excessiva',
      severity: 'medium',
      suggestion: 'Evite incluir telefones, links externos ou promessas de ganhos.',
    };
  }
  
  // 4. Verificar links suspeitos
  const urlMatches = content.match(/https?:\/\/([^\s/]+)/gi);
  if (urlMatches) {
    const suspiciousLinks = urlMatches.filter(url => {
      const domain = new URL(url).hostname.toLowerCase();
      return !ALLOWED_DOMAINS.some(allowed => domain.includes(allowed));
    });
    
    if (suspiciousLinks.length > 0) {
      return {
        isAllowed: false,
        reason: 'Links externos não são permitidos',
        severity: 'medium',
        suggestion: 'Remova links externos. Use apenas links do YouTube, Vimeo ou Google Drive.',
      };
    }
  }
  
  // 5. Verificar conteúdo muito curto ou sem sentido
  if (normalizedContent.length < 3) {
    return {
      isAllowed: false,
      reason: 'Conteúdo muito curto',
      severity: 'low',
      suggestion: 'Por favor, escreva uma mensagem mais completa.',
    };
  }
  
  // 6. Verificar CAPS LOCK excessivo (gritaria)
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.7 && content.length > 20) {
    return {
      isAllowed: false,
      reason: 'Uso excessivo de letras maiúsculas',
      severity: 'low',
      suggestion: 'Evite escrever tudo em MAIÚSCULAS. Isso é considerado gritar.',
    };
  }
  
  // 7. Verificar repetição excessiva de caracteres
  if (/(.)\1{4,}/.test(content)) {
    return {
      isAllowed: false,
      reason: 'Repetição excessiva de caracteres',
      severity: 'low',
      suggestion: 'Evite repetir caracteres desnecessariamente.',
    };
  }
  
  // Conteúdo aprovado
  return {
    isAllowed: true,
    severity: 'low',
  };
}

/**
 * Sanitiza conteúdo removendo caracteres especiais suspeitos
 */
export function sanitizeContent(content: string): string {
  // Remove caracteres unicode suspeitos
  let sanitized = content.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Remove múltiplos espaços
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Valida título do fórum ou post
 */
export function validateTitle(title: string): ModerationResult {
  if (!title || title.trim().length < 5) {
    return {
      isAllowed: false,
      reason: 'Título muito curto',
      severity: 'low',
      suggestion: 'O título deve ter pelo menos 5 caracteres.',
    };
  }
  
  if (title.length > 200) {
    return {
      isAllowed: false,
      reason: 'Título muito longo',
      severity: 'low',
      suggestion: 'O título deve ter no máximo 200 caracteres.',
    };
  }
  
  return moderateContent(title, 'forum');
}

/**
 * Calcula score de confiança do usuário (usado para moderar automaticamente ou manualmente)
 */
export function getUserTrustScore(user: {
  createdAt: Date;
  points?: number;
  topicsCreated?: number;
  repliesCreated?: number;
  likesReceived?: number;
}): number {
  let score = 0;
  
  // Pontos por tempo de conta (0-30)
  const accountAge = Date.now() - new Date(user.createdAt).getTime();
  const daysOld = accountAge / (1000 * 60 * 60 * 24);
  score += Math.min(30, daysOld);
  
  // Pontos por XP (0-30)
  score += Math.min(30, (user.points || 0) / 100);
  
  // Pontos por participação (0-40)
  score += Math.min(15, (user.topicsCreated || 0) * 3);
  score += Math.min(15, (user.repliesCreated || 0) * 2);
  score += Math.min(10, (user.likesReceived || 0) * 1);
  
  return Math.min(100, score);
}
