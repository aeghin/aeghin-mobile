import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Check from "lucide-react-native/icons/check";
import MapPin from "lucide-react-native/icons/map-pin";
import Pencil from "lucide-react-native/icons/pencil";
import Sparkles from "lucide-react-native/icons/sparkles";
import Square from "lucide-react-native/icons/square";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import X from "lucide-react-native/icons/x";
import { useMemo, useRef, useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useCreateEvent } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { apiBaseUrl, authHeaders } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { formatShortDate, formatTime, keyToDate, todayKey } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { NewEvent } from "@/types/event";
import type {
  CheckAvailabilityOutput,
  EventDraft,
  ProposeEventOutput,
} from "@/types/event-ai";

const SUGGESTIONS = [
  "Sunday morning service next week, full band",
  "Christmas Eve service, 6pm, rotate in people who haven't served lately",
  "Youth night this Friday — drums, bass, guitar, sound",
];

/** The two tools the agent calls, as the UI message stream carries them. */
type EventTools = {
  checkAvailability: { input: unknown; output: CheckAvailabilityOutput };
  proposeEvent: { input: unknown; output: ProposeEventOutput };
};

type EventUIMessage = UIMessage<unknown, Record<string, unknown>, EventTools>;

/** A draft's `"09:00"` as `"9:00 AM"`, read in UTC like every other time here. */
const formatClock = (clock: string) => formatTime(`1970-01-01T${clock}:00Z`);

/** The refusals worth rewording. Everything else is already a sentence. */
const REWORDED: [RegExp, string][] = [
  [/service type/i, "This organization has no service types yet — add one in Settings and try again."],
  [/upgrade/i, "This organization's AI plan has lapsed."],
  [/unauthori[sz]ed/i, "Your session has expired. Sign in again."],
  [/not found/i, "Only an owner or admin can draft events here."],
  [/internal server error/i, "Something went wrong. Please try again."],
];

/**
 * What to tell the person when the stream fails.
 *
 * Three shapes arrive here, and only two of them are ours. The transport
 * throws with the response body verbatim, which for these routes is
 * `{"error":"…"}`; a failure *inside* the stream arrives as the plain sentence
 * the route's `onError` returned. Both are our own wording and worth showing,
 * the same call `failureMessage` makes for every other write in the app.
 *
 * The third is an HTML error page — a route the server hasn't registered, or a
 * proxy's own page — and it must never be pattern-matched or shown. Next's
 * not-found page carries the word "unauthorized" in its RSC payload, which is
 * enough to make a naive regex report an expired session for what is really a
 * 404.
 */
