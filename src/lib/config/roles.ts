import type { RowSymbol } from "@/components/list";
import type { Palette } from "@/constants/branding";
import type { OrgRole } from "@/types/organization";

/**
 * Admin's accent. The web config uses Tailwind's blue-500/600 here; this app's
 * palette has no blue, so the value is pinned locally rather than invented at
 * each call site. Move it into `branding.ts` if a second screen needs it.
 */
const ADMIN_BLUE = "#2563EB";

export type RoleConfig = {
  symbol: RowSymbol;
  label: string;
  background: string;
  border: string;
  foreground: string;
};

/**
 * Presentation for the signed-in user's membership role.
 *
 * The web twin returns Tailwind class names; React Native has no class names,
 * so this returns resolved colors instead. Member's colors are theme-dependent,
 * which is why the palette comes in as an argument.
 */
export const getRoleConfig = (role: OrgRole, theme: Palette): RoleConfig => {
  switch (role) {
    case "OWNER":
      return {
        symbol: { ios: "crown.fill", android: "workspace_premium" },
        label: "Owner",
        background: `${theme.gold}1F`,
        border: `${theme.gold}66`,
        foreground: theme.gold,
      };
    case "ADMIN":
      return {
        symbol: { ios: "shield.fill", android: "shield" },
        label: "Admin",
        background: `${ADMIN_BLUE}1A`,
        border: `${ADMIN_BLUE}33`,
        foreground: ADMIN_BLUE,
      };
    default:
      return {
        symbol: { ios: "person.fill", android: "person" },
        label: "Member",
        background: theme.surface,
        border: theme.border,
        foreground: theme.textMuted,
      };
  }
};
