import type { ItemKey, Trait } from "@grani/core";

export const NAME_PLACEHOLDER = "{name}";

export type SelfItem = ItemKey & { readonly number: number; readonly text: string; readonly source: string };

export type FriendItem = ItemKey & { readonly text: string };

function selfItem(number: number, trait: Trait, reversed: boolean, source: string, text: string): SelfItem {
  return { id: `ipip-${String(number).padStart(2, "0")}`, number, trait, reversed, source, text };
}

const E = "extraversion";
const A = "agreeableness";
const C = "conscientiousness";
const S = "stability";
const O = "openness";

export const SELF_ITEMS: readonly SelfItem[] = [
  selfItem(1, E, false, "Am the life of the party", "Я душа компании."),
  selfItem(2, A, true, "Feel little concern for others", "Меня мало волнуют другие люди."),
  selfItem(3, C, false, "Am always prepared", "Я всегда заранее готовлюсь."),
  selfItem(4, S, true, "Get stressed out easily", "Я легко впадаю в стресс."),
  selfItem(5, O, false, "Have a rich vocabulary", "У меня богатый словарный запас."),
  selfItem(6, E, true, "Don't talk a lot", "Я говорю немного."),
  selfItem(7, A, false, "Am interested in people", "Мне интересны люди."),
  selfItem(8, C, true, "Leave my belongings around", "Я оставляю свои вещи где попало."),
  selfItem(9, S, false, "Am relaxed most of the time", "Большую часть времени мне спокойно."),
  selfItem(10, O, true, "Have difficulty understanding abstract ideas", "Мне трудно понимать абстрактные идеи."),
  selfItem(11, E, false, "Feel comfortable around people", "Мне комфортно среди людей."),
  selfItem(12, A, true, "Insult people", "Я говорю людям обидные вещи."),
  selfItem(13, C, false, "Pay attention to details", "Я обращаю внимание на детали."),
  selfItem(14, S, true, "Worry about things", "Я много тревожусь по разным поводам."),
  selfItem(15, O, false, "Have a vivid imagination", "У меня живое воображение."),
  selfItem(16, E, true, "Keep in the background", "Я держусь в тени."),
  selfItem(17, A, false, "Sympathize with others' feelings", "Я сопереживаю другим людям."),
  selfItem(18, C, true, "Make a mess of things", "У меня часто всё идёт кувырком."),
  selfItem(19, S, false, "Seldom feel blue", "Мне редко бывает грустно."),
  selfItem(20, O, true, "Am not interested in abstract ideas", "Абстрактные идеи мне неинтересны."),
  selfItem(21, E, false, "Start conversations", "Я легко начинаю разговор."),
  selfItem(22, A, true, "Am not interested in other people's problems", "Чужие проблемы меня не интересуют."),
  selfItem(23, C, false, "Get chores done right away", "Я делаю дела сразу, не откладывая."),
  selfItem(24, S, true, "Am easily disturbed", "Меня легко выбить из колеи."),
  selfItem(25, O, false, "Have excellent ideas", "Мне приходят в голову отличные идеи."),
  selfItem(26, E, true, "Have little to say", "Мне редко есть что сказать."),
  selfItem(27, A, false, "Have a soft heart", "У меня мягкое сердце."),
  selfItem(28, C, true, "Often forget to put things back in their proper place", "Я часто забываю класть вещи на место."),
  selfItem(29, S, true, "Get upset easily", "Я легко расстраиваюсь."),
  selfItem(30, O, true, "Do not have a good imagination", "Воображение — не моя сильная сторона."),
  selfItem(31, E, false, "Talk to a lot of different people at parties", "На вечеринках я общаюсь со множеством разных людей."),
  selfItem(32, A, true, "Am not really interested in others", "Другие люди мне не особенно интересны."),
  selfItem(33, C, false, "Like order", "Я люблю порядок."),
  selfItem(34, S, true, "Change my mood a lot", "Моё настроение часто меняется."),
  selfItem(35, O, false, "Am quick to understand things", "Я быстро схватываю новое."),
  selfItem(36, E, true, "Don't like to draw attention to myself", "Я не люблю привлекать к себе внимание."),
  selfItem(37, A, false, "Take time out for others", "Я нахожу время для других."),
  selfItem(38, C, true, "Shirk my duties", "Я увиливаю от своих обязанностей."),
  selfItem(39, S, true, "Have frequent mood swings", "У меня бывают резкие перепады настроения."),
  selfItem(40, O, false, "Use difficult words", "Я использую сложные слова."),
  selfItem(41, E, false, "Don't mind being the center of attention", "Я не против быть в центре внимания."),
  selfItem(42, A, false, "Feel others' emotions", "Я чувствую эмоции других людей."),
  selfItem(43, C, false, "Follow a schedule", "Я следую распорядку."),
  selfItem(44, S, true, "Get irritated easily", "Я легко раздражаюсь."),
  selfItem(45, O, false, "Spend time reflecting on things", "Я часто размышляю о разных вещах."),
  selfItem(46, E, true, "Am quiet around strangers", "С незнакомыми людьми я больше молчу."),
  selfItem(47, A, false, "Make people feel at ease", "Рядом со мной людям спокойно и легко."),
  selfItem(48, C, false, "Am exacting in my work", "В работе я требую от себя точности."),
  selfItem(49, S, true, "Often feel blue", "Мне часто бывает грустно."),
  selfItem(50, O, false, "Am full of ideas", "У меня всегда много идей."),
];

const FRIEND_TEXTS: Readonly<Record<string, string>> = {
  "ipip-01": "{name} — душа компании.",
  "ipip-21": "{name} легко начинает разговор.",
  "ipip-16": "{name} держится в тени.",
  "ipip-46": "С незнакомыми людьми {name} больше молчит.",
  "ipip-17": "{name} сопереживает другим людям.",
  "ipip-47": "{name} умеет сделать так, что людям рядом спокойно и легко.",
  "ipip-02": "{name} мало интересуется чувствами других.",
  "ipip-12": "{name} говорит людям обидные вещи.",
  "ipip-03": "{name} всегда заранее готовится.",
  "ipip-23": "{name} делает дела сразу, не откладывая.",
  "ipip-08": "{name} оставляет вещи где попало.",
  "ipip-38": "{name} увиливает от своих обязанностей.",
  "ipip-09": "{name} большую часть времени сохраняет спокойствие.",
  "ipip-19": "{name} редко грустит.",
  "ipip-04": "{name} легко впадает в стресс.",
  "ipip-44": "{name} легко раздражается.",
  "ipip-15": "{name} умеет ярко фантазировать.",
  "ipip-50": "{name} постоянно придумывает новые идеи.",
  "ipip-20": "{name} не интересуется абстрактными идеями.",
  "ipip-30": "{name} редко фантазирует.",
};

export const FRIEND_ITEMS: readonly FriendItem[] = SELF_ITEMS.flatMap((item) => {
  const text = FRIEND_TEXTS[item.id];
  return text === undefined ? [] : [{ id: item.id, trait: item.trait, reversed: item.reversed, text }];
});

export function friendItemText(item: FriendItem, name: string): string {
  return item.text.replace(NAME_PLACEHOLDER, name);
}
