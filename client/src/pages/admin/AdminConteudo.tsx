import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  Tags,
  Globe,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TablePagination } from "@/components/TablePagination";
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
import {
  AdminPage,
  AdminPageHeader,
  TableCard,
  FilterBar,
  EmptyState,
  TableSkeleton,
  StatusBadge,
} from "@/components/admin";

const getLanguageFlagCode = (code: string) => {
  const baseCode = code.split('-')[0].toLowerCase();
  const languageToCountry: Record<string, string> = {
    'pt': 'BR', 'en': 'GB', 'es': 'ES', 'fr': 'FR',
    'de': 'DE', 'it': 'IT', 'ja': 'JP', 'ko': 'KR',
    'zh': 'CN', 'ru': 'RU', 'ar': 'SA', 'hi': 'IN',
  };
  return languageToCountry[baseCode] || 'UN';
};

function LanguageFlag({ code, name, size = 6 }: { code: string; name?: string; size?: 5 | 6 | 8 }) {
  const countryCode = getLanguageFlagCode(code);
  const FlagComponent = (flags as any)[countryCode];
  const sizeClass = size === 8 ? "w-8 h-8" : size === 5 ? "w-5 h-5" : "w-6 h-6";
  const innerClass = size === 8 ? "w-12 h-12" : size === 5 ? "w-7 h-7" : "w-8 h-8";
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0`}
      title={name}
    >
      {FlagComponent ? (
        <FlagComponent className={`${innerClass} object-cover scale-150`} />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px]">
          {code.toUpperCase()}
        </div>
      )}
    </div>
  );
}

export default function AdminConteudo() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Conteúdo"
        description="Catálogo de PLRs, categorias e idiomas da plataforma"
        icon={BookOpen}
      />

      <Tabs defaultValue="plrs">
        <TabsList>
          <TabsTrigger value="plrs" data-testid="tab-plrs">PLRs</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Categorias</TabsTrigger>
          <TabsTrigger value="languages" data-testid="tab-languages">Idiomas</TabsTrigger>
        </TabsList>
        <TabsContent value="plrs" className="mt-5"><PLRsManagement /></TabsContent>
        <TabsContent value="categories" className="mt-5"><CategoriesManagement /></TabsContent>
        <TabsContent value="languages" className="mt-5"><LanguagesManagement /></TabsContent>
      </Tabs>
    </AdminPage>
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
  const itemsPerPage = 10;

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
      toast({ title: "Erro de validação", description: "O título do PLR é obrigatório", variant: "destructive" });
      return;
    }

    if (!data.description || data.description.trim() === '') {
      toast({ title: "Erro de validação", description: "A descrição do PLR é obrigatória", variant: "destructive" });
      return;
    }

    if (!data.categoryId || data.categoryId.trim() === '') {
      toast({ title: "Erro de validação", description: "A categoria é obrigatória", variant: "destructive" });
      return;
    }

    if (!data.coverImageUrl || data.coverImageUrl.trim() === '') {
      toast({ title: "Erro de validação", description: "A capa (imagem) é obrigatória", variant: "destructive" });
      return;
    }

    const downloadsArray: any[] = [];
    let hasValidationError = false;

    Object.entries(enabledContentTypes).forEach(([type, config]) => {
      if (config.enabled && config.languages.length > 0) {
        if (!config.link || config.link.trim() === '') {
          toast({ title: "Erro de validação", description: `O link para ${type} está vazio`, variant: "destructive" });
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
      toast({ title: "Erro de validação", description: "É necessário adicionar ao menos um e-book em qualquer idioma", variant: "destructive" });
      return;
    }

    if (data.extraLinks && data.extraLinks.length > 0) {
      for (let i = 0; i < data.extraLinks.length; i++) {
        if (!data.extraLinks[i].title.trim()) {
          toast({ title: "Erro de validação", description: `O título do Link Extra #${i + 1} é obrigatório`, variant: "destructive" });
          hasValidationError = true;
          return;
        }
        if (!data.extraLinks[i].url.trim()) {
          toast({ title: "Erro de validação", description: `A URL do Link Extra #${i + 1} é obrigatória`, variant: "destructive" });
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

  const filteredPlrs = useMemo(() => {
    if (!plrs) return [];
    return plrs.filter(plr => {
      if (searchTerm && !plr.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterCategory !== "all" && plr.categoryId !== filterCategory) return false;
      if (filterStatus === "active" && !plr.isActive) return false;
      if (filterStatus === "inactive" && plr.isActive) return false;
      if (filterPrice === "free" && !plr.isFree) return false;
      if (filterPrice === "paid" && plr.isFree) return false;
      return true;
    });
  }, [plrs, searchTerm, filterCategory, filterStatus, filterPrice]);

  const totalPages = Math.max(1, Math.ceil(filteredPlrs.length / itemsPerPage));
  const paginatedPlrs = filteredPlrs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <FilterBar
        search={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Buscar por título..."
        trailing={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importFromDriveMutation.mutate()}
              disabled={importFromDriveMutation.isPending}
              data-testid="button-import-drive"
            >
              {importFromDriveMutation.isPending ? "Importando..." : "Importar do Drive"}
            </Button>
            <Button size="sm" onClick={() => openDialog()} data-testid="button-create-plr">
              <Plus className="w-4 h-4 mr-1.5" />
              Novo PLR
            </Button>
          </>
        }
      >
        <Select value={filterCategory} onValueChange={(value) => handleFilterChange(setFilterCategory, value)}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(value) => handleFilterChange(setFilterStatus, value)}>
          <SelectTrigger className="w-[130px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPrice} onValueChange={(value) => handleFilterChange(setFilterPrice, value)}>
          <SelectTrigger className="w-[130px]" data-testid="select-filter-price">
            <SelectValue placeholder="Preço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="free">Gratuitos</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {selectedPLRs.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-medium text-red-700">{selectedPLRs.size} selecionado(s)</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm(`Deseja realmente excluir ${selectedPLRs.size} PLR(s)?`)) {
                deleteMultipleMutation.mutate(Array.from(selectedPLRs));
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Excluir selecionados
          </Button>
        </div>
      )}

      <TableCard
        title="PLRs"
        count={filteredPlrs.length}
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        }
      >
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : filteredPlrs.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhum PLR encontrado"
            description={searchTerm || filterCategory !== "all" || filterStatus !== "all" || filterPrice !== "all"
              ? "Ajuste os filtros para ver mais resultados."
              : "Crie o primeiro PLR ou importe do Google Drive."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedPlrs.length > 0 && selectedPLRs.size === paginatedPlrs.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPLRs(new Set(paginatedPlrs.map(p => p.id)));
                      } else {
                        setSelectedPLRs(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Idiomas</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPlrs.map((plr) => {
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
                    <TableCell data-testid={`plr-title-${plr.id}`}>
                      <div className="flex items-center gap-3">
                        {plr.coverImageUrl ? (
                          <img src={plr.coverImageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border" loading="lazy" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-sm">{plr.title}</span>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`plr-category-${plr.id}`}>
                      {plr.category?.name ? (
                        <Badge variant="outline" className="text-xs">{plr.category.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`plr-languages-${plr.id}`}>
                      <div className="flex gap-1 flex-wrap">
                        {availableLanguages.map((lang: any) => (
                          <LanguageFlag key={lang.code} code={lang.code} name={lang.name} />
                        ))}
                        {availableLanguages.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`plr-price-${plr.id}`}>
                      {plr.isFree ? (
                        <StatusBadge tone="success">Gratuito</StatusBadge>
                      ) : (
                        <span className="tabular-nums font-medium">R$ {((plr.price || 0) / 100).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={plr.isActive ? "success" : "neutral"} dot data-testid={`plr-status-${plr.id}`}>
                        {plr.isActive ? "Ativo" : "Inativo"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`plr-created-${plr.id}`}>
                      {new Date(plr.createdAt).toLocaleDateString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openDialog(plr)} data-testid={`button-edit-plr-${plr.id}`} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(plr.id)} data-testid={`button-delete-plr-${plr.id}`} title="Excluir">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                                                <LanguageFlag code={lang.code} name={lang.name} />
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

                                    return (
                                      <div
                                        key={langId}
                                        className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-sm"
                                      >
                                        <LanguageFlag code={lang.code} name={lang.name} size={5} />
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
                      <StatusBadge tone="success">Gratuito</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">
                        R$ {((form.watch("price") || 0) / 100).toFixed(2)}
                      </StatusBadge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
    <>
      <TableCard
        title="Categorias"
        count={categories?.length}
        actions={
          <Button size="sm" onClick={() => openDialog()} data-testid="button-create-category">
            <Plus className="w-4 h-4 mr-1.5" />
            Nova categoria
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !categories || categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria cadastrada"
            description="Crie categorias para organizar os PLRs."
            action={
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nova categoria
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium text-sm" data-testid={`category-name-${category.id}`}>{category.name}</TableCell>
                  <TableCell data-testid={`category-slug-${category.id}`}>
                    <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{category.slug}</code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`category-description-${category.id}`}>{category.description || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDialog(category)} data-testid={`button-edit-category-${category.id}`} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(category.id)} data-testid={`button-delete-category-${category.id}`} title="Excluir">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
    </>
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
    <>
      <TableCard
        title="Idiomas"
        count={languages?.length}
        actions={
          <Button size="sm" onClick={() => openDialog()} data-testid="button-create-language">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo idioma
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : !languages || languages.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="Nenhum idioma cadastrado"
            description="Cadastre os idiomas disponíveis para os downloads dos PLRs."
            action={
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Novo idioma
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Bandeira</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((language) => (
                <TableRow key={language.id}>
                  <TableCell>
                    <LanguageFlag code={language.code} name={language.name} size={8} />
                  </TableCell>
                  <TableCell className="font-medium text-sm" data-testid={`language-name-${language.id}`}>{language.name}</TableCell>
                  <TableCell data-testid={`language-code-${language.id}`}>
                    <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{language.code}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDialog(language)} data-testid={`button-edit-language-${language.id}`} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(language.id)} data-testid={`button-delete-language-${language.id}`} title="Excluir">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
    </>
  );
}
