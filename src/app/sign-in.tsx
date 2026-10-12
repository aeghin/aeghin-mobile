import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import KeyRound from "lucide-react-native/icons/key-round";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import MessageSquareText from "lucide-react-native/icons/message-square-text";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import User from "lucide-react-native/icons/user";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, View, type TextInput } from "react-native";

import {
  AuthButton,
  AuthError,
  AuthInput,
  OrDivider,
  PasswordInput,
  TextLink,
} from "@/components/auth/auth-controls";
import { AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import {
  clerkMessage,
  displayIdentifier,
  fieldMessage,
  globalMessage,
  isPhoneIdentifier,
  isUnsafePassword,
  toIdentifier,
} from "@/lib/auth";

type Channel = "email" | "phone";

type Step =
  | { name: "credentials" }
  /** A one-time code instead of the password. */
  | { name: "code"; channel: Channel; destination: string }
  /** What Clerk can ask for after the first factor: two-factor, or a new device. */
  | { name: "verify"; strategy: "email_code" | "phone_code" | "totp"; destination?: string }
  /** `breached`: sent unasked, because Clerk refused the right password as unsafe. */
  | { name: "reset"; channel: Channel; destination: string; breached?: boolean }
  | { name: "new-password"; channel: Channel };

type Action = "password" | "code" | "reset";

/**
 * Signing in, on Clerk's custom-flow API. Production takes a password or a
 * one-time code to the account's email or phone, so both start here; the later
 * steps cover a forgotten password and any second check Clerk asks for.
 * Finishing needs no navigation: the root layout's guard swaps this screen for
 * the app the moment the session is active.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();

  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [attempted, setAttempted] = useState<Action | null>(null);
  // What the last request carried. Clerk's error for a field shows only while
  // the field still holds it, so correcting the value clears the message.
  const [sent, setSent] = useState({ identifier: "", password: "" });
  const [problem, setProblem] = useState<string | null>(null);

  const passwordInput = useRef<TextInput>(null);
  const busy = action !== null || fetchStatus === "fetching";

  const go = (next: Step) => {
    setDirection(1);
    setProblem(null);
    setStep(next);
  };

  const backToStart = useCallback(() => {
    signIn.reset();
    setDirection(-1);
    setProblem(null);
    setStep({ name: "credentials" });
  }, [signIn]);

  // Android's back button steps back through the flow instead of leaving the app.
  useEffect(() => {
    if (step.name === "credentials") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      backToStart();
      return true;
    });
    return () => subscription.remove();
  }, [step.name, backToStart]);

  /** Wherever a request leaves the sign-in, its status says what comes next. */
  const advance = async () => {
    switch (signIn.status) {
      case "complete": {
        const { error } = await signIn.finalize();
        if (error) setProblem(clerkMessage(error));
        return;
      }
      case "needs_second_factor":
      case "needs_client_trust":
        return startVerification();
      case "needs_new_password":
        return go({
          name: "new-password",
          channel: step.name === "reset" ? step.channel : "email",
        });
      default:
        setProblem("Couldn't finish signing in. Try again.");
    }
  };

  const startVerification = async () => {
    const factors = signIn.supportedSecondFactors;
    const email = factors.find(
      (factor): factor is Extract<typeof factor, { strategy: "email_code" }> =>
        factor.strategy === "email_code",
    );
    const phone = factors.find(
      (factor): factor is Extract<typeof factor, { strategy: "phone_code" }> =>
        factor.strategy === "phone_code",
    );

    if (email) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (!error) go({ name: "verify", strategy: "email_code", destination: email.safeIdentifier });
    } else if (phone) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (!error) go({ name: "verify", strategy: "phone_code", destination: phone.safeIdentifier });
    } else if (factors.some((factor) => factor.strategy === "totp")) {
      go({ name: "verify", strategy: "totp" });
    } else {
      setProblem("This account needs a kind of verification the app doesn't support yet.");
    }
  };

  /** One of the first screen's three requests, with the spinner on its own button. */
  const run = async (kind: Action, request: (id: string) => Promise<void>) => {
    setAttempted(kind);
    const id = toIdentifier(identifier);
    if (!id || (kind === "password" && !password)) return;

    setSent({ identifier, password });
    setProblem(null);
    setAction(kind);
    await request(id);
    setAction(null);
  };

  const signInWithPassword = () =>
    run("password", async (id) => {
      const { error } = await signIn.password({ identifier: id, password });
      if (!error) await advance();
      // Clerk's advice for an unsafe password is to sign in another way and
      // reset afterwards, a step this screen can't show; resetting first ends
      // in an ordinary session.
      else if (isUnsafePassword(error)) await startReset(id, true);
    });

  const signInWithCode = () =>
    run("code", async (id) => {
      const phone = isPhoneIdentifier(id);
      const { error } = phone
        ? await signIn.phoneCode.sendCode({ phoneNumber: id })
        : await signIn.emailCode.sendCode({ emailAddress: id });
      if (!error) {
        go({
          name: "code",
          channel: phone ? "phone" : "email",
          destination: displayIdentifier(id),
        });
      }
    });

  // Clerk resets only through the email or number that was typed.
  const startReset = async (id: string, breached = false) => {
    const created = await signIn.create({ identifier: id });
    if (created.error) return;

    const phone = isPhoneIdentifier(id);
    const { error } = phone
      ? await signIn.resetPasswordPhoneCode.sendCode()
      : await signIn.resetPasswordEmailCode.sendCode();
    if (!error) {
      go({
        name: "reset",
        channel: phone ? "phone" : "email",
        destination: displayIdentifier(id),
        breached,
      });
    }
  };

  const resetPassword = () => run("reset", (id) => startReset(id));

  // Once a code sign-in exists, Clerk lists the account's other ways to get
  // one: a text when the email was typed, an email when the number was.
  const otherChannel = step.name === "code" ? (step.channel === "email" ? "phone" : "email") : null;
  const otherCode = otherChannel
    ? signIn.supportedFirstFactors.find(
        (factor): factor is Extract<typeof factor, { strategy: `${Channel}_code` }> =>
          factor.strategy === `${otherChannel}_code`,
      )
    : undefined;

  const sendCodeElsewhere = async () => {
    if (!otherChannel || !otherCode) return;

    setProblem(null);
    setAction("code");
    const { error } =
      otherChannel === "phone"
        ? await signIn.phoneCode.sendCode()
        : await signIn.emailCode.sendCode();
    setAction(null);
    if (!error) {
      go({
        name: "code",
        channel: otherChannel,
        destination: displayIdentifier(otherCode.safeIdentifier),
      });
    }
  };

  const submitCode = (code: string) => {
    switch (step.name) {
      case "code":
        return step.channel === "email"
          ? signIn.emailCode.verifyCode({ code })
          : signIn.phoneCode.verifyCode({ code });
      case "verify":
        if (step.strategy === "email_code") return signIn.mfa.verifyEmailCode({ code });
        if (step.strategy === "phone_code") return signIn.mfa.verifyPhoneCode({ code });
        return signIn.mfa.verifyTOTP({ code });
      case "reset":
        return step.channel === "email"
          ? signIn.resetPasswordEmailCode.verifyCode({ code })
          : signIn.resetPasswordPhoneCode.verifyCode({ code });
      default:
        return Promise.resolve({ error: null });
    }
  };

  const sendCodeAgain = () => {
    switch (step.name) {
      case "code":
        return step.channel === "email" ? signIn.emailCode.sendCode() : signIn.phoneCode.sendCode();
      case "verify":
        return step.strategy === "email_code"
          ? signIn.mfa.sendEmailCode()
          : signIn.mfa.sendPhoneCode();
      case "reset":
        return step.channel === "email"
          ? signIn.resetPasswordEmailCode.sendCode()
          : signIn.resetPasswordPhoneCode.sendCode();
      default:
        return Promise.resolve({ error: null });
    }
  };

  const verifyCode = async (code: string) => {
    const { error } = await submitCode(code);
    if (error) return false;
    await advance();
    return true;
  };

  const resendCode = async () => !(await sendCodeAgain()).error;

  const saveNewPassword = async () => {
    if (step.name !== "new-password" || newPassword.length < 8) return;

    setAction("password");
    const params = { password: newPassword, signOutOfOtherSessions: true };
    const { error } =
      step.channel === "phone"
        ? await signIn.resetPasswordPhoneCode.submitPassword(params)
        : await signIn.resetPasswordEmailCode.submitPassword(params);
    if (!error) await advance();
    setAction(null);
  };

  // Clerk keeps the last attempt's errors, including one from before this
  // screen mounted, so they wait for a request made here.
  const banner = problem ?? (attempted ? globalMessage(errors.global) : undefined);

  const identifierError =
    attempted && !identifier.trim()
      ? "Enter your email or phone number."
      : attempted && identifier === sent.identifier
        ? fieldMessage(errors.fields.identifier)
        : undefined;

  const passwordError =
    attempted === "password" && !password
      ? "Enter your password."
      : attempted && password === sent.password
        ? fieldMessage(errors.fields.password)
        : undefined;

  const viaPhone = isPhoneIdentifier(toIdentifier(identifier));

  const codeScreen =
    step.name === "verify"
      ? { icon: ShieldCheck, title: "Verify it's you" }
      : step.name === "reset"
        ? { icon: KeyRound, title: "Reset your password" }
        : step.name === "code" && step.channel === "phone"
          ? { icon: MessageSquareText, title: "Check your texts" }
          : { icon: Mail, title: "Check your email" };

  return (
    <AuthShell
      stepKey={step.name === "code" ? `code-${step.channel}` : step.name}
      direction={direction}
      onBack={step.name === "credentials" ? undefined : backToStart}
      footer={
        step.name === "credentials" ? (
          <HStack className="items-center justify-center gap-1.5">
            <Text className="text-[14.5px] text-muted-foreground">New to Aeghin?</Text>
            <TextLink label="Create an account" onPress={() => router.push("/sign-up")} />
          </HStack>
        ) : undefined
      }
    >
      {step.name === "credentials" ? (
        <View>
          <AuthHeader title="Welcome back" subtitle="Your worship team, scheduled." />

          <View style={{ gap: 16 }}>
            <AuthInput
              label="Email or phone"
              icon={User}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@church.org"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordInput.current?.focus()}
              error={identifierError}
            />

            <View>
              <PasswordInput
                ref={passwordInput}
                label="Password"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={signInWithPassword}
                error={passwordError}
              />
              <View style={{ alignSelf: "flex-end", marginTop: 12 }}>
                <TextLink label="Forgot password?" onPress={resetPassword} disabled={busy} />
              </View>
            </View>

            <AuthError message={banner} />

            <AuthButton
              label="Sign in"
              onPress={signInWithPassword}
              busy={action === "password"}
              disabled={busy}
            />

            <OrDivider />

            <AuthButton
              variant="secondary"
              icon={viaPhone ? MessageSquareText : Mail}
              label={viaPhone ? "Text me a code" : "Email me a code"}
              onPress={signInWithCode}
              busy={action === "code"}
              disabled={busy}
            />
          </View>
        </View>
      ) : step.name === "new-password" ? (
        <View>
          <AuthHeader
            icon={KeyRound}
            title="Choose a new password"
            subtitle="You'll be signed in with it here, and signed out everywhere else."
          />

          <View style={{ gap: 16 }}>
            <PasswordInput
              label="New password"
              icon={Lock}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              textContentType="newPassword"
              autoComplete="new-password"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={saveNewPassword}
              error={fieldMessage(errors.fields.password)}
              hint="Use 8 or more characters."
            />

            <AuthError message={banner} />

            <AuthButton
              label="Save and sign in"
              onPress={saveNewPassword}
              busy={action === "password"}
              disabled={busy || newPassword.length < 8}
            />
          </View>
        </View>
      ) : (
        <CodeStep
          icon={codeScreen.icon}
          title={codeScreen.title}
          destination={step.destination}
          reason={
            step.name === "reset" && step.breached
              ? "That password may have been exposed in a data breach, so it needs replacing."
              : undefined
          }
          description={
            step.name === "verify" && step.strategy === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : undefined
          }
          error={fieldMessage(errors.fields.code) ?? banner}
          busy={busy}
          onVerify={verifyCode}
          onResend={step.name === "verify" && step.strategy === "totp" ? undefined : resendCode}
        >
          {step.name === "code" ? (
            <>
              {otherCode ? (
                <TextLink
                  label={otherChannel === "phone" ? "Text me instead" : "Email me instead"}
                  muted
                  onPress={sendCodeElsewhere}
                  disabled={busy}
                />
              ) : null}
              <TextLink label="Use your password instead" muted onPress={backToStart} />
            </>
          ) : null}
        </CodeStep>
      )}
    </AuthShell>
  );
}
