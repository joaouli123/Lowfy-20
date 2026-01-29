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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  TrendingUp,
  Plus,
  Edit,
  Trash,
  Settings,
  Briefcase,
  AlertCircle,
  Trash2,
  Search,
  Upload
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import * as flags from 'country-flag-icons/react/3x2';
import {
  insertPLRSchema,
  insertCategorySchema,
  insertLanguageSchema,
  type InsertPLR,
  type InsertCategory,
  type InsertLanguage,
  type PLRWithRelations,
  type Category,
  type Language,
} from "@shared/schema";

export default function AdminConteudo() {
  return (
    <div className="p-[50px]">
      <ContentManagement />
    </div>
  );
}

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
  const [selectedPLRs, setSelectedPLRs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPrice, setFilterPrice] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Resetar página quando filtros mudarem
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const { data: plrsResponse, isLoading } = useQuery<{ data: PLRWithRelations[], total: number }>({
    queryKey: ["/api/plrs"],
  });
  
  const plrs = plrsResponse?.data;

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
      extraLinks: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { plr: InsertPLR; downloads: any[] }) => {
      const plr: any = await apiRequest("POST", "/api/plrs", data.plr);

      if (data.downloads && data.downloads.length > 0) {
        for (const download of data.downloads) {
          if (download.enabled && download.languages && download.languages.length > 0) {
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
          if (download.enabled && download.languages && download.languages.length > 0) {
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

  const deleteMultipleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/plrs/${id}`)));
    },
    onSuccess: () => {
      toast({ title: `${selectedPLRs.size} PLR(s) excluído(s) com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ["/api/plrs"] });
      setSelectedPLRs(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir PLRs", description: error.message, variant: "destructive" });
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
        isFree: plr.isFree,
        isActive: plr.isActive,
        extraLinks: plr.extraLinks || [],
      });

      const newEnabledTypes: {[key: string]: { enabled: boolean; languages: string[]; link: string }} = {
        'ebook': { enabled: false, languages: [], link: '' },
        'vsl': { enabled: false, languages: [], link: '' },
        'landingpage': { enabled: false, languages: [], link: '' },
        'quiz': { enabled: false, languages: [], link: '' },
        'criativos': { enabled: false, languages: [], link: '' },
      };

      if (plr.downloads && plr.downloads.length > 0) {
        const downloadsByType = plr.downloads.reduce((acc, download) => {
          if (!acc[download.type]) {
            acc[download.type] = {
              enabled: true,
              languages: [],
              link: download.fileUrl,
            };
          }
          const languageId = download.languageId || download.language?.id;
          if (languageId && !acc[download.type].languages.includes(languageId)) {
            acc[download.type].languages.push(languageId);
          }
          return acc;
        }, {} as {[key: string]: { enabled: boolean; languages: string[]; link: string }});

        Object.assign(newEnabledTypes, downloadsByType);
      }

      setEnabledContentTypes(newEnabledTypes);
    } else {
      setEditingPLR(null);
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertPLR) => {
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
    let hasValidationError = false;

    Object.entries(enabledContentTypes).forEach(([type, config]) => {
      if (config.enabled && config.languages.length > 0) {
        if (!config.link || config.link.trim() === '') {
          toast({ 
            title: "Erro de validação", 
            description: `O link para ${type} está vazio`, 
            variant: "destructive" 
          });
          hasValidationError = true;
          return;
        }
        downloadsArray.push({
          type,
          enabled: true,
          languages: config.languages,
          link: convertGoogleDriveUrl(config.link)
        });
      }
    });

    if (hasValidationError) {
      return;
    }

    const hasEbook = downloadsArray.some(d => d.type === 'ebook');
    if (!hasEbook) {
      toast({ 
        title: "Erro de validação", 
        description: "É necessário adicionar ao menos um e-book em qualquer idioma", 
        variant: "destructive" 
      });
      return;
    }

    // Validar links extras
    if (data.extraLinks && data.extraLinks.length > 0) {
      for (let i = 0; i < data.extraLinks.length; i++) {
        if (!data.extraLinks[i].title.trim()) {
          toast({ 
            title: "Erro de validação", 
            description: `O título do Link Extra #${i + 1} é obrigatório`, 
            variant: "destructive" 
          });
          hasValidationError = true;
          return;
        }
        if (!data.extraLinks[i].url.trim()) {
          toast({ 
            title: "Erro de validação", 
            description: `A URL do Link Extra #${i + 1} é obrigatória`, 
            variant: "destructive" 
          });
          hasValidationError = true;
          return;
        }
      }
    }

    if (hasValidationError) {
      return;
    }

    const payload = {
      plr: {
        ...data,
        coverImageUrl: convertGoogleDriveUrl(data.coverImageUrl),
      },
      downloads: downloadsArray,
    };

    if (editingPLR) {
      updateMutation.mutate({ id: editingPLR.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;

    if (url.includes('drive.google.com/uc?')) return url;

    let fileId = '';

    const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }

    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }

    if (fileId) {
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    return url;
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

  const filteredAndPaginatedPlrs = plrs
    ? plrs.filter(plr => {
        if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
        if (filterStatus === "active" && !plr.isActive) return false;
        if (filterStatus === "inactive" && plr.isActive) return false;
        if (filterPrice === "free" && !plr.isFree) return false;
        if (filterPrice === "paid" && plr.isFree) return false;
        return true;
      }).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : [];

  const totalPages = plrs ? Math.ceil(plrs.filter(plr => {
    if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
    if (filterStatus === "active" && !plr.isActive) return false;
    if (filterStatus === "inactive" && plr.isActive) return false;
    if (filterPrice === "free" && !plr.isFree) return false;
    if (filterPrice === "paid" && plr.isFree) return false;
    return true;
  }).length / itemsPerPage) : 1;

  return (
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>PLRs</CardTitle>
        <div className="flex gap-2">
          <Button 
            onClick={() => importFromDriveMutation.mutate()}
            disabled={importFromDriveMutation.isPending}
            variant="outline"
            data-testid="button-import-drive"
          >
            {importFromDriveMutation.isPending ? "Importando..." : "Importar do Drive"}
          </Button>
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
                    <TabsList className="grid w-full grid-cols-5 mb-6 bg-white">
                      <TabsTrigger value="basico" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Básico</TabsTrigger>
                      <TabsTrigger value="conteudo" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Conteúdo</TabsTrigger>
                      <TabsTrigger value="links" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Links</TabsTrigger>
                      <TabsTrigger value="idiomas" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Idiomas</TabsTrigger>
                      <TabsTrigger value="criativos" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">Criativos</TabsTrigger>
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
                                    <Input {...field} data-testid="input-plr-cover" placeholder="URL da imagem de capa" className="bg-white" />
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
                                      <Input {...field} data-testid="input-plr-title" placeholder="Ex: Curso Completo de Marketing Digital 2024" className="bg-white" />
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
                                    <Textarea {...field} data-testid="input-plr-description" placeholder="Descreva o conteúdo do PLR..." rows={4} className="bg-white" />
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
                                          className="bg-white"
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
                                              const getLanguageFlagCode = (code: string) => {
                                                const baseCode = code.split('-')[0].toLowerCase();
                                                const languageToCountry: Record<string, string> = {
                                                  'pt': 'BR', 'en': 'GB', 'es': 'ES', 'fr': 'FR',
                                                  'de': 'DE', 'it': 'IT', 'ja': 'JP', 'ko': 'KR',
                                                  'zh': 'CN', 'ru': 'RU', 'ar': 'SA', 'hi': 'IN',
                                                };
                                                return languageToCountry[baseCode] || 'UN';
                                              };
                                              const countryCode = getLanguageFlagCode(lang.code);
                                              const FlagComponent = flags[countryCode as keyof typeof flags];

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
                                                  <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0">
                                                    {FlagComponent ? (
                                                      <FlagComponent className="w-8 h-8 object-cover scale-150" />
                                                    ) : (
                                                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px]">
                                                        {lang.code.toUpperCase()}
                                                      </div>
                                                    )}
                                                  </div>
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
                                            className="bg-white"
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
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Links e Recursos</h3>
                            <p className="text-sm text-muted-foreground mb-4">Configure links adicionais para este PLR</p>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold">Links Extras</Label>
                              <Button 
                                type="button" 
                                size="sm" 
                                onClick={() => {
                                  const currentLinks = form.watch('extraLinks') || [];
                                  form.setValue('extraLinks', [...currentLinks, { title: '', url: '' }]);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Link
                              </Button>
                            </div>

                            {(form.watch('extraLinks') || []).map((link, index) => (
                              <Card key={index} className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label>Link Extra #{index + 1}</Label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        const currentLinks = form.watch('extraLinks') || [];
                                        form.setValue('extraLinks', currentLinks.filter((_, i) => i !== index));
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label>Título</Label>
                                      <Input
                                        placeholder="Ex: Página de Vendas"
                                        className="bg-white"
                                        value={link.title}
                                        onChange={(e) => {
                                          const currentLinks = form.watch('extraLinks') || [];
                                          const updatedLinks = currentLinks.map((l, i) => 
                                            i === index ? { ...l, title: e.target.value } : l
                                          );
                                          form.setValue('extraLinks', updatedLinks);
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label>URL</Label>
                                      <Input
                                        placeholder="https://exemplo.com"
                                        className="bg-white"
                                        value={link.url}
                                        onChange={(e) => {
                                          const currentLinks = form.watch('extraLinks') || [];
                                          const updatedLinks = currentLinks.map((l, i) => 
                                            i === index ? { ...l, url: e.target.value } : l
                                          );
                                          form.setValue('extraLinks', updatedLinks);
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}

                            {(!form.watch('extraLinks') || form.watch('extraLinks')?.length === 0) && (
                              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                <p className="text-sm text-muted-foreground">Nenhum link extra adicionado</p>
                              </div>
                            )}
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
                      <p className="font-medium mb-2">Downloads Disponíveis:</p>
                      {(() => {
                        const enabledTypes = Object.entries(enabledContentTypes).filter(([_, value]) => value.enabled && value.languages.length > 0);
                        const typeLabels: Record<string, string> = {
                          'ebook': 'E-book',
                          'vsl': 'VSL',
                          'landingpage': 'Página',
                          'quiz': 'Quiz',
                          'criativos': 'Criativos',
                        };

                        if (enabledTypes.length === 0) {
                          return <p className="text-sm text-muted-foreground">Nenhum download disponível</p>;
                        }

                        return (
                          <Accordion type="single" collapsible className="w-full">
                            {enabledTypes.map(([type, value]) => (
                              <AccordionItem key={type} value={type} className="border rounded-lg mb-2">
                                <AccordionTrigger className="px-3 hover:no-underline text-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-medium text-xs">
                                      {typeLabels[type] || type}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      ({value.languages.length} idioma{value.languages.length !== 1 ? 's' : ''})
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-3 pb-3">
                                  <div className="space-y-2">
                                    {value.languages.map((langId: string) => {
                                      const lang = languages?.find(l => l.id === langId);
                                      if (!lang) return null;

                                      const getLanguageFlagCode = (code: string) => {
                                        const baseCode = code.split('-')[0].toLowerCase();
                                        const languageToCountry: Record<string, string> = {
                                          'pt': 'BR', 'en': 'GB', 'es': 'ES', 'fr': 'FR',
                                          'de': 'DE', 'it': 'IT', 'ja': 'JP', 'ko': 'KR',
                                          'zh': 'CN', 'ru': 'RU', 'ar': 'SA', 'hi': 'IN',
                                        };
                                        return languageToCountry[baseCode] || 'UN';
                                      };
                                      const countryCode = getLanguageFlagCode(lang.code);
                                      const FlagComponent = flags[countryCode as keyof typeof flags];

                                      return (
                                        <div 
                                          key={langId}
                                          className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-sm"
                                        >
                                          <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0">
                                            {FlagComponent ? (
                                              <FlagComponent className="w-7 h-7 object-cover scale-150" />
                                            ) : (
                                              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px]">
                                                {lang.code.toUpperCase()}
                                              </div>
                                            )}
                                          </div>
                                          <span className="text-xs font-medium">{lang.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        );
                      })()}
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
                  </div>
                </div>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros e Busca */}
        <div className="mb-4 space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Buscar PLRs</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="w-[180px]">
              <Label>Categoria</Label>
              <Select value={filterCategory} onValueChange={(value) => handleFilterChange(setFilterCategory, value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={(value) => handleFilterChange(setFilterStatus, value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Label>Preço</Label>
              <Select value={filterPrice} onValueChange={(value) => handleFilterChange(setFilterPrice, value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="free">Gratuitos</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPLRs.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedPLRs.size} selecionado(s)</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Deseja realmente excluir ${selectedPLRs.size} PLR(s)?`)) {
                    deleteMultipleMutation.mutate(Array.from(selectedPLRs));
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Selecionados
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Total de PLRs: <span className="font-semibold text-foreground">{plrs?.filter(plr => {
                  if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                  if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
                  if (filterStatus === "active" && !plr.isActive) return false;
                  if (filterStatus === "inactive" && plr.isActive) return false;
                  if (filterPrice === "free" && !plr.isFree) return false;
                  if (filterPrice === "paid" && plr.isFree) return false;
                  return true;
                }).length || 0}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Exibindo {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, plrs?.filter(plr => {
                  if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                  if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
                  if (filterStatus === "active" && !plr.isActive) return false;
                  if (filterStatus === "inactive" && plr.isActive) return false;
                  if (filterPrice === "free" && !plr.isFree) return false;
                  if (filterPrice === "paid" && plr.isFree) return false;
                  return true;
                }).length || 0)} de {plrs?.filter(plr => {
                  if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                  if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
                  if (filterStatus === "active" && !plr.isActive) return false;
                  if (filterStatus === "inactive" && plr.isActive) return false;
                  if (filterPrice === "free" && !plr.isFree) return false;
                  if (filterPrice === "paid" && plr.isFree) return false;
                  return true;
                }).length || 0}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPLRs.size === (filteredAndPaginatedPlrs.length || 0)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPLRs(new Set(filteredAndPaginatedPlrs.map(p => p.id)));
                        } else {
                          setSelectedPLRs(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Idiomas</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndPaginatedPlrs.map((plr) => {
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
                    if (download.language?.code) {
                      uniqueLanguages.set(download.language.code, download.language);
                    }
                  });
                  const availableLanguages = Array.from(uniqueLanguages.values());

                  return (
                    <TableRow key={plr.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPLRs.has(plr.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedPLRs);
                            if (checked) {
                              newSelected.add(plr.id);
                            } else {
                              newSelected.delete(plr.id);
                            }
                            setSelectedPLRs(newSelected);
                          }}
                        />
                      </TableCell>
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
                      <TableCell data-testid={`plr-created-${plr.id}`}>
                        {new Date(plr.createdAt).toLocaleDateString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openDialog(plr)} data-testid={`button-edit-plr-${plr.id}`}>
                          <Edit className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(plr.id)} data-testid={`button-delete-plr-${plr.id}`}>
                          <Trash className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-9"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            )}
          </>
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
                        <Input {...field} data-testid="input-category-name" className="bg-white" />
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
                        <Input {...field} data-testid="input-category-slug" className="bg-white" />
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
                        <Textarea {...field} data-testid="input-category-description" className="bg-white" />
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
                        <Input {...field} data-testid="input-language-name" className="bg-white" />
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
                        <Input {...field} data-testid="input-language-code" className="bg-white" />
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