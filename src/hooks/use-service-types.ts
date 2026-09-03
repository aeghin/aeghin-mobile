import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ServiceType, ServiceTypeColor } from "@/types/event";

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

const serviceTypesKey = (orgId: string) => ["organizations", orgId, "service-types"];

const serviceTypesPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/service-types`;

export type ServiceTypeInput = { name: string; color: ServiceTypeColor };

export function useAddServiceType(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ServiceTypeInput) =>
      apiPost<{ serviceType: ServiceType | null }>(serviceTypesPath(orgId), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
    },
  });
}

export function useUpdateServiceType(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: ServiceTypeInput & { id: string }) =>
      apiPatch<{ success: true }>(`${serviceTypesPath(orgId)}/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
    },
  });
}

export function useDeleteServiceType(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ success: true }>(`${serviceTypesPath(orgId)}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
    },
  });
}
