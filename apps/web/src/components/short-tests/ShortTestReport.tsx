import type { ShortReport } from "@grani/content/short-tests";
import styles from "./short-tests.module.css";

export function ShortTestReport({ report }: { report: ShortReport }) {
  return (
    <article className={styles.report} aria-labelledby="short-report-title" data-testid="short-report">
      <h2 id="short-report-title">{report.title}</h2>
      {report.sections.map((section) => (
        <section key={section.heading}>
          <h3>{section.heading}</h3>
          <p>{section.text}</p>
        </section>
      ))}
      <section>
        <h3>Упражнения на месяц</h3>
        <ol>
          {report.exercises.map((exercise) => (
            <li key={exercise.title}>
              <strong>{exercise.title}.</strong> {exercise.text}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
