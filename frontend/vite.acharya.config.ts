import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { componentCatalog } from "./scripts/component-catalog";
import { fileURLToPath, URL } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The Acharya karigar app — a second, separate build in this project.
 *
 * `vite.config.ts` builds the OmniDel workspace; this builds the Acharya app
 * from `src/acharya/` (screens, lib, demo data) and `src/components/acharya/`.
 * It is its own config, not a second entry in that one, for two reasons:
 *
 *  - Its screens read `window.location.pathname` directly, so it must be
 *    served at real paths (`/acharyas/…`) with its own SPA fallback, which a
 *    root-level `index.html` per app gives for free.
 *  - It is styled with Tailwind v4, and that must never reach the OmniDel
 *    workspace's hand-written CSS.
 *
 * `next/*` imports resolve to the small shims in `src/acharya/next/`.
 */
export default defineConfig(({ mode }) => ({
  root: at("./src/acharya"),
  publicDir: at("./src/acharya/public"),
  envDir: at("."),
  plugins: [react(), tailwindcss(), componentCatalog(at("./src/components"))],
  resolve: {
    alias: [
      { find: /^next\/navigation$/, replacement: at("./src/acharya/next/navigation.ts") },
      { find: /^next\/link$/, replacement: at("./src/acharya/next/link.tsx") },
      { find: /^next\/image$/, replacement: at("./src/acharya/next/image.tsx") },
      { find: /^next\/dynamic$/, replacement: at("./src/acharya/next/dynamic.tsx") },
      { find: /^next\/font\/google$/, replacement: at("./src/acharya/next/font-google.ts") },
      { find: /^@\//, replacement: at("./src/") },
    ],
  },
  // The app was written for Next, which inlines these at build time.
  define: {
    "process.env": JSON.stringify({
      NODE_ENV: mode === "production" ? "production" : "development",
      NEXT_PUBLIC_NETWORK_PORTAL_URL: "",
      NEXT_PUBLIC_SIMPLE_TASK_TYPE_ID: "",
      SIMPLE_TASK_TYPE_ID: "",
    }),
  },
  server: { port: 5301, open: false },
  preview: { port: 5301 },
  build: { outDir: at("./dist-acharya"), emptyOutDir: true },
}));
