import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Prefixo vazio: carrega tudo de .env / .env.local, inclusive DATABASE_URL,
  // para os testes de integração acharem o banco sem exportar nada à mão.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/domain/**"],
    },
  },
});