function streamMessage(error: Error): string {
  const raw = error.message;

  if (__DEV__) {
    console.warn("event-ai stream failed:", raw);
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

type AiEventPanelProps = {
  organizationId: string;
  /** Whether the org has a service type to file an event under. */
  hasServiceTypes: boolean;
  /** Hand the draft to the form below for manual editing. */
  onRefine: (draft: EventDraft) => void;
  /** The draft was created for real — leave the screen. */
  onCreated: () => void;
};

/**
 * The dashboard's "Draft with AI" panel: a chat with the event agent whose
 * proposals become an event with one tap, or fill in the form below instead.
 *
 * Streams over `expo/fetch`, which supports response bodies as streams where
 * React Native's own fetch does not, with a fresh Clerk bearer read per send.
 */
export function AiEventPanel({
  organizationId,
  hasServiceTypes,
  onRefine,
  onCreated,
}: AiEventPanelProps) {
  const theme = useTheme();
  const [input, setInput] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<EventUIMessage>({
        api: `${apiBaseUrl}/api/mobile/v1/organizations/${organizationId}/event-ai`,
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        headers: authHeaders,
        // "Next Sunday" is relative to the phone's calendar, not the server's.
        // Resolvable, so this re-reads the clock on every send.
        body: () => ({ today: todayKey() }),
      }),
    [organizationId],
  );

  const { messages, sendMessage, status, stop, error } = useChat<EventUIMessage>({
    transport,
    onFinish: ({ isAbort, isError, finishReason }) => {
      setTimedOut(!isAbort && !isError && finishReason == null);
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";

  // The trailing part is "live" when text is still arriving or a tool is mid
  // call; otherwise the model is thinking and the panel says so.
  const lastPart = messages.at(-1)?.parts.at(-1);
  const tailIsLive =
    lastPart?.type === "text"
      ? lastPart.state === "streaming"
      : lastPart?.type === "tool-checkAvailability" || lastPart?.type === "tool-proposeEvent"
        ? lastPart.state === "input-streaming" || lastPart.state === "input-available"
        : false;
  const showBusy = isStreaming && !tailIsLive;

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming || !hasServiceTypes) return;
    setTimedOut(false);
    sendMessage({ text });
    setInput("");
  };

  return (
    <VStack className="flex-1 gap-3">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <EmptyState
            hasServiceTypes={hasServiceTypes}
            onPick={hasServiceTypes ? setInput : undefined}
          />
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
                          style={{ backgroundColor: brand.orange }}
                        >
                          <Text className="text-[14px] text-white">{part.text}</Text>
                        </Box>
                      </HStack>
                    ) : (
                      <Text
                        key={index}
                        className="text-[14px] leading-[20px] text-foreground"
                        selectable
                      >
                        {part.text}
                      </Text>
                    );
                  }

                  if (part.type === "tool-checkAvailability") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return <Busy key={index} label="Checking who's available…" />;
                      case "output-available":
                        return (
                          <Text key={index} className="text-[12px] text-muted-foreground">
                            {`Checked availability across ${part.output.roles.length} role${
                              part.output.roles.length === 1 ? "" : "s"
                            }`}
                          </Text>
                        );
                      default:
                        return null;
                    }
                  }

                  if (part.type === "tool-proposeEvent") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return <Busy key={index} label="Building the draft…" />;
                      case "output-available":
                        return part.output.ok ? (
                          <DraftCard
                            key={index}
                            draft={part.output.draft}
                            organizationId={organizationId}
                            onRefine={onRefine}
                            onCreated={onCreated}
                          />
                        ) : (
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
                            {"Couldn't build that draft. Try rephrasing."}
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

        {showBusy ? <Busy label="Thinking…" /> : null}

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
          editable={hasServiceTypes}
          placeholder={
            hasServiceTypes ? "Describe the event…" : "Add a service type to start drafting"
          }
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
            disabled={!input.trim() || !hasServiceTypes}
            accessibilityRole="button"
            accessibilityLabel="Send"
            className="items-center justify-center rounded-xl"
            style={{
              width: 34,
              height: 34,
              backgroundColor: brand.orange,
              opacity: input.trim() && hasServiceTypes ? 1 : 0.4,
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
 * One finished draft, and the two ways to take it.
 *
 * Creating goes through the same route the manual form posts to, which
 * re-checks membership, role qualification and blockouts before writing — the
 * draft is a suggestion right up to this tap.
 */
function DraftCard({
  draft,
  organizationId,
  onRefine,
  onCreated,
}: {
  draft: EventDraft;
  organizationId: string;
  onRefine: (draft: EventDraft) => void;
  onCreated: () => void;
}) {
  const theme = useTheme();
  const colors = getServiceColors(draft.serviceTypeColor, theme);
  const create = useCreateEvent(organizationId);

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [refined, setRefined] = useState(false);

  const kept = draft.assignments.filter((a) => !removed.has(a.userId));
  const locked = create.isPending || created;

  const toggleRemoved = (userId: string) =>
    setRemoved((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const submit = () => {
    setError(null);

    // Roles nobody was picked for go up empty, which is what leaves an open
    // slot on the roster for the team card to invite into later.
    const roleAssignments: Record<string, string[]> = Object.fromEntries(
      draft.rolesNeeded.map((role) => [role, [] as string[]]),
    );

    for (const assignment of kept) {
      roleAssignments[assignment.role] = [
        ...(roleAssignments[assignment.role] ?? []),
        assignment.userId,
      ];
    }

    const event: NewEvent = {
      serviceTypeId: draft.serviceTypeId,
      name: draft.name,
      description: draft.description.trim() || undefined,
      location: draft.location,
      days: draft.days,
      rolesNeeded: draft.rolesNeeded,
      expiresAt: draft.expiresInDays,
      smartSchedulingEnabled: draft.smartSchedulingEnabled,
      roleAssignments,
    };

    create.mutate(event, {
      onSuccess: () => {
        setCreated(true);
        onCreated();
      },
      onError: (failure) => setError(failureMessage(failure)),
    });
  };

  return (
    <VStack className="gap-3 rounded-2xl border border-border bg-card p-3">
      <HStack className="items-start gap-2">
        <Box
          className="mt-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: colors.base }}
        />
        <VStack className="flex-1">
          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
            {draft.name}
          </Text>
          <Text className="text-[11.5px]" style={{ color: colors.text }}>
            {draft.serviceTypeName}
          </Text>
        </VStack>
      </HStack>

      <VStack className="gap-1">
        {draft.days.map((day) => (
          <HStack key={day.date} className="items-center gap-1.5">
            <AppIcon icon={CalendarDays} size={12} color={theme.textMuted} />
            <Text className="flex-1 text-[12.5px] text-muted-foreground">
              {`${formatShortDate(keyToDate(day.date))} · ${formatClock(day.startTime)} – ${formatClock(day.endTime)}`}
            </Text>
          </HStack>
        ))}
        <HStack className="items-center gap-1.5">
          <AppIcon icon={MapPin} size={12} color={theme.textMuted} />
          <Text className="flex-1 text-[12.5px] text-muted-foreground" numberOfLines={1}>
            {draft.location}
          </Text>
        </HStack>
      </VStack>

      <VStack className="gap-2">
        {draft.rolesNeeded.map((role) => {
          const people = kept.filter((assignment) => assignment.role === role);
          const { emoji, label } = getVolunteerRoleConfig(role);

          return (
            <HStack key={role} className="items-start gap-2">
              <Text style={{ fontSize: 13, lineHeight: 18 }}>{emoji}</Text>
              <VStack className="flex-1 gap-0.5">
                <Text className="text-[13px] font-medium text-foreground">
                  {label}
                  {people.length === 0 ? (
                    <Text className="text-[12px] font-normal text-muted-foreground">
                      {"  — left open"}
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

      {removed.size > 0 && !created ? (
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

      {draft.warnings.length > 0 ? (
        <VStack
          className="gap-1 rounded-xl p-2"
          style={{ backgroundColor: withAlpha(theme.warning, 0.12) }}
        >
          {draft.warnings.map((warning, index) => (
            <HStack key={index} className="items-start gap-1.5">
              <Box style={{ marginTop: 2 }}>
                <AppIcon icon={TriangleAlert} size={12} color={theme.warning} />
              </Box>
              <Text className="flex-1 text-[11.5px]" style={{ color: theme.warning }}>
                {`${warning.name} skipped for ${getVolunteerRoleConfig(warning.role).label} — ${warning.reason}`}
              </Text>
            </HStack>
          ))}
        </VStack>
      ) : null}

      {error ? (
        <Text className="text-[12px]" style={{ color: theme.destructive }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={locked}
        accessibilityRole="button"
        className="items-center rounded-xl py-2.5"
        style={{
          backgroundColor: created ? withAlpha(colors.base, 0.15) : colors.base,
          opacity: create.isPending ? 0.6 : 1,
        }}
      >
        <HStack className="items-center gap-1.5">
          {created ? <AppIcon icon={Check} size={14} color={colors.text} /> : null}
          {create.isPending ? <Spinner size="small" color="#FFFFFF" /> : null}
          <Text
            className="text-[13px] font-semibold"
            style={{ color: created ? colors.text : "#FFFFFF" }}
          >
            {created
              ? "Created"
              : create.isPending
                ? "Creating…"
                : kept.length === 0
                  ? "Create event"
                  : `Create & invite ${kept.length} ${kept.length === 1 ? "person" : "people"}`}
          </Text>
        </HStack>
      </Pressable>

      {!created && kept.length > 0 ? (
        <Text className="text-center text-[11px] text-muted-foreground">
          {`Sends ${kept.length === 1 ? "an invite" : "invites"} by email immediately`}
        </Text>
      ) : null}

      {!created ? (
        <Pressable
          onPress={() => {
            // Hands over the whole draft, removals included — what you see on
            // this card is what lands in the form.
            onRefine({ ...draft, assignments: kept });
            setRefined(true);
          }}
          disabled={locked}
          accessibilityRole="button"
          className="items-center rounded-xl border py-2.5"
          style={{ borderColor: theme.border, opacity: locked ? 0.4 : 1 }}
        >
          <HStack className="items-center gap-1.5">
            <AppIcon icon={refined ? Check : Pencil} size={14} color={theme.text} />
            <Text className="text-[13px] font-semibold text-foreground">
              {refined ? "Loaded into the form" : "Edit manually first"}
            </Text>
          </HStack>
        </Pressable>
      ) : null}
    </VStack>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <HStack className="items-center gap-2 py-1">
      <Spinner size="small" color={brand.orange} />
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
    </HStack>
  );
}

function EmptyState({
  hasServiceTypes,
  onPick,
}: {
  hasServiceTypes: boolean;
  onPick?: (text: string) => void;
}) {
  const theme = useTheme();

  return (
    <VStack className="items-center gap-3 py-6">
      <Center
        className="h-11 w-11 rounded-xl"
        style={{ backgroundColor: withAlpha(brand.orange, 0.12) }}
      >
        <AppIcon icon={Sparkles} size={22} color={brand.orange} />
      </Center>
      <VStack className="items-center gap-1">
        <Text className="text-[15px] font-semibold text-foreground">Draft with AI</Text>
        <Text className="text-center text-[13px] text-muted-foreground">
          Describe the event — it picks the dates and the people, you approve.
        </Text>
      </VStack>

      {hasServiceTypes ? (
        <VStack className="w-full gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => onPick?.(suggestion)}
              accessibilityRole="button"
              className="rounded-xl border px-3 py-2.5 data-[active=true]:opacity-60"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}
            >
              <Text className="text-[13px] text-muted-foreground">{suggestion}</Text>
            </Pressable>
          ))}
        </VStack>
      ) : (
        <Text className="text-center text-[12.5px] text-muted-foreground">
          Every event is filed under a service type, and this organization has none yet.
          Add one in Settings and the drafting starts working.
        </Text>
      )}
    </VStack>
  );
}
