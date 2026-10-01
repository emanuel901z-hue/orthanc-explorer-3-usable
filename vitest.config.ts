import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // This repo owns the broker slice. The rest of OE3 (viewer, upload,
      // activity, the study list beyond the broker entry points) is the shared
      // fork's own area — measuring it here would report ~49 % and say nothing
      // about the code this workspace is responsible for.
      include: ["src/features/broker/**", "src/api/broker.ts"],
      // A regression has to fail the build, not just show up in a report. The
      // numbers sit below the current state (statements 97.5 %, branches 86 %,
      // functions 79 %) so ordinary fluctuation passes and a real drop does not.
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 75,
        lines: 95,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
