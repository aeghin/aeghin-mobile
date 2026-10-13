import { useAuth } from "@clerk/expo";
import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ActivityFilter, ActivityPage } from "@/types/activity";

/**
 * The organization's activity feed for one filter chip, a page at a time.
 * Owners and admins only; `enabled` keeps a member's copy from firing into a
 * 403.
 *
 * Switching chips keeps the last chip's rows on screen until the new ones
 * land, as the dashboard does, instead of blanking to a spinner. Only within
 * the same organization: another church's rows are never a stand-in.
 */
export function useActivity(orgId: string, canManage: boolean, filter: ActivityFilter) {
  const { userId } = useAuth();

  return useInfiniteQuery({
    queryKey: ["organizations", orgId, "activity", filter],
    enabled: Boolean(userId && orgId && canManage),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiGet<ActivityPage>(
        `/api/mobile/v1/organizations/${orgId}/activity?page=${pageParam}&filter=${filter}`,
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === orgId ? previous : undefined,
  });
}
