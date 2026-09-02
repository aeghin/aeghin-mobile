import type { KeyQuality, Pitch } from "@/types/song";

/**
 * Musical keys, ported from the web app's `lib/constants/key.ts`.
 *
 * The labels are the one part that must not drift: a key printed `Bb` on the
 * dashboard and `A#` on the phone is a different chart to the person holding
 * the guitar, even though the enum behind both is the same.
 */

export const PITCH_LABELS: Record<Pitch, string> = {
  C: "C",
  C_SHARP: "C#",
  D_FLAT: "Db",
  D: "D",
  D_SHARP: "D#",
  E_FLAT: "Eb",
  E: "E",
  F: "F",
  F_SHARP: "F#",
  G_FLAT: "Gb",
  G: "G",
  G_SHARP: "G#",
  A_FLAT: "Ab",
  A: "A",
  A_SHARP: "A#",
  B_FLAT: "Bb",
  B: "B",
};

export type KeyOption = {
  pitch: Pitch;
  quality: KeyQuality;
  label: string;
};

/**
 * The keys a song may be filed under, in the order the web picker lists them.
 *
 * Not every pitch/quality pair: the list is the enharmonic spellings players
 * actually write, which is why there is a `Db` but no `Dbm`.
 */
export const KEY_OPTIONS: KeyOption[] = [
  { pitch: "C", quality: "MAJOR", label: "C" },
  { pitch: "C", quality: "MINOR", label: "Cm" },
  { pitch: "C_SHARP", quality: "MAJOR", label: "C#" },
  { pitch: "C_SHARP", quality: "MINOR", label: "C#m" },
  { pitch: "D_FLAT", quality: "MAJOR", label: "Db" },
  { pitch: "D", quality: "MAJOR", label: "D" },
  { pitch: "D", quality: "MINOR", label: "Dm" },
  { pitch: "D_SHARP", quality: "MINOR", label: "D#m" },
  { pitch: "E_FLAT", quality: "MAJOR", label: "Eb" },
  { pitch: "E_FLAT", quality: "MINOR", label: "Ebm" },
  { pitch: "E", quality: "MAJOR", label: "E" },
  { pitch: "E", quality: "MINOR", label: "Em" },
  { pitch: "F", quality: "MAJOR", label: "F" },
  { pitch: "F", quality: "MINOR", label: "Fm" },
  { pitch: "F_SHARP", quality: "MAJOR", label: "F#" },
  { pitch: "F_SHARP", quality: "MINOR", label: "F#m" },
  { pitch: "G_FLAT", quality: "MAJOR", label: "Gb" },
  { pitch: "G", quality: "MAJOR", label: "G" },
  { pitch: "G", quality: "MINOR", label: "Gm" },
  { pitch: "G_SHARP", quality: "MINOR", label: "G#m" },
  { pitch: "A_FLAT", quality: "MAJOR", label: "Ab" },
  { pitch: "A", quality: "MAJOR", label: "A" },
  { pitch: "A", quality: "MINOR", label: "Am" },
  { pitch: "A_SHARP", quality: "MINOR", label: "A#m" },
  { pitch: "B_FLAT", quality: "MAJOR", label: "Bb" },
  { pitch: "B_FLAT", quality: "MINOR", label: "Bbm" },
  { pitch: "B", quality: "MAJOR", label: "B" },
  { pitch: "B", quality: "MINOR", label: "Bm" },
];

/** `("B_FLAT", "MINOR")` -> `"Bbm"`. */
export const formatKey = (pitch: Pitch, quality: KeyQuality): string =>
  `${PITCH_LABELS[pitch]}${quality === "MINOR" ? "m" : ""}`;

/** The time signatures the web form offers, in its order. */
export const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "12/8", "2/4", "5/4"];

/** Suggested themes, offered as taps before anyone types their own. */
export const COMMON_THEMES = [
  "Worship",
  "Praise",
  "Thanksgiving",
  "Communion",
  "Christmas",
  "Easter",
  "Salvation",
  "Grace",
  "Faithfulness",
  "Hope",
  "Love",
  "Jesus",
  "Cross",
  "Resurrection",
];
