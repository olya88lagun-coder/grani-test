import type { TraitScores } from "@grani/core";
import type { ReactNode } from "react";
import { ChapterCards } from "@/components/ChapterCards";
import { Paragraphs } from "@/components/Paragraphs";
import { isChapterCards } from "@/lib/chapter-view";
import type { ChapterView } from "@/lib/report-view";

type Props = {
  chapter: ChapterView;
  scores: TraitScores;
  question: string;
  paperClassName: string;
  preparing: ReactNode;
  practiceHref?: string;
  themes?: readonly string[];
};

// Тело главы по состояниям: карточки, прежний текст формата 1, «готовится», «ещё не куплена»
export function ChapterReading({ chapter, scores, question, paperClassName, preparing, practiceHref, themes }: Props) {
  if (chapter.state === "ready") {
    if (isChapterCards(chapter.sections)) return <ChapterCards kind={chapter.kind} sections={chapter.sections} scores={scores} practiceHref={practiceHref} />;
    return (
      <div className={paperClassName}>
        <Paragraphs text={chapter.sections.text} />
        <h3>Ориентиры для себя</h3>
        <ul>{chapter.sections.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </div>
    );
  }
  if (chapter.state === "preparing") return <div className={paperClassName}>{preparing}</div>;
  return (
    <div className={paperClassName}>
      <h3>{question}</h3>
      <p>Персональный текст и рекомендации, связанные с вашим профилем. Глава дополняет основной разбор в выбранной сфере.</p>
      {themes && themes.length > 0 && (
        <>
          <h3>Что разберём</h3>
          <ul>{themes.map((title) => <li key={title}>{title}</li>)}</ul>
        </>
      )}
    </div>
  );
}
