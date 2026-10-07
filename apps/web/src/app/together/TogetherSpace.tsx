"use client";

import { formatRub, TOGETHER_INVITE_NOTE_MAX, TOGETHER_PRICE_KOPECKS } from "@grani/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatAccessUntil,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  purchaseOutcome,
  spaceScreen,
  startErrorMessage,
  type PurchaseSnapshot,
  type SpaceView,
} from "@/lib/together-view";
import { callApi, LOGIN_AGAIN_URL, readSpace } from "./client";
import { CareCard } from "./CareCard";
import { ConsentCheckbox } from "./ConsentCheckbox";
import { InviteNote } from "./InviteNote";
import { PaymentForm } from "./PaymentForm";
import { ShareFriends } from "./ShareFriends";
import { TogetherCards } from "./TogetherCards";

const BUSY_RETRY_MS = 1000;
const BUSY_RETRY_LIMIT = 3;
const PRICE = formatRub(TOGETHER_PRICE_KOPECKS);

type Props = { initial: SpaceView | null; firstName: string; purchaseId: string | null; referral?: string };

const names = (space: SpaceView) => space.members.map((member) => member.displayName).join(" и ");
const partnerName = (space: SpaceView) => space.members.find((member) => member.role !== space.myRole)?.displayName ?? "Партнёр";

