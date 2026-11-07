import { scoreShortTest, type Answer, type Answers } from "@grani/core";
import { describe, expect, test } from "vitest";
import { findStopWords } from "../safety";
import { getShortTest } from "./index";
import { axisLevel, buildShortReport } from "./report";

const attachment = getShortTest("attachment")!;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

function answersFor(levels: Record<string, "low" | "high">): Answers {
  return Object.fromEntries(
    attachment.scoring.items.map((item) => [item.id, ((levels[item.axis] === "high") !== item.reverse ? 5 : 1) as Answer]),
  );
}

describe("attachment report blocks", () => {
  const report = attachment.report!;

  test("cover every type with six sections and 3–4 exercises", () => {
    for (const type of attachment.types) {
      expect(report.byType[type.key], type.key).toHaveLength(6);
      const exercises = report.exercises[type.key]!;
      expect(exercises.length, type.key).toBeGreaterThanOrEqual(3);
      expect(exercises.length, type.key).toBeLessThanOrEqual(4);
    }
  });

  test("cover both axes at three levels", () => {
    for (const axis of attachment.scoring.axes) {
      for (const level of ["low", "mid", "high"] as const) expect(report.byAxisLevel[axis]?.[level]?.text, `${axis} ${level}`).toBeTruthy();
    }
  });

  test("each type's assembled report is at least 750 words", () => {
    const quadrants: Record<string, Record<string, "low" | "high">> = {
      secure: { anxiety: "low", avoidance: "low" },
      anxious: { anxiety: "high", avoidance: "low" },
      avoidant: { anxiety: "low", avoidance: "high" },
      fearful: { anxiety: "high", avoidance: "high" },
    };
    for (const [key, levels] of Object.entries(quadrants)) {
      const built = buildShortReport(attachment, scoreShortTest(attachment.scoring, answersFor(levels)))!;
      const text = [...built.sections.map((s) => s.text), ...built.exercises.map((e) => e.text)].join(" ");
      expect(words(text), key).toBeGreaterThanOrEqual(750);
    }
  });

  test("has no stop words", () => {
    const texts = [
      report.title,
      ...report.preview,
      ...Object.values(report.byType).flatMap((sections) => sections.flatMap((s) => [s.heading, s.text])),
      ...Object.values(report.byAxisLevel).flatMap((levels) => Object.values(levels).flatMap((s) => [s.heading, s.text])),
      ...Object.values(report.exercises).flatMap((list) => list.flatMap((e) => [e.title, e.text])),
    ];
    expect(texts.filter((text) => findStopWords(text).length > 0)).toEqual([]);
  });
});

describe("buildShortReport", () => {
  test("assembles the anxious type with high anxiety and low avoidance blocks", () => {
    const score = scoreShortTest(attachment.scoring, answersFor({ anxiety: "high", avoidance: "low" }));
    const built = buildShortReport(attachment, score)!;
    const report = attachment.report!;
    for (const section of report.byType.anxious!) expect(built.sections).toContainEqual(section);
    expect(built.sections).toContainEqual(report.byAxisLevel.anxiety!.high);
    expect(built.sections).toContainEqual(report.byAxisLevel.avoidance!.low);
    expect(built.exercises).toEqual(report.exercises.anxious);
  });

  test("returns null for a test without a paid report", () => {
    const temperament = getShortTest("temperament")!;
    const answers = Object.fromEntries(temperament.items.map((i) => [i.id, 3 as Answer]));
    expect(buildShortReport(temperament, scoreShortTest(temperament.scoring, answers))).toBeNull();
  });
});

describe("axisLevel", () => {
  test("splits at 40 and 60", () => {
    expect(axisLevel(39)).toBe("low");
    expect(axisLevel(40)).toBe("mid");
    expect(axisLevel(60)).toBe("mid");
    expect(axisLevel(61)).toBe("high");
  });
});
