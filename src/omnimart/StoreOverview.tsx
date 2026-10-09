import { Badge, Button, Skeleton, emitToast, formatCompactInr, type BadgeTone } from "../components/common";
import type { ListOverview } from "../lists";

const TONE: Record<string, BadgeTone> = {
  critical: "crit",
  watch: "amber",
  ok: "ok",
};

/**
 * Store's opening view: one tile per store, today against its target.
 *
 * A tile is a headline number, not a chart — the question it answers is "how
 * far along is this store today", and the bar is there to make the gap
 * legible at a glance rather than to be read precisely.
 */
export function StoreOverview({
  overview,
  loading,
}: {
  overview: ListOverview;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="mart-overview__head">
        <span className="mart-overview__eyebrow">{overview.eyebrow}</span>
        <h3 style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{overview.title}</h3>
      </div>

      <div className="mart-kpis">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="mart-kpi" aria-busy="true">
                <Skeleton width="30%" height={9} />
                <Skeleton width="55%" height={16} style={{ marginTop: 10 }} />
                <Skeleton width="45%" height={22} style={{ marginTop: 10 }} />
                <Skeleton shape="block" height={6} style={{ marginTop: 12 }} />
              </div>
            ))
          : overview.stores.map((s) => {
              const pct = s.target > 0 ? Math.min(100, Math.round((s.today / s.target) * 100)) : 0;
              return (
                <article key={s.id} className="mart-kpi">
                  <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mart-overview__eyebrow">Store</span>
                    <span style={{ marginLeft: "auto" }}>
                      <Badge tone={TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                    </span>
                  </header>

                  <h4 style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 6 }}>{s.name}</h4>

                  <p style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--serif)", fontSize: 26, lineHeight: 1 }}>
                      {formatCompactInr(s.today)}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>
                      of {formatCompactInr(s.target)}
                    </span>
                  </p>

                  <span className="mart-kpi__track" aria-hidden="true">
                    <span
                      className="mart-kpi__fill"
                      style={{
                        width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                        background: s.status === "critical" ? "var(--crit)" : "var(--green-deep)",
                      }}
                    />
                  </span>

                  <div style={{ marginTop: 12 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => emitToast(`${s.name} report — demo`, "info")}
                    >
                      Report
                    </Button>
                  </div>
                </article>
              );
            })}
      </div>
    </div>
  );
}
