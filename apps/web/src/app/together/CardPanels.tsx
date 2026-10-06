"use client";

import type { ReactNode } from "react";
import { partnerStatusText, type AnswerValues, type CardView } from "@/lib/together-cards-view";

export function CardHeader({ card }: { card: CardView }) {
  return (
    <header className="stack">
      <p className="eyebrow">
        Карточка {card.position} · {card.estimatedMinutes} мин
      </p>
      <h2 className="display tc-title" tabIndex={-1} data-card-heading>{card.title}</h2>
      <p className="lead">{card.prompt}</p>
    </header>
  );
}

// Тексты ответа по подписям из снимка карточки; пустые поля не показываем
function AnswerTexts({ card, values }: { card: CardView; values: AnswerValues }) {
  const fields = card.fields.filter((field) => field.type === "short_text" && typeof values[field.id] === "string");
  return (
    <div className="stack">
      {fields.map((field) => (
        <div key={field.id}>
          {field.id !== "answer" && <p className="eyebrow">{field.label}</p>}
          <p className="tc-text">{String(values[field.id])}</p>
        </div>
      ))}
    </div>
  );
}

type FormProps = {
  card: CardView;
  values: AnswerValues;
  onChange: (values: AnswerValues) => void;
  onSubmit: () => void;
  working: boolean;
  fieldError: string | null;
  submitLabel: string;
  onCancel?: () => void;
};

export function AnswerForm({ card, values, onChange, onSubmit, working, fieldError, submitLabel, onCancel }: FormProps) {
  const texts = card.fields.filter((field) => field.type === "short_text");
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {card.hint && <p className="muted">{card.hint}</p>}
      {texts.map((field) => {
        const value = typeof values[field.id] === "string" ? String(values[field.id]) : "";
        const long = field.id === "answer" || (field.maxLength ?? 0) > 200;
        const id = `tc-field-${field.id}`;
        return (
          <div key={field.id} className="stack buy-form">
            <label className="buy-form__label" htmlFor={id}>
              {field.label}
              {!field.required && " (необязательно)"}
            </label>
            {long ? (
              <textarea id={id} className="buy-form__input tc-textarea" rows={5} required={field.required} aria-invalid={fieldError ? true : undefined} value={value} onChange={(event) => onChange({ ...values, [field.id]: event.target.value })} />
            ) : (
              <input id={id} className="buy-form__input" required={field.required} aria-invalid={fieldError ? true : undefined} value={value} onChange={(event) => onChange({ ...values, [field.id]: event.target.value })} />
            )}
            {field.maxLength && <p className="buy-form__hint">{[...value].length} из {field.maxLength}</p>}
          </div>
        );
      })}
      {fieldError && <p className="error" role="alert">{fieldError}</p>}
      <button type="submit" className="button button--block" disabled={working}>{working ? "Отправляем…" : submitLabel}</button>
      {onCancel && <button type="button" className="button button--ghost button--block" disabled={working} onClick={onCancel}>Отмена</button>}
    </form>
  );
}

export function PartnerStatus({ card, partnerName }: { card: CardView; partnerName: string }) {
  return (
    <p className="muted" role="status">
      {partnerStatusText(card.partner.status, partnerName)}
    </p>
  );
}

type WaitingProps = { card: CardView; partnerName: string; working: boolean; onEdit: () => void; onDelete: () => void; onCheck: () => void; onSkip: () => void };

export function WaitingPanel({ card, partnerName, working, onEdit, onDelete, onCheck, onSkip }: WaitingProps) {
  return (
    <div className="stack">
      <section className="tc-paper stack" aria-live="polite">
        <h3 className="display tc-sub">Ваш ответ на месте</h3>
        <p>Когда {partnerName} ответит, здесь откроются оба ответа. Можно вернуться позже.</p>
        {card.mine && <AnswerTexts card={card} values={card.mine.fields} />}
      </section>
      <div className="tc-actions">
        <button type="button" className="button button--ghost" disabled={working} onClick={onEdit}>Изменить ответ</button>
        <button type="button" className="button button--ghost" disabled={working} onClick={onDelete}>Удалить ответ</button>
        <button type="button" className="button button--ghost" disabled={working} onClick={onCheck}>Проверить ответы</button>
        <button type="button" className="button button--ghost" disabled={working} onClick={onSkip}>Пропустить карточку</button>
      </div>
    </div>
  );
}

