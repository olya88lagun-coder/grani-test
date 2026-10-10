import { traitLevel, type Trait, type TraitLevel, type TraitScores } from "@grani/core";

export type AtlasInsight = {
  id: string; group: string; title: string; explanation: string; application: string;
  risk: string; practice: string; limit: string; basis: string[]; ruleIds: string[]; weight: number;
};
type Copy = Pick<AtlasInsight,"title"|"explanation"|"application"|"risk"|"practice">;
type BaseRule = Copy & { id: string; trait: Trait; level: TraitLevel; group: string };
type PairRule = Copy & { id: string; signals: readonly [readonly [Trait,"high"|"low"],readonly [Trait,"high"|"low"]]; group: string };
const LIMIT = "Это гипотеза для самонаблюдения. Баллы не предсказывают поведение: учитывай задачу, опыт, условия и обратную связь.";
export const ATLAS_TRAITS = [
  {key:"openness",code:"O",name:"Открытость опыту",poles:["Привычное","Новое"]},
  {key:"conscientiousness",code:"C",name:"Добросовестность",poles:["Спонтанность","Порядок"]},
  {key:"extraversion",code:"E",name:"Экстраверсия",poles:["Тихий фокус","Внешний контакт"]},
  {key:"agreeableness",code:"A",name:"Доброжелательность",poles:["Независимая оценка","Согласие"]},
  {key:"stability",code:"S",name:"Эмоциональная устойчивость",poles:["Чувствительность","Устойчивость"]},
] as const;

const base = (trait:Trait,level:TraitLevel,title:string,explanation:string,risk:string,practice:string):BaseRule => ({id:`${trait}-${level}`,trait,level,group:`base-${trait}`,title,explanation,risk,practice,application:"Повседневные задачи и наблюдения за собственным способом действовать."});
export const ATLAS_BASE_RULES: readonly BaseRule[] = [
  base("openness","high","Исследовать новое","Интерес к новым решениям может расширять набор вариантов.","Продолжать поиск, когда пора проверить вариант.","Выбери одну идею и проверь её в малом масштабе."),
  base("openness","borderline","Сравнивать новое и знакомое","Можно проверить, когда удобнее опереться на опыт, а когда попробовать другое.","Оставаться между вариантами без критерия выбора.","Заранее определи, что полезного даст изменение."),
  base("openness","low","Опираться на проверенное","Знакомые методы могут помогать действовать с понятными ожиданиями.","Не заметить полезную альтернативу.","Проверь одно небольшое изменение привычного способа."),
  base("conscientiousness","high","Действовать последовательно","План и критерии готовности могут поддерживать выполнение задачи.","Усложнять подготовку и требования к результату.","Определи минимально готовый результат до начала работы."),
  base("conscientiousness","borderline","Подбирать нужную структуру","Полезно сравнить подробный план с несколькими опорными шагами.","Менять способ организации без проверки его пользы.","Попробуй один список из трёх шагов и оцени, помог ли он."),
  base("conscientiousness","low","Оставлять место спонтанности","Свободный способ действий может помогать пробовать варианты по ходу работы.","Потерять выбранный приоритет среди новых задач.","Выбери один следующий шаг и запиши, когда к нему вернёшься."),
  base("extraversion","high","Думать в диалоге","Обсуждение может помогать уточнять идеи и следующий шаг.","Не оставлять времени на собственное обдумывание.","После разговора запиши своё решение самостоятельно."),
  base("extraversion","borderline","Выбирать формат общения","Можно сравнить индивидуальную подготовку и совместное обсуждение.","Выбирать формат по привычке, не учитывая задачу.","Сравни два режима на похожих задачах."),
  base("extraversion","low","Находить тихий фокус","Полезно проверить самостоятельную подготовку перед обсуждением.","Поздно получать другое мнение.","Запланируй короткую промежуточную обратную связь."),
  base("agreeableness","high","Учитывать другие позиции","Внимание к чужой позиции может помогать находить общую цель.","Отодвигать собственные приоритеты ради согласия.","До обсуждения запиши, что важно лично тебе."),
  base("agreeableness","borderline","Согласовывать критерии","Можно проверить баланс сотрудничества и независимой оценки.","Не обозначить свою позицию достаточно ясно.","Назови общий критерий и свою точку зрения отдельно."),
  base("agreeableness","low","Сохранять независимую оценку","Можно проверить пользу прямого обсуждения идей и критериев.","Сосредоточиться на недостатках и потерять общий контекст.","Отделяй оценку решения от оценки человека."),
  base("stability","high","Сверяться с фактами","Можно проверить, помогает ли опора на наблюдения при изменении условий.","Не заметить значимость ситуации для другого человека.","Уточни, что изменилось и что важно участникам."),
  base("stability","borderline","Замечать условия реакции","Полезно наблюдать, какие условия делают неопределённую задачу понятнее.","Приписывать всё одному баллу вместо контекста.","Запиши ситуацию, свою реакцию и то, что помогло."),
  base("stability","low","Готовить опоры заранее","Можно проверить пользу ясных шагов в ситуациях неопределённости.","Задерживать действие, пытаясь предусмотреть всё.","Отдели известные факты от предположений и выбери малый обратимый шаг."),
];

