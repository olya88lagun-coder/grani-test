"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { PairMapCommand, PairMapSnapshot } from "@grani/core";
import { PAIR_CLIENT_MESSAGES, pairAccessClosed, requestPairMap, type PairClientOutcome } from "@/lib/pair-map-client";
import styles from "./pair-map.module.css";
type SharedContext = { snapshot: PairMapSnapshot | null; busy: boolean; status: string; storageKey: string; dispatch: (command: PairMapCommand, message: string) => Promise<PairClientOutcome | null> };
const Shared = createContext<SharedContext | null>(null);
export function usePairShared() { const value = useContext(Shared); if (!value) throw new Error("Missing pair state"); return value; }
export function PairSharedState({ pairId, initialSnapshot, storageKey, children }: { pairId: string; initialSnapshot: PairMapSnapshot | null; storageKey: string; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(initialSnapshot ? "" : "Общие данные временно недоступны. Базовая карта остаётся доступной.");
  const lock = useRef(false), abort = useRef<AbortController | null>(null);
  const run = useCallback(async (command?: PairMapCommand, message?: string): Promise<PairClientOutcome | null> => {
    if (lock.current) return null;
    lock.current = true; setBusy(true);
    const controller = new AbortController(); abort.current = controller;
    try {
      const result = await requestPairMap(pairId, command, fetch, controller.signal);
      if (controller.signal.aborted) return null;
      if (result.ok) { setSnapshot(result.snapshot); if (message) setStatus(message); }
      else {
        if (pairAccessClosed(result.error)) setSnapshot(null);
        if (result.error === "stale_version" || result.error === "consent_required") {
          const latest = await requestPairMap(pairId, undefined, fetch, controller.signal);
          if (!controller.signal.aborted) {
            if (latest.ok) setSnapshot(latest.snapshot);
            else if (pairAccessClosed(latest.error)) setSnapshot(null);
          }
        }
        setStatus(PAIR_CLIENT_MESSAGES[result.error]);
      }
      return result;
    } finally { lock.current = false; if (!controller.signal.aborted) setBusy(false); }
  }, [pairId]);
  useEffect(() => () => abort.current?.abort(), []);
  const waiting = !!snapshot && (snapshot.survey.mine.published !== null && !snapshot.survey.partner.submitted || snapshot.agreements.some(a => a.proposal && !(a.proposal.confirmedByYou && a.proposal.confirmedByPartner)));
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void run(); };
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    const timer = waiting ? window.setInterval(update, 20_000) : null;
    return () => { window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); if (timer !== null) window.clearInterval(timer); };
  }, [run, waiting]);
  return <Shared.Provider value={{ snapshot, busy, status, storageKey, dispatch: (command, message) => run(command, message) }}>
    <div className={styles.sharedToolbar}><button className="button button--ghost" type="button" disabled={busy} onClick={() => void run(undefined, "Общие данные обновлены.")}>Обновить общие данные</button><p role="status" aria-live="polite">{status || "Черновики личные. Публикация и подтверждение — отдельные действия."}</p></div>{children}
  </Shared.Provider>;
}
