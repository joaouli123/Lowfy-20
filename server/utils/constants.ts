/**
 * Language mapping for PLR imports
 */
export const LANGUAGE_MAP: Record<string, string> = {
  'Português': 'pt',
  'Inglês': 'en',
  'Espanhol': 'es',
  'Francês': 'fr',
  'Alemão': 'de',
  'Italiano': 'it',
  'Hindi': 'hi',
  'Árabe': 'ar',
  'Chinês': 'zh',
  'Japonês': 'ja',
  'Russo': 'ru',
};

/**
 * Category keywords for automatic categorization
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'saude-bem-estar': [
    'saúde', 'saude', 'bem-estar', 'bem estar', 'fitness', 'nutrição', 'nutricao',
    'dieta', 'emagrecimento', 'musculação', 'musculacao', 'yoga', 'meditação',
    'meditacao', 'ansiedade', 'depressão', 'depressao', 'insônia', 'insonia',
    'diabetes', 'colesterol', 'refluxo', 'candidiase', 'intestino', 'dor',
    'health', 'wellness', 'diet', 'weight loss', 'muscle', 'anxiety', 'depression'
  ],
  'marketing-digital': [
    'marketing', 'digital', 'tráfego', 'trafego', 'vendas', 'afiliado',
    'copywriting', 'anúncios', 'anuncios', 'ads', 'facebook', 'instagram',
    'google ads', 'seo', 'conversão', 'conversao', 'funil', 'landing page',
    'email marketing', 'social media', 'redes sociais', 'traffic', 'sales'
  ],
  'desenvolvimento-pessoal': [
    'desenvolvimento', 'pessoal', 'produtividade', 'hábitos', 'habitos',
    'motivação', 'motivacao', 'autoestima', 'confiança', 'confianca',
    'liderança', 'lideranca', 'carreira', 'sucesso', 'objetivos', 'metas',
    'personal development', 'productivity', 'habits', 'motivation', 'leadership'
  ],
  'financas': [
    'finanças', 'financas', 'dinheiro', 'investimento', 'poupança', 'poupanca',
    'economia', 'orçamento', 'orcamento', 'renda', 'passiva', 'ações', 'acoes',
    'bolsa', 'criptomoedas', 'bitcoin', 'finance', 'money', 'investment', 'savings'
  ],
  'relacionamentos': [
    'relacionamento', 'amor', 'casamento', 'namoro', 'família', 'familia',
    'filhos', 'educação infantil', 'educacao infantil', 'paternidade',
    'maternidade', 'relationship', 'love', 'marriage', 'family', 'parenting'
  ],
  'tecnologia': [
    'tecnologia', 'programação', 'programacao', 'desenvolvimento', 'web',
    'app', 'software', 'código', 'codigo', 'ia', 'inteligência artificial',
    'inteligencia artificial', 'technology', 'programming', 'coding', 'AI'
  ],
  'negocios': [
    'negócio', 'negocio', 'empresa', 'empreendedorismo', 'startup',
    'gestão', 'gestao', 'administração', 'administracao', 'estratégia',
    'estrategia', 'business', 'entrepreneurship', 'management', 'strategy'
  ],
  'pets': [
    'pet', 'animal', 'cachorro', 'gato', 'cão', 'cao', 'alimentação pet',
    'alimentacao pet', 'veterinária', 'veterinaria', 'adestramento',
    'dog', 'cat', 'pet food', 'veterinary', 'training'
  ]
};

/**
 * Default category slug
 */
export const DEFAULT_CATEGORY = 'outros';

/**
 * File type patterns for PLR downloads
 */
export const FILE_TYPE_PATTERNS: Record<string, RegExp[]> = {
  'ebook': [/ebook/i, /\.pdf$/i, /livro/i, /book/i],
  'vsl': [/vsl/i, /video.*sales/i, /video.*venda/i, /\.mp4$/i, /\.mov$/i],
  'capa': [/capa/i, /cover/i, /thumbnail/i],
  'criativos': [/criativos/i, /creatives/i, /banner/i, /anúncio/i, /anuncio/i],
  'quiz': [/quiz/i, /questionário/i, /questionario/i],
  'landingpage': [/landing.*page/i, /lp/i, /página.*captura/i, /pagina.*captura/i]
};

/**
 * Determine file type based on filename
 */
export function determineFileType(filename: string): string {
  const lowerFilename = filename.toLowerCase();
  
  for (const [type, patterns] of Object.entries(FILE_TYPE_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(lowerFilename))) {
      return type;
    }
  }
  
  // Default to ebook for PDFs, vsl for videos
  if (lowerFilename.endsWith('.pdf')) return 'ebook';
  if (/\.(mp4|mov|avi|wmv)$/i.test(lowerFilename)) return 'vsl';
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lowerFilename)) return 'capa';
  
  return 'outros';
}

/**
 * Determine category from PLR name
 */
export function determineCategoryFromName(plrName: string): string {
  const nameLower = plrName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => nameLower.includes(keyword.toLowerCase()))) {
      return category;
    }
  }
  
  return DEFAULT_CATEGORY;
}
