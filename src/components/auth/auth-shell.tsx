import ChevronLeft from "lucide-react-native/icons/chevron-left";
import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  LayoutAnimationConfig,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { useSplashRevealed } from "@/components/brand-splash";
import { KeyboardSpacer } from "@/components/keyboard-spacer";
import { Logo } from "@/components/logo";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { tintedGlow } from "@/lib/gradients";

const ENTRANCE = FadeInDown.duration(480).easing(Easing.out(Easing.cubic));
const FOOTER_ENTRANCE = FadeIn.duration(480).delay(160);
const FORWARD = FadeInRight.duration(280).easing(Easing.out(Easing.cubic));
const BACKWARD = FadeInLeft.duration(280).easing(Easing.out(Easing.cubic));

type AuthShellProps = {
  /** Changes with each step of a flow, which slides the new step in. */
  stepKey: string;
  /** Which way that slide goes: forward from the right, back from the left. */
  direction?: 1 | -1;
  onBack?: () => void;
  /** Sign-up's three steps, as a segmented bar beside the back button. */
  progress?: { step: number; total: number };
  children: ReactNode;
  /** Pinned to the bottom of the screen: the way across to the other screen. */
  footer?: ReactNode;
};

/**
 * The page both auth screens sit on: the app's background under a soft
 * brand glow — the web hero's blurred orange, as a radial gradient — with the
 * content scrolling above the keyboard on both platforms.
 *
 * Nothing renders until the splash starts lifting, so on a cold start the
 * entrance plays as the orange clears rather than behind it.
 */
export function AuthShell({
  stepKey,
  direction = 1,
  onBack,
  progress,
  children,
  footer,
}: AuthShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const revealed = useSplashRevealed();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BrandGlow />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {revealed ? (
          <>
            <Animated.View entering={ENTRANCE}>
              <TopBar onBack={onBack} progress={progress} />

              <LayoutAnimationConfig skipEntering>
                <Animated.View key={stepKey} entering={direction === 1 ? FORWARD : BACKWARD}>
                  {children}
                </Animated.View>
              </LayoutAnimationConfig>
            </Animated.View>

            {footer ? (
              <Animated.View entering={FOOTER_ENTRANCE} style={styles.footer}>
                {footer}
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <KeyboardSpacer />
    </View>
  );
}

function BrandGlow() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const size = width * 1.35;
  const dark = theme.scheme === "dark";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          {
            position: "absolute",
            width: size,
            height: size,
            top: -size * 0.58,
            left: (width - size) / 2,
          },
          tintedGlow(brand.orange, "lead", dark ? 0.2 : 0.16),
        ]}
      />
      <View
        style={[
          {
            position: "absolute",
            width: size * 0.9,
            height: size * 0.9,
            bottom: -size * 0.5,
            right: -size * 0.45,
          },
          tintedGlow(brand.orange, "trail", dark ? 0.1 : 0.07),
        ]}
      />
    </View>
  );
}

const BACK_SIZE = 40;

function TopBar({ onBack, progress }: Pick<AuthShellProps, "onBack" | "progress">) {
  const theme = useTheme();

  // Holds the bar's height, so the logo sits where it does on sign-up.
  if (!onBack && !progress) return <View style={{ height: BACK_SIZE }} />;

  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="bg-card data-[active=true]:bg-surface"
          style={[styles.back, { borderColor: theme.border }]}
        >
          <AppIcon icon={ChevronLeft} size={20} color={theme.text} />
        </Pressable>
      ) : null}

      {progress ? (
        <View
          style={styles.progress}
          accessible
          accessibilityLabel={`Step ${progress.step} of ${progress.total}`}
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <View
              key={index}
              style={[
                styles.segment,
                { backgroundColor: index < progress.step ? brand.orange : theme.border },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type AuthHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  /** A glyph in a tinted tile instead of the app's own tile. */
  icon?: AppIconName;
};

/** The logo — or a step's glyph — over a large title and a line under it. */
export function AuthHeader({ title, subtitle, icon }: AuthHeaderProps) {
  const theme = useTheme();

  return (
    <View style={{ marginTop: 28, marginBottom: 28 }}>
      {icon ? (
        <View
          style={[
            styles.iconTile,
            { backgroundColor: withAlpha(brand.orange, theme.scheme === "dark" ? 0.18 : 0.12) },
          ]}
        >
          <AppIcon icon={icon} size={26} color={brand.orange} />
        </View>
      ) : (
        <Logo size={56} variant="tile" />
      )}

      <Text
        className="mt-[22px] text-[30px] font-bold text-foreground"
        style={{ letterSpacing: -0.6, lineHeight: 36 }}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {subtitle ? (
        <Text className="mt-[8px] text-[15.5px] leading-[22px] text-muted-foreground">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: BACK_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingTop: 28,
  },
});
