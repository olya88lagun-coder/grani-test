"use client";

import Image from "next/image";
import { useState } from "react";
import type { YearSlide } from "@/lib/new-year-cards";
import { trackYearEvent } from "@/lib/new-year-analytics";
import { SHARE_URL_TEXT } from "@/lib/new-year-copy";
import styles from "./new-year.module.css";

const FAILURE = "Не получилось создать картинку. Попробуй ещё раз.";

function SlideCard({ slide }: { slide: YearSlide }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = slide.personal && !agreed;
  async function run(share: boolean) {
    setBusy(true); setMessage("");
    try {
      const { renderSlideCard, deliverYearImage } = await import("@/lib/new-year-share");
      const outcome = await deliverYearImage(await renderSlideCard(slide), `moi-grani-2027-${slide.id}.png`, share);
      setMessage(outcome === "shared" ? "Передано выбранному приложению." : outcome === "fallback" ? "Приложение не открылось. Картинка скачана." : "Картинка скачана на устройство.");
    } catch (error) {
      setMessage(error instanceof Error && error.name === "AbortError" ? "Отправка отменена." : FAILURE);
    } finally { setBusy(false); }
  }
  return <li className={styles.slide}>
    <div className={styles.slideFace} data-slide={slide.id} role="group" aria-label={`Превью карточки «${slide.kicker}»`}>
      <p className={styles.slideKicker}>{slide.kicker}</p>
      <p className={slide.id === "word" ? styles.slideWord : styles.slideText}>{slide.text}</p>
      <span className={styles.slideUrl}>{SHARE_URL_TEXT}</span>
    </div>
    {slide.personal
      ? <label className={styles.check}><input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => { setAgreed(e.target.checked); setMessage(""); }} />На картинке будет мой текст. Его увидит получатель.<span className={styles.srOnly}> Карточка «{slide.kicker}»</span></label>
      : <p className={styles.slideSafe}>Личных ответов здесь нет.</p>}
    <div className={styles.slideActions}>
      <button type="button" className={styles.secondary} disabled={busy || locked} aria-label={`Скачать «${slide.kicker}»`} onClick={() => void run(false)}>Скачать</button>
      <button type="button" className={styles.secondary} disabled={busy || locked} aria-label={`Поделиться «${slide.kicker}»`} onClick={() => void run(true)}>Поделиться</button>
    </div>
    <p role="status" aria-live="polite" className={styles.slideStatus}>{message}</p>
  </li>;
}

function Wallpaper({ word, custom }: { word: string; custom: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      const { renderWallpaper, deliverYearImage } = await import("@/lib/new-year-share");
      await deliverYearImage(await renderWallpaper(word), "moi-grani-2027-oboi.png", false);
      trackYearEvent("new_year_wallpaper");
      setMessage("Обои скачаны. Поставь их на экран блокировки из галереи.");
    } catch { setMessage(FAILURE); }
    finally { setBusy(false); }
  }
  return <div className={styles.wallpaper}>
    <div className={styles.wallpaperFace} role="img" aria-label={`Превью обоев со словом «${word}»`}>
      <small>Мои грани · 2027</small><strong>{word}</strong>
      <Image src="/home/hero-crystal.webp" width={110} height={132} alt="" loading="lazy" />
      <span>Не весь год сразу.<br />Один свой шаг.</span>
    </div>
    <div>
      <h3>Обои на телефон</h3>
      <p>Слово года и кристалл на тёмном фоне. Личного текста на обоях нет: экран блокировки видят все, кто рядом.{custom ? " Своё слово на обои не попадает, поэтому здесь слово из списка." : ""}</p>
      <button type="button" className={styles.primary} disabled={busy} onClick={() => void download()}>{busy ? "Готовим…" : "Скачать обои"}</button>
      <p role="status" aria-live="polite" className={styles.slideStatus}>{message}</p>
    </div>
  </div>;
}

export function YearCards({ slides, wallpaperWord, wordIsCustom }: { slides: YearSlide[]; wallpaperWord: string; wordIsCustom: boolean }) {
  return <section className={styles.cards} aria-labelledby="cards-title">
    <p className={styles.eyebrow}>Карточки на память</p>
    <h2 id="cards-title">Карта по частям</h2>
    <p className={styles.cardsNote}>Каждая карточка — отдельная картинка. Делись только тем, чем хочется. Файлы создаются на твоём устройстве.</p>
    <ul className={styles.slideRail} aria-label="Карточки карты">{slides.map((slide) => <SlideCard key={`${slide.id}:${slide.text}`} slide={slide} />)}</ul>
    <Wallpaper word={wallpaperWord} custom={wordIsCustom} />
  </section>;
}
