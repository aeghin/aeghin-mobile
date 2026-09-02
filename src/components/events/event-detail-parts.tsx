import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

/**
 * The shell every section of the event screen sits in.
 *
 * One rounded surface per section, inset from the page the way the rest of the
 * app's cards are — the web's three-column grid collapses to exactly this
 * stack on a narrow viewport, so the phone is not being given a different
 * reading order, only the one the browser already falls back to.
 */
export function DetailCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** A service-tinted wash, for the sections the web paints in that hue. */
  style?: ViewStyle;
}) {
  return (
    <VStack
      className={`mx-4 overflow-hidden rounded-2xl border border-border bg-card ${
        className ?? ""
      }`}
      style={style}
    >
      {children}
    </VStack>
  );
}

type DetailCardHeaderProps = {
  icon: AppIconName;
  title: string;
  /** The icon's colour, when a section is tinted by its service type. */
  tint?: string;
  /** A count, a status — whatever the section answers at a glance. */
  trailing?: ReactNode;
};

/** A section's title bar: a glyph, a name, and what it adds up to. */
export function DetailCardHeader({
  icon,
  title,
  tint,
  trailing,
}: DetailCardHeaderProps) {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-2 px-3.5 pb-2.5 pt-3.5">
      <AppIcon icon={icon} size={15} color={tint ?? theme.textMuted} />

      <Text className="flex-1 text-[14px] font-semibold tracking-[-0.2px] text-foreground">
        {title}
      </Text>

      {trailing}
    </HStack>
  );
}

/** The muted tabular count the web puts opposite a section title. */
export function DetailCount({ children }: { children: string }) {
  return (
    <Text
      className="text-[12px] text-muted-foreground"
      style={{ fontVariant: ["tabular-nums"] }}
    >
      {children}
    </Text>
  );
}

/** What a section shows when it has nothing in it yet. */
export function DetailEmpty({ children }: { children: string }) {
  return (
    <Text className="px-3.5 pb-4 pt-1 text-[13px] text-muted-foreground">
      {children}
    </Text>
  );
}

/**
 * Overlapping faces, the way the web stacks assigned vocalists.
 *
 * The ring between them is a pad in the card's own colour rather than a border
 * on the avatar: a border would inset the photo inside its circle, and these
 * are small enough already.
 */
export function AvatarStack({
  people,
  size = 22,
  max = 4,
}: {
  people: { userId: string; firstName: string; lastName: string; userImageUrl: string | null }[];
  size?: number;
  max?: number;
}) {
  const theme = useTheme();

  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const names = people
    .map((person) => `${person.firstName} ${person.lastName}`.trim())
    .join(", ");

  return (
    <HStack accessible accessibilityLabel={names} className="items-center">
      {shown.map((person, index) => (
        <Box
          key={person.userId}
          className="rounded-full"
          style={{
            backgroundColor: theme.card,
            padding: 1.5,
            marginLeft: index === 0 ? 0 : -size * 0.3,
          }}
        >
          <OrgAvatar
            name={`${person.firstName} ${person.lastName}`.trim()}
            logoUrl={person.userImageUrl}
            size={size}
            shape="circle"
          />
        </Box>
      ))}

      {extra > 0 ? (
        <Text
          className="ml-1 text-[11px] font-semibold text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {`+${extra}`}
        </Text>
      ) : null}
    </HStack>
  );
}
