import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { personName } from "@/lib/names";

/** A section header's icon square. */
const ICON_TILE = 30;

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
  /** One muted line under the title: a count, who may post. */
  subtitle?: string;
  /** The service the event belongs to, which the icon's tile wears. */
  tint: { base: string; text: string };
  /** A count, a button — whatever the section offers at a glance. */
  trailing?: ReactNode;
};

/** A section's title bar: its glyph on a tinted tile, a name, and what it adds up to. */
export function DetailCardHeader({ icon, title, subtitle, tint, trailing }: DetailCardHeaderProps) {
  return (
    <HStack className="items-center gap-3 px-4 pb-3 pt-4">
      <Center
        className="rounded-[10px]"
        style={{
          width: ICON_TILE,
          height: ICON_TILE,
          borderCurve: "continuous",
          backgroundColor: withAlpha(tint.base, 0.12),
        }}
      >
        <AppIcon icon={icon} size={15} color={tint.text} />
      </Center>

      <VStack className="flex-1">
        <Text className="text-[15px] font-bold leading-[20px] tracking-[-0.2px] text-foreground">
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-[12px] leading-[16px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </VStack>

      {trailing}
    </HStack>
  );
}

type DetailButtonProps = {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  /** The event's service, whose colour every button on the page wears. */
  service: { base: string; text: string };
  /** Filled in the service's colour: the one action a section leads with. */
  primary?: boolean;
  /** Tinted in the service's colour while what it toggles is on. */
  on?: boolean;
  /**
   * Present on a button that toggles. The label does not spell the state out —
   * the colour carries it — so this is what says "on" to a screen reader.
   */
  checked?: boolean;
  /** Present on a button that shows and hides something below it. */
  expanded?: boolean;
  busy?: boolean;
  style?: ViewStyle;
};

/**
 * A section's small outlined button. Kept at 34pt so a pair shares a line in
 * the card; `hitSlop` gives the finger back what the box gives up.
 */
export function DetailButton({
  icon,
  label,
  onPress,
  service,
  primary,
  on,
  checked,
  expanded,
  busy,
  style,
}: DetailButtonProps) {
  const theme = useTheme();
  const color = primary ? "#FFFFFF" : on ? service.text : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole={checked === undefined ? "button" : "switch"}
      accessibilityLabel={label}
      accessibilityState={
        checked !== undefined ? { checked } : expanded !== undefined ? { expanded } : undefined
      }
      className="data-[active=true]:opacity-70"
      style={[{ opacity: busy ? 0.5 : 1 }, style]}
    >
      <HStack
        className="h-[34px] items-center justify-center gap-1.5 rounded-[10px] border px-3"
        style={{
          borderCurve: "continuous",
          borderColor: primary
            ? service.base
            : on
              ? withAlpha(service.base, 0.35)
              : theme.border,
          backgroundColor: primary
            ? service.base
            : on
              ? withAlpha(service.base, 0.1)
              : theme.card,
          boxShadow: "0px 1px 0px rgba(0, 0, 0, 0.05)",
        }}
      >
        <AppIcon icon={icon} size={13} color={primary ? color : service.text} />
        <Text className="text-[12.5px] font-semibold" style={{ color }} numberOfLines={1}>
          {label}
        </Text>
      </HStack>
    </Pressable>
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
    <Text className="px-4 pb-4 pt-0.5 text-[13px] text-muted-foreground">
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
    .map(personName)
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
            name={personName(person)}
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
