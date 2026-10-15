import * as SecureStore from "expo-secure-store";

export type ColorSchemeChoice = "light" | "dark";

const KEY = "colorScheme";

/**
 * Light or dark as picked in the sidebar, or null to follow the phone — which
 * is where everyone starts, as on the web until its switch is first used.
 * Best effort both ways: a failed read or write just follows the phone.
 */
export function readColorScheme(): ColorSchemeChoice | null {
  try {
    const value = SecureStore.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export async function rememberColorScheme(value: ColorSchemeChoice): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, value);
  } catch {
    // Next launch follows the phone again.
  }
}
