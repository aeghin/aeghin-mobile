import { Choice } from "@/components/form-fields";
import { HStack } from "@/components/ui/hstack";
import {
  getVolunteerRoleConfig,
  ROLE_ORDER,
} from "@/lib/config/volunteer-roles";
import type { VolunteerRole } from "@/types/event";

type VolunteerRolePickerProps = {
  selected: VolunteerRole[];
  onToggle: (role: VolunteerRole) => void;
  /** Roles that cannot be picked — already on the event, say. */
  disabled?: VolunteerRole[];
  /** Narrows the set on offer; defaults to all twelve. */
  roles?: VolunteerRole[];
  /** One at a time rather than many. */
  single?: boolean;
};

/**
 * The twelve volunteer roles as tappable chips, in roster order.
 *
 * Every form that names a role uses this — inviting somebody to the
 * organization, opening a slot on an event, editing what a member can do — so
 * the same guitar means the same thing on each.
 */
export function VolunteerRolePicker({
  selected,
  onToggle,
  disabled = [],
  roles = ROLE_ORDER,
  single = false,
}: VolunteerRolePickerProps) {
  return (
    <HStack className="flex-wrap gap-1.5" accessibilityRole={single ? "radiogroup" : undefined}>
      {roles.map((role) => {
        const { label, emoji } = getVolunteerRoleConfig(role);
        return (
          <Choice
            key={role}
            label={label}
            leading={emoji}
            selected={selected.includes(role)}
            disabled={disabled.includes(role)}
            onPress={() => onToggle(role)}
          />
        );
      })}
    </HStack>
  );
}

/** Toggles one role in a list, or replaces the list when picking one at a time. */
export function toggleRole(
  current: VolunteerRole[],
  role: VolunteerRole,
  single = false,
): VolunteerRole[] {
  if (single) return current.includes(role) ? [] : [role];
  return current.includes(role)
    ? current.filter((entry) => entry !== role)
    : [...current, role];
}
