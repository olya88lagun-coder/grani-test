import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildYearMap, cleanWord, isStockWord, WORD_LIMIT, YEAR_WORDS, type YearAnswers } from "./new-year-2027";
import { buildSlides, SAMPLE_ANSWERS, wallpaperWord } from "./new-year-cards";
import { YEAR_FAQ } from "./new-year-faq";

const full: YearAnswers = { recap: "Год перемен", gratitude: "За заботу о себе", release: "Спешку", direction: "Больше спокойствия", goal: "Курс керамики", obstacle: "Усталость" };
const slidesFor = (answers: YearAnswers, word?: string) => {
  const map = buildYearMap(answers);
  return buildSlides(map, word ?? map.word, map.firstStep, map.ifThen);
};

describe("year word", () => {
  test("defaults to the chosen direction and falls back to a neutral word", () => {
    expect(buildYearMap({ direction: "Больше близости" }).word).toBe("Близость");
    expect(buildYearMap({ direction: "Больше нового" }).word).toBe("Любопытство");
    expect(buildYearMap({ direction: "Секретное направление" }).word).toBe("Опора");
    expect(buildYearMap({}).word).toBe("Опора");
    expect(buildYearMap({ direction: "toString" }).word).toBe("Опора");
  });
  test("only offers short stock words", () => {
    for (const word of YEAR_WORDS) expect(word.length).toBeLessThanOrEqual(WORD_LIMIT);
    expect(YEAR_WORDS.length).toBeGreaterThanOrEqual(6);
  });
  test("cleans a custom word to one short line of plain text", () => {
    expect(cleanWord("  мой \n  год  ")).toBe("мой год");
    expect(cleanWord("я".repeat(80)).length).toBe(WORD_LIMIT);
    expect(cleanWord("<b>x</b>")).toBe("<b>x</b>");
    expect(cleanWord(42)).toBe("");
    expect(cleanWord(undefined)).toBe("");
  });
});

describe("answers shape the map, not only echo", () => {
  test("gratitude becomes a strength, release becomes something to leave behind", () => {
    const map = buildYearMap(full);
    expect(map.strength).toContain("заботе о себе");
    expect(map.leave?.title).toBe("Что оставить в 2026");
    expect(map.leave?.text).toContain("спешк");
    expect(map.lead).toMatch(/перемен/i);
  });
  test("custom answers are quoted back and unknown keys never hit object prototypes", () => {
    const custom = buildYearMap({ gratitude: "Начала бегать", release: "Чувство вины", recap: "Странный год" });
    expect(custom.strength).toContain("«Начала бегать»");
    expect(custom.leave?.text).toContain("«Чувство вины»");
    const proto = buildYearMap({ gratitude: "toString", release: "constructor", recap: "__proto__" });
    expect(proto.strength).toContain("«toString»");
    expect(proto.leave?.text).toContain("«constructor»");
    expect(proto.lead).not.toContain("function");
  });
  test("skipped questions leave no invented blocks", () => {
    const map = buildYearMap({});
    expect(map.strength).toBeNull();
    expect(map.leave).toBeNull();
    expect(map.lead).toBeNull();
    expect(map.answered).toEqual([]);
  });
  test("tracks which questions were actually answered", () => {
    expect(buildYearMap({ goal: "Курс", obstacle: "   " }).answered).toEqual(["goal"]);
  });
  test("generated copy avoids gender-marked past forms", () => {
    const map = buildYearMap(full);
    const text = [map.lead, map.strength, map.leave?.text, map.firstStep, map.ifThen].join(" ");
    // \b does not see Cyrillic, so the boundaries are Unicode letter lookarounds.
    expect(text).not.toMatch(/(?<!\p{L})(?:был|сделал|смог|устал|решил|пропустил|назвал|продолжал)(?!\p{L})/iu);
    expect("Ты пропустил вопросы").toMatch(/(?<!\p{L})пропустил(?!\p{L})/iu);
  });
});

describe("share slides", () => {
  test("a skipped scenario produces only neutral, non-personal slides", () => {
    const slides = slidesFor({});
    expect(slides.map((s) => s.id)).toEqual(["word", "support", "step", "ifthen"]);
    expect(slides.every((s) => !s.personal)).toBe(true);
  });
  test("answers make dependent slides personal, a stock word stays public", () => {
    const slides = slidesFor(full);
    expect(slides.map((s) => s.id)).toEqual(["word", "support", "leave", "step", "ifthen"]);
    expect(slides.find((s) => s.id === "word")?.personal).toBe(false);
    for (const id of ["support", "leave", "step", "ifthen"]) expect(slides.find((s) => s.id === id)?.personal).toBe(true);
  });
  test("a custom word is treated as personal text", () => {
    expect(slidesFor({}, "Мой секрет").find((s) => s.id === "word")?.personal).toBe(true);
    expect(slidesFor({}, "спокойствие").find((s) => s.id === "word")?.personal).toBe(false);
  });
  test("edited step and plan are personal even if the answers were skipped", () => {
    const map = buildYearMap({});
    const slides = buildSlides(map, map.word, "Позвонить маме в 19:00", "Если устану, то лягу спать");
    expect(slides.find((s) => s.id === "step")?.personal).toBe(true);
    expect(slides.find((s) => s.id === "ifthen")?.personal).toBe(true);
  });
  test("the word slide carries the headline only, never answers", () => {
    const word = slidesFor(full).find((s) => s.id === "word")!;
    expect(JSON.stringify(word)).not.toContain("Курс керамики");
    expect(word.text).toBe("Спокойствие");
  });
});

describe("wallpaper", () => {
  test("a typed word never reaches the wallpaper, a stock word does", () => {
    expect(wallpaperWord("Мой секрет", "Опора")).toBe("Опора");
    expect(wallpaperWord("Ясность", "Опора")).toBe("Ясность");
    expect(wallpaperWord("ясность", "Опора")).toBe("ясность");
    expect(wallpaperWord("", "Опора")).toBe("Опора");
  });
  test("the default word is always a stock word, so the fallback is safe", () => {
    for (const direction of ["Больше спокойствия", "Больше нового", "Больше близости", "Больше своего ритма", "Свой вариант", ""]) {
      expect(isStockWord(buildYearMap({ direction }).word)).toBe(true);
    }
  });
});

describe("copy stays gender-neutral beyond the generated map", () => {
  const forms = /(?<!\p{L})(?:был|сделал|смог|устал|решил|пропустил|назвал|продолжал|проходил|прошёл|вошёл|выбрал|ответил)(?!\p{L})/iu;
  test("FAQ answers and questions", () => {
    for (const item of YEAR_FAQ) expect(`${item.question} ${item.answer}`).not.toMatch(forms);
  });
  test("every visible string in the page components", () => {
    const dir = fileURLToPath(new URL("../app/new-year-2027/", import.meta.url));
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
      expect(readFileSync(path.join(dir, file), "utf8"), file).not.toMatch(forms);
    }
  });
});

describe("demo card", () => {
  test("sample answers use only stock options so the demo is the same for everyone", () => {
    const map = buildYearMap(SAMPLE_ANSWERS);
    expect(map.answered).toHaveLength(6);
    expect(map.leave).not.toBeNull();
    expect(map.strength).not.toBeNull();
  });
});
