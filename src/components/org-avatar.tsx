import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { brand } from "@/constants/branding";

type OrgAvatarProps = {
  name: string;
  logoUrl?: string | null;
  /** Rendered width and height in points. The avatar is square. */
  size?: number;
};

/** Up to two leading characters, e.g. "Grace Community Band" -> "GC". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * An organization's logo, falling back to its initials on a tinted square when
 * `Organization.logoUrl` is null — which it is until someone uploads one.
 */
export function OrgAvatar({ name, logoUrl, size = 48 }: OrgAvatarProps) {
  // Squircle-ish: proportional so the shape holds at every size we use.
  const radius = size * 0.28;

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={150}
        accessibilityRole="image"
        accessibilityLabel={`${name} logo`}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    // Brand orange at low opacity reads on both the light and dark surfaces.
    backgroundColor: `${brand.orange}26`,
  },
  initials: {
    color: brand.orange,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
