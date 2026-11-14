// Научные публикации, на которые опираются статьи и страница методики.
// Авторы, год, название и журнал сверены с Crossref по DOI; note — что именно из текста подтверждает работа
export type Source = {
  readonly authors: string;
  readonly year: number;
  readonly title: string;
  readonly journal: string;
  readonly url: string;
  readonly note: string;
};

const GOLDBERG_1992: Source = {
  authors: "Goldberg L. R.",
  year: 1992,
  title: "The development of markers for the Big-Five factor structure",
  journal: "Psychological Assessment",
  url: "https://doi.org/10.1037/1040-3590.4.1.26",
  note: "пять черт из слов, которыми люди описывают друг друга",
};

const IPIP_2006: Source = {
  authors: "Goldberg L. R., Johnson J. A., Eber H. W. и др.",
  year: 2006,
  title: "The international personality item pool and the future of public-domain personality measures",
  journal: "Journal of Research in Personality",
  url: "https://doi.org/10.1016/j.jrp.2005.08.007",
  note: "открытый банк утверждений IPIP, на котором построен опросник IPIP-50",
};

const MCCRAE_COSTA_1997: Source = {
  authors: "McCrae R. R., Costa P. T.",
  year: 1997,
  title: "Personality trait structure as a human universal",
  journal: "American Psychologist",
  url: "https://doi.org/10.1037/0003-066X.52.5.509",
  note: "пятифакторная структура воспроизводится в разных странах и языках",
};

const ROBERTS_2006: Source = {
  authors: "Roberts B. W., Walton K. E., Viechtbauer W.",
  year: 2006,
  title: "Patterns of mean-level change in personality traits across the life course: A meta-analysis of longitudinal studies",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/0033-2909.132.1.1",
  note: "с возрастом люди в среднем становятся собраннее, доброжелательнее и спокойнее",
};

const ROBERTS_DELVECCHIO_2000: Source = {
  authors: "Roberts B. W., DelVecchio W. F.",
  year: 2000,
  title: "The rank-order consistency of personality traits from childhood to old age: A quantitative review of longitudinal studies",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/0033-2909.126.1.3",
  note: "у взрослых черты устойчивы: при повторных измерениях люди сохраняют своё место на шкале",
};

const SOTO_2019: Source = {
  authors: "Soto C. J.",
  year: 2019,
  title: "How replicable are links between personality traits and consequential life outcomes? The Life Outcomes of Personality Replication Project",
  journal: "Psychological Science",
  url: "https://doi.org/10.1177/0956797619831612",
  note: "связи черт с учёбой, работой, отношениями и здоровьем воспроизводятся, но они умеренные",
};

const LUCAS_2000: Source = {
  authors: "Lucas R. E., Diener E., Grob A., Suh E. M., Shao L.",
  year: 2000,
  title: "Cross-cultural evidence for the fundamental features of extraversion",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/0022-3514.79.3.452",
  note: "ядро экстраверсии — чувствительность к вознаграждению и яркие положительные эмоции",
};

const DEYOUNG_2007: Source = {
  authors: "DeYoung C. G., Quilty L. C., Peterson J. B.",
  year: 2007,
  title: "Between facets and domains: 10 aspects of the Big Five",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/0022-3514.93.5.880",
  note: "из чего складывается каждая черта: например, экстраверсия — это напористость и воодушевление",
};

const CHEEK_BUSS_1981: Source = {
  authors: "Cheek J. M., Buss A. H.",
  year: 1981,
  title: "Shyness and sociability",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/0022-3514.41.2.330",
  note: "застенчивость и общительность — разные свойства, а не два конца одной шкалы",
};

const VAZIRE_2010: Source = {
  authors: "Vazire S.",
  year: 2010,
  title: "Who knows what about a person? The self–other knowledge asymmetry (SOKA) model",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/a0017908",
  note: "заметные снаружи черты точнее видят другие, внутренние вроде тревожности — сам человек",
};

const CONNELLY_ONES_2010: Source = {
  authors: "Connelly B. S., Ones D. S.",
  year: 2010,
  title: "An other perspective on personality: Meta-analytic integration of observers' accuracy and predictive validity",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/a0021212",
  note: "оценки знакомых умеренно совпадают с самооценкой и тем точнее, чем ближе знакомство",
};

