"use client";

import type { ShortTestDefinition } from "@grani/content/short-tests";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ShortResultView } from "@/lib/short-test-result";
import { AxisMap } from "./AxisMap";
import styles from "./short-tests.module.css";

// Подписи квадрантов карты: [низкое x, низкое y], [высокое x, низкое y], [низкое x, высокое y], [высокое x, высокое y]
function quadrantLabels(test: ShortTestDefinition, xKey: string, yKey: string): [string, string, string, string] {
  const name = (x: "low" | "high", y: "low" | "high") => {
    const rule = test.scoring.types.find((r) => r.when[xKey] === x && r.when[yKey] === y);
    const type = test.types.find((t) => t.key === rule?.key);
    return type ? type.name.split(" ")[0]! : "";
  };
  return [name("low", "low"), name("high", "low"), name("low", "high"), name("high", "high")];
}

export function ShortTestResult({ test, view, onRestart, focusOnMount = false }: { test: ShortTestDefinition; view: ShortResultView; onRestart: () => void; focusOnMount?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Кнопка отправки исчезла вместе с тестом: фокус переводим на результат, чтобы клавиатура и читалка не потерялись.
  // При открытии сохранённого результата фокус не трогаем — человек только зашёл на страницу
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus();
  }, [focusOnMount]);
  // Ось X — вторая ось теста, ось Y — первая: у привязанности это избегание и тревожность
  const [yAxis, xAxis] = view.axes as [ShortResultView["axes"][number], ShortResultView["axes"][number]];
  return (
    <section className={styles.result} aria-labelledby="short-result-title" data-testid="short-result">
      <p className={styles.eyebrow}>Ваш результат</p>
      <h2 id="short-result-title" className={styles.resultTitle} ref={titleRef} tabIndex={-1}>{view.type.name}</h2>
      <p className={styles.tagline}>{view.type.tagline}</p>
      <div className={styles.resultGrid}>
        <AxisMap xLabel={xAxis.info.label} yLabel={yAxis.info.label} x={xAxis.value} y={yAxis.value} quadrantLabels={quadrantLabels(test, xAxis.info.key, yAxis.info.key)} />
        <div className={styles.axes}>
          {view.axes.map((axis) => (
            <div key={axis.info.key} className={styles.axis}>
              <div className={styles.axisHead}>
                <span>{axis.info.label}</span>
                <b>{axis.value}%</b>
              </div>
              <div className={styles.meter} aria-hidden="true">
                <span style={{ width: `${axis.value}%` }} />
              </div>
              <p>{axis.text}</p>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.summary}>{view.type.summary}</p>
      <p className={styles.disclaimer}>{test.disclaimer}</p>
      <div className={styles.actions}>
        <Link className="button" href={`${test.path}/${view.type.slug}`}>
          Подробнее о своём типе
        </Link>
        <Link className="button button--ghost" href="/big-five-test">
          Почему у вас так — тест Big Five
        </Link>
        <button type="button" className="button button--ghost" onClick={onRestart}>
          Пройти заново
        </button>
      </div>
    </section>
  );
}
