import { describe, expect, test } from "vitest";
import { buildTrack, toSnapshot, TOGETHER_MONTH_2, TOGETHER_TRACK } from "./catalog";
import intro from "./intro.json";
import month01 from "./month-01.json";
import month02 from "./month-02.json";

const validCard = {
  id: "x-01",
  version: 1,
  title: "T",
  estimatedMinutes: 5,
  prompt: "P",
  hint: "H",
  fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
  revealPolicy: "after_both_submit",
  jointAction: "J",
  skipAllowed: true,
};

describe("together track", () => {
  test("has 29 unique cards: three intro cards then m01-d01 … m01-d26", () => {
    const ids = TOGETHER_TRACK.map((card) => card.id);
    expect(ids).toHaveLength(29);
    expect(new Set(ids).size).toBe(29);
    expect(ids.slice(0, 3)).toEqual(["intro-01", "intro-02", "intro-03"]);
    expect(ids[3]).toBe("m01-d01");
    expect(ids.at(-1)).toBe("m01-d26");
    expect(ids).not.toContain("m01-d27");
    expect(TOGETHER_TRACK.slice(0, 3).every((card) => card.kind === "intro")).toBe(true);
    expect(TOGETHER_TRACK.slice(3).every((card) => card.kind === "main")).toBe(true);
  });

  test("every card has a required answer field and only supported field types", () => {
    for (const card of TOGETHER_TRACK) {
      expect(card.fields.find((field) => field.id === "answer")).toMatchObject({ type: "short_text", required: true });
      expect(card.fields.every((field) => field.type === "short_text" || field.type === "boolean")).toBe(true);
      expect(card.fields.filter((field) => field.type === "short_text").every((field) => (field.maxLength ?? 0) > 0 && (field.maxLength ?? 0) <= 1200)).toBe(true);
      expect(card.skipAllowed).toBe(true);
    }
  });

  test("boolean fields that need a reveal are marked after_reveal", () => {
    const first = TOGETHER_TRACK[3]!;
    expect(first.fields.find((field) => field.id === "share_in_book")).toMatchObject({ type: "boolean", availableAt: "after_reveal" });
  });
});

describe("toSnapshot", () => {
  test("keeps only the fields the server needs", () => {
    expect(toSnapshot({ ...validCard, rewardBinding: { type: "attention" } }, "main")).toEqual({
      id: "x-01",
      version: 1,
      kind: "main",
      title: "T",
      estimatedMinutes: 5,
      prompt: "P",
      hint: "H",
      jointAction: "J",
      skipAllowed: true,
      fields: [{ id: "answer", type: "short_text", label: "L", required: true, maxLength: 100 }],
    });
  });

  test("rejects an unsupported field type, a different reveal policy and a missing answer field", () => {
    const reference = { id: "pick", type: "candidate_reference", label: "L", required: false };
    expect(() => toSnapshot({ ...validCard, fields: [...validCard.fields, reference] }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, revealPolicy: "immediately" }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, fields: [{ ...validCard.fields[0], id: "other" }] }, "main")).toThrow();
    expect(() => toSnapshot({ ...validCard, fields: [{ ...validCard.fields[0], required: false }] }, "main")).toThrow();
  });
});

describe("buildTrack", () => {
  test("fails loudly when a card of the track is missing", () => {
    expect(() => buildTrack(intro.cards.slice(0, 2), [])).toThrow(/intro-03/);
  });
});

describe("month 1 editorial invariants", () => {
  const inTrack = month01.cards.filter((card) => TOGETHER_TRACK.some((item) => item.id === card.id));
  const bindingType = (card: unknown) => (card as { rewardBinding?: { type?: string } | null }).rewardBinding?.type;

  test("keeps enough sources in the track for the final care card: attention, ease and a ritual", () => {
    const types = inTrack.map(bindingType);
    expect(types.filter((type) => type === "attention").length).toBeGreaterThanOrEqual(2);
    expect(types.filter((type) => type === "ease").length).toBeGreaterThanOrEqual(2);
    expect(types.filter((type) => type === "ritual").length).toBeGreaterThanOrEqual(1);
  });

  test("keeps prompts short and puts the steps of a date card into the hint, where they are visible before answering", () => {
    for (const card of TOGETHER_TRACK) {
      expect(card.prompt.length, card.id).toBeLessThanOrEqual(220);
      expect(card.hint.length, card.id).toBeLessThanOrEqual(700);
    }
    const dates = TOGETHER_TRACK.filter((card) => card.title.startsWith("Свидание"));
    expect(dates.map((card) => card.id)).toEqual(["m01-d07", "m01-d13", "m01-d20", "m01-d25"]);
    for (const card of dates) expect(card.hint, card.id).toContain("\n1. ");
  });

  test("lists every card of the track in exactly one week, in order", () => {
    const days = month01.weeks.flatMap((week) => week.days);
    expect(days).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
  });
});

describe("month 2 draft (written, not yet in the track)", () => {
  test("passes the card schema with 26 unique main cards and the four dates in the same slots as month 1", () => {
    expect(TOGETHER_MONTH_2).toHaveLength(26);
    expect(new Set(TOGETHER_MONTH_2.map((card) => card.id)).size).toBe(26);
    expect(TOGETHER_MONTH_2.every((card) => card.kind === "main" && card.skipAllowed)).toBe(true);
    const dates = TOGETHER_MONTH_2.filter((card) => card.title.startsWith("Свидание"));
    expect(dates.map((card) => card.id)).toEqual(["m02-d07", "m02-d13", "m02-d20", "m02-d25"]);
    for (const card of dates) expect(card.hint, card.id).toContain("\n1. ");
    for (const card of TOGETHER_MONTH_2) {
      expect(card.prompt.length, card.id).toBeLessThanOrEqual(220);
      expect(card.hint.length, card.id).toBeLessThanOrEqual(700);
    }
  });

  test("is not part of the playable track yet and keeps its week map complete", () => {
    expect(TOGETHER_TRACK.some((card) => card.id.startsWith("m02-"))).toBe(false);
    expect(month02.weeks.flatMap((week) => week.days)).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
  });

  test("keeps the structured acquaintance fields that the first chapter is built from", () => {
    const first = TOGETHER_MONTH_2[0]!;
    expect(first.fields.map((field) => field.id)).toEqual(["answer", "approx_date", "setting", "remembered_detail", "share_in_book"]);
  });
});
