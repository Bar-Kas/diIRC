import { visit } from "unist-util-visit";
type Root = any;
type Text = any;
type Parent = any;

// Helper to create mdast nodes with custom data for hast conversion
function createSpoilerNode(children: any[]) {
  return {
    type: "spoiler",
    children,
    data: {
      hName: "spoiler",
      hProperties: {},
    },
  } as any;
}

function createUnderlineNode(children: any[]) {
  return {
    type: "underline",
    children,
    data: {
      hName: "underline",
      hProperties: {},
    },
  } as any;
}

/**
 * Remark plugin for `||spoiler||` syntax.
 * Converts ||text|| inside text nodes to <spoiler> nodes.
 * Runs before GFM so it captures raw pipes.
 */
export function remarkSpoiler() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      const value = node.value;
      // Quick check
      if (!value.includes("||")) return;
      // Don't process inside code/inlineCode
      if (parent.type === "inlineCode" || parent.type === "code") return;

      const regex = /\|\|(.+?)\|\|/g;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const newNodes: any[] = [];
      let hasSpoiler = false;

      while ((match = regex.exec(value)) !== null) {
        hasSpoiler = true;
        const before = value.slice(lastIndex, match.index);
        if (before) newNodes.push({ type: "text", value: before });
        const inner = match[1];
        // Create text node inside spoiler — further markdown inside spoiler not parsed for MVP simplicity
        // But allow bold etc inside spoiler by creating text that will be re-parsed? For now plain text.
        newNodes.push(createSpoilerNode([{ type: "text", value: inner }]));
        lastIndex = match.index + match[0].length;
      }

      if (!hasSpoiler) return;

      const after = value.slice(lastIndex);
      if (after) newNodes.push({ type: "text", value: after });

      // Replace current node with new nodes
      parent.children.splice(index, 1, ...newNodes);
      // Need to re-visit? return index to handle next nodes
      return index + newNodes.length;
    });
  };
}

/**
 * Remark plugin for `__underline__` syntax (Discord style).
 * remark-parse parses both **text** and __text__ as `strong` AST nodes.
 * This plugin inspects `strong` nodes, checks if the raw source delimiters were `__`,
 * and converts those nodes to `underline` nodes.
 */
export function remarkUnderline() {
  return (tree: Root, file: any) => {
    const source = typeof file?.value === "string" ? file.value : String(file || "");

    visit(tree, "strong", (node: any) => {
      if (
        !source ||
        !node.position ||
        node.position.start?.offset === undefined ||
        node.position.end?.offset === undefined
      ) {
        return;
      }

      const rawText = source.slice(node.position.start.offset, node.position.end.offset);
      if (rawText.startsWith("__") && rawText.endsWith("__")) {
        node.type = "underline";
        node.data = {
          hName: "underline",
          hProperties: {},
        };
      }
    });
  };
}

function createMentionNode(value: string, isMyMention: boolean) {
  return {
    type: "mention",
    children: [{ type: "text", value }],
    data: {
      hName: "mention",
      hProperties: {
        isMyMention: isMyMention ? "true" : "false",
      },
    },
  } as any;
}

/**
 * Remark plugin for mention syntax (`@nickname`, `nickname:`, `nickname,` or direct nickname match).
 */
export function remarkMention(options?: { myNicks?: string[]; allMemberNicks?: string[] }) {
  const myNicks = options?.myNicks || [];
  const allMemberNicks = options?.allMemberNicks || [];

  return (tree: Root) => {
    const myNicksLower = new Set(myNicks.map((n) => n.toLowerCase()));
    const allNicksLower = new Set(allMemberNicks.map((n) => n.toLowerCase()));

    const escapedMyNicks = myNicks
      .filter(Boolean)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const regexPattern =
      `(@[a-zA-Z0-9_\\-\\[\\]\\\`^{}|]+)` +
      (escapedMyNicks.length > 0
        ? `|(\\b(?:${escapedMyNicks.join("|")})(?:[:,]?(?=\\s|$)|\\b))`
        : "");

    if (!regexPattern) return;

    visit(tree, "text", (node: Text, index: number | undefined, parent: Parent | undefined) => {
      if (!parent || index === undefined) return;
      if (parent.type === "inlineCode" || parent.type === "code" || parent.type === "mention") return;

      const value = node.value;
      if (!value) return;

      const regex = new RegExp(regexPattern, "gi");
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const newNodes: any[] = [];
      let hasMatch = false;

      while ((match = regex.exec(value)) !== null) {
        const matchedStr = match[0];
        const cleanNick = matchedStr.replace(/^@/, "").replace(/[:,]$/, "").toLowerCase();
        const isMyMention = myNicksLower.has(cleanNick);
        const isMemberMention = isMyMention || allNicksLower.has(cleanNick) || matchedStr.startsWith("@");

        if (!isMemberMention) continue;

        hasMatch = true;
        const before = value.slice(lastIndex, match.index);
        if (before) newNodes.push({ type: "text", value: before });

        newNodes.push(createMentionNode(matchedStr, isMyMention));
        lastIndex = match.index + matchedStr.length;
      }

      if (!hasMatch) return;

      const after = value.slice(lastIndex);
      if (after) newNodes.push({ type: "text", value: after });

      parent.children.splice(index, 1, ...newNodes);
      return index + newNodes.length;
    });
  };
}

