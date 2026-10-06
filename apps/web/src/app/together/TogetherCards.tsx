"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CARD_POLL_INTERVAL_MS,
  CARD_POLL_MAX_ATTEMPTS,
  cardFailure,
  progressText,
  serializeAnswer,
  validateDraft,
  type AnswerValues,
  type CardFailure,
  type CardView,
  type Progress,
} from "@/lib/together-cards-view";
import { callApi, LOGIN_AGAIN_URL, readCurrentCard } from "./client";
import { AnswerForm, CardHeader, EndPanel, LockedPanel, MonthLockedPanel, PartnerStatus, RevealPanel, SkippedPanel, WaitingPanel } from "./CardPanels";
import { CardHistory } from "./CardHistory";
import { ConfirmDialog } from "./ConfirmDialog";
import "./together-cards.css";

type Props = {
  partnerName: string;
  price: string;
  accessActive: boolean;
  renderPayment: () => ReactNode;
  onGone: () => void;
  onAccessCheck: () => void;
};

type Load = "loading" | "ready" | "gone" | "error";

const EDITED_AFTER_REVEAL = "Пока вы правили, ответы открылись: партнёр увидел прежний текст, а ваша правка отмечена как изменение.";
const REVEALED_DURING_EDIT = "Пока вы правили, ответы открылись. Партнёр уже мог прочитать прежний текст. Ваш набранный текст сохранён: если сохранить его, ответ будет отмечен как изменённый.";

