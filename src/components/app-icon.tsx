import type { LucideIcon } from "lucide-react-native";

/** One icon, as the lucide component that draws it. */
export type AppIconName = LucideIcon;

type AppIconProps = {
  icon: AppIconName;
  size?: number;
  /** A resolved colour — lucide takes a `color` prop, not a style. */
  color: string;
};

/**
 * The app's icon.
 *
 * Lucide rather than SF Symbols, which the app used until the whole set moved
 * over: the web dashboard draws lucide, and a volunteer who reads a glyph on
 * one should not have to relearn it on the other. The four native tab icons
 * are the exception and stay SF Symbols — `NativeTabs.Trigger.Icon` renders a
 * real UITabBar item and takes a symbol name, not a component.
 *
 * Lucide's own default stroke of 2 is measured on its 24px grid, so it scales
 * with `size` and lands heavier beside iOS text than SF Symbols do. `STROKE`
 * is the one number to turn if the icons ever read too bold or too faint.
 */
const STROKE = 1.75;

export function AppIcon({ icon: Icon, size = 20, color }: AppIconProps) {
  return <Icon size={size} color={color} strokeWidth={STROKE} />;
}
