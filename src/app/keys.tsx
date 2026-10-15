import { Stack } from "expo-router";
import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import MicVocal from "lucide-react-native/icons/mic-vocal";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import {
  DetailButton,
  DetailCard,
  DetailCardHeader,
} from "@/components/events/event-detail-parts";
import { useCurrentOrganization } from "@/components/organization-provider";
import { RemovableChip, ToolbarChip } from "@/components/songs/list-toolbar";
import { SortDialog } from "@/components/songs/song-dialogs";
import { SongKeyFilterDialog } from "@/components/songs/song-key-filter-dialog";
import { useSongKeyEditor } from "@/components/songs/song-key-dialog";
import {
  SONG_KEY_SEPARATOR_INSET,
  SongKeyRow,
  SongKeyRowSkeleton,
} from "@/components/songs/song-key-row";
import { Button, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSongKeys } from "@/hooks/use-song-keys";
import { useSongs } from "@/hooks/use-songs";
import { useTheme } from "@/hooks/use-theme";
import { toggle } from "@/lib/songs/library";
import {
  SONG_KEY_SORT_OPTIONS,
  filterSongKeys,
  keysOf,
  themesOfKeys,
  type SongKeySort,
} from "@/lib/songs/song-keys";
import type { LibrarySong, SongKey } from "@/types/song";

/** My keys wears the brand rather than a service's colour. */
const BRAND_TINT = { base: brand.orange, text: brand.orange };

const NO_KEYS: SongKey[] = [];
const NO_SONGS: LibrarySong[] = [];

/**
 * The key each song is sung in, for the singers: the web's My keys page,
 * opened from the sidebar. Private to whoever is signed in — the server scopes
 * every row to the caller rather than taking a user id from here.
 *
 * Search, filters and sort follow the web page's rules. Its Key and Theme
 * dropdowns and its With comments chip become one Filters dialog here, the
 * same shape the Songs tab uses for the library.
 */
