import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { trackAdAbandonedCheckout } from "@/hooks/useGoogleAnalytics";
import type { CartItemWithProduct } from "@shared/schema";

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

export default function Cart() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: cartItems, isLoading } = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/marketplace/cart"],
  });

  // Since backend filters inactive products with innerJoin, cartItems only contains valid products
  const validCartItems = cartItems || [];

  // Rastrear checkout abandonado quando usuário sai do carrinho
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (validCartItems && validCartItems.length > 0) {
        const total = validCartItems.reduce((sum, item) => {
          return sum + (item.product?.price || 0) * item.quantity;
        }, 0) || 0;
        
        if (total > 0) {
          trackAdAbandonedCheckout(total / 100, 'BRL', validCartItems.length);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [validCartItems]);

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      return await apiRequest("PUT", `/api/marketplace/cart/${productId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a quantidade.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (productId: string) => {
      return await apiRequest("DELETE", `/api/marketplace/cart/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
      toast({
        title: "Removido",
        description: "Produto removido do carrinho.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover o produto.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateQuantity = (productId: string, currentQuantity: number, change: number) => {
    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) return;
    if (newQuantity > 99) return;
    updateQuantityMutation.mutate({ productId, quantity: newQuantity });
  };

  const handleRemoveItem = (productId: string) => {
    removeItemMutation.mutate(productId);
  };

  const handleCheckout = () => {
    setLocation("/checkout");
  };

  // Calculate totals (only for valid items)
  const subtotal = validCartItems.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * item.quantity;
  }, 0) || 0;

  const total = subtotal; // No platform fee for buyers

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando carrinho...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!validCartItems || validCartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-1">Carrinho de Compras</h1>
            <p className="text-muted-foreground">Seus produtos selecionados</p>
          </div>

          <div className="text-center py-20">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Seu carrinho está vazio
            </h3>
            <p className="text-muted-foreground mb-6">
              Adicione produtos da vitrine para começar a comprar
            </p>
            <Button
              onClick={() => setLocation("/marketplace/vitrine")}
              size="lg"
              data-testid="button-go-to-vitrine"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ir para Vitrine
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">Carrinho de Compras</h1>
          <p className="text-muted-foreground">
            {validCartItems.length} {validCartItems.length === 1 ? "produto" : "produtos"} no carrinho
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {validCartItems.map((item) => (
              <Card key={item.id} data-testid={`cart-item-${item.productId}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {/* Product Image and Info - Mobile */}
                    <div className="flex gap-3 sm:gap-4 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-md overflow-hidden">
                          {item.product?.images && item.product.images.length > 0 ? (
                            <img
                              src={item.product.images[0]}
                              alt={item.product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base sm:text-lg text-foreground mb-1 line-clamp-2">
                          {item.product?.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2 hidden sm:block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {item.product?.description || "Sem descrição"}
                        </p>
                        
                        {/* Seller Info */}
                        {item.seller && (
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Vendido por <span className="font-medium text-foreground">{item.seller.name}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price and Controls - Mobile Optimized */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between gap-3">
                      <p className="text-lg sm:text-xl font-bold text-primary" data-testid={`text-price-${item.productId}`}>
                        {formatCurrency((item.product?.price || 0) * item.quantity)}
                      </p>

                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity, -1)}
                            disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                            data-testid={`button-decrease-${item.productId}`}
                          >
                            <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <span className="w-8 sm:w-10 text-center font-medium text-sm sm:text-base" data-testid={`text-quantity-${item.productId}`}>
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 sm:h-9 sm:w-9"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity, 1)}
                            disabled={item.quantity >= 99 || updateQuantityMutation.isPending}
                            data-testid={`button-increase-${item.productId}`}
                          >
                            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(item.productId)}
                          disabled={removeItemMutation.isPending}
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-8">
              <CardHeader className="pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">Resumo do Pedido</h2>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <Separator />

                <div className="flex justify-between items-center p-3 sm:p-4 bg-primary/5 rounded-lg">
                  <span className="text-base sm:text-lg font-semibold text-foreground">Total</span>
                  <span className="text-2xl sm:text-3xl font-bold text-primary" data-testid="text-total">
                    {formatCurrency(total)}
                  </span>
                </div>

                <Button
                  className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold"
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                >
                  Finalizar Compra
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-10 sm:h-11"
                  onClick={() => setLocation("/marketplace/vitrine")}
                  data-testid="button-continue-shopping"
                >
                  Continuar Comprando
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
