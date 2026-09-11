import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Also the gate on every focus and foreground refetch, which is what
      // keeps those cheap: a screen returned to inside the window asks for
      // nothing. Short enough that coming back to a roster shows the answer
      // somebody just gave.
      staleTime: 30_000,
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
