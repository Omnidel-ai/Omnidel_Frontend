"use client";

import { useRouter } from "next/navigation";
import { CustomSelect } from "./custom-select";
import { DatePicker } from "./date-picker";
import { useIsMobile } from "@/lib/client/use-is-mobile";
import { BreadcrumbTrail } from "@/components/omnidel/breadcrumb-trail";
import { useTr } from "@/lib/client/language";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "select" | "checkbox" | "number";
  placeholder?: string;
  options?: { value: string; label: string }[];
  full?: boolean;
  readOnly?: boolean;
}

export function MasterFormShell({ title, breadcrumb, subtitle, headerExtra, hero, children, plainBody }: {
  title?: string;
  breadcrumb: { label: string; href?: string }[];
  subtitle?: string;
  headerExtra?: React.ReactNode;
  hero?: React.ReactNode;
  children: React.ReactNode;
  plainBody?: boolean;
}) {
  const tr = useTr();
  const router = useRouter();
  const isMobile = useIsMobile();
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontFamily: "var(--serif)", minWidth: 0, flex: "1 1 160px", display: "flex", overflow: "hidden", margin: 0 }}>
            <BreadcrumbTrail crumbs={breadcrumb} onNavigate={(href) => router.push(href)} />
          </h2>
          {headerExtra != null && (
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
              {headerExtra}
            </div>
          )}
        </div>
      </div>
      {hero}
      {plainBody ? (
        children
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", padding: isMobile ? "18px 16px" : "28px 32px" }}>
          {title && <h3 style={{ fontFamily: "var(--serif)", marginBottom: 24, fontSize: 18 }}>{tr(title)}</h3>}
          {children}
        </div>
      )}
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  // Max 2 fields per row (never 3 — too cramped); single column on mobile.
  return <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "20px 24px" }}>{children}</div>;
}

export function FormField({ label, value, onChange, placeholder, full, type = "text", readOnly, textarea, rows = 3, mono }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; full?: boolean; type?: string; readOnly?: boolean;
  textarea?: boolean; rows?: number; mono?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    background: "var(--surface-sunk)",
    border: "1px solid var(--rule)",
    borderRadius: "var(--r-sm)", color: readOnly ? "var(--ink-mute)" : "var(--ink)",
    outline: "none", fontFamily: mono ? "var(--mono)" : "var(--sans)",
    boxSizing: "border-box",
    cursor: readOnly ? "not-allowed" : "text",
  };
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
        {label}
      </label>
      {type === "date" ? (
        <DatePicker
          value={value}
          onChange={(v) => onChange?.(v)}
          placeholder={placeholder || "dd-mm-yyyy"}
          disabled={readOnly}
        />
      ) : textarea ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          style={{ ...inputStyle, lineHeight: 1.5, resize: "vertical" }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          style={inputStyle}
        />
      )}
    </div>
  );
}

export function FormSelect({ label, value, onChange, options, full }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; full?: boolean;
}) {
  const tr = useTr();
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
        {label}
      </label>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={tr("Select...")}
      />
    </div>
  );
}

export function FormCheckbox({ label, checked, onChange, optionLabel }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  /** When set, always show this text beside the checkbox (instead of Yes/No). */
  optionLabel?: string;
}) {
  const tr = useTr();
  return (
    <div>
      <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6 }}>
        {label}
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 10px", background: "var(--surface-sunk)", border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", width: "100%" }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: "var(--green-deep)" }} />
        <span style={{ fontSize: 13 }}>{optionLabel ?? (checked ? tr("Yes") : tr("No"))}</span>
      </label>
    </div>
  );
}

export function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p style={{ color: "var(--crit)", fontSize: 12, marginTop: 16, background: "var(--crit-wash)", padding: "6px 10px", borderRadius: "var(--r-sm)" }}>
      {error}
    </p>
  );
}

