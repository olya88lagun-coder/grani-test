"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { reachGoalOnce } from "@/lib/analytics";
import styles from "./roadmap-trail.module.css";

export function RoadmapTrail({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = ref.current;
    if (!list || !("IntersectionObserver" in window) || !window.matchMedia) return;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !motion.matches) continue;
        entry.target.closest("li")?.setAttribute("data-lit-stop", "");
        reachGoalOnce("fx_trail_seen");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    for (const item of Array.from(list.children)) {
      const stone = item.querySelector("[data-roadmap-stone]");
      if (stone) observer.observe(stone);
    }
    return () => observer.disconnect();
  }, []);

  return <ol ref={ref} className={[className, styles.trail].filter(Boolean).join(" ")} data-season-trail>{children}</ol>;
}
