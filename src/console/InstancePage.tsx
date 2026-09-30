import { useState } from "react";
import { Button, ConfirmDialog, EmptyState, Panel, SubTabs, emitToast } from "../components";
import { LockGlyph, StatusBadge } from "./bits";
import type { Instance } from "./types";

export interface InstancePageProps {
  instance: Instance;
}

const TABS = ["Overview", "People", "Modules", "Billing", "Activity"];

/**
 * One instance's record: the workspace facts, its lifecycle once it is on the
 * way out, and the support-session entry point.
 *
 * Only Overview has content — the other tabs are the console's, and wait on
 * its backend for their data.
 */
export function InstancePage({ instance }: InstancePageProps) {
  const [tab, setTab] = useState("Overview");
  const [confirmArchive, setConfirmArchive] = useState(false);

  return (
    <div className="console-record">
      <SubTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Instance sections" />

      <header className="console-head console-head--record">
        <h2 className="console-head__title">{instance.name}</h2>
        <div className="console-support">
          <Button variant="secondary" disabled iconLeft={<LockGlyph />} style={{ width: "100%", gap: 8 }}>
            Open a support session
          </Button>
          <p className="console-support__note">
            Not available yet: there is no support view to enter the instance with. Opening a session now would tell
            the customer we looked when we could not.
          </p>
        </div>
      </header>

      {tab === "Overview" ? (
        <div className="console-stack">
          <Panel title="Workspace" actions={<StatusBadge status={instance.status} />}>
            <dl className="console-facts">
              <dt>Prefix</dt>
              <dd className="console-mono">{instance.prefix}</dd>
              <dt>Seats</dt>
              <dd>{instance.seats}</dd>
              <dt>Modules</dt>
              <dd>
                {instance.modules.length > 0 ? (
                  <span className="console-chips">
                    {instance.modules.map((m) => (
                      <span key={m} className="console-chip">
                        {m}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="console-none">None</span>
                )}
              </dd>
              <dt>Created</dt>
              <dd>{instance.createdLong}</dd>
            </dl>
          </Panel>

          {instance.lifecycle && (
            <Panel title="Lifecycle" flush>
              <dl className="console-facts console-facts--padded">
                {instance.lifecycle.map((l) => (
                  <div key={l.label} style={{ display: "contents" }}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="console-panel-foot">
                <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              </div>
            </Panel>
          )}
        </div>
      ) : (
        <EmptyState
          size="card"
          title={`${tab} is not in the preview yet`}
          description="This tab fills in once the console's backend exists."
        />
      )}

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive ${instance.name}?`}
        description="Archiving starts the deletion countdown. The customer's data is deleted when the export window ends."
        confirmLabel="Archive"
        confirmTone="danger"
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false);
          emitToast("Preview only — nothing was archived.", "info");
        }}
      />
    </div>
  );
}
