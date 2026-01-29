import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Eye,
  DollarSign,
  Calendar,
  Package,
  CreditCard,
  ExternalLink,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  Banknote,
  LayoutGrid,
  List
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatDate = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const formatDateTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

const getPaymentMethodLabel = (method: string | null | undefined) => {
  const paymentMethods: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão de Crédito",
    boleto: "Boleto",
    picpay: "PicPay",
  };
  return method ? (paymentMethods[method] || method) : "Não informado";
};

export default function Compras() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");


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
      setRefundDialogOpen(false);
      setRefundReason("");
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
      paymentMethod: order.paymentMethod,
      canRefund: canRefund(order.order.createdAt),
    });
    setIsSheetOpen(true);
  };

  const handleRefund = () => {
    setRefundReason("");
    setRefundDialogOpen(true);
  };

  const submitRefund = () => {
    if (refundReason.trim().length < 180) {
      toast({
        title: "Justificativa incompleta",
        description: "Por favor, descreva o motivo do reembolso com no mínimo 180 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (selectedOrder) {
      refundMutation.mutate({
        orderId: selectedOrder.id,
        reason: refundReason,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Minhas Compras</h1>
            <p className="text-gray-600">Acompanhe seus pedidos e produtos adquiridos</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="gap-2"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </Button>
          </div>
        </div>

        {!purchases || purchases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma compra encontrada</h3>
              <p className="text-gray-600 mb-6">Você ainda não realizou nenhuma compra.</p>
              <Link href="/marketplace">
                <Button>Explorar Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {purchases.map((purchase: any) => {
              const product = purchase.product;
              const order = purchase.order;
              const statusConfig = getStatusBadge(order.status);

              return (
                <Card key={order.id} data-testid={`card-purchase-${order.id}`} className="overflow-hidden hover:shadow-lg transition-shadow">
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
                      <Badge variant={statusConfig.variant} className="absolute top-3 right-3">
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Link 
                      href={`/marketplace/produto/${product?.slug || product?.id}`}
                      className="font-semibold text-lg mb-2 line-clamp-1 hover:text-primary hover:underline transition-colors cursor-pointer block"
                    >
                      {product?.title || "Produto"}
                    </Link>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[120px]">Data</TableHead>
                      <TableHead className="min-w-[200px]">Produto</TableHead>
                      <TableHead className="min-w-[120px]">Valor</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">Vendedor</TableHead>
                      <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase: any) => {
                      const product = purchase.product;
                      const order = purchase.order;
                      const statusConfig = getStatusBadge(order.status);

                      return (
                        <TableRow key={order.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {format(new Date(order.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                                {product.images && product.images.length > 0 ? (
                                  <img
                                    src={product.images[0]}
                                    alt={product.title}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <Link 
                                  href={`/marketplace/produto/${product.slug || product.id}`}
                                  className="font-medium line-clamp-1 hover:text-primary hover:underline transition-colors cursor-pointer"
                                >
                                  {product.title}
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(order.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm line-clamp-1">
                                {purchase.seller?.name || 'Vendedor'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => handleViewDetails(purchase)}
                              >
                                <Eye className="w-4 h-4" />
                                <span className="hidden xl:inline">Ver</span>
                              </Button>
                              {product.productUrl && order.status === "completed" && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => window.open(product.productUrl, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span className="hidden xl:inline">Acessar</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="overflow-y-auto">
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
                        data-testid="img-product"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <Link
                        href={`/marketplace/produto/${selectedOrder.product?.slug || selectedOrder.productId}`}
                        className="font-semibold hover:text-primary hover:underline transition-colors cursor-pointer block"
                        data-testid="link-product-title"
                      >
                        {selectedOrder.product?.title}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1" data-testid="text-product-description">
                        {selectedOrder.product?.description}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedOrder.seller && (
                  <div>
                    <h3 className="font-semibold mb-3">Vendedor</h3>
                    <div className="flex gap-3 items-center">
                      {selectedOrder.seller.profileImageUrl ? (
                        <img
                          src={selectedOrder.seller.profileImageUrl}
                          alt={selectedOrder.seller.name}
                          className="w-12 h-12 rounded-full object-cover"
                          data-testid="img-seller-avatar"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold" data-testid="text-seller-name">{selectedOrder.seller.name}</p>
                        <p className="text-sm text-gray-600">Vendedor</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-3">Informações do Pedido</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Pago:</span>
                      <span className="font-semibold" data-testid="text-order-amount">
                        {formatCurrency(selectedOrder.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data da Compra:</span>
                      <span data-testid="text-order-date">{formatDateTime(selectedOrder.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Forma de Pagamento:</span>
                      <span className="font-medium flex items-center gap-1" data-testid="text-payment-method">
                        <Banknote className="w-4 h-4" />
                        {getPaymentMethodLabel(selectedOrder.paymentMethod)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant={getStatusBadge(selectedOrder.status).variant} data-testid="badge-order-status">
                        {getStatusBadge(selectedOrder.status).label}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  {selectedOrder.product?.productUrl && selectedOrder.status === "completed" && (
                    <Button
                      className="w-full"
                      onClick={() => window.open(selectedOrder.product.productUrl, "_blank")}
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
                      Reembolso concluído.
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent className="sm:max-w-[600px]" data-testid="dialog-refund">
            <DialogHeader>
              <DialogTitle>Solicitar Reembolso</DialogTitle>
              <DialogDescription>
                Por favor, descreva detalhadamente o motivo do reembolso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="refund-reason" className="text-sm font-medium">
                  Motivo do Reembolso *
                </label>
                <Textarea
                  id="refund-reason"
                  data-testid="textarea-refund-reason"
                  placeholder="Descreva detalhadamente por que você está solicitando o reembolso. Inclua informações relevantes sobre o produto, problemas encontrados, ou qualquer outro motivo que justifique sua solicitação..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="min-h-[150px] resize-none"
                  disabled={refundMutation.isPending}
                />
                <div className="text-sm text-right text-muted-foreground">
                  {refundReason.length}/180 caracteres
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRefundDialogOpen(false)}
                disabled={refundMutation.isPending}
                data-testid="button-cancel-refund"
              >
                Cancelar
              </Button>
              <Button
                onClick={submitRefund}
                disabled={refundMutation.isPending || refundReason.trim().length < 180}
                data-testid="button-submit-refund"
              >
                {refundMutation.isPending ? "Enviando..." : "Solicitar Reembolso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}