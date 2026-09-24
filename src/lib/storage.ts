const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Bytes the way the web's plans describe them: "500 MB", "5 GB", "1.2 GB". */
export function formatStorage(bytes: number): string {
  if (bytes >= GB) return `${Number((bytes / GB).toFixed(1))} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
