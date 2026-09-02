import Check from "lucide-react-native/icons/check";
import Search from "lucide-react-native/icons/search";
import SearchX from "lucide-react-native/icons/search-x";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Modal, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
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
 * a shape a phone does not have room for. They become sheets instead: the same
 * options, the same multi-select behaviour, one at a time.
 */

type SheetProps = {
  visible: boolean;
  onClose: () => void;
};

type SheetShellProps = SheetProps & {
  title: string;
  /** Shown top-left when there is something to clear. */
  onClear?: () => void;
  children: React.ReactNode;
};

/**
 * Modal and title bar. Everything below is the sheet's own, and unmounts when
 * the sheet closes — which is what lets the filter body hold a search term
 * without an effect to clear it again.
 */
function SheetShell({
  visible,
  onClose,
  title,
  onClear,
  children,
}: SheetShellProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      // Answers the hardware back button on Android and the swipe-down on iOS,
      // which otherwise close the sheet without telling the screen.
      onRequestClose={onClose}
    >
      <VStack
        className="flex-1"
        style={{ backgroundColor: theme.groupedBackground }}
      >
        <HStack
          className="items-center justify-between border-b px-4 py-3"
          style={{ borderColor: theme.border, backgroundColor: theme.card }}
        >
          <Pressable
            onPress={onClear}
            disabled={!onClear}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text
              className="text-[15px]"
              style={{ color: onClear ? theme.textMuted : "transparent" }}
            >
              Clear
            </Text>
          </Pressable>

          <Text className="text-[16px] font-semibold text-foreground">
            {title}
          </Text>

          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <Text
              className="text-[15px] font-semibold"
              style={{ color: brand.orange }}
            >
              Done
            </Text>
          </Pressable>
        </HStack>

        {children}
      </VStack>
    </Modal>
  );
}

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
      <HStack className="min-h-[46px] items-center gap-3">
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

type FilterSheetProps = SheetProps & {
  themes: FilterOption[];
  artists: FilterOption[];
  selectedThemes: Set<string>;
  selectedArtists: Set<string>;
  onToggleTheme: (theme: string) => void;
  onToggleArtist: (artist: string) => void;
  onClear: () => void;
};

/**
 * Theme and artist, in one sheet.
 *
 * Both are unions within themselves and an intersection between — the same rule
 * the web dropdowns follow, and the reason they sit together rather than behind
 * two separate buttons.
 */
export function FilterSheet({
  visible,
  onClose,
  onClear,
  ...options
}: FilterSheetProps) {
  const active = options.selectedThemes.size + options.selectedArtists.size;

  return (
    <SheetShell
      visible={visible}
      onClose={onClose}
      title="Filters"
      onClear={active > 0 ? onClear : undefined}
    >
      <FilterBody {...options} />
    </SheetShell>
  );
}

type FilterBodyProps = Omit<
  FilterSheetProps,
  "visible" | "onClose" | "onClear"
>;

function FilterBody({
  themes,
  artists,
  selectedThemes,
  selectedArtists,
  onToggleTheme,
  onToggleArtist,
}: FilterBodyProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [needle, setNeedle] = useState("");

  const visibleThemes = orderOptions(themes, selectedThemes, needle);
  const visibleArtists = orderOptions(artists, selectedArtists, needle);

  const nothing = visibleThemes.length === 0 && visibleArtists.length === 0;

  return (
    <>
      {/* Above the scroll, not in it: a few hundred options is exactly when the
          field must not be the first thing to disappear. */}
      <Box className="px-4 pb-1 pt-3">
        <HStack
          className="items-center gap-2 rounded-xl border px-3"
          style={{ borderColor: theme.border, backgroundColor: theme.card }}
        >
          <AppIcon icon={Search} size={16} color={theme.textMuted} />

          <TextInput
            value={needle}
            onChangeText={setNeedle}
            placeholder="Search themes and artists"
            placeholderTextColor={theme.textMuted}
            style={{
              flex: 1,
              fontSize: 15,
              paddingVertical: 10,
              color: theme.text,
            }}
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
      </Box>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {nothing ? (
          <VStack space="sm" className="flex-1 items-center justify-center">
            <AppIcon icon={SearchX} size={32} color={theme.textMuted} />
            <Text className="text-[15px] font-semibold text-foreground">
              No matches
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Nothing here is named for that.
            </Text>
          </VStack>
        ) : null}

        {visibleThemes.length > 0 ? (
          <>
            <GroupLabel>Theme</GroupLabel>
            <VStack>
              {visibleThemes.map((option) => (
                <OptionRow
                  key={option.value}
                  label={option.value}
                  count={option.count}
                  capitalize
                  selected={selectedThemes.has(option.value)}
                  onPress={() => onToggleTheme(option.value)}
                />
              ))}
            </VStack>
          </>
        ) : null}

        {visibleArtists.length > 0 ? (
          <>
            <GroupLabel>Artist</GroupLabel>
            <VStack>
              {visibleArtists.map((option) => (
                <OptionRow
                  key={option.value}
                  label={option.value}
                  count={option.count}
                  selected={selectedArtists.has(option.value)}
                  onPress={() => onToggleArtist(option.value)}
                />
              ))}
            </VStack>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

type SortSheetProps = SheetProps & {
  sort: SortKey;
  onSelect: (sort: SortKey) => void;
};

/** The three orders the web offers, in its order. */
export function SortSheet({
  visible,
  onClose,
  sort,
  onSelect,
}: SortSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <SheetShell visible={visible} onClose={onClose} title="Sort by">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <VStack>
          {SORT_OPTIONS.map((option) => (
            <SortRow
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            />
          ))}
        </VStack>
      </ScrollView>
    </SheetShell>
  );
}

/** Sorting has nothing to count, so it gets a row without the tally column. */
function SortRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="rounded-xl px-3 data-[active=true]:bg-border/60"
    >
      <HStack className="min-h-[46px] items-center gap-3">
        <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
        {selected ? (
          <AppIcon icon={Check} size={16} color={brand.orange} />
        ) : null}
      </HStack>
    </Pressable>
  );
}
