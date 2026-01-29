import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}

const defaultMeta = {
  title: 'Lowfy - Plataforma de Marketing Digital | PLR, IA, Ferramentas Premium',
  description: 'Acesse milhares de PLRs, cursos online, ferramentas de IA, templates e automações. Sua plataforma completa para marketing digital e vendas online.',
  keywords: 'PLR, conteúdo digital, cursos online, ferramentas IA, marketing digital, ebooks, templates, automações',
  ogType: 'website',
  ogImage: '/og-image.svg',
};

export const seoConfig = {
  home: {
    title: 'Lowfy - Plataforma de Marketing Digital | PLR, IA, Ferramentas Premium',
    description: 'Acesse milhares de PLRs, cursos online, ferramentas de IA, templates e automações. Sua plataforma completa para marketing digital e vendas online.',
    canonical: 'https://lowfy.com.br/',
  },
  ferramentas: {
    title: '39 Ferramentas Premium Inclusas | Lowfy',
    description: 'Cancele Canva, Semrush e ChatGPT. Todas as ferramentas liberadas em um só lugar. IA para anúncios, editor de imagens, automações e muito mais.',
    canonical: 'https://lowfy.com.br/ai-tools',
  },
  clonador: {
    title: 'Clonador de Páginas | Lowfy',
    description: 'Copie qualquer página de vendas em segundos. Limpeza automática de pixel e scripts. Clone, edite e publique páginas profissionais instantaneamente.',
    canonical: 'https://lowfy.com.br/clonador',
  },
  plrs: {
    title: 'Biblioteca de PLR em 7 Idiomas | Lowfy',
    description: 'Produtos prontos em 7 idiomas para revenda. Baixe, edite e venda em Dólar, Euro ou Real. Milhares de PLRs com direitos de revenda.',
    canonical: 'https://lowfy.com.br/plrs',
  },
  planos: {
    title: 'Nossos Planos | Economize com a Lowfy',
    description: 'Economize mais de R$ 7.000/mês. Acesso imediato a partir de R$ 99. Cancele Canva, ChatGPT e dezenas de ferramentas.',
    canonical: 'https://lowfy.com.br/assinatura/checkout',
  },
  login: {
    title: 'Entrar na Plataforma | Lowfy',
    description: 'Já é assinante? Acesse seu painel e ferramentas aqui. Entre na sua conta Lowfy.',
    canonical: 'https://lowfy.com.br/auth',
  },
  cursos: {
    title: 'Cursos Online de Marketing Digital | Lowfy',
    description: 'Aprenda marketing digital, tráfego pago, copywriting e vendas online. Cursos completos com certificado.',
    canonical: 'https://lowfy.com.br/courses',
  },
  presellBuilder: {
    title: 'Criador de Páginas Pre-Sell | Lowfy',
    description: 'Crie páginas de pré-venda profissionais sem código. Editor visual intuitivo com templates prontos.',
    canonical: 'https://lowfy.com.br/presell-builder',
  },
  marketplace: {
    title: 'Marketplace de Produtos Digitais | Lowfy',
    description: 'Compre e venda produtos digitais. Marketplace com sistema de afiliados e comissões.',
    canonical: 'https://lowfy.com.br/marketplace',
  },
  timeline: {
    title: 'Comunidade Lowfy | Timeline',
    description: 'Conecte-se com outros empreendedores digitais. Compartilhe experiências, dúvidas e conquistas.',
    canonical: 'https://lowfy.com.br/timeline',
  },
  forum: {
    title: 'Fórum de Marketing Digital | Lowfy',
    description: 'Tire dúvidas, compartilhe estratégias e aprenda com a comunidade Lowfy.',
    canonical: 'https://lowfy.com.br/forum',
  },
  plugins: {
    title: 'Plugins WordPress Premium | Lowfy',
    description: 'Plugins WordPress profissionais para seu site. Elementor, WooCommerce, SEO e mais.',
    canonical: 'https://lowfy.com.br/plugins',
  },
  templates: {
    title: 'Templates e Modelos Prontos | Lowfy',
    description: 'Templates profissionais para landing pages, emails e redes sociais.',
    canonical: 'https://lowfy.com.br/templates',
  },
  automacoes: {
    title: 'Automações N8N Prontas | Lowfy',
    description: 'Modelos de automação N8N prontos para usar. Integre ferramentas e automatize seu negócio.',
    canonical: 'https://lowfy.com.br/modelos-n8n',
  },
  andromeda: {
    title: 'Andromeda - Gerador de Campanhas Meta Ads | Lowfy',
    description: 'Gere criativos e campanhas para Meta Ads com IA. Carrosséis, imagens e textos otimizados.',
    canonical: 'https://lowfy.com.br/andromeda',
  },
  suporte: {
    title: 'Suporte ao Cliente | Lowfy',
    description: 'Precisa de ajuda? Entre em contato com nosso suporte.',
    canonical: 'https://lowfy.com.br/support',
  },
  afiliados: {
    title: 'Programa de Afiliados | Lowfy',
    description: 'Ganhe 50% de comissão recorrente indicando a Lowfy. Programa de afiliados com pagamentos semanais.',
    canonical: 'https://lowfy.com.br/referrals',
  },
  perfil: {
    title: 'Meu Perfil | Lowfy',
    description: 'Gerencie seu perfil, configurações e preferências na plataforma Lowfy.',
    canonical: 'https://lowfy.com.br/profile',
  },
};

export function SEO({
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  canonicalUrl,
  noindex = false,
}: SEOProps) {
  useEffect(() => {
    const pageTitle = title || defaultMeta.title;
    document.title = pageTitle;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const attribute = property ? 'property' : 'name';
      let tag = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, name);
        document.head.appendChild(tag);
      }
      
      tag.content = content;
    };

    // Standard meta tags
    updateMetaTag('description', description || defaultMeta.description);
    updateMetaTag('keywords', keywords || defaultMeta.keywords);

    // Open Graph tags
    updateMetaTag('og:title', ogTitle || title || defaultMeta.title, true);
    updateMetaTag('og:description', ogDescription || description || defaultMeta.description, true);
    updateMetaTag('og:image', ogImage || defaultMeta.ogImage, true);
    updateMetaTag('og:type', ogType, true);
    
    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle || title || defaultMeta.title);
    updateMetaTag('twitter:description', ogDescription || description || defaultMeta.description);
    updateMetaTag('twitter:image', ogImage || defaultMeta.ogImage);

    // Canonical URL
    if (canonicalUrl) {
      let linkTag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      
      if (!linkTag) {
        linkTag = document.createElement('link');
        linkTag.rel = 'canonical';
        document.head.appendChild(linkTag);
      }
      
      linkTag.href = canonicalUrl;
      
      updateMetaTag('og:url', canonicalUrl, true);
    }
    
    // Robots meta tag
    if (noindex) {
      updateMetaTag('robots', 'noindex, nofollow');
    } else {
      updateMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogType, canonicalUrl, noindex]);

  return null;
}
