import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { ScrollView, type BoxShadowValue } from "react-native";
import Animated, { useAnimatedRef, useAnimatedStyle } from "react-native-reanimated";
import Sortable, { useItemContext } from "react-native-sortables";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { blendOver, brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { formatMonth } from "@/lib/events/format";
import { TIME_SCOPES, type TimeScope } from "@/lib/events/schedule";
import type { ServiceType } from "@/types/event";

/** Horizontal padding the rows below bleed past, so they scroll edge to edge. */
const GUTTER = 16;

type ScopeFilterProps = {
  value: TimeScope;
  onChange: (scope: TimeScope) => void;
};

/**
 * Which stretch of the calendar the list covers.
 *
 * Text that tints rather than a second segmented control: the control above it
 * already owns that shape, and two of them stacked read as one broken widget.
 */
export function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Grows to the row's width so the scopes sit centred; at a large text
      // size they outgrow it and scroll from the left as before.
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: GUTTER,
        gap: 4,
      }}
    >
      {TIME_SCOPES.map((scope) => {
        const active = scope.value === value;

        return (
          <Pressable
            key={scope.value}
            onPress={() => onChange(scope.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="rounded-lg px-2.5 py-1.5 data-[active=true]:opacity-60"
            style={{
              backgroundColor: active
                ? withAlpha(brand.orange, 0.13)
                : "transparent",
            }}
          >
            <Text
              className={`text-[13px] font-semibold ${
                active ? "text-brand" : "text-muted-foreground"
              }`}
            >
              {scope.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type MonthStepperProps = {
  /** A `"2026-08"` month key. */
  value: string;
  onChange: (monthKey: string) => void;
};

/** Steps the month the two month-bound scopes read from. */
export function MonthStepper({ value, onChange }: MonthStepperProps) {
  const theme = useTheme();

  return (
    <HStack
      className="mx-4 items-center justify-between rounded-xl border border-border bg-surface px-1"
      style={{ height: 36 }}
    >
      <StepperButton
        icon={ChevronLeft}
        label="Previous month"
        onPress={() => onChange(shift(value, -1))}
        tint={theme.textMuted}
      />

      <Text className="text-[13px] font-semibold text-foreground">
        {formatMonth(value)}
      </Text>

      <StepperButton
        icon={ChevronRight}
        label="Next month"
        onPress={() => onChange(shift(value, 1))}
        tint={theme.textMuted}
      />
    </HStack>
  );
}

function shift(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function StepperButton({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-8 w-10 items-center justify-center rounded-lg data-[active=true]:bg-border/60"
    >
      <AppIcon icon={icon} size={13} color={tint} />
    </Pressable>
  );
}

type ServiceFilterProps = {
  /** Already in the viewer's own order. */
  services: ServiceType[];
  /** Null means "All". */
  value: string | null;
  onChange: (serviceTypeId: string | null) => void;
  /** A pill was dropped somewhere new: every id, first to last. */
  onReorder: (serviceTypeIds: string[]) => void;
};

/**
 * Narrows the list to one kind of service — and holds each person's own order
 * of them: hold a pill, drag it along the row, and it stays where it lands.
 *
 * A selected chip wears the service's own colour rather than a shared accent —
 * it is the same colour as the rail on every card the filter leaves behind, so
 * the connection is visible without reading either label.
 *
 * "All" sits outside the sortable run, so it always comes first. The pills tap
 * through `Sortable.Touchable` rather than `Pressable`, which can fire its
 * press as a dragged pill is dropped.
 */
export function ServiceFilter({
  services,
  value,
  onChange,
  onReorder,
}: ServiceFilterProps) {
  const theme = useTheme();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // A scroll view clips to its bounds, and a row only as tall as its pills
      // cut the lifted pill's shadow off entirely. The padding makes room for
      // it; the negative margins give that room back to the page's 12pt gaps,
      // so nothing around the row moves.
      style={{ marginTop: -2, marginBottom: -10 }}
      contentContainerStyle={{
        paddingHorizontal: GUTTER,
        paddingTop: 2,
        paddingBottom: 10,
        gap: 8,
      }}
    >
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: value === null }}
        className="rounded-full border px-3 py-1.5 data-[active=true]:opacity-60"
        style={{
          borderColor: value === null ? theme.text : theme.border,
          backgroundColor: value === null ? theme.text : "transparent",
        }}
      >
        <Text
          className="text-[12.5px] font-semibold"
          style={{ color: value === null ? theme.background : theme.textMuted }}
        >
          All
        </Text>
      </Pressable>

      <Sortable.Flex
        flexDirection="row"
        flexWrap="nowrap"
        gap={8}
        scrollableRef={scrollRef}
        autoScrollDirection="horizontal"
        overDrag="horizontal"
        dragActivationDelay={250}
        activeItemScale={1.06}
        activeItemShadowOpacity={0}
        inactiveItemOpacity={1}
        onDragEnd={({ fromIndex, toIndex, order }) => {
          if (fromIndex !== toIndex) {
            onReorder(order(services).map((service) => service.id));
          }
        }}
      >
        {services.map((service) => {
          const active = service.id === value;

          return (
            <ServicePill
              key={service.id}
              service={service}
              active={active}
              onSelect={() => onChange(active ? null : service.id)}
            />
          );
        })}
      </Sortable.Flex>
    </Animated.ScrollView>
  );
}

/**
 * The web's `shadow-md` under a pill being dragged — below it, not around it.
 * Constants rather than built per frame: iOS rebuilds a view's shadow layers
 * whenever `boxShadow` changes, so a value that tracked the lift animation cost
 * a rebuild on every frame of the pickup and every frame of the drop.
 */
const LIFTED: BoxShadowValue[] = [
  { offsetX: 0, offsetY: 4, blurRadius: 6, spreadDistance: -1, color: "rgba(0, 0, 0, 0.1)" },
  { offsetX: 0, offsetY: 2, blurRadius: 4, spreadDistance: -2, color: "rgba(0, 0, 0, 0.1)" },
];
const FLAT: BoxShadowValue[] = [];

function ServicePill({
  service,
  active,
  onSelect,
}: {
  service: ServiceType;
  active: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);
  const { activationAnimationProgress } = useItemContext();

  // On from the first frame of the lift until the pill has settled again, so
  // its layers are built once per drag. The library's own shadow is centred,
  // so it is turned off above. None at all at rest: iOS draws each shadow as a
  // masked layer, which costs every frame the list scrolls even when clear.
  const lift = useAnimatedStyle(() => ({
    boxShadow: activationAnimationProgress.value > 0 ? LIFTED : FLAT,
  }));

  // Held long enough to lift, then let go where it was: a drag that went
  // nowhere, not a tap. The tap gesture allows half a second and the lift
  // comes at 250ms, so both fire; a pill still lifted or settling skips it.
  const tap = () => {
    if (activationAnimationProgress.value > 0) return;
    onSelect();
  };

  return (
    <Sortable.Touchable
      onTap={tap}
      onAccessibilityTap={onSelect}
      accessible
      accessibilityRole="button"
      accessibilityLabel={service.name}
      accessibilityHint="Hold and drag to reorder"
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={[
          {
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderColor: active ? colors.hairline : theme.border,
            // The page's own colour, and the tint already mixed into it: the
            // same look as a transparent pill, but a dragged one hides the
            // pills it passes over instead of showing them through.
            backgroundColor: active
              ? blendOver(theme.groupedBackground, colors.base, 0.1)
              : theme.groupedBackground,
          },
          lift,
        ]}
      >
        <HStack className="items-center gap-1.5">
          <Box
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: colors.base }}
          />
          <Text
            className="text-[12.5px] font-semibold"
            style={{ color: active ? colors.text : theme.textMuted }}
          >
            {service.name}
          </Text>
        </HStack>
      </Animated.View>
    </Sortable.Touchable>
  );
}

/** Stand-ins for {@link ServiceFilterSkeleton}; only their widths show. */
const PLACEHOLDER_PILLS = ["All", "Sunday Service", "Midweek", "Youth"];

/** {@link ServiceFilter} while the service types load: pills of the same height. */
export function ServiceFilterSkeleton() {
  return (
    <HStack className="gap-2 px-4">
      {PLACEHOLDER_PILLS.map((label) => (
        <Bone
          key={label}
          className="rounded-full border border-transparent px-3 py-1.5"
          textClassName="text-[12.5px] font-semibold"
          label={label}
        />
      ))}
    </HStack>
  );
}

/**
 * A placeholder sized by the text it stands in for, hidden inside it, so a
 * loading row is exactly as tall as the real one at any text size.
 */
function Bone({
  className,
  textClassName,
  label,
}: {
  className: string;
  textClassName: string;
  label: string;
}) {
  return (
    <Box className={`overflow-hidden ${className}`}>
      <Skeleton startColor="bg-border" className="absolute inset-0" />
      <Text className={`opacity-0 ${textClassName}`}>{label}</Text>
    </Box>
  );
}
