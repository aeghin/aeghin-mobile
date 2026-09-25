import Check from "lucide-react-native/icons/check";
import Sparkles from "lucide-react-native/icons/sparkles";
import { Alert } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Dialog } from "@/components/dialog";
import { PLAN_COPY, planTint } from "@/components/events/ai-plan-cards";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useStartCheckout } from "@/hooks/use-billing";
import { useTheme } from "@/hooks/use-theme";
import { MOBILE_PURCHASES_ENABLED } from "@/lib/config/purchases";
import { failureMessage } from "@/lib/failure";

/**
 * What the limit screens say Premium adds: the dashboard's list, less the lines
 * whose numbers the server only sends for the organization's own plan.
 */
const PREMIUM_PERKS = [
  "Unlimited members, songs and service types",
  "Smart Scheduling fills declines for you",
  "AI setlist generation from your song library",
  "Billed per organization, cancel anytime",
];

type PlanLimitDialogProps = {
  visible: boolean;
  icon: AppIconName;
  title: string;
  description: string;
  /** How to make room without changing plans, like cancelling a pending invite. */
  hint?: string;
  organizationId: string;
  organizationName: string;
  /** Owners only, as on every other upgrade surface. */
  canSubscribe: boolean;
  onClose: () => void;
};

/**
 * The dashboard's plan-limit screen, shown instead of a form a Free
 * organization can't use. While the app can't sell, it says how to make room
 * and who to ask; once it can, owners get the upgrade.
 */
export function PlanLimitDialog({
  visible,
  icon,
  title,
  description,
  hint,
  organizationId,
  organizationName,
  canSubscribe,
  onClose,
}: PlanLimitDialogProps) {
  const theme = useTheme();
  const checkout = useStartCheckout(organizationId);

  if (!MOBILE_PURCHASES_ENABLED) {
    const askOwner = canSubscribe
      ? undefined
      : `Ask an owner of ${organizationName} about raising the limit.`;

    return (
      <Dialog
        visible={visible}
        icon={icon}
        title={title}
        description={[description, hint, askOwner].filter(Boolean).join("\n\n")}
        onClose={onClose}
      />
    );
  }

  const tint = planTint("premium", theme);

  return (
    <Dialog
      visible={visible}
      icon={icon}
      title={title}
      description={description}
      action={
        canSubscribe
          ? {
              label: "Upgrade to Premium",
              onPress: () =>
                checkout.mutate("premium", {
                  onError: (error) =>
                    Alert.alert("Couldn't start checkout", failureMessage(error)),
                }),
            }
          : undefined
      }
      submitting={checkout.isPending}
      cancelLabel="Not now"
      onClose={onClose}
    >
      <VStack
        className="gap-2 rounded-xl border p-3"
        style={{ borderColor: withAlpha(tint, 0.2), backgroundColor: withAlpha(tint, 0.05) }}
      >
        <HStack className="items-center justify-between">
          <HStack className="items-center gap-1.5">
            <AppIcon icon={Sparkles} size={14} color={tint} />
            <Text className="text-[14px] font-semibold text-foreground">
              {PLAN_COPY.premium.name}
            </Text>
          </HStack>
          <Text className="text-[12px] text-muted-foreground">{PLAN_COPY.premium.price}</Text>
        </HStack>

        {PREMIUM_PERKS.map((perk) => (
          <HStack key={perk} className="items-start gap-2">
            <AppIcon icon={Check} size={14} color={tint} />
            <Text className="flex-1 text-[13px] text-foreground">{perk}</Text>
          </HStack>
        ))}
      </VStack>

      {hint ? (
        <Text className="text-center text-[12px] text-muted-foreground">{hint}</Text>
      ) : null}

      {!canSubscribe ? (
        <Text className="text-center text-[13px] text-muted-foreground">
          {`Only an owner can upgrade. Ask an owner of ${organizationName} to upgrade to Premium.`}
        </Text>
      ) : null}
    </Dialog>
  );
}
