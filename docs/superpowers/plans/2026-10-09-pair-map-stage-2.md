# Pair Map Stage 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить к купленному разбору пары восемь взаимно раскрываемых ответов, три версионируемые договорённости с двумя подтверждениями и настоящий PDF.

**Architecture:** Чистая модель и валидация в `@grani/core`; отдельные таблицы и транзакции в `@grani/db`; серверный сервис проверяет прежнее право на покупку и действующее участие в паре. Клиент получает только безопасный снимок. Серверный PDF использует тот же снимок, реальные профили и уже готовые дополнительные главы.

**Tech Stack:** Существующие Next.js 16.3.5, React 19.3.0, TypeScript, Drizzle/PostgreSQL, Vitest/PGlite, Playwright; новая точная зависимость `@react-pdf/renderer@4.9.0`; `pdfjs-dist@6.4.299` только как dev dependency для извлечения текста в тестах PDF. Версии, React peerDependencies и Node engines парсера проверены через npm 9 октября 2026; Node 24 и standalone renderer проверяются на собственном минимальном документе.

**Spec:** [Утверждённый проект](../specs/2026-10-09-pair-map-stage-2-design.md), принят пользователем 9 октября 2026 сообщением «утверждаю».

## Global Constraints

- Основа: актуальный `origin/master`; сейчас `c00c9b0d165b7b7277dd8316ead69fd016300bfb`. Новая ветка `codex/pair-map-stage-2`.
- Цена `PRODUCT_PRICES.pair = 39900`, одна покупка для обоих; прежнее право через `unlockedKinds(listOwnedProducts(...))`. Бесплатный доступ владельца, если выдан существующей системой, не переопределять.
- Не менять алгоритм индекса, реальные результаты, авторизацию, платёжный шлюз и продукт «Вдвоём».
- Максимум текста 600 Unicode code points. Сохранение — только явной кнопкой. Публикация отдельно от личного черновика.
- Ответ партнёра раскрывается только после публикации обоими; два подтверждения относятся к одной версии договора.
- Перед первым серверным сохранением личного текста необходимо отдельное согласие. Базовая купленная карта и PDF базовых разделов доступны без нового согласия.
- PDF: выделяемый текст, встроенная кириллица, реальные данные, нет скрытых ответов и личных черновиков. Раскрытые ответы включаются только по явному выбору скачивающего.
- Новые данные не отправляются ИИ, Метрике или внешнему PDF-сервису. Не применять фикстуры к production.
- Чужие локальные файлы не трогать; не использовать `git stash -u`. Не выполнять merge или deploy без отдельного допуска.

## Review Focus

1. Одновременная правка с другого устройства: вернуть 409 и сохранить ввод, не перезаписать новый текст незаметно — задачи 2–4.
2. Повторная отправка запроса после потери сети: не создать новую версию или второе подтверждение — задачи 2–4.
3. Отзыв своего ответа после раскрытия: закрыть чужой ответ в последующих HTML/API/PDF, сохранив данные его автора — задачи 2, 3, 5.
4. Unicode, переводы строк и длинная строка без пробелов: единый лимит на клиенте/сервере, без повреждения UTF-16 и обрезки страниц — задачи 1, 4, 5.
5. Выход из пары или потеря права во время PDF-генерации: повторная проверка перед выдачей файла, без кэша персонального ответа — задачи 3, 5.

## Workspace and delivery

Исполнение — в новой изолированной рабочей копии от актуального master с собственными зависимостями. Сначала проверить `list_artifacts`, затем создать через управляемый `create_worktree`, если нет подходящей рабочей копии. Если приложение не может создать рабочую копию исходного `C:/dev/grani-test`, сохранить отдельную ветку в исходном проекте, не трогая чужие файлы. Проверить происхождение и чистоту выбранного checkout. На подготовке не запускать pnpm через общий junction `node_modules`.

Скопировать утверждённый проект и этот план в `docs/superpowers/specs/2026-10-09-pair-map-stage-2-design.md` и `docs/superpowers/plans/2026-10-09-pair-map-stage-2.md` новой рабочей копии. Вести компактный журнал выполненных задач и проверок. В окончательный PR включать только файлы этой функции.

Все пути ниже относительны к новой рабочей копии репозитория. Номера миграции сверить с master на старте: при текущей основе следующий номер — 0013.

## Task 1: Проверить PDF-генератор в текущем runtime

