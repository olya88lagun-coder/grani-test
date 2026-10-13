import type { MoneyAnswer, MoneyPracticeData } from "@grani/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { initialMoneyData, RECALL_NOTE } from "@/lib/money-practice";
import { isSaveProblem, MoneyPractice } from "./MoneyPractice";

const SCORES = { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 };
const render = (data: MoneyPracticeData = initialMoneyData()) =>
  renderToStaticMarkup(<MoneyPractice resultId="r1" displayName="Тест" scores={SCORES} initialDraft={{ revision: 0, schemaVersion: 1, data }} />);
const withAnswers = (answers: (MoneyAnswer | null)[]): MoneyPracticeData => ({ ...initialMoneyData(), answers });
const at = (html: string, needle: string) => {
  const index = html.indexOf(needle);
  expect(index, needle).toBeGreaterThan(-1);
  return index;
};

describe("MoneyPractice layout", () => {
  test("one linear path: questions, compass, week, memo, then the data block", () => {
    const html = render();

    expect(at(html, 'id="money-questions"')).toBeLessThan(at(html, 'id="money-compass"'));
    expect(at(html, 'id="money-compass"')).toBeLessThan(at(html, 'id="money-week"'));
    expect(at(html, 'id="money-week"')).toBeLessThan(at(html, 'id="money-memo"'));
    expect(at(html, 'id="money-memo"')).toBeLessThan(at(html, 'id="money-data"'));
    expect(html).not.toContain('id="money-observations"');
    expect(html).not.toContain('id="money-situations"');
  });

  test("the side navigation has four steps", () => {
    const html = render();
    const nav = html.slice(at(html, "<nav"), at(html, "</nav>"));

    expect(nav.match(/<li>/g)).toHaveLength(4);
    for (const label of ["Вопросы", "Компас", "Неделя", "Памятка"]) expect(nav).toContain(label);
    expect(html).not.toContain("Жизненные ситуации");
  });

  test("the save status is one line in the header, the buttons live in the data block after the memo", () => {
    const html = render();

    expect(at(html, "data-practice-save")).toBeLessThan(at(html, 'id="money-questions"'));
    for (const button of ["Сохранить сейчас", "Скачать черновик"]) {
      expect(html.indexOf(button)).toBeGreaterThan(at(html, 'id="money-data"'));
      expect(html.indexOf(button)).toBeGreaterThan(at(html, 'id="money-memo"'));
    }
  });
});

describe("MoneyPractice compass", () => {
  test("four sectors and four direction buttons, the first direction opened with its step and phrase", () => {
    const html = render(withAnswers(Array(6).fill("c")));

    expect(html.match(/<path[^>]*data-state="/g)).toHaveLength(4);
    expect(html.match(/data-direction="/g)).toHaveLength(4);
    expect(html).toContain("Ясность расходов");
    expect(html).toContain("Появилась неожиданная трата");
    expect(html).toContain("Сначала пойму сроки и обязательные расходы.");
    expect(html).toContain("Это не оценка финансовой успешности");
  });

  test("the five traits are folded into a block inside the compass, not a section of their own", () => {
    const html = render();
    const compass = html.slice(at(html, 'id="money-compass"'), at(html, 'id="money-week"'));

    expect(compass).toContain("Почему так: твои черты");
    expect(compass).toContain("Открытость опыту");
  });

  test("the recall note appears while answers are missing and disappears when all are given", () => {
    expect(render()).toContain(RECALL_NOTE);
    expect(render(withAnswers(Array(6).fill("a")))).not.toContain(RECALL_NOTE);
  });
});

describe("MoneyPractice habits", () => {
  test("the habit that matches the answers is marked once and not chosen for the person", () => {
    const html = render(withAnswers(Array(6).fill("c")));

    expect(html.match(/Подходит по твоим ответам/g)).toHaveLength(1);
    expect(html).not.toMatch(/name="money-habit"[^>]*checked/);
  });

  test("without answers no habit is marked", () => {
    expect(render()).not.toContain("Подходит по твоим ответам");
  });
});

describe("isSaveProblem", () => {
  test("only an error or a conflict is a problem that must be noticed", () => {
    expect(["idle", "dirty", "saving", "saved"].some((s) => isSaveProblem(s as never))).toBe(false);
    expect(isSaveProblem("error")).toBe(true);
    expect(isSaveProblem("conflict")).toBe(true);
  });
});
