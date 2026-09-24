import { Stack, useLocalSearchParams } from "expo-router";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CreditCard from "lucide-react-native/icons/credit-card";
import Sparkles from "lucide-react-native/icons/sparkles";
import { useCallback, useEffect, useRef } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { PLAN_COPY, PlanButton, planTint } from "@/components/events/ai-plan-cards";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useBillingPortal, useBillingStatus, usePlanUsage } from "@/hooks/use-billing";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { MOBILE_PURCHASES_ENABLED } from "@/lib/config/purchases";
import { canManageOrg } from "@/lib/config/roles";
import { formatDayMonth } from "@/lib/events/format";
import { failureMessage } from "@/lib/failure";
import { formatStorage } from "@/lib/storage";
import type { AiPlan, PlanLimits, PlanUsage } from "@/types/billing";

const TAB_BAR_CLEARANCE = 64;

/**
 * The dashboard's Free features. The caps come from the server, so a changed
 * number doesn't wait on an app release. The server only sends the org's own
 * plan, so pass `limits` only when that plan is Free.
 */
function freeFeatures(limits?: PlanLimits): string[] {
  return [
    "Create organizations, invite members, schedule events",
    limits?.members ? `Up to ${limits.members} members per organization` : "",
    "Event templates & service types",
    "Blockout dates",
    "Song library with charts and audio",
    limits?.songs ? `Up to ${limits.songs} songs in your library` : "",
    limits ? `${formatStorage(limits.storage)} of storage for charts and audio` : "",
    "Setlists & per-song assignments",
    "Event chat and email notifications",
    limits?.bulkEmails ? `${limits.bulkEmails} group emails a month` : "",
  ].filter(Boolean);
}

/** A paid plan's list, with what the server reports after its first line. */
function paidFeatures(plan: AiPlan, limits?: PlanLimits): string[] {
  const [first, ...rest] = PLAN_COPY[plan].features;

  return limits
    ? [
        first,
        `${formatStorage(limits.storage)} of storage for charts and audio`,
        limits.bulkEmails ? `${limits.bulkEmails} group emails a month` : "",
        limits.aiRuns ? `${limits.aiRuns} AI requests a month` : "",
        ...rest,
      ].filter(Boolean)
    : PLAN_COPY[plan].features;
}

