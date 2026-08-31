import { useEffect, useRef, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

const TRACK_PADDING = 3;
const TRACK_HEIGHT = 38;

export type Segment<T extends string> = {
  value: T;
  label: string;
  count?: number;
  /** A colour for a small dot before the label, for a segment wanting attention. */
  dot?: string;
};

type SegmentedControlProps<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * The iOS segmented control, hand-rolled.
 *
 * `Animated` from React Native core rather than Reanimated: a sliding thumb is
 * one native-driven `translateX`, and core `Animated` needs no Babel plugin to
 * deliver it — nothing in this app has depended on the worklets transform yet.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    segments.findIndex((segment) => segment.value === value),
    0,
  );

  const segmentWidth =
    trackWidth > 0
      ? (trackWidth - TRACK_PADDING * 2) / segments.length
      : 0;

  // Lazy state, not a ref: the value has to be read during render to build
  // the thumb's style, and the compiler's lint forbids reading `.current` there.
  const [translateX] = useState(() => new Animated.Value(0));
  // The first real width arrives after layout. Snapping to it rather than
  // springing keeps the thumb from sliding in from the left on mount.
  const settled = useRef(false);

  useEffect(() => {
    const target = index * segmentWidth;

    if (!settled.current) {
      settled.current = segmentWidth > 0;
      translateX.setValue(target);
      return;
    }

    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      stiffness: 320,
      damping: 30,
      mass: 0.8,
    }).start();
  }, [index, segmentWidth, translateX]);

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  return (
    <Box
      className="overflow-hidden rounded-xl bg-surface"
      style={{ padding: TRACK_PADDING }}
      onLayout={handleLayout}
      accessibilityRole="tablist"
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: TRACK_PADDING,
            left: TRACK_PADDING,
            width: segmentWidth,
            height: TRACK_HEIGHT,
            borderRadius: 9,
            backgroundColor: theme.card,
            // A lifted thumb is what separates the control from a row of chips.
            boxShadow: `0px 2px 6px ${withAlpha("#000000", theme.scheme === "dark" ? 0.4 : 0.12)}`,
            transform: [{ translateX }],
          }}
        />
      ) : null}

      <HStack>
        {segments.map((segment) => {
          const active = segment.value === value;

          return (
            <Pressable
              key={segment.value}
              onPress={() => onChange(segment.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={
                segment.count === undefined
                  ? segment.label
                  : `${segment.label}, ${segment.count}`
              }
              className="flex-1"
              style={{ height: TRACK_HEIGHT }}
            >
              <HStack className="h-full items-center justify-center gap-1.5">
                {segment.dot ? (
                  <Box
                    className="h-[6px] w-[6px] rounded-full"
                    style={{ backgroundColor: segment.dot }}
                  />
                ) : null}

                <Text
                  className={`text-[13px] font-semibold ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                  numberOfLines={1}
                >
                  {segment.label}
                </Text>

                {segment.count === undefined ? null : (
                  <Text
                    className={`text-[12px] font-semibold ${
                      active ? "text-muted-foreground" : "text-muted-foreground/70"
                    }`}
                  >
                    {segment.count}
                  </Text>
                )}
              </HStack>
            </Pressable>
          );
        })}
      </HStack>
    </Box>
  );
}
