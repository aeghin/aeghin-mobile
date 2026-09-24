import { useRef, type RefObject } from "react";
import type { ScrollView, TextInputSelectionChangeEvent } from "react-native";

/**
 * Keeps the line being typed in view when a message field grows inside a
 * scrolling dialog body — a `FormInput` with `grow`, in a `Dialog` given the
 * same `bodyRef`.
 *
 * While the caret sits at the end of the text, where typing happens, every
 * keystroke and every new line scrolls the body to its end, so the text never
 * slides under the dialog's buttons. With the caret anywhere else the view
 * stays put: going back to fix an earlier line doesn't jump away from it.
 *
 * Spread the result onto the field.
 */
export function useFollowTyping(bodyRef: RefObject<ScrollView | null>, text: string) {
  // A ref rather than state: it is only read in handlers, never rendered.
  const atEnd = useRef(false);

  const follow = () => {
    // A frame later, once the body has laid out the line just added.
    requestAnimationFrame(() => bodyRef.current?.scrollToEnd({ animated: true }));
  };

  return {
    onSelectionChange: (event: TextInputSelectionChangeEvent) => {
      // `>=` because the event can land before the new text does.
      atEnd.current = event.nativeEvent.selection.end >= text.length;

      if (atEnd.current) follow();
    },
    onContentSizeChange: () => {
      if (atEnd.current) follow();
    },
    onBlur: () => {
      atEnd.current = false;
    },
  };
}
