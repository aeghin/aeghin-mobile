import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import type { InvitationDetail, PendingInvitation } from "@/types/organization";

/** Keyed on the account, not an organization: this is what is waiting on *you*. */
const myInvitationsKey = (userId: string | null | undefined) => [
  "my-invitations",
  userId,
];

/**
 * Organization invitations addressed to the signed-in account: pending, not
 * yet lapsed. The picker shows these so somebody invited to their first
 * organization can join without leaving the phone.
 */
export function useMyInvitations() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: myInvitationsKey(userId),
    enabled: Boolean(userId),
    queryFn: async () => {
      const { invitations } = await apiGet<{ invitations: PendingInvitation[] }>(
        "/api/mobile/v1/invitations",
      );
      return invitations;
    },
  });
}

/** One invitation resolved from a link, including why it may not be answerable. */
export function useInvitationByToken(token: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["invitation", token],
    enabled: Boolean(userId && token),
    queryFn: async () => {
      const { invitation } = await apiGet<{ invitation: InvitationDetail }>(
        `/api/mobile/v1/invitations/${encodeURIComponent(token)}`,
      );
      return invitation;
    },
  });
}

export type OrgInvitationResponse = "accept" | "decline";

export type RespondResult = {
  status: "ACCEPTED" | "DECLINED";
  /** The organization just joined, on an accept. */
  orgId: string | null;
};

/**
 * Answers an organization invitation.
 *
 * Not optimistic. Accepting creates a membership, and the whole app reads
 * from that list, so it is better to wait a beat than to show an
 * organization the server has not agreed to yet. No retries either: the
 * second attempt would find nothing pending and report a conflict.
 */
export function useRespondToOrgInvitation() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, action }: { token: string; action: OrgInvitationResponse }) =>
      apiPost<RespondResult>(
        `/api/mobile/v1/invitations/${encodeURIComponent(token)}/respond`,
        { action },
      ),
    retry: false,
    onSuccess: (_result, { token }) => {
      queryClient.invalidateQueries({ queryKey: myInvitationsKey(userId) });
      queryClient.invalidateQueries({ queryKey: ["invitation", token] });
      // Accepting adds a membership, which is the list every tab reads from.
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}
