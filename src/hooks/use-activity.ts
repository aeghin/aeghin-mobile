import { useAuth } from "@clerk/expo";
import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ActivityPage } from "@/types/activity";

/**
 * The organization's activity feed, a page at a time. Owners and admins only;
 * `enabled` keeps a member's copy from firing into a 403.
 */
export function useActivity(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  return useInfiniteQuery({
    queryKey: ["organizations", orgId, "activity"],
    enabled: Boolean(userId && orgId && canManage),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<ActivityPage>(
        `/api/mobile/v1/organizations/${orgId}/activity?page=${pageParam}`,
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}
