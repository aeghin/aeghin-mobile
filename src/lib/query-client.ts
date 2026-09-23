import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

import { ApiError } from "@/lib/api";

// React Query learns about focus from the browser's `visibilitychange`, which
// React Native doesn't have. Coming back to the foreground is the phone's
// version of it.
if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (status) => {
      handleFocus(status === "active");
    });
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Off unless a query asks for it. Before focus was wired above nothing
      // refetched on resume, and the screens are tuned around that.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // A 401 or 404 will not fix itself; only retry transport and server faults.
        if (error instanceof ApiError && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
