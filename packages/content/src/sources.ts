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

export const ARTICLE_SOURCES: Readonly<Record<string, readonly Source[]>> = {
  "big-five": [GOLDBERG_1992, MCCRAE_COSTA_1997, ROBERTS_2006, SOTO_2019, IPIP_2006],
  "ekstravert-introvert": [LUCAS_2000, DEYOUNG_2007, CHEEK_BUSS_1981],
  "kak-menya-vidyat": [VAZIRE_2010, CONNELLY_ONES_2010],
  "sovmestimost-par": [DYRENFORTH_2010, MALOUFF_2010],
  "test-lichnosti": [IPIP_2006, ROBERTS_DELVECCHIO_2000, PITTENGER_2005],
};

export const METHOD_SOURCES: readonly Source[] = [GOLDBERG_1992, IPIP_2006, ROBERTS_DELVECCHIO_2000, VAZIRE_2010, DYRENFORTH_2010, MALOUFF_2010];

export function sourceLabel(source: Source): string {
  return `${source.authors} (${source.year}). ${source.title} // ${source.journal}`;
}
