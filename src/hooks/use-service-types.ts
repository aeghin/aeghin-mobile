import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { ServiceType } from "@/types/event";

type ServiceTypesResponse = {
  serviceTypes: ServiceType[];
};

/**
 * The kinds of service one organization runs — what names and colours every
 * event on the schedule, and what the filter chips are made of.
 *
 * No `userId` in the key: these belong to the organization, not to the caller,
 * so every account on the device can share one entry. `userId` is still read
 * as a readiness signal, so the query does not fire before Clerk has a session
 * to mint a token from.
 */
export function useServiceTypes(orgId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: ["organizations", orgId, "service-types"],
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const { serviceTypes } = await apiGet<ServiceTypesResponse>(
        `/api/mobile/v1/organizations/${orgId}/service-types`,
      );
      return serviceTypes;
    },
  });
}
