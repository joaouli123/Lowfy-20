
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Package, MoreVertical, Power, PowerOff } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TablePagination } from "@/components/TablePagination";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InsertMarketplaceProduct } from "@shared/schema";

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

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const ITEMS_PER_PAGE = 15;

export default function MeusProdutos() {
  const { toast } = useToast();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const paginatedProducts = useMemo(() => {
    if (!myProducts) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return myProducts.slice(start, end);
  }, [myProducts, currentPage]);

  const totalPages = Math.ceil((myProducts?.length || 0) / ITEMS_PER_PAGE);

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
          ? "O produto agora está visível no marketplace." 
          : "O produto foi ocultado do marketplace.",
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
      
      // Separar imagens internas (upload local ou Object Storage) das externas (URLs http)
      const allImages = product.images || [];
      // Imagens internas: começam com /uploads/ ou /objects/ ou são paths relativos
      const internalImages = allImages.filter((url: string) => 
        url.startsWith('/uploads/') || url.startsWith('/objects/') || !url.startsWith('http')
      );
      // Imagens externas: URLs completas http/https (exceto do próprio domínio)
      const externalImages = allImages.filter((url: string) => 
        url.startsWith('http') && !url.includes('/objects/') && !url.includes('/uploads/')
      );
      
      setFormData({
        title: product.title,
        description: product.description || "",
        price: (product.price / 100).toFixed(2),
        category: product.category || "",
        productUrl: product.productUrl || "",
        images: internalImages,
        externalImageUrls: externalImages.join(", "),
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Meus Produtos</h1>
            <p className="text-gray-600">Gerencie seus produtos à venda</p>
          </div>
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
          <>
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
                  {paginatedProducts.map((product: any) => (
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
                          <Link 
                            href={`/marketplace/produto/${product.slug || product.id}`}
                            className="line-clamp-1 hover:text-primary hover:underline transition-colors cursor-pointer"
                            data-testid={`link-product-${product.id}`}
                          >
                            {product.title}
                          </Link>
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
                        {product.isBlocked ? (
                          <Badge variant="destructive" className="bg-red-600">
                            Bloqueado
                          </Badge>
                        ) : (
                          <Badge variant={product.isActive ? "default" : "secondary"}>
                            {product.isActive ? "Ativo" : "Inativo"}
                          </Badge>
                        )}
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleStatusMutation.mutate({ 
                                productId: product.id, 
                                isActive: !product.isActive 
                              })}
                              disabled={toggleStatusMutation.isPending}
                              data-testid={`menu-toggle-${product.id}`}
                            >
                              {product.isActive ? (
                                <>
                                  <PowerOff className="w-4 h-4 mr-2 text-orange-500" />
                                  <span className="text-orange-600">Desativar</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-4 h-4 mr-2 text-green-500" />
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
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, myProducts.length)} de {myProducts.length} produtos
              </p>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
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
                  />
                  <Label htmlFor="isActive">Produto Ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={productMutation.isPending}>
                  {productMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
