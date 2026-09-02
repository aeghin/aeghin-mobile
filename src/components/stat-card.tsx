import { AppIcon, type AppIconName } from "@/components/app-icon";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";

export type Stat = {
  label: string;
  value: number;
  /** One short line under the number, for what the number counts. */
  description: string;
  icon: AppIconName;
};

/**
 * One figure from an organization's summary.
 *
 * Mirrors the web dashboard's `StatsCard`: label above a large tabular number,
 * a caption below, and a brand-tinted tile holding the icon on the right.
 */
export function StatCard({ label, value, description, icon }: Stat) {
  return (
    <Box className="flex-1 overflow-hidden rounded-2xl border border-border bg-card p-4">
      <HStack space="sm" className="items-start justify-between">
        <VStack className="flex-1 gap-1">
          <Text
            className="text-[13px] font-medium text-muted-foreground"
            numberOfLines={1}
          >
            {label}
          </Text>

          <Text className="text-[28px] font-bold leading-9 tracking-tight text-foreground">
            {value}
          </Text>

          <Text className="text-[11px] leading-4 text-muted-foreground" numberOfLines={2}>
            {description}
          </Text>
        </VStack>

        <Center className="h-10 w-10 rounded-xl bg-brand/10">
          <AppIcon icon={icon} size={19} color={brand.orange} />
        </Center>
      </HStack>
    </Box>
  );
}
