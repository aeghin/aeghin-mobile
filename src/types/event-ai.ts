import type { NewEventDay, ServiceTypeColor, VolunteerRole } from "@/types/event";
import type { Team } from "@/types/team-notifications";

/**
 * What the AI agents stream back: the event-draft agent over
 * `POST /api/mobile/v1/organizations/:orgId/event-ai`, and Fill with AI over
 * `POST /api/mobile/v1/organizations/:orgId/events/:eventId/team-ai`.
 *
 * These mirror `lib/agents/event/agent.ts`, `lib/agents/team/agent.ts` and
 * `lib/agents/shared.ts` in the NHC repo. The agent's own output is only a
 * suggestion: every id, date and pick has already been re-checked against live
 * data by the tool that produced it, and is checked again by the route that
 * acts on it when somebody approves.
 */

/** One day of a draft. The same wall-clock shape the create route takes. */
export type DraftDay = NewEventDay;

export type DraftAssignment = {
  userId: string;
  name: string;
  role: VolunteerRole;
  /** One sentence on why this person for this slot. */
  reason: string;
};

/** A pick the server rejected or left to somebody else. Surfaced, never silently dropped. */
export type DraftWarning = {
  name: string;
  role: VolunteerRole;
  reason: string;
};

/** Who picks the people for one team on a draft. */
export type DraftTeam = {
  team: Team;
  /** Their full name; the card says "You" when `you`. */
  name: string;
  you: boolean;
  /** Handling it for this event only, rather than as the team's lead. */
  cover: boolean;
};

/** A team handed to somebody for this event only, saved with the event. */
export type DraftCover = { team: Team; userId: string; name: string };

export type EventDraft = {
  serviceTypeId: string;
  serviceTypeName: string;
  serviceTypeColor: ServiceTypeColor;
  name: string;
  description: string;
  location: string;
  days: DraftDay[];
  rolesNeeded: VolunteerRole[];
  /** How many each role needs, for the roles needing more than one. Absent from older servers. */
  roleSpots?: Partial<Record<VolunteerRole, number>>;
  assignments: DraftAssignment[];
  expiresInDays: 3 | 5 | 7;
  smartSchedulingEnabled: boolean;
  /** Resolved to a real date, unlike a template's offset. Null when none. */
  rehearsal: DraftDay | null;
  summary: string;
  warnings: DraftWarning[];
  unfilledRoles: VolunteerRole[];
  /** Who picks each team's people. Absent from an older server, which makes every team the drafter's. */
  teams?: DraftTeam[];
  /** Absent from an older server. */
  covers?: DraftCover[];
};

/** `proposeEvent`'s output. A rejection is the agent's cue to try again. */
export type ProposeEventOutput =
  | { ok: true; draft: EventDraft; refill?: boolean }
  | { ok: false; error: string };

/** One person free for a role. */
export type AvailabilityCandidate = {
  name: string;
  /** Invitations they said yes to, out of `responded`. */
  accepted: number;
  responded: number;
  /** Times they served in the last 60 days, and the last day they did. */
  recentServes: number;
  lastServedOn: string | null;
  /** Other events ahead they've said yes to or are deciding on. */
  upcoming: number;
};

/** Somebody who holds the role but can't serve, and why. */
export type AvailabilityExclusion = {
  name: string;
  reason: "conflict" | "blockout";
  /** The clashing event's name, or the blockout's dates: `"2026-10-31 to 2026-11-02"`. */
  detail: string;
};

/** One role's availability. */
export type AvailabilityRole = {
  role: VolunteerRole;
  /** Everyone holding the role, the unavailable included. */
  totalQualified: number;
  /** Everyone free, best first. */
  eligible: AvailabilityCandidate[];
  excluded: AvailabilityExclusion[];
};

/** `checkAvailability`'s output: the days it was asked about, and who is free. */
export type CheckAvailabilityOutput = {
  days: DraftDay[];
  roles: AvailabilityRole[];
};

/**
 * ── Fill with AI ─────────────────────────────────────────────────────────
 */

export type ProposedInvite = {
  userId: string;
  name: string;
  role: VolunteerRole;
  /** One sentence on why this person for this spot. */
  reason: string;
};

/** A pick the server turned down. Surfaced, never silently dropped. */
export type InviteWarning = {
  name: string;
  role: VolunteerRole;
  reason: string;
};

export type TeamProposal = {
  picks: ProposedInvite[];
  note: string;
  warnings: InviteWarning[];
  /** Spots still open once these picks say yes, by role. */
  stillOpen: { role: VolunteerRole; count: number }[];
};

/** `proposeInvites`' output. A rejection is the agent's cue to try again. */
export type ProposeInvitesOutput =
  | { ok: true; proposal: TeamProposal; refill?: boolean }
  | { ok: false; error: string };
