"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MoneyAnswer, MoneyPracticeData, TraitScores } from "@grani/core";
import { buildMoneyMemo, directionDetails, financialObservations, MONEY_HABITS, MONEY_QUESTIONS, moneyDataSchema, RECALL_NOTE, recommendedHabit } from "@/lib/money-practice";
import { CompassWheel } from "./CompassWheel";
import { usePracticeDraft, type ClientPracticeDraft, type PracticeSaveState } from "./use-practice-draft";
import styles from "./MoneyPractice.module.css";

const validate = (value: unknown): MoneyPracticeData | null => { const parsed = moneyDataSchema.safeParse(value); return parsed.success ? parsed.data : null; };
const SAVE_LABELS: Record<PracticeSaveState, string> = { idle: "Прогресс загружен", dirty: "Есть несохранённые изменения", saving: "Сохраняем…", saved: "Сохранено в аккаунте", error: "Сохранение не подтверждено", conflict: "Есть другая версия в аккаунте" };
const SECTIONS = [{ id: "questions", label: "Вопросы" }, { id: "compass", label: "Компас" }, { id: "week", label: "Неделя" }, { id: "memo", label: "Памятка" }];
const LEVEL_LABELS = { high: "Выражена сильнее", low: "Выражена слабее", borderline: "Близко к середине" } as const;
// Ошибку и конфликт сохранения нельзя спрятать вместе с кнопками: блок «Данные» раскрывается, в шапке появляется ссылка на него
export const isSaveProblem = (status: PracticeSaveState) => status === "error" || status === "conflict";
function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function dayDate(start: string, offset: number) { const date = new Date(start + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + offset); return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }); }
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function MoneyPractice({ resultId, displayName, scores, initialDraft }: { resultId: string; displayName: string; scores: TraitScores; initialDraft: ClientPracticeDraft<MoneyPracticeData> }) {
  const draft = usePracticeDraft({ endpoint: `/api/report/${encodeURIComponent(resultId)}/practice/money`, initial: initialDraft, validate });
  const [questionIndex, setQuestionIndex] = useState(() => Math.max(0, initialDraft.data.answers.findIndex(a => a === null)));
  const [axisIndex, setAxisIndex] = useState(0), [dayIndex, setDayIndex] = useState(0), [notice, setNotice] = useState("");
  const data = draft.data, observations = financialObservations(scores), directions = directionDetails(data.answers);
  const question = MONEY_QUESTIONS[questionIndex]!, answered = data.answers.filter(a => a !== null).length;
  const habit = MONEY_HABITS.find(h => h.id === data.habit), active = directions[axisIndex]!, suggestedHabit = recommendedHabit(directions);
  const saveText = draft.ready ? SAVE_LABELS[draft.status] : "Подключаем сохранение…", saveProblem = isSaveProblem(draft.status);
  const backup = () => download(JSON.stringify({ resultId, practice: "money", schemaVersion: 1, data }, null, 2), "Грани-финансовый-компас-черновик.json", "application/json");
  const generateMemo = () => {
    if (data.memo && !window.confirm("Заменить текст памятки текущими наблюдениями? Сначала можно скачать свою версию.")) return;
    draft.update(before => ({ ...before, memo: buildMoneyMemo(before) }));
  };
  return <div className={styles.root} data-money-ready={draft.ready || undefined}>
    <a className={styles.skip} href="#money-questions">Перейти к вопросам</a>
    <div className={styles.layout}>
      <aside className={styles.navigation} aria-label="Разделы финансового практикума">
        <Link href={`/report/${resultId}`} className={styles.back}>К моему разбору</Link>
        <p className={styles.navTitle}>Деньги</p>
        <nav><ol>{SECTIONS.map((s, i) => <li key={s.id}><a href={`#money-${s.id}`}><span aria-hidden="true">{i + 1}</span>{s.label}</a></li>)}</ol></nav>
        <p className={styles.navNote}>Одна привычка.<br />Семь дней внимания к себе.</p>
      </aside>
      <div className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}><h1>Мой финансовый <em>компас</em></h1><p className={styles.lead}>Понять свои привычки.<br />Найти удобный способ обращаться с деньгами.</p><p className={styles.secondary}>{displayName}, здесь можно проверить знакомые реакции, выбрать одну привычку и наблюдать за ней семь дней.</p><a className={styles.primary} href={answered < 6 ? "#money-questions" : "#money-compass"}>{answered === 0 ? "Начать практикум" : "Продолжить практикум"}</a></div>
          <div className={styles.heroArt} aria-hidden="true"><Image src="/practice/money/gem.png" alt="" fill sizes="(max-width: 700px) 90vw, 440px" priority /></div>
          <div className={styles.heroFoot}><span>Твой приватный практикум · <strong role="status" data-practice-save>{saveText}</strong>{saveProblem && <> · <a href="#money-data">Открыть сохранение</a></>}</span><span>6 вопросов · 1 привычка · 7 дней</span></div>
        </header>
        <fieldset className={styles.controls} disabled={!draft.ready} aria-label="Инструменты финансового практикума">
          <section id="money-questions" className={styles.section} aria-labelledby="money-questions-title">
            <h2 id="money-questions-title">Как это происходит у тебя</h2><p className={styles.intro}>Выбирай то, что ближе к последним неделям. «Пока не знаю» — тоже ответ. Все варианты можно изменить.</p>
            <div className={styles.questionPanel}><div className={styles.questionProgress}><span>Вопрос {questionIndex + 1} из 6</span><span>Ответов: {answered} из 6</span></div>
              <fieldset className={styles.question}><legend>{question.title}</legend><p>{question.context}</p>{[...question.options, "Пока не знаю"].map((text, i) => { const answer = (["a", "b", "c", "unsure"] as MoneyAnswer[])[i]!; return <label key={questionIndex + ":" + i} className={styles.choice}><input type="radio" name={`money-question-${questionIndex}`} value={answer} checked={data.answers[questionIndex] === answer} onChange={() => draft.update(before => ({ ...before, answers: before.answers.map((a, index) => index === questionIndex ? answer : a) }))} /><span>{text}</span></label>; })}</fieldset>
              <div className={styles.questionActions}><button type="button" onClick={() => setQuestionIndex(i => i - 1)} disabled={questionIndex === 0}>Назад</button>{questionIndex < 5 ? <button type="button" className={styles.primary} disabled={data.answers[questionIndex] === null} onClick={() => setQuestionIndex(i => i + 1)}>Следующий вопрос</button> : <a className={styles.primary} href="#money-compass">Посмотреть мой компас</a>}</div>
            </div>
          </section>
          <section id="money-compass" className={styles.section} aria-labelledby="money-compass-title">
            <h2 id="money-compass-title">Четыре направления твоего компаса</h2><p className={styles.intro}>Выбери направление: здесь вывод по твоим ответам, шаг для знакомой ситуации и фраза, которая поможет. Это не оценка финансовой успешности, сектора показывают только твои ответы.</p>
            {directions.some(d => d.recall) && <p className={styles.recall}>{RECALL_NOTE}</p>}
            <div className={styles.compassLayout}>
              <CompassWheel directions={directions} activeIndex={axisIndex} onSelect={setAxisIndex} />
              <div className={styles.compassDetail} aria-live="polite">
                <div className={styles.directionArt}><Image src={`/practice/money/${active.image}.png`} alt="" fill sizes="(max-width: 700px) 90vw, 440px" /></div>
                <h3>{active.title}</h3><p className={styles.compassState}>{active.label}</p><p>{active.note}</p>
                <h4>Что попробовать: {active.situation}</h4><p>{active.action}</p><blockquote>{active.phrase}</blockquote>
                <details data-basis><summary>На какие ответы опирается вывод</summary><ul>{active.basis.map(b => <li key={b}>{b}</li>)}</ul></details>
                <a href="#money-questions">Вернуться к вопросам</a>
              </div>
            </div>
            <details className={styles.traits}><summary>Почему так: твои черты</summary><p className={styles.intro}>Пять ракурсов по твоим шкалам Big Five. Это гипотезы для проверки: характер не определяет доход, долги или финансовое поведение.</p>{observations.map(o => <div key={o.trait} className={styles.trait}><h4>{o.name}<span>{LEVEL_LABELS[o.level]}</span></h4><p>{o.text}</p><p className={styles.prompt}>{o.question}</p></div>)}</details>
          </section>
          <section id="money-week" className={styles.section} aria-labelledby="money-week-title"><div className={styles.weekCover}><Image src="/practice/money/week.png" alt="" fill sizes="(max-width: 700px) 100vw, 900px" /><div><h2 id="money-week-title">Одна привычка.<br />Семь небольших шагов.</h2><p>Не обещай себе изменить всё. Выбери один способ и посмотри, подходит ли он тебе.</p></div></div>
            {!data.startedOn ? <><fieldset className={styles.habitChoices}><legend>Что хочу попробовать</legend>{MONEY_HABITS.map(h => <label key={h.id} className={styles.habit}><input type="radio" name="money-habit" value={h.id} checked={data.habit === h.id} onChange={() => draft.update(before => ({ ...before, habit: h.id }))} /><span><strong>{h.title}{suggestedHabit === h.id && <em className={styles.recommended}>Подходит по твоим ответам</em>}</strong><span>{h.action}</span></span></label>)}</fieldset><button type="button" className={styles.primary} disabled={!data.habit} onClick={() => draft.update(before => ({ ...before, startedOn: localToday() }))}>Начать семь дней</button></> : <div className={styles.experiment}><h3>{habit?.title}</h3><p>{habit?.action}</p><p className={styles.secondary}>Начало: {dayDate(data.startedOn, 0)}. Отмечено дней: {data.done.filter(Boolean).length} из 7. Пропущенный день можно оставить без отметки.</p><div className={styles.dayNav} aria-label="Выбрать день эксперимента">{data.done.map((done, i) => <button type="button" key={i} aria-pressed={i === dayIndex} onClick={() => setDayIndex(i)}><span>День {i + 1}</span><span>{done ? "Отмечен" : "Без отметки"}</span></button>)}</div><div className={styles.dayPanel}><h4>День {dayIndex + 1} · {dayDate(data.startedOn, dayIndex)}</h4><label className={styles.check}><input type="checkbox" checked={data.done[dayIndex]} onChange={e => draft.update(before => ({ ...before, done: before.done.map((d, i) => i === dayIndex ? e.target.checked : d) }))} />Я попробовал(а) выбранный шаг</label><label htmlFor="money-day-note">Что заметил(а) сегодня</label><textarea id="money-day-note" rows={4} maxLength={2000} value={data.notes[dayIndex]} onChange={e => draft.update(before => ({ ...before, notes: before.notes.map((n, i) => i === dayIndex ? e.target.value : n) }))} placeholder="Что помогло? Что оказалось неудобным?" /></div><label htmlFor="money-reflection">Итог недели: что хочу оставить или изменить</label><textarea id="money-reflection" rows={3} maxLength={2000} value={data.reflection} onChange={e => draft.update(before => ({ ...before, reflection: e.target.value }))} /><p className={styles.secondary}>Здесь сохраняется один эксперимент. Памятку можно обновить после своих наблюдений.</p></div>}
          </section>
          <section id="money-memo" className={styles.section} aria-labelledby="money-memo-title"><h2 id="money-memo-title">Мои ориентиры — с собой</h2><p className={styles.intro}>Составь памятку из своих ответов и выбранной привычки. Отредактируй любые слова, чтобы она звучала по-твоему.</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={generateMemo}>{data.memo ? "Обновить по моим ответам" : "Составить мою памятку"}</button><button type="button" disabled={!data.memo} onClick={() => download(data.memo, "Мой-финансовый-компас.txt", "text/plain;charset=utf-8")}>Скачать памятку</button><button type="button" disabled={!data.memo} onClick={() => void navigator.clipboard.writeText(data.memo).then(() => setNotice("Памятка скопирована"), () => setNotice("Копирование недоступно. Можно скачать памятку или выделить текст."))}>Скопировать</button></div><label htmlFor="money-memo-text" className={styles.memoLabel}>Моя редактируемая памятка</label><textarea id="money-memo-text" rows={15} maxLength={8000} value={data.memo} onChange={e => draft.update(before => ({ ...before, memo: e.target.value }))} placeholder="Нажми «Составить мою памятку» или напиши свои ориентиры." />{notice && <p role="status">{notice}</p>}</section>
        </fieldset>
        <details id="money-data" className={styles.dataBlock} open={saveProblem ? true : undefined}>
          <summary>Данные и сохранение</summary>
          <p>Ответы, заметки и памятка сохраняются в аккаунте автоматически. Они доступны только тебе.</p>
          <div className={styles.actions}><button type="button" onClick={() => void draft.saveNow()} disabled={!draft.ready || ["saving", "error", "conflict"].includes(draft.status)}>Сохранить сейчас</button>{draft.status === "error" && <button type="button" onClick={draft.retry}>Повторить сохранение</button>}{draft.status === "conflict" && <button type="button" onClick={() => { if (window.confirm("Загрузить версию из аккаунта и заменить правки этой вкладки? Сначала можно скачать черновик.")) void draft.loadServer(); }}>Загрузить версию из аккаунта</button>}<button type="button" onClick={backup} disabled={!draft.ready}>Скачать черновик</button></div>
          {draft.message && <p className={styles.alert} role="alert">{draft.message}</p>}
        </details>
        <footer className={styles.footer}><p>Материал для самонаблюдения. Big Five не оценивает финансовую грамотность и не прогнозирует доход. Практикум не даёт индивидуальных инвестиционных рекомендаций.</p><Link href={`/report/${resultId}`}>Вернуться к моему разбору</Link></footer>
      </div>
    </div>
  </div>;
}
