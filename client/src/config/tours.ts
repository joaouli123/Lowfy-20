import { TourConfig } from '@/hooks/useTour';

export const dashboardTour: TourConfig = {
  id: 'dashboard-tour',
  name: 'Introdução ao Dashboard',
  steps: [
    {
      id: 'welcome',
      element: 'dashboard-content',
      title: '👋 Bem-vindo ao Painel Principal',
      description: 'Este é seu painel central! Aqui você pode acessar todas as funcionalidades da plataforma. Vamos explorar juntos?',
      position: 'bottom',
    },
    {
      id: 'plrs-card',
      element: 'card-plrs-disponíveis',
      title: '📚 PLRs Disponíveis',
      description: 'Acesse centenas de PLRs (Private Label Rights) prontos para usar. São ebooks, cursos, templates e muito mais!',
      position: 'bottom',
    },
    {
      id: 'ai-tools-card',
      element: 'card-ferramentas-ia',
      title: '⚡ Ferramentas de IA',
      description: 'Use nossas ferramentas de IA para criar conteúdo, gerar ideias e otimizar sua produtividade.',
      position: 'bottom',
    },
    {
      id: 'courses-card',
      element: 'card-cursos-online',
      title: '🎓 Cursos Online',
      description: 'Aprenda novas habilidades com nossos cursos especializados sobre marketing digital, vendas e muito mais.',
      position: 'bottom',
    },
    {
      id: 'services-card',
      element: 'card-white-label',
      title: '💼 White Label',
      description: 'Acesse serviços personalizados que você pode oferecer aos seus clientes sob sua própria marca.',
      position: 'bottom',
    },
    {
      id: 'community-card',
      element: 'card-membros',
      title: '👥 Nossa Comunidade',
      description: 'Conecte-se com outros membros, compartilhe experiências e cresça junto com a comunidade Lowfy.',
      position: 'bottom',
    },
    {
      id: 'growth-card',
      element: 'card-crescimento',
      title: '📈 Sua Performance',
      description: 'Acompanhe o crescimento da plataforma e veja como está evoluindo. Clique aqui para ver análises detalhadas.',
      position: 'bottom',
    },
    {
      id: 'quick-actions',
      element: 'quick-action-plrs',
      title: '⚡ Ações Rápidas',
      description: 'Use os atalhos rápidos para acessar rapidamente as funcionalidades mais usadas.',
      position: 'bottom',
    },
  ],
};

export const pagesClonerTour: TourConfig = {
  id: 'page-cloner-tour',
  name: 'Como Usar o Clonador de Páginas',
  steps: [
    {
      id: 'welcome',
      element: 'page-cloner-container',
      title: '🚀 Clonador de Páginas',
      description: 'Crie páginas profissionais clonando páginas existentes. Perfeito para copyswipes e A/B testing!',
      position: 'bottom',
    },
    // Adicione mais steps conforme a interface
  ],
};

export const marketplaceTour: TourConfig = {
  id: 'marketplace-tour',
  name: 'Explorando o Marketplace',
  steps: [
    {
      id: 'welcome',
      element: 'marketplace-container',
      title: '🛍️ Bem-vindo ao Marketplace',
      description: 'Compre e venda produtos digitais. Encontre oportunidades de negócio e aumente sua renda.',
      position: 'bottom',
    },
    // Adicione mais steps conforme a interface
  ],
};

export const timelineTour: TourConfig = {
  id: 'timeline-tour',
  name: 'Bem-vindo à Timeline',
  steps: [
    {
      id: 'user-card',
      element: 'user-card-section',
      title: 'Seu Perfil',
      description: 'Aqui você vê seu nível, pontos acumulados, total de posts, nível e quantos seguidores tem. Clique para editar seu perfil.',
      position: 'right',
      desktopOnly: true,
    },
    {
      id: 'create-post',
      element: 'create-post-area',
      title: 'Compartilhe com a Comunidade',
      description: 'Escreva seus posts aqui! Você pode adicionar emojis, mencionar pessoas, adicionar links e imagens para engajar com a comunidade.',
      position: 'bottom',
    },
    {
      id: 'tag-filters',
      element: 'tag-filters-container',
      title: 'Filtre por Tags e Seguidores',
      description: 'Use as tags para filtrar posts que te interessam. Alterne entre "Feed" (todos), "Seguindo" (só quem segue) e "Meus" posts.',
      position: 'bottom',
    },
    {
      id: 'posts-list',
      element: 'posts-list',
      title: 'Seu Feed de Posts',
      description: 'Veja aqui todos os posts da comunidade! Interaja, comente, compartilhe e ganhe XP a cada ação. Role para ver mais conteúdo.',
      position: 'left',
    },
    {
      id: 'weekly-ranking',
      element: 'weekly-ranking-section',
      title: 'Top Usuários da Semana',
      description: 'Confira quem são os top contribuidores! Complete missões, compartilhe posts e interaja para aparecer no ranking semanal.',
      position: 'left',
      desktopOnly: true,
    },
    {
      id: 'suggested-connections',
      element: 'suggested-connections-section',
      title: 'Sugestões para Você',
      description: 'Descubra novos amigos! Confira usuários com interesses parecidos e siga quem quer acompanhar de perto.',
      position: 'left',
      desktopOnly: true,
    },
    {
      id: 'weekly-goals',
      element: 'weekly-goals-section',
      title: 'Metas Semanais',
      description: 'Acompanhe suas metas semanais! Complete objetivos maiores para ganhar recompensas especiais e subir no ranking.',
      position: 'left',
      desktopOnly: true,
    },
    {
      id: 'daily-missions',
      element: 'daily-missions-section',
      title: 'Missões Diárias',
      description: 'Complete as missões do dia para ganhar XP! Cada missão concluída aumenta seus pontos e o aproxima de novos níveis. Pronto para explorar a plataforma?',
      position: 'right',
      desktopOnly: true,
    },
  ],
};

