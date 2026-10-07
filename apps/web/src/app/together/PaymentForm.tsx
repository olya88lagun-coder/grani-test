"use client";

import Link from "next/link";

type Props = {
  idPrefix: string;
  email: string;
  onEmail: (value: string) => void;
  onSubmit: () => void;
  working: boolean;
  label: string;
  workingLabel?: string;
  ghost?: boolean;
  legal?: boolean;
};

// Одна форма оплаты для экрана «30 дней», продления и закрытой карточки: протокол оплаты этапа 1 не меняется
export function PaymentForm({ idPrefix, email, onEmail, onSubmit, working, label, workingLabel, ghost, legal }: Props) {
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="stack buy-form">
        <label className="buy-form__label" htmlFor={`${idPrefix}-email`}>Электронная почта для чека</label>
        <input id={`${idPrefix}-email`} className="buy-form__input" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => onEmail(event.target.value)} />
      </div>
      {legal && (
        <p className="muted">
          Данные оплаты относятся к плательщику. Нажимая кнопку, вы соглашаетесь с <Link href="/offer">офертой</Link> и <Link href="/privacy">политикой</Link>.
        </p>
      )}
      <button type="submit" className={ghost ? "button button--ghost button--block" : "button button--block"} disabled={working}>
        {working && workingLabel ? workingLabel : label}
      </button>
    </form>
  );
}
