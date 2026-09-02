import Crown from "lucide-react-native/icons/crown";
import Shield from "lucide-react-native/icons/shield";
import User from "lucide-react-native/icons/user";

import type { AppIconName } from "@/components/app-icon";
import type { Palette } from "@/constants/branding";
import type { OrgRole } from "@/types/organization";

/**
 * Who can act on the organization rather than only on their own schedule.
 *
 * Named roles rather than "not a member": the web gates every managed view
 * this way, and the API answers 403 on the same rule, so a role added later is
 * shut out until somebody decides otherwise. No organization resolved yet is
 * not one of them either.
 */
export const canManageOrg = (role: OrgRole | undefined): boolean =>
  role === "OWNER" || role === "ADMIN";

export type RoleConfig = {
  icon: AppIconName;
  label: string;
  /** The badge's surface and hairline. */
  badgeClass: string;
  /** The badge's label colour. */
  textClass: string;
  /** The same colour resolved to a hex, for the icon and the label alike. */
  tint: string;
};

/**
 * Presentation for a membership role.
 *
 * The web twin returns Tailwind class names, and now so does this — the two
 * finally speak the same language, down to the icon: `lib/config/roles.ts`
 * there names the same three lucide glyphs. `tint` is the one value that still
 * has to be resolved, because lucide colours through a prop, not a style.
 */
export const getRoleConfig = (role: OrgRole, theme: Palette): RoleConfig => {
  switch (role) {
    case "OWNER":
      return {
        icon: Crown,
        label: "Owner",
        badgeClass: "border border-gold/40 bg-gold/15",
        textClass: "text-gold",
        tint: theme.gold,
      };
    case "ADMIN":
      return {
        icon: Shield,
        label: "Admin",
        badgeClass: "border border-admin/30 bg-admin/10",
        textClass: "text-admin",
        tint: theme.admin,
      };
    default:
      return {
        icon: User,
        label: "Member",
        badgeClass: "border border-border bg-surface",
        textClass: "text-muted-foreground",
        tint: theme.textMuted,
      };
  }
};
