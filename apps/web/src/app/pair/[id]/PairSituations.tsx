"use client";
import { useEffect, useRef, useState } from "react";
import type { buildPairGuide } from "@/lib/pair-guide";
import styles from "./pair-map.module.css";
type Guide = ReturnType<typeof buildPairGuide>;

export function PairSituations({ guide }: { guide: Guide }) {
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const detail = guide.situations[selected]!;
  useEffect(() => {
    const card = track.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    if (card && track.current) track.current.scrollTo({ left: card.offsetLeft - track.current.offsetLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [selected]);
  return <section id="situations" className={`${styles.section} ${styles.situationsSection}`} aria-labelledby="situations-title">
    <header className={styles.sectionHead}><div><p className={styles.kicker}>03 / Жизненные ситуации</p><h2 id="situations-title">Как вы можете вести себя в обычной жизни</h2></div><div className={styles.carouselControls}><button type="button" aria-label="Предыдущая ситуация" onClick={() => setSelected(i => (i + 7) % 8)}>‹</button><span data-situation-counter aria-live="polite">{selected + 1} / 8</span><button type="button" aria-label="Следующая ситуация" onClick={() => setSelected(i => (i + 1) % 8)}>›</button></div></header>
    <p className={styles.sectionIntro}>Восемь поводов понять друг друга лучше. Подсказки — гипотезы по вашим ответам, а не готовые ответы за вас.</p>
    <div className={styles.situationTrack} data-situation-track ref={track} role="group" aria-label="Восемь жизненных ситуаций">{guide.situations.map((situation,index) => <button key={situation.id} type="button" className={styles.situationCard} data-situation-card data-index={index} aria-label={situation.title} aria-pressed={selected === index} aria-controls="situation-detail" onClick={() => { setSelected(index); setOpen(true); }}><img src={`/pair-map/${situation.id}-v1.webp`} alt="" width={560} height={700} loading="lazy" /><span className={styles.cardNumber}>0{index + 1}</span><span className={styles.cardCaption}><strong>{situation.title}</strong><small>{situation.subtitle}</small><span>Посмотреть подсказку <span aria-hidden="true">↗</span></span></span></button>)}</div>
    <details id="situation-detail" className={styles.situationDetail} open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary>{detail.title} — ваша подсказка<span aria-hidden="true">+</span></summary><div className={styles.situationBody}><p className={styles.evidence}>Основа: {detail.label} · {guide.subject.firstName} {detail.score}/100 · {guide.other.firstName} {detail.otherScore}/100</p><div className={styles.detailColumns}><div><p>{detail.hypothesis}</p><p><strong>Другая перспектива:</strong> {guide.other.firstName}: возможная потребность — {detail.partnerNeed}.</p></div><div className={styles.tip}><h3>Что попробовать</h3><p>{detail.action}</p><blockquote>{detail.phrase}</blockquote></div></div><p><strong>Вопрос друг другу:</strong> {detail.question}</p>{detail.caution && <p className={styles.note}>{detail.caution}</p>}</div></details>
  </section>;
}
