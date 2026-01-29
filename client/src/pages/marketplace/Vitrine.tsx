
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Filter, Package, ShoppingBag, ShoppingCart, Eye, X, ArrowRight, User, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { trackAdAddToCart, trackAdViewItem } from "@/hooks/useGoogleAnalytics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function Vitrine() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  const allProducts = productsData?.map((item: any) => ({
    ...item.product,
    seller: item.seller,
  })) || [];

  const products = allProducts.slice(0, displayedCount);
  const hasMore = displayedCount < allProducts.length;

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setDisplayedCount((prev) => prev + ITEMS_PER_PAGE);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoading]);

  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await apiRequest("POST", "/api/marketplace/cart", { productId, quantity: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
      toast({
        title: "Produto adicionado!",
        description: "O produto foi adicionado ao carrinho.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar ao carrinho.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = (e: React.MouseEvent, productId: string, productData?: any) => {
    e.stopPropagation();
    // Google Ads tracking
    if (productData) {
      trackAdAddToCart(productData.title, productData.id, productData.price / 100, 1);
    }
    addToCartMutation.mutate(productId);
  };

  const handleProductView = (product: any) => {
    // Google Ads tracking - view item
    trackAdViewItem(product.title, product.id, product.price / 100, product.category || 'produto');
  };

  const handleProductClick = (product: any) => {
    const identifier = product.slug || product.id;
    setLocation(`/marketplace/produto/${identifier}`);
  };

  const handleQuickView = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleBuyNow = () => {
    if (!selectedProduct) return;
    addToCartMutation.mutate(selectedProduct.id, {
      onSuccess: () => {
        setIsModalOpen(false);
        setLocation("/checkout");
      }
    });
  };

  const handleAddToCartFromModal = () => {
    if (!selectedProduct) return;
    addToCartMutation.mutate(selectedProduct.id, {
      onSuccess: () => {
        setIsModalOpen(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Vitrine</h1>
          <p className="text-gray-600">Descubra produtos digitais e serviços da nossa comunidade</p>
        </div>

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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando produtos...</p>
            </div>
          </div>
        ) : products && products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product: any) => (
                <Card
                  key={product.id}
                  className="overflow-hidden border shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => {
                    handleProductView(product);
                    handleProductClick(product);
                  }}
                  data-testid={`card-product-${product.id}`}
                >
                  <CardHeader className="p-0">
                    <div className="relative h-56 bg-muted overflow-hidden">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Package className="w-20 h-20 text-muted-foreground" />
                        </div>
                      )}
                      
                      {product.category && (
                        <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
                          {CATEGORIES.find((c) => c.value === product.category)?.label || product.category}
                        </Badge>
                      )}
                      
                      <Button 
                        size="icon"
                        variant="secondary"
                        className="absolute bottom-3 right-3 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product);
                        }}
                        data-testid={`button-quick-view-${product.id}`}
                      >
                        <Eye className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-xl text-foreground mb-1 line-clamp-2">
                      {product.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                      {product.description || "Sem descrição disponível"}
                    </p>
                    <div className="flex items-center gap-2.5 pt-2">
                      {product.seller?.profileImageUrl ? (
                        <img
                          src={product.seller.profileImageUrl}
                          alt={product.seller.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-foreground">
                            {product.seller?.name?.charAt(0).toUpperCase() || "V"}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.seller?.name || "Vendedor"}
                        </p>
                        {product.seller?.areaAtuacao && (
                          <p className="text-xs text-muted-foreground truncate">
                            {product.seller.areaAtuacao}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Preço</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                    <Button 
                      size="lg" 
                      className="px-6"
                      onClick={(e) => handleAddToCart(e, product.id, product)}
                      disabled={addToCartMutation.isPending}
                      data-testid={`button-add-to-cart-${product.id}`}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {addToCartMutation.isPending ? "Adicionando..." : "Adicionar"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            {hasMore && (
              <div 
                ref={loadMoreRef} 
                className="flex items-center justify-center py-8"
                data-testid="load-more-trigger"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Carregando mais produtos...</span>
                </div>
              </div>
            )}
            
            {!hasMore && allProducts.length > ITEMS_PER_PAGE && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Você viu todos os {allProducts.length} produtos disponíveis</p>
              </div>
            )}
          </>
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

      {/* Quick View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">{selectedProduct.title}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Product Image */}
                <div className="relative h-80 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-lg overflow-hidden">
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-24 h-24 text-muted-foreground opacity-30" />
                    </div>
                  )}
                </div>

                {/* Category Badge */}
                {selectedProduct.category && (
                  <Badge className="mb-4">
                    {CATEGORIES.find((c) => c.value === selectedProduct.category)?.label || selectedProduct.category}
                  </Badge>
                )}

                {/* Description */}
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Descrição</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selectedProduct.description || "Sem descrição disponível"}
                  </p>
                </div>

                <Separator />

                {/* Seller Info */}
                <div className="flex items-center gap-3">
                  {selectedProduct.seller?.profileImageUrl ? (
                    <img
                      src={selectedProduct.seller.profileImageUrl}
                      alt={selectedProduct.seller.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{selectedProduct.seller?.name || "Vendedor"}</p>
                    {selectedProduct.seller?.areaAtuacao && (
                      <p className="text-sm text-muted-foreground">{selectedProduct.seller.areaAtuacao}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Price and Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Preço</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1" 
                      size="lg"
                      onClick={handleBuyNow}
                      disabled={addToCartMutation.isPending}
                      data-testid="button-modal-buy-now"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      {addToCartMutation.isPending ? "Processando..." : "Comprar Agora"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      size="lg"
                      onClick={handleAddToCartFromModal}
                      disabled={addToCartMutation.isPending}
                      data-testid="button-modal-add-to-cart"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Adicionar ao Carrinho
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => handleProductClick(selectedProduct)}
                    data-testid="button-modal-view-details"
                  >
                    Ver detalhes completos
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
