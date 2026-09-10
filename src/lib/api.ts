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

/** The Next app's origin, for the one caller that streams rather than requests. */
export const apiBaseUrl = baseUrl;

/** The bearer header a streaming client attaches itself. Read per call, like `request`. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getClerkInstance().session?.getToken();
  if (!token) throw new ApiError(401);
  return { Authorization: `Bearer ${token}` };
}

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
function errorFromBody(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    return typeof body.error === "string" ? body.error : undefined;
  } catch {
    return undefined;
  }
}

async function errorMessage(response: Response): Promise<string | undefined> {
  return errorFromBody(await response.text().catch(() => ""));
}

/**
 * One request to the web app, with a bearer token attached.
 *
 * The token is read per call rather than captured once — Clerk session tokens
 * are short lived, so a hoisted one starts returning 401s after about a minute.
 */
async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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

/**
 * One file, as React Native's `FormData` wants it.
 *
 * Not a `Blob`: RN streams from the file's own uri rather than reading it into
 * JS, which is what keeps a 60MB track off the heap. The three fields are what
 * its networking layer turns into a multipart part with a filename — and a
 * filename is what makes the server parse the part as a file rather than a
 * field.
 */
export type UploadFile = {
  uri: string;
  name: string;
  type: string;
};

/**
 * POSTs files to `path` as `multipart/form-data`.
 *
 * `XMLHttpRequest` rather than `fetch`. SDK 57 replaces the global `fetch` with
 * Expo's WinterCG one, and that implementation cannot encode a React Native
 * file part — `convertFormData` takes a string, a `Blob`, or anything with
 * `bytes()`, and throws "Unsupported FormDataPart implementation" on our
 * `{ uri, name, type }`. Expo leaves `XMLHttpRequest` alone, so the part still
 * reaches RN's networking layer, which streams the file from disk.
 *
 * Nothing sets `Content-Type` here either way: a multipart body must carry the
 * boundary the platform generated, and a hand-written header would not match it.
 */
export async function apiUpload<T>(
  path: string,
  field: string,
  files: UploadFile[],
): Promise<T> {
  const token = await getClerkInstance().session?.getToken();

  if (!token) {
    throw new ApiError(401);
  }

  const form = new FormData();

  for (const file of files) {
    // RN's FormData takes this shape; the DOM lib's types only know `Blob`.
    form.append(field, file as unknown as Blob);
  }

  const { status, body } = await new Promise<{ status: number; body: string }>(
    (resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open("POST", `${baseUrl}${path}`);
      request.setRequestHeader("Accept", "application/json");
      request.setRequestHeader("Authorization", `Bearer ${token}`);

      request.onload = () =>
        resolve({ status: request.status, body: request.responseText });

      // A transport failure never reaches a status, so it carries its own
      // wording rather than falling through to `failureMessage`'s fallback.
      request.onerror = () =>
        reject(new ApiError(0, "The upload didn't finish. Check your connection."));

      request.onabort = () => reject(new ApiError(0, "The upload was cancelled."));

      request.send(form);
    },
  );

  if (status < 200 || status >= 300) {
    throw new ApiError(status, errorFromBody(body));
  }

  return JSON.parse(body) as T;
}

/** GETs `path`. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

/** POSTs `body` as JSON to `path`. */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

/** PUTs `body` as JSON to `path`. */
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

/** PATCHes `body` as JSON to `path`. */
export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

/** DELETEs `path`. */
export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}

/** DELETEs `path` with a JSON body, for a resource named by a field rather than a segment. */
export function apiDeleteWithBody<T>(path: string, body: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}
