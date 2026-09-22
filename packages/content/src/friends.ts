import { compareWithFriends, scoreItems, type Answers, type FriendComparison } from "@grani/core";
import { FRIEND_ITEMS } from "./items";

// Владелец и друзья считаются по одним и тем же 20 вопросам: так сравнение честное
export function compareFriendAnswers(ownerAnswers: Answers, friendAnswers: readonly Answers[]): FriendComparison | null {
  return compareWithFriends(
    scoreItems(FRIEND_ITEMS, ownerAnswers),
    friendAnswers.map((answers) => scoreItems(FRIEND_ITEMS, answers)),
  );
}
