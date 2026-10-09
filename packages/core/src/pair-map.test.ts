import { expect, test } from "vitest";

const ids = ["conflict", "home", "money", "social", "closeness", "support", "plans", "decisions"] as const;
const values = () => Object.fromEntries(ids.map(id => [id, { text: "Ответ", skipped: false }])) as Record<(typeof ids)[number], {text:string;skipped:boolean}>;
async function subject() {
  const module = await import("./pair-map").catch(() => null);
  expect(module, "Shared pair input model must exist").not.toBeNull();
  return module!;
}

test("validates exactly eight answers and accepts explicit skips", async () => {
  const model = await subject();
  const answers = values();
  answers.home = { text: "", skipped: true };
  expect(model.parseSurveyAnswers(answers, true)).toEqual(answers);
  expect(model.parseSurveyAnswers({ ...answers, secret: { text: "bad", skipped: false } }, true)).toBeNull();
  const { conflict, ...missing } = answers;
  expect(model.parseSurveyAnswers(missing, false)).toBeNull();
});
test("allows incomplete private drafts but rejects incomplete publication", async () => {
  const model = await subject();
  const answers = values(); answers.home = { text: "  ", skipped: false };
  expect(model.parseSurveyAnswers(answers, false)?.home.text).toBe("");
  expect(model.parseSurveyAnswers(answers, true)).toBeNull();
  answers.home = { text: "Secret", skipped: true };
  expect(model.parseSurveyAnswers(answers, false)).toBeNull();
});
test("counts Unicode code points, normalizes newlines and rejects controls", async () => {
  const model = await subject();
  const answers = values(); answers.home.text = "🙂".repeat(600);
  expect(model.parseSurveyAnswers(answers, true)?.home.text).toBe(answers.home.text);
  answers.home.text += "🙂";
  expect(model.parseSurveyAnswers(answers, false)).toBeNull();
  answers.home.text = "  А\r\nБ  ";
  expect(model.parseSurveyAnswers(answers, true)?.home.text).toBe("А\nБ");
  answers.home.text = "А\u0000Б";
  expect(model.parseSurveyAnswers(answers, false)).toBeNull();
});
