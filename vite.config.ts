import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy to local Orthanc dev stack — avoids CORS in dev mode.
      // public/config.js sets orthancUrl: "/orthanc-proxy" so the SPA
      // never makes a cross-origin request during development.
      "/orthanc-proxy": {
        target: "http://localhost:8042",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/orthanc-proxy/, ""),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
}));
