import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash, X, MoreVertical, Wrench, Upload, Package, Bot, KeyRound, ListChecks } from "lucide-react";
import {
  insertServiceSchema,
  insertAIToolSchema,
  insertGlobalAIAccessSchema,
  insertQuizInterativoSettingsSchema,
  type InsertService,
  type InsertAITool,
  type InsertGlobalAIAccess,
  type InsertQuizInterativoSettings,
  type Service,
  type AITool,
  type GlobalAIAccess,
  type QuizInterativoSettings,
} from "@shared/schema";
import { z } from "zod";
import {
  AdminPage,
  AdminPageHeader,
  TableCard,
  EmptyState,
  TableSkeleton,
  StatusBadge,
  formatBRL,
} from "@/components/admin";

const AI_CATEGORIES: { value: string; label: string }[] = [
  { value: "mineracao", label: "Ferramentas de Mineração" },
  { value: "ia", label: "Inteligência Artificial" },
  { value: "design", label: "Design" },
  { value: "seo", label: "SEO" },
  { value: "cortesia", label: "Cortesia" },
  { value: "infoprodutos", label: "Infoprodutos" },
  { value: "brinde", label: "Brinde" },
  { value: "manutencao", label: "Manutenção" },
  { value: "assistentes", label: "IA Conversacional" },
  { value: "imagem-video", label: "Criação de Imagens e Vídeos" },
  { value: "edicao", label: "Edição" },
  { value: "apresentacao", label: "Apresentações" },
  { value: "banco-imagens", label: "Banco de Imagens" },
  { value: "texto", label: "Texto" },
  { value: "video", label: "Vídeo" },
  { value: "audio", label: "Áudio" },
  { value: "codigo", label: "Código" },
  { value: "analise", label: "Análise" },
  { value: "outros", label: "Outros" },
];

const categoryLabel = (value?: string | null) =>
  AI_CATEGORIES.find((c) => c.value === value)?.label || value || "—";

export default function AdminServicos() {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Serviços e ferramentas"
        description="White Label, ferramentas de IA, acessos globais e Quiz Interativo"
        icon={Wrench}
      />

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services" data-testid="tab-services">White Label</TabsTrigger>
          <TabsTrigger value="ai-tools" data-testid="tab-ai-tools">Ferramentas IA</TabsTrigger>
          <TabsTrigger value="global-access" data-testid="tab-global-access">Acessos globais</TabsTrigger>
          <TabsTrigger value="quiz-interativo" data-testid="tab-quiz-interativo">Quiz Interativo</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-5"><ServicesTab /></TabsContent>
        <TabsContent value="ai-tools" className="mt-5"><AIToolsTab /></TabsContent>
        <TabsContent value="global-access" className="mt-5"><GlobalAccessTab /></TabsContent>
        <TabsContent value="quiz-interativo" className="mt-5"><QuizInterativoTab /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}

function ServicesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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
      isActive: true,
      isPopular: false,
      imageUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      await apiRequest("POST", "/api/services", data);
    },
    onSuccess: () => {
      toast({ title: "White Label criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsDialogOpen(false);
      form.reset();
      setImagePreview("");
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar White Label", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertService }) => {
      await apiRequest("PUT", `/api/services/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "White Label atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsDialogOpen(false);
      setEditingService(null);
      form.reset();
      setImagePreview("");
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar White Label", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      toast({ title: "White Label excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir White Label", description: error.message, variant: "destructive" });
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Erro", description: "Por favor, selecione uma imagem", variant: "destructive" });
      return;
    }

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Erro ao fazer upload');
      const data = await response.json();
      form.setValue('imageUrl', data.url);
      setImagePreview(data.url);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setImagePreview(service.imageUrl || "");
      form.reset({
        name: service.name,
        description: service.description || "",
        priceCents: service.priceCents,
        benefitsText: service.benefits?.join("\n") || "",
        isActive: service.isActive,
        isPopular: service.isPopular,
        imageUrl: service.imageUrl || "",
      });
    } else {
      setEditingService(null);
      setImagePreview("");
      form.reset({
        name: "",
        description: "",
        priceCents: 0,
        benefitsText: "",
        isActive: true,
        isPopular: false,
        imageUrl: "",
      });
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
      isActive: data.isActive,
      isPopular: data.isPopular,
      imageUrl: data.imageUrl || "",
    };

    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: serviceData });
    } else {
      createMutation.mutate(serviceData);
    }
  };

  return (
    <>
      <TableCard
        title="White Label"
        count={services?.length}
        actions={
          <Button size="sm" onClick={() => openDialog()} data-testid="button-create-service">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo White Label
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : !services || services.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum White Label cadastrado"
            description="Crie o primeiro serviço White Label para exibi-lo aos usuários."
            action={
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Novo White Label
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell data-testid={`service-name-${service.id}`}>
                    <div className="flex items-center gap-3">
                      {service.imageUrl ? (
                        <img src={service.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{service.name}</span>
                        {service.isPopular && (
                          <StatusBadge tone="warning" className="ml-2">Popular</StatusBadge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium" data-testid={`service-price-${service.id}`}>
                    {formatBRL(service.priceCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={service.isActive ? "success" : "neutral"} dot data-testid={`service-status-${service.id}`}>
                      {service.isActive ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDialog(service)} data-testid={`button-edit-service-${service.id}`} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(service.id)} data-testid={`button-delete-service-${service.id}`} title="Excluir">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar White Label" : "Novo White Label"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="imageUrl"
                render={() => (
                  <FormItem>
                    <FormLabel>Imagem</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {imagePreview && (
                          <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                form.setValue('imageUrl', '');
                                setImagePreview("");
                              }}
                              data-testid="button-remove-image"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingImage}
                          data-testid="button-upload-image"
                          className="w-full"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isUploadingImage ? "Enviando..." : "Selecionar Imagem"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                          className="hidden"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-service-name" />
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
                    <FormLabel>Preço (centavos)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-service-price" />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {formatBRL(form.watch("priceCents") || 0)}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="benefitsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benefícios (um por linha)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-service-benefits" rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-6 bg-muted/60 rounded-lg p-3">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormLabel className="font-normal">Ativo</FormLabel>
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
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormLabel className="font-normal">Popular</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-service-popular" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-service">
                  {editingService ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type AccessCredential = {
  label: string;
  login: string;
  password: string;
};

function AIToolsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AITool | null>(null);
  const [credentials, setCredentials] = useState<AccessCredential[]>([]);

  const { data: tools, isLoading } = useQuery<AITool[]>({
    queryKey: ["/api/admin/ai-tools"],
  });

  const aiToolFormSchema = insertAIToolSchema;

  type AIToolFormData = Omit<z.infer<typeof aiToolFormSchema>, 'accessCredentials'>;

  const form = useForm<AIToolFormData>({
    resolver: zodResolver(aiToolFormSchema.omit({ accessCredentials: true })),
    defaultValues: {
      name: "",
      description: "",
      toolUrl: "",
      iconType: "default",
      category: "outros",
      logoUrl: "",
      videoUrl: "",
      instructions: "",
      isActive: true,
      isUnderMaintenance: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAITool) => {
      await apiRequest("POST", "/api/ai-tools", data);
    },
    onSuccess: () => {
      toast({ title: "Ferramenta IA criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
      setIsDialogOpen(false);
      form.reset();
      setCredentials([]);
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
      setIsDialogOpen(false);
      setEditingTool(null);
      form.reset();
      setCredentials([]);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar ferramenta", description: error.message, variant: "destructive" });
    },
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ id, isUnderMaintenance }: { id: string; isUnderMaintenance: boolean }) => {
      await apiRequest("PUT", `/api/ai-tools/${id}`, { isUnderMaintenance });
    },
    onSuccess: () => {
      toast({ title: "Status de manutenção atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-tools"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-tools/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Ferramenta IA excluída com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-tools"] });
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
        category: tool.category || "outros",
        logoUrl: tool.logoUrl || "",
        videoUrl: tool.videoUrl || "",
        instructions: tool.instructions || "",
        isActive: tool.isActive,
        isUnderMaintenance: tool.isUnderMaintenance || false,
      });
      setCredentials(tool.accessCredentials || []);
    } else {
      setEditingTool(null);
      form.reset();
      setCredentials([]);
    }
    setIsDialogOpen(true);
  };

  const toggleMaintenance = (tool: AITool) => {
    toggleMaintenanceMutation.mutate({
      id: tool.id,
      isUnderMaintenance: !tool.isUnderMaintenance,
    });
  };

  const addCredential = () => {
    setCredentials([...credentials, { label: "", login: "", password: "" }]);
  };

  const removeCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index));
  };

  const updateCredential = (index: number, field: keyof AccessCredential, value: string) => {
    const updated = [...credentials];
    updated[index] = { ...updated[index], [field]: value };
    setCredentials(updated);
  };

  const onSubmit = (data: AIToolFormData) => {
    const toolData: InsertAITool = {
      ...data,
      accessCredentials: credentials.length > 0 ? credentials : undefined,
    };

    if (editingTool) {
      updateMutation.mutate({ id: editingTool.id, data: toolData });
    } else {
      createMutation.mutate(toolData);
    }
  };

  return (
    <>
      <TableCard
        title="Ferramentas IA"
        count={tools?.length}
        actions={
          <Button size="sm" onClick={() => openDialog()} data-testid="button-create-ai-tool">
            <Plus className="w-4 h-4 mr-1.5" />
            Nova ferramenta
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !tools || tools.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="Nenhuma ferramenta cadastrada"
            description="Adicione ferramentas de IA para disponibilizá-las aos usuários."
            action={
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nova ferramenta
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Credenciais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell data-testid={`ai-tool-name-${tool.id}`}>
                    <div className="flex items-center gap-3">
                      {tool.logoUrl ? (
                        <img src={tool.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain border bg-white p-0.5" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium text-sm">{tool.name}</span>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`ai-tool-category-${tool.id}`}>
                    <Badge variant="outline" className="text-xs">{categoryLabel(tool.category)}</Badge>
                  </TableCell>
                  <TableCell data-testid={`ai-tool-credentials-${tool.id}`} className="text-center tabular-nums font-medium">
                    {tool.accessCredentials?.length || 0}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      tone={tool.isUnderMaintenance ? "warning" : tool.isActive ? "success" : "neutral"}
                      dot
                      data-testid={`ai-tool-status-${tool.id}`}
                    >
                      {tool.isUnderMaintenance ? "Em manutenção" : tool.isActive ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${tool.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(tool)} data-testid={`button-edit-ai-tool-${tool.id}`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleMaintenance(tool)}
                          data-testid={`button-maintenance-ai-tool-${tool.id}`}
                        >
                          <Wrench className="w-4 h-4 mr-2" />
                          {tool.isUnderMaintenance ? "Remover manutenção" : "Colocar em manutenção"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(tool.id)}
                          className="text-red-600"
                          data-testid={`button-delete-ai-tool-${tool.id}`}
                        >
                          <Trash className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTool ? "Editar Ferramenta IA" : "Nova Ferramenta IA"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-ai-tool-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ai-tool-category">
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AI_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Textarea {...field} value={field.value || ""} data-testid="input-ai-tool-description" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="toolUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Ferramenta *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." data-testid="input-ai-tool-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL do Logo</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="https://..."
                          data-testid="input-ai-tool-logo"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Exemplo CapCut Pro: https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/CapCut_Logo.svg/1200px-CapCut_Logo.svg.png
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Vídeo Tutorial</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="https://..." data-testid="input-ai-tool-video" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instruções de Uso</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="input-ai-tool-instructions" rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Credenciais de Acesso</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addCredential} data-testid="button-add-credential">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Credencial
                  </Button>
                </div>
                {credentials.map((cred, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-3 bg-muted/40">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Credencial {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCredential(index)}
                        data-testid={`button-remove-credential-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-sm font-medium">Rótulo</label>
                        <Input
                          value={cred.label}
                          onChange={(e) => updateCredential(index, "label", e.target.value)}
                          placeholder="Ex: Conta Principal"
                          data-testid={`input-credential-label-${index}`}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Login/Email</label>
                        <Input
                          value={cred.login}
                          onChange={(e) => updateCredential(index, "login", e.target.value)}
                          placeholder="email@exemplo.com"
                          data-testid={`input-credential-login-${index}`}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Senha</label>
                        <Input
                          type="text"
                          value={cred.password}
                          onChange={(e) => updateCredential(index, "password", e.target.value)}
                          placeholder="Senha"
                          data-testid={`input-credential-password-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-3 bg-muted/60 space-y-0">
                    <FormLabel className="font-normal">Ferramenta Ativa</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ai-tool-active" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-ai-tool">
                  {editingTool ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GlobalAccessTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState<GlobalAIAccess | null>(null);

  const { data: accesses, isLoading } = useQuery<GlobalAIAccess[]>({
    queryKey: ["/api/admin/global-ai-access"],
  });

  const form = useForm<InsertGlobalAIAccess>({
    resolver: zodResolver(insertGlobalAIAccessSchema),
    defaultValues: {
      label: "",
      login: "",
      password: "",
      order: 0,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGlobalAIAccess) => {
      await apiRequest("POST", "/api/global-ai-access", data);
    },
    onSuccess: () => {
      toast({ title: "Acesso global criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-ai-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-ai-access"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar acesso", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertGlobalAIAccess }) => {
      await apiRequest("PUT", `/api/global-ai-access/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Acesso global atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-ai-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-ai-access"] });
      setIsDialogOpen(false);
      setEditingAccess(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar acesso", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/global-ai-access/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Acesso global excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-ai-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-ai-access"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir acesso", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = (access?: GlobalAIAccess) => {
    if (access) {
      setEditingAccess(access);
      form.reset({
        label: access.label,
        login: access.login,
        password: access.password,
        order: access.order || 0,
        isActive: access.isActive,
      });
    } else {
      setEditingAccess(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertGlobalAIAccess) => {
    if (editingAccess) {
      updateMutation.mutate({ id: editingAccess.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <>
      <TableCard
        title="Acessos globais"
        count={accesses?.length}
        actions={
          <Button size="sm" onClick={() => openDialog()} data-testid="button-create-global-access">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo acesso
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={4} />
        ) : !accesses || accesses.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhum acesso global cadastrado"
            description="Cadastre credenciais compartilhadas para as ferramentas de IA."
            action={
              <Button size="sm" onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Novo acesso
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rótulo</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead className="text-right">Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[110px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accesses.map((access) => (
                <TableRow key={access.id}>
                  <TableCell className="font-medium text-sm" data-testid={`access-label-${access.id}`}>{access.label}</TableCell>
                  <TableCell className="text-sm" data-testid={`access-login-${access.id}`}>{access.login}</TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`access-password-${access.id}`}>••••••••</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`access-order-${access.id}`}>{access.order}</TableCell>
                  <TableCell>
                    <StatusBadge tone={access.isActive ? "success" : "neutral"} dot data-testid={`access-status-${access.id}`}>
                      {access.isActive ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openDialog(access)} data-testid={`button-edit-access-${access.id}`} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(access.id)} data-testid={`button-delete-access-${access.id}`} title="Excluir">
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
            <DialogTitle>{editingAccess ? "Editar Acesso Global" : "Novo Acesso Global"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rótulo/Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: ACESSO 1" data-testid="input-access-label" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login/Email *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Login ou email" data-testid="input-access-login" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha *</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Senha de acesso" data-testid="input-access-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-access-order" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-3 bg-muted/60 space-y-0">
                    <FormLabel className="font-normal">Acesso Ativo</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-access-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-access">
                  {editingAccess ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuizInterativoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<QuizInterativoSettings>({
    queryKey: ["/api/quiz-interativo/settings"],
  });

  const form = useForm<InsertQuizInterativoSettings>({
    resolver: zodResolver(insertQuizInterativoSettingsSchema),
    defaultValues: {
      videoUrl: "",
      platformUrl: "",
      login: "",
      password: "",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertQuizInterativoSettings) => {
      await apiRequest("POST", "/api/quiz-interativo/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Configurações criadas com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-interativo/settings"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar configurações", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InsertQuizInterativoSettings }) => {
      await apiRequest("PUT", `/api/quiz-interativo/settings/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Configurações atualizadas com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["/api/quiz-interativo/settings"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar configurações", description: error.message, variant: "destructive" });
    },
  });

  const openDialog = () => {
    if (settings) {
      form.reset({
        videoUrl: settings.videoUrl || "",
        platformUrl: settings.platformUrl,
        login: settings.login,
        password: settings.password,
        isActive: settings.isActive,
      });
    } else {
      form.reset({
        videoUrl: "",
        platformUrl: "",
        login: "",
        password: "",
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: InsertQuizInterativoSettings) => {
    if (settings?.id) {
      updateMutation.mutate({ id: settings.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const settingsFields = settings ? [
    { label: "URL do vídeo", value: settings.videoUrl || "Não configurado", testId: "text-current-video-url" },
    { label: "URL da plataforma", value: settings.platformUrl, testId: "text-current-platform-url" },
    { label: "Login", value: settings.login, testId: "text-current-login" },
    { label: "Senha", value: settings.password, testId: "text-current-password" },
  ] : [];

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quiz Interativo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Credenciais e vídeo tutorial exibidos na página do Quiz Interativo</p>
          </div>
          <Button size="sm" onClick={openDialog} data-testid="button-edit-quiz-settings">
            {settings ? (
              <>
                <Edit className="w-4 h-4 mr-1.5" />
                Editar configurações
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1.5" />
                Criar configurações
              </>
            )}
          </Button>
        </div>
        <div className="p-5">
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : settings ? (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                {settingsFields.map((f) => (
                  <div key={f.testId} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                    <div className="bg-secondary/60 rounded-lg p-3 border">
                      <p className="text-sm font-mono break-all" data-testid={f.testId}>{f.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                <StatusBadge tone={settings.isActive ? "success" : "neutral"} dot data-testid="badge-current-status">
                  {settings.isActive ? "Ativo" : "Inativo"}
                </StatusBadge>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={ListChecks}
              title="Nenhuma configuração cadastrada"
              description="Crie as configurações para exibir o Quiz Interativo aos usuários."
              action={
                <Button size="sm" onClick={openDialog} data-testid="button-create-quiz-settings-empty">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Criar configurações
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{settings ? "Editar" : "Criar"} Configurações do Quiz Interativo</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Vídeo (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://www.youtube.com/embed/..." data-testid="input-quiz-video-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="platformUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da Plataforma *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://plataforma-quiz.com" data-testid="input-quiz-platform-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login/Email *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Login ou email de acesso" data-testid="input-quiz-login" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha *</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Senha de acesso" data-testid="input-quiz-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between border rounded-lg p-3 bg-muted/60 space-y-0">
                    <FormLabel className="font-normal">Configuração Ativa</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-quiz-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-quiz-settings">
                  {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (settings ? "Atualizar" : "Criar")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
