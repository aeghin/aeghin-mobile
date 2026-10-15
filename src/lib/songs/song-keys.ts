import { KEY_OPTIONS, formatKey } from "@/lib/config/keys";
import type { FilterOption } from "@/lib/songs/library";
import type { SongKey } from "@/types/song";

/**
 * Searching, filtering and sorting My keys.
 *
 * The rules are the web My keys page's: a search matches the title, the
 * artist, a theme or your comment; the Key and Theme filters are unions within
 * themselves and an intersection between; "With comments" narrows on top. It
 * all runs on the device, against a journal of a few dozen songs.
 */

export type SongKeySort = "title" | "artist" | "recent" | "key";

export const SONG_KEY_SORT_OPTIONS: { value: SongKeySort; label: string }[] = [
  { value: "title", label: "Title (A–Z)" },
  { value: "artist", label: "Artist (A–Z)" },
  { value: "recent", label: "Recently saved" },
  { value: "key", label: "Key" },
];

/** Where a key falls in the picker's order, so a list of keys reads C, Cm, C#… */
function keyRank(entry: SongKey): number {
  const index = KEY_OPTIONS.findIndex(
    (option) => option.pitch === entry.pitch && option.quality === entry.keyQuality,
  );
  return index === -1 ? KEY_OPTIONS.length : index;
}

/** The keys you actually sing in, each with how many songs, in the picker's order. */
export function keysOf(entries: SongKey[]): FilterOption[] {
  const byLabel = new Map<string, { option: FilterOption; rank: number }>();

  for (const entry of entries) {
    const value = formatKey(entry.pitch, entry.keyQuality);
    const known = byLabel.get(value);
    if (known) known.option.count += 1;
    else byLabel.set(value, { option: { value, count: 1 }, rank: keyRank(entry) });
  }

  return [...byLabel.values()]
    .sort((a, b) => a.rank - b.rank || a.option.value.localeCompare(b.option.value))
    .map(({ option }) => option);
}

/** The themes on your songs, most-used first as the library's filter lists them. */
export function themesOfKeys(entries: SongKey[]): FilterOption[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const theme of entry.themes) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  }

  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
}

export type SongKeyFilters = {
  query: string;
  /** Formatted keys, `G` or `Em`, as {@link keysOf} names them. */
  keys: Set<string>;
  themes: Set<string>;
  commentsOnly: boolean;
  sort: SongKeySort;
};

/** The journal as the list should read it. */
export function filterSongKeys(
  entries: SongKey[],
  { query, keys, themes, commentsOnly, sort }: SongKeyFilters,
): SongKey[] {
  const needle = query.trim().toLowerCase();

  const matched = entries.filter((entry) => {
    if (commentsOnly && !entry.notes) return false;
    if (keys.size > 0 && !keys.has(formatKey(entry.pitch, entry.keyQuality))) return false;
    if (themes.size > 0 && !entry.themes.some((theme) => themes.has(theme))) return false;
    if (!needle) return true;

    return (
      entry.title.toLowerCase().includes(needle) ||
      entry.artist.toLowerCase().includes(needle) ||
      entry.themes.some((theme) => theme.toLowerCase().includes(needle)) ||
      (entry.notes ?? "").toLowerCase().includes(needle)
    );
  });

  return matched.sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "artist":
        return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
      case "recent":
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      case "key":
        return keyRank(a) - keyRank(b) || a.title.localeCompare(b.title);
    }
  });
}
