"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ClientPracticeDraft<T> = { revision: number; schemaVersion: number; data: T };
export type PracticeSaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";
export function usePracticeDraft<T>({ endpoint, initial, validate }: { endpoint: string; initial: ClientPracticeDraft<T>; validate: (value: unknown) => T | null }) {
  const [data, setData] = useState(initial.data), [status, setStatus] = useState<PracticeSaveState>("idle"), [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const current = useRef(initial.data), revision = useRef(initial.revision), saved = useRef<string | null>(JSON.stringify(initial.data));
  const busy = useRef(false), blocked = useRef<"error" | "conflict" | null>(null), generation = useRef(0);
  const waiters = useRef<(() => void)[]>([]), storageKey = `grani-practice:${endpoint}:v${initial.schemaVersion}`;
  const persist = useCallback(() => {
    try {
      if (!busy.current && !blocked.current && JSON.stringify(current.current) === saved.current) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify({ revision: revision.current, data: current.current, uncertain: saved.current === null || busy.current }));
    } catch { /* Server save stays available when browser storage is disabled. */ }
  }, [storageKey]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const pending = JSON.parse(raw), recovered = validate(pending.data);
        if (recovered && Number.isSafeInteger(pending.revision) && pending.revision >= 0 && (pending.uncertain === true || JSON.stringify(recovered) !== saved.current)) {
          current.current = recovered; setData(recovered);
          // A request from the previous page may still commit after this GET.
          // Equal values alone cannot confirm an uncertain previous write.
          if (pending.uncertain === true) saved.current = null;
          blocked.current = pending.revision === revision.current ? null : "conflict";
          setStatus(blocked.current ?? "dirty");
          setMessage("Восстановлены правки этой вкладки. Их сохранение в аккаунте ещё не подтверждено.");
        }
      }
    } catch { /* Corrupt local recovery must not replace owner-checked server data. */ }
    setReady(true);
  }, [storageKey, validate]);
  const flush = useCallback(async () => {
    if (busy.current) { await new Promise<void>(resolve => waiters.current.push(resolve)); return; }
    if (blocked.current) return;
    busy.current = true;
    try {
      while (JSON.stringify(current.current) !== saved.current) {
        const snapshot = structuredClone(current.current), expectedRevision = revision.current;
        // Until acknowledgement arrives the server may contain this snapshot.
        // Even reverting to the previous value is new intent, not a confirmed save.
        saved.current = null;
        setStatus("saving"); setMessage(""); persist();
        const response = await fetch(endpoint, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision, data: snapshot }) });
        if (!response.ok) {
          blocked.current = response.status === 409 ? "conflict" : "error"; setStatus(blocked.current);
          setMessage(response.status === 409 ? "Есть другая версия в аккаунте. Правки здесь не перезаписали её. Скачай черновик перед загрузкой другой версии." : response.status === 401 ? "Сессия истекла. Скачай черновик перед повторным входом." : "Не удалось подтвердить сохранение. Повтори попытку или скачай черновик.");
          return;
        }
        const payload = await response.json();
        if (!payload.ok || payload.draft?.revision !== expectedRevision + 1 || payload.draft.schemaVersion !== initial.schemaVersion || !validate(payload.draft.data)) throw Error("Invalid acknowledgement");
        revision.current = payload.draft.revision; saved.current = JSON.stringify(snapshot); persist();
      }
      setStatus("saved");
    } catch {
      blocked.current = "error"; setStatus("error"); setMessage("Нет подтверждения сохранения. Правки остаются в этой вкладке. Можно повторить попытку или скачать черновик.");
    } finally { busy.current = false; persist(); waiters.current.splice(0).forEach(resolve => resolve()); }
  }, [endpoint, initial.schemaVersion, persist, validate]);
  const update = useCallback((change: (data: T) => T) => {
    const next = change(current.current); generation.current++; current.current = next; setData(next); persist();
    if (!blocked.current) setStatus(busy.current ? "saving" : JSON.stringify(next) === saved.current ? "saved" : "dirty");
  }, [persist]);
  useEffect(() => {
    if (!ready || blocked.current || JSON.stringify(data) === saved.current) return;
    const timer = setTimeout(() => void flush(), 700); return () => clearTimeout(timer);
  }, [data, flush, ready]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (JSON.stringify(current.current) !== saved.current || busy.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const a = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || a.hasAttribute("download") || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      if (JSON.stringify(current.current) === saved.current && !busy.current) return;
      event.preventDefault(); event.stopPropagation();
      void (async () => { await flush(); if (!blocked.current && JSON.stringify(current.current) === saved.current) location.assign(url.href); else setMessage("Переход отложен: сохрани правки или скачай черновик перед уходом."); })();
    };
    window.addEventListener("beforeunload", protect); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", protect); document.removeEventListener("click", navigate, true); };
  }, [flush]);
  const retry = () => { if (blocked.current === "conflict") return; blocked.current = null; void flush(); };
  const loadServer = async () => {
    if (busy.current) return;
    busy.current = true; const atStart = generation.current; setStatus("saving");
    try {
      const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw Error("Read failed");
      const payload = await response.json(), next = validate(payload.draft?.data);
      if (!payload.ok || !next || !Number.isSafeInteger(payload.draft.revision) || payload.draft.schemaVersion !== initial.schemaVersion) throw Error("Invalid draft");
      if (generation.current !== atStart) { blocked.current = "conflict"; setStatus("conflict"); setMessage("Во время загрузки появились новые правки. Они остаются здесь. Повтори загрузку, когда захочешь их заменить."); return; }
      current.current = next; saved.current = JSON.stringify(next); revision.current = payload.draft.revision; blocked.current = null;
      setData(next); setStatus("saved"); setMessage(""); persist();
    } catch { blocked.current = "error"; setStatus("error"); setMessage("Не удалось загрузить версию из аккаунта. Правки здесь остаются доступны."); }
    finally { busy.current = false; waiters.current.splice(0).forEach(resolve => resolve()); }
  };
  return { data, update, status, message, ready, saveNow: flush, retry, loadServer };
}
