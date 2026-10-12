import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

const LENGTH = 6;

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  /** Called once the sixth digit lands, so a pasted or autofilled code submits itself. */
  onComplete: (code: string) => void;
  error?: boolean;
  /** Bump it after every rejected code to shake the boxes, even for the same error twice. */
  shake: number;
};

/**
 * Six boxes over one invisible field. The field is what the keyboard, paste
 * and iOS's one-time-code autofill from Messages and Mail all talk to; the
 * boxes only draw what it holds.
 */
export function CodeInput({ value, onChange, onComplete, error, shake }: CodeInputProps) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const offset = useSharedValue(0);
  const caret = useSharedValue(1);

  useEffect(() => {
    if (shake === 0) return;
    offset.set(
      withSequence(
        withTiming(-9, { duration: 45 }),
        withTiming(9, { duration: 70 }),
        withTiming(-6, { duration: 70 }),
        withTiming(6, { duration: 70 }),
        withTiming(0, { duration: 45 }),
      ),
    );
  }, [shake, offset]);

  useEffect(() => {
    caret.set(
      withRepeat(
        withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })),
        -1,
      ),
    );
  }, [caret]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.value }));

  const active = focused ? Math.min(value.length, LENGTH - 1) : -1;

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <Animated.View style={[styles.row, rowStyle]}>
        {Array.from({ length: LENGTH }, (_, index) => {
          const digit = value[index];
          const isActive = index === active;
          const borderColor = error
            ? theme.destructive
            : isActive
              ? brand.orange
              : digit
                ? withAlpha(theme.text, 0.25)
                : theme.border;

          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor,
                  borderWidth: isActive || error ? 1.5 : 1,
                  backgroundColor: isActive ? theme.card : theme.surface,
                  boxShadow: isActive
                    ? `0px 0px 0px 4px ${withAlpha(brand.orange, 0.16)}`
                    : undefined,
                },
              ]}
            >
              {digit ? (
                <Text
                  className="text-[24px] font-semibold text-foreground"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {digit}
                </Text>
              ) : isActive ? (
                <Animated.View style={[styles.caret, caretStyle]} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>

      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => {
          const code = text.replace(/\D/g, "").slice(0, LENGTH);
          onChange(code);
          if (code.length === LENGTH) onComplete(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        maxLength={LENGTH}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        caretHidden
        accessibilityLabel="Verification code"
        // Nearly, not fully, transparent: iOS withholds autofill from a field
        // it considers hidden.
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  caret: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: brand.orange,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: "transparent",
    fontSize: 1,
  },
});
