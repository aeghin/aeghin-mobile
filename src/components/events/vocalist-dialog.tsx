import Check from "lucide-react-native/icons/check";
import Mic from "lucide-react-native/icons/mic";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { FormCard } from "@/components/form-fields";
import { OrgAvatar } from "@/components/org-avatar";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useToggleVocalist } from "@/hooks/use-setlist";
import { useTheme } from "@/hooks/use-theme";
import { getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import type { ServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { EventDetailsAssignment, EventSetlistSong } from "@/types/event";

type VocalistDialogProps = {
  song: EventSetlistSong | null;
  onClose: () => void;
  organizationId: string;
  eventId: string;
  /** The event's roster; only accepted lead vocalists and BGVs are offered. */
  assignments: EventDetailsAssignment[];
  colors: ServiceColors;
};

/** The dashboard's vocalist popover: who is singing this one. */
export function VocalistDialog({
  song,
  onClose,
  organizationId,
  eventId,
  assignments,
  colors,
}: VocalistDialogProps) {
  const theme = useTheme();
  const toggle = useToggleVocalist(organizationId, eventId);

  const candidates = assignments.filter(
    (assignment) =>
      assignment.status === "ACCEPTED" &&
      (assignment.role === "LEAD_VOCALIST" || assignment.role === "BGVS"),
  );

  const assigned = new Set(song?.vocalists.map((person) => person.userId) ?? []);

  return (
    <Dialog
      visible={song !== null}
      icon={Mic}
      title="Vocalists"
      description={song ? `Who is singing ${song.title}.` : undefined}
      onClose={onClose}
    >
      {candidates.length === 0 ? (
        <Text className="py-6 text-center text-[13px] text-muted-foreground">
          No accepted vocalists to assign yet.
        </Text>
      ) : (
        <FormCard>
          {candidates.map((candidate, index) => {
            const isAssigned = assigned.has(candidate.userId);
            const name = `${candidate.user.firstName} ${candidate.user.lastName}`.trim();
            return (
              <VStack key={candidate.id}>
                {index > 0 ? <Divider style={{ marginLeft: 58 }} /> : null}
                <Pressable
                  onPress={() =>
                    song &&
                    toggle.mutate(
                      { setlistSongId: song.id, userId: candidate.userId, assign: !isAssigned },
                      { onError: (error) => Alert.alert("Couldn't update", failureMessage(error)) },
                    )
                  }
                  disabled={toggle.isPending}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isAssigned }}
                  className="data-[active=true]:bg-border/40"
                >
                  <HStack className="items-center gap-3 px-3 py-2.5">
                    <OrgAvatar name={name} logoUrl={candidate.user.userImageUrl} size={34} shape="circle" />
                    <VStack className="flex-1">
                      <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text className="text-[12px] text-muted-foreground">
                        {getVolunteerRoleConfig(candidate.role).label}
                      </Text>
                    </VStack>
                    <HStack
                      className="h-5 w-5 items-center justify-center rounded-full border"
                      style={{
                        borderColor: isAssigned ? colors.base : theme.border,
                        backgroundColor: isAssigned ? colors.base : "transparent",
                      }}
                    >
                      {isAssigned ? <AppIcon icon={Check} size={12} color="#FFFFFF" /> : null}
                    </HStack>
                  </HStack>
                </Pressable>
              </VStack>
            );
          })}
        </FormCard>
      )}
      <Text className="text-[12px] text-muted-foreground">
        Only people who accepted a Lead Vocalist or BGVs role on this event can be assigned.
      </Text>
    </Dialog>
  );
}
