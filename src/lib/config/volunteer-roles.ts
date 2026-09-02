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
 * that is not a lucide glyph: a role is content rather than chrome, and colour
 * is what tells twelve of them apart at chip size, which a monochrome icon set
 * cannot do.
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

export type RoleCategory = "band" | "vocals" | "production" | "hospitality";

/**
 * The four groups the event roster is split into, and the order they sit in.
 *
 * Ported straight from the web's `lib/config/roles.ts` — the team card on both
 * platforms has to break the same twelve roles into the same four sections, or
 * a volunteer looking for "who else is on production" learns two layouts.
 */
export const roleCategoryConfig: Record<
  RoleCategory,
  { label: string; order: number }
> = {
  band: { label: "Band", order: 0 },
  vocals: { label: "Vocals", order: 1 },
  production: { label: "Production", order: 2 },
  hospitality: { label: "Hospitality", order: 3 },
};

export const roleToCategory: Record<VolunteerRole, RoleCategory> = {
  PIANIST: "band",
  AUX_KEYS: "band",
  BASSIST: "band",
  GUITARIST: "band",
  DRUMMER: "band",
  LEAD_VOCALIST: "vocals",
  BGVS: "vocals",
  SOUND_TECH: "production",
  STREAM_TECH: "production",
  PROJECTION_TECH: "production",
  USHER: "hospitality",
  GREETER: "hospitality",
};

/**
 * Every role, in the order a roster lists them — rhythm section first, then
 * the front line, then the booth, then the door. The same array the web's
 * `EventAssignmentsCard` sorts by.
 */
export const ROLE_ORDER: VolunteerRole[] = [
  "PIANIST",
  "AUX_KEYS",
  "BASSIST",
  "GUITARIST",
  "DRUMMER",
  "LEAD_VOCALIST",
  "BGVS",
  "SOUND_TECH",
  "STREAM_TECH",
  "PROJECTION_TECH",
  "USHER",
  "GREETER",
];

/** The categories in `order`, which is the sequence the team card renders. */
export const ROLE_CATEGORIES: RoleCategory[] = (
  Object.keys(roleCategoryConfig) as RoleCategory[]
).sort((a, b) => roleCategoryConfig[a].order - roleCategoryConfig[b].order);
