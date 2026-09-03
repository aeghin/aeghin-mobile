import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type {
  InvitationInput,
  OrganizationInvitation,
} from "@/types/organization";

const invitationsPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/invitations`;

const invitationsKey = (orgId: string) => ["organizations", orgId, "invitations"];

/**
 * Every invitation one organization has sent. Owners and admins only — the
 * route answers 403 to a member, so `enabled` keeps the request from firing.
 */
export function useInvitations(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: invitationsKey(orgId),
    enabled: Boolean(userId && orgId && canManage),
    queryFn: async () => {
      const { invitations } = await apiGet<{ invitations: OrganizationInvitation[] }>(
        invitationsPath(orgId),
      );
      return invitations;
    },
  });
}

/**
 * Invites one person by email. The server sends the email, logs the activity
 * and refreshes an earlier invitation to the same address, as the dashboard's
 * dialog does.
 */
export function useInviteMember(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvitationInput) =>
      apiPost<{ success: true }>(invitationsPath(orgId), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKey(orgId) });
      // The organization detail carries `pendingInvitationCount`.
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

export function useCancelInvitation(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      apiDelete<{ success: true }>(`${invitationsPath(orgId)}/${invitationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationsKey(orgId) });
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}
