import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { toRgbChannels, withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** The web's `shimmer`: one sweep every 2s, end to end, no rest. */
const PERIOD = 2000;
/** Half the band: the web's `3ch + 40px` at this size. */
const SPREAD = 60;
/** Which way the band travels: CSS's 110deg, the web shimmer's tilt. */
const DIR_X = Math.sin((110 * Math.PI) / 180);
const DIR_Y = -Math.cos((110 * Math.PI) / 180);

/**
 * How much page a dark title wears at rest. Its letters are drawn brighter
 * underneath, this much veil brings them back to the muted grey, and the band
 * thins it so they light up the way the web's dark shimmer does.
 */
const VEIL = 0.4;

/**
 * The veil's opacity across the band, edge to centre to edge. Light mode
 * leaves the letters at the web's 100%, 60% and 20%; dark mode clears the
 * veil at the centre.
 */
const BAND = {
  light: [0, 0.4, 0.8, 0.4, 0],
  dark: [VEIL, VEIL / 2, 0, VEIL / 2, VEIL],
} as const;

/** The colour that shows as `shown` once `veil` covers it at `alpha`. */
function underVeil(shown: string, veil: string, alpha: number): string {
  const channels = (hex: string) =>
    toRgbChannels(hex).split(" ").map(Number) as [number, number, number];

  const [sr, sg, sb] = channels(shown);
  const [vr, vg, vb] = channels(veil);

  const lift = (s: number, v: number) =>
    Math.min(255, Math.max(0, Math.round((s - v * alpha) / (1 - alpha))))
      .toString(16)
      .padStart(2, "0");

  return `#${lift(sr, vr)}${lift(sg, vg)}${lift(sb, vb)}`.toUpperCase();
}

function Title({ title, color }: { title: string; color: string }) {
  return (
    <Text numberOfLines={1} className="shrink text-[12px] leading-[16px]" style={{ color }}>
      {title}
    </Text>
  );
}

/**
 * A running step's title, with the web's shimmer: a band sweeping across that
 * fades the letters in light mode and lights them up in dark.
 *
 * React Native can't cut a gradient to the shape of text without a native
 * module, so the band is the page's own colour laid over the title: over the
 * letters it fades them toward the page, and over the page it changes
 * nothing. That holds on `groupedBackground`, which every AI screen sits on.
 * Still under Reduce Motion, as on the web.
 */
function ShimmerTitle({ title }: { title: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const id = `shimmer${useId()}`;
  const progress = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withRepeat(withTiming(1, { duration: PERIOD, easing: Easing.linear }), -1));
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => {
    // The band's centre, from clear of the title on the left to clear of it on the right.
    const x = -SPREAD + (width.get() + 2 * SPREAD) * progress.get();
    const y = height.get() / 2;
    return {
      x1: x - SPREAD * DIR_X,
      y1: y - SPREAD * DIR_Y,
      x2: x + SPREAD * DIR_X,
      y2: y + SPREAD * DIR_Y,
    };
  });

  if (reduceMotion) return <Title title={title} color={theme.textMuted} />;

  const lit =
    theme.scheme === "dark"
      ? underVeil(theme.textMuted, theme.groupedBackground, VEIL)
      : theme.textMuted;

  return (
    <View
      style={{ flexShrink: 1 }}
      onLayout={(event) => {
        width.set(event.nativeEvent.layout.width);
        height.set(event.nativeEvent.layout.height);
      }}
    >
      <Title title={title} color={lit} />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <AnimatedLinearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            animatedProps={animatedProps}
          >
            {BAND[theme.scheme].map((opacity, index) => (
              <Stop
                key={index}
                offset={index / 4}
                stopColor={theme.groupedBackground}
                stopOpacity={opacity}
              />
            ))}
          </AnimatedLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

type Status = "running" | "error";

/** Muted, red when it stopped, foreground while held down: the web's hover. */
function lineColor(theme: Palette, status?: Status, pressed = false) {
  if (status === "error") return theme.destructive;
  return pressed ? theme.text : theme.textMuted;
}

type StepLineProps = {
  icon?: AppIconName;
  title: string;
  description?: string;
  status?: Status;
  pressed?: boolean;
};

function StepLine({ icon, title, description, status, pressed }: StepLineProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const color = lineColor(theme, status, pressed);

  return (
    <HStack className="shrink items-center gap-2">
      {icon ? <AppIcon icon={icon} size={16} color={color} /> : null}
      {status === "running" ? <ShimmerTitle title={title} /> : <Title title={title} color={color} />}
      {/* The title gives way first, so a count is never cut. Half the screen
          is the most a long event name in "serving …" can take. */}
      {description ? (
        <Text
          numberOfLines={1}
          className="text-[12px] leading-[16px]"
          style={{
            flexShrink: 0,
            maxWidth: width / 2,
            color: withAlpha(theme.textMuted, 0.7),
            fontVariant: ["tabular-nums"],
          }}
        >
          {description}
        </Text>
      ) : null}
    </HStack>
  );
}

/** Right when shut, down when open, turning as the web's does. */
function Chevron({ open, color }: { open: boolean; color: string }) {
  const turn = useSharedValue(open ? 90 : 0);

  useEffect(() => {
    turn.set(withTiming(open ? 90 : 0, { duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
  }, [open, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));

  return (
    <Animated.View style={style}>
      <AppIcon icon={ChevronRight} size={16} color={color} />
    </Animated.View>
  );
}

/** The web's accordion: the height opens from nothing over 200ms, eased out. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const height = useSharedValue(0);
  const openness = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    openness.set(withTiming(open ? 1 : 0, { duration: 200, easing: Easing.bezier(0, 0, 0.58, 1) }));
  }, [open, openness]);

  const style = useAnimatedStyle(() => ({ height: height.get() * openness.get() }));

  return (
    <Animated.View
      style={[{ overflow: "hidden" }, style]}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
    >
      {/* Laid out at full height whatever the box shows, so it can be measured. */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        onLayout={(event) => height.set(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

type AgentStepProps = {
  /** Leads the line. A role's line in the availability check has none. */
  icon?: AppIconName;
  title: string;
  /** Muted, after the title: a count. */
  description?: string;
  status?: Status;
  /** What opens under the step. Without it the step is a plain line. */
  children?: ReactNode;
  /** It opened or shut, which changes the chat's height above the reply. */
  onToggle?: () => void;
};

/**
 * One thing an assistant is doing or did, drawn as the web's Trace line: a
 * running step's title shimmers, a stopped one is red, and one with more to
 * show opens under a chevron, its contents hung off a rule. Kept at 12px so
 * a step never outsizes the reply it leads to.
 */
export function AgentStep({ icon, title, description, status, children, onToggle }: AgentStepProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (!children) {
    return <StepLine icon={icon} title={title} description={description} status={status} />;
  }

  return (
    <VStack>
      <Pressable
        onPress={() => {
          onToggle?.();
          setOpen((shown) => !shown);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="max-w-full self-start"
      >
        {({ pressed }) => (
          <HStack className="items-center gap-1">
            <StepLine
              icon={icon}
              title={title}
              description={description}
              status={status}
              pressed={pressed}
            />
            <Chevron open={open} color={lineColor(theme, status, pressed)} />
          </HStack>
        )}
      </Pressable>

      <Collapse open={open}>
        <VStack
          className="mb-1 mt-2 pl-4 pr-1"
          style={{ marginLeft: 7, borderLeftWidth: 1, borderColor: theme.border }}
        >
          {typeof children === "string" ? (
            <Text className="text-[12px] leading-[19.5px]" style={{ color: theme.textMuted }}>
              {children}
            </Text>
          ) : (
            children
          )}
        </VStack>
      </Collapse>
    </VStack>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

/** A search's results as link rows, for under its step. */
export function AgentSources({ sources }: { sources: { url: string; title: string | null }[] }) {
  const theme = useTheme();

  return (
    <VStack className="gap-2">
      {sources.map((source) => (
        <Pressable
          key={source.url}
          onPress={() => Linking.openURL(source.url).catch(() => {})}
          accessibilityRole="link"
          className="max-w-full self-start"
        >
          {({ pressed }) => {
            const color = lineColor(theme, undefined, pressed);

            return (
              <HStack className="shrink items-center gap-1">
                <Title title={source.title || hostOf(source.url)} color={color} />
                <AppIcon icon={ArrowUpRight} size={16} color={color} />
              </HStack>
            );
          }}
        </Pressable>
      ))}
    </VStack>
  );
}
