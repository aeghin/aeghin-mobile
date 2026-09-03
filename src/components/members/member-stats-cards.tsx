import { useState } from "react";
import Svg, { Circle } from "react-native-svg";

import { SegmentedControl, type Segment } from "@/components/events/segmented-control";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import type { MemberSong, MemberStats, RangeStats } from "@/types/organization";

/**
 * The two cards the dashboard's member profile is built around: how often this
 * person says yes, and what they sing most.
 *
 * The web animates the ring and the bars in. Nothing here does — these sit
 * inside a screen that is already scrolled to, so a ring that fills on arrival
 * would mostly play off screen, and a count that spins up reads as loading
 * rather than as a number.
 */

const RING_SIZE = 152;
const RING_STROKE = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type RangeKey = "all" | "year";

export function MemberAcceptanceCard({ stats }: { stats: MemberStats }) {
  const theme = useTheme();
  const [range, setRange] = useState<RangeKey>("all");

  const active: RangeStats = stats[range];

  const percent = active.invited
    ? Math.round((active.accepted / active.invited) * 100)
    : 0;

  const segments: Segment<RangeKey>[] = [
    { value: "all", label: "All time" },
    { value: "year", label: "This year" },
  ];

  const caption =
    active.invited === 0
      ? `No invites ${range === "year" ? "this year" : "yet"}`
      : `${range === "year" ? new Date().getFullYear() : "All time"} · ${active.invited} ${active.invited === 1 ? "invite" : "invites"}`;

  return (
    <VStack className="gap-3 rounded-2xl border border-border bg-card p-4">
      <SegmentedControl segments={segments} value={range} onChange={setRange} />

      <VStack className="items-center py-1">
        <Box style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              stroke={theme.border}
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              stroke={brand.orange}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
              // Zero degrees is east on an SVG circle; the arc has to start at
              // the top for a progress ring to read as one.
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>

          <VStack className="absolute inset-0 items-center justify-center">
            <HStack className="items-baseline">
              <Text
                className="text-[38px] font-bold tracking-[-1px] text-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {percent}
              </Text>
              <Text className="text-[19px] font-semibold text-muted-foreground">%</Text>
            </HStack>
            <Text className="text-[11px] tracking-[0.4px] text-muted-foreground">accepted</Text>
          </VStack>
        </Box>
      </VStack>

      <HStack className="gap-3 border-t border-border pt-3">
        <Stat label="Invited" value={active.invited} dot={theme.text} />
        <Stat label="Accepted" value={active.accepted} dot={brand.orange} />
        <Stat label="Declined" value={active.declined} dot={theme.textMuted} />
      </HStack>

      <Text className="text-[12px] text-muted-foreground">{caption}</Text>
    </VStack>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <VStack className="flex-1 gap-0.5">
      <HStack className="items-center gap-1.5">
        <Box className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        <Text className="text-[12px] text-muted-foreground">{label}</Text>
      </HStack>
      <Text
        className="text-[20px] font-bold text-foreground"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </VStack>
  );
}

export function MemberTopSongsCard({ songs }: { songs: MemberSong[] }) {
  const theme = useTheme();

  // The longest bar is the most-sung song rather than a fixed scale, so the
  // shape of the list reads the same whether the top count is 3 or 30.
  const most = Math.max(1, ...songs.map((song) => song.count));

  return (
    <VStack className="gap-2 rounded-2xl border border-border bg-card p-4">
      <HStack className="items-center justify-between">
        <Text className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
          Top 5 songs
        </Text>
        <Text className="text-[12px] text-muted-foreground">All time</Text>
      </HStack>

      {songs.length === 0 ? (
        <Text className="py-6 text-center text-[13px] text-muted-foreground">
          No songs performed yet.
        </Text>
      ) : (
        songs.map((song, index) => (
          <VStack key={`${song.title}-${song.artist}`} className="gap-1.5 pt-2">
            <HStack className="items-center gap-3">
              <Text
                className="text-[14px] font-bold text-muted-foreground/60"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {String(index + 1).padStart(2, "0")}
              </Text>
              <VStack className="flex-1">
                <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                  {song.title}
                </Text>
                <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                  {song.artist}
                </Text>
              </VStack>
              <HStack className="items-baseline">
                <Text
                  className="text-[17px] font-bold text-foreground"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {song.count}
                </Text>
                <Text className="text-[11px] font-medium text-muted-foreground">×</Text>
              </HStack>
            </HStack>

            <Box
              className="ml-9 h-1 overflow-hidden rounded-full"
              style={{ backgroundColor: theme.border }}
            >
              <Box
                className="h-full rounded-full"
                style={{
                  width: `${(song.count / most) * 100}%`,
                  backgroundColor: withAlpha(brand.orange, 0.85),
                }}
              />
            </Box>
          </VStack>
        ))
      )}
    </VStack>
  );
}
