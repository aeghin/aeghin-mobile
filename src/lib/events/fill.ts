import type { Roles } from "@/lib/config/volunteer-roles";
import { roleStanding } from "@/lib/events/spots";
import type { EventDetails } from "@/types/event";
import type { Team } from "@/types/team-notifications";

/** A team the viewer can fill with AI on an event, and its open spots. */
export type FillableTeam = {
  team: Team;
  label: string;
  /** Spots nobody has said yes to and nobody is deciding on. */
  open: number;
  /** Whoever's in charge, by first name, when the viewer is only its backup. */
  backingUp: string | null;
};

/** Accepted, or pending and not yet lapsed — somebody the role still counts on. */
const isLive = (assignment: { status: string; expiresAt: string }, now: number) =>
  assignment.status === "ACCEPTED" ||
  (assignment.status === "PENDING" && new Date(assignment.expiresAt).getTime() > now);

/**
 * The teams the viewer can fill with AI on this event right now, the way the
 * dashboard's Team card decides it: the server's `aiTeams` with a spot still
 * open. A team the viewer only backs up waits for its lead until the backup
 * is needed — a spot on it fell through with nothing in flight, which is when
 * they're emailed, or last call.
 */
export function fillableTeams(event: EventDetails, roles: Roles, now: number): FillableTeam[] {
  const aiTeams = event.aiTeams ?? [];

  if (aiTeams.length === 0) return [];

  const rosterRoles = roles.inOrder([
    ...event.rolesNeeded,
    ...event.assignments.map((assignment) => assignment.role),
  ]);

  return aiTeams.flatMap(({ team, backingUp }) => {
    const groups = rosterRoles
      .filter((role) => roles.teamOf(role) === team)
      .map((role) => ({
        standing: roleStanding(role, event.roleSpots, event.assignments, now),
        items: event.assignments.filter((assignment) => assignment.role === role),
      }));

    const open = groups.reduce((sum, group) => sum + group.standing.open, 0);

    // The Team card's warning glyph: somebody fell through, nothing in flight.
    const stalled = groups.some(
      (group) => group.standing.open > 0 && group.items.some((item) => !isLive(item, now)),
    );

    const needed = backingUp === null || stalled || event.lastCall === true;

    return open > 0 && needed ? [{ team, label: roles.teamLabel(team), open, backingUp }] : [];
  });
}
