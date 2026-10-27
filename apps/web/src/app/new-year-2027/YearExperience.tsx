"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildYearMap, EMPTY_EDITS, parseYearDraft, QUESTIONS, YEAR_VERSION, type YearAnswers, type YearEdits } from "@/lib/new-year-2027";
import { trackYearEvent } from "@/lib/new-year-analytics";
import { validProfile } from "@/lib/new-year-2027";
import type { YearProfile } from "@/server/new-year-profile";
import { YearQuestion } from "./YearQuestion";
import { YearLanding } from "./YearLanding";
import { YearResult } from "./YearResult";
import styles from "./new-year.module.css";

const DRAFT_KEY = "grani-new-year-2027-v1";
export function YearExperience() {
  const [screen, setScreen] = useState<"intro" | "question" | "result">("intro");
  const [answers, setAnswers] = useState<YearAnswers>({});
  const [edits, setEdits] = useState<YearEdits>(EMPTY_EDITS);
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [profile, setProfile] = useState<YearProfile | { status: "loading" }>({ status: "loading" });
  const [useProfile, setUseProfile] = useState(true);
  const title = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  const loadProfile = useCallback(async () => {
    setProfile({ status: "loading" });
    try {
      const response = await fetch("/api/new-year-2027/profile", { cache: "no-store", credentials: "same-origin" });
      const data: unknown = await response.json();
      if (data && typeof data === "object" && "status" in data) {
        if (response.ok && data.status === "available" && "scores" in data && validProfile(data.scores)) {
          setProfile({ status: "available", scores: data.scores }); return;
        }
        if (response.ok && (data.status === "guest" || data.status === "missing")) { setProfile({ status: data.status }); return; }
      }
      setProfile({ status: "unavailable" });
    } catch { setProfile({ status: "unavailable" }); }
  }, []);
  useEffect(() => {
    try {
      const saved = parseYearDraft(sessionStorage.getItem(DRAFT_KEY));
      if (saved) { setAnswers(saved.answers); setEdits(saved.edits); setUseProfile(saved.useProfile); setStep(saved.step); setScreen(saved.result ? "result" : "question"); }
    } catch { setStorageUnavailable(true); }
    setHydrated(true);
    void loadProfile();
  }, [loadProfile]);
  useEffect(() => {
    if (!hydrated || screen === "intro") return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: YEAR_VERSION, answers, edits, useProfile, step, result: screen === "result" })); }
    catch { setStorageUnavailable(true); }
  }, [answers, edits, useProfile, step, screen, hydrated]);
  useEffect(() => { if (interacted.current) title.current?.focus(); }, [screen, step]);

  function begin() { interacted.current = true; setScreen("question"); trackYearEvent("new_year_start"); }
  function changeAnswer(value: string) {
    const id = QUESTIONS[step]!.id;
    if ((answers[id] || "") !== value) {
      if (id === "goal" || id === "direction") setEdits((old) => ({ ...old, firstStep: null }));
      if (id === "obstacle") setEdits((old) => ({ ...old, ifThen: null }));
    }
    setAnswers((old) => ({ ...old, [id]: value }));
  }
  function advance(value: string) {
    interacted.current = true;
    changeAnswer(value);
    if (step === 5) { setScreen("result"); trackYearEvent("new_year_complete"); }
    else setStep((old) => old + 1);
  }
  function restart() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* In-memory state is cleared too. */ }
    setAnswers({}); setEdits(EMPTY_EDITS); setStep(0); setScreen("intro"); setUseProfile(true); interacted.current = true;
  }
  const map = buildYearMap(answers, useProfile && profile.status === "available" ? profile.scores : undefined);
  return (
    <main className={styles.page} data-night-entry data-band="night">
      <div className={styles.topline}><span>Новогодний спецпроект</span><span>2026 / 2027</span></div>
      {screen === "intro" ? <>
        <section className={styles.hero} aria-labelledby="year-title">
          <div className={styles.heroBackdrop} aria-hidden="true"><Image src="/new-year-2027/winter-hero-v2.webp" alt="" fill priority sizes="100vw" /></div>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Новый год. Свои ориентиры.</p>
            <h1 id="year-title" ref={title} tabIndex={-1} className={styles.heroTitle}>Мои грани<span>2027</span></h1>
            <p className={styles.lead}>Не становиться другим.<br />Стать чуть ближе к себе.</p>
            <p className={styles.introText}>Оглянись на свой год. Забери важное.<br />Найди один шаг в следующий.</p>
            <button type="button" className={styles.primary} onClick={begin} disabled={!hydrated}>Собрать мою карту <span aria-hidden="true">↗</span></button>
            <p className={styles.fine}>6 вопросов · около 3 минут · бесплатно</p>
          </div>
          <div className={styles.heroArt} aria-hidden="true"><Image src="/home/hero-crystal.webp" alt="" width={900} height={1080} priority sizes="(max-width: 700px) 260px, 480px" /><span className={styles.artCaption}>Всё важное уже есть в тебе</span></div>
        </section>
        <section className={styles.introFoot} aria-label="О карте"><p>Твой год — не список достижений.<br /><span>Здесь можно отвечать как есть. И пропускать.</span></p><p>В конце — личная карта 2027:<br /><span>слово года, опоры, первый шаг и запасной план.</span></p></section>
        <YearLanding onStart={begin} disabled={!hydrated} />
      </> : screen === "question" ?
        <YearQuestion key={step} question={QUESTIONS[step]!} step={step} value={answers[QUESTIONS[step]!.id] || ""} titleRef={title} onChange={changeAnswer} onNext={advance} onBack={() => { interacted.current = true; if (step === 0) setScreen("intro"); else setStep(step - 1); }} />
        : <YearResult map={map} edits={edits} onEdits={setEdits} titleRef={title} onEdit={() => { interacted.current = true; setStep(0); setScreen("question"); }} profileStatus={profile.status} />}
      <aside className={styles.privacy} aria-label="Приватность и профиль">
        <p>{storageUnavailable ? "Хранилище браузера недоступно. Ответы сохраняются только до перезагрузки страницы." : "Ответы хранятся только в этой вкладке браузера. На сервер они не отправляются."}</p>
        {profile.status === "loading" && <p role="status">Проверяем, есть ли твой профиль Big Five…</p>}
        {profile.status === "available" && <label className={styles.check}><input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} />Учитывать мой сохранённый профиль Big Five</label>}
        {profile.status === "guest" && <p>Можно без входа. Big Five уже пройден? <a href="/login">Войди через VK ID</a>, затем вернись сюда и <button className={styles.textButton} onClick={() => void loadProfile()}>обнови профиль</button>.</p>}
        {profile.status === "missing" && <p>Сохранённого Big Five пока нет. Карта будет опираться на твои ответы. <a href="/test">Пройти Big Five</a></p>}
        {profile.status === "unavailable" && <p role="status">Профиль сейчас недоступен. Можно продолжить по ответам. <button className={styles.textButton} onClick={() => void loadProfile()}>Проверить снова</button></p>}
        {screen !== "intro" && <button type="button" onClick={restart} className={styles.textButton}>Удалить ответы и начать заново</button>}
      </aside>
    </main>
  );
}
