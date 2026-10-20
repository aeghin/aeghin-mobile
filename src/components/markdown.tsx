import type { ReactNode } from "react";
import { Linking, Platform, Text as Span } from "react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { brand, withAlpha, type Palette } from "@/constants/branding";
import { useTheme } from "@/hooks/use-theme";
import {
  parseBlocks,
  parseInline,
  settleStreaming,
  type Block,
  type Inline,
} from "@/lib/markdown";

const BODY = "text-[14px] leading-[20px] text-foreground";

const HEADING: Record<number, { fontSize: number; lineHeight: number }> = {
  1: { fontSize: 17, lineHeight: 23 },
  2: { fontSize: 15.5, lineHeight: 21 },
};

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/**
 * An assistant's reply, formatted the way the web's `Markdown` shows it: bold
 * reads bold rather than wrapped in asterisks. Spans are React Native's own
 * `Text`, which inherit the paragraph's size and colour; gluestack's would
 * reset them.
 */
export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const theme = useTheme();
  const blocks = parseBlocks(streaming ? settleStreaming(text) : text);

  return (
    <VStack>
      {blocks.map((block, index) => (
        <MarkdownBlock
          key={index}
          block={block}
          gap={gapBefore(block, blocks[index - 1])}
          theme={theme}
        />
      ))}
    </VStack>
  );
}

/** The web's `my-2` between blocks, `space-y-1` inside a list. */
function gapBefore(block: Block, previous: Block | undefined) {
  if (!previous) return 0;
  if (block.kind === "heading") return 12;
  if (block.kind === "item" && previous.kind === "item") return 4;
  return 8;
}

function MarkdownBlock({ block, gap, theme }: { block: Block; gap: number; theme: Palette }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <Text selectable className={BODY} style={{ marginTop: gap }}>
          {renderInline(parseInline(block.text), theme)}
        </Text>
      );

    case "heading":
      return (
        <Text
          selectable
          className={`${BODY} font-semibold`}
          style={{ marginTop: gap, ...HEADING[block.level] }}
        >
          {renderInline(parseInline(block.text), theme)}
        </Text>
      );

    case "item":
      return (
        <HStack className="gap-2" style={{ marginTop: gap, paddingLeft: block.depth * 16 }}>
          <Text
            className={`${BODY} text-muted-foreground`}
            style={{ minWidth: block.marker === "•" ? 8 : 18, fontVariant: ["tabular-nums"] }}
          >
            {block.marker}
          </Text>
          <Text selectable className={`${BODY} flex-1`}>
            {renderInline(parseInline(block.text), theme)}
          </Text>
        </HStack>
      );

    case "quote":
      return (
        <Box
          className="pl-3"
          style={{ marginTop: gap, borderLeftWidth: 2, borderLeftColor: theme.border }}
        >
          <Text selectable className={`${BODY} italic text-muted-foreground`}>
            {renderInline(parseInline(block.text), theme)}
          </Text>
        </Box>
      );

    case "rule":
      return (
        <Box style={{ marginTop: gap + 4, marginBottom: 4, height: 1, backgroundColor: theme.border }} />
      );
  }
}

function renderInline(nodes: Inline[], theme: Palette): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.text;

      case "code":
        return (
          <Span
            key={index}
            style={{
              fontFamily: MONO,
              fontSize: 12.5,
              backgroundColor: withAlpha(theme.text, 0.08),
            }}
          >
            {node.text}
          </Span>
        );

      case "link":
        return (
          <Span
            key={index}
            accessibilityRole="link"
            onPress={() => Linking.openURL(node.href).catch(() => {})}
            style={{ color: brand.orange, fontWeight: "500", textDecorationLine: "underline" }}
          >
            {renderInline(node.children, theme)}
          </Span>
        );

      case "strong":
        return (
          <Span key={index} style={{ fontWeight: "600" }}>
            {renderInline(node.children, theme)}
          </Span>
        );

      case "em":
        return (
          <Span key={index} style={{ fontStyle: "italic" }}>
            {renderInline(node.children, theme)}
          </Span>
        );
    }
  });
}
