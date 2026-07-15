import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    // I test di integrazione condividono un unico Postgres di test mutabile (conteggi globali
    // in seed-integrity.test.ts, coda job in src/lib/jobs/*, ecc.): file eseguiti in parallelo
    // (default Vitest) possono osservarsi a vicenda a metà esecuzione. Sequenziale, non parallelo.
    fileParallelism: false,
  },
});
