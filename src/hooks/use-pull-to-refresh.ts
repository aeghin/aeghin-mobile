import { useCallback, useState } from "react";

/**
 * The two props a `RefreshControl` needs, driven by the pull and nothing else.
 *
 * Reading a query's `isRefetching` instead hands the native control to every
 * *background* refetch, which is how the spinner gets stuck. iOS acts only on
 * the edges of `refreshing`: an `endRefreshing` sent while the screen is off
 * the window is dropped, and because the prop has already changed, nothing ever
 * sends it again — the spinner is still there, still holding the content down,
 * when the tab comes back. Only a fresh false→true→false cycle clears it.
 *
 * Switching organizations is the reliable way in. The queries re-key onto an
 * organization whose data is cached but stale, and stale data refetches in the
 * background rather than showing a skeleton, so `isRefetching` goes true with
 * nobody having pulled anything — then settles while you are on another tab.
 *
 * A gesture cannot do that: the screen is under the finger that started it.
 *
 * `refresh` has to be stable — a query's `refetch`, or a `useCallback` around
 * several of them.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Settled, not resolved: a refresh that fails still ends the gesture, and
    // the screen already reports the failure from its own query state.
    const done = () => setRefreshing(false);
    refresh().then(done, done);
  }, [refresh]);

  return { refreshing, onRefresh };
}
