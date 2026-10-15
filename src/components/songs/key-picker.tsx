import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import { PITCHES_BY_QUALITY, PITCH_LABELS, formatKey, respell } from "@/lib/config/keys";
import type { KeyQuality, Pitch } from "@/types/song";

const QUALITIES: Segment<KeyQuality>[] = [
  { value: "MAJOR", label: "Major" },
  { value: "MINOR", label: "Minor" },
];

/** Each quality has 14 spellings, so two rows of seven. */
const COLUMNS = 7;

type KeyPickerProps = {
  pitch: Pitch;
  quality: KeyQuality;
  onChange: (pitch: Pitch, quality: KeyQuality) => void;
};

/** Every key as one tap: major or minor, then the note. */
export function KeyPicker({ pitch, quality, onChange }: KeyPickerProps) {
  const theme = useTheme();
  const pitches = PITCHES_BY_QUALITY[quality];

  return (
    <VStack className="gap-2.5">
      <SegmentedControl
        segments={QUALITIES}
        value={quality}
        onChange={(next) => onChange(respell(pitch, next), next)}
      />

      {[pitches.slice(0, COLUMNS), pitches.slice(COLUMNS)].map((row, index) => (
        <HStack key={index} className="gap-1.5">
          {row.map((option) => {
            const selected = option === pitch;

            return (
              <Pressable
                key={option}
                onPress={() => onChange(option, quality)}
                accessibilityRole="radio"
                accessibilityLabel={formatKey(option, quality)}
                accessibilityState={{ selected }}
                className="flex-1 items-center justify-center rounded-[10px] border data-[active=true]:opacity-70"
                style={{
                  height: 40,
                  borderCurve: "continuous",
                  borderColor: selected ? brand.orange : theme.border,
                  backgroundColor: selected ? brand.orange : theme.card,
                }}
              >
                <Text
                  className="text-[14px] font-semibold"
                  style={{ color: selected ? "#FFFFFF" : theme.text }}
                  maxFontSizeMultiplier={1.2}
                >
                  {PITCH_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      ))}
    </VStack>
  );
}
