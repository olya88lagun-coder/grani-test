import { z } from "zod";
import { ARTICLE_SOURCES } from "./sources";

export const CONTENT_STATUSES = ["draft", "ready_for_review", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const QUALITY_RULES = [
  "Публикация автоматическая (решение владелицы, 28.09.2026): статью выпускает конвейер, reviewed: true ставится только после самопроверки по этим правилам и зелёных тестов.",
  "Не выдумывать исследования, авторов, DOI и статистику.",
  "Научные утверждения привязывать к ARTICLE_SOURCES или помечать needs-research до редакторской проверки.",
  "Не выпускать массовые шаблонные страницы: каждая тема должна иметь отдельный интент и план пользы.",
  "Не приравнивать типы Граней к MBTI, соционике или медицинским диагнозам.",
  "Внутренние ссылки должны быть естественными и вести только на существующие публичные страницы.",
] as const;

type TopicInput = {
  readonly slug: string;
  readonly primaryQuery: string;
  readonly title: string;
  readonly cluster: string;
  readonly intent?: string;
  readonly secondaryQueries?: readonly string[];
  readonly links?: readonly string[];
  readonly sourceKeys?: readonly string[];
  readonly status?: ContentStatus;
};

export type PlannedFaq = { readonly question: string; readonly answer: string };
export type ContentTopic = {
  readonly slug: string;
  readonly path: string;
  readonly status: ContentStatus;
  readonly kind: "article";
  readonly cluster: string;
  readonly primaryQuery: string;
  readonly secondaryQueries: readonly string[];
  readonly intent: string;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly canonical: string;
  readonly faq: readonly PlannedFaq[];
  readonly internalLinks: readonly string[];
  readonly sourceKeys: readonly string[];
};

const TopicSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  path: z.string().regex(/^\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: z.enum(CONTENT_STATUSES),
  kind: z.literal("article"),
  cluster: z.string().min(2).max(40),
  primaryQuery: z.string().min(4).max(90),
  secondaryQueries: z.array(z.string().min(4).max(90)).max(8),
  intent: z.string().min(4).max(120),
  title: z.string().min(10).max(70),
  h1: z.string().min(10).max(80),
  description: z.string().min(70).max(200),
  canonical: z.string().regex(/^\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
  faq: z.array(z.strictObject({ question: z.string().min(8).max(120), answer: z.string().min(40).max(260) })).min(2).max(5),
  internalLinks: z.array(z.string().regex(/^\/[a-z0-9/-]+$/)).min(3).max(8),
  sourceKeys: z.array(z.string()).min(1).max(4),
});

const SAFE_SOURCE_KEYS = new Set([...Object.keys(ARTICLE_SOURCES), "needs-research"]);

function description(primaryQuery: string, cluster: string): string {
  return `Разбор темы «${primaryQuery}» в контексте ${cluster}: что это значит, как проявляется в жизни и как связать результат с тестом Big Five в «Гранях».`;
}

function faq(primaryQuery: string): readonly PlannedFaq[] {
  return [
    {
      question: `Что значит «${primaryQuery}»?`,
      answer: "Статья должна дать простое определение, показать бытовые проявления и отделить личностные черты от диагнозов или ярлыков.",
    },
    {
      question: "Как понять это про себя?",
      answer: "Материал связывает тему с результатами Big Five и ведет к тесту, но не обещает точных выводов без контекста и самонаблюдения.",
    },
  ];
}

function topic(input: TopicInput): ContentTopic {
  const path = `/articles/${input.slug}`;
  const sourceKeys = input.sourceKeys ?? ["needs-research"];
  return {
    slug: input.slug,
    path,
    status: input.status ?? "draft",
    kind: "article",
    cluster: input.cluster,
    primaryQuery: input.primaryQuery,
    secondaryQueries: input.secondaryQueries ?? [],
    intent: input.intent ?? "Пользователь хочет понять термин и применить его к себе без клинических выводов.",
    title: input.title,
    h1: input.title,
    description: description(input.primaryQuery, input.cluster),
    canonical: path,
    faq: faq(input.primaryQuery),
    internalLinks: [...new Set(["/big-five-test", "/test", "/articles/big-five", ...(input.links ?? [])])],
    sourceKeys,
  };
}

// Темы, которые повторяли уже опубликованные статьи (ambivert, big-five, mbti-i-socionika, temperament), убраны:
// две страницы под один запрос отбирают друг у друга позиции. Новую тему сверять с опубликованными перед записью в план.
export const CONTENT_PLAN: readonly ContentTopic[] = [
  // test-big-five-na-russkom убрана: интент совпадает с уже существующей публичной страницей /big-five-test (тот же запрос — прохождение теста на русском, тот же FAQ).
  topic({ slug: "ipip-50", primaryQuery: "IPIP-50", title: "IPIP-50: что это за опросник", cluster: "big-five", status: "published", links: ["/about", "/articles/test-lichnosti"], sourceKeys: ["ipip-50"] }),
  // ocean-test убрана: тот же интент, что у /big-five-test (там тест уже назван и как Big Five, и как OCEAN) — две страницы под один запрос отбирают друг у друга позиции.
  topic({ slug: "rezultaty-big-five", primaryQuery: "результаты Big Five", title: "Как читать результаты Big Five", cluster: "big-five", status: "published", links: ["/traits", "/types"], sourceKeys: ["rezultaty-big-five"] }),
  // shkaly-big-five убрана: тот же интент, что у /articles/rezultaty-big-five (там уже разобрано, что означают баллы по шкалам).
  topic({ slug: "naskolko-tochen-big-five", primaryQuery: "насколько точен Big Five", title: "Насколько точен тест Big Five", cluster: "big-five", status: "published", links: ["/about", "/articles/test-lichnosti"], sourceKeys: ["big-five", "test-lichnosti"] }),
  // big-five-ili-mbti убрана: тот же интент, что у /articles/mbti-i-socionika (там уже есть раздел «Что выбрать» с тем же выводом).
  topic({ slug: "ekstraversiya", primaryQuery: "экстраверсия", title: "Экстраверсия: как она проявляется", cluster: "traits", status: "published", links: ["/traits/extraversion-high", "/traits/extraversion-low"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "introversiya", primaryQuery: "интроверсия", title: "Интроверсия: сила спокойного темпа", cluster: "traits", status: "published", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "otkrytost-opytu", primaryQuery: "открытость опыту", title: "Открытость опыту: любопытство и идеи", cluster: "traits", status: "published", links: ["/traits/openness-high", "/traits/openness-low"], sourceKeys: ["otkrytost-opytu"] }),
  topic({ slug: "nizkaya-otkrytost", primaryQuery: "низкая открытость", title: "Низкая открытость: практичность без стыда", cluster: "traits", status: "published", links: ["/traits/openness-low", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "dobrosovestnost", primaryQuery: "добросовестность", title: "Добросовестность: порядок и доведение дел", cluster: "traits", status: "published", links: ["/traits/conscientiousness-high", "/traits/conscientiousness-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "nizkaya-dobrosovestnost", primaryQuery: "низкая добросовестность", title: "Низкая добросовестность: гибкость и риски", cluster: "traits", status: "published", links: ["/traits/conscientiousness-low", "/types", "/articles/sovmestimost-par"], sourceKeys: ["dobrosovestnost"] }),
  topic({ slug: "dobrozhelatelnost", primaryQuery: "доброжелательность", title: "Доброжелательность: доверие и мягкость", cluster: "traits", status: "published", links: ["/traits/agreeableness-high", "/traits/agreeableness-low", "/articles/sovmestimost-par"], sourceKeys: ["dobrozhelatelnost"] }),
  topic({ slug: "nizkaya-dobrozhelatelnost", primaryQuery: "низкая доброжелательность", title: "Низкая доброжелательность: прямота и границы", cluster: "traits", status: "published", links: ["/traits/agreeableness-low", "/types"], sourceKeys: ["nizkaya-dobrozhelatelnost"] }),
  topic({ slug: "emotsionalnaya-ustoychivost", primaryQuery: "эмоциональная устойчивость", title: "Эмоциональная устойчивость: спокойствие под давлением", cluster: "traits", status: "published", links: ["/traits/stability-high", "/traits/stability-low"], sourceKeys: ["emotsionalnaya-ustoychivost"] }),
  topic({ slug: "neyrotizm-big-five", primaryQuery: "нейротизм Big Five", title: "Нейротизм в Big Five и чувствительность", cluster: "traits", status: "published", links: ["/traits/stability-low", "/articles/big-five"], sourceKeys: ["neyrotizm-big-five"] }),
  topic({ slug: "sovmestimost-tipov", primaryQuery: "совместимость типов личности", title: "Совместимость типов личности: что важно", cluster: "relationships", status: "published", intent: "Понять сочетание двух типов «Граней»: процент совместимости не приговор", secondaryQueries: ["совместимость по большой пятёрке","совместимость характеров в паре"], links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["sovmestimost-tipov"] }),
  topic({ slug: "big-five-v-otnosheniyah", primaryQuery: "Big Five в отношениях", title: "Big Five в отношениях: где вы похожи", cluster: "relationships", status: "published", intent: "Увидеть, какие из пяти черт влияют на отношения и о чём договориться", secondaryQueries: ["большая пятёрка в отношениях","черты характера и отношения"], links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["big-five-v-otnosheniyah"] }),
  topic({ slug: "kak-ponyat-partnera", primaryQuery: "как понять партнера", title: "Как понять партнера через пять черт", cluster: "relationships", status: "published", intent: "Научиться читать поведение партнёра через пять черт, не навешивая ярлыков", secondaryQueries: ["как лучше понять партнёра","почему мы с партнёром по-разному реагируем"], links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["kak-ponyat-partnera"] }),
  topic({ slug: "raznye-tempy-v-pare", primaryQuery: "разный темп в паре", title: "Разный темп в паре: как договориться", cluster: "relationships", status: "published", intent: "Договориться о разном ритме: экстраверт и интроверт, планирующий и спонтанный", secondaryQueries: ["экстраверт и интроверт в паре","разные темпы жизни в отношениях"], links: ["/traits/extraversion-high", "/traits/extraversion-low", "/compatibility"], sourceKeys: ["raznye-tempy-v-pare"] }),
  topic({ slug: "konflikty-i-big-five", primaryQuery: "конфликты и Big Five", title: "Конфликты через призму Big Five", cluster: "relationships", status: "published", intent: "Понять, почему ссоры повторяются у разных характеров, и что обсудить спокойно", secondaryQueries: ["почему мы ссоримся с партнёром","конфликты в паре характер"], links: ["/compatibility", "/traits/agreeableness-low", "/articles/sovmestimost-par"], sourceKeys: ["konflikty-i-big-five"] }),
  // chuvstvitelnost убрана: дублирует neyrotizm-big-five.md и emotsionalnaya-ustoychivost.md — та же шкала с двух полюсов уже разобрана.
  // silnye-storony-introverta убрана: раздел «Интроверсия — это не минус экстраверсии» в introversiya.md и «Сильные стороны каждого полюса» в ekstravert-introvert.md уже закрывают тему.
  // silnye-storony-ekstraverta убрана: тот же раздел «Сильные стороны каждого полюса» в ekstravert-introvert.md уже закрывает тему для экстравертов.
  // tipy-lichnosti-grani убрана: тот же интент, что в хедере страницы /types («тип складывается из четырёх черт... отсюда 16 сочетаний») и в big-five.md.
  // 16-tipov-lichnosti убрана: тот же интент, что у mbti-i-socionika.md (16 типов, мифы о коробках, соответствие кодам MBTI).
  // tip-iskra, tip-arkhitektor, tip-mechtatel, tip-opora, tip-komandir, tip-nablyudatel убраны: каждая страница /types/[slug] уже SEO-титулована как «<Имя> — тип личности по Big Five» — тот же primaryQuery, прямая каннибализация.
  // druzya-otsenivayut-menya, samootsenka-i-vzglyad-drugih, anketa-dlya-druzey убраны: тот же интент, что у kak-menya-vidyat.md (расхождение самооценки и взгляда друзей, как спросить, сама анкета).
  topic({ slug: "lichnost-i-rabota", primaryQuery: "личность и работа", title: "Личность и работа: какие черты помогают", cluster: "work", status: "published", links: ["/traits/conscientiousness-high", "/traits/extraversion-high"], sourceKeys: ["big-five"] }),
  topic({ slug: "dobrosovestnost-v-rabote", primaryQuery: "добросовестность в работе", title: "Добросовестность в работе: сила системы", cluster: "work", status: "published", links: ["/traits/conscientiousness-high", "/traits/conscientiousness-low", "/articles/lichnost-i-rabota"], sourceKeys: ["dobrosovestnost"] }),
  topic({ slug: "ekstraversiya-v-rabote", primaryQuery: "экстраверсия в работе", title: "Экстраверсия в работе: энергия команды", cluster: "work", links: ["/traits/extraversion-high", "/articles/ambivert"], sourceKeys: ["ambivert"] }),
  topic({ slug: "introvert-na-rabote", primaryQuery: "интроверт на работе", title: "Интроверт на работе: фокус и восстановление", cluster: "work", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "otkrytost-i-karera", primaryQuery: "открытость и карьера", title: "Открытость и карьера: идеи против рутины", cluster: "work", links: ["/traits/openness-high", "/traits/openness-low"], sourceKeys: ["needs-research"] }),
  topic({ slug: "lichnost-i-stress", primaryQuery: "личность и стресс", title: "Личность и стресс: почему реакции разные", cluster: "wellbeing", links: ["/traits/stability-high", "/traits/stability-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "kak-vosstanavlivatsya-introvertu", primaryQuery: "как восстанавливаться интроверту", title: "Как восстанавливаться интроверту", cluster: "wellbeing", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "emotsii-i-lichnost", primaryQuery: "эмоции и личность", title: "Эмоции и личность: роль устойчивости", cluster: "wellbeing", links: ["/traits/stability-high", "/traits/stability-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "privychki-i-harakter", primaryQuery: "привычки и характер", title: "Привычки и характер: что легче менять", cluster: "wellbeing", links: ["/traits/conscientiousness-high", "/traits/conscientiousness-low"], sourceKeys: ["needs-research"] }),
  topic({ slug: "lichnost-menyaetsya-li", primaryQuery: "меняется ли личность", title: "Меняется ли личность со временем", cluster: "science", links: ["/articles/big-five", "/about"], sourceKeys: ["big-five"] }),
  topic({ slug: "cherty-ili-tipy", primaryQuery: "черты или типы личности", title: "Черты или типы личности: что точнее", cluster: "science", links: ["/articles/mbti-i-socionika", "/types"], sourceKeys: ["mbti-i-socionika"] }),
  topic({ slug: "test-lichnosti-besplatno", primaryQuery: "тест личности бесплатно", title: "Бесплатный тест личности: на что смотреть", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "test-haraktera", primaryQuery: "тест характера", title: "Тест характера: чем он отличается от Big Five", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "test-na-introverta", primaryQuery: "тест на интроверта", title: "Тест на интроверта: что он показывает", cluster: "test", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "test-na-ekstraverta", primaryQuery: "тест на экстраверта", title: "Тест на экстраверта: как читать результат", cluster: "test", links: ["/traits/extraversion-high", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "kak-proyti-test-chestno", primaryQuery: "как пройти тест личности честно", title: "Как проходить тест личности честно", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "povtorno-proyti-test", primaryQuery: "можно ли пройти тест повторно", title: "Можно ли проходить тест личности повторно", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "lichnost-i-samoznanie", primaryQuery: "личность и самопознание", title: "Личность и самопознание без ярлыков", cluster: "self-knowledge", links: ["/articles/big-five", "/traits"], sourceKeys: ["big-five"] }),
  topic({ slug: "kak-opisat-sebya", primaryQuery: "как описать себя", title: "Как описать себя через пять черт", cluster: "self-knowledge", links: ["/traits", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "sily-i-zony-rosta", primaryQuery: "сильные стороны и зоны роста", title: "Сильные стороны и зоны роста по Big Five", cluster: "self-knowledge", links: ["/traits", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "lichnost-bez-yarlykov", primaryQuery: "личность без ярлыков", title: "Личность без ярлыков: как читать типы бережно", cluster: "self-knowledge", links: ["/types", "/articles/mbti-i-socionika"], sourceKeys: ["mbti-i-socionika", "big-five"] }),
  // Пополнение 23.10.2026. Спрос в Вордстате не замерен; каждая тема сверена с опубликованными статьями и очередью выше (интент в поле intent).
  // Источники в sourceKeys: needs-research — перед публикацией добавить в ARTICLE_SOURCES[slug] не меньше двух работ, сверенных по DOI через Crossref.
  // Кандидаты (DOI уже находились в Crossref 23.10.2026, но поля всё равно брать из ответа Crossref):
  //   prokrastinatsiya — Steel 2007, 10.1037/0033-2909.133.1.65; uchyoba — Poropat 2009, 10.1037/a0014996; liderstvo — Judge, Bono, Ilies 2002, 10.1037/0021-9010.87.4.765;
  //   tvorchestvo — Feist 1998, 10.1207/s15327957pspr0204_5; schaste — DeNeve, Cooper 1998, 10.1037/0033-2909.124.2.197 и Steel, Schmidt, Shultz 2008, 10.1037/0033-2909.134.1.138;
  //   nasledstvennost — Vukasović, Bratko 2015, 10.1037/bul0000017; hronotip — Tsaousis 2010, 10.1002/per.754; muzyka — Rentfrow, Gosling 2003, 10.1037/0022-3514.84.6.1236;
  //   emotsionalnyj intellekt — Joseph, Newman 2010, 10.1037/a0017286; dlina testa — Johnson 2014, 10.1016/j.jrp.2014.05.003 и Gosling, Rentfrow, Swann 2003, 10.1016/S0092-6566(03)00046-1.
  topic({ slug: "prokrastinatsiya-i-lichnost", primaryQuery: "прокрастинация и личность", title: "Прокрастинация и личность: при чём тут добросовестность", cluster: "wellbeing", intent: "Понять, как откладывание дел связано с чертами, а не с ленью или слабой волей", links: ["/traits/conscientiousness-low", "/traits/conscientiousness-high", "/articles/dobrosovestnost"], sourceKeys: ["needs-research"] }),
  topic({ slug: "kak-obschatsya-s-introvertom", primaryQuery: "как общаться с интровертом", title: "Как общаться с интровертом: что важно знать", cluster: "relationships", intent: "Подсказки для друзей, коллег и родных; не про пару (там — темп в паре)", links: ["/traits/extraversion-low", "/articles/introversiya", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "lichnost-i-schaste", primaryQuery: "личность и счастье", title: "Личность и счастье: какие черты связаны с благополучием", cluster: "wellbeing", intent: "Узнать, какие черты Big Five связаны с удовлетворённостью жизнью и как это читать", links: ["/traits/stability-high", "/traits/extraversion-high", "/articles/neyrotizm-big-five"], sourceKeys: ["needs-research"] }),
  topic({ slug: "zhavoronki-i-sovy", primaryQuery: "жаворонки и совы", title: "Жаворонки и совы: связан ли режим дня с чертами", cluster: "science", intent: "Понять, что известно о связи времени суток, когда человеку удобнее, с чертами Big Five", links: ["/traits/conscientiousness-high", "/traits/extraversion-high", "/articles/big-five"], sourceKeys: ["needs-research"] }),
  topic({ slug: "tvorcheskaya-lichnost", primaryQuery: "творческая личность", title: "Творческая личность: открытость опыту и творчество", cluster: "traits", intent: "Увидеть, какие черты чаще связаны с творчеством, без деления на творческих и нетворческих", links: ["/traits/openness-high", "/traits/openness-low", "/articles/otkrytost-opytu"], sourceKeys: ["needs-research"] }),
  topic({ slug: "emotsionalnyj-intellekt-i-lichnost", primaryQuery: "эмоциональный интеллект и личность", title: "Эмоциональный интеллект и личность: что общего", cluster: "self-knowledge", intent: "Разобраться, чем эмоциональный интеллект отличается от черт Big Five и где они пересекаются", links: ["/traits/stability-high", "/traits/agreeableness-high", "/articles/big-five"], sourceKeys: ["needs-research"] }),
  topic({ slug: "lichnost-i-uchyoba", primaryQuery: "личность и успеваемость", title: "Личность и учёба: какие черты связаны с успеваемостью", cluster: "work", intent: "Понять, как добросовестность и другие черты связаны с учёбой и что от них не зависит", links: ["/traits/conscientiousness-high", "/traits/openness-high", "/articles/dobrosovestnost"], sourceKeys: ["needs-research"] }),
  topic({ slug: "lichnost-i-liderstvo", primaryQuery: "личность и лидерство", title: "Личность и лидерство: какие черты связаны с лидерством", cluster: "work", intent: "Увидеть, какие черты связаны с лидерством, и почему лидерский стиль не сводится к одной черте", links: ["/traits/extraversion-high", "/traits/conscientiousness-high", "/articles/ekstraversiya"], sourceKeys: ["needs-research"] }),
  topic({ slug: "vrozhdennaya-li-lichnost", primaryQuery: "личность врождённая или приобретённая", title: "Врождённая ли личность: что известно о наследуемости черт", cluster: "science", intent: "Понять, что значит наследуемость черт и чего она не значит для конкретного человека", links: ["/articles/big-five", "/articles/naskolko-tochen-big-five", "/traits"], sourceKeys: ["needs-research"] }),
  topic({ slug: "muzyka-i-lichnost", primaryQuery: "музыка и личность", title: "Музыка и личность: связаны ли вкусы с чертами Big Five", cluster: "science", intent: "Узнать, что известно о связи музыкальных предпочтений с чертами, без угадывания человека по плейлисту", links: ["/traits/openness-high", "/traits/extraversion-high", "/articles/otkrytost-opytu"], sourceKeys: ["needs-research"] }),
  topic({ slug: "aspekty-big-five", primaryQuery: "аспекты Big Five", title: "Аспекты Big Five: почему у каждой черты две стороны", cluster: "big-five", intent: "Понять, что каждая из пяти шкал делится на два аспекта и почему один балл скрывает разницу", links: ["/traits", "/articles/rezultaty-big-five", "/articles/ipip-50"], sourceKeys: ["otkrytost-opytu"] }),
  topic({ slug: "skolko-voprosov-v-teste-lichnosti", primaryQuery: "сколько вопросов в тесте личности", title: "Сколько вопросов нужно тесту личности: 10, 50 или 120", cluster: "test", intent: "Сравнить короткие и длинные тесты Big Five: что теряется при сокращении и что даёт длина", links: ["/articles/ipip-50", "/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["ipip-50", "test-lichnosti"] }),
] as const;

export function validateContentPlan(plan: readonly ContentTopic[] = CONTENT_PLAN): void {
  const paths = new Set<string>();
  for (const topic of plan) {
    const parsed = TopicSchema.safeParse(topic);
    if (!parsed.success) throw new Error(`Invalid content topic ${topic.slug}: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    if (paths.has(topic.path)) throw new Error(`Duplicate content URL: ${topic.path}`);
    paths.add(topic.path);
    for (const sourceKey of topic.sourceKeys) if (!SAFE_SOURCE_KEYS.has(sourceKey)) throw new Error(`Unknown source key for ${topic.slug}: ${sourceKey}`);
    if (topic.title.toLowerCase().includes("mbti") && topic.cluster !== "comparison") throw new Error(`MBTI topics must stay in comparison cluster: ${topic.slug}`);
  }
}

export function topicsByStatus(status: ContentStatus, plan: readonly ContentTopic[] = CONTENT_PLAN): ContentTopic[] {
  return plan.filter((topic) => topic.status === status);
}

export function publishedCanonicalUrls(plan: readonly ContentTopic[] = CONTENT_PLAN): string[] {
  return topicsByStatus("published", plan).map((topic) => topic.canonical);
}

export function seoMetadataForTopic(topic: ContentTopic): { title: string; description: string; alternates: { canonical: string } } {
  return { title: topic.title, description: topic.description, alternates: { canonical: topic.canonical } };
}

export function internalLinksForTopic(slug: string, plan: readonly ContentTopic[] = CONTENT_PLAN): readonly string[] {
  const topic = plan.find((item) => item.slug === slug);
  if (!topic) throw new Error(`Unknown content topic: ${slug}`);
  return topic.internalLinks;
}
