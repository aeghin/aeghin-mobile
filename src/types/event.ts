/**
 * The shapes the events screen renders.
 *
 * These mirror what the web dashboard's `getUserEvents` / `getOrgEvents`
 * already return, with two differences: `DateTime` fields arrive as ISO
 * strings rather than `Date`, and Prisma's enums become string unions — see
 * `src/lib/config/roles.ts` for why that matters when porting web config.
 */

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
