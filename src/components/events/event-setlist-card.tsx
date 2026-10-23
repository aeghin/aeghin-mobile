import AudioLines from "lucide-react-native/icons/audio-lines";
import FileText from "lucide-react-native/icons/file-text";
import Info from "lucide-react-native/icons/info";
import Music from "lucide-react-native/icons/music";
import Pencil from "lucide-react-native/icons/pencil";

import { AppIcon } from "@/components/app-icon";
import { ArrangementButton } from "@/components/events/arrangement-button";
import {
  AvatarStack,
  DetailButton,
  DetailCard,
  DetailCardHeader,
  DetailCardHeaderSkeleton,
  DetailEmpty,
} from "@/components/events/event-detail-parts";
import { SongKeyCard } from "@/components/events/song-key-card";
import { SpotifyIcon, YoutubeIcon } from "@/components/icons/brand-icons";
import { OPEN_BUTTON_TAP, OpenButton } from "@/components/open-button";
import type { Track } from "@/components/track-player-provider";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { mediaTint, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import {
  getServiceColors,
  type ServiceColors,
} from "@/lib/config/service-types";
import type { EventSetlistSong, ServiceType } from "@/types/event";
import type { SongAttachment, SongKey } from "@/types/song";

/** The running-order badge. */
const NUMBER = 22;
/** Hairlines start past the position badge, so they line up with the titles. */
const SEPARATOR_INSET = 16 + NUMBER + 10;
/** Assigned faces. The web draws these at 24. */
const VOCALIST = 22;
/** Half the gap between a 28pt `OpenButton` and the 17pt glyph it centres. */
const LINK_SLACK = 5.5;

type EventSetlistCardProps = {
  setlist: EventSetlistSong[];
  service: ServiceType;
  /** Managers only: a row opens the vocalist picker for that song. */
  onSongPress?: (song: EventSetlistSong) => void;
  /** Managers only: opens the editor. */
  onEdit?: () => void;
  /** Opens the player on one of a song's tracks. */
  onPlayTrack: (track: Track) => void;
  organizationId: string;
  /** The caller sings on this event, so each row gets a ⋮ with its key card. */
  canSaveKeys?: boolean;
  /** Their key journal, for telling the three save states apart. */
  myKeys?: SongKey[];
};

/** Stable identity for an event nobody's journal has anything to say about. */
const NO_KEYS: SongKey[] = [];

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
export function EventSetlistCard({
  setlist,
  service,
  onSongPress,
  onEdit,
  onPlayTrack,
  organizationId,
  canSaveKeys = false,
  myKeys = NO_KEYS,
}: EventSetlistCardProps) {
  const theme = useTheme();
  const colors = getServiceColors(service.color, theme);

  // Keyed on the library song, not the setlist row — the journal outlives any
  // one event. An entry whose song has left the library carries no songId and
  // can never match.
  const myKeyBySongId = new Map(
    myKeys.flatMap((entry) =>
      entry.songId === null ? [] : [[entry.songId, entry] as const],
    ),
  );

  return (
    <DetailCard>
      <DetailCardHeader
        icon={Music}
        title="Setlist"
        subtitle={
          setlist.length > 0
            ? `${setlist.length} ${setlist.length === 1 ? "song" : "songs"}`
            : undefined
        }
        tint={colors}
        trailing={
          onEdit ? (
            <DetailButton
              icon={Pencil}
              label="Edit"
              service={colors}
              onPress={onEdit}
            />
          ) : undefined
        }
      />

      {/* The dashboard says this in a tooltip on the ⊕ that opens the picker.
          A phone has neither a hover nor that button, so the instruction moves
          here, under the heading, where it is read once on the way into the
          list. Managers only: nobody else's tap does anything. */}
      {onSongPress && setlist.length > 0 ? (
        <HStack className="items-center gap-1.5 px-4 pb-1">
          <AppIcon icon={Info} size={11} color={theme.textMuted} />
          <Text className="flex-1 text-[12px] text-muted-foreground">
            Tap a song to assign who sings it.
          </Text>
        </HStack>
      ) : null}

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
                onPlayTrack={onPlayTrack}
                organizationId={organizationId}
                canSaveKey={canSaveKeys}
                savedEntry={myKeyBySongId.get(song.songId) ?? null}
                service={colors}
              />
            </VStack>
          ))}
        </VStack>
      )}
    </DetailCard>
  );
}

/** Holds the card's shape while the event loads. Three songs: a short set. */
export function EventSetlistCardSkeleton() {
  return (
    <DetailCard>
      <DetailCardHeaderSkeleton />

      <VStack className="pb-1.5">
        {[160, 120, 140].map((width, index) => (
          <VStack key={width}>
            {index > 0 ? (
              <Divider style={{ marginLeft: SEPARATOR_INSET }} />
            ) : null}
            <HStack className="items-start gap-2.5 px-4 py-2.5">
              <Skeleton
                startColor="bg-border"
                className="mt-0.5 rounded-md"
                style={{ width: NUMBER, height: NUMBER }}
              />
              <VStack className="flex-1 gap-2 pt-0.5">
                <Skeleton
                  startColor="bg-border"
                  style={{ width, height: 14 }}
                />
                <Skeleton
                  startColor="bg-border"
                  style={{ width: 80, height: 11 }}
                />
              </VStack>
            </HStack>
          </VStack>
        ))}
      </VStack>
    </DetailCard>
  );
}

