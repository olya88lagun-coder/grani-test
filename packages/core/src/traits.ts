export const TRAITS = ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"] as const;

export type Trait = (typeof TRAITS)[number];

export type TraitScores = Readonly<Record<Trait, number>>;
