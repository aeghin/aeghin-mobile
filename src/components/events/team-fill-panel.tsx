import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import Check from "lucide-react-native/icons/check";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import Sparkles from "lucide-react-native/icons/sparkles";
import Square from "lucide-react-native/icons/square";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import X from "lucide-react-native/icons/x";
import { useMemo, useRef, useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Choice } from "@/components/form-fields";
import { Markdown } from "@/components/markdown";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useInviteToEvent } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { apiBaseUrl, authHeaders } from "@/lib/api";
import type { ServiceColors } from "@/lib/config/service-types";
import type { FillableTeam } from "@/lib/events/fill";
import { failureMessage } from "@/lib/failure";
import type { VolunteerRole } from "@/types/event";
import type { ProposeInvitesOutput, TeamProposal } from "@/types/event-ai";
import type { Team } from "@/types/team-notifications";

const SUGGESTIONS = [
  "Fill the open spots",
  "Fill the open spots, resting anyone who served last week",
  "Who hasn't served in a while?",
];

/** The three deadlines the dashboard offers an invitee. */
const EXPIRY_OPTIONS = [3, 5, 7] as const;

/** The one tool the agent calls, as the UI message stream carries it. */
type FillTools = {
  proposeInvites: { input: unknown; output: ProposeInvitesOutput };
};

type FillUIMessage = UIMessage<unknown, Record<string, unknown>, FillTools>;

/** The refusals worth rewording. Everything else is already a sentence. */
const REWORDED: [RegExp, string][] = [
  [/upgrade/i, "This organization's plan no longer includes Fill with AI."],
  [/unauthori[sz]ed/i, "Your session has expired. Sign in again."],
  [/not found/i, "Only an owner or admin can fill teams here."],
  [/internal server error/i, "Something went wrong. Please try again."],
];

/**
 * What to tell the person when the stream fails: the route's own sentence out
 * of its `{"error":"…"}` body or the stream, never an HTML error page — the
 * same reading the event-draft panel gives its failures.
 */
function streamMessage(error: Error): string {
  const raw = error.message;

  if (__DEV__) {
    console.warn("team-ai stream failed:", raw);
  }

  if (/^\s*<(!doctype|html)\b/i.test(raw)) {
    return "The server didn't recognise that request — it may be running an older build.";
  }

  let reason = raw;

  try {
    const body = JSON.parse(raw) as { error?: unknown };
    if (typeof body.error === "string") reason = body.error;
  } catch {
    // Not one of our JSON refusals, so the text is the message.
  }

  for (const [pattern, reworded] of REWORDED) {
    if (pattern.test(reason)) return reworded;
  }

  return reason.trim() || "Something went wrong. Please try again.";
}

type TeamFillPanelProps = {
  organizationId: string;
  eventId: string;
  eventName: string;
  colors: ServiceColors;
  /** Every team the viewer can fill here that still has open spots. */
  teams: FillableTeam[];
  /** The team whose row opened the screen, picked to start with. */
  team: Team;
};

/**
 * Fill with AI: a chat with the team agent whose picks are invited with one
 * tap. Only on teams the viewer can staff here — theirs, and the ones they
 * back up on Also notify — and the route checks that again.
 *
 * Streams over `expo/fetch`, which supports response bodies as streams where
 * React Native's own fetch does not, with a fresh Clerk bearer read per send.
 * The teams ride along with each message, so changing them steers the next
 * answer.
 */
