import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash, X, Settings, AlertCircle, MoreVertical, Wrench, Upload, Image as ImageIcon } from "lucide-react";
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

export default function AdminServicos() {
  return (
    <div className="p-[50px]">
      <ServicesManagement />
    </div>
  );
}

function ServicesManagement() {
  return (
    <Tabs defaultValue="services" className="mt-6">
      <TabsList className="grid w-full grid-cols-4 bg-white">
        <TabsTrigger value="services" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">White Label</TabsTrigger>
        <TabsTrigger value="ai-tools" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">FERRAMENTAS IA</TabsTrigger>
        <TabsTrigger value="global-access" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">ACESSOS GLOBAIS</TabsTrigger>
        <TabsTrigger value="quiz-interativo" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">QUIZ INTERATIVO</TabsTrigger>
      </TabsList>
      <TabsContent value="services"><ServicesTab /></TabsContent>
      <TabsContent value="ai-tools"><AIToolsTab /></TabsContent>
      <TabsContent value="global-access"><GlobalAccessTab /></TabsContent>
      <TabsContent value="quiz-interativo"><QuizInterativoTab /></TabsContent>
    </Tabs>
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
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>White Label</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-service">
              <Plus className="w-4 h-4 mr-2" />
              Novo White Label
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? "Editar White Label" : "Novo White Label"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
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
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Ativo</FormLabel>
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
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>FERRAMENTAS IA</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-ai-tool">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ferramenta
            </Button>
          </DialogTrigger>
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
                            <SelectItem value="mineracao">Ferramentas de Mineração</SelectItem>
                            <SelectItem value="ia">Inteligência Artificial</SelectItem>
                            <SelectItem value="design">Design</SelectItem>
                            <SelectItem value="seo">SEO</SelectItem>
                            <SelectItem value="cortesia">Cortesia</SelectItem>
                            <SelectItem value="infoprodutos">Infoprodutos</SelectItem>
                            <SelectItem value="brinde">Brinde</SelectItem>
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                            <SelectItem value="assistentes">IA Conversacional</SelectItem>
                            <SelectItem value="imagem-video">Criação de Imagens e Vídeos</SelectItem>
                            <SelectItem value="edicao">Edição</SelectItem>
                            <SelectItem value="apresentacao">Apresentações</SelectItem>
                            <SelectItem value="banco-imagens">Banco de Imagens</SelectItem>
                            <SelectItem value="texto">Texto</SelectItem>
                            <SelectItem value="video">Vídeo</SelectItem>
                            <SelectItem value="audio">Áudio</SelectItem>
                            <SelectItem value="codigo">Código</SelectItem>
                            <SelectItem value="analise">Análise</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
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
                    <div key={index} className="border rounded-lg p-3 space-y-3">
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
                    <FormItem className="flex items-center justify-between border rounded-lg p-3">
                      <FormLabel>Ferramenta Ativa</FormLabel>
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
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Credenciais</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools?.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell data-testid={`ai-tool-name-${tool.id}`}>
                    <span className="font-medium">{tool.name}</span>
                  </TableCell>
                  <TableCell data-testid={`ai-tool-category-${tool.id}`}>
                    <Badge variant="outline" className="capitalize">{tool.category}</Badge>
                  </TableCell>
                  <TableCell data-testid={`ai-tool-credentials-${tool.id}`} className="text-center">
                    <span className="font-semibold text-lg">{tool.accessCredentials?.length || 0}</span>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={tool.isUnderMaintenance ? "outline" : tool.isActive ? "default" : "secondary"} 
                      data-testid={`ai-tool-status-${tool.id}`}
                      className={`w-fit ${tool.isUnderMaintenance ? 'text-orange-600 border-orange-600' : ''}`}
                    >
                      {tool.isUnderMaintenance ? "Em Manutenção" : tool.isActive ? "Ativo" : "Inativo"}
                    </Badge>
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
                          {tool.isUnderMaintenance ? "Remover Manutenção" : "Colocar em Manutenção"}
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
      </CardContent>
    </Card>
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
    <Card className="mt-4 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ACESSOS GLOBAIS</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-create-global-access">
              <Plus className="w-4 h-4 mr-2" />
              Novo Acesso
            </Button>
          </DialogTrigger>
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
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Acesso Ativo</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-access-active" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-access">
                    {editingAccess ? "Atualizar" : "Criar"}
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
                <TableHead>Rótulo</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accesses?.map((access) => (
                <TableRow key={access.id}>
                  <TableCell data-testid={`access-label-${access.id}`}>{access.label}</TableCell>
                  <TableCell data-testid={`access-login-${access.id}`}>{access.login}</TableCell>
                  <TableCell data-testid={`access-password-${access.id}`}>••••••••</TableCell>
                  <TableCell data-testid={`access-order-${access.id}`}>{access.order}</TableCell>
                  <TableCell>
                    <Badge variant={access.isActive ? "default" : "secondary"} data-testid={`access-status-${access.id}`}>
                      {access.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => openDialog(access)} data-testid={`button-edit-access-${access.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(access.id)} data-testid={`button-delete-access-${access.id}`}>
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Configurações - Quiz Interativo</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as credenciais e vídeo do Quiz Interativo</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog} data-testid="button-edit-quiz-settings">
              {settings ? (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar Configurações
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Configurações
                </>
              )}
            </Button>
          </DialogTrigger>
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
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Configuração Ativa</FormLabel>
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : settings ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">URL do Vídeo</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                  <p className="text-sm font-mono break-all" data-testid="text-current-video-url">
                    {settings.videoUrl || "Não configurado"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">URL da Plataforma</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                  <p className="text-sm font-mono break-all" data-testid="text-current-platform-url">
                    {settings.platformUrl}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Login</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                  <p className="text-sm font-mono" data-testid="text-current-login">
                    {settings.login}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Senha</label>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                  <p className="text-sm font-mono" data-testid="text-current-password">
                    {settings.password}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-muted-foreground">Status:</label>
              <Badge variant={settings.isActive ? "default" : "secondary"} data-testid="badge-current-status">
                {settings.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Nenhuma configuração cadastrada</p>
            <Button onClick={openDialog} data-testid="button-create-quiz-settings-empty">
              <Plus className="w-4 h-4 mr-2" />
              Criar Configurações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}