/**
 * The admin tables' cell renderers now live with the Table itself, so the
 * OmniMart work lists render their columns the same way. Re-exported here so
 * the admin screens keep importing from where they always did.
 */
export { toColumn, initials, formatInr, formatCompactInr } from "../../components";
export type { ColumnDescriptor, DescriptorRow } from "../../components";
