# Задача 1 — Подвал, «Контакты и услуги», политика, согласие v2, оферта v2

**Files:**
- Modify: `apps/web/src/lib/legal.ts`
- Create: `apps/web/src/lib/legal.test.ts`
- Create: `apps/web/src/components/Footer.tsx`
- Modify: `apps/web/src/app/layout.tsx` (подвал на всех страницах)
- Modify: `apps/web/src/app/page.tsx` (убрать собственный `<footer>`)
- Create: `apps/web/src/app/contacts/page.tsx`
- Create: `apps/web/src/app/privacy/page.tsx`
- Modify: `apps/web/src/app/consent/page.tsx`
- Modify: `apps/web/src/app/offer/page.tsx`
- Modify: `apps/web/src/server/login-service.ts` (`CONSENT_VERSION = "2026-09-v2"`)
- Modify: `apps/web/src/app/login/LoginPanel.tsx` (ссылка на политику рядом с галочкой согласия)
- Modify: `apps/web/src/app/result/[id]/page.tsx` (дисклеймер)

**Interfaces:**
- Produces: `OPERATOR` с полем `inn`; `LEGAL_VERSIONS = { consent: "2026-09-v2", privacy: "2026-09-v1", offer: "2026-09-v2" }`; `DATA_RECIPIENTS` — список получателей данных (одно место для политики и согласия); компонент `Footer` со ссылками и кнопкой «Настройки cookie» (кнопка появляется в задаче 5 — здесь сразу оставить для неё место `id="cookie-settings"`).
- `CONSENT_VERSION` в `login-service.ts` берётся из `LEGAL_VERSIONS.consent`, `OFFER_VERSION` — из `LEGAL_VERSIONS.offer`.

## Зачем

Спецификация 6: политика обработки ПДн и отдельное согласие, оферта, контакты и описание услуг на сайте (требование ЮKassa: без этой страницы магазин не пройдёт модерацию). В плане 5 оферта и согласие — рабочие редакции. Согласие v1 обещает, что «третьим лицам данные не передаются», хотя данные получают ЮKassa, сервис ИИ, Telegram, ВКонтакте и Метрика. Новая редакция должна это исправить.

Правило для текстов: коротко, простыми словами, без выдуманных фактов. Юридическая точность важнее красоты. Всё, что пользователь может проверить (ИНН, почта, адрес хранения), берётся из `legal.ts`.

## Шаги

- [ ] **Шаг 1. Получить ИНН.** Спросить у пользователя ИНН самозанятой (12 цифр). Пока ИНН нет, не коммитить `contacts/page.tsx`: остальные шаги можно делать.

- [ ] **Шаг 2. Тест `legal.test.ts` (RED).**

```ts
import { describe, expect, it } from "vitest";
import { DATA_RECIPIENTS, LEGAL_VERSIONS, OPERATOR } from "./legal";

describe("legal", () => {
  it("has a 12-digit INN of the self-employed operator", () => {
    expect(OPERATOR.inn).toMatch(/^\d{12}$/);
  });

  it("names every service that receives personal data", () => {
    const names = DATA_RECIPIENTS.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["ЮKassa", "Telegram", "ВКонтакте", "Яндекс.Метрика"]));
    expect(names.some((n) => n.includes("YandexGPT") || n.includes("GigaChat"))).toBe(true);
  });

  it("uses the new document versions", () => {
    expect(LEGAL_VERSIONS).toEqual({ consent: "2026-09-v2", privacy: "2026-09-v1", offer: "2026-09-v2" });
  });
});
```

Запуск: `pnpm vitest run apps/web/src/lib/legal.test.ts`. Ожидается FAIL: нет `inn`, `DATA_RECIPIENTS`, `LEGAL_VERSIONS`.

- [ ] **Шаг 3. `legal.ts`.**

