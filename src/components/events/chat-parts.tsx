import * as Clipboard from "expo-clipboard";
import SendHorizontal from "lucide-react-native/icons/send-horizontal";
import { useEffect, useState } from "react";
import { TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { OrgAvatar } from "@/components/org-avatar";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";
import type { ServiceColors } from "@/lib/config/service-types";
import { personName } from "@/lib/names";
import type { ChatMessage } from "@/types/chat";

const AVATAR = 28;
const GAP = 8;
/** Lines the name and the tapped time up with the bubble's text. */
const TEXT_INDENT = AVATAR + GAP + 12;

const RADIUS = 16;
/** The sender's side, where bubbles in a run meet. */
const JOIN_RADIUS = 6;

/** One person's messages this close together read as a single run. */
const RUN_MINUTES = 5;
/** A pause this long, or a new day, earns a time divider. */
const DIVIDER_MINUTES = 15;

/** How long "Copied" stays under a bubble after a long press. */
const COPIED_MS = 1500;

const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

function minutesApart(a: string, b: string): number {
  return Math.abs(Date.parse(b) - Date.parse(a)) / 60_000;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * `"Today 3:42 PM"`, `"Yesterday 9:10 AM"`, `"Saturday 3:42 PM"` within the
 * week, then `"Sat, Sep 20 · 3:42 PM"`. Device time, like every message time.
 */
function formatDivider(value: string, now = new Date()): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString("en-US", TIME);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) {
    return `${date.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
  }

  const day = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });

  return `${day} · ${time}`;
}

function needsDivider(before: ChatMessage | undefined, message: ChatMessage): boolean {
  return (
    !before ||
    minutesApart(before.createdAt, message.createdAt) >= DIVIDER_MINUTES ||
    startOfDay(new Date(before.createdAt)) !== startOfDay(new Date(message.createdAt))
  );
}

function startsRun(before: ChatMessage | undefined, message: ChatMessage): boolean {
  return (
    !before ||
    needsDivider(before, message) ||
    before.author.id !== message.author.id ||
    minutesApart(before.createdAt, message.createdAt) >= RUN_MINUTES
  );
}

/** Where a message sits among its neighbours, oldest first. */
export type MessagePlace = {
  /** Heads a run of one person's messages, so it carries their name. */
  first: boolean;
  /** Ends the run, so it carries their avatar. */
  last: boolean;
  /** The time divider above it, when a pause or a new day earns one. */
  divider: string | null;
};

export function placeMessage(
  before: ChatMessage | undefined,
  message: ChatMessage,
  after: ChatMessage | undefined,
): MessagePlace {
  return {
    first: startsRun(before, message),
    last: !after || startsRun(message, after),
    divider: needsDivider(before, message) ? formatDivider(message.createdAt) : null,
  };
}

type MessageRowProps = {
  message: ChatMessage;
  isMe: boolean;
  colors: ServiceColors;
  place: MessagePlace;
};

/**
 * One bubble, laid out the way messaging apps group them: a run of one
 * person's messages carries their name above the first bubble and their avatar
 * beside the last, and times live in dividers between pauses rather than under
 * every message. A tap shows a bubble's own time and a long press copies it —
 * the text isn't selectable, because on Android a selectable text swallows
 * the tap.
 *
 * The caller's own sit right in the service colour, the way the dashboard
 * paints them, with no name or avatar — the side and the colour already say
 * whose they are. Everyone else's sit left on the surface.
 */
export function MessageRow({ message, isMe, colors, place }: MessageRowProps) {
  const theme = useTheme();
  const [showTime, setShowTime] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = message.id.startsWith("temp-");

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void Clipboard.setStringAsync(message.body).then((done) => setCopied(done));
  };

  const footnote = copied
    ? "Copied"
    : pending
      ? place.last
        ? "Sending…"
        : null
      : showTime
        ? new Date(message.createdAt).toLocaleTimeString("en-US", TIME)
        : null;

  // Square where bubbles in a run meet on the sender's side; the foot stays
  // squared as the tail.
  const senderTop = place.first ? RADIUS : JOIN_RADIUS;

  return (
    <VStack className={`px-4 ${place.first ? "mt-3" : "mt-0.5"}`}>
      {place.divider ? (
        <Text className="mb-3 mt-2 text-center text-[11px] font-medium text-muted-foreground">
          {place.divider}
        </Text>
      ) : null}

      {!isMe && place.first ? (
        <Text
          className="mb-1 text-[12px] font-medium text-muted-foreground"
          style={{ marginLeft: TEXT_INDENT }}
          numberOfLines={1}
        >
          {personName(message.author)}
        </Text>
      ) : null}

      <HStack className={`items-end ${isMe ? "justify-end" : ""}`} style={{ gap: GAP }}>
        {isMe ? null : (
          <Box style={{ width: AVATAR }}>
            {place.last ? (
              <OrgAvatar
                name={personName(message.author) || "?"}
                logoUrl={message.author.userImageUrl}
                size={AVATAR}
                shape="circle"
              />
            ) : null}
          </Box>
        )}

        <Pressable
          onPress={pending ? undefined : () => setShowTime((shown) => !shown)}
          onLongPress={copy}
          accessibilityHint={
            pending ? "Hold to copy" : "Shows when it was sent. Hold to copy."
          }
          className="max-w-[78%] data-[active=true]:opacity-80"
        >
          <Box
            className="px-3 py-2"
            style={{
              backgroundColor: isMe ? colors.base : theme.border,
              opacity: pending ? 0.6 : 1,
              borderRadius: RADIUS,
              ...(isMe
                ? { borderTopRightRadius: senderTop, borderBottomRightRadius: JOIN_RADIUS }
                : { borderTopLeftRadius: senderTop, borderBottomLeftRadius: JOIN_RADIUS }),
            }}
          >
            <Text
              className="text-[15px] leading-[20px]"
              style={{ color: isMe ? "#FFFFFF" : theme.text }}
            >
              {message.body}
            </Text>
          </Box>
        </Pressable>
      </HStack>

      {footnote ? (
        <Text
          className={`mt-1 text-[11px] text-muted-foreground ${isMe ? "self-end" : ""}`}
          style={isMe ? { marginRight: 4 } : { marginLeft: TEXT_INDENT }}
        >
          {footnote}
        </Text>
      ) : null}
    </VStack>
  );
}

type ComposerProps = {
  colors: ServiceColors;
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
};

/** The message field and its send button. */
export function Composer({ colors, onSend, disabled }: ComposerProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const body = draft.trim();
  const canSend = body.length > 0 && body.length <= 2000 && !sending && !disabled;

  const send = async () => {
    if (!canSend) return;
    setDraft("");
    setSending(true);
    try {
      await onSend(body);
    } catch {
      // The hook rolled the optimistic row back; put the words back too.
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <HStack
      className="items-end gap-2 border-t px-3 pt-2"
      style={{ borderColor: theme.border, backgroundColor: theme.card }}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Message the team…"
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={2000}
        editable={!disabled}
        style={{
          flex: 1,
          maxHeight: 112,
          minHeight: 38,
          paddingHorizontal: 12,
          paddingTop: 9,
          paddingBottom: 9,
          borderRadius: 19,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
          fontSize: 15,
          color: theme.text,
        }}
      />

      <Pressable
        onPress={send}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        className="items-center justify-center rounded-full"
        style={{
          width: 38,
          height: 38,
          backgroundColor: colors.base,
          opacity: canSend ? 1 : 0.4,
        }}
      >
        <AppIcon icon={SendHorizontal} size={18} color="#FFFFFF" />
      </Pressable>
    </HStack>
  );
}
