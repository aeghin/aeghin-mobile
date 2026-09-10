import { genUploader } from "uploadthing/client";

import { apiBaseUrl, authHeaders } from "@/lib/api";

/**
 * Uploads straight to UploadThing, the way the dashboard's browser does.
 *
 * The phone used to post bytes to our own API for `UTApi` to forward, a path
 * capped at the host's 4.5MB request body limit. This one has `/api/uploadthing`
 * sign a URL — the same file router, so the same role check — and then sends the
 * file to UploadThing itself, leaving the router's own caps as the only limit.
 *
 * `uploadthing/client` is framework-agnostic; `useUploadThing` is the React DOM
 * hook and the reason this looked impossible. It sends the file over
 * `XMLHttpRequest` with React Native's `{ uri, type, name }` part, which is what
 * keeps it clear of Expo's WinterCG `fetch` — that `fetch` cannot encode such a
 * part at all, and throws before opening a socket.
 */

/** A file the pickers hand us. `size` is required: the presign request sends it. */
export type UploadFile = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

/** What UploadThing stored, in the shape our own API records. */
export type StoredFile = {
  name: string;
  url: string;
  key: string;
  type: string;
  size: number;
};

/**
 * What we actually call, spelled out.
 *
 * `genUploader` infers its argument and result from the server's `FileRouter`
 * type, which lives in the other repo. Rather than reconstruct that type, the
 * seam is declared once here — narrowed to the two endpoints and the fields we
 * read, so everything downstream stays checked.
 */
type Uploader = {
  uploadFiles: (
    slug: Endpoint,
    opts: {
      files: File[];
      input: Record<string, string>;
      headers: () => Promise<Record<string, string>>;
    },
  ) => Promise<
    { name: string; size: number; key: string; type: string; ufsUrl: string }[]
  >;
};

type Endpoint = "songAttachment" | "orgLogo";

const uploader = genUploader({
  // Must be a `URL`: given a string the library falls back to
  // `window.location.origin`, which React Native does not have.
  url: new URL(`${apiBaseUrl}/api/uploadthing`),
  // The library's default is `window.fetch`. Called through the global so Expo's
  // runtime has installed its own by the time this runs.
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  package: "aeghin-mobile",
}) as unknown as Uploader;

/**
 * Uploads to one file router endpoint and returns what landed.
 *
 * The bearer is read per call rather than captured: Clerk session tokens are
 * short lived, and this is the request that authorizes the upload.
 */
export async function uploadToStorage(
  slug: Endpoint,
  files: UploadFile[],
  input: Record<string, string>,
): Promise<StoredFile[]> {
  const stored = await uploader.uploadFiles(slug, {
    // RN's own file part shape, which the library handles; its types say `File`.
    files: files as unknown as File[],
    input,
    headers: authHeaders,
  });

  // Field by field rather than a spread: `url` and `appUrl` are deprecation
  // getters that log the moment they are read.
  return stored.map((file) => ({
    name: file.name,
    url: file.ufsUrl,
    key: file.key,
    type: file.type,
    size: file.size,
  }));
}
