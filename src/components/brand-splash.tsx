import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Polyline } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

import { brand } from "@/constants/branding";

/**
 * Where the native splash draws the mark: `splash-icon.png` at `imageWidth`
 * 200 puts the chevrons at 115 × 124pt in the centre of the window, on iOS's
 * storyboard and Android's 288dp drawable alike. Drawn the same size in the
 * same place, the hand-off from native to JS is invisible.
 */
const MARK_WIDTH = 115;
const MARK_HEIGHT = MARK_WIDTH * (85.22 / 79.211);

/** The brand kit's master, cropped to the strokes: three polylines, stroke 13, miter joins. */
const VIEW_BOX = "10.394 12.188 79.211 85.22";
const CHEVRONS = ["14,92 50,68 86,92", "23,62 50,44 77,62", "32,32 50,20 68,32"];

/** How long Clerk may take before the mark starts pulsing, so a slow start doesn't look frozen. */
const PULSE_AFTER = 900;
const PULSE_PERIOD = 1200;

const RISE = 450;
const RISE_HEIGHT = 9;
const REVEAL_AT = 360;

let revealed = false;
const listeners = new Set<() => void>();

function markRevealed() {
  if (revealed) return;
  revealed = true;
  listeners.forEach((listener) => listener());
}

/**
 * Whether the splash has started uncovering the app. A screen that animates
 * in waits for it, so its entrance isn't spent behind the orange.
 */
export function useSplashRevealed(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => revealed,
  );
}

/** A hump from 0 to 1 and back across `[start, start + width]` of `t`. */
function bump(t: number, start: number, width: number): number {
  "worklet";
  const x = (t - start) / width;
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x);
}

type ChevronProps = {
  points: string;
  /** Bottom 0, top 2: where this chevron falls in a wave climbing the mark. */
  index: number;
  rise: SharedValue<number>;
  pulse: SharedValue<number>;
};

function Chevron({ points, index, rise, pulse }: ChevronProps) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - 0.6 * bump(pulse.value, index * 0.22, 0.56),
    transform: [{ translateY: -RISE_HEIGHT * bump(rise.value, index * 0.2, 0.6) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox={VIEW_BOX}>
        <Polyline
          points={points}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={13}
          strokeLinejoin="miter"
          strokeLinecap="butt"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The launch screen, carried on in JS so it can move: it takes over from the
 * native splash frame for frame, and once `ready` a wave climbs the three
 * chevrons — the mark's own "signal" — before it lifts away and the orange
 * fades off the app underneath.
 */
export function BrandSplash({ ready }: { ready: boolean }) {
  const reduceMotion = useReducedMotion();
  const [finished, setFinished] = useState(false);

  const pulse = useSharedValue(0);
  const rise = useSharedValue(0);
  const markLift = useSharedValue(0);
  const markOpacity = useSharedValue(1);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    if (ready || reduceMotion) return;

    const timer = setTimeout(() => {
      pulse.set(withRepeat(withTiming(1, { duration: PULSE_PERIOD, easing: Easing.linear }), -1));
    }, PULSE_AFTER);

    return () => clearTimeout(timer);
  }, [ready, reduceMotion, pulse]);

  useEffect(() => {
    if (!ready) return;

    // A pulse caught mid-climb finishes its sweep quickly rather than snapping back.
    const pulsing = pulse.get() > 0;
    cancelAnimation(pulse);
    if (pulsing) pulse.set(withTiming(1, { duration: 220 }));
    const settle = pulsing ? 220 : 0;

    const finish = (done?: boolean) => {
      "worklet";
      if (done) scheduleOnRN(setFinished, true);
    };

    if (reduceMotion) {
      markRevealed();
      markOpacity.set(withTiming(0, { duration: 250 }));
      backdrop.set(withTiming(0, { duration: 250 }, finish));
      return;
    }

    rise.set(withDelay(settle, withTiming(1, { duration: RISE, easing: Easing.linear })));

    const revealAt = settle + REVEAL_AT;
    markLift.set(
      withDelay(revealAt, withTiming(-28, { duration: 300, easing: Easing.in(Easing.cubic) })),
    );
    markOpacity.set(withDelay(revealAt, withTiming(0, { duration: 240 })));
    backdrop.set(
      withDelay(
        revealAt + 40,
        withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }, finish),
      ),
    );

    const timer = setTimeout(markRevealed, revealAt);
    return () => clearTimeout(timer);
  }, [ready, reduceMotion, pulse, rise, markLift, markOpacity, backdrop]);

  // Fast Refresh re-runs this module, which resets `revealed`; a splash that
  // has already finished hands it back, or the auth screens would stay empty.
  useEffect(() => {
    if (finished) markRevealed();
  }, [finished]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ translateY: markLift.value }],
  }));

  if (finished) return null;

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      // Drawn and identical, so the native one can go without a frame of gap.
      onLayout={() => SplashScreen.hide()}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />

      <Animated.View style={[styles.mark, markStyle]}>
        {CHEVRONS.map((points, index) => (
          <Chevron key={points} points={points} index={index} rise={rise} pulse={pulse} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    backgroundColor: brand.orange,
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
});
