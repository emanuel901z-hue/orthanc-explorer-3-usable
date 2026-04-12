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
  optimizeDeps: {
    // Exclude the image loader from esbuild pre-bundling. It uses
    //   new URL('./decodeImageFrameWorker.js', import.meta.url)
    // which must resolve relative to the original node_modules location.
    // Pre-bundling would move it to .vite/deps/ where the worker file doesn't exist.
    exclude: ['@cornerstonejs/dicom-image-loader'],
    // Explicitly include the UMD codec packages so esbuild pre-bundles them
    // and creates proper ESM default exports. The worker (served from node_modules)
    // imports these subpaths; Vite redirects to the pre-bundled versions.
    include: [
      'dicom-parser',
      '@cornerstonejs/codec-charls/decodewasmjs',
      '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
      '@cornerstonejs/codec-openjpeg/decodewasmjs',
      '@cornerstonejs/codec-openjph/wasmjs',
    ],
  },
  // Cornerstone3D codec libs ship as IIFE/UMD files. Vite's default worker format
  // is 'iife', but IIFE + code-splitting = Rollup error. Switching workers to
  // 'es' format lets Rollup handle the dynamic imports inside the worker correctly.
  worker: {
    format: 'es',
  },
}));
