"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = { title: string; confirmLabel: string; cancelLabel?: string; working?: boolean; onConfirm?: () => void; onClose: () => void; children: ReactNode };

// Системный <dialog>: Escape закрывает, фокус остаётся внутри, при закрытии возвращается на нажатую кнопку.
// Без onConfirm диалог только читается (например, карточка из истории)
export function ConfirmDialog({ title, confirmLabel, cancelLabel = "Отмена", working, onConfirm, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={ref} className="tc-dialog" aria-labelledby="tc-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="stack">
        <h2 id="tc-dialog-title" className="display tc-dialog__title">{title}</h2>
        {children}
        {onConfirm && (
          <button type="button" className="button button--block" disabled={working} onClick={onConfirm}>{confirmLabel}</button>
        )}
        <button type="button" className="button button--ghost button--block" onClick={onClose}>{onConfirm ? cancelLabel : confirmLabel}</button>
      </div>
    </dialog>
  );
}
