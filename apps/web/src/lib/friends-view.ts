import { MIN_FRIENDS, TRAITS, type Gender, type Trait } from "@grani/core";
import type { FriendsSummary } from "@/server/friends-service";
import { TRAIT_LABELS } from "./result-view";

export type FriendRow = { trait: Trait; label: string; self: number; friends: number; phrase: string; notable: boolean };
export type FriendsView =
  | { state: "no_link" }
  | { state: "waiting"; shareUrl: string; counter: string }
  | { state: "ready"; shareUrl: string; counter: string; summary: string; rows: readonly FriendRow[] };

const PRONOUNS: Readonly<Record<Exclude<Gender, null>, string>> = { female: "её", male: "его" };

export function friendIntro(firstName: string, gender: Gender): string {
  if (gender === null) return `${firstName} просит ответить на 20 вопросов о себе. Около 3 минут, анонимно.`;
  return `${firstName} просит оценить ${PRONOUNS[gender]}. 20 вопросов, около 3 минут, анонимно.`;
}

// 1 друг, 2–4 друга, 5–20 друзей; 11–14 — «друзей»
function pluralFriends(count: number): { verb: string; noun: string } {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return { verb: "Ответил", noun: "друг" };
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return { verb: "Ответили", noun: "друга" };
  return { verb: "Ответили", noun: "друзей" };
}

export function friendsCounter(friendsCount: number): string {
  if (friendsCount < MIN_FRIENDS) return `Ответили ${friendsCount} из ${MIN_FRIENDS}`;
  const { verb, noun } = pluralFriends(friendsCount);
  return `${verb} ${friendsCount} ${noun}`;
}

function phraseFor(diff: number, notable: boolean): string {
  if (!notable) return "Примерно так же, как ты";
  return diff > 0 ? `Друзья оценивают выше на ${diff}` : `Друзья оценивают ниже на ${-diff}`;
}

export function buildFriendsView(summary: FriendsSummary, appUrl: string): FriendsView {
  if (!summary.inviteToken) return { state: "no_link" };
  const shareUrl = new URL(`/f/${summary.inviteToken}`, appUrl).toString();
  const counter = friendsCounter(summary.friendsCount);
  if (!summary.comparison) return { state: "waiting", shareUrl, counter };

  const traits = summary.comparison.traits;
  const rows = TRAITS.map((trait) => {
    const { self, friends, diff, notable } = traits[trait];
    return { trait, label: TRAIT_LABELS[trait], self, friends, notable, phrase: phraseFor(diff, notable) };
  });
  const notableLabels = rows.filter((row) => row.notable).map((row) => row.label.toLowerCase());
  const summaryText =
    notableLabels.length === 0
      ? "Друзья видят тебя примерно так же, как ты себя."
      : `Заметнее всего расходятся оценки по шкалам: ${notableLabels.join(", ")}.`;
  return { state: "ready", shareUrl, counter, summary: summaryText, rows };
}
