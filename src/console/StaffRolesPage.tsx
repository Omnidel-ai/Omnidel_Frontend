import { useState } from "react";
import { Panel, Table, type Column } from "../components";
import { ConsoleHeader } from "./bits";
import type { StaffPermission } from "./types";

export interface StaffRolesPageProps {
  roles: string[];
  permissions: StaffPermission[];
}

/**
 * Staff roles — what each OmniDel staff role may do.
 *
 * Roles across, permissions down. The owner column is not a choice: an owner
 * holds everything, so it reads "Always" instead of a box. Ticks are held in
 * memory until the console's backend exists.
 */
export function StaffRolesPage({ roles, permissions }: StaffRolesPageProps) {
  const [grants, setGrants] = useState(() => permissions.map((p) => new Set(p.grants)));

  const toggle = (row: number, role: string) =>
    setGrants((gs) =>
      gs.map((g, i) => {
        if (i !== row) return g;
        const next = new Set(g);
        if (next.has(role)) next.delete(role);
        else next.add(role);
        return next;
      }),
    );

  const columns: Column<StaffPermission>[] = [
    { key: "label", header: "Permission", width: "minmax(260px, 1fr)", wrap: true, render: (p) => p.label },
    ...roles.map<Column<StaffPermission>>((role) => ({
      key: role,
      header: role,
      width: "96px",
      align: "center",
      render: (p, i) => (
        <input
          type="checkbox"
          className="console-check"
          checked={grants[i].has(role)}
          onChange={() => toggle(i, role)}
          aria-label={`${role}: ${p.label}`}
        />
      ),
    })),
    {
      key: "owner",
      header: "Owner",
      width: "96px",
      align: "center",
      render: () => <span className="console-none">Always</span>,
    },
  ];

  return (
    <div>
      <ConsoleHeader
        title="Staff roles"
        lede="What each OmniDel staff role may do. A change applies on that person's next click."
      />

      <Panel title="Permissions">
        <Table columns={columns} data={permissions} rowKey={(p) => p.label} minWidth={620} minHeight={0} />
        <p className="console-footnote">
          Only an owner may approve deleting a customer's data or change this screen. Those two cannot be given to
          another role.
        </p>
      </Panel>
    </div>
  );
}
