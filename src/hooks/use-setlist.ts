import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPut } from "@/lib/api";
import type { SetlistDraftSong } from "@/types/setlist";

const setlistPath = (orgId: string, eventId: string) =>
  `/api/mobile/v1/organizations/${orgId}/events/${eventId}/setlist`;

/** Expires the event detail, which is where the setlist is read from. */
function useInvalidateEvent(orgId: string, eventId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey: ["organizations", userId, "event-details", orgId, eventId],
    });
}

/** Replaces the setlist with the draft, in order. */
export function useSaveSetlist(orgId: string, eventId: string) {
  const invalidate = useInvalidateEvent(orgId, eventId);

  return useMutation({
    mutationFn: (songs: SetlistDraftSong[]) =>
      apiPut<{ success: true }>(
        setlistPath(orgId, eventId),
        { songs: songs.map((song, index) => ({ ...song, position: index })) },
      ),
    onSuccess: invalidate,
  });
}

export type VocalistChange = {
  setlistSongId: string;
  userId: string;
  assign: boolean;
};

/** Puts a vocalist on a song, or takes them off. */
export function useToggleVocalist(orgId: string, eventId: string) {
  const invalidate = useInvalidateEvent(orgId, eventId);

  return useMutation({
    mutationFn: ({ setlistSongId, userId, assign }: VocalistChange) => {
      const path = `${setlistPath(orgId, eventId)}/${setlistSongId}/vocalists/${userId}`;
      return assign
        ? apiPut<{ success: true }>(path)
        : apiDelete<{ success: true }>(path);
    },
    onSuccess: invalidate,
  });
}
