import { parseBlocks } from "@grani/content";
import Link from "next/link";
import { splitForInlineCta } from "@/lib/article-layout";
import { RichText } from "./RichText";

export function ArticleReading({ body }: { body: string }) {
  const text = body.replace(/\r\n/g, "\n");
  const split = splitForInlineCta(text);
  const parts = (split ?? [text]).map((part, index) => ({ text: part, prefix: `article-${index}` }));
  // Each fragment keeps its own block indices, matching RichText even after the test prompt splits the body.
  const headings = parts.flatMap((part) => parseBlocks(part.text).flatMap((block, index) =>
    block.kind === "h2" ? [{ text: block.text, id: `${part.prefix}-${index}` }] : [],
  ));
  return (
    <>
      {headings.length >= 4 && (
        <details className="article-contents">
          <summary>Содержание статьи</summary>
          <nav aria-label="В этой статье">
            <ol>
              {headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}
            </ol>
          </nav>
        </details>
      )}
      <div className="article-body">
        <RichText text={parts[0]!.text} headingIdPrefix={parts[0]!.prefix} />
        {parts[1] && (
          <>
            <aside className="article-inline-cta" aria-label="Пройти тест">
              <p>Хочешь узнать, как эти черты выражены у тебя?</p>
              <Link className="button" href="/test">Пройти тест Big Five <span aria-hidden="true">→</span></Link>
            </aside>
            <RichText text={parts[1].text} headingIdPrefix={parts[1].prefix} />
          </>
        )}
      </div>
    </>
  );
}
