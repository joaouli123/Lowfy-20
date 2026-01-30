import { Switch, Route, useLocation, useSearch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { lazy, Suspense, useEffect } from "react";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SEOProvider } from "@/contexts/SEOContext";
import { usePreloadPages } from "@/hooks/usePreloadPages";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { initMetaPixel, trackPageView } from "@/hooks/useMetaPixel";
import { initGoogleAnalytics, trackPageView as trackGAPageView, trackUserLogin as trackGAUserLogin } from "@/hooks/useGoogleAnalytics";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

// Lazy load pages for better performance
const Home = lazy(() => import("@/pages/Home"));
const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Timeline = lazy(() => import("@/pages/Timeline"));
const PLRs = lazy(() => import("@/pages/PLRs"));
const AITools = lazy(() => import("@/pages/AITools"));
const QuizInterativo = lazy(() => import("./pages/QuizInterativo"));
const Plugins = lazy(() => import("./pages/Plugins"));
const Templates = lazy(() => import("./pages/Templates"));
const Services = lazy(() => import("./pages/Services"));
const PageCloner = lazy(() => import("./pages/PageCloner"));
const PageClonerPreview = lazy(() => import("./pages/PageClonerPreview"));
const PreSellDashboard = lazy(() => import("./pages/PreSellDashboard"));
const PreSellBuilder = lazy(() => import("./pages/PreSellBuilderSimple"));
const PreSellPreview = lazy(() => import("./pages/PreSellPreview"));
const Courses = lazy(() => import("@/pages/Courses"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const MarketplaceVitrine = lazy(() => import("@/pages/marketplace/Vitrine"));
const MarketplaceMeusProdutos = lazy(() => import("@/pages/marketplace/MeusProdutos"));
const MarketplaceCompras = lazy(() => import("@/pages/marketplace/Compras"));
const MarketplaceFinanceiro = lazy(() => import("@/pages/marketplace/Financeiro"));
const MarketplaceCart = lazy(() => import("@/pages/marketplace/Cart"));
const MarketplaceOrderSuccess = lazy(() => import("@/pages/marketplace/OrderSuccess"));
const MarketplaceOrderFailure = lazy(() => import("@/pages/marketplace/OrderFailure"));
const MarketplacePolicies = lazy(() => import("@/pages/marketplace/Politicas"));
const CheckoutPix = lazy(() => import("@/pages/CheckoutPix"));
const CheckoutAwaitingConfirmation = lazy(() => import("@/pages/marketplace/CheckoutAwaitingConfirmation"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Support = lazy(() => import("@/pages/Support"));
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Forum = lazy(() => import("@/pages/Forum"));
const ForumTopic = lazy(() => import("@/pages/ForumTopic"));
const SetPassword = lazy(() => import("@/pages/SetPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const N8nAutomations = lazy(() => import("@/pages/N8nAutomations"));
const MetaAdsAndromeda = lazy(() => import("@/pages/MetaAdsAndromeda"));
const Referrals = lazy(() => import("@/pages/Referrals"));
const Subscription = lazy(() => import("@/pages/Subscription"));

// Subscription pages (separate from marketplace checkout)
const SubscriptionCheckout = lazy(() => import("@/pages/subscription/SubscriptionCheckout"));
const SubscriptionPix = lazy(() => import("@/pages/subscription/SubscriptionPix"));
const SubscriptionCheckoutSuccess = lazy(() => import("@/pages/subscription/SubscriptionCheckoutSuccess"));
const SubscriptionCheckoutAwaiting = lazy(() => import("@/pages/subscription/SubscriptionCheckoutAwaiting"));
const ActivateAccount = lazy(() => import("@/pages/subscription/ActivateAccount"));

// Legal pages
const TermsOfUse = lazy(() => import("@/pages/legal/TermsOfUse"));
const PrivacyPolicy = lazy(() => import("@/pages/legal/PrivacyPolicy"));
const PLRLicense = lazy(() => import("@/pages/legal/PLRLicense"));
const Copyright = lazy(() => import("@/pages/legal/Copyright"));

// Lazy load admin pages
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminClonagemAnalytics = lazy(() => import("@/pages/admin/AdminClonagemAnalytics"));
const AdminUsuarios = lazy(() => import("@/pages/admin/AdminUsuarios"));
const AdminConteudo = lazy(() => import("@/pages/admin/AdminConteudo"));
const AdminCursos = lazy(() => import("@/pages/admin/AdminCursos"));
const AdminMarketplace = lazy(() => import("@/pages/admin/AdminMarketplace"));
const AdminComunidade = lazy(() => import("@/pages/admin/AdminComunidade"));
const AdminServicos = lazy(() => import("@/pages/admin/AdminServicos"));
const AdminBugs = lazy(() => import("@/pages/admin/AdminBugs"));
const AdminFinanceiro = lazy(() => import("@/pages/admin/AdminFinanceiro"));
const AdminCheckoutAbandonado = lazy(() => import("@/pages/admin/AdminCheckoutAbandonado"));
const AdminAfiliados = lazy(() => import("@/pages/admin/AdminAfiliados"));
const AdminVendedores = lazy(() => import("@/pages/admin/AdminVendedores"));
const AdminSubscriptionRefunds = lazy(() => import("@/pages/admin/AdminSubscriptionRefunds"));
const AdminAIUsage = lazy(() => import("@/pages/admin/AdminAIUsage"));
const AdminWhatsApp = lazy(() => import("@/pages/admin/AdminWhatsApp"));

// Content loading component (for pages inside Layout - keeps sidebar visible)
function ContentLoader() {
  return (
    <div className="w-full h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

// Full page loading component (for auth loading and public pages)
function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="flex flex-col items-center gap-4">
        <img 
          src="/lowfy-logo-green.webp" 
          alt="Lowfy" 
          className="h-12 w-auto object-contain mb-2"
        />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

// Wrapper component that applies subscription protection based on current route
function ProtectedContent({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <ProtectedRoute currentPath={location}>
      {children}
    </ProtectedRoute>
  );
}

// Checkout router - redirects subscription checkouts to /assinatura/checkout
function CheckoutRouter() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const urlParams = new URLSearchParams(searchString);

  const cupom = urlParams.get("cupom");
  const plan = urlParams.get("plan");

  // If this is a subscription checkout with coupon or plan params, redirect
  if (cupom || plan) {
    const params = new URLSearchParams();
    if (plan) params.set("plan", plan);
    if (cupom) params.set("cupom", cupom);
    setLocation(`/assinatura/checkout?${params.toString()}`);
    return <PageLoader />;
  }

  // Otherwise show marketplace checkout
  return <Checkout />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect unauthenticated users to login when accessing protected routes
  useAuthRedirect();

  // Preload pages in background after initial load (always call hook, control internally)
  usePreloadPages(isAuthenticated);

  // Loading state - show global loading without redirecting
  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {!isAuthenticated ? (
          <>
            {/* Public routes without Layout */}
            <Route path="/" component={Home} />
            <Route path="/login" component={Landing} />
            <Route path="/reset-password" component={ResetPassword} />
            <Route path="/clonador/preview" component={PageClonerPreview} />
            <Route path="/presell/preview" component={PreSellPreview} />
            <Route path="/termos" component={TermsOfUse} />
            <Route path="/privacidade" component={PrivacyPolicy} />
            <Route path="/licenca-plr" component={PLRLicense} />
            <Route path="/direitos-autorais" component={Copyright} />
            {/* Subscription checkout pages - public, fullscreen */}
            <Route path="/assinatura/checkout" component={SubscriptionCheckout} />
            <Route path="/subscription/checkout" component={SubscriptionCheckout} />
            <Route path="/assinatura/checkout/pix/:transactionId?" component={SubscriptionPix} />
            <Route path="/subscription/checkout/pix/:transactionId?" component={SubscriptionPix} />
            <Route path="/assinatura/checkout/sucesso" component={SubscriptionCheckoutSuccess} />
            <Route path="/assinatura/checkout/aguardando" component={SubscriptionCheckoutAwaiting} />
            <Route path="/subscription/checkout-success" component={SubscriptionCheckoutSuccess} />
            <Route path="/ativar-conta">
              {() => <ActivateAccount />}
            </Route>
          </>
        ) : (
          <>
            {/* Preview routes without Layout (fullscreen) - authenticated */}
            <Route path="/clonador/preview" component={PageClonerPreview} />
            <Route path="/presell/preview" component={PreSellPreview} />

            {/* Checkout - fullscreen for high conversion */}
            <Route path="/checkout" component={CheckoutRouter} />
            <Route path="/marketplace/checkout/pix/:transactionId?" component={CheckoutPix} />
            <Route path="/marketplace/checkout/awaiting-confirmation" component={CheckoutAwaitingConfirmation} />
            <Route path="/marketplace/politicas" component={MarketplacePolicies} />

            {/* Order Success/Failure - fullscreen */}
            <Route path="/marketplace/order/success" component={MarketplaceOrderSuccess} />
            <Route path="/marketplace/order/failure" component={MarketplaceOrderFailure} />

            {/* Subscription checkout pages - fullscreen, also accessible when authenticated */}
            <Route path="/assinatura/checkout" component={SubscriptionCheckout} />
            <Route path="/subscription/checkout" component={SubscriptionCheckout} />
            <Route path="/assinatura/checkout/pix/:transactionId?" component={SubscriptionPix} />
            <Route path="/subscription/checkout/pix/:transactionId?" component={SubscriptionPix} />
            <Route path="/assinatura/checkout/sucesso" component={SubscriptionCheckoutSuccess} />
            <Route path="/assinatura/checkout/aguardando" component={SubscriptionCheckoutAwaiting} />
            <Route path="/subscription/checkout-success" component={SubscriptionCheckoutSuccess} />
            <Route path="/ativar-conta">
              {() => <ActivateAccount />}
            </Route>

            {/* All other routes with Layout */}
            <Layout>
              <ProtectedContent>
                <Route path="/" component={Timeline} />
                <Route path="/timeline" component={Timeline} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/plrs" component={PLRs} />
                <Route path="/ai-tools" component={AITools} />
                <Route path="/clonador" component={PageCloner} />
                <Route path="/presell-dashboard" component={PreSellDashboard} />
                <Route path="/presell-builder" component={PreSellBuilder} />
                <Route path="/quiz-interativo" component={QuizInterativo} />
                <Route path="/courses" component={Courses} />
                <Route path="/plugins" component={Plugins} />
                <Route path="/templates" component={Templates} />
                <Route path="/services" component={Services} />
                <Route path="/marketplace" component={Marketplace} />
                <Route path="/marketplace/vitrine" component={MarketplaceVitrine} />
                <Route path="/marketplace/meus-produtos" component={MarketplaceMeusProdutos} />
                <Route path="/marketplace/compras" component={MarketplaceCompras} />
                <Route path="/marketplace/financeiro" component={MarketplaceFinanceiro} />
                <Route path="/marketplace/cart" component={MarketplaceCart} />
                <Route path="/marketplace/produto/:id" component={ProductDetails} />
                <Route path="/notifications" component={Notifications} />
                <Route path="/support" component={Support} />
                <Route path="/forum" component={Forum} />
                <Route path="/forum/:idOrSlug" component={ForumTopic} />
                <Route path="/set-password" component={SetPassword} />
                <Route path="/admin/analytics">
                  {() => <AdminRoute><AdminAnalytics /></AdminRoute>}
                </Route>
                <Route path="/admin/clonagem-analytics">
                  {() => <AdminRoute><AdminClonagemAnalytics /></AdminRoute>}
                </Route>
                <Route path="/admin/usuarios">
                  {() => <AdminRoute><AdminUsuarios /></AdminRoute>}
                </Route>
                <Route path="/admin/conteudo">
                  {() => <AdminRoute><AdminConteudo /></AdminRoute>}
                </Route>
                <Route path="/admin/cursos">
                  {() => <AdminRoute><AdminCursos /></AdminRoute>}
                </Route>
                <Route path="/admin/marketplace">
                  {() => <AdminRoute><AdminMarketplace /></AdminRoute>}
                </Route>
                <Route path="/admin/comunidade">
                  {() => <AdminRoute><AdminComunidade /></AdminRoute>}
                </Route>
                <Route path="/admin/servicos">
                  {() => <AdminRoute><AdminServicos /></AdminRoute>}
                </Route>
                <Route path="/admin/bugs">
                  {() => <AdminRoute><AdminBugs /></AdminRoute>}
                </Route>
                <Route path="/admin/financeiro">
                  {() => <AdminRoute><AdminFinanceiro /></AdminRoute>}
                </Route>
                <Route path="/admin/checkout-abandonado">
                  {() => <AdminRoute><AdminCheckoutAbandonado /></AdminRoute>}
                </Route>
                <Route path="/admin/afiliados">
                  {() => <AdminRoute><AdminAfiliados /></AdminRoute>}
                </Route>
                <Route path="/admin/vendedores">
                  {() => <AdminRoute><AdminVendedores /></AdminRoute>}
                </Route>
                <Route path="/admin/subscription-refunds">
                  {() => <AdminRoute><AdminSubscriptionRefunds /></AdminRoute>}
                </Route>
                <Route path="/admin/ai-usage">
                  {() => <AdminRoute><AdminAIUsage /></AdminRoute>}
                </Route>
                <Route path="/admin/whatsapp">
                  {() => <AdminRoute><AdminWhatsApp /></AdminRoute>}
                </Route>
                <Route path="/profile" component={Profile} />
                <Route path="/users/:id" component={Profile} />
                <Route path="/indicacoes" component={Referrals} />
                <Route path="/assinatura" component={Subscription} />
                <Route path="/modelos-n8n" component={N8nAutomations} />
                <Route path="/meta-ads-andromeda" component={MetaAdsAndromeda} />
              </ProtectedContent>
            </Layout>
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function MetaPixelInitializer() {
  const [location] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    trackPageView();
  }, [location]);

  return null;
}

function GoogleAnalyticsInitializer() {
  const [location] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      initGoogleAnalytics(user.id);
      trackGAUserLogin(user.id);
    } else {
      initGoogleAnalytics();
    }
  }, [user?.id]);

  useEffect(() => {
    trackGAPageView(location);
  }, [location]);

  return null;
}

import { LovableCreditsPopup } from "@/components/LovableCreditsPopup";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <SidebarProvider>
            <SubscriptionProvider>
              <TooltipProvider>
                <SEOProvider>
                  <MetaPixelInitializer />
                  <GoogleAnalyticsInitializer />
                  <Toaster />
                  <Router />
                </SEOProvider>
              </TooltipProvider>
            </SubscriptionProvider>
          </SidebarProvider>
        </SocketProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;