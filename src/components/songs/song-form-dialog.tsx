import Music from "lucide-react-native/icons/music";
import X from "lucide-react-native/icons/x";
import { useState } from "react";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice, ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand, withAlpha } from "@/constants/branding";
import {
  COMMON_THEMES,
  KEY_OPTIONS,
  TIME_SIGNATURES,
  formatKey,
} from "@/lib/config/keys";
import type { KeyQuality, LibrarySong, Pitch, SongInput } from "@/types/song";

/**
 * The song form, as both the "add" and the "edit" dialog.
 *
 * Every field the web form carries, validated by the same rules before it goes
 * up — a song needs a title, an artist, a tempo, a key, at least one theme and
 * at least one link. The server re-checks all of it; doing it here as well is
 * what keeps someone from filling six fields and losing them to a round trip.
 */

const EMPTY: SongInput = {
  title: "",
  artist: "",
  bpm: 0,
  timeSignature: "4/4",
  defaultPitch: "C",
  defaultKeyQuality: "MAJOR",
  spotifyUrl: "",
  youtubeUrl: "",
  themes: [],
};

type FieldErrors = Partial<Record<keyof SongInput, string>>;

/** A link the server's `z.url()` will accept. */
const isUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

function validate(draft: SongInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!draft.title.trim()) errors.title = "Song title required";
  if (!draft.artist.trim()) errors.artist = "Artist name required";
  if (!Number.isInteger(draft.bpm) || draft.bpm < 1) errors.bpm = "BPM is required";
  if (!draft.timeSignature) errors.timeSignature = "Time signature required";
  if (draft.themes.length === 0) errors.themes = "Pick at least one theme";

  if (draft.spotifyUrl && !isUrl(draft.spotifyUrl)) {
    errors.spotifyUrl = "Enter a valid URL";
  }

  if (draft.youtubeUrl && !isUrl(draft.youtubeUrl)) {
    errors.youtubeUrl = "Enter a valid URL";
  }

  // The web schema hangs this one off `spotifyUrl` too: either link satisfies
  // it, so it belongs to the pair rather than to one field.
  if (!errors.spotifyUrl && !draft.spotifyUrl && !draft.youtubeUrl) {
    errors.spotifyUrl = "Add a Spotify or YouTube link";
  }

  return errors;
}

/** Themes are stored trimmed and lowercased, and never twice. */
function addTheme(themes: string[], raw: string): string[] {
  const theme = raw.trim().toLowerCase();

  if (!theme || themes.includes(theme)) return themes;

  return [...themes, theme];
}

type SongFormDialogProps = {
  visible: boolean;
  /** The song being edited, or undefined when this is a new one. */
  song?: LibrarySong;
  submitting: boolean;
  /** Whatever the server said, when it refused the save. */
  submitError: string | null;
  onSubmit: (song: SongInput) => void;
  onClose: () => void;
};

/** The song being edited, as fields. A new song starts from {@link EMPTY}. */
function draftFrom(song: LibrarySong | undefined): SongInput {
  if (!song) return EMPTY;

  return {
    title: song.title,
    artist: song.artist,
    bpm: song.bpm,
    timeSignature: song.timeSignature,
    defaultPitch: song.defaultPitch,
    defaultKeyQuality: song.defaultKeyQuality,
    spotifyUrl: song.spotifyUrl ?? "",
    youtubeUrl: song.youtubeUrl ?? "",
    themes: song.themes,
  };
}

/**
 * Keyed on the song, so the form below takes its values from props once, on
 * mount, with no effect resetting them: opening a different song builds a new
 * form rather than reusing the last one's state.
 */
export function SongFormDialog(props: SongFormDialogProps) {
  return <SongForm key={props.song?.id ?? "new"} {...props} />;
}

