import { FUNNEL_STEPS, type FunnelStep } from "@grani/core";
import { listFunnelDays } from "@grani/db";
import type { Metadata } from "next";
import { getDb } from "@/server/db";
import { requireOwner } from "@/server/owner";
import { OwnerDeviceMark } from "../receipts/OwnerDeviceMark";

export const metadata: Metadata = { title: "Воронка входа", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAYS = 30;
const STEP_LABELS: Readonly<Record<FunnelStep, string>> = {
  test_start: "Начали тест",
  test_finish: "Закончили тест",
  login_consent: "Поставили согласие",
  login_start: "Нажали VK ID",
  login: "Вошли",
};

export default async function FunnelPage() {
  await requireOwner();
  const days = await listFunnelDays(getDb(), new Date(Date.now() - (DAYS - 1) * 86_400_000));
  const total = Object.fromEntries(FUNNEL_STEPS.map((step) => [step, days.reduce((sum, day) => sum + day[step], 0)])) as Record<FunnelStep, number>;
  // Доля от закончивших тест: именно они упираются во вход
  const share = (step: FunnelStep) => (total.test_finish ? `${Math.round((total[step] * 100) / total.test_finish)}%` : "—");

  return (
    <main className="inner-page">
      <article className="page stack">
        <header className="stack">
          <h1 className="display">Воронка входа</h1>
          <p className="lead">Последние {DAYS} дней по Москве. Считаются все посетители, не только принявшие cookie; ничего, кроме числа за день, не хранится.</p>
          <OwnerDeviceMark />
        </header>
        <table className="funnel-table">
          <thead>
            <tr><th>Шаг</th><th>Всего</th><th>От закончивших</th></tr>
          </thead>
          <tbody>
            {FUNNEL_STEPS.map((step) => (
              <tr key={step}><td>{STEP_LABELS[step]}</td><td>{total[step]}</td><td>{step === "test_start" ? "" : share(step)}</td></tr>
            ))}
          </tbody>
        </table>
        {days.length > 0 && (
          <table className="funnel-table">
            <thead>
              <tr><th>День</th>{FUNNEL_STEPS.map((step) => <th key={step}>{STEP_LABELS[step]}</th>)}</tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day}><td>{day.day}</td>{FUNNEL_STEPS.map((step) => <td key={step}>{day[step]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </main>
  );
}
