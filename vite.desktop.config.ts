import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Отдельная сборка для Windows-приложения (Electron): обычный статический SPA,
// без серверной части и без сборочных плагинов Lovable — поэтому собирается
// и на GitHub Actions, и локально.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-desktop",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "index.desktop.html"),
    },
  },
});
