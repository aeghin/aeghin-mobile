import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type Theme,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { BrandSplash } from "@/components/brand-splash";
import { OrganizationProvider } from "@/components/organization-provider";
import { PushNotifications } from "@/components/push-notifications";
import { QueryProvider } from "@/components/query-provider";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { brand, palette, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

import "../globals.css";
import "../polyfills";

/**
 * Reanimated 4 turns strict mode on by default, and NativeWind trips it.
 *
 * `react-native-css-interop` — the engine behind NativeWind's `className` —
 * writes shared values inside its render path (`native-interop.js`, in both
 * the CSS-animation and the transition branch), which is exactly what strict
 * mode warns about. Every `animate-pulse` skeleton in the app fires it, so a
 * loading list logs the warning on every render.
 *
 * The app's own Reanimated code writes shared values only from effects and
 * callbacks, so there is no app-side misuse to find and nothing lost by turning
 * the advisories off. Real Reanimated warnings and errors still log — `strict`
 * only governs the strict-mode ones.
 *
 * Revisit when NativeWind updates: this belongs to css-interop 0.2.6, and the
 * fix is theirs to make.
 */
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

SplashScreen.preventAutoHideAsync();
// `BrandSplash` draws the same frame and hides this one beneath it, so a fade
// would only dim its animation.
SplashScreen.setOptions({ fade: false });

/**
 * The nav bar is drawn natively and takes its colours from React Navigation's
 * theme, not from NativeWind — and expo-router defaults that theme to
 * `DefaultTheme`, which is light in both schemes. Without this the bar stays
 * white while the rest of the app follows the system.
 *
 * `card` is the bar itself, `background` what shows behind a screen mid-push,
 * and `primary` the iOS header tint — every back chevron.
 */
function withPalette(base: Theme, colors: Palette): Theme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: brand.orange,
      card: colors.card,
      background: colors.groupedBackground,
      text: colors.text,
      border: colors.border,
    },
  };
}

const navigationTheme: Record<Palette["scheme"], Theme> = {
  light: withPalette(DefaultTheme, palette.light),
  dark: withPalette(DarkTheme, palette.dark),
};

function requirePublishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to .env.local — copy " +
        "it from the Clerk Dashboard under API keys, then restart the dev server.",
    );
  }
  return key;
}

const publishableKey = requirePublishableKey();

export default function RootLayout() {
  return (
    // The drag on the Events service pills is a gesture-handler gesture, and
    // those only run under this root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GluestackUIProvider mode="system">
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <QueryProvider>
            {/* Inside QueryProvider and ClerkProvider: it reads the membership
                list to resolve the remembered id, and needs a session to do it. */}
            <OrganizationProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </OrganizationProvider>
          </QueryProvider>
        </ClerkProvider>
      </GluestackUIProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { isLoaded, isSignedIn = false } = useAuth();

  return (
    <>
      {isLoaded ? <Navigator isSignedIn={isSignedIn} /> : null}
      {/* Over everything, from the first frame: it is what replaces the native
          splash, and it waits for Clerk before uncovering the app. */}
      <BrandSplash ready={isLoaded} />
    </>
  );
}

function Navigator({ isSignedIn }: { isSignedIn: boolean }) {
  const { scheme } = useTheme();

  return (
    <ThemeProvider value={navigationTheme[scheme]}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          {/* Its own in-screen header, because with no organization chosen there
              are no tabs and this is the whole app — including the only way to
              sign out. See `organizations/index.tsx`. */}
          <Stack.Screen name="organizations/index" />
          {/* Its own header too: an invitation link can land here before the
              person belongs to any organization, so there are no tabs behind it. */}
          <Stack.Screen name="invite/[token]" />
        </Stack.Protected>

        {/* Sign-in first: the first declared screen is where a signed-out
            launch lands. */}
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
        </Stack.Protected>
      </Stack>

      <PushNotifications ready={isSignedIn} />
    </ThemeProvider>
  );
}
