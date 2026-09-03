/**
 * The event chat, as `GET/POST .../events/:eventId/chat` and the Ably channel
 * carry it. Mirrors `lib/realtime/types.ts` and the mobile route's `ChatPage`
 * in the NHC repo — additive-only.
 */

export type ChatMessage = {
  id: string;
  body: string;
  /** ISO string. A real instant, read in device time. */
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    userImageUrl: string | null;
  };
};

export type ChatViewer = {
  userId: string;
  /** Accepted assignees write; owners and admins only watch. */
  canPost: boolean;
  firstName: string;
  lastName: string;
  userImageUrl: string | null;
};

/** One page of history, newest first, plus who is asking. */
export type ChatPage = {
  messages: ChatMessage[];
  nextCursor: string | null;
  viewer: ChatViewer;
};

export type PresenceMember = {
  clientId: string;
  firstName?: string;
  lastName?: string;
  userImageUrl?: string | null;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
