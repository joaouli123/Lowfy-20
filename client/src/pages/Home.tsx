
import { useState, useEffect, memo, useRef, lazy, Suspense, startTransition, useCallback } from 'react';
// Hero Background Image - Placeholder used after cleanup
const moneyBg = 'https://images.unsplash.com/photo-1550565118-3a14e8d0386f?q=80&w=2070&auto=format&fit=crop';

// Lazy Section - Only renders when visible in viewport
const LazySection = memo(({ children, fallback, rootMargin = '200px' }: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
  rootMargin?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startTransition(() => setIsVisible(true));
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : (fallback || <div className="min-h-[200px]" />)}
    </div>
  );
});

const LazyVideo = memo(({ src, className, poster }: { src: string; className?: string; poster?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isVisible, isLoaded]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ minHeight: '300px' }}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#29654f] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isVisible && (
        <video 
          ref={videoRef}
          src={src}
          poster={poster}
          loop
          muted
          playsInline
          preload="none"
          className={`w-full h-full object-contain rounded-lg ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          width="700"
          height="420"
          onLoadedData={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
});
import Navbar from '@/components/landing/Navbar';

const InfiniteCarousel = lazy(() => import('@/components/landing/InfiniteCarousel'));
const UiCarousel = lazy(() => import('@/components/landing/UiCarousel'));
const BentoFeatures = lazy(() => import('@/components/landing/BentoFeatures').then(m => ({ default: m.BentoFeatures })));
const Testimonials = lazy(() => import('@/components/landing/Testimonials'));

const SectionLoader = () => (
  <div className="w-full h-64 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-[#29654f] border-t-transparent rounded-full animate-spin" />
  </div>
);

const RetroGrid = memo(({ angle = 65, cellSize = 50, opacity = 0.4, lightLineColor = "#d1d5db", darkLineColor = "#404040" }: {
  angle?: number; cellSize?: number; opacity?: number; lightLineColor?: string; darkLineColor?: string;
}) => (
  <div
    className="pointer-events-none absolute inset-0 overflow-hidden"
    style={{
      background: `linear-gradient(to bottom, transparent, white), 
                   linear-gradient(${angle}deg, ${lightLineColor} 1px, transparent 1px),
                   linear-gradient(${angle + 90}deg, ${lightLineColor} 1px, transparent 1px)`,
      backgroundSize: `100% 100%, ${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px`,
      opacity: opacity,
    }}
  />
));

const lucasImg = 'https://ui-avatars.com/api/?name=Lucas+Felipe&background=29654f&color=fff&bold=true&size=128';
const mariaImg = 'https://ui-avatars.com/api/?name=Maria+Silva&background=3db370&color=fff&bold=true&size=128';
const pedroImg = 'https://ui-avatars.com/api/?name=Pedro+Santos&background=29654f&color=fff&bold=true&size=128';
import { 
  STATS, 
  AI_TOOL_CATEGORIES, 
  ANDROMEDA_FEATURES, 
  FAQ_ITEMS, 
  COURSE_CATEGORIES, 
  PLR_LANGUAGES,
  PLR_INCLUDES,
  SELLABLE_ITEMS,
  CLONER_PROCESS_STEPS,
  FORUM_TOPICS,
  FORUM_CATEGORIES,
  QUIZ_FEATURES,
  QUIZ_USE_CASES,
  BENEFITS_GRID
} from '@/lib/landing-constants';
import { 
  Check, 
  Rocket, 
  Zap,
  ChevronDown,
  ChevronUp,
  Lock,
  Coins,
  Crown,
  Play,
  ShieldCheck,
  Copy,
  Globe,
  ArrowRight,
  MessageCircle,
  Users,
  Trophy,
  Search,
  Banknote,
  Download,
  X as XIcon,
  Gift,
  Instagram,
  Youtube,
  Facebook,
  Mail,
  Phone,
  Layout,
  Link,
  Plus,
  CornerDownRight,
  CreditCard,
  CheckCircle,
  Pin,
  ThumbsUp,
  Share2,
  Heart,
  Award,
  Home as HomeIcon,
  User,
  Coffee
} from 'lucide-react';

const Home: React.FC = () => {
  // Theme Management
  const [theme, setTheme] = useState<string>('dark');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeToolCategory, setActiveToolCategory] = useState('ai');
  const [activeTab, setActiveTab] = useState<'cloner' | 'builder'>('cloner');
  const [quizStep, setQuizStep] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [communityProgress, setCommunityProgress] = useState<number>(0);
  const [activeCommunityTab, setActiveCommunityTab] = useState<'forum' | 'timeline' | 'gamification'>('forum');
  const [pricingPlan, setPricingPlan] = useState<'mensal' | 'anual'>('mensal');
  const [legalOpen, setLegalOpen] = useState<boolean>(false);

  // Quiz Questions
  const quizQuestions = [
    {
      question: 'Qual seu maior objetivo?',
      options: ['Vender sem aparecer (PLR)', 'Criar minha marca pessoal', 'Prestar serviços (Freelancer)']
    },
    {
      question: 'Qual é seu nível de experiência?',
      options: ['Iniciante', 'Intermediário', 'Avançado']
    },
    {
      question: 'Qual é seu orçamento para este ano?',
      options: ['Menos de R$ 5.000', 'R$ 5.000 - R$ 15.000', 'Mais de R$ 15.000']
    }
  ];

  // Initial Theme Check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('lowfy-theme') || 'dark';
      setTheme(savedTheme);
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  // Community Tab Auto-advance - DISABLED
  // useEffect(() => {
  //   let communityTimer: NodeJS.Timeout;
  //   
  //   const startTimer = () => {
  //     communityTimer = setInterval(() => {
  //       setCommunityProgress((prev) => {
  //         const newProgress = prev + 1;
  //         if (newProgress >= 100) {
  //           setActiveCommunityTab((currentTab) => {
  //             if (currentTab === 'forum') return 'timeline';
  //             if (currentTab === 'timeline') return 'gamification';
  //             return 'forum';
  //           });
  //           return 0;
  //         }
  //         return newProgress;
  //       });
  //     }, 100);
  //   };
  //   
  //   startTimer();
  //
  //   return () => {
  //     if (communityTimer) {
  //       clearInterval(communityTimer);
  //     }
  //   };
  // }, []);

  // Auto-advance Quiz - DISABLED to prevent video restart
  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     setQuizStep((prev) => (prev + 1) % quizQuestions.length);
  //   }, 6000);
  //   
  //   return () => {
  //     clearInterval(timer);
  //   };
  // }, [quizQuestions.length]);

  // Toggle Theme Function - Memoized to prevent INP issues
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('lowfy-theme', newTheme);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
  }, [theme]);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  }, [openFaq]);

  const HomePage = () => (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-[#0f0f0f] dark:text-white font-sans selection:bg-[#29654f] selection:text-white overflow-x-hidden transition-colors duration-200">
      <Navbar toggleTheme={toggleTheme} isDark={theme === 'dark'} />

      {/* HERO SECTION CINEMÁTICA */}
      <section 
        className="relative min-h-[90vh] flex items-center justify-center pt-32 md:pt-48 overflow-hidden bg-gray-50 dark:bg-[#0f0f0f] transition-colors duration-200 will-change-transform"
        style={{
          backgroundImage: `url(${moneyBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'scroll',
          contain: 'paint layout',
        }}
      >
        {/* Dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-black/80 dark:bg-black/85 z-[1]" style={{ contain: 'layout paint' }} />
        
        {/* Subtle grid pattern - pure CSS, no overlay */}
        <div 
          className="absolute inset-0 z-0 opacity-[0.08] dark:opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(var(--grid-color, #ccc) 1px, transparent 1px), linear-gradient(90deg, var(--grid-color, #ccc) 1px, transparent 1px)`,
            backgroundSize: '100px 100px',
            contain: 'paint',
            backfaceVisibility: 'hidden',
            perspective: 1000,
          }}
        />
        <style>{`.dark { --grid-color: #333; } :root { --grid-color: #d1d5db; }`}</style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-[10] text-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-400 text-xs font-bold mb-6 backdrop-blur-sm shadow-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 mr-2"></span>
            OFERTA DE FINAL DE ANO
          </div>
          
          <h1 className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tighter text-gray-900 dark:text-white mb-6 leading-[1.1]">
            <span itemProp="name">O Marketing Digital</span> <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] via-[#3b8569] to-[#4ade80]">
              Ficou Covarde.
            </span>
          </h1>
          
          <p className="mt-4 max-w-3xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80] font-bold">+39 Ferramentas de IA Premium, Criador e Clonador de Páginas, IA, templates e plugins, +350 Cursos e Automação Total.</span>
            <br/><br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80] font-bold text-xl">Economize mais de R$ 7.000/mês</span><br/>
            Construa, lance e escale no mesmo dia.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <a href="#pricing" className="bg-[#29654f] hover:bg-[#3db370] text-white text-base font-black py-4 px-8 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center group border border-[#29654f]/50 hover:border-[#3db370] transition-all duration-300 active:scale-95" style={{ willChange: 'transform' }}>
              Desbloquear Meu Acesso Agora <Rocket className="ml-2 w-5 h-5" />
            </a>
            <button className="bg-gray-200 hover:bg-gray-300 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white text-base font-semibold py-4 px-8 rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-300 active:scale-95" style={{ willChange: 'transform' }}>
              <Play className="mr-2 w-4 h-4 fill-current" /> Ver Tudo Por Dentro
            </button>
          </div>

          <p className="mt-6 text-sm font-bold text-white/80 flex items-center justify-center gap-1">
            <Zap size={14} className="text-[#4ade80]" /> Garanta seu acesso exclusivo antes que a oferta acabe!
          </p>

          <div className="mt-16 mb-24 border-t border-gray-200 dark:border-white/10 pt-8 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
             {STATS.map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stat.value}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{stat.label}</span>
              </div>
             ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<SectionLoader />}>
        <InfiniteCarousel />
      </Suspense>

      {/* BENEFITS BENTO GRID SECTION (MOVED UP) */}
      <section className="pt-20 md:pt-32 pb-16 md:pb-24 bg-white dark:bg-[#0f0f0f] relative transition-colors duration-200" id="por-que-lowfy">
         {/* Decorative light orbs */}
         <div className="absolute top-20 left-10 w-64 h-64 bg-purple-600 rounded-full blur-[120px] opacity-10 dark:opacity-5 pointer-events-none" />
         <div className="absolute bottom-20 right-10 w-72 h-72 bg-[#29654f] rounded-full blur-[140px] opacity-10 dark:opacity-5 pointer-events-none" />
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
           <div className="text-center mb-12">
             <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">Por que a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80]">Lowfy</span>?</h2>
             <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Tudo em um só lugar.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 mb-8">
             {BENEFITS_GRID.map((item, i) => (
               <div key={i} className={`${item.colSpan} bg-white dark:bg-[#0f0f0f] p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-[#29654f] transition-colors duration-200 group relative overflow-hidden shadow-md dark:shadow-none hover:shadow-lg`}>
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-gray-900 dark:text-white">
                    <item.icon size={80} />
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg flex items-center justify-center text-[#29654f] dark:text-[#4ade80] mb-4">
                       <item.icon size={32} />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
               </div>
             ))}
           </div>
         </div>
      </section>

      {/* SHOWCASE DE FERRAMENTAS DETALHADO - CAROUSEL */}
      <LazySection fallback={<div className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] min-h-[400px]" />}>
        <section className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] relative transition-colors duration-200" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
                Arsenal de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80]">Ferramentas</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-2xl mx-auto text-sm md:text-base">
                Mais de 39 ferramentas premium, +250 landing pages, +150 automações N8N, pack de plugins, criador de anúncios Andromeda — tudo que você precisa para criar, vender e escalar — segurança e perfis prontos.
              </p>
            </div>

            {/* Category Tabs - Wrapped on mobile */}
            <div className="flex flex-wrap justify-center gap-3 mb-10 px-4 md:px-0">
              {AI_TOOL_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveToolCategory(cat.id)}
                  className={`flex items-center px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-colors duration-200 border shadow-sm flex-shrink-0 ${
                    activeToolCategory === cat.id 
                    ? 'bg-[#29654f] text-white shadow-[0_0_20px_rgba(41,101,79,0.3)] border-[#29654f]' 
                    : 'bg-white dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 border-gray-200 dark:border-gray-800 hover:border-[#29654f]/50 transition-colors duration-200'
                  }`}
                >
                  <cat.icon className="w-4 h-4 mr-2" />
                  {cat.title}
                </button>
              ))}
            </div>

            {/* Tool Cards Carousel */}
            <Suspense fallback={<SectionLoader />}>
              <UiCarousel>
                {AI_TOOL_CATEGORIES.find(c => c.id === activeToolCategory)?.tools.map((tool, idx) => (
                  <div key={idx} className="min-w-[300px] bg-white dark:bg-[#2a2a2a] rounded-xl border border-[#e0e7e1] dark:border-gray-800 hover:border-[#29654f] dark:hover:border-[#29654f] transition-colors duration-200 group flex flex-col relative overflow-hidden shadow-sm hover:shadow-md dark:shadow-none snap-start">
                    
                    {/* Logo Container - Compacto */}
                    <div className="h-20 w-full bg-white flex items-center justify-center p-4 border-b border-[#e0e7e1] dark:border-gray-700 relative">
                        {tool.logo ? (
                           <img 
                             src={tool.logo} 
                             alt={`${tool.name} - Ferramenta Premium de ${activeToolCategory}`} 
                             className={`w-auto object-contain ${tool.name === 'Sora AI' ? 'h-24' : tool.name === 'Ideogram' ? 'h-40' : tool.name === 'You.com' ? 'h-28' : tool.name === 'SemRush' ? 'h-24' : 'h-12'}`} 
                             loading="lazy"
                             decoding="async"
                             width="auto"
                             height={tool.name === 'Sora AI' ? '96' : tool.name === 'Ideogram' ? '160' : tool.name === 'You.com' ? '112' : tool.name === 'SemRush' ? '96' : '48'}
                           />
                         ) : (
                           <span className="text-4xl font-black text-[#29654f]">{tool.name.charAt(0)}</span>
                         )}
                    </div>

                    <div className="p-4 flex flex-col relative">
                        <h4 className="text-xl font-black text-gray-900 dark:text-white mb-1.5 line-clamp-1">{tool.name}</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-snug line-clamp-2 mb-3">{tool.desc}</p>
                        
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <span className="text-sm font-black flex items-center text-[#29654f] dark:text-[#4ade80]">
                                <CheckCircle size={16} className="text-[#29654f] dark:text-[#4ade80] mr-2" /> Incluso
                            </span>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg border-2 shadow-sm ${tool.marketPrice.includes('Free') ? 'bg-green-500 text-white border-green-600 dark:bg-green-600 dark:border-green-700' : 'bg-red-500 text-white border-red-600 dark:bg-red-600 dark:border-red-700'}`}>
                                {tool.marketPrice}
                            </span>
                        </div>
                    </div>
                  </div>
                ))}
              </UiCarousel>
            </Suspense>
          </div>
        </section>
      </LazySection>

      {/* PLR GLOBAL SECTION */}
      <LazySection fallback={<div className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] min-h-[400px]" />}>
        <section id="plr" className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] relative border-y border-gray-200 dark:border-gray-900 overflow-hidden transition-colors duration-200">
          <div className="absolute inset-0 opacity-10 dark:opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/World_map_blank_without_borders.svg/2000px-World_map_blank_without_borders.svg.png')] bg-no-repeat bg-center bg-contain grayscale dark:invert-0"></div>

         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <div className="lg:w-1/2 order-2 lg:order-1">
                 <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="bg-white dark:bg-[#0f0f0f] rounded-xl border border-gray-200 dark:border-gray-800 p-6 md:p-8 relative shadow-xl dark:shadow-none">
                       <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                         <Globe className="text-blue-600 dark:text-blue-500" /> Disponível em 7 Idiomas
                       </h3>
                       <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-8">
                          {PLR_LANGUAGES.map((lang, i) => (
                            <div key={i} className="flex flex-col items-center p-2 bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors cursor-default shadow-sm dark:shadow-none">
                               <img 
                                src={`https://flagcdn.com/w80/${lang.code.toLowerCase()}.png`} 
                                alt={lang.name}
                                className="w-8 h-auto mb-2 rounded shadow-sm"
                                width="32"
                                height="24"
                                loading="lazy"
                                decoding="async"
                              />
                              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{lang.code}</span>
                            </div>
                          ))}
                       </div>
                       <div className="space-y-2">
                          {PLR_INCLUDES.map((inc, i) => (
                            <div key={i} className="flex items-center text-gray-700 dark:text-gray-300 p-2.5 bg-white dark:bg-[#2a2a2a]/50 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-500/30 transition-colors shadow-sm dark:shadow-none">
                               <inc.icon className="w-4 h-4 text-[#29654f] mr-3" />
                               <span className="font-medium text-xs md:text-sm">{inc.item}</span>
                               <Check className="w-3.5 h-3.5 text-[#29654f] dark:text-[#4ade80] ml-auto" />
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
              <div className="lg:w-1/2 order-1 lg:order-2">
                 <div className="inline-block px-3 py-1 border border-blue-500/50 text-blue-600 dark:text-blue-400 text-xs font-bold mb-4 rounded bg-blue-500/10">
                    INTERNACIONALIZAÇÃO
                 </div>
                 <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-6">
                   <span className="text-blue-600 dark:text-blue-500">Ganhe em Dólar</span> com PLRs Globais.
                 </h2>
                 <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-8 leading-relaxed">
                   Esqueça a saturação do mercado brasileiro. Nossa biblioteca oferece PLRs validados, com estruturas completas, tradução nativa e prontas para gerar lucros em diversos mercados internacionais.
                 </p>
                 
                 <div>
                   <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">Como Funciona:</h3>
                   <ul className="space-y-3">
                     {[
                       'Baixe o pacote completo (JSON + MP4 + PDF)',
                       'Suba no WordPress com Elementor Pro em 1 clique (fácil e rápido)',
                       'Comece a vender em Dólar, Euro ou outras moedas imediatamente'
                     ].map((text, i) => (
                       <li key={i} className="flex items-center text-sm md:text-base text-gray-700 dark:text-white">
                         <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mr-3 text-blue-600 dark:text-blue-500 font-bold text-xs md:text-sm flex-shrink-0">
                           {i + 1}
                         </div>
                         {text}
                       </li>
                     ))}
                   </ul>
                 </div>
              </div>
            </div>
          </div>
        </section>
      </LazySection>

      {/* COURSES ACADEMY SECTION - CAROUSEL */}
      <LazySection fallback={<div className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] min-h-[400px]" />}>
        <section id="academy" className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] relative transition-colors duration-200">
           {/* Decorative light orbs */}
           <div className="absolute top-0 right-1/4 w-80 h-80 bg-pink-500 rounded-full blur-[140px] opacity-10 dark:opacity-5 pointer-events-none" />
           <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#29654f] rounded-full blur-[150px] opacity-10 dark:opacity-5 pointer-events-none" />
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="text-center mb-12">
                 <div className="inline-block px-3 py-1 border border-[#29654f]/50 text-[#29654f] dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-[#29654f] dark:to-[#4ade80] text-xs font-bold mb-6 rounded bg-[#29654f]/10 dark:bg-[#29654f]/5">
                    LOWFY ACADEMY
                 </div>
                 <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-3">A "<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-500">Netflix</span>" do Digital</h2>
                 <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">Acesso a mais de 350 cursos do mercado, com conteúdo exclusivo dos maiores players do marketing digital.</p>
              </div>

              <Suspense fallback={<SectionLoader />}>
                <UiCarousel>
                   {COURSE_CATEGORIES.map((course, i) => (
                     <div key={i} className="min-w-[280px] md:min-w-[340px] group relative h-64 rounded-2xl overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-800 hover:border-[#29654f] dark:hover:border-[#29654f] transition-colors duration-200 shadow-lg dark:shadow-none snap-start">
                        <img 
                          src={course.image} 
                          alt={`Curso de ${course.name} - Lowfy Academy`} 
                          className="absolute inset-0 w-full h-full object-cover opacity-90 dark:opacity-40"
                          loading="lazy"
                          decoding="async"
                          width="340"
                          height="256"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-5 w-full">
                           <div className="flex justify-between items-center mb-2">
                              <div className="w-8 h-8 rounded-full bg-[#29654f] flex items-center justify-center text-white">
                                 <course.icon size={16} />
                              </div>
                           </div>
                           <h3 className="text-xl font-bold text-white mb-1">{course.name}</h3>
                           <p className="text-gray-300 text-xs flex items-center gap-1 group-hover:text-[#4ade80] transition-colors">
                              Assistir Trilha <ArrowRight size={12} />
                           </p>
                        </div>
                     </div>
                   ))}
                </UiCarousel>
              </Suspense>
           </div>
        </section>
      </LazySection>

      {/* QUIZ INTERACTIVE SECTION */}
      <section className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] border-y border-gray-200 dark:border-gray-900 relative transition-colors duration-200" id="quiz">
        {/* Decorative light orbs */}
        <div className="absolute top-1/4 right-1/3 w-72 h-72 bg-purple-600 rounded-full blur-[130px] opacity-10 dark:opacity-6 pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-blue-500 rounded-full blur-[140px] opacity-10 dark:opacity-6 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
           <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              <div className="lg:w-5/12">
                 <div className="inline-block px-3 py-1 border border-purple-500/50 text-purple-600 dark:text-purple-400 text-xs font-bold mb-6 rounded bg-purple-500/10">
                    ENGAJAMENTO MÁXIMO
                 </div>
                 <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-6">
                    Quiz Interativo <br/><span className="text-purple-600 dark:text-purple-500">Viral</span>.
                 </h2>
                 <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-4">
                    Transforme visitantes frios em leads quentes e aumente suas conversões com quizzes altamente engajadores.
                 </p>
                 <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-8">
                    Crie quizzes personalizados de diagnóstico, recomendação de produtos ou personalidade em minutos e conquiste seu público de forma viral.
                 </p>
                 
                 <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Benefícios Imediatos:</h3>
                    <div className="space-y-4">
                       {QUIZ_FEATURES.map((feat, i) => (
                          <div key={i} className="flex gap-4 items-start">
                             <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-500 shrink-0">
                                <feat.icon size={20} />
                             </div>
                             <div>
                                <h4 className="text-gray-900 dark:text-white font-bold text-sm">{feat.title}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{feat.desc}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="lg:w-7/12 relative w-full">
                 {/* Quiz Simulator Card - STATIC decorative element */}
                 <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md mx-auto shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-200 relative z-10 border border-purple-300 pointer-events-none" style={{ minHeight: '400px' }}>
                    <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
                       <div className="h-full bg-purple-600 rounded-full" style={{width: '33%'}}></div>
                    </div>
                    
                    <div className="quiz-content">
                       <h3 className="text-xl md:text-2xl font-black text-purple-600 mb-2 text-center">Qual seu maior objetivo?</h3>
                       <p className="text-gray-500 text-center mb-6 text-xs">Pergunta 1 de 3</p>

                       <div className="space-y-3">
                          <div className="w-full p-4 rounded-xl border-2 border-purple-600 bg-purple-600 text-white font-bold flex justify-between items-center text-sm md:text-base">
                             Vender sem aparecer (PLR)
                             <div className="w-4 h-4 rounded-full border-2 border-white bg-white flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                             </div>
                          </div>
                          <div className="w-full p-4 rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-bold flex justify-between items-center text-sm md:text-base">
                             Criar minha marca pessoal
                             <div className="w-4 h-4 rounded-full border-2 border-gray-400"></div>
                          </div>
                          <div className="w-full p-4 rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-bold flex justify-between items-center text-sm md:text-base">
                             Prestar serviços (Freelancer)
                             <div className="w-4 h-4 rounded-full border-2 border-gray-400"></div>
                          </div>
                       </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                       <div className="bg-purple-600 text-white font-bold py-2.5 px-8 rounded-full shadow-lg text-sm">
                          Próximo
                       </div>
                    </div>
                 </div>
                 
                 {/* Decorative Elements */}
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500 rounded-full blur-[80px] opacity-20 dark:opacity-50"></div>
                 <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500 rounded-full blur-[80px] opacity-20 dark:opacity-50"></div>
              </div>
           </div>
        </div>
      </section>

      {/* CLONER & BUILDER SECTION - WITH TABS */}
      <section className="py-16 md:py-24 bg-white dark:bg-[#0f0f0f] relative overflow-hidden transition-colors duration-200" id="cloner">
        {/* Decorative light orbs */}
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-yellow-500 rounded-full blur-[130px] opacity-10 dark:opacity-5 pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-pink-600 rounded-full blur-[140px] opacity-10 dark:opacity-5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* TABS - Always visible at top - Pill Style */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex gap-1 p-1.5 bg-gray-900 dark:bg-gray-900/80 rounded-full border border-gray-700 dark:border-gray-800 shadow-lg">
              <button
                onClick={() => setActiveTab('cloner')}
                data-testid="button-tab-cloner"
                className={`px-6 py-2.5 rounded-full font-bold text-sm md:text-base transition-colors duration-200 flex items-center gap-2 ${
                  activeTab === 'cloner'
                    ? 'bg-[#29654f] text-white shadow-md'
                    : 'text-gray-400 dark:text-gray-400 hover:text-gray-200'
                }`}
              >
                <Copy size={18} /> Clonador de páginas
              </button>
              <button
                onClick={() => setActiveTab('builder')}
                data-testid="button-tab-builder"
                className={`px-6 py-2.5 rounded-full font-bold text-sm md:text-base transition-colors duration-200 flex items-center gap-2 ${
                  activeTab === 'builder'
                    ? 'bg-gray-700 text-white shadow-md'
                    : 'text-gray-400 dark:text-gray-400 hover:text-gray-200'
                }`}
              >
                <Layout size={18} /> Clonador de Página
              </button>
            </div>
          </div>

          {/* CLONER TAB - Title & Description inside */}
          {activeTab === 'cloner' && (
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80]">Clonagem</span> Profissional de Páginas
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-sm md:text-base">
                Importe, limpe, edite e publique — tudo em menos de 20 segundos.
              </p>
            </div>
          )}

          {/* BUILDER TAB - Title & Description inside */}
          {activeTab === 'builder' && (
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-3">
                Páginas de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500">Alta Conversão</span> em Segundos
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-sm md:text-base">
                Crie Pre-Sells, VSLs e Páginas de Obrigado profissionais com gatilhos de escassez, urgência e persuasão — sem código.
              </p>
            </div>
          )}

          {/* CLONER TAB CONTENT */}
          {activeTab === 'cloner' && (
            <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xl transition-colors">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-5/12 p-6 md:p-8 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0f0f0f]/50">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Como Funciona</h3>
                   <div className="space-y-5 relative">
                     <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-800 z-0"></div>
                     {CLONER_PROCESS_STEPS.map((step, i) => (
                       <div key={i} className="flex gap-4 relative z-10">
                         <div className={`w-10 h-10 rounded-full bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-700 flex flex-shrink-0 items-center justify-center shadow-md text-[#29654f] dark:text-[#4ade80] font-bold text-lg`}>
                           {i + 1}
                         </div>
                         <div>
                           <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{step.title}</h4>
                           <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="lg:w-7/12 p-4 md:p-6 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-900 dark:to-dark-950 min-h-[350px] md:min-h-[420px]">
                   <LazyVideo 
                     src="/clonador-demo-compressed.mp4" 
                     className="w-full h-full rounded-lg shadow-lg"
                   />
                </div>
              </div>
            </div>
          )}

          {/* BUILDER TAB CONTENT */}
          {activeTab === 'builder' && (
            <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xl transition-colors">
              <div className="flex flex-col lg:flex-row-reverse">
                <div className="lg:w-5/12 p-6 md:p-8 flex flex-col border-b lg:border-b-0 lg:border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0f0f0f]/50">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Como Funciona</h3>
                   <div className="space-y-5 relative">
                     <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-800 z-0"></div>
                     {[
                       { title: 'Monte com Blocos', desc: 'Arraste e solte textos, imagens, timers, provas sociais e CTAs.' },
                       { title: 'Personalize Fácil', desc: 'Edite cores, layout e estrutura visual com total liberdade.' },
                       { title: 'Gatilhos que Vendem', desc: 'Escassez, urgência e elementos persuasivos integrados.' },
                       { title: 'Publique em Segundos', desc: 'Coloque sua página no ar e rode tráfego imediatamente. (hospedagem inclusa)' }
                     ].map((step, i) => (
                       <div key={i} className="flex gap-4 relative z-10">
                         <div className="w-10 h-10 rounded-full bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-700 flex flex-shrink-0 items-center justify-center shadow-md text-blue-600 dark:text-blue-400 font-bold">
                           {i + 1}
                         </div>
                         <div>
                           <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{step.title}</h4>
                           <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="lg:w-7/12 p-4 md:p-6 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-900 dark:to-dark-950 min-h-[350px] md:min-h-[420px]">
                   <LazyVideo 
                     src="/adobe-express-demo-compressed.mp4" 
                     className="w-full h-full rounded-lg shadow-lg"
                   />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COMMUNITY SECTION - AUTO-ADVANCING TABS */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-[#0f0f0f] relative overflow-hidden transition-colors duration-200" id="community">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header */}
            <div className="mb-12">
               <div className="inline-block px-3 py-1 border border-[#29654f]/50 dark:border-[#4ade80]/50 text-[#29654f] dark:text-[#4ade80] text-xs font-bold mb-4 rounded bg-[#29654f]/5 dark:bg-[#4ade80]/5">
                  COMUNIDADE LOWFY
               </div>
               <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">
                  Fórum, Timeline e <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#29654f] to-[#4ade80]">Gamificação</span>
               </h2>
               <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">
                  A Comunidade onde você evolui todos os dias.
               </p>
            </div>

            {/* Tabs Layout - Left Vertical List, Right Content */}
            <div className="bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xl dark:shadow-2xl">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                  {/* Left Column - Vertical Tabs */}
                  <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800">
                     <div className="space-y-4">
                        {[
                           { 
                              id: 'forum', 
                              label: 'Discussões Profundas', 
                              desc: 'Conversas estruturadas sobre estratégia, tráfego, PLR, IA e escala.\nAprenda diretamente com membros experientes e tópicos avançados.', 
                              icon: MessageCircle 
                           },
                           { 
                              id: 'timeline', 
                              label: 'Timeline em Tempo Real', 
                              desc: 'Feed ao estilo Facebook para interações rápidas, postagens, comentários, insights e networking com o restante da comunidade.', 
                              icon: Zap 
                           },
                           { 
                              id: 'gamification', 
                              label: 'Gamificação', 
                              desc: 'Ganhe XP, suba de nível, desbloqueie badges e conquiste posições no ranking.\nA evolução vira um jogo — e você é recompensado por participar.', 
                              icon: Trophy 
                           }
                        ].map((tab) => {
                           const TabIcon = tab.icon;
                           const isActive = activeCommunityTab === tab.id;
                           return (
                              <button
                                 key={tab.id}
                                 onClick={() => setActiveCommunityTab(tab.id as any)}
                                 data-testid={`button-community-tab-${tab.id}`}
                                 className={`w-full text-left p-4 rounded-lg transition-all duration-200 border-l-4 ${
                                    isActive
                                       ? 'bg-gray-50 dark:bg-[#0f0f0f]/80 border-l-[#29654f] dark:border-l-[#4ade80]'
                                       : 'bg-transparent hover:bg-gray-50/50 dark:hover:bg-dark-900/50 border-l-transparent'
                                 }`}
                              >
                                 <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${isActive ? 'bg-[#29654f]/20' : 'bg-gray-100 dark:bg-[#2a2a2a]'}`}>
                                       <TabIcon className={`w-5 h-5 ${isActive ? 'text-[#29654f] dark:text-[#4ade80]' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <h4 className={`font-bold text-sm md:text-base ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                          {tab.label}
                                       </h4>
                                       <p className={`text-xs md:text-sm mt-1 ${isActive ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}`}>
                                          {tab.desc}
                                       </p>
                                    </div>
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </div>

                  {/* Right Column - Content (2 columns wide) */}
                  <div className="lg:col-span-2 p-6 md:p-8 bg-gradient-to-br from-transparent to-gray-50 dark:from-transparent dark:to-dark-900/30 h-[700px] md:h-[750px] overflow-y-auto">
                     {activeCommunityTab === 'forum' && (
                        <div className="space-y-4">
                           <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-6">Tópicos em Discussão</h3>
                           {FORUM_TOPICS.slice(0, 6).map((topic, idx) => {
                              const userImages = [
                                 'https://randomuser.me/api/portraits/women/1.jpg',
                                 'https://randomuser.me/api/portraits/men/2.jpg',
                                 'https://randomuser.me/api/portraits/women/3.jpg',
                                 'https://randomuser.me/api/portraits/men/4.jpg',
                                 'https://randomuser.me/api/portraits/women/5.jpg',
                                 'https://randomuser.me/api/portraits/men/6.jpg'
                              ];
                              return (
                                 <div key={idx} className="p-4 bg-white dark:bg-[#0f0f0f] rounded-lg border border-gray-100 dark:border-[#333] cursor-pointer hover:border-[#29654f] dark:hover:border-[#4ade80] transition-colors group">
                                    <div className="flex gap-3 mb-3">
                                       <img src={userImages[idx]} alt={`User ${idx + 1}`} className="w-10 h-10 rounded-full object-cover flex-shrink-0" width="40" height="40" loading="lazy" decoding="async" />
                                       <div className="flex-1">
                                          <h5 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-[#29654f] dark:group-hover:text-[#4ade80] transition-colors">{topic.title}</h5>
                                          <div className="flex items-center gap-2 mt-1">
                                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${FORUM_CATEGORIES.find(c => c.name === topic.tag)?.color || 'bg-gray-500'}`}>
                                                {topic.tag}
                                             </span>
                                             <span className="text-xs text-gray-500 dark:text-gray-400">{Math.floor(Math.random() * 50)} respostas</span>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}

                     {activeCommunityTab === 'timeline' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {/* LEFT SIDEBAR - Profile */}
                           <div className="md:col-span-1 space-y-4">
                              {/* Profile Card */}
                              <div className="bg-white dark:bg-[#0f0f0f] rounded-lg border border-gray-100 dark:border-[#333] overflow-hidden">
                                 <div className="h-20 bg-gradient-to-r from-[#29654f] to-[#4ade80]"></div>
                                 <div className="p-4 text-center -mt-6 relative z-10">
                                    <div className="w-16 h-16 mx-auto mb-3 rounded-full border-4 border-white dark:border-dark-900 overflow-hidden flex-shrink-0">
                                       <img src="https://randomuser.me/api/portraits/men/7.jpg" alt="Lucas Felipe" className="w-full h-full object-cover" width="64" height="64" loading="lazy" decoding="async" />
                                    </div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">Lucas Felipe</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Professional</p>
                                 </div>
                                 
                                 {/* Stats */}
                                 <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                       <div>
                                          <Trophy size={16} className="text-yellow-500 inline mr-2" />
                                          <span className="text-sm font-bold text-gray-900 dark:text-white">3 / 100 XP</span>
                                       </div>
                                       <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Nv 1</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-[#2a2a2a] rounded-full h-2">
                                       <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full" style={{width: '3%'}}></div>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Novato</p>
                                 </div>

                                 {/* Posts Stats */}
                                 <div className="p-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                       <p className="text-lg font-bold text-gray-900 dark:text-white">0</p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400">Posts</p>
                                    </div>
                                    <div>
                                       <p className="text-lg font-bold text-gray-900 dark:text-white">1</p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400">Nível</p>
                                    </div>
                                    <div>
                                       <p className="text-lg font-bold text-gray-900 dark:text-white">0</p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400">Seguidores</p>
                                    </div>
                                 </div>

                                 {/* Weekly Goals */}
                                 <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                       <Award size={16} /> Metas Semanais
                                    </p>
                                    {[
                                       { title: 'Criador de Conteúdo', xp: '+50 XP', progress: 3, total: 5 },
                                       { title: 'Influenciador', xp: '+40 XP', progress: 0, total: 20 },
                                       { title: 'Iniciador de Discussões', xp: '+30 XP', progress: 0, total: 2 }
                                    ].map((goal, idx) => (
                                       <div key={idx} className="text-xs">
                                          <div className="flex items-center justify-between mb-1">
                                             <span className="text-gray-700 dark:text-gray-300 font-semibold">{goal.title}</span>
                                             <span className="text-green-600 dark:text-green-400 font-bold">{goal.xp}</span>
                                          </div>
                                          <div className="flex items-center justify-between mb-2">
                                             <div className="w-full bg-gray-200 dark:bg-[#2a2a2a] rounded-full h-1.5 mr-2">
                                                <div className="bg-gradient-to-r from-green-400 to-green-600 h-1.5 rounded-full" style={{width: `${(goal.progress / goal.total) * 100}%`}}></div>
                                             </div>
                                             <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{goal.progress} / {goal.total}</span>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>

                           {/* MIDDLE - Feed */}
                           <div className="md:col-span-2 space-y-4">
                              {/* Compose Post */}
                              <div className="bg-white dark:bg-[#0f0f0f] rounded-lg border border-gray-100 dark:border-[#333] p-4">
                                 <div className="flex gap-3 mb-4">
                                    <input type="text" placeholder="Compartilhe algo interessante... Use # para adicionar hashtags!" className="flex-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#29654f]"/>
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200">●●●</button>
                                 </div>
                                 <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex gap-3">
                                       <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200" title="Imagem">
                                          <Heart size={18} />
                                       </button>
                                       <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200" title="Vídeo">
                                          <MessageCircle size={18} />
                                       </button>
                                       <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200" title="Arquivo">
                                          <Share2 size={18} />
                                       </button>
                                    </div>
                                    <button className="px-4 py-2 bg-[#29654f] hover:bg-[#1f4a38] text-white rounded-lg font-bold text-sm transition">
                                       Publicar
                                    </button>
                                 </div>
                              </div>

                              {/* Feed Posts */}
                              <div className="space-y-3">
                                 {[1, 2].map((post) => {
                                    const postAvatars = ['https://randomuser.me/api/portraits/women/2.jpg', 'https://randomuser.me/api/portraits/men/3.jpg'];
                                    return (
                                    <div key={post} className="bg-white dark:bg-[#0f0f0f] rounded-lg border border-gray-100 dark:border-[#333] p-4">
                                       <div className="flex items-start justify-between mb-3">
                                          <div className="flex gap-3">
                                             <img src={postAvatars[post - 1]} alt={`User ${post}`} className="w-10 h-10 rounded-full object-cover flex-shrink-0" width="40" height="40" loading="lazy" decoding="async" />
                                             <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">Usuário #{post}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Professional</p>
                                             </div>
                                          </div>
                                          <button className="text-gray-400">···</button>
                                       </div>
                                       <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Compartilhou uma estratégia incrível</p>
                                       <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                                          <button className="flex items-center gap-1 hover:text-red-600">❤ (0)</button>
                                          <button className="flex items-center gap-1 hover:text-blue-600">💬 (0)</button>
                                          <button className="flex items-center gap-1 hover:text-blue-600">↗ (0)</button>
                                       </div>
                                    </div>
                                    );
                                 })}
                              </div>
                           </div>

                        </div>
                     )}

                     {activeCommunityTab === 'gamification' && (
                        <div className="space-y-4">
                           <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                              <Trophy size={24} className="text-yellow-500" /> Níveis e Progressão
                           </h3>
                           
                           {[
                              { name: 'Novato', level: 1, xp: '0 - 99 XP', desc: 'Começando a jornada na plataforma', icon: Zap, bgColor: 'from-green-400 to-green-600' },
                              { name: 'Aprendiz', level: 2, xp: '100 - 299 XP', desc: 'Aprendendo e participando ativamente', icon: Layout, bgColor: 'from-blue-400 to-blue-600' },
                              { name: 'Contribuidor', level: 3, xp: '300 - 599 XP', desc: 'Contribuindo regularmente com a comunidade', icon: Users, bgColor: 'from-purple-400 to-purple-600' },
                              { name: 'Mentor', level: 4, xp: '600 - 999 XP', desc: 'Ajudando e guiando outros membros', icon: Gift, bgColor: 'from-orange-400 to-orange-600' },
                              { name: 'Mestre', level: 5, xp: '1000+ XP', desc: 'Expertise máxima e liderança na comunidade', icon: Crown, bgColor: 'from-yellow-400 to-yellow-600' }
                           ].map((tier, idx) => {
                              const TierIcon = tier.icon;
                              return (
                                 <div key={idx} className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f] hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                                    <div className="flex items-start gap-3">
                                       <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${tier.bgColor} flex items-center justify-center text-white`}>
                                          <TierIcon size={20} />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                             <h4 className="text-base font-black text-gray-900 dark:text-white">{tier.name}</h4>
                                             <span className="px-2 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] rounded text-xs font-bold text-gray-700 dark:text-gray-300">Nível {tier.level}</span>
                                          </div>
                                          <p className="text-xs text-gray-600 dark:text-gray-400 font-bold mb-1">{tier.xp}</p>
                                          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{tier.desc}</p>
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* BENTO FEATURES SECTION */}
      <Suspense fallback={<SectionLoader />}>
        <BentoFeatures />
      </Suspense>

      {/* MARKETPLACE SELLER SECTION */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-[#0f0f0f] border-t border-gray-200 dark:border-gray-900 transition-colors duration-200" id="marketplace">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center mb-12">
               <div className="inline-block px-3 py-1 border border-[#29654f]/50 dark:border-[#4ade80]/50 text-[#29654f] dark:text-[#4ade80] text-xs font-bold mb-4 rounded bg-[#29654f]/5 dark:bg-[#4ade80]/5">
                  MARKETPLACE
               </div>
               <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4">
                 Lucre Dentro da <span className="text-[#29654f] dark:text-[#4ade80]">Lowfy</span>.
               </h2>
               <p className="text-gray-600 dark:text-gray-400 max-w-3xl text-sm md:text-base">
                 Se você tem algo para vender, a Lowfy tem quem compre. Publique, alcance usuários e gere vendas rapidamente.
               </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-10 items-center">
               {/* Left Column: The Pitch */}
               <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-lg dark:shadow-none">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                       <Banknote className="text-[#29654f] dark:text-[#00ff9d]" size={20} /> O que vender?
                     </h3>
                     <div className="grid grid-cols-2 gap-3">
                        {SELLABLE_ITEMS.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg border border-gray-100 dark:border-gray-700/50 hover:border-[#29654f]/50 dark:hover:border-[#00ff9d]/50 transition-colors">
                             <item.icon size={16} className="text-gray-400" />
                             <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Right Column: Dashboard Simulator */}
               <div className="lg:col-span-7 w-full">
                  <div className="relative group">
                     <div className="absolute -inset-1 bg-gradient-to-b from-[#29654f] to-[#4ade80] rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                     <div className="relative bg-white dark:bg-[#0f0f0f] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 md:p-8 shadow-2xl transition-colors">
                        {/* Mockup Header */}
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-b dark:border-[#333] dark:border-gray-800">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#29654f] rounded-lg flex items-center justify-center shadow-md">
                                 <Zap className="text-white w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase">Painel</p>
                                 <p className="text-gray-900 dark:text-white font-bold text-sm">Minha Loja</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0f0f0f] px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400">Online</span>
                           </div>
                        </div>

                        {/* Financial Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                           <div className="bg-gray-50 dark:bg-[#0f0f0f] p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Disponível</p>
                              <p className="text-3xl font-black text-gray-900 dark:text-white mb-3">R$ 3.240,00</p>
                              <button className="w-full px-4 py-3 bg-[#29654f] hover:bg-[#1f4a38] dark:bg-[#4ade80] dark:hover:bg-[#2ddc6f] text-white dark:text-black font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-[#29654f]/40">
                                 SACAR <ArrowRight size={16} />
                              </button>
                           </div>
                           <div className="bg-gray-50 dark:bg-[#0f0f0f] p-6 rounded-xl border border-gray-200 dark:border-gray-800">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">A Liberar</p>
                              <p className="text-3xl font-black text-gray-900 dark:text-white">R$ 1.450,90</p>
                           </div>
                        </div>

                        {/* Features Icons Footer */}
                        <div className="flex flex-wrap justify-between items-center text-xs text-gray-600 dark:text-gray-400 gap-3">
                           <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#29654f] dark:text-[#4ade80]" /> Seguro</span>
                           <span className="flex items-center gap-2"><CreditCard size={16} className="text-[#29654f] dark:text-[#4ade80]" /> Pix/Card</span>
                           <span className="flex items-center gap-2"><Download size={16} className="text-[#29654f] dark:text-[#4ade80]" /> Acesso imediato</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* AFFILIATE SECTION - SIDE BY SIDE WITH COMMUNITY */}
      <section className="py-16 md:py-20 bg-gray-100 dark:bg-[#0f0f0f] relative overflow-hidden transition-colors duration-200" id="afiliado">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
           <div className="text-center mb-12">
             <div className="inline-flex items-center justify-center p-3 bg-[#29654f]/10 dark:bg-[#29654f]/20 rounded-full mb-6">
               <Coins className="text-[#29654f] dark:text-[#4ade80] w-8 h-8" />
             </div>
             <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-6">
               Lucre <span className="text-[#29654f] dark:text-[#4ade80]">50% Recorrente</span>
             </h2>
             <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
               Indique a Lowfy e ganhe metade do valor da assinatura todo mês. <br/> <span className="text-[#29654f] dark:text-[#4ade80] font-bold">2 Indicações = Sua assinatura sai de graça.</span>
             </p>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
             {/* Card 1 */}
             <div className="bg-white dark:bg-[#0f0f0f] p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-[#29654f] transition-colors duration-200 shadow-lg dark:shadow-none text-center">
               <p className="text-gray-500 text-xs mb-4 font-bold uppercase tracking-wider">10 Indicações</p>
               <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">R$ 500</p>
               <span className="text-xs text-gray-500 font-normal">/mês no seu bolso</span>
             </div>
             
             {/* Card 2 (Featured) */}
             <div className="bg-gradient-to-b from-[#29654f]/10 to-white dark:to-dark-900 p-8 md:p-10 rounded-3xl border-2 border-[#29654f] transform md:scale-110 shadow-2xl relative text-center z-10 pointer-events-auto">
               <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#29654f] dark:bg-[#4ade80] text-white dark:text-black text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  META RECOMENDADA
               </div>
               <p className="text-[#29654f] dark:text-[#4ade80] text-sm mb-4 font-bold uppercase tracking-wider">50 Indicações</p>
               <p className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">R$ 2.500</p>
               <span className="text-xs text-gray-500 dark:text-gray-300 font-bold">/mês (Salário Júnior)</span>
             </div>
             
             {/* Card 3 */}
             <div className="bg-white dark:bg-[#0f0f0f] p-6 md:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 hover:border-[#29654f] transition-colors duration-200 shadow-lg dark:shadow-none text-center">
               <p className="text-gray-500 text-xs mb-4 font-bold uppercase tracking-wider">100 Indicações</p>
               <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">R$ 5.000</p>
               <span className="text-xs text-gray-500 font-normal">/mês (Liberdade)</span>
             </div>
           </div>
        </div>
      </section>


      {/* TESTIMONIALS SECTION */}
      <div id="testimonials">
        <Suspense fallback={<SectionLoader />}>
          <Testimonials />
        </Suspense>
      </div>

      {/* PRICING */}
      <section id="pricing" className="py-16 md:py-24 relative overflow-hidden bg-gray-50 dark:bg-[#0f0f0f] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white dark:bg-[#0f0f0f]/80 backdrop-blur-md rounded-[2.5rem] border border-[#29654f]/30 dark:border-[#29654f] shadow-[0_10px_50px_rgba(41,101,79,0.15)] dark:shadow-[0_0_100px_rgba(41,101,79,0.15)] overflow-hidden relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#29654f] to-[#4ade80] rounded-[2.5rem] blur opacity-5 dark:opacity-10 group-hover:opacity-20 transition duration-1000"></div>
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#29654f] via-[#4ade80] to-[#29654f]"></div>
            
            <div className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row gap-8 md:gap-12">
              
              {/* Column 1: Pricing & Title */}
              <div className="flex-1 flex flex-col justify-between text-center md:text-left">
                <div>
                  <div className="inline-block bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    OFERTA DE FINAL DE ANO:
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">Acesso Total Lowfy</h2>
                  <p className="text-gray-700 dark:text-gray-400 text-sm mb-6 font-medium">A única assinatura que você precisa para viver de internet.</p>
                </div>

                {/* PLAN SELECTOR TABS */}
                <div className="flex justify-center md:justify-start mb-8">
                  <div className="inline-flex gap-1 p-1.5 bg-gray-900 dark:bg-gray-900/80 rounded-full border border-gray-700 dark:border-gray-800 shadow-lg">
                    <button
                      onClick={() => setPricingPlan('mensal')}
                      className={`px-6 py-2.5 rounded-full font-bold text-sm md:text-base transition-all flex items-center gap-2 ${
                        pricingPlan === 'mensal'
                          ? 'bg-[#29654f] text-white shadow-md'
                          : 'text-gray-400 dark:text-gray-400 hover:text-gray-200'
                      }`}
                      data-testid="button-plan-mensal"
                    >
                      Mensal
                    </button>
                    <button
                      onClick={() => setPricingPlan('anual')}
                      className={`px-6 py-2.5 rounded-full font-bold text-sm md:text-base transition-all flex items-center gap-2 relative ${
                        pricingPlan === 'anual'
                          ? 'bg-[#29654f] text-white shadow-md'
                          : 'text-gray-400 dark:text-gray-400 hover:text-gray-200'
                      }`}
                      data-testid="button-plan-anual"
                    >
                      Anual
                      <span className="absolute -top-2 -right-1 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">-50%</span>
                    </button>
                  </div>
                </div>
                
                <div className="mb-6">
                   <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-3 md:mb-6">
                      <span className="text-gray-700 dark:text-gray-400 line-through text-sm md:text-xl font-bold decoration-red-500 decoration-2 md:decoration-4">
                        {pricingPlan === 'mensal' ? 'De R$ 997,00' : 'De R$ 11.988,00'}
                      </span>
                      <span className="bg-green-500 dark:bg-green-600 text-white text-xs md:text-base font-black px-2 md:px-4 py-1 md:py-2 rounded-full">
                        {pricingPlan === 'mensal' ? 'ECONOMIZE 90%' : 'ECONOMIZE 70%'}
                      </span>
                   </div>
                   {pricingPlan === 'mensal' ? (
                     <>
                       <div className="flex items-baseline gap-1 md:gap-2 justify-center md:justify-start">
                          <span className="text-gray-900 dark:text-white text-4xl md:text-5xl font-bold">R$</span>
                          <span className="text-6xl md:text-8xl lg:text-9xl font-black text-gray-900 dark:text-white tracking-tighter">99</span>
                          <div className="flex flex-col items-start">
                            <span className="text-gray-900 dark:text-white text-3xl md:text-4xl font-bold">,99</span>
                            <span className="text-gray-900 dark:text-white text-lg md:text-2xl font-bold uppercase">/mês</span>
                          </div>
                       </div>
                       <div className="text-sm md:text-lg text-gray-800 dark:text-green-300 mt-1 md:mt-3 text-center md:text-left font-bold flex items-center justify-center md:justify-start gap-1">
                          <Coffee size={16} className="text-[#29654f] dark:text-green-300" /> Menos de R$ 3,40 por dia
                       </div>
                     </>
                   ) : (
                     <>
                       <div className="flex items-baseline gap-1 md:gap-2 justify-center md:justify-start">
                          <span className="text-gray-900 dark:text-white text-4xl md:text-5xl font-bold">R$</span>
                          <span className="text-6xl md:text-8xl lg:text-9xl font-black text-gray-900 dark:text-white tracking-tighter">360</span>
                          <div className="flex flex-col items-start">
                            <span className="text-gray-900 dark:text-white text-3xl md:text-4xl font-bold">,90</span>
                            <span className="text-gray-900 dark:text-white text-lg md:text-2xl font-bold uppercase">/ano</span>
                          </div>
                       </div>
                       <div className="text-sm md:text-lg text-gray-800 dark:text-green-300 mt-1 md:mt-3 text-center md:text-left font-bold flex items-center justify-center md:justify-start gap-1">
                          <Banknote size={16} className="text-[#29654f] dark:text-green-300" /> Apenas R$ 30,07 por mês (desconto de 70%)
                       </div>
                     </>
                   )}
                </div>

                {/* CTA BUTTONS - ONE FOR EACH PLAN */}
                <div className="flex flex-col gap-3">
                  {pricingPlan === 'mensal' && (
                    <a
                      href="/assinatura/checkout?plan=mensal"
                      className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-black py-4 md:py-8 px-4 md:px-8 rounded-xl shadow-2xl hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-colors duration-200 border-t-2 md:border-t-4 border-green-400 flex flex-col items-center justify-center gap-1 md:gap-2 uppercase tracking-wide"
                      data-testid="button-checkout-mensal"
                    >
                      <span className="text-sm md:text-2xl">QUERO MEU ACESSO IMEDIATO <ArrowRight size={16} className="md:w-7 md:h-7 inline" /></span>
                      <span className="text-xs md:text-base font-semibold opacity-90">Compra segura e liberação automática</span>
                    </a>
                  )}
                  {pricingPlan === 'anual' && (
                    <a
                      href="/assinatura/checkout?plan=anual"
                      className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-black py-4 md:py-8 px-4 md:px-8 rounded-xl shadow-2xl hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-colors duration-200 border-t-2 md:border-t-4 border-green-400 flex flex-col items-center justify-center gap-1 md:gap-2 uppercase tracking-wide"
                      data-testid="button-checkout-anual"
                    >
                      <span className="text-sm md:text-2xl">QUERO MEU ACESSO IMEDIATO <ArrowRight size={16} className="md:w-7 md:h-7 inline" /></span>
                      <span className="text-xs md:text-base font-semibold opacity-90">Compra segura e liberação automática</span>
                    </a>
                  )}
                </div>

                {/* Payment Methods */}
                <div className="flex items-center justify-center mt-1 mb-6">
                  <img src="/payments-logo.webp" alt="Formas de Pagamento Lowfy: Pix, Visa, MasterCard, American Express, Elo, Hipercard, Diners" className="h-12 object-contain opacity-90 hover:opacity-100 transition-opacity dark:brightness-0 dark:invert" width="400" height="48" loading="lazy" decoding="async" />
                </div>
              </div>

              {/* Column 2: Stacked Benefits List */}
              <div className="flex-1 bg-white dark:bg-[#0f0f0f] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-inner relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-20 h-20 bg-[#29654f]/10 rounded-bl-full z-0"></div>
                 <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 relative z-10 flex items-center gap-2">
                   <Gift size={16} className="text-[#29654f]" /> O QUE VOCÊ VAI RECEBER:
                 </h4>
                 <ul className="space-y-4 relative z-10">
                    {[
                       { text: "+39 Ferramentas Premium (IA, Design e SEO)", price: "R$8.000" },
                       { text: "IA de criação de copys Andromeda", price: "R$190" },
                       { text: "Biblioteca de PLR estruturados em 7 idiomas (Baixe e Venda)", price: null },
                       { text: "Clonador de Páginas", price: "R$99,90" },
                       { text: "Criador de Páginas", price: "R$99,90" },
                       { text: "Quiz interativo", price: "R$99,90" },
                       { text: "+350 Cursos dos maiores players do mundo", price: "R$50.000" },
                       { text: "Marketplace: Venda seus produtos dentro da plataforma Lowfy", price: null },
                       { text: "Fórum de Networking VIP", price: null },
                       { text: "Atualizações e novos recursos sem custos", price: null }
                    ].map((benefit, i) => (
                      <li key={i} className="flex items-center gap-3">
                         <div className="w-5 h-5 rounded-full bg-[#29654f]/10 dark:bg-[#29654f]/20 flex items-center justify-center flex-shrink-0">
                           <Check size={12} className="text-[#29654f] dark:text-[#4ade80] stroke-[3]" />
                         </div>
                         <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                           {benefit.text}
                           {benefit.price && <span className="text-red-600 dark:text-red-500 ml-1 line-through">+ {benefit.price}</span>}
                         </span>
                      </li>
                    ))}
                 </ul>

                 {/* BONUS SECTION */}
                 <div id="bonus" className="mt-6 p-4 rounded-xl border border-[#29654f]/50 dark:border-[#4ade80]/50 bg-[#29654f]/5 dark:bg-[#4ade80]/5">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 relative z-10 flex items-center gap-2 text-[#29654f] dark:text-[#4ade80]">
                      <Gift size={16} /> + BONUS EXCLUSIVOS
                    </h4>
                    <ul className="space-y-3 relative z-10">
                       {[
                          { text: "IA de criação de copys Andromeda", price: "R$190" },
                          { text: "+15 plugins Premium e atualizados", price: "R$4.000" },
                          { text: "+150 automações N8N", price: "R$10.000" },
                          { text: "+250 landing pages para wordpress", price: "R$5.000" }
                       ].map((bonus, i) => (
                         <li key={i} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-[#29654f]/20 dark:bg-[#4ade80]/20 flex items-center justify-center flex-shrink-0">
                              <Check size={12} className="text-[#29654f] dark:text-[#4ade80] stroke-[3]" />
                            </div>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                              {bonus.text}
                              {bonus.price && <span className="text-red-600 dark:text-red-500 ml-1 line-through">+ {bonus.price}</span>}
                            </span>
                         </li>
                       ))}
                    </ul>
                 </div>
                 
                 <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-center text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                       <strong className="text-[#29654f] dark:text-[#4ade80] flex items-center justify-center gap-1.5"><ShieldCheck size={14} className="inline" /> RISCO ZERO:</strong> Entre, use as ferramentas e baixe os PLRs. Se em 7 dias não gostar, devolvemos cada centavo.
                    </p>
                    <div className="mt-3 flex justify-center">
                       <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-dashed border-gray-500 dark:border-gray-400 pb-0.5 hover:text-red-500 hover:border-red-500 cursor-pointer transition-colors">
                          Cancele a qualquer momento
                       </span>
                    </div>
                 </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-16 md:py-24 bg-gray-50 dark:bg-[#0f0f0f] border-t border-gray-200 dark:border-gray-900 transition-colors duration-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-colors duration-200 hover:border-[#29654f]/50 shadow-sm dark:shadow-none">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex justify-between items-center focus:outline-none"
                >
                  <span className="text-gray-900 dark:text-white font-bold text-sm md:text-base">{item.question}</span>
                  {openFaq === index ? <ChevronUp size={18} className="text-[#29654f]" /> : <ChevronDown size={18} className="text-gray-500" />}
                </button>
                <div className={`px-6 text-gray-600 dark:text-gray-400 text-sm overflow-hidden transition-all duration-200 leading-relaxed ${openFaq === index ? 'max-h-40 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FULL FOOTER */}
      <footer className="bg-white dark:bg-[#0f0f0f] pt-16 pb-8 border-t border-gray-200 dark:border-gray-900 transition-colors duration-200 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
             {/* Brand Column */}
             <div className="col-span-1 md:col-span-1">
                <div className="flex items-center gap-3 mb-6">
                  {/* Logo Verde em light mode, original em dark mode */}
                  <img src="/logo-white.webp" alt="Lowfy - Plataforma de Marketing Digital com PLR, IA e Ferramentas Premium" className="h-8 w-auto hidden dark:block transition-all" width="120" height="32" loading="lazy" decoding="async" />
                  <img src="/logo-dark.webp" alt="Lowfy - Plataforma de Marketing Digital com PLR, IA e Ferramentas Premium" className="h-8 w-auto block dark:hidden transition-all" width="120" height="32" loading="lazy" decoding="async" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
                  O ecossistema definitivo para quem quer dominar o marketing digital sem gastar uma fortuna. Todas as ferramentas que você precisa em um só lugar.
                </p>
                <div className="flex gap-4">
                   <a href="https://www.instagram.com/lowfybr/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                      <Instagram size={18} />
                   </a>
                   <a href="https://www.facebook.com/p/Lowfy-61551759668769/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                      <Facebook size={18} />
                   </a>
                   <a href="https://www.youtube.com/@lowfy_plrs" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-[#29654f] hover:bg-[#29654f]/10 transition-colors">
                      <Youtube size={18} />
                   </a>
                </div>
             </div>

             {/* Links Column */}
             <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Plataforma</h4>
                <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                   <li><a href="#features" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Ferramentas</a></li>
                   <li><a href="#cloner" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Clonador de Páginas</a></li>
                   <li><a href="#community" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Comunidade Black</a></li>
                   <li><a href="#benefits" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Benefícios</a></li>
                   <li><a href="#pricing" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Assinar Agora</a></li>
                </ul>
             </div>

             {/* Legal Column */}
             <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Legal</h4>
                <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                   <li><a href="/termos" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Termos de Uso</a></li>
                   <li><a href="/privacidade" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Política de Privacidade</a></li>
                   <li><a href="/licenca-plr" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Licença de PLR</a></li>
                   <li><a href="/direitos-autorais" className="hover:text-[#29654f] dark:hover:text-[#4ade80] transition-colors">Direitos Autorais</a></li>
                </ul>
             </div>

             {/* Contact Column */}
             <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-6">Contato</h4>
                <ul className="space-y-4 text-gray-600 dark:text-gray-400">
                   <li className="flex items-center gap-3">
                      <Mail size={16} className="text-[#29654f]" />
                      contato@lowfy.com.br
                   </li>
                   <li className="flex items-center gap-3">
                      <Phone size={16} className="text-[#29654f]" />
                      +55 (41) 99907-7637
                   </li>
                   <li className="text-xs pt-4 text-gray-500">
                      Atendimento de Segunda a Sexta das 09h às 18h.
                   </li>
                </ul>
             </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-8">
             <p className="text-gray-500 text-xs">
                © 2025 Lowfy Tecnologia Ltda. CNPJ 47.394.596/0001-15. Todos os direitos reservados.
             </p>
          </div>
        </div>
      </footer>
    </div>
  );

  return <HomePage />;
};

export default Home;
