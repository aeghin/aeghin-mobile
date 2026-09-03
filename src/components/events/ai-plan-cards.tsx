import Sparkles from "lucide-react-native/icons/sparkles";
import { Alert } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Button, ButtonText } from "@/components/ui/button";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useStartCheckout } from "@/hooks/use-billing";
import { useTheme } from "@/hooks/use-theme";
import { failureMessage } from "@/lib/failure";
import type { AiPlan } from "@/types/billing";

/** The dashboard's plan copy, word for word. */
export const PLAN_COPY: Record<AiPlan, { name: string; price: string; blurb: string; features: string[] }> = {
  premium: {
    name: "Premium",
    price: "$29.99/month",
    blurb: "Let AI build the setlist from your catalog.",
    features: [
      "AI setlist generation",
      "Matches themes, keys, and tempo arc",
      "Works strictly from your song catalog",
      "Apply proposals straight into the editor",
    ],
  },
  pro: {
    name: "Pro",
    price: "$39.99/month",
    blurb: "A stronger model that can research beyond your catalog.",
    features: [
      "Everything in Premium",
      "Upgraded, more capable AI model",
      "Web search for songs and artists",
      "Suggests songs you don't own yet",
    ],
  },
};

/** Premium is amber and Pro is violet on the dashboard; the same here. */
export function planTint(plan: AiPlan, theme: ReturnType<typeof useTheme>): string {
  return plan === "pro" ? theme.violet : theme.warning;
}

type PlanButtonProps = {
  organizationId: string;
  plan: AiPlan;
  canSubscribe: boolean;
  label?: string;
};

/** Starts Checkout for one plan, or explains why it can't. */
export function PlanButton({ organizationId, plan, canSubscribe, label }: PlanButtonProps) {
  const theme = useTheme();
  const checkout = useStartCheckout(organizationId);
  const tint = planTint(plan, theme);

  return (
    <Button
      onPress={() =>
        checkout.mutate(plan, {
          onError: (error) => Alert.alert("Couldn't start checkout", failureMessage(error)),
        })
      }
      disabled={checkout.isPending || !canSubscribe}
      className="rounded-xl"
      style={{ backgroundColor: tint, opacity: canSubscribe ? 1 : 0.5 }}
    >
      <ButtonText className="font-semibold text-white">
        {checkout.isPending ? "Opening…" : (label ?? `Get ${PLAN_COPY[plan].name}`)}
      </ButtonText>
    </Button>
  );
}

type AiUpgradeCardProps = {
  organizationId: string;
  canSubscribe: boolean;
};

/** The dashboard's AI Setlist Upgrade panel: no plan yet, pick one. */
export function AiUpgradeCard({ organizationId, canSubscribe }: AiUpgradeCardProps) {
  const theme = useTheme();

  return (
    <VStack className="gap-4 rounded-2xl border border-border bg-card p-4">
      <VStack className="items-center gap-2">
        <Center
          className="h-12 w-12 rounded-xl"
          style={{ backgroundColor: withAlpha(brand.orange, 0.12) }}
        >
          <AppIcon icon={Sparkles} size={24} color={brand.orange} />
        </Center>
        <Text className="text-[15px] font-semibold text-foreground">AI setlist generation</Text>
        <Text className="max-w-[280px] text-center text-[13px] text-muted-foreground">
          Describe the vibe and let AI build the setlist. Pick a plan to unlock it.
        </Text>
        {!canSubscribe ? (
          <Text className="text-center text-[12px] text-muted-foreground">
            Reach out to an organization owner to subscribe.
          </Text>
        ) : null}
      </VStack>

      {(["premium", "pro"] as AiPlan[]).map((plan) => {
        const copy = PLAN_COPY[plan];
        const tint = planTint(plan, theme);
        return (
          <VStack
            key={plan}
            className="gap-2 rounded-xl border p-3"
            style={{
              borderColor: withAlpha(tint, plan === "pro" ? 0.3 : 0.2),
              backgroundColor: withAlpha(tint, 0.05),
            }}
          >
            <HStack className="items-center justify-between">
              <Text className="text-[14px] font-semibold text-foreground">{copy.name}</Text>
              <HStack className="items-center gap-1">
                <Text className="text-[12px] text-muted-foreground">{copy.price}</Text>
                <AppIcon icon={Sparkles} size={14} color={tint} />
              </HStack>
            </HStack>
            <Text className="text-[12.5px] text-muted-foreground">{copy.blurb}</Text>
            <PlanButton organizationId={organizationId} plan={plan} canSubscribe={canSubscribe} />
          </VStack>
        );
      })}
    </VStack>
  );
}

/** The dashboard's Pro upsell, shown above the panel to a Premium organization. */
export function AiProUpsell({ organizationId, canSubscribe }: AiUpgradeCardProps) {
  const theme = useTheme();
  const tint = theme.violet;

  return (
    <HStack
      className="items-center gap-3 rounded-2xl border p-3"
      style={{ borderColor: withAlpha(tint, 0.3), backgroundColor: withAlpha(tint, 0.05) }}
    >
      <Center className="h-8 w-8 rounded-lg" style={{ backgroundColor: withAlpha(tint, 0.12) }}>
        <AppIcon icon={Sparkles} size={16} color={tint} />
      </Center>
      <VStack className="flex-1">
        <Text className="text-[13px] font-semibold text-foreground">Want sharper setlists?</Text>
        <Text className="text-[12px] text-muted-foreground">
          Pro uses a smarter model and can pull ideas from the web.
          {!canSubscribe ? " Ask an organization owner to upgrade." : ""}
        </Text>
      </VStack>
      <PlanButton
        organizationId={organizationId}
        plan="pro"
        canSubscribe={canSubscribe}
        label="Upgrade"
      />
    </HStack>
  );
}

/**
 * The gate on the create screen's AI pane. Event drafting is Pro alone — the
 * route reads `ai_pro` and nothing else — so unlike the setlist's two-plan
 * picker there is only ever one thing to offer here.
 */
export function AiEventUpgradeCard({ organizationId, canSubscribe }: AiUpgradeCardProps) {
  const theme = useTheme();
  const tint = planTint("pro", theme);

  return (
    <VStack
      className="gap-3 rounded-2xl border p-4"
      style={{ borderColor: withAlpha(tint, 0.3), backgroundColor: withAlpha(tint, 0.05) }}
    >
      <VStack className="items-center gap-2">
        <Center className="h-12 w-12 rounded-xl" style={{ backgroundColor: withAlpha(tint, 0.12) }}>
          <AppIcon icon={Sparkles} size={24} color={tint} />
        </Center>
        <Text className="text-[15px] font-semibold text-foreground">Draft events with AI</Text>
        <Text className="max-w-[280px] text-center text-[13px] text-muted-foreground">
          Describe the event and it picks the dates and the people from your roster — you
          approve. Part of {PLAN_COPY.pro.name}, {PLAN_COPY.pro.price}.
        </Text>
        {!canSubscribe ? (
          <Text className="text-center text-[12px] text-muted-foreground">
            Reach out to an organization owner to subscribe.
          </Text>
        ) : null}
      </VStack>

      <PlanButton organizationId={organizationId} plan="pro" canSubscribe={canSubscribe} />
    </VStack>
  );
}
