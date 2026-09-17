# Task 1: Визуальное направление

> **Статус: выполнен 2026-09-17.** Направления A «Бумага», B «Вечер», C «Минерал» и следующая серия («Атлас», «Обсидиан», «Пудра») пользователю не подошли. Она прислала пример стиля (кремовая бумага, тонированные панели, светлая антиква, один «чернильный» цвет); по нему собраны палитры «Оранжерея», «Туман», «Глина» — понравились все три. Решение: одна система, у каждого раздела своя палитра. Итог и все значения — `docs/design/visual-direction.md`; таблицы ниже — первая, отклонённая версия, в коде не используются. Цвет типа заменён на «тон семьи + гранёный знак» (Task 9).

**Files:**
- Create: `docs/design/visual-direction.md`
- Create (временно, не коммитится): `<scratchpad>/grani-visual-preview.html`

**Interfaces:**
- Consumes: названия 16 типов (`TYPE_NAMES` из `@grani/core`), тексты `types/*/short.md` (`@grani/content`).
- Produces: значения для фиксированных имён CSS-переменных и данные типов, которые используют Task 3, 8 и 9:
  ```
  --bg --surface --surface-2 --ink --ink-soft --line --accent --accent-ink --danger --radius --font-body --font-display
  ```
  ```ts
  // Task 9 переносит таблицу в apps/web/src/lib/type-visuals.ts
  type TypeShape = "diamond" | "hexagon" | "triangle" | "circle" | "star" | "square" | "pentagon" | "drop";
  type TypeVisual = { color: string; ink: string; shape: TypeShape };
  ```

Пользовательница хотела повторить идею Горизонта, но **изменить визуально**, поэтому стиль выбирает она. Задача — показать три готовых направления на реальных фрагментах сайта и зафиксировать выбор.

## Три направления

| | A. «Бумага» | B. «Вечер» | C. «Минерал» |
|---|---|---|---|
| Идея | тёплый редакционный журнал | тёмный, глубокий, с цветными гранями | чистый, светлый, «кристаллические» грани |
| `--bg` | `#F7F3EC` | `#14121F` | `#F3F5F8` |
| `--surface` | `#FFFFFF` | `#1E1B2E` | `#FFFFFF` |
| `--surface-2` | `#EFE8DC` | `#2A2640` | `#E7ECF2` |
| `--ink` | `#1F1D1A` | `#F2EFFA` | `#0F172A` |
| `--ink-soft` | `#6B655C` | `#A9A3BF` | `#5B6472` |
| `--line` | `#DDD4C6` | `#3A3553` | `#D5DCE5` |
| `--accent` | `#C2410C` | `#B69CFF` | `#0F766E` |
| `--accent-ink` | `#FFFFFF` | `#14121F` | `#FFFFFF` |
| `--danger` | `#B42318` | `#FF8A8A` | `#B42318` |
| `--radius` | `14px` | `20px` | `10px` |
| `--font-display` | Playfair Display | Manrope | Manrope |
| `--font-body` | Manrope | Manrope | Manrope |

Шрифты Manrope и Playfair Display есть с кириллицей в `next/font/google`, а их TTF для карточек уже лежат в `C:\dev\wishlist\apps\web\assets\fonts\` (лицензия OFL) — скачивать ничего не нужно.

## Цвета и формы типов (общие для всех направлений)

| Каталог | Тип | `color` | `ink` | `shape` |
|---|---|---|---|---|
| `pppp` | Вдохновитель | `#F59E0B` | `#1F1D1A` | `star` |
| `pppm` | Реформатор | `#DC2626` | `#FFFFFF` | `triangle` |
| `ppmp` | Созидатель | `#15803D` | `#FFFFFF` | `hexagon` |
| `ppmm` | Архитектор | `#1D4ED8` | `#FFFFFF` | `square` |
| `pmpp` | Искра | `#F97316` | `#1F1D1A` | `star` |
| `pmpm` | Бунтарь | `#BE185D` | `#FFFFFF` | `triangle` |
| `pmmp` | Мечтатель | `#7C3AED` | `#FFFFFF` | `drop` |
| `pmmm` | Изобретатель | `#0E7490` | `#FFFFFF` | `diamond` |
| `mppp` | Опора | `#65A30D` | `#1F1D1A` | `hexagon` |
| `mppm` | Командир | `#B91C1C` | `#FFFFFF` | `pentagon` |
| `mpmp` | Тихий хранитель | `#0F766E` | `#FFFFFF` | `circle` |
| `mpmm` | Мастер | `#475569` | `#FFFFFF` | `square` |
| `mmpp` | Душа компании | `#EC4899` | `#1F1D1A` | `circle` |
| `mmpm` | Игрок | `#C2410C` | `#FFFFFF` | `diamond` |
| `mmmp` | Тихая гавань | `#0EA5E9` | `#1F1D1A` | `drop` |
| `mmmm` | Наблюдатель | `#6B7280` | `#FFFFFF` | `pentagon` |

Пары `color`/`ink` подобраны так, чтобы контраст текста на цвете был не ниже 4.5:1; при правке пользователем контраст проверить заново (например, по формуле WCAG в браузерной консоли).

- [ ] **Step 0: Ветка**

```bash
cd /c/dev/grani-test
git checkout master && git pull --ff-only
git checkout -b feat/test-login
```

- [ ] **Step 1: Превью трёх направлений**

Сделать один самодостаточный HTML-файл в каталоге scratchpad (не в репозитории): переключатель A/B/C вверху, под ним на каждом направлении три фрагмента — первый экран («Узнай свой тип и как тебя видят другие», кнопка «Пройти тест», «10 минут, бесплатно»), карточка вопроса (текст вопроса, 5 вариантов ответа, прогресс «Вопрос 12 из 50») и блок результата (название типа «Искра», уточнение «спокойный», 5 шкал с полосками и баллами, короткое описание из `types/pmpp/short.md`). Ниже — сетка 16 маленьких карточек типов с цветом, формой (SVG) и названием. Шрифты — через Google Fonts `<link>`.

Отправить файл пользователю (SendUserFile, `display: "render"`) и спросить: какое направление взять, что поменять в цветах типов или формах.

- [ ] **Step 2: Зафиксировать выбор**

`docs/design/visual-direction.md` — по шаблону:
```markdown
# Грани — визуальное направление

Выбрано: <A «Бумага» | B «Вечер» | C «Минерал»>, <дата>. Правки пользователя: <список или «нет»>.

## CSS-переменные

| Переменная | Значение |
|---|---|
| --bg | ... |
| --surface | ... |
| --surface-2 | ... |
| --ink | ... |
| --ink-soft | ... |
| --line | ... |
| --accent | ... |
| --accent-ink | ... |
| --danger | ... |
| --radius | ... |
| --font-display | ... |
| --font-body | ... |

## Типы

<таблица каталог / тип / color / ink / shape с учётом правок>
```

- [ ] **Step 3: Коммит**

```bash
git add docs/design/visual-direction.md
git commit -m "docs: visual direction and type visuals"
```
