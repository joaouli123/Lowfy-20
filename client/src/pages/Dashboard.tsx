import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@heroui/react";
import { BookOpen, Zap, GraduationCap, Briefcase, Users, TrendingUp, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from "recharts";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/ui/tour/TourOverlay";
import { TourButton } from "@/components/ui/tour/TourButton";
import { dashboardTour } from "@/config/tours";

interface AdminStats {
  totalPLRs: number;
  totalUsers: number;
  totalServices: number;
  monthlyRevenue: number;
}

// Gera o mesmo slug usado pelo dashboardTour (config/tours.ts) para apontar os steps do tour.
const slug = (title: string) => title.toLowerCase().replace(/\s+/g, "-");

// Reduz o valor exibido (string ou número) a um número plano só para alimentar o
// gráfico de panorama — é o mesmo valor já mostrado como texto no card, sem nenhuma
// métrica nova sendo inventada.
const toNumericValue = (value: string | number) => {
  if (typeof value === "number") return value;
  const parsed = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs text-default-500">{payload[0].payload.name}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{payload[0].value}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const tour = useTour(dashboardTour);

  const firstName = user?.name?.split(" ")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const quickStats = [
    {
      title: "PLRs Disponíveis",
      value: stats?.totalPLRs ?? 0,
      icon: BookOpen,
      href: "/plrs",
    },
    {
      title: "Ferramentas IA",
      value: "6",
      icon: Zap,
      href: "/ai-tools",
    },
    {
      title: "Cursos Online",
      value: "12",
      icon: GraduationCap,
      href: "/courses",
    },
    {
      title: "White Label",
      value: stats?.totalServices ?? 0,
      icon: Briefcase,
      href: "/services",
    },
    {
      title: "Membros",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      href: "/forum",
    },
    {
      title: "Crescimento",
      value: "+15%",
      icon: TrendingUp,
      href: "/admin",
    },
  ];

  const [primaryStat, ...restStats] = quickStats;

  const chartData = restStats.map((stat) => ({ name: stat.title, value: toNumericValue(stat.value) }));

  const quickActions = [
    { label: "Explorar PLRs", href: "/plrs", icon: BookOpen, testId: "quick-action-plrs" },
    { label: "Ferramentas de IA", href: "/ai-tools", icon: Zap, testId: "quick-action-ai-tools" },
    { label: "Cursos Online", href: "/courses", icon: GraduationCap, testId: "quick-action-courses" },
    { label: "Suporte", href: "/support", icon: Briefcase, testId: "quick-action-support" },
  ];

  const announcements = [
    {
      title: "Novos PLRs Adicionados",
      description: "Confira os novos PLRs de Marketing Digital e Saúde & Bem-estar que acabaram de ser adicionados à plataforma.",
      testId: "announcement-new-plrs",
    },
    {
      title: "Ferramentas de IA Atualizadas",
      description: "Novas funcionalidades foram adicionadas ao gerador de conteúdo e criador de imagens.",
      testId: "announcement-ai-tools",
    },
    {
      title: "Fórum da Comunidade",
      description: "Participe das discussões e conecte-se com outros membros da comunidade.",
      testId: "announcement-forum",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto" data-testid="dashboard-content">
      <TourOverlay
        isActive={tour.isActive}
        step={tour.getCurrentStep() || { title: "", description: "" }}
        elementRef={tour.getCurrentElement()}
        currentStep={tour.currentStep}
        totalSteps={tour.totalSteps}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />

      {/* Saudação — destaque narrativo de abertura */}
      <header className="mb-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Painel Principal</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight leading-[1.1]">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-default-500 mt-3 text-base leading-relaxed max-w-md">
          Aqui está um resumo rápido da sua plataforma de conteúdo digital hoje.
        </p>
        {!tour.isActive && (
          <div className="mt-6">
            <TourButton onClick={tour.start} label="Conhecer a plataforma" variant="outline" />
          </div>
        )}
      </header>

      {/* Destaque principal — único número grande, sem card, primeiro na rolagem */}
      <section className="mb-16 pb-14 border-b border-border">
        <p className="text-sm font-medium text-default-500 mb-4">Comece por aqui</p>
        <Link href={primaryStat.href}>
          <div
            className="group flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 cursor-pointer"
            data-testid={`card-${slug(primaryStat.title)}`}
          >
            <div>
              <p className="text-sm text-default-500 mb-2">{primaryStat.title} para você</p>
              {isLoading ? (
                <Skeleton className="h-14 w-32 rounded-lg" />
              ) : (
                <p className="text-6xl sm:text-7xl font-bold text-foreground tracking-tight tabular-nums">
                  {primaryStat.value}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-primary font-medium text-sm pb-2 shrink-0 group-hover:gap-2.5 transition-all">
              Explorar PLRs
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        </Link>
      </section>

      {/* A plataforma em números — faixa compacta e escaneável, com panorama comparativo */}
      <section className="mb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-default-400 mb-5">
          A plataforma em números
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {restStats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <div
                className="group flex flex-col gap-2 rounded-xl border border-border p-4 h-full cursor-pointer hover:border-primary/40 transition-colors"
                data-testid={`card-${slug(stat.title)}`}
              >
                <stat.icon className="w-4 h-4 text-default-400 group-hover:text-primary transition-colors" />
                {isLoading ? (
                  <Skeleton className="h-6 w-12 rounded-md" />
                ) : (
                  <span className="text-xl font-semibold text-foreground tabular-nums">{stat.value}</span>
                )}
                <span className="text-xs text-default-500 group-hover:text-foreground transition-colors leading-tight">
                  {stat.title}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-default-400 mb-2">Panorama comparativo</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#dashboardTrend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Ações rápidas */}
      <section className="mb-16">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-default-400 mb-5">Ações rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <div
                className="group flex items-center gap-3 py-3 cursor-pointer"
                data-testid={action.testId}
              >
                <action.icon className="w-4 h-4 text-default-400 group-hover:text-primary transition-colors shrink-0" />
                <span className="text-sm text-default-600 group-hover:text-foreground transition-colors flex-1">
                  {action.label}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-default-300 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Novidades — fecho narrativo da página */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-default-400 mb-5">Novidades</h2>
        <div className="space-y-8">
          {announcements.map((item) => (
            <div key={item.testId} data-testid={item.testId}>
              <h3 className="font-semibold text-foreground text-sm mb-1.5">{item.title}</h3>
              <p className="text-sm text-default-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
