import type { VolunteerRole } from "@/types/event";
import type { OrganizationMember, OrgRole } from "@/types/organization";

/**
 * Searching and filtering the members roster.
 *
 * Every rule here is the dashboard's `members-list.tsx`, kept deliberately
 * identical: someone who narrows to admins who drum on the web and does the
 * same on their phone has to get the same people back.
 *
 * Both filters are single-select, as the web's two dropdowns are. That is the
 * one place this deliberately does *not* copy the song library beside it,
 * which multi-selects — the web library multi-selects too, and this one does
 * not, so each screen follows its own twin rather than its neighbour.
 *
 * It all runs on the device against the full list the route already returns:
 * a roster is tens of rows, and filtering here keeps typing responsive.
 */

/** Seniority order — how the roster is grouped, and how the filter lists them. */
export const ORG_ROLE_ORDER: OrgRole[] = ["OWNER", "ADMIN", "MEMBER"];

/** `"ALL"` is the web's own sentinel for an unset dropdown. */
export type RoleFilter = OrgRole | "ALL";
export type VolunteerFilter = VolunteerRole | "ALL";

export type RosterFilters = {
  query: string;
  role: RoleFilter;
  volunteerRole: VolunteerFilter;
};

export const NO_FILTERS: RosterFilters = {
  query: "",
  role: "ALL",
  volunteerRole: "ALL",
};

/**
 * Whether one row answers to the term.
 *
 * Name and address are tested separately rather than concatenated, which is
 * what the web does and is not merely tidier: joined into one string, a term
 * that straddles the seam — `"lovelace ada@"` against "Ada Lovelace
 * ada@…" — matches here and matches nothing there.
 *
 * `email` is empty on every row but your own when the server withholds
 * contacts from a plain member, so for them this quietly narrows to names.
 */
function matchesQuery(member: OrganizationMember, needle: string): boolean {
  const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();

  return fullName.includes(needle) || member.email.toLowerCase().includes(needle);
}

/**
 * The roster as the list should read it: matching the term, holding the org
 * role, and carrying the volunteer role — an intersection, as the web's is.
 *
 * Order is not this function's business; the screen groups what comes back by
 * seniority afterwards.
 */
export function filterMembers(
  members: OrganizationMember[],
  { query, role, volunteerRole }: RosterFilters,
): OrganizationMember[] {
  const needle = query.trim().toLowerCase();

  return members.filter((member) => {
    if (needle && !matchesQuery(member, needle)) return false;

    if (role !== "ALL" && member.role !== role) return false;

    if (volunteerRole !== "ALL" && !member.volunteerRoles.includes(volunteerRole)) {
      return false;
    }

    return true;
  });
}

/** How many filters are narrowing the list, for the badge on the dock. */
export function activeFilterCount({ role, volunteerRole }: RosterFilters): number {
  return (role === "ALL" ? 0 : 1) + (volunteerRole === "ALL" ? 0 : 1);
}

/** Whether anything at all is narrowing the list, the search term included. */
export function isNarrowed(filters: RosterFilters): boolean {
  return filters.query.trim().length > 0 || activeFilterCount(filters) > 0;
}

/**
 * How many members each org role holds.
 *
 * Counted against the *unfiltered* roster on purpose: these sit beside the
 * options in the picker, answering "how many are there", and a count that
 * moved as you narrowed would stop answering that.
 */
export function roleCounts(members: OrganizationMember[]): Record<OrgRole, number> {
  const counts: Record<OrgRole, number> = { OWNER: 0, ADMIN: 0, MEMBER: 0 };

  for (const member of members) counts[member.role] += 1;

  return counts;
}

/** The same, per volunteer role. Absent roles are simply missing from the map. */
export function volunteerRoleCounts(
  members: OrganizationMember[],
): Map<VolunteerRole, number> {
  const counts = new Map<VolunteerRole, number>();

  for (const member of members) {
    for (const role of member.volunteerRoles) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }

  return counts;
}
