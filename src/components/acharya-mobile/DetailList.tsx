import type { ReactNode } from "react";
import { Card } from "./Card";
import { PersonAvatar } from "./PersonAvatar";

export interface DetailRow {
  label: string;
  value: ReactNode;
}

export interface DetailListProps {
  rows: DetailRow[];
  /** Two columns on Contractor's Account card; one or two in Kaarigar's detail groups. */
  columns?: 1 | 2;
  /** Shown, dimmed, where a value is empty — "Not added". */
  emptyValue?: string;
}

/**
 * Label over value, as a real `<dl>`. Contractor's Profile → Account grid and
 * Kaarigar's `DetailGroup` rows (contact, work, location, about) are the same
 * thing: a small label, the value under it, and a placeholder when empty.
 */
export function DetailList({ rows, columns = 2, emptyValue = "—" }: DetailListProps) {
  return (
    <dl className={`am-details${columns === 2 ? " am-details--2" : ""}`}>
      {rows.map((row) => {
        const empty = row.value === null || row.value === undefined || (typeof row.value === "string" && !row.value.trim());
        return (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd data-empty={empty ? "" : undefined}>{empty ? emptyValue : row.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export interface ProfileHeroProps {
  name: string;
  /** Keeps the avatar colour fixed when `name` is transliterated. */
  colorKey?: string;
  imageUrl?: string | null;
  /** The line under the name — usually the phone number. */
  meta?: ReactNode;
  /** A role or status tag beside the meta line. */
  tag?: ReactNode;
  /** Trailing control — edit, settings. */
  action?: ReactNode;
  /** `ochre` — Contractor's wash card. `forest` — Kaarigar's dark identity card (PR #207). */
  tone?: "ochre" | "forest";
}

/**
 * The top of Profile in both apps: a big avatar, the person's name, their
 * phone number and a role tag. Contractor puts it on an ochre wash; Kaarigar's
 * PR #207 made it a solid dark green card.
 */
export function ProfileHero({ name, colorKey, imageUrl, meta, tag, action, tone = "forest" }: ProfileHeroProps) {
  return (
    <Card tone={tone} style={{ boxShadow: "var(--shadow-md)" }}>
      <div className="am-hero">
        <PersonAvatar name={name} colorKey={colorKey} imageUrl={imageUrl} size="xl" ring={tone === "forest"} />
        <div className="am-hero__text">
          <p className="am-hero__name">{name}</p>
          {(meta || tag) && (
            <p className="am-hero__meta">
              {meta}
              {tag}
            </p>
          )}
        </div>
        {action}
      </div>
    </Card>
  );
}
