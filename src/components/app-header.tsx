import { Stack, useRouter } from "expo-router";
import ChevronDown from "lucide-react-native/icons/chevron-down";

import { AppIcon } from "@/components/app-icon";
import { Logo } from "@/components/logo";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";

export function AppHeader() {
  const router = useRouter();
  const theme = useTheme();
  const { organization } = useCurrentOrganization();

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <HStack className="items-center gap-2">
            <Logo size={28} trim />
            <Text className="text-[22px] font-bold tracking-[-0.3px] text-brand">
              aeghin
            </Text>
          </HStack>
        </Stack.Toolbar.View>
      </Stack.Toolbar>

      {organization ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.View>
            <Pressable
              onPress={() => router.push("/organizations")}
              accessibilityRole="button"
              accessibilityLabel={`${organization.name}. Switch organization.`}
              className="data-[active=true]:opacity-60"
            >
              <HStack className="items-center gap-1.5">
                <OrgAvatar
                  name={organization.name}
                  logoUrl={organization.logoUrl}
                  size={26}
                />
                <Text
                  className="max-w-[150px] text-[15px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {organization.name}
                </Text>
                <AppIcon icon={ChevronDown} size={11} color={theme.textMuted} />
              </HStack>
            </Pressable>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
