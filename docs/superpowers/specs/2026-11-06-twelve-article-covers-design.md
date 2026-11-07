# Twelve Article Covers Design

## Intent

Give the 12 published articles that still share three generic rubric images their own editorial covers. The result should make the catalogue easier to scan while preserving the established visual identity and every article contract.

## Goals

- Create one unique cover for each targeted article.
- Match the existing dark emerald, gold and cinematic 3D editorial series.
- Use the same cover in catalogue cards, featured cards, article hero, related cards, Open Graph, Twitter Card and Article JSON-LD through existing front matter.
- Export every production asset as sRGB WebP at exactly 1600 × 900 px.
- Add a specific Russian alt text of at least 20 characters for each image.

## Non-goals

- Do not edit article titles, descriptions, dates, canonical URLs, body copy or sources.
- Do not replace the 21 existing dedicated article covers.
- Do not change the article rendering components, database, CMS, authentication, payment or deployment workflows.
- Do not publish without a separate explicit request.

## Visual system

- Dark emerald and near-black environment, polished dark stone or green marble.
- Faceted emerald glass and sculptural forms with restrained warm-gold metal or light accents.
- Cinematic volumetric lighting, realistic reflections, deep shadows and premium editorial 3D finish.
- Wide 16:9 composition that remains legible when cropped inside article cards.
- No words, letters, numbers, logos, watermarks, interface mockups, frames or decorative borders.
- Human figures, when used, are stylized sculptures rather than identifiable real people.

## Cover map

| Slug | Production file | Composition | Alt text |
| --- | --- | --- | --- |
| `big-five-v-otnosheniyah` | `big-five-v-otnosheniyah.webp` | Two sculptural partners beside five paired emerald forms linked by gold arcs. | Две изумрудные фигуры партнёров рядом с пятью парами кристаллов, соединённых золотыми дугами |
| `dobrosovestnost-v-rabote` | `dobrosovestnost-v-rabote.webp` | Ordered blocks, recurring rails and a calm gold task light. | Упорядоченные изумрудные блоки и повторяющиеся золотые линии под направленным рабочим светом |
| `ekstraversiya-v-rabote` | `ekstraversiya-v-rabote.webp` | Energetic team around a round table with outward gold connections. | Команда из изумрудных фигур за круглым столом, соединённая расходящимися золотыми линиями |
| `introvert-na-rabote` | `introvert-na-rabote.webp` | Focused lone figure in a quiet alcove, distant teamwork blurred behind glass. | Изумрудная фигура работает в тихой нише, пока за стеклом мягко размыто пространство команды |
| `kak-ponyat-partnera` | `kak-ponyat-partnera.webp` | Two facing busts and a central prism dividing one gold beam into five. | Два изумрудных бюста смотрят друг на друга через призму, разделяющую золотой свет на пять лучей |
| `kak-vosstanavlivatsya-introvertu` | `kak-vosstanavlivatsya-introvertu.webp` | Seated figure in a calm conservatory with a protective warm halo. | Сидящая изумрудная фигура отдыхает в тихой тёмной оранжерее внутри мягкого золотого свечения |
| `konflikty-i-big-five` | `konflikty-i-big-five.webp` | Two figures across a cracked circular platform; five tangled threads reconnect. | Две изумрудные фигуры стоят по сторонам трещины, над которой снова соединяются пять золотых нитей |
| `lichnost-i-rabota` | `lichnost-i-rabota.webp` | Central worker sculpture arranging five different emerald forms on a planning grid. | Изумрудная фигура расставляет пять разных кристаллов на рабочей сетке с золотыми направляющими |
| `lichnost-i-stress` | `lichnost-i-stress.webp` | Grounded figure on stone while turbulent gold waves pass around it. | Устойчивая изумрудная фигура стоит на камне среди напряжённых волн золотого света |
| `otkrytost-i-karera` | `otkrytost-i-karera.webp` | Forked workplace: ordered grid on one side, luminous novel forms on the other. | Изумрудная фигура стоит между строгой рабочей сеткой и пространством новых светящихся форм |
| `raznye-tempy-v-pare` | `raznye-tempy-v-pare.webp` | Two partners moving on concentric tracks at different rhythms, meeting at a gold bridge. | Две изумрудные фигуры движутся по разным круговым траекториям и встречаются у золотого моста |
| `sovmestimost-tipov` | `sovmestimost-tipov.webp` | Two distinct polyhedral sculptures aligned by one complementary gold ring. | Две разные изумрудные многогранные фигуры соединены общей золотой окружностью |

## Technical integration

Final assets live in `apps/web/public/images/articles/`. Each corresponding Markdown file changes only `image` and `imageAlt`; `pnpm build:library` regenerates `packages/content/src/generated/articles.json`. Existing `articleCover()` and metadata code distribute those fields to every required surface.

## Acceptance

- All 12 target articles use distinct `/images/articles/*.webp` paths and distinct binary hashes.
- Every file exists, is WebP, sRGB and exactly 1600 × 900 px.
- No target article still references `/home/cover-work.webp`, `/home/article-relationship.webp` or `/home/article-friends.webp`.
- Related tests, typecheck and production build pass.
- Browser QA confirms catalogue, hero and social metadata at 390, 768 and 1440 px with no console errors or horizontal overflow.
