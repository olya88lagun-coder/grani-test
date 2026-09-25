"use client";

import { useState } from "react";

type ShareCardProps = { cardUrl: string; fileName: string; typeName: string; eyebrow?: string; heading?: string; shareTitle?: string };

export function ShareCard({ cardUrl, fileName, typeName, eyebrow = "Для сторис", heading = "Карточка «мой тип»", shareTitle = `Мой тип — ${typeName}` }: ShareCardProps) {
  const [status, setStatus] = useState<string | null>(null);

  // Сторис принимают файл, а не ссылку: сначала пробуем поделиться картинкой, иначе — скачиваем её
  async function share() {
    setStatus(null);
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus("Картинка скачана — добавьте её в сторис.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Не получилось подготовить картинку. Попробуйте ещё раз.");
    }
  }

  // Превью рядом с текстом, кнопки — под текстом, а не поверх картинки
  return (
    <section className="share-card" aria-labelledby="share">
      <img className="share-card__preview" src={cardUrl} alt={`Карточка типа «${typeName}»`} width={1080} height={1920} />
      <div className="share-card__body">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="share">{heading}</h2>
        <p className="lead">Сохрани или отправь в сторис.</p>
        <p className="muted">Картинка 1080×1920 — ровно под размер сторис.</p>
        <div className="row">
          <button type="button" className="button" onClick={share}>
            Поделиться <span aria-hidden="true">→</span>
          </button>
          <a className="button button--ghost" href={cardUrl} download={fileName}>
            Скачать
          </a>
        </div>
        {status && (
          <p className="muted" role="status">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
