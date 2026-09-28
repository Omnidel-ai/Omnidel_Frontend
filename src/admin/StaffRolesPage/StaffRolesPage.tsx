import { useMemo, useState, type CSSProperties } from "react";
import { Badge, Button, ConfirmDialog, PageHeader, TableScroll, emitToast } from "../../components";
import type { BadgeTone } from "../../components";

export interface StaffRole {
  key: string;
  label: string;
  tone: BadgeTone;
  members: number;
  summary: string;
  /** Holds every permission, always; its column is not editable. */
  fixed?: boolean;
}

export interface StaffPermission {
  key: string;
  label: string;
  /** Muted line under the label — what the permission sets in motion. */
  hint?: string;
  /** Role keys that hold this permission today. */
  grants: string[];
  /** Tag beside the label for the ones that are hard to undo. */
  risk?: "Serious" | "Destructive";
}

export interface StaffPermissionGroup {
  key: string;
  label: string;
  permissions: StaffPermission[];
}

export interface StaffRolesData {
  roles: StaffRole[];
  groups: StaffPermissionGroup[];
  /** Things no role but the owner may do, named under the matrix. */
  ownerOnly: string[];
}

export interface StaffRolesPageProps {
  data: StaffRolesData;
}

type Grants = Record<string, string[]>;
type Change = { role: StaffRole; perm: StaffPermission; granted: boolean };

const has = (g: Grants, perm: string, role: string) => g[perm]?.includes(role) ?? false;

/**
 * Staff roles — what each OmniDel staff role may do.
 *
 * One matrix, permissions down and roles across, grouped by what the
 * permission touches so a column reads as a job description rather than a
 * list of fourteen checkboxes. It follows the application's Roles &
 * Permissions screen: mono group labels with an x/y count, a group checkbox
 * that goes indeterminate, changed cells washed ochre until saved, and Save
 * only once there is something to save.
 *
 * The owner's column is drawn, not edited: showing "Always" keeps the reader
 * from wondering whether the owner was forgotten.
 */
