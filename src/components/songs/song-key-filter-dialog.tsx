import ListFilter from "lucide-react-native/icons/list-filter";

import { Dialog } from "@/components/dialog";
import { GroupLabel, OptionRow } from "@/components/songs/song-dialogs";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import type { FilterOption } from "@/lib/songs/library";

type SongKeyFilterDialogProps = {
  visible: boolean;
  onClose: () => void;
  /** The keys you sing in, from `keysOf`. */
  keys: FilterOption[];
  /** The themes on your songs, from `themesOfKeys`. */
  themes: FilterOption[];
  selectedKeys: Set<string>;
  selectedThemes: Set<string>;
  /** How many of your songs carry a comment. */
  withComments: number;
  commentsOnly: boolean;
  onToggleKey: (key: string) => void;
  onToggleTheme: (theme: string) => void;
  onToggleComments: () => void;
  onClear: () => void;
};

/**
 * My keys' filters, in one dialog: the web page's Key and Theme dropdowns and
 * its With comments chip, which a phone has no room to set side by side.
 */
export function SongKeyFilterDialog({
  visible,
  onClose,
  keys,
  themes,
  selectedKeys,
  selectedThemes,
  withComments,
  commentsOnly,
  onToggleKey,
  onToggleTheme,
  onToggleComments,
  onClear,
}: SongKeyFilterDialogProps) {
  const active = selectedKeys.size + selectedThemes.size + (commentsOnly ? 1 : 0);

  return (
    <Dialog
      visible={visible}
      icon={ListFilter}
      title="Filters"
      description="Narrow your keys by the key you sing, a theme, or your comments."
      onClose={onClose}
    >
      {active > 0 ? (
        <Pressable onPress={onClear} accessibilityRole="button" className="self-start px-1">
          <Text className="text-[13px] font-semibold" style={{ color: brand.orange }}>
            {`Clear ${active} filter${active === 1 ? "" : "s"}`}
          </Text>
        </Pressable>
      ) : null}

      {withComments > 0 ? (
        <VStack>
          <GroupLabel>Comments</GroupLabel>
          <OptionRow
            label="With comments"
            count={withComments}
            selected={commentsOnly}
            onPress={onToggleComments}
          />
        </VStack>
      ) : null}

      {keys.length > 1 ? (
        <VStack>
          <GroupLabel>Your key</GroupLabel>
          {keys.map((option) => (
            <OptionRow
              key={option.value}
              label={option.value}
              count={option.count}
              selected={selectedKeys.has(option.value)}
              onPress={() => onToggleKey(option.value)}
            />
          ))}
        </VStack>
      ) : null}

      {themes.length > 0 ? (
        <VStack>
          <GroupLabel>Theme</GroupLabel>
          {themes.map((option) => (
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
      ) : null}
    </Dialog>
  );
}
