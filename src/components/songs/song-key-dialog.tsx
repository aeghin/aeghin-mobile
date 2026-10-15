import Check from "lucide-react-native/icons/check";
import MicVocal from "lucide-react-native/icons/mic-vocal";
import Search from "lucide-react-native/icons/search";
import Trash2 from "lucide-react-native/icons/trash-2";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { Alert, ScrollView, TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { KeyPicker } from "@/components/songs/key-picker";
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useDeleteSongKey, useSaveSongKey, useUpdateSongKey } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { MAX_KEY_NOTE_LENGTH, formatKey } from "@/lib/config/keys";
import { failureMessage } from "@/lib/failure";
import type {
  KeyQuality,
  LibrarySong,
  Pitch,
  SongKey,
  SongKeyInput,
} from "@/types/song";

/**
 * The journal's one form, as both the dashboard's "Add to my keys" dialog and
 * the editor its rows open.
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
  /** Editing only: takes the entry off your keys, after asking. */
  onRemove?: () => void;
  onClose: () => void;
  /**
   * Changed by the opener on every open. It is the form's key, so each open
   * builds a fresh one instead of reopening onto the last song you picked.
   */
  openToken: number;
};

export function SongKeyDialog(props: SongKeyDialogProps) {
  return (
    <SongKeyForm
      key={`${props.entry?.id ?? "add"}-${props.openToken}`}
      {...props}
    />
  );
}

function SongKeyForm({
  visible,
  entry,
  catalog,
  journal,
  submitting,
  submitError,
  onSubmit,
  onRemove,
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
          (option) =>
            option.title.toLowerCase().includes(needle) ||
            option.artist.toLowerCase().includes(needle),
        )
      : catalog;
    return [...matched].sort((a, b) => a.title.localeCompare(b.title));
  }, [catalog, query]);

  // Picking a song seeds the key. A song already journalled opens on what you
  // wrote down for it — this dialog is how you change that, and re-typing a
  // note to keep it would be a fine way to lose one. Anything else seeds from
  // the library default, which most of the time is already the right answer.
  const pick = (option: LibrarySong) => {
    const saved = journal.get(option.id);

    setSelected(option);
    setPitch(saved?.pitch ?? option.defaultPitch);
    setQuality(saved?.keyQuality ?? option.defaultKeyQuality);
    setNotes(saved?.notes ?? "");
  };

  // The song is fixed when editing; only Add searches.
  const fixed = editing ? { title: entry.title, artist: entry.artist } : null;

  const library: { pitch: Pitch; quality: KeyQuality } | null = editing
    ? entry.libraryPitch && entry.libraryKeyQuality
      ? { pitch: entry.libraryPitch, quality: entry.libraryKeyQuality }
      : null
    : selected
      ? { pitch: selected.defaultPitch, quality: selected.defaultKeyQuality }
      : null;

  // Plain words, and only when yours differs: no step counts to decode.
  const keyHint = (() => {
    if (!pitch || !quality || !library) return undefined;
    const theirs = formatKey(library.pitch, library.quality);
    return theirs === formatKey(pitch, quality) ? undefined : `The library has it in ${theirs}`;
  })();

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

      {fixed ? (
        <VStack className="rounded-xl border border-border bg-surface px-3 py-2.5">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {fixed.title}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {fixed.artist}
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
              {filtered.map((option, index) => (
                <VStack key={option.id}>
                  {index > 0 ? <Divider style={{ marginLeft: 12 }} /> : null}
                  <CatalogRow
                    song={option}
                    selected={selected?.id === option.id}
                    alreadySaved={journal.has(option.id)}
                    onPress={() => pick(option)}
                  />
                </VStack>
              ))}
            </ScrollView>
          )}
        </VStack>
      )}

      {pitch && quality && (editing || selected) ? (
        <>
          <Field label="Your key" hint={keyHint}>
            <KeyPicker
              pitch={pitch}
              quality={quality}
              onChange={(nextPitch, nextQuality) => {
                setPitch(nextPitch);
                setQuality(nextQuality);
              }}
            />
          </Field>

          <Field label="Comments" hint={`${notes.length}/${MAX_KEY_NOTE_LENGTH}`}>
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

      {editing && onRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={submitting}
          accessibilityRole="button"
          className="self-center rounded-lg px-3 py-2 data-[active=true]:opacity-60"
        >
          <HStack className="items-center gap-1.5">
            <AppIcon icon={Trash2} size={14} color={theme.destructive} />
            <Text className="text-[14px] font-semibold" style={{ color: theme.destructive }}>
              Remove from my keys
            </Text>
          </HStack>
        </Pressable>
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

/** Stable identity for a journal that hasn't loaded. */
const NO_KEYS: SongKey[] = [];

type EditorTarget = { entry: SongKey | null; token: number };

/** The dialog with its saving wired up, for My keys' Add button and its rows. */
export function useSongKeyEditor(
  organizationId: string,
  catalog: LibrarySong[],
  entries: SongKey[] = NO_KEYS,
) {
  const save = useSaveSongKey(organizationId);
  const update = useUpdateSongKey(organizationId);
  const remove = useDeleteSongKey(organizationId);

  // What the dialog shows and whether it is showing are separate: leaving the
  // contents in place through the closing fade is what stops the card turning
  // back into an empty picker on its way out.
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const journal = useMemo(
    () =>
      new Map(
        entries.flatMap((entry) =>
          entry.songId === null ? [] : [[entry.songId, entry] as const],
        ),
      ),
    [entries],
  );

  const open = (entry: SongKey | null) => {
    setFormError(null);
    setTarget((current) => ({ entry, token: (current?.token ?? 0) + 1 }));
    setVisible(true);
  };

  const close = () => {
    setVisible(false);
    setFormError(null);
  };

  const submit = (input: SongKeyInput) => {
    setFormError(null);

    const onError = (error: unknown) => setFormError(failureMessage(error));
    const onSuccess = () => close();

    const editing = target?.entry;

    if (editing) {
      update.mutate({ entryId: editing.id, entry: input }, { onError, onSuccess });
    } else {
      save.mutate(input, { onError, onSuccess });
    }
  };

  // The web deletes on one click. A phone has no undo, so it asks first — the
  // same confirm blockouts and the library use.
  const confirmRemove = (entry: SongKey) =>
    Alert.alert(
      "Remove from my keys",
      `${entry.title} will come off your keys. The song stays in the library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            close();
            remove.mutate(entry.id, {
              onError: (error) => Alert.alert("Couldn't remove", failureMessage(error)),
            });
          },
        },
      ],
    );

  const editingEntry = target?.entry ?? null;

  const dialog = (
    <SongKeyDialog
      visible={visible}
      entry={editingEntry}
      openToken={target?.token ?? 0}
      catalog={catalog}
      journal={journal}
      submitting={save.isPending || update.isPending}
      submitError={formError}
      onSubmit={submit}
      onRemove={editingEntry ? () => confirmRemove(editingEntry) : undefined}
      onClose={close}
    />
  );

  return {
    /** A new entry, picked from the library. */
    openAdd: () => open(null),
    openEdit: (entry: SongKey) => open(entry),
    dialog,
  };
}