const MALOUFF_2010: Source = {
  authors: "Malouff J. M., Thorsteinsson E. B., Schutte N. S., Bhullar N., Rooke S. E.",
  year: 2010,
  title: "The Five-Factor Model of personality and relationship satisfaction of intimate partners: A meta-analysis",
  journal: "Journal of Research in Personality",
  url: "https://doi.org/10.1016/j.jrp.2009.09.004",
  note: "удовлетворённость парой связана с устойчивостью, доброжелательностью и добросовестностью партнёра",
};

const DYRENFORTH_2010: Source = {
  authors: "Dyrenforth P. S., Kashy D. A., Donnellan M. B., Lucas R. E.",
  year: 2010,
  title:
    "Predicting relationship and life satisfaction from personality in nationally representative samples from three countries: The relative importance of actor, partner, and similarity effects",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/a0020385",
  note: "черты каждого партнёра объясняют счастье в паре заметно сильнее, чем их похожесть",
};

const PITTENGER_2005: Source = {
  authors: "Pittenger D. J.",
  year: 2005,
  title: "Cautionary comments regarding the Myers-Briggs Type Indicator",
  journal: "Consulting Psychology Journal: Practice and Research",
  url: "https://doi.org/10.1037/1065-9293.57.3.210",
  note: "почему деление на типы без баллов теряет информацию и тип часто меняется при повторе",
};

const MCCRAE_COSTA_1989: Source = {
  authors: "McCrae R. R., Costa P. T.",
  year: 1989,
  title: "Reinterpreting the Myers-Briggs Type Indicator from the perspective of the five-factor model of personality",
  journal: "Journal of Personality",
  url: "https://doi.org/10.1111/j.1467-6494.1989.tb00759.x",
  note: "четыре шкалы MBTI совпадают с экстраверсией, открытостью, доброжелательностью и добросовестностью; устойчивости в MBTI нет",
};

const EYSENCK_1991: Source = {
  authors: "Eysenck H. J.",
  year: 1991,
  title: "Dimensions of personality: 16, 5 or 3? Criteria for a taxonomic paradigm",
  journal: "Personality and Individual Differences",
  url: "https://doi.org/10.1016/0191-8869(91)90144-Z",
  note: "модель Айзенка с осями экстраверсии и нейротизма, на которые ложатся четыре классических темперамента",
};

const ROTHBART_2007: Source = {
  authors: "Rothbart M. K.",
  year: 2007,
  title: "Temperament, development, and personality",
  journal: "Current Directions in Psychological Science",
  url: "https://doi.org/10.1111/j.1467-8721.2007.00505.x",
  note: "темперамент заметен уже в детстве, и из него со временем вырастают черты личности взрослого",
};

const FLEESON_2001: Source = {
  authors: "Fleeson W.",
  year: 2001,
  title: "Toward a structure- and process-integrated view of personality: Traits as density distributions of states",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/0022-3514.80.6.1011",
  note: "поведение каждого человека сильно меняется от ситуации к ситуации, черта описывает его в среднем",
};

const FLEESON_2002: Source = {
  authors: "Fleeson W., Malanos A. B., Achille N. M.",
  year: 2002,
  title:
    "An intraindividual process approach to the relationship between extraversion and positive affect: Is acting extraverted as “good” as being extraverted?",
  journal: "Journal of Personality and Social Psychology",
  url: "https://doi.org/10.1037/0022-3514.83.6.1409",
  note: "когда люди ведут себя общительнее, они чувствуют больше положительных эмоций — и интроверты тоже",
};

const GRANT_2013: Source = {
  authors: "Grant A. M.",
  year: 2013,
  title: "Rethinking the extraverted sales ideal: The ambivert advantage",
  journal: "Psychological Science",
  url: "https://doi.org/10.1177/0956797612463706",
  note: "в исследовании продавцов лучший результат показали люди со средней экстраверсией",
};

const WILMOT_2019_EXTRAVERSION: Source = {
  authors: "Michael P. Wilmot, Connie R. Wanberg, John D. Kammeyer-Mueller, Deniz S. Ones",
  year: 2019,
  title: "Extraversion advantages at work: A quantitative review and synthesis of the meta-analytic evidence.",
  journal: "Journal of Applied Psychology",
  url: "https://doi.org/10.1037/apl0000415",
  note: "небольшая средняя связь экстраверсии с рабочими показателями; общительность сама по себе даёт ограниченные преимущества",
};

const BARRICK_MOUNT_1991: Source = {
  authors: "MURRAY R. BARRICK, MICHAEL K. MOUNT",
  year: 1991,
  title: "THE BIG FIVE PERSONALITY DIMENSIONS AND JOB PERFORMANCE: A META‐ANALYSIS",
  journal: "Personnel Psychology",
  url: "https://doi.org/10.1111/j.1744-6570.1991.tb00688.x",
  note: "открытость была связана с результатами обучения сотрудников в метаанализе, но не с другими обобщёнными рабочими показателями",
};

