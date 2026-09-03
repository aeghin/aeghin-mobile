import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import ImageIcon from "lucide-react-native/icons/image";
import LogOut from "lucide-react-native/icons/log-out";
import Pencil from "lucide-react-native/icons/pencil";
import Trash2 from "lucide-react-native/icons/trash-2";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import {
  useDeleteOrganization,
  useLeaveOrganization,
  useOrganizationDetails,
  useRemoveLogo,
  useUpdateLogo,
  useUpdateOrganization,
} from "@/hooks/use-organizations";
import { formatShortDate } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import type { OrganizationInput } from "@/types/organization";

const TAB_BAR_CLEARANCE = 64;

/** The hero avatar, and the squircle radius `OrgAvatar` derives from that size. */
const LOGO_SIZE = 84;
const LOGO_RADIUS = LOGO_SIZE * 0.28;

/**
 * The dashboard's Settings tab for the organization itself: its name and
 * description, and the danger zone. Editing is the owner's — the server
 * refuses everyone else, so the row only appears for them.
 */
export default function OrganizationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { organization, organizations, select } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const isOwner = organization?.role === "OWNER";

  const details = useOrganizationDetails(organizationId);
  const leave = useLeaveOrganization(organizationId);
  const updateLogo = useUpdateLogo(organizationId);
  const removeLogo = useRemoveLogo(organizationId);

  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  const name = details.data?.name ?? organization?.name ?? "";
  const description = details.data?.description ?? organization?.description ?? "";

  // After leaving or deleting, the tabs need somewhere else to stand.
  const moveOn = () => {
    const next = organizations.find((candidate) => candidate.id !== organizationId);
    if (next) select(next.id);
    router.replace("/organizations");
  };

  /**
   * Picks a logo and sends it.
   *
   * Square by construction: the crop box is 1:1 and every avatar in the app
   * draws the result as a square, so cropping here is what stops the system
   * from centre-cropping something else later.
   */
  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photos access needed",
        "Allow photo access in Settings to choose a logo.",
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    }).catch(() => null);

    if (!picked || picked.canceled || picked.assets.length === 0) return;

    const asset = picked.assets[0];

    // Cropping rewrites the file, so the picker's own name is often missing;
    // the server only needs something to call it.
    const fileName = asset.fileName ?? `${name || "organization"}-logo.jpg`;

    updateLogo.mutate(
      { uri: asset.uri, name: fileName, type: asset.mimeType ?? "image/jpeg" },
      { onError: (error) => Alert.alert("Couldn't update logo", failureMessage(error)) },
    );
  };

  const confirmRemoveLogo = () =>
    Alert.alert("Remove logo", `${name} will show its initials instead.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeLogo.mutate(undefined, {
            onError: (error) => Alert.alert("Couldn't remove logo", failureMessage(error)),
          }),
      },
    ]);

  const openLogoActions = () => {
    if (!organization?.logoUrl) {
      pickLogo();
      return;
    }

    Alert.alert("Logo", undefined, [
      { text: "Choose a new one", onPress: pickLogo },
      { text: "Remove logo", style: "destructive", onPress: confirmRemoveLogo },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const logoBusy = updateLogo.isPending || removeLogo.isPending;

  const confirmLeave = () =>
    Alert.alert(
      "Leave organization",
      `You'll lose access to ${name}'s events and assignments until you're invited back.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () =>
            leave.mutate(undefined, {
              onSuccess: moveOn,
              onError: (error) => Alert.alert("Couldn't leave", failureMessage(error)),
            }),
        },
      ],
    );

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Organization", headerBackTitle: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        <VStack className="gap-5">
          <VStack className="items-center gap-2 pb-1">
            <Pressable
              onPress={isOwner ? openLogoActions : undefined}
              disabled={!isOwner || logoBusy}
              accessibilityRole={isOwner ? "button" : undefined}
              accessibilityLabel={isOwner ? "Change organization logo" : undefined}
            >
              <OrgAvatar name={name} logoUrl={organization?.logoUrl} size={LOGO_SIZE} elevated />
              {logoBusy ? (
                <VStack
                  className="absolute inset-0 items-center justify-center bg-black/45"
                  style={{ borderRadius: LOGO_RADIUS }}
                >
                  <Spinner size="small" color="#FFFFFF" />
                </VStack>
              ) : null}
            </Pressable>

            {isOwner ? (
              <Pressable onPress={openLogoActions} disabled={logoBusy} accessibilityRole="button">
                <HStack className="items-center gap-1">
                  <AppIcon icon={ImageIcon} size={13} color={brand.orange} />
                  <Text className="text-[13px] font-semibold" style={{ color: brand.orange }}>
                    {organization?.logoUrl ? "Change logo" : "Add a logo"}
                  </Text>
                </HStack>
              </Pressable>
            ) : null}

            <Text className="text-[22px] font-bold tracking-[-0.4px] text-foreground">{name}</Text>
            {details.data ? (
              <Text className="text-[12px] text-muted-foreground">
                {`${details.data.memberCount} ${details.data.memberCount === 1 ? "member" : "members"} · since ${formatShortDate(details.data.createdAt)}`}
              </Text>
            ) : null}
          </VStack>

          <VStack>
            <SectionLabel>Details</SectionLabel>
            <InsetCard elevated>
              <VStack className="gap-3 px-3.5 py-3">
                <VStack className="gap-0.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                    Name
                  </Text>
                  <Text className="text-[15px] text-foreground">{name}</Text>
                </VStack>
                <VStack className="gap-0.5">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                    Description
                  </Text>
                  <Text
                    className={`text-[15px] ${description ? "text-foreground" : "italic text-muted-foreground"}`}
                  >
                    {description || "No description added yet"}
                  </Text>
                </VStack>
              </VStack>
              {isOwner ? (
                <InsetRow icon={Pencil} label="Edit details" onPress={() => setDialog("edit")} />
              ) : null}
            </InsetCard>
          </VStack>

          <VStack>
            <SectionLabel>Danger zone</SectionLabel>
            <InsetCard elevated>
              <InsetRow icon={LogOut} label="Leave organization" onPress={confirmLeave} destructive />
              {isOwner ? (
                <InsetRow
                  icon={Trash2}
                  label="Delete organization"
                  onPress={() => setDialog("delete")}
                  destructive
                />
              ) : null}
            </InsetCard>
            <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
              {isOwner
                ? "Deleting removes every event, song and member. It can't be undone."
                : "The only owner can't leave; they'd need to transfer ownership or delete the organization."}
            </Text>
          </VStack>
        </VStack>
      </ScrollView>

      <EditDetailsDialog
        key={dialog === "edit" ? "edit" : "closed"}
        visible={dialog === "edit"}
        onClose={() => setDialog(null)}
        organizationId={organizationId}
        initial={{ name, description }}
      />
      <DeleteOrganizationDialog
        key={dialog === "delete" ? "delete" : "closed-delete"}
        visible={dialog === "delete"}
        onClose={() => setDialog(null)}
        organizationId={organizationId}
        name={name}
        onDeleted={moveOn}
      />
    </VStack>
  );
}

