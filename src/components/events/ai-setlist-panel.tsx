import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import * as Crypto from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import Check from "lucide-react-native/icons/check";
import Globe from "lucide-react-native/icons/globe";
import ListMusic from "lucide-react-native/icons/list-music";
import Music from "lucide-react-native/icons/music";
import Sparkles from "lucide-react-native/icons/sparkles";
import Square from "lucide-react-native/icons/square";
import { useMemo, useRef, useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { AgentSources, AgentStep } from "@/components/agent-steps";
import { AppIcon } from "@/components/app-icon";
import { Markdown } from "@/components/markdown";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { apiBaseUrl, authHeaders } from "@/lib/api";
import { formatKey } from "@/lib/config/keys";
import type { ServiceColors } from "@/lib/config/service-types";
import type { ProposedSetlistSong, SetlistDraftSong, SetlistProposal } from "@/types/setlist";

const SUGGESTIONS = [
  "Build a 5-song Sunday morning set",
  "Songs about grace, building toward communion",
  "Upbeat opener, then slower worship",
];

/** The two tools the agent calls, as the UI message stream carries them. */
type SetlistTools = {
  proposeSetlist: { input: unknown; output: SetlistProposal };
  web_search: {
    input: { query?: string } | undefined;
    output: { url: string; title: string | null }[];
  };
};

type SetlistUIMessage = UIMessage<unknown, Record<string, unknown>, SetlistTools>;

/**
 * The route's own sentence out of the `{"error":"…"}` body the transport
 * throws with, or null when the failure is something else.
 */
function refusalOf(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

type AiSetlistPanelProps = {
  organizationId: string;
  eventId: string;
  colors: ServiceColors;
  onApply: (songs: SetlistDraftSong[]) => void;
};

/**
 * The dashboard's AI panel: a chat with the setlist agent whose proposals
 * land in the draft with one tap.
 *
 * Streams over `expo/fetch`, which supports response bodies as streams where
 * React Native's own fetch does not, with a fresh Clerk bearer read per send.
 */
export function AiSetlistPanel({ organizationId, eventId, colors, onApply }: AiSetlistPanelProps) {
  const theme = useTheme();
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  // Follows the reply to the bottom as it streams in, until somebody opens a
  // step above it to read: then the list stays where they are.
  const follow = useRef(true);
  const stopFollowing = () => {
    follow.current = false;
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport<SetlistUIMessage>({
        api: `${apiBaseUrl}/api/mobile/v1/organizations/${organizationId}/events/${eventId}/setlist-ai`,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        headers: authHeaders,
      }),
    [organizationId, eventId],
  );

  const { messages, sendMessage, status, stop, error } = useChat<SetlistUIMessage>({ transport });

  const isStreaming = status === "submitted" || status === "streaming";

  // The trailing part is "live" when text is still arriving or a tool is mid
  // call; otherwise the model is thinking and the panel says so.
  const lastPart = messages.at(-1)?.parts.at(-1);
  const tailIsLive =
    lastPart?.type === "text"
      ? lastPart.state === "streaming"
      : lastPart?.type === "tool-web_search" || lastPart?.type === "tool-proposeSetlist"
        ? lastPart.state === "input-streaming" || lastPart.state === "input-available"
        : false;
  const showBusy = isStreaming && !tailIsLive;

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    follow.current = true;
    sendMessage({ text });
    setInput("");
  };

  // Fresh rows are the Original; the editor carries a kept song's pick across.
  const applyProposal = (songs: ProposedSetlistSong[]) =>
    onApply(
      songs.map((song, index) => ({
        id: Crypto.randomUUID(),
        songId: song.songId,
        arrangementId: null,
        arrangementName: null,
        position: index,
        pitch: song.pitch,
        keyQuality: song.keyQuality,
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        title: song.title,
        artist: song.artist,
        youtubeUrl: song.youtubeUrl,
        spotifyUrl: song.spotifyUrl,
      })),
    );

  return (
    <VStack className="flex-1 gap-3">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        onContentSizeChange={() => {
          if (follow.current) scrollRef.current?.scrollToEnd({ animated: true });
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <EmptyState colors={colors} onPick={setInput} />
        ) : (
          <VStack className="gap-3">
            {messages.map((message) => (
              <VStack key={message.id} className="gap-2">
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    if (!part.text) return null;
                    return message.role === "user" ? (
                      <HStack key={index} className="justify-end">
                        <Box
                          className="max-w-[85%] rounded-2xl rounded-tr-md px-3 py-2"
                          style={{ backgroundColor: colors.base }}
                        >
                          <Text className="text-[14px] text-white">{part.text}</Text>
                        </Box>
                      </HStack>
                    ) : (
                      <Markdown
                        key={index}
                        text={part.text}
                        streaming={part.state === "streaming"}
                      />
                    );
                  }

                  if (part.type === "tool-proposeSetlist") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return isStreaming ? (
                          <AgentStep
                            key={index}
                            icon={ListMusic}
                            title="Building the setlist"
                            status="running"
                          />
                        ) : (
                          <AgentStep
                            key={index}
                            icon={ListMusic}
                            title="Stopped before the setlist was built"
                            status="error"
                          />
                        );
                      case "output-available":
                        return (
                          <ProposalCard
                            key={index}
                            proposal={part.output}
                            colors={colors}
                            onApply={applyProposal}
                          />
                        );
                      case "output-error":
                        return (
                          <AgentStep
                            key={index}
                            icon={ListMusic}
                            title="Couldn't build that setlist. Try rephrasing."
                            status="error"
                          />
                        );
                      default:
                        return null;
                    }
                  }

                  if (part.type === "tool-web_search") {
                    const query =
                      typeof part.input?.query === "string" ? ` for “${part.input.query}”` : "";

                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return isStreaming ? (
                          <AgentStep
                            key={index}
                            icon={Globe}
                            title={`Searching the web${query}`}
                            status="running"
                          />
                        ) : (
                          <AgentStep key={index} icon={Globe} title="Search stopped" status="error" />
                        );
                      case "output-available":
                        return part.output.length > 0 ? (
                          <AgentStep
                            key={index}
                            icon={Globe}
                            title={`Searched the web${query}`}
                            description={`${part.output.length} ${
                              part.output.length === 1 ? "result" : "results"
                            }`}
                            onToggle={stopFollowing}
                          >
                            <AgentSources sources={part.output} />
                          </AgentStep>
                        ) : (
                          <AgentStep
                            key={index}
                            icon={Globe}
                            title={`Searched the web${query}`}
                            description="No results"
                          />
                        );
                      case "output-error":
                        return (
                          <AgentStep
                            key={index}
                            icon={Globe}
                            title="Web search failed"
                            status="error"
                          />
                        );
                      default:
                        return null;
                    }
                  }

                  return null;
                })}
              </VStack>
            ))}
          </VStack>
        )}

        {showBusy ? (
          <Box className="mt-3">
            <AgentStep icon={Sparkles} title="Thinking" status="running" />
          </Box>
        ) : null}

        {error ? (
          <Text className="mt-2 text-[13px]" style={{ color: theme.destructive }}>
            {/upgrade/i.test(error.message)
              ? "This organization's plan no longer includes AI setlists."
              : /catalog/i.test(error.message)
                ? "Add songs to the library first — the AI builds setlists from it."
                : /AI requests/.test(error.message)
                  ? (refusalOf(error.message) ?? "This month's AI requests are used up.")
                  : "Something went wrong. Please try again."}
          </Text>
        ) : null}
      </ScrollView>

      <HStack
        className="items-end gap-2 rounded-2xl border p-1.5"
        style={{ borderColor: theme.border, backgroundColor: theme.card }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Describe the setlist…"
          placeholderTextColor={theme.textMuted}
          multiline
          style={{
            flex: 1,
            maxHeight: 112,
            minHeight: 36,
            paddingHorizontal: 10,
            paddingTop: 8,
            paddingBottom: 8,
            fontSize: 14,
            color: theme.text,
          }}
        />
        {isStreaming ? (
          <Pressable
            onPress={() => stop()}
            accessibilityRole="button"
            accessibilityLabel="Stop"
            className="items-center justify-center rounded-xl"
            style={{ width: 34, height: 34, backgroundColor: theme.surface }}
          >
            <AppIcon icon={Square} size={14} color={theme.text} />
          </Pressable>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!input.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            className="items-center justify-center rounded-xl"
            style={{
              width: 34,
              height: 34,
              backgroundColor: colors.base,
              opacity: input.trim() ? 1 : 0.4,
            }}
          >
            <AppIcon icon={ArrowUp} size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </HStack>
    </VStack>
  );
}

function ProposalCard({
  proposal,
  colors,
  onApply,
}: {
  proposal: SetlistProposal;
  colors: ServiceColors;
  onApply: (songs: ProposedSetlistSong[]) => void;
}) {
  const theme = useTheme();
  const [applied, setApplied] = useState(false);

  if (proposal.songs.length === 0) {
    return (
      <Text className="text-[13px] text-muted-foreground">
        No matching songs found in your library.
      </Text>
    );
  }

  return (
    <VStack className="gap-2 rounded-2xl border border-border bg-card p-3">
      <HStack className="items-center gap-2">
        <AppIcon icon={Music} size={14} color={colors.text} />
        <Text className="flex-1 text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {proposal.title}
        </Text>
        <Text className="text-[11px] text-muted-foreground">{`${proposal.songs.length} songs`}</Text>
      </HStack>

      {/* The model's explanation rides on the card: it stops at the proposal. */}
      {proposal.note ? (
        <Text className="text-[12px] leading-[17px] text-muted-foreground">{proposal.note}</Text>
      ) : null}

      <VStack className="gap-1.5">
        {proposal.songs.map((song, index) => (
          <HStack key={song.songId} className="items-start gap-2">
            <Center className="mt-0.5 h-4 w-4 rounded" style={{ backgroundColor: theme.surface }}>
              <Text className="text-[10px] font-bold text-muted-foreground">{index + 1}</Text>
            </Center>
            <VStack className="flex-1">
              <Text className="text-[13px] font-medium text-foreground" numberOfLines={1}>
                {song.title}
                <Text className="text-[11px] text-muted-foreground">
                  {`  · ${formatKey(song.pitch, song.keyQuality)} · ${song.bpm}bpm`}
                </Text>
              </Text>
              <Text className="text-[11.5px] text-muted-foreground" numberOfLines={2}>
                {song.reason}
              </Text>
            </VStack>
          </HStack>
        ))}
      </VStack>

      <Pressable
        onPress={() => {
          onApply(proposal.songs);
          setApplied(true);
        }}
        accessibilityRole="button"
        className="mt-1 items-center rounded-xl py-2.5"
        style={{ backgroundColor: applied ? withAlpha(colors.base, 0.15) : colors.base }}
      >
        <HStack className="items-center gap-1.5">
          {applied ? <AppIcon icon={Check} size={14} color={colors.text} /> : null}
          <Text
            className="text-[13px] font-semibold"
            style={{ color: applied ? colors.text : "#FFFFFF" }}
          >
            {applied ? "Applied to draft" : "Apply to setlist"}
          </Text>
        </HStack>
      </Pressable>

      {proposal.skipped.length > 0 ? (
        <Text className="text-[11px] text-muted-foreground">
          {`${proposal.skipped.length} suggestion(s) skipped — not in your library.`}
        </Text>
      ) : null}
    </VStack>
  );
}

function EmptyState({ colors, onPick }: { colors: ServiceColors; onPick: (text: string) => void }) {
  const theme = useTheme();

  return (
    <VStack className="items-center gap-3 py-6">
      <Center className="h-11 w-11 rounded-xl" style={{ backgroundColor: colors.surface }}>
        <AppIcon icon={Sparkles} size={22} color={colors.text} />
      </Center>
      <VStack className="items-center gap-1">
        <Text className="text-[15px] font-semibold text-foreground">Generate a setlist</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          Describe the vibe and it will be built from your song library.
        </Text>
      </VStack>
      <VStack className="w-full gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onPick(suggestion)}
            accessibilityRole="button"
            className="rounded-xl border px-3 py-2.5 data-[active=true]:opacity-60"
            style={{ borderColor: theme.border, backgroundColor: theme.card }}
          >
            <Text className="text-[13px] text-muted-foreground">{suggestion}</Text>
          </Pressable>
        ))}
      </VStack>
    </VStack>
  );
}
