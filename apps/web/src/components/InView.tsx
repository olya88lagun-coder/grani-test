"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Движение «при показе» нужно, только если блок ещё ниже экрана: то, что видно сразу, не сбрасываем.
// Без JS и при reduced-motion блок остаётся в финальном виде.
function waitsBelowFold(el: HTMLElement) {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && el.getBoundingClientRect().top > window.innerHeight;
}

function onFirstView(el: HTMLElement, threshold: number, show: () => void) {
  const io = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return;
    io.disconnect();
    show();
  }, { threshold });
  io.observe(el);
  return () => io.disconnect();
}

/** Ставит data-inview="false" до показа и "true" при показе — CSS запускает по нему анимацию. */
export function InView({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<boolean>();
  useEffect(() => {
    const el = ref.current;
    if (!el || !waitsBelowFold(el)) return;
    setInView(false);
    return onFirstView(el, 0.4, () => setInView(true));
  }, []);
  return <div ref={ref} className={className} data-inview={inView}>{children}</div>;
}

/** Число набегает от 0 до value при первом показе. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !waitsBelowFold(el)) return;
    const show = (n: number) => { el.textContent = `${n}${suffix}`; };
    show(0);
    let frame = 0;
    const stop = onFirstView(el, 0.6, () => {
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / 900);
        show(Math.round(value * (1 - (1 - k) ** 3)));
        if (k < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return () => { stop(); cancelAnimationFrame(frame); show(value); };
  }, [value, suffix]);
  return <span ref={ref}>{`${value}${suffix}`}</span>;
}
