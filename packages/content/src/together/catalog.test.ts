import { describe, expect, test } from "vitest";
import { buildTrack, toSnapshot, TOGETHER_TRACK } from "./catalog";
import intro from "./intro.json";

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
