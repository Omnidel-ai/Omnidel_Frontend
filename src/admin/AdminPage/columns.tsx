import { Badge, type BadgeTone, type Column } from "../../components";
import type { DemoColumn, DemoRow } from "../../data/types";

/**
 * Descriptor column → table column.
 *
 * One renderer per declared type, so a master adds a column by naming a type
 * in JSON rather than by writing a cell. Nothing here knows what a lane or a
 * language is; it knows what a code, a percentage and a swatch look like.
 */
export function toColumn(c: DemoColumn): Column<DemoRow> {
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
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>
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
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)" }}>
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
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--green-deep)",
                  color: "#f4efdf",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(name)}
              </span>
              <span className="picker-truncate">{name}</span>
            </span>
          );
        },
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
    <span style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
      {empty ? "—" : `${value}${suffix}`}
    </span>
  );
}

function Muted() {
  return <span style={{ color: "var(--ink-faint)" }}>—</span>;
}

function str(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
