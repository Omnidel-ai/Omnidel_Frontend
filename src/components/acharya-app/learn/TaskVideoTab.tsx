"use client";

import type { Lang } from "@/lib/store";
import { t } from "@/lib/i18n/strings";
import { LearnPanelShell } from "@/components/learn/LearnPanelShell";

interface TaskShape {
  id: string;
  title: string;
  description: string | null;
}

interface Props {
  task: TaskShape;
  workspaceSlug: string;
  lang: Lang;
}

export function TaskVideoTab({ lang }: Props) {
  const s = t(lang);
  return (
    <LearnPanelShell>
      <EmptyState
        title={s.noVideoYet}
        body={s.noVideoYetBody}
      />
    </LearnPanelShell>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 260,
        padding: "48px 24px",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "var(--surface-sunk)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <VideoIcon />
      </div>
      <div>
        <p
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--ink)",
            margin: "0 0 8px",
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.5, margin: 0, maxWidth: 300 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  );
}
