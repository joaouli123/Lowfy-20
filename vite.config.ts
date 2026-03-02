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
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
