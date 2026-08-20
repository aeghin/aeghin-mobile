import { ClerkProvider } from "@clerk/expo";
import { useAuthViewState } from "@clerk/expo/native";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

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
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style="auto" />
      <RootNavigator />
    </ClerkProvider>
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
        <Stack.Screen name="index" />
      </Stack.Protected>

      <Stack.Protected guard={!isAuthFlowComplete}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
