import { useSignUp } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import Lock from "lucide-react-native/icons/lock";
import Mail from "lucide-react-native/icons/mail";
import MessageSquareText from "lucide-react-native/icons/message-square-text";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, View, type TextInput } from "react-native";

import {
  AuthButton,
  AuthError,
  AuthInput,
  PasswordInput,
  PhoneInput,
  TextLink,
} from "@/components/auth/auth-controls";
import { AuthHeader, AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { clerkMessage, fieldMessage, formatUsPhone, globalMessage, usPhoneE164 } from "@/lib/auth";

type Step = "details" | "email" | "phone";

const STEPS: Step[] = ["details", "email", "phone"];

type Details = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type FieldError = { code: string; message: string; longMessage?: string } | null;

/**
 * Clerk's wording for a taken address tells the person to try another one,
 * when what they want is to sign in.
 */
function identifierMessage(error: FieldError, taken: string): string | undefined {
  return error?.code === "form_identifier_exists" ? taken : fieldMessage(error);
}

/**
 * Creating an account. Production requires a name, an email, a phone and a
 * password, and verifies both the email and the phone with a code, so the
 * flow is one form and two code steps; the bar at the top counts them.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();

  const [step, setStep] = useState<Step>("details");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // What the last request carried. Clerk's error for a field shows only while
  // the field still holds it, so correcting the value clears the message.
  const [sent, setSent] = useState<Details | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const lastNameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);

  const busy = creating || fetchStatus === "fetching";

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/sign-in"));

  const go = (next: Step) => {
    setDirection(1);
    setProblem(null);
    setStep(next);
  };

  const editDetails = useCallback(() => {
    setDirection(-1);
    setProblem(null);
    setStep("details");
  }, []);

  useEffect(() => {
    if (step === "details") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      editDetails();
      return true;
    });
    return () => subscription.remove();
  }, [step, editDetails]);

  /** Whatever Clerk still wants, in its order: the email checked, the phone, then the account. */
  const advance = async () => {
    if (signUp.status === "complete") {
      const { error } = await signUp.finalize();
      if (error) setProblem(clerkMessage(error));
      return;
    }

    if (signUp.unverifiedFields.includes("email_address")) {
      const { error } = await signUp.verifications.sendEmailCode();
      if (!error) go("email");
    } else if (signUp.unverifiedFields.includes("phone_number")) {
      const { error } = await signUp.verifications.sendPhoneCode();
      if (!error) go("phone");
    } else {
      setProblem("Couldn't finish creating your account. Try again.");
    }
  };

  const missing = {
    firstName: firstName.trim() ? undefined : "Enter your first name.",
    lastName: lastName.trim() ? undefined : "Enter your last name.",
    email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : "Enter a valid email address.",
    phone: phone.length === 10 ? undefined : "Enter a 10-digit phone number.",
    password: password.length >= 8 ? undefined : "Use 8 or more characters.",
  };

  const create = async () => {
    setAttempted(true);
    if (Object.values(missing).some(Boolean)) return;

    // The first submit starts a new sign-up rather than updating one this
    // device left unfinished on an earlier visit; a resubmit after "Change it"
    // updates this one, keeping whatever was already verified.
    if (!sent) await signUp.reset();

    setSent({ firstName, lastName, email, phone, password });
    setProblem(null);
    setCreating(true);

    const { error } = await signUp.password({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      emailAddress: email.trim(),
      phoneNumber: usPhoneE164(phone),
      password,
    });
    if (!error) await advance();
    setCreating(false);
  };

  const verify = async (code: string) => {
    const { error } =
      step === "email"
        ? await signUp.verifications.verifyEmailCode({ code })
        : await signUp.verifications.verifyPhoneCode({ code });
    if (error) return false;
    await advance();
    return true;
  };

  const resend = async () => {
    const { error } =
      step === "email"
        ? await signUp.verifications.sendEmailCode()
        : await signUp.verifications.sendPhoneCode();
    return !error;
  };

  const unchanged = (field: keyof Details, value: string) => sent !== null && sent[field] === value;

  const errorFor = (field: keyof Details, value: string, clerk: string | undefined) =>
    attempted && missing[field] ? missing[field] : unchanged(field, value) ? clerk : undefined;

  const banner = problem ?? (sent ? globalMessage(errors.global) : undefined);

  return (
    <>
      {/* A swipe back mid-verification would throw away the codes already sent. */}
      <Stack.Screen options={{ gestureEnabled: step === "details" }} />

      <AuthShell
        stepKey={step}
        direction={direction}
        onBack={step === "details" ? leave : editDetails}
        progress={{ step: STEPS.indexOf(step) + 1, total: STEPS.length }}
        footer={
          step === "details" ? (
            <HStack className="items-center justify-center gap-1.5">
              <Text className="text-[14.5px] text-muted-foreground">Already have an account?</Text>
              <TextLink label="Sign in" onPress={leave} />
            </HStack>
          ) : undefined
        }
      >
        {step === "details" ? (
          <View>
            <AuthHeader title="Create your account" subtitle="Join your team or start a new one." />

            <View style={{ gap: 16 }}>
              <HStack className="gap-3">
                <View style={{ flex: 1 }}>
                  <AuthInput
                    label="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Grace"
                    autoCapitalize="words"
                    textContentType="givenName"
                    autoComplete="given-name"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => lastNameInput.current?.focus()}
                    error={errorFor("firstName", firstName, fieldMessage(errors.fields.firstName))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AuthInput
                    ref={lastNameInput}
                    label="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Lee"
                    autoCapitalize="words"
                    textContentType="familyName"
                    autoComplete="family-name"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => emailInput.current?.focus()}
                    error={errorFor("lastName", lastName, fieldMessage(errors.fields.lastName))}
                  />
                </View>
              </HStack>

              <AuthInput
                ref={emailInput}
                label="Email"
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                placeholder="you@church.org"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordInput.current?.focus()}
                error={errorFor(
                  "email",
                  email,
                  identifierMessage(
                    errors.fields.emailAddress,
                    "There's already an account with this email. Sign in instead.",
                  ),
                )}
              />

              <PhoneInput
                label="Phone"
                digits={phone}
                onChangeDigits={setPhone}
                placeholder="555-123-4567"
                hint="So your team can reach you. We'll text a code to confirm it."
                error={errorFor(
                  "phone",
                  phone,
                  identifierMessage(
                    errors.fields.phoneNumber,
                    "There's already an account with this number. Sign in instead.",
                  ),
                )}
              />

              <PasswordInput
                ref={passwordInput}
                label="Password"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="go"
                onSubmitEditing={create}
                hint="Use 8 or more characters."
                error={errorFor("password", password, fieldMessage(errors.fields.password))}
              />

              <AuthError message={banner} />

              <AuthButton label="Create account" onPress={create} busy={busy} />

              {/* Where Clerk's bot protection mounts a challenge, if one is ever served. */}
              <View nativeID="clerk-captcha" />
            </View>
          </View>
        ) : (
          <CodeStep
            icon={step === "email" ? Mail : MessageSquareText}
            title={step === "email" ? "Check your email" : "Check your texts"}
            destination={step === "email" ? sent?.email.trim() : formatUsPhone(sent?.phone ?? "")}
            error={fieldMessage(errors.fields.code) ?? banner}
            busy={busy}
            onVerify={verify}
            onResend={resend}
          >
            <TextLink
              label={step === "email" ? "Wrong email? Change it" : "Wrong number? Change it"}
              muted
              onPress={editDetails}
            />
          </CodeStep>
        )}
      </AuthShell>
    </>
  );
}
