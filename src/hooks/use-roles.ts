import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiGet } from "@/lib/api";
import {
  BUILT_IN_CATALOG,
  buildRoles,
  type RoleCatalog,
  type Roles,
} from "@/lib/config/volunteer-roles";

/**
 * The role catalog from the server, else the one this build shipped with —
 * until the request lands, and for good against a server too old to have the
 * route.
 */
export function useRoleCatalog(): RoleCatalog {
  const { userId } = useAuth();

  const query = useQuery({
    queryKey: ["role-catalog"],
    enabled: Boolean(userId),
    // Roles change with a deploy, not while somebody has the app open.
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiGet<RoleCatalog>("/api/mobile/v1/roles"),
  });

  return query.data ?? BUILT_IN_CATALOG;
}

/** Every role and team, and the questions screens ask of them. */
export function useRoles(): Roles {
  const catalog = useRoleCatalog();

  return useMemo(() => buildRoles(catalog), [catalog]);
}
