import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiGet } from "@/lib/api";
import type { OrganizationMember } from "@/types/organization";

type MembersResponse = {
  members: OrganizationMember[];
};

/**
 * Everyone in one organization.
 *
 * No `userId` in the key: this roster belongs to the organization, not to the
 * caller, so every account on the device can share one cache entry. `userId` is
 * still read — as a readiness signal, so the query does not fire before Clerk
 * has a session to mint a token from.
 */
export function useMembersList(orgId: string) {
  const { userId } = useAuth();

  // A missing orgId leaves the query disabled, which reports as `pending`
  // forever — a spinner that never resolves and never errors. Say so out loud.
  useEffect(() => {
    if (__DEV__ && !orgId) {
      console.warn("useMembersList: called without an orgId; query disabled.");
    }
  }, [orgId]);

  return useQuery({
    queryKey: ["organizations", orgId, "members"],
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const { members } = await apiGet<MembersResponse>(
        `/api/mobile/v1/organizations/${orgId}/members`,
      );
      return members;
    },
  });
}