**Files:**
- Modify: `apps/web/package.json`, корневой `package.json` (dev parser), `pnpm-lock.yaml`, `apps/web/next.config.ts` только при необходимости tracing/external package.
- Create: `apps/web/src/server/pair-pdf/render.tsx`, `apps/web/src/server/pair-pdf/render.test.ts`.
- Create: `apps/web/src/server/pair-pdf/testing.ts` — test-only `extractPdfText(buffer:Buffer):Promise<string>` через pdfjs `getDocument`/`getTextContent`, с очисткой parser после проверки; не импортируется продуктовым кодом.
- Create: `apps/web/assets/pdf/` — локальные шрифты с полной кириллицей и латиницей, лицензии и происхождение; изображения в совместимом формате из существующих иллюстраций/камней.

**Interfaces:** Produces `renderPairPdf(document: ReactElement<DocumentProps>): Promise<Buffer>`; генерация без HTTP-загрузки шрифтов и картинок. Этот внутренний renderer не открывает пользовательский маршрут.

- [ ] Написать `renders_cyrillic_selectable_pdf_without_external_requests`: `%PDF-`, положительное число страниц, извлекаемый текст `Карта вашей пары`, `Ёж`, `399 ₽` и данные обеих шкал; исходный минимум — RED до установки/реализации.
- [ ] Закрепить `@react-pdf/renderer@4.9.0` и test-only `pdfjs-dist@6.4.299`; добавить локальные полные шрифты с лицензиями. Существующие `assets/fonts` содержат отдельные Latin/Cyrillic WOFF-подмножества: не считать их одним полным шрифтом без проверки покрытия.
- [ ] Реализовать renderer. Шрифты и картинки читаются по безопасным абсолютным путям; учесть Windows и standalone tracing. Не повторять девелоперскую проблему `readFile(new URL(...))` генератора карточек.
- [ ] Проверить минимальный PDF на Node 24 и в standalone-сборке; извлечь текст и отрендерить страницу. Включить длинную кириллическую строку и переносы. До успеха не добавлять кнопку скачивания и обещания на сайте.
- [ ] Проверить типы и сохранить отдельный commit `feat(pdf): add local pair document renderer`.

## Task 2: Модель, хранение и транзакции общих данных