const HUANG_2014: Source = {
  authors: "Jason L. Huang, Ann Marie Ryan, Keith L. Zabel, Ashley Palmer",
  year: 2014,
  title: "Personality and adaptive performance at work: A meta-analytic investigation.",
  journal: "Journal of Applied Psychology",
  url: "https://doi.org/10.1037/a0034285",
  note: "открытость не помогла предсказать общий показатель адаптивного поведения на работе",
};

const LUO_2023: Source = {
  authors: "Jing Luo, Bo Zhang, Mengyang Cao, Brent W. Roberts",
  year: 2023,
  title: "The Stressful Personality: A Meta-Analytical Review of the Relation Between Personality and Stress",
  journal: "Personality and Social Psychology Review",
  url: "https://doi.org/10.1177/10888683221104002",
  note: "связи черт Big Five со стрессом различаются для событий, субъективной оценки и физиологической реакции",
};

const BOLGER_SCHILLING_1991: Source = {
  authors: "Niall Bolger, Elizabeth A. Schilling",
  year: 1991,
  title: "Personality and the Problems of Everyday Life: The Role of Neuroticism In Exposure and Reactivity to Daily Stressors",
  journal: "Journal of Personality",
  url: "https://doi.org/10.1111/j.1467-6494.1991.tb00253.x",
  note: "дневниковое исследование разделяет частоту повседневных стрессоров и силу реакции на них",
};

const LEIKAS_ILMARINEN_2017: Source = {
  authors: "Sointu Leikas, Ville‐Juhani Ilmarinen",
  year: 2017,
  title: "Happy Now, Tired Later? Extraverted and Conscientious Behavior Are Related to Immediate Mood Gains, but to Later Fatigue",
  journal: "Journal of Personality",
  url: "https://doi.org/10.1111/jopy.12264",
  note: "общительное поведение было связано с хорошим настроением в моменте и большей усталостью позже",
};

const NGUYEN_RYAN_DECI_2018: Source = {
  authors: "Thuy-vy T. Nguyen, Richard M. Ryan, Edward L. Deci",
  year: 2018,
  title: "Solitude as an Approach to Affective Self-Regulation",
  journal: "Personality and Social Psychology Bulletin",
  url: "https://doi.org/10.1177/0146167217733073",
  note: "уединение снижало интенсивность активных эмоций, а желание побыть одному было связано с расслабленностью",
};

const STEEL_2007: Source = {
  authors: "Steel P.",
  year: 2007,
  title: "The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/0033-2909.133.1.65",
  note: "прокрастинация как сбой саморегуляции; сильнее всего она связана с низкой добросовестностью, особенно с импульсивностью",
};

const SIROIS_PYCHYL_2013: Source = {
  authors: "Sirois F. M., Pychyl T. A.",
  year: 2013,
  title: "Procrastination and the priority of short-term mood regulation: Consequences for future self",
  journal: "Social and Personality Psychology Compass",
  url: "https://doi.org/10.1111/spc3.12011",
  note: "откладывание как способ быстро улучшить настроение, убрав неприятную задачу из поля зрения",
};

const KOTOV_2010: Source = {
  authors: "Kotov R., Gamez W., Schmidt F., Watson D.",
  year: 2010,
  title: "Linking “big” personality traits to anxiety, depressive, and substance use disorders: A meta-analysis",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/a0020327",
  note: "метаанализ: из всех черт сильнее всего с частыми переживаниями тревоги связана эмоциональная чувствительность (обратная сторона устойчивости)",
};

const LAHEY_2009: Source = {
  authors: "Lahey B. B.",
  year: 2009,
  title: "Public health significance of neuroticism",
  journal: "American Psychologist",
  url: "https://doi.org/10.1037/a0015309",
  note: "обзор: эмоциональная чувствительность (нейротизм) связана с более частой тревогой и подавленностью и с нагрузкой на здоровье; черта устойчива и не равна текущему состоянию",
};

const STOEBER_OTTO_2006: Source = {
  authors: "Stoeber J., Otto K.",
  year: 2006,
  title: "Positive Conceptions of Perfectionism: Approaches, Evidence, Challenges",
  journal: "Personality and Social Psychology Review",
  url: "https://doi.org/10.1207/s15327957pspr1004_2",
  note: "обзор: у перфекционизма две стороны — стремление к высоким стандартам и опасения по поводу ошибок; изматывает в основном вторая",
};

