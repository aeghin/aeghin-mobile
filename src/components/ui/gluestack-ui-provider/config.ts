import { vars } from "nativewind";

import { brand, palette, toRgbChannels, type Palette } from "@/constants/branding";

/**
 * The aeghin palette expressed as gluestack's semantic tokens.
 *
 * gluestack's copied-in components are written against these names — a Button
 * is `bg-primary`, a Card is `bg-card`, a hairline is `border-border`. Mapping
 * them here is what makes the whole component set wear the brand rather than
 * gluestack's stock neutral grey, and it means a palette edit in one file
 * reaches every screen.
 */
function tokensFor(theme: Palette) {
  const rgb = toRgbChannels;

  return {
    // Brand orange carries every primary action.
    "--primary": rgb(brand.orange),
    "--primary-foreground": "255 255 255",

    "--background": rgb(theme.background),
    "--foreground": rgb(theme.text),

    "--card": rgb(theme.card),
    "--card-foreground": rgb(theme.text),

    "--popover": rgb(theme.card),
    "--popover-foreground": rgb(theme.text),

    "--secondary": rgb(theme.surface),
    "--secondary-foreground": rgb(theme.text),

    "--muted": rgb(theme.surface),
    "--muted-foreground": rgb(theme.textMuted),

    "--accent": rgb(theme.surface),
    "--accent-foreground": rgb(theme.text),

    "--destructive": rgb(theme.destructive),

    "--border": rgb(theme.border),
    "--input": rgb(theme.border),
    "--ring": rgb(brand.orange),

    // Tokens of our own, for the things gluestack has no name for.
    "--brand": rgb(brand.orange),
    "--brand-pressed": rgb(brand.orangePressed),
    "--gold": rgb(theme.gold),
    "--admin": rgb(theme.admin),
    /** The page *behind* inset cards, so a grouped screen reads as layered. */
    "--grouped": rgb(theme.groupedBackground),
    "--surface": rgb(theme.surface),
  };
}

export const colors = {
  light: tokensFor(palette.light),
  dark: tokensFor(palette.dark),
};

export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
