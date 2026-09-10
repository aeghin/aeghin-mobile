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

  return uploadMessage(error) ?? fallback;
}

/**
 * The same, for the leg that goes to UploadThing rather than to our own API.
 *
 * Those throw their own classes, not `ApiError`, so without this every upload
 * failure — a refused presign, a dropped connection — reads as the fallback.
 * The message is either our file router's refusal or UploadThing's own, and
 * both name what went wrong; the exception is its internal client fault, which
 * asks the reader to report the problem to a company they have never heard of.
 *
 * Matched on `_tag` rather than `instanceof`: the classes live in
 * `@uploadthing/shared`, a package we do not depend on directly.
 */
function uploadMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  const { _tag: tag, code } = error as Error & { _tag?: unknown; code?: unknown };

  // `UploadAbortedError` and `UploadPausedError` share this tag. We never
  // pause, so anything carrying it is an upload that was stopped.
  if (tag === "UploadAborted") return "The upload was cancelled.";

  if (tag !== "UploadThingError" || code === "INTERNAL_CLIENT_ERROR") return undefined;

  return error.message || undefined;
}
