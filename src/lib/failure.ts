import { ApiError } from "@/lib/api";

/**
 * What to tell the person when a write was refused.
 *
 * The server's own wording is the message for anything but a fault: the
 * routes answer a refusal with the reason, and that reason names the rule.
 * A 500 says nothing worth repeating.
 */
export function failureMessage(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  if (error instanceof ApiError && error.status !== 500 && error.message) {
    return error.message;
  }
  return fallback;
}
