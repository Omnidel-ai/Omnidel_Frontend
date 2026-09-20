import { useState } from "react";
import { Badge, Button, NoAccessScreen, PageHeader, StatusToggle, emitToast } from "../components";
import { Case, Section } from "./Case";

export function ChromeSection() {
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <Section id="chrome" title="Page header, badges & states">
      <Case label="PageHeader — trail, eyebrow, actions" stack>
        <div className="pg-card">
          <PageHeader
            eyebrow="Masters"
            crumbs={[{ label: "OmniMart" }, { label: "Lanes", href: "/omnimart/lanes" }, { label: "Lane 12" }]}
            onNavigate={(href) => emitToast(`Would navigate to ${href}`, "info")}
            actions={
              <>
                <Button variant="secondary" size="sm">
                  Export
                </Button>
                <Button size="sm">+ Add Lane</Button>
              </>
            }
          />
        </div>
        <div className="pg-card">
          <PageHeader
            crumbs={[
              { label: "OmniPulse" },
              { label: "Boards", href: "/omnipulse/boards" },
              { label: "Q3 Planning", href: "/omnipulse/boards/q3" },
              { label: "Sprint 4", href: "/omnipulse/boards/q3/s4" },
              { label: "Newtown consolidation lane rollout, phase two — reviewed every quarter" },
            ]}
            onNavigate={(href) => emitToast(`Would navigate to ${href}`, "info")}
          />
        </div>
      </Case>

      <Case label="Badge tones">
        <Badge>neutral</Badge>
        <Badge tone="green">green</Badge>
        <Badge tone="terra">terra</Badge>
        <Badge tone="ochre">ochre</Badge>
        <Badge tone="ok">ok</Badge>
        <Badge tone="amber">amber</Badge>
        <Badge tone="crit">crit</Badge>
        <Badge tone="neutral" dot="var(--terracotta)">
          with dot
        </Badge>
      </Case>

      <Case label="StatusToggle — on · off · busy · disabled">
        <StatusToggle active={live} onToggle={setLive} />
        <StatusToggle active={false} onToggle={() => undefined} />
        <StatusToggle
          active={busy}
          busy={busy}
          onToggle={(next) => {
            setBusy(next);
            window.setTimeout(() => setBusy(false), 1200);
          }}
        />
        <StatusToggle active disabled onToggle={() => undefined} />
      </Case>

      <Case label="NoAccessScreen" stack>
        <div className="pg-card" style={{ padding: 0 }}>
          <NoAccessScreen
            area="Pricing"
            action={
              <Button variant="secondary" size="sm" onClick={() => emitToast("Request sent", "success")}>
                Request access
              </Button>
            }
          />
        </div>
      </Case>
    </Section>
  );
}
