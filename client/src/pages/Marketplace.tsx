import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import {
  Search,
  Plus,
  Pencil,
  Eye,
  DollarSign,
  TrendingUp,
  Calendar,
  Package,
  ShoppingBag,
  Star,
  Filter,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  MoreVertical,
  Power,
  PowerOff,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  MarketplaceProductWithRelations,
  MarketplaceOrderWithRelations,
  SellerWallet,
  SellerTransaction,
  InsertMarketplaceProduct,
} from "@shared/schema";

// ==================== TYPES & CONSTANTS ====================

const CATEGORIES = [
  { value: "digital", label: "Produtos Digitais" },
  { value: "service", label: "Serviços" },
  { value: "template", label: "Templates" },
  { value: "course", label: "Cursos" },
  { value: "tool", label: "Ferramentas" },
  { value: "ebook", label: "E-books" },
  { value: "plugin", label: "Plugins" },
  { value: "other", label: "Outros" },
];

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

// ==================== HELPER FUNCTIONS ====================

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDate = (date: Date | string) => {
  return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const formatDateTime = (date: Date | string) => {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const canRefund = (orderDate: Date | string) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(orderDate) >= sevenDaysAgo;
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    completed: { label: "Concluído", variant: "default" },
    refunded: { label: "Reembolsado", variant: "destructive" },
    refund_requested: { label: "Reembolso Solicitado", variant: "outline" },
  };
  return statusConfig[status] || { label: status, variant: "outline" };
};

// ==================== MAIN COMPONENT ====================

export default function Marketplace() {
  // Redireciona para a Vitrine por padrão
  window.location.href = "/marketplace/vitrine";
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
}

// ==================== SEÇÃO 1: VITRINE ====================

function VitrineSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // SEO Schema Markup for Breadcrumb
  const marketplaceSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Lowfy",
        "item": "https://lowfy.com.br"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Marketplace",
        "item": "https://lowfy.com.br/marketplace"
      }
    ]
  };

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/marketplace/products", selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (searchQuery) params.append("search", searchQuery);
      const url = `/api/marketplace/products${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  const products = productsData?.map((item: any) => ({
    ...item.product,
    seller: item.seller,
  })) || [];

  return (
    <div>
      <script type="application/ld+json">
        {JSON.stringify(marketplaceSchema)}
      </script>
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-products"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-[220px]" data-testid="select-category-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Todas Categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando produtos...</p>
          </div>
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <Card
              key={product.id}
              className="h-full hover:shadow-xl transition-all cursor-pointer"
              data-testid={`card-product-${product.id}`}
            >
              <CardHeader className="p-0">
                <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  {product.category && (
                    <Badge className="absolute top-3 right-3 bg-black text-white">
                      {CATEGORIES.find((c) => c.value === product.category)?.label || product.category}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-1">
                  {product.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {product.description || "Sem descrição"}
                </p>
                <div className="flex items-center gap-2 mb-3">
                  {product.rating && product.rating > 0 ? (
                    <>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.round(product.rating / 10)
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        ({product.reviewCount || 0})
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">Sem avaliações</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-semibold">
                      {product.seller?.name?.charAt(0).toUpperCase() || "V"}
                    </span>
                  </div>
                  <span className="line-clamp-1">{product.seller?.name || "Vendedor"}</span>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex items-center justify-between border-t">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(product.price)}
                  </p>
                </div>
                <Button size="sm" data-testid={`button-buy-${product.id}`}>
                  Comprar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-gray-600">
            {searchQuery || selectedCategory !== "all"
              ? "Tente ajustar os filtros de busca"
              : "Seja o primeiro a vender um produto!"}
          </p>
        </div>
      )}
    </div>
  );
}

// ==================== SEÇÃO 2: MEUS PRODUTOS ====================

function MeusProdutosSection() {
  const { toast } = useToast();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    productUrl: "",
    images: [] as string[],
    externalImageUrls: "",
    isActive: true,
  });

  const { data: myProducts, isLoading } = useQuery({
    queryKey: ["/api/marketplace/my-products"],
  });

  const productMutation = useMutation({
    mutationFn: async (data: any) => {
      // Combinar imagens de upload e URLs externas
      const externalUrls = data.externalImageUrls 
        ? data.externalImageUrls.split(",").map((url: string) => url.trim()).filter(Boolean)
        : [];
      const allImages = [...data.images, ...externalUrls];

      const payload: InsertMarketplaceProduct & { id?: string } = {
        title: data.title,
        description: data.description || null,
        price: Math.round(parseFloat(data.price) * 100),
        category: data.category || null,
        productUrl: data.productUrl,
        images: allImages,
        isActive: data.isActive,
      };

      if (editingProduct) {
        return await apiRequest("PUT", `/api/marketplace/products/${editingProduct.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/marketplace/products", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
      toast({
        title: editingProduct ? "Produto atualizado!" : "Produto criado!",
        description: "Suas alterações foram salvas com sucesso.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o produto.",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/marketplace/products/${productId}`, { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/products"] });
      toast({
        title: variables.isActive ? "Produto ativado!" : "Produto desativado!",
        description: variables.isActive 
          ? "O produto está visível na vitrine novamente." 
          : "O produto foi removido da vitrine.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar o status do produto.",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        title: product.title,
        description: product.description || "",
        price: (product.price / 100).toFixed(2),
        category: product.category || "",
        productUrl: product.productUrl || "",
        images: product.images || [],
        externalImageUrls: "",
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        title: "",
        description: "",
        price: "",
        category: "",
        productUrl: "",
        images: [],
        externalImageUrls: "",
        isActive: true,
      });
    }
    setIsProductDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setFormData({
      title: "",
      description: "",
      price: "",
      category: "",
      productUrl: "",
      images: [],
      externalImageUrls: "",
      isActive: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.productUrl) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título, preço e URL do produto.",
        variant: "destructive",
      });
      return;
    }
    productMutation.mutate(formData);
  };

  const handleToggleStatus = (productId: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ productId, isActive: !currentStatus });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Meus Produtos</h2>
        <Button onClick={() => handleOpenDialog()} data-testid="button-create-product">
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : myProducts && myProducts.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myProducts.map((product: any) => (
                <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <span className="line-clamp-1">{product.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {CATEGORIES.find((c) => c.value === product.category)?.label || "-"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell>{product.salesCount || 0}</TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-actions-${product.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleOpenDialog(product)}
                          data-testid={`menu-edit-${product.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleStatus(product.id, product.isActive)}
                          disabled={toggleStatusMutation.isPending}
                          data-testid={`menu-toggle-${product.id}`}
                        >
                          {product.isActive ? (
                            <>
                              <PowerOff className="w-4 h-4 mr-2 text-orange-600" />
                              <span className="text-orange-600">Desativar</span>
                            </>
                          ) : (
                            <>
                              <Power className="w-4 h-4 mr-2 text-green-600" />
                              <span className="text-green-600">Ativar</span>
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
          <p className="text-gray-600 mb-4">Comece a vender criando seu primeiro produto</p>
          <Button onClick={() => handleOpenDialog()} data-testid="button-create-first-product">
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeiro Produto
          </Button>
        </div>
      )}

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-product-form">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do produto. Campos obrigatórios estão marcados com *.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nome do produto"
                  data-testid="input-product-title"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva seu produto..."
                  rows={4}
                  data-testid="textarea-product-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Preço (R$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-product-price"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger data-testid="select-product-category">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="productUrl">URL do Produto *</Label>
                <Input
                  id="productUrl"
                  type="url"
                  value={formData.productUrl}
                  onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                  placeholder="https://..."
                  data-testid="input-product-url"
                  required
                />
                <p className="text-xs text-gray-500">
                  Link onde o comprador acessará o produto após a compra
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Imagens do Produto</Label>
                <ImageUpload
                  value={formData.images}
                  onChange={(urls) => setFormData({ ...formData, images: urls })}
                  maxImages={10}
                  maxSizeMB={5}
                  maxSizePerImageMB={2}
                  disabled={productMutation.isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="externalImageUrls">Links Externos (opcional)</Label>
                <Textarea
                  id="externalImageUrls"
                  value={formData.externalImageUrls}
                  onChange={(e) => setFormData({ ...formData, externalImageUrls: e.target.value })}
                  placeholder="https://drive.google.com/..., https://exemplo.com/imagem.jpg"
                  rows={2}
                  data-testid="textarea-external-image-urls"
                />
                <p className="text-xs text-gray-500">
                  Use links externos para imagens maiores que 5MB. Separe múltiplas URLs por vírgula.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-product-active"
                />
                <Label htmlFor="isActive">Produto Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                data-testid="button-cancel-product"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={productMutation.isPending}
                data-testid="button-save-product"
              >
                {productMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== SEÇÃO 3: COMPRAS ====================

function ComprasSection() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["/api/marketplace/my-purchases"],
  });

  const refundMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      return await apiRequest("POST", `/api/marketplace/request-refund/${orderId}`, {
        refundReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-purchases"] });
      toast({
        title: "Reembolso solicitado!",
        description: "Sua solicitação será analisada em breve.",
      });
      setIsSheetOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível solicitar o reembolso.",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (order: any) => {
    setSelectedOrder({
      ...order.order,
      product: order.product,
      seller: order.seller,
      canRefund: canRefund(order.order.createdAt),
    });
    setIsSheetOpen(true);
  };

  const handleRefund = () => {
    if (selectedOrder) {
      refundMutation.mutate({
        orderId: selectedOrder.id,
        reason: "Solicitado pelo comprador",
      });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Minhas Compras</h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        </div>
      ) : purchases && purchases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((purchase: any) => {
            const order = purchase.order;
            const product = purchase.product;
            const seller = purchase.seller;
            const status = getStatusBadge(order.status);

            return (
              <Card key={order.id} data-testid={`card-purchase-${order.id}`}>
                <CardHeader className="p-0">
                  <div className="relative h-40 bg-gray-100 rounded-t-lg overflow-hidden">
                    {product?.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <Badge
                      variant={status.variant}
                      className="absolute top-3 right-3"
                    >
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">
                    {product?.title || "Produto"}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(order.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleViewDetails(purchase)}
                    data-testid={`button-view-details-${order.id}`}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma compra realizada</h3>
          <p className="text-gray-600">Explore a vitrine e adquira produtos incríveis!</p>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto" data-testid="sheet-purchase-details">
          <SheetHeader>
            <SheetTitle>Detalhes da Compra</SheetTitle>
            <SheetDescription>
              Informações completas sobre sua aquisição
            </SheetDescription>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Produto</h3>
                <div className="flex gap-3">
                  {selectedOrder.product?.images && selectedOrder.product.images.length > 0 ? (
                    <img
                      src={selectedOrder.product.images[0]}
                      alt={selectedOrder.product.title}
                      className="w-20 h-20 object-cover rounded"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{selectedOrder.product?.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedOrder.product?.description}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Vendedor</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="font-semibold">
                      {selectedOrder.seller?.name?.charAt(0).toUpperCase() || "V"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{selectedOrder.seller?.name}</p>
                    <p className="text-sm text-gray-600">{selectedOrder.seller?.email}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Informações do Pedido</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor Pago:</span>
                    <span className="font-semibold">
                      {formatCurrency(selectedOrder.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data da Compra:</span>
                    <span>{formatDateTime(selectedOrder.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <Badge variant={getStatusBadge(selectedOrder.status).variant}>
                      {getStatusBadge(selectedOrder.status).label}
                    </Badge>
                  </div>
                  {selectedOrder.refundRequestedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reembolso Solicitado em:</span>
                      <span>{formatDateTime(selectedOrder.refundRequestedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                {selectedOrder.product?.productUrl && selectedOrder.status === "completed" && (
                  <Button
                    className="w-full"
                    onClick={() => window.open(selectedOrder.product.productUrl, "_blank")}
                    data-testid="button-access-product"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Acessar Produto
                  </Button>
                )}

                {selectedOrder.canRefund &&
                  selectedOrder.status !== "refunded" &&
                  selectedOrder.status !== "refund_requested" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleRefund}
                      disabled={refundMutation.isPending}
                      data-testid="button-request-refund"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {refundMutation.isPending ? "Solicitando..." : "Solicitar Reembolso"}
                    </Button>
                  )}

                {!selectedOrder.canRefund && selectedOrder.status === "completed" && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    O prazo para solicitar reembolso (7 dias) expirou.
                  </div>
                )}

                {selectedOrder.status === "refund_requested" && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Seu reembolso está sendo processado.
                  </div>
                )}

                {selectedOrder.status === "refunded" && (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Reembolso concluído em {formatDateTime(selectedOrder.refundCompletedAt || selectedOrder.updatedAt)}.
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ==================== SEÇÃO 4: FINANCEIRO ====================

function FinanceiroSection() {
  const { toast } = useToast();
  const [isPixDialogOpen, setIsPixDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [transactionTab, setTransactionTab] = useState("sales");
  const [pixFormData, setPixFormData] = useState({ pixKey: "", pixKeyType: "" });
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: wallet } = useQuery<SellerWallet>({
    queryKey: ["/api/marketplace/wallet"],
  });

  const { data: salesStats } = useQuery({
    queryKey: ["/api/marketplace/sales-stats"],
  });

  const { data: transactions } = useQuery<SellerTransaction[]>({
    queryKey: ["/api/marketplace/transactions"],
  });

  const pixMutation = useMutation({
    mutationFn: async (data: { pixKey: string; pixKeyType: string }) => {
      return await apiRequest("POST", "/api/marketplace/update-pix", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/wallet"] });
      toast({
        title: "PIX atualizado!",
        description: "Suas informações de PIX foram salvas.",
      });
      setIsPixDialogOpen(false);
      setPixFormData({ pixKey: "", pixKeyType: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o PIX.",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest("POST", "/api/marketplace/withdraw", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/transactions"] });
      toast({
        title: "Saque solicitado!",
        description: "Seu saque será processado em breve.",
      });
      setIsWithdrawDialogOpen(false);
      setWithdrawAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível solicitar o saque.",
        variant: "destructive",
      });
    },
  });

  const handlePixSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pixFormData.pixKey || !pixFormData.pixKeyType) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a chave e o tipo de PIX.",
        variant: "destructive",
      });
      return;
    }
    pixMutation.mutate(pixFormData);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountInCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (amountInCents < 1000) {
      toast({
        title: "Valor mínimo",
        description: "O valor mínimo para saque é R$ 10,00.",
        variant: "destructive",
      });
      return;
    }
    if (amountInCents > (wallet?.balanceAvailable || 0)) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não tem saldo disponível suficiente.",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate(amountInCents);
  };

  const filteredTransactions = transactions?.filter((t: SellerTransaction) => {
    if (transactionTab === "sales") return t.type === "sale";
    if (transactionTab === "refunds") return t.type === "refund";
    if (transactionTab === "withdrawals") return t.type === "withdrawal";
    return true;
  }) || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Financeiro</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-balance-pending">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Saldo Bloqueado (8 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">
                {formatCurrency(wallet?.balancePending || 0)}
              </p>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-balance-available">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Saldo Disponível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(wallet?.balanceAvailable || 0)}
              </p>
              <Wallet className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-earned">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Ganho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">
                {formatCurrency(wallet?.totalEarned || 0)}
              </p>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-withdrawn">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Sacado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">
                {formatCurrency(wallet?.totalWithdrawn || 0)}
              </p>
              <ArrowUpRight className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => {
            setPixFormData({
              pixKey: wallet?.pixKey || "",
              pixKeyType: wallet?.pixKeyType || "",
            });
            setIsPixDialogOpen(true);
          }}
          data-testid="button-configure-pix"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          {wallet?.pixKey ? "Atualizar PIX" : "Configurar PIX"}
        </Button>
        <Button
          onClick={() => setIsWithdrawDialogOpen(true)}
          disabled={!wallet?.pixKey || (wallet?.balanceAvailable || 0) < 1000}
          data-testid="button-request-withdraw"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Solicitar Saque
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={transactionTab} onValueChange={setTransactionTab}>
            <TabsList className="mb-4" data-testid="tabs-transactions">
              <TabsTrigger value="sales">Vendas</TabsTrigger>
              <TabsTrigger value="refunds">Reembolsos</TabsTrigger>
              <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            </TabsList>

            <div className="overflow-x-auto">
              {filteredTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction: SellerTransaction) => (
                      <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                        <TableCell>{formatDateTime(transaction.createdAt)}</TableCell>
                        <TableCell className="capitalize">
                          {transaction.type === "sale" && "Venda"}
                          {transaction.type === "refund" && "Reembolso"}
                          {transaction.type === "withdrawal" && "Saque"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.description || "-"}
                        </TableCell>
                        <TableCell
                          className={`font-semibold ${
                            transaction.type === "refund" || transaction.type === "withdrawal"
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {transaction.type === "refund" || transaction.type === "withdrawal" ? "-" : "+"}
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.status === "completed"
                                ? "default"
                                : transaction.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {transaction.status === "pending" && "Pendente"}
                            {transaction.status === "completed" && "Concluído"}
                            {transaction.status === "failed" && "Falhou"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Nenhuma transação encontrada
                </div>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isPixDialogOpen} onOpenChange={setIsPixDialogOpen}>
        <DialogContent data-testid="dialog-pix-form">
          <DialogHeader>
            <DialogTitle>Configurar PIX</DialogTitle>
            <DialogDescription>
              Informe sua chave PIX para receber os pagamentos
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePixSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="pixKeyType">Tipo de Chave</Label>
                <Select
                  value={pixFormData.pixKeyType}
                  onValueChange={(value) =>
                    setPixFormData({ ...pixFormData, pixKeyType: value })
                  }
                >
                  <SelectTrigger data-testid="select-pix-type">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pixKey">Chave PIX</Label>
                <Input
                  id="pixKey"
                  value={pixFormData.pixKey}
                  onChange={(e) =>
                    setPixFormData({ ...pixFormData, pixKey: e.target.value })
                  }
                  placeholder="Digite sua chave PIX"
                  data-testid="input-pix-key"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPixDialogOpen(false)}
                data-testid="button-cancel-pix"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pixMutation.isPending}
                data-testid="button-save-pix"
              >
                {pixMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
        <DialogContent data-testid="dialog-withdraw-form">
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Saldo disponível: {formatCurrency(wallet?.balanceAvailable || 0)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleWithdrawSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="withdrawAmount">Valor do Saque (R$)</Label>
                <Input
                  id="withdrawAmount"
                  type="number"
                  step="0.01"
                  min="10"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-withdraw-amount"
                  required
                />
                <p className="text-xs text-gray-500">Valor mínimo: R$ 10,00</p>
              </div>
              {wallet?.pixKey && (
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p className="text-gray-600">
                    Chave PIX cadastrada:{" "}
                    <span className="font-semibold">{wallet.pixKey}</span>
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWithdrawDialogOpen(false)}
                data-testid="button-cancel-withdraw"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={withdrawMutation.isPending}
                data-testid="button-confirm-withdraw"
              >
                {withdrawMutation.isPending ? "Solicitando..." : "Solicitar Saque"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
