import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Panel,
  StatTile,
  StatusToggle,
  SubTabs,
  Table,
  emitToast,
  formatInr,
  type Column,
} from "../../components";
import { LockGlyph, ModuleChips, SeatMeter, StatusBadge } from "./bits";
import {
  daysFrom,
  formatDate,
  relative,
  type Instance,
  type InstanceEvent,
  type InstanceInvoice,
  type InstancePerson,
  type InstancesData,
} from "./types";

export interface InstancePageProps {
  instance: Instance;
  data: InstancesData;
  /** Back to the list — also what "Leave this instance" does. */
  onBack: () => void;
}

const TABS = ["Overview", "People", "Modules", "Billing", "Activity"];

/**
 * One instance, from the platform side.
 *
 * The strip across the top is the one thing that must never be missed: staff
 * are looking at a customer's workspace, not their own, and the way out is on
 * it. Below, the Overview answers the two questions support arrives with —
 * what does this customer have, and what happens to them next — with the
 * lifecycle drawn as a timeline so "Grace ends 9 Oct" reads against today
 * rather than as a bare date.
 */
export function InstancePage({ instance: i, data, onBack }: InstancePageProps) {
  const [tab, setTab] = useState("Overview");
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [modules, setModules] = useState(i.modules);

  const people = i.people ?? [];
  const activity = i.activity ?? [];

  return (
    <div>
      <div className="inst-viewing" role="status">
        <WarnGlyph />
        <span>
          Viewing <strong>{i.name}</strong> <span className="inst-viewing__prefix">· {i.prefix}</span>
        </span>
        <button type="button" className="inst-viewing__leave" onClick={onBack}>
          Leave this instance
        </button>
      </div>

      <PageHeader
        eyebrow="OmniDel platform · Instance"
        crumbs={[{ label: "Admin" }, { label: "Platform" }, { label: "Instances", href: "/admin/instances" }, { label: i.name }]}
        onNavigate={onBack}
        marginBottom={12}
        actions={
          <>
            <StatusBadge status={archived ? "Closing" : i.status} />
            <Button variant="secondary" size="sm" disabled title="Not available yet" iconLeft={<LockGlyph />}>
              Open a support session
            </Button>
          </>
        }
      />

      <p className="inst-note">
        <LockGlyph />
        <span>
          <strong>Support sessions are not available yet.</strong> There is no support view to enter the
          instance with, and opening a session now would tell the customer we looked when we could not.
        </span>
      </p>

      <div className="inst-tabs">
        <SubTabs
          tabs={TABS}
          active={tab}
          onChange={setTab}
          counts={{ People: people.length, Modules: modules.length, Activity: activity.length }}
          ariaLabel="Instance sections"
        />
      </div>

      {tab === "Overview" && (
        <Overview
          i={i}
          today={data.today}
          modules={modules}
          moduleTotal={data.modules.length}
          archived={archived}
          onArchive={() => setArchiving(true)}
        />
      )}
      {tab === "People" && <People people={people} seats={i.seats} />}
      {tab === "Modules" && (
        <Modules
          all={data.modules}
          on={modules}
          onToggle={(m, next) => {
            setModules((cur) => (next ? [...cur, m] : cur.filter((x) => x !== m)));
            emitToast(`${m} turned ${next ? "on" : "off"} for ${i.name}`, "success");
          }}
        />
      )}
      {tab === "Billing" && <Billing invoices={i.invoices ?? []} />}
      {tab === "Activity" && <Activity events={activity} />}

      <ConfirmDialog
        open={archiving}
        title={`Archive ${i.name}?`}
        description={`Archiving starts the deletion countdown. The customer can still export their data until ${
          i.lifecycle ? formatDate(i.lifecycle.exportEnds) : "the export window closes"
        }; after that only an owner can approve deleting it.`}
        requireText={{ label: `Type ${i.prefix} to confirm`, placeholder: i.prefix, minLength: i.prefix.length }}
        confirmLabel="Archive instance"
        confirmTone="danger"
        onCancel={() => setArchiving(false)}
        onConfirm={(text) => {
          if (text?.trim() !== i.prefix) {
            emitToast(`That is not ${i.prefix} — nothing was archived`);
            return;
          }
          setArchived(true);
          setArchiving(false);
          emitToast(`${i.name} archived — deletion countdown started`, "success");
        }}
      />
    </div>
  );
}

