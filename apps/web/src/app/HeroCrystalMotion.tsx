"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { reachGoalOnce } from "@/lib/analytics";

export function HeroCrystalMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = ref.current;
    const hero = scene?.closest(".home-hero");
    if (!scene || !hero || !window.matchMedia || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const fine = window.matchMedia("(pointer: fine)");
    let active = false;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    function render() {
      frame = 0;
      if (!scene || !hero || !active || !motion.matches) return;
      const box = (fine.matches ? hero : scene).getBoundingClientRect();
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      if (!box.width || !box.height) return;
      const x = pointer ? clamp(2 * (pointer.x - box.left) / box.width - 1) : 0;
      const y = fine.matches
        ? (pointer ? clamp(2 * (pointer.y - box.top) / box.height - 1) : 0)
        : clamp(1 - 2 * (box.top + box.height / 2) / window.innerHeight);
      scene.style.setProperty("--mx", x.toFixed(3));
      scene.style.setProperty("--my", y.toFixed(3));
    }

    function schedule() {
      if (active && motion.matches && frame === 0) frame = requestAnimationFrame(render);
    }

    function move(event: Event) {
      const input = event as PointerEvent;
      if (!fine.matches || input.pointerType !== "mouse") return;
      pointer = { x: input.clientX, y: input.clientY };
      reachGoalOnce("fx_hero_move");
      schedule();
    }

    function reset() {
      pointer = null;
      schedule();
    }

    function scroll() {
      if (!fine.matches) {
        reachGoalOnce("fx_hero_move");
        schedule();
      }
    }

    function preferenceChanged() {
      scene?.removeAttribute("data-crystal-reveal");
      if (active && motion.matches) scene?.setAttribute("data-crystal-reveal", "shown");
      schedule();
    }

    const observer = new IntersectionObserver(([entry]) => {
      active = Boolean(entry?.isIntersecting);
      if (active) reachGoalOnce("fx_hero_seen");
      if (active && motion.matches) {
        scene.dataset.crystalReveal = "shown";
        reachGoalOnce("fx_hero_labels");
      }
      if (!active) pointer = null;
      scene.toggleAttribute("data-crystal-in-view", active);
      schedule();
    }, { threshold: 0.25 });

    observer.observe(scene);
    hero.addEventListener("pointermove", move, { passive: true });
    hero.addEventListener("pointerleave", reset);
    window.addEventListener("scroll", scroll, { passive: true });
    motion.addEventListener?.("change", preferenceChanged);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
      window.removeEventListener("scroll", scroll);
      motion.removeEventListener?.("change", preferenceChanged);
    };
  }, []);

  return <div ref={ref} className="home-crystal" data-hero-crystal aria-label="Гранёная схема личности">{children}</div>;
}
