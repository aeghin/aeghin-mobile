import type { InvitationStatus, VolunteerRole } from "@/types/event";

export type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

export type OrganizationSummary = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  role: OrgRole;
  memberCount: number;
};

export type OrganizationDetail = OrganizationSummary & {
  createdAt: string;
  upcomingEventCount: number;
  songCount: number;
  pendingInvitationCount: number;
};

export type OrganizationMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageUrl: string | null;
  role: OrgRole;
  /** What they can be scheduled for. The event invite picker filters on it. */
  volunteerRoles: VolunteerRole[];
  joinedAt: string;
};

export type OrganizationInput = {
  name: string;
  description: string;
};

/** What `POST .../invitations` takes. `orgId` comes from the path. */
export type InvitationInput = {
  email: string;
  phoneNumber: string;
  volunteerRoles: VolunteerRole[];
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  status: InvitationStatus;
  volunteerRoles: VolunteerRole[];
  expiresAt: string;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
};

/**
 * One of the caller's blockouts. Both ends are calendar days stored at UTC
 * midnight, so they are read with `dayKey` the way event dates are.
 */
export type Blockout = {
  id: string;
  startDate: string;
  endDate: string;
};

/**
 * An invitation waiting on the signed-in person, as `GET /invitations`
 * carries it. The phone asks what is waiting rather than following a token
 * out of an email, because unlike a browser it already knows who is asking.
 */
export type PendingInvitation = {
  id: string;
  /** What answering is keyed on. It is the caller's own invitation. */
  token: string;
  email: string;
  volunteerRoles: VolunteerRole[];
  expiresAt: string;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
  organization: {
    id: string;
    name: string;
    description: string;
    logoUrl: string | null;
    memberCount: number;
  };
};

/**
 * One invitation resolved from a link. Carries the reasons it might not be
 * answerable, which the list above never has to: already answered, lapsed, or
 * addressed to a different account.
 */
export type InvitationDetail = PendingInvitation & {
  status: InvitationStatus;
  expired: boolean;
  forYou: boolean;
  alreadyMember: boolean;
};

/**
 * One member's answer rate over a span.
 *
 * `invited` is `accepted + declined` rather than everything ever sent — an
 * invitation still waiting has not been answered either way, and counting it
 * would make the rate drop simply because the schedule got busier.
 */
export type RangeStats = {
  invited: number;
  accepted: number;
  declined: number;
};

/** A song this member has sung, and how often. */
export type MemberSong = {
  title: string;
  artist: string;
  count: number;
};

/** What the member profile's two cards are drawn from. */
export type MemberStats = {
  all: RangeStats;
  /** The same, for the current calendar year. */
  year: RangeStats;
  /** The five they have sung most, most first. */
  songs: MemberSong[];
};
