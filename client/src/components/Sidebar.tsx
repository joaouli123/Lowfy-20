import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  Avatar,
  Button,
  Input,
  Tooltip,
  ScrollShadow,
  Accordion,
  AccordionItem,
  Divider,
} from "@heroui/react";
import {
  BookOpen,
  Sparkles,
  GraduationCap,
  Briefcase,
  MessageCircle,
  HelpCircle,
  LogOut,
  User,
  Home,
  ShoppingBag,
  ShoppingCart,
  Shield,
  Users,
  BarChart3,
  Database,
  Wrench,
  MessageSquare,
  MousePointerClick,
  Puzzle,
  FileText,
  Globe,
  Search,
  X,
  Layout as LayoutIcon,
  Target,
  Bug,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  DollarSign,
  Wand2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import { usePreloadPages } from "@/hooks/usePreloadPages";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  href: string | null;
  icon: any;
  testId: string;
  badge?: string;
  // Subagrupamento visual opcional (usado hoje só pelo Painel Admin) — nunca afeta href/testId.
  cluster?: string;
};

type NavGroup = {
  key: string;
  label: string;
  icon: any;
  items: NavItem[];
  headerHref?: string;
  sectionActive?: boolean;
};

// Remove acentos para permitir busca "produtos" encontrar "Produtos"/"pródutos" etc.
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Agrupa itens já filtrados em microclusters (usa a ordem de primeira ocorrência).
// Itens sem `cluster` caem num grupo "sem título" (chave vazia).
function groupByCluster(items: NavItem[]): { cluster: string; items: NavItem[] }[] {
  const order: string[] = [];
  const map = new Map<string, NavItem[]>();
  items.forEach((item) => {
    const key = item.cluster ?? "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  });
  return order.map((cluster) => ({ cluster, items: map.get(cluster)! }));
}

export default function Sidebar() {
  const { preloadOnHover } = usePreloadPages();
  // `setLocation` é usado só pelo cabeçalho clicável dos grupos (Admin/Marketplace) —
  // evita aninhar um <Link> (que renderiza <a>) dentro do <button> que o HeroUI usa
  // como trigger do AccordionItem (HTML inválido, dispara toggle + navegação juntos).
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSidebarOpen, isSidebarCollapsed, closeSidebar, toggleCollapse } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");

  // Mesma queryKey usada pelo TopBar — o React Query deduplica automaticamente,
  // então isso não gera uma segunda requisição ao carrinho.
  const { data: cartItems } = useQuery({
    queryKey: ["/api/marketplace/cart"],
    enabled: !!user,
  });
  const cartItemCount = Array.isArray(cartItems)
    ? cartItems.reduce((total: number, item: any) => total + (item.quantity || 1), 0)
    : 0;

  useEffect(() => {
    closeSidebar();
  }, [location]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem("auth_token");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Logout realizado com sucesso!", description: "Até logo!" });
      window.location.href = "/";
    },
    onError: () => {
      toast({ title: "Erro ao fazer logout", description: "Tente novamente", variant: "destructive" });
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

  // Âncora fixa fora dos grupos — sempre visível, é a página inicial da plataforma.
  const pinnedNav: NavItem[] = [
    { name: "Início", href: "/", icon: Home, testId: "nav-timeline" },
  ];

  const criarNav: NavItem[] = [
    { name: "Meus PLRs", href: "/plrs", icon: BookOpen, testId: "nav-plrs" },
    { name: "Ferramentas IA", href: "/ai-tools", icon: Sparkles, testId: "nav-ai-tools" },
    { name: "Estúdio IA", href: "/ai-studio", icon: Wand2, testId: "nav-ai-studio" },
    { name: "Criador de Ebooks", href: "/ebooks", icon: BookOpen, testId: "nav-ebooks" },
    { name: "Quiz Builder", href: "/quiz-builder", icon: MousePointerClick, testId: "nav-quiz-builder" },
    { name: "Cursos Online", href: "/courses", icon: GraduationCap, testId: "nav-courses" },
    { name: "White Label", href: "/services", icon: Briefcase, testId: "nav-services" },
  ];

  const utilitiesNav: NavItem[] = [
    { name: "Plugins", href: "/plugins", icon: Puzzle, testId: "nav-plugins" },
    { name: "Páginas e Templates", href: "/templates", icon: FileText, testId: "nav-templates" },
    { name: "Modelos N8N", href: "/modelos-n8n", icon: Wrench, testId: "nav-modelos-n8n" },
    { name: "Clonador de Páginas", href: "/clonador", icon: Globe, testId: "nav-clonador" },
    { name: "Criador de Páginas", href: "/presell-dashboard", icon: LayoutIcon, testId: "nav-presell-dashboard" },
    { name: "Agente de IA", href: null, icon: Sparkles, testId: "nav-agente-ia", badge: "em breve" },
    { name: "Hack Ads", href: null, icon: Target, testId: "nav-hack-ads", badge: "em breve" },
  ];

  const marketplaceSubNav: NavItem[] = [
    { name: "Vitrine", href: "/marketplace/vitrine", icon: ShoppingBag, testId: "nav-marketplace-vitrine" },
    { name: "Meus Produtos", href: "/marketplace/meus-produtos", icon: Target, testId: "nav-marketplace-meus-produtos" },
    { name: "Compras", href: "/marketplace/compras", icon: ShoppingCart, testId: "nav-marketplace-compras" },
    { name: "Financeiro", href: "/marketplace/financeiro", icon: Wallet, testId: "nav-marketplace-financeiro" },
  ];

  const communityNav: NavItem[] = [
    { name: "Fórum", href: "/forum", icon: MessageSquare, testId: "nav-forum" },
    { name: "Suporte", href: "/support", icon: HelpCircle, testId: "nav-support" },
  ];

  const userNav: NavItem[] = [
    { name: "Indicações", href: "/indicacoes", icon: Users, testId: "nav-referrals" },
    { name: "Assinatura", href: "/assinatura", icon: CreditCard, testId: "nav-assinatura" },
    { name: "Perfil", href: "/profile", icon: User, testId: "nav-profile" },
  ];

  // Painel Admin — subdividido em microclusters (Visão Geral/Gestão/Financeiro/Sistema)
  // para dar hierarquia visual a quem está explorando, sem alterar nenhum href/testId.
  const adminSubNav: NavItem[] = user?.isAdmin
    ? [
        { name: "Analytics", href: "/admin/analytics", icon: BarChart3, testId: "nav-admin-analytics", cluster: "Visão Geral" },
        { name: "Analytics de Clonagem", href: "/admin/clonagem-analytics", icon: Globe, testId: "nav-admin-cloning", cluster: "Visão Geral" },
        { name: "Usuários", href: "/admin/usuarios", icon: Users, testId: "nav-admin-users", cluster: "Visão Geral" },
        { name: "Conteúdo", href: "/admin/conteudo", icon: Database, testId: "nav-admin-content", cluster: "Gestão" },
        { name: "Cursos Online", href: "/admin/cursos", icon: GraduationCap, testId: "nav-admin-courses", cluster: "Gestão" },
        { name: "Marketplace", href: "/admin/marketplace", icon: ShoppingBag, testId: "nav-admin-marketplace", cluster: "Gestão" },
        { name: "Comunidade", href: "/admin/comunidade", icon: MessageCircle, testId: "nav-admin-community", cluster: "Gestão" },
        { name: "White Label e Tools IA", href: "/admin/servicos", icon: Wrench, testId: "nav-admin-services", cluster: "Gestão" },
        { name: "Bugs Reportados", href: "/admin/bugs", icon: Bug, testId: "nav-admin-bugs", cluster: "Gestão" },
        { name: "Financeiro", href: "/admin/financeiro", icon: Wallet, testId: "nav-admin-financeiro", cluster: "Financeiro" },
        { name: "Checkouts Abandonados", href: "/admin/checkout-abandonado", icon: ShoppingCart, testId: "nav-admin-checkout-abandonado", cluster: "Financeiro" },
        { name: "Afiliados", href: "/admin/afiliados", icon: Users, testId: "nav-admin-afiliados", cluster: "Financeiro" },
        { name: "Vendedores", href: "/admin/vendedores", icon: TrendingUp, testId: "nav-admin-vendedores", cluster: "Financeiro" },
        { name: "Reembolsos de Assinatura", href: "/admin/subscription-refunds", icon: DollarSign, testId: "nav-admin-subscription-refunds", cluster: "Financeiro" },
        { name: "Uso de IA (OpenAI)", href: "/admin/ai-usage", icon: Sparkles, testId: "nav-admin-ai-usage", cluster: "Sistema" },
        { name: "WhatsApp", href: "/admin/whatsapp", icon: Phone, testId: "nav-admin-whatsapp", cluster: "Sistema" },
        { name: "Recuperação de Conta", href: "/admin/account-recovery", icon: ShieldCheck, testId: "nav-admin-account-recovery", cluster: "Sistema" },
      ]
    : [];

  const isNavLinkActive = (href: string | null) => !!href && location === href;
  const isTimelineActive = location === "/" || location === "/timeline";
  const isMarketplaceSectionActive = location.startsWith("/marketplace");
  const isAdminSectionActive = location.startsWith("/admin");

  const groups: NavGroup[] = [
    { key: "criar", label: "Criar", icon: Sparkles, items: criarNav },
    ...(user?.isAdmin
      ? [{ key: "admin", label: "Painel Admin", icon: Shield, items: adminSubNav, headerHref: "/admin/analytics", sectionActive: isAdminSectionActive }]
      : []),
    { key: "utilidades", label: "Utilidades", icon: Wrench, items: utilitiesNav },
    { key: "marketplace", label: "Marketplace", icon: ShoppingBag, items: marketplaceSubNav, headerHref: "/marketplace", sectionActive: isMarketplaceSectionActive },
    { key: "comunidade", label: "Comunidade", icon: MessageCircle, items: communityNav },
    { key: "conta", label: "Conta", icon: User, items: userNav },
  ];

  // Grupos vêm colapsados por padrão — só o grupo que contém a rota atual abre sozinho.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    if (isAdminSectionActive) return new Set(["admin"]);
    if (isMarketplaceSectionActive) return new Set(["marketplace"]);
    const activeGroup = groups.find((g) => g.items.some((i) => i.href === location));
    return activeGroup ? new Set([activeGroup.key]) : new Set();
  });

  const query = normalize(searchQuery.trim());
  const matchesQuery = (name: string) => !query || normalize(name).includes(query);

  const visiblePinned = pinnedNav.filter((item) => matchesQuery(item.name));
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matchesQuery(item.name)) }))
    .filter((group) => !query || group.items.length > 0);
  const hasResults = visiblePinned.length > 0 || visibleGroups.some((g) => g.items.length > 0);

  // Enquanto o usuário busca, os grupos com resultado abrem automaticamente.
  const effectiveOpenKeys = query ? new Set(visibleGroups.map((g) => g.key)) : openKeys;

  const handleSelectionChange = (keys: any) => {
    if (query) return; // seleção controlada pela busca enquanto ela estiver ativa
    if (keys === "all") {
      setOpenKeys(new Set(groups.map((g) => g.key)));
      return;
    }
    setOpenKeys(new Set(Array.from(keys as Set<string>).map(String)));
  };

  // Linha de navegação — item simples com ícone, usada em todas as seções.
  function NavRow({
    name,
    href,
    icon: Icon,
    testId,
    active,
    badge,
    compact = false,
  }: {
    name: string;
    href: string | null;
    icon: any;
    testId: string;
    active: boolean;
    badge?: string;
    compact?: boolean;
  }) {
    const isComingSoon = href === null;
    const row = (
      <div
        className={cn(
          "relative flex items-center gap-3 text-sm transition-colors",
          compact ? "py-2 pl-4 pr-2" : "py-2.5 pl-4 pr-2",
          isSidebarCollapsed && "justify-center px-0",
          isComingSoon
            ? "cursor-default text-default-300"
            : active
              ? "text-primary font-medium"
              : "text-default-600 hover:text-foreground cursor-pointer"
        )}
        data-testid={testId}
        onMouseEnter={() => href && preloadOnHover(href)}
      >
        {!isSidebarCollapsed && (
          <span
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full transition-colors",
              active ? "bg-primary" : "bg-transparent"
            )}
          />
        )}
        <Icon className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-[18px] h-[18px]")} />
        {!isSidebarCollapsed && <span className="flex-1 truncate">{name}</span>}
        {!isSidebarCollapsed && badge && (
          <span className="text-[10px] uppercase tracking-wide text-default-300">{badge}</span>
        )}
      </div>
    );

    const content = isComingSoon ? row : <Link href={href}>{row}</Link>;

    if (isSidebarCollapsed) {
      return (
        <Tooltip content={name} placement="right" delay={200} closeDelay={0}>
          {content}
        </Tooltip>
      );
    }
    return content;
  }

  // Selo numérico discreto para cabeçalhos de grupo (ex.: contagem de itens no carrinho).
  function CountBadge({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
      <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold normal-case tracking-normal">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  const accordionItemClasses = {
    base: "px-0",
    title: "text-[11px] font-semibold uppercase tracking-wider",
    trigger: "px-1 py-2 data-[hover=true]:opacity-70 transition-opacity cursor-pointer",
    content: "pb-1 pt-0.5 pl-1 space-y-0.5",
    indicator: "text-default-300",
  };

  return (
    <>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 z-50 lg:z-auto",
          "bg-sidebar border-r border-sidebar-border",
          "flex flex-col h-screen",
          "transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "lg:w-[76px]" : "lg:w-72",
          "w-72",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Defensivo: neutraliza qualquer transform herdado em telas lg+ (evita que o
          // estado de abertura mobile crie um stacking context indesejado para flyouts
          // ou tooltips futuros do modo colapsado).
          "lg:transform-none"
        )}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="h-16 px-4 flex items-center justify-between shrink-0">
          <div className={cn("flex items-center", isSidebarCollapsed && "justify-center w-full")}>
            {!isSidebarCollapsed ? (
              <img src="/lowfy-logo-dark.webp" alt="Lowfy" className="h-6 w-auto object-contain" loading="eager" />
            ) : (
              <img src="/lowfy-logo-green.webp" alt="Lowfy" className="h-6 w-6 object-contain" loading="eager" />
            )}
          </div>
          {!isSidebarCollapsed && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              onPress={toggleCollapse}
              className="hidden lg:flex text-default-400"
              data-testid="button-toggle-collapse"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="full"
            onPress={closeSidebar}
            className="lg:hidden text-default-400"
            data-testid="button-close-sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {isSidebarCollapsed && (
          <div className="hidden lg:flex px-3 pb-2 justify-center">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              radius="full"
              onPress={toggleCollapse}
              className="text-default-400"
              data-testid="button-expand-collapse"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Busca — filtro em tempo real dos itens do menu */}
        {!isSidebarCollapsed && (
          <div className="px-4 pb-3 shrink-0">
            <Input
              aria-label="Buscar no menu"
              value={searchQuery}
              onValueChange={setSearchQuery}
              isClearable
              variant="underlined"
              color="primary"
              size="sm"
              placeholder="Buscar no menu"
              startContent={<Search className="h-4 w-4 text-default-400" />}
              classNames={{ inputWrapper: "shadow-none", input: "text-sm" }}
              data-testid="input-sidebar-search"
            />
          </div>
        )}

        <ScrollShadow className="flex-1 px-3 py-1" hideScrollBar>
          {isSidebarCollapsed ? (
            <div className="space-y-4">
              <div className="space-y-0.5">
                {pinnedNav.map((item) => (
                  <NavRow key={item.testId} {...item} active={isTimelineActive} />
                ))}
                {criarNav.map((item) => (
                  <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} />
                ))}
              </div>

              {user?.isAdmin && (
                <>
                  <Divider />
                  <NavRow name="Painel Admin" href="/admin/analytics" icon={Shield} testId="nav-admin" active={isAdminSectionActive} />
                </>
              )}

              <Divider />
              <div className="space-y-0.5">
                {utilitiesNav.map((item) => (
                  <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} />
                ))}
              </div>

              <Divider />
              <div className="space-y-0.5">
                <NavRow name="Marketplace" href="/marketplace" icon={ShoppingBag} testId="nav-marketplace" active={isMarketplaceSectionActive} />
                {communityNav.map((item) => (
                  <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} />
                ))}
              </div>

              <Divider />
              <div className="space-y-0.5 pb-2">
                {userNav.map((item) => (
                  <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {visiblePinned.map((item) => (
                <NavRow key={item.testId} {...item} active={isTimelineActive} />
              ))}

              {query && !hasResults && (
                <p className="px-3 py-8 text-center text-sm text-default-400" data-testid="sidebar-search-empty">
                  Nenhum item encontrado para "{searchQuery.trim()}"
                </p>
              )}

              {visibleGroups.length > 0 && (
                <Accordion
                  variant="light"
                  isCompact
                  selectionMode="multiple"
                  showDivider={false}
                  itemClasses={accordionItemClasses}
                  selectedKeys={Array.from(effectiveOpenKeys)}
                  onSelectionChange={handleSelectionChange}
                >
                  {visibleGroups.map((group) => (
                    <AccordionItem
                      key={group.key}
                      aria-label={group.label}
                      title={
                        group.headerHref ? (
                          // Elemento clicável (não <Link>) para não aninhar <a> dentro do
                          // <button> do trigger do AccordionItem — navega programaticamente
                          // e para a propagação para não também alternar o accordion.
                          <span
                            role="link"
                            className={cn(
                              "flex items-center gap-3 w-full text-[11px] font-semibold uppercase tracking-wider",
                              group.sectionActive ? "text-primary" : "text-default-400"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(group.headerHref!);
                            }}
                            onMouseEnter={() => preloadOnHover(group.headerHref!)}
                          >
                            <group.icon className="w-4 h-4 flex-shrink-0" />
                            {group.label}
                            {group.key === "marketplace" && <CountBadge count={cartItemCount} />}
                          </span>
                        ) : (
                          <span className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-default-400">
                            <group.icon className="w-4 h-4 flex-shrink-0" />
                            {group.label}
                          </span>
                        )
                      }
                    >
                      {group.key === "admin" ? (
                        <div className="space-y-2">
                          {groupByCluster(group.items).map((clusterGroup) => (
                            <div key={clusterGroup.cluster || "geral"}>
                              {clusterGroup.cluster && (
                                <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-default-300 select-none">
                                  {clusterGroup.cluster}
                                </p>
                              )}
                              <div className="space-y-0.5">
                                {clusterGroup.items.map((item) => (
                                  <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} compact />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {group.items.map((item) => (
                            <NavRow key={item.testId} {...item} active={isNavLinkActive(item.href)} compact />
                          ))}
                        </div>
                      )}
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          )}
        </ScrollShadow>

        {/* Perfil do usuário */}
        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className={cn("flex items-center", isSidebarCollapsed ? "flex-col gap-2" : "gap-3")}>
            <Avatar
              src={user?.profileImageUrl || undefined}
              name={getInitials(user?.name)}
              size="sm"
              radius="full"
              classNames={{ base: "bg-primary/10 ring-1 ring-border", name: "text-primary font-semibold" }}
              data-testid="user-initials"
            />
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">
                  {user?.name || user?.email || "Usuário"}
                </p>
                <p className="text-xs text-default-400 truncate" data-testid="user-email">
                  {user?.email}
                </p>
              </div>
            )}
            <Tooltip content="Sair" placement={isSidebarCollapsed ? "right" : "top"}>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                onPress={() => logoutMutation.mutate()}
                isDisabled={logoutMutation.isPending}
                className="text-danger-500 hover:bg-danger-50"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  );
}
