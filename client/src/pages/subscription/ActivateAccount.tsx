import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { 
  CheckCircle, Lock, Eye, EyeOff, Crown, 
  User, Mail, Phone, CreditCard, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackCompleteRegistration } from "@/hooks/useMetaPixel";
import { trackAdConversion, trackPurchase } from "@/hooks/useGoogleAnalytics";
import confetti from 'canvas-confetti';

interface ActivationData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  planName: string;
  planType: string;
  paymentMethod?: 'credit_card' | 'pix';
}

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(searchString);
  const token = urlParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [subscriptionToken, setSubscriptionToken] = useState<string | null>(null);
  const [passwordHash, setPasswordHash] = useState<string | null>(null);

  // Fetch activation data
  const { data: activationData, isLoading, error } = useQuery<ActivationData>({
    queryKey: ['/api/subscriptions/activation', token],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/activation/${token}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Token inválido ou expirado');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Activation mutation
  const activateMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiRequest("POST", "/api/subscriptions/activate", data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS enviado!",
        description: "Verifique o código enviado ao seu telefone.",
      });

      // Store subscription token and password for verification step
      setSubscriptionToken(data.subscriptionToken);
      setPasswordHash(data.passwordHash);
      
      // Show OTP modal
      setShowOTPModal(true);
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Não foi possível ativar sua conta.";
      toast({
        title: "Erro na ativação",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Verify OTP and activate account mutation
  const verifyOTPMutation = useMutation({
    mutationFn: async ({ subscriptionToken, password, code }: { subscriptionToken: string; password: string; code: string }) => {
      const response = await apiRequest("POST", "/api/subscriptions/verify-and-activate", { subscriptionToken, password, code });
      return await response.json();
    },
    onSuccess: (data) => {
      setShowOTPModal(false);
      
      // 🎉 Trigger confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      toast({
        title: "Conta ativada com sucesso!",
        description: "Bem-vindo à Lowfy! Redirecionando...",
      });

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      localStorage.setItem('show_welcome_confetti', 'true');

      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      setTimeout(() => {
        setLocation("/timeline");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Erro na verificação",
        description: error.message || "Código inválido ou expirado",
        variant: "destructive",
      });
      setOtpValue("");
    },
  });

  const handleOTPComplete = (code: string) => {
    if (subscriptionToken && password) {
      verifyOTPMutation.mutate({ subscriptionToken, password, code });
    }
  };

  // Track conversion as soon as activation data loads (payment already confirmed)
  useEffect(() => {
    if (activationData && !isLoading && !error) {
      const planType = activationData.planType as 'mensal' | 'anual' || 'mensal';
      const priceInCents = planType === 'mensal' ? 9990 : 36090;
      const transactionId = `subscription-${Date.now()}`;
      
      // Meta Pixel - Purchase
      trackCompleteRegistration({
        content_name: `Compra Lowfy ${activationData.planName || 'Plano Mensal'}`,
        status: 'completed',
        value: priceInCents / 100,
        currency: 'BRL',
      });
      
      // Google Ads Conversion Tracking (Purchase) with Transaction ID
      trackAdConversion(undefined, priceInCents / 100, 'BRL', transactionId);
      
      // Google Analytics Purchase Tracking
      trackPurchase(transactionId, priceInCents / 100, 'BRL', [
        {
          item_id: `lowfy_${planType}`,
          item_name: `Lowfy ${activationData.planName || 'Plano'}`,
          price: priceInCents / 100,
          quantity: 1,
        }
      ]);
    }
  }, [activationData, isLoading, error]);

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      toast({
        title: "Token não encontrado",
        description: "Link de ativação inválido.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [token, setLocation, toast]);

  const validatePassword = () => {
    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return false;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha deve ser igual à senha.",
        variant: "destructive",
      });
      return false;
    }
    if (!acceptedTerms) {
      toast({
        title: "Termos não aceitos",
        description: "Você precisa aceitar os termos de uso para continuar.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword()) return;
    if (!token) return;

    activateMutation.mutate({ token, password });
  };

  // Format CPF for display
  const formatCpfDisplay = (cpf: string | undefined | null) => {
    if (!cpf) return "";
    const numbers = cpf.replace(/\D/g, "");
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    }
    return cpf;
  };

  // Format phone for display
  const formatPhoneDisplay = (phone: string | undefined | null) => {
    if (!phone) return "";
    const numbers = phone.replace(/\D/g, "");
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
    if (numbers.length === 10) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }
    return phone;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Carregando dados de ativação...</p>
        </div>
      </div>
    );
  }

  if (error || !activationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Inválido</h2>
            <p className="text-gray-600 mb-6">
              {(error as Error)?.message || "Este link de ativação é inválido ou já foi utilizado."}
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-home">
              Voltar para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format payment date
  const formatPaymentDate = () => {
    const now = new Date();
    const date = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const time = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    return `${date} - ${time}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Success Header */}
        <Card className="mb-6 border border-green-200 bg-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-green-900 mb-2">
                Pagamento Aprovado!
              </h1>
              <p className="text-green-700 font-medium mb-4">
                Compra confirmada com sucesso
              </p>

              {/* Payment Details */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Plano escolhido:</span>
                  <span className="font-semibold text-gray-900">
                    {activationData.planName || `Plano ${activationData.planType}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Data e hora:</span>
                  <span className="font-semibold text-gray-900">
                    {formatPaymentDate()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Forma de pagamento:</span>
                  <span className="font-semibold text-gray-900">
                    {activationData.paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              Complete seu Cadastro
            </CardTitle>
            <CardDescription>
              Preencha os dados abaixo para finalizar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Data (Read-only) */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Seus Dados
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Nome</Label>
                    <div className="relative">
                      <Input
                        value={activationData.name}
                        readOnly
                        className="bg-gray-50 text-gray-700 pl-10"
                        data-testid="input-name-readonly"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Email</Label>
                    <div className="relative">
                      <Input
                        value={activationData.email}
                        readOnly
                        className="bg-gray-50 text-gray-700 pl-10"
                        data-testid="input-email-readonly"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">CPF</Label>
                    <div className="relative">
                      <Input
                        value={formatCpfDisplay(activationData.cpf)}
                        readOnly
                        className="bg-gray-50 text-gray-700 pl-10"
                        data-testid="input-cpf-readonly"
                      />
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Telefone</Label>
                    <div className="relative">
                      <Input
                        value={formatPhoneDisplay(activationData.phone)}
                        readOnly
                        className="bg-gray-50 text-gray-700 pl-10"
                        data-testid="input-phone-readonly"
                      />
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Crie sua Senha
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Digite a senha novamente"
                        className="pr-10"
                        data-testid="input-confirm-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        data-testid="button-toggle-confirm-password"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm text-gray-600 leading-tight cursor-pointer">
                  Li e aceito os{" "}
                  <a href="/termos" target="_blank" className="text-primary hover:underline">
                    Termos de Uso
                  </a>{" "}
                  e a{" "}
                  <a href="/privacidade" target="_blank" className="text-primary hover:underline">
                    Política de Privacidade
                  </a>
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={activateMutation.isPending}
                data-testid="button-activate"
              >
                {activateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ativando conta...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Ativar Minha Conta
                  </>
                )}
              </Button>

              {/* Security Note */}
              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                Seus dados estão protegidos
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Modal de Verificação OTP (Telefone) */}
        <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center text-2xl">
                Verifique seu telefone
              </DialogTitle>
              <DialogDescription className="text-center">
                Enviamos um código de 6 dígitos para {formatPhoneDisplay(activationData?.phone)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6 py-4">
              <InputOTP
                maxLength={6}
                value={otpValue}
                onChange={(value) => {
                  setOtpValue(value);
                  if (value.length === 6) {
                    handleOTPComplete(value);
                  }
                }}
                data-testid="input-otp-activation"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {verifyOTPMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando código...
                </div>
              )}

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  O código é válido por 10 minutos
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
