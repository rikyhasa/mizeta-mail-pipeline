import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Componenti di riferimento visivo, non compilati nell'app — vedi FASE-7C-REDESIGN-STRUTTURALE.md.
    "docs/design-reference/**",
    // Clone locale read-only della reference Mizeta Flow (Fase 8, gitignored) — progetto Next.js
    // a sé, non fa parte del target: i suoi `.next/**` generati non vanno linterati qui.
    ".reference/**",
  ]),
]);

export default eslintConfig;
