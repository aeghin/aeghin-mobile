import { useUser } from "@clerk/expo";
import { useRouter, type Href } from "expo-router";
import Activity from "lucide-react-native/icons/activity";
import BellRing from "lucide-react-native/icons/bell-ring";
import CalendarOff from "lucide-react-native/icons/calendar-off";
import Check from "lucide-react-native/icons/check";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import LayoutGrid from "lucide-react-native/icons/layout-grid";
import LayoutTemplate from "lucide-react-native/icons/layout-template";
import Moon from "lucide-react-native/icons/moon";
import Settings from "lucide-react-native/icons/settings";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sun from "lucide-react-native/icons/sun";
import Tags from "lucide-react-native/icons/tags";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { planTint } from "@/components/events/ai-plan-cards";
import { Logo } from "@/components/logo";
import { OrgAvatar } from "@/components/org-avatar";
import { useCurrentOrganization } from "@/components/organization-provider";
import { useSidebar } from "@/components/sidebar";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useBillingStatus } from "@/hooks/use-billing";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/hooks/use-theme";
import { rememberColorScheme } from "@/lib/color-scheme";
import { PLAN_NAMES, planOf } from "@/lib/config/plans";
import { canManageOrg, getRoleConfig } from "@/lib/config/roles";
import { capitalizeName } from "@/lib/names";
import type { PaidPlan } from "@/types/billing";

/**
 * What the sidebar holds: the web dashboard's sidebar, less everything the tab
 * bar already has. Events, Songs, Members and notifications live in the tabs,
 * My keys in Songs, Invitations on Members, and creating an event or inviting
 * someone on the screen each one changes — so none of them appear here.
 * Service types and Staffing alerts join the web's Manage group. The foot is
 * you, then Settings and the light/dark switch as two icons; the plan sits by
 * the brand, where the web's top bar badges it.
 */
