import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * `virtual:component-catalog` — every file in `src/components/{common,acharya,omnidel}`.
 *
 * The Components page lists all three sets. Writing that list by hand would
 * be out of date the first time someone adds a file, so it is read off the
 * disk when Vite builds or serves: path, folder, size, what it exports, and
 * the first sentence of its doc comment. Adding, renaming or moving a
 * component updates the page; nothing else to maintain.
 */

export interface CatalogEntry {
  /** `acharya/tasks/task-card.tsx` */
  path: string;
  set: "common" | "acharya" | "omnidel";
  /** Folder inside the set: `tasks`, `Button`, `(root)`. */
  folder: string;
  file: string;
  lines: number;
  exports: string[];
  summary: string;
}

const VIRTUAL = "virtual:component-catalog";
const RESOLVED = "\0" + VIRTUAL;
const SETS = ["common", "acharya", "omnidel"] as const;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

/** First doc comment (or run of // lines) above the first export, as plain text. */
function summarise(src: string): string {
  const body = src.replace(/^\s*["']use client["'];?\s*/, "");
  const firstExport = body.search(/^export\s/m);
  const head = firstExport === -1 ? body : body.slice(0, firstExport);
  const blocks = [...head.matchAll(/\/\*\*([\s\S]*?)\*\//g)].map((m) => m[1]);
  let text = blocks.length ? blocks[blocks.length - 1] : "";
  if (!text) {
    const lines = head.split(/\r?\n/).filter((l) => /^\s*\/\//.test(l));
    text = lines.map((l) => l.replace(/^\s*\/\/\s?/, "")).join(" ");
  }
  text = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/`/g, "")
    // Banner rules (`// =====`, `/* ───── */`) are decoration, not a description.
    .replace(/[=─━—\-*#~_]{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = text.match(/^(.{20,240}?[.!?])(\s|$)/);
  return (sentence ? sentence[1] : text.slice(0, 240)).trim();
}

function exportsOf(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|let)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  if (/^export\s+default\s+(?!function|class|async)/m.test(src)) names.add("default");
  return [...names];
}

export function buildCatalog(componentsDir: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const set of SETS) {
    const base = path.join(componentsDir, set);
    for (const abs of walk(base)) {
      if (!/\.(tsx?|css)$/.test(abs)) continue;
      const rel = path.relative(base, abs).split(path.sep).join("/");
      const parts = rel.split("/");
      const src = fs.readFileSync(abs, "utf8");
      entries.push({
        path: `${set}/${rel}`,
        set,
        folder: parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)",
        file: parts[parts.length - 1],
        lines: src.split(/\r?\n/).length,
        exports: abs.endsWith(".css") ? [] : exportsOf(src),
        summary: abs.endsWith(".css") ? "Stylesheet." : summarise(src),
      });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export function componentCatalog(componentsDir: string): Plugin {
  return {
    name: "omnidel:component-catalog",
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : null),
    load(id) {
      if (id !== RESOLVED) return null;
      const catalog = buildCatalog(componentsDir);
      for (const e of catalog) this.addWatchFile(path.join(componentsDir, e.path));
      return `export default ${JSON.stringify(catalog)};`;
    },
    configureServer(server) {
      // A file added or removed is not a change to a watched file; re-list on both.
      const refresh = (file: string) => {
        if (!path.resolve(file).startsWith(path.resolve(componentsDir))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.reloadModule(mod);
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
  };
}
