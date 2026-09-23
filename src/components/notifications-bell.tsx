import { useRouter } from "expo-router";
import Bell from "lucide-react-native/icons/bell";

import { AppIcon } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useNotifications } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";

/**
 * One feed for every organization, like the dashboard's. The badge stays inside
 * the button's box: the native bar can clip anything outside a toolbar item.
 */
export function NotificationsBell() {
  const router = useRouter();
  const theme = useTheme();
  const { data } = useNotifications();

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      // The badge truncates at 9+; the label carries the real number.
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
      }
      hitSlop={6}
      className="data-[active=true]:opacity-60"
    >
      <Box className="h-8 w-8 items-center justify-center">
        <AppIcon icon={Bell} size={20} color={theme.text} />

        {unreadCount > 0 ? (
          <Center className="absolute right-0 top-0 h-4 min-w-4 rounded-full bg-brand px-1">
            <Text className="text-[10px] font-semibold leading-[12px] text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </Center>
        ) : null}
      </Box>
    </Pressable>
  );
}
