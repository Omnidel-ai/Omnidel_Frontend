export const ACTIVE_ATTEMPT_CHANGED_EVENT = "karigar:active-attempt-changed";

export function notifyActiveAttemptChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTIVE_ATTEMPT_CHANGED_EVENT));
}