export function OrgSidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const roles = useRoles();
  const { isOpen, close, headerHeight } = useSidebar();
  const { organization, organizations, select } = useCurrentOrganization();
  const { setColorScheme } = useColorScheme();
  const billing = useBillingStatus(organization?.id ?? "");

  // The organization list folds away whenever the sidebar shuts.
  const [switching, setSwitching] = useState(false);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setSwitching(false);
  }

  // Another organization, chosen anywhere, opens on its own page, not here.
  const organizationId = organization?.id;
  useEffect(() => {
    close();
  }, [organizationId, close]);

  if (!organization) {
    return null;
  }

  // The page opens over the sidebar and goes back to it, as the old Settings
  // list did, so one page after another is back and a tap.
  const go = (href: Href) => {
    router.push(href);
  };

  const choose = (organizationId: string) => {
    select(organizationId);
    close();
  };

  const dark = theme.scheme === "dark";
  const toggleScheme = () => {
    const next = dark ? "light" : "dark";
    setColorScheme(next);
    rememberColorScheme(next);
  };

  // "Owner · Lead Vocalist, BGVs", as the web's switcher reads.
  const role = getRoleConfig(organization.role, theme).label;
  const serves = roles
    .inOrder(organization.volunteerRoles ?? [])
    .map((entry) => roles.get(entry).label);
  const subtitle = serves.length > 0 ? `${role} · ${serves.join(", ")}` : role;

  const name =
    capitalizeName([user?.firstName, user?.lastName].filter(Boolean).join(" ")) ||
    "Your account";
  const plan = planOf(billing.data);

  return (
    <VStack
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 6 }}
    >
      {/* As tall as the page's nav bar, so the rule under it meets the bar's
          line, as the web's brand row meets its top bar's. */}
      <HStack
        className="items-center gap-2.5 px-5"
        style={{ height: headerHeight ? headerHeight - insets.top : 52 }}
      >
        <Logo size={28} variant="tile" />
        <Text className="text-[19px] font-semibold tracking-[-0.4px] text-foreground">
          aeghin
        </Text>
        {plan === "free" ? null : <PlanBadge plan={plan} />}
      </HStack>

      <BarRule />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 12, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Filled as the web's switcher is on hover, since a phone has no hover. */}
        <Pressable
          onPress={() => setSwitching((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`${organization.name}, ${subtitle}. Switch organization.`}
          accessibilityState={{ expanded: switching }}
          className="rounded-xl bg-surface data-[active=true]:bg-input"
        >
          <HStack className="items-center gap-3 p-2.5">
            <OrgAvatar
              name={organization.name}
              logoUrl={organization.logoUrl}
              size={38}
            />
            <VStack className="flex-1">
              <Text
                className="text-[15.5px] font-semibold tracking-[-0.2px] text-foreground"
                numberOfLines={1}
              >
                {organization.name}
              </Text>
              <Text className="text-[12.5px] text-muted-foreground" numberOfLines={1}>
                {subtitle}
              </Text>
            </VStack>
            <AppIcon icon={ChevronsUpDown} size={16} color={theme.textMuted} />
          </HStack>
        </Pressable>

        {switching ? (
          <VStack className="mt-1.5 rounded-xl border border-border bg-popover p-1">
            {organizations.map((entry) => {
              const current = entry.id === organization.id;

              return (
                <Pressable
                  key={entry.id}
                  onPress={() => choose(entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={entry.name}
                  accessibilityState={{ selected: current }}
                  className="rounded-lg data-[active=true]:bg-foreground/5"
                >
                  <HStack className="h-11 items-center gap-2.5 px-2.5">
                    <OrgAvatar name={entry.name} logoUrl={entry.logoUrl} size={26} />
                    <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
                      {entry.name}
                    </Text>
                    {current ? <AppIcon icon={Check} size={17} color={theme.text} /> : null}
                  </HStack>
                </Pressable>
              );
            })}

            <Divider className="my-1" />

            <SidebarRow
              icon={LayoutGrid}
              label="All organizations"
              onPress={() => go("/organizations")}
            />
          </VStack>
        ) : null}

        <VStack className="mt-4 gap-0.5">
          <SidebarRow icon={CalendarOff} label="Blockouts" onPress={() => go("/blockouts")} />
        </VStack>

        {canManageOrg(organization.role) ? (
          <>
            <Text className="mx-2.5 mb-1.5 mt-5 text-[12px] font-medium text-muted-foreground">
              Manage
            </Text>
            <VStack className="gap-0.5">
              <SidebarRow
                icon={LayoutTemplate}
                label="Templates"
                onPress={() => go("/templates")}
              />
              <SidebarRow icon={Activity} label="Activity" onPress={() => go("/activity")} />
              <SidebarRow
                icon={Tags}
                label="Service types"
                onPress={() => go("/settings/service-types")}
              />
              {/* Owners change them; admins see them read-only. */}
              <SidebarRow
                icon={BellRing}
                label="Staffing alerts"
                onPress={() => go("/settings/notifications")}
              />
            </VStack>
          </>
        ) : null}
      </ScrollView>

      <BarRule />

      <HStack className="items-center gap-0.5 px-2.5 pt-2">
        <Pressable
          onPress={() => go("/account")}
          accessibilityRole="button"
          accessibilityLabel={`Account, ${name}`}
          className="flex-1 rounded-xl data-[active=true]:bg-foreground/5"
        >
          <HStack className="items-center gap-3 px-2.5 py-2">
            <OrgAvatar name={name} logoUrl={user?.imageUrl} size={34} shape="circle" />
            {/* One line however long the name: it ends in an ellipsis. */}
            <Text
              className="flex-1 text-[15px] font-semibold text-foreground"
              numberOfLines={1}
            >
              {name}
            </Text>
          </HStack>
        </Pressable>

        <Pressable
          onPress={() => go("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          className="h-10 w-10 items-center justify-center rounded-xl data-[active=true]:bg-foreground/5"
        >
          <AppIcon icon={Settings} size={20} color={theme.textMuted} />
        </Pressable>

        <Pressable
          onPress={toggleScheme}
          accessibilityRole="switch"
          accessibilityLabel="Dark mode"
          accessibilityState={{ checked: dark }}
          className="h-10 w-10 items-center justify-center rounded-xl data-[active=true]:bg-foreground/5"
        >
          <AppIcon icon={dark ? Moon : Sun} size={20} color={theme.textMuted} />
        </Pressable>
      </HStack>
    </VStack>
  );
}

/**
 * The hairline iOS draws under a nav bar — one pixel, black at 30% or white
 * at 15% — so the rule under the brand row carries the page's straight on.
 */
function BarRule() {
  const theme = useTheme();

  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor:
          theme.scheme === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.3)",
      }}
    />
  );
}

/** The organization's paid plan, badged in its colour as the web's top bar does. */
function PlanBadge({ plan }: { plan: PaidPlan }) {
  const theme = useTheme();
  const tint = planTint(plan, theme);

  return (
    <HStack
      className="ml-auto items-center gap-1 rounded-full border px-2 py-[3px]"
      style={{ backgroundColor: withAlpha(tint, 0.1), borderColor: withAlpha(tint, 0.3) }}
      accessible
      accessibilityLabel={`${PLAN_NAMES[plan]} plan`}
    >
      <AppIcon icon={Sparkles} size={12} color={tint} />
      <Text className="text-[12px] font-medium" style={{ color: tint }}>
        {PLAN_NAMES[plan]}
      </Text>
    </HStack>
  );
}

function SidebarRow({
  icon,
  label,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="rounded-[10px] data-[active=true]:bg-foreground/5"
    >
      <HStack className="h-11 items-center gap-3 px-2.5">
        <AppIcon icon={icon} size={19} color={theme.textMuted} />
        <Text className="flex-1 text-[15px] font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
      </HStack>
    </Pressable>
  );
}
