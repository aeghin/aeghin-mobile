import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import ArrowUp from "lucide-react-native/icons/arrow-up";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import CalendarOff from "lucide-react-native/icons/calendar-off";
import CalendarX2 from "lucide-react-native/icons/calendar-x-2";
import Check from "lucide-react-native/icons/check";
import MapPin from "lucide-react-native/icons/map-pin";
import Pencil from "lucide-react-native/icons/pencil";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import Sparkles from "lucide-react-native/icons/sparkles";
import Square from "lucide-react-native/icons/square";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserSearch from "lucide-react-native/icons/user-search";
import X from "lucide-react-native/icons/x";
import { useMemo, useRef, useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { AgentStep } from "@/components/agent-steps";
import { AppIcon } from "@/components/app-icon";
import { Markdown } from "@/components/markdown";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useCreateEvent } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { apiBaseUrl, authHeaders } from "@/lib/api";
import { getServiceColors } from "@/lib/config/service-types";
import {
  formatDayMonth,
  formatShortDate,
  formatTime,
  keyToDate,
  todayKey,
} from "@/lib/events/format";
import { teamList } from "@/lib/events/fill";
import { failureMessage } from "@/lib/failure";
import type { NewEvent } from "@/types/event";
import type {
  AvailabilityRole,
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

/** `"2026-10-31 to 2026-11-02"` as `"Oct 31 – Nov 2"`; blockout days are UTC midnights. */
function formatBlockout(detail: string): string {
  const [from, to] = detail.split(" to ");
  if (!from || !to) return detail;

  const day = (key: string) => formatDayMonth(keyToDate(key));

  return from === to ? day(from) : `${day(from)} – ${day(to)}`;
}

/** The refusals worth rewording. Everything else is already a sentence. */
const REWORDED: [RegExp, string][] = [
  [/service type/i, "This organization has no service types yet — add one in Settings and try again."],
  [/upgrade/i, "This organization's plan no longer includes AI event drafting."],
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
    return "This isn't available right now. Try again in a few minutes.";
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
  /**
   * The draft was created for real — leave the screen. `eventId` is the new
   * event, so it can be opened; an older server leaves it out.
   */
  onCreated: (eventId?: string) => void;
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
  // Follows the reply to the bottom as it streams in, until somebody opens a
  // step above it to read: then the list stays where they are.
  const follow = useRef(true);
  const stopFollowing = () => {
    follow.current = false;
  };

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

  // Only the newest draft can be created or edited; earlier ones fold away so
  // nobody taps Create on a version they've already moved past.
  let latestDraftId: string | undefined;
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type === "tool-proposeEvent" &&
        part.state === "output-available" &&
        part.output.ok
      ) {
        latestDraftId = part.toolCallId;
      }
    }
  }

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming || !hasServiceTypes) return;
    setTimedOut(false);
    follow.current = true;
    sendMessage({ text });
    setInput("");
  };

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
                      <Markdown
                        key={index}
                        text={part.text}
                        streaming={part.state === "streaming"}
                      />
                    );
                  }

                  if (part.type === "tool-checkAvailability") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return isStreaming ? (
                          <AgentStep
                            key={index}
                            icon={UserSearch}
                            title="Checking who's available"
                            status="running"
                          />
                        ) : (
                          <AgentStep
                            key={index}
                            icon={UserSearch}
                            title="Stopped while checking who's available"
                            status="error"
                          />
                        );
                      case "output-available":
                        return (
                          <AgentStep
                            key={index}
                            icon={UserSearch}
                            title="Checked who's available"
                            description={`${part.output.roles.length} ${
                              part.output.roles.length === 1 ? "role" : "roles"
                            }`}
                            onToggle={stopFollowing}
                          >
                            <AvailabilityTrace
                              checked={part.output.roles}
                              onToggle={stopFollowing}
                            />
                          </AgentStep>
                        );
                      case "output-error":
                        return (
                          <AgentStep
                            key={index}
                            icon={UserSearch}
                            title="Couldn't check who's available"
                            status="error"
                          />
                        );
                      default:
                        return null;
                    }
                  }

                  if (part.type === "tool-proposeEvent") {
                    switch (part.state) {
                      case "input-streaming":
                      case "input-available":
                        return isStreaming ? (
                          <AgentStep
                            key={index}
                            icon={CalendarDays}
                            title="Building the draft"
                            status="running"
                          />
                        ) : (
                          <AgentStep
                            key={index}
                            icon={CalendarDays}
                            title="Stopped before the draft was built"
                            status="error"
                          />
                        );
                      case "output-available":
                        return part.output.ok ? (
                          <DraftCard
                            key={index}
                            draft={part.output.draft}
                            organizationId={organizationId}
                            onRefine={onRefine}
                            onCreated={onCreated}
                            latest={part.toolCallId === latestDraftId}
                          />
                        ) : (
                          // The server turned the draft down; the agent fixes it
                          // and proposes again, so this is a step, not a failure.
                          <AgentStep
                            key={index}
                            icon={RotateCcw}
                            title="Adjusting the draft"
                            onToggle={stopFollowing}
                          >
                            {part.output.error}
                          </AgentStep>
                        );
                      case "output-error":
                        return (
                          <AgentStep
                            key={index}
                            icon={CalendarDays}
                            title="Couldn't build that draft. Try rephrasing."
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
  latest,
}: {
  draft: EventDraft;
  organizationId: string;
  onRefine: (draft: EventDraft) => void;
  onCreated: (eventId?: string) => void;
  /** The newest draft in the chat: the only one that can be created or edited. */
  latest: boolean;
}) {
  const theme = useTheme();
  const roles = useRoles();
  const colors = getServiceColors(draft.serviceTypeColor, theme);
  const create = useCreateEvent(organizationId);

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [refined, setRefined] = useState(false);

  const kept = draft.assignments.filter((a) => !removed.has(a.userId));
  const locked = create.isPending || created;

  // Roles by team, each with whoever's in charge of it. A draft from an older
  // server carries no teams, which makes every team the drafter's.
  const groups = (
    draft.teams?.length
      ? draft.teams
      : roles.teamsOf(draft.rolesNeeded).map((team) => ({ team, name: "", you: true, cover: false }))
  )
    .map((entry) => ({
      ...entry,
      teamRoles: draft.rolesNeeded.filter((role) => roles.teamOf(role) === entry.team),
    }))
    .filter((entry) => entry.teamRoles.length > 0);

  // Whoever's in charge of a team the drafter isn't hears about it on Create.
  const told = [...new Set(groups.filter((entry) => !entry.you).map((entry) => entry.name))];

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
      rehearsal: draft.rehearsal,
      rolesNeeded: draft.rolesNeeded,
      roleSpots: draft.roleSpots,
      expiresAt: draft.expiresInDays,
      smartSchedulingEnabled: draft.smartSchedulingEnabled,
      roleAssignments,
      // Teams the draft handed to somebody for this event only.
      teamLeads: (draft.covers ?? []).map(({ team, userId }) => ({ team, userId })),
      // Anybody booked elsewhere since the draft was built is refused.
      refuseConflicts: true,
    };

    create.mutate(event, {
      onSuccess: (result) => {
        setCreated(true);
        onCreated(result.eventId);
      },
      onError: (failure) => setError(failureMessage(failure)),
    });
  };

  // An earlier version in the same chat: one line, nothing to press.
  if (!latest) {
    return (
      <AgentStep
        icon={History}
        title={`Earlier draft: ${draft.name}`}
        description={formatShortDate(keyToDate(draft.days[0].date))}
      />
    );
  }

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
          {draft.serviceTypeName.toLowerCase() !== draft.name.toLowerCase() ? (
            <Text className="text-[11.5px]" style={{ color: colors.text }}>
              {draft.serviceTypeName}
            </Text>
          ) : null}
        </VStack>
      </HStack>

      {/* The model's explanation rides on the card: it stops at the draft. */}
      {draft.summary ? (
        <Text className="text-[12.5px] leading-[18px] text-muted-foreground">{draft.summary}</Text>
      ) : null}

      <VStack className="gap-1">
        {draft.days.map((day) => (
          <HStack key={day.date} className="items-center gap-1.5">
            <AppIcon icon={CalendarDays} size={12} color={theme.textMuted} />
            <Text className="flex-1 text-[12.5px] text-muted-foreground">
              {`${formatShortDate(keyToDate(day.date))} · ${formatClock(day.startTime)} – ${formatClock(day.endTime)}`}
            </Text>
          </HStack>
        ))}
        {draft.rehearsal ? (
          <HStack className="items-center gap-1.5">
            <AppIcon icon={CalendarClock} size={12} color={theme.textMuted} />
            <Text className="flex-1 text-[12.5px] text-muted-foreground">
              {`Rehearsal ${formatShortDate(keyToDate(draft.rehearsal.date))} · ${formatClock(draft.rehearsal.startTime)} – ${formatClock(draft.rehearsal.endTime)}`}
            </Text>
          </HStack>
        ) : null}
        <HStack className="items-center gap-1.5">
          <AppIcon icon={MapPin} size={12} color={theme.textMuted} />
          <Text className="flex-1 text-[12.5px] text-muted-foreground" numberOfLines={1}>
            {draft.location}
          </Text>
        </HStack>
      </VStack>

      <VStack className="gap-3">
        {groups.map(({ team, name, you, cover, teamRoles }) => (
          <VStack key={team} className="gap-2">
            <HStack className="items-baseline justify-between gap-2">
              <Text className="text-[11px] font-bold uppercase tracking-[0.7px] text-muted-foreground">
                {roles.teamLabel(team)}
              </Text>
              <Text className="shrink text-[11px] text-muted-foreground" numberOfLines={1}>
                {you
                  ? cover
                    ? "You, covering"
                    : "You"
                  : cover
                    ? `${name}, covering`
                    : `${name} leads`}
              </Text>
            </HStack>

            {teamRoles.map((role) => {
              const people = kept.filter((assignment) => assignment.role === role);
              const { emoji, label } = roles.get(role);
              const spots = draft.roleSpots?.[role] ?? 1;

              return (
                <HStack key={role} className="items-start gap-2">
                  <Text style={{ fontSize: 13, lineHeight: 18 }}>{emoji}</Text>
                  <VStack className="flex-1 gap-0.5">
                    <Text className="text-[13px] font-medium text-foreground">
                      {label}
                      {spots > 1 ? (
                        <Text className="text-[12px] font-normal text-muted-foreground">
                          {` ×${spots}`}
                        </Text>
                      ) : null}
                      {people.length === 0 ? (
                        <Text className="text-[12px] font-normal text-muted-foreground">
                          {"  — left open"}
                        </Text>
                      ) : people.length < spots ? (
                        <Text className="text-[12px] font-normal text-muted-foreground">
                          {`  — ${spots - people.length} more open`}
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
        ))}
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
                {`${warning.name} skipped for ${roles.get(warning.role).label} — ${warning.reason}`}
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

      {!created && (kept.length > 0 || told.length > 0) ? (
        <Text className="text-center text-[11px] text-muted-foreground">
          {kept.length > 0
            ? `Sends ${kept.length === 1 ? "an invite" : "invites"} by email immediately${
                told.length > 0 ? ` and lets ${teamList(told)} know` : ""
              }`
            : `Lets ${teamList(told)} know`}
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

/**
 * Who's free for each role, and — opened — who can't serve and why. Folded
 * twice, like the dashboard's: the step opens to a line per role, and a role
 * opens to its names, so a big church's list only gets long where somebody
 * looks. The count is the people free, not everyone holding the role.
 */
function AvailabilityTrace({
  checked,
  onToggle,
}: {
  checked: AvailabilityRole[];
  /** A role opened or shut, which changes the chat's height above the reply. */
  onToggle: () => void;
}) {
  const roles = useRoles();

  return (
    <VStack className="gap-2">
      {checked.map((entry) => (
        <AgentStep
          key={entry.role}
          title={roles.get(entry.role).label}
          description={`${entry.eligible.length} free${
            entry.excluded.length > 0 ? ` · ${entry.excluded.length} can't` : ""
          }`}
          onToggle={onToggle}
        >
          {entry.excluded.length > 0 ? (
            <VStack className="gap-2">
              {entry.excluded.map((person, index) => (
                <AgentStep
                  key={`${person.name}-${index}`}
                  icon={person.reason === "blockout" ? CalendarOff : CalendarX2}
                  title={person.name}
                  description={
                    person.reason === "blockout"
                      ? `blocked out ${formatBlockout(person.detail)}`
                      : `serving ${person.detail}`
                  }
                />
              ))}
            </VStack>
          ) : null}
        </AgentStep>
      ))}
    </VStack>
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
