"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { reachGoalOnce } from "@/lib/analytics";

export function ScrollPairHero({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = ref.current;
    const section = scene?.closest("[data-pair-scroll-section]");
    const steps = section?.querySelector("#pair-how");
    const stones = scene?.firstElementChild;
    if (!scene || !section || !steps || !stones || !window.matchMedia || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    let visible = false;
    let frame = 0;

    function paint() {
      frame = 0;
      if (!scene || !steps || !stones || !motion.matches) return;
      const viewport = window.innerHeight;
      const scroll = window.scrollY;
      const sceneTop = stones.getBoundingClientRect().top + scroll;
      const stepsTop = steps.getBoundingClientRect().top + scroll;
      const start = Math.max(0, sceneTop - viewport * .66);
      const end = Math.max(start + 150, Math.min(sceneTop + viewport * .08, stepsTop - viewport * .66));
      const progress = Math.max(0, Math.min(1, (scroll - start) / (end - start)));
      scene.style.setProperty("--approach", progress.toFixed(3));
      scene.style.setProperty("--contact", Math.max(0, (progress - .68) / .32).toFixed(3));
      scene.dataset.pairInMotion = "";
      if (progress >= 1) reachGoalOnce("fx_pair_contact");
    }

    function schedule() {
      if (visible && motion.matches && !frame) frame = requestAnimationFrame(paint);
    }
    function preferenceChanged() {
      if (!motion.matches) scene?.removeAttribute("data-pair-in-motion");
      else schedule();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      schedule();
    });
    observer.observe(section);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener?.("change", preferenceChanged);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener?.("change", preferenceChanged);
    };
  }, []);

  return <div ref={ref} className={className} data-scroll-pair>{children}</div>;
}
