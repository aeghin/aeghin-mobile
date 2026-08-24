import * as SecureStore from "expo-secure-store";

/**
 * The organization each account was last viewing, so a launch can reopen it.
 *
 * Both calls are best effort: this is a convenience, never a source of truth,
 * so a storage failure degrades to "no organization remembered" rather than
 * surfacing anything to the caller. Keyed per user id so switching accounts on
 * a shared device does not restore the previous person's organization.
 */

function keyFor(userId: string): string {
  return `lastOrganization.${userId}`;
}

export function readLastOrganizationId(userId: string): string | null {
  try {
    return SecureStore.getItem(keyFor(userId));
  } catch {
    // A failed read just means no restore this launch.
    return null;
  }
}

export async function rememberLastOrganizationId(
  userId: string,
  organizationId: string,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(keyFor(userId), organizationId);
  } catch {
    // A failed write just means no restore next launch.
  }
}
