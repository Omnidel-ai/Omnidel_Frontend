/**
 * Shell: the application frame around a page.
 *
 * Like the shared components, these are data-driven and route-agnostic — they
 * take nav items, a user, notifications and status values as props, and report
 * navigation back to the caller.
 */
export * from "./Sidebar";
export * from "./Topbar";
export * from "./Profile";
export * from "./StatusBar";
export * from "./AskMache";
export { ShellLayout } from "./ShellLayout";
export type { ShellLayoutProps } from "./ShellLayout";
