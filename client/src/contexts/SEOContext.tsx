import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { SEO } from '@/components/SEO';

interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
}

const seoConfigMap: Record<string, SEOConfig> = {
  '/': {
    title: 'Lowfy - Plataforma de Marketing Digital',
    description: 'Acesse milhares de PLRs, cursos online, ferramentas de IA, templates e automações. Sua plataforma completa para marketing digital e vendas online.',
    keywords: 'marketing digital, PLR, ferramentas IA, cursos online, templates, automações N8N, landing pages',
  },
  '/login': {
    title: 'Login - Lowfy',
    description: 'Faça login na Lowfy e acesse todas as ferramentas premium de marketing digital, PLRs, cursos e automações.',
  },
  '/timeline': {
    title: 'Timeline - Lowfy',
    description: 'Acompanhe as novidades e atualizações da comunidade Lowfy. Veja os últimos conteúdos, dicas e discussões.',
  },
  '/dashboard': {
    title: 'Dashboard - Lowfy',
    description: 'Seu painel de controle na Lowfy. Acompanhe seu progresso, vendas, comissões e atividades.',
  },
  '/plrs': {
    title: 'PLRs Premium - Baixe Produtos com Direitos de Revenda | Lowfy',
    description: 'Acesse milhares de PLRs exclusivos: ebooks, cursos, templates e muito mais. Produtos com direitos de revenda para seu negócio digital.',
    keywords: 'PLR, produtos digitais, direitos de revenda, ebooks PLR, cursos PLR, templates PLR',
  },
  '/ai-tools': {
    title: 'Ferramentas de IA para Marketing | Lowfy',
    description: 'Crie anúncios, copies, scripts de vendas e muito mais com inteligência artificial. Ferramentas IA otimizadas para marketing digital.',
    keywords: 'IA marketing, inteligência artificial, gerador de anúncios, copywriting IA, automação marketing',
  },
  '/courses': {
    title: 'Cursos Online de Marketing Digital | Lowfy',
    description: 'Aprenda marketing digital, vendas online, tráfego pago e muito mais com nossos cursos exclusivos. Do básico ao avançado.',
    keywords: 'cursos marketing digital, cursos online, tráfego pago, vendas online, dropshipping',
  },
  '/plugins': {
    title: 'Plugins WordPress Premium | Lowfy',
    description: 'Plugins WordPress profissionais para ecommerce, SEO, performance e conversão. Turbine seu site WordPress.',
    keywords: 'plugins WordPress, WooCommerce, SEO WordPress, plugins premium',
  },
  '/templates': {
    title: 'Templates Profissionais | Lowfy',
    description: 'Templates prontos para landing pages, emails, posts e muito mais. Designs profissionais para seu marketing digital.',
    keywords: 'templates marketing, landing pages, email marketing, templates canva',
  },
  '/services': {
    title: 'Serviços de Marketing Digital | Lowfy',
    description: 'Contrate serviços profissionais de marketing digital: criação de sites, gestão de tráfego, design e muito mais.',
    keywords: 'serviços marketing, agência digital, criação de sites, gestão de tráfego',
  },
  '/marketplace': {
    title: 'Marketplace de Produtos Digitais | Lowfy',
    description: 'Compre e venda produtos digitais no marketplace da Lowfy. Encontre cursos, ebooks, templates e ferramentas.',
    keywords: 'marketplace digital, produtos digitais, comprar cursos, vender produtos digitais',
  },
  '/marketplace/vitrine': {
    title: 'Vitrine de Produtos - Marketplace | Lowfy',
    description: 'Explore nossa vitrine de produtos digitais. Encontre os melhores cursos, ebooks e ferramentas para seu negócio.',
  },
  '/marketplace/meus-produtos': {
    title: 'Meus Produtos - Marketplace | Lowfy',
    description: 'Gerencie seus produtos digitais no marketplace da Lowfy. Cadastre, edite e acompanhe suas vendas.',
  },
  '/marketplace/compras': {
    title: 'Minhas Compras | Lowfy',
    description: 'Acesse todos os produtos digitais que você comprou na Lowfy. Seus cursos, ebooks e ferramentas em um só lugar.',
  },
  '/marketplace/financeiro': {
    title: 'Financeiro - Marketplace | Lowfy',
    description: 'Acompanhe suas vendas, comissões e saques no marketplace da Lowfy. Relatórios financeiros completos.',
  },
  '/forum': {
    title: 'Comunidade e Fórum | Lowfy',
    description: 'Participe da comunidade Lowfy. Tire dúvidas, compartilhe experiências e conecte-se com outros empreendedores digitais.',
    keywords: 'comunidade marketing digital, fórum empreendedores, networking digital',
  },
  '/support': {
    title: 'Suporte ao Cliente | Lowfy',
    description: 'Precisa de ajuda? Nossa equipe de suporte está pronta para auxiliar você. FAQ, tutoriais e atendimento personalizado.',
  },
  '/profile': {
    title: 'Meu Perfil | Lowfy',
    description: 'Gerencie seu perfil, configurações e preferências na plataforma Lowfy.',
  },
  '/indicacoes': {
    title: 'Programa de Indicações | Lowfy',
    description: 'Indique amigos e ganhe comissões! Programa de afiliados da Lowfy com comissões recorrentes.',
    keywords: 'afiliados Lowfy, programa de indicação, ganhar comissões, marketing de afiliados',
  },
  '/assinatura': {
    title: 'Planos e Assinatura | Lowfy',
    description: 'Escolha o plano ideal para você. Assinatura mensal com acesso a todas as ferramentas, PLRs e cursos da Lowfy.',
    keywords: 'planos Lowfy, assinatura, preços, plano mensal',
  },
  '/assinatura/checkout': {
    title: 'Checkout - Assine a Lowfy',
    description: 'Finalize sua assinatura e comece a usar todas as ferramentas premium da Lowfy agora mesmo.',
  },
  '/clonador': {
    title: 'Clonador de Páginas | Lowfy',
    description: 'Clone páginas de vendas de alta conversão em segundos. Ferramenta exclusiva para criar landing pages profissionais.',
    keywords: 'clonador de páginas, landing page, página de vendas, clonar sites',
  },
  '/presell-dashboard': {
    title: 'Páginas de Pre-Sell | Lowfy',
    description: 'Crie páginas de pre-sell que convertem. Builder intuitivo para criar páginas de aquecimento de leads.',
  },
  '/quiz-interativo': {
    title: 'Quiz Interativo | Lowfy',
    description: 'Crie quizzes interativos para engajar sua audiência e qualificar leads automaticamente.',
  },
  '/modelos-n8n': {
    title: 'Automações N8N | Lowfy',
    description: 'Templates de automação N8N prontos para usar. Automatize seu marketing digital e aumente sua produtividade.',
    keywords: 'automações N8N, templates automação, workflow automation, marketing automation',
  },
  '/meta-ads-andromeda': {
    title: 'Meta Ads Andromeda - Gerador de Anúncios IA | Lowfy',
    description: 'Gere anúncios otimizados para Meta Ads com inteligência artificial. Copies, headlines e criativos que convertem.',
    keywords: 'Meta Ads, Facebook Ads, gerador de anúncios, IA para anúncios, copywriting',
  },
  '/termos': {
    title: 'Termos de Uso | Lowfy',
    description: 'Termos e condições de uso da plataforma Lowfy. Leia atentamente antes de utilizar nossos serviços.',
  },
  '/privacidade': {
    title: 'Política de Privacidade | Lowfy',
    description: 'Política de privacidade da Lowfy. Saiba como tratamos e protegemos seus dados pessoais.',
  },
  '/licenca-plr': {
    title: 'Licença PLR | Lowfy',
    description: 'Termos de licença para produtos PLR da Lowfy. Entenda seus direitos de uso e revenda.',
  },
  '/direitos-autorais': {
    title: 'Direitos Autorais | Lowfy',
    description: 'Informações sobre direitos autorais e propriedade intelectual na plataforma Lowfy.',
  },
};

