import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";

import { AuthButton, TextLink } from "@/components/auth/auth-controls";
import { AuthHeader } from "@/components/auth/auth-shell";
import { CodeInput } from "@/components/auth/code-input";
import type { AppIconName } from "@/components/app-icon";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

/** How long before another code may be asked for — about as long as one takes to arrive. */
const RESEND_COOLDOWN = 30;

type CodeStepProps = {
  icon: AppIconName;
  title: string;
  /** Where the code went, set in bold inside the default line. */
  destination?: string;
  /** Replaces the default line — an authenticator code was not sent anywhere. */
  description?: string;
  error?: string;
  busy: boolean;
  /** Resolves `true` once Clerk accepts the code; `false` shakes and clears the boxes. */
  onVerify: (code: string) => Promise<boolean>;
  /** Resolves `true` once a new code is on its way. Omit it when nothing can be resent. */
  onResend?: () => Promise<boolean>;
  /** Ways out beneath the resend line: "Use your password instead". */
  children?: ReactNode;
};

/** Every "type the six digits we sent you" step in both flows. */
export function CodeStep({
  icon,
  title,
  destination,
  description,
  error,
  busy,
  onVerify,
  onResend,
  children,
}: CodeStepProps) {
  const theme = useTheme();
  const [code, setCode] = useState("");
  const [rejected, setRejected] = useState(0);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (busy || value.length < 6) return;
    if (!(await onVerify(value))) {
      setRejected((count) => count + 1);
      setCode("");
    }
  };

  const resend = async () => {
    if (!onResend) return;
    if (await onResend()) {
      setCooldown(RESEND_COOLDOWN);
      setCode("");
    }
  };

  return (
    <View>
      <AuthHeader
        icon={icon}
        title={title}
        subtitle={
          description ?? (
            <>
              Enter the 6-digit code we sent to{" "}
              <Text className="font-semibold text-foreground">{destination}</Text>.
            </>
          )
        }
      />

      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={verify}
        error={Boolean(error) && code.length === 0}
        // Never disabled while a code is checked: an iOS field that stops
        // being editable drops the keyboard, and a wrong code wants a retype.
        shake={rejected}
      />

      {error && code.length === 0 ? (
        <Text className="ml-0.5 mt-2.5 text-[13px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <AuthButton
          label="Verify"
          onPress={() => verify(code)}
          busy={busy}
          disabled={code.length < 6}
        />
      </View>

      {onResend ? (
        <HStack className="mt-5 items-center justify-center gap-1.5">
          <Text className="text-[14.5px] text-muted-foreground">Didn&apos;t get it?</Text>
          {cooldown > 0 ? (
            <Text
              className="text-[14.5px] font-semibold text-muted-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              Resend in 0:{String(cooldown).padStart(2, "0")}
            </Text>
          ) : (
            <TextLink label="Resend code" onPress={resend} disabled={busy} />
          )}
        </HStack>
      ) : null}

      {children ? <VStack className="mt-4 items-center gap-4">{children}</VStack> : null}
    </View>
  );
}
