import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/react";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { SocketProvider } from "@/contexts/SocketContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Dashboard from "@/pages/Dashboard";
import "./index.css";

// Harness isolado só para revisão visual do redesign HeroUI (Sidebar/TopBar/Dashboard).
// Não depende do backend/DB — dados mockados via cache do React Query.

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
queryClient.setQueryData(["/api/admin/stats"], {
  totalPLRs: 428,
  totalUsers: 12840,
  totalServices: 39,
  monthlyRevenue: 184500,
});
queryClient.setQueryData(["/api/marketplace/cart"], [{ id: "1", quantity: 2 }]);
queryClient.setQueryData([`/api/users/${mockUser.id}/points`], { points: 740 });
queryClient.setQueryData(["/api/notifications"], []);

function PreviewShell() {
  return (
    <div className="min-h-screen flex bg-[radial-gradient(ellipse_120%_80%_at_50%_-10%,hsl(154,56%,96%),transparent)] dark:bg-none bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Dashboard />
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
          <PreviewShell />
        </SocketProvider>
      </SidebarProvider>
    </HeroUIProvider>
  </QueryClientProvider>
);
