import SendHorizontal from "lucide-react-native/icons/send-horizontal";
import { useState } from "react";
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
import type { ChatMessage } from "@/types/chat";

const AVATAR = 28;

/** `"3:42 PM"`, in device time — a message is a real instant, unlike an event date. */
function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type MessageRowProps = {
  message: ChatMessage;
  isMe: boolean;
  colors: ServiceColors;
  /** Hides the name and avatar when the message above is the same person's. */
  continued: boolean;
};

/**
 * One bubble. The caller's own sit right in the service colour, the way the
 * dashboard paints them; everyone else's sit left on the surface.
 */
export function MessageRow({ message, isMe, colors, continued }: MessageRowProps) {
  const theme = useTheme();
  const pending = message.id.startsWith("temp-");
  const fullName = `${message.author.firstName} ${message.author.lastName}`.trim();

  return (
    <HStack
      className={`items-end gap-2 px-4 ${isMe ? "flex-row-reverse" : ""} ${
        continued ? "mt-1" : "mt-3"
      }`}
    >
      <Box style={{ width: AVATAR }}>
        {continued ? null : (
          <OrgAvatar
            name={fullName || "?"}
            logoUrl={message.author.userImageUrl}
            size={AVATAR}
            shape="circle"
          />
        )}
      </Box>

      <VStack className={`max-w-[76%] ${isMe ? "items-end" : "items-start"}`}>
        {continued ? null : (
          <Text className="mb-0.5 px-1 text-[11px] text-muted-foreground">
            {isMe ? "You" : fullName}
          </Text>
        )}

        <Box
          className="rounded-2xl px-3 py-2"
          style={{
            backgroundColor: isMe ? colors.base : theme.surface,
            opacity: pending ? 0.6 : 1,
            borderBottomRightRadius: isMe ? 6 : 16,
            borderBottomLeftRadius: isMe ? 16 : 6,
          }}
        >
          <Text
            className="text-[15px] leading-[20px]"
            style={{ color: isMe ? "#FFFFFF" : theme.text }}
            selectable
          >
            {message.body}
          </Text>
        </Box>

        <Text className="mt-0.5 px-1 text-[10px] text-muted-foreground">
          {pending ? "Sending…" : formatMessageTime(message.createdAt)}
        </Text>
      </VStack>
    </HStack>
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
