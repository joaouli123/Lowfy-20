import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, Mail, Calendar, Shield, Settings, Trophy, Zap, Target, 
  MessageCircle, Heart, Award, TrendingUp, UserPlus, UserCheck, 
  Users, Edit2, Save, X, Camera, MapPin, Briefcase, Link as LinkIcon,
  Phone, Globe, ImageIcon, Lightbulb, Sparkles, BookOpen, Eye, ThumbsUp, Share2
} from "lucide-react";
import imageCompression from 'browser-image-compression';
import BadgeCard from "@/components/BadgeCard";
import type { UserPoints, Badge as BadgeType, User as UserType } from "@shared/schema";
import { useGamification } from "@/hooks/useGamification";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';

export default function Profile() {
  const { user: currentUser } = useAuth();
  const { id: userIdParam } = useParams();
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<Array<{ name: string; state: string }>>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [forumPage, setForumPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);


  const userId = userIdParam || currentUser?.id;
  const isOwnProfile = !userIdParam || userIdParam === currentUser?.id;

  const { data: profileUser, isLoading: isLoadingUser } = useQuery<UserType>({
    queryKey: ["/api/users", userId],
    enabled: !!userId && !isOwnProfile,
  });

  const displayUser = isOwnProfile ? currentUser : profileUser;

  const { data: userPoints } = useQuery<UserPoints>({
    queryKey: [`/api/users/${userId}/points`],
    enabled: !!userId,
  });

  const { data: userBadges } = useQuery<BadgeType[]>({
    queryKey: [`/api/users/${userId}/badges`],
    enabled: !!userId,
  });

  const { data: userPosts } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/posts`],
    enabled: !!userId,
  });

  const { data: userForumTopics } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/forum-topics`],
    enabled: !!userId,
  });

  const { data: recentActivities } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/recent-activities`],
    enabled: !!userId,
  });

  const { data: isFollowingData } = useQuery<{ isFollowing: boolean }>({
    queryKey: ["/api/users", userId, "is-following"],
    enabled: !!currentUser && !!userId && !isOwnProfile,
  });

  const { data: followers } = useQuery<UserType[]>({
    queryKey: ["/api/users", userId, "followers"],
    enabled: !!userId,
  });

  const { data: following } = useQuery<UserType[]>({
    queryKey: ["/api/users", userId, "following"],
    enabled: !!userId,
  });

  const followersCount = Array.isArray(followers) ? followers.length : 0;
  const followingCount = Array.isArray(following) ? following.length : 0;

  // Get user stats (posts count)
  const { data: stats } = useQuery<{ postsCount: number }>({
    queryKey: [`/api/users/${userId}/stats`],
    enabled: !!userId,
  });


  const followMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "is-following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/daily-activities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamification/weekly-challenges'] });
      toast({
        title: "Sucesso!",
        description: `Agora você segue ${displayUser?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível seguir este usuário",
        variant: "destructive",
      });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "is-following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "followers"] });
      toast({
        title: "Sucesso!",
        description: `Você deixou de seguir ${displayUser?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível deixar de seguir este usuário",
        variant: "destructive",
      });
    },
  });

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  };

  // Função para formatar CPF (apenas para exibição)
  const formatCPFDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').replace(/-$/, '');
    }
    return numbers.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const profileSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    phone: z.string().optional(),
    cpf: z.string().optional().refine(
      (val) => !val || val.replace(/\D/g, '').length === 11,
      { message: "CPF deve ter 11 dígitos" }
    ),
    areaAtuacao: z.string().optional(),
    location: z.string().optional(),
    bio: z.string().optional(),
    website: z.string().optional(),
  });

  const avatarSchema = z.object({
    profileImageUrl: z.string().optional().or(z.literal("")),
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: displayUser?.name || "",
      phone: displayUser?.phone || "",
      cpf: displayUser?.cpf || "",
      areaAtuacao: displayUser?.areaAtuacao || "",
      location: displayUser?.location || "",
      bio: displayUser?.bio || "",
      website: displayUser?.website || "",
    },
  });

  // Atualizar valores do formulário quando displayUser mudar
  useEffect(() => {
    if (displayUser) {
      form.reset({
        name: displayUser.name || "",
        phone: displayUser.phone || "",
        cpf: displayUser.cpf || "",
        areaAtuacao: displayUser.areaAtuacao || "",
        location: displayUser.location || "",
        bio: displayUser.bio || "",
        website: displayUser.website || "",
      });
    }
  }, [displayUser, form]);

  const avatarForm = useForm<z.infer<typeof avatarSchema>>({
    resolver: zodResolver(avatarSchema),
    defaultValues: {
      profileImageUrl: displayUser?.profileImageUrl || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: z.infer<typeof profileSchema>) => {
      // Remover phone e cpf dos dados enviados (campos bloqueados)
      const { phone, cpf, ...allowedData } = data;
      return apiRequest("PUT", "/api/auth/user", allowedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil",
        variant: "destructive",
      });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: (data: z.infer<typeof avatarSchema>) => 
      apiRequest("PUT", "/api/auth/user", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Avatar atualizado!",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
      setIsAvatarDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o avatar",
        variant: "destructive",
      });
    },
  });

  const {
    currentXP,
    level: currentLevel,
    levelName,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercentage,
    nextLevelData,
  } = useGamification(userId);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'long',
    });
  };

  const handleFollowToggle = () => {
    if (isFollowingData?.isFollowing) {
      unfollowMutation.mutate();
    } else {
      followMutation.mutate();
    }
  };

  // Buscar cidades brasileiras pela API do IBGE
  const searchCities = async (query: string) => {
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`
      );
      const cities = await response.json();

      const filtered = cities
        .filter((city: any) => 
          city.nome.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10)
        .map((city: any) => ({
          name: city.nome,
          state: city.microrregiao.mesorregiao.UF.sigla
        }));

      setCitySuggestions(filtered);
    } catch (error) {
    }
  };

  // Atualizar busca de cidades quando citySearch mudar
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCities(citySearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [citySearch]);

  const handleCancelEdit = () => {
    form.reset({
      name: displayUser?.name || "",
      phone: displayUser?.phone || "",
      areaAtuacao: displayUser?.areaAtuacao || "",
      location: displayUser?.location || "",
      bio: displayUser?.bio || "",
      website: displayUser?.website || "",
    });
    setIsEditMode(false);
  };

  if (isLoadingUser) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando perfil...</p>
          </div>
        </div>
      </div>
    );
  }

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header Card - LinkedIn Style */}
      <Card className="overflow-hidden">
        {/* Cover Image */}
        <div className="h-16 md:h-24 from-slate-700 to-slate-900 relative text-[#29654f] bg-[#29654f]">
          {/* Avatar positioned over cover */}
          <div className="absolute -bottom-16 left-6">
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-white shadow-xl">
                <AvatarImage src={displayUser?.profileImageUrl || ''} alt={displayUser?.name} />
                <AvatarFallback className="bg-white text-primary text-3xl">
                  {getInitials(displayUser?.name)}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <Button
                  size="icon"
                  variant="default"
                  className="absolute bottom-0 right-0 h-10 w-10 rounded-full shadow-lg"
                  onClick={() => setIsAvatarDialogOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <CardContent className="pt-20 pb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{displayUser?.name}</h1>
                {levelName && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white">
                    {levelName}
                  </Badge>
                )}
              </div>

              <p className="text-muted-foreground mb-2">@{displayUser?.name?.toLowerCase().replace(/\s+/g, '')}</p>

              {displayUser?.areaAtuacao && (
                <p className="font-medium text-foreground mb-3">{displayUser.areaAtuacao}</p>
              )}

              {displayUser?.bio && (
                <p className="text-sm text-foreground mb-4 max-w-2xl">{displayUser.bio}</p>
              )}

              {/* Public Info */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {displayUser?.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{displayUser.location}</span>
                  </div>
                )}
                {displayUser?.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    <a 
                      href={displayUser.website.startsWith('http://') || displayUser.website.startsWith('https://') 
                        ? displayUser.website 
                        : `https://${displayUser.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:underline text-primary"
                    >
                      {displayUser.website}
                    </a>
                  </div>
                )}
                {displayUser?.createdAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Entrou em {formatDate(displayUser.createdAt)}</span>
                  </div>
                )}
              </div>

              {/* Private Info (only visible to owner) */}
              {isOwnProfile && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg border border-dashed">
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{displayUser?.email}</span>
                  </div>
                  {displayUser?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{formatPhone(displayUser.phone)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isOwnProfile && (
                <>
                  <Button variant="outline" size="sm">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Mensagem
                  </Button>
                  <Button
                    onClick={handleFollowToggle}
                    disabled={isPending}
                    size="sm"
                    variant={isFollowingData?.isFollowing ? "outline" : "default"}
                  >
                    {isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : isFollowingData?.isFollowing ? (
                      <UserCheck className="w-4 h-4 mr-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    {isFollowingData?.isFollowing ? "Seguindo" : "Seguir"}
                  </Button>
                </>
              )}
              {isOwnProfile && (
                <Button onClick={() => setIsEditDialogOpen(true)} size="sm" variant="default">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar Perfil
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-primary">{followersCount}</p>
            <p className="text-sm text-muted-foreground">Seguidores</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-primary">{followingCount}</p>
            <p className="text-sm text-muted-foreground">Seguindo</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats?.postsCount || 0}</p>
            <p className="text-sm text-muted-foreground">Posts</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-primary">{userPoints?.likesReceived || 0}</p>
            <p className="text-sm text-muted-foreground">Curtidas</p>
          </CardContent>
        </Card>
        <Card className="transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Award className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-primary" data-testid="text-best-answers">{userPoints?.bestAnswers || 0}</p>
            <p className="text-sm text-muted-foreground">Melhores Respostas</p>
          </CardContent>
        </Card>
      </div>



      {/* Main Profile Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="gamificacao" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted p-1.5 rounded-xl border border-border/50">
              <TabsTrigger 
                value="gamificacao"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-300 rounded-lg font-medium"
              >
                <Trophy className="w-4 h-4 mr-1.5 inline-block" />
                Gamificação
              </TabsTrigger>
              <TabsTrigger 
                value="posts"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-300 rounded-lg font-medium"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger 
                value="forum"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-300 rounded-lg font-medium"
              >
                Fórum
              </TabsTrigger>
              <TabsTrigger 
                value="activity"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all duration-300 rounded-lg font-medium"
              >
                Atividade
              </TabsTrigger>
            </TabsList>

            {/* Aba Gamificação */}
            <TabsContent value="gamificacao" className="p-6 space-y-6 w-full overflow-visible">
              <div>
                <h3 className="font-semibold text-lg mb-2">Sistema de Gamificação</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Ganhe XP completando atividades e suba de nível na plataforma
                </p>
              </div>

              {/* Barra de Progresso Compacta */}
              {userPoints && (
                <Card className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Nível {userPoints.level}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {userPoints.points} XP / {userPoints.level * 100} XP
                      </div>
                    </div>
                    <Progress 
                      value={(userPoints.points % 100) || 0} 
                      className="h-2 bg-slate-200 dark:bg-slate-800"
                    />
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 text-right">
                      {100 - (userPoints.points % 100)} XP para o próximo nível
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sistema de Níveis */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Níveis e Progressão
                </h4>
                <div className="grid gap-3">
                  <Card className="overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Novato</span>
                            <Badge variant="outline" className="text-xs">Nível 1</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">0 - 99 XP</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Começando a jornada na plataforma</p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                          <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Aprendiz</span>
                            <Badge variant="outline" className="text-xs">Nível 2</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">100 - 299 XP</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Aprendendo e participando ativamente</p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Contribuidor</span>
                            <Badge variant="outline" className="text-xs">Nível 3</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">300 - 599 XP</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Contribuindo regularmente com a comunidade</p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Mentor</span>
                            <Badge variant="outline" className="text-xs">Nível 4</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">600 - 999 XP</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Ajudando e guiando outros membros</p>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg">
                          <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Mestre</span>
                            <Badge variant="outline" className="text-xs">Nível 5</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">1000+ XP</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Expertise máxima e liderança na comunidade</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Atividades Diárias */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Atividades Diárias
                </h4>
                <p className="text-sm text-muted-foreground -mt-2">
                  Complete atividades todos os dias para ganhar XP. As atividades resetam à meia-noite.
                </p>
                <div className="grid gap-2">
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Login Diário</p>
                        <p className="text-xs text-muted-foreground">Faça login hoje</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+3 XP</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Criar Postagem</p>
                        <p className="text-xs text-muted-foreground">Crie 1 postagem na timeline</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+10 XP</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Comentar em Posts</p>
                        <p className="text-xs text-muted-foreground">Comente em 3 posts diferentes</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+15 XP</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Curtir Conteúdo</p>
                        <p className="text-xs text-muted-foreground">Dê 5 curtidas em posts</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+10 XP</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Participar do Fórum</p>
                        <p className="text-xs text-muted-foreground">Responda 1 tópico no fórum</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+10 XP</span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Expandir Rede</p>
                        <p className="text-xs text-muted-foreground">Siga 2 novos membros</p>
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">+4 XP</span>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Tabela de Pontuação */}
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Tabela de Pontuação
                </h4>
                <p className="text-sm text-muted-foreground -mt-2">
                  Veja quantos pontos você ganha por cada ação na plataforma
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-semibold">Ação</th>
                        <th className="text-right p-3 font-semibold">XP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3">Criar postagem</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+10 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Comentar em post</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+5 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Dar curtida</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+2 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Receber curtida</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+3 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Compartilhar post</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+4 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Seguir usuário</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+2 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Ganhar seguidor</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+5 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Criar tópico no fórum</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+15 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Responder tópico</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+10 XP</td>
                      </tr>
                      <tr className="bg-amber-50 dark:bg-amber-950/10">
                        <td className="p-3 font-semibold flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span>Melhor resposta</span>
                        </td>
                        <td className="p-3 text-right text-amber-600 dark:text-amber-400 font-bold">+25 XP</td>
                      </tr>
                      <tr>
                        <td className="p-3">Login diário</td>
                        <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">+3 XP</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dicas */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Dicas para Ganhar Mais XP
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>Complete todas as atividades diárias para maximizar seus ganhos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>Participe ativamente do fórum - respostas de qualidade podem ser marcadas como "melhor resposta"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>Crie conteúdo de qualidade para receber mais curtidas e engajamento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                    <span>Interaja com outros membros para construir sua rede e ganhar seguidores</span>
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* Aba Posts */}
            <TabsContent value="posts" className="p-6 w-full overflow-visible">
              <h3 className="font-semibold text-lg mb-4">Posts Publicados</h3>
              {userPosts && userPosts.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {userPosts.slice((postsPage - 1) * 15, postsPage * 15).map((post) => (
                      <Card key={post.id} data-testid={`card-post-${post.id}`}>
                        <CardContent className="p-4">
                          <p className="text-sm text-foreground/90 mb-3" dangerouslySetInnerHTML={{ __html: post.content || '' }} />
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-4 h-4" />
                              {post.likeCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-4 h-4" />
                              {post.commentCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Share2 className="w-4 h-4" />
                              {post.shareCount || 0}
                            </span>
                            <span className="ml-auto">
                              {new Date(post.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {Math.ceil(userPosts.length / 15) > 1 && (
                    <div className="mt-6 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPostsPage(p => Math.max(1, p - 1))}
                              disabled={postsPage === 1}
                            >
                              Anterior
                            </Button>
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(userPosts.length / 15) }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <Button
                                variant={postsPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPostsPage(page)}
                                className="w-9"
                              >
                                {page}
                              </Button>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPostsPage(p => Math.min(Math.ceil(userPosts.length / 15), p + 1))}
                              disabled={postsPage === Math.ceil(userPosts.length / 15)}
                            >
                              Próximo
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">Nenhum post publicado</p>
                  <p className="text-sm text-muted-foreground">Comece a compartilhar suas ideias na timeline!</p>
                </div>
              )}
            </TabsContent>

            {/* Aba Fórum */}
            <TabsContent value="forum" className="p-6">
              <h3 className="font-semibold text-lg mb-4">Discussões no Fórum</h3>
              {userForumTopics && userForumTopics.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {userForumTopics.slice((forumPage - 1) * 15, forumPage * 15).map((topic) => (
                      <Card key={topic.id} data-testid={`card-topic-${topic.id}`}>
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-base mb-2">{topic.title}</h4>
                          {topic.category && (
                            <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs rounded-full mb-2">
                              {topic.category.name}
                            </span>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                            <span className="flex items-center gap-1">
                              <Eye className="w-4 h-4" />
                              {topic.viewCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-4 h-4" />
                              {topic.replyCount || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-4 h-4" />
                              {topic.likeCount || 0}
                            </span>
                            <span className="ml-auto">
                              {new Date(topic.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {Math.ceil(userForumTopics.length / 15) > 1 && (
                    <div className="mt-6 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setForumPage(p => Math.max(1, p - 1))}
                              disabled={forumPage === 1}
                            >
                              Anterior
                            </Button>
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(userForumTopics.length / 15) }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <Button
                                variant={forumPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setForumPage(page)}
                                className="w-9"
                              >
                                {page}
                              </Button>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setForumPage(p => Math.min(Math.ceil(userForumTopics.length / 15), p + 1))}
                              disabled={forumPage === Math.ceil(userForumTopics.length / 15)}
                            >
                              Próximo
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">Nenhuma discussão criada</p>
                  <p className="text-sm text-muted-foreground">Compartilhe seu conhecimento no fórum!</p>
                </div>
              )}
            </TabsContent>

            {/* Aba Atividade */}
            <TabsContent value="activity" className="p-6">
              <h3 className="font-semibold text-lg mb-4">Atividade Recente</h3>
              {recentActivities && recentActivities.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {recentActivities.slice((activityPage - 1) * 15, activityPage * 15).map((activity, index) => (
                      <Card key={`${activity.type}-${activity.id}-${index}`} data-testid={`card-activity-${index}`}>
                        <CardContent className="p-4 flex items-start gap-3 relative">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {activity.type === 'post_created' && <MessageCircle className="w-5 h-5 text-muted-foreground" />}
                            {activity.type === 'comment_created' && <MessageCircle className="w-5 h-5 text-muted-foreground" />}
                            {activity.type === 'topic_created' && <Trophy className="w-5 h-5 text-muted-foreground" />}
                            {activity.type === 'forum_reply_created' && <MessageCircle className="w-5 h-5 text-muted-foreground" />}
                            {activity.type === 'post_liked' && <Heart className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0 pr-32">
                            <p className="text-sm font-medium">{activity.action}</p>
                            {activity.content && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{activity.content}</p>
                            )}
                          </div>
                          <p className="absolute top-4 right-4 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(activity.timestamp).toLocaleString('pt-BR', {
                              timeZone: 'America/Sao_Paulo',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {Math.ceil(recentActivities.length / 15) > 1 && (
                    <div className="mt-6 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                              disabled={activityPage === 1}
                            >
                              Anterior
                            </Button>
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(recentActivities.length / 15) }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <Button
                                variant={activityPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActivityPage(page)}
                                className="w-9"
                              >
                                {page}
                              </Button>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivityPage(p => Math.min(Math.ceil(recentActivities.length / 15), p + 1))}
                              disabled={activityPage === Math.ceil(recentActivities.length / 15)}
                            >
                              Próximo
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium text-foreground mb-2">Nenhuma atividade registrada</p>
                  <p className="text-sm text-muted-foreground">Comece a participar da plataforma para ver suas atividades aqui!</p>
                </div>
              )}
            </TabsContent>


          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              updateProfileMutation.mutate(data);
              setIsEditDialogOpen(false);
            })} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Seu nome completo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="areaAtuacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidade</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Marketing Digital, SEO" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel>Localização</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            {...field} 
                            placeholder="Digite o nome da cidade..."
                            onChange={(e) => {
                              field.onChange(e);
                              setCitySearch(e.target.value);
                            }}
                          />
                          {citySuggestions.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                              {citySuggestions.map((city, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  onClick={() => {
                                    const cityString = `${city.name}, ${city.state}`;
                                    field.onChange(cityString);
                                    setCitySearch(cityString);
                                    setCitySuggestions([]);
                                  }}
                                >
                                  <div className="text-sm font-medium">{city.name}</div>
                                  <div className="text-xs text-muted-foreground">{city.state}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone (privado)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="(00) 00000-0000"
                          value={field.value ? formatPhone(field.value) : ''}
                          onChange={(e) => {
                            const formatted = formatPhone(e.target.value);
                            field.onChange(formatted);
                          }}
                          maxLength={15}
                          disabled
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Este campo não pode ser alterado</p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF (privado)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000.000.000-00"
                          value={field.value ? formatCPFDisplay(field.value) : ''}
                          onChange={(e) => {
                            const onlyNumbers = e.target.value.replace(/\D/g, '');
                            field.onChange(onlyNumbers.slice(0, 11));
                          }}
                          maxLength={14}
                          disabled
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-cpf"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Este campo não pode ser alterado</p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://seusite.com.br" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sobre você</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Fale um pouco sobre você, sua experiência e seus interesses..."
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Avatar Upload Dialog */}
      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Atualizar Foto de Perfil</DialogTitle>
          </DialogHeader>
          <Form {...avatarForm}>
            <form onSubmit={avatarForm.handleSubmit((data) => updateAvatarMutation.mutate(data))} className="space-y-4">
              <FormField
                control={avatarForm.control}
                name="profileImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foto de Perfil</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {/* Preview do Avatar */}
                        <div className="flex justify-center">
                          <div className="relative">
                            <Avatar className="w-32 h-32 ring-4 ring-primary/20">
                              <AvatarImage 
                                src={field.value || displayUser?.profileImageUrl} 
                                className="object-cover"
                              />
                              <AvatarFallback className="text-2xl">
                                {getInitials(displayUser?.name)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>

                        {/* Botão de Upload Visível */}
                        <div className="flex flex-col gap-2">
                          <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({
                                    title: "Erro",
                                    description: "A imagem deve ter no máximo 5MB",
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                try {
                                  const imageCompression = (await import('browser-image-compression')).default;

                                  const options = {
                                    maxSizeMB: 1,
                                    maxWidthOrHeight: 1024,
                                    useWebWorker: true,
                                    initialQuality: 0.95,
                                    fileType: 'image/webp',
                                    preserveExif: false,
                                  };

                                  toast({
                                    title: "Otimizando...",
                                    description: "Convertendo para WebP com 95% de qualidade",
                                  });

                                  const compressedFile = await imageCompression(file, options);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    field.onChange(reader.result as string);
                                  };
                                  reader.readAsDataURL(compressedFile);

                                  toast({
                                    title: "Pronto!",
                                    description: "Imagem otimizada com sucesso",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Erro",
                                    description: "Não foi possível processar a imagem",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="default"
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => document.getElementById('avatar-upload')?.click()}
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Escolher Nova Foto
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            JPG, PNG, GIF ou WEBP (máx. 5MB)
                          </p>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAvatarDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateAvatarMutation.isPending}>
                  {updateAvatarMutation.isPending ? "Salvando..." : "Salvar Avatar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}