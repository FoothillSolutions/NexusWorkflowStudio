import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/store/library-store"],
              message: "Use the canonical '@/store/library' entrypoint instead.",
            },
            {
              group: ["@/store/opencode-store"],
              message: "Use the canonical '@/store/opencode' entrypoint instead.",
            },
            {
              group: ["@/store/workflow-gen-store"],
              message: "Use the canonical '@/store/workflow-gen' entrypoint instead.",
            },
            {
              group: ["@/store/workflow-store", "@/store/workflow-store-*"],
              message: "Use the canonical '@/store/workflow' domain exports instead.",
            },
            {
              group: ["@/store/prompt-gen-store", "@/store/prompt-gen-*"],
              message: "Use the canonical '@/store/prompt-gen' domain exports instead.",
            },
          ],
        },
      ],
      // Allow underscore-prefixed unused vars (interface conformance convention)
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
    // SpacetimeDB module has its own tsconfig and uses decorators not supported by ESLint
    "spacetime/**",
    // SpacetimeDB generated client bindings are validated by typecheck.
    "src/lib/spacetime/module_bindings/**",
  ]),
]);

export default eslintConfig;
