import type { AppSymbolName } from "@/components/app-symbol";
import type { Palette } from "@/constants/branding";
import type { OrgRole } from "@/types/organization";

export type RoleConfig = {
  symbol: AppSymbolName;
  label: string;
  /** The badge's surface and hairline. */
  badgeClass: string;
  /** The badge's label colour. */
  textClass: string;
  /** The same colour resolved to a hex, for native props like `tintColor`. */
  tint: string;
};

/**
 * Presentation for a membership role.
 *
 * The web twin returns Tailwind class names, and now so does this — the two
 * finally speak the same language. `tint` is the one value that still has to be
 * resolved, because `SymbolView` colours through a prop rather than a style.
 */
export const getRoleConfig = (role: OrgRole, theme: Palette): RoleConfig => {
  switch (role) {
    case "OWNER":
      return {
        symbol: { ios: "crown.fill", android: "workspace_premium" },
        label: "Owner",
        badgeClass: "border border-gold/40 bg-gold/15",
        textClass: "text-gold",
        tint: theme.gold,
      };
    case "ADMIN":
      return {
        symbol: { ios: "shield.fill", android: "shield" },
        label: "Admin",
        badgeClass: "border border-admin/30 bg-admin/10",
        textClass: "text-admin",
        tint: theme.admin,
      };
    default:
      return {
        symbol: { ios: "person.fill", android: "person" },
        label: "Member",
        badgeClass: "border border-border bg-surface",
        textClass: "text-muted-foreground",
        tint: theme.textMuted,
      };
  }
};