const pair=(id:string,a:readonly [Trait,"high"|"low"],b:readonly [Trait,"high"|"low"],group:string,title:string,explanation:string,application:string,risk:string,practice:string):PairRule => ({id,signals:[a,b],group,title,explanation,application,risk,practice});
export const ATLAS_PAIR_RULES: readonly PairRule[] = [
  pair("R01",["openness","high"],["conscientiousness","high"],"implementation","От идеи к системе","Соединять исследование новых вариантов с организацией действий.","Запуск проекта, изучение сложной темы.","Слишком долгая подготовка.","Определить минимально готовый результат."),
  pair("R02",["openness","high"],["conscientiousness","low"],"implementation","Выбирать идею для завершения","Исследование вариантов можно поддержать небольшим обязательством по выбранному.","Новые проекты и рабочие эксперименты.","Переключаться между идеями, не проверяя ни одну.","Выбери один вариант и один шаг для его завершения."),
  pair("R03",["openness","low"],["conscientiousness","high"],"implementation","Менять с опорой на опыт","Проверенные методы можно сочетать с управляемыми небольшими изменениями.","Задачи с понятными требованиями.","Слишком долго сохранять способ, который уже не подходит.","Оставь основную структуру и проверь одно изменение."),
  pair("R04",["conscientiousness","high"],["extraversion","low"],"focus","Самостоятельное погружение","Проверить, насколько эффективна индивидуальная подготовка перед совместным обсуждением.","Аналитические задачи.","Позднее получение другого мнения.","Запланировать промежуточное обсуждение."),
  pair("R05",["extraversion","high"],["agreeableness","high"],"collaboration","Общая работа, свои приоритеты","Совместное обсуждение можно сочетать с ясным обозначением собственных задач.","Командные задачи.","Согласиться на слишком много чужих запросов.","До разговора определи свой приоритет и доступное время."),
  pair("R06",["conscientiousness","high"],["agreeableness","low"],"quality","Ясные критерии","Использовать заранее согласованные стандарты качества при оценке решений.","Согласование задач и обратная связь.","Чрезмерная сосредоточенность на недостатках.","Отделять оценку идеи от оценки человека."),
  pair("R07",["conscientiousness","high"],["stability","low"],"uncertainty","Достаточно ясный следующий шаг","Личные требования можно проверять на соответствие реальным условиям задачи.","Задачи с неполной информацией.","Повышать требования, когда данных ещё недостаточно.","Раздели необходимые условия и желательные улучшения."),
  pair("R08",["openness","high"],["extraversion","low"],"focus","Самостоятельное погружение","Проверить пользу самостоятельного исследования новых идей перед обсуждением.","Аналитические задачи.","Продолжать исследование без промежуточной проверки.","Сформулируй одну гипотезу и покажи промежуточный результат."),
  pair("R09",["extraversion","high"],["agreeableness","low"],"discussion","Прямота с общей целью","Прямое обсуждение разногласий можно опереть на общие критерии.","Рабочее согласование решений.","Быстро перейти к аргументам, не услышав другую позицию.","Назови общую цель и запроси конкретный пример другой позиции."),
  pair("R10",["agreeableness","high"],["conscientiousness","low"],"priorities","Помогать в пределах своего плана","Запросы других можно учитывать вместе с собственными задачами.","Совместная работа и договорённости.","Сместить свои задачи из-за новых просьб.","Перед согласием выбери место для просьбы в своём списке."),
  pair("R11",["extraversion","low"],["stability","low"],"preparation","Готовить разговор постепенно","Можно проверить пользу подготовки перед интенсивным общением.","Обсуждение сложной рабочей задачи.","Откладывать разговор ради полной готовности.","Запиши цель разговора и один вопрос, который хочешь прояснить."),
  pair("R12",["openness","low"],["agreeableness","high"],"collaboration","Сотрудничать с понятными опорами","Сотрудничество можно поддержать знакомыми способами и общей целью.","Командные задачи с известными требованиями.","Согласиться на привычный способ без проверки условий.","Уточни, подходит ли проверенный метод текущей задаче."),
];

