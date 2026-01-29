import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Zap,
  GraduationCap,
  Briefcase,
  MessageCircle,
  HelpCircle,
  Settings,
  LogOut,
  User,
  Home,
  Trophy,
  ShoppingBag,
  ShoppingCart,
  Shield,
  Users,
  BarChart3,
  Database,
  ChevronDown,
  ChevronRight,
  Wrench,
  MessageSquare,
  Newspaper,
  MousePointerClick,
  Puzzle,
  FileText,
  Globe,
  Sparkles,
  X,
  Layout,
  Target,
  Megaphone,
  Bug,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  Lock,
  CheckCircle,
  Clock,
  ArrowLeft,
  Mail,
  IdCard,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  TrendingUp,
  DollarSign
} from "lucide-react";
import type { Notification } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import { usePreloadPages } from "@/hooks/usePreloadPages";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import collapsedLogoUrl from "@assets/Favicon_1764026734985.png";


export default function Sidebar() {
  const { preloadOnHover } = usePreloadPages();
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [isUtilitiesExpanded, setIsUtilitiesExpanded] = useState(false);
  const [isMarketplaceExpanded, setIsMarketplaceExpanded] = useState(false);
  const { isSidebarOpen, isSidebarCollapsed, closeSidebar, toggleCollapse } = useSidebar();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [location]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem('auth_token');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Logout realizado com sucesso!",
        description: "Até logo!",
      });
      window.location.href = "/";
    },
    onError: () => {
      toast({
        title: "Erro ao fazer logout",
        description: "Tente novamente",
        variant: "destructive",
      });
    },
  });


  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const mainNav = [
    {
      name: "Timeline",
      href: "/",
      icon: Home,
      testId: "nav-timeline"
    },
    {
      name: "Meus PLRs",
      href: "/plrs",
      icon: BookOpen,
      testId: "nav-plrs"
    },
    {
      name: "Ferramentas IA",
      href: "/ai-tools",
      icon: Sparkles,
      testId: "nav-ai-tools"
    },
    {
      name: "Quiz Interativo",
      href: "/quiz-interativo",
      icon: MousePointerClick,
      testId: "nav-quiz-interativo"
    },
    {
      name: "Cursos Online",
      href: "/courses",
      icon: GraduationCap,
      testId: "nav-courses"
    },
    {
      name: "White Label",
      href: "/services",
      icon: Briefcase,
      testId: "nav-services"
    },
  ];

  const utilitiesNav = [
    {
      name: "Meta Ads Andromeda",
      href: "/meta-ads-andromeda",
      icon: Megaphone,
      testId: "nav-meta-ads-andromeda"
    },
    {
      name: "Plugins",
      href: "/plugins",
      icon: Puzzle,
      testId: "nav-plugins"
    },
    {
      name: "Páginas e Templates",
      href: "/templates",
      icon: FileText,
      testId: "nav-templates"
    },
    {
      name: "Modelos N8N",
      href: "/modelos-n8n",
      icon: Wrench,
      testId: "nav-modelos-n8n"
    },
    {
      name: "Clonador de Páginas",
      href: "/clonador",
      icon: Globe,
      testId: "nav-clonador"
    },
    {
      name: "Pre-Sell Builder",
      href: "/presell-dashboard",
      icon: Layout,
      testId: "nav-presell-dashboard"
    },
    {
      name: "Agente de IA",
      href: null,
      icon: Sparkles,
      testId: "nav-agente-ia",
      badge: "em breve"
    },
    {
      name: "Hack Ads",
      href: null,
      icon: Target,
      testId: "nav-hack-ads",
      badge: "em breve"
    },
  ];

  const communityNav = [
    {
      name: "Fórum",
      href: "/forum",
      icon: MessageSquare,
      testId: "nav-forum"
    },
    {
      name: "Marketplace",
      href: "/marketplace",
      icon: ShoppingBag,
      testId: "nav-marketplace"
    },
    {
      name: "Suporte",
      href: "/support",
      icon: HelpCircle,
      testId: "nav-support"
    },
  ];

  const userNav = [
    {
      name: "Indicações",
      href: "/indicacoes",
      icon: Users,
      testId: "nav-referrals"
    },
    {
      name: "Assinatura",
      href: "/assinatura",
      icon: CreditCard,
      testId: "nav-assinatura"
    },
    {
      name: "Perfil",
      href: "/profile",
      icon: User,
      testId: "nav-profile"
    },
  ];

  const adminSubNav = user?.isAdmin ? [
    {
      name: "Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      testId: "nav-admin-analytics"
    },
    {
      name: "Analytics de Clonagem",
      href: "/admin/clonagem-analytics",
      icon: Globe,
      testId: "nav-admin-cloning"
    },
    {
      name: "Usuários",
      href: "/admin/usuarios",
      icon: Users,
      testId: "nav-admin-users"
    },
    {
      name: "Conteúdo",
      href: "/admin/conteudo",
      icon: Database,
      testId: "nav-admin-content"
    },
    {
      name: "Cursos Online",
      href: "/admin/cursos",
      icon: GraduationCap,
      testId: "nav-admin-courses"
    },
    {
      name: "Marketplace",
      href: "/admin/marketplace",
      icon: ShoppingBag,
      testId: "nav-admin-marketplace"
    },
    {
      name: "Comunidade",
      href: "/admin/comunidade",
      icon: MessageCircle,
      testId: "nav-admin-community"
    },
    {
      name: "White Label e Tools IA",
      href: "/admin/servicos",
      icon: Wrench,
      testId: "nav-admin-services"
    },
    {
      name: "Bugs Reportados",
      href: "/admin/bugs",
      icon: Bug,
      testId: "nav-admin-bugs"
    },
    {
      name: "Financeiro",
      href: "/admin/financeiro",
      icon: Wallet,
      testId: "nav-admin-financeiro"
    },
    {
      name: "Checkouts Abandonados",
      href: "/admin/checkout-abandonado",
      icon: ShoppingCart,
      testId: "nav-admin-checkout-abandonado"
    },
    {
      name: "Afiliados",
      href: "/admin/afiliados",
      icon: Users,
      testId: "nav-admin-afiliados"
    },
    {
      name: "Vendedores",
      href: "/admin/vendedores",
      icon: TrendingUp,
      testId: "nav-admin-vendedores"
    },
    {
      name: "Reembolsos de Assinatura",
      href: "/admin/subscription-refunds",
      icon: DollarSign,
      testId: "nav-admin-subscription-refunds"
    },
    {
      name: "Uso de IA (OpenAI)",
      href: "/admin/ai-usage",
      icon: Sparkles,
      testId: "nav-admin-ai-usage"
    },
    {
      name: "WhatsApp",
      href: "/admin/whatsapp",
      icon: Phone,
      testId: "nav-admin-whatsapp"
    },
  ] : [];

  const navigation = user?.isAdmin ? [...mainNav, {
    name: "Painel Admin",
    href: "/admin", // This is a parent link, sub-items will be handled separately
    icon: Shield,
    testId: "nav-admin",
    subItems: adminSubNav // Pass adminSubNav as subItems
  }] : mainNav;


  const isActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const isNavLinkActive = (href: string) => {
    return location === href;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 z-50 lg:z-auto",
          "bg-white dark:bg-sidebar border-r border-sidebar-border",
          "flex flex-col h-screen",
          "transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "lg:w-20" : "lg:w-72",
          "w-72", // Mobile always full width
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        data-testid="sidebar"
      >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center justify-between">
        <div className={cn("flex items-center", isSidebarCollapsed ? "justify-center w-full" : "")}>
          {!isSidebarCollapsed ? (
            <img
              src="/lowfy-logo-dark.webp"
              alt="Lowfy"
              className="h-8 w-auto object-contain"
              loading="eager"
            />
          ) : (
            <img
              src="/lowfy-logo-green.webp"
              alt="Lowfy"
              className="h-8 w-8 object-contain"
              loading="eager"
            />
          )}
        </div>
        {/* Toggle collapse button for desktop */}
        {!isSidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="hidden lg:flex"
            data-testid="button-toggle-collapse"
            title="Recolher sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </Button>
        )}
        {/* Close button for mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={closeSidebar}
          className="lg:hidden"
          data-testid="button-close-sidebar"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Collapse button when collapsed (visible on desktop only) */}
      {isSidebarCollapsed && (
        <div className="hidden lg:flex px-2 py-2 justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="w-full"
            data-testid="button-expand-collapse"
            title="Expandir sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Main Navigation */}
        {navigation.map((item) => {
          const Icon = item.icon;
          const isCurrentLocation = isNavLinkActive(item.href);
          const isAdminSection = item.name === "Painel Admin";

          return (
            <div key={item.href}>
              <Link href={item.href}>
                <div
                  className={cn(
                    "sidebar-link flex items-center rounded-lg text-sm font-medium cursor-pointer",
                    isSidebarCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3",
                    isCurrentLocation
                      ? "active"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  )}
                  data-testid={item.testId}
                  onMouseEnter={() => !isAdminSection && preloadOnHover(item.href)}
                  onClick={() => {
                    if (isAdminSection) {
                      setIsAdminExpanded(!isAdminExpanded);
                    }
                  }}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {isAdminSection && (
                        <>
                          {isAdminExpanded ? (
                            <ChevronDown className="w-4 h-4 ml-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 ml-auto" />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </Link>

              {/* Render sub-items if it's the admin section and it's expanded */}
              {isAdminSection && isAdminExpanded && item.subItems && !isSidebarCollapsed && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.subItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <Link key={subItem.href} href={subItem.href}>
                        <div
                          className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                            isNavLinkActive(subItem.href)
                              ? "active"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                          }`}
                          data-testid={subItem.testId}
                        >
                          <SubIcon className="w-4 h-4" />
                          <span className="text-xs">{subItem.name}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Utilidades Section */}
        <div className="pt-4 mt-4 border-t border-sidebar-border">
          <div>
            <div
              className={cn(
                "sidebar-link flex items-center rounded-lg text-sm font-medium cursor-pointer text-sidebar-foreground/70 hover:text-sidebar-foreground",
                isSidebarCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3"
              )}
              onClick={() => setIsUtilitiesExpanded(!isUtilitiesExpanded)}
              data-testid="nav-utilidades"
              title={isSidebarCollapsed ? "Utilidades" : undefined}
            >
              <Wrench className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <>
                  <span>Utilidades</span>
                  {isUtilitiesExpanded ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </>
              )}
            </div>

            {isUtilitiesExpanded && !isSidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1">
                {utilitiesNav.map((item) => {
                  const Icon = item.icon;
                  const isComingSoon = item.href === null;
                  
                  const itemContent = (
                    <div
                      className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium ${
                        isComingSoon
                          ? "cursor-default text-sidebar-foreground/40 opacity-60"
                          : `cursor-pointer ${
                              isNavLinkActive(item.href)
                                ? "active"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                            }`
                      }`}
                      data-testid={item.testId}
                    >
                      <Icon className="w-4 h-4" />
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs">{item.name}</span>
                        {(item as any).badge && (
                          <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 ml-auto">
                            {(item as any).badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );

                  return (
                    <div key={item.testId}>
                      {isComingSoon ? (
                        itemContent
                      ) : (
                        <Link href={item.href || "/"}>
                          {itemContent}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Community Section */}
        <div className="pt-4 mt-4 border-t border-sidebar-border">
          {communityNav.map((item) => {
            const Icon = item.icon;
            // Check if the current item is Marketplace
            const isMarketplaceItem = item.name === "Marketplace";
            return (
              <div key={item.href}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      "sidebar-link flex items-center rounded-lg text-sm font-medium cursor-pointer",
                      isSidebarCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3",
                      isNavLinkActive(item.href)
                        ? "active"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    )}
                    data-testid={item.testId}
                    onClick={(e) => {
                      // If it's the marketplace item, toggle its expansion state
                      if (isMarketplaceItem) {
                        e.preventDefault(); // Prevent navigation to the marketplace page itself
                        setIsMarketplaceExpanded(!isMarketplaceExpanded);
                      }
                    }}
                    title={isSidebarCollapsed ? item.name : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isSidebarCollapsed && (
                      <>
                        <span>{item.name}</span>
                        {/* Add dropdown icon for marketplace if it has sub-items or is expandable */}
                        {isMarketplaceItem && (
                          <>
                            {isMarketplaceExpanded ? (
                              <ChevronDown className="w-4 h-4 ml-auto" />
                            ) : (
                              <ChevronRight className="w-4 h-4 ml-auto" />
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </Link>

                {/* Render sub-items for Marketplace if expanded */}
                {isMarketplaceItem && isMarketplaceExpanded && !isSidebarCollapsed && (
                  <div className="ml-4 mt-1 space-y-1">
                    <Link href="/marketplace/vitrine">
                      <div
                        className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                          isNavLinkActive("/marketplace/vitrine")
                            ? "active"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        }`}
                        data-testid="nav-marketplace-vitrine"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-xs">Vitrine</span>
                      </div>
                    </Link>
                    <Link href="/marketplace/meus-produtos">
                      <div
                        className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                          isNavLinkActive("/marketplace/meus-produtos")
                            ? "active"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        }`}
                        data-testid="nav-marketplace-meus-produtos"
                      >
                        <Target className="w-4 h-4" />
                        <span className="text-xs">Meus Produtos</span>
                      </div>
                    </Link>
                    <Link href="/marketplace/compras">
                      <div
                        className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                          isNavLinkActive("/marketplace/compras")
                            ? "active"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        }`}
                        data-testid="nav-marketplace-compras"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span className="text-xs">Compras</span>
                      </div>
                    </Link>
                    <Link href="/marketplace/financeiro">
                      <div
                        className={`sidebar-link flex items-center space-x-3 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                          isNavLinkActive("/marketplace/financeiro")
                            ? "active"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        }`}
                        data-testid="nav-marketplace-financeiro"
                      >
                        <Wallet className="w-4 h-4" />
                        <span className="text-xs">Financeiro</span>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Section */}
        <div className="pt-4 mt-4 border-t border-sidebar-border">
          {userNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "sidebar-link flex items-center rounded-lg text-sm font-medium cursor-pointer",
                    isSidebarCollapsed ? "justify-center px-2 py-3" : "space-x-3 px-4 py-3",
                    isNavLinkActive(item.href)
                      ? "active"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  )}
                  data-testid={item.testId}
                  title={isSidebarCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isSidebarCollapsed && <span>{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center px-4 py-3",
          isSidebarCollapsed ? "flex-col gap-2" : "space-x-3"
        )}>
          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground" data-testid="user-initials">
                {getInitials(user?.name)}
              </span>
            )}
          </div>
          {!isSidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate" data-testid="user-name">
                  {user?.name || user?.email || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="user-email">
                  {user?.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logoutMutation.mutate()}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                title="Sair"
                data-testid="button-logout"
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-5 h-5 text-red-500 hover:text-red-600" />
              </Button>
            </>
          )}
          {isSidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
              title="Sair"
              data-testid="button-logout"
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4 text-red-500 hover:text-red-600" />
            </Button>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}