import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * Flat config for the isolated project only. The Next.js app at the repository
 * root keeps its own eslint setup — nothing here reaches it.
 */
export default [
  { ignores: ["dist/**", ".smoke/**", "node_modules/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...(tsPlugin.configs?.recommended?.rules ?? {}),
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
