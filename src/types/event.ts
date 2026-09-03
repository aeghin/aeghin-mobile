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

/**
 * ── Creating an event ───────────────────────────────────────────────────
 *
 * What `POST /api/mobile/v1/organizations/:orgId/events` takes. Not the
 * dashboard form's own shape: the web carries a `dateRange` its action never
 * reads and a record keyed by date, both artefacts of its wizard. This is the
 * thing itself, and the route assembles what the action wants.
 */

/** One day the event runs. Times are wall-clock, read in UTC like every other. */
export type NewEventDay = {
  /** `"2026-09-27"`. */
  date: string;
  /** `"10:00"`. */
  startTime: string;
  endTime: string;
};

export type NewEvent = {
  serviceTypeId: string;
  name: string;
  description?: string;
  location: string;
  days: NewEventDay[];
  rolesNeeded: VolunteerRole[];
  /** Days an invitee has to answer: 3, 5 or 7. */
  expiresAt: number;
  smartSchedulingEnabled: boolean;
  /** Who to invite, per role. Every role optional. */
  roleAssignments: Record<string, string[]>;
};

/**
 * One day of a template's schedule.
 *
 * A wall clock, not an instant: a template has no date until an event is built
 * from it. Position in the array is the day offset from `dayOfWeek` — the
 * server writes `dayOffset: index` and reads them back in that order, which is
 * what lets a template become a contiguous date range.
 */
export type EventTemplateDay = {
  /** `"09:00"`. */
  startTime: string;
  endTime: string;
};

/** A saved starting point for an event. Owners and admins only. */
export type EventTemplate = {
  id: string;
  name: string;
  description: string;
  location: string;
  /** `0` Sunday … `6` Saturday, matching `Date.getDay()`. */
  dayOfWeek: number;
  days: EventTemplateDay[];
  rolesNeeded: VolunteerRole[];
  /** Days an invitee gets to answer on events built from this: 3, 5 or 7. */
  expiresInDays: number;
  smartSchedulingEnabled: boolean;
  serviceTypeId: string;
  serviceType: ServiceType;
};

/** What both template write routes take. The organization comes from the path. */
export type EventTemplateInput = {
  serviceTypeId: string;
  name: string;
  description?: string;
  location: string;
  dayOfWeek: number;
  days: EventTemplateDay[];
  rolesNeeded: VolunteerRole[];
  expiresInDays: number;
  smartSchedulingEnabled: boolean;
};

/**
 * What the edit screen sends back: the fields the dashboard's "edit event
 * details" dialog owns. Not the service type, the roles or the roster — those
 * have their own controls on the detail screen, and the web's dialog leaves
 * them alone too.
 */
export type EventEdit = {
  name: string;
  description?: string;
  location: string;
  days: NewEventDay[];
};

/** An event somebody is already booked on over the hours being planned. */
export type MemberConflict = {
  eventName: string;
  startTime: string;
  endTime: string;
};

/** A member's own declared unavailability. */
export type MemberBlockout = {
  startDate: string;
  endDate: string;
};

/**
 * Who cannot make the hours being planned, keyed by user id.
 *
 * The two halves are not the same weight. A blockout is refused by the server
 * outright; a conflict is the manager's call, so the picker warns and lets
 * them go ahead.
 */
export type MemberAvailability = {
  conflicts: Record<string, MemberConflict>;
  blockouts: Record<string, MemberBlockout>;
};
