import * as SecureStore from "expo-secure-store";
import { useState } from "react";

/** The one-time hints, each named for what it teaches. */
export type TipName = "swipeRemoveRole";

const keyFor = (tip: TipName, userId: string) => `tip.${tip}.${userId}`;

/**
 * A hint shown until its "Got it" is tapped, then never again for this account
 * on this device. Best effort, like the colour scheme: a failed read or write
 * only means the hint comes back.
 */
export function useTip(tip: TipName, userId: string) {
  const [seen, setSeen] = useState(() => {
    try {
      return SecureStore.getItem(keyFor(tip, userId)) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setSeen(true);
    SecureStore.setItemAsync(keyFor(tip, userId), "1").catch(() => {});
  };

  return { seen, dismiss };
}
