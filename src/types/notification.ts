/**
 * The bell, as `GET /api/mobile/v1/notifications` carries it. Mirrors
 * `NotificationItem` in the NHC mobile route — additive-only.
 */

export type NotificationCategory =
  | "ROSTER_ATTENTION"
  | "AWAITING_RESPONSE"
  | "FULLY_STAFFED";

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  /** Open roles for ROSTER_ATTENTION; always 1 otherwise. */
  count: number;
  unread: boolean;
  eventId: string;
  eventName: string;
  organizationId: string;
  organizationName: string;
  /** ISO string. A real instant, read in device time. */
  updatedAt: string;
};

export type NotificationFeed = {
  items: NotificationItem[];
  unreadCount: number;
};
