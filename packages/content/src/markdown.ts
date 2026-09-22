// Разметка текстов библиотеки и статей: абзацы через пустую строку, подзаголовки «## », списки «- »
export type TextBlock = { kind: "h2"; text: string } | { kind: "p"; text: string } | { kind: "ul"; items: string[] };

function parseBlock(chunk: string): TextBlock {
  const lines = chunk.split("\n").map((line) => line.trim());
  if (lines.length === 1 && lines[0]!.startsWith("## ")) return { kind: "h2", text: lines[0]!.slice(3).trim() };
  if (lines.every((line) => line.startsWith("- "))) return { kind: "ul", items: lines.map((line) => line.slice(2).trim()) };
  return { kind: "p", text: lines.join(" ") };
}

export function parseBlocks(text: string): TextBlock[] {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .filter((chunk) => chunk.trim() !== "")
    .map(parseBlock);
}

export type InlinePart = { text: string } | { text: string; href: string };

// Только внутренние ссылки: тексты ведут на тест и страницы типов, а не наружу
export function inlineLinks(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[([^\]]+)\]\((\/[^)\s]*)\)/g)) {
    const at = match.index;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: match[1]!, href: match[2]! });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
