import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import {
  LineChart,
  Line,
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
  BookOpen,
  Users,
  Briefcase,
  TrendingUp,
  Plus,
  Edit,
  Trash,
  Settings,
  BarChart3,
  MessageSquare,
  ShoppingBag,
  TicketIcon,
  Shield,
  ShieldOff,
  Lock,
  Unlock,
  Pin,
  PinOff,
  AlertCircle,
  ShoppingCart,
} from "lucide-react";
import * as flags from 'country-flag-icons/react/3x2';
import {
  insertPLRSchema,
  insertServiceSchema,
  insertCategorySchema,
  insertLanguageSchema,
  insertCourseSchema,
  insertAIToolSchema,
  insertMarketplaceProductSchema,
  type InsertPLR,
  type InsertService,
  type InsertCategory,
  type InsertLanguage,
  type InsertCourse,
  type InsertAITool,
  type InsertMarketplaceProduct,
  type PLRWithRelations,
  type Category,
  type Language,
  type Service,
  type Course,
  type AITool,
  type User,
  type MarketplaceProductWithRelations,
  type ProductReview,
  type ForumTopicWithRelations,
  type SupportTicketWithRelations,
} from "@shared/schema";
import { z } from "zod";
import { useEffect } from "react";
import AdminClonagemAnalytics from "./admin/AdminClonagemAnalytics";

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [user, toast]);

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
    enabled: !!user?.isAdmin,
  });

  const { data: userGrowth, isLoading: userGrowthLoading } = useQuery<UserGrowthData[]>({
    queryKey: ["/api/admin/analytics/user-growth"],
    enabled: !!user?.isAdmin,
  });

  const { data: forumActivity, isLoading: forumActivityLoading } = useQuery<ForumActivityData[]>({
    queryKey: ["/api/admin/analytics/forum-activity"],
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <Card className="p-8 text-center">
          <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Acesso Restrito</h3>
          <p className="text-muted-foreground">
            Esta página é restrita para administradores.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 lg:px-[50px] pt-[50px] pb-[50px]" data-testid="admin-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie conteúdos, serviços e usuários</p>
      </div>

      <Tabs defaultValue="management" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 bg-white">
          <TabsTrigger value="management" data-testid="tab-management" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
            Gestão
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-6">
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-white">
              <TabsTrigger value="users" data-testid="tab-users" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <BookOpen className="w-4 h-4 mr-2" />
                Conteúdo
              </TabsTrigger>
              <TabsTrigger value="education" data-testid="tab-education" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <Briefcase className="w-4 h-4 mr-2" />
                Cursos Online
              </TabsTrigger>
              <TabsTrigger value="marketplace" data-testid="tab-marketplace" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Marketplace
              </TabsTrigger>
              <TabsTrigger value="community" data-testid="tab-community" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <MessageSquare className="w-4 h-4 mr-2" />
                Comunidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UsersManagement />
            </TabsContent>

            <TabsContent value="content">
              <ContentManagement />
            </TabsContent>

            <TabsContent value="education">
              <EducationManagement />
            </TabsContent>

            <TabsContent value="marketplace">
              <MarketplaceManagement />
            </TabsContent>

            <TabsContent value="community">
              <CommunityManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-8 w-16" /></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card data-testid="stat-total-users">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics?.activeUsers || 0} ativos
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="stat-forum-topics">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tópicos do Fórum</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalTopics || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics?.totalReplies || 0} respostas
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="stat-support-tickets">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tickets de Suporte</CardTitle>
                    <TicketIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalSupportTickets || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics?.openTickets || 0} abertos
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="stat-total-plrs">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">PLRs Ativos</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalPLRs || 0}</div>
                  </CardContent>
                </Card>

                <Card data-testid="stat-total-courses">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cursos</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalCourses || 0}</div>
                  </CardContent>
                </Card>

                <Card data-testid="stat-marketplace-products">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Produtos</CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.totalMarketplaceProducts || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Crescimento de Usuários</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userGrowthLoading ? (
                      <Skeleton className="h-[300px]" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={userGrowth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="count" stroke="#8884d8" name="Usuários" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Atividade do Fórum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {forumActivityLoading ? (
                      <Skeleton className="h-[300px]" />
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={forumActivity}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="topics" fill="#8884d8" name="Tópicos" />
                          <Bar dataKey="replies" fill="#82ca9d" name="Respostas" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ==================== USERS MANAGEMENT ====================
function UsersManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<User> }) => {
      await apiRequest("PUT", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
    },
  });

  const toggleAdmin = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isAdmin: !user.isAdmin },
    });
  };

  const toggleBlock = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { accountStatus: user.accountStatus === 'blocked' ? 'active' : 'blocked' },
    });
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card className="mt-6 bg-white">
      <CardHeader>
        <CardTitle>Gerenciar Usuários</CardTitle>
      </CardHeader>
      <CardContent className="bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell data-testid={`user-name-${user.id}`}>{user.name}</TableCell>
                <TableCell data-testid={`user-email-${user.id}`}>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.accountStatus === 'active' ? 'default' : 'destructive'} data-testid={`user-status-${user.id}`}>
                    {user.accountStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isAdmin ? 'secondary' : 'outline'} data-testid={`user-type-${user.id}`}>
                    {user.isAdmin ? 'Admin' : 'User'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAdmin(user)}
                    data-testid={`button-toggle-admin-${user.id}`}
                  >
                    {user.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleBlock(user)}
                    data-testid={`button-toggle-block-${user.id}`}
                  >
                    {user.accountStatus === 'blocked' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ==================== CONTENT MANAGEMENT ====================
function ContentManagement() {
  return (
    <Tabs defaultValue="plrs" className="mt-6">
      <TabsList className="grid w-full grid-cols-3 bg-white">
        <TabsTrigger value="plrs" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">PLRs</TabsTrigger>
        <TabsTrigger value="categories" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Categorias</TabsTrigger>
        <TabsTrigger value="languages" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Idiomas</TabsTrigger>
      </TabsList>
      <TabsContent value="plrs"><PLRsManagement /></TabsContent>
      <TabsContent value="categories"><CategoriesManagement /></TabsContent>
      <TabsContent value="languages"><LanguagesManagement /></TabsContent>
    </Tabs>
  );
}

function PLRsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPLR, setEditingPLR] = useState<PLRWithRelations | null>(null);
  const [currentTab, setCurrentTab] = useState("basico");
  const [enabledContentTypes, setEnabledContentTypes] = useState<{[key: string]: { enabled: boolean; languages: string[]; link: string }}>({
    'ebook': { enabled: false, languages: [], link: '' },
    'vsl': { enabled: false, languages: [], link: '' },
    'landingpage': { enabled: false, languages: [], link: '' },
    'quiz': { enabled: false, languages: [], link: '' },
    'criativos': { enabled: false, languages: [], link: '' },
  });
  const [extraLinks, setExtraLinks] = useState<Array<{ title: string; url: string }>>([]);

  const { data: plrs, isLoading } = useQuery<PLRWithRelations[]>({
    queryKey: ["/api/plrs"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: languages } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
  });

  const contentTypes = [
    { value: 'ebook', label: 'E-book', icon: BookOpen },
    { value: 'vsl', label: 'VSL', icon: TrendingUp },
    { value: 'landingpage', label: 'Página', icon: Briefcase },
    { value: 'quiz', label: 'Quiz', icon: AlertCircle },
    { value: 'criativos', label: 'Criativos', icon: Settings },
  ];

  const downloadTypes = [
    { value: 'capa', label: 'Capa' },
    { value: 'ebook', label: 'E-book' },
    { value: 'vsl', label: 'VSL' },
    { value: 'criativos', label: 'Criativos' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'landingpage', label: 'Página' },
  ];

  const form = useForm<InsertPLR>({
    resolver: zodResolver(insertPLRSchema),
    defaultValues: {
      title: "",
      description: "",
      coverImageUrl: "",
      categoryId: "",
      countryCode: "BR",
      price: 0,
      isFree: true,
      isActive: true,
    },
  });

  // Função para converter link do Google Drive para URL de visualização direta
  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;

    // Se já está no formato correto, retorna
    if (url.includes('drive.google.com/uc?')) return url;

    // Extrai o ID do arquivo de diferentes formatos de URL do Google Drive
    let fileId = '';

    // Formato: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }

    // Formato: https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }

    // Se encontrou o ID, converte para URL de visualização direta
    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    // Se não conseguiu converter, retorna a URL original
    return url;
  };

  const createMutation = useMutation({
    mutationFn: async (data: { plr: InsertPLR; downloads: any[] }) => {
      const plr: any = await apiRequest("POST", "/api/plrs", data.plr);

      if (data.downloads && data.downloads.length > 0) {
        for (const download of data.downloads) {
          for (const langId of download.languages) {
            await apiRequest("POST", "/api/plrs/bulk/downloads", {
              plrId: plr.id,
              type: download.type,
              languageId: langId,
              fileUrl: download.link,
            });
          }
        }
      }

      return plr;
    },
    onSuccess: () => {
      toast({ title: "PLR criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/plrs"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar PLR", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { plr: InsertPLR; downloads: any[] } }) => {
      const plr = await apiRequest("PUT", `/api/plrs/${id}`, data.plr);

      await apiRequest("DELETE", `/api/plrs/${id}/downloads`);
      if (data.downloads && data.downloads.length > 0) {
        for (const download of data.downloads) {
          for (const langId of download.languages) {
            await apiRequest("POST", "/api/plrs/bulk/downloads", {
              plrId: id,
              type: download.type,
              languageId: langId,
              fileUrl: download.link,
            });
          }
        }
      }

      return plr;
    },
    onSuccess: () => {
      toast({ title: "PLR atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/plrs"] });
      setIsDialogOpen(false);
      setEditingPLR(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar PLR", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/plrs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "PLR excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/plrs"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir PLR", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    form.reset();
    setCurrentTab("basico");
    setEnabledContentTypes({
      'ebook': { enabled: false, languages: [], link: '' },
      'vsl': { enabled: false, languages: [], link: '' },
      'landingpage': { enabled: false, languages: [], link: '' },
      'quiz': { enabled: false, languages: [], link: '' },
      'criativos': { enabled: false, languages: [], link: '' },
    });
    setExtraLinks([]);
  };

  const openDialog = (plr?: PLRWithRelations) => {
    if (plr) {
      setEditingPLR(plr);
      form.reset({
        title: plr.title,
        description: plr.description || "",
        coverImageUrl: plr.coverImageUrl || "",
        categoryId: plr.categoryId || "",
        countryCode: plr.countryCode || "BR",
        price: plr.price || 0,
        isFree: plr.isFree ?? true,
        isActive: plr.isActive,
      });

      if (plr.downloads && plr.downloads.length > 0) {
        const typeToDownloads = plr.downloads.reduce((acc: any, d) => {
          if (!acc[d.type]) {
            acc[d.type] = {
              enabled: true,
              languages: [d.languageId],
              link: d.fileUrl
            };
          } else {
            if (!acc[d.type].languages.includes(d.languageId)) {
              acc[d.type].languages.push(d.languageId);
            }
          }
          return acc;
        }, {});

        setEnabledContentTypes({
          'ebook': typeToDownloads['ebook'] || { enabled: false, languages: [], link: '' },
          'vsl': typeToDownloads['vsl'] || { enabled: false, languages: [], link: '' },
          'landingpage': typeToDownloads['landingpage'] || { enabled: false, languages: [], link: '' },
          'quiz': typeToDownloads['quiz'] || { enabled: false, languages: [], link: '' },
          'criativos': typeToDownloads['criativos'] || { enabled: false, languages: [], link: '' },
        });
      }

      setExtraLinks(plr.extraLinks || []);
    } else {
      setEditingPLR(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };



  const onSubmit = (data: InsertPLR) => {
    // Validação dos campos obrigatórios
    if (!data.title || data.title.trim() === '') {
      toast({ 
        title: "Erro de validação", 
        description: "O título do PLR é obrigatório", 
        variant: "destructive" 
      });
      return;
    }

    if (!data.description || data.description.trim() === '') {
      toast({ 
        title: "Erro de validação", 
        description: "A descrição do PLR é obrigatória", 
        variant: "destructive" 
      });
      return;
    }

    if (!data.categoryId || data.categoryId.trim() === '') {
      toast({ 
        title: "Erro de validação", 
        description: "A categoria é obrigatória", 
        variant: "destructive" 
      });
      return;
    }

    if (!data.coverImageUrl || data.coverImageUrl.trim() === '') {
      toast({ 
        title: "Erro de validação", 
        description: "A capa (imagem) é obrigatória", 
        variant: "destructive" 
      });
      return;
    }

    const downloadsArray: any[] = [];

    Object.entries(enabledContentTypes).forEach(([type, config]) => {
      if (config.enabled && config.languages.length > 0) {
        if (!config.link || config.link.trim() === '') {
          toast({ 
            title: "Erro de validação", 
            description: `O link para ${type} está vazio`, 
            variant: "destructive" 
          });
          return;
        }
        downloadsArray.push({
          type,
          languages: config.languages,
          link: convertGoogleDriveUrl(config.link)
        });
      }
    });

    // Verificar se ao menos um e-book foi adicionado
    const hasEbook = downloadsArray.some(d => d.type === 'ebook');
    if (!hasEbook) {
      toast({ 
        title: "Erro de validação", 
        description: "É necessário adicionar ao menos um e-book em qualquer idioma", 
        variant: "destructive" 
      });
      return;
    }

    const payload = {
      plr: {
        ...data,
        coverImageUrl: convertGoogleDriveUrl(data.coverImageUrl),
        extraLinks: extraLinks.filter(link => link.title && link.url),
      },
      downloads: downloadsArray,
    };

    if (editingPLR) {
      updateMutation.mutate({ id: editingPLR.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const importFromDriveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/import-from-drive", {
        folderId: "1itfq6kODRr77zVLF_xVHtdSsSwkkgUwR"
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Importação iniciada!", 
        description: "Os PLRs estão sendo importados do Google Drive. Verifique os logs do servidor."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/plrs"] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao importar", 
        description: "Ocorreu um erro ao iniciar a importação", 
        variant: "destructive" 
      });
    }
  });

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>PLRs</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-plr">
              <Plus className="w-4 h-4 mr-2" />
              Novo PLR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">
            <div className="flex h-[85vh]">
              <div className="flex-1 overflow-y-auto p-6">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl">{editingPLR ? "Editar PLR" : "Gerenciar PLR"}</DialogTitle>
                  <p className="text-sm text-muted-foreground">Crie e gerencie produtos PLR com recursos avançados</p>
                </DialogHeader>

                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 mb-6">
                    <TabsTrigger value="basico">Básico</TabsTrigger>
                    <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
                    <TabsTrigger value="links">Links</TabsTrigger>
                    <TabsTrigger value="idiomas">Idiomas</TabsTrigger>
                    <TabsTrigger value="criativos">Criativos</TabsTrigger>
                  </TabsList>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                      <TabsContent value="basico" className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Informações Básicas</h3>
                          <p className="text-sm text-muted-foreground mb-4">Configure as informações principais do PLR</p>

                          <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="coverImageUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Capa *</FormLabel>
                                  <FormControl>
                                    <Input {...field} data-testid="input-plr-cover" placeholder="URL da imagem de capa" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Categoria *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-plr-category">
                                          <SelectValue placeholder="Selecione uma categoria" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {categories?.map((cat) => (
                                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Título do PLR *</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-plr-title" placeholder="Ex: Curso Completo de Marketing Digital 2024" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Descrição</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} data-testid="input-plr-description" placeholder="Descreva o conteúdo do PLR..." rows={4} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                              <div className="flex items-center justify-between p-4 border rounded-lg">
                                <FormLabel>PLR Gratuito</FormLabel>
                                <FormField
                                  control={form.control}
                                  name="isFree"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-plr-free" />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {!form.watch("isFree") && (
                                <FormField
                                  control={form.control}
                                  name="price"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Preço (R$)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) * 100 || 0)}
                                          value={field.value ? field.value / 100 : 0}
                                          data-testid="input-plr-price"
                                          placeholder="0.00"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="conteudo" className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Arquivos e Downloads</h3>
                          <p className="text-sm text-muted-foreground mb-4">Habilite os tipos de conteúdo e adicione os idiomas disponíveis</p>

                          <div className="space-y-4">
                            {contentTypes.map((type) => {
                              const Icon = type.icon;
                              const isEnabled = enabledContentTypes[type.value]?.enabled;

                              return (
                                <Card key={type.value} className={`p-4 ${isEnabled ? 'border-primary' : ''}`}>
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <Icon className="w-5 h-5" />
                                        <div>
                                          <p className="font-medium">{type.label}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {isEnabled ? 'Habilitado' : 'Desabilitado'}
                                          </p>
                                        </div>
                                      </div>
                                      <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => {
                                          setEnabledContentTypes({
                                            ...enabledContentTypes,
                                            [type.value]: { enabled: checked, languages: [], link: '' }
                                          });
                                        }}
                                      />
                                    </div>

                                    {isEnabled && (
                                      <div className="space-y-3 pt-3 border-t">
                                        <div>
                                          <FormLabel className="text-sm">Idiomas Disponíveis</FormLabel>
                                          <div className="flex flex-wrap gap-2 mt-2">
                                            {languages?.map((lang) => {
                                              const isSelected = enabledContentTypes[type.value].languages.includes(lang.id);
                                              return (
                                                <div
                                                  key={lang.id}
                                                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                                                    isSelected
                                                      ? 'bg-primary text-primary-foreground border-primary'
                                                      : 'bg-background border-border hover:bg-muted'
                                                  }`}
                                                  onClick={() => {
                                                    const current = enabledContentTypes[type.value].languages;
                                                    const updated = isSelected
                                                      ? current.filter((id: string) => id !== lang.id)
                                                      : [...current, lang.id];
                                                    setEnabledContentTypes({
                                                      ...enabledContentTypes,
                                                      [type.value]: { ...enabledContentTypes[type.value], languages: updated }
                                                    });
                                                  }}
                                                >
                                                  <span className="text-xl">{lang.flagEmoji}</span>
                                                  <span className="text-sm font-medium">{lang.name}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        <div>
                                          <FormLabel className="text-sm">Link ou Upload</FormLabel>
                                          <Input
                                            value={enabledContentTypes[type.value].link}
                                            onChange={(e) => {
                                              setEnabledContentTypes({
                                                ...enabledContentTypes,
                                                [type.value]: { ...enabledContentTypes[type.value], link: e.target.value }
                                              });
                                            }}
                                            placeholder="Cole o link ou clique para fazer upload"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="links" className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Links e Recursos Extras</h3>
                          <p className="text-sm text-muted-foreground mb-4">Adicione links para recursos complementares, ferramentas ou materiais extras</p>

                          <div className="space-y-3">
                            {extraLinks.map((link, index) => (
                              <Card key={index} className="p-4">
                                <div className="flex gap-3">
                                  <div className="flex-1 space-y-3">
                                    <Input
                                      placeholder="Título do link (ex: Planilha de Cálculos)"
                                      value={link.title}
                                      onChange={(e) => {
                                        const newLinks = [...extraLinks];
                                        newLinks[index].title = e.target.value;
                                        setExtraLinks(newLinks);
                                      }}
                                      data-testid={`input-extra-link-title-${index}`}
                                    />
                                    <Input
                                      placeholder="URL do link (ex: https://...)"
                                      value={link.url}
                                      onChange={(e) => {
                                        const newLinks = [...extraLinks];
                                        newLinks[index].url = e.target.value;
                                        setExtraLinks(newLinks);
                                      }}
                                      data-testid={`input-extra-link-url-${index}`}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => {
                                      const newLinks = extraLinks.filter((_, i) => i !== index);
                                      setExtraLinks(newLinks);
                                    }}
                                    data-testid={`button-remove-extra-link-${index}`}
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </Card>
                            ))}

                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => setExtraLinks([...extraLinks, { title: '', url: '' }])}
                              data-testid="button-add-extra-link"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Adicionar Link Extra
                            </Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="idiomas" className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Configuração de Idiomas</h3>
                          <p className="text-sm text-muted-foreground mb-4">Gerencie os idiomas disponíveis para este PLR</p>
                          <p className="text-muted-foreground">Configure os idiomas na aba Conteúdo</p>
                        </div>
                      </TabsContent>

                      <TabsContent value="criativos" className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Materiais Criativos</h3>
                          <p className="text-sm text-muted-foreground mb-4">Adicione materiais promocionais e criativos</p>
                          <p className="text-muted-foreground">Em desenvolvimento...</p>
                        </div>
                      </TabsContent>

                      <div className="flex gap-2 mt-6 pt-6 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                          {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingPLR ? "Atualizar PLR" : "Criar PLR"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </Tabs>
              </div>

              <div className="w-80 bg-muted/30 border-l p-6 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Prévia do PLR</h3>
                  </div>

                  <div className="space-y-4">
                    {form.watch("coverImageUrl") ? (
                      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg border overflow-hidden">
                        <img
                          src={convertGoogleDriveUrl(form.watch("coverImageUrl"))}
                          alt="Capa"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.error-message')) {
                              target.style.display = 'none';
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'error-message absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-lg flex items-center justify-center';
                              errorDiv.innerHTML = '<div class="text-center p-4"><p class="text-sm text-red-600 font-medium">Erro ao carregar imagem</p><p class="text-xs text-muted-foreground mt-1">Verifique o link do Google Drive</p></div>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'block';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center border">
                        <div className="text-center">
                          <BookOpen className="w-12 h-12 text-primary/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhuma capa</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold text-lg mb-1">
                        {form.watch("title") || "Título do PLR"}
                      </h4>
                      {form.watch("categoryId") && categories && (
                        <Badge className="bg-green-500 text-white mb-2">
                          {categories.find(c => c.id === form.watch("categoryId"))?.name}
                        </Badge>
                      )}
                    </div>

                    {form.watch("description") && (
                      <div>
                        <p className="font-medium mb-2">Descrição:</p>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-sm text-muted-foreground line-clamp-4">
                            {form.watch("description")}
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="font-medium mb-2">Idiomas:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(enabledContentTypes).map(([key, value]) => {
                          if (value.enabled && value.languages.length > 0) {
                            return value.languages.map((langId: string) => {
                              const lang = languages?.find(l => l.id === langId);
                              return lang ? (
                                <span key={`${key}-${langId}`} className="text-2xl" title={lang.name}>
                                  {lang.flagEmoji}
                                </span>
                              ) : null;
                            });
                          }
                          return null;
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Status:</p>
                      {form.watch("isFree") ? (
                        <Badge className="bg-green-500 text-white">Gratuito</Badge>
                      ) : (
                        <Badge className="bg-yellow-500 text-black">
                          R$ {((form.watch("price") || 0) / 100).toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    {extraLinks.length > 0 && extraLinks.some(link => link.title || link.url) && (
                      <div>
                        <p className="font-medium mb-2">Links Extras:</p>
                        <div className="space-y-2">
                          {extraLinks.filter(link => link.title && link.url).map((link, index) => (
                            <div key={index} className="bg-muted/50 p-2 rounded-lg">
                              <p className="text-xs font-medium text-primary truncate">{link.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Idiomas</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plrs?.map((plr) => {
                const getLanguageFlagCode = (languageCode: string) => {
                  const baseCode = languageCode.split('-')[0].toLowerCase();
                  const languageToCountry: Record<string, string> = {
                    'pt': 'BR', 'en': 'GB', 'es': 'ES', 'fr': 'FR',
                    'de': 'DE', 'it': 'IT', 'ja': 'JP', 'ko': 'KR',
                    'zh': 'CN', 'ru': 'RU', 'ar': 'SA', 'hi': 'IN',
                  };
                  return languageToCountry[baseCode] || 'UN';
                };

                const uniqueLanguages = new Map();
                plr.downloads?.forEach(download => {
                  if (download.language) {
                    uniqueLanguages.set(download.language.code, download.language);
                  }
                });
                const availableLanguages = Array.from(uniqueLanguages.values());

                return (
                  <TableRow key={plr.id}>
                    <TableCell data-testid={`plr-title-${plr.id}`}>{plr.title}</TableCell>
                    <TableCell data-testid={`plr-category-${plr.id}`}>{plr.category?.name || "-"}</TableCell>
                    <TableCell data-testid={`plr-languages-${plr.id}`}>
                      <div className="flex gap-1 flex-wrap">
                        {availableLanguages.map((lang: any) => {
                          const countryCode = getLanguageFlagCode(lang.code);
                          const FlagComponent = flags[countryCode as keyof typeof flags];
                          return (
                            <div
                              key={lang.code}
                              className="w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center"
                              title={lang.name}
                            >
                              {FlagComponent ? (
                                <FlagComponent className="w-8 h-8 object-cover scale-150" />
                              ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px]">
                                  {lang.code.toUpperCase()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {availableLanguages.length === 0 && <span className="text-muted-foreground text-sm">-</span>}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`plr-price-${plr.id}`}>
                      {plr.isFree ? "Gratuito" : `R$ ${((plr.price || 0) / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plr.isActive ? "default" : "secondary"} data-testid={`plr-status-${plr.id}`}>
                        {plr.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openDialog(plr)} data-testid={`button-edit-plr-${plr.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(plr.id)} data-testid={`button-delete-plr-${plr.id}`}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCategory) => {
      await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      toast({ title: "Categoria criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertCategory }) => {
      await apiRequest("PUT", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Categoria atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsDialogOpen(false);
      setEditingCategory(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Categoria excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir categoria", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      form.reset({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
      });
    } else {
      setEditingCategory(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertCategory) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Categorias</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-category">
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-category-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-category-slug" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-category-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-category">
                    {editingCategory ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell data-testid={`category-name-${category.id}`}>{category.name}</TableCell>
                  <TableCell data-testid={`category-slug-${category.id}`}>{category.slug}</TableCell>
                  <TableCell data-testid={`category-description-${category.id}`}>{category.description || "-"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(category)} data-testid={`button-edit-category-${category.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(category.id)} data-testid={`button-delete-category-${category.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LanguagesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null);

  const { data: languages, isLoading } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
  });

  const form = useForm<InsertLanguage>({
    resolver: zodResolver(insertLanguageSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertLanguage) => {
      await apiRequest("POST", "/api/languages", data);
    },
    onSuccess: () => {
      toast({ title: "Idioma criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar idioma", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertLanguage }) => {
      await apiRequest("PUT", `/api/languages/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Idioma atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
      setIsDialogOpen(false);
      setEditingLanguage(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar idioma", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/languages/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Idioma excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/languages"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir idioma", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (language?: Language) => {
    if (language) {
      setEditingLanguage(language);
      form.reset({
        name: language.name,
        code: language.code,
      });
    } else {
      setEditingLanguage(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertLanguage) => {
    if (editingLanguage) {
      updateMutation.mutate({ id: editingLanguage.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Idiomas</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-language">
              <Plus className="w-4 h-4 mr-2" />
              Novo Idioma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLanguage ? "Editar Idioma" : "Novo Idioma"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-language-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código (ex: pt-BR)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-language-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-language">
                    {editingLanguage ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bandeira</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages?.map((language) => {
                const getLanguageFlag = (code: string) => {
                  const baseCode = code.split('-')[0].toLowerCase();
                  const languageToCountry: Record<string, string> = {
                    'pt': 'BR',
                    'en': 'GB',
                    'es': 'ES',
                    'fr': 'FR',
                    'de': 'DE',
                    'it': 'IT',
                    'ja': 'JP',
                    'ko': 'KR',
                    'zh': 'CN',
                    'ru': 'RU',
                    'ar': 'SA',
                    'hi': 'IN',
                  };
                  return languageToCountry[baseCode] || 'UN';
                };

                const countryCode = getLanguageFlag(language.code);
                const FlagComponent = (flags as any)[countryCode];

                return (
                  <TableRow key={language.id}>
                    <TableCell>
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center"
                        title={language.name}
                      >
                        {FlagComponent ? (
                          <FlagComponent className="w-12 h-12 object-cover scale-150" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs">
                            {language.code.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`language-name-${language.id}`}>{language.name}</TableCell>
                    <TableCell data-testid={`language-code-${language.id}`}>{language.code}</TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openDialog(language)} data-testid={`button-edit-language-${language.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(language.id)} data-testid={`button-delete-language-${language.id}`}>
                        <Trash className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== EDUCATION MANAGEMENT ====================
function EducationManagement() {
  return (
    <Tabs defaultValue="courses" className="mt-6">
      <TabsList className="grid w-full grid-cols-3 bg-white">
        <TabsTrigger value="courses" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Cursos</TabsTrigger>
        <TabsTrigger value="services" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">White label</TabsTrigger>
        <TabsTrigger value="ai-tools" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Ferramentas IA</TabsTrigger>
      </TabsList>
      <TabsContent value="courses"><CoursesManagement /></TabsContent>
      <TabsContent value="services"><ServicesManagement /></TabsContent>
      <TabsContent value="ai-tools"><AIToolsManagement /></TabsContent>
    </Tabs>
  );
}

function CoursesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });

  const form = useForm<InsertCourse>({
    resolver: zodResolver(insertCourseSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: "",
      lessonCount: 0,
      thumbnailUrl: "",
      courseUrl: "",
      isActive: true,
      isNew: false,
      isPopular: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCourse) => {
      await apiRequest("POST", "/api/courses", data);
    },
    onSuccess: () => {
      toast({ title: "Curso criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar curso", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertCourse }) => {
      await apiRequest("PUT", `/api/courses/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Curso atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setIsDialogOpen(false);
      setEditingCourse(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar curso", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/courses/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Curso excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir curso", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      form.reset({
        title: course.title,
        description: course.description || "",
        duration: course.duration || "",
        lessonCount: course.lessonCount || 0,
        thumbnailUrl: course.thumbnailUrl || "",
        courseUrl: course.courseUrl,
        isActive: course.isActive,
        isNew: course.isNew,
        isPopular: course.isPopular,
      });
    } else {
      setEditingCourse(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertCourse) => {
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cursos</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-course">
              <Plus className="w-4 h-4 mr-2" />
              Novo Curso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-course-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-course-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duração</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-course-duration" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lessonCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Aulas</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-course-lesson-count" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="courseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL do Curso</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-course-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Thumbnail (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-course-thumbnail" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>White Label Ativo</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isNew"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Novo</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-new" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isPopular"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Popular</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-course-popular" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-course">
                    {editingCourse ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Aulas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map((course) => (
                <TableRow key={course.id}>
                  <TableCell data-testid={`course-title-${course.id}`}>{course.title}</TableCell>
                  <TableCell data-testid={`course-duration-${course.id}`}>{course.duration}</TableCell>
                  <TableCell data-testid={`course-lessons-${course.id}`}>{course.lessonCount}</TableCell>
                  <TableCell>
                    <Badge variant={course.isActive ? "default" : "secondary"} data-testid={`course-status-${course.id}`}>
                      {course.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(course)} data-testid={`button-edit-course-${course.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(course.id)} data-testid={`button-delete-course-${course.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ServicesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const serviceFormSchema = insertServiceSchema.extend({
    benefitsText: z.string().optional(),
  }).omit({ benefits: true });

  type ServiceFormData = z.infer<typeof serviceFormSchema>;

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "",
      description: "",
      priceCents: 0,
      benefitsText: "",
      imageUrl: "",
      serviceUrl: "",
      isActive: true,
      isPopular: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      await apiRequest("POST", "/api/services", data);
    },
    onSuccess: () => {
      toast({ title: "Serviço criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar serviço", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertService }) => {
      await apiRequest("PUT", `/api/services/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Serviço atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsDialogOpen(false);
      setEditingService(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar serviço", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Serviço excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir serviço", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      form.reset({
        name: service.name,
        description: service.description || "",
        priceCents: service.priceCents,
        benefitsText: service.benefits?.join("\n") || "",
        imageUrl: service.imageUrl || "",
        serviceUrl: service.serviceUrl || "",
        isActive: service.isActive,
        isPopular: service.isPopular,
      });
    } else {
      setEditingService(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    const benefits = data.benefitsText?.split("\n").filter((b) => b.trim()) || [];
    const serviceData: InsertService = {
      name: data.name,
      description: data.description,
      priceCents: data.priceCents,
      benefits,
      imageUrl: data.imageUrl?.trim() || undefined,
      serviceUrl: data.serviceUrl?.trim() || undefined,
      isActive: data.isActive,
      isPopular: data.isPopular,
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: serviceData });
    } else {
      createMutation.mutate(serviceData);
    }
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-col gap-4">
        <div>
          <CardTitle className="text-2xl mb-2">White Label</CardTitle>
          <p className="text-sm text-gray-600">
            Tenha seu próprio sistema, sem perder tempo gastando dinheiro, tempo e se estressando em desenvolver seus próprios sistemas! 
            <br className="hidden md:block" />
            Compre seu white label e coloque sua marca - venda como SUA!
          </p>
        </div>
        <div className="flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} data-testid="button-create-service">
                <Plus className="w-4 h-4 mr-2" />
                Novo White Label
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingService ? "Editar White Label" : "Novo White Label"}</DialogTitle>
              </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do White Label</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Sistema Lowfy Customizado" data-testid="input-service-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do White Label</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-service-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceCents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço do White Label (centavos)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-service-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="benefitsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Benefícios do White Label (um por linha)</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-service-benefits" rows={5} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imagem do White Label</FormLabel>
                      <FormControl>
                        <SingleImageUpload
                          value={field.value || ""}
                          onChange={field.onChange}
                          maxSizeMB={2}
                          disabled={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link do White Label</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://exemplo.com/white-label" data-testid="input-service-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>White Label Ativo</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-service-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isPopular"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Popular</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-service-popular" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-service">
                    {editingService ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.map((service) => (
                <TableRow key={service.id}>
                  <TableCell data-testid={`service-name-${service.id}`}>{service.name}</TableCell>
                  <TableCell data-testid={`service-price-${service.id}`}>R$ {(service.priceCents / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={service.isActive ? "default" : "secondary"} data-testid={`service-status-${service.id}`}>
                      {service.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(service)} data-testid={`button-edit-service-${service.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(service.id)} data-testid={`button-delete-service-${service.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AIToolsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AITool | null>(null);

  const { data: tools, isLoading } = useQuery<AITool[]>({
    queryKey: ["/api/ai-tools"],
  });

  const form = useForm<InsertAITool>({
    resolver: zodResolver(insertAIToolSchema),
    defaultValues: {
      name: "",
      description: "",
      toolUrl: "",
      iconType: "default",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAITool) => {
      await apiRequest("POST", "/api/ai-tools", data);
    },
    onSuccess: () => {
      toast({ title: "Ferramenta IA criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar ferramenta", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertAITool }) => {
      await apiRequest("PUT", `/api/ai-tools/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Ferramenta IA atualizada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
      setIsDialogOpen(false);
      setEditingTool(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar ferramenta", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-tools/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Ferramenta IA excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir ferramenta", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (tool?: AITool) => {
    if (tool) {
      setEditingTool(tool);
      form.reset({
        name: tool.name,
        description: tool.description || "",
        toolUrl: tool.toolUrl,
        iconType: tool.iconType || "default",
        isActive: tool.isActive,
      });
    } else {
      setEditingTool(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertAITool) => {
    if (editingTool) {
      updateMutation.mutate({ id: editingTool.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ferramentas IA</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-ai-tool">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ferramenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTool ? "Editar Ferramenta IA" : "Nova Ferramenta IA"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-ai-tool-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-ai-tool-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toolUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Ferramenta</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-ai-tool-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Ativo</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ai-tool-active" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-ai-tool">
                    {editingTool ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools?.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell data-testid={`ai-tool-name-${tool.id}`}>{tool.name}</TableCell>
                  <TableCell data-testid={`ai-tool-url-${tool.id}`}>{tool.toolUrl}</TableCell>
                  <TableCell>
                    <Badge variant={tool.isActive ? "default" : "secondary"} data-testid={`ai-tool-status-${tool.id}`}>
                      {tool.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(tool)} data-testid={`button-edit-ai-tool-${tool.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(tool.id)} data-testid={`button-delete-ai-tool-${tool.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MARKETPLACE MANAGEMENT ====================
function MarketplaceManagement() {
  return (
    <Tabs defaultValue="products" className="mt-6">
      <TabsList className="grid w-full grid-cols-2 bg-white">
        <TabsTrigger value="products" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Produtos</TabsTrigger>
        <TabsTrigger value="reviews" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Reviews</TabsTrigger>
      </TabsList>
      <TabsContent value="products"><ProductsManagement /></TabsContent>
      <TabsContent value="reviews"><ReviewsManagement /></TabsContent>
    </Tabs>
  );
}

function ProductsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MarketplaceProductWithRelations | null>(null);

  const { data: products, isLoading } = useQuery<MarketplaceProductWithRelations[]>({
    queryKey: ["/api/marketplace/products"],
  });

  const form = useForm<InsertMarketplaceProduct>({
    resolver: zodResolver(insertMarketplaceProductSchema),
    defaultValues: {
      name: "",
      description: "",
      priceCents: 0,
      category: "",
      imageUrl: "",
      sellerId: "",
      isActive: true,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertMarketplaceProduct> }) => {
      await apiRequest("PUT", `/api/marketplace/products/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Produto atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar produto", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marketplace/products/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Produto excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir produto", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Produtos do Marketplace</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Avaliação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell data-testid={`product-name-${product.id}`}>{product.name}</TableCell>
                  <TableCell data-testid={`product-price-${product.id}`}>R$ {(product.priceCents / 100).toFixed(2)}</TableCell>
                  <TableCell data-testid={`product-category-${product.id}`}>{product.category}</TableCell>
                  <TableCell data-testid={`product-rating-${product.id}`}>
                    {product.rating ? (product.rating / 10).toFixed(1) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"} data-testid={`product-status-${product.id}`}>
                      {product.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(product.id)} data-testid={`button-delete-product-${product.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products } = useQuery<MarketplaceProductWithRelations[]>({
    queryKey: ["/api/marketplace/products"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ productId, reviewId }: { productId: string; reviewId: string }) => {
      await apiRequest("DELETE", `/api/marketplace/products/${productId}/reviews/${reviewId}`);
    },
    onSuccess: () => {
      toast({ title: "Review excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir review", description: error.message, variant: "destructive" });
    },
  });

  const allReviews = products?.flatMap(product =>
    (product.reviews || []).map(review => ({ ...review, productName: product.name, productId: product.id }))
  ) || [];

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Moderação de Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead>Comentário</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allReviews.map((review: any) => (
              <TableRow key={review.id}>
                <TableCell data-testid={`review-product-${review.id}`}>{review.productName}</TableCell>
                <TableCell data-testid={`review-rating-${review.id}`}>{review.rating}/5</TableCell>
                <TableCell data-testid={`review-comment-${review.id}`}>{review.comment}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ productId: review.productId, reviewId: review.id })}
                    data-testid={`button-delete-review-${review.id}`}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ==================== COMMUNITY MANAGEMENT ====================
function CommunityManagement() {
  return (
    <Tabs defaultValue="forum" className="mt-6">
      <TabsList className="grid w-full grid-cols-2 bg-white">
        <TabsTrigger value="forum" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Fórum</TabsTrigger>
        <TabsTrigger value="tickets" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Tickets de Suporte</TabsTrigger>
      </TabsList>
      <TabsContent value="forum"><ForumManagement /></TabsContent>
      <TabsContent value="tickets"><TicketsManagement /></TabsContent>
    </Tabs>
  );
}

function ForumManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: topics, isLoading } = useQuery<ForumTopicWithRelations[]>({
    queryKey: ["/api/forum/topics"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { isSticky?: boolean; isClosed?: boolean } }) => {
      await apiRequest("PATCH", `/api/forum/topics/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Tópico atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tópico", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/forum/topics/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Tópico excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir tópico", description: error.message, variant: "destructive" });
    },
  });

  const toggleSticky = (topic: ForumTopicWithRelations) => {
    updateMutation.mutate({ id: topic.id, data: { isSticky: !topic.isSticky } });
  };

  const toggleClosed = (topic: ForumTopicWithRelations) => {
    updateMutation.mutate({ id: topic.id, data: { isClosed: !topic.isClosed } });
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Moderação do Fórum</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Visualizações</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics?.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell data-testid={`topic-title-${topic.id}`}>{topic.title}</TableCell>
                  <TableCell data-testid={`topic-author-${topic.id}`}>{topic.author?.name}</TableCell>
                  <TableCell data-testid={`topic-views-${topic.id}`}>{topic.viewCount}</TableCell>
                  <TableCell data-testid={`topic-replies-${topic.id}`}>{topic.replyCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {topic.isSticky && <Badge variant="secondary" data-testid={`topic-sticky-${topic.id}`}>Fixado</Badge>}
                      {topic.isClosed && <Badge variant="destructive" data-testid={`topic-closed-${topic.id}`}>Fechado</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => toggleSticky(topic)} data-testid={`button-toggle-sticky-${topic.id}`}>
                      {topic.isSticky ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleClosed(topic)} data-testid={`button-toggle-closed-${topic.id}`}>
                      {topic.isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(topic.id)} data-testid={`button-delete-topic-${topic.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TicketsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery<SupportTicketWithRelations[]>({
    queryKey: ["/api/support/tickets"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string; priority?: string } }) => {
      await apiRequest("PATCH", `/api/support/tickets/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Ticket atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar ticket", description: error.message, variant: "destructive" });
    },
  });

  const updateStatus = (id: string, status: string) => {
    updateMutation.mutate({ id, data: { status } });
  };

  const updatePriority = (id: string, priority: string) => {
    updateMutation.mutate({ id, data: { priority } });
  };

  return (
    <Card className="mt-4 bg-white">
      <CardHeader>
        <CardTitle>Tickets de Suporte</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assunto</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell data-testid={`ticket-subject-${ticket.id}`}>{ticket.subject}</TableCell>
                  <TableCell data-testid={`ticket-user-${ticket.id}`}>{ticket.user?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={ticket.status === 'open' ? 'default' : ticket.status === 'in_progress' ? 'secondary' : 'outline'}
                      data-testid={`ticket-status-${ticket.id}`}
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={ticket.priority === 'high' ? 'destructive' : ticket.priority === 'medium' ? 'secondary' : 'outline'}
                      data-testid={`ticket-priority-${ticket.id}`}
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Select onValueChange={(value) => updateStatus(ticket.id, value)}>
                      <SelectTrigger className="w-32" data-testid={`select-status-${ticket.id}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="in_progress">Em Progresso</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select onValueChange={(value) => updatePriority(ticket.id, value)}>
                      <SelectTrigger className="w-32" data-testid={`select-priority-${ticket.id}`}>
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}