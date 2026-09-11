import Check from "lucide-react-native/icons/check";
import ListFilter from "lucide-react-native/icons/list-filter";
import type { ReactNode } from "react";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { getRoleConfig } from "@/lib/config/roles";
import { ROLE_ORDER, getVolunteerRoleConfig } from "@/lib/config/volunteer-roles";
import {
  ORG_ROLE_ORDER,
  activeFilterCount,
  roleCounts,
  volunteerRoleCounts,
  type RoleFilter,
  type RosterFilters,
  type VolunteerFilter,
} from "@/lib/members/roster";
import type { OrganizationMember } from "@/types/organization";

/**
 * The roster's two pickers, in one dialog.
 *
 * The web puts role and volunteer role in dropdowns beside the search field, a
 * shape a phone does not have room for. They become one sheet instead: the same
 * two lists, the same single-select behaviour, reached from the search dock.
 *
 * Both are radios rather than checkboxes — the web dropdowns hold one value
 * each, and "ALL" is its own row rather than an absence, so clearing one filter
 * is a tap in the same list rather than a hunt for a reset.
 */

type MemberFilterDialogProps = {
  visible: boolean;
  onClose: () => void;
  /** The whole roster, so the counts describe the organization, not the view. */
  members: OrganizationMember[];
  filters: RosterFilters;
  onChangeRole: (role: RoleFilter) => void;
  onChangeVolunteerRole: (role: VolunteerFilter) => void;
  onClear: () => void;
};

export function MemberFilterDialog({
  visible,
  onClose,
  members,
  filters,
  onChangeRole,
  onChangeVolunteerRole,
  onClear,
}: MemberFilterDialogProps) {
  const theme = useTheme();

  const byRole = roleCounts(members);
  const byVolunteerRole = volunteerRoleCounts(members);
  const active = activeFilterCount(filters);

  // Only the roles somebody actually holds. Listing all twelve would bury the
  // four this organization uses under eight that return nobody.
  const volunteerRoles = ROLE_ORDER.filter((role) => byVolunteerRole.has(role));

  return (
    <Dialog
      visible={visible}
      icon={ListFilter}
      title="Filters"
      description="Narrow the roster by what someone is, or by what they play."
      onClose={onClose}
    >
      {active > 0 ? (
        <Pressable onPress={onClear} accessibilityRole="button" className="self-start px-1">
          <Text className="text-[13px] font-semibold" style={{ color: brand.orange }}>
            {`Clear ${active} filter${active === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      ) : null}

      <VStack>
        <GroupLabel>Role</GroupLabel>

        <OptionRow
          label="All roles"
          count={members.length}
          selected={filters.role === "ALL"}
          onPress={() => onChangeRole("ALL")}
        />

        {ORG_ROLE_ORDER.map((role) => {
          const { icon, label, tint } = getRoleConfig(role, theme);
          return (
            <OptionRow
              key={role}
              label={label}
              leading={<AppIcon icon={icon} size={15} color={tint} />}
              count={byRole[role]}
              selected={filters.role === role}
              onPress={() => onChangeRole(role)}
            />
          );
        })}
      </VStack>

      <VStack>
        <GroupLabel>Volunteer role</GroupLabel>

        <OptionRow
          label="All volunteer roles"
          count={members.length}
          selected={filters.volunteerRole === "ALL"}
          onPress={() => onChangeVolunteerRole("ALL")}
        />

        {volunteerRoles.length === 0 ? (
          <Text className="px-3 py-2 text-[13px] text-muted-foreground">
            Nobody has a volunteer role yet.
          </Text>
        ) : (
          volunteerRoles.map((role) => {
            const { emoji, label } = getVolunteerRoleConfig(role);
            return (
              <OptionRow
                key={role}
                label={label}
                // Emoji ignore `color` and clip against a tight line box, so
                // this one carries its own metrics rather than inheriting.
                leading={<Text style={{ fontSize: 15, lineHeight: 19 }}>{emoji}</Text>}
                count={byVolunteerRole.get(role) ?? 0}
                selected={filters.volunteerRole === role}
                onPress={() => onChangeVolunteerRole(role)}
              />
            );
          })
        )}
      </VStack>
    </Dialog>
  );
}

/** The small uppercase caption above each group of options. */
function GroupLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1 ml-3 mt-3 text-xs font-bold uppercase tracking-[0.7px] text-muted-foreground">
      {children}
    </Text>
  );
}

type OptionRowProps = {
  label: string;
  /** How many members this option leaves. */
  count: number;
  selected: boolean;
  onPress: () => void;
  /**
   * The org role's glyph or the volunteer role's emoji, already drawn. A node
   * rather than an icon name because the two are not the same kind of thing —
   * lucide colours through a prop, an emoji carries its own.
   */
  leading?: ReactNode;
};

function OptionRow({ label, count, selected, onPress, leading }: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? "member" : "members"}`}
      className="rounded-xl px-3 data-[active=true]:bg-border/60"
    >
      <HStack className="min-h-[44px] items-center gap-3">
        {/* Fixed width whether or not there is a glyph, so the "All" row's
            label lines up with the named ones under it. */}
        <Box className="items-center" style={{ width: 18 }}>
          {leading}
        </Box>

        <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
          {label}
        </Text>

        <Text
          className="text-[13px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {count}
        </Text>

        <Box style={{ width: 16 }}>
          {selected ? <AppIcon icon={Check} size={16} color={brand.orange} /> : null}
        </Box>
      </HStack>
    </Pressable>
  );
}
