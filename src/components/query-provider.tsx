import { useAuth } from "@clerk/expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
