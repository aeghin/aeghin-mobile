import ArrowRight from "lucide-react-native/icons/arrow-right";
import BookmarkPlus from "lucide-react-native/icons/bookmark-plus";
import EllipsisVertical from "lucide-react-native/icons/ellipsis-vertical";
import MessageSquareText from "lucide-react-native/icons/message-square-text";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable as RNPressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { DetailButton } from "@/components/events/event-detail-parts";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useSaveSongKey } from "@/hooks/use-song-keys";
import { useTheme } from "@/hooks/use-theme";
import { formatKey } from "@/lib/config/keys";
import type { ServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { KeyQuality, Pitch, SongKey } from "@/types/song";

/** The ⋮, the size `ActionMenu` draws its own. */
const TRIGGER = 30;
const CARD_WIDTH = 264;
/** Between the trigger and the card. */
const GAP = 6;
/** How close to a screen edge the card may land. */
const EDGE = 12;
const RADIUS = 14;
/** Below this share of the screen, the card opens upwards instead. */
const FLIP_AT = 0.55;
/** The large key grows with Dynamic Type only this far, as the key tile's does. */
const MAX_SCALE = 1.3;

/** Where the trigger sits in the window, once it has been measured. */
type Anchor = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

type SongKeyCardProps = {
  organizationId: string;
  /** The library song. A setlist can't hold anything else. */
  songId: string;
  title: string;
  artist: string;
  /** The setlist's key for this event — what gets copied across. */
  pitch: Pitch;
  keyQuality: KeyQuality;
  /** The caller's journal entry for this song, if they already have one. */
  savedEntry: SongKey | null;
  /** The event's service colours, for the button, as the setlist's own buttons wear them. */
  service: ServiceColors;
};

/**
 * A setlist song's ⋮, for the singers on the event: a small card with the key
 * in the middle, your comment, and the one thing to do about it. The web's key
 * card, hung off the ⋮ the way `ActionMenu` hangs its card.
 *
 * Three states, because overwriting a key you already wrote down should never
 * be silent: Save while it isn't in My keys, nothing to press once it is, and
 * Update with both keys in view when yours differs. The save is optimistic, so
 * the card turns into the saved state as it is tapped.
 */
export function SongKeyCard({
  organizationId,
  songId,
  title,
  artist,
  pitch,
  keyQuality,
  savedEntry,
  service,
}: SongKeyCardProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const save = useSaveSongKey(organizationId);

  const triggerRef = useRef<View>(null);

  // The anchor outlives the closing, so the card fades out where it was
  // rather than jumping to the corner — the same reason `ActionMenu` keeps it.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  const [scale] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    if (!open) return;

    scale.setValue(0.92);

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 320,
      mass: 0.7,
    }).start();
  }, [open, scale]);

  const eventKey = formatKey(pitch, keyQuality);
  const yourKey = savedEntry ? formatKey(savedEntry.pitch, savedEntry.keyQuality) : null;

  const isSaved = yourKey === eventKey;
  const isStale = yourKey !== null && !isSaved;

  const write = () =>
    save.mutate(
      {
        songId,
        title,
        artist,
        pitch,
        keyQuality,
        // The save is an upsert that writes whatever notes it is handed, so
        // the comment you already wrote goes back up unchanged.
        notes: savedEntry?.notes ?? "",
      },
      {
        onError: (error) => Alert.alert("Couldn't save", failureMessage(error)),
      },
    );

  // Below the trigger, or above it for a row low on the screen. Opening
  // upwards pins the card's bottom edge instead of its top, so it never has to
  // know its own height — which a comment changes.
  const flipped = anchor !== null && anchor.y > height * FLIP_AT;
  const vertical = anchor
    ? flipped
      ? { bottom: Math.max(insets.bottom + EDGE, height - anchor.y + GAP) }
      : { top: anchor.y + anchor.height + GAP }
    : { top: 0 };
  const left = anchor
    ? clamp(anchor.x + anchor.width - CARD_WIDTH, EDGE, Math.max(EDGE, width - CARD_WIDTH - EDGE))
    : 0;

  const status = isSaved
    ? "The same as this event"
    : isStale
      ? "This event is in a different key"
      : "Not in My keys yet";

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={() =>
            triggerRef.current?.measureInWindow((x, y, w, h) => {
              setAnchor({ x, y, width: w, height: h });
              setOpen(true);
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`My keys: ${title}`}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          className="items-center justify-center rounded-full data-[active=true]:bg-border/60"
          style={{ width: TRIGGER, height: TRIGGER }}
        >
          <AppIcon icon={EllipsisVertical} size={18} color={theme.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {/* Lighter than a dialog's scrim: this hangs off a row you are still
            looking at, as `ActionMenu`'s card does. */}
        <RNPressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `rgba(0, 0, 0, ${theme.scheme === "dark" ? 0.4 : 0.18})`,
          }}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <Animated.View
          accessibilityViewIsModal
          style={{
            position: "absolute",
            ...vertical,
            left,
            width: CARD_WIDTH,
            padding: 16,
            borderRadius: RADIUS,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
            boxShadow: "0px 16px 32px rgba(0, 0, 0, 0.24)",
            transformOrigin: flipped ? "bottom right" : "top right",
            opacity: scale.interpolate({ inputRange: [0.92, 1], outputRange: [0, 1] }),
            transform: [{ scale }],
          }}
        >
          <Text
            className="text-center text-[15px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="text-center text-[13px] text-muted-foreground" numberOfLines={1}>
            {artist}
          </Text>

          <HStack className="mt-4 items-center justify-center gap-5">
            {isStale && yourKey ? (
              <>
                <KeyFigure value={yourKey} label="Your key" />
                <AppIcon icon={ArrowRight} size={16} color={theme.textMuted} />
                <KeyFigure value={eventKey} label="This event" />
              </>
            ) : (
              <KeyFigure value={eventKey} label={isSaved ? "Your key" : "This event"} />
            )}
          </HStack>

          <Text className="mt-2 text-center text-[12.5px] text-muted-foreground">{status}</Text>

          {savedEntry?.notes ? (
            <HStack
              className="mt-3 items-start gap-1.5 rounded-lg px-3 py-2"
              style={{ backgroundColor: theme.surface }}
            >
              <Box style={{ paddingTop: 2 }}>
                <AppIcon icon={MessageSquareText} size={12} color={theme.textMuted} />
              </Box>
              <Text
                className="flex-1 text-[12.5px] leading-[17px] text-muted-foreground"
                numberOfLines={4}
              >
                {savedEntry.notes}
              </Text>
            </HStack>
          ) : null}

          {isSaved ? null : (
            <DetailButton
              icon={isStale ? RefreshCw : BookmarkPlus}
              label={isStale ? `Update to ${eventKey}` : `Save ${eventKey} to My keys`}
              service={service}
              primary
              busy={save.isPending}
              onPress={write}
              style={{ marginTop: 16 }}
            />
          )}
        </Animated.View>
      </Modal>
    </>
  );
}

/** One key, large, with what it is under it. */
function KeyFigure({ value, label }: { value: string; label: string }) {
  return (
    <VStack className="items-center">
      <Text
        className="text-[30px] font-bold leading-[34px] tracking-[-0.5px] text-foreground"
        maxFontSizeMultiplier={MAX_SCALE}
      >
        {value}
      </Text>
      <Text className="mt-1 text-[10px] font-bold uppercase tracking-[0.9px] text-muted-foreground">
        {label}
      </Text>
    </VStack>
  );
}
