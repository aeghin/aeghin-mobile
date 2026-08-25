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
};