export function FormActions({ saveLabel, saving, onSave, onCancel }: {
  saveLabel: string; saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const tr = useTr();
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      <button onClick={onSave} disabled={saving} style={{
        padding: "9px 20px", fontSize: 13, fontWeight: 500,
        background: "var(--green-deep)", color: "#f4efdf",
        border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
        cursor: "pointer", fontFamily: "var(--sans)",
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? tr("Saving...") : saveLabel}
      </button>
      <button onClick={onCancel} style={{
        padding: "9px 20px", fontSize: 13, fontWeight: 500,
        background: "var(--surface)", color: "var(--ink-soft)",
        border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
        cursor: "pointer", fontFamily: "var(--sans)",
      }}>
        {tr("Cancel")}
      </button>
    </div>
  );
}

export const backBtnStyle: React.CSSProperties = {
  padding: "7px 14px", fontSize: 12, fontWeight: 500,
  background: "var(--surface)", color: "var(--ink-soft)",
  border: "1px solid var(--rule-strong)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

export const editBtnStyle: React.CSSProperties = {
  padding: "7px 16px", fontSize: 12, fontWeight: 500,
  background: "var(--green-deep)", color: "#f4efdf",
  border: "1px solid var(--green-deep)", borderRadius: "var(--r-sm)",
  cursor: "pointer", fontFamily: "var(--sans)",
};

/**
 * A read-only label/value pair on a view page.
 *
 * `boxed` gives the value the same sunk, ruled box a `FormField` input has. The
 * plain variant sets a value as bare text on the card, which on a view page with
 * four or five of them reads as loose prose rather than as fields — the eye has
 * nothing telling it where one value ends and the next begins, and the same
 * record looks unlike its own edit form. The box is the affordance those pages
 * were missing.
 *
 * It is a variant rather than a change to the default because this component is
 * on OmniMart pipeline, schedule sites and operations, OmniVarsity progress and
 * the OmniStudio ads detail pages. Restyling all of them is a decision for
 * whoever is looking at all of them; when that decision is taken, flipping this
 * default is the whole change.
 *
 * `boxed` deliberately does NOT make it look editable beyond the background: no
 * focus ring, no cursor change, and it stays a div. A read-only value that
 * invites a click it will not honour is worse than plain text.
 */
export function DetailItem({ label, children, boxed }: {
  label: string;
  children: React.ReactNode;
  boxed?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 6,
      }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--ink)",
          wordBreak: "break-word",
          ...(boxed
            ? {
                background: "var(--surface-sunk)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r-sm)",
                // Matches FormField's input padding so a view page and its edit
                // form put the same value in the same place on the page.
                padding: "9px 11px",
                // An empty value must not collapse the box to a ruled line.
                minHeight: 38,
              }
            : null),
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Standalone card for grouped details — same style as content view's Translations/Sections cards
export function ViewCard({ title, children, headerExtra }: {
  title: string; children: React.ReactNode; headerExtra?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--rule)",
      borderRadius: "var(--r-md)", padding: isMobile ? "18px 16px" : "28px 32px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{title}</h3>
        {headerExtra}
      </div>
      {children}
    </div>
  );
}

// 3-column translation grid — matches the colored language boxes in content view
export function TranslationGrid({ items }: {
  items: { lang: "EN" | "BN" | "HI"; title: string | null; subtitle?: string | null; status?: string }[];
}) {
  const tr = useTr();
  const isMobile = useIsMobile();
  const colors: Record<string, { bg: string; fg: string }> = {
    EN: { bg: "var(--green-wash)", fg: "var(--green-deep)" },
    BN: { bg: "var(--ochre-wash)", fg: "var(--ochre)" },
    HI: { bg: "var(--terra-wash)", fg: "var(--terracotta)" },
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
      {items.map((item) => {
        const c = colors[item.lang];
        return (
          <div key={item.lang} style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span className="tag" style={{ background: c.bg, color: c.fg }}>{item.lang}</span>
              {item.status && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-faint)", textTransform: "uppercase" }}>
                  {tr(item.status)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.title || "—"}</div>
            {item.subtitle !== undefined && (
              <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{item.subtitle || tr("No description")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatusTag({ active }: { active: boolean }) {
  const tr = useTr();
  return (
    <span className="tag" style={{
      background: active ? "var(--ok-wash)" : "var(--crit-wash)",
      color: active ? "var(--ok)" : "var(--crit)",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "var(--ok)" : "var(--crit)" }} />
      {active ? tr("ACTIVE") : tr("INACTIVE")}
    </span>
  );
}

// Hero card shown above the details on all View pages
export function HeroCard({ title, subtitle, meta, status, avatarUrl }: {
  title: string;
  subtitle?: string;
  meta?: string;
  status: boolean;
  avatarUrl?: string | null;
}) {
  const isMobile = useIsMobile();
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--rule)",
      borderRadius: "var(--r-md)", padding: isMobile ? "20px 16px" : "24px 28px", marginBottom: 16,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      flexWrap: "wrap", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", minWidth: 0 }}>
        {(avatarUrl || initials) && (
          <div style={{
            width: 56, height: 56, borderRadius: "var(--r-md)", border: "1px solid var(--rule)",
            background: "var(--surface-sunk)", overflow: "hidden", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink-mute)",
          }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--serif)", marginBottom: 4 }}>{title}</div>
          {subtitle && <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-mute)" }}>{subtitle}</div>}
          {meta && <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>{meta}</div>}
        </div>
      </div>
      <StatusTag active={status} />
    </div>
  );
}
