import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * Interaction tests.
 *
 * Separate from `vite.config.ts` on purpose: that file configures a dev server
 * and a production build, and carries a plugin that intercepts `/api` for the
 * browser. None of that belongs in a test run, and a config that serves two
 * masters gets confusing fast.
 *
 * These tests do what the smoke render cannot. `renderToString` draws a screen
 * once and stops, so it proves a screen exists and nothing more — it cannot
 * click Cancel, type in a search box, or watch a progress bar move. That needs
 * a DOM, which is what jsdom provides here.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // Each file gets a clean document; tests that leak state into each other
    // are worse than no tests, because they fail for reasons that are not the
    // code's fault.
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
    css: false,
  },
});
