import { AppSymbol } from "@/components/app-symbol";
import { Badge, BadgeText } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import { getRoleConfig } from "@/lib/config/roles";
import type { OrgRole } from "@/types/organization";

type RoleBadgeProps = {
  role: OrgRole;
};

const SYMBOL_SIZE = 11;

/**
 * Someone's role in an organization. Label, symbol and colours all come from
 * `getRoleConfig`, so this badge and its web twin stay in step.
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  const theme = useTheme();
  const { symbol, label, badgeClass, textClass, tint } = getRoleConfig(
    role,
    theme,
  );

  return (
    <Badge
      variant="outline"
      className={`gap-1 rounded-md px-2 py-[3px] ${badgeClass}`}
    >
      <AppSymbol name={symbol} size={SYMBOL_SIZE} tint={tint} />
      <BadgeText className={`text-[11px] font-bold tracking-wider ${textClass}`}>
        {label}
      </BadgeText>
    </Badge>
  );
}
