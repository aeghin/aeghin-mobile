/**
 * The slice of Markdown the AI assistants write: paragraphs, headings, lists,
 * quotes, rules, and bold, italic, code and links inside them. Everything else
 * stays as typed. The web renders the same replies with react-markdown, which
 * can't run here.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] };

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: number; text: string }
  /** `marker` is "•" for a bullet, or the item's own number with a dot. */
  | { kind: "item"; marker: string; depth: number; text: string }
  | { kind: "quote"; text: string }
  | { kind: "rule" };

// Code first, so nothing inside backticks is read as emphasis; bold before
// italics, so `**` is never taken for two single stars.
const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(\S(?:.*?\S)?)\*\*|\*([^\s*](?:[^*\n]*[^\s*])?)\*/g;

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const [whole, code, label, href, strong, em] = match;
    const at = match.index ?? 0;

    if (at > last) nodes.push({ kind: "text", text: text.slice(last, at) });

    if (code !== undefined) nodes.push({ kind: "code", text: code });
    else if (href !== undefined) nodes.push({ kind: "link", href, children: parseInline(label) });
    else if (strong !== undefined) nodes.push({ kind: "strong", children: parseInline(strong) });
    else nodes.push({ kind: "em", children: parseInline(em) });

    last = at + whole.length;
  }

  if (last < text.length) nodes.push({ kind: "text", text: text.slice(last) });

  return nodes;
}

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    let match: RegExpExecArray | null;

    if (!trimmed) {
      flush();
      continue;
    }

    if ((match = /^(#{1,6})\s+(.*)$/.exec(trimmed))) {
      flush();
      blocks.push({ kind: "heading", level: match[1].length, text: match[2] });
      continue;
    }

    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }

    if ((match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line))) {
      flush();
      blocks.push({
        kind: "item",
        marker: /\d/.test(match[2]) ? `${match[2].slice(0, -1)}.` : "•",
        depth: Math.min(Math.floor(match[1].length / 2), 3),
        text: match[3],
      });
      continue;
    }

    if ((match = /^>\s?(.*)$/.exec(trimmed))) {
      flush();
      blocks.push({ kind: "quote", text: match[1] });
      continue;
    }

    // An indented line straight after a list item carries on that item.
    const previous = blocks.at(-1);
    if (paragraph.length === 0 && previous?.kind === "item" && /^\s/.test(line)) {
      previous.text += ` ${trimmed}`;
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();
  return blocks;
}

/**
 * Mid-reply, a `**` still waiting for its pair would show as typed until the
 * pair lands. Drop the odd one out while the text is streaming.
 */
export function settleStreaming(text: string): string {
  const count = text.split("**").length - 1;
  if (count % 2 === 0) return text;

  const at = text.lastIndexOf("**");
  return text.slice(0, at) + text.slice(at + 2);
}
