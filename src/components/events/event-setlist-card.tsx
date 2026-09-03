import AudioLines from "lucide-react-native/icons/audio-lines";
import FileText from "lucide-react-native/icons/file-text";
import Music from "lucide-react-native/icons/music";
import { Linking } from "react-native";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/app-icon";
import {
  AvatarStack,
  DetailCard,
  DetailCardHeader,
  DetailCount,
  DetailEmpty,
} from "@/components/events/event-detail-parts";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import { getServiceColors } from "@/lib/config/service-types";
import type { EventSetlistSong, ServiceType } from "@/types/event";
import type { SongAttachment } from "@/types/song";

/** Tap targets for the links. Below 28 they get hard to hit. */
const TAP = 28;
const NUMBER = 22;
/** Hairlines start past the position badge, so they line up with the titles. */
const SEPARATOR_INSET = 14 + NUMBER + 10;

type EventSetlistCardProps = {
  setlist: EventSetlistSong[];
  service: ServiceType;
  /** Managers only: a row opens the vocalist picker for that song. */
  onSongPress?: (song: EventSetlistSong) => void;
  /** Managers only: opens the editor. */
  onEdit?: () => void;
};

/**
 * What the band is playing, in order.
 *
 * The key and tempo shown are the *setlist's*, not the library's: a song is
 * often played a step down from how it is filed, and this is the sheet
 * somebody stands behind a guitar reading.
 *
 * Editing lives on the dashboard. The links and charts are the part that has
 * to work from a phone, so those are the only things here that do anything.
 */
export function EventSetlistCard({ setlist, service, onSongPress, onEdit }: EventSetlistCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);

  return (
    <DetailCard>
      <DetailCardHeader
        icon={Music}
        title="Setlist"
        tint={colors.text}
        trailing={
          <HStack className="items-center gap-3">
            {setlist.length > 0 ? (
              <DetailCount>
                {`${setlist.length} ${setlist.length === 1 ? "song" : "songs"}`}
              </DetailCount>
            ) : null}
            {onEdit ? (
              <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8}>
                <Text className="text-[13px] font-semibold" style={{ color: colors.text }}>
                  Edit
                </Text>
              </Pressable>
            ) : null}
          </HStack>
        }
      />

      {setlist.length === 0 ? (
        <DetailEmpty>No setlist added yet.</DetailEmpty>
      ) : (
        <VStack className="pb-1.5">
          {setlist.map((song, index) => (
            <VStack key={song.id}>
              {index > 0 ? (
                <Divider style={{ marginLeft: SEPARATOR_INSET }} />
              ) : null}
              <SetlistRow
                song={song}
                position={index + 1}
                onPress={onSongPress ? () => onSongPress(song) : undefined}
              />
            </VStack>
          ))}
        </VStack>
      )}
    </DetailCard>
  );
}

function SetlistRow({
  song,
  position,
  onPress,
}: {
  song: EventSetlistSong;
  position: number;
  onPress?: () => void;
}) {
  const theme = useTheme();

  const minor = song.keyQuality === "MINOR";
  const keyColor = minor ? theme.violet : theme.textMuted;

  const hasLinks =
    Boolean(song.spotifyUrl) ||
    Boolean(song.youtubeUrl) ||
    song.attachments.length > 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Assign vocalists" : undefined}
      className="data-[active=true]:bg-border/40"
    >
    <HStack className="items-start gap-2.5 px-3.5 py-2.5">
      <Center
        className="mt-0.5 shrink-0 rounded-md bg-surface"
        style={{ width: NUMBER, height: NUMBER }}
      >
        <Text
          className="text-[11px] font-bold text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {position}
        </Text>
      </Center>

      <VStack className="min-w-0 flex-1 gap-0.5">
        <HStack className="items-center gap-2">
          <Text
            className="flex-1 text-[14.5px] font-semibold leading-[19px] text-foreground"
            numberOfLines={1}
          >
            {song.title}
          </Text>

          <Box
            className="rounded-md border px-1.5 py-[1px]"
            style={{
              borderColor: withAlpha(keyColor, 0.3),
              backgroundColor: withAlpha(keyColor, 0.08),
            }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: keyColor, fontVariant: ["tabular-nums"] }}
            >
              {formatKey(song.pitch, song.keyQuality)}
            </Text>
          </Box>
        </HStack>

        <HStack className="items-center gap-2">
          <Text
            className="flex-1 text-[12.5px] text-muted-foreground"
            numberOfLines={1}
          >
            {song.artist}
          </Text>

          <Text
            className="text-[12px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {`${song.bpm} bpm · ${song.timeSignature}`}
          </Text>
        </HStack>

        {hasLinks || song.vocalists.length > 0 ? (
          <HStack className="items-center gap-1 pt-0.5">
            {song.spotifyUrl ? (
              <OpenButton
                url={song.spotifyUrl}
                label={`Open ${song.title} in Spotify`}
              >
                <SpotifyIcon size={15} color={theme.textMuted} />
              </OpenButton>
            ) : null}

            {song.youtubeUrl ? (
              <OpenButton
                url={song.youtubeUrl}
                label={`Open ${song.title} in YouTube`}
              >
                <YoutubeIcon size={16} color={theme.textMuted} />
              </OpenButton>
            ) : null}

            {song.attachments.map((attachment) => (
              <AttachmentButton key={attachment.id} attachment={attachment} />
            ))}

            <Box className="flex-1" />

            <AvatarStack people={song.vocalists} size={22} max={3} />
          </HStack>
        ) : null}
      </VStack>
    </HStack>
    </Pressable>
  );
}

/** A chart or a track, opened in whatever app the device uses for its type. */
function AttachmentButton({ attachment }: { attachment: SongAttachment }) {
  const theme = useTheme();
  const isPdf = attachment.type === "application/pdf";

  return (
    <OpenButton url={attachment.url} label={`Open ${attachment.name}`}>
      <AppIcon
        icon={isPdf ? FileText : AudioLines}
        size={15}
        color={theme.textMuted}
      />
    </OpenButton>
  );
}

/**
 * Hands a URL to the system.
 *
 * Nothing is rendered in-app: a Spotify link belongs to Spotify, and a PDF
 * chart to whatever the player already reads charts in.
 */
function OpenButton({
  url,
  label,
  children,
}: {
  url: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      className="items-center justify-center rounded-md data-[active=true]:bg-border/60"
      style={{ width: TAP, height: TAP }}
    >
      {children}
    </Pressable>
  );
}
