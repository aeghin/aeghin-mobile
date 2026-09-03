/**
 * The organization activity feed, as `GET .../activity?page=` carries it.
 * Mirrors `ActivityItem` in the NHC mobile route — additive-only.
 */

export type ActivityType =
  | "EVENT_CREATED"
  | "EVENT_DELETED"
  | "INVITE_SENT"
  | "INVITE_ACCEPTED"
  | "INVITE_DECLINED"
  | "INVITE_CANCELED"
  | "AUTO_INVITE_SENT"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "ROLE_CHANGED"
  | "SMART_FILL_SKIPPED"
  | "SMART_FILL_NO_CANDIDATES"
  | "SMART_FILL_ALL_UNAVAILABLE"
  | "SMART_FILL_FAILED"
  | "SMART_SCHEDULING_ENABLED"
  | "SMART_SCHEDULING_DISABLED";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  actorName: string | null;
  targetName: string | null;
  detail: string | null;
  /** Only good for linking to a live event; null once it is deleted. */
  eventId: string | null;
  eventName: string | null;
  /** ISO string. A real instant, read in device time. */
  createdAt: string;
};

export type ActivityPage = {
  items: ActivityItem[];
  page: number;
  totalPages: number;
};
