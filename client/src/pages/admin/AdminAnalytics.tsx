import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis, Legend, ResponsiveContainer,
} from "recharts";
import {
  Users, MessageSquare, BookOpen, ShoppingBag, Briefcase, TicketIcon,
  GraduationCap, Sparkles, BarChart3,
} from "lucide-react";
import {
  AdminPage, AdminPageHeader, StatCard, StatGrid, ChartCard,
  CHART_COLORS, gridProps, axisProps, tooltipStyle, formatNumber,
} from "@/components/admin";

interface AnalyticsData {
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

interface UserGrowthData { date: string; count: number }
interface ForumActivityData { date: string; topics: number; replies: number }

export default function AdminAnalytics() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: userGrowth, isLoading: userGrowthLoading } = useQuery<UserGrowthData[]>({
    queryKey: ["/api/admin/analytics/user-growth"],
  });

  const { data: forumActivity, isLoading: forumActivityLoading } = useQuery<ForumActivityData[]>({
    queryKey: ["/api/admin/analytics/forum-activity"],
  });

  const hasOpenTickets = (analytics?.openTickets ?? 0) > 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Analytics"
        description="Métricas gerais da plataforma"
        icon={BarChart3}
      />

      <StatGrid cols={4}>
        <StatCard
          label="Usuários"
          value={formatNumber(analytics?.totalUsers)}
          icon={Users}
          tone="success"
          hint={analytics ? `${formatNumber(analytics.activeUsers)} ativos` : undefined}
          loading={analyticsLoading}
          testId="analytics-total-users"
        />
        <StatCard
          label="Tópicos no fórum"
          value={formatNumber(analytics?.totalTopics)}
          icon={MessageSquare}
          tone="info"
          hint={analytics ? `${formatNumber(analytics.totalReplies)} respostas` : undefined}
          loading={analyticsLoading}
          testId="analytics-total-topics"
        />
        <StatCard
          label="Produtos no marketplace"
          value={formatNumber(analytics?.totalMarketplaceProducts)}
          icon={ShoppingBag}
          tone="violet"
          loading={analyticsLoading}
          testId="analytics-total-products"
        />
        <StatCard
          label="Tickets abertos"
          value={formatNumber(analytics?.openTickets)}
          icon={TicketIcon}
          tone={hasOpenTickets ? "danger" : "default"}
          colorValue={hasOpenTickets}
          hint={analytics ? `${formatNumber(analytics.totalSupportTickets)} no total` : undefined}
          loading={analyticsLoading}
          testId="analytics-open-tickets"
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard
          label="PLRs"
          value={formatNumber(analytics?.totalPLRs)}
          icon={BookOpen}
          loading={analyticsLoading}
          testId="analytics-total-plrs"
        />
        <StatCard
          label="Cursos"
          value={formatNumber(analytics?.totalCourses)}
          icon={GraduationCap}
          loading={analyticsLoading}
        />
        <StatCard
          label="Serviços white label"
          value={formatNumber(analytics?.totalServices)}
          icon={Briefcase}
          loading={analyticsLoading}
          testId="analytics-total-services"
        />
        <StatCard
          label="Ferramentas de IA"
          value={formatNumber(analytics?.totalAITools)}
          icon={Sparkles}
          loading={analyticsLoading}
        />
      </StatGrid>

      <ChartCard
        title="Crescimento de usuários"
        description="Novos cadastros nos últimos 30 dias"
        loading={userGrowthLoading}
        empty={(userGrowth?.length ?? 0) === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={userGrowth || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis {...axisProps} dataKey="date" dy={6} />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="count" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#growthGradient)" name="Novos usuários" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Atividade do fórum"
        description="Tópicos e respostas nos últimos 30 dias"
        loading={forumActivityLoading}
        empty={(forumActivity?.length ?? 0) === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forumActivity || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="topicsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.sky} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.sky} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="repliesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis {...axisProps} dataKey="date" dy={6} />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="topics" stroke={CHART_COLORS.sky} strokeWidth={2} fill="url(#topicsGradient)" name="Tópicos" />
            <Area type="monotone" dataKey="replies" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#repliesGradient)" name="Respostas" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </AdminPage>
  );
}
