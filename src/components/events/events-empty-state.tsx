import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { Center } from "@/components/ui/center";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";

export type EmptyTone = "neutral" | "success" | "error";

type EventsEmptyStateProps = {
  symbol: AppSymbolName;
  title: string;
  body: string;
  tone?: EmptyTone;
  action?: { label: string; onPress: () => void };
};

/**
 * What a tab shows when its list comes back with nothing.
 *
 * It draws its own card rather than floating on the page: an empty region
 * between a filter bar and the tab bar reads as a failed render, while a
 * bordered panel reads as an answer.
 */
export function EventsEmptyState({
  symbol,
  title,
  body,
  tone = "neutral",
  action,
}: EventsEmptyStateProps) {
  const theme = useTheme();

  const accent =
    tone === "success"
      ? theme.success
      : tone === "error"
        ? theme.destructive
        : theme.textMuted;

  return (
    <VStack className="mx-4 items-center gap-2 rounded-2xl border border-border bg-card px-6 py-11">
      <Center
        className="mb-1 h-12 w-12 rounded-full"
        style={{ backgroundColor: withAlpha(accent, tone === "neutral" ? 0.1 : 0.14) }}
      >
        <AppSymbol name={symbol} size={22} tint={accent} />
      </Center>

      <Text className="text-[15px] font-semibold text-foreground">{title}</Text>

      <Text className="max-w-[260px] text-center text-[13px] leading-[18px] text-muted-foreground">
        {body}
      </Text>

      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          className="mt-2 rounded-full border border-border bg-surface px-4 py-2 data-[active=true]:opacity-60"
        >
          <Text className="text-[13px] font-semibold text-foreground">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </VStack>
  );
}
