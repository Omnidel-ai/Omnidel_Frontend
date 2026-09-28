import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * `/api/*` in the dev server: answer, don't serve.
 *
 * The handlers in `api/` are Vercel Functions. `vite dev` does not run them —
 * and worse, since they sit under the project root, a request for
 * `/api/blob/view?pathname=x.png` resolves to the file and Vite tries to
 * transform it, which fails on the extension in the query string.
 *
 * So the dev server answers the way a deployment with no Blob store answers:
 * 501 with `demo: true`. The workspace then behaves in development exactly as
 * it does when deployed without a store, which is its normal state. To run the
 * functions for real, use `vercel dev` instead of `npm run dev`.
 */
function apiInDev(): Plugin {
  return {
    name: "omnidel:api-demo",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        res.statusCode = 501;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            demo: true,
            store: "absent",
            writable: false,
            error: "vite dev does not run the functions in api/. Use `vercel dev` for those.",
          }),
        );
      });
    },
  };
}

// Standalone playground server. Nothing here is shared with the Next.js app
// at the repository root — this project has its own deps, config and CSS.
export default defineConfig({
  plugins: [react(), apiInDev()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5300, open: false },
});
