import { getClerkInstance } from "@clerk/expo";

/**
 * Thin fetch wrapper for the Next.js mobile API.
 *
 * Requests carry a short-lived Clerk session token. The server derives the
 * caller's identity from that token, so no user id is ever sent from here.
 */

function requireApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_WEB_APP_URL;
  if (!url) {
    throw new Error(
      "Missing EXPO_PUBLIC_WEB_APP_URL. Add it to .env.local pointing at the " +
        "Next app, then fully reload the app. On a physical device this must " +
        "be your machine's LAN address, not localhost.",
    );
  }
  return url.replace(/\/+$/, "");
}

const baseUrl = requireApiBaseUrl();

/** A non-2xx response. `status` drives both retry policy and UI branching. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed (${status}).`);
    this.name = "ApiError";
    this.status = status;
    // Hermes: restore the prototype chain so `instanceof ApiError` holds.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * GETs `path` from the web app with a bearer token attached.
 *
 * The token is read per call rather than captured once — Clerk session tokens
 * are short lived, so a hoisted one starts returning 401s after about a minute.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const token = await getClerkInstance().session?.getToken();

  if (!token) {
    throw new ApiError(401);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return (await response.json()) as T;
}
