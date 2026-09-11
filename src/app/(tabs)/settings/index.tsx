import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Activity from "lucide-react-native/icons/activity";
import Building2 from "lucide-react-native/icons/building-2";
import CalendarOff from "lucide-react-native/icons/calendar-off";
import ExternalLink from "lucide-react-native/icons/external-link";
import FileText from "lucide-react-native/icons/file-text";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import LayoutTemplate from "lucide-react-native/icons/layout-template";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Sparkles from "lucide-react-native/icons/sparkles";
import Tags from "lucide-react-native/icons/tags";
import UserRound from "lucide-react-native/icons/user-round";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useBillingStatus } from "@/hooks/use-billing";
import { useTheme } from "@/hooks/use-theme";
import { MOBILE_PURCHASES_ENABLED } from "@/lib/config/purchases";
import { legalLinks } from "@/lib/config/links";
import { canManageOrg, getRoleConfig } from "@/lib/config/roles";

const TAB_BAR_CLEARANCE = 64;

/**
 * The dashboard's settings, blockouts and activity tabs, as a list of rows —
 * plus the account screen Clerk draws.
 *
 * No organization row at the top: the header switcher already names the
 * current organization and opens the picker. Invitations are not here either:
 * they live on the Members tab, beside the roster they change.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);
  const role = organization ? getRoleConfig(organization.role, theme) : null;

  const billing = useBillingStatus(organizationId);
  const plan = billing.data?.hasPro ? "Pro" : billing.data?.hasPremium ? "Premium" : "Free";

  return (
    <VStack className="flex-1 bg-grouped">
      <AppHeader />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
      >
        <VStack className="gap-5">
          <VStack>
            <SectionLabel>Organization</SectionLabel>
            <InsetCard elevated>
              <InsetRow
                icon={Building2}
                label="Details"
                value={role?.label}
                onPress={() => router.push("/settings/organization")}
              />
              {canManage ? (
                <InsetRow
                  icon={Tags}
                  label="Service types"
                  onPress={() => router.push("/settings/service-types")}
                />
              ) : null}
              {canManage ? (
                <InsetRow
                  icon={LayoutTemplate}
                  label="Templates"
                  onPress={() => router.push("/settings/templates")}
                />
              ) : null}
              {canManage ? (
                <InsetRow
                  icon={Activity}
                  label="Activity"
                  onPress={() => router.push("/settings/activity")}
                />
              ) : null}
              <InsetRow
                icon={Sparkles}
                label={MOBILE_PURCHASES_ENABLED ? "AI plans" : "AI"}
                value={billing.data ? plan : undefined}
                onPress={() => router.push("/settings/billing")}
              />
            </InsetCard>
          </VStack>

          <VStack>
            <SectionLabel>You</SectionLabel>
            <InsetCard elevated>
              <InsetRow
                icon={CalendarOff}
                label="Blockout dates"
                onPress={() => router.push("/settings/blockouts")}
              />
              <InsetRow
                icon={UserRound}
                label="Account"
                value={user?.firstName ?? undefined}
                onPress={() => router.push("/settings/account")}
              />
            </InsetCard>
            <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
              Blockouts are per organization. Account covers your name, email, password and sign-out.
            </Text>
          </VStack>

          <VStack>
            <SectionLabel>About</SectionLabel>
            <InsetCard elevated>
              <InsetRow
                icon={ShieldCheck}
                label="Privacy Policy"
                trailing={ExternalLink}
                onPress={() => openLink(legalLinks.privacy)}
              />
              <InsetRow
                icon={FileText}
                label="Terms & Conditions"
                trailing={ExternalLink}
                onPress={() => openLink(legalLinks.terms)}
              />
              <InsetRow
                icon={LifeBuoy}
                label="Support"
                trailing={ExternalLink}
                onPress={() => openLink(legalLinks.support)}
              />
            </InsetCard>
          </VStack>
        </VStack>
      </ScrollView>
    </VStack>
  );
}

/**
 * Opens one of the public pages.
 *
 * In an in-app browser rather than by handing the URL to Safari: these are a
 * detour from settings, not a departure, and the reader comes straight back.
 * A failure is swallowed — there is nothing useful to say about a browser that
 * would not open, and an alert over a privacy policy helps nobody.
 */
function openLink(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