export function editorialWeight(level:TraitLevel,score:number):number {
  const clamp=(n:number)=>Math.max(0,Math.min(1,n));
  return level==="high"?clamp((score-55)/20):level==="low"?clamp((45-score)/20):clamp(1-Math.abs(score-50)/15);
}
export type PersonalityAtlas = {
  scores:TraitScores; traits:{key:Trait;code:string;name:string;poles:readonly string[];value:number;level:TraitLevel;description:string}[];
  strengths:AtlasInsight[]; theme:string; formulaTitle:string; formulaText:string; interaction:string[];
  memo:{quote:string;items:{label:string;text:string}[]};
};

export function buildPersonalityAtlas(scores:TraitScores):PersonalityAtlas {
  for(const trait of ATLAS_TRAITS)if(!Number.isFinite(scores[trait.key])||scores[trait.key]<0||scores[trait.key]>100)throw new Error("Invalid Big Five score");
  const basis=(keys:readonly Trait[])=>keys.map(key=>`${ATLAS_TRAITS.find(t=>t.key===key)!.code} ${scores[key]}`);
  const matched=ATLAS_PAIR_RULES.map(rule=>({...rule,weight:Math.min(...rule.signals.map(([trait,level])=>editorialWeight(level,scores[trait])))})).filter(r=>r.weight>0);
  const grouped=new Map<string,AtlasInsight>();
  for(const rule of matched){
    const existing=grouped.get(rule.group);
    if(existing){existing.ruleIds.push(rule.id);existing.basis=[...new Set([...existing.basis,...basis(rule.signals.map(s=>s[0]))])];existing.weight=Math.max(existing.weight,rule.weight);}
    else grouped.set(rule.group,{...rule,ruleIds:[rule.id],basis:basis(rule.signals.map(s=>s[0])),limit:LIMIT});
  }
  const strengths=[...grouped.values()].sort((a,b)=>b.weight-a.weight).slice(0,3);
  const baseMatches=ATLAS_BASE_RULES.filter(r=>r.level===traitLevel(scores[r.trait])).map(r=>({...r,weight:editorialWeight(r.level,scores[r.trait]),basis:basis([r.trait]),ruleIds:[r.id],limit:LIMIT})).sort((a,b)=>b.weight-a.weight);
  for(const r of baseMatches){if(strengths.length===3)break;strengths.push(r);}
  const first=strengths[0]!; const isSofiaTheme=first.ruleIds.includes("R01");
  const theme=isSofiaTheme?"Идеи, которым ты умеешь придавать форму":first.title;
  const interaction=isSofiaTheme?[
    "Мне удобно, когда у разговора есть понятная цель, а новые предложения можно спокойно обдумать.",
    "Мне помогает конкретная обратная связь: что получилось, что стоит изменить и почему.",
    "Если наши мнения расходятся, давай обсуждать идеи и критерии, а не личные качества друг друга.",
  ]:[
    `Мне помогает такой подход: ${first.practice.charAt(0).toLowerCase()+first.practice.slice(1)}`,
    "Мне удобно, когда понятна цель обсуждения и остаётся место для моей позиции.",
    "Мне помогает конкретная обратная связь: что получилось, что стоит изменить и почему.",
  ];
  return {
    scores:{...scores},strengths,theme,
    formulaTitle:isSofiaTheme?"Структура, которая оставляет место новому":first.title,
    formulaText:isSofiaTheme?"Открытость позволяет рассматривать новые решения, добросовестность поддерживает последовательное выполнение задач. Возможное противоречие — продолжать исследовать варианты и одновременно стремиться зафиксировать план.":`${first.explanation} Возможный перегиб: ${first.risk.charAt(0).toLowerCase()+first.risk.slice(1)}`,
    traits:ATLAS_TRAITS.map(t=>({...t,value:scores[t.key],level:traitLevel(scores[t.key]),description:baseMatches.find(r=>r.trait===t.key)!.explanation})),
    interaction,
    memo:{quote:isSofiaTheme?"Хорошая система помогает двигаться вперёд, а не только готовиться к движению.":"Полезный подход — тот, который помогает в моей конкретной ситуации.",items:[
      {label:"Моя возможная сила",text:isSofiaTheme?"Превращать идеи в последовательные действия.":first.explanation},
      {label:"Мой возможный перегиб",text:isSofiaTheme?"Слишком долго готовиться к практической проверке.":first.risk},
      {label:"Как мне выбирать",text:"Сравнивать варианты по критериям и назначать момент решения."},
      {label:"Что важно в общении",text:"Конкретная обратная связь и понятная цель обсуждения."},
      {label:"Что хочу попробовать",text:isSofiaTheme?"Раньше показывать промежуточные результаты.":first.practice},
    ]},
  };
}
