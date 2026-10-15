import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Building2 from "lucide-react-native/icons/building-2";
import ExternalLink from "lucide-react-native/icons/external-link";
import FileText from "lucide-react-native/icons/file-text";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Sparkles from "lucide-react-native/icons/sparkles";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { VStack } from "@/components/ui/vstack";
import { useBillingStatus } from "@/hooks/use-billing";
import { useTheme } from "@/hooks/use-theme";
import { MOBILE_PURCHASES_ENABLED } from "@/lib/config/purchases";
import { legalLinks } from "@/lib/config/links";
import { PLAN_NAMES, planOf } from "@/lib/config/plans";
import { getRoleConfig } from "@/lib/config/roles";

/**
 * The dashboard's Settings page, as a list of rows, opened from the foot of the
 * sidebar as the web's is.
 *
 * The sidebar holds the organization switcher, Blockouts, the Manage pages
 * (Templates, Activity, Service types, Staffing alerts) and your account, and
 * Invitations live on the Members tab beside the roster they change, so what
 * is left here is the organization's details, its plan and the legal links.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const role = organization ? getRoleConfig(organization.role, theme) : null;

  const billing = useBillingStatus(organizationId);
  const plan = PLAN_NAMES[planOf(billing.data)];

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + 24,
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
              <InsetRow
                icon={Sparkles}
                label={MOBILE_PURCHASES_ENABLED ? "Plans" : "Plan"}
                value={billing.data ? plan : undefined}
                onPress={() => router.push("/settings/billing")}
              />
            </InsetCard>
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
