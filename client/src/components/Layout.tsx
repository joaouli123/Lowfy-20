import { ReactNode, Suspense, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BugReportButton from "./BugReportButton";

interface LayoutProps {
  children: ReactNode;
}

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

export default function Layout({ children }: LayoutProps) {
  // O app logado é sempre tema claro; a landing (Home) pode ter deixado a classe
  // "dark" no <html> via localStorage, então removemos ao entrar no app.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <div className="min-h-screen flex bg-background" data-testid="layout-container">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Suspense fallback={<ContentLoader />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
      <BugReportButton />
    </div>
  );
}