**Files:**
- Create: `packages/core/src/pair-map.ts`, `packages/core/src/pair-map.test.ts`; modify `packages/core/src/index.ts`.
- Create: `packages/db/src/pair-map-context.ts`, `packages/db/src/pair-map-survey.ts`, `packages/db/src/pair-map-agreements.ts`, `packages/db/src/pair-map.test.ts`.
- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`; generate `packages/db/drizzle/0013_pair_map_shared.sql` и соответствующие metadata.
- Modify/test: `packages/db/src/delete-user.test.ts`; менять `delete-user.ts` только если новые данные не удаляются существующим каскадом удаления результатов/пары.

**Core interfaces:**

`PairQuestionId = 'conflict' | 'home' | 'money' | 'social' | 'closeness' | 'support' | 'plans' | 'decisions'`.

`SurveyAnswer = { text: string; skipped: boolean }`; `SurveyAnswers = Record<PairQuestionId, SurveyAnswer>`; незаполненный черновик имеет пустой текст и `skipped:false`.

`PAIR_MAP_CONSENT_VERSION = '2026-10-09-v1'`, `PAIR_MAP_MAX_TEXT = 600`, каталог ровно восьми вопросов с существующими формулировками из `pair-guide.ts`, три исходные заготовки из `PairAgreements.tsx`.

`parseSurveyAnswers(raw: unknown, complete: boolean): SurveyAnswers | null`: ровно восемь известных ключей, правильные типы, нормализация CRLF/краевых пробелов, исключение иных управляющих символов; пропущенный ответ без текста; для отправки каждый ответ либо непустой, либо пропущен.

**DB interfaces:** Все функции принимают `db: Database` и `p: { pairId:string; userId:string; now:Date; ... }`. Общая обвязка `withPairMapContext` берёт строку активной пары `FOR UPDATE`, проверяет членство и право `pair`. Ни один write не принимает доверенный userId от клиента.

- `readPairMap(db, p): Promise<PairMapReadOutcome>` — безопасный снимок.
- `acceptPairMapConsent(db, p & { version:string }): Promise<PairMapWriteOutcome>`.
- `savePairSurvey(db, p & { answers:SurveyAnswers; expectedRevision:number; publish:boolean }): Promise<PairMapWriteOutcome>`.
- `deletePairSurvey(db, p & { expectedRevision:number }): Promise<PairMapWriteOutcome>`.
- `savePairAgreementDraft(db, p & { slot:0|1|2; text:string; expectedRevision:number }): Promise<PairMapWriteOutcome>`.
- `proposePairAgreement(db, p & { slot:0|1|2; text:string; expectedRevision:number }): Promise<PairMapWriteOutcome>`.
- `confirmPairAgreement(db, p & { slot:0|1|2; expectedRevision:number }): Promise<PairMapWriteOutcome>`.
- `retractPairAgreementConfirmation(db, p & { slot:0|1|2; expectedRevision:number }): Promise<PairMapWriteOutcome>`.

Outcome: `{ok:true, snapshot:PairMapSnapshot}` либо `{ok:false,error:'not_found'|'access_required'|'consent_required'|'invalid'|'stale_version'}`. Снимок ориентирован на зрителя: `consentRequired`, `mineSurvey` (draft, published, revision), `partnerSurvey` (только статус либо раскрытый published/revision), три sharedAgreement, три собственных drafts/revisions. Даты в API — ISO strings.

**Tables:** `pair_map_consents`, `pair_map_surveys`, `pair_map_agreements`, `pair_map_agreement_drafts`, `pair_map_agreement_confirmations`. FK пары с cascade; уникальность пары/автора либо пары/slot; диапазон slot 0–2; положительные опубликованные версии; пустой исходный ресурс имеет expectedRevision 0. Черновая и опубликованная ревизии опроса различаются, чтобы сохранение черновика не выглядело публикацией. Confirmation уникально на договорённость/участника и хранит revision. Новое предложение удаляет все confirmation этого ресурса. После удаления своих ответов текст и публикация очищаются, но монотонная revision строки сохраняется: старый запрос не должен удалить новый ответ после повторной отправки (защита от ABA).

- [ ] Написать RED-тесты парой через существующие `createTestDb`, `seedPair`: скрытый SECRET отсутствует у партнёра; оба публикуют — SECRET появляется; delete — снова отсутствует; свой draft никогда не попадает партнёру.
- [ ] Добавить RED-проверки unpaid/outsider/left/deleted/consent_required, 600 Unicode code points, 601 и неизвестные ключи; partial draft разрешён, partial submit отклонён.
- [ ] Добавить проверки предложения и двух подтверждений revision 1; правка создаёт revision 2 и 0 подтверждений; старое подтверждение возвращает `stale_version`; отзыв только своего; одинаковые повторные действия идемпотентны. После delete/re-submit старый delete получает `stale_version` и не стирает новый ответ.
- [ ] Реализовать таблицы, миграцию, validators и транзакции. Проверить `expectedRevision` до изменения; повторный save/propose с совпадающим уже сохранённым payload даёт тот же результат, не сбрасывая актуальные подтверждения. Confirm/retract всегда относятся к точной текущей revision; повтор такого действия не меняет дату и число подтверждений. Снимок строится внутри согласованного транзакционного чтения.
- [ ] Параллельные отдельные соединения реального локального PostgreSQL: два противоречащих предложения одной revision — ровно одно принимается, второе получает конфликт. PGlite-тесты не считать доказательством реальной конкуренции соединений.
- [ ] `deleteUserData` удаляет новую пару и общие записи каскадом через результаты, платежи сохраняет. Проверить это запросами всех новых таблиц.
- [ ] GREEN: `pnpm exec vitest run packages/core/src/pair-map.test.ts packages/db/src/pair-map.test.ts packages/db/src/delete-user.test.ts`; typecheck; commit `feat(db): persist private pair answers and versioned agreements`.

## Task 3: Защищённый API и серверный снимок

**Files:**
- Create: `apps/web/src/server/pair-map-route.ts`, `apps/web/src/server/pair-map-service.ts`, их `.test.ts`.
- Create: `apps/web/src/app/api/pairs/[id]/map/route.ts`.
- Modify: `apps/web/src/server/rate-limit.ts` — отдельные лимиты 30 запросов чтения/изменения в минуту и 3 PDF в минуту.
- Modify: `apps/web/src/app/pair/[id]/page.tsx`, `PairReport.tsx` — viewerId передаётся с серверной сессии, общие данные загружаются только в купленной ветке.

**Interfaces:**

GET `/api/pairs/:id/map` возвращает `{ok:true,snapshot}`. POST принимает дискриминированный `PairMapCommand` с `kind`: `consent`, `survey_draft`, `survey_submit`, `survey_delete`, `agreement_draft`, `agreement_propose`, `agreement_confirm`, `agreement_retract`. Text/answers/slot/expectedRevision/version проверяются по выбранному kind; непредусмотренные keys отклоняются. Выдача `{ok:true,snapshot}` либо безопасной ошибки.

`authorizePairMap(request, options): Promise<{user:UserRecord; db:Database; now:()=>Date} | NextResponse>` использует существующие `loginDeps`, `getCurrentUser`, `SESSION_COOKIE`, `isSameOrigin`, лимиты. Сервис повторно использует DB-проверку конкретной пары и покупки, не доверяет только route guard.

Коды: нет сессии 401; чужая/закрытая/некорректная пара 404; активный член без покупки 403; bad_origin 403; неверное тело 400; stale_version/consent_required 409; лимит 429. Все персональные ответы, включая ошибки, `Cache-Control: private, no-store`.

- [ ] RED: подделанный userId/посторонний Origin не изменяет БД; body больше 64 KiB даёт 413 до JSON parsing; недействительная сессия 401, лимит 429. Задать ограничение потока, а не только проверять Content-Length.
- [ ] RED: JSON/SSR партнёра не содержит скрытый SECRET; unpaid ветка не содержит опрос/черновики; запрос после leave или refunded без другого действующего права закрыт.
- [ ] Реализовать GET/POST, строгий parser команд и mapped errors. Использовать Promise params текущего Next.js. Не выводить personal payload в журнал ошибок.
- [ ] GREEN: сервисы/route tests плюс прежние `pair-payment-access.test.ts`, `pairs-service.test.ts`, `pair-entitlement.test.ts`; typecheck; commit `feat(web): protect shared pair map API`.

## Task 4: Опрос, договорённости и согласие в интерфейсе

**Files:**
- Create: `apps/web/src/app/pair/[id]/PairSurvey.tsx`, `PairSharedState.tsx`, `PairMapConsent.tsx`.
- Modify: `PairGuide.tsx`, `PairAgreements.tsx`, `PairReport.tsx`, `pair-map.module.css`, `apps/web/src/lib/pair-guide.ts` для общего каталога вопросов.
- Create: `apps/web/src/lib/pair-map-client.ts`, `.test.ts` для безопасной обработки ответов/конфликтов.
- Modify: `apps/web/src/app/privacy/page.tsx`; create `apps/web/src/app/consent/pair-map/page.tsx` с отдельным текстом согласия и metadata. Точечные дополнения без изменения прочих условий.
- Create: `e2e/pair-map-shared.spec.ts`; обновить устаревшие assertions `e2e/pair-map.spec.ts`.

**Interfaces:** `PairSharedState({pairId,initialSnapshot,storageKey,children})` — единственный владелец клиентского снимка и requests. Компоненты получают typed snapshot/dispatch; локальный несохранённый ввод живёт отдельно и не затирается server refresh. Ошибки 409 показывают новое состояние, сохраняя локальный текст. После выхода/потери доступа очищается отображение общих данных.

- [ ] RED: два browser context настоящей локальной сессии. A сохраняет личный draft; B получает только статус. A публикует, B публикует — оба видят ответы. Проверить skip и новую публикацию поверх отдельного draft.
- [ ] RED: оба подтверждают, A правит, B со старой формой не подтверждает незнакомый текст; B обновляет и подтверждает текущую версию. Повтор запроса и сетевой сбой не портят состояния.
- [ ] Реализовать формы с явными Save/Submit/Propose/Confirm/Retract, контролами skip, счётчиками 600 code points и aria-live статусов. Согласие до первого server save; без согласия читать базовую карту можно.
- [ ] Существующие sessionStorage drafts читать по прежнему pair/viewer key; показывать явный перенос в личные server drafts. Не загружать автоматически и не удалять браузерный оригинал до успешного переноса.
- [ ] При focus и явном Update читать GET; пока ждём партнёра — 20 секунд только при видимой вкладке. Обновление не меняет dirty поля. Один запрос в процессе, не собирать наложенные poll.
- [ ] Дополнить privacy, согласие и тексты о хранении/раскрытии/удалении. Согласие не предвыбрано. Не обещать PDF до следующей задачи.
- [ ] GREEN browser cases; проверить keyboard, длинные имена, 320/390/768/1024/1440 без горизонтального переполнения; commit `feat(web): add mutual pair answers and agreement confirmations`.

## Task 5: Полный персональный PDF и рабочее скачивание

**Files:**
- Create: `apps/web/src/server/pair-pdf/source.ts`, `document.tsx`, `source.test.ts`, `document.test.ts`.
- Create: `apps/web/src/app/api/pairs/[id]/map/pdf/route.ts`, `apps/web/src/server/pair-pdf-route.test.ts`.
- Create: `apps/web/src/app/pair/[id]/PairPdfDownload.tsx`; modify `PairGuide.tsx`, `PairReport.tsx`, `apps/web/src/app/compatibility/page.tsx`.
- Create: `e2e/pair-map-pdf.spec.ts`.

**Interfaces:** `loadPairPdfSource(db,p:{pairId:string;userId:string;includeAnswers:boolean;now:Date}): Promise<PairPdfSource | PairMapFailure>` проверяет участие/покупку, строит реальные `PairView`, оба `buildPairGuide` и безопасный shared snapshot, читает готовые extras через существующий parser. `PairPdfSource` содержит `view:PairView`, `generatedAt:string`, `guides` обеих перспектив, `confirmedAgreements` (slot/text/revision), `sharedAnswers` (null либо опубликованные ответы обоих), `extras` (state/sections) и `sharedRevisionToken` текущих включённых публикаций/подтверждений. `buildPairPdfDocument(source): ReactElement<DocumentProps>` использует renderer задачи 1. `assertPairPdfSnapshotCurrent(db,p,source):Promise<PairMapFailure|null>` проверяет текущий доступ и неизменность включённых общих данных перед выдачей.

GET `/api/pairs/:id/map/pdf?includeAnswers=1` — только `1` включает опубликованные взаимно раскрытые ответы. Без этого параметра ответы отсутствуют. Изменения perspective UI не влияют на объективные шкалы источника. Личные черновики и договорённости без двух текущих confirmation не включаются.

- [ ] RED: PDF содержит обе реальные шкалы, восемь ситуаций, методику, translator, четыре шага разговора. SECRET не попадает без флага/до публикации обоими/после delete; появляется только при разрешённом includeAnswers.
- [ ] RED: без опроса, подтверждённых договорённостей или готового extras документ доступен с честными статусами; extras включаются после readiness, а не блокируют скачивание.
- [ ] Сделать изумрудную обложку с реальными камнями; светлые основные страницы, настоящие шкалы, переносы и номера страниц. Имя файла `grani-pair-map.pdf`. Проверить кириллицу, специальные символы, длинные слова и длины до лимита.
- [ ] Route — Node runtime, no-store и noindex; перед отдачей повторить проверку активной пары/entitlement и sharedRevisionToken включённых данных. Если во время генерации удалили ответ, отозвали подтверждение или изменили общую версию, документ не отдаётся: 409 с возможностью повторить. Проверить это задержанным renderer в route test. Ошибка генерации 500 без содержимого PDF/ответов в журнале; разумный лимит генерации 3/minute.
- [ ] Кнопка делает fetch, проверяет HTTP status и `application/pdf`, затем скачивает Blob и освобождает object URL. При JSON error показать сообщение, не сохранять его как `.pdf`. IncludeAnswers по умолчанию unchecked. Рядом сообщить: сохранённую копию файла выход из пары не удаляет.
- [ ] После доказанного скачивания убрать уведомления «PDF/опрос/подтверждение недоступны» и обновить публичное предложение точными реализованными функциями.
- [ ] GREEN: source/route/document tests и browser download. Открыть PDF, извлечь текст, отрендерить и проверить каждую страницу нескольких граничных фикстур. Проверить payload и headers, не только `%PDF-`. Commit `feat(pdf): export complete paid pair map`.

## Final verification and review

- [ ] Миграция с актуального master на изолированном PostgreSQL; проверить существующие пары, покупки и результаты после неё.
- [ ] `pnpm typecheck`, `pnpm test:coverage`, `pnpm --filter @grani/web build`; проверить финальный точный commit.
- [ ] Production standalone: новые shared/PDF E2E, существующие pair flow и unpaid state, fake/dev endpoints 404. Dev checkout — только в изолированной dev среде; реальных списаний нет.
- [ ] Новые состояния на пяти ширинах, клавиатура, reload, иной автор, конфликт revision, необходимое/отклонённое согласие, потеря сети. Снимки и PDF с синтетическими фикстурами явно обозначить локальными.
- [ ] Независимое ревью всей ветки с акцентом на скрытые данные, доступ, конкуренцию и новый PDF. Исправить существенные замечания с воспроизводящими тестами.
- [ ] Сохранить QA-отчёт и PDF-пример в `outputs/stage-2/`, создать draft PR, проверить CI. Текущий первый этап на сайте не меняется до отдельного разрешения на публикацию второго.

## Execution method recommendation

Рекомендуется **Native / один исполнитель в текущем чате**: API, snapshot, client и PDF тесно связаны типами. Это экономит повторное чтение контекста; независимый reviewer проверяет всю готовую ветку в конце.

Альтернатива — **Subagent-driven / агенты по задачам**: отдельный исполнитель и ревью на каждую задачу, больше независимых проверок и больший расход контекста.

Технический план составлен по уже утверждённому проекту. Перед исполнением требуется выбор метода и просмотр этого плана по `superpowers:writing-plans`; отдельного повторного согласования продуктовой идеи не требуется.
