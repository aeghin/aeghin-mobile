import Eye from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import Phone from "lucide-react-native/icons/phone";
import { useState, type ReactNode, type Ref } from "react";
import { Pressable as BarePressable, TextInput, View, type TextInputProps } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatUsPhone, usPhoneDigits } from "@/lib/auth";

/**
 * The pieces the sign-in and sign-up screens are built from: Sleek's form
 * language — a soft filled field that lifts to the card colour with a brand
 * ring when focused — over the app's own palette.
 */

const FIELD_HEIGHT = 52;
const RADIUS = 14;

type AuthInputProps = TextInputProps & {
  label: string;
  icon?: AppIconName;
  /** Drawn ahead of the text, after the icon — the phone field's country code. */
  prefix?: ReactNode;
  /** Opposite the icon — the password field's eye. */
  trailing?: ReactNode;
  error?: string;
  hint?: string;
  ref?: Ref<TextInput>;
};

export function AuthInput({
  label,
  icon,
  prefix,
  trailing,
  error,
  hint,
  ref,
  onFocus,
  onBlur,
  style,
  ...input
}: AuthInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const ring = error ? theme.destructive : brand.orange;

  return (
    <VStack>
      <Text className="mb-1.5 ml-0.5 text-[13px] font-semibold text-foreground">{label}</Text>

      <HStack
        className="items-center"
        style={{
          height: FIELD_HEIGHT,
          borderRadius: RADIUS,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: error ? theme.destructive : focused ? brand.orange : theme.border,
          backgroundColor: focused ? theme.card : theme.surface,
          paddingHorizontal: 14,
          gap: 10,
          boxShadow: focused ? `0px 0px 0px 4px ${withAlpha(ring, 0.16)}` : undefined,
        }}
      >
        {icon ? (
          <AppIcon icon={icon} size={18} color={focused ? brand.orange : theme.textMuted} />
        ) : null}

        {prefix}

        <TextInput
          {...input}
          ref={ref}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={theme.textMuted}
          selectionColor={brand.orange}
          style={[
            { flex: 1, height: "100%", paddingVertical: 0, fontSize: 16, color: theme.text },
            style,
          ]}
        />

        {trailing}
      </HStack>

      {error ? (
        <Text className="ml-0.5 mt-1.5 text-[12.5px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="ml-0.5 mt-1.5 text-[12.5px] text-muted-foreground">{hint}</Text>
      ) : null}
    </VStack>
  );
}

export function PasswordInput(props: Omit<AuthInputProps, "secureTextEntry" | "trailing">) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <AuthInput
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <BarePressable
          onPress={() => setVisible((shown) => !shown)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <AppIcon icon={visible ? EyeOff : Eye} size={19} color={theme.textMuted} />
        </BarePressable>
      }
    />
  );
}

type PhoneInputProps = Omit<AuthInputProps, "value" | "onChangeText" | "prefix"> & {
  /** Up to ten digits, no formatting. */
  digits: string;
  onChangeDigits: (digits: string) => void;
};

/** A US number, the only kind the rest of the app reads. */
export function PhoneInput({ digits, onChangeDigits, ...props }: PhoneInputProps) {
  const theme = useTheme();

  return (
    <AuthInput
      icon={Phone}
      {...props}
      value={formatUsPhone(digits)}
      onChangeText={(text) => onChangeDigits(usPhoneDigits(text))}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      prefix={
        <HStack className="items-center" style={{ gap: 10 }}>
          <Text className="text-[16px] text-foreground">+1</Text>
          <View style={{ width: 1, height: 20, backgroundColor: theme.border }} />
        </HStack>
      }
    />
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  icon?: AppIconName;
  busy?: boolean;
  disabled?: boolean;
};

export function AuthButton({
  label,
  onPress,
  variant = "primary",
  icon,
  busy = false,
  disabled = false,
}: AuthButtonProps) {
  const theme = useTheme();
  const primary = variant === "primary";
  const foreground = primary ? "#FFFFFF" : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      className={
        primary
          ? "bg-brand data-[active=true]:bg-brand-pressed"
          : "bg-card data-[active=true]:bg-surface"
      }
      style={{
        height: FIELD_HEIGHT,
        borderRadius: RADIUS,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.border,
        // The base style dims anything disabled; a busy button keeps its colour.
        opacity: disabled && !busy ? 0.5 : 1,
        boxShadow:
          primary && !disabled ? `0px 8px 20px -8px ${withAlpha(brand.orange, 0.6)}` : undefined,
      }}
    >
      {busy ? (
        <Spinner size="small" color={foreground} />
      ) : (
        <>
          {icon ? <AppIcon icon={icon} size={18} color={foreground} /> : null}
          <Text className="text-[16px] font-semibold" style={{ color: foreground }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type TextLinkProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Muted rather than orange, for a secondary way out. */
  muted?: boolean;
};

export function TextLink({ label, onPress, disabled, muted }: TextLinkProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      className="data-[active=true]:opacity-60"
    >
      <Text
        className="text-[14.5px] font-semibold"
        style={{ color: muted ? theme.textMuted : brand.orange }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OrDivider() {
  const theme = useTheme();

  return (
    <HStack className="items-center gap-3">
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <Text className="text-[13px] text-muted-foreground">or</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
    </HStack>
  );
}

/** The banner for an error that belongs to no one field. */
export function AuthError({ message }: { message?: string | null }) {
  const theme = useTheme();

  if (!message) return null;

  return (
    <View
      style={{
        borderRadius: 12,
        borderCurve: "continuous",
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor: withAlpha(theme.destructive, 0.1),
      }}
      accessibilityRole="alert"
    >
      <Text className="text-[13.5px] leading-[19px]" style={{ color: theme.destructive }}>
        {message}
      </Text>
    </View>
  );
}
