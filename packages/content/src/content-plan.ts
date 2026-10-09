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
  topic({ slug: "shkaly-big-five", primaryQuery: "шкалы Big Five", title: "Шкалы Big Five: что означают баллы", cluster: "big-five", links: ["/traits", "/articles/big-five"], sourceKeys: ["big-five"] }),
  topic({ slug: "naskolko-tochen-big-five", primaryQuery: "насколько точен Big Five", title: "Насколько точен тест Big Five", cluster: "big-five", status: "published", links: ["/about", "/articles/test-lichnosti"], sourceKeys: ["big-five", "test-lichnosti"] }),
  topic({ slug: "big-five-ili-mbti", primaryQuery: "Big Five или MBTI", title: "Big Five или MBTI: что выбрать", cluster: "comparison", links: ["/articles/mbti-i-socionika", "/types"], sourceKeys: ["mbti-i-socionika"] }),
  topic({ slug: "ekstraversiya", primaryQuery: "экстраверсия", title: "Экстраверсия: как она проявляется", cluster: "traits", links: ["/traits/extraversion-high", "/traits/extraversion-low"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "introversiya", primaryQuery: "интроверсия", title: "Интроверсия: сила спокойного темпа", cluster: "traits", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "otkrytost-opytu", primaryQuery: "открытость опыту", title: "Открытость опыту: любопытство и идеи", cluster: "traits", status: "published", links: ["/traits/openness-high", "/traits/openness-low"], sourceKeys: ["otkrytost-opytu"] }),
  topic({ slug: "nizkaya-otkrytost", primaryQuery: "низкая открытость", title: "Низкая открытость: практичность без стыда", cluster: "traits", status: "published", links: ["/traits/openness-low", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "dobrosovestnost", primaryQuery: "добросовестность", title: "Добросовестность: порядок и доведение дел", cluster: "traits", status: "published", links: ["/traits/conscientiousness-high", "/traits/conscientiousness-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "nizkaya-dobrosovestnost", primaryQuery: "низкая добросовестность", title: "Низкая добросовестность: гибкость и риски", cluster: "traits", links: ["/traits/conscientiousness-low", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "dobrozhelatelnost", primaryQuery: "доброжелательность", title: "Доброжелательность: доверие и мягкость", cluster: "traits", links: ["/traits/agreeableness-high", "/traits/agreeableness-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "nizkaya-dobrozhelatelnost", primaryQuery: "низкая доброжелательность", title: "Низкая доброжелательность: прямота и границы", cluster: "traits", links: ["/traits/agreeableness-low", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "emotsionalnaya-ustoychivost", primaryQuery: "эмоциональная устойчивость", title: "Эмоциональная устойчивость: спокойствие под давлением", cluster: "traits", links: ["/traits/stability-high", "/traits/stability-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "neyrotizm-big-five", primaryQuery: "нейротизм Big Five", title: "Нейротизм в Big Five и чувствительность", cluster: "traits", links: ["/traits/stability-low", "/articles/big-five"], sourceKeys: ["big-five"] }),
  topic({ slug: "chuvstvitelnost", primaryQuery: "чувствительность характера", title: "Чувствительность: как жить с тонкой реакцией", cluster: "traits", links: ["/traits/stability-low", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "silnye-storony-introverta", primaryQuery: "сильные стороны интроверта", title: "Сильные стороны интроверта", cluster: "traits", links: ["/traits/extraversion-low", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "silnye-storony-ekstraverta", primaryQuery: "сильные стороны экстраверта", title: "Сильные стороны экстраверта", cluster: "traits", links: ["/traits/extraversion-high", "/articles/ekstravert-introvert"], sourceKeys: ["ekstravert-introvert"] }),
  topic({ slug: "tipy-lichnosti-grani", primaryQuery: "типы личности Грани", title: "Типы личности Грани: как они устроены", cluster: "types", links: ["/types", "/articles/big-five"], sourceKeys: ["big-five"] }),
  topic({ slug: "16-tipov-lichnosti", primaryQuery: "16 типов личности", title: "16 типов личности без мифов", cluster: "types", links: ["/types", "/articles/mbti-i-socionika"], sourceKeys: ["mbti-i-socionika", "big-five"] }),
  topic({ slug: "tip-iskra", primaryQuery: "тип Искра", title: "Тип Искра: энергия и идеи", cluster: "types", links: ["/types/iskra", "/traits/extraversion-high"], sourceKeys: ["big-five"] }),
  topic({ slug: "tip-arkhitektor", primaryQuery: "тип Архитектор", title: "Тип Архитектор: структура и глубина", cluster: "types", links: ["/types/arkhitektor", "/traits/conscientiousness-high"], sourceKeys: ["big-five"] }),
  topic({ slug: "tip-mechtatel", primaryQuery: "тип Мечтатель", title: "Тип Мечтатель: воображение и смысл", cluster: "types", links: ["/types/mechtatel", "/traits/openness-high"], sourceKeys: ["big-five"] }),
  topic({ slug: "tip-opora", primaryQuery: "тип Опора", title: "Тип Опора: надежность и забота", cluster: "types", links: ["/types/opora", "/traits/agreeableness-high"], sourceKeys: ["big-five"] }),
  topic({ slug: "tip-komandir", primaryQuery: "тип Командир", title: "Тип Командир: движение и решения", cluster: "types", links: ["/types/komandir", "/traits/agreeableness-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "tip-nablyudatel", primaryQuery: "тип Наблюдатель", title: "Тип Наблюдатель: спокойствие и дистанция", cluster: "types", links: ["/types/nablyudatel", "/traits/extraversion-low"], sourceKeys: ["big-five"] }),
  topic({ slug: "sovmestimost-tipov", primaryQuery: "совместимость типов личности", title: "Совместимость типов личности: что важно", cluster: "relationships", links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "big-five-v-otnosheniyah", primaryQuery: "Big Five в отношениях", title: "Big Five в отношениях: где вы похожи", cluster: "relationships", links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "kak-ponyat-partnera", primaryQuery: "как понять партнера", title: "Как понять партнера через пять черт", cluster: "relationships", links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "raznye-tempy-v-pare", primaryQuery: "разный темп в паре", title: "Разный темп в паре: как договориться", cluster: "relationships", links: ["/traits/extraversion-high", "/traits/extraversion-low", "/compatibility"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "konflikty-i-big-five", primaryQuery: "конфликты и Big Five", title: "Конфликты через призму Big Five", cluster: "relationships", links: ["/compatibility", "/traits/agreeableness-low"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "druzya-otsenivayut-menya", primaryQuery: "как меня видят друзья", title: "Как меня видят друзья: зачем сравнивать взгляды", cluster: "friends", links: ["/articles/kak-menya-vidyat", "/test"], sourceKeys: ["kak-menya-vidyat"] }),
  topic({ slug: "samootsenka-i-vzglyad-drugih", primaryQuery: "самооценка и взгляд других", title: "Самооценка и взгляд других: почему они различаются", cluster: "friends", links: ["/articles/kak-menya-vidyat", "/traits"], sourceKeys: ["kak-menya-vidyat"] }),
  topic({ slug: "anketa-dlya-druzey", primaryQuery: "анкета для друзей", title: "Анкета для друзей: как просить обратную связь", cluster: "friends", links: ["/articles/kak-menya-vidyat", "/test"], sourceKeys: ["kak-menya-vidyat"] }),
  topic({ slug: "lichnost-i-rabota", primaryQuery: "личность и работа", title: "Личность и работа: какие черты помогают", cluster: "work", links: ["/traits/conscientiousness-high", "/traits/extraversion-high"], sourceKeys: ["needs-research"] }),
  topic({ slug: "dobrosovestnost-v-rabote", primaryQuery: "добросовестность в работе", title: "Добросовестность в работе: сила системы", cluster: "work", links: ["/traits/conscientiousness-high", "/traits/conscientiousness-low"], sourceKeys: ["needs-research"] }),
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
  topic({ slug: "test-na-sovmestimost", primaryQuery: "тест на совместимость", title: "Тест на совместимость: что реально сравнивать", cluster: "test", links: ["/compatibility", "/articles/sovmestimost-par"], sourceKeys: ["sovmestimost-par"] }),
  topic({ slug: "kak-proyti-test-chestno", primaryQuery: "как пройти тест личности честно", title: "Как проходить тест личности честно", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "povtorno-proyti-test", primaryQuery: "можно ли пройти тест повторно", title: "Можно ли проходить тест личности повторно", cluster: "test", links: ["/articles/test-lichnosti", "/big-five-test"], sourceKeys: ["test-lichnosti"] }),
  topic({ slug: "lichnost-i-samoznanie", primaryQuery: "личность и самопознание", title: "Личность и самопознание без ярлыков", cluster: "self-knowledge", links: ["/articles/big-five", "/traits"], sourceKeys: ["big-five"] }),
  topic({ slug: "kak-opisat-sebya", primaryQuery: "как описать себя", title: "Как описать себя через пять черт", cluster: "self-knowledge", links: ["/traits", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "sily-i-zony-rosta", primaryQuery: "сильные стороны и зоны роста", title: "Сильные стороны и зоны роста по Big Five", cluster: "self-knowledge", links: ["/traits", "/types"], sourceKeys: ["big-five"] }),
  topic({ slug: "lichnost-bez-yarlykov", primaryQuery: "личность без ярлыков", title: "Личность без ярлыков: как читать типы бережно", cluster: "self-knowledge", links: ["/types", "/articles/mbti-i-socionika"], sourceKeys: ["mbti-i-socionika", "big-five"] }),
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
