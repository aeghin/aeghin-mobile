import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import Music from "lucide-react-native/icons/music";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Choice } from "@/components/form-fields";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { KEY_OPTIONS, TIME_SIGNATURES, formatKey } from "@/lib/config/keys";
import type { ServiceColors } from "@/lib/config/service-types";
import type { SetlistDraftSong } from "@/types/setlist";

type SetlistDraftListProps = {
  songs: SetlistDraftSong[];
  colors: ServiceColors;
  onChange: (songs: SetlistDraftSong[]) => void;
};

/**
 * The draft, as the dashboard's editor shows it: order, key, tempo and time
 * signature per song. Reordering is by arrows rather than drag — a drag
 * needs the worklets runtime nothing in this app has exercised yet.
 */
export function SetlistDraftList({ songs, colors, onChange }: SetlistDraftListProps) {
  const theme = useTheme();
  const [keyFor, setKeyFor] = useState<SetlistDraftSong | null>(null);

  const update = (id: string, patch: Partial<SetlistDraftSong>) =>
    onChange(songs.map((song) => (song.id === id ? { ...song, ...patch } : song)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (id: string) => onChange(songs.filter((song) => song.id !== id));

  if (songs.length === 0) {
    return (
      <VStack className="items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-10">
        <AppIcon icon={Music} size={26} color={theme.textMuted} />
        <Text className="text-center text-[13px] text-muted-foreground">
          No songs yet. Add from the catalog or generate with AI.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack className="gap-2">
      {songs.map((song, index) => (
        <VStack key={song.id} className="gap-2 rounded-2xl border border-border bg-card p-3">
          <HStack className="items-center gap-2.5">
            <Center className="h-6 w-6 rounded-md" style={{ backgroundColor: theme.surface }}>
              <Text className="text-[11px] font-bold text-muted-foreground">{index + 1}</Text>
            </Center>
            <VStack className="flex-1">
              <Text className="text-[14.5px] font-semibold text-foreground" numberOfLines={1}>
                {song.title}
              </Text>
              <Text className="text-[12.5px] text-muted-foreground" numberOfLines={1}>
                {song.artist}
              </Text>
            </VStack>
            <Pressable
              onPress={() => remove(song.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${song.title}`}
              hitSlop={8}
            >
              <AppIcon icon={X} size={16} color={theme.textMuted} />
            </Pressable>
          </HStack>

          <HStack className="items-center gap-2">
            <Pressable
              onPress={() => setKeyFor(song)}
              accessibilityRole="button"
              accessibilityLabel={`Key, ${formatKey(song.pitch, song.keyQuality)}`}
              className="rounded-lg border px-2.5 py-1.5"
              style={{ borderColor: withAlpha(colors.base, 0.4), backgroundColor: colors.surface }}
            >
              <Text className="text-[12px] font-semibold" style={{ color: colors.text }}>
                {formatKey(song.pitch, song.keyQuality)}
              </Text>
            </Pressable>

            <SmallInput
              value={song.bpm > 0 ? String(song.bpm) : ""}
              onChangeText={(value) =>
                update(song.id, { bpm: Number(value.replace(/[^0-9]/g, "")) || 0 })
              }
              placeholder="BPM"
              keyboardType="number-pad"
              width={58}
            />
            <SmallInput
              value={song.timeSignature}
              onChangeText={(value) => update(song.id, { timeSignature: value })}
              placeholder="4/4"
              width={52}
            />

            <HStack className="ml-auto items-center gap-1">
              <ArrowButton
                icon={ChevronUp}
                label="Move up"
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <ArrowButton
                icon={ChevronDown}
                label="Move down"
                disabled={index === songs.length - 1}
                onPress={() => move(index, 1)}
              />
            </HStack>
          </HStack>
        </VStack>
      ))}

      <Dialog
        visible={keyFor !== null}
        icon={Music}
        title="Key"
        description={keyFor ? `What ${keyFor.title} is played in.` : undefined}
        onClose={() => setKeyFor(null)}
      >
        <HStack className="flex-wrap gap-1.5">
          {KEY_OPTIONS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              selected={
                keyFor?.pitch === option.pitch && keyFor?.keyQuality === option.quality
              }
              onPress={() => {
                if (keyFor) update(keyFor.id, { pitch: option.pitch, keyQuality: option.quality });
                setKeyFor(null);
              }}
            />
          ))}
        </HStack>
        <Text className="text-[12px] text-muted-foreground">
          {`Common time signatures: ${TIME_SIGNATURES.join(", ")}`}
        </Text>
      </Dialog>
    </VStack>
  );
}

function SmallInput({
  width,
  ...props
}: React.ComponentProps<typeof TextInput> & { width: number }) {
  const theme = useTheme();

  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.textMuted}
      autoCorrect={false}
      style={{
        width,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        paddingVertical: 6,
        textAlign: "center",
        fontSize: 12,
        fontVariant: ["tabular-nums"],
        color: theme.text,
        backgroundColor: theme.surface,
      }}
    />
  );
}

function ArrowButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof ChevronUp;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-lg border"
      style={{
        width: 30,
        height: 30,
        borderColor: theme.border,
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <AppIcon icon={icon} size={16} color={theme.text} />
    </Pressable>
  );
}