function Overview({
  i,
  today,
  modules,
  moduleTotal,
  archived,
  onArchive,
}: {
  i: Instance;
  today: string;
  modules: string[];
  moduleTotal: number;
  archived: boolean;
  onArchive: () => void;
}) {
  const lc = i.lifecycle;
  const steps = [
    { label: "Created", date: i.created },
    ...(lc
      ? [
          { label: "Suspended", date: lc.suspended },
          { label: "Grace ends", date: lc.graceEnds, hint: "Last day to pay and reactivate" },
          { label: "Export window ends", date: lc.exportEnds, hint: "After this the data can be deleted" },
        ]
      : i.trialEnds
        ? [{ label: "Trial ends", date: i.trialEnds, hint: "Becomes a paid instance, or pauses" }]
        : []),
  ];
  const next = steps.find((s) => daysFrom(today, s.date) >= 0);

  return (
    <>
      <div className="inst-tiles">
        <StatTile label="seats used" value={`${i.seats.used}`} hint={i.seats.cap ? `of ${i.seats.cap}` : "Uncapped trial"} />
        <StatTile label="modules on" value={String(modules.length)} hint={`of ${moduleTotal}`} />
        <StatTile label="created" value={formatDate(i.created).split(" ").slice(0, 2).join(" ")} hint={relative(today, i.created)} />
        {next ? (
          <StatTile
            label={next.label.toLowerCase()}
            value={`${daysFrom(today, next.date)}d`}
            hint={formatDate(next.date)}
            tone={lc ? "crit" : undefined}
          />
        ) : (
          <StatTile label="next step" value="—" hint="Nothing scheduled" />
        )}
      </div>

      <div className="inst-grid">
        <Panel title="Workspace" subtitle="What the customer has">
          <dl className="inst-dl">
            <dt>Prefix</dt>
            <dd>
              <code className="inst-code">{i.prefix}</code>
            </dd>
            <dt>Owner</dt>
            <dd>
              {i.owner ? (
                <span className="inst-two">
                  <span>{i.owner.name}</span>
                  <span className="inst-two__sub">{i.owner.email}</span>
                </span>
              ) : (
                <span className="inst-none">Not claimed yet</span>
              )}
            </dd>
            <dt>Seats</dt>
            <dd>
              <SeatMeter {...i.seats} />
            </dd>
            <dt>Modules</dt>
            <dd>
              <ModuleChips modules={modules} max={6} />
            </dd>
            <dt>Created</dt>
            <dd>{formatDate(i.created, "long")}</dd>
          </dl>
        </Panel>

        <Panel title="Lifecycle" subtitle={lc ? "Closing — in grace" : "What happens next"} accent={lc ? "crit" : undefined}>
          <ol className={lc ? "inst-steps inst-steps--crit" : "inst-steps"}>
            {steps.map((s) => {
              const d = daysFrom(today, s.date);
              const state = d < 0 ? "done" : s === next ? "next" : d === 0 ? "next" : "later";
              return (
                <li key={s.label} className={`inst-step inst-step--${state}`}>
                  <span className="inst-step__dot" aria-hidden="true" />
                  <span className="inst-step__body">
                    <span className="inst-step__label">{s.label}</span>
                    {s.hint && <span className="inst-step__hint">{s.hint}</span>}
                  </span>
                  <span className="inst-step__when">
                    <span>{formatDate(s.date)}</span>
                    <span className="inst-step__rel">{relative(today, s.date)}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {lc && (
            <div className="inst-danger">
              <span>
                <strong>{archived ? "Archived." : "Archive this instance"}</strong>
                <span className="inst-danger__sub">
                  {archived
                    ? "The deletion countdown has started."
                    : "Starts the deletion countdown. Needs the Archive permission."}
                </span>
              </span>
              <Button variant="danger" size="sm" onClick={onArchive} disabled={archived}>
                {archived ? "Archived" : "Archive"}
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function People({ people, seats }: { people: InstancePerson[]; seats: Instance["seats"] }) {
  const columns: Column<InstancePerson>[] = [
    {
      key: "name",
      header: "Person",
      width: "minmax(220px, 2fr)",
      render: (p) => (
        <span className="inst-name">
          <Avatar name={p.name} size={28} />
          <span className="inst-two">
            <span>{p.name}</span>
            <span className="inst-two__sub">{p.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "120px",
      render: (p) => <Badge tone={p.role === "Owner" ? "terra" : "neutral"}>{p.role}</Badge>,
    },
    {
      key: "lastSeen",
      header: "Last seen",
      width: "130px",
      render: (p) => <span className="inst-date">{formatDate(p.lastSeen)}</span>,
    },
  ];
  return (
    <>
      <p className="inst-count" style={{ marginBottom: 10 }}>
        {seats.used} of {seats.cap ?? "unlimited"} seats in use
      </p>
      <Table
        columns={columns}
        data={people}
        rowKey={(p) => p.email}
        minWidth={560}
        minHeight={0}
        emptyMessage="Nobody has joined yet"
        emptyHint="The first person to sign in becomes the owner."
      />
    </>
  );
}

function Modules({ all, on, onToggle }: { all: string[]; on: string[]; onToggle: (m: string, next: boolean) => void }) {
  return (
    <Panel title="Modules" subtitle={`${on.length} of ${all.length} on`} flush>
      <ul className="inst-modules">
        {all.map((m) => {
          const active = on.includes(m);
          return (
            <li key={m} className="inst-module">
              <span className="inst-two">
                <span>{m}</span>
                <span className="inst-two__sub">{active ? "On — the customer sees it in their sidebar" : "Off"}</span>
              </span>
              <StatusToggle active={active} onToggle={(next) => onToggle(m, next)} label={`${m} ${active ? "on" : "off"}`} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Billing({ invoices }: { invoices: InstanceInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        size="card"
        title="No invoices yet"
        description="The first invoice is raised at the end of the first paid month."
      />
    );
  }
  const tone = { Paid: "ok", Due: "ochre", Overdue: "crit" } as const;
  const columns: Column<InstanceInvoice>[] = [
    { key: "no", header: "Invoice", width: "120px", render: (v) => <code className="inst-code">{v.no}</code> },
    { key: "period", header: "Period", width: "minmax(120px, 1fr)" },
    { key: "due", header: "Due", width: "120px", render: (v) => <span className="inst-date">{formatDate(v.due)}</span> },
    { key: "status", header: "Status", width: "110px", render: (v) => <Badge tone={tone[v.status]}>{v.status}</Badge> },
    { key: "amount", header: "Amount", width: "120px", align: "right", render: (v) => formatInr(v.amount) },
  ];
  return <Table columns={columns} data={invoices} rowKey={(v) => v.no} minWidth={600} minHeight={0} />;
}

function Activity({ events }: { events: InstanceEvent[] }) {
  if (events.length === 0) return <EmptyState size="card" title="Nothing has happened here yet" />;
  return (
    <Panel title="Activity" subtitle="Newest first" flush>
      <ol className="inst-activity">
        {events.map((e) => (
          <li key={e.at + e.what} className={`inst-event${e.tone ? ` inst-event--${e.tone}` : ""}`}>
            <span className="inst-event__dot" aria-hidden="true" />
            <span className="inst-two">
              <span>{e.what}</span>
              <span className="inst-two__sub">{e.who}</span>
            </span>
            <span className="inst-date">
              {formatDate(e.at)} · {e.at.slice(11)}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function WarnGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
