import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/react";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AIStudio from "@/pages/AIStudio";
import { Router, Route, Switch, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import "./index.css";

// Harness isolado só para revisão visual do Estúdio IA, sem backend/DB.
// Abrir em /studio.html com o Vite puro rodando (npx vite --port 5174).
// Os botões de gerar não chamam a IA de verdade — é só a casca da interface.

const mockUser = {
  id: "preview-user-1",
  email: "ana.silva@lowfy.com.br",
  passwordHash: "",
  name: "Ana Silva",
  phone: null,
  cpf: null,
  phoneVerified: true,
  phoneVerifiedAt: null,
  profileImageUrl: null,
  profession: "Empreendedora Digital",
  areaAtuacao: null,
  location: null,
  bio: null,
  website: null,
  isAdmin: true,
  testingAsNonAdmin: false,
  accountStatus: "active",
  subscriptionStatus: "active",
  subscriptionExpiresAt: null,
  accessPlan: "full",
  caktoCustomerId: null,
  createdAt: new Date(2025, 0, 1).toISOString(),
  updatedAt: new Date(2025, 0, 1).toISOString(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async () => null,
      retry: false,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

queryClient.setQueryData(["/api/auth/user"], mockUser);
queryClient.setQueryData(["/api/marketplace/cart"], []);
queryClient.setQueryData([`/api/users/${mockUser.id}/points`], { points: 740 });
queryClient.setQueryData(["/api/notifications"], []);

// Motores: mostra o badge como ficaria com as chaves premium ligadas.
queryClient.setQueryData(["/api/ai-studio/capabilities"], {
  image: { ready: true, premium: true },
  copy: { ready: true, premium: true },
  tts: { ready: true, premium: true },
  voiceClone: { ready: true, premium: true },
  avatar: { ready: true, premium: false },
  video: { ready: true, premium: false },
});
queryClient.setQueryData(["/api/ai-studio/voices"], { voices: [] });

function StudioPreviewShell() {
  return (
    <div className="min-h-screen flex bg-background">
      <Router hook={useHashLocation}><Sidebar /></Router>
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Router hook={useHashLocation}>
              <Switch>
                <Route path="/ai-studio/:tool" component={AIStudio} />
                <Route><Redirect to="/ai-studio/criativo" /></Route>
              </Switch>
            </Router>
          </div>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <HeroUIProvider>
      <SidebarProvider>
        <SocketProvider>
          <StudioPreviewShell />
          <Toaster />
        </SocketProvider>
      </SidebarProvider>
    </HeroUIProvider>
  </QueryClientProvider>
);