```ts
// Оператор персональных данных — самозанятая, указана так же, как в «Мой налог»
export const OPERATOR = { name: "Лагутенкова Ольга Валентиновна", inn: "<ИНН от пользователя>", email: "lagutenkova.olga@yandex.ru" } as const;

export const LEGAL_VERSIONS = { consent: "2026-09-v2", privacy: "2026-09-v1", offer: "2026-09-v2" } as const;
export const OFFER_VERSION = LEGAL_VERSIONS.offer;

export const DATA_STORAGE = "на сервере в Москве (Timeweb Cloud)";

export type DataRecipient = { name: string; what: string; why: string };

// Кому и что уходит. Политика и согласие читают один список, чтобы они не расходились
export const DATA_RECIPIENTS: readonly DataRecipient[] = [
  { name: "ЮKassa", what: "сумма и назначение платежа; данные карты вводятся на стороне ЮKassa и сайту не передаются", why: "приём оплаты и отправка чека" },
  { name: "YandexGPT или GigaChat", what: "баллы по пяти чертам, их уровни и выбранные тексты — без имени, пола и идентификаторов", why: "подготовка текста платного разбора" },
  { name: "Telegram", what: "текст уведомления", why: "уведомления о друзьях, паре и готовом разборе, если вы разрешили сообщения" },
  { name: "ВКонтакте", what: "текст уведомления", why: "уведомления через сообщения сообщества, если вы разрешили сообщения" },
  { name: "Яндекс.Метрика", what: "обезличенные данные о посещении (cookie, страницы, устройство)", why: "статистика посещений — только если вы приняли cookie" },
];
```

Вписать настоящий ИНН, полученный на шаге 1. Прогнать тест: PASS.

- [ ] **Шаг 4. `Footer.tsx` и подключение в `layout.tsx`.** Серверный компонент, стили — существующий класс `.footer`.

```tsx
import Link from "next/link";

const LINKS = [
  { href: "/types", label: "Типы личности" },
  { href: "/articles", label: "Статьи" },
  { href: "/contacts", label: "Контакты и услуги" },
  { href: "/offer", label: "Оферта" },
  { href: "/privacy", label: "Политика обработки данных" },
  { href: "/consent", label: "Согласие" },
  { href: "/me", label: "Мой результат" },
] as const;

export function Footer() {
  return (
    <footer className="footer page">
      <nav aria-label="Документы и разделы">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
```

`/types` и `/articles` появятся в задачах 3 и 4. Пока их нет, ссылки ведут на 404, но PR выходит целиком, так что это не страшно. В `layout.tsx` после `{children}` вставить `<Footer />`. Из `page.tsx` удалить блок `<footer className="footer">…</footer>`. Проверить `.footer`: у `a` есть `margin-right`, поэтому на 375px ссылки переносятся строками. Если переносятся плохо, добавить `.footer nav { display: flex; flex-wrap: wrap; gap: 8px 21px }` и убрать `margin-right`.

- [ ] **Шаг 5. `/contacts`.**

```tsx
import { formatRub, PRODUCT_PRICES, type Product } from "@grani/core";
import type { Metadata } from "next";
import { OPERATOR } from "@/lib/legal";
import { PRODUCT_DESCRIPTIONS } from "@/server/payments-service";

export const metadata: Metadata = { title: "Контакты и услуги" };
const PRODUCTS = Object.keys(PRODUCT_PRICES) as Product[];

export default function ContactsPage() {
  return (
    <main className="page">
      <article className="stack">
        <h1 className="display">Контакты и услуги</h1>
        <h2>Исполнитель</h2>
        <p>{OPERATOR.name}, самозанятая (плательщик налога на профессиональный доход). ИНН {OPERATOR.inn}.</p>
        <p>
          Почта: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Отвечаем в течение двух рабочих дней.
        </p>
        <h2>Что это за сайт</h2>
        <p>
          «Грани» — бесплатный тест личности по модели «Большая пятёрка»: 50 утверждений, один из 16 типов, пять шкал и анкета для друзей
          «Как меня видят другие». Платно — подробные текстовые разборы по результату теста. Они открываются на сайте сразу после оплаты.
        </p>
        <h2>Платные услуги</h2>
        <ul>
          {PRODUCTS.map((product) => (
            <li key={product}>
              {PRODUCT_DESCRIPTIONS[product]} — {formatRub(PRODUCT_PRICES[product])}
            </li>
          ))}
        </ul>
        <p>
          Оплата картой через ЮKassa, чек приходит из «Мой налог». Условия, возвраты и порядок оказания — в <a href="/offer">оферте</a>.
        </p>
      </article>
    </main>
  );
}
```

