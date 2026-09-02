import Search from "lucide-react-native/icons/search";
import { TextInput } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { useMembersSearch } from "@/components/members-search-provider";
import { HStack } from "@/components/ui/hstack";
import { useTheme } from "@/hooks/use-theme";

/**
 * The members search field, as it sits inside `NativeTabs.BottomAccessory`.
 *
 * The accessory *is* the surface — UIKit draws the liquid glass capsule around
 * whatever this renders. So there is no background, border or radius here: a
 * styled `Input` on top of the accessory would read as a second bar inside the
 * first. Only the magnifier and the text.
 *
 * The term comes from context rather than local state, because this component
 * is mounted twice at once. See {@link useMembersSearch}.
 */
export function MembersSearchField() {
  const theme = useTheme();
  const { query, setQuery } = useMembersSearch();

  return (
    <HStack className="h-full flex-1 items-center gap-2 px-4">
      <AppIcon
        icon={Search}
        size={17}
        color={theme.textMuted}
      />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search members"
        placeholderTextColor={theme.textMuted}
        style={{ flex: 1, fontSize: 17, color: theme.text }}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </HStack>
  );
}
