import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown instead of the crash. Receives the error and a way to try again. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Somewhere to send the error — a logger, in an application that has one. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one broken screen from taking the whole application with it.
 *
 * Without this, an error thrown anywhere during render unmounts the entire
 * React tree: the sidebar, the topbar and the content all vanish and the
 * person is left on a white page with no way back. That is the single worst
 * failure a front end can have, because it destroys the navigation they would
 * have used to escape.
 *
 * With it, the shell survives, the content area shows what went wrong, and
 * every other screen is still one click away.
 *
 * It has to be a class. Error boundaries are the one thing React has never
 * given hooks for — `componentDidCatch` has no `useCatch` equivalent.
 *
 * What it does **not** catch, and why that is worth knowing: errors inside
 * event handlers, in `setTimeout`, or in promises. Those do not happen during
 * render, so React never sees them. Handle those where they are thrown — which
 * in this workspace means a toast.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real deployment sends this to Sentry or similar. The console is what
    // this workspace has, and saying so is better than swallowing it.
    console.error("[ErrorBoundary] a screen crashed:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    return (
      <div className="crash" role="alert">
        <p className="ui-eyebrow">Something broke</p>
        <h2 className="crash__title">This screen stopped working.</h2>
        <p className="crash__body">
          The rest of the workspace is fine — the navigation still works, so you can go somewhere
          else and come back.
        </p>
        <pre className="crash__detail">{error.message}</pre>
        <button type="button" className="btn-secondary btn-sm" onClick={this.retry}>
          Try this screen again
        </button>
      </div>
    );
  }
}