function SongForm({
  visible,
  song,
  submitting,
  submitError,
  onSubmit,
  onClose,
}: SongFormDialogProps) {
  const [draft, setDraft] = useState<SongInput>(() => draftFrom(song));
  const [themeInput, setThemeInput] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof SongInput>(key: K, value: SongInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const commitTheme = () => {
    const next = addTheme(draft.themes, themeInput);

    if (next !== draft.themes) set("themes", next);

    setThemeInput("");
  };

  const submit = () => {
    // The theme someone typed but never committed still counts — losing it to
    // a stale input box is the easiest way to fail the "one theme" rule while
    // looking at a theme.
    const themes = addTheme(draft.themes, themeInput);
    const candidate = { ...draft, themes };

    const found = validate(candidate);

    if (Object.keys(found).length > 0) {
      setDraft(candidate);
      setThemeInput("");
      setErrors(found);
      return;
    }

    onSubmit(candidate);
  };

  const keySelected = (pitch: Pitch, quality: KeyQuality) =>
    draft.defaultPitch === pitch && draft.defaultKeyQuality === quality;

  return (
    <Dialog
      visible={visible}
      icon={Music}
      title={song ? "Edit song" : "New song"}
      description={
        song ? "Changes apply everywhere this song is used." : "Add a song to the library."
      }
      action={{ label: "Save", onPress: submit }}
      submitting={submitting}
      onClose={onClose}
    >
      <ErrorBanner message={submitError} />

      <Field label="Title" error={errors.title}>
        <FormInput
          value={draft.title}
          onChangeText={(value) => set("title", value)}
          placeholder="Goodness of God"
          autoCapitalize="words"
        />
      </Field>

      <Field label="Artist" error={errors.artist}>
        <FormInput
          value={draft.artist}
          onChangeText={(value) => set("artist", value)}
          placeholder="Bethel Music"
          autoCapitalize="words"
        />
      </Field>

      <Field label="BPM" error={errors.bpm}>
        <FormInput
          value={draft.bpm > 0 ? String(draft.bpm) : ""}
          onChangeText={(value) => {
            const digits = value.replace(/[^0-9]/g, "");
            set("bpm", digits ? Number(digits) : 0);
          }}
          placeholder="120"
          keyboardType="number-pad"
        />
      </Field>

      <Field label="Time signature" error={errors.timeSignature}>
        <HStack className="flex-wrap gap-1.5">
          {TIME_SIGNATURES.map((signature) => (
            <Choice
              key={signature}
              label={signature}
              selected={draft.timeSignature === signature}
              onPress={() => set("timeSignature", signature)}
            />
          ))}
        </HStack>
      </Field>

      <Field
        label="Default key"
        hint={`Currently ${formatKey(draft.defaultPitch, draft.defaultKeyQuality)}`}
      >
        <HStack className="flex-wrap gap-1.5">
          {KEY_OPTIONS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              selected={keySelected(option.pitch, option.quality)}
              onPress={() => {
                set("defaultPitch", option.pitch);
                set("defaultKeyQuality", option.quality);
              }}
            />
          ))}
        </HStack>
      </Field>

      <Field label="Spotify link" error={errors.spotifyUrl}>
        <FormInput
          value={draft.spotifyUrl}
          onChangeText={(value) => set("spotifyUrl", value)}
          placeholder="https://open.spotify.com/track/…"
          keyboardType="url"
          autoCapitalize="none"
        />
      </Field>

      <Field label="YouTube link" error={errors.youtubeUrl}>
        <FormInput
          value={draft.youtubeUrl}
          onChangeText={(value) => set("youtubeUrl", value)}
          placeholder="https://youtube.com/watch?v=…"
          keyboardType="url"
          autoCapitalize="none"
        />
      </Field>

      <Field label="Themes" error={errors.themes}>
        {draft.themes.length > 0 ? (
          <HStack className="mb-2 flex-wrap gap-1.5">
            {draft.themes.map((value) => (
              <Pressable
                key={value}
                onPress={() =>
                  set("themes", draft.themes.filter((item) => item !== value))
                }
                accessibilityRole="button"
                accessibilityLabel={`Remove ${value}`}
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: withAlpha(brand.orange, 0.14) }}
              >
                <HStack className="items-center gap-1">
                  <Text
                    className="text-[12px] font-semibold capitalize"
                    style={{ color: brand.orange }}
                  >
                    {value}
                  </Text>
                  <AppIcon icon={X} size={10} color={brand.orange} />
                </HStack>
              </Pressable>
            ))}
          </HStack>
        ) : null}

        <FormInput
          value={themeInput}
          onChangeText={setThemeInput}
          onSubmitEditing={commitTheme}
          onBlur={commitTheme}
          placeholder="Add a theme and press return"
          autoCapitalize="none"
          returnKeyType="done"
        />

        <HStack className="mt-2 flex-wrap gap-1.5">
          {COMMON_THEMES.filter(
            (value) => !draft.themes.includes(value.toLowerCase()),
          ).map((value) => (
            <Choice
              key={value}
              label={value}
              selected={false}
              onPress={() => set("themes", addTheme(draft.themes, value))}
            />
          ))}
        </HStack>
      </Field>
    </Dialog>
  );
}
