import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Phone, CheckCircle2, ArrowLeft, Mail, Eye, EyeOff, Smartphone, MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { loginSchema } from "@shared/schema";
import { SEO, seoConfig } from "@/components/SEO";
import { trackCompleteRegistration } from "@/hooks/useMetaPixel";
import { trackUserSignup, trackAdLead } from "@/hooks/useGoogleAnalytics";

const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  phone: z.string().min(10, "Telefone é obrigatório").refine(
    (val) => /^\d{10,11}$/.test(val.replace(/\D/g, '')),
    { message: "Telefone inválido. Use DDD + número (ex: 11999999999)" }
  ),
  cpf: z.string().min(11, "CPF é obrigatório").refine(
    (val) => val.replace(/\D/g, '').length === 11,
    { message: "CPF deve ter 11 dígitos" }
  ),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const resetPasswordDirectSchema = z.object({
  email: z.string().email("Email inválido"),
  cpf: z.string().min(11, "CPF é obrigatório").refine(
    (val) => val.replace(/\D/g, '').length === 11,
    { message: "CPF deve ter 11 dígitos" }
  ),
  newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type ResetPasswordDirectForm = z.infer<typeof resetPasswordDirectSchema>;
type AuthView = 'login' | 'register' | 'forgot' | 'forgotSuccess' | 'reset' | 'resetDirect';

export default function Landing() {
  const [, navigate] = useLocation();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pending2FAUserId, setPending2FAUserId] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resend2FACooldown, setResend2FACooldown] = useState(0);
  const [checkoutDataLoaded, setCheckoutDataLoaded] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [lockedFields, setLockedFields] = useState<{
    name: boolean;
    email: boolean;
    phone: boolean;
    cpf: boolean;
  }>({ name: false, email: false, phone: false, cpf: false });
  const [showActivationForm, setShowActivationForm] = useState(false);
  const [activationEmail, setActivationEmail] = useState("");
  const [activationCpf, setActivationCpf] = useState("");
  const [showActivationPassword, setShowActivationPassword] = useState(false);
  const [showActivationConfirmPassword, setShowActivationConfirmPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Declarar os forms ANTES dos useEffects
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      name: "",
      phone: "",
      cpf: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordDirectForm = useForm<ResetPasswordDirectForm>({
    resolver: zodResolver(resetPasswordDirectSchema),
    defaultValues: {
      email: "",
      cpf: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Detect token and tab in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setResetToken(tokenParam);
      setAuthView('reset');
      return;
    }
    
    // Check for tab parameter to open register directly
    const tabParam = params.get('tab');
    const cadastroParam = params.get('cadastro');
    const registerParam = params.get('register');
    
    if (tabParam === 'register' || tabParam === 'cadastro' || cadastroParam !== null || registerParam !== null) {
      setActiveTab('register');
      setAuthView('register');
    }
  }, []);

  // Detect checkout data in URL (post-purchase redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Helper function to check if value is a valid data (not a template literal)
    const isValidValue = (value: string | null): boolean => {
      if (!value) return false;
      if (value.includes('{{') || value.includes('}}')) return false;
      if (value.trim() === '') return false;
      return true;
    };

    // Format CPF with mask (XXX.XXX.XXX-XX)
    const formatCPF = (cpf: string) => {
      const numbers = cpf.replace(/\D/g, '').slice(0, 11);
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    };

    // Format phone with mask ((XX) XXXXX-XXXX)
    const formatPhone = (phoneNum: string) => {
      const numbers = phoneNum.replace(/\D/g, '').slice(0, 11);
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    };

    // Function to fill form with customer data
    const fillFormWithData = (customerName: string, customerEmail: string, customerPhone?: string, customerCpf?: string) => {
      if (customerEmail) {
        // Verificar se usuário existe (vindo de compra)
        fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerEmail })
        })
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            // Email existe = vindo de compra com pending_activation
            // Mostrar form de ATIVAÇÃO, não registro
            setActivationEmail(customerEmail);
            if (customerCpf) {
              setActivationCpf(formatCPF(customerCpf));
            }
            setShowActivationForm(true);
            setAuthView('login'); // Mantém na tela de login mas mostra form de ativação
            toast({
              title: "Compra aprovada! 🎉",
              description: "Complete a ativação da sua conta definindo uma senha.",
            });
          } else {
            // Email não existe = novo registro
            const fieldsToLock = { name: false, email: false, phone: false, cpf: false };
            if (customerName) {
              registerForm.setValue("name", customerName);
              fieldsToLock.name = true;
            }
            registerForm.setValue("email", customerEmail);
            fieldsToLock.email = true;
            if (customerPhone) {
              registerForm.setValue("phone", formatPhone(customerPhone));
              fieldsToLock.phone = true;
            }
            if (customerCpf) {
              registerForm.setValue("cpf", formatCPF(customerCpf));
              fieldsToLock.cpf = true;
            }
            setLockedFields(fieldsToLock);
            setActiveTab("register");
            setAuthView("register");
            toast({
              title: "Dados da compra preenchidos!",
              description: "Complete o cadastro para acessar a plataforma.",
            });
          }
        })
        .catch(() => {});
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    };

    // Try URL parameters with PII
    const name = params.get('name') || params.get('customer_name');
    const email = params.get('email') || params.get('customer_email');
    const phone = params.get('phone') || params.get('customer_phone');
    const doc = params.get('doc') || params.get('customer_doc') || params.get('cpf');

    // Only process if we have at least one valid value (not a template literal)
    const hasValidData = isValidValue(name) || isValidValue(email) || isValidValue(phone) || isValidValue(doc);

    if (hasValidData && !checkoutDataLoaded) {
      setCheckoutDataLoaded(true);
      setActiveTab("register");
      setAuthView("register");

      setTimeout(() => {
        fillFormWithData(
          isValidValue(name) ? decodeURIComponent(name!) : '',
          isValidValue(email) ? decodeURIComponent(email!) : '',
          isValidValue(phone) ? decodeURIComponent(phone!) : undefined,
          isValidValue(doc) ? decodeURIComponent(doc!) : undefined
        );
      }, 100);
    }
  }, [checkoutDataLoaded, registerForm, loginForm, toast]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Cooldown timer for 2FA resend
  useEffect(() => {
    if (resend2FACooldown > 0) {
      const timer = setTimeout(() => setResend2FACooldown(resend2FACooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resend2FACooldown]);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Login bem-sucedido - sessionId é a auth_token
        if (data.sessionId) {
          localStorage.setItem('auth_token', data.sessionId);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta.",
        });
        
        // Redirecionar imediatamente para Timeline
        window.location.href = '/timeline';
      } else if (data.requiresVerification) {
        // Fallback para 2FA se ainda existir
        setPending2FAUserId(data.userId);
        setShow2FAModal(true);
        toast({
          title: "Código enviado!",
          description: data.message || "Verifique seu email",
        });
      } else if (data.token) {
        // Fallback para token antigo
        localStorage.setItem('auth_token', data.token);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta.",
        });
        
        window.location.href = '/timeline';
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Email ou senha inválidos",
        variant: "destructive",
      });
    },
  });

  const verify2FAMutation = useMutation({
    mutationFn: async ({ userId, code }: { userId: string; code: string }) => {
      const response = await apiRequest("POST", "/api/auth/verify-2fa", { userId, code });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      setShow2FAModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta.",
      });
      
      window.location.href = '/timeline';
    },
    onError: (error: any) => {
      toast({
        title: "Código inválido",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
      setTwoFACode("");
    },
  });

  // Mutation para reenviar código 2FA por email
  const resend2FAEmailMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("POST", "/api/auth/resend-2fa", { userId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Código reenviado!",
        description: "Verifique seu email",
      });
      setResend2FACooldown(60);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reenviar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  // Mutation para enviar código 2FA por WhatsApp (alternativa)
  const send2FAWhatsAppMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("POST", "/api/auth/send-2fa-whatsapp", { userId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Código enviado por WhatsApp!",
        description: data.message || "Verifique seu WhatsApp",
      });
      setResend2FACooldown(60);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar WhatsApp",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: async (data, variables) => {
      if (pendingUserId === data.user.id) {
        return;
      }
      
      // Rastrear criação de conta gratuita no Meta Pixel
      trackCompleteRegistration({
        content_name: "Conta Gratuita",
        status: "completed",
      });
      
      // Rastrear criação de conta no Google Analytics
      trackUserSignup();
      
      // Rastrear lead no Google Ads
      trackAdLead();
      
      setPendingUserId(data.user.id);
      setPendingPhone(variables.phone);
      
      // Enviar SMS apenas uma vez
      if (!sendOTPMutation.isPending) {
        try {
          await sendOTPMutation.mutateAsync({
            userId: data.user.id,
            phone: variables.phone,
          });
          setShowOTPModal(true);
        } catch (error) {
        }
      }
    },
    onError: (error: any, variables) => {
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Não foi possível criar sua conta",
        variant: "destructive",
      });
    },
  });

  // Mutation para ativar conta após compra (sem SMS)
  const activatePurchasedAccountMutation = useMutation({
    mutationFn: async (data: { email: string; cpf: string; password: string; confirmPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/activate-account", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.sessionId) {
        localStorage.setItem('auth_token', data.sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Conta ativada!",
        description: "Bem-vindo à Lowfy! 🎉",
      });
      window.location.href = '/timeline';
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar conta",
        description: error.message || "Verifique seus dados",
        variant: "destructive",
      });
    },
  });

  const sendOTPMutation = useMutation({
    mutationFn: async ({ userId, phone }: { userId: string; phone: string }) => {
      const response = await apiRequest("POST", "/api/auth/phone/send", { userId, phone });
      return response.json();
    },
    onSuccess: (data) => {
      setResendCooldown(60);
      toast({
        title: "Código enviado!",
        description: `SMS enviado para ${pendingPhone}`,
      });
    },
    onError: (error: any) => {
      const errorMsg = error.message || "Erro ao enviar código";
      if (errorMsg.includes("Aguarde")) {
        const match = errorMsg.match(/(\d+) segundos/);
        if (match) {
          setResendCooldown(parseInt(match[1]));
        }
      }
      toast({
        title: "Erro ao enviar SMS",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const resendOTPForUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const response = await apiRequest("POST", "/api/auth/phone/resend-for-user", { userId });
      return response.json();
    },
    onSuccess: (data) => {
      setResendCooldown(60);
      setShowOTPModal(true);
      toast({
        title: "Código reenviado!",
        description: "Verifique seu telefone e insira o código.",
      });
    },
    onError: (error: any) => {
      const errorMsg = error.message || "Erro ao reenviar código";
      if (errorMsg.includes("Aguarde")) {
        const match = errorMsg.match(/(\d+) segundos/);
        if (match) {
          setResendCooldown(parseInt(match[1]));
        }
      }
      toast({
        title: "Erro ao reenviar SMS",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const verifyOTPMutation = useMutation({
    mutationFn: async ({ userId, code }: { userId: string; code: string }) => {
      const response = await apiRequest("POST", "/api/auth/phone/verify", { userId, code });
      return response.json();
    },
    onSuccess: (data) => {
      // Salvar token no localStorage
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
      // Marcar que é o primeiro acesso
      localStorage.setItem('show_welcome_confetti', 'true');
      
      setShowOTPModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Telefone verificado!",
        description: "Sua conta foi ativada com sucesso.",
      });
      
      window.location.href = '/timeline';
    },
    onError: (error: any) => {
      toast({
        title: "Código inválido",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
      setOtpValue("");
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const handleOTPComplete = (value: string) => {
    if (value.length === 6 && pendingUserId) {
      verifyOTPMutation.mutate({ userId: pendingUserId, code: value });
    }
  };

  const handle2FAComplete = (value: string) => {
    if (value.length === 6 && pending2FAUserId) {
      verify2FAMutation.mutate({ userId: pending2FAUserId, code: value });
    }
  };

  const handleResendCode = () => {
    if (pendingUserId && pendingPhone && resendCooldown === 0) {
      sendOTPMutation.mutate({ userId: pendingUserId, phone: pendingPhone });
    }
  };

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Email enviado!",
        description: data.message || "Verifique seu email para redefinir sua senha.",
      });
      setAuthView('forgotSuccess');
      forgotPasswordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      if (!resetToken) throw new Error("Token inválido");
      const response = await apiRequest("POST", "/api/auth/reset-password", { 
        token: resetToken, 
        newPassword: data.password 
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Senha redefinida!",
        description: data.message || "Sua senha foi alterada com sucesso. Faça login com sua nova senha.",
      });
      setAuthView('login');
      setResetToken(null);
      resetPasswordForm.reset();
      // Clear URL token
      window.history.replaceState({}, document.title, "/login");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Token inválido ou expirado",
        variant: "destructive",
      });
    },
  });

  const onForgotPasswordSubmit = (data: ForgotPasswordForm) => {
    forgotPasswordMutation.mutate(data);
  };

  const onResetPasswordSubmit = (data: ResetPasswordForm) => {
    resetPasswordMutation.mutate(data);
  };

  const resetPasswordDirectMutation = useMutation({
    mutationFn: async (data: ResetPasswordDirectForm) => {
      const response = await apiRequest("POST", "/api/auth/reset-password-direct", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.sessionId) {
        localStorage.setItem('auth_token', data.sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Senha redefinida!",
        description: "Você foi automaticamente conectado.",
      });
      resetPasswordDirectForm.reset();
      window.location.href = '/timeline';
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message || "Email ou CPF incorreto",
        variant: "destructive",
      });
    },
  });

  const onResetPasswordDirectSubmit = (data: ResetPasswordDirectForm) => {
    resetPasswordDirectMutation.mutate(data);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      <SEO 
        title={seoConfig.login.title}
        description={seoConfig.login.description}
        canonicalUrl={seoConfig.login.canonical}
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img 
              src="/lowfy-logo-green.webp" 
              alt="Lowfy - Plataforma de Marketing Digital Premium" 
              className="h-16 w-auto object-contain"
              loading="eager"
              decoding="async"
              width="200"
              height="64"
              data-testid="img-lowfy-logo"
            />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-3" itemProp="headline">
            {authView === 'forgot' && "Recupere o Acesso à Sua Conta"}
            {authView === 'reset' && "Redefina Sua Senha Seguramente"}
            {authView === 'login' && "Acesse a Plataforma Premium Lowfy"}
            {authView === 'register' && "Comece Seu Negócio Digital Hoje"}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {authView === 'forgot' && "Insira seu email e CPF para recuperar o acesso seguramente"}
            {authView === 'reset' && "Crie uma senha forte para proteger sua conta"}
            {authView === 'login' && "Faça login com suas credenciais para acessar as 39 ferramentas premium"}
            {authView === 'register' && "Cadastre-se agora e economize R$ 7.000+ por mês com todas as ferramentas inclusas"}
          </p>
        </div>

        <Card className="p-8 shadow-lg border-border bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
          {/* Login/Register Tabs */}
          {(authView === 'login' || authView === 'register') && (
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as "login" | "register");
              setAuthView(v as "login" | "register");
            }}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">
                  Cadastrar
                </TabsTrigger>
              </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Email"
                      data-testid="input-login-email"
                      className="pl-10"
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="email"
                      {...loginForm.register("email")}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive" data-testid="error-login-email">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <svg 
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="none"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none"/>
                    </svg>
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      data-testid="input-login-password"
                      className="pl-10 pr-10"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                      data-testid="toggle-login-password"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive" data-testid="error-login-password">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login-submit"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setAuthView('forgot')}
                    className="text-sm text-primary hover:underline"
                    data-testid="button-forgot-password"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                {/* Ativação de conta após compra */}
                {showActivationForm && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h3 className="text-lg font-semibold mb-4">Ativar Conta da Compra</h3>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const password = (e.target as any).password?.value;
                      const confirmPassword = (e.target as any).confirmPassword?.value;
                      if (password && confirmPassword) {
                        activatePurchasedAccountMutation.mutate({
                          email: activationEmail,
                          cpf: activationCpf.replace(/\D/g, ''),
                          password,
                          confirmPassword
                        });
                      }
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="activation-email">Email (da compra)</Label>
                        <Input
                          id="activation-email"
                          type="email"
                          value={activationEmail}
                          disabled
                          className="bg-gray-100 dark:bg-gray-800"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="activation-cpf">CPF (da compra)</Label>
                        <Input
                          id="activation-cpf"
                          type="text"
                          value={activationCpf}
                          disabled
                          className="bg-gray-100 dark:bg-gray-800"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="activation-password">Defina uma senha</Label>
                        <div className="relative">
                          <Input
                            id="activation-password"
                            name="password"
                            type={showActivationPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pr-10"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowActivationPassword(!showActivationPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showActivationPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="activation-confirm-password">Confirmar senha</Label>
                        <div className="relative">
                          <Input
                            id="activation-confirm-password"
                            name="confirmPassword"
                            type={showActivationConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="pr-10"
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowActivationConfirmPassword(!showActivationConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showActivationConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={activatePurchasedAccountMutation.isPending}
                      >
                        {activatePurchasedAccountMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Ativando...
                          </>
                        ) : (
                          "Ativar Conta"
                        )}
                      </Button>
                    </form>
                  </div>
                )}
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome completo</Label>
                  <div className="relative">
                    <svg 
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" fill="none"/>
                      <circle cx="12" cy="7" r="4" fill="none"/>
                    </svg>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome"
                      data-testid="input-register-name"
                      className={`pl-10 ${lockedFields.name ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}`}
                      disabled={lockedFields.name}
                      readOnly={lockedFields.name}
                      {...registerForm.register("name")}
                    />
                  </div>
                  {registerForm.formState.errors.name && (
                    <p className="text-sm text-destructive" data-testid="error-register-name">
                      {registerForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      data-testid="input-register-email"
                      className={`pl-10 ${lockedFields.email ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}`}
                      disabled={lockedFields.email}
                      readOnly={lockedFields.email}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="email"
                      {...registerForm.register("email")}
                    />
                  </div>
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-destructive" data-testid="error-register-email">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      data-testid="input-register-phone"
                      className={`pl-10 ${lockedFields.phone ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}`}
                      disabled={lockedFields.phone}
                      readOnly={lockedFields.phone}
                      value={(() => {
                        const phoneValue = registerForm.watch("phone") || "";
                        const numbers = phoneValue.replace(/\D/g, "");
                        if (numbers.length <= 10) {
                          return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3").replace(/\($/, '');
                        }
                        return numbers.slice(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                      })()}
                      onChange={(e) => {
                        if (lockedFields.phone) return;
                        const onlyNumbers = e.target.value.replace(/\D/g, "");
                        registerForm.setValue("phone", onlyNumbers.slice(0, 11));
                      }}
                      maxLength={15}
                    />
                  </div>
                  {registerForm.formState.errors.phone && (
                    <p className="text-sm text-destructive" data-testid="error-register-phone">
                      {registerForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-cpf">CPF</Label>
                  <div className="relative">
                    <svg 
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" fill="none"/>
                      <circle cx="12" cy="12" r="3" fill="none"/>
                    </svg>
                    <Input
                      id="register-cpf"
                      type="text"
                      placeholder="000.000.000-00"
                      data-testid="input-register-cpf"
                      className={`pl-10 ${lockedFields.cpf ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}`}
                      disabled={lockedFields.cpf}
                      readOnly={lockedFields.cpf}
                      value={(() => {
                        const cpfValue = registerForm.watch("cpf") || "";
                        const numbers = cpfValue.replace(/\D/g, "");
                        if (numbers.length <= 11) {
                          return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/-$/, '');
                        }
                        return numbers.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                      })()}
                      onChange={(e) => {
                        if (lockedFields.cpf) return;
                        const onlyNumbers = e.target.value.replace(/\D/g, "");
                        registerForm.setValue("cpf", onlyNumbers.slice(0, 11));
                      }}
                      maxLength={14}
                    />
                  </div>
                  {registerForm.formState.errors.cpf && (
                    <p className="text-sm text-destructive" data-testid="error-register-cpf">
                      {registerForm.formState.errors.cpf.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <div className="relative">
                    <svg 
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="none"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none"/>
                    </svg>
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      data-testid="input-register-password"
                      className="pl-10 pr-10"
                      {...registerForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                      data-testid="toggle-register-password"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-destructive" data-testid="error-register-password">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Repetir Senha</Label>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                    <Input
                      id="register-confirm-password"
                      type={showRegisterConfirmPassword ? "text" : "password"}
                      placeholder="Confirme sua senha"
                      data-testid="input-register-confirm-password"
                      className="pl-10 pr-10"
                      {...registerForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                      data-testid="toggle-register-confirm-password"
                    >
                      {showRegisterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive" data-testid="error-register-confirm-password">
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register-submit"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}

          {/* Forgot Password Form - Direct Recovery (no email) */}
          {authView === 'forgot' && (
            <form onSubmit={resetPasswordDirectForm.handleSubmit(onResetPasswordDirectSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    data-testid="input-forgot-email"
                    className="pl-10"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    {...resetPasswordDirectForm.register("email")}
                  />
                </div>
                {resetPasswordDirectForm.formState.errors.email && (
                  <p className="text-sm text-destructive" data-testid="error-forgot-email">
                    {resetPasswordDirectForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-cpf">CPF</Label>
                <div className="relative">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" fill="none"/>
                    <circle cx="12" cy="12" r="3" fill="none"/>
                  </svg>
                  <Input
                    id="forgot-cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    data-testid="input-forgot-cpf"
                    className="pl-10"
                    value={(() => {
                      const cpfValue = resetPasswordDirectForm.watch("cpf") || "";
                      const numbers = cpfValue.replace(/\D/g, "");
                      if (numbers.length <= 11) {
                        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").replace(/-$/, '');
                      }
                      return numbers.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    })()}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value.replace(/\D/g, "");
                      resetPasswordDirectForm.setValue("cpf", onlyNumbers.slice(0, 11));
                    }}
                    maxLength={14}
                  />
                </div>
                {resetPasswordDirectForm.formState.errors.cpf && (
                  <p className="text-sm text-destructive" data-testid="error-forgot-cpf">
                    {resetPasswordDirectForm.formState.errors.cpf.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-password">Nova Senha</Label>
                <div className="relative">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="none"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none"/>
                  </svg>
                  <Input
                    id="forgot-password"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="••••••••"
                    data-testid="input-forgot-password"
                    className="pl-10 pr-10"
                    {...resetPasswordDirectForm.register("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                    data-testid="toggle-forgot-password"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetPasswordDirectForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive" data-testid="error-forgot-password">
                    {resetPasswordDirectForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-confirm-password">Confirmar Senha</Label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <Input
                    id="forgot-confirm-password"
                    type={showResetConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    data-testid="input-forgot-confirm-password"
                    className="pl-10 pr-10"
                    {...resetPasswordDirectForm.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                    data-testid="toggle-forgot-confirm-password"
                  >
                    {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetPasswordDirectForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive" data-testid="error-forgot-confirm-password">
                    {resetPasswordDirectForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordDirectMutation.isPending}
                data-testid="button-reset-password-direct"
              >
                {resetPasswordDirectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setAuthView('login')}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Form */}
          {authView === 'reset' && (
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">Nova Senha</Label>
                <div className="relative">
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" fill="none"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none"/>
                  </svg>
                  <Input
                    id="reset-password"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="••••••••"
                    data-testid="input-reset-password"
                    className="pl-10 pr-10"
                    {...resetPasswordForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                    data-testid="toggle-reset-password"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetPasswordForm.formState.errors.password && (
                  <p className="text-sm text-destructive" data-testid="error-reset-password">
                    {resetPasswordForm.formState.errors.password.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Mínimo de 6 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirmar Senha</Label>
                <div className="relative">
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <Input
                    id="reset-confirm-password"
                    type={showResetConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    data-testid="input-reset-confirm-password"
                    className="pl-10 pr-10"
                    {...resetPasswordForm.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
                    data-testid="toggle-reset-confirm-password"
                  >
                    {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive" data-testid="error-reset-confirm-password">
                    {resetPasswordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir Senha"
                )}
              </Button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthView('login');
                    setResetToken(null);
                    window.history.replaceState({}, document.title, "/login");
                  }}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="button-back-to-login-reset"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao login
                </button>
              </div>
            </form>
          )}
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
                Enviamos um código de 6 dígitos para
                <br />
                <strong className="text-foreground">{pendingPhone}</strong>
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
                data-testid="input-otp"
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
                  Não recebeu o código?
                </p>
                <Button
                  variant="link"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || sendOTPMutation.isPending}
                  data-testid="button-resend-otp"
                  className="text-primary"
                >
                  {sendOTPMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Reenviar em ${resendCooldown}s`
                  ) : (
                    "Reenviar código"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Verificação 2FA (Email) */}
        <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center text-2xl">
                Verificação de Segurança
              </DialogTitle>
              <DialogDescription className="text-center">
                Por segurança, enviamos um código de 6 dígitos para seu email
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6 py-4">
              <InputOTP
                maxLength={6}
                value={twoFACode}
                onChange={(value) => {
                  setTwoFACode(value);
                  if (value.length === 6) {
                    handle2FAComplete(value);
                  }
                }}
                data-testid="input-2fa-code"
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

              {verify2FAMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando código...
                </div>
              )}

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Não recebeu o código?
                </p>
                
                <div className="flex flex-col gap-2">
                  <Button
                    variant="link"
                    onClick={() => pending2FAUserId && resend2FAEmailMutation.mutate({ userId: pending2FAUserId })}
                    disabled={resend2FACooldown > 0 || resend2FAEmailMutation.isPending || !pending2FAUserId}
                    className="text-primary"
                    data-testid="button-resend-2fa-email"
                  >
                    {resend2FAEmailMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : resend2FACooldown > 0 ? (
                      `Reenviar em ${resend2FACooldown}s`
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Reenviar por email
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pending2FAUserId && send2FAWhatsAppMutation.mutate({ userId: pending2FAUserId })}
                    disabled={resend2FACooldown > 0 || send2FAWhatsAppMutation.isPending || !pending2FAUserId}
                    className="text-muted-foreground"
                    data-testid="button-send-2fa-whatsapp"
                  >
                    {send2FAWhatsAppMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : resend2FACooldown > 0 ? (
                      `Aguarde ${resend2FACooldown}s`
                    ) : (
                      <>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Tentar por WhatsApp
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  O código é válido por 10 minutos
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* SEO Navigation - Hidden but crawlable by Google */}
        <nav className="hidden" aria-hidden="true">
          <ul>
            <li><a href="/ai-tools" title="39 Ferramentas de IA Inclusas - Cancele Canva, Semrush e ChatGPT. Tudo liberado em um só lugar.">39 Ferramentas Inclusas</a></li>
            <li><a href="/clonador" title="Clonador de Páginas - Copie qualquer página de vendas em segundos. Limpeza automática de pixel.">Clonador de Páginas</a></li>
            <li><a href="/assinatura/checkout" title="Planos e Preços - Economize mais de R$ 7.000/mês. Acesso imediato a partir de R$ 99.">Planos e Preços</a></li>
            <li><a href="/plrs" title="Biblioteca de PLR - Produtos prontos em 7 idiomas. Baixe, edite e venda em Dólar hoje mesmo.">Biblioteca de PLR</a></li>
            <li><a href="/auth" title="Área de Membros - Já é assinante? Acesse seu painel e ferramentas aqui.">Área de Membros</a></li>
            <li><a href="/courses" title="Cursos Online - Mais de 380 cursos de marketing digital, afiliados, IA e muito mais.">Cursos Online</a></li>
          </ul>
        </nav>

      </div>
    </div>
  );
}
