import { useAuth } from "@clerk/expo";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useOrganizations } from "@/hooks/use-organizations";
import {
  readLastOrganizationId,
  rememberLastOrganizationId,
} from "@/lib/last-organization";
import type { OrganizationSummary } from "@/types/organization";

type OrganizationContextValue = {
  /** The organization every tab reads from, or null when none is chosen. */
  organization: OrganizationSummary | null;
  /** Every organization this account belongs to, for the switcher. */
  organizations: OrganizationSummary[];
  /** True until the membership list resolves — not yet "no organization". */
  isPending: boolean;
  select: (organizationId: string) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * The current organization, held in a provider rather than in the URL.
 *
 * The tabs are app-level and permanent, so the organization cannot live in a
 * route param — there is no `[id]` segment above them to read. Keeping it here
 * also sidesteps the ancestor-params trap entirely: no dynamic segment means no
 * `useLocalSearchParams` returning `undefined` and silently disabling a query.
 *
 * The trade is that a URL no longer identifies an organization. A deep link
 * such as `aeghin://songs` means "songs for whatever is current", so anything
 * pointing at a specific organization has to `select` it before navigating.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const { data, isPending } = useOrganizations();

  // `SecureStore.getItem` is synchronous, so the remembered id is read during
  // render rather than synced in through an effect — an effect here would set
  // state on mount and cascade a second render for no gain. Memoised per
  // account, so it costs one storage hit per sign-in rather than one per render.
  const rememberedId = useMemo(
    () => (userId ? readLastOrganizationId(userId) : null),
    [userId],
  );

  // A choice made this session outranks the stored one, and carries the account
  // that made it: switching users on a shared device must not inherit it.
  const [chosen, setChosen] = useState<{ userId: string; id: string } | null>(
    null,
  );

  const selectedId =
    chosen && chosen.userId === userId ? chosen.id : rememberedId;

  const select = useCallback(
    (organizationId: string) => {
      if (!userId) {
        return;
      }
      setChosen({ userId, id: organizationId });
      rememberLastOrganizationId(userId, organizationId);
    },
    [userId],
  );

  const organizations = useMemo(() => data ?? [], [data]);

  // Resolved against the membership list rather than trusted on its own, so an
  // organization the account has since left reads as no selection and sends the
  // tabs back to the picker instead of into a 404.
  const organization =
    organizations.find((candidate) => candidate.id === selectedId) ?? null;

  const value = useMemo(
    () => ({ organization, organizations, isPending, select }),
    [organization, organizations, isPending, select],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useCurrentOrganization(): OrganizationContextValue {
  const value = useContext(OrganizationContext);

  if (!value) {
    throw new Error(
      "useCurrentOrganization must be used inside <OrganizationProvider>.",
    );
  }

  return value;
}
