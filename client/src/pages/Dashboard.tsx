import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, GraduationCap, Briefcase, Users, TrendingUp } from "lucide-react";
import { Link } from "wouter";
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

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  // Tour
  const tour = useTour(dashboardTour);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const quickStats = [
    {
      title: "PLRs Disponíveis",
      value: stats?.totalPLRs || 0,
      icon: BookOpen,
      href: "/plrs",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ferramentas IA",
      value: "6",
      icon: Zap,
      href: "/ai-tools",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Cursos Online",
      value: "12",
      icon: GraduationCap,
      href: "/courses",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "White Label",
      value: stats?.totalServices || 0,
      icon: Briefcase,
      href: "/services",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Membros",
      value: stats?.totalUsers || 0,
      icon: Users,
      href: "/forum",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Crescimento",
      value: "+15%",
      icon: TrendingUp,
      href: "/admin",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8" data-testid="dashboard-content">
      {/* Tour Overlay */}
      <TourOverlay
        isActive={tour.isActive}
        step={tour.getCurrentStep() || { title: '', description: '' }}
        element={tour.getCurrentElement()}
        currentStep={tour.currentStep}
        totalSteps={tour.totalSteps}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Painel Principal</h1>
          <p className="text-muted-foreground">Bem-vindo à sua plataforma de conteúdo digital</p>
        </div>
        {!tour.isActive && (
          <TourButton 
            onClick={tour.start} 
            label="Conhecer a plataforma"
            variant="outline"
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {quickStats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="card-hover cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1" data-testid={`card-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/plrs">
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="quick-action-plrs">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="text-foreground">Explorar PLRs</span>
              </div>
            </Link>
            <Link href="/ai-tools">
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="quick-action-ai-tools">
                <Zap className="w-5 h-5 text-accent" />
                <span className="text-foreground">Ferramentas de IA</span>
              </div>
            </Link>
            <Link href="/courses">
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="quick-action-courses">
                <GraduationCap className="w-5 h-5 text-secondary" />
                <span className="text-foreground">Cursos Online</span>
              </div>
            </Link>
            <Link href="/support">
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer" data-testid="quick-action-support">
                <Briefcase className="w-5 h-5 text-primary" />
                <span className="text-foreground">Suporte</span>
              </div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Novidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/30" data-testid="announcement-new-plrs">
              <h4 className="font-semibold text-foreground mb-2">Novos PLRs Adicionados</h4>
              <p className="text-sm text-muted-foreground">
                Confira os novos PLRs de Marketing Digital e Saúde & Bem-estar que acabaram de ser adicionados à plataforma.
              </p>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30" data-testid="announcement-ai-tools">
              <h4 className="font-semibold text-foreground mb-2">Ferramentas de IA Atualizadas</h4>
              <p className="text-sm text-muted-foreground">
                Novas funcionalidades foram adicionadas ao gerador de conteúdo e criador de imagens.
              </p>
            </div>
            <div className="p-4 bg-secondary/10 rounded-lg border border-secondary/30" data-testid="announcement-forum">
              <h4 className="font-semibold text-foreground mb-2">Fórum da Comunidade</h4>
              <p className="text-sm text-muted-foreground">
                Participe das discussões e conecte-se com outros membros da comunidade.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
