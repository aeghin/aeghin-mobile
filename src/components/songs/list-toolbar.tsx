import X from "lucide-react-native/icons/x";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

/**
 * The pieces of a narrowable song list's toolbar, shared by the Songs tab and
 * My keys: the Filters and Sort chips under the search field, and the chips
 * that name each active filter and take it off again.
 */

type ToolbarChipProps = {
  icon: AppIconName;
  label: string;
  count?: number;
  onPress: () => void;
};

export function ToolbarChip({ icon, label, count, onPress }: ToolbarChipProps) {
  const theme = useTheme();
  const active = (count ?? 0) > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 rounded-xl border px-3 py-2"
      style={{
        borderColor: active ? brand.orange : theme.border,
        backgroundColor: active ? withAlpha(brand.orange, 0.1) : theme.card,
      }}
    >
      <HStack className="items-center justify-center gap-1.5">
        <AppIcon
          icon={icon}
          size={13}
          color={active ? brand.orange : theme.textMuted}
        />
        <Text
          className="text-[13px] font-medium"
          numberOfLines={1}
          style={{ color: active ? brand.orange : theme.text }}
        >
          {label}
        </Text>
        {active ? (
          <Box
            className="min-w-[17px] items-center rounded-full px-1"
            style={{ backgroundColor: brand.orange }}
          >
            <Text className="text-[11px] font-bold text-white">{count}</Text>
          </Box>
        ) : null}
      </HStack>
    </Pressable>
  );
}

type RemovableChipProps = {
  label: string;
  capitalize?: boolean;
  onPress: () => void;
};

/** An active filter, and the tap that takes it off again. */
export function RemovableChip({ label, capitalize, onPress }: RemovableChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remove filter ${label}`}
      className="rounded-full border px-2.5 py-0.5"
      style={{ borderColor: theme.border, backgroundColor: theme.surface }}
    >
      <HStack className="items-center gap-1">
        <Text
          className={`text-[12px] font-medium text-foreground ${
            capitalize ? "capitalize" : ""
          }`}
        >
          {label}
        </Text>
        <AppIcon icon={X} size={10} color={theme.textMuted} />
      </HStack>
    </Pressable>
  );
}
