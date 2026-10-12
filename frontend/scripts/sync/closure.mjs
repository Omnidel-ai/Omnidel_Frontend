import fs from "node:fs";
import path from "node:path";

// Usage: node closure.mjs <repoRoot> <seed files...>
// Follows @/ and relative imports from the seeds and reports what they reach.
const root = path.resolve(process.argv[2]);
const seeds = process.argv.slice(3);
const exts = ["", ".ts", ".tsx", "/index.ts", "/index.tsx", ".css"];

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const e of exts) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return "MISSING:" + spec;
}

const seen = new Set();
const ext = new Map();
const missing = new Set();
const serverRefs = new Set();
const q = seeds.map((s) => path.resolve(root, s));
const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
while (q.length) {
  const f = q.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  if (f.endsWith(".css")) continue;
  const src = fs.readFileSync(f, "utf8");
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    const spec = m[1] || m[2] || m[3];
    const r = resolve(f, spec);
    if (r === null) ext.set(spec, (ext.get(spec) || 0) + 1);
    else if (r.startsWith("MISSING")) missing.add(r + " in " + path.relative(root, f));
    else if (/[\\/]lib[\\/]server[\\/]/.test(r)) { seen.add(r); serverRefs.add(path.relative(root, r) + "  <-  " + path.relative(root, f)); } else q.push(r);
  }
}
const rel = [...seen].map((f) => path.relative(root, f).split(path.sep).join("/")).sort();
const groups = {};
for (const r of rel) {
  const g = r.split("/").slice(0, r.startsWith("src/lib/") ? 3 : 2).join("/");
  groups[g] = (groups[g] || 0) + 1;
}
console.log("FILES", rel.length);
console.log(groups);
console.log("SERVER-ish:\n" + rel.filter((r) => /lib\/server|app\/api/.test(r)).join("\n"));
console.log("EXTERNAL:", [...ext.keys()].sort().join("  "));
console.log("MISSING:", [...missing].join("\n"));
console.log("SERVER REFS:\n" + [...serverRefs].sort().join("\n"));
if (process.env.LIST) console.log(rel.join("\n"));
