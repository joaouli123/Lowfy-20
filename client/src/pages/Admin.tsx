import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Users,
  LifeBuoy,
  MessagesSquare,
  BookOpen,
  GraduationCap,
  ShoppingBag,
  Briefcase,
  Sparkles,
  BarChart3,
  Globe,
  Wallet,
  DollarSign,
  ShoppingCart,
  Share2,
  TrendingUp,
  Database,
  Wrench,
  Bug,
  MessageCircle,
  KeyRound,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  AdminPage,
  AdminPageHeader,
  StatCard,
  StatGrid,
  ChartCard,
  CHART_COLORS,
  gridProps,
  axisProps,
  tooltipStyle,
  formatNumber,
} from "@/components/admin";

interface AdminAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalTopics: number;
  totalReplies: number;
  totalPLRs: number;
  totalServices: number;
  totalCourses: number;
  totalAITools: number;
  totalMarketplaceProducts: number;
  totalSupportTickets: number;
  openTickets: number;
}

interface UserGrowthData {
  date: string;
  count: number;
}

interface ForumActivityData {
  date: string;
  topics: number;
  replies: number;
}

interface AdminArea {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  testId: string;
}

const ADMIN_AREAS: { title: string; items: AdminArea[] }[] = [
  {
    title: "Análises",
    items: [
      { name: "Analytics", description: "Métricas gerais da plataforma", href: "/admin/analytics", icon: BarChart3, testId: "link-admin-analytics" },
      { name: "Analytics de Clonagem", description: "Páginas clonadas e acessos", href: "/admin/clonagem-analytics", icon: Globe, testId: "link-admin-clonagem-analytics" },
      { name: "Uso de IA", description: "Consumo e custo por ferramenta", href: "/admin/ai-usage", icon: Sparkles, testId: "link-admin-ai-usage" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { name: "Financeiro", description: "Receita, assinaturas e vendas", href: "/admin/financeiro", icon: Wallet, testId: "link-admin-financeiro" },
      { name: "Reembolsos de Assinatura", description: "Solicitações de reembolso", href: "/admin/subscription-refunds", icon: DollarSign, testId: "link-admin-subscription-refunds" },
      { name: "Checkouts Abandonados", description: "Recuperação de vendas perdidas", href: "/admin/checkout-abandonado", icon: ShoppingCart, testId: "link-admin-checkout-abandonado" },
      { name: "Afiliados", description: "Programa de indicações", href: "/admin/afiliados", icon: Share2, testId: "link-admin-afiliados" },
      { name: "Vendedores", description: "Sellers do marketplace", href: "/admin/vendedores", icon: TrendingUp, testId: "link-admin-vendedores" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { name: "Usuários", description: "Contas, planos e acessos", href: "/admin/usuarios", icon: Users, testId: "link-admin-usuarios" },
      { name: "Conteúdo", description: "PLRs, categorias e idiomas", href: "/admin/conteudo", icon: Database, testId: "link-admin-conteudo" },
      { name: "Cursos Online", description: "Catálogo de cursos", href: "/admin/cursos", icon: GraduationCap, testId: "link-admin-cursos" },
      { name: "Marketplace", description: "Produtos e reviews", href: "/admin/marketplace", icon: ShoppingBag, testId: "link-admin-marketplace" },
      { name: "Comunidade", description: "Fórum e tickets de suporte", href: "/admin/comunidade", icon: MessagesSquare, testId: "link-admin-comunidade" },
      { name: "White Label e Tools IA", description: "Serviços e ferramentas de IA", href: "/admin/servicos", icon: Wrench, testId: "link-admin-servicos" },
      { name: "Bugs Reportados", description: "Problemas relatados pelos usuários", href: "/admin/bugs", icon: Bug, testId: "link-admin-bugs" },
    ],
  },
  {
    title: "Operações",
    items: [
      { name: "WhatsApp", description: "Conexão, campanhas e bloqueios", href: "/admin/whatsapp", icon: MessageCircle, testId: "link-admin-whatsapp" },
      { name: "Recuperação de Conta", description: "Solicitações via WhatsApp", href: "/admin/account-recovery", icon: KeyRound, testId: "link-admin-account-recovery" },
    ],
  },
];

export default function Admin() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: userGrowth, isLoading: userGrowthLoading } = useQuery<UserGrowthData[]>({
    queryKey: ["/api/admin/analytics/user-growth"],
  });

  const { data: forumActivity, isLoading: forumActivityLoading } = useQuery<ForumActivityData[]>({
    queryKey: ["/api/admin/analytics/forum-activity"],
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title="Painel Administrativo"
        description="Visão geral da plataforma e acesso rápido a todas as áreas"
        icon={LayoutDashboard}
      />

      <StatGrid cols={4}>
        <StatCard
          label="Usuários"
          value={formatNumber(analytics?.totalUsers ?? 0)}
          icon={Users}
          hint={`${formatNumber(analytics?.activeUsers ?? 0)} novos nos últimos 30 dias`}
          loading={analyticsLoading}
          testId="stat-total-users"
        />
        <StatCard
          label="Tickets de suporte"
          value={formatNumber(analytics?.totalSupportTickets ?? 0)}
          icon={LifeBuoy}
          tone={(analytics?.openTickets ?? 0) > 0 ? "warning" : "default"}
          hint={`${formatNumber(analytics?.openTickets ?? 0)} em aberto`}
          loading={analyticsLoading}
          testId="stat-support-tickets"
        />
        <StatCard
          label="Tópicos do fórum"
          value={formatNumber(analytics?.totalTopics ?? 0)}
          icon={MessagesSquare}
          tone="info"
          hint={`${formatNumber(analytics?.totalReplies ?? 0)} respostas`}
          loading={analyticsLoading}
          testId="stat-forum-topics"
        />
        <StatCard
          label="PLRs ativos"
          value={formatNumber(analytics?.totalPLRs ?? 0)}
          icon={BookOpen}
          tone="success"
          loading={analyticsLoading}
          testId="stat-total-plrs"
        />
        <StatCard
          label="Cursos"
          value={formatNumber(analytics?.totalCourses ?? 0)}
          icon={GraduationCap}
          loading={analyticsLoading}
          testId="stat-total-courses"
        />
        <StatCard
          label="Produtos no marketplace"
          value={formatNumber(analytics?.totalMarketplaceProducts ?? 0)}
          icon={ShoppingBag}
          loading={analyticsLoading}
          testId="stat-marketplace-products"
        />
        <StatCard
          label="White labels"
          value={formatNumber(analytics?.totalServices ?? 0)}
          icon={Briefcase}
          loading={analyticsLoading}
          testId="stat-total-services"
        />
        <StatCard
          label="Ferramentas IA"
          value={formatNumber(analytics?.totalAITools ?? 0)}
          icon={Sparkles}
          tone="violet"
          loading={analyticsLoading}
          testId="stat-total-ai-tools"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          title="Novos usuários"
          description="Cadastros por dia nos últimos 30 dias"
          loading={userGrowthLoading}
          empty={!!userGrowth && userGrowth.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={userGrowth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="adminUserGrowthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip {...tooltipStyle} />
              <Area
                type="monotone"
                dataKey="count"
                name="Novos usuários"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                fill="url(#adminUserGrowthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Atividade do fórum"
          description="Tópicos e respostas por dia nos últimos 30 dias"
          loading={forumActivityLoading}
          empty={!!forumActivity && forumActivity.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forumActivity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} width={36} />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="topics" name="Tópicos" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="replies" name="Respostas" fill={CHART_COLORS.sky} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {ADMIN_AREAS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((area) => {
              const Icon = area.icon;
              return (
                <Link key={area.href} href={area.href}>
                  <div
                    className="group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
                    data-testid={area.testId}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{area.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{area.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </AdminPage>
  );
}
