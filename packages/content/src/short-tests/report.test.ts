import { scoreShortTest, type Answer, type Answers } from "@grani/core";
import { describe, expect, test } from "vitest";
import { findStopWords } from "../safety";
import { ATTACHMENT_COMBINATIONS, getShortTest } from "./index";
import { axisLevel, buildShortPairReport, buildShortReport, SHORT_PAIR_REPORTS, SHORT_REPORTS } from "./report";

const attachment = getShortTest("attachment")!;
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

function answersFor(levels: Record<string, "low" | "high">): Answers {
  return Object.fromEntries(
    attachment.scoring.items.map((item) => [item.id, ((levels[item.axis] === "high") !== item.reverse ? 5 : 1) as Answer]),
  );
}

describe("attachment report blocks", () => {
  const report = SHORT_REPORTS.attachment!;

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

  test("preview headings match the client offer", () => {
    expect(report.preview).toEqual(attachment.reportOffer!.preview);
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
    const report = SHORT_REPORTS.attachment!;
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

describe("paid report texts stay on the server", () => {
  test("the client-facing test definition carries only the offer, not the report texts", () => {
    const json = JSON.stringify(getShortTest("attachment"));
    expect(json).not.toContain("заработанная надёжность");
    expect(json).not.toContain("Факт и толкование");
    expect(getShortTest("attachment")!.reportOffer?.preview.length).toBeGreaterThan(0);
  });
});

// Фразы, которые есть только в текстах разбора пары: по ним видно, что тексты не ушли в браузер
const PAIR_REPORT_MARKERS = ["круг погони", "договор о паузе"];
const QUADRANTS: Record<string, Record<string, "low" | "high">> = {
  secure: { anxiety: "low", avoidance: "low" },
  anxious: { anxiety: "high", avoidance: "low" },
  avoidant: { anxiety: "low", avoidance: "high" },
  fearful: { anxiety: "high", avoidance: "high" },
};
const scoreOf = (type: string) => scoreShortTest(attachment.scoring, answersFor(QUADRANTS[type]!));

describe("attachment pair report blocks", () => {
  const report = SHORT_PAIR_REPORTS.attachment!;

  test("cover every combination, every type and both axes", () => {
    for (const combination of ATTACHMENT_COMBINATIONS) {
      const blocks = report.byCombination[combination.key];
      expect(blocks?.dynamics.text, combination.key).toBeTruthy();
      expect(blocks?.phrases.text, combination.key).toBeTruthy();
      expect(blocks!.exercises.length, combination.key).toBeGreaterThanOrEqual(3);
      expect(blocks!.exercises.length, combination.key).toBeLessThanOrEqual(4);
    }
    for (const type of attachment.types) {
      expect(report.byType[type.key]?.inConflict.text, type.key).toBeTruthy();
      expect(report.byType[type.key]?.needs.text, type.key).toBeTruthy();
    }
    for (const axis of attachment.scoring.axes) {
      expect(report.axisGap[axis]?.close.text, axis).toBeTruthy();
      expect(report.axisGap[axis]?.far.text, axis).toBeTruthy();
    }
  });

  test("each assembled pair report is at least 700 words and names both partners", () => {
    const types = Object.keys(QUADRANTS);
    for (const a of types) {
      for (const b of types) {
        const built = buildShortPairReport(attachment, { name: "Аня", score: scoreOf(a) }, { name: "Борис", score: scoreOf(b) })!;
        const text = [...built.sections.map((s) => s.text), ...built.exercises.map((e) => e.text)].join(" ");
        expect(words(text), `${a}+${b}`).toBeGreaterThanOrEqual(700);
        const headings = built.sections.map((s) => s.heading).join(" ");
        expect(headings).toContain("Аня");
        expect(headings).toContain("Борис");
      }
    }
  });

  test("uses the far gap block when partners are more than 25 points apart on an axis", () => {
    const built = buildShortPairReport(attachment, { name: "Аня", score: scoreOf("anxious") }, { name: "Борис", score: scoreOf("secure") })!;
    expect(built.sections).toContainEqual(report.axisGap.anxiety!.far);
    expect(built.sections).toContainEqual(report.axisGap.avoidance!.close);
  });

  test("preview headings match the client offer", () => {
    expect(report.preview).toEqual(attachment.pairOffer!.preview);
  });

  test("has no stop words", () => {
    const texts = [
      report.title,
      ...report.preview,
      ...Object.values(report.byCombination).flatMap((c) => [c.dynamics.heading, c.dynamics.text, c.phrases.heading, c.phrases.text, ...c.exercises.flatMap((e) => [e.title, e.text])]),
      ...Object.values(report.byType).flatMap((t) => [t.inConflict.text, t.needs.text]),
      ...Object.values(report.axisGap).flatMap((g) => [g.close.heading, g.close.text, g.far.heading, g.far.text]),
    ];
    expect(texts.filter((text) => findStopWords(text).length > 0)).toEqual([]);
  });

  test("returns null for a test without a pair mode", () => {
    const temperament = getShortTest("temperament")!;
    const answers = Object.fromEntries(temperament.items.map((i) => [i.id, 3 as Answer]));
    const score = scoreShortTest(temperament.scoring, answers);
    expect(buildShortPairReport(temperament, { name: "А", score }, { name: "Б", score })).toBeNull();
  });

  test("its texts are not in the client-facing definitions", () => {
    const client = JSON.stringify([getShortTest("attachment"), ATTACHMENT_COMBINATIONS]);
    const server = JSON.stringify(report);
    for (const marker of PAIR_REPORT_MARKERS) {
      expect(server).toContain(marker);
      expect(client).not.toContain(marker);
    }
  });
});
