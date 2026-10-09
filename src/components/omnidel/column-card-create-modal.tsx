"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LIST_COLOR_PALETTE } from "@/components/omnidel/task-board";
import { AcharyaPicker } from "@/components/omnidel/acharya-picker";
import { useTr } from "@/lib/client/language";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string, acharyaId?: string | null) => Promise<void>;
  onCreated?: () => void;
}

export function ColumnCardCreateModal({ open, onClose, onCreate, onCreated }: Props) {
  const tr = useTr();
  const [name, setName] = useState("");
  const [color, setColor] = useState(LIST_COLOR_PALETTE[0].value);
  const [acharyaId, setAcharyaId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(LIST_COLOR_PALETTE[0].value);
    setAcharyaId(null);
    setError("");
    setSaving(false);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(name.trim(), color, acharyaId);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-column-card-title"
        style={{
          width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          background: "var(--surface)", border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
          padding: "24px 28px", position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Close")}
          style={{
            position: "absolute", top: 14, right: 14, width: 30, height: 30,
            borderRadius: "var(--r-sm)", background: "transparent",
            borderWidth: 0, cursor: "pointer", color: "var(--ink-soft)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, lineHeight: 1,
          }}
        >×</button>

        <div style={{ marginBottom: 20, paddingRight: 40 }}>
          <input
            id="new-column-card-title"
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder={tr("List name")}
            style={{
              width: "100%", padding: "6px 10px", fontSize: 22, fontWeight: 600,
              fontFamily: "var(--serif)", color: "var(--ink)",
              background: "var(--page)", border: "1px solid var(--rule-strong)",
              borderRadius: "var(--r-sm)",
            }}
          />
        </div>

        {error && (
          <div style={{
            color: "var(--crit)", fontSize: 13, marginBottom: 16,
            padding: "8px 12px", background: "var(--surface-sunk)",
            borderRadius: "var(--r-sm)",
          }}>{error}</div>
        )}

        <section>
          <SectionTitle>{tr("Color")}</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LIST_COLOR_PALETTE.map((c) => {
              const selected = color.toLowerCase() === c.value.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setColor(c.value)}
                  style={{
                    width: 30, height: 30, borderRadius: "50%", cursor: "pointer",
                    background: c.value,
                    borderWidth: 2, borderStyle: "solid",
                    borderColor: selected ? "var(--ink)" : "transparent",
                    boxShadow: selected ? "0 0 0 2px var(--surface)" : "none",
                    outline: "none", flexShrink: 0,
                  }}
                />
              );
            })}
          </div>
        </section>

        <section style={{ marginTop: 16 }}>
          <AcharyaPicker
            value={acharyaId}
            onChange={setAcharyaId}
          />
        </section>

        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} disabled={saving} style={cancelBtnStyle}>{tr("Cancel")}</button>
          <button type="button" onClick={() => void handleCreate()} disabled={saving || !name.trim()} style={saveBtnStyle}>
            {saving ? tr("Creating...") : tr("Create List")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "var(--serif)", fontSize: 14, margin: "0 0 8px 0", color: "var(--ink)",
    }}>{children}</h3>
  );
}

const saveBtnStyle: CSSProperties = {
  padding: "8px 20px", fontSize: 12, fontWeight: 500,
  background: "var(--green-deep)", color: "var(--surface)",
  borderWidth: 1, borderStyle: "solid", borderColor: "var(--green-deep)",
  borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "var(--sans)",
};
const cancelBtnStyle: CSSProperties = {
  padding: "8px 14px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};
