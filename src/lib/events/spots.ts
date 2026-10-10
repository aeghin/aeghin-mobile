import type { RoleSpots, VolunteerRole } from "@/types/event";

/**
 * How many people a role needs, and where it stands against that. Mirrors
 * `lib/role-spots.ts` in the web app, which every notification and the meter
 * read — keep the two in step.
 */

export const spotsFor = (spots: RoleSpots | undefined, role: VolunteerRole): number =>
  spots?.[role] ?? 1;

type Answer = { role: VolunteerRole; status: string; expiresAt: string };

export type RoleStanding = {
  needed: number;
  accepted: number;
  /** Invited and still inside their window to answer. */
  deciding: number;
  /** Spots nobody has said yes to and nobody is deciding on. */
  open: number;
};

export function roleStanding(
  role: VolunteerRole,
  spots: RoleSpots | undefined,
  assignments: readonly Answer[],
  now: number,
): RoleStanding {
  let accepted = 0;
  let deciding = 0;

  for (const assignment of assignments) {
    if (assignment.role !== role) continue;

    if (assignment.status === "ACCEPTED") {
      accepted += 1;
    } else if (
      assignment.status === "PENDING" &&
      new Date(assignment.expiresAt).getTime() > now
    ) {
      deciding += 1;
    }
  }

  const needed = spotsFor(spots, role);

  return { needed, accepted, deciding, open: Math.max(0, needed - accepted - deciding) };
}