function EditDetailsDialog({
  visible,
  onClose,
  organizationId,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  initial: OrganizationInput;
}) {
  const update = useUpdateOrganization(organizationId);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const name = draft.name.trim();
  const ready = name.length >= 3 && name.length <= 20 && draft.description.trim().length <= 100;

  const submit = () => {
    setError(null);
    update.mutate(
      { name, description: draft.description.trim() },
      { onSuccess: onClose, onError: (failure) => setError(failureMessage(failure)) },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={Pencil}
      title="Edit details"
      action={{ label: "Save", onPress: submit, disabled: !ready }}
      submitting={update.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />
      <Field label="Organization name" hint="3 to 20 characters.">
        <FormInput
          value={draft.name}
          onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
          autoCapitalize="words"
          maxLength={20}
          autoFocus
        />
      </Field>
      <Field label="Description" hint="Up to 100 characters.">
        <FormInput
          value={draft.description}
          onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))}
          multiline
          maxLength={100}
        />
      </Field>
    </Dialog>
  );
}

/** The dashboard asks for the name typed back before it deletes; so does this. */
function DeleteOrganizationDialog({
  visible,
  onClose,
  organizationId,
  name,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  name: string;
  onDeleted: () => void;
}) {
  const remove = useDeleteOrganization(organizationId);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    remove.mutate(undefined, {
      onSuccess: () => {
        onClose();
        onDeleted();
      },
      onError: (failure) => setError(failureMessage(failure)),
    });
  };

  return (
    <Dialog
      visible={visible}
      icon={TriangleAlert}
      tone="destructive"
      title="Delete organization"
      description={`This permanently deletes ${name}, and every event, song, template, invitation and membership in it. Nobody can undo it.`}
      action={{ label: "Delete", onPress: submit, disabled: typed !== name }}
      submitting={remove.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />
      <Field label={`Type "${name}" to confirm`}>
        <FormInput
          value={typed}
          onChangeText={setTyped}
          placeholder={name}
          autoCapitalize="none"
          autoFocus
        />
      </Field>
    </Dialog>
  );
}
