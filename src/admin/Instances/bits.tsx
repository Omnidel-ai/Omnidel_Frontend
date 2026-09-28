import { Badge } from "../../components";
import { STATUS_TONE, statusDot, type InstanceStatus } from "./types";

/** "2 / 100" over a thin bar; an uncapped trial reads "0 / ∞" with no bar. */
export function SeatMeter({ used, cap }: { used: number; cap: number | null }) {
  return (
    <span className="inst-seats">
      <span className="inst-seats__n">
        {used} <span className="inst-seats__cap">/ {cap ?? "∞"}</span>
      </span>
      {cap != null && (
        <span className="inst-seats__bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ status }: { status: InstanceStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={statusDot(status)}>
      {status}
    </Badge>
  );
}

/** Square initials tile — an instance has no portrait, only a name. */
export function InstanceMark({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span className="inst-mark" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function ModuleChips({ modules, max = 3 }: { modules: string[]; max?: number }) {
  if (modules.length === 0) return <span className="inst-none">None yet</span>;
  const shown = modules.slice(0, max);
  return (
    <span className="inst-chips">
      {shown.map((m) => (
        <span key={m} className="inst-chip">
          {m}
        </span>
      ))}
      {modules.length > max && <span className="inst-chip inst-chip--more">+{modules.length - max}</span>}
    </span>
  );
}

export function LockGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
