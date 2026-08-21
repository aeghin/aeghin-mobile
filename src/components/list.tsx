import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { Children, Fragment, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

/** One icon, named for each platform's own symbol set. */
export type RowSymbol = {
  ios: SFSymbol;
  android: AndroidSymbol;
};

const ICON_COLUMN = 28;
const ROW_PADDING = 14;

type CardProps = {
  children: ReactNode;
};

/**
 * A grouped container in the iOS inset-list tradition: one rounded surface with
 * hairline separators drawn between its rows, inset past the icon column.
 */
export function Card({ children }: CardProps) {
  const theme = useTheme();
  const rows = Children.toArray(children);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          ) : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

type RowProps = {
  label: string;
  symbol?: RowSymbol;
  /** Trailing text, e.g. a count. */
  value?: string;
  onPress?: () => void;
  /** Renders the label in red — for leave, delete, and the like. */
  destructive?: boolean;
};

/**
 * A single tappable line inside a {@link Card}. Shows a chevron whenever it
 * navigates, so a row without `onPress` reads as static by design.
 */
export function Row({ label, symbol, value, onPress, destructive }: RowProps) {
  const theme = useTheme();
  const tint = destructive ? DESTRUCTIVE : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { backgroundColor: theme.border } : null,
      ]}
    >
      {symbol ? (
        <SymbolView
          name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
          size={20}
          tintColor={destructive ? DESTRUCTIVE : theme.textMuted}
          fallback={<View style={styles.iconFallback} />}
          style={styles.icon}
        />
      ) : null}

      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>

      {value ? (
        <Text style={[styles.value, { color: theme.textMuted }]}>{value}</Text>
      ) : null}

      {onPress && !destructive ? (
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          size={14}
          tintColor={theme.textMuted}
          fallback={<Text style={{ color: theme.textMuted }}>›</Text>}
        />
      ) : null}
    </Pressable>
  );
}

type SectionLabelProps = {
  children: string;
};

/** The small uppercase caption that sits above a {@link Card}. */
export function SectionLabel({ children }: SectionLabelProps) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
      {children}
    </Text>
  );
}

/** iOS system red, which reads on both backgrounds. */
const DESTRUCTIVE = "#FF3B30";

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_PADDING + ICON_COLUMN,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: ROW_PADDING,
    minHeight: 50,
  },
  icon: {
    width: ICON_COLUMN - 10,
    height: 20,
  },
  iconFallback: {
    width: ICON_COLUMN - 10,
    height: 20,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  value: {
    fontSize: 15,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
});
