import { Stack, useRouter } from "expo-router";

import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { Logo } from "@/components/logo";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";

const CHEVRON: AppSymbolName = { ios: "chevron.down", android: "expand_more" };

/**
 * Every tab's header: the app on the left, the organization on the right.
 *
 * The two together are what stop a tab from being anonymous — one says whose
 * app this is, the other says which organization you are looking at. The centre
 * is deliberately empty: the tab bar already names the section, and a third
 * label would crowd both ends off the bar.
 *
 * `placement` defaults to `'bottom'`, which on iOS 26 means the *bottom*
 * toolbar. Both halves have to say `'left'` / `'right'` to land in the header.
 *
 * The switcher is a custom view rather than a `Stack.Toolbar.Menu`, because a
 * native `UIMenu` button cannot show a logo *and* a name: any icon on it — the
 * `Icon` child or the `icon` prop, SF Symbol or image alike — suppresses the
 * label, and image icons are not drawn at all, leaving iOS's default "…" glyph.
 * Verified both ways on device. Tapping this opens the picker instead, which
 * costs a tap over a menu but shows every organization's logo, role and member
 * count, and — unlike a `UIMenu` — can fall back to initials for the
 * organizations that have no `logoUrl` yet.
 */
export function AppHeader() {
  const router = useRouter();
  const theme = useTheme();
  const { organization } = useCurrentOrganization();

  return (
    <>
      <Stack.Toolbar placement="left">
        {/* `hidesSharedBackground` drops the glass capsule iOS 26 draws behind
            a bar item, so the wordmark sits directly on the bar. The switcher
            opposite keeps its capsule, because it is the one that is tappable. */}
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
                <AppSymbol name={CHEVRON} size={11} tint={theme.textMuted} />
              </HStack>
            </Pressable>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