const without = <T,>(record: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

// Карточки пары. Состояние, права и ответ партнёра приходят только от сервера; здесь хранятся лишь несохранённый
// текст формы (чтобы не потерять его при обновлении) и намерение отметить «Сделали вместе» до нажатия «Продолжить»
export function TogetherCards({ partnerName, price, accessActive, renderPayment, onGone, onAccessCheck }: Props) {
  const [load, setLoad] = useState<Load>("loading");
  const [card, setCard] = useState<CardView | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AnswerValues>>({});
  const [doneIntent, setDoneIntent] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editStart, setEditStart] = useState<CardView["state"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"skip" | "delete" | null>(null);
  const [pollRound, setPollRound] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const focusAfterLoad = useRef(false);

  const gone = useCallback(() => {
    setLoad("gone");
    setCard(null);
    setDrafts({});
    setDoneIntent({});
    onGone();
  }, [onGone]);

  // clearError: фоновое чтение убирает устаревшее сообщение о сети, а чтение после ошибки действия его сохраняет
  const reload = useCallback(async (clearError = false) => {
    const result = await readCurrentCard();
    if (result.ok) {
      setCard(result.body.card);
      setProgress(result.body.progress);
      setLoad("ready");
      if (clearError) setError(null);
      return;
    }
    focusAfterLoad.current = false;
    const failure = cardFailure(result.status, result.body.error ?? "");
    if (failure.kind === "login") window.location.href = LOGIN_AGAIN_URL;
    else if (failure.kind === "gone") gone();
    else {
      setLoad((current) => (current === "loading" ? "error" : current));
      setError(failure.text);
    }
  }, [gone]);

  // Оплата или первый заход: актуальная карточка берётся у сервера
  useEffect(() => {
    void reload();
  }, [reload, accessActive]);

  // Возврат на вкладку обновляет карточку (безопасное чтение); итог партнёра не исчезает, пока не нажато «Продолжить»
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void reload(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  // Ожидание партнёра: ограниченный опрос, на скрытой вкладке пауза; в других состояниях опроса нет
  const waiting = card?.state === "waiting";
  const cardId = card?.id;
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setPollExhausted(false);
    const tick = async () => {
      if (cancelled) return;
      if (document.hidden) {
        timer = setTimeout(tick, CARD_POLL_INTERVAL_MS);
        return;
      }
      attempts += 1;
      await reload(true);
      if (cancelled) return;
      if (attempts >= CARD_POLL_MAX_ATTEMPTS) {
        setPollExhausted(true);
        return;
      }
      timer = setTimeout(tick, CARD_POLL_INTERVAL_MS);
    };
    timer = setTimeout(tick, CARD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [waiting, cardId, pollRound, reload]);

  // Карточка сменила состояние (например, партнёр ответил): открытый диалог уже говорит неправду
  const cardState = card?.state;
  useEffect(() => {
    setDialog(null);
  }, [cardState, cardId]);

  // После успешного «Продолжить» фокус переходит на заголовок следующего вопроса
  useEffect(() => {
    if (!focusAfterLoad.current) return;
    focusAfterLoad.current = false;
    sectionRef.current?.querySelector<HTMLElement>("[data-card-heading]")?.focus();
  }, [cardId]);

  const fail = useCallback(
    (failure: CardFailure) => {
      if (failure.kind === "login") return void (window.location.href = LOGIN_AGAIN_URL);
      if (failure.kind === "gone") return gone();
      setError(failure.text);
      if (failure.kind === "reload" || failure.kind === "paywall") void reload();
      if (failure.kind === "paywall") onAccessCheck();
    },
    [gone, reload, onAccessCheck],
  );

  async function act(run: () => Promise<void>) {
    if (working) return;
    setWorking(true);
    setError(null);
    setFieldError(null);
    try {
      await run();
    } finally {
      setWorking(false);
    }
  }

  const url = (suffix: string) => `/api/together/cards/${card?.id}/${suffix}`;

  const submit = (values: AnswerValues) =>
    card &&
    act(async () => {
      const problem = validateDraft(card, values);
      if (problem) return setFieldError(problem.message);
      const result = await callApi<{ state?: string }>(url("answer"), { method: "PUT", body: { fields: serializeAnswer(card, values, card.state === "revealed") } });
      if (!result.ok) return fail(cardFailure(result.status, result.body.error ?? ""));
      // Правка началась до раскрытия, а сохранилась после него: партнёр уже мог прочитать прежний текст
      if (editStart === "waiting" && result.body.state === "edited") setNotice(EDITED_AFTER_REVEAL);
      setEditing(false);
      setDrafts((current) => without(current, card.id));
      await reload();
    });

  // Выбор материала для книги: сохраняется сразу, при ошибке галочка возвращается к значению сервера
  const toggleChoice = (fieldId: string, value: boolean) =>
    card?.mine &&
    act(async () => {
      // Галочка меняется только после ответа сервера: успех до подтверждения не показываем
      const fields = { ...card.mine!.fields, [fieldId]: value };
      const result = await callApi(url("answer"), { method: "PUT", body: { fields: serializeAnswer(card, fields, true) } });
      if (!result.ok) return fail(cardFailure(result.status, result.body.error ?? ""));
      await reload();
    });

  const removeDraft = () =>
    act(async () => {
      const result = await callApi(url("answer"), { method: "DELETE" });
      setDialog(null);
      if (!result.ok) return fail(cardFailure(result.status, result.body.error ?? ""));
      setEditing(false);
      setDrafts((current) => without(current, card!.id));
      await reload();
    });

  const skip = () =>
    act(async () => {
      const result = await callApi(url("skip"), { body: {} });
      setDialog(null);
      if (!result.ok) return fail(cardFailure(result.status, result.body.error ?? ""));
      setEditing(false);
      await reload();
    });

  // «Сделали вместе» уходит вместе с «Продолжить», а не отдельным запросом: галочка сама итог просмотренным не делает
  const proceed = () =>
    card &&
    act(async () => {
      const result = await callApi(url("continue"), { body: doneIntent[card.id] ? { done: true } : {} });
      if (!result.ok) return fail(cardFailure(result.status, result.body.error ?? ""));
      setDoneIntent((current) => without(current, card.id));
      setEditing(false);
      focusAfterLoad.current = true;
      await reload();
    });

  const startEdit = () => {
    if (!card?.mine) return;
    setDrafts((current) => ({ ...current, [card.id]: { ...card.mine!.fields } }));
    setEditStart(card.state);
    setNotice(null);
    setEditing(true);
  };

  if (load === "loading") {
    return (
      <section className="card stack" aria-busy="true">
        <p role="status">Загружаем карточку…</p>
      </section>
    );
  }
  if (load === "gone") {
    return (
      <section className="card stack">
        <h2 className="display">Пространство недоступно</h2>
        <p>Не удалось открыть совместные карточки.</p>
      </section>
    );
  }
  if (load === "error") {
    return (
      <section className="card stack">
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="button button--ghost" onClick={() => { setError(null); setLoad("loading"); void reload(); }}>Повторить</button>
      </section>
    );
  }

  const values = card ? (drafts[card.id] ?? {}) : {};
  const setValues = (next: AnswerValues) => card && setDrafts((current) => ({ ...current, [card.id]: next }));

  return (
    <div className="stack">
      <section ref={sectionRef} className="card stack">
        {progress && (
          <div className="tc-progress">
            <span className="eyebrow">Пройдено: {progressText(progress)}</span>
            <progress aria-label="Пройдено карточек" value={progress.done} max={progress.total} />
          </div>
        )}
        {card ? (
          <>
            <CardHeader card={card} />
            {card.locked && card.lock?.kind === "month" && <MonthLockedPanel lock={card.lock} />}
            {card.locked && card.lock?.kind !== "month" && <LockedPanel price={price}>{renderPayment()}</LockedPanel>}
            {!card.locked && card.state === "answer" && (
              <>
                <PartnerStatus card={card} partnerName={partnerName} />
                <p className="muted">Ответы откроются, когда ответят оба. До этого партнёр видит только статус.</p>
                <AnswerForm card={card} values={values} onChange={setValues} onSubmit={() => submit(values)} working={working} fieldError={fieldError} submitLabel="Отправить ответ" />
                <button type="button" className="button button--ghost" disabled={working} onClick={() => setDialog("skip")}>Пропустить карточку</button>
              </>
            )}
            {card.state === "waiting" &&
              (editing ? (
                <AnswerForm card={card} values={values} onChange={setValues} onSubmit={() => submit(values)} working={working} fieldError={fieldError} submitLabel="Сохранить ответ" onCancel={() => setEditing(false)} />
              ) : (
                <>
                  <WaitingPanel card={card} partnerName={partnerName} working={working} onEdit={startEdit} onDelete={() => setDialog("delete")} onCheck={() => { setPollRound((round) => round + 1); void reload(); }} onSkip={() => setDialog("skip")} />
                  {pollExhausted && <p className="muted">Мы перестали проверять автоматически. Нажмите «Проверить ответы», когда захотите.</p>}
                </>
              ))}
            {card.state === "revealed" &&
              (editing ? (
                <>
                  {editStart === "waiting" && <p className="tc-banner" role="status">{REVEALED_DURING_EDIT}</p>}
                  <AnswerForm card={card} values={values} onChange={setValues} onSubmit={() => submit(values)} working={working} fieldError={fieldError} submitLabel="Сохранить изменения" onCancel={() => setEditing(false)} />
                </>
              ) : (
                <RevealPanel
                  card={card}
                  partnerName={partnerName}
                  working={working}
                  doneIntent={doneIntent[card.id] === true}
                  onDoneIntent={(value) => setDoneIntent((current) => ({ ...current, [card.id]: value }))}
                  onToggle={toggleChoice}
                  onEdit={startEdit}
                  onContinue={proceed}
                />
              ))}
            {card.state === "skipped" && <SkippedPanel card={card} working={working} onContinue={proceed} />}
          </>
        ) : (
          progress && <EndPanel total={progress.total} />
        )}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <CardHistory partnerName={partnerName} onFailure={fail} />

      {dialog === "skip" && (
        <ConfirmDialog title="Пропустить для обоих?" confirmLabel="Да, пропустить" cancelLabel="Не пропускать" working={working} onConfirm={skip} onClose={() => setDialog(null)}>
          <p>Карточка закроется. Ответы не раскроются. Если партнёр уже ответил, его текст останется только у него. Ваш отправленный ответ будет удалён.</p>
        </ConfirmDialog>
      )}
      {dialog === "delete" && (
        <ConfirmDialog title="Удалить свой ответ?" confirmLabel="Да, удалить" cancelLabel="Оставить" working={working} onConfirm={removeDraft} onClose={() => setDialog(null)}>
          <p>До раскрытия можно удалить отправленный ответ. Карточка останется открытой, ответить можно будет снова.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
