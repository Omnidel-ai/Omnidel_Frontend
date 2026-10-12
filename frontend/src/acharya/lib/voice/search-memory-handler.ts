import type { ToolHandlers } from "@/acharya/hooks/useGeminiLiveSession";

/**
 * The `search_memory` tool handler, for every voice surface that binds the tool.
 *
 * WHY THIS IS SHARED AND NOT INLINE ON A SCREEN
 *
 * The tool was declared at mint from the day the RAG path landed, and
 * `/api/work/acharya-memory` was written for exactly this call — but no handler
 * was registered anywhere, so every call fell through to the hook's
 * `{ ok:false, error:"unhandled" }`. The prompt tells the model to call this
 * FIRST on anything factual and never to answer from recollection, so a single
 * factual turn produced "I am having trouble looking something up — shall I
 * continue or try again?" and stopped there.
 *
 * That was fixed once, inside `AcharyaShell.baseHandlers` — which only mounts
 * under `/acharyas/[slug]`. When the home navigator later gained the same tool,
 * the same bug would have come back on the home screen alone, for the same
 * reason: a tool bound at mint with nothing to answer it. Extracted here so
 * binding the tool and handling it stay one decision.
 *
 * A MISS RESOLVES `ok: true` WITH AN EMPTY LIST, deliberately. "Nothing in my
 * material" is something the acharya can speak past; a *failed* tool is what it
 * stalls on. Every failure mode — bad request, non-2xx, network throw — collapses
 * to the same harmless shape, and the karigar never hears about the lookup.
 */
export function buildSearchMemoryHandler(acharyaSlug: string): ToolHandlers {
  return {
    search_memory: async (args) => {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) return { ok: true, items: [], note: "no_query" };
      try {
        const res = await fetch("/api/work/acharya-memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acharyaSlug, query }),
        });
        if (!res.ok) return { ok: true, items: [], note: "nothing_found" };
        const data = (await res.json()) as { items?: Array<{ content?: unknown }> };
        const items = (data.items ?? [])
          .map((item) => String(item?.content ?? "").trim())
          .filter(Boolean);
        return { ok: true, items, note: items.length ? "found" : "nothing_found" };
      } catch {
        return { ok: true, items: [], note: "nothing_found" };
      }
    },
  };
}