- [ ] **Шаг 6. `/privacy` — политика обработки ПДн.** Страница рендерит разделы с данными из `legal.ts`. Обязательные разделы (152-ФЗ, ст. 18.1):
  1. Оператор: ФИО, ИНН, почта.
  2. Какие данные: идентификатор и имя в Telegram или VK ID; пол, если его передаёт VK ID; ответы теста и результат; ответы друзей (без имён друзей, обезличенно по cookie-метке); данные пары; покупки (продукт, сумма, дата, статус); cookie Метрики — только с согласия.
  3. Цели: вход и хранение результата; анкета друзей и пара; платные разборы; уведомления; учёт оплат для налога; статистика посещений (с согласия).
  4. Правовые основания: согласие (ст. 6 ч. 1 п. 1); исполнение договора-оферты (п. 5) — для покупок; налоговый учёт — обязанность по закону (п. 2).
  5. Действия с данными и хранение: сбор, запись, хранение, использование, передача получателям из `DATA_RECIPIENTS`, удаление. Хранение — `DATA_STORAGE`, в России.
  6. Получатели: таблица из `DATA_RECIPIENTS` (кто, что, зачем).
  7. Сроки: до удаления аккаунта или отзыва согласия. Записи об оплатах без ответов теста хранятся 5 лет (налоговый учёт).
  8. Права: узнать, исправить, удалить. Удаление — кнопка «Удалить мои данные» на странице `/me/delete` (задача 2) или письмо на почту, срок — 30 дней. Отзыв согласия — теми же способами.
  9. Cookie: сессия и технические cookie нужны для входа; cookie Метрики — только после «Принять». Выбор меняется ссылкой «Настройки cookie» в подвале.
  10. Защита: HTTPS, доступ к серверу только у оператора, секреты не хранятся в коде.
  11. Редакция `LEGAL_VERSIONS.privacy` и дата.

- [ ] **Шаг 7. Согласие v2.** В `consent/page.tsx`:
  - в «Какие данные» добавить данные пары и покупок;
  - в «Зачем» — анкету друзей, пару, платные разборы и уведомления;
  - раздел «Что с ними делают» переписать: кому передаются данные — список из `DATA_RECIPIENTS` без Метрики (на неё отдельное согласие в баннере); хранение — `DATA_STORAGE`;
  - в «Срок и отзыв» добавить кнопку удаления `/me/delete` рядом с письмом;
  - дать ссылку на `/privacy`.

  Редакция — `LEGAL_VERSIONS.consent`. В `login-service.ts`: `export const CONSENT_VERSION = LEGAL_VERSIONS.consent;`, импорт из `@/lib/legal`. Существующий тест `login-service.test.ts` сверяет версию через константу. Если он сверяет строку `"2026-09-v1"`, заменить её на `CONSENT_VERSION`.

- [ ] **Шаг 8. Оферта v2.** В `offer/page.tsx`:
  - в «Исполнитель» добавить ИНН;
  - в «Данные для подготовки материалов» назвать сервисы (YandexGPT или GigaChat) и дать ссылку на политику;
  - добавить раздел «Акцепт»: оплата — полное и безоговорочное принятие оферты;
  - добавить раздел «Претензии»: на почту, ответ в течение 10 рабочих дней;
  - в «Возвраты» добавить срок: до 10 рабочих дней на ту же карту;
  - оставить дисклеймер.

- [ ] **Шаг 9. Ссылка на политику при входе.** В `LoginPanel.tsx` у галочки согласия уже есть ссылка «на обработку персональных данных» → `/consent`. Добавить после неё « в соответствии с <a href="/privacy">политикой</a>».

- [ ] **Шаг 9а. Дисклеймер на результате.** Спецификация 6 требует его на результатах, разборах и в оферте; на странице результата его пока нет. Внизу `result/[id]/page.tsx` — `<p className="muted">{REPORT_DISCLAIMER}</p>` (из `@/lib/report-view`).

- [ ] **Шаг 10. Проверка.** `pnpm typecheck`, `pnpm vitest run apps/web`. Открыть в превью `/contacts`, `/privacy`, `/consent`, `/offer` на 375px и на десктопе: текст читается, подвал на всех страницах, включая `/result/<id>`. Сделать скриншот `/contacts`.

- [ ] **Шаг 11. Коммит.**

```bash
git add apps/web/src/lib/legal.ts apps/web/src/lib/legal.test.ts apps/web/src/components/Footer.tsx apps/web/src/app/layout.tsx apps/web/src/app/page.tsx apps/web/src/app/contacts apps/web/src/app/privacy apps/web/src/app/consent apps/web/src/app/offer apps/web/src/server/login-service.ts apps/web/src/app/login/LoginPanel.tsx apps/web/src/app/globals.css
git commit -m "feat(legal): privacy policy, contacts page, consent and offer v2, shared footer"
```
