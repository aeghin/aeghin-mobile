/**
 * The shapes the events screen renders.
 *
 * These mirror what the web dashboard's `getUserEvents` / `getOrgEvents`
 * already return, with two differences: `DateTime` fields arrive as ISO
 * strings rather than `Date`, and Prisma's enums become string unions — see
 * `src/lib/config/roles.ts` for why that matters when porting web config.
 */

import type { KeyQuality, Pitch, SongAttachment } from "@/types/song";

export type VolunteerRole =
  | "GUITARIST"
  | "PIANIST"
  | "AUX_KEYS"
  | "DRUMMER"
  | "LEAD_VOCALIST"
  | "BGVS"
  | "BASSIST"
  | "SOUND_TECH"
  | "STREAM_TECH"
  | "PROJECTION_TECH"
  | "USHER"
  | "GREETER";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED";

/** The eight swatches `ServiceType.color` is allowed to hold. */
export type ServiceTypeColor =
  | "indigo"
  | "amber"
  | "emerald"
  | "pink"
  | "violet"
  | "red"
  | "blue"
  | "cyan";

export type ServiceType = {
  id: string;
  name: string;
  color: ServiceTypeColor;
};

/**
 * One block of an event. An event has many, which is what makes a conference
 * or a weekend of rehearsals a single row rather than three.
 *
 * Times are wall-clock stored with a `Z` suffix, so every helper in
 * `src/lib/events/format.ts` reads them in UTC and never in device time.
 */
export type EventDate = {
  id: string;
  startTime: string;
  endTime: string;
};

export type EventAssignment = {
  id: string;
  userId: string;
  role: VolunteerRole;
  status: InvitationStatus;
  /** Null once the person who sent the invitation has left the organization. */
  assignedBy: { firstName: string } | null;
  expiresAt: string;
};

export type OrganizationEvent = {
  id: string;
  name: string;
  description: string;
  location: string;
  serviceTypeId: string;
  dates: EventDate[];
  /**
   * The signed-in user's assignments only — the same narrowing both web
   * queries apply. An event on the All tab that nobody invited you to carries
   * an empty array, and its row shows no role.
   */
  assignments: EventAssignment[];
  rolesNeeded: VolunteerRole[];
  /** Declining auto-invites the next best available member for that role. */
  smartSchedulingEnabled: boolean;
  /**
   * How many of `rolesNeeded` are filled, for the staffing meter on the All
   * tab. Optional: the row falls back to hiding the meter without it, so a
   * payload that doesn't count assignments still renders.
   */
  filledRoleCount?: number;
};

/**
 * ── Event details ───────────────────────────────────────────────────────
 *
 * What `GET /api/mobile/v1/organizations/:orgId/events/:eventId` answers with:
 * the dashboard's event detail page, flattened. Keep this in step with the
 * route's own wire types, and treat it as additive-only — installed apps
 * cannot be force-updated.
 */

/** Somebody named on the event, as the detail payload carries them. */
export type EventPerson = {
  userId: string;
  firstName: string;
  lastName: string;
  userImageUrl: string | null;
};

/**
 * One person's place on the event.
 *
 * Unlike {@link EventAssignment}, which the list screens narrow to the
 * signed-in user, this is the whole roster — declined and canceled included,
 * because the web shows those struck through rather than dropping them.
 */
export type EventDetailsAssignment = {
  id: string;
  userId: string;
  role: VolunteerRole;
  status: InvitationStatus;
  expiresAt: string;
  user: {
    firstName: string;
    lastName: string;
    userImageUrl: string | null;
  };
};

/**
 * One song in the event's setlist, already merged with the song it points at.
 *
 * The key and tempo are the *setlist's*, not the library's: a song is often
 * played a step down from how it is filed, and this is what the band reads.
 */
export type EventSetlistSong = {
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
  attachments: SongAttachment[];
  /** Who is singing this one. Empty until somebody is assigned. */
  vocalists: EventPerson[];
};

/** The seven activity kinds the smart-scheduling log is filtered down to. */
export type SmartActivityType =
  | "AUTO_INVITE_SENT"
  | "SMART_FILL_SKIPPED"
  | "SMART_FILL_NO_CANDIDATES"
  | "SMART_FILL_ALL_UNAVAILABLE"
  | "SMART_FILL_FAILED"
  | "SMART_SCHEDULING_ENABLED"
  | "SMART_SCHEDULING_DISABLED";

/**
 * One line of the smart-scheduling log.
 *
 * The names are snapshots taken when the entry was written, not joins, so a row
 * still reads correctly after the person it names has left the organization.
 *
 * `createdAt` is a real instant — the one date in this app that is *not* stored
 * as UTC wall-clock, and so the one that is read in device time.
 */
export type SmartSchedulingActivityItem = {
  id: string;
  type: SmartActivityType;
  actorName: string | null;
  targetName: string | null;
  detail: string | null;
  createdAt: string;
};

export type EventDetails = {
  id: string;
  name: string;
  description: string;
  location: string;
  rolesNeeded: VolunteerRole[];
  smartSchedulingEnabled: boolean;
  organizationName: string;
  serviceType: ServiceType;
  dates: EventDate[];
  assignments: EventDetailsAssignment[];
  setlist: EventSetlistSong[];
  /**
   * The caller's own standing, which is what every gate on the screen reads.
   * `userId` is the database id: the token carries only a Clerk id, so the
   * phone has no other way to tell which row is its own.
   */
  viewer: {
    userId: string;
    canManage: boolean;
    /** Accepted, not merely invited — the same right that opens the screen. */
    isAssigned: boolean;
  };
  /** Managers only; empty for everybody else. */
  smartSchedulingActivity: SmartSchedulingActivityItem[];
  /** Managers only; 0 for everybody else. */
  expiredInviteCount: number;
};
