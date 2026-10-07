import { Stack, useRouter } from "expo-router";
import type { ReactNode } from "react";

import { HeaderCapsule } from "@/components/header-capsule";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

/**
 * `actions` are a screen's own controls, drawn ahead of the bell in the same
 * bar item so they keep its 8pt rhythm rather than UIKit's 16pt item gap.
 */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  const router = useRouter();
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
          {/* One item drawing two capsules: as separate items UIKit set them 16pt apart. */}
          <Stack.Toolbar.View hidesSharedBackground>
            <HStack className="items-center gap-2">
              {actions}
              <NotificationsBell />

              <Pressable
                onPress={() => router.push("/organizations")}
                accessibilityRole="button"
                accessibilityLabel={`${organization.name}. Switch organization.`}
                className="data-[active=true]:opacity-60"
              >
                <HeaderCapsule>
                  <OrgAvatar
                    name={organization.name}
                    logoUrl={organization.logoUrl}
                    size={32}
                    shape="circle"
                  />
                </HeaderCapsule>
              </Pressable>
            </HStack>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
