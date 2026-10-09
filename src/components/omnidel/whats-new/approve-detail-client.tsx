"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/omnidel/confirm-dialog";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import {
  WHATS_NEW_APP_LABELS,
  WHATS_NEW_CHANGE_TYPE_LABELS,
  WHATS_NEW_MODULE_LABELS,
  type ReleaseNote,
  type WhatsNewChangeType,
  type WhatsNewModule,
} from "@/lib/whats-new-schema";
import { useTr } from "@/lib/client/language";

/** Detail modal — same shell + section order as New changelog create modal. */
export function ChangelogDetailModal({
  note: initialNote,
  onClose,
  onPublished,
}: {
  note: ReleaseNote;
  onClose: () => void;
  onPublished?: (note: ReleaseNote) => void;
}) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const [note, setNote] = useState(initialNote);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !publishOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, publishOpen, onClose]);

  async function handlePublish() {
    setBusy(true);
    setActionErr(null);
    try {
      const res = await fetch(`/api/admin/whats-new/entries/${note.id}/publish`, {
        method: "PATCH",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionErr(d.error || "Publish failed");
        return;
      }
      const updated = d.item as ReleaseNote;
      setNote(updated);
      setPublishOpen(false);
      onPublished?.(updated);
    } catch {
      setActionErr("Publish failed — network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          overflowY: "auto",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr("Changelog details")}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: isMobile ? "100%" : 720,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            position: "relative",
          }}
        >
          <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "22px 24px" }}>
            <ReleaseNoteDetailFields note={note} isMobile={isMobile} />
          </div>

          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
              padding: "12px 24px",
              borderTop: "1px solid var(--rule)",
              background: "var(--surface)",
            }}
          >
            <button type="button" onClick={onClose} style={cancelBtnStyle}>
              {tr("Close")}
            </button>
            {!note.is_published && (
              <button
                type="button"
                onClick={() => {
                  setActionErr(null);
                  setPublishOpen(true);
                }}
                style={saveBtnStyle}
              >
                {tr("Publish")}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={publishOpen}
        title={tr("Publish to What's new?")}
        description={`Publish "${note.title}" (${note.released_on}). It will appear on the public What's new page for everyone.`}
        confirmLabel={tr("Publish")}
        confirmTone="primary"
        busy={busy}
        error={actionErr}
        onCancel={() => {
          setPublishOpen(false);
          setActionErr(null);
        }}
        onConfirm={handlePublish}
      />
    </>
  );
}

export function ReleaseNoteDetailFields({
  note,
  isMobile,
}: {
  note: ReleaseNote;
  isMobile: boolean;
}) {
  const tr = useTr();
  const items = note.items ?? [];

  return (
    <div>
      {/* Title — same chrome as create modal */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            width: "100%",
            padding: "6px 10px",
            fontSize: 22,
            fontWeight: 600,
            fontFamily: "var(--serif)",
            color: "var(--ink)",
            background: "var(--page)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--r-sm)",
            boxSizing: "border-box",
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {note.title}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              padding: "3px 10px",
              fontSize: 11,
              fontFamily: "var(--mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderRadius: 999,
              minWidth: 72,
              textAlign: "center",
              background: note.is_published ? "var(--ok-wash)" : "var(--surface-sunk)",
              color: note.is_published ? "var(--ok)" : "var(--ink-mute)",
            }}
          >
            {note.is_published ? tr("Published") : tr("Draft")}
          </span>
        </div>
      </div>

      <section style={{ marginTop: 6 }}>
        <SectionTitle>{tr("Summary")}</SectionTitle>
        <div style={{ ...readFieldStyle, minHeight: 64 }}>
          {note.summary?.trim() || (
            <span style={{ color: "var(--ink-mute)" }}>{tr("No summary")}</span>
          )}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <SectionTitle>{tr("Details")}</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "12px 24px",
          }}
        >
          <DI label={tr("RELEASE DATE")}>
            <div
              style={{
                ...readFieldStyle,
                minHeight: 40,
                display: "flex",
                alignItems: "center",
              }}
            >
              {note.released_on}
            </div>
          </DI>
          <DI label={tr("APP")}>
            <div
              style={{
                ...readFieldStyle,
                minHeight: 40,
                display: "flex",
                alignItems: "center",
              }}
            >
              {(note.apps?.length
                ? note.apps.map((a) => WHATS_NEW_APP_LABELS[a] ?? a).join(" · ")
                : "—")}
            </div>
          </DI>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <SectionTitle>{tr("Items")}</SectionTitle>
        {items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-mute)", padding: "4px 0 2px" }}>
            {tr("No items yet")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 2 }}>
            {items.map((it, idx) => {
              const isLast = idx === items.length - 1;
              const typeLabel =
                WHATS_NEW_CHANGE_TYPE_LABELS[it.change_type as WhatsNewChangeType] ??
                it.change_type;
              const moduleLabel =
                it.module && it.module !== "platform"
                  ? WHATS_NEW_MODULE_LABELS[it.module as WhatsNewModule] ?? it.module
                  : null;
              return (
                <div
                  key={it.id}
                  style={{
                    padding: "10px 4px",
                    borderBottom: isLast ? "none" : "1px solid var(--rule)",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 160px",
                      minWidth: 0,
                      fontSize: 13,
                      fontFamily: "var(--sans)",
                      color: "var(--ink)",
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {it.text}
                  </div>
                  <div
                    style={{
                      flex: "0 0 auto",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: isMobile ? "flex-start" : "flex-end",
                    }}
                  >
                    <span style={changeTypeChipStyle(it.change_type)}>{typeLabel}</span>
                    {moduleLabel && <span style={moduleChipStyle}>{moduleLabel}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return (
    <h3
      style={{
        fontFamily: "var(--serif)",
        fontSize: 14,
        margin: 0,
        marginBottom: inline ? 0 : 8,
        color: "var(--ink)",
      }}
    >
      {children}
    </h3>
  );
}

function DI({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{children}</div>
    </div>
  );
}

const readFieldStyle: CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--page)",
  color: "var(--ink)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  fontFamily: "var(--sans)",
  boxSizing: "border-box",
};

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 500,
  fontFamily: "var(--sans)",
  lineHeight: 1.2,
  padding: "4px 10px",
  borderRadius: "var(--r-sm)",
  whiteSpace: "nowrap",
};

function changeTypeChipStyle(changeType: string): CSSProperties {
  if (changeType === "new") {
    return {
      ...chipBase,
      background: "var(--ok-wash)",
      color: "var(--ok)",
      border: "1px solid var(--ok)",
    };
  }
  if (changeType === "fixed") {
    return {
      ...chipBase,
      background: "var(--crit-wash)",
      color: "var(--crit)",
      border: "1px solid var(--crit)",
    };
  }
  // improved / default
  return {
    ...chipBase,
    background: "var(--ochre-wash, var(--surface-sunk))",
    color: "var(--ochre, var(--ink-soft))",
    border: "1px solid var(--ochre, var(--rule-strong))",
  };
}

const moduleChipStyle: CSSProperties = {
  ...chipBase,
  background: "var(--green-wash)",
  color: "var(--green-deep)",
  border: "1px solid var(--green-soft)",
};

const saveBtnStyle: CSSProperties = {
  padding: "8px 20px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--green-deep)",
  color: "var(--surface)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};

const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 500,
  background: "var(--surface)",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  fontFamily: "var(--sans)",
};
