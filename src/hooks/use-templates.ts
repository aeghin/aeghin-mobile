import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { EventTemplate, EventTemplateInput } from "@/types/event";

type TemplatesResponse = {
  templates: EventTemplate[];
};

const templatesKey = (orgId: string) => ["organizations", orgId, "templates"];

const templatesPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/templates`;

/**
 * One organization's event templates, by weekday then name.
 *
 * No `userId` in the key: templates belong to the organization, not the
 * caller, so every account on the device can share one entry — the same trade
 * `useServiceTypes` makes. `userId` is still read as a readiness signal so the
 * query does not fire before Clerk has a session to mint a token from.
 *
 * `enabled` also takes `canManage`, because the route is managers-only and a
 * member would otherwise sit on a 403 the screen has nothing to do with.
 */
export function useTemplates(orgId: string, canManage: boolean) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: templatesKey(orgId),
    enabled: Boolean(userId && orgId && canManage),
    queryFn: async () => {
      const { templates } = await apiGet<TemplatesResponse>(templatesPath(orgId));
      return templates;
    },
  });
}

export function useAddTemplate(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EventTemplateInput) =>
      apiPost<{ success: true }>(templatesPath(orgId), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey(orgId) });
    },
  });
}

/** A template's days are replaced wholesale, so this takes the whole template. */
export function useUpdateTemplate(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: EventTemplateInput & { id: string }) =>
      apiPatch<{ success: true }>(`${templatesPath(orgId)}/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey(orgId) });
    },
  });
}

export function useDeleteTemplate(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ success: true }>(`${templatesPath(orgId)}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey(orgId) });
    },
  });
}
