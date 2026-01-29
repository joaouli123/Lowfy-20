import { 
  Bot, 
  BookOpen, 
  ShoppingBag, 
  Copy, 
  Layout, 
  Users, 
  Zap,
  Globe,
  Database,
  Puzzle,
  Trophy,
  Crown,
  Target,
  TrendingUp,
  ShieldCheck,
  HelpCircle,
  Search,
  Video,
  Image,
  PenTool,
  BarChart,
  Cpu,
  MousePointer2,
  Layers,
  Smartphone,
  Briefcase,
  GraduationCap,
  Banknote,
  PlayCircle,
  FileText,
  Monitor,
  MessageSquare,
  Share2,
  Hash,
  UserPlus,
  Lock,
  Heart,
  Star,
  Flame,
  Wallet,
  CreditCard,
  RefreshCw,
  Download,
  DollarSign,
  PieChart,
  CheckCircle,
  Music,
  Package,
  FileSpreadsheet,
  Code,
  Eraser,
  Timer,
  MousePointerClick,
  EyeOff,
  Tablet,
  Save,
  Move,
  Laptop,
  Type,
  Minus,
  Box,
  Trash2,
  Link,
  MoreVertical,
  Rocket,
  Key,
  MessageCircle,
  Pin,
  ThumbsUp,
  CornerDownRight,
  Tag,
  Filter,
  Award,
  Sprout,
  Coffee
} from 'lucide-react';

export const BRAND_COLOR = '#29654f';

