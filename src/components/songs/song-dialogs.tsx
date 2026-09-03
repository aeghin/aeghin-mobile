import ArrowUpDown from "lucide-react-native/icons/arrow-up-down";
import Check from "lucide-react-native/icons/check";
import ListFilter from "lucide-react-native/icons/list-filter";
import Search from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import {
  SORT_OPTIONS,
  orderOptions,
  type FilterOption,
  type SortKey,
} from "@/lib/songs/library";

/**
 * The library's pickers.
 *
 * The web puts theme, artist and sort in three dropdowns side by side, which is
 * a shape a phone does not have room for. They become dialogs instead: the same
 * options, the same multi-select behaviour, one at a time.
 */

type DialogProps = {
  visible: boolean;
  onClose: () => void;
};

type OptionRowProps = {
  label: string;
  /** How many songs this option leaves. */
  count: number;
  selected: boolean;
  onPress: () => void;
  /** Themes are stored lowercase and read better capitalised, artists do not. */
  capitalize?: boolean;
};

function OptionRow({
  label,
  count,
  selected,
  onPress,
  capitalize,
}: OptionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${count} song${count === 1 ? "" : "s"}`}
      className="rounded-xl px-3 data-[active=true]:bg-border/60"
    >
      <HStack className="min-h-[44px] items-center gap-3">
        <Text
          className={`flex-1 text-[15px] text-foreground ${
            capitalize ? "capitalize" : ""
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>

        {/* The count is why the order is what it is: it says at a glance which
            of these narrows the library and which names one song. */}
        <Text
          className="text-[13px] text-muted-foreground"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {count}
        </Text>

        <Box style={{ width: 16 }}>
          {selected ? (
            <AppIcon icon={Check} size={16} color={brand.orange} />
          ) : null}
        </Box>
      </HStack>
    </Pressable>
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

type FilterDialogProps = DialogProps & {
  themes: FilterOption[];
  artists: FilterOption[];
  selectedThemes: Set<string>;
  selectedArtists: Set<string>;
  onToggleTheme: (theme: string) => void;
  onToggleArtist: (artist: string) => void;
  onClear: () => void;
};

/**
 * Theme and artist, in one dialog.
 *
 * Both are unions within themselves and an intersection between — the same rule
 * the web dropdowns follow, and the reason they sit together rather than behind
 * two separate buttons.
 */
export function FilterDialog({
  visible,
  onClose,
  onClear,
  ...options
}: FilterDialogProps) {
  const theme = useTheme();
  const [needle, setNeedle] = useState("");

  const active = options.selectedThemes.size + options.selectedArtists.size;

  const visibleThemes = orderOptions(options.themes, options.selectedThemes, needle);
  const visibleArtists = orderOptions(options.artists, options.selectedArtists, needle);

  const nothing = visibleThemes.length === 0 && visibleArtists.length === 0;

  return (
    <Dialog
      visible={visible}
      icon={ListFilter}
      title="Filters"
      description="Narrow the library by theme or by who recorded it."
      onClose={onClose}
    >
      <HStack
        className="items-center gap-2 rounded-xl border px-3"
        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
      >
        <AppIcon icon={Search} size={16} color={theme.textMuted} />

        <TextInput
          value={needle}
          onChangeText={setNeedle}
          placeholder="Search themes and artists"
          placeholderTextColor={theme.textMuted}
          style={{ flex: 1, fontSize: 15, paddingVertical: 10, color: theme.text }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {needle ? (
          <Pressable
            onPress={() => setNeedle("")}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            hitSlop={8}
          >
            <AppIcon icon={X} size={14} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </HStack>

      {active > 0 ? (
        <Pressable onPress={onClear} accessibilityRole="button" className="self-start px-1">
          <Text className="text-[13px] font-semibold" style={{ color: brand.orange }}>
            {`Clear ${active} filter${active === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      ) : null}

      {nothing ? (
        <VStack space="sm" className="items-center py-8">
          <AppIcon icon={SearchX} size={30} color={theme.textMuted} />
          <Text className="text-[15px] font-semibold text-foreground">No matches</Text>
          <Text className="text-center text-[13px] text-muted-foreground">
            Nothing here is named for that.
          </Text>
        </VStack>
      ) : null}

      {visibleThemes.length > 0 ? (
        <VStack>
          <GroupLabel>Theme</GroupLabel>
          {visibleThemes.map((option) => (
            <OptionRow
              key={option.value}
              label={option.value}
              count={option.count}
              capitalize
              selected={options.selectedThemes.has(option.value)}
              onPress={() => options.onToggleTheme(option.value)}
            />
          ))}
        </VStack>
      ) : null}

      {visibleArtists.length > 0 ? (
        <VStack>
          <GroupLabel>Artist</GroupLabel>
          {visibleArtists.map((option) => (
            <OptionRow
              key={option.value}
              label={option.value}
              count={option.count}
              selected={options.selectedArtists.has(option.value)}
              onPress={() => options.onToggleArtist(option.value)}
            />
          ))}
        </VStack>
      ) : null}
    </Dialog>
  );
}

type SortDialogProps = DialogProps & {
  sort: SortKey;
  onSelect: (sort: SortKey) => void;
};

/** The three orders the web offers, in its order. */
export function SortDialog({ visible, onClose, sort, onSelect }: SortDialogProps) {
  return (
    <Dialog
      visible={visible}
      icon={ArrowUpDown}
      title="Sort by"
      description="How the library is ordered."
      onClose={onClose}
    >
      <VStack>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: sort === option.value }}
            className="rounded-xl px-3 data-[active=true]:bg-border/60"
          >
            <HStack className="min-h-[46px] items-center gap-3">
              <Text className="flex-1 text-[15px] text-foreground">{option.label}</Text>
              {sort === option.value ? (
                <AppIcon icon={Check} size={16} color={brand.orange} />
              ) : null}
            </HStack>
          </Pressable>
        ))}
      </VStack>
    </Dialog>
  );
}
