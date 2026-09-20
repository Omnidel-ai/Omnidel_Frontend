/**
 * Public surface of the shared-component library.
 *
 * Everything exported here is presentation only: no fetching, no routing, no
 * knowledge of customers, invoices, tasks or any other domain object. A
 * feature passes data in and handles what comes back out.
 */
export * from "./Button";
export * from "./Input";
export * from "./Select";
export * from "./SearchBar";
export * from "./SubTabs";
export * from "./Table";
export * from "./Filters";
export * from "./Modal";
export * from "./ConfirmDialog";
export * from "./Toast";
export * from "./PageHeader";
export * from "./NoAccessScreen";
export * from "./Badge";
export * from "./StatusToggle";
export * from "./Spinner";

export { useIsMobile } from "../hooks/useIsMobile";
export { useHScrollThumb } from "../hooks/useHScrollThumb";
