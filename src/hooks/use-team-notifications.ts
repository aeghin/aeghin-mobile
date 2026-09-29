import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch } from "@/lib/api";
import type {
  Team,
  TeamNotificationSettings,
  TeamSettings,
} from "@/types/team-notifications";

/**
 * The organization's, not the caller's, so keyed without `userId` — like the
 * members roster, every account on the device can share one entry.
 */
const settingsKey = (orgId: string) => ["organizations", orgId, "team-notifications"];

const path = (orgId: string) => `/api/mobile/v1/organizations/${orgId}/team-notifications`;

/**
 * Who leads each team and who else gets a heads-up. Owners and admins only —
 * the route answers 403 to a member, so `enabled` gates the request rather
 * than letting it fire and fail.
 */
export function useTeamNotifications(orgId: string, enabled: boolean) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: settingsKey(orgId),
    enabled: Boolean(userId && orgId && enabled),
    queryFn: () => apiGet<TeamNotificationSettings>(path(orgId)),
  });
}

type Change =
  | { team: Team; lead: string | null }
  | { team: Team; userId: string; watching: boolean };

/** The settings as they will read once the server agrees. */
function apply(settings: TeamNotificationSettings, change: Change): TeamNotificationSettings {
  const person = (userId: string) => {
    const found = settings.managers.find((manager) => manager.userId === userId);
    return found
      ? { userId: found.userId, firstName: found.firstName, lastName: found.lastName }
      : null;
  };

  const teams = settings.teams.map((entry): TeamSettings => {
    if (entry.team !== change.team) return entry;

    if ("lead" in change) {
      return {
        ...entry,
        lead: change.lead ? person(change.lead) : null,
        watchers: entry.watchers.filter((watcher) => watcher.userId !== change.lead),
      };
    }

    const added = change.watching ? person(change.userId) : null;

    return {
      ...entry,
      watchers: change.watching
        ? added && !entry.watchers.some((watcher) => watcher.userId === change.userId)
          ? [...entry.watchers, added]
          : entry.watchers
        : entry.watchers.filter((watcher) => watcher.userId !== change.userId),
    };
  });

  return { ...settings, teams };
}

/**
 * One change: a team's lead (owners only), or one person on or off its
 * "Also notify" (owners for anybody, an admin for themselves). Answered
 * optimistically, and put back exactly as it was if the server refuses.
 */
export function useChangeTeamNotifications(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const key = settingsKey(orgId);

  return useMutation({
    mutationFn: (change: Change) => apiPatch<{ success: true }>(path(orgId), change),
    onMutate: async (change: Change) => {
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<TeamNotificationSettings>(key);

      queryClient.setQueryData<TeamNotificationSettings>(key, (settings) =>
        settings ? apply(settings, change) : settings,
      );

      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: (_data, _error, change) => {
      queryClient.invalidateQueries({ queryKey: key });

      // A new lead moves who owns every open role in the team: the bell, and
      // the lead named on each event's invite screen.
      if ("lead" in change) {
        queryClient.invalidateQueries({ queryKey: ["organizations", userId, "notifications"] });
        queryClient.invalidateQueries({ queryKey: ["organizations", userId, "event-details", orgId] });
      }
    },
  });
}
