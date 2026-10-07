import { describe, expect, test } from "vitest";
import { buildCareCard, type CareCandidate } from "./together-care";

const MEMBERS = [
  { id: "a", name: "Аня" },
  { id: "b", name: "Борис" },
] as const;

const item = (ownerId: string, category: CareCandidate["category"], action: string, context: string | null = null, sourceId = "m01-d14"): CareCandidate => ({ ownerId, category, action, context, sourceId });

describe("buildCareCard", () => {
  test("puts every author's own items under their name, by kind, with the context kept", () => {
    const card = buildCareCard(MEMBERS, [
      item("a", "attention", "Спросить, что нужно", "Когда я устала", "m01-d14"),
      item("a", "ease", "Дать время переключиться", null, "m01-d15"),
      item("b", "attention", "Обнять и помолчать", null, "m01-d17"),
      item("b", "ease", "Взять на себя ужин", "В будни", "m01-d19"),
    ]);

    expect(card.title).toBe("Наши способы заботы");
    expect(card.members).toEqual([
      { id: "a", name: "Аня", attention: [{ text: "Спросить, что нужно", context: "Когда я устала" }], ease: [{ text: "Дать время переключиться", context: null }] },
      { id: "b", name: "Борис", attention: [{ text: "Обнять и помолчать", context: null }], ease: [{ text: "Взять на себя ужин", context: "В будни" }] },
    ]);
    expect(card).toMatchObject({ complete: true, empty: false });
  });

  test("keeps the order of the source cards and lists the ritual ideas with their authors", () => {
    const card = buildCareCard(MEMBERS, [
      item("a", "attention", "Второе", null, "m01-d18"),
      item("a", "attention", "Первое", null, "m01-d14"),
      item("b", "ritual", "Чай по воскресеньям", "Вечером, 20 минут", "m01-d24"),
      item("a", "ritual", "Прогулка после ужина", null, "m01-d24"),
    ]);

    expect(card.members[0]!.attention.map((entry) => entry.text)).toEqual(["Первое", "Второе"]);
    expect(card.rituals).toEqual([
      { ownerId: "b", ownerName: "Борис", text: "Чай по воскресеньям", context: "Вечером, 20 минут" },
      { ownerId: "a", ownerName: "Аня", text: "Прогулка после ужина", context: null },
    ]);
  });

  test("is incomplete until each person has an attention item and an ease item, and empty without any item", () => {
    expect(buildCareCard(MEMBERS, [])).toMatchObject({ complete: false, empty: true, rituals: [] });
    const partial = buildCareCard(MEMBERS, [item("a", "attention", "Раз"), item("a", "ease", "Два"), item("b", "attention", "Три")]);

    expect(partial).toMatchObject({ complete: false, empty: false });
  });

  test("trims the text, drops blank items and ignores authors who are not in the pair", () => {
    const card = buildCareCard(MEMBERS, [item("a", "attention", "  Спросить  ", "   "), item("a", "ease", "   "), item("stranger", "attention", "Чужое")]);

    expect(card.members[0]!.attention).toEqual([{ text: "Спросить", context: null }]);
    expect(card.members[0]!.ease).toEqual([]);
    expect(card.members.flatMap((member) => member.attention)).toHaveLength(1);
  });

  test("cuts over-long texts instead of failing, so one bad answer cannot hide the card", () => {
    const card = buildCareCard(MEMBERS, [item("a", "attention", "я".repeat(500), "к".repeat(500))]);

    const entry = card.members[0]!.attention[0]!;
    expect([...entry.text].length).toBeLessThanOrEqual(180);
    expect([...entry.context!].length).toBeLessThanOrEqual(100);
  });
});
