import { ClerkProvider } from "@clerk/expo";
import { useAuthViewState } from "@clerk/expo/native";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { OrganizationProvider } from "@/components/organization-provider";
import { QueryProvider } from "@/components/query-provider";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import "../globals.css";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

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
  );
}

function RootNavigator() {
  const { isLoaded, isAuthFlowComplete } = useAuthViewState();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthFlowComplete}>
        <Stack.Screen name="(tabs)" />
        {/* Its own in-screen header, because with no organization chosen there
            are no tabs and this is the whole app — including the only way to
            sign out. See `organizations/index.tsx`. */}
        <Stack.Screen name="organizations/index" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthFlowComplete}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
