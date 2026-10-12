import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Copy files to new locations and rewrite every import between them.
 *
 *   node relocate.mjs <inRoot> <outRoot> <mapping.mjs> <file list (relative to inRoot)>
 *
 * mapping.mjs default-exports (relPath) => newRelPath. Both are POSIX paths
 * relative to their root. `@/x` resolves to `<root>/src/x` on both sides.
 * Every import that resolves to a mapped file is rewritten, keeping its style:
 * `@/…` stays `@/…`, relative stays relative, a written extension is kept.
 * Imports that do not resolve to a listed file (packages, unknown) are left
 * alone and reported.
 */
const [inRoot, outRoot, mappingFile, listFile] = process.argv.slice(2);
const map = (await import(pathToFileURL(path.resolve(mappingFile)).href)).default;
const files = fs.readFileSync(listFile, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const fileSet = new Set(files);

const posix = (p) => p.split(path.sep).join("/");
const exts = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveOld(importer, spec) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) base = posix(path.posix.join(path.posix.dirname(importer), spec));
  else return null;
  for (const e of exts) if (fileSet.has(base + e)) return { target: base + e, suffix: e };
  return { target: null, base };
}

function newSpec(oldSpec, importerNew, targetNew, suffix) {
  // Drop what resolution added, so `@/x` stays extensionless and `./dir` stays a dir.
  let t = targetNew;
  if (suffix === "/index.ts" || suffix === "/index.tsx") t = path.posix.dirname(t);
  else if (suffix === ".ts" || suffix === ".tsx") t = t.slice(0, -suffix.length);
  if (oldSpec.startsWith("@/")) {
    if (!t.startsWith("src/")) throw new Error(`cannot express ${t} with @/`);
    return "@/" + t.slice(4);
  }
  let rel = path.posix.relative(path.posix.dirname(importerNew), t);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

const re = /((?:import|export)\s[^'"`;]*?from\s*|import\(\s*|^\s*import\s+|@import\s+)(['"])([^'"]+)\2/gm;
const unresolved = new Set();
let rewrites = 0;
for (const rel of files) {
  const dest = map(rel);
  if (!dest) throw new Error("unmapped file " + rel);
  const src = fs.readFileSync(path.join(inRoot, rel), "utf8");
  const out = /\.(tsx?|css|mjs|js)$/.test(rel)
    ? src.replace(re, (whole, lead, q, spec) => {
        const r = resolveOld(rel, spec);
        if (!r) return whole;
        if (!r.target) {
          unresolved.add(`${spec}  in ${rel}`);
          return whole;
        }
        const ns = newSpec(spec, dest, map(r.target), r.suffix);
        if (ns !== spec) rewrites++;
        return lead + q + ns + q;
      })
    : src;
  const abs = path.join(outRoot, dest);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs)) throw new Error("refusing to overwrite " + abs);
  fs.writeFileSync(abs, out);
}
console.log(`copied ${files.length} files, rewrote ${rewrites} imports`);
if (unresolved.size) console.log("UNRESOLVED (left as is):\n" + [...unresolved].sort().join("\n"));
