import type { KeyQuality, Pitch } from "@/types/song";

/**
 * One row of the setlist editor's draft — the dashboard's `SetlistSong`.
 *
 * `id` is the saved row's id for songs already on the setlist and a fresh
 * uuid for ones added in this session; the server keys on `songId` and mints
 * ids of its own, so a draft id is only ever a React key.
 */
export type SetlistDraftSong = {
  id: string;
  songId: string;
  position: number;
  pitch: Pitch;
  keyQuality: KeyQuality;
  bpm: number;
  timeSignature: string;
  title: string;
  artist: string;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
};

/** What the agent's `proposeSetlist` tool hands back, hydrated from the catalog. */
export type ProposedSetlistSong = {
  songId: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  pitch: Pitch;
  keyQuality: KeyQuality;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  reason: string;
};

export type SetlistProposal = {
  title: string;
  songs: ProposedSetlistSong[];
  /** Ids the model named that were not in the catalog. */
  skipped: string[];
};
