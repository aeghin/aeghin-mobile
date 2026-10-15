import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { blendOver, brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { PITCH_LABELS } from "@/lib/config/keys";
import type { KeyQuality, Pitch } from "@/types/song";

const SIZE = 52;

/** Text in the tile grows with Dynamic Type only this far, as the date tile's does. */
const MAX_SCALE = 1.3;

/**
 * Your key, set the way an event card sets its date: a tinted tile leading
 * the row, because it is the answer the list is opened for.
 */
export function KeyTile({ pitch, quality }: { pitch: Pitch; quality: KeyQuality }) {
  const theme = useTheme();
  const dark = theme.scheme === "dark";

  return (
    <VStack
      className="items-center justify-center border"
      style={{
        minWidth: SIZE,
        minHeight: SIZE,
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: blendOver(theme.card, brand.orange, dark ? 0.16 : 0.08),
        borderColor: blendOver(theme.card, brand.orange, dark ? 0.4 : 0.28),
        boxShadow: "0px 1px 0px rgba(0, 0, 0, 0.05)",
      }}
      accessible
      accessibilityLabel={`Your key, ${PITCH_LABELS[pitch]} ${quality === "MINOR" ? "minor" : "major"}`}
    >
      <Text
        className="text-[19px] font-bold leading-[22px] tracking-[-0.3px]"
        style={{ color: brand.orange }}
        maxFontSizeMultiplier={MAX_SCALE}
      >
        {PITCH_LABELS[pitch]}
      </Text>
      <Text
        className="text-[9.5px] font-bold uppercase leading-[12px] tracking-[0.6px] text-muted-foreground"
        maxFontSizeMultiplier={MAX_SCALE}
      >
        {quality === "MINOR" ? "minor" : "major"}
      </Text>
    </VStack>
  );
}
