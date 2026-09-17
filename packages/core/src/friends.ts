import { TRAITS, type Trait, type TraitScores } from "./traits";

export const MIN_FRIENDS = 3;
export const FRIEND_DIFF_THRESHOLD = 15;

export type TraitComparison = {
  readonly self: number;
  readonly friends: number;
  readonly diff: number;
  readonly notable: boolean;
};

export type FriendComparison = {
  readonly friendsCount: number;
  readonly average: TraitScores;
  readonly traits: Readonly<Record<Trait, TraitComparison>>;
};

export function averageScores(list: readonly TraitScores[]): TraitScores {
  if (list.length === 0) throw new Error("Cannot average an empty list of scores");
  const entries = TRAITS.map((trait) => {
    const sum = list.reduce((total, item) => total + item[trait], 0);
    return [trait, Math.round(sum / list.length)] as const;
  });
  return Object.fromEntries(entries) as Record<Trait, number>;
}

function compareTrait(self: number, friends: number): TraitComparison {
  const diff = friends - self;
  return { self, friends, diff, notable: Math.abs(diff) > FRIEND_DIFF_THRESHOLD };
}

export function compareWithFriends(
  selfSubset: TraitScores,
  friends: readonly TraitScores[],
): FriendComparison | null {
  if (friends.length < MIN_FRIENDS) return null;
  const average = averageScores(friends);
  const traits = Object.fromEntries(
    TRAITS.map((trait) => [trait, compareTrait(selfSubset[trait], average[trait])] as const),
  ) as Record<Trait, TraitComparison>;
  return { friendsCount: friends.length, average, traits };
}
