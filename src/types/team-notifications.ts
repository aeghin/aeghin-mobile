/**
 * Who hears about staffing alerts, as `GET .../team-notifications` carries it.
 * Mirrors the NHC route's wire types — additive-only.
 */

import type { OrgRole } from "@/types/organization";

/** The four teams the volunteer roles fall into, as the API names them. */
export type Team = "BAND" | "VOCALS" | "PRODUCTION" | "HOSPITALITY";

export type TeamPerson = {
  userId: string;
  firstName: string;
  lastName: string;
};

export type TeamSettings = {
  team: Team;
  /** Asked to act when one of the team's roles opens up. */
  lead: TeamPerson | null;
  /** "Also notify": copied in for a heads-up. Never repeats the lead. */
  watchers: TeamPerson[];
};

export type TeamNotificationSettings = {
  teams: TeamSettings[];
  /** Admins and owners: everybody who can lead a team or be copied in. */
  managers: (TeamPerson & { role: OrgRole })[];
  /** Whose own switch this is, and whether they may change anybody else's. */
  viewer: { userId: string; isOwner: boolean };
};