// Categorias de Ferramentas Atualizadas (32 Total)
export const AI_TOOL_CATEGORIES = [
  {
    id: 'ai',
    title: 'Inteligência Artificial (15)',
    icon: Bot,
    totalValue: 'R$ 2.500/mês',
    tools: [
      { 
        name: 'ChatGPT-5', 
        marketPrice: 'US$ 20', 
        desc: 'Modelo de Linguagem Avançado',
        logo: 'https://chatgptaihub.com/wp-content/uploads/2023/06/ChatGpt-logo-With-colour-Background-and-features-ChatGPT-Name-1024x301.png'
      },
      { 
        name: 'Sora AI', 
        marketPrice: 'US$ 99', 
        desc: 'Geração de Vídeo Realista',
        logo: 'https://images.seeklogo.com/logo-png/61/3/openai-sora-logo-png_seeklogo-612642.png'
      },
      { 
        name: 'Leonardo AI', 
        marketPrice: 'US$ 12', 
        desc: 'Geração de Arte Digital',
        logo: 'https://www.freelogovectors.net/wp-content/uploads/2025/06/leonardo_ai-logo-freelogovectors.net_.png'
      },
      { 
        name: 'Hey Gen', 
        marketPrice: 'US$ 24', 
        desc: 'Avatares Falantes para VSL',
        logo: 'https://s7-recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/400/488/200/original/image_(19).png?1758583343'
      },
      { 
        name: 'Midjourney', 
        marketPrice: 'US$ 10', 
        desc: 'Imagens Artísticas de Alta Qualidade',
        logo: 'https://www.furia.fi/wp-content/uploads/2023/08/Midjourney-logo-removebg-preview-1.png'
      },
      { 
        name: 'Runway', 
        marketPrice: 'US$ 15', 
        desc: 'Edição de Vídeo com IA',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Runway_Logo.png/2560px-Runway_Logo.png'
      },
      { 
        name: 'Copilot Pro', 
        marketPrice: 'US$ 20', 
        desc: 'Assistente Microsoft Integrado',
        logo: 'https://logodownload.org/wp-content/uploads/2024/03/copilot-logo.png'
      },
      { 
        name: 'Perplexity AI', 
        marketPrice: 'US$ 20', 
        desc: 'Motor de Busca Inteligente',
        logo: 'https://juridicoagil.com/wp-content/uploads/2025/09/download-12.png'
      },
      { 
        name: 'Gamma App', 
        marketPrice: 'US$ 15', 
        desc: 'Slides e Apresentações Automáticas',
        logo: 'https://asset.brandfetch.io/idAmHoFYTU/idWyo6kqsa.png'
      },
      { 
        name: 'SeaArt', 
        marketPrice: 'US$ 99', 
        desc: 'Arte Anime e Ilustração',
        logo: 'https://toolsfine.com/wp-content/uploads/2024/02/SeaArt.AI-logo.webp'
      },
      { 
        name: 'Ideogram', 
        marketPrice: 'US$ 99', 
        desc: 'Textos em Imagens Perfeitos',
        logo: 'https://pnghdpro.com/wp-content/themes/pnghdpro/download/social-media-and-brands/ideogram-logo-hd.png'
      },
      { 
        name: 'Grok AI', 
        marketPrice: 'US$ 16', 
        desc: 'IA do X/Twitter em Tempo Real',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Grok-feb-2025-logo.svg/1024px-Grok-feb-2025-logo.svg.png'
      },
      { 
        name: 'Synthesia', 
        marketPrice: 'US$ 30', 
        desc: 'Vídeos com Avatares AI',
        logo: 'https://cdn.prod.website-files.com/65e89895c5a4b8d764c0d710/65eae689ace95f5017dc17a0_Logo-main.svg'
      },
      { 
        name: 'You.com', 
        marketPrice: 'US$ 15', 
        desc: 'Buscador com Chat AI',
        logo: 'https://logos-world.net/wp-content/uploads/2024/09/You.com-Logo-New.png' 
      },
      {
        name: 'Flaticon',
        marketPrice: 'US$ 10',
        desc: 'Ícones e Stickers Vetoriais',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Flaticon.png/1200px-Flaticon.png'
      }
    ]
  },
  {
    id: 'design',
    title: 'Design & Edição (6)',
    icon: PenTool,
    totalValue: 'R$ 900/mês',
    tools: [
      { 
        name: 'Canva Pro', 
        marketPrice: 'R$ 34', 
        desc: 'Design Gráfico (4 Links)',
        logo: 'https://freelogopng.com/images/all_img/1656732927canva-logo-png.png'
      },
      { 
        name: 'CapCut Pro', 
        marketPrice: 'R$ 40', 
        desc: 'Editor de Vídeo Completo',
        logo: 'https://freelogopng.com/images/all_img/1680932354capcut-logo.png'
      },
      { 
        name: 'Envato Elements', 
        marketPrice: 'US$ 16', 
        desc: 'Downloads Ilimitados',
        logo: 'https://cdn.freebiesupply.com/logos/large/2x/envato-logo-png-transparent.png'
      },
      { 
        name: 'Freepik Premium', 
        marketPrice: 'R$ 60', 
        desc: 'Vetores e PSDs',
        logo: 'https://aisubbox.com/wp-content/uploads/2024/11/freepik-logo-E05E514182-seeklogo.com_.png'
      },
      { 
        name: 'Remini Pro', 
        marketPrice: 'R$ 30', 
        desc: 'Restauração de Fotos IA',
        logo: 'https://apkreminiai.com/wp-content/uploads/2024/06/cropped-Untitled-design-1.webp'
      }
    ]
  },
  {
    id: 'seo',
    title: 'SEO & Analytics (3)',
    icon: BarChart,
    totalValue: 'R$ 3.500/mês',
    tools: [
      { 
        name: 'SemRush', 
        marketPrice: 'US$ 129', 
        desc: 'Suite Completa de SEO',
        logo: 'https://logos-world.net/wp-content/uploads/2024/10/SEMrush-Logo.png'
      },
      { 
        name: 'RankerFox (+80)', 
        marketPrice: 'US$ 50', 
        desc: 'Pack com 80 ferramentas SEO',
        logo: 'https://rankerfox.com/wp-content/uploads/2023/05/rankerfox-2.png'
      },
      { 
        name: 'SimilarWeb', 
        marketPrice: 'US$ 125', 
        desc: 'Análise de Tráfego Web',
        logo: 'https://image.similarpng.com/file/similarpng/original-picture/2020/06/Logo-similarweb-transparent-PNG.png'
      }
    ]
  },
  {
    id: 'mining',
    title: 'Mineração (8)',
    icon: Search,
    totalValue: 'R$ 2.800/mês',
    tools: [
      { 
        name: 'AdsParo', 
        marketPrice: 'R$ 497', 
        desc: 'Espionagem de Anúncios e Trends',
        logo: 'https://img1.wsimg.com/isteam/ip/1f25943f-b3b3-4edb-b3f3-4bd98025ab1e/logo5.png'
      },
      { 
        name: 'American Swipe', 
        marketPrice: 'US$ 49', 
        desc: 'Arquivos de Referência de Marketing',
        logo: 'https://americanswipe.com.br/wp-content/webp-express/webp-images/uploads/2025/01/American-Swipe-Logo-2.png.webp'
      },
      { 
        name: 'GuruKiller', 
        marketPrice: 'R$ 297', 
        desc: 'Minerador de PLRs e Infoprodutos',
        logo: 'https://app.gurukiller.io/images/logo_azul_light_2.png'
      },
      { 
        name: 'BigSpy', 
        marketPrice: 'US$ 99', 
        desc: 'Spy Multi-plataforma (FB, IG, TT)',
        logo: 'https://www.ianfernando.com/wp-content/uploads/2022/09/bigspy-logo.png'
      },
      { 
        name: 'SpyHero', 
        marketPrice: 'R$ 497', 
        desc: 'Inteligência para Afiliados',
        logo: 'https://training.spyhero.com/wp-content/uploads/2022/07/logo-black.png'
      },
      { 
        name: 'Social Peta', 
        marketPrice: 'US$ 69', 
        desc: 'Análise de Ads e Tendências',
        logo: 'https://www.socialpeta.com/images/common/logo.svg'
      },
      { 
        name: 'ShopHunter', 
        marketPrice: 'US$ 50', 
        desc: 'Mineração para Dropshipping',
        logo: 'https://cdn.prod.website-files.com/62d4335c49ba53481bdf4fbf/65be521db5ac33d3c8e9b69d_Ei0eGM2whlmDk1xRNiTmCVva7lRe7Tvju5kubN1TQDQ.jpeg'
      },
      { 
        name: 'PipiAds', 
        marketPrice: 'US$ 165', 
        desc: 'Espionagem Exclusiva TikTok',
        logo: 'https://www.pipiads.com/assets/svg/pipiads_logo.svg'
      }
    ]
  },
];

