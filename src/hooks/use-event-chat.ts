import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Ably from "ably";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiPost } from "@/lib/api";
import type {
  ChatMessage,
  ChatPage,
  ChatViewer,
  ConnectionStatus,
  PresenceMember,
} from "@/types/chat";

const chatPath = (orgId: string, eventId: string) =>
  `/api/mobile/v1/organizations/${orgId}/events/${eventId}/chat`;

/** The channel the NHC backend publishes each event's messages on. */
const channelName = (eventId: string) => `event:${eventId}:chat`;

export const chatKey = (
  userId: string | null | undefined,
  orgId: string,
  eventId: string,
) => ["organizations", userId, "event-chat", orgId, eventId];

/**
 * The first page of history plus the caller's standing — enough on its own
 * for the preview card on the event screen, which never opens a socket.
 */
export function useChatHistory(orgId: string, eventId: string, enabled = true) {
  const { userId } = useAuth();

  return useQuery({
    queryKey: chatKey(userId, orgId, eventId),
    enabled: Boolean(userId && orgId && eventId && enabled),
    queryFn: () => apiGet<ChatPage>(chatPath(orgId, eventId)),
  });
}

/** Oldest first, no id twice. Later entries win, so a persisted row replaces its optimistic twin. */
function mergeById(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const list of lists) {
    for (const message of list) byId.set(message.id, message);
  }
  return [...byId.values()];
}

export type UseEventChatReturn = {
  /** Oldest first. `null` until the first page has loaded. */
  messages: ChatMessage[] | null;
  viewer: ChatViewer | null;
  presence: PresenceMember[];
  status: ConnectionStatus;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  send: (body: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  hasMore: boolean;
  loadingOlder: boolean;
};

/**
 * The live chat for one event — the phone's twin of the dashboard's
 * `useEventChat`.
 *
 * History comes over REST and lives in React Query. Everything that arrives
 * after that — Ably broadcasts and the caller's own optimistic sends — is
 * held here and merged on top, id-deduped, so the echo of a message you sent
 * replaces its temporary copy rather than doubling it.
 *
 * Ably authenticates through `authCallback` rather than `authUrl`: the token
 * route wants a Clerk bearer, and Clerk's tokens live about a minute, so each
 * renewal has to fetch a fresh one rather than reuse a header captured once.
 */
export function useEventChat(orgId: string, eventId: string): UseEventChatReturn {
  const history = useChatHistory(orgId, eventId);
  const viewer = history.data?.viewer ?? null;

  const [live, setLive] = useState<ChatMessage[]>([]);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [presence, setPresence] = useState<PresenceMember[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // The cursor follows the first page until the caller pages back past it.
  const nextCursor = cursor === undefined ? (history.data?.nextCursor ?? null) : cursor;

  const messages = useMemo(() => {
    if (!history.data) return null;
    return mergeById(older, [...history.data.messages].reverse(), live);
  }, [history.data, older, live]);

  const canPost = viewer?.canPost ?? false;
  const me = useMemo(
    () =>
      viewer
        ? {
            id: viewer.userId,
            firstName: viewer.firstName,
            lastName: viewer.lastName,
            userImageUrl: viewer.userImageUrl,
          }
        : null,
    [viewer],
  );

  const upsert = useCallback((incoming: ChatMessage) => {
    setLive((current) =>
      current.some((message) => message.id === incoming.id)
        ? current
        : [...current, incoming],
    );
  }, []);

  useEffect(() => {
    // Nothing to connect as until the first page has said who we are.
    if (!me || !orgId || !eventId) return;

    const client = new Ably.Realtime({
      clientId: me.id,
      authCallback: (_params, callback) => {
        apiGet<Ably.TokenRequest>(`${chatPath(orgId, eventId)}/token`)
          .then((tokenRequest) => callback(null, tokenRequest))
          .catch((error: unknown) =>
            callback(error instanceof Error ? error.message : "Token request failed", null),
          );
      },
    });

    client.connection.on("connected", () => setStatus("connected"));
    client.connection.on("disconnected", () => setStatus("disconnected"));
    client.connection.on("suspended", () => setStatus("disconnected"));
    client.connection.on("failed", () => setStatus("disconnected"));

    const channel = client.channels.get(channelName(eventId));

    channel
      .subscribe("message", (message) => upsert(message.data as ChatMessage))
      .catch(() => {});

    const syncPresence = async () => {
      try {
        const members = await channel.presence.get();
        setPresence(
          members.map((member) => ({
            clientId: member.clientId,
            ...(member.data as Omit<PresenceMember, "clientId">),
          })),
        );
      } catch {
        // Not attached yet, or detached mid-teardown.
      }
    };

    channel.presence
      .subscribe(["enter", "leave", "present"], syncPresence)
      .catch(() => {});

    // Enter only after our own attach resolves — see the dashboard hook for
    // why entering an unattached channel leaks an uncatchable rejection.
    channel
      .attach()
      .then(async () => {
        if (canPost) {
          await channel.presence.enter({
            firstName: me.firstName,
            lastName: me.lastName,
            userImageUrl: me.userImageUrl,
          });
        }
        await syncPresence();
      })
      .catch(() => {});

    return () => {
      channel.unsubscribe();
      channel.presence.unsubscribe();
      if (canPost) channel.presence.leave().catch(() => {});
      client.close();
    };
  }, [orgId, eventId, canPost, me, upsert]);

  const send = useCallback(
    async (body: string) => {
      if (!me) throw new Error("Not connected yet.");

      const tempId = `temp-${Crypto.randomUUID()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        body,
        createdAt: new Date().toISOString(),
        author: me,
      };
      setLive((current) => [...current, optimistic]);

      try {
        const { message } = await apiPost<{ message: ChatMessage }>(
          chatPath(orgId, eventId),
          { body },
        );
        setLive((current) => [
          ...current.filter((entry) => entry.id !== tempId && entry.id !== message.id),
          message,
        ]);
      } catch (error) {
        setLive((current) => current.filter((entry) => entry.id !== tempId));
        throw error;
      }
    },
    [me, orgId, eventId],
  );

  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await apiGet<ChatPage>(
        `${chatPath(orgId, eventId)}?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setOlder((current) => mergeById([...page.messages].reverse(), current));
      setCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }, [nextCursor, loadingOlder, orgId, eventId]);

  return {
    messages,
    viewer,
    presence,
    status,
    isPending: history.isPending,
    isError: history.isError,
    refetch: history.refetch,
    send,
    loadOlder,
    hasMore: Boolean(nextCursor),
    loadingOlder,
  };
}

/** Expires the cached first page — for the preview card after a visit to the chat. */
export function useInvalidateChat(orgId: string, eventId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: chatKey(userId, orgId, eventId) }),
    [queryClient, userId, orgId, eventId],
  );
}
