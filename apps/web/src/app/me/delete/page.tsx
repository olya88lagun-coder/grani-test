import type { Metadata } from "next";
import Link from "next/link";
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
            <li>вход через VK ID.</li>
          </ul>
          <p className="muted">
            Останется только запись об оплате — услуга, сумма и дата, без ответов теста. Её нужно хранить для налогового учёта.
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
