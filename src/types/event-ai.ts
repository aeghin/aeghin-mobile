import type { NewEventDay, ServiceTypeColor, VolunteerRole } from "@/types/event";

/**
 * What the event-draft agent streams back over
 * `POST /api/mobile/v1/organizations/:orgId/event-ai`.
 *
 * These mirror `lib/agents/event/agent.ts` and the `RoleEligibility` half of
 * `lib/types.ts` in the NHC repo. The agent's own output is only a suggestion:
 * every id, date and pick in an `EventDraft` has already been re-checked
 * against live data by the tool that produced it, and is checked again by the
 * create route when somebody approves it.
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

/** A pick the server rejected. Surfaced, never silently dropped. */
export type DraftWarning = {
  name: string;
  role: VolunteerRole;
  reason: string;
};

export type EventDraft = {
  serviceTypeId: string;
  serviceTypeName: string;
  serviceTypeColor: ServiceTypeColor;
  name: string;
  description: string;
  location: string;
  days: DraftDay[];
  rolesNeeded: VolunteerRole[];
  assignments: DraftAssignment[];
  expiresInDays: 3 | 5 | 7;
  smartSchedulingEnabled: boolean;
  summary: string;
  warnings: DraftWarning[];
  unfilledRoles: VolunteerRole[];
};

/** `proposeEvent`'s output. A rejection is the agent's cue to try again. */
export type ProposeEventOutput =
  | { ok: true; draft: EventDraft }
  | { ok: false; error: string };

export type RoleCandidate = {
  userId: string;
  name: string;
  /** Laplace-smoothed acceptance rate, 0–1. No-history members sit at 0.5. */
  reliability: number;
  responded: number;
  recentServes: number;
  lastServedOn: string | null;
};

export type RoleExclusion = {
  userId: string;
  name: string;
  reason: "conflict" | "blockout";
  detail: string;
};

export type RoleEligibility = {
  role: VolunteerRole;
  eligible: RoleCandidate[];
  excluded: RoleExclusion[];
  totalQualified: number;
};

/** `checkAvailability`'s output: the days it was asked about, and who is free. */
export type CheckAvailabilityOutput = {
  days: DraftDay[];
  roles: RoleEligibility[];
};
