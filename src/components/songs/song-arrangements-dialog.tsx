import Layers from "lucide-react-native/icons/layers";
import Pencil from "lucide-react-native/icons/pencil";
import Trash2 from "lucide-react-native/icons/trash-2";
import { useState } from "react";
import { Alert, Switch } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { OpenButton } from "@/components/open-button";
import { SongFiles } from "@/components/songs/song-files";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useAddArrangement,
  useDeleteArrangement,
  useUpdateArrangement,
} from "@/hooks/use-songs";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { VersionLinks } from "@/lib/songs/arrangements";
import { formatStorage } from "@/lib/storage";
import type { LibrarySong, SongArrangement, SongArrangementInput } from "@/types/song";

/**
 * A song's other versions, like the verse the band recorded or its own intro.
 * Each one is picked per event on a setlist, and the team then sees its files
 * there instead of the Original's.
 *
 * The web puts these in its song modal. Here they're their own dialog, like
 * attachments: they save as they're made, which the song form's Save doesn't.
 * Adding or editing one swaps the list for its form in the same card.
 */

/** The list, or the form for a new arrangement or an existing one. */
type Editing = "new" | SongArrangement | null;

const EMPTY: SongArrangementInput = {
  name: "",
  useSongLinks: true,
  spotifyUrl: "",
  youtubeUrl: "",
};

type FieldErrors = Partial<Record<"name" | "spotifyUrl" | "youtubeUrl", string>>;

/** A link the server's `z.url()` will accept. */
const isUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

/** The web schema's rules. The input's maxLength keeps the name to 60. */
function validate(draft: SongArrangementInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();

  if (!name) errors.name = "Arrangement name required";
  else if (name.toLowerCase() === "original") {
    errors.name = "Original is the song itself. Pick another name";
  }

  if (!draft.useSongLinks) {
    if (draft.spotifyUrl.trim() && !isUrl(draft.spotifyUrl)) {
      errors.spotifyUrl = "Enter a valid URL";
    }
    if (draft.youtubeUrl.trim() && !isUrl(draft.youtubeUrl)) {
      errors.youtubeUrl = "Enter a valid URL";
    }
  }

  return errors;
}

function draftFrom(arrangement: SongArrangement): SongArrangementInput {
  return {
    name: arrangement.name,
    useSongLinks: arrangement.useSongLinks,
    spotifyUrl: arrangement.spotifyUrl ?? "",
    youtubeUrl: arrangement.youtubeUrl ?? "",
  };
}

/** What goes up: trimmed, and its own links only while it doesn't use the song's. */
function cleaned(draft: SongArrangementInput): SongArrangementInput {
  return {
    name: draft.name.trim(),
    useSongLinks: draft.useSongLinks,
    spotifyUrl: draft.useSongLinks ? "" : draft.spotifyUrl.trim(),
    youtubeUrl: draft.useSongLinks ? "" : draft.youtubeUrl.trim(),
  };
}

const sameAs = (a: SongArrangementInput, b: SongArrangementInput) =>
  a.name === b.name &&
  a.useSongLinks === b.useSongLinks &&
  a.spotifyUrl === b.spotifyUrl &&
  a.youtubeUrl === b.youtubeUrl;

type SongArrangementsDialogProps = {
  visible: boolean;
  song: LibrarySong | undefined;
  organizationId: string;
  /** The library's charts and audio against the plan's storage. Null until the plan loads. */
  storage: { used: number; limit: number } | null;
  onClose: () => void;
};

