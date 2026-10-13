import type { Trait } from "@grani/core";
import type { TraitSection } from "./keys";

export type PortraitSeed = { readonly id: string; readonly title: string; readonly focus: string; readonly traits: readonly Trait[]; readonly sections: readonly TraitSection[] };

// Разделы библиотеки, из которых берутся блоки входа по каждой черте. «strengths» и «blind_spots» не берём:
// первый человек уже видел бесплатно, второй показан на вкладке отдельным блоком
export const PORTRAIT_SECTIONS: readonly TraitSection[] = ["work", "relationships", "stress"];

// Заголовки и порядок блоков задаёт редакция: структура одинакова у всех покупателей, ИИ пишет только текст под баллы человека
const PORTRAIT_SEEDS: readonly PortraitSeed[] = [
  { id: "start", title: "Как ты берёшься за дело", focus: "Как человек берётся за новое дело: с чего начинает, что помогает дойти до результата и где теряет интерес.", traits: ["openness", "conscientiousness"], sections: ["work"] },
  { id: "talk", title: "Как ты общаешься", focus: "Как человек ведёт себя в разговоре: что для него важнее, контакт или темп, как он слышит собеседника и говорит о своём.", traits: ["extraversion", "agreeableness"], sections: ["relationships"] },
  { id: "load", title: "Что происходит под нагрузкой", focus: "Что происходит с настроением и решениями, когда нагрузки становится много, и что помогает вернуть ясность.", traits: ["stability"], sections: ["stress"] },
  { id: "energy", title: "Что даёт тебе энергию", focus: "Где человек берёт силы: в новизне, в людях или в тишине, и как это сочетание влияет на его неделю.", traits: ["extraversion", "openness"], sections: ["work", "relationships"] },
  { id: "support", title: "На что в тебе можно опереться", focus: "В чём на человека могут положиться другие и как ему не перегрузить себя, оставаясь надёжным.", traits: ["agreeableness", "conscientiousness"], sections: ["relationships", "work"] },
];

export const portraitSeeds = (): readonly PortraitSeed[] => PORTRAIT_SEEDS;
