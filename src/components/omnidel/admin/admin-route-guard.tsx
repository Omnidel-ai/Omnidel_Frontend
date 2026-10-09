// UNUSED — Page audit 2026-09-16: nothing in src/ imports this module.
// Route gating is done by PermissionGate / layout guards; no importers.
// Deletion candidate. See docs/architecture/page-audit-2026-09-16.md.

import { requirePageAccess } from "@/lib/server/page-access";
import { NoAccessScreen } from "@/components/omnidel/no-access-screen";

export default async function AdminRouteGuard({
  permission,
  resource,
  children,
}: {
  permission: string;
  resource: string;
  children: React.ReactNode;
}) {
  const allowed = await requirePageAccess({ permission });
  return allowed ? children : <NoAccessScreen area={resource} />;
}
