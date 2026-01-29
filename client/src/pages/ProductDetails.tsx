import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useProductSchema } from "@/hooks/useProductSchema";
import { SEO } from "@/components/SEO";
import {
  Star,
  ShoppingCart,
  Package,
  User,
  Calendar,
  Check,
  ArrowLeft,
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Link } from "wouter";
import type { MarketplaceProductWithRelations, ProductReview } from "@shared/schema";

export default function ProductDetails() {
  const [, params] = useRoute("/marketplace/produto/:id");
  const [, setLocation] = useLocation();
  const productId = params?.id;
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: productData, isLoading } = useQuery({
    queryKey: [`/api/marketplace/products/${productId}`],
    enabled: !!productId,
  });

  const product = productData?.product;
  const seller = productData?.seller;

  // Filter out broken/empty images and ensure valid image URLs
  const validImages = product?.images?.filter(img => {
    if (!img || typeof img !== 'string') return false;
    const trimmed = img.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return false;
    // Verifica se é uma URL válida
    try {
      new URL(trimmed);
      return true;
    } catch {
      // Se não for URL completa, verifica se começa com / (caminho relativo)
      return trimmed.startsWith('/');
    }
  }) || [];

  const { data: reviews } = useQuery<ProductReview[]>({
    queryKey: [`/api/marketplace/products/${productId}/reviews`],
    enabled: !!productId,
  });

  const avgRating = reviews?.length 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : undefined;

  useProductSchema({
    id: productId || '',
    name: product?.title || 'Produto',
    description: product?.description?.substring(0, 160) || 'Produto do marketplace Lowfy',
    image: product?.images?.[0] || undefined,
    price: product?.price ? product.price / 100 : undefined,
    currency: 'BRL',
    rating: avgRating,
    reviewCount: reviews?.length,
    availability: product?.stock && product.stock > 0 ? 'InStock' : 'OutOfStock',
    seller: seller?.name || 'Lowfy',
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/marketplace/products/${productId}/review`, {
        rating: reviewRating, // 1-5 scale
        comment: reviewText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/marketplace/products/${productId}/reviews`] });
      queryClient.invalidateQueries({ queryKey: [`/api/marketplace/products/${productId}`] });
      toast({
        title: "Review enviado!",
        description: "Obrigado pelo seu feedback.",
      });
      setReviewText("");
      setReviewRating(0);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o review.",
        variant: "destructive",
      });
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Product ID not found");
      return await apiRequest("POST", "/api/marketplace/cart", { 
        productId, 
        quantity: 1 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/cart"] });
      toast({
        title: "Adicionado ao carrinho!",
        description: "Produto adicionado com sucesso.",
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

  const handleBuyNow = () => {
    addToCartMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/checkout");
      }
    });
  };

  const formatPrice = (priceValue: number) => {
    // Todos os valores no banco estão em centavos
    const valueInReais = priceValue / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valueInReais);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando produto...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Produto não encontrado</h3>
          <Link href="/marketplace">
            <Button className="mt-4">Voltar ao Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${product.title} - Marketplace | Lowfy`}
        description={product.description?.substring(0, 160) || `Compre ${product.title} no marketplace da Lowfy`}
        ogTitle={product.title}
        ogDescription={product.description?.substring(0, 160)}
        ogImage={product.images?.[0] || '/og-image.svg'}
        ogType="product"
        canonicalUrl={`https://lowfy.com.br/marketplace/produto/${productId}`}
      />
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
        <Link href="/marketplace">
          <Button variant="ghost" className="mb-4 sm:mb-6 hover:text-white" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Marketplace
          </Button>
        </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Product Info */}
        <div className="lg:col-span-2 order-1 lg:order-1">
          <Card>
            <CardContent className="p-4 sm:p-6">
              {/* Product Image Gallery */}
              <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
                {/* Main Image */}
                <div className="relative h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-lg overflow-hidden group">
                  {validImages.length > 0 ? (
                    <>
                      <img
                        src={validImages[selectedImageIndex]}
                        alt={product.title}
                        className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setIsImageModalOpen(true)}
                        data-testid="product-main-image"
                      />
                      {validImages.length > 1 && (
                        <>
                          <button
                            onClick={() => setSelectedImageIndex((prev) => 
                              prev === 0 ? validImages.length - 1 : prev - 1
                            )}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid="button-prev-image"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => setSelectedImageIndex((prev) => 
                              prev === validImages.length - 1 ? 0 : prev + 1
                            )}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid="button-next-image"
                          >
                            <ChevronRight className="w-6 h-6" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-24 h-24 text-muted-foreground opacity-50" />
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {validImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2" data-testid="image-thumbnails">
                    {validImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedImageIndex
                            ? 'border-primary shadow-lg'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                        data-testid={`thumbnail-${index}`}
                      >
                        <img
                          src={image}
                          alt={`${product.title} - ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" data-testid="product-title">
                      {product.title}
                    </h1>
                    {product.category && (
                      <Badge className="mb-2 sm:mb-3">{product.category}</Badge>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-primary" data-testid="product-price">
                      {formatPrice(product.price)}
                    </p>
                  </div>
                </div>

                {/* Rating */}
                {product.rating > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(product.rating / 10)
                              ? "text-yellow-500 fill-yellow-500"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({product.reviewCount || 0} avaliações)
                    </span>
                  </div>
                )}

                <p className="text-foreground mb-4 whitespace-pre-wrap" data-testid="product-description">
                  {product.description && product.description.trim() ? product.description.trim() : "Sem descrição disponível"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Bottom on mobile, sticky on desktop */}
        <div className="lg:col-span-1 order-2 lg:order-2">
          {/* Purchase Card */}
          <Card className="lg:sticky lg:top-8">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg text-left">Comprar Produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg text-left">
                <p className="text-xs text-muted-foreground mb-1">Preço</p>
                <p className="text-3xl sm:text-4xl font-bold text-primary">{formatPrice(product.price)}</p>
              </div>
              
              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-base font-semibold shadow-lg hover:shadow-xl transition-all h-12 sm:h-14" 
                onClick={handleBuyNow}
                disabled={addToCartMutation.isPending}
                data-testid="button-buy-now"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {addToCartMutation.isPending ? "Adicionando..." : "Comprar Agora"}
              </Button>

              <Button 
                variant="outline"
                className="w-full border-2 hover:bg-secondary/50 hover:text-primary h-12 sm:h-14" 
                onClick={() => addToCartMutation.mutate()}
                disabled={addToCartMutation.isPending}
                data-testid="button-add-to-cart"
              >
                <Plus className="w-5 h-5 mr-2" />
                Adicionar ao Carrinho
              </Button>

              <div className="pt-4 border-t border-border space-y-3">
                <h4 className="font-semibold text-foreground">Vendedor</h4>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={seller?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {seller?.name?.charAt(0).toUpperCase() || "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground" data-testid="seller-name">
                      {seller?.name || "Vendedor"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {seller?.areaAtuacao || seller?.profession || "Vendedor"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Publicado em {formatDate(product.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="w-4 h-4" />
                  <span>Entrega Digital Instantânea</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3" data-testid="payment-methods-section">
                <h4 className="font-semibold text-foreground">Formas de Pagamento</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2" data-testid="payment-method-credit-card">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Cartão de Crédito</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="payment-method-pix">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>PIX</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3" data-testid="warranty-section">
                <h4 className="font-semibold text-foreground">Garantia</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2" data-testid="warranty-refund">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>7 dias para reembolso</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="warranty-support">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Suporte do vendedor</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="warranty-lifetime">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Acesso vitalício ao produto</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reviews Section - Moved to bottom */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <MessageSquare className="w-5 h-5" />
            Avaliações ({reviews?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Add Review Form */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold text-foreground mb-3">Deixe sua avaliação</h4>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Sua nota:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 cursor-pointer transition-colors ${
                    star <= (hoverRating || reviewRating)
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-gray-300"
                  }`}
                  onClick={() => setReviewRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  data-testid={`star-${star}`}
                />
              ))}
            </div>
            <Textarea
              placeholder="Compartilhe sua experiência com este produto..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="mb-3"
              data-testid="input-review-text"
            />
            <Button
              onClick={() => submitReviewMutation.mutate()}
              disabled={!reviewRating || !reviewText.trim() || submitReviewMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
            </Button>
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0" data-testid={`review-${review.id}`}>
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-foreground">Usuário</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma avaliação ainda. Seja o primeiro a avaliar!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-4xl w-full p-0">
          <div className="relative bg-black">
            {validImages.length > 0 && (
              <>
                <img
                  src={validImages[selectedImageIndex]}
                  alt={product.title}
                  className="w-full h-auto max-h-[80vh] object-contain"
                  data-testid="modal-image"
                />
                {validImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImageIndex((prev) => 
                        prev === 0 ? validImages.length - 1 : prev - 1
                      )}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition-colors"
                      data-testid="modal-prev-image"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setSelectedImageIndex((prev) => 
                        prev === validImages.length - 1 ? 0 : prev + 1
                      )}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition-colors"
                      data-testid="modal-next-image"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                      {selectedImageIndex + 1} / {validImages.length}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
