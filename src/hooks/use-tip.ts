import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useState, useSyncExternalStore } from "react";

/** The one-time hints, each named for what it teaches. */
export type TipName =
  | "getStarted"
  | "pendingInvite"
  | "menu"
  | "orderServices"
  | "swipeRemoveRole"
  | "saveKey";

/**
 * Which goes first when two are due on one screen. The next waits for the
 * first one's "Got it", so a screen never carries more than one.
 */
const ORDER: TipName[] = [
  "getStarted",
  "pendingInvite",
  "menu",
  "orderServices",
  "swipeRemoveRole",
  "saveKey",
];

/**
 * Raise it to show every hint again, to everyone: each "Got it" is saved under
 * the round it was given in, and an earlier round's are never read. The web
 * counts its own.
 */
const ROUND = 2;

const keyFor = (tip: TipName, userId: string) => `tip.${ROUND}.${tip}.${userId}`;

/** The due hints on the screen in view, whichever's turn it is. */
const onScreen = new Set<TipName>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed() {
  for (const listener of listeners) listener();
}

const firstOnScreen = () => ORDER.find((tip) => onScreen.has(tip));

/**
 * A hint shown until its "Got it" is tapped, then never again for this account
 * on this device. Best effort, like the colour scheme: a failed read or write
 * only means the hint comes back.
 *
 * `when` says whether the screen has the thing the hint points at. Even then it
 * waits its turn behind any hint before it in `ORDER`.
 */
export function useTip(tip: TipName, when = true) {
  const { userId } = useAuth();

  const [seen, setSeen] = useState(() => {
    if (!userId) return false;
    try {
      return SecureStore.getItem(keyFor(tip, userId)) === "1";
    } catch {
      return false;
    }
  });

  const due = when && !seen && Boolean(userId);

  // Counted only while its screen is the one in view: a stack keeps the
  // screens under it mounted, and a hint waiting on one of those would hold up
  // the one in front of you.
  useFocusEffect(
    useCallback(() => {
      if (!due) return;
      onScreen.add(tip);
      changed();
      return () => {
        onScreen.delete(tip);
        changed();
      };
    }, [due, tip]),
  );

  const turn = useSyncExternalStore(subscribe, firstOnScreen);

  const dismiss = () => {
    setSeen(true);
    if (userId) SecureStore.setItemAsync(keyFor(tip, userId), "1").catch(() => {});
  };

  return { show: due && turn === tip, dismiss };
}
