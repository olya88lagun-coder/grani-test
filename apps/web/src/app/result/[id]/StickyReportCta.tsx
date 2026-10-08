"use client";

import { useEffect, useState } from "react";
import { reachGoal } from "@/lib/analytics";

// На телефоне кнопка первого экрана быстро уезжает вверх — плашка снизу держит путь к разбору на виду.
// Прячется рядом с действиями и подвалом; запас снизу защищает кнопки до их появления в зоне плашки.
export function StickyReportCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = [document.querySelector(".result-hero__actions"), document.getElementById("report")?.closest("section"),
      ...document.querySelectorAll(".page--result .row, .page--result .result-block, .page--result .share-card__body, .footer")].filter(
      (target): target is Element => target != null,
    );
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setVisible(onScreen.size === 0);
    }, { rootMargin: "0px 0px 96px 0px" });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      className={visible ? "sticky-cta sticky-cta--visible" : "sticky-cta"}
      href="#report"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => reachGoal("report_click", { place: "sticky" })}
    >
      {label} <span aria-hidden="true">→</span>
    </a>
  );
}
