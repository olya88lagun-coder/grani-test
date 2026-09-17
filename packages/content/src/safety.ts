export type StopTopic = "diagnosis" | "medication" | "self_harm" | "appearance";

export const STOP_PATTERNS: readonly { readonly topic: StopTopic; readonly pattern: RegExp }[] = [
  {
    topic: "diagnosis",
    pattern:
      /диагноз|расстройств|депресси|биполяр|шизофрен|сдвг|аутизм|аутичн|психопат|социопат|нарциссическ|пограничн(?:ое|ого|ым) расстройств|невроз|психоз/iu,
  },
  {
    topic: "medication",
    pattern: /лекарств|(?<![а-яё])(?:из)?лечени|(?<![а-яё])(?:из)?лечит|таблетк|антидепрессант|транквилизатор|успокоительн|препарат|дозировк|рецепт врача/iu,
  },
  {
    topic: "self_harm",
    pattern: /суицид|самоубийств|самоповрежд|навредить себе|причинить себе вред|покончить с собой|свести счёты/iu,
  },
  {
    topic: "appearance",
    pattern: /внешност|некрасив|лишний вес|лишнего веса|толст(?:ый|ая|ые|еть)|худ(?:ой|ая|ые)|уродлив|фигур(?:а|ы|у|ой) у тебя/iu,
  },
];

export function findStopWords(text: string): StopTopic[] {
  return STOP_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ topic }) => topic);
}
