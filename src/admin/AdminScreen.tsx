import { AdminPage } from "./AdminPage";
import masters from "../data/masters.json";
import type { DemoMaster } from "../data/types";

const MASTERS = masters as DemoMaster[];

export interface AdminScreenProps {
  /** The part of the route after `/admin/`. */
  masterKey: string;
  /** Search text from the shell's topbar. */
  search?: string;
  /** Rendered when no master has that key — the caller decides what that is. */
  fallback?: React.ReactNode;
}

/**
 * The admin area's own entry point: a key in, the right screen out.
 *
 * This exists for one reason, and it is a load-time reason rather than a
 * tidiness one. `masters.json` is **139 KB** — by far the heaviest thing in
 * the workspace. While `App` imported it directly, every visitor downloaded
 * all 24 admin screens' columns, fields and rows before Home could paint, even
 * if they never opened Admin.
 *
 * Moving the import here means the bundler can put this module and its data in
 * a chunk of their own, fetched the first time someone navigates to `/admin/…`
 * and never otherwise.
 *
 * It keeps `AdminPage` pure, which matters just as much: that component still
 * takes a descriptor and nothing else, so it can be used with a descriptor
 * from an API, a test, or the real application's database.
 */
export function AdminScreen({ masterKey, search, fallback = null }: AdminScreenProps) {
  const master = MASTERS.find((m) => m.key === masterKey);
  if (!master) return <>{fallback}</>;
  // Keyed so switching masters remounts: a fresh screen, not one table's state
  // bleeding into the next.
  return <AdminPage key={master.key} master={master} externalSearch={search} />;
}

/** Whether the admin area owns this route — asked before the chunk is loaded. */
export function isAdminMaster(href: string): boolean {
  return href.startsWith("/admin/");
}

export default AdminScreen;
