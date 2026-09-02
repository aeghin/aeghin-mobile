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
