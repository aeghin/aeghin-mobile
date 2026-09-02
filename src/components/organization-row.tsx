import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";

import { AppIcon } from "@/components/app-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { RoleBadge } from "@/components/role-badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import type { OrganizationSummary } from "@/types/organization";

type OrganizationRowProps = {
  organization: OrganizationSummary;
  onPress: () => void;
  /** The one the tabs are currently reading from. */
  isCurrent?: boolean;
};

/** One organization card in the picker. */
export function OrganizationRow({
  organization,
  onPress,
  isCurrent = false,
}: OrganizationRowProps) {
  const theme = useTheme();
  const { name, description, logoUrl, role, memberCount } = organization;

  const members = `${memberCount} ${memberCount === 1 ? "member" : "members"}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${role.toLowerCase()}, ${members}`}
      accessibilityState={{ selected: isCurrent }}
      className={`rounded-2xl border p-3 data-[active=true]:opacity-65 ${
        isCurrent ? "border-brand/50 bg-brand/5" : "border-border bg-surface"
      }`}
    >
      <HStack space="md" className="items-center">
        <OrgAvatar name={name} logoUrl={logoUrl} size={48} />

        <VStack className="flex-1 gap-[3px]">
          <HStack space="sm" className="items-center">
            <Text
              className="shrink text-[17px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {name}
            </Text>
            <RoleBadge role={role} />
          </HStack>

          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {description ? `${members} · ${description}` : members}
          </Text>
        </VStack>

        {/* The list doubles as the switcher, so the row that is already in
            use says so rather than offering to navigate to itself. */}
        {isCurrent ? (
          <AppIcon icon={Check} size={15} color={brand.orange} />
        ) : (
          <AppIcon icon={ChevronRight} size={14} color={theme.textMuted} />
        )}
      </HStack>
    </Pressable>
  );
}