const SEOContext = createContext<null>(null);

interface SEOProviderProps {
  children: ReactNode;
}

export function SEOProvider({ children }: SEOProviderProps) {
  const [location] = useLocation();

  const getConfigForRoute = (path: string): SEOConfig => {
    if (seoConfigMap[path]) {
      return seoConfigMap[path];
    }
    
    if (path.startsWith('/marketplace/produto/')) {
      return {
        title: 'Produto - Marketplace | Lowfy',
        description: 'Veja os detalhes deste produto no marketplace da Lowfy.',
        ogType: 'product',
      };
    }
    
    if (path.startsWith('/forum/')) {
      return {
        title: 'Tópico do Fórum | Lowfy',
        description: 'Participe da discussão na comunidade Lowfy.',
        ogType: 'article',
      };
    }
    
    if (path.startsWith('/users/')) {
      return {
        title: 'Perfil de Usuário | Lowfy',
        description: 'Veja o perfil deste membro da comunidade Lowfy.',
        ogType: 'profile',
      };
    }
    
    if (path.startsWith('/admin/')) {
      return {
        title: 'Administração | Lowfy',
        description: 'Painel administrativo da Lowfy.',
      };
    }
    
    return {
      title: 'Lowfy - Plataforma de Marketing Digital',
      description: 'Plataforma completa de marketing digital com ferramentas IA, PLRs, cursos e automações.',
    };
  };

  const config = getConfigForRoute(location);
  
  const currentHost = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://lowfy.com.br';

  return (
    <SEOContext.Provider value={null}>
      <SEO
        title={config.title}
        description={config.description}
        keywords={config.keywords}
        ogType={config.ogType}
        ogImage={config.ogImage || '/og-image.svg'}
        canonicalUrl={`${currentHost}${location}`}
      />
      {children}
    </SEOContext.Provider>
  );
}
