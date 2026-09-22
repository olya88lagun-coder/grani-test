"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  consent_required: "Отметьте согласие — без него пара не создаётся.",
  no_result: "Сначала пройдите тест: для пары нужен ваш результат.",
  already_used: "По этой ссылке пара уже создана. Попросите новую ссылку.",
  already_paired: "Вы уже в паре с этим человеком.",
  own_invite: "Это ваша собственная ссылка.",
  not_found: "Ссылка не работает. Попросите прислать её ещё раз.",
};
const FALLBACK = "Не получилось создать пару. Проверьте интернет и попробуйте ещё раз.";

export function AcceptPairForm({ token, consentLabel }: { token: string; consentLabel: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/pairs/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, consent }) });
      const body = (await response.json()) as { ok: boolean; redirect?: string; error?: string };
      if (body.ok && body.redirect) {
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
        <span>{consentLabel}</span>
      </label>
      <button type="button" className="button button--block" disabled={!consent || sending} onClick={accept}>
        {sending ? "Создаём пару…" : "Узнать совместимость"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
