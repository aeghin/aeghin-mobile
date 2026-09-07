import type { ReactNode } from "react";
import { TextInput } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { InsetCard } from "@/components/inset-list";
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

/**
 * The grouped half of the set: a card per section, headed by a tinted glyph
 * and a title, with a glyph on every row inside it.
 *
 * This is the event screen's card language rather than Settings' — the form
 * builds an event, so it reads like the page that event becomes. The dialogs
 * keep to {@link Field} above: a dialog is already a card, and a card inside
 * it has nothing to sit on.
 */

/** Lines a row's label up with an `InsetRow`'s. */
const ROW_PADDING = 14;

/** The glyph column, so every label in a card starts at the same x. */
const ICON_COLUMN = 18;

/** `ROW_PADDING` + the column + its gap: where the text starts, and the hairlines. */
const TEXT_INSET = 42;

function RowIcon({ icon, tint }: { icon?: AppIconName; tint?: string }) {
  const theme = useTheme();

  if (!icon) return null;

  return (
    <Box style={{ width: ICON_COLUMN, alignItems: "center" }}>
      <AppIcon icon={icon} size={17} color={tint ?? theme.textMuted} />
    </Box>
  );
}

type FormGroupProps = {
  /** The card's title, in its own header row. */
  label: string;
  /** The glyph beside the title. */
  icon: AppIconName;
  /**
   * The header glyph's colour. Pass the chosen service type's and the form
   * takes on the hue of the event being made, the way its detail screen does.
   */
  tint?: string;
  /** What the group answers at a glance — a count, a span. */
  trailing?: ReactNode;
  /** The line under the card, for what the group wants or what it did. */
  footnote?: string;
  /** Replaces the footnote and turns it red. */
  error?: string;
  children: ReactNode;
};

/** A titled card of form rows. */
export function FormGroup({
  label,
  icon,
  tint,
  trailing,
  footnote,
  error,
  children,
}: FormGroupProps) {
  const theme = useTheme();

  return (
    <VStack>
      <InsetCard elevated separatorInset={TEXT_INSET}>
        <HStack
          className="items-center gap-2.5"
          style={{ paddingHorizontal: ROW_PADDING, paddingVertical: 11 }}
        >
          <RowIcon icon={icon} tint={tint ?? brand.orange} />

          <Text className="flex-1 text-[15px] font-semibold tracking-[-0.2px] text-foreground">
            {label}
          </Text>

          {trailing}
        </HStack>

        {children}
      </InsetCard>

      {error ? (
        <Text className="ml-1 mt-1.5 text-[12px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : footnote ? (
        <Text className="ml-1 mt-1.5 text-[12px] text-muted-foreground">{footnote}</Text>
      ) : null}
    </VStack>
  );
}

/** The muted count a group header answers with. */
export function FormCount({ children }: { children: string }) {
  return (
    <Text
      className="text-[13px] text-muted-foreground"
      style={{ fontVariant: ["tabular-nums"] }}
    >
      {children}
    </Text>
  );
}

type FormRowProps = {
  label: string;
  icon?: AppIconName;
} & React.ComponentProps<typeof TextInput>;

/**
 * A row whose answer is short enough to sit beside its label.
 *
 * The input is the row: it carries the vertical padding rather than the stack
 * around it, so the whole right-hand side is the tap target and the caret does
 * not depend on hitting a 15px line of text.
 */
export function FormRow({ label, icon, ...input }: FormRowProps) {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-2.5" style={{ paddingHorizontal: ROW_PADDING }}>
      <RowIcon icon={icon} />

      <Text className="text-[15px] text-foreground">{label}</Text>

      <TextInput
        autoCorrect={false}
        {...input}
        placeholderTextColor={theme.textMuted}
        style={[
          {
            flex: 1,
            paddingVertical: 14,
            textAlign: "right",
            fontSize: 15,
            color: theme.text,
          },
          input.style,
        ]}
      />
    </HStack>
  );
}

type FormBlockProps = {
  /** Omit it for content that names itself — a calendar, a row of chips. */
  label?: string;
  icon?: AppIconName;
  /** Sits opposite the label. "Optional", a count, a summary. */
  trailing?: ReactNode;
  children: ReactNode;
};

/** A row whose answer needs the full width under its label. */
export function FormBlock({ label, icon, trailing, children }: FormBlockProps) {
  return (
    <VStack
      className="gap-2"
      style={{ paddingHorizontal: ROW_PADDING, paddingVertical: 12 }}
    >
      {label ? (
        <HStack className="items-center gap-2.5">
          <RowIcon icon={icon} />
          <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
          {trailing}
        </HStack>
      ) : null}

      {/* Indented to the label rather than to the card, so the answer reads as
          belonging to the question above it. A block with no glyph — a bare
          calendar — keeps the full width it needs. */}
      <VStack style={icon ? { paddingLeft: TEXT_INSET - ROW_PADDING } : undefined}>
        {children}
      </VStack>
    </VStack>
  );
}

/** {@link FormInput}'s paragraph, stripped of the chrome the card supplies. */
export function FormTextArea(props: React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();

  return (
    <TextInput
      autoCorrect={false}
      multiline
      {...props}
      placeholderTextColor={theme.textMuted}
      style={[
        {
          // Only a floor: a multiline input with no fixed height grows with
          // its content, so a one-line description does not reserve four.
          minHeight: 44,
          textAlignVertical: "top",
          fontSize: 15,
          lineHeight: 21,
          color: theme.text,
        },
        props.style,
      ]}
    />
  );
}
