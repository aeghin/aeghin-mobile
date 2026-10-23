import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiPut } from "@/lib/api";
import type { EventDetails, EventPerson } from "@/types/event";
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
  /** Who, with name and photo, so the row's avatars can show them before the server answers. */
  person: EventPerson;
  assign: boolean;
};

/** What `onMutate` hands `onError` so a failed change can be undone. */
type Rollback = { previous: EventDetails | undefined };

/**
 * Puts a vocalist on a song, or takes them off.
 *
 * Optimistic, like the web's popover: the change is written into the cached
 * event first, so the dialog's tick and the row's avatars move on the tap.
 * Put back exactly as it was if the server refuses.
 */
export function useToggleVocalist(orgId: string, eventId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["organizations", userId, "event-details", orgId, eventId];

  return useMutation({
    mutationFn: ({ setlistSongId, person, assign }: VocalistChange) => {
      const path = `${setlistPath(orgId, eventId)}/${setlistSongId}/vocalists/${person.userId}`;
      return assign
        ? apiPut<{ success: true }>(path)
        : apiDelete<{ success: true }>(path);
    },
    onMutate: async ({ setlistSongId, person, assign }: VocalistChange): Promise<Rollback> => {
      // An in-flight refetch would otherwise land after this patch and undo it.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<EventDetails>(queryKey);

      queryClient.setQueryData<EventDetails>(queryKey, (event) =>
        event && {
          ...event,
          setlist: event.setlist.map((song) => {
            if (song.id !== setlistSongId) return song;
            const others = song.vocalists.filter((vocalist) => vocalist.userId !== person.userId);
            // Last, where the server lists the newest assignment too.
            return { ...song, vocalists: assign ? [...others, person] : others };
          }),
        },
      );

      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
