import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Lock, 
  LockOpen, 
  Edit2, 
  Link as LinkIcon,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  ImagePlus,
  X,
  Image as ImageIcon
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MarketplaceProduct {
  id: string;
  title: string;
  description?: string;
  sellerId: string;
  sellerName?: string;
  sellerEmail?: string;
  price: number;
  category: string;
  images?: string[];
  productUrl?: string;
  slug?: string;
  isDigital?: boolean;
  isActive: boolean;
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: string;
  salesCount?: number;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const CATEGORIES = [
  { value: "plugin", label: "Plugin" },
  { value: "template", label: "Template" },
  { value: "course", label: "Curso" },
  { value: "digital", label: "Produto Digital" },
  { value: "other", label: "Outros" },
];

export default function AdminMarketplace() {
  const { toast } = useToast();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: 0,
    category: "",
    productUrl: "",
    isActive: true,
    images: [] as string[],
  });
  const [newImageUrl, setNewImageUrl] = useState("");

  const { data: products, isLoading, refetch, error } = useQuery<MarketplaceProduct[]>({
    queryKey: ["/api/admin/marketplace/products"],
  });

  const blockMutation = useMutation({
    mutationFn: async (data: { productId: string; reason: string }) => {
      await apiRequest("POST", `/api/admin/marketplace/block/${data.productId}`, {
        reason: data.reason,
      });
    },
    onSuccess: () => {
      toast({ title: "Produto bloqueado com sucesso!", description: "O vendedor será notificado por email." });
      setBlockDialogOpen(false);
      setBlockReason("");
      setSelectedProduct(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao bloquear produto",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("POST", `/api/admin/marketplace/unblock/${productId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Produto desbloqueado!" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desbloquear",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { productId: string; updates: Partial<MarketplaceProduct> }) => {
      await apiRequest("PUT", `/api/admin/marketplace/products/${data.productId}`, data.updates);
    },
    onSuccess: () => {
      toast({ title: "Produto atualizado com sucesso!" });
      setEditDialogOpen(false);
      setSelectedProduct(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/admin/marketplace/products/${productId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Produto deletado com sucesso!" });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenEdit = (product: MarketplaceProduct) => {
    setSelectedProduct(product);
    setEditForm({
      title: product.title || "",
      description: product.description || "",
      price: product.price || 0,
      category: product.category || "",
      productUrl: product.productUrl || "",
      isActive: product.isActive ?? true,
      images: product.images || [],
    });
    setNewImageUrl("");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedProduct) return;
    editMutation.mutate({
      productId: selectedProduct.id,
      updates: {
        title: editForm.title,
        description: editForm.description,
        price: editForm.price,
        category: editForm.category,
        productUrl: editForm.productUrl,
        isActive: editForm.isActive,
        images: editForm.images,
      },
    });
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    if (editForm.images.includes(newImageUrl.trim())) {
      toast({ title: "Esta URL já foi adicionada", variant: "destructive" });
      return;
    }
    setEditForm({ ...editForm, images: [...editForm.images, newImageUrl.trim()] });
    setNewImageUrl("");
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...editForm.images];
    newImages.splice(index, 1);
    setEditForm({ ...editForm, images: newImages });
  };

  const copyToClipboard = async (text: string, linkType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(linkType);
      setTimeout(() => setCopiedLink(null), 2000);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const getProductLinks = (product: MarketplaceProduct) => {
    const baseUrl = window.location.origin;
    return {
      productPage: `${baseUrl}/marketplace/produto/${product.id}`,
      productSlug: product.slug ? `${baseUrl}/marketplace/produto/${product.slug}` : null,
      sellerProfile: `${baseUrl}/marketplace/vendedor/${product.sellerId}`,
      externalUrl: product.productUrl || null,
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="page-title">Moderação de Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie e modere todos os produtos do marketplace
          </p>
        </div>
        <Button variant="outline" onClick={() => window.open("/marketplace/politicas", "_blank")} data-testid="button-view-policies">
          <ExternalLink className="w-4 h-4 mr-2" />
          Ver Políticas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Produtos do Marketplace</span>
            {products && products.length > 0 && (
              <Badge variant="secondary">{products.length} produtos</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <p className="text-muted-foreground">Erro ao carregar produtos</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4" data-testid="button-retry">
                Tentar novamente
              </Button>
            </div>
          ) : !products || products.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground" data-testid="empty-state">
              Nenhum produto encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vendas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} data-testid={`product-row-${product.id}`}>
                      <TableCell className="font-medium max-w-[200px] truncate" data-testid={`product-title-${product.id}`}>
                        {product.title}
                      </TableCell>
                      <TableCell data-testid={`product-seller-${product.id}`}>
                        <div className="text-sm">
                          <p className="font-medium">{product.sellerName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{product.sellerEmail || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`product-date-${product.id}`}>
                        {formatDate(product.createdAt)}
                      </TableCell>
                      <TableCell data-testid={`product-price-${product.id}`}>
                        {formatCurrency(product.price)}
                      </TableCell>
                      <TableCell data-testid={`product-category-${product.id}`}>
                        <Badge variant="outline">
                          {CATEGORIES.find(c => c.value === product.category)?.label || product.category || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`product-sales-${product.id}`}>
                        {product.salesCount || 0}
                      </TableCell>
                      <TableCell data-testid={`product-status-${product.id}`}>
                        {product.isBlocked ? (
                          <div>
                            <Badge variant="destructive" className="bg-red-600 mb-1">
                              Bloqueado
                            </Badge>
                            {product.blockReason && (
                              <p className="text-xs text-red-600 mt-1 max-w-[150px] truncate" title={product.blockReason}>
                                {product.blockReason}
                              </p>
                            )}
                          </div>
                        ) : product.isActive ? (
                          <Badge variant="default" className="bg-green-600">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`product-actions-${product.id}`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${product.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => window.open(`/marketplace/produto/${product.id}`, "_blank")}
                              data-testid={`action-view-${product.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Produto
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProduct(product);
                                setLinksDialogOpen(true);
                              }}
                              data-testid={`action-links-${product.id}`}
                            >
                              <LinkIcon className="w-4 h-4 mr-2" />
                              Ver Links
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(product)}
                              data-testid={`action-edit-${product.id}`}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {product.isBlocked ? (
                              <DropdownMenuItem
                                onClick={() => unblockMutation.mutate(product.id)}
                                disabled={unblockMutation.isPending}
                                data-testid={`action-unblock-${product.id}`}
                              >
                                <LockOpen className="w-4 h-4 mr-2 text-green-600" />
                                Desbloquear
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setBlockDialogOpen(true);
                                }}
                                data-testid={`action-block-${product.id}`}
                              >
                                <Lock className="w-4 h-4 mr-2 text-amber-600" />
                                Bloquear
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProduct(product);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-600 focus:text-red-600"
                              data-testid={`action-delete-${product.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Bloquear Produto
            </DialogTitle>
            <DialogDescription>
              O vendedor será notificado por email sobre o bloqueio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedProduct?.title}</p>
              <p className="text-sm text-muted-foreground">
                Vendedor: {selectedProduct?.sellerName} ({selectedProduct?.sellerEmail})
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Motivo do bloqueio *</Label>
              <Textarea
                id="reason"
                placeholder="Descreva o motivo do bloqueio (violação de políticas, conteúdo proibido, etc.)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="mt-2"
                rows={4}
                data-testid="textarea-block-reason"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  O vendedor receberá um email informando que seu produto foi bloqueado por violar as 
                  <a href="/marketplace/politicas" target="_blank" className="underline ml-1">políticas do marketplace</a>.
                </span>
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setBlockDialogOpen(false);
                  setBlockReason("");
                }}
                data-testid="button-cancel-block"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!blockReason.trim()) {
                    toast({
                      title: "Erro",
                      description: "Informe o motivo do bloqueio",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedProduct) {
                    blockMutation.mutate({
                      productId: selectedProduct.id,
                      reason: blockReason,
                    });
                  }
                }}
                disabled={blockMutation.isPending}
                data-testid="button-confirm-block"
              >
                {blockMutation.isPending ? "Bloqueando..." : "Bloquear Produto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" />
              Editar Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Nome do Produto</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="mt-1"
                data-testid="input-edit-title"
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1"
                rows={3}
                data-testid="textarea-edit-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Preço (centavos)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                  data-testid="input-edit-price"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatCurrency(editForm.price)}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({ ...editForm, category: value })}
                >
                  <SelectTrigger className="mt-1" data-testid="select-edit-category">
                    <SelectValue placeholder="Selecione" />
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

            <div>
              <Label htmlFor="edit-url">URL do Produto</Label>
              <Input
                id="edit-url"
                value={editForm.productUrl}
                onChange={(e) => setEditForm({ ...editForm, productUrl: e.target.value })}
                className="mt-1"
                placeholder="https://..."
                data-testid="input-edit-url"
              />
            </div>

            {/* Seção de Imagens */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Imagens do Produto
              </Label>
              
              {/* Grid de imagens atuais */}
              {editForm.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {editForm.images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Imagem ${index + 1}`}
                        className="w-full h-20 object-cover rounded-md border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23999'%3E?%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-image-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 bg-muted/50 rounded-md text-sm text-muted-foreground">
                  Nenhuma imagem cadastrada
                </div>
              )}

              {/* Adicionar nova imagem por URL */}
              <div className="flex gap-2">
                <Input
                  placeholder="Cole a URL da imagem aqui..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddImageUrl()}
                  data-testid="input-new-image-url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  data-testid="button-add-image"
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Adicione URLs de imagens ou links externos
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <Label htmlFor="edit-active">Produto Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Produtos inativos não aparecem no marketplace
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                data-testid="switch-edit-active"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editMutation.isPending}
                data-testid="button-save-edit"
              >
                {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Links Dialog */}
      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Links do Produto
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedProduct.title}</p>
              </div>

              {(() => {
                const links = getProductLinks(selectedProduct);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium">Página do Produto</p>
                        <p className="text-xs text-muted-foreground truncate">{links.productPage}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(links.productPage, "product")}
                          data-testid="button-copy-product-link"
                        >
                          {copiedLink === "product" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(links.productPage, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {links.productSlug && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium">Link Amigável (Slug)</p>
                          <p className="text-xs text-muted-foreground truncate">{links.productSlug}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(links.productSlug!, "slug")}
                            data-testid="button-copy-slug-link"
                          >
                            {copiedLink === "slug" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(links.productSlug!, "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium">Perfil do Vendedor</p>
                        <p className="text-xs text-muted-foreground truncate">{links.sellerProfile}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(links.sellerProfile, "seller")}
                          data-testid="button-copy-seller-link"
                        >
                          {copiedLink === "seller" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(links.sellerProfile, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {links.externalUrl && (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium">URL Externa do Produto</p>
                          <p className="text-xs text-muted-foreground truncate">{links.externalUrl}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(links.externalUrl!, "external")}
                            data-testid="button-copy-external-link"
                          >
                            {copiedLink === "external" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(links.externalUrl!, "_blank")}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setLinksDialogOpen(false)} data-testid="button-close-links">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>"{selectedProduct?.title}"</strong>?
              <br /><br />
              Esta ação não pode ser desfeita. O produto será permanentemente removido do marketplace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
