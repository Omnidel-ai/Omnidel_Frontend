"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { usePermissions } from "@/lib/client/permissions";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { emitToast } from "@/components/omnidel/toaster";
import type { SearchResult, SearchResultType } from "@/lib/search/types";
import { SEARCH_RESULT_TYPES } from "@/lib/search/types";
import { ResultGroup } from "./ResultGroup";
import { ResultRow, typeLabel } from "./ResultRow";
import {
  getRecentSelections,
  pushRecentSelection,
  removeRecentSelection,
} from "./recent";
import { useTr } from "@/lib/client/language";

function emitSearchClick(payload: { type: string; rank: number; q_len: number }) {
  // Structured client event — wire to metrics sink when available. Never includes raw q.
  // eslint-disable-next-line no-console
  console.info("search_result_click", payload);
}

function clientAllowedTypes(
  can: (p: string) => boolean,
  hasModule: (m: string) => boolean,
  isFounder: boolean,
): SearchResultType[] {
  if (isFounder) return [...SEARCH_RESULT_TYPES];
  const out: SearchResultType[] = [];
  if (can("omnipulse.boards.view")) {
    out.push("task", "board", "workspace");
  }
  if (can("admin.users")) out.push("user");
  if (hasModule("omnimart") && can("pipeline.view")) {
    out.push("lead", "operation", "site");
  }
  if (can("omnistudio.media.read")) out.push("media_project");
  if (can("omnistudio.brand.read")) out.push("reference");
  if (can("omnivarsity.acharyas.read")) out.push("acharya");
  if (can("missions.view")) out.push("mission");
  return out;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const tr = useTr();
  const router = useRouter();
  const { can, hasModule, isFounder } = usePermissions();
  const allowedTypes = useMemo(
    () => clientAllowedTypes(can, hasModule, isFounder),
    [can, hasModule, isFounder],
  );
  const { query, setQuery, envelope, loading, clear, searchType, dispatchNow } = useGlobalSearch({
    types: allowedTypes,
  });
  const [seeAllType, setSeeAllType] = useState<SearchResultType | null>(null);
  const [recent, setRecent] = useState(() => getRecentSelections());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecent(getRecentSelections());
      setSeeAllType(null);
    } else {
      clear();
      setSeeAllType(null);
    }
  }, [open, clear]);

  // Focus the input the moment the palette opens (and on every reopen). The
  // whole tree unmounts on close (see `if (!open) return null` below), so
  // `inputRef.current` is only populated once the input has actually mounted.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const resolveAndPush = useCallback(
    async (req: { target_id: string; entity_id?: string; params?: Record<string, string> }) => {
      const res = await fetch("/api/mahacharya/nav-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (res.status === 404 || res.status === 422) {
        return { ok: false as const, gone: true };
      }
      if (!res.ok) return { ok: false as const, gone: false };
      const { path } = (await res.json()) as { path?: string };
      if (
        typeof path === "string" &&
        path.startsWith("/") &&
        !path.startsWith("//") &&
        /^[\w\-/?&=%.]*$/.test(path)
      ) {
        router.push(path);
        return { ok: true as const };
      }
      return { ok: false as const, gone: false };
    },
    [router],
  );

  const handleSelect = useCallback(
    async (row: Omit<SearchResult, "updated_at">, rank: number) => {
      emitSearchClick({ type: row.type, rank, q_len: query.trim().length });
      const result = await resolveAndPush({
        target_id: row.target_id,
        entity_id: row.entity_id,
        params: row.params,
      });
      if (result.ok) {
        pushRecentSelection(row);
        onOpenChange(false);
        return;
      }
      if (result.gone) {
        emitToast("That item is no longer available");
        removeRecentSelection(row.type, row.id);
        setRemovingIds((prev) => new Set(prev).add(`${row.type}:${row.id}`));
        setRecent(getRecentSelections());
        return;
      }
      emitToast("Couldn't open that item");
    },
    [onOpenChange, query, resolveAndPush],
  );

  if (!open) return null;

  const groups = (envelope?.groups || []).map((g) => ({
    ...g,
    results: g.results.filter((r) => !removingIds.has(`${r.type}:${r.id}`)),
  })).filter((g) => g.results.length > 0);

  const showRecent = query.trim().length < 2 && recent.length > 0 && !seeAllType;
  const empty =
    query.trim().length >= 2 &&
    !loading &&
    groups.length === 0 &&
    (envelope?.failed.length ?? 0) === 0;

  let rankOffset = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Global search")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        background: "color-mix(in srgb, var(--ink) 40%, transparent)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <Command
        label={tr("Global search")}
        shouldFilter={false}
        style={{
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "min(480px, 70vh)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "var(--page)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          boxShadow: "0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
          {seeAllType ? (
            <button
              type="button"
              onClick={() => {
                setSeeAllType(null);
                if (query.trim().length >= 2) void dispatchNow(query);
              }}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--ink-mute)",
                cursor: "pointer",
                fontSize: 13,
                padding: "0 4px",
              }}
              aria-label={tr("Back to all results")}
            >
              ←
            </button>
          ) : null}
          <Command.Input
            ref={inputRef}
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={seeAllType ? `Search ${typeLabel(seeAllType)}…` : "Search OmniDel…"}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 16,
              color: "var(--ink)",
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            {tr("Esc")}
          </kbd>
        </div>

        <Command.List style={{ overflow: "auto", flex: 1, padding: "4px 0" }}>
          {showRecent ? (
            <div style={{ padding: "8px 8px 4px" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  padding: "4px 12px",
                }}
              >
                {tr("Recent")}
              </div>
              {recent.map((r, i) => (
                <ResultRow
                  key={`recent-${r.type}-${r.id}`}
                  id={r.id}
                  title={r.title}
                  subtitle={r.subtitle || typeLabel(r.type)}
                  value={`recent:${r.type}:${r.id}`}
                  onSelect={() => void handleSelect(r, i + 1)}
                />
              ))}
            </div>
          ) : null}

          {loading && groups.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-mute)", fontSize: 13 }}>{tr("Searching…")}</div>
          ) : null}

          {empty ? (
            <div style={{ padding: 16, color: "var(--ink-mute)", fontSize: 13 }}>
              {tr("No results for ‘")}{query.trim()}&rsquo;
            </div>
          ) : null}

          {groups.map((g) => {
            const offset = rankOffset;
            rankOffset += g.results.length;
            return (
              <ResultGroup
                key={g.type}
                group={g}
                rankOffset={offset}
                onSelect={(row, rank) => void handleSelect(row, rank)}
                onSeeAll={
                  seeAllType
                    ? undefined
                    : (type) => {
                        setSeeAllType(type);
                        void searchType(type, 25);
                      }
                }
              />
            );
          })}

          {(envelope?.failed.length ?? 0) > 0 ? (
            <div style={{ padding: "8px 20px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
              {tr("Some sources unavailable")}
            </div>
          ) : null}
        </Command.List>
      </Command>
    </div>
  );
}
