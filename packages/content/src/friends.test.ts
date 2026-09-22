import type { Answer, Answers } from "@grani/core";
import { expect, test } from "vitest";
import { compareFriendAnswers } from "./friends";
import { FRIEND_ITEMS } from "./items";

const all = (value: Answer): Answers => Object.fromEntries(FRIEND_ITEMS.map((item) => [item.id, value]));

test("compares the owner's own answers on the friend items with the friends' average", () => {
  expect(compareFriendAnswers(all(3), [all(3), all(3)])).toBeNull();

  const comparison = compareFriendAnswers(all(3), [all(3), all(3), all(3)]);

  expect(comparison?.friendsCount).toBe(3);
  expect(comparison?.traits.openness).toEqual({ self: 50, friends: 50, diff: 0, notable: false });
});
