/**
 * The shapes the song library renders.
 *
 * These mirror what the web dashboard's `getOrganizationSongs` returns, with
 * the two differences every ported type here has: `DateTime` arrives as an ISO
 * string, and Prisma's enums become string unions — see
 * `src/lib/config/roles.ts` for why that matters.
 */

/** Every pitch a song can be keyed to. Prisma maps the sharps and flats. */
export type Pitch =
  | "C"
  | "C_SHARP"
  | "D_FLAT"
  | "D"
  | "D_SHARP"
  | "E_FLAT"
  | "E"
  | "F"
  | "F_SHARP"
  | "G_FLAT"
  | "G"
  | "G_SHARP"
  | "A_FLAT"
  | "A"
  | "A_SHARP"
  | "B_FLAT"
  | "B";

export type KeyQuality = "MAJOR" | "MINOR";

/**
 * A chart or a track pinned to a song.
 *
 * `url` is an UploadThing address the phone opens in a browser rather than
 * rendering: a PDF chart and an MP3 both belong to apps the device already has.
 */
export type SongAttachment = {
  id: string;
  name: string;
  url: string;
  /** A MIME type. `application/pdf` is a chart; everything else reads as audio. */
  type: string;
  size: number;
  createdAt: string;
};

export type LibrarySong = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  defaultPitch: Pitch;
  defaultKeyQuality: KeyQuality;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  themes: string[];
  attachments: SongAttachment[];
};

/**
 * One line of the caller's own key journal — the dashboard's My Keys tab.
 *
 * `title` and `artist` arrive resolved: the live song's while the link holds,
 * the snapshot taken when the entry was written once the song is gone. The
 * `library*` fields and the links are the song's own, and are null for an
 * entry that no longer points at one.
 *
 * Mirrors the wire type in the web app's
 * `app/api/mobile/v1/organizations/[orgId]/song-keys/route.ts`.
 */
export type SongKey = {
  id: string;
  /** Null when the song has left the library. Entries outlive their songs. */
  songId: string | null;
  title: string;
  artist: string;
  /** The key *you* sing it in, which is the whole point of the journal. */
  pitch: Pitch;
  keyQuality: KeyQuality;
  notes: string | null;
  updatedAt: string;
  /** What the library files it under, for the "library Bb" line when they differ. */
  libraryPitch: Pitch | null;
  libraryKeyQuality: KeyQuality | null;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
};

/**
 * What the journal's two write routes take.
 *
 * `title` and `artist` are sent for a freehand entry only — for a linked one
 * the server re-reads both off the Song row and ignores what was sent, so an
 * entry can never drift from the song it names.
 */
export type SongKeyInput = {
  songId: string | null;
  title: string;
  artist: string;
  pitch: Pitch;
  keyQuality: KeyQuality;
  notes: string;
};

/** What both write routes accept — the whole song, as the web form submits it. */
export type SongInput = {
  title: string;
  artist: string;
  bpm: number;
  timeSignature: string;
  defaultPitch: Pitch;
  defaultKeyQuality: KeyQuality;
  spotifyUrl: string;
  youtubeUrl: string;
  themes: string[];
};
