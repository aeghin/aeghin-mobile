/**
 * What tapping a push notification opens, as the server sends it in the
 * notification's `data`. Mirrors `PushData` in the NHC `lib/push/send.ts` —
 * additive-only, so a newer server can send a type this build predates.
 */
export type PushData =
  /** The event page. Only sent to people allowed to open it. */
  | { type: "event"; organizationId: string; eventId: string }
  /** An event invitation, answered from the Pending list. */
  | { type: "invitation"; organizationId: string; eventId: string }
  /** The organization's events, when there is no page left to open. */
  | { type: "organization"; organizationId: string }
  /** An invitation to join an organization. */
  | { type: "organization-invite"; token: string }
  /** A new message in the event's chat. Only sent to people on its team. */
  | { type: "chat"; organizationId: string; eventId: string };