type RevealProps = {
  card: CardView;
  partnerName: string;
  working: boolean;
  doneIntent: boolean;
  onDoneIntent: (value: boolean) => void;
  onToggle: (fieldId: string, value: boolean) => void;
  onEdit: () => void;
  onContinue: () => void;
};

export function RevealPanel({ card, partnerName, working, doneIntent, onDoneIntent, onToggle, onEdit, onContinue }: RevealProps) {
  const mine = card.mine;
  const partner = card.partner;
  const booleans = card.fields.filter((field) => field.type === "boolean" && field.availableAt === "after_reveal");
  const alreadyDone = mine?.done === true;
  return (
    <div className="stack">
      <div className="tc-replies">
        <section className="tc-paper stack">
          <p className="eyebrow">Ваш ответ{mine && mine.revision > 1 ? " · изменён" : ""}</p>
          {mine && <AnswerTexts card={card} values={mine.fields} />}
          {mine && booleans.length > 0 && (
            <div className="stack">
              {booleans.map((field) => (
                <label key={field.id} className="choice">
                  <input type="checkbox" checked={mine.fields[field.id] === true} disabled={working} onChange={(event) => onToggle(field.id, event.target.checked)} />
                  <span>{field.label}</span>
                </label>
              ))}
              <p className="buy-form__hint">Это только выбор материала. Книга и карточка заботы появятся на следующих этапах.</p>
            </div>
          )}
          <button type="button" className="button button--ghost" disabled={working} onClick={onEdit}>Изменить мой ответ</button>
        </section>
        <section className="tc-paper stack">
          <p className="eyebrow">{partnerName}{partner.edited ? " · изменено" : ""}</p>
          {partner.fields && <AnswerTexts card={card} values={partner.fields} />}
        </section>
      </div>
      <section className="tc-paper stack">
        <p className="eyebrow">Маленький шаг</p>
        <p>{card.jointAction}</p>
        <label className="choice">
          <input type="checkbox" checked={alreadyDone || doneIntent} disabled={alreadyDone || working} onChange={(event) => onDoneIntent(event.target.checked)} />
          <span>Сделали вместе</span>
        </label>
        {partner.done && <p className="muted">Отметка {partnerName}: действие сделано.</p>}
      </section>
      <button type="button" className="button button--block" disabled={working} onClick={onContinue}>Продолжить</button>
    </div>
  );
}

export function SkippedPanel({ card, working, onContinue }: { card: CardView; working: boolean; onContinue: () => void }) {
  return (
    <div className="stack">
      <section className="tc-paper stack">
        <p className="eyebrow">Можно идти дальше</p>
        <h3 className="display tc-sub">Карточка пропущена</h3>
        <p>Карточка закрыта для вас обоих. Ответы друг другу не откроются.</p>
        {card.mine && (
          <div className="stack">
            <p className="eyebrow">Только вам</p>
            <AnswerTexts card={card} values={card.mine.fields} />
          </div>
        )}
      </section>
      <button type="button" className="button button--block" disabled={working} onClick={onContinue}>Продолжить</button>
    </div>
  );
}

export function LockedPanel({ price, children }: { price: string; children: ReactNode }) {
  return (
    <section className="tc-paper stack">
      <h3 className="display tc-sub">Продолжите вдвоём</h3>
      <p>Три вводные карточки доступны бесплатно. Чтобы отвечать на основной маршрут, откройте доступ для пары: 30 дней, {price} за двоих, без автоматических списаний.</p>
      {children}
    </section>
  );
}

export function EndPanel({ total }: { total: number }) {
  return (
    <section className="tc-paper stack">
      <p className="eyebrow">{total} карточек позади</p>
      <h3 className="display tc-sub" tabIndex={-1} data-card-heading>Вы прошли этот маршрут</h3>
      <p>В истории остались ваши ответы и пропуски. Новые карточки появятся позже.</p>
    </section>
  );
}
