import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";
import { ReadingContents, type ReadingSection } from "./ReadingContents";
import styles from "@/app/editorial.module.css";

type HeadingProps = { children?: ReactNode; id?: string };

// Оглавление берётся из самих заголовков: текст документа хранится в одном месте.
export function EditorialPage({ children, title, path, document: isDocument = false }: {
  children: ReactNode; title: string; path: string; document?: boolean;
}) {
  const sections: ReadingSection[] = [];
  let firstHeading = -1;
  const blocks = Children.toArray(children).map((block, index) => {
    if (!isValidElement<HeadingProps>(block) || block.type !== "h2") return block;
    if (firstHeading < 0) firstHeading = index;
    const id = block.props.id ?? `section-${index}`;
    sections.push({ id, title: block.props.children });
    return cloneElement(block, { id });
  });
  const intro = firstHeading < 0 ? blocks : blocks.slice(0, firstHeading);
  const body = firstHeading < 0 ? [] : blocks.slice(firstHeading);
  return (
    <main className={`${styles.page} ${isDocument ? styles.document : ""}`}>
      <article>
        <Breadcrumbs items={[{ name: title, path }]} />
        <header className={styles.intro}>{intro}</header>
        <div className={styles.reading}>
          <ReadingContents sections={sections} />
          <div className={styles.body}>{body}</div>
        </div>
      </article>
    </main>
  );
}
