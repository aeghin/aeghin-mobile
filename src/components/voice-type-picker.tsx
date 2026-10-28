import { Choice } from "@/components/form-fields";
import { HStack } from "@/components/ui/hstack";
import { useRoles } from "@/hooks/use-roles";
import type { VoiceType } from "@/types/event";

type VoiceTypePickerProps = {
  selected: VoiceType | null;
  /** Null when the one already picked is tapped again. */
  onChange: (voiceType: VoiceType | null) => void;
};

/**
 * A singer's voice type as tappable chips, high to low, one at a time: the
 * volunteer role picker's chips, minus the emoji. Tapping the one already
 * picked clears it. Only offered to somebody holding a role that sings.
 */
export function VoiceTypePicker({ selected, onChange }: VoiceTypePickerProps) {
  const roles = useRoles();

  return (
    <HStack className="flex-wrap gap-1.5" accessibilityRole="radiogroup">
      {roles.voiceTypes.map((voiceType) => (
        <Choice
          key={voiceType}
          label={roles.voiceTypeLabel(voiceType)}
          selected={selected === voiceType}
          onPress={() => onChange(selected === voiceType ? null : voiceType)}
        />
      ))}
    </HStack>
  );
}
