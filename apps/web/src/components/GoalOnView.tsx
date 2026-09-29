"use client";

import { useEffect, useRef } from "react";
import { reachGoal, type Goal } from "@/lib/analytics";

// Цель при открытии страницы — один раз за показ, даже если эффект запустится повторно
export function GoalOnView({ goal }: { goal: Goal }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    reachGoal(goal);
  }, [goal]);
  return null;
}
