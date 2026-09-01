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

  constructor(status: number, message?: string) {
    super(message ?? `Request failed (${status}).`);
    this.name = "ApiError";
    this.status = status;
    // Hermes: restore the prototype chain so `instanceof ApiError` holds.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * The `{ error }` string every mobile route answers a failure with.
 *
 * Worth reading for a write, where the reason is the whole message — an
 * invitation that expired says so. A body that isn't the JSON we expect is not
 * itself an error to report: a proxy's HTML timeout page must not replace the
 * status that actually explains the failure.
 */
async function errorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One request to the web app, with a bearer token attached.
 *
 * The token is read per call rather than captured once — Clerk session tokens
 * are short lived, so a hoisted one starts returning 401s after about a minute.
 */
async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getClerkInstance().session?.getToken();

  if (!token) {
    throw new ApiError(401);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? null : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }

  return (await response.json()) as T;
}

/** GETs `path`. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

/** POSTs `body` as JSON to `path`. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}