export function TogetherSpace({ initial, firstName, purchaseId, referral }: Props) {
  const [space, setSpace] = useState<SpaceView | null>(initial);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseSnapshot | null>(null);
  const [pollRound, setPollRound] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [email, setEmail] = useState("");
  const [reissuing, setReissuing] = useState(false);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const result = await readSpace();
    if (result.ok) setSpace(result.space);
    else if (result.status === 401) window.location.href = LOGIN_AGAIN_URL;
    else setError("Не получилось обновить данные. Проверьте соединение и повторите проверку.");
  }, []);

  // Возврат с оплаты: статус берётся только у сервера; опрос раз в 5 секунд, не более 12 раз, на скрытой вкладке — пауза
  useEffect(() => {
    if (!purchaseId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setPollExhausted(false);

    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      attempts += 1;
      const status = await callApi<PurchaseSnapshot>(`/api/together/purchases/${purchaseId}`);
      if (cancelled) return;
      if (status.status === 401) {
        window.location.href = LOGIN_AGAIN_URL;
        return;
      }
      if (status.ok) {
        // Сначала актуальное пространство, затем статус: успех не показывается по одному историческому granted
        if (status.body.status === "succeeded" && status.body.granted) await refresh();
        if (cancelled) return;
        setPurchase({ status: status.body.status, granted: status.body.granted });
        if (status.body.status !== "pending") return;
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        setPollExhausted(true);
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [purchaseId, pollRound, refresh]);

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } finally {
      setWorking(false);
    }
  }

  const createSpace = () =>
    run(async () => {
      const result = await callApi<{ inviteUrl: string }>("/api/together/spaces", { body: { consent, from: referral } });
      if (result.status === 401) return void (window.location.href = LOGIN_AGAIN_URL);
      if (!result.ok && result.body.error !== "already_in_space") return setError(startErrorMessage(result.body.error ?? "").text);
      if (result.ok) setInviteUrl(result.body.inviteUrl);
      await refresh();
    });

  const reissue = () =>
    run(async () => {
      const result = await callApi<{ inviteUrl: string }>("/api/together/invite", { body: {} });
      if (!result.ok) return setError(startErrorMessage(result.body.error ?? "").text);
      setInviteUrl(result.body.inviteUrl);
      setReissuing(false);
      setMessage("Новая ссылка готова. Прежняя больше не работает.");
    });

  const saveNote = () =>
    run(async () => {
      const result = await callApi<{ note: string | null }>("/api/together/invite/note", { method: "PUT", body: { note } });
      if (result.status === 401) return void (window.location.href = LOGIN_AGAIN_URL);
      if (!result.ok) {
        const failure = startErrorMessage(result.body.error ?? "");
        setError(failure.text);
        if (failure.reload) await refresh();
        return;
      }
      setNote(result.body.note ?? "");
      setMessage(result.body.note ? "Записка сохранена. Партнёр увидит её на странице приглашения." : "Записка убрана.");
    });

  const respond = (accept: boolean) =>
    run(async () => {
      const result = await callApi("/api/together/invite/confirm", { body: { accept } });
      if (!result.ok) setError(startErrorMessage(result.body.error ?? "").text);
      await refresh();
    });

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Ссылка скопирована. Отправьте её партнёру лично.");
    } catch {
      linkRef.current?.select();
      setMessage("Ссылка выделена. Скопируйте её вручную.");
    }
  };

  const startPayment = () =>
    run(async () => {
      for (let attempt = 0; attempt <= BUSY_RETRY_LIMIT; attempt += 1) {
        const result = await callApi<{ url: string }>("/api/together/purchases", { body: { email } });
        if (result.ok) {
          window.location.href = result.body.url;
          return;
        }
        const failure = startErrorMessage(result.status === 401 ? "unauthorized" : (result.body.error ?? ""));
        if (failure.login) return void (window.location.href = LOGIN_AGAIN_URL);
        if (failure.retry && attempt < BUSY_RETRY_LIMIT) {
          setMessage(failure.text);
          await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
          continue;
        }
        setMessage(null);
        setError(failure.text);
        if (failure.reload) await refresh();
        return;
      }
    });

  const leave = () =>
    run(async () => {
      const result = await callApi("/api/together/leave", { body: { acknowledged: true } });
      if (!result.ok && result.status !== 404) return setError(startErrorMessage(result.body.error ?? "").text);
      setLeaving(false);
      setAcknowledged(false);
      setInviteUrl(null);
      await refresh();
    });

  const refreshSpace = useCallback(() => void refresh(), [refresh]);

  const screen = spaceScreen(space);
  const outcome = purchase ? purchaseOutcome(purchase, space) : null;

  return (
    <div className="stack">
      {purchaseId && <PurchaseResult outcome={outcome} exhausted={pollExhausted} onCheck={() => setPollRound((round) => round + 1)} />}

      {screen === "start" && (
        <section className="card stack">
          <h1 className="display">{firstName}, начнём с двоих</h1>
          <p className="lead">Вы создадите пространство, а затем отправите партнёру личную ссылку. Оплату мы не предлагаем, пока оба не подтверждены.</p>
          <ConsentCheckbox id="together-consent" checked={consent} onChange={setConsent} />
          <button type="button" className="button button--block" disabled={working || !consent} onClick={createSpace}>
            {working ? "Создаём пространство…" : "Создать и получить приглашение"}
          </button>
        </section>
      )}

      {screen === "invite" && space && (
        <section className="card stack">
          <h1 className="display">{inviteUrl ? "Ваше приглашение готово" : "Ждём запрос партнёра"}</h1>
          {inviteUrl ? (
            <>
              <p className="lead">Отправьте ссылку лично. Когда партнёр войдёт и отправит запрос, вы подтвердите его имя.</p>
              <div className="stack buy-form">
                <label className="buy-form__label" htmlFor="together-link">Личная ссылка</label>
                <input id="together-link" ref={linkRef} className="buy-form__input" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
              </div>
              <button type="button" className="button button--block" onClick={copyLink}>Скопировать ссылку</button>
              <p className="muted">Приглашение действует 7 суток. Сохраните ссылку сейчас: при следующем входе мы не сможем её показать.</p>
            </>
          ) : (
            <p className="lead">Мы не можем восстановить прежнюю ссылку. Можно выпустить новую: старая перестанет работать.</p>
          )}
          {reissuing ? (
            <div className="stack">
              <p>Прежняя ссылка перестанет работать. Новую нужно отправить партнёру.</p>
              <button type="button" className="button button--block" disabled={working} onClick={reissue}>Да, выпустить новую</button>
              <button type="button" className="button button--ghost button--block" onClick={() => setReissuing(false)}>Отмена</button>
            </div>
          ) : (
            <button type="button" className="button button--ghost button--block" onClick={() => setReissuing(true)}>
              {inviteUrl ? "Выпустить новую ссылку" : "Создать новую ссылку"}
            </button>
          )}
          <InviteNote note={note} maxLength={TOGETHER_INVITE_NOTE_MAX} working={working} onChange={setNote} onSave={() => void saveNote()} />
          <button type="button" className="button button--ghost button--block" disabled={working} onClick={() => run(refresh)}>Обновить статус</button>
        </section>
      )}

      {screen === "confirm" && space?.pendingRequest && (
        <section className="card stack">
          <h1 className="display">Это ваш человек?</h1>
          <p className="lead">Проверьте имя аккаунта, который отправил запрос. Подтверждайте только того, кого пригласили.</p>
          <p className="eyebrow">Отображаемое имя аккаунта</p>
          <p className="display">{space.pendingRequest.displayName}</p>
          <button type="button" className="button button--block" disabled={working} onClick={() => respond(true)}>Да, подтвердить партнёра</button>
          <button type="button" className="button button--ghost button--block" disabled={working} onClick={() => respond(false)}>Отклонить запрос</button>
          <p className="muted">Отказ не закрывает пространство. Приглашение снова можно использовать.</p>
        </section>
      )}

      {screen === "ready" && space && (
        <section className="card stack">
          <h1 className="display">Вы теперь вдвоём</h1>
          <p className="lead">{names(space)} подтвердили участие. Три вводные карточки доступны бесплатно, а доступ на 30 дней откроется, когда дойдёте до основного маршрута.</p>
        </section>
      )}

      {space?.status === "active" && (
        <TogetherCards
          partnerName={partnerName(space)}
          price={PRICE}
          accessActive={space.access.active}
          onGone={refreshSpace}
          onAccessCheck={refreshSpace}
          renderPayment={() => (
            <PaymentForm idPrefix="together" email={email} onEmail={setEmail} onSubmit={() => void startPayment()} working={working} label={`Перейти к оплате ${PRICE}`} workingLabel="Готовим оплату…" legal />
          )}
        />
      )}

      {(screen === "paid" || screen === "limit") && space && (
        <section className="card stack">
          <h1 className="display">Ваше пространство</h1>
          <p className="eyebrow">Доступ активен</p>
          {space.access.accessUntil && <p className="lead">Доступ действует до {formatAccessUntil(space.access.accessUntil)}. Для обоих участников, ручное продление.</p>}
          {screen === "paid" ? (
            <div className="stack">
              <PaymentForm idPrefix="together-renew" email={email} onEmail={setEmail} onSubmit={() => void startPayment()} working={working} label="Добавить ещё 30 дней" ghost />
              <p className="muted">Продление добавляет период после текущего. История сохраняется.</p>
            </div>
          ) : (
            <p className="muted">Следующий период уже оплачен. Новую оплату предложим, когда останется не больше 30 суток доступа.</p>
          )}
        </section>
      )}

      {space?.status === "active" && <CareCard />}

      {space?.status === "active" && <ShareFriends />}

      {space && (
        <section className="stack">
          {!leaving && <button type="button" className="button button--ghost" onClick={() => setLeaving(true)}>Выйти из пространства</button>}
          {leaving && (
            <div className="card stack" role="dialog" aria-labelledby="leave-title">
              <h2 id="leave-title" className="display">Выйти из пространства?</h2>
              <p>Совместная программа и доступ прекратятся для обоих участников. Остаток оплаченного срока автоматически не переносится, но плательщик может запросить возврат за неиспользованные сутки: условия в <a href="/offer" target="_blank" rel="noopener">оферте</a>.</p>
              <label className="choice">
                <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                <span>Я понимаю последствия</span>
              </label>
              <button type="button" className="button button--block" disabled={!acknowledged || working} onClick={leave}>Выйти из пространства</button>
              <button type="button" className="button button--ghost button--block" onClick={() => setLeaving(false)}>Остаться</button>
            </div>
          )}
        </section>
      )}

      {message && <p role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function PurchaseResult({ outcome, exhausted, onCheck }: { outcome: ReturnType<typeof purchaseOutcome> | null; exhausted: boolean; onCheck: () => void }) {
  if (outcome === "success") {
    return (
      <section className="card stack" role="status">
        <h2 className="display">Доступ открыт для двоих</h2>
        <p>Платёж подтверждён и доступ выдан.</p>
      </section>
    );
  }
  if (outcome === "cancelled") {
    return (
      <section className="card stack" role="status">
        <h2 className="display">Оплата не завершена</h2>
        <p>Можно вернуться к условиям и продолжить позже. Не оформляйте новую оплату, пока предыдущий статус не проверен.</p>
      </section>
    );
  }
  if (outcome === "delayed" || outcome === "closed") {
    return (
      <section className="card stack" role="status">
        <h2 className="display">Платёж подтверждён. Доступ проверяем.</h2>
        <p>Не оплачивайте повторно. Если пространство закрыто или доступ не выдан, потребуется проверка.</p>
        <button type="button" className="button button--ghost" onClick={onCheck}>Проверить ещё раз</button>
      </section>
    );
  }
  return (
    <section className="card stack" role="status">
      <h2 className="display">Проверяем оплату</h2>
      <p>Возвращение на сайт ещё не подтверждает платёж. Проверяем статус и выдачу доступа.</p>
      {exhausted && <button type="button" className="button button--ghost" onClick={onCheck}>Проверить статус</button>}
    </section>
  );
}
