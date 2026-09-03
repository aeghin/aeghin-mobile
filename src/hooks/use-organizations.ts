import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiUpload,
  type UploadFile,
} from "@/lib/api";
import type {
  OrganizationDetail,
  OrganizationInput,
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

/**
 * Creates an organization with the caller as owner. Answers `{ orgId }`, so
 * the picker can select it straight away.
 */
export function useCreateOrganization() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      apiPost<{ orgId: string }>("/api/mobile/v1/organizations", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

/** Renames or re-describes one. Owners only; the server says so otherwise. */
export function useUpdateOrganization(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OrganizationInput) =>
      apiPatch<{ success: true }>(`/api/mobile/v1/organizations/${orgId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

/** Deletes one and everything in it. Owners only. */
export function useDeleteOrganization(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiDelete<{ success: true }>(`/api/mobile/v1/organizations/${orgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

/** The caller leaves. The server refuses the last owner. */
export function useLeaveOrganization(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<{ success: true }>(`/api/mobile/v1/organizations/${orgId}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

const logoPath = (orgId: string) => `/api/mobile/v1/organizations/${orgId}/logo`;

/**
 * Replaces the organization's logo. Owners only.
 *
 * The image goes to our own API rather than to UploadThing, which the
 * dashboard uploads to straight from the browser — there is no UploadThing
 * client for React Native, so the server does that leg. Replacing also deletes
 * whatever the logo used to be, which the action handles.
 *
 * Invalidating the whole `["organizations", userId]` subtree rather than one
 * key: the logo is drawn from the summary list, the detail, and the header
 * switcher, and all three read from under it.
 */
export function useUpdateLogo(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: UploadFile) =>
      apiUpload<{ logoUrl: string }>(logoPath(orgId), "file", [file]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

/** Clears it, and deletes the stored file. The avatar falls back to initials. */
export function useRemoveLogo(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiDelete<{ success: true }>(logoPath(orgId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
    },
  });
}

export type OrganizationEmail = {
  subject: string;
  body: string;
};

/**
 * One message to every member. Owners and admins only.
 *
 * The organization's counterpart to `useEmailTeam`, which writes to one
 * event's accepted volunteers. Nothing to invalidate — sending an email
 * changes no state the app reads.
 */
export function useEmailOrganization(orgId: string) {
  return useMutation({
    mutationFn: (input: OrganizationEmail) =>
      apiPost<{ sentCount: number }>(
        `/api/mobile/v1/organizations/${orgId}/email`,
        input,
      ),
  });
}
