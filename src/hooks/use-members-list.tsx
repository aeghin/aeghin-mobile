import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import type { VolunteerRole } from "@/types/event";
import type { MemberStats, OrgRole, OrganizationMember } from "@/types/organization";

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

const membersKey = (orgId: string) => ["organizations", orgId, "members"];

/** One change to one member, as the dashboard's row menu offers them. */
export type MemberChange =
  | { role: OrgRole }
  | { toggleVolunteerRole: VolunteerRole };

export function useUpdateMember(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, change }: { memberId: string; change: MemberChange }) =>
      apiPatch<{ success: true }>(
        `/api/mobile/v1/organizations/${orgId}/members/${memberId}`,
        change,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(orgId) });
      // A role change can be the caller's own standing seen from another device.
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

export function useRemoveMember(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      apiDelete<{ success: true }>(
        `/api/mobile/v1/organizations/${orgId}/members/${memberId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(orgId) });
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

/**
 * One member's acceptance record and most-sung songs.
 *
 * Its own query rather than a field on the roster: the roster is read on every
 * visit to the members tab, and these two aggregates are only ever wanted on
 * one person's page. Keyed without `userId` for the same reason the roster is —
 * it belongs to the organization, not to whoever is looking.
 */
export function useMemberStats(orgId: string, memberId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["organizations", orgId, "member-stats", memberId],
    enabled: Boolean(userId && orgId && memberId),
    queryFn: async () => {
      const { stats } = await apiGet<{ stats: MemberStats }>(
        `/api/mobile/v1/organizations/${orgId}/members/${memberId}/stats`,
      );
      return stats;
    },
  });
}
