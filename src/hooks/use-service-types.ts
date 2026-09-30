import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { teamNotificationsKey } from "@/hooks/use-team-notifications";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { isPlanLimit } from "@/lib/failure";
import type { ServiceType, ServiceTypeColor } from "@/types/event";
import type { OrganizationSummary } from "@/types/organization";

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
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ServiceTypeInput) =>
      apiPost<{ serviceType: ServiceType | null }>(serviceTypesPath(orgId), input),
    onSuccess: ({ serviceType }) => {
      // Seeded into the cache before the refetch lands, so a caller that
      // selects what it just created — the event form does — has something to
      // draw immediately rather than a blank chip for a round trip. Sorted by
      // name because the route is, so the new chip does not jump afterwards.
      if (serviceType) {
        queryClient.setQueryData<ServiceType[]>(serviceTypesKey(orgId), (current) =>
          current
            ? [...current, serviceType].sort((a, b) => a.name.localeCompare(b.name))
            : [serviceType],
        );
      }

      queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
      // Staffing alerts list every service type, each with its own teams.
      queryClient.invalidateQueries({ queryKey: teamNotificationsKey(orgId) });
    },
    // Refused as full: the list or the plan the phone counted against was stale.
    onError: (error) => {
      if (isPlanLimit(error, "SERVICE_TYPE_LIMIT")) {
        queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
        queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
      }
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
      // Staffing alerts show each service type by name and colour.
      queryClient.invalidateQueries({ queryKey: teamNotificationsKey(orgId) });
    },
  });
}

export function useDeleteServiceType(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ success: true }>(`${serviceTypesPath(orgId)}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceTypesKey(orgId) });
      // Its teams leave Staffing alerts, and its leads stop counting — so the
      // server hands their open spots on, and the bell moves with them.
      queryClient.invalidateQueries({ queryKey: teamNotificationsKey(orgId) });
      queryClient.invalidateQueries({ queryKey: ["organizations", userId, "notifications"] });
    },
  });
}

/**
 * Saves the caller's own order for the service-type pills on Events.
 *
 * The order is read off the cached organizations list, so it is written there
 * first — a dropped pill stays put instead of springing back for a round
 * trip. Scoped so two quick drags reach the server in the order they were made.
 */
export function useSetServiceTypeOrder(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const organizationsKey = ["organizations", userId];

  return useMutation({
    scope: { id: `service-type-order-${orgId}` },
    mutationFn: (serviceTypeIds: string[]) =>
      apiPut<{ success: true }>(
        `/api/mobile/v1/organizations/${orgId}/service-type-order`,
        { serviceTypeIds },
      ),
    onMutate: async (serviceTypeIds) => {
      await queryClient.cancelQueries({ queryKey: organizationsKey, exact: true });
      const previous = queryClient.getQueryData<OrganizationSummary[]>(organizationsKey);

      queryClient.setQueryData<OrganizationSummary[]>(organizationsKey, (current) =>
        current?.map((organization) =>
          organization.id === orgId
            ? { ...organization, serviceTypeOrder: serviceTypeIds }
            : organization,
        ),
      );

      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(organizationsKey, context.previous);
      }
    },
  });
}
