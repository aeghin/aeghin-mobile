/** Mirrors the `OrgRole` enum in the Next app's Prisma schema. */
export type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * One row of the home list.
 *
 * Shape expected from `GET /api/mobile/v1/organizations` — the caller's own
 * organizations, so `role` is always the signed-in user's membership role.
 */
export type OrganizationSummary = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  role: OrgRole;
  memberCount: number;
};

/** Shape expected from `GET /api/mobile/v1/organizations/:id`. */
export type OrganizationDetail = OrganizationSummary & {
  /** ISO 8601 — straight off `Organization.createdAt`. */
  createdAt: string;
  upcomingEventCount: number;
  songCount: number;
  pendingInvitationCount: number;
};
