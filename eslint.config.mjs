import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // global ignores
  {
    ignores: [
      "**/dist/**",
      "**/dist-electron/**",
      "**/web/**",
      "**/node_modules/**",
      "**/android/**",
      "**/ios/**",
      "**/release/**",
      "**/build/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },

  // base recommended rules
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // project-wide overrides
  {
    rules: {
      // catch real bugs
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // warn on any — push toward better types over time
      "@typescript-eslint/no-explicit-any": "warn",

      // allow require() for dynamic native imports (rn adapters)
      "@typescript-eslint/no-require-imports": "off",

      // no-console is off — the project uses its own log utility
      "no-console": "off",

      // too noisy for existing codebase — re-thrown errors don't always need cause chaining
      "preserve-caught-error": "off",
    },
  },

  // relax rules for test files
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/e2e/**", "**/e2e-mobile/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
