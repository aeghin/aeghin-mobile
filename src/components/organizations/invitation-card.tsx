import { Pill } from "@/components/events/chips";
import { OrgAvatar } from "@/components/org-avatar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import { formatExpiry, todayKey } from "@/lib/events/format";
import type { PendingInvitation } from "@/types/organization";

export type InvitationAction = "accept" | "decline";

type InvitationCardProps = {
  invitation: PendingInvitation;
  /** Which button is mid-flight, if either. */
  busy?: InvitationAction;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * An organization asking you to join: who invited you, what they want you to
 * play, and how long the offer stands.
 *
 * The same two answers the dashboard's invite page offers, on the one screen a
 * person with no organizations can actually reach.
 */
export function InvitationCard({
  invitation,
  busy,
  onAccept,
  onDecline,
}: InvitationCardProps) {
  const { organization, invitedBy, volunteerRoles } = invitation;
  const expiry = formatExpiry(invitation.expiresAt, todayKey());
  const inviter = `${invitedBy.firstName} ${invitedBy.lastName}`.trim();

  return (
    <VStack className="gap-3 rounded-2xl border border-border bg-card p-3.5">
      <HStack className="items-center gap-3">
        <OrgAvatar
          name={organization.name}
          logoUrl={organization.logoUrl}
          size={44}
        />

        <VStack className="flex-1 gap-0.5">
          <Text
            className="text-[16px] font-semibold tracking-[-0.2px] text-foreground"
            numberOfLines={1}
          >
            {organization.name}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {inviter ? `Invited by ${inviter}` : "You've been invited"}
          </Text>
        </VStack>

        <Pill label={expiry.label} tone={expiry.urgent ? "warning" : "neutral"} />
      </HStack>

      {volunteerRoles.length > 0 ? (
        <HStack className="flex-wrap gap-1.5">
          {volunteerRoles.map((role) => {
            const { emoji, label } = getVolunteerRoleConfig(role);
            return (
              <HStack
                key={role}
                className="items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1"
              >
                <Text style={{ fontSize: 13, lineHeight: 17 }}>{emoji}</Text>
                <Text className="text-[12px] font-medium text-foreground">{label}</Text>
              </HStack>
            );
          })}
        </HStack>
      ) : null}

      <HStack className="gap-2.5">
        <AnswerButton
          label="Decline"
          onPress={onDecline}
          busy={busy === "decline"}
          disabled={busy !== undefined}
          variant="outline"
        />
        <AnswerButton
          label="Accept"
          onPress={onAccept}
          busy={busy === "accept"}
          disabled={busy !== undefined}
          accent={brand.orange}
        />
      </HStack>

      {organization.description ? (
        <Text className="text-[12.5px] text-muted-foreground" numberOfLines={2}>
          {organization.description}
        </Text>
      ) : null}

      <Text className="text-[11.5px] text-muted-foreground">
        {`${organization.memberCount} ${organization.memberCount === 1 ? "member" : "members"}`}
      </Text>
    </VStack>
  );
}

function AnswerButton({
  label,
  onPress,
  busy,
  disabled,
  variant = "solid",
  accent = brand.orange,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "solid" | "outline";
  accent?: string;
}) {
  const theme = useTheme();
  const outline = variant === "outline";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className="flex-1 items-center justify-center rounded-xl data-[active=true]:opacity-70"
      style={{
        height: 42,
        backgroundColor: outline ? theme.surface : accent,
        borderWidth: outline ? 1 : 0,
        borderColor: theme.border,
        opacity: disabled && !busy ? 0.5 : 1,
      }}
    >
      {busy ? (
        <Spinner size="small" color={outline ? theme.textMuted : "#FFFFFF"} />
      ) : (
        <Text
          className="text-[15px] font-semibold"
          style={{ color: outline ? theme.text : "#FFFFFF" }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