/** The dashboard's pricing and billing section: what the organization has, and how to change it. */
export default function BillingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";
  const canManage = canManageOrg(organization?.role);

  const billing = useBillingStatus(organizationId);
  const usage = usePlanUsage(organizationId, canManage);
  const portal = useBillingPortal(organizationId);

  // A member never loads usage, and `refetch` would fetch it regardless.
  const refetchBilling = billing.refetch;
  const refetchUsage = usage.refetch;
  const refresh = useCallback(
    () => Promise.all([refetchBilling(), canManage ? refetchUsage() : null]),
    [refetchBilling, refetchUsage, canManage],
  );
  const pullToRefresh = usePullToRefresh(refresh);

  // Stripe's return page deep-links here with what happened.
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!checkout || announced.current === checkout) return;
    announced.current = checkout;
    if (checkout === "success") {
      Alert.alert("You're all set", "Your plan is active. It can take a moment to show here.");
    }
  }, [checkout]);

  const status = billing.data;
  const current: AiPlan | null = status?.hasPro ? "pro" : status?.hasPremium ? "premium" : null;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen
        options={{
          title: MOBILE_PURCHASES_ENABLED ? "Plans" : "Plan",
          headerBackTitle: "Settings",
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            {...pullToRefresh}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {billing.isLoadingError ? (
          <EventsEmptyState
            icon={CircleAlert}
            title="Couldn't load billing"
            body="Pull down to try again."
            tone="error"
          />
        ) : !status ? (
          <VStack className="items-center py-10">
            <Spinner color={theme.textMuted} />
          </VStack>
        ) : (
          <VStack className="gap-5">
            <VStack className="items-center gap-2 pb-1">
              <Center
                className="h-14 w-14 rounded-2xl"
                style={{ backgroundColor: withAlpha(current ? planTint(current, theme) : brand.orange, 0.12) }}
              >
                <AppIcon icon={Sparkles} size={26} color={current ? planTint(current, theme) : brand.orange} />
              </Center>
              <Text className="text-[20px] font-bold text-foreground">
                {current ? `${PLAN_COPY[current].name} plan` : "Free plan"}
              </Text>
              <Text className="max-w-[300px] text-center text-[13px] text-muted-foreground">
                {current
                  ? PLAN_COPY[current].blurb
                  : "Core scheduling for your team."}
              </Text>
            </VStack>

            {canManage && usage.data ? <UsageSection usage={usage.data} /> : null}

            {current && MOBILE_PURCHASES_ENABLED ? (
              <VStack>
                <SectionLabel>Subscription</SectionLabel>
                <InsetCard elevated>
                  {status.canSubscribe ? (
                    <InsetRow
                      icon={CreditCard}
                      label={portal.isPending ? "Opening…" : "Manage subscription"}
                      onPress={() =>
                        portal.mutate(undefined, {
                          onError: (error) => Alert.alert("Couldn't open billing", failureMessage(error)),
                        })
                      }
                    />
                  ) : (
                    <InsetRow icon={CreditCard} label="Managed by the organization owner" />
                  )}
                </InsetCard>
                <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
                  Update payment details, view invoices, or cancel.
                </Text>
              </VStack>
            ) : null}

            {!MOBILE_PURCHASES_ENABLED ? (
              <VStack>
                <SectionLabel>{current ? "Included" : "Your plan"}</SectionLabel>
                <InsetCard elevated>
                  <VStack className="gap-1.5 p-4">
                    {(current ? paidFeatures(current, status.limits) : freeFeatures(status.limits)).map((feature) => (
                      <HStack key={feature} className="items-start gap-2">
                        <AppIcon
                          icon={Check}
                          size={14}
                          color={current ? planTint(current, theme) : theme.textMuted}
                        />
                        <Text className="flex-1 text-[13px] text-foreground">{feature}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </InsetCard>
              </VStack>
            ) : (
            <VStack>
              <SectionLabel>Plans</SectionLabel>
              <VStack className="gap-3">
                <PlanCard
                  name="Free"
                  price="$0/month"
                  blurb="Core scheduling for your team."
                  features={freeFeatures(current === null ? status.limits : undefined)}
                  tint={theme.textMuted}
                  current={current === null}
                />
                {(["premium", "pro"] as AiPlan[]).map((plan) => (
                  <PlanCard
                    key={plan}
                    name={PLAN_COPY[plan].name}
                    price={PLAN_COPY[plan].price}
                    blurb={PLAN_COPY[plan].blurb}
                    features={[
                      ...paidFeatures(plan, current === plan ? status.limits : undefined),
                      "Billed per organization",
                    ]}
                    tint={planTint(plan, theme)}
                    current={current === plan}
                    action={
                      current === plan || (current === "pro" && plan === "premium") ? null : (
                        <PlanButton
                          organizationId={organizationId}
                          plan={plan}
                          canSubscribe={status.canSubscribe}
                          label={current === "premium" && plan === "pro" ? "Upgrade to Pro" : undefined}
                        />
                      )
                    }
                  />
                ))}
              </VStack>
              <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
                {status.canSubscribe
                  ? "Checkout opens in your browser. Plans are per organization, and AI usage is subject to plan limits."
                  : "Only an organization owner can start or change a plan. AI usage is subject to plan limits."}
              </Text>
            </VStack>
            )}
          </VStack>
        )}
      </ScrollView>
    </VStack>
  );
}

function PlanCard({
  name,
  price,
  blurb,
  features,
  tint,
  current,
  action,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  tint: string;
  current: boolean;
  action?: React.ReactNode;
}) {
  return (
    <VStack
      className="gap-3 rounded-2xl border border-border bg-card p-4"
      style={{ borderColor: current ? tint : undefined }}
    >
      <HStack className="items-start justify-between gap-2">
        <VStack className="flex-1">
          <Text className="text-[16px] font-bold text-foreground">{name}</Text>
          <Text className="text-[13px] text-muted-foreground">{blurb}</Text>
        </VStack>
        <VStack className="items-end">
          <Text className="text-[13px] font-semibold text-foreground">{price}</Text>
          {current ? (
            <Text className="text-[11px] font-semibold" style={{ color: tint }}>
              Current plan
            </Text>
          ) : null}
        </VStack>
      </HStack>

      <VStack className="gap-1.5">
        {features.map((feature) => (
          <HStack key={feature} className="items-start gap-2">
            <AppIcon icon={Check} size={14} color={tint} />
            <Text className="flex-1 text-[13px] text-foreground">{feature}</Text>
          </HStack>
        ))}
      </VStack>

      {action}
    </VStack>
  );
}

// From this share of a limit the row turns amber, as on the dashboard.
const WARN_AT = 0.8;

/** The dashboard's Plan & usage rows. Pending invites hold seats, so they fill the bar. */
function UsageSection({ usage }: { usage: PlanUsage }) {
  const { members, songs, storage, bulkEmails, aiRuns, resetsAt } = usage;

  const seatsUsed = members.used + members.pending;
  const invited = members.pending > 0 ? `${members.pending} invited · ` : "";
  const resets = resetsAt ? ` · Resets ${formatDayMonth(resetsAt)}` : "";

  return (
    <VStack>
      <SectionLabel>Usage</SectionLabel>
      <InsetCard elevated separatorInset={16}>
        <UsageRow
          label="Members"
          value={members.limit === null ? `${members.used}` : `${members.used} / ${members.limit}`}
          detail={
            members.limit === null
              ? `${invited}No limit`
              : `${invited}${seatsUsed >= members.limit ? "Limit reached" : `${members.limit - seatsUsed} left`}`
          }
          used={seatsUsed}
          limit={members.limit}
        />
        <UsageRow
          label="Songs"
          value={songs.limit === null ? `${songs.used}` : `${songs.used} / ${songs.limit}`}
          detail={
            songs.limit === null
              ? "No limit"
              : songs.used >= songs.limit
                ? "Limit reached"
                : `${songs.limit - songs.used} left`
          }
          used={songs.used}
          limit={songs.limit}
        />
        <UsageRow
          label="Storage"
          value={`${formatStorage(storage.used)} / ${formatStorage(storage.limit)}`}
          detail={
            storage.used >= storage.limit ? "Full" : `${formatStorage(storage.limit - storage.used)} left`
          }
          used={storage.used}
          limit={storage.limit}
        />
        {bulkEmails ? (
          <UsageRow
            label="Group emails this month"
            value={`${bulkEmails.used} / ${bulkEmails.limit}`}
            detail={`${
              bulkEmails.used >= bulkEmails.limit
                ? "Limit reached"
                : `${bulkEmails.limit - bulkEmails.used} left`
            }${resets}`}
            used={bulkEmails.used}
            limit={bulkEmails.limit}
          />
        ) : null}
        {/* Free has no AI, so there's no allowance to show. */}
        {aiRuns && aiRuns.limit > 0 ? (
          <UsageRow
            label="AI requests this month"
            value={`${aiRuns.used} / ${aiRuns.limit}`}
            detail={`${
              aiRuns.used >= aiRuns.limit ? "Limit reached" : `${aiRuns.limit - aiRuns.used} left`
            }${resets}`}
            used={aiRuns.used}
            limit={aiRuns.limit}
          />
        ) : null}
      </InsetCard>
      {members.limit !== null ? (
        <Text className="ml-1 mt-2 text-[12px] text-muted-foreground">
          Pending invites count toward the member limit.
        </Text>
      ) : null}
    </VStack>
  );
}

function UsageRow({
  label,
  value,
  detail,
  used,
  limit,
}: {
  label: string;
  value: string;
  detail: string;
  used: number;
  /** Null means no limit, and no bar. */
  limit: number | null;
}) {
  const theme = useTheme();
  const ratio = limit ? used / limit : 0;
  const warn = limit !== null && ratio >= WARN_AT;

  return (
    <VStack className="gap-1.5 px-4 py-3">
      <HStack className="items-baseline justify-between gap-2">
        <Text className="text-[15px] text-foreground">{label}</Text>
        <Text
          className={`text-[14px] ${warn ? "font-semibold" : "text-muted-foreground"}`}
          style={warn ? { color: theme.warning } : undefined}
        >
          {value}
        </Text>
      </HStack>
      {limit !== null ? (
        <Box
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: withAlpha(theme.textMuted, 0.18) }}
        >
          <Box
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, ratio * 100)}%` as const,
              backgroundColor: warn ? theme.warning : brand.orange,
            }}
          />
        </Box>
      ) : null}
      <Text className="text-[12px]" style={{ color: warn ? theme.warning : theme.textMuted }}>
        {detail}
      </Text>
    </VStack>
  );
}
