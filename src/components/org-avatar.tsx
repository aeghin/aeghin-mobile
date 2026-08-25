import { Image as ExpoImage } from "expo-image";
import { cssInterop } from "nativewind";

import { Avatar, AvatarFallbackText } from "@/components/ui/avatar";
import { brand, withAlpha } from "@/constants/branding";
import { avatarSheen } from "@/lib/gradients";

/**
 * expo-image is not a core React Native component, so NativeWind has no
 * `className` mapping for it until one is registered. Doing that once here
 * keeps expo-image's caching and cross-fade while letting the avatar be styled
 * in the same vocabulary as everything around it.
 */
const Image = cssInterop(ExpoImage, { className: "style" });

type OrgAvatarProps = {
  name: string;
  logoUrl?: string | null;
  /** Rendered width and height in points. The avatar is square. */
  size?: number;
  /** People read as circles; the squircle is for organization logos. */
  shape?: "squircle" | "circle";
  /**
   * Lifts the tile off the page with a brand-tinted gradient and shadow, for
   * the one place an organization is the subject rather than a list entry.
   */
  elevated?: boolean;
  className?: string;
};

/**
 * An organization's logo, falling back to its initials on a brand-tinted
 * square when `Organization.logoUrl` is null — which it is until someone
 * uploads one.
 *
 * Sizes arrive as numbers rather than classes because the same avatar is drawn
 * at four different scales; an inline style outranks a utility class in
 * NativeWind exactly as it does in CSS, so `h-12 w-12` on the gluestack base
 * gives way without a fight.
 */
export function OrgAvatar({
  name,
  logoUrl,
  size = 48,
  shape = "squircle",
  elevated = false,
  className,
}: OrgAvatarProps) {
  // Proportional so the shape holds at every size we draw it at.
  const borderRadius = shape === "circle" ? size / 2 : size * 0.28;

  return (
    <Avatar
      className={`overflow-hidden bg-brand/15 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius,
        ...(elevated
          ? {
              ...avatarSheen(),
              boxShadow: `0px 8px 20px ${withAlpha(brand.orange, 0.18)}`,
            }
          : null),
      }}
    >
      <AvatarFallbackText
        className="font-bold tracking-wide text-brand"
        style={{ fontSize: size * 0.36 }}
      >
        {name.trim() || "?"}
      </AvatarFallbackText>

      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          className="absolute h-full w-full"
          style={{ borderRadius }}
          contentFit="cover"
          transition={150}
          accessibilityRole="image"
          accessibilityLabel={`${name} logo`}
        />
      ) : null}
    </Avatar>
  );
}
