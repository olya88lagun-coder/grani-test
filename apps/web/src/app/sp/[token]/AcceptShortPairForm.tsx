"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reachGoal } from "@/lib/analytics";

const ERRORS: Record<string, string> = {
  consent_required: "Отметьте согласие — без него общая карта не создаётся.",
  no_result: "Сначала пройдите тест: для карты нужен ваш результат.",
  already_used: "По этой ссылке пара уже создана. Попросите новую ссылку.",
  already_paired: "Вы уже в паре с этим человеком по этому тесту.",
  own_invite: "Это ваша собственная ссылка.",
  not_found: "Ссылка не работает. Попросите прислать её ещё раз.",
  wrong_test: "Ссылка от другого теста. Попросите прислать её ещё раз.",
};
const FALLBACK = "Не получилось создать пару. Проверьте интернет и попробуйте ещё раз.";

export function AcceptShortPairForm({ token, inviterFirstName }: { token: string; inviterFirstName: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/short-pairs/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, consent }) });
      const body = (await response.json()) as { ok: boolean; redirect?: string; error?: string };
      if (body.ok && body.redirect) {
        reachGoal("attachment_pair");
        router.push(body.redirect);
        return;
      }
      setError(ERRORS[body.error ?? ""] ?? FALLBACK);
    } catch {
      setError(FALLBACK);
    }
    setSending(false);
  }

  return (
    <div className="stack">
      <label className="choice">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        {/* Текст согласия связан с SHORT_PAIR_CONSENT_VERSION: при изменении формулировки поднять версию */}
        <span>{inviterFirstName} и я увидим типы привязанности и баллы друг друга на общей карте</span>
      </label>
      <button type="button" className="button button--block" disabled={!consent || sending} onClick={accept}>
        {sending ? "Создаём карту…" : "Открыть общую карту"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
