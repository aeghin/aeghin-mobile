import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Music from "lucide-react-native/icons/music";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { InsetCard } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { PlanLimitDialog } from "@/components/plan-limit-dialog";
import {
  SONG_SEPARATOR_INSET,
  SongRow,
  SongRowSkeleton,
} from "@/components/songs/song-row";
import { SongKeysPane } from "@/components/songs/song-keys-pane";
import { SongAttachmentsDialog } from "@/components/songs/song-attachments-dialog";
import { SongFormDialog } from "@/components/songs/song-form-dialog";
import { FilterDialog, SortDialog } from "@/components/songs/song-dialogs";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useBillingStatus } from "@/hooks/use-billing";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSongKeys } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import {
  useAddSong,
  useDeleteSong,
  useSongs,
  useUpdateSong,
} from "@/hooks/use-songs";
import { ApiError } from "@/lib/api";
import { PLAN_NAMES, planOf } from "@/lib/config/plans";
import { canManageOrg } from "@/lib/config/roles";
import { isVocalist } from "@/lib/config/volunteer-roles";
import {
  SORT_OPTIONS,
  artistsOf,
  filterSongs,
  themesOf,
  toggle,
  type SortKey,
} from "@/lib/songs/library";
import type { LibrarySong, SongInput, SongKey } from "@/types/song";

/** Stable identity, so an empty library does not remake the array each render. */
const NO_SONGS: LibrarySong[] = [];

/** The same, for a journal that hasn't loaded or has nothing in it. */
const NO_KEYS: SongKey[] = [];

/**
 * The screen's two halves: the organization's library, and the caller's own
 * key journal. The journal is the dashboard's My Keys tab, which only lead
 * vocalists and BGVs are offered — so only they see the control at all.
 */
type Pane = "library" | "keys";

/** How much page the tab bar covers once the list has scrolled under it. */
const TAB_BAR_CLEARANCE = 64;

