"use client";

import Link from "next/link";
import { useState } from "react";
import { startErrorMessage } from "@/lib/together-view";
import { callApi, readSpace } from "./client";
import { ConsentCheckbox } from "./ConsentCheckbox";

type Phase = "idle" | "sending" | "requested";

const REFUSALS: Readonly<Record<string, string>> = {
  invalid: "Эта ссылка сейчас недоступна. Попросите партнёра отправить новое приглашение.",
  own_invite: "Это ваша собственная ссылка. Отправьте её партнёру.",
  already_in_space: "У вас уже есть своё пространство. Сначала откройте его.",
};

export function InviteJoin({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  async function sendRequest() {
    setPhase("sending");
    setError(null);
    const result = await callApi("/api/together/invite/request", { body: { token, consent } });
    if (result.status === 401) {
      window.location.href = `/api/together/enter?next=invite&token=${encodeURIComponent(token)}`;
      return;
    }
    if (result.ok) {
      setPhase("requested");
      return;
    }
    setPhase("idle");
    setError(REFUSALS[result.body.error ?? ""] ?? startErrorMessage(result.body.error ?? "").text);
  }

  async function checkConfirmation() {
    setMessage(null);
    const result = await readSpace();
    if (result.ok && result.space) {
      window.location.href = "/together";
      return;
    }
    setMessage(result.ok ? "Подтверждения пока нет. Инициатор увидит ваш запрос, когда зайдёт." : "Не получилось обновить данные. Проверьте соединение и повторите.");
  }

  if (phase === "requested") {
    return (
      <section className="card stack together-flow-card">
        <h1 className="display">Осталось подтверждение</h1>
        <p className="lead">Вы отправили запрос. Инициатор увидит ваше имя и подтвердит, что приглашение предназначено вам.</p>
        <p className="muted">Можно закрыть страницу и вернуться по этой же ссылке. Уведомления пока не подключены, поэтому написать партнёру лучше самим.</p>
        <button type="button" className="button button--block" onClick={checkConfirmation}>Проверить подтверждение</button>
        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="card stack together-flow-card">
      <h1 className="display">Время для вас двоих</h1>
      <p className="lead">Вас пригласили создать общее пространство. После запроса инициатор проверит ваше имя и подтвердит участие.</p>
      <ConsentCheckbox id="invite-consent" checked={consent} onChange={setConsent} />
      <button type="button" className="button button--block" disabled={phase === "sending" || !consent} onClick={sendRequest}>
        {phase === "sending" ? "Отправляем запрос…" : "Отправить запрос на участие"}
      </button>
      <p className="muted">До подтверждения вы не получаете доступа к общим материалам. Личные данные пары по ссылке не раскрываются.</p>
      {error && (
        <p className="error" role="alert">
          {error} <Link href="/together">Открыть «Вдвоём»</Link>
        </p>
      )}
    </section>
  );
}
