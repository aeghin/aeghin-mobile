import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AiProUpsell, AiUpgradeCard } from "@/components/events/ai-plan-cards";
import { AiSetlistPanel } from "@/components/events/ai-setlist-panel";
import { CatalogPicker } from "@/components/events/catalog-picker";
import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { SetlistDraftList } from "@/components/events/setlist-draft-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useBillingStatus } from "@/hooks/use-billing";
import { useEventDetails } from "@/hooks/use-events";
import { useSaveSetlist } from "@/hooks/use-setlist";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { EventSetlistSong } from "@/types/event";
import type { SetlistDraftSong } from "@/types/setlist";

const TAB_BAR_CLEARANCE = 64;

type Pane = "setlist" | "catalog" | "ai";

const toDraft = (song: EventSetlistSong): SetlistDraftSong => ({
  id: song.id,
  songId: song.songId,
  position: song.position,
  pitch: song.pitch,
  keyQuality: song.keyQuality,
  bpm: song.bpm,
  timeSignature: song.timeSignature,
  title: song.title,
  artist: song.artist,
  youtubeUrl: song.youtubeUrl,
  spotifyUrl: song.spotifyUrl,
});

/**
 * The dashboard's dedicated setlist editor page. Its three columns become
 * three panes: the draft, the catalog to pull from, and the AI assistant.
 */
export default function SetlistEditorScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const details = useEventDetails(organizationId, eventId ?? "");
  const theme = useTheme();

  if (details.isPending || !details.data) {
    return (
      <Box className="flex-1 items-center justify-center bg-grouped">
        <Stack.Screen options={{ title: "Setlist" }} />
        <Spinner color={theme.textMuted} />
      </Box>
    );
  }

  return (
    <Editor
      key={details.data.id}
      organizationId={organizationId}
      eventId={details.data.id}
      eventName={details.data.name}
      serviceColor={details.data.serviceType.color}
      initial={details.data.setlist.map(toDraft)}
    />
  );
}

function Editor({
  organizationId,
  eventId,
  eventName,
  serviceColor,
  initial,
}: {
  organizationId: string;
  eventId: string;
  eventName: string;
  serviceColor: string;
  initial: SetlistDraftSong[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = getServiceColors(serviceColor, theme);

  const billing = useBillingStatus(organizationId);
  const save = useSaveSetlist(organizationId, eventId);

  const [songs, setSongs] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pane, setPane] = useState<Pane>("setlist");

  const change = (next: SetlistDraftSong[]) => {
    setSongs(next);
    setDirty(true);
  };

  const canSave = dirty && songs.every((song) => song.bpm > 0 && song.timeSignature.trim());

  const submit = () =>
    save.mutate(songs, {
      onSuccess: () => router.back(),
      onError: (error) => Alert.alert("Couldn't save", failureMessage(error)),
    });

  const canUseAi = Boolean(billing.data?.hasPremium || billing.data?.hasPro);

  const segments: Segment<Pane>[] = [
    { value: "setlist", label: "Setlist", count: songs.length },
    { value: "catalog", label: "Catalog" },
    { value: "ai", label: canUseAi ? "AI" : "AI 🔒" },
  ];

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: eventName,
          headerBackTitle: "Event",
          headerRight: () => (
            <Pressable onPress={submit} disabled={!canSave || save.isPending} accessibilityRole="button" hitSlop={8}>
              {save.isPending ? (
                <Spinner size="small" color={brand.orange} />
              ) : (
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: canSave ? brand.orange : theme.textMuted }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Box className="px-4 pt-3">
          <SegmentedControl segments={segments} value={pane} onChange={setPane} />
        </Box>

        {pane === "ai" ? (
          <Box className="flex-1 px-4 pt-3" style={{ paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }}>
            {billing.isPending ? (
              <Box className="items-center py-10">
                <Spinner color={theme.textMuted} />
              </Box>
            ) : !canUseAi ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <AiUpgradeCard
                  organizationId={organizationId}
                  canSubscribe={billing.data?.canSubscribe ?? false}
                />
              </ScrollView>
            ) : (
              <VStack className="flex-1 gap-3">
                {!billing.data?.hasPro ? (
                  <AiProUpsell
                    organizationId={organizationId}
                    canSubscribe={billing.data?.canSubscribe ?? false}
                  />
                ) : null}
                <AiSetlistPanel
                  organizationId={organizationId}
                  eventId={eventId}
                  colors={colors}
                  onApply={(next) => {
                    change(next);
                    setPane("setlist");
                  }}
                />
              </VStack>
            )}
          </Box>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {pane === "setlist" ? (
              <SetlistDraftList songs={songs} colors={colors} onChange={change} />
            ) : (
              <CatalogPicker
                organizationId={organizationId}
                draftSongIds={new Set(songs.map((song) => song.songId))}
                colors={colors}
                onAdd={(song) => change([...songs, song])}
              />
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </VStack>
  );
}