export function TeamFillPanel({
  organizationId,
  eventId,
  eventName,
  colors,
  teams,
  team,
}: TeamFillPanelProps) {
  const theme = useTheme();
  const [picked, setPicked] = useState<Team[]>([team]);
  const [input, setInput] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<FillUIMessage>({
        api: `${apiBaseUrl}/api/mobile/v1/organizations/${organizationId}/events/${eventId}/team-ai`,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        headers: authHeaders,
      }),
    [organizationId, eventId],
  );

  const { messages, sendMessage, status, stop, error } = useChat<FillUIMessage>({
    transport,
    onFinish: ({ isAbort, isError, finishReason }) => {
      setTimedOut(!isAbort && !isError && finishReason == null);
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";

  // The trailing part is "live" when text is still arriving or the tool is
  // mid call; otherwise the model is thinking and the panel says so.
  const lastPart = messages.at(-1)?.parts.at(-1);
  const tailIsLive =
    lastPart?.type === "text"
      ? lastPart.state === "streaming"
      : lastPart?.type === "tool-proposeInvites"
        ? lastPart.state === "input-streaming" || lastPart.state === "input-available"
        : false;
  const showBusy = isStreaming && !tailIsLive;

  // Only the newest picks can be sent; earlier ones fold away so nobody
  // invites from a version they've already moved past.
  let latestId: string | undefined;
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === "tool-proposeInvites" &&
        part.state === "output-available" &&
        part.output.ok
      ) {
        latestId = part.toolCallId;
      }
    }
  }

  const togglePicked = (value: Team) =>
    setPicked((current) =>
      current.includes(value)
        ? // At least one team stays picked: there's nothing to fill without one.
          current.length > 1
          ? current.filter((entry) => entry !== value)
          : current
        : [...current, value],
    );

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setTimedOut(false);
    sendMessage({ text }, { body: { teams: picked } });
    setInput("");
  };

  return (
    <VStack className="flex-1 gap-3">
      {teams.length > 1 ? (
        <HStack className="flex-wrap gap-1.5">
          {teams.map((entry) => (
            <Choice
              key={entry.team}
              label={`${entry.label} · ${entry.open}`}
              selected={picked.includes(entry.team)}
              onPress={() => togglePicked(entry.team)}
            />
          ))}
        </HStack>
      ) : null}

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <EmptyState eventName={eventName} colors={colors} onPick={setInput} />
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

                  if (part.type === "tool-proposeInvites") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return <Busy key={index} label="Picking people…" tint={colors.text} />;
                      case "output-available":
                        return part.output.ok ? (
                          <ProposalCard
                            key={index}
                            proposal={part.output.proposal}
                            latest={part.toolCallId === latestId}
                            organizationId={organizationId}
                            eventId={eventId}
                            colors={colors}
                          />
                        ) : (
                          // The server turned the picks down; the agent fixes
                          // them and proposes again, so this is a step.
                          <Text key={index} className="text-[12px] text-muted-foreground">
                            {`Adjusting: ${part.output.error}`}
                          </Text>
                        );
                      case "output-error":
                        return (
                          <Text
                            key={index}
                            className="text-[13px]"
                            style={{ color: theme.destructive }}
                          >
                            {"Couldn't pick people. Try rephrasing."}
                          </Text>
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

        {showBusy ? <Busy label="Thinking…" tint={colors.text} /> : null}

        {timedOut ? (
          <Text className="mt-2 text-[13px]" style={{ color: theme.destructive }}>
            That timed out before finishing. Try again, or narrow the request.
          </Text>
        ) : null}

        {error ? (
          <Text className="mt-2 text-[13px]" style={{ color: theme.destructive }}>
            {streamMessage(error)}
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
          placeholder="Ask for picks, or about anyone…"
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

/**
 * One set of picks, and the tap that sends them.
 *
 * One call per role, each only into spots still open when it lands — so a
 * lead and their backup approving at once can't both add a drummer — and
 * refusing anybody booked elsewhere since the card was built. The invitations
 * route checks every pick again before it sends.
 */
function ProposalCard({
  proposal,
  latest,
  organizationId,
  eventId,
  colors,
}: {
  proposal: TeamProposal;
  /** The newest picks in the chat: the only ones that can be sent. */
  latest: boolean;
  organizationId: string;
  eventId: string;
  colors: ServiceColors;
}) {
  const theme = useTheme();
  const roles = useRoles();
  const invite = useInviteToEvent(organizationId, eventId);

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState<3 | 5 | 7>(3);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);
  const [leftOut, setLeftOut] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const kept = proposal.picks.filter((pick) => !removed.has(pick.userId));
  const invited = invitedCount !== null;
  const locked = sending || invited;

  // Every role the picks touch, plus any nobody could be picked for.
  const shown = roles
    .inOrder([
      ...proposal.picks.map((pick) => pick.role),
      ...proposal.stillOpen.map((entry) => entry.role),
    ])
    .map((role) => ({
      role,
      people: kept.filter((pick) => pick.role === role),
      // Still open once these say yes: what nobody was picked for, and anyone taken off.
      open:
        (proposal.stillOpen.find((entry) => entry.role === role)?.count ?? 0) +
        proposal.picks.filter((pick) => pick.role === role && removed.has(pick.userId)).length,
    }));

  const toggleRemoved = (userId: string) =>
    setRemoved((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const send = async () => {
    setError(null);
    setSending(true);

    const byRole = new Map<VolunteerRole, string[]>();
    for (const pick of kept) byRole.set(pick.role, [...(byRole.get(pick.role) ?? []), pick.userId]);

    let count = 0;
    const missed: string[] = [];

    for (const [role, userIds] of byRole) {
      const label = roles.get(role).label;

      try {
        const result = await invite.mutateAsync({
          role,
          userIds,
          expiresAt,
          onlyOpenSpots: true,
          refuseConflicts: true,
        });

        count += result.invitedCount;
        missed.push(...(result.noSpotNames ?? []).map((name) => `${name}: ${label} filled up first`));
        missed.push(...result.skippedNames.map((name) => `${name}: already on this event`));
      } catch (failure) {
        missed.push(`${label}: ${failureMessage(failure)}`);
      }
    }

    setSending(false);
    setLeftOut(missed);

    if (count === 0) {
      setError("Nobody was invited.");
      return;
    }

    setInvitedCount(count);
  };

  // An earlier version in the same chat: one line, nothing to press.
  if (!latest) {
    const n = invitedCount ?? proposal.picks.length;
    const people = n === 1 ? "person" : "people";

    return (
      <HStack className="items-center gap-1.5 py-0.5">
        <AppIcon icon={invited ? Check : History} size={12} color={theme.textMuted} />
        <Text className="flex-1 text-[12px] text-muted-foreground">
          {invited ? `Invited ${n} ${people}` : `Earlier picks: ${n} ${people}`}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack className="gap-3 rounded-2xl border border-border bg-card p-3">
      {/* The model's explanation rides on the card: it stops at the picks. */}
      {proposal.note ? (
        <Text className="text-[12.5px] leading-[18px] text-muted-foreground">{proposal.note}</Text>
      ) : null}

      <VStack className="gap-2">
        {shown.map(({ role, people, open }) => {
          const { emoji, label } = roles.get(role);

          return (
            <HStack key={role} className="items-start gap-2">
              <Text style={{ fontSize: 13, lineHeight: 18 }}>{emoji}</Text>
              <VStack className="flex-1 gap-0.5">
                <Text className="text-[13px] font-medium text-foreground">
                  {label}
                  {open > 0 ? (
                    <Text className="text-[12px] font-normal text-muted-foreground">
                      {`  — ${open} open`}
                    </Text>
                  ) : null}
                </Text>
                {people.map((person) => (
                  <HStack key={person.userId} className="items-start gap-1.5">
                    <Text className="flex-1 text-[11.5px] text-muted-foreground">
                      <Text className="text-[11.5px] text-foreground">{person.name}</Text>
                      {` · ${person.reason}`}
                    </Text>
                    <Pressable
                      onPress={() => toggleRemoved(person.userId)}
                      disabled={locked}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${person.name}`}
                      hitSlop={8}
                      style={{ opacity: locked ? 0.4 : 1 }}
                    >
                      <AppIcon icon={X} size={13} color={theme.textMuted} />
                    </Pressable>
                  </HStack>
                ))}
              </VStack>
            </HStack>
          );
        })}
      </VStack>

      {removed.size > 0 && !invited ? (
        <Pressable
          onPress={() => setRemoved(new Set())}
          disabled={locked}
          accessibilityRole="button"
          className="self-start"
        >
          <Text className="text-[11.5px] underline text-muted-foreground">
            {`Undo ${removed.size} removal${removed.size === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      ) : null}

      {proposal.warnings.length > 0 ? (
        <Notice
          title="Not picked"
          lines={proposal.warnings.map(
            (warning) => `${warning.name} for ${roles.get(warning.role).label}: ${warning.reason}`,
          )}
        />
      ) : null}

      {/* Approved but not asked: somebody got there first, or they're on it already. */}
      {leftOut.length > 0 ? <Notice title="Not invited" lines={leftOut} /> : null}

      {error ? (
        <Text className="text-[12px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : null}

      {!invited ? (
        <VStack className="gap-1.5">
          <Text className="text-[12px] font-medium text-muted-foreground">Time to respond</Text>
          <HStack className="gap-1.5">
            {EXPIRY_OPTIONS.map((days) => (
              <Choice
                key={days}
                label={`${days} days`}
                selected={expiresAt === days}
                onPress={() => setExpiresAt(days)}
                disabled={locked}
              />
            ))}
          </HStack>
        </VStack>
      ) : null}

      <Pressable
        onPress={send}
        disabled={locked || kept.length === 0}
        accessibilityRole="button"
        className="items-center rounded-xl py-2.5"
        style={{
          backgroundColor: invited ? withAlpha(colors.base, 0.15) : colors.base,
          opacity: sending || (!invited && kept.length === 0) ? 0.6 : 1,
        }}
      >
        <HStack className="items-center gap-1.5">
          {invited ? <AppIcon icon={Check} size={14} color={colors.text} /> : null}
          {sending ? <Spinner size="small" color="#FFFFFF" /> : null}
          <Text
            className="text-[13px] font-semibold"
            style={{ color: invited ? colors.text : "#FFFFFF" }}
          >
            {invited
              ? `Invited ${invitedCount}`
              : sending
                ? "Inviting…"
                : `Invite ${kept.length} ${kept.length === 1 ? "person" : "people"}`}
          </Text>
        </HStack>
      </Pressable>

      {!invited && kept.length > 0 ? (
        <Text className="text-center text-[11px] text-muted-foreground">
          {`Sends ${kept.length === 1 ? "an invite" : "invites"} by email immediately`}
        </Text>
      ) : null}
    </VStack>
  );
}

/** A tinted box of lines under a heading: who wasn't picked, or wasn't invited. */
function Notice({ title, lines }: { title: string; lines: string[] }) {
  const theme = useTheme();

  return (
    <VStack className="gap-1 rounded-xl p-2" style={{ backgroundColor: withAlpha(theme.warning, 0.12) }}>
      <HStack className="items-center gap-1.5">
        <AppIcon icon={TriangleAlert} size={12} color={theme.warning} />
        <Text className="text-[11.5px] font-semibold" style={{ color: theme.warning }}>
          {title}
        </Text>
      </HStack>
      {lines.map((line, index) => (
        <Text key={index} className="text-[11.5px]" style={{ color: theme.warning }}>
          {line}
        </Text>
      ))}
    </VStack>
  );
}

function Busy({ label, tint }: { label: string; tint: string }) {
  return (
    <HStack className="items-center gap-2 py-1">
      <Spinner size="small" color={tint} />
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
    </HStack>
  );
}

function EmptyState({
  eventName,
  colors,
  onPick,
}: {
  eventName: string;
  colors: ServiceColors;
  onPick: (text: string) => void;
}) {
  const theme = useTheme();

  return (
    <VStack className="items-center gap-3 py-6">
      <Center className="h-11 w-11 rounded-xl" style={{ backgroundColor: colors.surface }}>
        <AppIcon icon={Sparkles} size={22} color={colors.text} />
      </Center>
      <VStack className="items-center gap-1">
        <Text className="text-[15px] font-semibold text-foreground">Fill with AI</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          {`Picks people for ${eventName}'s open spots. Nothing is sent until you tap Invite.`}
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
