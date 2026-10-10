/** Private practice data. Generated reports and payment contracts do not depend on it. */
export type MoneyAnswer = "a" | "b" | "c" | "unsure";
export type MoneyHabit = "pause" | "review" | "emotion" | "boundary";
export type MoneyPracticeData = {
  answers: (MoneyAnswer | null)[];
  habit: MoneyHabit | null;
  startedOn: string | null;
  done: boolean[];
  notes: string[];
  reflection: string;
  memo: string;
};