export default function SongsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const songs = useSongs(organizationId);
  const billing = useBillingStatus(organizationId);

  // Gated on the caller's volunteer roles, the way the dashboard gates its own
  // tab. Somebody who doesn't sing never asks for a journal they cannot open.
  const canSeeKeys = isVocalist(organization?.volunteerRoles);
  const songKeys = useSongKeys(organizationId, { enabled: canSeeKeys });

  const addSong = useAddSong(organizationId);
  const updateSong = useUpdateSong(organizationId);
  const deleteSong = useDeleteSong(organizationId);

  // ── View state ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("title");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [pane, setPane] = useState<Pane>("library");

  // Resolved rather than stored: switching to an organization this person does
  // not sing in takes the control away, and a remembered "keys" would strand
  // the screen on a pane with no way back.
  const activePane = canSeeKeys ? pane : "library";

  // The pull refreshes whichever pane is showing. `refetch` is stable per
  // query, so swapping the two here costs the control nothing.
  const pullToRefresh = usePullToRefresh(
    activePane === "library" ? songs.refetch : songKeys.refetch,
  );

  // `undefined` while closed, `null` for a new song, a song when editing one.
  const [editing, setEditing] = useState<LibrarySong | null | undefined>(
    undefined,
  );
  const [formError, setFormError] = useState<string | null>(null);

  // Which song's charts and tracks are open. Held by id rather than by value,
  // so the list stays live: an upload refetches the library and the dialog has
  // to redraw from the new row, not the one that was passed in.
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  const library = songs.data ?? NO_SONGS;

  // Only managers add songs, so only they see the cap.
  const songLimit = canManage ? (billing.data?.limits?.songs ?? null) : null;
  const songLimitReached = songLimit !== null && library.length >= songLimit;
  const planName = PLAN_NAMES[planOf(billing.data)];

  // The library's charts and audio against the plan's storage. Null until the plan loads.
  const storageLimit = billing.data?.limits?.storage ?? null;
  const storage =
    storageLimit === null
      ? null
      : {
          used: library.reduce(
            (total, song) => total + song.attachments.reduce((sum, file) => sum + file.size, 0),
            0,
          ),
          limit: storageLimit,
        };

  const themes = useMemo(() => themesOf(library), [library]);
  const artists = useMemo(() => artistsOf(library), [library]);

  const visible = useMemo(
    () =>
      filterSongs(library, {
        query,
        themes: selectedThemes,
        artists: selectedArtists,
        sort,
      }),
    [library, query, selectedThemes, selectedArtists, sort],
  );

  const activeFilters = selectedThemes.size + selectedArtists.size;
  const narrowed = activeFilters > 0 || query.trim().length > 0;

  const clearFilters = () => {
    setQuery("");
    setSelectedThemes(new Set());
    setSelectedArtists(new Set());
  };

  // ── Writing ───────────────────────────────────────────────────────────
  const saving = addSong.isPending || updateSong.isPending;

  const submit = (song: SongInput) => {
    setFormError(null);

    const onError = (error: unknown) => setFormError(writeFailure(error));
    const onSuccess = () => setEditing(undefined);

    if (editing) {
      updateSong.mutate(
        { songId: editing.id, song },
        { onError, onSuccess },
      );
    } else {
      addSong.mutate(song, { onError, onSuccess });
    }
  };

  const confirmDelete = (song: LibrarySong) => {
    Alert.alert(
      "Delete song",
      `${song.title} by ${song.artist} will be removed from the library and can no longer be added to setlists. Past setlists keep their copy.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteSong.mutate(song.id, {
              // The refusal worth reading is the server's: it names the events
              // this song is still scheduled for.
              onError: (error) =>
                Alert.alert("Couldn't delete", writeFailure(error)),
            }),
        },
      ],
    );
  };

  const openActions = (song: LibrarySong) => {
    Alert.alert(song.title, song.artist, [
      { text: "Edit details", onPress: () => setEditing(song) },
      {
        text: song.attachments.length
          ? `Attachments (${song.attachments.length})`
          : "Add attachments",
        onPress: () => setAttachingId(song.id),
      },
      {
        text: "Delete song",
        style: "destructive",
        onPress: () => confirmDelete(song),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

  const countLabel = narrowed
    ? `${visible.length} result${visible.length === 1 ? "" : "s"}`
    : songLimit !== null
      ? `${library.length} / ${songLimit} songs${songLimitReached ? ` · ${planName} limit reached` : ""}`
      : `${library.length} song${library.length === 1 ? "" : "s"}`;
  const countWarning = songLimitReached && !narrowed;

  // Only the journal carries a count: the library prints its own under the
  // toolbar, and printing it twice on one screen says nothing new.
  const panes: Segment<Pane>[] = [
    { value: "library", label: "Library" },
    { value: "keys", label: "My Keys", count: songKeys.data?.length || undefined },
  ];

  return (
    <VStack className="flex-1 bg-grouped">
      <AppHeader />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom + 16,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {canSeeKeys ? (
          <Box className="mb-3">
            <SegmentedControl segments={panes} value={activePane} onChange={setPane} />
          </Box>
        ) : null}

        {activePane === "keys" ? (
          <SongKeysPane
            organizationId={organizationId}
            entries={songKeys.data ?? NO_KEYS}
            isPending={songKeys.isPending}
            isError={songKeys.isError}
            catalog={library}
          />
        ) : (
          <>
            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <HStack
              className="mb-2.5 items-center gap-2 rounded-xl border px-3"
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

            <HStack className="mb-3 gap-2">
              <ToolbarChip
                icon={SlidersHorizontal}
                label="Filters"
                count={activeFilters}
                onPress={() => setFiltersOpen(true)}
              />
              <ToolbarChip
                icon={ArrowUpDown}
                label={sortLabel}
                onPress={() => setSortOpen(true)}
              />

              {canManage ? (
                <AddSongButton
                  // A full library gets the limit, not a form it can't save.
                  onPress={() => (songLimitReached ? setLimitOpen(true) : setEditing(null))}
                />
              ) : null}
            </HStack>

            {/* ── How much of the library is showing ───────────────────────── */}
            {songs.isPending || songs.isError ? null : (
              <HStack className="mb-3 flex-wrap items-center gap-1.5">
                <Text
                  className={`text-[12px] font-medium ${countWarning ? "" : "text-muted-foreground"}`}
                  style={countWarning ? { color: theme.warning } : undefined}
                >
                  {countLabel}
                </Text>

                {Array.from(selectedThemes).map((value) => (
                  <RemovableChip
                    key={`theme-${value}`}
                    label={value}
                    capitalize
                    onPress={() =>
                      setSelectedThemes((current) => toggle(current, value))
                    }
                  />
                ))}

                {Array.from(selectedArtists).map((value) => (
                  <RemovableChip
                    key={`artist-${value}`}
                    label={value}
                    onPress={() =>
                      setSelectedArtists((current) => toggle(current, value))
                    }
                  />
                ))}

                {narrowed ? (
                  <Pressable
                    onPress={clearFilters}
                    accessibilityRole="button"
                    hitSlop={6}
                  >
                    <Text className="text-[12px] font-medium text-muted-foreground underline">
                      Clear all
                    </Text>
                  </Pressable>
                ) : null}
              </HStack>
            )}

            {/* ── The library ──────────────────────────────────────────────── */}
            {songs.isPending ? (
              <InsetCard elevated separatorInset={SONG_SEPARATOR_INSET}>
                {Array.from({ length: 6 }, (_, index) => (
                  <SongRowSkeleton key={index} index={index} />
                ))}
              </InsetCard>
            ) : visible.length === 0 ? (
              <EmptyState
                {...emptyStateFor({ isError: songs.isError, narrowed })}
                onClear={narrowed ? clearFilters : undefined}
              />
            ) : (
              <InsetCard elevated separatorInset={SONG_SEPARATOR_INSET}>
                {visible.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    canManage={canManage}
                    onActions={() => openActions(song)}
                  />
                ))}
              </InsetCard>
            )}
          </>
        )}
      </ScrollView>

      <FilterDialog
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        themes={themes}
        artists={artists}
        selectedThemes={selectedThemes}
        selectedArtists={selectedArtists}
        onToggleTheme={(value) =>
          setSelectedThemes((current) => toggle(current, value))
        }
        onToggleArtist={(value) =>
          setSelectedArtists((current) => toggle(current, value))
        }
        onClear={() => {
          setSelectedThemes(new Set());
          setSelectedArtists(new Set());
        }}
      />

      <SortDialog
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        sort={sort}
        onSelect={setSort}
      />

      <SongFormDialog
        visible={editing !== undefined}
        song={editing ?? undefined}
        submitting={saving}
        submitError={formError}
        onSubmit={submit}
        onClose={() => {
          setEditing(undefined);
          setFormError(null);
        }}
      />

      <SongAttachmentsDialog
        visible={attachingId !== null}
        song={library.find((song) => song.id === attachingId)}
        organizationId={organizationId}
        storage={storage}
        onClose={() => setAttachingId(null)}
      />

      {organization && songLimit !== null ? (
        <PlanLimitDialog
          visible={limitOpen}
          icon={Music}
          title="Song limit reached"
          description={`${organization.name} has reached the ${planName} plan's ${songLimit}-song limit.`}
          hint="Remove a song you no longer use to free a spot."
          organizationId={organization.id}
          organizationName={organization.name}
          canSubscribe={organization.role === "OWNER"}
          onClose={() => setLimitOpen(false)}
        />
      ) : null}
    </VStack>
  );
}

