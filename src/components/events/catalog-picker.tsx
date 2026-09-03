import * as Crypto from "expo-crypto";
import Check from "lucide-react-native/icons/check";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Choice } from "@/components/form-fields";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSongs } from "@/hooks/use-songs";
import { useTheme } from "@/hooks/use-theme";
import type { ServiceColors } from "@/lib/config/service-types";
import type { SetlistDraftSong } from "@/types/setlist";
import type { LibrarySong } from "@/types/song";

type SortKey = "title" | "artist" | "bpm";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "bpm", label: "BPM" },
];

type CatalogPickerProps = {
  organizationId: string;
  draftSongIds: Set<string>;
  colors: ServiceColors;
  onAdd: (song: SetlistDraftSong) => void;
};

/** The dashboard's catalog picker: search the library, tap to add. */
export function CatalogPicker({ organizationId, draftSongIds, colors, onAdd }: CatalogPickerProps) {
  const theme = useTheme();
  const songs = useSongs(organizationId);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("title");

  const catalog = useMemo(() => songs.data ?? [], [songs.data]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? catalog.filter(
          (song) =>
            song.title.toLowerCase().includes(needle) ||
            song.artist.toLowerCase().includes(needle) ||
            song.themes.some((theme) => theme.includes(needle)),
        )
      : catalog;
    return [...matched].sort((a, b) =>
      sort === "bpm"
        ? a.bpm - b.bpm
        : sort === "artist"
          ? a.artist.localeCompare(b.artist)
          : a.title.localeCompare(b.title),
    );
  }, [catalog, query, sort]);

  const add = (song: LibrarySong) =>
    onAdd({
      id: Crypto.randomUUID(),
      songId: song.id,
      position: 0,
      pitch: song.defaultPitch,
      keyQuality: song.defaultKeyQuality,
      bpm: song.bpm,
      timeSignature: song.timeSignature,
      title: song.title,
      artist: song.artist,
      youtubeUrl: song.youtubeUrl,
      spotifyUrl: song.spotifyUrl,
    });

  return (
    <VStack className="gap-3">
      <HStack
        className="items-center gap-2 rounded-xl border px-3"
        style={{ borderColor: theme.border, backgroundColor: theme.card }}
      >
        <AppIcon icon={Search} size={16} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search songs, artists or themes"
          placeholderTextColor={theme.textMuted}
          style={{ flex: 1, fontSize: 15, paddingVertical: 10, color: theme.text }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <AppIcon icon={X} size={14} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </HStack>

      <HStack className="items-center gap-1.5">
        <Text className="text-[12px] text-muted-foreground">Sort</Text>
        {SORTS.map((option) => (
          <Choice
            key={option.value}
            label={option.label}
            selected={sort === option.value}
            onPress={() => setSort(option.value)}
          />
        ))}
      </HStack>

      {songs.isPending ? (
        <HStack className="justify-center py-8">
          <Spinner color={theme.textMuted} />
        </HStack>
      ) : visible.length === 0 ? (
        <Text className="py-8 text-center text-[13px] text-muted-foreground">
          {catalog.length === 0 ? "No songs in the library yet." : "No songs match."}
        </Text>
      ) : (
        <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
          {visible.map((song, index) => {
            const added = draftSongIds.has(song.id);
            return (
              <VStack key={song.id}>
                {index > 0 ? <Divider style={{ marginLeft: 14 }} /> : null}
                <HStack className="items-center gap-3 px-3.5 py-2.5">
                  <VStack className="flex-1">
                    <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
                      {song.title}
                    </Text>
                    <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
                      {`${song.artist} · ${song.bpm} bpm · ${song.timeSignature}`}
                    </Text>
                  </VStack>
                  <Pressable
                    onPress={() => add(song)}
                    disabled={added}
                    accessibilityRole="button"
                    accessibilityLabel={added ? "Already added" : `Add ${song.title}`}
                    className="items-center justify-center rounded-full border"
                    style={{
                      width: 30,
                      height: 30,
                      borderColor: added ? "transparent" : theme.border,
                      backgroundColor: added ? colors.surface : theme.card,
                    }}
                  >
                    <AppIcon
                      icon={added ? Check : Plus}
                      size={15}
                      color={added ? colors.text : theme.text}
                    />
                  </Pressable>
                </HStack>
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
