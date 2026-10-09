"use client";

// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// Superseded by the filter UI inside boards/page.tsx; no importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

// In-page workspace filter for /boards. Replaces the topbar workspace
// switcher. Lists only "relevant" workspaces: ones the user is explicitly
// in OR has visible boards in. Admin sees all.
//
// State is URL-driven (?workspace=<id>) so the filter survives navigation
// and the link is shareable. Empty value = "All my workspaces".

interface WorkspaceItem {
  id: string;
  name: string;
  module_slug: string | null;
  visibility: "public" | "private";
  is_system: boolean;
  is_protected: boolean;
}

interface Props {
  /** Current workspace id from the URL (server-resolved). */
  currentWorkspaceId: string | null;
}

const ALL_VALUE = "__all__";

export function BoardsWorkspaceFilter({ currentWorkspaceId }: Props) {
  const tr = useTr();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/omnipulse/workspaces?relevant=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = (data.items || []) as WorkspaceItem[];
        setWorkspaces(items);
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_VALUE) {
      params.delete("workspace");
    } else {
      params.set("workspace", value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const options = [
    { value: ALL_VALUE, label: "All my projects" },
    ...workspaces.map((w) => ({
      value: w.id,
      label: w.name,
    })),
  ];

  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>{tr("TEAM")}</span>
      <div style={selectWrapStyle}>
        <CustomSelect
          value={currentWorkspaceId || ALL_VALUE}
          onChange={onChange}
          options={options}
          placeholder={loading ? "Loading…" : "Select team"}
        />
      </div>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

// Floor the trigger width so short selections (e.g. "Design") don't
// collapse the dropdown into a 2-line wrap when longer options open.
const selectWrapStyle: React.CSSProperties = {
  minWidth: 220,
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-mute)",
};
