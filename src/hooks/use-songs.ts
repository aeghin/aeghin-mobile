import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { LibrarySong, SongInput } from "@/types/song";

type SongsResponse = {
  songs: LibrarySong[];
};

const songsPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/songs`;

/** Shared by the query and every mutation that has to expire it. */
const songsKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "songs",
  orgId,
];

/**
 * One organization's whole song library, attachments included.
 *
 * Every member gets it — the dashboard shows the library to members and admins
 * alike and gates only the writes, so this query is never role-dependent the
 * way `useOrgEvents` is.
 *
 * The list arrives complete rather than paged, because searching and filtering
 * both run on the device: a library is hundreds of rows, and a round trip per
 * keystroke would cost more than holding all of them.
 */
export function useSongs(orgId: string) {
  const { userId } = useAuth();

  useEffect(() => {
    if (__DEV__ && !orgId) {
      console.warn("useSongs: called without an orgId; query disabled.");
    }
  }, [orgId]);

  return useQuery({
    queryKey: songsKey(userId, orgId),
    enabled: Boolean(userId && orgId),
    queryFn: async () => {
      const { songs } = await apiGet<SongsResponse>(songsPath(orgId));
      return songs;
    },
  });
}

/**
 * Adds a song to the library. Owners and admins only — the route answers 403
 * to anybody else, which is the one failure worth telling apart from a
 * rejected field.
 *
 * Not optimistic: the row's id is the server's to mint, and the same call is
 * what enforces "this title and artist are already in the library".
 */
export function useAddSong(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (song: SongInput) =>
      apiPost<{ success: true }>(songsPath(orgId), song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
    },
  });
}

export type SongEdit = {
  songId: string;
  song: SongInput;
};

/**
 * Edits a song. The whole song goes up, not the changed fields: the action
 * behind the route revalidates every one of them, so a partial body would fail
 * its schema rather than merge.
 */
export function useUpdateSong(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, song }: SongEdit) =>
      apiPatch<{ success: true }>(`${songsPath(orgId)}/${songId}`, song),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
    },
  });
}

/**
 * Removes a song from the library.
 *
 * Deliberately not optimistic, unlike answering an invitation. The server
 * refuses this one often and on purpose — a song on an upcoming setlist cannot
 * be removed until it is off that setlist — and a row that vanishes, then
 * reappears under an alert, reads as a bug. It waits.
 */
export function useDeleteSong(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (songId: string) =>
      apiDelete<{ success: true }>(`${songsPath(orgId)}/${songId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
    },
  });
}
