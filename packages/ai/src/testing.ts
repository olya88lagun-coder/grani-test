import { chapterSeeds, lifeSeeds, portraitSeeds } from "@grani/content";
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

// Совет для каждой из пяти ситуаций «В жизни». «critique» совпадает с темой главы «Конфликты» и берёт её совет: внутри одного отчёта советы всё равно разные
const LIFE_SAMPLE_ACTIONS: Readonly<Record<string, string>> = {
  change: "Когда план сорвался, выпиши три обязательных пункта и один, который можно сдвинуть на неделю.",
  deadline: "За два дня до срока отдели то, без чего нельзя сдать, и закрой это первым, остальное запиши на потом.",
  talk: "Перед разговором запиши одну главную мысль и первую фразу и скажи её в первые полминуты встречи.",
  method: "Выбери один небольшой участок работы и попробуй чужой способ только на нём, потом сравни результат.",
};

const actionFor = (seedId: string): string | undefined => {
  for (const kind of CHAPTER_KINDS) {
    const index = chapterSeeds(kind).findIndex((seed) => seed.id === seedId);
    if (index >= 0) return SAMPLE_ACTIONS[index];
  }
  return LIFE_SAMPLE_ACTIONS[seedId];
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
const FIRST_SEEDS: ReadonlySet<string> = new Set([...CHAPTER_KINDS.map((kind) => chapterSeeds(kind)[0]!.id), lifeSeeds()[0]!.id]);

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

// Корректный ответ модели для портрета: фраза и пять блоков по темам, у каждого своя мысль
export function samplePortrait() {
  const texts = [
    "Ты быстро загораешься новой идеей, а довести её до результата помогают понятные шаги. Поэтому полезно сразу записать первый маленький шаг и срок: так интерес не растворяется в планах, а превращается в действие.",
    "В разговоре тебе важны и контакт, и спокойный темп. Ты слышишь собеседника, но иногда соглашаешься быстрее, чем успеваешь понять, чего хочется самому. Короткая пауза перед ответом возвращает голос и никого не обижает.",
    "Под нагрузкой тебе нужно сначала снизить шум вокруг, а уже потом принимать решения. Помогает список из трёх дел на сегодня и одно окно без уведомлений. Когда сигналов становится меньше, возвращаются ясность и ровное настроение.",
    "Силы к тебе возвращаются там, где есть и свобода пробовать новое, и живые люди рядом. Тихий вечер без планов полезен, но если он затягивается, тянет к разговору. Договорись с собой о паре встреч в неделю и одном дне для себя.",
    "Тебе легко доверяют: ты замечаешь, что нужно другим, и помнишь про договорённости. Чтобы надёжность не превращалась в перегруз, заранее называй, сколько времени и сил можно дать, и оставляй запас на собственные дела.",
  ];
  return {
    headline: "Ты соединяешь интерес к новому с заботой о людях и порядком, и тебе важно беречь на это силы",
    blocks: portraitSeeds().map((seed, index) => ({ seed: seed.id, text: texts[index]! })),
  };
}

// Заглушка модели для портрета: по умолчанию отвечает корректно, script задаёт цепочку ответов
export function portraitStubWriter(script: readonly Step[] = []): ReportWriter & { calls: Prompt[] } {
  const calls: Prompt[] = [];
  const queue = [...script];
  return {
    name: "stub",
    calls,
    async complete(prompt) {
      calls.push(prompt);
      const step = queue.shift();
      if (step === "hang") return new Promise<string>(() => {});
      if (step instanceof Error) throw step;
      return typeof step === "string" ? step : JSON.stringify(samplePortrait());
    },
  };
}
