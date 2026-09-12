import Check from "lucide-react-native/icons/check";
import MicVocal from "lucide-react-native/icons/mic-vocal";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice, ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { KEY_OPTIONS, MAX_KEY_NOTE_LENGTH, formatKey } from "@/lib/config/keys";
import type {
  KeyQuality,
  LibrarySong,
  Pitch,
  SongKey,
  SongKeyInput,
} from "@/types/song";

/**
 * The journal's one form, as both the dashboard's "Add to my keys" dialog and
 * the inline editor its rows open.
 *
 * The web edits a row in place — a key dropdown and a notes box appearing
 * inside the list. A phone row has no room for either, so editing opens the
 * same dialog adding does, with the song already chosen.
 */

/** How tall the library list may get before it scrolls. The web's `max-h-64`. */
const CATALOG_MAX_HEIGHT = 260;

type SongKeyDialogProps = {
  visible: boolean;
  /** The entry being edited, or null when this is a new one. */
  entry: SongKey | null;
  /** The org library — the pool an entry can be added from. */
  catalog: LibrarySong[];
  /**
   * What is already journalled, keyed by song. Picking one of these rewrites
   * that entry rather than doubling it, so the form opens on what it holds.
   */
  journal: Map<string, SongKey>;
  submitting: boolean;
  /** Whatever the server said, when it refused the save. */
  submitError: string | null;
  onSubmit: (input: SongKeyInput) => void;
  onClose: () => void;
  /**
   * Changed by the opener on every open. It is the form's key, so each open
   * builds a fresh one instead of reopening onto the last song you picked.
   */
  openToken: number;
};

export function SongKeyDialog(props: SongKeyDialogProps) {
  return <SongKeyForm key={`${props.entry?.id ?? "add"}-${props.openToken}`} {...props} />;
}

function SongKeyForm({
  visible,
  entry,
  catalog,
  journal,
  submitting,
  submitError,
  onSubmit,
  onClose,
}: SongKeyDialogProps) {
  const theme = useTheme();

  const editing = entry !== null;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LibrarySong | null>(null);
  // Null until a song is picked: an entry's key is the library's default until
  // the singer says otherwise, and there is no default before there is a song.
  const [pitch, setPitch] = useState<Pitch | null>(entry?.pitch ?? null);
  const [quality, setQuality] = useState<KeyQuality | null>(entry?.keyQuality ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? "");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? catalog.filter(
          (song) =>
            song.title.toLowerCase().includes(needle) ||
            song.artist.toLowerCase().includes(needle),
        )
      : catalog;
    return [...matched].sort((a, b) => a.title.localeCompare(b.title));
  }, [catalog, query]);

  // Picking a song seeds the key. A song already journalled opens on what you
  // wrote down for it — this dialog is how you change that, and re-typing a
  // note to keep it would be a fine way to lose one. Anything else seeds from
  // the library default, which most of the time is already the right answer.
  const pick = (song: LibrarySong) => {
    const saved = journal.get(song.id);

    setSelected(song);
    setPitch(saved?.pitch ?? song.defaultPitch);
    setQuality(saved?.keyQuality ?? song.defaultKeyQuality);
    setNotes(saved?.notes ?? "");
  };

  const alreadySaved = selected !== null && journal.has(selected.id);
  const ready = (editing || selected !== null) && pitch !== null && quality !== null;

  const submit = () => {
    if (!pitch || !quality) return;

    if (entry) {
      onSubmit({
        songId: entry.songId,
        title: entry.title,
        artist: entry.artist,
        pitch,
        keyQuality: quality,
        notes,
      });
      return;
    }

    if (!selected) return;

    onSubmit({
      songId: selected.id,
      title: selected.title,
      artist: selected.artist,
      pitch,
      keyQuality: quality,
      notes,
    });
  };

  const title = editing ? "Your key" : "Add to my keys";

  const description = editing
    ? `The key you sing ${entry.title} in.`
    : "Pick a song from the library and set the key you sing it in.";

  const actionLabel = editing
    ? "Save"
    : alreadySaved
      ? "Update my key"
      : "Save my key";

  return (
    <Dialog
      visible={visible}
      icon={MicVocal}
      title={title}
      description={description}
      submitting={submitting}
      action={{ label: actionLabel, onPress: submit, disabled: !ready }}
      onClose={onClose}
    >
      <ErrorBanner message={submitError} />

      {editing ? (
        <VStack className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {entry.title}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {entry.artist}
          </Text>
        </VStack>
      ) : (
        <VStack className="gap-2">
          <HStack
            className="items-center gap-2 rounded-xl border px-3"
            style={{ borderColor: theme.border, backgroundColor: theme.surface }}
          >
            <AppIcon icon={Search} size={16} color={theme.textMuted} />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search the library"
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

          {filtered.length === 0 ? (
            <Text className="py-8 text-center text-[13px] text-muted-foreground">
              {catalog.length === 0
                ? "The library is empty — an admin adds songs to it."
                : "No songs match that search."}
            </Text>
          ) : (
            <ScrollView
              style={{ maxHeight: CATALOG_MAX_HEIGHT }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              {filtered.map((song, index) => (
                <VStack key={song.id}>
                  {index > 0 ? <Divider style={{ marginLeft: 12 }} /> : null}
                  <CatalogRow
                    song={song}
                    selected={selected?.id === song.id}
                    alreadySaved={journal.has(song.id)}
                    onPress={() => pick(song)}
                  />
                </VStack>
              ))}
            </ScrollView>
          )}
        </VStack>
      )}

      {editing || selected ? (
        <>
          <Field
            label="Your key"
            hint={
              pitch && quality
                ? `You sing it in ${formatKey(pitch, quality)}`
                : undefined
            }
          >
            <HStack className="flex-wrap gap-1.5">
              {KEY_OPTIONS.map((option) => (
                <Choice
                  key={option.label}
                  label={option.label}
                  selected={pitch === option.pitch && quality === option.quality}
                  onPress={() => {
                    setPitch(option.pitch);
                    setQuality(option.quality);
                  }}
                />
              ))}
            </HStack>
          </Field>

          <Field label="Notes" hint={`${notes.length}/${MAX_KEY_NOTE_LENGTH}`}>
            <FormInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Capo, where it sits, what to watch for…"
              maxLength={MAX_KEY_NOTE_LENGTH}
              multiline
              style={{ minHeight: 72 }}
            />
          </Field>
        </>
      ) : null}
    </Dialog>
  );
}

type CatalogRowProps = {
  song: LibrarySong;
  selected: boolean;
  alreadySaved: boolean;
  onPress: () => void;
};

/** One song to pick from, with the key the library files it under. */
function CatalogRow({ song, selected, alreadySaved, onPress }: CatalogRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{ backgroundColor: selected ? withAlpha(brand.orange, 0.1) : undefined }}
      className="data-[active=true]:bg-border/60"
    >
      <HStack className="items-center gap-2.5 px-3 py-2.5">
        <VStack className="min-w-0 flex-1">
          <Text className="text-[14px] font-medium text-foreground" numberOfLines={1}>
            {song.title}
          </Text>
          <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
            {alreadySaved ? `${song.artist} · already in your keys` : song.artist}
          </Text>
        </VStack>

        <Text
          className="text-[12px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatKey(song.defaultPitch, song.defaultKeyQuality)}
        </Text>

        <Box style={{ width: 16 }}>
          {selected ? <AppIcon icon={Check} size={16} color={brand.orange} /> : null}
        </Box>
      </HStack>
    </Pressable>
  );
}
