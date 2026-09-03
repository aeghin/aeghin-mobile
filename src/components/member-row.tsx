import ChevronRight from "lucide-react-native/icons/chevron-right";

import { AppIcon } from "@/components/app-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import { getRoleConfig } from "@/lib/config/roles";
import type { OrganizationMember } from "@/types/organization";

const AVATAR = 44;
const PADDING = 14;
/** `HStack space="md"`, in points — the separator inset has to know it. */
const GAP = 12;

/** Feed this to an `InsetCard` so hairlines start at the text, not the avatar. */
export const MEMBER_SEPARATOR_INSET = PADDING + AVATAR + GAP;

/** Padding shared by the real row and its placeholder, so nothing shifts. */
const ROW_CLASS = "items-center px-3.5 py-[11px]";

type MemberRowProps = {
  member: OrganizationMember;
  /** Marks the signed-in user's own row. */
  isYou?: boolean;
  /** Opens the member's own screen. */
  onPress?: () => void;
};

/**
 * One person inside the roster card.
 *
 * Draws no surface of its own — the `InsetCard` owns the background, the
 * rounding and the separators.
 */
export function MemberRow({ member, isYou, onPress }: MemberRowProps) {
  const theme = useTheme();
  const { firstName, lastName, email, imageUrl, role } = member;

  const { icon, label, textClass, tint } = getRoleConfig(role, theme);

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      className="data-[active=true]:bg-border/60"
    >
    <HStack space="md" className={ROW_CLASS}>
      {/* People read as circles; the squircle is for organization logos. */}
      <OrgAvatar
        name={fullName}
        logoUrl={imageUrl}
        size={AVATAR}
        shape="circle"
      />

      <VStack className="flex-1 gap-px">
        <Text
          className="text-base font-semibold tracking-[-0.2px] text-foreground"
          numberOfLines={1}
        >
          {isYou ? "You" : fullName}
        </Text>

        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          {email}
        </Text>
      </VStack>

      {/* Tinted text rather than a filled pill: owner and admin still carry
          colour, while "Member" recedes instead of shouting on every row. */}
      <HStack space="xs" className="items-center">
        <AppIcon icon={icon} size={12} color={tint} />
        <Text className={`text-[13px] font-semibold ${textClass}`}>{label}</Text>
      </HStack>

      {onPress ? <AppIcon icon={ChevronRight} size={14} color={theme.textMuted} /> : null}
    </HStack>
    </Pressable>
  );
}

/** Widths cycle so a column of placeholders reads as names, not as a grid. */
const SKELETON_WIDTHS = [
  { name: 150, email: 200 },
  { name: 120, email: 175 },
  { name: 168, email: 215 },
];

/**
 * A placeholder row, sized to match a real one.
 *
 * Shown while the roster loads so the screen keeps the list's shape instead of
 * flashing empty — the fetch is short, and a void that size reads as breakage.
 */
export function MemberRowSkeleton({ index = 0 }: { index?: number }) {
  const width = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];

  return (
    <HStack space="md" className={ROW_CLASS}>
      <Skeleton
        variant="circular"
        startColor="bg-border"
        style={{ width: AVATAR, height: AVATAR }}
      />

      <VStack className="flex-1 gap-[7px]">
        <Skeleton startColor="bg-border" style={{ width: width.name, height: 13 }} />
        <Skeleton startColor="bg-border" style={{ width: width.email, height: 11 }} />
      </VStack>

      <Skeleton startColor="bg-border" style={{ width: 58, height: 13 }} />
    </HStack>
  );
}
