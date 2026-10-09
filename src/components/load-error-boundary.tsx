import { Component, type ReactNode } from "react";

type LoadErrorBoundaryProps = {
  /** Shown in place of the children once one of them has thrown. */
  fallback: ReactNode;
  /**
   * Any change here clears a caught error and renders the children again: a
   * different organization, say, or the data the failed load was waiting on.
   */
  resetKeys: readonly unknown[];
  /** Runs just before the children render again, so they retry rather than rethrow. */
  onReset?: () => void;
  children: ReactNode;
};

type LoadErrorBoundaryState = { failed: boolean };

/**
 * Catches a first load that failed. A suspending query throws its error to the
 * nearest boundary instead of returning it, and catching one takes a class:
 * React has no hook for it.
 */
export class LoadErrorBoundary extends Component<
  LoadErrorBoundaryProps,
  LoadErrorBoundaryState
> {
  state: LoadErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): LoadErrorBoundaryState {
    return { failed: true };
  }

  componentDidUpdate(
    previousProps: LoadErrorBoundaryProps,
    previousState: LoadErrorBoundaryState,
  ) {
    // Only an error that was already showing: the update that caught one may
    // also have changed a key, and resetting on it would just throw again.
    if (
      previousState.failed &&
      this.state.failed &&
      keysChanged(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.props.onReset?.();
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function keysChanged(previous: readonly unknown[], next: readonly unknown[]) {
  return (
    previous.length !== next.length ||
    previous.some((key, index) => !Object.is(key, next[index]))
  );
}
