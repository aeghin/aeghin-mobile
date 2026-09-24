import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiBaseUrl, apiPost } from "@/lib/api";

// Without a handler iOS drops a notification that arrives while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * This install's Expo push token, asking for permission the first time. Null
 * when it can't be pushed to: permission was refused, or the build has no push
 * credentials to register with.
 */
export async function obtainPushToken(): Promise<string | null> {
  // Android 13 only shows the permission prompt once a channel exists.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Notifications",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();

  if (status === "undetermined") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }

  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  // Sandbox or production is read from the provisioning profile, which a
  // simulator build doesn't have — its sandbox token would register as
  // production and Apple would refuse every push to it (BadDeviceToken).
  const { data } = await Notifications.getExpoPushTokenAsync({
    projectId,
    development: Device.isDevice ? undefined : true,
  });

  return data;
}

/** Points this phone's notifications at the signed-in account. */
export function registerPushToken(token: string) {
  return apiPost<{ success: true }>("/api/mobile/v1/push-tokens", { token });
}

/**
 * Stops notifications to this phone. Runs after sign-out, when there is no
 * session left to send — the route takes the token itself as proof.
 */
export async function unregisterPushToken(token: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/mobile/v1/push-tokens`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}
