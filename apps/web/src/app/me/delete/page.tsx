import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/legal";
import { requireUser } from "@/server/viewer";
import { DeleteForm } from "./DeleteForm";

export const metadata: Metadata = { title: "Удалить мои данные" };

export default async function DeleteDataPage() {
  await requireUser();
  return (
    <main className="page inner-text">
      <div className="stack">
        <h1 className="display">Удалить мои данные</h1>
        <section className="card stack">
          <h2>Что удалится</h2>
          <ul>
            <li>результаты теста и ответы друзей о вас;</li>
            <li>разборы, в том числе купленные;</li>
            <li>пара и разбор пары — у вас и у партнёра;</li>
            <li>пространство «Вдвоём»: оно закроется для обоих, ваши ответы, отметки и записка в приглашении сотрутся;</li>
            <li>вход через VK ID.</li>
          </ul>
          <p>
            Купленные разборы удалятся вместе с данными. Деньги за уже открытые разборы не возвращаются, за неоткрытые возвращаются полностью: чтобы получить их, напишите
            на {OPERATOR.email} до удаления. Условия — в <Link href="/offer">оферте</Link>.
          </p>
          <p className="muted">
            Останется только запись об оплате — услуга, сумма и дата, без ответов теста. Она хранится 3 года после оплаты для рассмотрения претензий и подтверждения дохода.
          </p>
        </section>
        <DeleteForm />
        <p>
          <Link href="/me">Передумали — вернуться к результату</Link>
        </p>
      </div>
    </main>
  );
}
