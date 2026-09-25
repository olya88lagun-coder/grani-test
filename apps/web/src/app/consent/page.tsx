import type { Metadata } from "next";
import Link from "next/link";
import { DATA_STORAGE, LEGAL_DATE, LOGIN_CONSENT_RECIPIENTS, OPERATOR } from "@/lib/legal";
import { publicMetadata } from "@/lib/seo";
import { CONSENT_VERSION } from "@/server/login-service";

export const metadata: Metadata = publicMetadata({
  title: "Согласие на обработку персональных данных",
  description: "Текст согласия на обработку персональных данных, которое даётся при входе на сайт «Грани».",
  path: "/consent",
});

export default function ConsentPage() {
  return (
    <main className="page inner-text">
      <article className="stack">
        <h1 className="display">Согласие на обработку персональных данных</h1>
        <p className="muted">
          Редакция {CONSENT_VERSION} от {LEGAL_DATE}
        </p>
        <p>
          Отмечая согласие на сайте grani-test.ru, я свободно, своей волей и в своём интересе даю {OPERATOR.name} (ИНН {OPERATOR.inn}, далее —
          оператор) согласие на обработку моих персональных данных на условиях ниже и{" "}
          <Link href="/privacy">политики обработки персональных данных</Link>.
        </p>
        <h2>Какие данные</h2>
        <p>
          Идентификатор и имя в VK ID; пол, если его передаёт VK ID; ответы на вопросы теста и рассчитанный по ним результат;
          ответы друзей обо мне; данные пары, если я её создам; сведения о покупках; разрешение на уведомления; дата и время согласия.
        </p>
        <h2>Зачем</h2>
        <p>
          Чтобы входить на сайт, сохранять и показывать мне результаты теста, собирать ответы друзей, показывать совместимость пары, готовить
          платные разборы и присылать уведомления.
        </p>
        <h2>Что с ними делают</h2>
        <p>
          Сбор, запись, систематизация, хранение, уточнение, использование, передача, удаление. Данные хранятся {DATA_STORAGE}. Для работы
          сайта данные передаются:
        </p>
        <ul>
          {LOGIN_CONSENT_RECIPIENTS.map((recipient) => (
            <li key={recipient.name}>
              {recipient.name} — {recipient.what}; {recipient.why}.
            </li>
          ))}
        </ul>
        <p>Другим лицам данные не передаются, кроме случаев, предусмотренных законом. На Яндекс.Метрику согласие даётся отдельно — в баннере cookie.</p>
        <h2>Срок и отзыв</h2>
        <p>
          Согласие действует до отзыва. Отозвать его и удалить данные можно кнопкой на странице <Link href="/me/delete">«Удалить мои данные»</Link>{" "}
          или письмом на <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> — по письму данные удаляются в течение 30 дней. Записи об
          оплатах без ответов теста хранятся 5 лет для налогового учёта.
        </p>
        <p className="muted">
          Результаты теста описывают черты личности по модели «Большая пятёрка» и не являются медицинским или психологическим диагнозом.
        </p>
      </article>
    </main>
  );
}
