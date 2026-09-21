import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Спасибо" };

export default function FriendDonePage() {
  return (
    <main className="page stack" data-palette="friends">
      <p className="eyebrow">Ответы переданы анонимно</p>
      <h1 className="display">Спасибо! А какой тип у тебя?</h1>
      <p className="lead">50 коротких утверждений, 10 минут — и ты узнаешь свой тип и пять шкал личности.</p>
      <div>
        <Link className="button button--lg" href="/test">
          Пройти тест <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
