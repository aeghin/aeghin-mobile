import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/** A query result, narrowed to the three fields this reads. */
type Refreshable = {
  isStale: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

/** `false` for a query the caller may not ask for, so call sites can inline the gate. */
type Entry = Refreshable | false | null | undefined;

/**
 * Re-reads a screen's queries when it comes back into view.
 *
 * The dashboard gets this free: expiring a cache tag is enough there, because
 * every navigation is a fresh read from the server. A tab screen here mounts
 * once and stays mounted — switching tabs hides it rather than unmounting it —
 * so `refetchOnMount` fires once in the app's lifetime, and a change somebody
 * else made never arrives at all.
 *
 * Asks only for what `staleTime` calls old, the same test `refetchOnWindowFocus`
 * applies, so bouncing between tabs costs nothing.
 *
 * A query the caller may not run must be passed as `false`. `refetch` fires a
 * *disabled* query rather than skipping it, and a member asking for a
 * manager-only list gets a 403 — `enabled` is not readable from the result, so
 * the gate has to be spelled out at the call site.
 */
export function useRefetchOnFocus(queries: Entry[]) {
  // The array is rebuilt every render while the focus effect has to stay
  // stable, or it would run on each render rather than on focus. Written from
  // an effect rather than in render: the commit that updates it always precedes
  // the next focus, and touching a ref mid-render is a lint error.
  const latest = useRef(queries);

  useEffect(() => {
    latest.current = queries;
  });

  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // The first focus arrives with the mount, which `refetchOnMount` has
      // already answered. Refetching there would cancel that request and send
      // it again — `refetch` defaults to `cancelRefetch: true` — for the same
      // bytes, on the slowest screen of the session.
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }

      for (const query of latest.current) {
        if (!query || !query.isStale || query.isFetching) continue;

        // `refetch` resolves with the result rather than throwing, so this
        // catch should never run; an unhandled rejection in a focus handler
        // would be a red box, and the screen reports a failed read from its
        // own query state regardless.
        query.refetch().catch(() => {});
      }
    }, []),
  );
}
