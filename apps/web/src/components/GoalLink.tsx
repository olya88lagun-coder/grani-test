"use client";

import type { ReactNode } from "react";
import { reachGoal, type Goal } from "@/lib/analytics";

// Обычная ссылка, которая при нажатии отмечает цель Метрики
export function GoalLink({ href, className, goal, children }: { href: string; className: string; goal: Goal; children: ReactNode }) {
  return (
    <a className={className} href={href} onClick={() => reachGoal(goal)}>
      {children}
    </a>
  );
}