/** Mounted fresh for each visit, so it opens on the list, or on the form when there's no list yet. */
export function SongArrangementsDialog({
  visible,
  song,
  organizationId,
  storage,
  onClose,
}: SongArrangementsDialogProps) {
  const theme = useTheme();

  const add = useAddArrangement(organizationId);
  const update = useUpdateArrangement(organizationId);

  const arrangements = song?.arrangements ?? [];

  const [editing, setEditing] = useState<Editing>(() =>
    arrangements.length === 0 ? "new" : null,
  );
  const [draft, setDraft] = useState<SongArrangementInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const full = storage !== null && storage.used >= storage.limit;
  const submitting = add.isPending || update.isPending;

  const openForm = (target: "new" | SongArrangement) => {
    setEditing(target);
    setDraft(target === "new" ? EMPTY : draftFrom(target));
    setErrors({});
    setFormError(null);
  };

  // With none saved there's no list to go back to.
  const back = () => (arrangements.length === 0 ? onClose() : setEditing(null));

  const set = <K extends keyof SongArrangementInput>(key: K, value: SongArrangementInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // The boxes hide while it's on, so nothing left in them may hold up saving.
  const toggleSongLinks = (on: boolean) => {
    setDraft((current) =>
      on
        ? { ...current, useSongLinks: true, spotifyUrl: "", youtubeUrl: "" }
        : { ...current, useSongLinks: false },
    );
    setErrors((current) => ({ ...current, spotifyUrl: undefined, youtubeUrl: undefined }));
  };

  const changed =
    editing !== null && editing !== "new" && !sameAs(cleaned(draft), cleaned(draftFrom(editing)));

  const ready = draft.name.trim().length > 0 && (editing === "new" || changed);

  const submit = () => {
    if (!song || editing === null) return;

    const found = validate(draft);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setFormError(null);

    const done = {
      onSuccess: () => setEditing(null),
      onError: (failure: unknown) => setFormError(failureMessage(failure)),
    };

    if (editing === "new") {
      add.mutate({ songId: song.id, arrangement: cleaned(draft) }, done);
    } else {
      update.mutate(
        { songId: song.id, arrangementId: editing.id, arrangement: cleaned(draft) },
        done,
      );
    }
  };

  if (editing !== null) {
    const songLinks: VersionLinks = {
      spotifyUrl: song?.spotifyUrl ?? null,
      youtubeUrl: song?.youtubeUrl ?? null,
    };

    return (
      <Dialog
        visible={visible}
        icon={Layers}
        title={editing === "new" ? "New arrangement" : "Edit arrangement"}
        description={
          editing === "new"
            ? `Another version of ${song?.title ?? "the song"}, picked when it goes on a setlist. Add its charts and tracks once it's saved.`
            : "Changes reach every setlist that plays it."
        }
        action={{ label: editing === "new" ? "Add" : "Save", onPress: submit, disabled: !ready }}
        submitting={submitting}
        onClose={back}
        compactWhileTyping
      >
        <ErrorBanner message={formError} />

        <Field label="Name" error={errors.name}>
          <FormInput
            value={draft.name}
            onChangeText={(value) => set("name", value)}
            placeholder="Verse sample"
            maxLength={60}
            autoCorrect={false}
            returnKeyType="done"
          />
        </Field>

        <HStack className="items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5">
          <Text className="flex-1 text-[15px] text-foreground">{"Use the song's links"}</Text>
          {draft.useSongLinks ? (
            <HStack className="items-center gap-1.5">
              {songLinks.spotifyUrl ? <SpotifyIcon size={15} color={theme.textMuted} /> : null}
              {songLinks.youtubeUrl ? <YoutubeIcon size={16} color={theme.textMuted} /> : null}
            </HStack>
          ) : null}
          <Switch
            value={draft.useSongLinks}
            onValueChange={toggleSongLinks}
            disabled={submitting}
            trackColor={{ true: brand.orange }}
            accessibilityLabel="Use the song's links"
          />
        </HStack>

        {draft.useSongLinks ? null : (
          <>
            <Field label="Spotify link" error={errors.spotifyUrl}>
              <FormInput
                value={draft.spotifyUrl}
                onChangeText={(value) => set("spotifyUrl", value)}
                placeholder="https://open.spotify.com/track/…"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>

            <Field
              label="YouTube link"
              error={errors.youtubeUrl}
              hint="Leave both empty to show only this arrangement's files."
            >
              <FormInput
                value={draft.youtubeUrl}
                onChangeText={(value) => set("youtubeUrl", value)}
                placeholder="https://youtube.com/watch?v=…"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          </>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog
      visible={visible}
      icon={Layers}
      title="Arrangements"
      description={
        song
          ? `Other versions of ${song.title} with their own files, picked when the song goes on a setlist.`
          : undefined
      }
      // In the footer beside Done, apart from the cards, so the orange "Add
      // chart or track" rows inside them only ever mean files.
      action={{ label: "Add arrangement", onPress: () => openForm("new"), disabled: !song }}
      cancelLabel="Done"
      onClose={onClose}
      // On in both modes, so the dialog keeps listening and a form opened
      // after the keyboard went away doesn't start out squashed.
      compactWhileTyping
    >
      {song && arrangements.length > 0 ? (
        arrangements.map((arrangement) => (
          <ArrangementCard
            key={arrangement.id}
            organizationId={organizationId}
            songId={song.id}
            arrangement={arrangement}
            storage={storage}
            onEdit={() => openForm(arrangement)}
          />
        ))
      ) : (
        // Only after the last one is deleted: a song with none opens on the form.
        <Text className="py-4 text-center text-[13px] text-muted-foreground">
          No arrangements yet.
        </Text>
      )}

      {full && storage ? (
        <Text className="text-[12px] font-medium" style={{ color: theme.warning }}>
          {`${formatStorage(storage.used)} of ${formatStorage(storage.limit)} used. Remove files you no longer use to make room.`}
        </Text>
      ) : null}
    </Dialog>
  );
}

type ArrangementCardProps = {
  organizationId: string;
  songId: string;
  arrangement: SongArrangement;
  storage: { used: number; limit: number } | null;
  onEdit: () => void;
};

/** One arrangement: its name and links, with its files under them. */
function ArrangementCard({
  organizationId,
  songId,
  arrangement,
  storage,
  onEdit,
}: ArrangementCardProps) {
  const theme = useTheme();
  const remove = useDeleteArrangement(organizationId);

  // Shown under this card rather than atop the dialog, which may be scrolled away.
  const [error, setError] = useState<string | null>(null);

  const files = arrangement.attachments.length;

  const confirmDelete = () => {
    Alert.alert(
      "Delete arrangement",
      files === 0
        ? `${arrangement.name} will be deleted for everyone.`
        : `${arrangement.name} and its ${files === 1 ? "file" : `${files} files`} will be deleted for everyone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setError(null);
            remove.mutate(
              { songId, arrangementId: arrangement.id },
              // The refusal worth reading is the server's: it names the
              // upcoming events that still play this one.
              { onError: (failure) => setError(failureMessage(failure)) },
            );
          },
        },
      ],
    );
  };

  return (
    <VStack className="gap-2">
      <VStack className="overflow-hidden rounded-2xl border border-border bg-card">
        <HStack className="items-center gap-1 py-2.5 pl-3.5 pr-2">
          <VStack className="flex-1 gap-0.5">
            <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
              {arrangement.name}
            </Text>
            <LinkSummary arrangement={arrangement} />
          </VStack>

          <IconButton
            icon={Pencil}
            label={`Edit ${arrangement.name}`}
            onPress={onEdit}
            disabled={remove.isPending}
          />

          {remove.isPending ? (
            <HStack className="items-center justify-center" style={{ width: ICON_BUTTON }}>
              <Spinner size="small" color={theme.textMuted} />
            </HStack>
          ) : (
            <IconButton
              icon={Trash2}
              label={`Delete ${arrangement.name}`}
              onPress={confirmDelete}
            />
          )}
        </HStack>

        <Divider />

        <SongFiles
          organizationId={organizationId}
          songId={songId}
          arrangementId={arrangement.id}
          attachments={arrangement.attachments}
          storage={storage}
          onError={setError}
        />
      </VStack>

      <ErrorBanner message={error} />
    </VStack>
  );
}

/** Which links a setlist shows for it, in the web's words. */
function LinkSummary({ arrangement }: { arrangement: SongArrangement }) {
  const theme = useTheme();

  if (arrangement.useSongLinks || (!arrangement.spotifyUrl && !arrangement.youtubeUrl)) {
    return (
      <Text className="text-[12px] text-muted-foreground">
        {arrangement.useSongLinks ? "Uses the song's links" : "No links"}
      </Text>
    );
  }

  // Pulled out by the buttons' slack, so the glyphs line up under the name
  // and the line stays the height of a line of text.
  return (
    <HStack className="items-center" style={{ marginLeft: -6, marginVertical: -4 }}>
      {arrangement.spotifyUrl ? (
        <OpenButton url={arrangement.spotifyUrl} label={`Open ${arrangement.name} in Spotify`}>
          <SpotifyIcon size={15} color={theme.textMuted} />
        </OpenButton>
      ) : null}

      {arrangement.youtubeUrl ? (
        <OpenButton url={arrangement.youtubeUrl} label={`Open ${arrangement.name} in YouTube`}>
          <YoutubeIcon size={16} color={theme.textMuted} />
        </OpenButton>
      ) : null}
    </HStack>
  );
}

const ICON_BUTTON = 32;

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
      style={{ width: ICON_BUTTON, height: ICON_BUTTON, opacity: disabled ? 0.4 : 1 }}
    >
      <AppIcon icon={icon} size={16} color={theme.textMuted} />
    </Pressable>
  );
}
