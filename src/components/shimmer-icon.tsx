import { useEffect, useId } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Defs, LinearGradient, Stop } from "react-native-svg";

import { AppIcon, STROKE, type AppIconName } from "@/components/app-icon";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/** The web's `shimmer-icon`: a sweep in the first 40% of each period, then a rest. */
const PERIOD = 2500;
const SWEEP = 0.4;
/** Half the band, in lucide's 24-unit grid: the web's 6px on a 16px icon. */
const SPREAD = 9;
/** Which way the band travels: CSS's 110deg, the web shimmer's tilt. */
const DIR_X = Math.sin((110 * Math.PI) / 180);
const DIR_Y = -Math.cos((110 * Math.PI) / 180);
/** How far the 24-unit grid reaches along that direction. */
const REACH = 24 * (DIR_X + DIR_Y);

type ShimmerIconProps = {
  icon: AppIconName;
  size?: number;
  color: string;
};

/**
 * An AppIcon with the web's Trace shimmer: a band that fades the glyph as it
 * sweeps across, then rests. Drawn as the stroke's gradient, since React
 * Native has no masks without a native module. Still under Reduce Motion.
 */
export function ShimmerIcon({ icon: Icon, size = 20, color }: ShimmerIconProps) {
  const reduceMotion = useReducedMotion();
  const id = `shine${useId()}`;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withRepeat(withTiming(1, { duration: PERIOD, easing: Easing.linear }), -1));
    return () => cancelAnimation(progress);
  }, [reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => {
    // The band's centre, from clear of the grid on one side to clear of it on the other.
    const at = -SPREAD + (REACH + 2 * SPREAD) * Math.min(progress.get() / SWEEP, 1);
    return {
      x1: (at - SPREAD) * DIR_X,
      y1: (at - SPREAD) * DIR_Y,
      x2: (at + SPREAD) * DIR_X,
      y2: (at + SPREAD) * DIR_Y,
    };
  });

  if (reduceMotion) return <AppIcon icon={Icon} size={size} color={color} />;

  return (
    <Icon size={size} color={`url(#${id})`} strokeWidth={STROKE}>
      <Defs key="shine">
        <AnimatedLinearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          animatedProps={animatedProps}
        >
          <Stop offset={0} stopColor={color} />
          <Stop offset={0.25} stopColor={color} stopOpacity={0.6} />
          <Stop offset={0.5} stopColor={color} stopOpacity={0.2} />
          <Stop offset={0.75} stopColor={color} stopOpacity={0.6} />
          <Stop offset={1} stopColor={color} />
        </AnimatedLinearGradient>
      </Defs>
    </Icon>
  );
}
