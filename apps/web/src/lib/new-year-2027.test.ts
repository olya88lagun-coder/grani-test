import { describe, expect, test } from "vitest";
import { buildYearMap, shareContent, validProfile, parseYearDraft, type YearAnswers } from "./new-year-2027";

const scores = { openness: 80, conscientiousness: 30, extraversion: 20, agreeableness: 70, stability: 40 };
describe("2027 reflection", () => {
  test("all skipped stays honest and provides an actionable default", () => {
    const map = buildYearMap({});
    expect(map.reflections).toEqual([]);
    expect(map.profileUsed).toBe(false);
    expect(map.firstStep).toContain("10 минут");
    expect(map.ifThen).toContain("Если");
    expect(map.supports.length).toBeGreaterThan(0);
  });
  test("reflects every answer verbatim without inferring traits", () => {
    const answers: YearAnswers = { recap: "Смена работы", gratitude: "Не сдалась", release: "Спешку", direction: "Больше спокойствия", goal: "Курс керамики", obstacle: "Мало времени" };
    const map = buildYearMap(answers);
    expect(map.reflections.map((r) => r.text)).toEqual(Object.values(answers));
    expect(map.goal).toBe("Курс керамики");
    expect(map.ifThen).toContain("Мало времени");
    expect(map.profileUsed).toBe(false);
  });
  test("requires five finite scores and refuses incomplete or out of range data", () => {
    for (const value of [null, {}, { ...scores, openness: NaN }, { ...scores, stability: -1 }, { ...scores, agreeableness: 101 }, { ...scores, openness: "80" }]) {
      expect(validProfile(value)).toBe(false);
    }
    expect(validProfile(scores)).toBe(true);
    expect(buildYearMap({}, { ...scores, openness: 101 }).profileUsed).toBe(false);
  });
  test("uses actual trait direction and treats core borderline values as neutral", () => {
    const map = buildYearMap({}, scores);
    expect(map.profileUsed).toBe(true);
    expect(map.supports.join(" ")).toContain("эксперимент");
    expect(map.supports.join(" ")).toContain("короткий список");
    const neutral = buildYearMap({}, { openness: 45, conscientiousness: 55, extraversion: 50, agreeableness: 45, stability: 55 });
    expect(neutral.supports.join(" ")).not.toContain("эксперимент");
    expect(neutral.supports.join(" ")).not.toContain("короткий список");
  });
  test("default share omits all private answers, even custom direction", () => {
    const map = buildYearMap({ direction: "Секретное направление", goal: "Личная цель", obstacle: "Мой страх", gratitude: "Моя история" }, scores);
    const output = JSON.stringify(shareContent(map, false));
    for (const secret of ["Секретное", "Личная цель", "Мой страх", "Моя история", "openness", "80"]) expect(output).not.toContain(secret);
    expect(shareContent(map, true).goal).toBe("Личная цель");
  });
  test("trims and bounds restored input and keeps HTML as plain text", () => {
    expect(buildYearMap({ goal: "  <script>hello</script>  " }).goal).toBe("<script>hello</script>");
    expect(buildYearMap({ goal: "я".repeat(900) }).goal.length).toBeLessThanOrEqual(300);
  });
  test("treats object property names as custom text, not built-in choices", () => {
    const map = buildYearMap({ direction: "toString", obstacle: "toString" });
    expect(map.ifThen).not.toContain("function");
    expect(map.title).toBe("Место для своего");
  });
  test("rejects corrupt or old drafts and bounds restored state", () => {
    for (const raw of ["not json", "null", "{}", '{"version":2,"answers":{}}']) expect(parseYearDraft(raw)).toBeNull();
    expect(parseYearDraft('{"version":1,"answers":{"goal":123},"step":900,"result":true}')).toMatchObject({ answers: { goal: "" }, step: 5, result: true });
  });
  test("restores user-edited step, if-then plan and profile preference", () => {
    const draft = parseYearDraft(JSON.stringify({ version: 1, answers: {}, edits: { firstStep: "Мой шаг", ifThen: "Мой план" }, useProfile: false }));
    expect(draft).toMatchObject({ edits: { firstStep: "Мой шаг", ifThen: "Мой план" }, useProfile: false });
  });
});
