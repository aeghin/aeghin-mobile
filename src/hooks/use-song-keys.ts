import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { SongKey, SongKeyInput } from "@/types/song";

/**
 * The caller's own key journal — the dashboard's My Keys tab.
 *
 * Every read and write here is the signed-in person's own: the server scopes
 * on the caller from the token, so nobody's journal is addressable by anybody
 * else and no user id is ever sent.
 */

const songKeysPath = (orgId: string) =>
  `/api/mobile/v1/organizations/${orgId}/song-keys`;

/** The caller's own, so it is keyed on them as well as the organization. */
const songKeysKey = (userId: string | null | undefined, orgId: string) => [
  "organizations",
  userId,
  "song-keys",
  orgId,
];

/**
 * Every key this person has written down for one organization, ordered by the
 * title they'd look it up under.
 *
 * `enabled` is how the event screen keeps a non-singer from asking: the
 * journal is offered there only to somebody singing on that event, and a
 * request nobody will read is one the phone should not make.
 */
export function useSongKeys(orgId: string, options?: { enabled?: boolean }) {
  const { userId } = useAuth();
  const wanted = options?.enabled ?? true;

  return useQuery({
    queryKey: songKeysKey(userId, orgId),
    enabled: Boolean(userId && orgId) && wanted,
    queryFn: async () => {
      const { songKeys } = await apiGet<{ songKeys: SongKey[] }>(
        songKeysPath(orgId),
      );
      return songKeys;
    },
  });
}

/**
 * The journal with one save already applied.
 *
 * An upsert on (you, song), mirroring the server: an entry for the same song
 * is rewritten rather than doubled, which is what lets the setlist's one-tap
 * save double as "update this to the key we're doing it tonight". A freehand
 * entry carries no songId and so can never match — it is always an append.
 *
 * A rewrite keeps everything the input does not carry, the library key
 * included, so only what actually changed moves. A brand-new entry has no id
 * until the server mints one; `onSettled` swaps the placeholder for the real
 * row as soon as the write lands.
 */
function applySave(entries: SongKey[], input: SongKeyInput): SongKey[] {
  const existing =
    input.songId === null
      ? -1
      : entries.findIndex((entry) => entry.songId === input.songId);

  if (existing >= 0) {
    const next = [...entries];
    next[existing] = {
      ...next[existing],
      pitch: input.pitch,
      keyQuality: input.keyQuality,
      notes: input.notes,
    };
    return next;
  }

  const pending: SongKey = {
    id: `pending-${Date.now()}`,
    songId: input.songId,
    title: input.title,
    artist: input.artist,
    pitch: input.pitch,
    keyQuality: input.keyQuality,
    notes: input.notes,
    updatedAt: new Date().toISOString(),
    libraryPitch: null,
    libraryKeyQuality: null,
    spotifyUrl: null,
    youtubeUrl: null,
  };

  // The route hands these back ordered by title, and My Keys renders them in
  // the order it is given — so an append has to land where the refetch will
  // put it, or the new row jumps once the real one arrives.
  return [...entries, pending].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Writes the key you sing one song in.
 *
 * An upsert, not an insert: the server keys a linked entry on (you, song), so
 * saving a song already in the journal rewrites it rather than doubling it.
 * That is what lets the setlist's one-tap save double as "update this to the
 * key we're doing it in tonight".
 *
 * Optimistic, because the setlist's bookmark is the whole feedback for the
 * tap — waiting for the write and then a refetch left it looking like nothing
 * had happened. The dashboard has a toast to cover that gap and a phone does
 * not, so the icon has to carry it, which means it has to flip now.
 */
export function useSaveSongKey(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = songKeysKey(userId, orgId);

  return useMutation({
    mutationFn: (input: SongKeyInput) =>
      apiPost<{ success: true }>(songKeysPath(orgId), input),
    onMutate: async (input: SongKeyInput): Promise<Rollback> => {
      // An in-flight refetch would otherwise land after this patch and undo it.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<SongKey[]>(queryKey);

      queryClient.setQueryData<SongKey[]>(queryKey, (entries) =>
        entries ? applySave(entries, input) : entries,
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      // Rolls back from here rather than from the caller: this has to run even
      // if the screen went away while the request was in flight.
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export type SongKeyEdit = {
  entryId: string;
  entry: SongKeyInput;
};

/** What `onMutate` hands `onError` so a failed write can be undone. */
type Rollback = { previous: SongKey[] | undefined };

/**
 * Edits one entry in place.
 *
 * Addressed by entry id rather than by song, because an entry outlives the
 * song it pointed at — a retired song leaves a row with a null `songId`, and
 * the note about it is still yours to change.
 *
 * The name is the server's to resolve: a linked entry re-snapshots its song's
 * title and artist and ignores what was sent, so those two are left alone here
 * and arrive with the refetch.
 */
export function useUpdateSongKey(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = songKeysKey(userId, orgId);

  return useMutation({
    mutationFn: ({ entryId, entry }: SongKeyEdit) =>
      apiPatch<{ success: true }>(`${songKeysPath(orgId)}/${entryId}`, entry),
    onMutate: async ({ entryId, entry }: SongKeyEdit): Promise<Rollback> => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<SongKey[]>(queryKey);

      queryClient.setQueryData<SongKey[]>(queryKey, (entries) =>
        entries?.map((row) =>
          row.id === entryId
            ? {
                ...row,
                pitch: entry.pitch,
                keyQuality: entry.keyQuality,
                notes: entry.notes,
              }
            : row,
        ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Drops one entry from the journal. */
export function useDeleteSongKey(orgId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = songKeysKey(userId, orgId);

  return useMutation({
    mutationFn: (entryId: string) =>
      apiDelete<{ success: true }>(`${songKeysPath(orgId)}/${entryId}`),
    onMutate: async (entryId: string): Promise<Rollback> => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<SongKey[]>(queryKey);

      queryClient.setQueryData<SongKey[]>(queryKey, (entries) =>
        entries?.filter((row) => row.id !== entryId),
      );

      return { previous };
    },
    onError: (_error, _entryId, context) => {
      // The row comes back rather than silently staying gone — the pane's own
      // handler is what tells them why.
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
