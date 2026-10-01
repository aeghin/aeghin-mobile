/**
 * Who hears about staffing alerts, as `GET .../team-notifications` carries it.
 * Mirrors the NHC route's wire types.
 */

import type { OrgRole } from "@/types/organization";

/**
 * A team's key, e.g. `"BAND"`, as the API names it. A plain string for the same
 * reason as `VolunteerRole`: the server adds teams without a release.
 */
export type Team = string;

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

/** One service type's teams. */
export type ServiceTypeTeams = {
  serviceTypeId: string;
  name: string;
  color: string;
  teams: TeamSettings[];
};

export type TeamNotificationSettings = {
  /** Live service types, oldest first. */
  serviceTypes: ServiceTypeTeams[];
  /** Admins and owners: everybody who can lead a team or be copied in. */
  managers: (TeamPerson & { role: OrgRole })[];
  /** Who is asking, so the screens can say "you". */
  viewer: { userId: string };
};

/** Somebody picked to handle one team on one event only, in place of its lead. */
export type TeamLeadPick = {
  team: Team;
  userId: string;
};
