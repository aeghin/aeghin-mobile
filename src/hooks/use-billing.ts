import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useCallback } from "react";

import { apiGet, apiPost } from "@/lib/api";
import type { AiPlan, BillingStatus } from "@/types/billing";

const billingPath = (orgId: string) => `/api/mobile/v1/organizations/${orgId}/billing`;

const billingKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "billing",
  orgId,
];

/** Where Stripe's return page hands the browser back to. */
const RETURN_SCHEME = "aeghin://settings/billing";

/** The organization's AI plan, and whether the caller may change it. */
export function useBillingStatus(orgId: string) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: billingKey(userId, orgId),
    enabled: Boolean(userId && orgId),
    queryFn: () => apiGet<BillingStatus>(billingPath(orgId)),
    // Entitlements land through a webhook; a fresh read after checkout matters.
    staleTime: 0,
  });
}

/**
 * Opens a Stripe page in an auth session and expires the status when it
 * closes. The session ends on its own when Stripe's return page navigates to
 * the app scheme, or when the person taps Done.
 */
export function useOpenStripe(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    async (url: string) => {
      await WebBrowser.openAuthSessionAsync(url, RETURN_SCHEME);
      await queryClient.invalidateQueries({ queryKey: billingKey(userId, orgId) });
    },
    [queryClient, userId, orgId],
  );
}

/** Starts Checkout for one plan and opens it. Owners only; the server says so otherwise. */
export function useStartCheckout(orgId: string) {
  const open = useOpenStripe(orgId);

  return useMutation({
    mutationFn: async (plan: AiPlan) => {
      const { url } = await apiPost<{ url: string }>(`${billingPath(orgId)}/checkout`, { plan });
      await open(url);
    },
  });
}

/** Opens the Customer Portal. */
export function useBillingPortal(orgId: string) {
  const open = useOpenStripe(orgId);

  return useMutation({
    mutationFn: async () => {
      const { url } = await apiPost<{ url: string }>(`${billingPath(orgId)}/portal`);
      await open(url);
    },
  });
}
