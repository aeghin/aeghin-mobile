import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type {
  OrganizationDetail,
  OrganizationSummary,
} from "@/types/organization";

type OrganizationsResponse = {
  organizations: OrganizationSummary[];
};

/**
 * The signed-in user's organizations.
 *
 * `userId` is here for cache scoping only — it is never sent. The server reads
 * the caller from the token; keying on it just stops one account's cached list
 * from being handed to another after a session switch.
 */
export function useOrganizations() {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["organizations", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { organizations } = await apiGet<OrganizationsResponse>(
        "/api/mobile/v1/organizations",
      );
      return organizations;
    },
  });
}

/**
 * One organization's detail, for the signed-in caller.
 *
 * `userId` is in the key for cache scoping only — it is never sent, for the
 * same reason as {@link useOrganizations}.
 *
 * Nesting under the list's `["organizations", userId]` key means invalidating
 * the list also invalidates any open detail entry.
 */
export function useOrganizationDetails(orgId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["organizations", userId, "detail", orgId],
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const response = await apiGet<{ organization: OrganizationDetail }>(
        `/api/mobile/v1/organizations/${orgId}`,
      );
      return response.organization;
    },
  });
}
