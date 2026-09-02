import type { LibrarySong } from "@/types/song";

/**
 * Searching, filtering and sorting the song library.
 *
 * Every rule here is the web library's, kept deliberately identical: someone
 * who narrows to two themes on the dashboard and does the same on their phone
 * has to get the same songs back, or the filter stops being trustworthy.
 *
 * All of it runs on the device against the full list, which is what the route
 * already returns — a library is hundreds of rows, not thousands, and doing it
 * here keeps typing responsive instead of round-tripping every keystroke.
 */

export type SortKey = "title" | "artist" | "bpm";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "title", label: "Title (A–Z)" },
  { value: "artist", label: "Artist (A–Z)" },
  { value: "bpm", label: "BPM (low to high)" },
];

/** One value the library can be narrowed by, and how much of it that leaves. */
export type FilterOption = {
  value: string;
  count: number;
};

/**
 * Most-used first, ties alphabetical.
 *
 * A deliberate break from the web, which sorts both filter lists A–Z. That
 * works in a dropdown wide enough to show everything at once; in a phone sheet
 * it buries the only options worth tapping. Most values here name a single song
 * — filtering to one of those is what the search field is for — so the few that
 * actually group songs have to come first.
 */
function rank(counts: Map<string, number>): FilterOption[] {
  return Array.from(counts, ([value, count]) => ({ value, count })).sort(
    (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
}

/** Every theme in the library, with the number of songs carrying it. */
export function themesOf(songs: LibrarySong[]): FilterOption[] {
  const counts = new Map<string, number>();

  for (const song of songs) {
    for (const theme of song.themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }

  return rank(counts);
}

/** Every artist in the library, with how many songs each has. */
export function artistsOf(songs: LibrarySong[]): FilterOption[] {
  const counts = new Map<string, number>();

  for (const song of songs) {
    counts.set(song.artist, (counts.get(song.artist) ?? 0) + 1);
  }

  return rank(counts);
}

/**
 * The options as the sheet lists them.
 *
 * Whatever is already on floats to the top, so the sheet says what it is doing
 * without anyone scrolling to look for check marks, and `needle` drops the rest
 * — which is what keeps a library of a few hundred songs from opening onto a
 * list nobody can reach the bottom of.
 */
export function orderOptions(
  options: FilterOption[],
  selected: Set<string>,
  needle: string,
): FilterOption[] {
  const term = needle.trim().toLowerCase();

  const matching = term
    ? options.filter((option) => option.value.toLowerCase().includes(term))
    : options;

  // Two stable passes rather than one comparator: each half keeps its rank.
  return [
    ...matching.filter((option) => selected.has(option.value)),
    ...matching.filter((option) => !selected.has(option.value)),
  ];
}

export type LibraryFilters = {
  query: string;
  themes: Set<string>;
  artists: Set<string>;
  sort: SortKey;
};

/**
 * The library as the list should read it.
 *
 * A song survives the query when its title, its artist *or* any one of its
 * themes contains the term — searching "christmas" finds carols nobody titled
 * that. The two chip filters are unions within themselves and an intersection
 * between: pick two themes and you get songs carrying either, pick a theme and
 * an artist and you get songs that satisfy both.
 */
export function filterSongs(
  songs: LibrarySong[],
  { query, themes, artists, sort }: LibraryFilters,
): LibrarySong[] {
  const needle = query.trim().toLowerCase();

  const matched = songs.filter((song) => {
    if (needle) {
      const hit =
        song.title.toLowerCase().includes(needle) ||
        song.artist.toLowerCase().includes(needle) ||
        song.themes.some((theme) => theme.toLowerCase().includes(needle));

      if (!hit) return false;
    }

    if (themes.size > 0 && !song.themes.some((theme) => themes.has(theme))) {
      return false;
    }

    if (artists.size > 0 && !artists.has(song.artist)) {
      return false;
    }

    return true;
  });

  return matched.sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "artist":
        return a.artist.localeCompare(b.artist);
      case "bpm":
        return a.bpm - b.bpm;
    }
  });
}

/** Adds or removes one value, leaving the original set untouched. */
export function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);

  if (next.has(value)) next.delete(value);
  else next.add(value);

  return next;
}

/** `1_400_000` -> `"1.4 MB"`. Matches the web's rounding. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
