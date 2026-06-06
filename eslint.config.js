import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Build artifacts, deps, and coverage output are not linted.
    ignores: ["dist/**", "node_modules/**", "coverage/**", ".nyc_output/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "benchmark/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    rules: {
      // The library deliberately uses `any` in the schema-driven dispatch and
      // type-inference layers; flag accidental ones as warnings, not errors.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow intentionally-unused args/vars prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests use non-null assertions and loose typing freely.
    files: ["src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  prettier,
);