const EGAN_2011: Source = {
  authors: "Egan S. J., Wade T. D., Shafran R.",
  year: 2011,
  title: "Perfectionism as a transdiagnostic process: A clinical review",
  journal: "Clinical Psychology Review",
  url: "https://doi.org/10.1016/j.cpr.2010.04.009",
  note: "обзор: перфекционизм поддерживает сам себя, когда самооценка привязана к достижениям и подпитывается самокритикой",
};

const CURRAN_HILL_2019: Source = {
  authors: "Curran T., Hill A. P.",
  year: 2019,
  title: "Perfectionism is increasing over time: A meta-analysis of birth cohort differences from 1989 to 2016",
  journal: "Psychological Bulletin",
  url: "https://doi.org/10.1037/bul0000138",
  note: "метаанализ когорт 1989–2016: у молодых поколений перфекционизм в среднем растёт, особенно ощущение завышенных требований со стороны других",
};

const SWIDER_ZIMMERMAN_2010: Source = {
  authors: "Swider B. W., Zimmerman R. D.",
  year: 2010,
  title: "Born to burnout: A meta-analytic path model of personality, job burnout, and work outcomes",
  journal: "Journal of Vocational Behavior",
  url: "https://doi.org/10.1016/j.jvb.2010.01.003",
  note: "метаанализ: из черт сильнее всего с выгоранием связана эмоциональная чувствительность; нагрузка и поддержка на работе значат не меньше черт",
};

const ALARCON_2009: Source = {
  authors: "Alarcon G., Eschleman K. J., Bowling N. A.",
  year: 2009,
  title: "Relationships between personality variables and burnout: A meta-analysis",
  journal: "Work & Stress",
  url: "https://doi.org/10.1080/02678370903282600",
  note: "метаанализ: выгорание связано с несколькими чертами, но черты объясняют лишь часть различий — условия работы остаются ключевыми",
};

const RICK_SMALL_FINKEL_2011: Source = {
  authors: "Rick S. I., Small D. A., Finkel E. J.",
  year: 2011,
  title: "Fatal (Fiscal) Attraction: Spendthrifts and Tightwads in Marriage",
  journal: "Journal of Marketing Research",
  url: "https://doi.org/10.1509/jmkr.48.2.228",
  note: "исследование браков: транжиры и экономные люди чаще выбирают друг друга, и это несовпадение связано с более частыми спорами о деньгах",
};

const DEW_BRITT_HUSTON_2012: Source = {
  authors: "Dew J., Britt S., Huston S.",
  year: 2012,
  title: "Examining the Relationship Between Financial Issues and Divorce",
  journal: "Family Relations",
  url: "https://doi.org/10.1111/j.1741-3729.2012.00715.x",
  note: "панельные данные: споры о деньгах — один из самых сильных предикторов распада пары, сильнее многих других тем конфликтов",
};

const MATZ_GLADSTONE_STILLWELL_2016: Source = {
  authors: "Matz S. C., Gladstone J. J., Stillwell D.",
  year: 2016,
  title: "Money Buys Happiness When Spending Fits Our Personality",
  journal: "Psychological Science",
  url: "https://doi.org/10.1177/0956797616635200",
  note: "исследование банковских трат: покупки, совпадающие с чертами человека, связаны с большей удовлетворённостью, чем сама сумма трат",
};

const DONNELLY_IYER_HOWELL_2012: Source = {
  authors: "Donnelly G., Iyer R., Howell R. T.",
  year: 2012,
  title: "The Big Five personality traits, material values, and financial well-being of self-described money managers",
  journal: "Journal of Economic Psychology",
  url: "https://doi.org/10.1016/j.joep.2012.08.001",
  note: "исследование: добросовестность связана с лучшим финансовым благополучием, а выраженный материализм — с большими долгами",
};

