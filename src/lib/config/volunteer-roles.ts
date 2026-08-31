import type { VolunteerRole } from "@/types/event";

export type VolunteerRoleConfig = {
  label: string;
  emoji: string;
};

/**
 * What each volunteer role is called and what it looks like.
 *
 * Emoji, character for character with the web app's `lib/config/roles.ts`, so
 * a guitarist sees the same guitar on both. They are the one place in this app
 * that is not an `expo-symbols` glyph: a role is content rather than chrome,
 * and colour is what tells twelve of them apart at chip size, which a
 * monochrome symbol set cannot do.
 *
 * Every glyph here is Emoji 3.0 or older. The newest is 🥁 (Emoji 3.0), which
 * Android picked up in 7.0 — this app's `minSdkVersion` is 24, which *is*
 * Android 7.0, so nothing here can land as a tofu box on a supported device.
 * Android draws Google's Noto set rather than Apple's, so the art differs by
 * platform; the meaning does not.
 */
export const volunteerRoleConfig: Record<VolunteerRole, VolunteerRoleConfig> = {
  GUITARIST: { label: "Guitarist", emoji: "🎸" },
  BASSIST: { label: "Bassist", emoji: "🎸" },
  PIANIST: { label: "Pianist", emoji: "🎹" },
  AUX_KEYS: { label: "Aux Keys", emoji: "🎹" },
  DRUMMER: { label: "Drummer", emoji: "🥁" },
  LEAD_VOCALIST: { label: "Lead Vocalist", emoji: "🎤" },
  BGVS: { label: "BGVs", emoji: "🎤" },
  SOUND_TECH: { label: "Sound Tech", emoji: "🎚️" },
  STREAM_TECH: { label: "Stream Tech", emoji: "📹" },
  PROJECTION_TECH: { label: "Projection", emoji: "📽️" },
  USHER: { label: "Usher", emoji: "🚪" },
  GREETER: { label: "Greeter", emoji: "👋" },
};

export const getVolunteerRoleConfig = (role: VolunteerRole) =>
  volunteerRoleConfig[role];
