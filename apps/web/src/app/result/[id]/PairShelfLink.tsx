"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { reachGoal, reachGoalOnce } from "@/lib/analytics";
import styles from "./pair-shelf.module.css";

export function PairShelfLink({ href, recent, children }: { href: string; recent: boolean; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const link = ref.current;
    if (!link || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      reachGoalOnce("fx_shelf_seen");
      if (recent) link.dataset.newPairFlash = "";
      observer.disconnect();
    }, { threshold: .5 });
    observer.observe(link);
    return () => observer.disconnect();
  }, [recent]);

  return <Link ref={ref} href={href} className={`pair-block__item ${styles.item}`} onClick={() => reachGoal("fx_shelf_open")}>{children}</Link>;
}
