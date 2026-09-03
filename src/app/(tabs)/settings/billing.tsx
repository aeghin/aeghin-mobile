import { Stack, useLocalSearchParams } from "expo-router";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CreditCard from "lucide-react-native/icons/credit-card";
import Sparkles from "lucide-react-native/icons/sparkles";
import { useEffect, useRef } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { PLAN_COPY, PlanButton, planTint } from "@/components/events/ai-plan-cards";
import { EventsEmptyState } from "@/components/events/events-empty-state";
import { InsetCard, InsetRow, SectionLabel } from "@/components/inset-list";
import { useCurrentOrganization } from "@/components/organization-provider";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useBillingPortal, useBillingStatus } from "@/hooks/use-billing";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { AiPlan } from "@/types/billing";

const TAB_BAR_CLEARANCE = 64;

const FREE_FEATURES = [
  "Unlimited organizations, members, and events",
  "Event templates & service types",
  "Blockout dates & smart scheduling",
  "Song library with charts and audio",
  "Setlists & per-song assignments",
  "Event chat and email notifications",
];

/** The dashboard's pricing and billing section: what the organization has, and how to change it. */
export default function BillingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? "";

  const billing = useBillingStatus(organizationId);
  const portal = useBillingPortal(organizationId);

  // Stripe's return page deep-links here with what happened.
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!checkout || announced.current === checkout) return;
    announced.current = checkout;
    if (checkout === "success") {
      Alert.alert("You're all set", "Your AI plan is active. It can take a moment to show here.");
    }
  }, [checkout]);

  const status = billing.data;
  const current: AiPlan | null = status?.hasPro ? "pro" : status?.hasPremium ? "premium" : null;

  return (
    <VStack className="flex-1 bg-grouped">
      <Stack.Screen options={{ title: "AI plans", headerBackTitle: "Settings" }} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={billing.isRefetching}
            onRefresh={billing.refetch}
            tintColor={theme.textMuted}
            colors={[brand.orange]}
          />
        }
      >
        {billing.isError ? (
          <EventsEmptyState
            icon={CircleAlert}
            title="Couldn't load billing"
            body="Pull down to try again."
            tone="error"
          />
        ) : billing.isPending || !status ? (
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
                {current ? `AI Setlist ${PLAN_COPY[current].name}` : "Free plan"}
              </Text>
              <Text className="max-w-[300px] text-center text-[13px] text-muted-foreground">
                {current
                  ? `${organization?.name ?? "This organization"} can generate setlists with AI.`
                  : "Every scheduling feature is free. AI setlists are the only paid add-on."}
              </Text>
            </VStack>

            {current ? (
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

            <VStack>
              <SectionLabel>Plans</SectionLabel>
              <VStack className="gap-3">
                <PlanCard
                  name="Free"
                  price="$0 forever"
                  blurb="The whole platform, for every team."
                  features={FREE_FEATURES}
                  tint={theme.textMuted}
                  current={current === null}
                />
                {(["premium", "pro"] as AiPlan[]).map((plan) => (
                  <PlanCard
                    key={plan}
                    name={`AI Setlist ${PLAN_COPY[plan].name}`}
                    price={PLAN_COPY[plan].price}
                    blurb={PLAN_COPY[plan].blurb}
                    features={[...PLAN_COPY[plan].features, "Billed per organization"]}
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
                  ? "Checkout opens in your browser. Plans are per organization."
                  : "Only an organization owner can start or change a plan."}
              </Text>
            </VStack>
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
