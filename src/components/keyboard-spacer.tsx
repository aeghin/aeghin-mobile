import { useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";

type KeyboardSpacerProps = {
  /**
   * Bottom padding the screen keeps below its last control, given back while
   * the keyboard is up so that control sits on the keyboard rather than that
   * far above it.
   */
  inset?: number;
};

/**
 * Space at the foot of a screen as tall as the part the keyboard covers, so
 * whatever sits above it — a scroll view, a composer — shrinks or rises clear.
 * Put it last in the screen's column.
 *
 * Android only. The app draws edge to edge, so the window no longer shrinks for
 * the keyboard and a field near the bottom was typed into blind; iOS already
 * has a `KeyboardAvoidingView` wherever it needs one. It measures its own place
 * in the window rather than leaning on the header's height, so it lands right
 * under a native header, inside a modal, and over the tab bar alike — and a
 * shrinking scroll view is what makes Android scroll the focused field back
 * into view.
 */
export function KeyboardSpacer({ inset = 0 }: KeyboardSpacerProps) {
  // Where the screen's column ends, in window coordinates. It stays put as the
  // spacer grows, since the spacer grows upwards from it.
  const [bottom, setBottom] = useState<number | null>(null);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS !== "android") return null;

  const height =
    bottom === null || keyboardTop === null ? 0 : Math.max(bottom - keyboardTop - inset, 0);

  return (
    <View
      pointerEvents="none"
      style={{ height }}
      onLayout={(event) =>
        event.currentTarget.measureInWindow((_x, y, _width, current) => setBottom(y + current))
      }
    />
  );
}