/**
 * What to tell someone whose write did not land.
 *
 * The server's own message is the useful one for every refusal it makes on
 * purpose — a duplicate title, a missing field, a song still on a setlist. Only
 * a request that never arrived has nothing worth quoting.
 */
function writeFailure(error: unknown): string {
  if (error instanceof ApiError && error.status !== 500) {
    return error.message;
  }
  return "Couldn't reach the server. Try again in a moment.";
}

type ToolbarChipProps = {
  icon: AppIconName;
  label: string;
  count?: number;
  onPress: () => void;
};

function ToolbarChip({ icon, label, count, onPress }: ToolbarChipProps) {
  const theme = useTheme();
  const active = (count ?? 0) > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 rounded-xl border px-3 py-2"
      style={{
        borderColor: active ? brand.orange : theme.border,
        backgroundColor: active ? withAlpha(brand.orange, 0.1) : theme.card,
      }}
    >
      <HStack className="items-center justify-center gap-1.5">
        <AppIcon
          icon={icon}
          size={13}
          color={active ? brand.orange : theme.textMuted}
        />
        <Text
          className="text-[13px] font-medium"
          numberOfLines={1}
          style={{ color: active ? brand.orange : theme.text }}
        >
          {label}
        </Text>
        {active ? (
          <Box
            className="min-w-[17px] items-center rounded-full px-1"
            style={{ backgroundColor: brand.orange }}
          >
            <Text className="text-[11px] font-bold text-white">{count}</Text>
          </Box>
        ) : null}
      </HStack>
    </Pressable>
  );
}

/**
 * Adds a song, from the top of the page.
 *
 * Icon only: the two chips beside it carry words already, and a third label
 * would push the sort chip's name to an ellipsis on a narrow phone. The row is
 * the first thing under the search field, so it stays in reach of a library
 * that runs to hundreds of songs.
 */
function AddSongButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add song"
      className="items-center justify-center rounded-xl px-3.5 py-2"
      style={{ backgroundColor: brand.orange }}
    >
      <AppIcon icon={Plus} size={17} color="#FFFFFF" />
    </Pressable>
  );
}

type RemovableChipProps = {
  label: string;
  capitalize?: boolean;
  onPress: () => void;
};

/** An active filter, and the tap that takes it off again. */
function RemovableChip({ label, capitalize, onPress }: RemovableChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
      className="rounded-full border px-2.5 py-0.5"
      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
    >
      <HStack className="items-center gap-1">
        <Text
          className={`text-[12px] font-medium text-foreground ${
            capitalize ? "capitalize" : ""
          }`}
        >
          {label}
        </Text>
        <AppIcon icon={X} size={10} color={theme.textMuted} />
      </HStack>
    </Pressable>
  );
}

type EmptyStateProps = {
  icon: AppIconName;
  title: string;
  body: string;
};

function emptyStateFor({
  isError,
  narrowed,
}: {
  isError: boolean;
  narrowed: boolean;
}): EmptyStateProps {
  if (isError) {
    return {
      icon: CircleAlert,
      title: "Couldn't load songs",
      body: "Pull down to try again.",
    };
  }

  if (narrowed) {
    return {
      icon: SearchX,
      title: "No songs match your filters",
      body: "Try clearing filters or searching for something else.",
    };
  }

  return {
    icon: Music,
    title: "No songs yet",
    body: "Songs added to the library show up here.",
  };
}

function EmptyState({
  icon,
  title,
  body,
  onClear,
}: EmptyStateProps & { onClear?: () => void }) {
  const theme = useTheme();

  return (
    <VStack space="sm" className="flex-1 items-center justify-center">
      <AppIcon icon={icon} size={40} color={theme.textMuted} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[260px] text-center text-sm text-muted-foreground">
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
