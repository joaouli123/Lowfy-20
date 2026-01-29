
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  MessageSquare,
  BookOpen,
  ShoppingBag,
  Briefcase,
  TicketIcon,
  TrendingUp,
} from "lucide-react";

export default function AdminAnalytics() {
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
    <div className="p-[50px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">Visualize métricas e estatísticas da plataforma</p>
      </div>

      <div className="space-y-6">
        {/* Analytics Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card data-testid="analytics-total-users">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Usuários</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalUsers || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
              {!analyticsLoading && analytics && (
                <Badge variant="secondary" className="text-xs">
                  {analytics.activeUsers} ativos
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card data-testid="analytics-total-topics">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Tópicos</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalTopics || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="analytics-total-plrs">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de PLRs</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalPLRs || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="analytics-total-products">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Produtos</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalMarketplaceProducts || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="analytics-total-services">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total de Serviços</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalServices || 0}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="analytics-open-tickets" className={analytics?.openTickets && analytics.openTickets > 0 ? "border-destructive/50" : ""}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tickets Abertos</p>
                  {analyticsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className={`text-2xl font-bold ${analytics?.openTickets && analytics.openTickets > 0 ? "text-destructive" : "text-foreground"}`}>
                      {analytics?.openTickets || 0}
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${analytics?.openTickets && analytics.openTickets > 0 ? "bg-destructive/10" : "bg-secondary/10"}`}>
                  <TicketIcon className={`w-6 h-6 ${analytics?.openTickets && analytics.openTickets > 0 ? "text-destructive" : "text-secondary"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Growth Chart */}
        <Card data-testid="chart-user-growth">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Crescimento de Usuários (30 dias)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userGrowthLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowth || []}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={10}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    fill="url(#colorCount)"
                    name="Novos Usuários"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Forum Activity Chart */}
        <Card data-testid="chart-forum-activity">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Atividade do Fórum (30 dias)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forumActivityLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={forumActivity || []}>
                  <defs>
                    <linearGradient id="colorTopics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickMargin={10}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: "20px" }}
                    iconType="circle"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="topics" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#colorTopics)"
                    name="Tópicos"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="replies" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="url(#colorReplies)"
                    name="Respostas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