function SetlistRow({
  song,
  position,
  onPress,
  onPlayTrack,
  organizationId,
  canSaveKey,
  savedEntry,
  service,
}: {
  song: EventSetlistSong;
  position: number;
  onPress?: () => void;
  onPlayTrack: (track: Track) => void;
  organizationId: string;
  canSaveKey: boolean;
  savedEntry: SongKey | null;
  service: ServiceColors;
}) {
  const theme = useTheme();

  const minor = song.keyQuality === "MINOR";
  const keyColor = minor ? theme.violet : theme.textMuted;

  // Anything on the controls line to press: a link, a file, or the
  // arrangement's glyph.
  const hasButtons =
    Boolean(song.spotifyUrl) ||
    Boolean(song.youtubeUrl) ||
    song.attachments.length > 0 ||
    Boolean(song.arrangement);

  // The web's `showPeople`, widened to cover the buttons. A row with nothing
  // to press and nobody singing it skips the line outright rather than paying
  // for an empty one.
  const showControls = hasButtons || song.vocalists.length > 0;

  const row = (
    <HStack className="items-start gap-2.5 px-4 py-2.5">
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

          {/* No "bpm": beside a time signature the number can't be anything
              else. A screen reader still says it. */}
          <Text
            className="text-[12px] text-muted-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
            accessibilityLabel={`${song.bpm} BPM, ${song.timeSignature}`}
          >
            {`${song.bpm} · ${song.timeSignature}`}
          </Text>
        </HStack>

        {showControls ? (
          // Top-aligned once icons can wrap, so the singers stay level with
          // the first line of them; a row without icons is one line anyway.
          <HStack className={hasButtons ? "items-start" : "items-center"}>
            {/* Every control here is a tap square wider than the glyph inside
              it, so each end is pulled out by its own slack — otherwise the
              icons sit indented from the title and artist above them. A row
              with more of them than fit takes a second line rather than
              pushing the singers off the card. */}
            <HStack
              className="flex-1 flex-wrap items-center"
              style={{ marginLeft: -LINK_SLACK, rowGap: 2 }}
            >
              {song.spotifyUrl ? (
                <OpenButton
                  url={song.spotifyUrl}
                  label={`Open ${song.title} in Spotify`}
                >
                  <SpotifyIcon size={17} color={mediaTint.spotify} />
                </OpenButton>
              ) : null}

              {song.youtubeUrl ? (
                <OpenButton
                  url={song.youtubeUrl}
                  label={`Open ${song.title} in YouTube`}
                >
                  <YoutubeIcon size={18} color={mediaTint.youtube} />
                </OpenButton>
              ) : null}

              {song.attachments.map((attachment) => (
                <AttachmentButton
                  key={attachment.id}
                  attachment={attachment}
                  onPlay={() =>
                    onPlayTrack({ attachment, songTitle: song.title })
                  }
                />
              ))}

              {/* The version this event plays, after its own links and files
                  so they start in the same place on every row. */}
              {song.arrangement ? (
                <ArrangementButton name={song.arrangement.name} />
              ) : null}
            </HStack>

            <Box
              className="ml-1.5 justify-center"
              style={{ minHeight: hasButtons ? OPEN_BUTTON_TAP : undefined }}
            >
              <AvatarStack people={song.vocalists} size={VOCALIST} max={3} />
            </Box>
          </HStack>
        ) : null}
      </VStack>

      {/* A singer's ⋮, centred against the title and artist lines and pulled
          out by its own slack so the glyph sits on the card's inset. */}
      {canSaveKey ? (
        <Box style={{ marginTop: 4, marginRight: -6 }}>
          <SongKeyCard
            organizationId={organizationId}
            songId={song.songId}
            title={song.title}
            artist={song.artist}
            pitch={song.pitch}
            keyQuality={song.keyQuality}
            savedEntry={savedEntry}
            service={service}
          />
        </Box>
      ) : null}
    </HStack>
  );

  // Somebody who cannot assign vocalists gets the same row without the tap.
  // A `disabled` Pressable would drop it to 40%, which reads as unavailable
  // rather than read-only.
  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Assign vocalists"
      className="data-[active=true]:bg-border/40"
    >
      {row}
    </Pressable>
  );
}

/** A chart, opened in whatever app reads PDFs, or a track, played in the app. */
function AttachmentButton({
  attachment,
  onPlay,
}: {
  attachment: SongAttachment;
  onPlay: () => void;
}) {
  const theme = useTheme();
  const isPdf = attachment.type === "application/pdf";

  return (
    <OpenButton
      url={attachment.url}
      label={`${isPdf ? "Open" : "Play"} ${attachment.name}`}
      onPress={isPdf ? undefined : onPlay}
    >
      <AppIcon
        icon={isPdf ? FileText : AudioLines}
        size={17}
        // A chart is a plain document, so it takes the text colour, the web's `hover:text-foreground`.
        color={isPdf ? theme.text : mediaTint.audio}
      />
    </OpenButton>
  );
}
