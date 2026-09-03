import { useRouter } from "expo-router";
import ListMusic from "lucide-react-native/icons/list-music";
import Mail from "lucide-react-native/icons/mail";
import Pencil from "lucide-react-native/icons/pencil";
import Plus from "lucide-react-native/icons/plus";
import Settings2 from "lucide-react-native/icons/settings-2";
import Trash2 from "lucide-react-native/icons/trash-2";
import UserPlus from "lucide-react-native/icons/user-plus";
import Zap from "lucide-react-native/icons/zap";
import { useState } from "react";
import { Alert, Switch } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { AddRolesDialog } from "@/components/events/add-roles-dialog";
import { EmailTeamDialog } from "@/components/events/email-team-dialog";
import { DetailCard, DetailCardHeader } from "@/components/events/event-detail-parts";
import { InviteToEventDialog } from "@/components/events/invite-to-event-dialog";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useDeleteEvent, useSetSmartScheduling } from "@/hooks/use-events";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { EventDetails, VolunteerRole } from "@/types/event";

type EventManageCardProps = {
  organizationId: string;
  event: EventDetails;
};

/**
 * What the dashboard puts in the event header's buttons and menus, gathered
 * into one card for owners and admins.
 */
export function EventManageCard({ organizationId, event }: EventManageCardProps) {
  const theme = useTheme();
  const router = useRouter();

  const [dialog, setDialog] = useState<"invite" | "roles" | "email" | null>(null);

  const smart = useSetSmartScheduling(organizationId, event.id);
  const remove = useDeleteEvent(organizationId, event.id);

  const rosterRoles: VolunteerRole[] = [
    ...new Set([...event.rolesNeeded, ...event.assignments.map((assignment) => assignment.role)]),
  ];
  const acceptedCount = event.assignments.filter((a) => a.status === "ACCEPTED").length;

  const toggleSmart = (enabled: boolean) =>
    smart.mutate(enabled, {
      onError: (error) => Alert.alert("Couldn't update", failureMessage(error)),
    });

  const confirmDelete = () =>
    Alert.alert(
      "Delete event",
      `${event.name} and its roster, setlist and chat will be deleted. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate(undefined, {
              onSuccess: () => router.back(),
              onError: (error) => Alert.alert("Couldn't delete", failureMessage(error)),
            }),
        },
      ],
    );

  return (
    <>
      <DetailCard>
        <DetailCardHeader icon={Settings2} title="Manage" />

        <Divider />
        <Row
          icon={Pencil}
          label="Edit details"
          onPress={() => router.push(`/events/${event.id}/edit`)}
        />
        <Divider style={{ marginLeft: 42 }} />
        <Row
          icon={ListMusic}
          label="Edit setlist"
          onPress={() => router.push(`/events/${event.id}/setlist`)}
        />
        <Divider style={{ marginLeft: 42 }} />
        <Row icon={UserPlus} label="Invite volunteers" onPress={() => setDialog("invite")} />
        <Divider style={{ marginLeft: 42 }} />
        <Row icon={Plus} label="Add roles" onPress={() => setDialog("roles")} />
        <Divider style={{ marginLeft: 42 }} />
        <Row icon={Mail} label="Email team" onPress={() => setDialog("email")} />
        <Divider style={{ marginLeft: 42 }} />

        <HStack className="items-center gap-2.5 px-3.5 py-2">
          <AppIcon icon={Zap} size={18} color={theme.textMuted} />
          <VStack className="flex-1">
            <Text className="text-[15px] text-foreground">Smart scheduling</Text>
            <Text className="text-[12px] text-muted-foreground">
              A decline auto-invites the next available member.
            </Text>
          </VStack>
          <Switch
            value={event.smartSchedulingEnabled}
            onValueChange={toggleSmart}
            disabled={smart.isPending}
            trackColor={{ true: brand.orange }}
          />
        </HStack>

        <Divider style={{ marginLeft: 42 }} />
        <Row icon={Trash2} label="Delete event" onPress={confirmDelete} destructive />
      </DetailCard>

      <InviteToEventDialog
        visible={dialog === "invite"}
        onClose={() => setDialog(null)}
        organizationId={organizationId}
        eventId={event.id}
        rosterRoles={rosterRoles}
        assignments={event.assignments}
      />
      <AddRolesDialog
        visible={dialog === "roles"}
        onClose={() => setDialog(null)}
        organizationId={organizationId}
        eventId={event.id}
        existing={rosterRoles}
      />
      <EmailTeamDialog
        visible={dialog === "email"}
        onClose={() => setDialog(null)}
        organizationId={organizationId}
        eventId={event.id}
        acceptedCount={acceptedCount}
      />
    </>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const tint = destructive ? theme.destructive : theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="data-[active=true]:bg-border/40"
    >
      <HStack className="items-center gap-2.5 px-3.5 py-3">
        <AppIcon icon={icon} size={18} color={tint} />
        <Text
          className={`flex-1 text-[15px] ${destructive ? "text-destructive" : "text-foreground"}`}
        >
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
}
