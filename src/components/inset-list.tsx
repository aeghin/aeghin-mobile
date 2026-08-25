import { Children, Fragment, type ReactNode } from "react";

import { AppSymbol, type AppSymbolName } from "@/components/app-symbol";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTheme } from "@/hooks/use-theme";

const ICON_COLUMN = 28;
const ROW_PADDING = 14;

/** Where a card's hairlines start when its rows lead with an {@link InsetRow}. */
export const ROW_SEPARATOR_INSET = ROW_PADDING + ICON_COLUMN;

const CHEVRON: AppSymbolName = { ios: "chevron.right", android: "chevron_right" };

type InsetCardProps = {
  children: ReactNode;
  /**
   * Where the hairlines between rows start. Defaults to the {@link InsetRow}
   * icon column; pass a different value when the rows lead with something
   * wider, so the separators line up with the text rather than the artwork.
   */
  separatorInset?: number;
  /**
   * Renders on `card` rather than `surface`, for screens whose page sits on
   * `grouped` and need the card to read as raised.
   */
  elevated?: boolean;
  className?: string;
};

/**
 * A grouped container in the iOS inset-list tradition: one rounded surface with
 * hairline separators drawn between its rows, inset past the icon column.
 */
export function InsetCard({
  children,
  separatorInset = ROW_SEPARATOR_INSET,
  elevated = false,
  className,
}: InsetCardProps) {
  const rows = Children.toArray(children);

  return (
    <VStack
      className={`overflow-hidden rounded-2xl border border-border ${
        elevated ? "bg-card" : "bg-surface"
      } ${className ?? ""}`}
    >
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider style={{ marginLeft: separatorInset }} /> : null}
          {row}
        </Fragment>
      ))}
    </VStack>
  );
}

type InsetRowProps = {
  label: string;
  symbol?: AppSymbolName;
  /** Trailing text, e.g. a count. */
  value?: string;
  onPress?: () => void;
  /** Renders the row in red — for leave, delete, and the like. */
  destructive?: boolean;
};

/**
 * A single tappable line inside an {@link InsetCard}. Shows a chevron whenever
 * it navigates, so a row without `onPress` reads as static by design.
 */
export function InsetRow({
  label,
  symbol,
  value,
  onPress,
  destructive,
}: InsetRowProps) {
  const theme = useTheme();
  const tint = destructive ? theme.destructive : theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      // gluestack's Pressable publishes its press state as a data attribute,
      // which is what lets the highlight be a class rather than a callback.
      className="data-[active=true]:bg-border/60"
      style={{ paddingHorizontal: ROW_PADDING }}
    >
      <HStack space="sm" className="min-h-[52px] items-center">
        {symbol ? (
          <VStack
            className="items-center justify-center"
            style={{ width: ICON_COLUMN - 10 }}
          >
            <AppSymbol name={symbol} size={20} tint={tint} />
          </VStack>
        ) : null}

        <Text
          className={`flex-1 text-base ${
            destructive ? "text-destructive" : "text-foreground"
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>

        {value ? (
          <Text className="text-[15px] text-muted-foreground">{value}</Text>
        ) : null}

        {onPress && !destructive ? (
          <AppSymbol name={CHEVRON} size={14} tint={theme.textMuted} />
        ) : null}
      </HStack>
    </Pressable>
  );
}

/** The small uppercase caption that sits above an {@link InsetCard}. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-[0.7px] text-muted-foreground">
      {children}
    </Text>
  );
}
