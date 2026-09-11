import { useAuth } from "@clerk/expo";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { queryClient } from "@/lib/query-client";

/**
 * React Query for the app, plus a hard cache reset on sign-out so one account's
 * data can never be handed to the next person who signs in on this device.
 *
 * Must render inside `ClerkProvider` — it reads auth state.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    // `undefined` means Clerk is still loading; only clear on a real sign-out.
    if (isSignedIn === false) {
      queryClient.clear();
    }
  }, [isSignedIn]);

  // React Query refetches on window focus, which is a DOM listener and so never
  // fires on a phone. `AppState` is the same signal: coming back from the lock
  // screen or the app switcher re-checks every query against its `staleTime`,
  // which is how a roster somebody else changed while the app was away catches
  // up. Without it the only way back to the server is a pull.
  //
  // Not on web, where the listener React Query installs itself is the better
  // one — `setFocused` takes the manager over manually and would replace a
  // working `visibilitychange` with `AppState`'s shim of it.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => focusManager.setFocused(status === "active"),
    );

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
