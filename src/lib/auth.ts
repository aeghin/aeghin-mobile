import { isClerkAPIResponseError, isClerkRuntimeError } from "@clerk/expo";

/**
 * Ten digits as someone types them, the US way the rest of the app reads a
 * number: the invite dialog asks for exactly ten and the member page prints
 * them `555-123-4567`. A leading 1 is a country code, never the start of an
 * area code, so autofill's "+1 (555) …" lands on the same ten digits.
 */
export function usPhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
}

/** `"5551234"` → `"555-123-4"`, so the dashes appear while typing. */
export function formatUsPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Clerk takes numbers in E.164 only. */
export function usPhoneE164(digits: string): string {
  return `+1${digits}`;
}

/**
 * The sign-in field takes an email or a phone number. A phone typed the local
 * way goes to Clerk in E.164, or it is looked up as a username and missed.
 */
export function toIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes("@") || !/^[\d\s().+-]+$/.test(value)) return value;

  const digits = value.replace(/\D/g, "");
  return value.startsWith("+") ? `+${digits}` : usPhoneE164(usPhoneDigits(digits));
}

export function isPhoneIdentifier(identifier: string): boolean {
  return identifier.startsWith("+");
}

/**
 * An identifier the way the person would recognise it: a US number back in
 * dashes, including the masked `+*********42` Clerk gives for an account's
 * other number.
 */
export function displayIdentifier(identifier: string): string {
  if (/^\+1\d{10}$/.test(identifier)) return formatUsPhone(identifier.slice(2));
  if (/^\+\*[\d*]{10}$/.test(identifier)) return formatUsPhone(identifier.slice(2)).replace(/\*/g, "•");
  return identifier;
}

type FieldError = { message: string; longMessage?: string } | null | undefined;

/** Clerk's sentence for a field, which is written for the person, not the developer. */
export function fieldMessage(error: FieldError): string | undefined {
  return error ? (error.longMessage ?? error.message) : undefined;
}

/** The first of the errors Clerk's hooks couldn't pin to a field. */
export function globalMessage(errors: readonly unknown[] | null): string | undefined {
  const [first] = errors ?? [];
  return first ? clerkMessage(first) : undefined;
}

/**
 * The right password, refused because it turned up in a data breach or was
 * marked unsafe from the Clerk dashboard. Clerk only says so once the
 * password matches; a reset is the way back in.
 */
export function isUnsafePassword(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    error.errors.some(
      (e) => e.code === "form_password_pwned" || e.code === "form_password_compromised",
    )
  );
}

/** What to show when a call fails without naming a field. */
export function clerkMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    const [first] = error.errors;
    if (first) return first.longMessage ?? first.message;
  }

  // Thrown before any request, when the account has no code sent that way.
  if (isClerkRuntimeError(error) && error.code === "factor_not_found") {
    return "This account can't get a code that way. Use your password instead.";
  }

  return "Couldn't reach Aeghin. Check your connection and try again.";
}
