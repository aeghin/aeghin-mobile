import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Blockout, TeamBlockout } from "@/types/organization";

const blockoutsPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/blockouts`;

/** The caller's own, so it is keyed on them as well as the organization. */
const blockoutsKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "blockouts",
  orgId,
];

export function useBlockouts(orgId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: blockoutsKey(userId, orgId),
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const { blockouts } = await apiGet<{ blockouts: Blockout[] }>(blockoutsPath(orgId));
      return blockouts;
    },
  });
}

const teamKey = (orgId: string) => ["organizations", orgId, "blockouts", "team"];

/**
 * Who's away in the next 60 days — owners and admins only; `enabled` keeps a
 * member's copy from firing into a 403.
 */
export function useTeamBlockouts(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: teamKey(orgId),
    enabled: Boolean(userId && orgId && canManage),
    queryFn: async () => {
      const { team } = await apiGet<{ team: TeamBlockout[] }>(`${blockoutsPath(orgId)}/team`);
      return team;
    },
  });
}

export type BlockoutInput = { startDate: string; endDate: string };

export function useAddBlockout(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BlockoutInput) =>
      apiPost<{ success: true }>(blockoutsPath(orgId), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blockoutsKey(userId, orgId) });
      // The caller is on the team list too.
      queryClient.invalidateQueries({ queryKey: teamKey(orgId) });
    },
  });
}

export function useDeleteBlockout(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockoutId: string) =>
      apiDelete<{ success: true }>(`${blockoutsPath(orgId)}/${blockoutId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blockoutsKey(userId, orgId) });
      // The caller is on the team list too.
      queryClient.invalidateQueries({ queryKey: teamKey(orgId) });
    },
  });
}
