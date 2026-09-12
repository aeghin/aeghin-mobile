import CircleAlert from "lucide-react-native/icons/circle-alert";
import MicVocal from "lucide-react-native/icons/mic-vocal";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import X from "lucide-react-native/icons/x";
import { useMemo, useState } from "react";
import { Alert, TextInput } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { InsetCard } from "@/components/inset-list";
import { SongKeyDialog } from "@/components/songs/song-key-dialog";
import {
  SONG_KEY_SEPARATOR_INSET,
  SongKeyRow,
  SongKeyRowSkeleton,
} from "@/components/songs/song-key-row";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import {
  useDeleteSongKey,
  useSaveSongKey,
  useUpdateSongKey,
} from "@/hooks/use-song-keys";
import { failureMessage } from "@/lib/failure";
import type { LibrarySong, SongKey, SongKeyInput } from "@/types/song";

/**
 * The dashboard's My Keys tab: the key this person sings each song in.
 *
 * Private to whoever is signed in — nobody else in the organization can read
 * it, and the server scopes every row to the caller rather than taking a user
 * id from here.
 */

/** How many entries before the list offers a search field. The web's threshold. */
const SEARCH_THRESHOLD = 6;

type SongKeysPaneProps = {
  organizationId: string;
  entries: SongKey[];
  isPending: boolean;
  isError: boolean;
  /** The library, for the picker. Owned by the screen, which already loads it. */
  catalog: LibrarySong[];
};

/** What the dialog is showing, and which open it is. */
type OpenDialog = {
  /** The entry being edited, or null when adding one. */
  entry: SongKey | null;
  token: number;
};

export function SongKeysPane({
  organizationId,
  entries,
  isPending,
  isError,
  catalog,
}: SongKeysPaneProps) {
  const theme = useTheme();

  const save = useSaveSongKey(organizationId);
  const update = useUpdateSongKey(organizationId);
  const remove = useDeleteSongKey(organizationId);

  const [query, setQuery] = useState("");

  // What the dialog shows and whether it is showing are separate: leaving the
  // contents in place through the closing fade is what stops the card turning
  // back into an empty picker on its way out.
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openDialog = (entry: SongKey | null) => {
    setFormError(null);
    setDialog((current) => ({ entry, token: (current?.token ?? 0) + 1 }));
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setFormError(null);
  };

  // Songs already journalled stay pickable — re-picking one is how you change
  // its key from the dialog — but it labels them as such, and the form opens
  // on the entry rather than on a blank one.
  const journal = useMemo(
    () =>
      new Map(
        entries.flatMap((entry) =>
          entry.songId === null ? [] : [[entry.songId, entry] as const],
        ),
      ),
    [entries],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(needle) ||
        entry.artist.toLowerCase().includes(needle),
    );
  }, [entries, query]);

  const saving = save.isPending || update.isPending;

  const submit = (input: SongKeyInput) => {
    setFormError(null);

    const onError = (error: unknown) => setFormError(failureMessage(error));
    const onSuccess = () => closeDialog();

    const editing = dialog?.entry;

    if (editing) {
      update.mutate({ entryId: editing.id, entry: input }, { onError, onSuccess });
    } else {
      save.mutate(input, { onError, onSuccess });
    }
  };

  // The web deletes on one click. A phone row is smaller than a mouse cursor
  // and there is no undo, so it asks first — the same confirm blockouts and
  // the library use.
  const confirmDelete = (entry: SongKey) =>
    Alert.alert(
      "Remove from my keys",
      `${entry.title} will come off your keys. The song stays in the library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            remove.mutate(entry.id, {
              onError: (error) =>
                Alert.alert("Couldn't remove", failureMessage(error)),
            }),
        },
      ],
    );

  return (
    <VStack className="gap-3">
      <Text className="ml-1 text-[13px] text-muted-foreground">
        The key you sing each song in — yours only, nobody else sees it.
      </Text>

      {isError ? null : (
        <Button
          variant="outline"
          onPress={() => openDialog(null)}
          className="h-auto rounded-2xl border-dashed border-border py-3.5"
        >
          <AppIcon icon={Plus} size={20} color={brand.orange} />
          <ButtonText className="text-base font-semibold text-brand">
            Add a song to my keys
          </ButtonText>
        </Button>
      )}

      {entries.length > SEARCH_THRESHOLD ? (
        <HStack
          className="items-center gap-2 rounded-xl border px-3"
          style={{ borderColor: theme.border, backgroundColor: theme.card }}
        >
          <AppIcon icon={Search} size={16} color={theme.textMuted} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your keys"
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
      ) : null}

      {isPending ? (
        <InsetCard elevated separatorInset={SONG_KEY_SEPARATOR_INSET}>
          {Array.from({ length: 4 }, (_, index) => (
            <SongKeyRowSkeleton key={index} index={index} />
          ))}
        </InsetCard>
      ) : isError ? (
        <PaneMessage
          icon={CircleAlert}
          title="Couldn't load your keys"
          body="Pull down to try again."
          tone="error"
        />
      ) : entries.length === 0 ? (
        <PaneMessage
          icon={MicVocal}
          title="No keys saved yet"
          body="Add a song here, or save one straight from an event's setlist."
        />
      ) : visible.length === 0 ? (
        <PaneMessage
          icon={SearchX}
          title="No matches"
          body={`Nothing in your keys is named for “${query.trim()}”.`}
        />
      ) : (
        <InsetCard elevated separatorInset={SONG_KEY_SEPARATOR_INSET}>
          {visible.map((entry) => (
            <SongKeyRow
              key={entry.id}
              entry={entry}
              onEdit={() => openDialog(entry)}
              onDelete={() => confirmDelete(entry)}
            />
          ))}
        </InsetCard>
      )}

      <SongKeyDialog
        visible={showDialog}
        entry={dialog?.entry ?? null}
        openToken={dialog?.token ?? 0}
        catalog={catalog}
        journal={journal}
        submitting={saving}
        submitError={formError}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </VStack>
  );
}

type PaneMessageProps = {
  icon: AppIconName;
  title: string;
  body: string;
  tone?: "default" | "error";
};

/** The pane's empty, filtered-empty and failed states, in one shape. */
function PaneMessage({ icon, title, body, tone = "default" }: PaneMessageProps) {
  const theme = useTheme();
  const tint = tone === "error" ? theme.destructive : theme.textMuted;

  return (
    <VStack space="sm" className="items-center px-6 py-10">
      <AppIcon icon={icon} size={34} color={tint} />
      <Text className="text-[17px] font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[280px] text-center text-sm text-muted-foreground">
        {body}
      </Text>
    </VStack>
  );
}
