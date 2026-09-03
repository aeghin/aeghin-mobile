import { useEffect, useState, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * The app's modal, matching the dashboard's dialogs rather than iOS's page
 * sheet: a dimmed page with a centred card on it, headed by a tinted glyph, a
 * title and a line of explanation, and closed by a pair of buttons.
 *
 * The card is capped at most of the viewport and scrolls inside itself, which
 * is what lets one shape carry both a two-field form and a list of every key.
 */

/** How much of the screen the card may take before its body starts scrolling. */
const MAX_HEIGHT_RATIO = 0.86;

const CARD_RADIUS = 26;
const ICON_CIRCLE = 52;
const BUTTON_HEIGHT = 46;

export type DialogTone = "default" | "destructive";

type DialogAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type DialogProps = {
  visible: boolean;
  title: string;
  /** The line under the title. The web's `DialogDescription`. */
  description?: string;
  /** The glyph in the tinted circle above the title. */
  icon?: AppIconName;
  /** `destructive` turns the circle, the title and the confirm button red. */
  tone?: DialogTone;
  /** The confirming button. Omit it for a dialog that only shows or toggles. */
  action?: DialogAction;
  submitting?: boolean;
  /** What the dismissing button says when there is an action beside it. */
  cancelLabel?: string;
  onClose: () => void;
  children?: ReactNode;
};

export function Dialog({
  visible,
  title,
  description,
  icon,
  tone = "default",
  action,
  submitting = false,
  cancelLabel = "Cancel",
  onClose,
  children,
}: DialogProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // The web's `zoom-in-95`. Held as lazy state rather than a ref, because
  // reading `.current` during render is an error under this project's lint.
  const [scale] = useState(() => new Animated.Value(0.94));

  // Driven from the prop rather than from mounting: the children stay mounted
  // so the modal's own fade-out has something to fade, and re-running the
  // scale on each open is what keeps the entrance from playing only once.
  useEffect(() => {
    if (!visible) return;

    scale.setValue(0.94);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 20,
      stiffness: 260,
      mass: 0.85,
    }).start();
  }, [visible, scale]);

  const accent = tone === "destructive" ? theme.destructive : brand.orange;
  const dismiss = submitting ? undefined : onClose;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* The scrim. Its own layer under the card so a tap anywhere off the
          card dismisses, while taps on the card do not reach it. */}
      <RNPressable
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, ${theme.scheme === "dark" ? 0.62 : 0.5})`,
        }}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />

      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          accessibilityViewIsModal
          style={{
            maxHeight: height * MAX_HEIGHT_RATIO - insets.top - insets.bottom,
            borderRadius: CARD_RADIUS,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            overflow: "hidden",
            boxShadow: "0px 24px 48px rgba(0, 0, 0, 0.28)",
            opacity: scale.interpolate({
              inputRange: [0.94, 1],
              outputRange: [0, 1],
            }),
            transform: [{ scale }],
          }}
        >
          <VStack className="items-center gap-1.5 px-6 pb-1 pt-6">
            {icon ? (
              <Center
                className="mb-1.5"
                style={{
                  width: ICON_CIRCLE,
                  height: ICON_CIRCLE,
                  borderRadius: ICON_CIRCLE / 2,
                  backgroundColor: withAlpha(accent, 0.12),
                }}
              >
                <AppIcon icon={icon} size={24} color={accent} />
              </Center>
            ) : null}

            <Text
              className="text-center text-[19px] font-bold tracking-[-0.3px]"
              style={{ color: tone === "destructive" ? theme.destructive : theme.text }}
            >
              {title}
            </Text>

            {description ? (
              <Text className="max-w-[300px] text-center text-[13.5px] leading-[19px] text-muted-foreground">
                {description}
              </Text>
            ) : null}
          </VStack>

          {children ? (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <VStack className="gap-4">{children}</VStack>
            </ScrollView>
          ) : null}

          <HStack
            className="gap-2.5 px-5 pt-4"
            style={{
              paddingBottom: 20,
              // The body scrolls under this, so a dialog that has one gets a
              // hairline: without it a long list is clipped mid-row and reads
              // as a rendering fault rather than as more to scroll.
              borderTopWidth: children ? 1 : 0,
              borderTopColor: theme.border,
            }}
          >
            {action ? (
              <>
                <DialogButton
                  label={cancelLabel}
                  onPress={onClose}
                  disabled={submitting}
                  variant="outline"
                />
                <DialogButton
                  label={action.label}
                  onPress={action.onPress}
                  disabled={submitting || action.disabled}
                  busy={submitting}
                  accent={accent}
                />
              </>
            ) : (
              <DialogButton label="Done" onPress={onClose} accent={accent} />
            )}
          </HStack>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type DialogButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "solid" | "outline";
  accent?: string;
};

function DialogButton({
  label,
  onPress,
  disabled,
  busy,
  variant = "solid",
  accent = brand.orange,
}: DialogButtonProps) {
  const theme = useTheme();
  const outline = variant === "outline";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className="flex-1 items-center justify-center rounded-2xl data-[active=true]:opacity-70"
      style={{
        height: BUTTON_HEIGHT,
        backgroundColor: outline ? theme.surface : accent,
        borderWidth: outline ? 1 : 0,
        borderColor: theme.border,
        opacity: disabled && !busy ? 0.45 : 1,
      }}
    >
      {busy ? (
        <Spinner size="small" color={outline ? theme.textMuted : "#FFFFFF"} />
      ) : (
        <Text
          className="text-[15px] font-semibold"
          style={{ color: outline ? theme.text : "#FFFFFF" }}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
