import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function spaBypass(req) {
  if (req.headers["accept"]?.includes("text/html")) {
    return "/index.html";
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ── Build optimisations ───────────────────────────────────────────────────
  build: {
    // Use esbuild (default) — fastest minifier
    target: "esnext",
    // Split vendor bundles so the app shell is tiny
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-query";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/axios")) {
            return "vendor-axios";
          }
        },
      },
    },
    // Raise chunk size warning threshold (we're splitting manually)
    chunkSizeWarningLimit: 600,
  },

  server: {
    port: 5173,
    proxy: {
      "/auth/me":     { target: "http://localhost:8000", changeOrigin: true },
      "/auth/login":  { target: "http://localhost:8000", changeOrigin: true },
      "/auth/signup": { target: "http://localhost:8000", changeOrigin: true },
      "/auth/google": { target: "http://localhost:8000", changeOrigin: true },
      "/orgs":     { target: "http://localhost:8000", changeOrigin: true, bypass: spaBypass },
      "/projects": { target: "http://localhost:8000", changeOrigin: true, bypass: spaBypass },
      "/api":      { target: "http://localhost:8000", changeOrigin: true },
      "/health":   { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
