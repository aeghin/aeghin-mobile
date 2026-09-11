import Palette from "lucide-react-native/icons/palette";
import { useState } from "react";

import { Dialog } from "@/components/dialog";
import { ErrorBanner, Field, FormInput } from "@/components/form-fields";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { useAddServiceType, useUpdateServiceType, type ServiceTypeInput } from "@/hooks/use-service-types";
import { useTheme } from "@/hooks/use-theme";
import { getServiceColors } from "@/lib/config/service-types";
import { failureMessage } from "@/lib/failure";
import type { ServiceType, ServiceTypeColor } from "@/types/event";

/**
 * Naming a kind of service, and picking the colour that tells it apart.
 *
 * Shared by the settings screen, where it is how the list is managed, and by
 * the event form, where the dashboard lets you add one without leaving the
 * page. Both need the same eight colours and the same 25-character name, so
 * they are the same dialog rather than two that have to be kept in step.
 */

/** The palette, character for character with the web's `SERVICE_TYPE_COLORS`. */
const COLORS: ServiceTypeColor[] = [
  "indigo",
  "amber",
  "emerald",
  "pink",
  "violet",
  "red",
  "blue",
  "cyan",
];

type ServiceTypeDialogProps = {
  visible: boolean;
  organizationId: string;
  /** Present to edit that one; absent to create a new one. */
  serviceType?: ServiceType;
  onClose: () => void;
  /**
   * The row that was just created. The event form takes it to select what it
   * asked for; the settings list, which only has to redraw, leaves it out.
   */
  onCreated?: (serviceType: ServiceType) => void;
};

export function ServiceTypeDialog({
  visible,
  organizationId,
  serviceType,
  onClose,
  onCreated,
}: ServiceTypeDialogProps) {
  const theme = useTheme();
  const add = useAddServiceType(organizationId);
  const update = useUpdateServiceType(organizationId);

  const [draft, setDraft] = useState<ServiceTypeInput>({
    name: serviceType?.name ?? "",
    color: serviceType?.color ?? "indigo",
  });
  const [error, setError] = useState<string | null>(null);

  const name = draft.name.trim();
  const ready = name.length > 0 && name.length <= 25;

  const submit = () => {
    setError(null);

    const onError = (failure: unknown) => setError(failureMessage(failure));

    if (serviceType) {
      update.mutate(
        { id: serviceType.id, name, color: draft.color },
        { onSuccess: onClose, onError },
      );
      return;
    }

    add.mutate(
      { name, color: draft.color },
      {
        onSuccess: ({ serviceType: created }) => {
          // The route answers `null` only if it could not read the row back.
          // Nothing to hand on then, but the write itself did land.
          if (created) onCreated?.(created);
          onClose();
        },
        onError,
      },
    );
  };

  return (
    <Dialog
      visible={visible}
      icon={Palette}
      title={serviceType ? "Edit service type" : "New service type"}
      description="Every event belongs to one. The colour is what tells them apart."
      action={{ label: "Save", onPress: submit, disabled: !ready }}
      submitting={add.isPending || update.isPending}
      onClose={onClose}
    >
      <ErrorBanner message={error} />

      <Field label="Name" hint="Up to 25 characters.">
        <FormInput
          value={draft.name}
          onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
          placeholder="Sunday Service"
          autoCapitalize="words"
          maxLength={25}
          autoFocus
        />
      </Field>

      <Field label="Colour">
        <HStack className="flex-wrap gap-2">
          {COLORS.map((color) => {
            const colors = getServiceColors(color, theme);
            const selected = draft.color === color;
            return (
              <Pressable
                key={color}
                onPress={() => setDraft((current) => ({ ...current, color }))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={color}
                className="items-center justify-center rounded-full"
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: colors.surface,
                  borderWidth: 2,
                  borderColor: selected ? colors.base : "transparent",
                }}
              >
                <Box className="h-5 w-5 rounded-full" style={{ backgroundColor: colors.base }} />
              </Pressable>
            );
          })}
        </HStack>
      </Field>
    </Dialog>
  );
}
