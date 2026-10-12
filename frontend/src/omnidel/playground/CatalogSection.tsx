import { useMemo, useState } from "react";
import catalog from "virtual:component-catalog";
import { Badge, EmptyState, SearchBar } from "../../components/common";
import { Section } from "./Case";

type SetId = "common" | "acharya" | "omnidel";

/** Where the Acharya app's dev server runs; its /components page renders the Acharya set live. */
const ACHARYA_URL = (import.meta.env.VITE_ACHARYA_URL as string | undefined) ?? "http://localhost:5301";

const INTRO: Record<SetId, string> = {
  common:
    "The shared library both apps build on. Domain-free: each component takes props and reports events. Rendered live in the tabs above; this is the full file list.",
  acharya:
    "The Acharya karigar app's components, from omnidel-acharya PR #207, grouped by what they are for. They run in the Acharya app (src/acharya), which has its own styles — open its Components page to see them rendered.",
  omnidel:
    "The OmniDel app's own components, copied from OmniDel/src/components and grouped by area. Reference source for porting into common/; not built here.",
};

/** Counts per set, for the set switcher's badges. */
export const CATALOG_COUNTS: Record<SetId, number> = {
  common: catalog.filter((e) => e.set === "common").length,
  acharya: catalog.filter((e) => e.set === "acharya").length,
  omnidel: catalog.filter((e) => e.set === "omnidel").length,
};

/**
 * Every file in one component set, by folder.
 *
 * Read from `virtual:component-catalog`, which Vite builds from the folders
 * themselves, so this page cannot fall behind the code.
 */
export function CatalogSection({ set }: { set: SetId }) {
  const [query, setQuery] = useState("");

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = catalog.filter(
      (e) =>
        e.set === set &&
        (!q ||
          e.path.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.exports.some((x) => x.toLowerCase().includes(q))),
    );
    const byFolder = new Map<string, typeof rows>();
    for (const r of rows) byFolder.set(r.folder, [...(byFolder.get(r.folder) ?? []), r]);
    return [...byFolder.entries()].sort(([a], [b]) => (a === "(root)" ? -1 : b === "(root)" ? 1 : a.localeCompare(b)));
  }, [set, query]);

  const total = folders.reduce((n, [, rows]) => n + rows.length, 0);

  return (
    <div>
      <p className="pg-note">
        {INTRO[set]}
        {set === "acharya" && (
          <>
            {" "}
            <a href={`${ACHARYA_URL}/components`} target="_blank" rel="noreferrer">
              Open the Acharya component gallery ↗
            </a>{" "}
            (run <code>npm run dev:acharya</code> first).
          </>
        )}
      </p>

      <div className="pg-cat-toolbar">
        <SearchBar value={query} onChange={setQuery} placeholder={`Search ${CATALOG_COUNTS[set]} files by name, export or description`} />
        <span className="pg-cat-count">
          {total} file{total === 1 ? "" : "s"} · {folders.length} folder{folders.length === 1 ? "" : "s"}
        </span>
      </div>

      {folders.length === 0 ? (
        <div className="ui-card" style={{ display: "flex", minHeight: 200 }}>
          <EmptyState variant="no-results" title={`Nothing matches “${query}”`} description="Try a file name, an export, or a word from a description." />
        </div>
      ) : (
        folders.map(([folder, rows]) => (
          <Section key={folder} id={`${set}-${folder}`} title={`${set}/${folder === "(root)" ? "" : folder + "/"} · ${rows.length}`}>
            <ul className="pg-cat-list">
              {rows.map((e) => (
                <li key={e.path} className="pg-cat-item">
                  <div className="pg-cat-item__head">
                    <code className="pg-cat-item__file">{e.file}</code>
                    <span className="pg-cat-item__lines">{e.lines} lines</span>
                  </div>
                  {e.summary && <p className="pg-cat-item__summary">{e.summary}</p>}
                  {e.exports.length > 0 && (
                    <div className="pg-row" style={{ gap: 6 }}>
                      {e.exports.slice(0, 8).map((x) => (
                        <Badge key={x}>{x}</Badge>
                      ))}
                      {e.exports.length > 8 && <Badge>+{e.exports.length - 8}</Badge>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </div>
  );
}
