import type { ReactNode } from "react";
import { TextInput } from "react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * The parts every form in the app is built from. They live apart from
 * {@link Dialog} because a field is not a modal's to own — the setlist editor
 * and the catalog picker use these on a plain screen.
 */

export function ErrorBanner({ message }: { message: string | null }) {
  const theme = useTheme();

  if (!message) return null;

  return (
    <Box
      className="rounded-xl px-3 py-2.5"
      style={{ backgroundColor: withAlpha(theme.destructive, 0.12) }}
    >
      <Text className="text-[13px]" style={{ color: theme.destructive }}>
        {message}
      </Text>
    </Box>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const theme = useTheme();

  return (
    <VStack>
      <Text className="mb-1.5 ml-1 text-[13px] font-semibold text-foreground">
        {label}
      </Text>

      {children}

      {error ? (
        <Text className="ml-1 mt-1 text-[12px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="ml-1 mt-1 text-[12px] text-muted-foreground">{hint}</Text>
      ) : null}
    </VStack>
  );
}

type FormInputProps = React.ComponentProps<typeof TextInput>;

export function FormInput(props: FormInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      autoCorrect={false}
      {...props}
      placeholderTextColor={theme.textMuted}
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: 15,
          color: theme.text,
        },
        props.multiline ? { minHeight: 96, textAlignVertical: "top" } : null,
        props.style,
      ]}
    />
  );
}

type ChoiceProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A glyph drawn ahead of the label — the role chips use an emoji. */
  leading?: string;
  disabled?: boolean;
};

/** One tappable option in a wrapping row. */
export function Choice({ label, selected, onPress, leading, disabled }: ChoiceProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className="rounded-full border px-3 py-1.5"
      style={{
        borderColor: selected ? brand.orange : theme.border,
        backgroundColor: selected ? withAlpha(brand.orange, 0.12) : theme.card,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <HStack className="items-center gap-1.5">
        {leading ? (
          <Text style={{ fontSize: 14, lineHeight: 18 }}>{leading}</Text>
        ) : null}
        <Text
          className="text-[13px] font-medium"
          style={{ color: selected ? brand.orange : theme.text }}
        >
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
}

/** A group of related rows, bounded the way a card bounds a list. */
export function FormCard({ children }: { children: ReactNode }) {
  return (
    <VStack className="overflow-hidden rounded-2xl border border-border bg-surface">
      {children}
    </VStack>
  );
}
