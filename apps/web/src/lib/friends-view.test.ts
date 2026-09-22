import { TRAITS, type FriendComparison } from "@grani/core";
import { describe, expect, test } from "vitest";
import { buildFriendsView, friendIntro, friendsCounter } from "./friends-view";

const APP_URL = "https://grani-test.ru";

function comparison(diffs: Partial<Record<(typeof TRAITS)[number], number>>): FriendComparison {
  const traits = Object.fromEntries(
    TRAITS.map((trait) => {
      const diff = diffs[trait] ?? 0;
      return [trait, { self: 50, friends: 50 + diff, diff, notable: Math.abs(diff) > 15 }];
    }),
  ) as FriendComparison["traits"];
  return { friendsCount: 3, average: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, stability: 50 }, traits };
}

describe("friendIntro", () => {
  test("uses the pronoun only when gender is known", () => {
    expect(friendIntro("Аня", "female")).toBe("Аня просит оценить её. 20 вопросов, около 3 минут, анонимно.");
    expect(friendIntro("Борис", "male")).toBe("Борис просит оценить его. 20 вопросов, около 3 минут, анонимно.");
    expect(friendIntro("Саша", null)).toBe("Саша просит ответить на 20 вопросов о себе. Около 3 минут, анонимно.");
  });
});

describe("friendsCounter", () => {
  test("counts up to three and then just the total", () => {
    expect(friendsCounter(0)).toBe("Ответили 0 из 3");
    expect(friendsCounter(2)).toBe("Ответили 2 из 3");
    expect(friendsCounter(3)).toBe("Ответили 3 друга");
    expect(friendsCounter(5)).toBe("Ответили 5 друзей");
    expect(friendsCounter(21)).toBe("Ответил 21 друг");
  });
});

describe("buildFriendsView", () => {
  test("offers to create a link when there is none", () => {
    expect(buildFriendsView({ inviteToken: null, friendsCount: 0, needed: 3, comparison: null }, APP_URL)).toEqual({ state: "no_link" });
  });

  test("shows only the counter while fewer than three answered", () => {
    expect(buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 1, needed: 2, comparison: null }, APP_URL)).toEqual({
      state: "waiting",
      shareUrl: `${APP_URL}/f/${"t".repeat(24)}`,
      counter: "Ответили 1 из 3",
    });
  });

  test("describes notable differences and says when views match", () => {
    const view = buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 3, needed: 0, comparison: comparison({ openness: 22, stability: -18, extraversion: 15 }) }, APP_URL);

    expect(view.state).toBe("ready");
    if (view.state !== "ready") return;
    expect(view.summary).toBe("Заметнее всего расходятся оценки по шкалам: открытость опыту, эмоциональная устойчивость.");
    expect(view.rows.find((row) => row.trait === "openness")).toMatchObject({ self: 50, friends: 72, notable: true, phrase: "Друзья оценивают выше на 22" });
    expect(view.rows.find((row) => row.trait === "stability")?.phrase).toBe("Друзья оценивают ниже на 18");
    expect(view.rows.find((row) => row.trait === "extraversion")).toMatchObject({ notable: false, phrase: "Примерно так же, как ты" });
  });

  test("says that friends see the owner the same way when nothing is notable", () => {
    const view = buildFriendsView({ inviteToken: "t".repeat(24), friendsCount: 4, needed: 0, comparison: comparison({}) }, APP_URL);

    expect(view.state === "ready" && view.summary).toBe("Друзья видят тебя примерно так же, как ты себя.");
  });
});
