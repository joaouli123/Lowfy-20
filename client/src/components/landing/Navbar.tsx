import React, { useState, useCallback } from 'react';
import { Menu, X, Sun, Moon, ChevronDown, Wrench, BookOpen, Users } from 'lucide-react';

interface NavbarProps {
  toggleTheme: () => void;
  isDark: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleTheme, isDark }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);

  const menuGroups = [
    {
      id: 'ferramentas',
      label: 'Ferramentas',
      icon: Wrench,
      items: [
        { label: 'Arsenal de Ferramentas', href: '#features', desc: '+39 ferramentas premium' },
        { label: 'Pack de Plugins', href: '#bonus', desc: 'Plugins WordPress inclusos' },
        { label: '+250 Landing Pages', href: '#bonus', desc: 'Modelos prontos' },
        { label: '+150 N8N Automações', href: '#bonus', desc: 'Automações inteligentes' },
        { label: 'Criador de Anúncios Andromeda', href: '#bonus', desc: 'IA para campanhas' },
        { label: 'Criador de Site', href: '#cloner', desc: 'Crie sites profissionais' },
        { label: 'Clonador de Páginas', href: '#cloner', desc: 'Clone qualquer página' },
        { label: 'Quiz Interativo', href: '#quiz', desc: 'Engajamento viral' },
        { label: 'PLR Global', href: '#plr', desc: 'Ganhe em dólar com PLRs' },
        { label: 'Academy', href: '#academy', desc: '+350 cursos disponíveis' },
      ]
    },
    {
      id: 'comunidade',
      label: 'Comunidade',
      icon: Users,
      items: [
        { label: 'Comunidade Black', href: '#community', desc: 'Networking exclusivo' },
        { label: 'Marketplace', href: '#marketplace', desc: 'Venda seus produtos' },
        { label: 'Afiliado', href: '#afiliado', desc: 'Lucre 50% recorrente' },
      ]
    }
  ];

  const handleMouseEnter = useCallback((id: string) => {
    setActiveDropdown(id);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveDropdown(null);
  }, []);

  const toggleMobileMenu = useCallback((id: string) => {
    setExpandedMobileMenu(prev => prev === id ? null : id);
  }, []);

  const handleMobileLinkClick = useCallback(() => {
    setIsOpen(false);
    setExpandedMobileMenu(null);
  }, []);

  return (
    <nav className="fixed w-full z-50 glass-nav transition-all duration-300 border-b border-gray-200 dark:border-[#333] bg-white/80 dark:bg-[#0f0f0f]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <a href="#" className="flex-shrink-0 flex items-center gap-3 cursor-pointer" title="Lowfy - Plataforma de Marketing Digital">
              <img src="/logo-dark.webp" alt="Lowfy - Plataforma de Marketing Digital com PLR, IA e Ferramentas Premium" className="h-8 w-auto hidden dark:block transition-all" width="120" height="32" />
              <img src="/logo-dark.webp" alt="Lowfy - Plataforma de Marketing Digital com PLR, IA e Ferramentas Premium" className="h-8 w-auto block dark:hidden transition-all" width="120" height="32" />
            </a>
            
            {/* Desktop Menu */}
            <div className="hidden lg:block">
              <div className="ml-10 flex items-center space-x-1">
                {/* Início Link */}
                <a 
                  href="#" 
                  className="text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-link-inicio"
                >
                  Início
                </a>
                
                {/* Dropdown Menus - Hover based for desktop */}
                {menuGroups.map((group) => (
                  <div 
                    key={group.id}
                    className="relative"
                    onMouseEnter={() => handleMouseEnter(group.id)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <button 
                      className="flex items-center gap-1 text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      data-testid={`nav-dropdown-${group.id}`}
                    >
                      {group.label}
                      <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === group.id ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown Panel */}
                    {activeDropdown === group.id && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-[#0f0f0f] rounded-xl shadow-xl border border-gray-200 dark:border-[#333] overflow-hidden z-50">
                        <div className="p-2">
                          {group.items.map((item, idx) => (
                            <a
                              key={idx}
                              href={item.href}
                              className="flex flex-col px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors group"
                              data-testid={`nav-link-${item.href.replace('#', '')}`}
                            >
                              <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#29654f] dark:group-hover:text-[#4ade80] transition-colors">
                                {item.label}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {item.desc}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Direct Links */}
                <a 
                  href="#testimonials" 
                  className="text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-link-depoimentos"
                >
                  Depoimentos
                </a>
                <a 
                  href="#pricing" 
                  className="text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-link-preco"
                >
                  Preço
                </a>
                <a 
                  href="#faq" 
                  className="text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-link-faq"
                >
                  FAQ
                </a>
              </div>
            </div>
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-[#2a2a2a] dark:hover:bg-dark-700 dark:text-yellow-400 transition-colors duration-200"
              aria-label="Alternar Tema"
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} className="text-gray-700" />}
            </button>
            <a 
              href="/login"
              className="text-gray-600 hover:text-[#29654f] dark:text-gray-300 dark:hover:text-[#4ade80] font-medium transition-colors"
              data-testid="link-login-desktop"
            >
              Login
            </a>
            <a 
              href="#pricing"
              className="bg-[#29654f] hover:bg-[#1a4535] text-white font-bold py-2.5 px-6 rounded-full shadow-lg shadow-[#29654f]/20 hover:shadow-[#29654f]/40 transition-colors duration-200"
              data-testid="button-cta-header"
            >
              Começar Agora
            </a>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="-mr-2 flex lg:hidden gap-4 items-center">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-yellow-400"
              data-testid="button-theme-toggle-mobile"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-[#29654f] dark:text-gray-400 dark:hover:text-white focus:outline-none"
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Click based instead of hover */}
      {isOpen && (
        <div className="lg:hidden bg-white dark:bg-[#0f0f0f] border-b border-gray-200 dark:border-[#333] shadow-xl max-h-[80vh] overflow-y-auto">
          <div className="px-4 pt-4 pb-6 space-y-2">
            {menuGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                {/* Accordion Header - Click to expand */}
                <button
                  onClick={() => toggleMobileMenu(group.id)}
                  className="w-full flex items-center justify-between gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                  data-testid={`nav-mobile-accordion-${group.id}`}
                >
                  <span className="flex items-center gap-2">
                    <group.icon size={16} className="text-[#29654f] dark:text-[#4ade80]" />
                    {group.label}
                  </span>
                  <ChevronDown 
                    size={16} 
                    className={`transition-transform duration-200 ${expandedMobileMenu === group.id ? 'rotate-180' : ''}`} 
                  />
                </button>
                
                {/* Accordion Content */}
                <div 
                  className={`overflow-hidden transition-all duration-200 ${
                    expandedMobileMenu === group.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="pl-6 space-y-1 pb-2">
                    {group.items.map((item, idx) => (
                      <a 
                        key={idx}
                        href={item.href} 
                        onClick={handleMobileLinkClick}
                        className="text-gray-600 dark:text-gray-400 hover:text-[#29654f] dark:hover:text-[#4ade80] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] block px-4 py-2.5 rounded-lg text-sm transition-colors"
                        data-testid={`nav-mobile-link-${item.href.replace('#', '')}`}
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{item.desc}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Direct Links Mobile */}
            <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-[#333]">
              <a 
                href="#" 
                onClick={handleMobileLinkClick}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                data-testid="nav-mobile-link-inicio"
              >
                Início
              </a>
              <a 
                href="#community" 
                onClick={handleMobileLinkClick}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                data-testid="nav-mobile-link-comunidade"
              >
                Comunidade
              </a>
              <a 
                href="#testimonials" 
                onClick={handleMobileLinkClick}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                data-testid="nav-mobile-link-depoimentos"
              >
                Depoimentos
              </a>
              <a 
                href="#pricing" 
                onClick={handleMobileLinkClick}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                data-testid="nav-mobile-link-preco"
              >
                Preço
              </a>
              <a 
                href="#faq" 
                onClick={handleMobileLinkClick}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                data-testid="nav-mobile-link-faq"
              >
                FAQ
              </a>
            </div>
            
            <a 
              href="/login"
              onClick={handleMobileLinkClick}
              className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              data-testid="link-login-mobile"
            >
              Login
            </a>
            <a 
              href="#pricing"
              onClick={handleMobileLinkClick}
              className="block w-full text-center mt-4 bg-[#29654f] hover:bg-[#1a4535] text-white font-bold py-3 rounded-lg shadow-md transition-colors"
              data-testid="button-cta-mobile"
            >
              Começar Agora
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
