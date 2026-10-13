import { chapterSeeds } from "@grani/content";
import { CHAPTER_KINDS, type Trait } from "@grani/core";
import type { ChapterPart } from "./chapter-cards";
import type { ReportWriter } from "./generate";
import type { PersonalScores } from "./input";
import type { Prompt } from "./prompt";

export const SAMPLE_SCORES: PersonalScores = {
  scores: { openness: 30, conscientiousness: 45, extraversion: 50, agreeableness: 60, stability: 35 },
  typeCode: "--++",
  stability: "sensitive",
};

export function sampleOverview() {
  return {
    headline: "Ты щедрее к людям, чем к себе, и сильнее всего тревожишься из-за неожиданных трат",
    summary:
      "Деньги для тебя — способ заботиться о людях и держать опору под ногами. Осторожность с новым защищает от лишнего риска, а чувствительность к неожиданным тратам делает запас особенно важным. Ниже — шесть ситуаций с готовыми фразами и действиями.",
    others_see:
      "Близкие видят в тебе человека, на которого можно положиться, когда нужна помощь. При этом со стороны не всегда заметно, как сильно ты переживаешь из-за отданной суммы, поэтому полезно говорить об этом вслух.",
    traps: [
      { trap: "Соглашаться на просьбу сразу, а переживать потом", instead: "Попросить день на ответ и назвать сумму, которую готов отдать" },
      { trap: "Откладывать запас до «лучших времён»", instead: "Начать с суммы на одну неделю обычных расходов" },
      { trap: "Закрывать вопрос покупкой, чтобы стало спокойнее", instead: "Отложить покупку на сутки и проверить, чего на самом деле хочется" },
    ],
  };
}

// Своя формулировка совета у каждой из шести тем главы: проверка повторов не должна видеть в тестовых карточках одно и то же
const SAMPLE_ACTIONS = [
  "Перед следующей просьбой о деньгах назови вслух сумму, которую готов дать, и срок возврата.",
  "Открой заметку и выпиши три ближайших обязательных платежа, чтобы видеть запас до зарплаты.",
  "Когда захочется купить для настроения, поставь таймер на сутки и реши только после него.",
  "Найди одну альтернативу незнакомому предложению и сравни условия по двум пунктам.",
  "Раз в неделю по воскресеньям смотри на баланс карты десять минут и не больше.",
  "Перед встречей с друзьями решите, кто как платит, и закрепите это одним сообщением.",
] as const;

const actionFor = (seedId: string): string | undefined => {
  for (const kind of CHAPTER_KINDS) {
    const index = chapterSeeds(kind).findIndex((seed) => seed.id === seedId);
    if (index >= 0) return SAMPLE_ACTIONS[index];
  }
  return undefined;
};

export function sampleSituation(seed: { id: string; title: string }) {
  return {
    seed: seed.id,
    title: `Ситуация: ${seed.title}`,
    scene: `Например, возникает ситуация из темы «${seed.title}»: нужно быстро решить, как поступить, и вместе с решением приходит напряжение.`,
    why: "Здесь сходятся твои черты: осторожность и чуткость к людям подсказывают держаться знакомого, поэтому важно заранее знать свой ответ.",
    traits: ["agreeableness"] as Trait[],
    say: ["Мне нужно время подумать, отвечу завтра."],
    do: actionFor(seed.id) ?? `Выбери один шаг для темы «${seed.title}» и сделай его до конца недели.`,
  };
}

type Step = string | Error | "hang";

// Определяет часть по первой теме входа: пустой список — обзор, первая тема главы — группа A, иначе группа B
const FIRST_SEEDS: ReadonlySet<string> = new Set(CHAPTER_KINDS.map((kind) => chapterSeeds(kind)[0]!.id));

function partOf(prompt: Prompt): ChapterPart {
  const seeds = (JSON.parse(prompt.user) as { seeds: { id: string }[] }).seeds;
  if (seeds.length === 0) return "overview";
  return FIRST_SEEDS.has(seeds[0]!.id) ? "situations_a" : "situations_b";
}

// Заглушка модели для глав-карточек: по умолчанию отвечает корректно, script задаёт цепочку ответов для части
export function cardsStubWriter(script: Partial<Record<ChapterPart, readonly Step[]>> = {}): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const queues = new Map<ChapterPart, Step[]>(Object.entries(script).map(([part, steps]) => [part as ChapterPart, [...(steps as Step[])]]));
  return {
    name: "stub",
    calls,
    async complete(prompt) {
      calls.push(prompt);
      const part = partOf(prompt);
      const step = queues.get(part)?.shift();
      if (step === "hang") return new Promise<string>(() => {});
      if (step instanceof Error) throw step;
      if (typeof step === "string") return step;
      const seeds = (JSON.parse(prompt.user) as { seeds: { id: string; title: string }[] }).seeds;
      return JSON.stringify(part === "overview" ? sampleOverview() : { situations: seeds.map(sampleSituation) });
    },
  };
}
