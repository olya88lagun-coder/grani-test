"use client";
import { useEffect, useState } from "react";
import { emptySurveyAnswers, PAIR_MAP_MAX_TEXT, PAIR_MAP_QUESTIONS, parseSurveyAnswers, type SurveyAnswers } from "@grani/core";
import { PairMapConsent } from "./PairMapConsent";
import { usePairShared } from "./PairSharedState";
import styles from "./pair-map.module.css";
export function PairSurvey() {
  const { snapshot, busy, dispatch } = usePairShared();
  const [answers, setAnswers] = useState<SurveyAnswers>(snapshot?.survey.mine.draft ?? emptySurveyAnswers());
  const [revision, setRevision] = useState(snapshot?.survey.mine.revision ?? 0);
  const [dirty, setDirty] = useState(false), [deleting, setDeleting] = useState(false);
  useEffect(() => { if (!dirty && snapshot) { setAnswers(snapshot.survey.mine.draft); setRevision(snapshot.survey.mine.revision); } }, [snapshot, dirty]);
  if (!snapshot) return null;
  const mine = snapshot.survey.mine, partner = snapshot.survey.partner;
  const validDraft = !!parseSurveyAnswers(answers, false), complete = !!parseSurveyAnswers(answers, true);
  const disabled = busy || snapshot.consentRequired;
  async function save(publish: boolean) {
    const result = await dispatch({ kind: publish ? "survey_submit" : "survey_draft", answers, expectedRevision: revision }, publish ? "Ответы опубликованы. Они раскроются, когда опубликуют оба." : "Личный черновик сохранён. Партнёр его не видит.");
    if (result?.ok) { setAnswers(result.snapshot.survey.mine.draft); setRevision(result.snapshot.survey.mine.revision); setDirty(false); }
  }
  return <section className={styles.section} aria-labelledby="survey-title" id="pair-survey"><p className={styles.kicker}>Ваши ответы вдвоём</p><h2 id="survey-title">Как это устроено у вас?</h2><p className={styles.sectionIntro}>Восемь вопросов для разговора. Ваши ответы не меняют индекс и результаты теста. Можно пропустить любой вопрос.</p><PairMapConsent />
    <p className={styles.note}>{mine.published ? `Вы опубликовали ответы · версия ${mine.published.revision}. Личная правка не меняет её до повторной публикации.` : "Ваши ответы ещё не опубликованы."} {partner.submitted ? "Партнёр опубликовал ответы." : "Партнёр пока не опубликовал ответы."}</p>
    <div className={styles.surveyGrid}>{PAIR_MAP_QUESTIONS.map(({ id, title, question }, i) => <fieldset className={styles.surveyQuestion} key={id}><legend>0{i + 1} · {title}</legend><p>{question}</p><label htmlFor={`answer-${id}`}>Ответ: {title}</label><textarea id={`answer-${id}`} rows={3} value={answers[id].text} disabled={busy || answers[id].skipped} onChange={e => { setAnswers(v => ({ ...v, [id]: { text: e.target.value, skipped: false } })); setDirty(true); }} aria-describedby={`count-${id}`} /><small id={`count-${id}`}>{Array.from(answers[id].text).length}/{PAIR_MAP_MAX_TEXT}</small><label className={styles.check}><input id={`skip-${id}`} type="checkbox" disabled={busy} checked={answers[id].skipped} onChange={e => { setAnswers(v => ({ ...v, [id]: { text: "", skipped: e.target.checked } })); setDirty(true); }} />Пропустить этот вопрос</label></fieldset>)}</div>
    {dirty && <p className={styles.note}>Есть несохранённый ввод. Обновление страницы его не сохранит.</p>}
    {dirty && revision !== mine.revision && <div className={styles.conflict}><p>На сервере другая версия личного черновика. Сверьте её перед сохранением.</p><details><summary>Показать сохранённые ответы</summary>{PAIR_MAP_QUESTIONS.map(q => <p key={q.id}><strong>{q.title}: </strong>{mine.draft[q.id].skipped ? "Пропущено" : mine.draft[q.id].text || "Не заполнено"}</p>)}</details><button className="button button--ghost" type="button" onClick={() => setRevision(mine.revision)}>Сохранить мой ввод поверх этой версии</button></div>}
    <div className={styles.actions}><button className="button button--ghost" type="button" disabled={disabled || !validDraft} onClick={() => void save(false)}>Сохранить мои ответы</button><button className="button" type="button" disabled={disabled || !complete} onClick={() => void save(true)}>Опубликовать мои ответы</button><button className="button button--ghost" type="button" disabled={busy} onClick={() => setDeleting(true)}>Удалить мои ответы</button></div>
    {deleting && <div className={styles.conflict}><p>Удалится ваш личный черновик и публикация. Ответы партнёра снова скроются у вас. Уже скачанные копии PDF останутся у скачавшего.</p><div className={styles.actions}><button className="button" type="button" disabled={busy} onClick={async () => { const result = await dispatch({ kind: "survey_delete", expectedRevision: mine.revision }, "Ваши ответы удалены. Ответы партнёра скрыты."); if (result?.ok) { setDirty(false); setAnswers(result.snapshot.survey.mine.draft); setRevision(result.snapshot.survey.mine.revision); setDeleting(false); } }}>Удалить ответы окончательно</button><button className="button button--ghost" type="button" onClick={() => setDeleting(false)}>Отмена</button></div></div>}
    {mine.published && partner.published && <div className={styles.sharedAnswers} data-shared-answers><h3>Ответы раскрыты обоим</h3><p className={styles.note}>Ваша публикация · версия {mine.published.revision}. Публикация партнёра · версия {partner.published.revision}. Новая версия означает изменение ответов.</p>{PAIR_MAP_QUESTIONS.map(q => <article key={q.id}><h4>{q.title}</h4><div className={styles.answerColumns}><div><strong>Вы</strong><p>{mine.published!.answers[q.id].skipped ? "Вопрос пропущен" : mine.published!.answers[q.id].text}</p></div><div><strong>Партнёр</strong><p>{partner.published!.answers[q.id].skipped ? "Вопрос пропущен" : partner.published!.answers[q.id].text}</p></div></div></article>)}</div>}
  </section>;
}
