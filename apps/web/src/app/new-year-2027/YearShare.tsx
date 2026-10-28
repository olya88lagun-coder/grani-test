"use client";

import Image from "next/image";
import { useState } from "react";
import { shareContent, type YearMap } from "@/lib/new-year-2027";
import styles from "./new-year.module.css";

export function YearShare({ map, firstStep }: { map: YearMap; firstStep: string }) {
  const [personal, setPersonal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const content = shareContent(map, personal, firstStep);
  async function exportCard(share: boolean) {
    setBusy(true); setMessage("");
    try {
      const { renderYearShare, deliverYearImage } = await import("@/lib/new-year-share");
      const outcome = await deliverYearImage(await renderYearShare(content), "moi-grani-2027.png", share);
      setMessage(outcome === "shared" ? "Карточка передана выбранному приложению."
        : outcome === "fallback" ? "Приложение не открылось. Карточка скачана — её можно отправить из файлов."
        : share ? "Карточка скачана. Её можно отправить из галереи или файлов." : "Карточка скачана на устройство.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") setMessage("Отправка отменена. Карточка остаётся здесь.");
      else setMessage("Не получилось сохранить карточку. Попробуй ещё раз или сделай снимок её превью.");
    } finally { setBusy(false); }
  }
  return <section className={styles.share} aria-labelledby="share-title">
    <div><p className={styles.eyebrow}>Можно оставить себе</p><h2 id="share-title">Маленькое напоминание о важном</h2><p>На карточке по умолчанию только выбранное настроение. Ответов, шкал Big Five и имени на ней нет.</p>
      <label className={styles.check}><input type="checkbox" checked={personal} onChange={(e) => { setPersonal(e.target.checked); setMessage(""); }} disabled={busy} />Добавить мою цель и первый шаг. Их увидит получатель карточки.</label>
      <p>Превью показывает весь текст, который попадёт в файл. Изображение создаётся на твоём устройстве.</p>
      <div className={styles.shareActions}><button className={styles.primary} disabled={busy} onClick={() => void exportCard(false)}>{busy ? "Готовим…" : "Скачать PNG"}</button><button className={styles.secondary} disabled={busy} onClick={() => void exportCard(true)}>Поделиться</button></div>
      <p role="status" aria-live="polite">{message}</p>
    </div>
    <div className={styles.sharePreview} aria-label="Превью share-карточки"><p className={styles.previewBrand}>грани</p><div className={styles.previewYear}>2027</div><Image src="/home/hero-crystal.webp" width={110} height={132} alt="" loading="eager" /><h3>{content.title}</h3><p>{content.subtitle}</p>{content.goal && <><p>МОЯ ЦЕЛЬ</p><p className={styles.previewPrivate}>{content.goal}</p></>}{content.step && <><p>ПЕРВЫЙ ШАГ</p><p className={styles.previewPrivate}>{content.step}</p></>}<p>grani-test.ru/new-year-2027</p></div>
  </section>;
}
