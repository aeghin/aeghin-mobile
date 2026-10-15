import { useRouter, useSegments, type Href } from "expo-router";
import { useMemo } from "react";

/**
 * Opening something on the Events tab from wherever the app is: another tab,
 * or one of the sidebar's screens over the tabs.
 *
 * The router targets the first navigator where here and there differ, and
 * each has its trap. From over the tabs, a push lands on the root stack and
 * stacks a second copy of the tabs, so it goes back down to them instead. From
 * another tab, `dismissTo` reaches the tab bar, which can't handle it, so the
 * list is navigated to.
 */
export function useOpenInTabs() {
  const router = useRouter();
  const [area, tab] = useSegments();
  const inTabs = area === "(tabs)";
  const onEvents = inTabs && tab === "(events)";

  return useMemo(
    () => ({
      /** An event page, or its chat. */
      event: (href: Href) => (inTabs ? router.push(href) : router.dismissTo(href)),
      /**
       * The events list, on one of its tabs. On the Events tab an open event
       * page is dismissed back to the list rather than stacking another on it.
       */
      list: (listTab?: "pending" | "all" | "schedule") => {
        const href: Href = listTab ? { pathname: "/", params: { tab: listTab } } : "/";

        if (inTabs && !onEvents) {
          router.navigate(href);
        } else {
          router.dismissTo(href);
        }
      },
    }),
    [router, inTabs, onEvents],
  );
}
