import { Avatar } from "../Avatar";
import { Badge, type BadgeTone } from "../Badge";
import type { Column } from "./Table";

/**
 * A column as JSON describes it — the shape `masters.json` and `omnimart.json`
 * both use. Deliberately not tied to either: a key, a header, a track width,
 * an alignment, and a named type that picks the renderer.
 */
export interface ColumnDescriptor {
  key: string;
  header: string;
  width?: string;
  type?: string;
  align?: "left" | "right" | "center";
  /** For `badge`: value → tone. */
  tones?: Record<string, string>;
  /** For `person`: the row key holding the muted line under the name. */
  sub?: string;
  /** For `person`: the row key holding a chip after the name, when set. */
  badge?: string;
}

/** The minimum a row must have to be rendered. */
export interface DescriptorRow {
  id: string;
  [key: string]: unknown;
}

/**
 * Descriptor column → table column.
 *
 * One renderer per declared type, so a screen adds a column by naming a type
 * in JSON rather than by writing a cell. Nothing here knows what a lane, a
 * language or a lead is; it knows what a code, a percentage, a swatch and a
 * rupee amount look like.
 *
 * Shared by the admin masters and the OmniMart work lists — the reason a lead
 * table and a language table feel like the same table.
 */
export function toColumn(c: ColumnDescriptor): Column<DescriptorRow> {
  const base = { key: c.key, header: c.header, width: c.width, align: c.align };

  switch (c.type) {
    case "code":
      return {
        ...base,
        render: (r) => (
          <code style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
            {str(r[c.key])}
          </code>
        ),
      };

    case "badge":
      return {
        ...base,
        render: (r) => {
          const v = str(r[c.key], "");
          if (!v) return <Muted />;
          return <Badge tone={(c.tones?.[v] as BadgeTone) ?? "neutral"}>{v}</Badge>;
        },
      };

    case "flag":
      return { ...base, render: (r) => (r[c.key] ? <Badge tone="green">Yes</Badge> : <Muted />) };

    case "number":
      return {
        ...base,
        align: c.align ?? "right",
        render: (r) => <Num value={r[c.key]} />,
      };

    case "percent":
      return {
        ...base,
        align: c.align ?? "right",
        render: (r) => <Num value={r[c.key]} suffix="%" />,
      };

    case "date":
      return {
        ...base,
        render: (r) => (
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-soft)" }}>
            {str(r[c.key])}
          </span>
        ),
      };

    case "color":
      return {
        ...base,
        render: (r) => {
          const v = str(r[c.key], "");
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  background: v || "var(--surface-sunk)",
                  border: "1px solid var(--rule-strong)",
                  flexShrink: 0,
                }}
              />
              <span className="ui-meta" >
                {v || "—"}
              </span>
            </span>
          );
        },
      };

    case "chips":
      return {
        ...base,
        render: (r) => {
          const list = Array.isArray(r[c.key]) ? (r[c.key] as unknown[]) : [];
          if (list.length === 0) return <Muted />;
          return (
            <span style={{ display: "flex", flexWrap: "wrap", gap: 4, minWidth: 0 }}>
              {list.slice(0, 3).map((v) => (
                <Badge key={String(v)} tone="neutral">
                  {String(v)}
                </Badge>
              ))}
              {list.length > 3 && (
                <span className="ui-meta-sm" >
                  +{list.length - 3}
                </span>
              )}
            </span>
          );
        },
      };

    case "user":
      return {
        ...base,
        render: (r) => {
          const name = str(r[c.key], "");
          if (!name) return <Muted />;
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Avatar name={name} size={22} />
              <span className="picker-truncate">{name}</span>
            </span>
          );
        },
      };

    /**
     * A person as two lines: their portrait, their name, and what they are.
     *
     * The application's acharya and kaarigar tables lead with this — the name
     * is the link to the record, so it is underlined, and the description sits
     * under it in the muted line rather than in a column of its own, where it
     * would be clipped.
     */
    case "person":
      return {
        ...base,
        render: (r) => {
          const name = str(r[c.key], "");
          if (!name) return <Muted />;
          const sub = c.sub ? str(r[c.sub], "") : "";
          const chip = c.badge ? str(r[c.badge], "") : "";
          return (
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar name={name} size={32} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span
                    className="picker-truncate"
                    style={{ textDecoration: "underline", textUnderlineOffset: 2 }}
                  >
                    {name}
                  </span>
                  {chip && <Badge tone="ochre">{chip}</Badge>}
                </span>
                {sub && (
                  <span
                    className="picker-truncate"
                    style={{ display: "block", fontSize: 12, color: "var(--ink-mute)" }}
                  >
                    {sub}
                  </span>
                )}
              </span>
            </span>
          );
        },
      };

    case "money":
      return {
        ...base,
        align: c.align ?? "right",
        render: (r) => {
          const v = r[c.key];
          if (v == null || v === "") return <Muted />;
          return (
            <span className="ui-num" >
              {formatCompactInr(Number(v))}
            </span>
          );
        },
      };

    // A record number that opens the record: mono, underlined, ink.
    case "link":
      return {
        ...base,
        render: (r) => (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--ink)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {str(r[c.key])}
          </span>
        ),
      };

    case "status":
      return {
        ...base,
        render: (r) =>
          r.is_archived ? (
            <Badge tone="neutral">Archived</Badge>
          ) : r.is_active ? (
            <Badge tone="ok">Active</Badge>
          ) : (
            <Badge tone="amber">Inactive</Badge>
          ),
      };

    default:
      return { ...base, render: (r) => <span>{str(r[c.key])}</span> };
  }
}

function Num({ value, suffix = "" }: { value: unknown; suffix?: string }) {
  const empty = value == null || value === "";
  return (
    <span className="ui-num" >
      {empty ? "—" : `${value}${suffix}`}
    </span>
  );
}

function Muted() {
  return <span style={{ color: "var(--ink-faint)" }}>—</span>;
}

/**
 * Indian digit grouping — 12,34,567, not 1,234,567.
 *
 * The app writes money this way everywhere, and a lakh grouped the Western way
 * reads as the wrong number to the people using it.
 */
export function formatInr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

/**
 * Compact rupees for a table cell or a tile — 25.8L, 29K, 0.
 *
 * Lakh and thousand, not million: these columns are read by people who think
 * in lakhs, and "2.6M" would be a translation they have to do in their head.
 */
export function formatCompactInr(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

function str(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}
