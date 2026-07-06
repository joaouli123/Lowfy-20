import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const optionalPlugins: any[] = [];

try {
  const runtimeOverlayModule = await import("@replit/vite-plugin-runtime-error-modal");
  optionalPlugins.push(runtimeOverlayModule.default());
} catch {
  // Optional outside Replit
}

if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
  try {
    const cartographerModule = await import("@replit/vite-plugin-cartographer");
    optionalPlugins.push(cartographerModule.cartographer());
  } catch {}

  try {
    const devBannerModule = await import("@replit/vite-plugin-dev-banner");
    optionalPlugins.push(devBannerModule.devBanner());
  } catch {}
}

export default defineConfig({
  plugins: [
    react(),
    ...optionalPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // PERFORMANCE: sem sourcemaps em produção (não expõe código-fonte) e
    // remove console/debugger do bundle final.
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Separa bibliotecas pesadas/estáveis em chunks próprios para melhor cache
        // e para evitar duplicação entre chunks de rota.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "wouter", "clsx", "tailwind-merge"],
          "query-vendor": ["@tanstack/react-query"],
          "chart-vendor": ["recharts"],
          "motion-vendor": ["framer-motion"],
          "editor-vendor": ["quill"],
        },
      },
    },
  },
  esbuild: {
    // Remove console.* e debugger do build de produção
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