export const MARKETPLACE_CATEGORIES = [
  { title: 'PLRs Premium', count: '100+', image: 'https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&q=80&w=400', icon: BookOpen },
  { title: 'Cursos Online', count: '380+', image: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=400', icon: Users },
  { title: 'White Label', count: 'Diversos', image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=400', icon: Briefcase },
  { title: 'Templates', count: '150+', image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=400', icon: Layout },
  { title: 'Plugins', count: '18+', image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=400', icon: Puzzle },
  { title: 'Scripts', count: 'Automações', image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=400', icon: Database },
];

export const ANDROMEDA_FEATURES = [
  { title: 'Teste A/B Automático', desc: 'O sistema roda variações de criativos e escala o vencedor sozinho.' },
  { title: 'Anti-Bloqueio', desc: 'Estrutura de contingência integrada para evitar bans do Meta.' },
  { title: 'Copy Persuasiva IA', desc: 'Gera textos de anúncio que convertem cliques em vendas.' },
  { title: 'Pixel Blindado', desc: 'Rastreamento server-side que não perde eventos (iOS 14+ ready).' }
];

export const STATS = [
  { label: 'Economia Mensal', value: 'R$ 7k+' },
  { label: 'Ferramentas', value: '39+' },
  { label: 'Cursos', value: '350+' },
  { label: 'Membros Ativos', value: '+500' },
];

export const RANKS = [
  { level: 1, name: 'Novato', xp: 0, icon: Sprout, desc: 'Iniciando a jornada' },
  { level: 5, name: 'Aprendiz', xp: 100, icon: BookOpen, desc: 'Criou 5 tópicos' },
  { level: 10, name: 'Mentor', xp: 600, icon: GraduationCap, desc: 'Respostas de Ouro' },
  { level: 15, name: 'Mestre', xp: 1000, icon: Crown, desc: 'Lenda do Fórum' },
];

export const COURSE_CATEGORIES = [
  { name: 'Tráfego Pago', count: '45 Cursos', icon: Target, image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=500' },
  { name: 'Copywriting', count: '32 Cursos', icon: PenTool, image: '/copywriter_creating_persuasive_content.webp' },
  { name: 'Dropshipping', count: '28 Cursos', icon: ShoppingBag, image: '/dropshipping_logistics_visualization.webp' },
  { name: 'Marketing Viral', count: '15 Cursos', icon: Zap, image: '/viral_marketing_campaign_success.webp' },
  { name: 'Automação & IA', count: '50 Cursos', icon: Bot, image: '/ai_automation_technology_workspace.webp' },
  { name: 'Design & VSL', count: '40 Cursos', icon: Layout, image: '/vsl_and_design_creation_workspace.webp' },
];

export const PLR_LANGUAGES = [
  { code: 'BR', name: 'Português' },
  { code: 'US', name: 'Inglês' },
  { code: 'ES', name: 'Espanhol' },
  { code: 'FR', name: 'Francês' },
  { code: 'AE', name: 'Árabe' },
  { code: 'CN', name: 'Chinês' },
  { code: 'IN', name: 'Hindi' },
];

export const PLR_INCLUDES = [
  { item: 'Página de Vendas', icon: Monitor },
  { item: 'VSL Cinematográfica', icon: PlayCircle },
  { item: 'Ebook Diagramado', icon: BookOpen },
  { item: 'Quiz de Alta Conversão', icon: HelpCircle },
  { item: 'Certificado de Revenda', icon: Award },
];

// FORUM CONSTANTS
export const FORUM_CATEGORIES = [
  { name: 'Geral', color: 'bg-gray-500' },
  { name: 'Tráfego Pago', color: 'bg-blue-500' },
  { name: 'PLRs & Dropshipping', color: 'bg-purple-500' },
  { name: 'Copy & VSL', color: 'bg-yellow-500' },
  { name: 'Black Hat', color: 'bg-red-500' },
  { name: 'Ferramentas IA', color: 'bg-[#29654f]' },
];

export const FORUM_TOPICS = [
  {
    title: "[OFICIAL] Regras de Convivência e Níveis de XP",
    author: "Admin",
    role: "Administrator",
    tag: "Geral",
    replies: 42,
    views: 1205,
    time: "Fixado",
    isPinned: true,
    isClosed: true
  },
  {
    title: "Estratégia de Contingência para Facebook Ads (2025)",
    author: "Marcos V.",
    role: "Mestre",
    tag: "Black Hat",
    replies: 156,
    views: 3420,
    time: "2h atrás",
    isPinned: true,
    isClosed: false
  },
  {
    title: "Como usar o Sora AI para criar VSLs que convertem?",
    author: "Julia M.",
    role: "Aprendiz",
    tag: "Ferramentas IA",
    replies: 23,
    views: 410,
    time: "15min atrás",
    isPinned: false,
    isClosed: false
  },
  {
    title: "Script de Vendas para WhatsApp (High Ticket)",
    author: "Lucas Sales",
    role: "Mentor",
    tag: "Copy & VSL",
    replies: 45,
    views: 890,
    time: "3h atrás",
    isPinned: false,
    isClosed: false
  },
  {
    title: "Desvendando a Estratégia Andromeda: Como Criar Campanhas de Sucesso",
    author: "Alex Tech",
    role: "Mestre",
    tag: "Ferramentas IA",
    replies: 89,
    views: 2150,
    time: "1h atrás",
    isPinned: false,
    isClosed: false
  }
];

export const FAQ_ITEMS = [
  {
    question: "O que está incluso na assinatura?",
    answer: "Absolutamente tudo: 39 Ferramentas Premium, 350+ Cursos dos maiores players do mundo, Plugins WordPress, Clonador de Páginas, Criador de Páginas, Sistema de PLRs Globais, Quiz Interativo, Marketplace, Fórum Secreto e muito mais. Sem upsells ou taxas ocultas."
  },
  {
    question: "Como acesso as 39 ferramentas?",
    answer: "Dentro da Lowfy você encontrará as instruções completas e um vídeo explicativo. Geralmente os acessos funcionam via AdsPower (com perfis compartilhados) ou via login e senha direto em cada ferramenta."
  },
  {
    question: "Posso vender meus produtos no Marketplace?",
    answer: "Sim! Você pode cadastrar seus produtos e usar nossa estrutura de pagamentos. O saque é via Pix e cai na sua conta instantaneamente. Consulte a tabela de taxas e prazo de saque na plataforma."
  },
  {
    question: "O que vem nesses PLRs?",
    answer: "Cada PLR inclui: eBook completo, VSL (Vídeo Sales Letter), Página de Vendas, Quiz Interativo e Certificado de Conclusão. Tudo disponível em 7 idiomas diferentes para você vender globalmente."
  },
  {
    question: "Os PLRs realmente funcionam em outros idiomas?",
    answer: "Sim. Nossa biblioteca foi traduzida e localizada nativamente para 7 idiomas, permitindo que você ganhe em Dólar e Euro sem saber falar a língua."
  },
  {
    question: "Após a Black Friday meu plano mudará de valor?",
    answer: "Não! O valor permanecerá o mesmo sempre. Você garante o preço de R$ 99,90/mês ou R$ 360,90/ano vitaliciamente enquanto mantiver sua assinatura ativa."
  },
  {
    question: "Como ganho XP no Fórum?",
    answer: "Você ganha XP criando tópicos (+15), respondendo (+10) e tendo respostas marcadas como 'Melhor Resposta' (+25). Suba de nível para desbloquear áreas exclusivas e benefícios especiais."
  },
  {
    question: "E a hospedagem dos sites que clono ou crio?",
    answer: "A hospedagem está totalmente inclusa na sua assinatura! Seus sites clonados e páginas criadas ficam hospedados nos servidores Lowfy com segurança garantida e velocidade máxima. O domínio não está incluído, mas você pode comprar a partir de R$ 2,99/ano e apontar para sua página em segundos."
  }
];

export const AI_TOOLS_LOGOS = [
  "ChatGPT-4", "Midjourney", "SemRush", "Canva Pro", "CapCut", 
  "HeyGen", "Sora", "SpyHero", "PipiAds", "Envato", 
  "Elementor", "SimilarWeb", "Adspower", "Grok AI", 
  "Runway", "Gamma", "Leonardo AI"
];

export const CAROUSEL_LOGOS = [
  { 
    name: "ChatGPT-4", 
    logo: "https://chatgptaihub.com/wp-content/uploads/2023/06/ChatGpt-logo-With-colour-Background-and-features-ChatGPT-Name-1024x301.png" 
  },
  { 
    name: "Midjourney", 
    logo: "https://www.furia.fi/wp-content/uploads/2023/08/Midjourney-logo-removebg-preview-1.png" 
  },
  { 
    name: "SemRush", 
    logo: "https://logos-world.net/wp-content/uploads/2024/10/SEMrush-Logo.png" 
  },
  { 
    name: "Canva Pro", 
    logo: "https://freelogopng.com/images/all_img/1656732927canva-logo-png.png" 
  },
  { 
    name: "CapCut", 
    logo: "https://freelogopng.com/images/all_img/1680932354capcut-logo.png" 
  },
  { 
    name: "HeyGen", 
    logo: "https://s7-recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/400/488/200/original/image_(19).png?1758583343" 
  },
  { 
    name: "Sora", 
    logo: "https://images.seeklogo.com/logo-png/61/3/openai-sora-logo-png_seeklogo-612642.png" 
  },
  { 
    name: "SpyHero", 
    logo: "https://spyhero.com/wp-content/uploads/2022/10/spyhero-logo.png" 
  },
  { 
    name: "PipiAds", 
    logo: "https://www.pipiads.com/assets/svg/pipiads_logo.svg" 
  },
  { 
    name: "Envato", 
    logo: "https://cdn.freebiesupply.com/logos/large/2x/envato-logo-png-transparent.png" 
  },
  { 
    name: "Elementor", 
    logo: "https://elementorpro.site/wp-content/uploads/2022/06/plugin-Elementor-pro-1.png" 
  },
  { 
    name: "SimilarWeb", 
    logo: "https://image.similarpng.com/file/similarpng/original-picture/2020/06/Logo-similarweb-transparent-PNG.png" 
  },
  { 
    name: "Adspower", 
    logo: "https://resource-wangsu.helplook.net/docker_production/9cr2vn/nav_logo/site_logo?rand=2069952276" 
  },
  { 
    name: "Grok AI", 
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Grok-feb-2025-logo.svg/1024px-Grok-feb-2025-logo.svg.png" 
  },
  { 
    name: "Runway", 
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Runway_Logo.png/2560px-Runway_Logo.png" 
  },
  { 
    name: "Gamma", 
    logo: "https://asset.brandfetch.io/idAmHoFYTU/idWyo6kqsa.png" 
  },
  { 
    name: "Leonardo AI", 
    logo: "https://www.freelogovectors.net/wp-content/uploads/2025/06/leonardo_ai-logo-freelogovectors.net_.png" 
  },
  { 
    name: "BigSpy", 
    logo: "https://www.ianfernando.com/wp-content/uploads/2022/09/bigspy-logo.png" 
  },
  { 
    name: "Social Peta", 
    logo: "https://www.socialpeta.com/images/common/logo.svg" 
  },
  { 
    name: "AdsParo", 
    logo: "https://adsparo.com/overview/assets/logo5.png" 
  },
  { 
    name: "SeaArt", 
    logo: "https://toolsfine.com/wp-content/uploads/2024/02/SeaArt.AI-logo.webp" 
  },
  { 
    name: "You.com", 
    logo: "https://logos-world.net/wp-content/uploads/2024/09/You.com-Logo-New.png" 
  }
];

// CONSTANTES NOVAS PARA O MARKETPLACE FINANCEIRO
export const SELLABLE_ITEMS = [
  { label: 'E-books', icon: BookOpen },
  { label: 'Cursos', icon: GraduationCap },
  { label: 'Templates', icon: Layout },
  { label: 'Planilhas', icon: FileSpreadsheet },
  { label: 'Softwares', icon: Cpu },
  { label: 'Áudios', icon: Music },
  { label: 'Mentoria', icon: Users },
  { label: 'Automações', icon: Package },
];

export const FINANCIAL_MOCK = [
  { id: '#1923', product: 'Ebook PLR Pro', value: '+ R$ 47,90', status: 'paid', time: 'Agora' },
  { id: '#1922', product: 'Curso Dropshipping', value: '+ R$ 97,00', status: 'paid', time: '5 min' },
  { id: '#1921', product: 'Pack Canva', value: '+ R$ 29,90', status: 'paid', time: '12 min' },
  { id: '#1920', product: 'Mentoria Black', value: '+ R$ 497,00', status: 'pending', time: '30 min' },
];

export const MARKETPLACE_FEES = [
  { label: 'Taxa Fixa', value: 'R$ 2,49', desc: 'Por transação aprovada' },
  { label: 'Comissão', value: '9,99%', desc: 'Sobre o valor da venda' },
  { label: 'Saque PIX', value: 'R$ 2,49', desc: 'Taxa única de transferência' },
];

// CLONER AND BUILDER CONSTANTS

// Steps for the Cloner Process
export const CLONER_PROCESS_STEPS = [
  { 
    title: "Importar Página", 
    desc: "Cole a URL (ex: concorrente). O sistema baixa o HTML/CSS completo.", 
    icon: Download,
    color: "text-blue-400"
  },
  { 
    title: "Limpeza Automática", 
    desc: "Remove scripts espiões, Pixels antigos do Facebook e Google Analytics.", 
    icon: Eraser,
    color: "text-red-400"
  },
  { 
    title: "Edição Inteligente", 
    desc: "Troque textos, imagens e links dos botões sem tocar em código.", 
    icon: PenTool,
    color: "text-yellow-400"
  },
  { 
    title: "Publicação", 
    desc: "Salve com seu domínio próprio e publique em 3s.", 
    icon: Rocket,
    color: "text-green-400"
  }
];

// Detected Elements in Cloner
export const DETECTED_ELEMENTS = [
  { name: "Títulos (H1-H3)", icon: Type },
  { name: "Parágrafos", icon: FileText },
  { name: "Imagens", icon: Image },
  { name: "Botões/Links", icon: MousePointerClick },
  { name: "Formulários", icon: CheckCircle },
  { name: "Vídeos", icon: Video },
];

// Builder Sidebar Tools
export const BUILDER_TOOLS = [
  { name: "Headline", icon: Type, category: "Typography" },
  { name: "Subheadline", icon: Type, size: 14, category: "Typography" },
  { name: "Parágrafo", icon: FileText, category: "Typography" },
  { name: "Vídeo (VSL)", icon: Video, category: "Media" },
  { name: "Imagem", icon: Image, category: "Media" },
  { name: "Botão CTA", icon: MousePointerClick, category: "Conversion" },
  { name: "Countdown", icon: Timer, category: "Scarcity" },
  { name: "Divisor", icon: Minus, category: "Layout" },
  { name: "Container", icon: Box, category: "Layout" },
];

// Builder Button Effects
export const BUTTON_EFFECTS_LIST = [
  { name: "None", class: "" },
  { name: "Pulse", class: "animate-pulse" },
  { name: "Shake", class: "animate-bounce" },
  { name: "Bounce", class: "animate-bounce" },
  { name: "Glow", class: "shadow-[0_0_15px_#29654f]" },
];

// Device Preview Sizes
export const DEVICE_PREVIEWS = [
  { name: "Desktop", width: "100%", icon: Monitor },
  { name: "Laptop", width: "1024px", icon: Laptop },
  { name: "Tablet", width: "768px", icon: Tablet },
  { name: "Mobile", width: "375px", icon: Smartphone },
];

// Use Cases
export const BUILDER_USE_CASES = [
  "Página de Vendas (Sales Page)",
  "VSL (Video Sales Letter)",
  "Página de Captura (Squeeze)",
  "Página de Obrigado (Thank You)",
  "Advertorial",
  "Página de Checkout"
];

// Quiz Constants
export const QUIZ_FEATURES = [
  { title: "Captura de Leads", desc: "Integre diretamente com seu CRM favorito e capture dados preciosos.", icon: Database },
  { title: "Segmentação Inteligente", desc: "Separe clientes por nível de consciência e entregue a mensagem certa para cada um.", icon: Filter },
  { title: "Engajamento Máximo", desc: "Aumente 3x a conversão em comparação com landing pages tradicionais.", icon: TrendingUp },
  { title: "Analytics Avançado", desc: "Veja os padrões de respostas e optimize sua estratégia.", icon: BarChart },
];

export const QUIZ_USE_CASES = [
  'Quiz de Diagnóstico: "Qual seu perfil de investidor?"',
  'Quiz de Recomendação: "Qual o melhor produto para a sua pele?"',
  'Quiz de Personalidade: "Qual arquétipo define sua marca?"',
];

// Benefits & Target Audience
export const BENEFITS_GRID = [
  { 
    title: "Tudo em Um Lugar", 
    desc: "Pare de pagar por múltiplas assinaturas e centralize suas ferramentas, cursos e vendas em um único sistema.", 
    icon: Box, 
    colSpan: "col-span-1 md:col-span-2" 
  },
  { 
    title: "Economia Brutal", 
    desc: "Economize até R$ 7.000/mês em ferramentas profissionais e softwares essenciais.", 
    icon: Wallet,
    colSpan: "col-span-1"
  },
  { 
    title: "Renda Passiva", 
    desc: "Ganhe 50% de comissão recorrente para sempre, ao indicar pessoas para a plataforma. Renda passiva garantida!", 
    icon: Banknote,
    colSpan: "col-span-1"
  },
  { 
    title: "Internacional", 
    desc: "Venda seus produtos em Dólar, Euro, Peso, Franco e outras moedas com PLRs globalmente testados e traduzidos para diversos mercados.", 
    icon: Globe,
    colSpan: "col-span-1 md:col-span-2"
  },
];

export const TARGET_AUDIENCE = [
  { name: "Afiliados", icon: Link },
  { name: "Produtores", icon: Package },
  { name: "Gestores", icon: BarChart },
  { name: "Designers", icon: PenTool },
  { name: "Agências", icon: Briefcase },
  { name: "Iniciantes", icon: Rocket },
];