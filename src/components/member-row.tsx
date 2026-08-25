import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { OrgAvatar } from "@/components/org-avatar";
import { useTheme } from "@/hooks/use-theme";
import { getRoleConfig } from "@/lib/config/roles";
import type { OrganizationMember } from "@/types/organization";

const AVATAR = 44;
const PADDING = 14;
const GAP = 12;

/** Feed this to a `Card` so its hairlines start at the text, not the avatar. */
export const MEMBER_SEPARATOR_INSET = PADDING + AVATAR + GAP;

type MemberRowProps = {
  member: OrganizationMember;
  /** Marks the signed-in user's own row. */
  isYou?: boolean;
};

/**
 * One person inside the roster `Card`.
 *
 * Draws no surface of its own — the `Card` owns the background, the rounding
 * and the separators.
 */
export function MemberRow({ member, isYou }: MemberRowProps) {
  const theme = useTheme();
  const { firstName, lastName, email, imageUrl, role } = member;

  const { symbol, label, foreground } = getRoleConfig(role, theme);

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;

  return (
    <View style={styles.row}>
      {/* People read as circles; the squircle is for organization logos. The
          clip lives here so `OrgAvatar` keeps one shape for both callers. */}
      <View style={styles.avatar}>
        <OrgAvatar name={fullName} logoUrl={imageUrl} size={AVATAR} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {isYou ? "You" : fullName}
        </Text>

        <Text
          style={[styles.email, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {email}
        </Text>
      </View>

      {/* Tinted text rather than a filled pill: owner and admin still carry
          colour, while "Member" recedes instead of shouting on every row. */}
      <View style={styles.role}>
        <SymbolView
          name={{
            ios: symbol.ios,
            android: symbol.android,
            web: symbol.android,
          }}
          size={12}
          tintColor={foreground}
          fallback={<View />}
        />
        <Text style={[styles.roleLabel, { color: foreground }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    paddingHorizontal: PADDING,
    paddingVertical: 11,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: "hidden",
  },
  body: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  email: {
    fontSize: 13,
  },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  skeletonBody: {
    flex: 1,
    gap: 7,
  },
  skeletonBar: {
    borderRadius: 4,
  },
});

/** Widths cycle so a column of placeholders reads as names, not as a grid. */
const SKELETON_WIDTHS = [
  { name: 150, email: 200 },
  { name: 120, email: 175 },
  { name: 168, email: 215 },
];

/**
 * A placeholder row, sized to match a real one.
 *
 * Shown while the roster loads so the screen keeps the list's shape instead of
 * flashing empty — the fetch is short, and a void that size reads as breakage.
 */
export function MemberRowSkeleton({ index = 0 }: { index?: number }) {
  const theme = useTheme();
  const opacity = usePulse();

  const width = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];
  const bar = { backgroundColor: theme.border, opacity };

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.avatar, bar]} />

      <View style={styles.skeletonBody}>
        <Animated.View
          style={[styles.skeletonBar, bar, { width: width.name, height: 13 }]}
        />
        <Animated.View
          style={[styles.skeletonBar, bar, { width: width.email, height: 11 }]}
        />
      </View>

      <Animated.View
        style={[styles.skeletonBar, bar, { width: 58, height: 13 }]}
      />
    </View>
  );
}

/** A slow opacity breath. Native-driven, so the fetch never stutters it. */
function usePulse() {
  // useState, not useRef: the compiler's lint bans reading `.current` during
  // render, and the lazy initialiser gives the same construct-once behaviour.
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}
