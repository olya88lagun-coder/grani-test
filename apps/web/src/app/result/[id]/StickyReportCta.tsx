"use client";

import { useEffect, useState } from "react";

// На телефоне кнопка первого экрана быстро уезжает вверх — плашка снизу держит путь к разбору на виду.
// Прячется, пока видна кнопка первого экрана или сам блок покупки: две одинаковые кнопки рядом не нужны.
export function StickyReportCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = [document.querySelector(".result-hero__actions"), document.getElementById("report")?.closest("section")].filter(
      (target): target is Element => target != null,
    );
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setVisible(onScreen.size === 0);
    });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <a className={visible ? "sticky-cta sticky-cta--visible" : "sticky-cta"} href="#report" aria-hidden={!visible} tabIndex={visible ? 0 : -1}>
      {label} <span aria-hidden="true">→</span>
    </a>
  );
}
