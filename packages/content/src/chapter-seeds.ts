import type { ChapterKind, Trait } from "@grani/core";

export type ChapterSeed = { readonly id: string; readonly title: string; readonly focus: string; readonly traits: readonly Trait[] };

// Темы задаёт редакция: так карточки не повторяются и структура одинакова у всех покупателей.
// У каждой главы шесть тем: три первые идут в один запрос к модели, три последние — в другой
const SEEDS: Readonly<Partial<Record<ChapterKind, readonly ChapterSeed[]>>> = {
  chapter_money: [
    { id: "help", title: "Помощь другим и отказ", focus: "Как человек решает, давать ли деньги в долг, дарить и скидываться, и как ему даётся отказ.", traits: ["agreeableness", "stability"] },
    { id: "surprise", title: "Неожиданные траты", focus: "Что происходит с настроением и решениями, когда появляется непредвиденный расход.", traits: ["stability", "conscientiousness"] },
    { id: "mood", title: "Покупки для настроения", focus: "Покупка как способ сменить состояние: когда это помогает, а когда остаётся только сумма в чеке.", traits: ["stability", "extraversion"] },
    { id: "new", title: "Новые возможности и предложения", focus: "Отношение к незнакомым способам заработать, вложить, попробовать: где осторожность защищает, а где мешает.", traits: ["openness", "conscientiousness"] },
    { id: "periods", title: "Учёт и спонтанные периоды", focus: "Как чередуются аккуратный учёт и спонтанные траты и какая простая система выдержит оба периода.", traits: ["conscientiousness", "extraversion"] },
    { id: "shared", title: "Общие деньги и разговор о них", focus: "Как говорить о деньгах с близкими: договорённости, общие траты, неудобные темы.", traits: ["agreeableness", "extraversion"] },
  ],
  chapter_conflict: [
    { id: "notice", title: "Как замечаю разногласие", focus: "Как человек замечает, что с кем-то расходится во мнениях, и говорит об этом сразу или копит недовольство.", traits: ["agreeableness", "extraversion"] },
    { id: "voice", title: "Когда повышают голос", focus: "Что происходит внутри и в словах человека, когда собеседник говорит резко или повышает тон.", traits: ["stability", "agreeableness"] },
    { id: "position", title: "Отстаивать свою позицию", focus: "Как человек говорит о своём мнении и желаниях без обвинений и в какой момент он уступает.", traits: ["agreeableness", "conscientiousness"] },
    { id: "critique", title: "Критика в мой адрес", focus: "Как человек слышит замечания о своей работе или поведении и что помогает отделить дельное от обидного.", traits: ["stability", "openness"] },
    { id: "pause", title: "Пауза после ссоры", focus: "Сколько времени нужно человеку, чтобы остыть, как это видят другие и как не превратить паузу в молчание.", traits: ["stability", "extraversion"] },
    { id: "deal", title: "Договорённость после спора", focus: "Как человек закрепляет итог разговора, возвращается к теме и проверяет, что все поняли договорённость одинаково.", traits: ["conscientiousness", "agreeableness"] },
  ],
  chapter_stress: [
    { id: "signals", title: "Первые сигналы напряжения", focus: "По каким телесным и поведенческим признакам человек замечает, что нагрузка растёт, и что делает сразу.", traits: ["stability", "conscientiousness"] },
    { id: "overload", title: "Перегруз на работе или учёбе", focus: "Как человек действует, когда задач становится слишком много: берётся за всё, откладывает или сужает список.", traits: ["conscientiousness", "stability"] },
    { id: "uncertainty", title: "Неопределённость и ожидание", focus: "Как человек переносит ситуации с неизвестным исходом: ожидание ответа, перемены, незнакомые условия.", traits: ["stability", "openness"] },
    { id: "recovery", title: "Как я восстанавливаюсь", focus: "Что возвращает силы: тишина, движение, общение или смена обстановки, и почему один способ подходит не всем.", traits: ["extraversion", "openness"] },
    { id: "ask", title: "Просьба о помощи", focus: "Как человеку даётся просить о поддержке в тяжёлый период и какие слова для этого подойдут.", traits: ["extraversion", "agreeableness"] },
    { id: "routine", title: "Режим, сон и мелочи", focus: "Как нагрузка влияет на сон, еду и бытовые дела и какие простые опоры помогают не терять режим.", traits: ["conscientiousness", "stability"] },
  ],
  chapter_relationships: [
    { id: "start", title: "Сближение и первые шаги", focus: "Как человек сближается с новым человеком: торопится, присматривается или ждёт инициативы, и что помогает сделать шаг.", traits: ["extraversion", "openness"] },
    { id: "space", title: "Близость и личное пространство", focus: "Сколько времени вместе и сколько отдельно нужно человеку и как сказать об этом, не обижая близкого.", traits: ["extraversion", "agreeableness"] },
    { id: "feelings", title: "Говорить о чувствах", focus: "Как человек делится радостью, обидой и усталостью и что мешает сказать об этом прямо.", traits: ["stability", "agreeableness"] },
    { id: "support", title: "Поддержка близкого", focus: "Как человек поддерживает того, кому плохо: советом, делом или присутствием, и как спросить, что нужно.", traits: ["agreeableness", "stability"] },
    { id: "home", title: "Быт и договорённости", focus: "Как распределяются дела, планы и обещания в паре или семье и что помогает не копить обиды из-за мелочей.", traits: ["conscientiousness", "agreeableness"] },
    { id: "limits", title: "Границы в близости", focus: "Как человек говорит «нет» близким, не разрушая отношений, и в чём для него проходит граница личного.", traits: ["agreeableness", "stability"] },
  ],
};

export function chapterSeeds(kind: ChapterKind): readonly ChapterSeed[] {
  return SEEDS[kind] ?? [];
}

export function hasCardsFormat(kind: ChapterKind): boolean {
  return chapterSeeds(kind).length > 0;
}