export default function KeysScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const songKeys = useSongKeys(organizationId);
  // The picker's pool, usually already loaded by the Songs tab.
  const songs = useSongs(organizationId);
  const entries = songKeys.data ?? NO_KEYS;
  const editor = useSongKeyEditor(organizationId, songs.data ?? NO_SONGS, entries);

  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [sort, setSort] = useState<SongKeySort>("title");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const refetchKeys = songKeys.refetch;
  const refetchSongs = songs.refetch;
  const pullToRefresh = usePullToRefresh(() => Promise.all([refetchKeys(), refetchSongs()]));

  // Only the keys and themes you actually have.
  const keyOptions = useMemo(() => keysOf(entries), [entries]);
  const themeOptions = useMemo(() => themesOfKeys(entries), [entries]);
  const withComments = entries.filter((entry) => Boolean(entry.notes)).length;

  // A filter whose last song was just edited out of it drops away rather than
  // leaving an empty list behind.
  const activeKeys = new Set(
    keyOptions.filter((option) => selectedKeys.has(option.value)).map((option) => option.value),
  );
  const activeThemes = new Set(
    themeOptions.filter((option) => selectedThemes.has(option.value)).map((option) => option.value),
  );
  const onlyComments = commentsOnly && withComments > 0;

  const visible = filterSongKeys(entries, {
    query,
    keys: activeKeys,
    themes: activeThemes,
    commentsOnly: onlyComments,
    sort,
  });

  const filterCount = activeKeys.size + activeThemes.size + (onlyComments ? 1 : 0);
  const narrowed = query.trim().length > 0 || filterCount > 0;
  // Nothing to narrow by until there is more than one key, a theme, or a comment.
  const canFilter = keyOptions.length > 1 || themeOptions.length > 0 || withComments > 0;
  const sortLabel = SONG_KEY_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

  const clearFilters = () => {
    setQuery("");
    setSelectedKeys(new Set());
    setSelectedThemes(new Set());
    setCommentsOnly(false);
  };

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "My keys" }} />

      <ScrollView
        contentContainerStyle={{ paddingTop: 18, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        <DetailCard>
          <DetailCardHeader
            icon={MicVocal}
            title={
              entries.length === 0
                ? "Your keys"
                : `${entries.length} ${entries.length === 1 ? "song" : "songs"}`
            }
            subtitle="Only you can see these"
            tint={BRAND_TINT}
            trailing={
              songKeys.isError ? undefined : (
                <DetailButton
                  icon={Plus}
                  label="Add"
                  service={BRAND_TINT}
                  onPress={() => editor.openAdd()}
                />
              )
            }
          />

          {entries.length > 0 ? (
            <VStack className="gap-2.5 px-4 pb-3">
              <HStack
                className="items-center gap-2 rounded-xl border px-3"
                style={{ borderColor: theme.border, backgroundColor: theme.surface }}
              >
                <AppIcon icon={Search} size={16} color={theme.textMuted} />

                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search your keys"
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel="Search your keys by song, artist, theme or comment"
                  style={{ flex: 1, fontSize: 15, paddingVertical: 10, color: theme.text }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />

                {query ? (
                  <Pressable
                    onPress={() => setQuery("")}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={8}
                  >
                    <AppIcon icon={X} size={14} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </HStack>

              <HStack className="gap-2">
                {canFilter ? (
                  <ToolbarChip
                    icon={SlidersHorizontal}
                    label="Filters"
                    count={filterCount}
                    onPress={() => setFiltersOpen(true)}
                  />
                ) : null}
                <ToolbarChip icon={ArrowUpDown} label={sortLabel} onPress={() => setSortOpen(true)} />
              </HStack>

              {narrowed ? (
                <HStack className="flex-wrap items-center gap-1.5">
                  <Text className="text-[12px] font-medium text-muted-foreground">
                    {`${visible.length} result${visible.length === 1 ? "" : "s"}`}
                  </Text>

                  {onlyComments ? (
                    <RemovableChip label="With comments" onPress={() => setCommentsOnly(false)} />
                  ) : null}

                  {[...activeKeys].map((value) => (
                    <RemovableChip
                      key={`key-${value}`}
                      label={value}
                      onPress={() => setSelectedKeys((current) => toggle(current, value))}
                    />
                  ))}

                  {[...activeThemes].map((value) => (
                    <RemovableChip
                      key={`theme-${value}`}
                      label={value}
                      capitalize
                      onPress={() => setSelectedThemes((current) => toggle(current, value))}
                    />
                  ))}

                  <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={6}>
                    <Text className="text-[12px] font-medium text-muted-foreground underline">
                      Clear all
                    </Text>
                  </Pressable>
                </HStack>
              ) : null}
            </VStack>
          ) : null}

          <Divider />

          {songKeys.isPending ? (
            Array.from({ length: 4 }, (_, index) => (
              <VStack key={index}>
                {index > 0 ? <Divider style={{ marginLeft: SONG_KEY_SEPARATOR_INSET }} /> : null}
                <SongKeyRowSkeleton index={index} />
              </VStack>
            ))
          ) : songKeys.isError ? (
            <CardMessage
              icon={CircleAlert}
              title="Couldn't load your keys"
              body="Pull down to try again."
              tone="error"
            />
          ) : entries.length === 0 ? (
            <CardMessage
              icon={MicVocal}
              title="No keys saved yet"
              body="Save a song from an event's setlist with its ⋮, or add one here."
            />
          ) : visible.length === 0 ? (
            <CardMessage
              icon={SearchX}
              title="No matches"
              body={
                query.trim()
                  ? `Nothing in your keys matches “${query.trim()}”.`
                  : "Nothing in your keys matches those filters."
              }
              onClear={clearFilters}
            />
          ) : (
            visible.map((entry, index) => (
              <VStack key={entry.id}>
                {index > 0 ? <Divider style={{ marginLeft: SONG_KEY_SEPARATOR_INSET }} /> : null}
                <SongKeyRow entry={entry} onEdit={() => editor.openEdit(entry)} />
              </VStack>
            ))
          )}
        </DetailCard>
      </ScrollView>

      <SongKeyFilterDialog
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        keys={keyOptions}
        themes={themeOptions}
        selectedKeys={activeKeys}
        selectedThemes={activeThemes}
        withComments={withComments}
        commentsOnly={onlyComments}
        onToggleKey={(value) => setSelectedKeys((current) => toggle(current, value))}
        onToggleTheme={(value) => setSelectedThemes((current) => toggle(current, value))}
        onToggleComments={() => setCommentsOnly(!onlyComments)}
        onClear={() => {
          setSelectedKeys(new Set());
          setSelectedThemes(new Set());
          setCommentsOnly(false);
        }}
      />

      <SortDialog
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        sort={sort}
        onSelect={setSort}
        options={SONG_KEY_SORT_OPTIONS}
        description="How your keys are ordered."
      />

      {editor.dialog}
    </VStack>
  );
}

type CardMessageProps = {
  icon: AppIconName;
  title: string;
  body: string;
  tone?: "default" | "error";
  /** Filtered-empty only: takes the search and every filter off. */
  onClear?: () => void;
};

/** The card's empty, filtered-empty and failed states, in one shape. */
function CardMessage({ icon, title, body, tone = "default", onClear }: CardMessageProps) {
  const theme = useTheme();
  const tint = tone === "error" ? theme.destructive : theme.textMuted;

  return (
    <VStack space="sm" className="items-center px-6 py-10">
      <AppIcon icon={icon} size={30} color={tint} />
      <Text className="text-[16px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[280px] text-center text-[13.5px] text-muted-foreground">
        {body}
      </Text>

      {onClear ? (
        <Button
          variant="outline"
          onPress={onClear}
          className="mt-1.5 rounded-xl border-border"
        >
          <ButtonText className="text-brand">Clear filters</ButtonText>
        </Button>
      ) : null}
    </VStack>
  );
}
