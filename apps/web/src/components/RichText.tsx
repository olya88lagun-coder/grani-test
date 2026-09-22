import { inlineLinks, parseBlocks } from "@grani/content";
import Link from "next/link";

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineLinks(text).map((part, index) => {
        if ("href" in part)
          return (
            <Link key={index} href={part.href}>
              {part.text}
            </Link>
          );
        if ("strong" in part) return <strong key={index}>{part.text}</strong>;
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

// Тексты типов и статьи: подзаголовки, абзацы и списки из разметки библиотеки
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseBlocks(text).map((block, index) => {
        if (block.kind === "h2") return <h2 key={index}>{block.text}</h2>;
        if (block.kind === "ul")
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </>
  );
}