export const ARTICLE_SOURCES: Readonly<Record<string, readonly Source[]>> = {
  "prokrastinatsiya-i-lichnost": [STEEL_2007, SIROIS_PYCHYL_2013],
  "trevozhnost-i-cherty": [KOTOV_2010, LAHEY_2009],
  "perfektsionizm-i-lichnost": [STOEBER_OTTO_2006, EGAN_2011, CURRAN_HILL_2019],
  "vygoranie-i-lichnost": [SWIDER_ZIMMERMAN_2010, ALARCON_2009],
  "dengi-v-pare": [RICK_SMALL_FINKEL_2011, DEW_BRITT_HUSTON_2012],
  "lichnost-i-dengi": [MATZ_GLADSTONE_STILLWELL_2016, DONNELLY_IYER_HOWELL_2012],
  "kak-vosstanavlivatsya-introvertu": [LEIKAS_ILMARINEN_2017, NGUYEN_RYAN_DECI_2018],
  "lichnost-i-stress": [LUO_2023, BOLGER_SCHILLING_1991],
  "otkrytost-i-karera": [BARRICK_MOUNT_1991, HUANG_2014],
  "introvert-na-rabote": [CHEEK_BUSS_1981, FLEESON_2001],
  "ekstraversiya-v-rabote": [WILMOT_2019_EXTRAVERSION, GRANT_2013],
  "dobrosovestnost": [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  "nizkaya-otkrytost": [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  "big-five": [GOLDBERG_1992, MCCRAE_COSTA_1997, ROBERTS_2006, SOTO_2019, IPIP_2006],
  "otkrytost-opytu": [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  "rezultaty-big-five": [ROBERTS_DELVECCHIO_2000, ROBERTS_2006, SOTO_2019],
  "ekstravert-introvert": [LUCAS_2000, DEYOUNG_2007, CHEEK_BUSS_1981],
  "kak-menya-vidyat": [VAZIRE_2010, CONNELLY_ONES_2010],
  "sovmestimost-par": [DYRENFORTH_2010, MALOUFF_2010],
  "test-sovmestimosti-dlya-dvoikh": [DYRENFORTH_2010, MALOUFF_2010],
  "big-five-v-otnosheniyah": [DYRENFORTH_2010, MALOUFF_2010],
  "kak-ponyat-partnera": [DYRENFORTH_2010, MALOUFF_2010],
  "raznye-tempy-v-pare": [DYRENFORTH_2010, MALOUFF_2010],
  "test-lichnosti": [IPIP_2006, ROBERTS_DELVECCHIO_2000, PITTENGER_2005],
  "mbti-i-socionika": [MCCRAE_COSTA_1989, PITTENGER_2005, GOLDBERG_1992],
  temperament: [EYSENCK_1991, ROTHBART_2007],
  ambivert: [FLEESON_2001, FLEESON_2002, GRANT_2013],
  "ipip-50": [IPIP_2006, GOLDBERG_1992],
  "naskolko-tochen-big-five": [ROBERTS_DELVECCHIO_2000, GOLDBERG_1992, MCCRAE_COSTA_1997, SOTO_2019],
  ekstraversiya: [LUCAS_2000, DEYOUNG_2007, CHEEK_BUSS_1981],
  introversiya: [LUCAS_2000, DEYOUNG_2007, CHEEK_BUSS_1981],
  "nizkaya-dobrosovestnost": [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  "dobrozhelatelnost": [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
  "nizkaya-dobrozhelatelnost": [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
  "emotsionalnaya-ustoychivost": [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
  "neyrotizm-big-five": [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
  "sovmestimost-tipov": [DYRENFORTH_2010, MALOUFF_2010],
  "konflikty-i-big-five": [DYRENFORTH_2010, MALOUFF_2010],
  "lichnost-i-rabota": [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  "dobrosovestnost-v-rabote": [DEYOUNG_2007, SOTO_2019],
};

// Источники гидов по чертам: из чего складывается черта (DeYoung), с чем связана в жизни (Soto),
// как меняется с возрастом (Roberts) и что показывают исследования пар (Malouff) — всё уже сверено по DOI
export const TRAIT_SOURCES: Readonly<Record<string, readonly Source[]>> = {
  openness: [DEYOUNG_2007, SOTO_2019, ROBERTS_2006],
  conscientiousness: [DEYOUNG_2007, SOTO_2019, ROBERTS_2006, MALOUFF_2010],
  extraversion: [LUCAS_2000, DEYOUNG_2007, CHEEK_BUSS_1981, SOTO_2019],
  agreeableness: [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
  stability: [DEYOUNG_2007, MALOUFF_2010, ROBERTS_2006],
};

export const METHOD_SOURCES: readonly Source[] = [GOLDBERG_1992, IPIP_2006, ROBERTS_DELVECCHIO_2000, VAZIRE_2010, DYRENFORTH_2010, MALOUFF_2010];

export function sourceLabel(source: Source): string {
  return `${source.authors} (${source.year}). ${source.title} // ${source.journal}`;
}
