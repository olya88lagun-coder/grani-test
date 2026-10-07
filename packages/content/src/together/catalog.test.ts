import { describe, expect, test } from "vitest";
import { buildTrack, CARE_READY_CARD_ID, CARE_SOURCES, toSnapshot, TOGETHER_DATE_CARD_IDS, TOGETHER_MONTHS, TOGETHER_TRACK } from "./catalog";
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
  test("has 159 unique cards: three intro cards, then months 1 to 6 of 26 cards each, in order", () => {
    const ids = TOGETHER_TRACK.map((card) => card.id);
    expect(ids).toHaveLength(159);
    expect(new Set(ids).size).toBe(159);
    expect(ids.slice(0, 3)).toEqual(["intro-01", "intro-02", "intro-03"]);
    expect(ids[3]).toBe("m01-d01");
    expect(ids[28]).toBe("m01-d26");
    expect(ids[29]).toBe("m02-d01");
    expect(ids.at(-1)).toBe("m06-d26");
    for (const month of [1, 2, 3, 4, 5, 6]) expect(ids).not.toContain(`m0${month}-d27`);
    expect(TOGETHER_TRACK.slice(0, 3).every((card) => card.kind === "intro")).toBe(true);
    expect(TOGETHER_TRACK.slice(3).every((card) => card.kind === "main")).toBe(true);
  });

  test("month N opens after N-1 stages of paid time: intro and month 1 are open from the start", () => {
    for (const card of TOGETHER_TRACK) {
      const month = card.id.startsWith("m0") ? Number(card.id.slice(2, 3)) : 0;
      expect(card.unlockStage ?? 0, card.id).toBe(month >= 2 ? month - 1 : 0);
    }
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
    const dates = TOGETHER_TRACK.filter((card) => card.id.startsWith("m01-") && card.title.startsWith("Свидание"));
    expect(dates.map((card) => card.id)).toEqual(["m01-d07", "m01-d13", "m01-d20", "m01-d25"]);
    for (const card of dates) expect(card.hint, card.id).toContain("\n1. ");
  });

  test("lists every card of the track in exactly one week, in order", () => {
    const days = month01.weeks.flatMap((week) => week.days);
    expect(days).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
  });
});

describe("month 2", () => {
  const month2 = TOGETHER_MONTHS[2]!;

  test("passes the card schema with 26 unique main cards and the four dates in the same slots as month 1", () => {
    expect(month2).toHaveLength(26);
    expect(new Set(month2.map((card) => card.id)).size).toBe(26);
    expect(month2.every((card) => card.kind === "main" && card.skipAllowed)).toBe(true);
    const dates = month2.filter((card) => card.title.startsWith("Свидание"));
    expect(dates.map((card) => card.id)).toEqual(["m02-d07", "m02-d13", "m02-d20", "m02-d25"]);
    for (const card of dates) expect(card.hint, card.id).toContain("\n1. ");
    for (const card of month2) {
      expect(card.prompt.length, card.id).toBeLessThanOrEqual(220);
      expect(card.hint.length, card.id).toBeLessThanOrEqual(700);
    }
  });

  test("keeps its week map complete and the structured acquaintance fields that the first chapter is built from", () => {
    expect(month02.weeks.flatMap((week) => week.days)).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
    expect(month2[0]!.fields.map((field) => field.id)).toEqual(["answer", "approx_date", "setting", "remembered_detail", "share_in_book"]);
  });
});

describe("months 3 to 6", () => {
  for (const month of [3, 4, 5, 6]) {
    test(`month ${month} has 26 unique main cards, four dates in the usual slots and short prompts`, () => {
      const cards = TOGETHER_MONTHS[month]!;
      expect(cards).toHaveLength(26);
      expect(new Set(cards.map((card) => card.id)).size).toBe(26);
      expect(cards.every((card) => card.kind === "main" && card.skipAllowed)).toBe(true);
      const dates = cards.filter((card) => card.hint.includes("\n1. "));
      expect(cards.filter((card) => card.title.startsWith("Свидание")).map((card) => card.id), "date titles").toEqual(dates.map((card) => card.id));
      expect(dates.map((card) => card.id)).toEqual([7, 13, 20, 25].map((n) => `m0${month}-d${String(n).padStart(2, "0")}`));
      for (const card of dates) expect(card.hint, card.id).toContain("\n1. ");
      for (const card of cards) {
        expect(card.prompt.length, card.id).toBeLessThanOrEqual(220);
        expect(card.hint.length, card.id).toBeLessThanOrEqual(700);
        expect(card.prompt, card.id).not.toMatch(/[(][а-я]+[)]/);
      }
    });
  }

  test("all months are part of the playable track, in order", () => {
    const fromMonths = [2, 3, 4, 5, 6].flatMap((month) => TOGETHER_MONTHS[month]!.map((card) => card.id));
    expect(TOGETHER_TRACK.slice(29).map((card) => card.id)).toEqual(fromMonths);
  });
});

describe("care card sources", () => {
  test("the cards that feed «Наши способы заботы» are the week 3 and 4 cards with a care binding, by kind", () => {
    expect(CARE_SOURCES).toEqual({
      "m01-d14": "attention",
      "m01-d15": "ease",
      "m01-d17": "attention",
      "m01-d18": "attention",
      "m01-d19": "ease",
      "m01-d24": "ritual",
    });
  });

  test("every source card is in the track and has the action, context and consent fields the card reads", () => {
    for (const id of Object.keys(CARE_SOURCES)) {
      const card = TOGETHER_TRACK.find((entry) => entry.id === id);
      expect(card, id).toBeDefined();
      const types = Object.fromEntries(card!.fields.map((field) => [field.id, field.type]));
      expect(types, id).toMatchObject({ care_action: "short_text", care_context: "short_text", allow_care_reward: "boolean" });
      expect(card!.fields.find((field) => field.id === "allow_care_reward"), id).toMatchObject({ availableAt: "after_reveal" });
    }
  });

  test("the card is ready once the month reflection card is closed, and that card is in the track", () => {
    expect(CARE_READY_CARD_ID).toBe("m01-d26");
    expect(TOGETHER_TRACK.some((card) => card.id === CARE_READY_CARD_ID)).toBe(true);
  });
});

describe("date cards", () => {
  test("every month has four dates in the usual slots, 24 in the six months, and they are the cards with numbered steps", () => {
    const expected = [1, 2, 3, 4, 5, 6].flatMap((month) => [7, 13, 20, 25].map((n) => `m0${month}-d${String(n).padStart(2, "0")}`));

    expect([...TOGETHER_DATE_CARD_IDS].sort()).toEqual([...expected].sort());
    for (const id of TOGETHER_DATE_CARD_IDS) expect(TOGETHER_TRACK.find((card) => card.id === id)!.title, id).toMatch(/^Свидание/);
  });
});
