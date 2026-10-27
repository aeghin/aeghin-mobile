import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TeamFillPanel } from "@/components/events/team-fill-panel";
import { KeyboardSpacer } from "@/components/keyboard-spacer";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useNowPlayingInset } from "@/components/track-player-provider";
import { Box } from "@/components/ui/box";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useEventDetails } from "@/hooks/use-events";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { fillableTeams } from "@/lib/events/fill";

const TAB_BAR_CLEARANCE = 64;

/**
 * Fill with AI for one event, opened from its row on the Team card. A
 * screen rather than a dialog: the chat needs the height, and the keyboard.
 *
 * The conversation lasts as long as the screen does. The teams to pick from
 * are the event's, re-read as invites land, but the panel stays put when they
 * fill up: its own Invite is what took them, and the chat carries on.
 */
export default function FillWithAiScreen() {
  const theme = useTheme();
  const roles = useRoles();
  const insets = useSafeAreaInsets();
  const nowPlayingInset = useNowPlayingInset();

  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");
  const event = details.data;

  // Read once per mount, like the Team card: "has this lapsed" must not flip mid-render.
  const [now] = useState(() => Date.now());

  const teams = event ? fillableTeams(event, roles, now) : [];

  // Any team the server says this viewer can fill, open or not, so the panel
  // stays put when its own Invite takes the last spot.
  const canFill = (event?.aiTeams?.length ?? 0) > 0;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Fill with AI", headerBackTitle: "Event" }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Box
          className="flex-1 px-4 pt-3"
          style={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset }}
        >
          {!event ? (
            details.isError ? (
              <Text className="py-10 text-center text-[13px] text-muted-foreground">
                {"Couldn't load the event. Go back and try again."}
              </Text>
            ) : (
              <Box className="items-center py-10">
                <Spinner color={theme.textMuted} />
              </Box>
            )
          ) : !canFill ? (
            <Text className="py-10 text-center text-[13px] text-muted-foreground">
              Nothing here for you to fill with AI right now.
            </Text>
          ) : (
            <TeamFillPanel
              organizationId={organizationId}
              eventId={event.id}
              eventName={event.name}
              colors={getServiceColors(event.serviceType.color, theme)}
              teams={teams}
            />
          )}
        </Box>

        {/* Lifts the composer on Android, where the avoiding view does
            nothing. Gives back the tab bar clearance under it, which would
            otherwise float it that far above the keyboard. */}
        <KeyboardSpacer inset={insets.bottom + TAB_BAR_CLEARANCE + nowPlayingInset - 8} />
      </KeyboardAvoidingView>
    </VStack>
  );
}
