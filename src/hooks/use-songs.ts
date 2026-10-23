import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { isPlanLimit } from "@/lib/failure";
import { uploadToStorage, type UploadFile } from "@/lib/uploadthing";
import type { LibrarySong, SongArrangementInput, SongInput } from "@/types/song";

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
 * Every cached event in the organization. Their setlist rows show a picked
 * version's name, links and files, and an event screen left open in its tab
 * keeps what it has until something expires it.
 */
const eventsKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "event-details",
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
    // Refused as full: the library or the plan the phone counted against was
    // stale. Both live under this key.
    onError: (error) => {
      if (isPlanLimit(error, "SONG_LIMIT")) {
        queryClient.invalidateQueries({ queryKey: ["organizations", userId] });
      }
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

/** What the upload route answers with — some files can land while others don't. */
export type AttachmentUploadResult = {
  added: number;
  skipped: number;
};

export type NewAttachments = {
  songId: string;
  /** The arrangement they're for. Null is the Original's. */
  arrangementId: string | null;
  files: UploadFile[];
};

/**
 * Attaches charts or tracks to a song.
 *
 * Two steps, the same two the dashboard takes: the files go to UploadThing
 * directly — which is what keeps them clear of the host's request body cap —
 * and then our own API records what landed. The role check happens in both
 * places, since the file router and the route each run it.
 *
 * Not optimistic: the rows are the server's to mint, and a file can fail on
 * its own while the rest of a batch succeeds.
 */
export function useAddAttachments(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ songId, arrangementId, files }: NewAttachments) => {
      const stored = await uploadToStorage("songAttachment", files, { songId });

      return apiPost<AttachmentUploadResult>(
        `${songsPath(orgId)}/${songId}/attachments`,
        { files: stored, arrangementId },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
      queryClient.invalidateQueries({ queryKey: eventsKey(userId, orgId) });
    },
  });
}

export type AttachmentRef = {
  songId: string;
  attachmentId: string;
};

/** Removes one, from UploadThing's storage as well as the library. */
export function useDeleteAttachment(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, attachmentId }: AttachmentRef) =>
      apiDelete<{ success: true }>(
        `${songsPath(orgId)}/${songId}/attachments/${attachmentId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
      queryClient.invalidateQueries({ queryKey: eventsKey(userId, orgId) });
    },
  });
}

export type NewArrangement = {
  songId: string;
  arrangement: SongArrangementInput;
};

export type ArrangementEdit = {
  songId: string;
  arrangementId: string;
  arrangement: SongArrangementInput;
};

export type ArrangementRef = {
  songId: string;
  arrangementId: string;
};

const arrangementsPath = (orgId: string, songId: string) =>
  `${songsPath(orgId)}/${songId}/arrangements`;

/**
 * Adds an arrangement to a song. Its files go on afterwards, the way a song's
 * do. The three below wait for the library to refetch before they settle, so
 * the dialog goes back to a list that already shows the change.
 */
export function useAddArrangement(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, arrangement }: NewArrangement) =>
      apiPost<{ success: true }>(arrangementsPath(orgId, songId), arrangement),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) }),
  });
}

/** Renames one or changes its links. Every setlist that plays it follows. */
export function useUpdateArrangement(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, arrangementId, arrangement }: ArrangementEdit) =>
      apiPatch<{ success: true }>(
        `${arrangementsPath(orgId, songId)}/${arrangementId}`,
        arrangement,
      ),
    onSuccess: () => {
      // Not waited on: the dialog only needs the library back.
      queryClient.invalidateQueries({ queryKey: eventsKey(userId, orgId) });
      return queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
    },
  });
}

/**
 * Deletes one along with its files. Not optimistic, like deleting a song: the
 * server refuses while an upcoming setlist plays it, and says which.
 */
export function useDeleteArrangement(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, arrangementId }: ArrangementRef) =>
      apiDelete<{ success: true }>(`${arrangementsPath(orgId, songId)}/${arrangementId}`),
    onSuccess: () => {
      // A past setlist that played it shows the Original from now on.
      queryClient.invalidateQueries({ queryKey: eventsKey(userId, orgId) });
      return queryClient.invalidateQueries({ queryKey: songsKey(userId, orgId) });
    },
  });
}