export const plrsTour: TourConfig = {
  id: 'plrs-tour',
  name: 'Explorando os PLRs',
  steps: [
    {
      id: 'search',
      element: 'plr-search-section',
      title: 'Busque PLRs',
      description: 'Use a barra de pesquisa para encontrar PLRs específicos por nome ou palavra-chave. Ideal para achar exatamente o que você precisa!',
      position: 'bottom',
    },
    {
      id: 'categories',
      element: 'plr-category-filter',
      title: 'Filtre por Categorias',
      description: 'Escolha uma categoria para ver apenas PLRs daquele nicho. Temos Marketing, Negócios, Saúde e muito mais!',
      position: 'bottom',
    },
    {
      id: 'plr-card',
      element: 'plr-first-card',
      title: 'Cards de PLRs',
      description: 'Cada card mostra a capa do PLR, categoria, título e descrição. Clique no coração para favoritar!',
      position: 'bottom',
    },
    {
      id: 'language-flags',
      element: '.tour-language-flags',
      title: 'Idiomas Disponíveis',
      description: 'Veja aqui todos os idiomas em que este PLR está disponível. Você pode usar o conteúdo nos idiomas que precisar!',
      position: 'bottom',
    },
    {
      id: 'content-types',
      element: '.tour-content-types',
      title: 'O que está Incluso',
      description: 'Veja quais tipos de arquivo estão inclusos no pacote: VSL (vídeos), E-book (PDF), Página (HTML) e mais. Cada tipo pode ser baixado separadamente!',
      position: 'bottom',
    },
    {
      id: 'view-details',
      element: '.tour-view-details-button',
      title: 'Ver Detalhes',
      description: 'Clique aqui para abrir o painel com todos os downloads organizados por tipo e idioma. Você pode baixar cada arquivo diretamente!',
      position: 'bottom',
    },
  ],
};

export const aiToolsTour: TourConfig = {
  id: 'ai-tools-tour',
  name: 'Bem-vindo às Ferramentas de IA',
  steps: [
    {
      id: 'tabs',
      element: 'ai-tools-tabs',
      title: 'Como Acessar as Ferramentas',
      description: 'Temos 2 sistemas de login: AdsPower e Dicloak. Selecione cada aba para ver o vídeo tutorial de instalação de cada um!',
      position: 'bottom',
    },
    {
      id: 'global-access',
      element: 'ai-tools-global-access',
      title: 'Acessos Globais',
      description: 'Aqui estão as credenciais para acessar ambos os sistemas. Copie os logins e senhas usando os ícones de cópia!',
      position: 'top',
    },
    {
      id: 'tool-card',
      element: '.ai-tool-card-first',
      title: 'Ferramentas Disponíveis',
      description: 'A maioria das ferramentas são acessadas pelos logins acima, mas algumas têm login individual. Se não encontrar a ferramenta dentro do Dicloak ou AdsPower, clique aqui para consultar as credenciais específicas!',
      position: 'bottom',
    },
    {
      id: 'report-problem',
      element: '.tour-report-button',
      title: 'Reportar Problema',
      description: 'Se algum login estiver incorreto ou não funcionar, clique aqui que nosso admin será notificado para corrigir!',
      position: 'top',
    },
  ],
};

export const quizInterativoTour: TourConfig = {
  id: 'quiz-interativo-tour',
  name: 'Como usar o Funil Interativo',
  steps: [
    {
      id: 'access-button',
      element: 'quiz-access-button',
      title: 'Acessar Ferramenta',
      description: 'Clique aqui para acessar a plataforma do XQuiz externamente. Você será redirecionado para o site da ferramenta.',
      position: 'bottom',
    },
    {
      id: 'credentials',
      element: 'quiz-credentials-section',
      title: 'Credenciais de Acesso',
      description: 'Copie o email e a senha clicando nos ícones de cópia. Use essas credenciais para fazer login na plataforma!',
      position: 'bottom',
    },
  ],
};

export const allTours = {
  dashboard: dashboardTour,
  timeline: timelineTour,
  pageCloner: pagesClonerTour,
  marketplace: marketplaceTour,
  plrs: plrsTour,
  aiTools: aiToolsTour,
  quizInterativo: quizInterativoTour,
};