export function StaffRolesPage({ data }: StaffRolesPageProps) {
  const initial = useMemo(() => {
    const g: Grants = {};
    for (const group of data.groups) for (const p of group.permissions) g[p.key] = p.grants;
    return g;
  }, [data.groups]);

  const [saved, setSaved] = useState<Grants>(initial);
  const [draft, setDraft] = useState<Grants>(initial);
  const [confirming, setConfirming] = useState(false);

  const permissions = useMemo(() => data.groups.flatMap((g) => g.permissions), [data.groups]);

  const changes = useMemo(() => {
    const out: Change[] = [];
    for (const perm of permissions)
      for (const role of data.roles) {
        if (role.fixed) continue;
        const now = has(draft, perm.key, role.key);
        if (now !== has(saved, perm.key, role.key)) out.push({ role, perm, granted: now });
      }
    return out;
  }, [draft, saved, permissions, data.roles]);

  function toggle(perm: string, role: string) {
    setDraft((d) => {
      const cur = d[perm] ?? [];
      return { ...d, [perm]: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] };
    });
  }

  function toggleGroup(group: StaffPermissionGroup, role: string) {
    const all = group.permissions.every((p) => has(draft, p.key, role));
    setDraft((d) => {
      const next = { ...d };
      for (const p of group.permissions) {
        const cur = next[p.key] ?? [];
        next[p.key] = all ? cur.filter((r) => r !== role) : cur.includes(role) ? cur : [...cur, role];
      }
      return next;
    });
  }

  function save() {
    // Where the write goes.
    setSaved(draft);
    setConfirming(false);
    emitToast(`${changes.length} ${changes.length === 1 ? "change" : "changes"} saved`, "success");
  }

  const total = permissions.length;
  const count = (role: StaffRole) =>
    role.fixed ? total : permissions.filter((p) => has(draft, p.key, role.key)).length;

  return (
    <div>
      <PageHeader
        eyebrow="OmniDel platform"
        crumbs={[{ label: "Admin" }, { label: "Platform" }, { label: "Staff roles" }]}
        actions={
          changes.length > 0 ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setDraft(saved)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => setConfirming(true)}>
                Save {changes.length} {changes.length === 1 ? "change" : "changes"}
              </Button>
            </>
          ) : (
            <span className="staff-roles__quiet">No unsaved changes</span>
          )
        }
      />

      <p className="staff-roles__lede">
        What each OmniDel staff role may do. A change applies on that person's next click.
      </p>

      <div className="staff-roles__strip">
        {data.roles.map((role) => {
          const n = count(role);
          return (
            <div key={role.key} className="staff-roles__role">
              <div className="staff-roles__role-head">
                <Badge tone={role.tone}>{role.label}</Badge>
                <span className="staff-roles__members">
                  {role.members} {role.members === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="staff-roles__role-count">
                <span className="staff-roles__role-n">{n}</span>
                <span className="staff-roles__role-of">of {total} permissions</span>
              </div>
              <div className="staff-roles__meter" aria-hidden="true">
                <span style={{ width: `${(n / total) * 100}%` }} />
              </div>
              <p className="staff-roles__role-sum">{role.summary}</p>
            </div>
          );
        })}
      </div>

      <TableScroll minWidth={680} minHeight={0}>
        <div className="table-header staff-roles__grid" style={gridStyle(data.roles.length)}>
          <span>Permission</span>
          {data.roles.map((r) => (
            <span key={r.key} className="staff-roles__col">
              {r.label}
            </span>
          ))}
        </div>

        {data.groups.map((group) => (
          <div key={group.key} role="rowgroup">
            <div className="table-row staff-roles__grid staff-roles__group" style={gridStyle(data.roles.length)}>
              <span className="staff-roles__group-label">{group.label}</span>
              {data.roles.map((role) => {
                const n = role.fixed
                  ? group.permissions.length
                  : group.permissions.filter((p) => has(draft, p.key, role.key)).length;
                return (
                  <span key={role.key} className="staff-roles__col staff-roles__group-cell">
                    {!role.fixed && (
                      <Check
                        checked={n === group.permissions.length}
                        indeterminate={n > 0 && n < group.permissions.length}
                        label={`All of ${group.label} for ${role.label}`}
                        onChange={() => toggleGroup(group, role.key)}
                      />
                    )}
                    <span className="staff-roles__group-n">
                      {n}/{group.permissions.length}
                    </span>
                  </span>
                );
              })}
            </div>

            {group.permissions.map((perm) => (
              <div key={perm.key} className="table-row staff-roles__grid" style={gridStyle(data.roles.length)}>
                <span className="table-cell--wrap">
                  <span className="staff-roles__perm">
                    {perm.label}
                    {perm.risk && <Badge tone={perm.risk === "Destructive" ? "crit" : "amber"}>{perm.risk}</Badge>}
                  </span>
                  {perm.hint && <span className="staff-roles__hint">{perm.hint}</span>}
                </span>
                {data.roles.map((role) => {
                  if (role.fixed) {
                    return (
                      <span key={role.key} className="staff-roles__col staff-roles__always" title="The owner holds every permission">
                        <LockGlyph /> Always
                      </span>
                    );
                  }
                  const on = has(draft, perm.key, role.key);
                  const changed = on !== has(saved, perm.key, role.key);
                  return (
                    <span
                      key={role.key}
                      className={changed ? "staff-roles__col staff-roles__cell staff-roles__cell--changed" : "staff-roles__col staff-roles__cell"}
                    >
                      <Check
                        checked={on}
                        label={`${role.label}: ${perm.label}`}
                        onChange={() => toggle(perm.key, role.key)}
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        ))}

      </TableScroll>

      <p className="staff-roles__foot">
        <LockGlyph />
        <span>
          <strong>Owner only.</strong> {data.ownerOnly.join(" and ")} — these cannot be given to another role.
        </span>
      </p>

      <ConfirmDialog
        open={confirming}
        title={`Save ${changes.length} ${changes.length === 1 ? "change" : "changes"} to staff roles?`}
        description={describe(changes) + " Each person picks this up on their next click."}
        confirmLabel="Save changes"
        onCancel={() => setConfirming(false)}
        onConfirm={save}
      />
    </div>
  );
}

function gridStyle(roles: number): CSSProperties {
  return { gridTemplateColumns: `minmax(240px, 1fr) repeat(${roles}, 96px)` };
}

/** "Billing gains Record a payment. Support loses See invoices." — first few, then a count. */
function describe(changes: Change[]): string {
  const shown = changes
    .slice(0, 3)
    .map((c) => `${c.role.label} ${c.granted ? "gains" : "loses"} “${c.perm.label}”.`);
  const rest = changes.length - shown.length;
  return shown.join(" ") + (rest > 0 ? ` And ${rest} more.` : "");
}

function Check({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      className="staff-roles__check"
      checked={checked}
      aria-label={label}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
    />
  );
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
