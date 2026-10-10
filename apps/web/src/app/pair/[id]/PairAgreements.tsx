"use client";
import { useEffect, useState } from "react";
import { PAIR_AGREEMENT_DEFAULTS, PAIR_AGREEMENT_TITLES, PAIR_MAP_MAX_TEXT, parsePairMapText, type AgreementSlot, type PairMapSnapshot } from "@grani/core";
import { usePairShared } from "./PairSharedState";
import { PairIcon } from "./PairIcon";
import styles from "./pair-map.module.css";
type Agreement = PairMapSnapshot["agreements"][number];
function AgreementCard({ agreement }: { agreement: Agreement }) {
  const { snapshot, busy, dispatch } = usePairShared(); const { slot, draft, proposal } = agreement;
  const initial = () => draft.revision ? draft.text : PAIR_AGREEMENT_DEFAULTS[slot];
  const [text, setText] = useState<string>(initial), [dirty, setDirty] = useState(false);
  const [draftRevision, setDraftRevision] = useState(draft.revision), [proposalRevision, setProposalRevision] = useState(proposal?.revision ?? 0);
  useEffect(() => { if (!dirty) { setText(draft.revision ? draft.text : PAIR_AGREEMENT_DEFAULTS[slot]); setDraftRevision(draft.revision); setProposalRevision(proposal?.revision ?? 0); } }, [draft.text, draft.revision, proposal?.revision, dirty, slot]);
  const disabled = busy || !!snapshot?.consentRequired;
  async function save(propose: boolean) {
    const result = await dispatch({ kind: propose ? "agreement_propose" : "agreement_draft", slot, text, expectedRevision: propose ? proposalRevision : draftRevision }, propose ? "Предложение опубликовано. Каждый подтверждает эту версию отдельно." : "Личный черновик договорённости сохранён.");
    if (result?.ok) {
      const current = result.snapshot.agreements[slot]!;
      setProposalRevision(current.proposal?.revision ?? 0);
      // Publishing does not overwrite the separate personal draft or the edited text.
      if (!propose) { setDraftRevision(current.draft.revision); setText(current.draft.text); setDirty(false); }
    }
  }
  const conflict = dirty && (draftRevision !== draft.revision || proposalRevision !== (proposal?.revision ?? 0));
  return <div className={styles.agreement} data-agreement-slot={slot}>
    <label htmlFor={`agreement-${slot}`}><PairIcon name={(["talk", "life", "heart"] as const)[slot]} /><span>0{slot + 1}</span> {PAIR_AGREEMENT_TITLES[slot]}</label>
    <textarea id={`agreement-${slot}`} rows={4} value={text} disabled={busy} onChange={e => { setText(e.target.value); setDirty(true); }} />
    <small>{Array.from(text).length}/{PAIR_MAP_MAX_TEXT} · личный черновик{dirty ? " · изменён" : ""}</small>
    <div className={styles.actions}><button className="button button--ghost" type="button" disabled={disabled || parsePairMapText(text, true) === null} onClick={() => void save(false)}>Сохранить личный черновик</button><button className="button" type="button" disabled={disabled || parsePairMapText(text) === null} onClick={() => void save(true)}>Предложить партнёру</button></div>
    {conflict && <div className={styles.conflict}><p>Сохранённая версия изменилась. Ваш ввод остался в поле. Текущий личный черновик: {draft.text || "пусто"}.</p><button className="button button--ghost" type="button" onClick={() => { setDraftRevision(draft.revision); setProposalRevision(proposal?.revision ?? 0); }}>Применить текущие версии для отправки</button></div>}
    {proposal ? <div className={styles.proposal}><p className={styles.kicker}>Версия {proposal.revision} · {proposal.proposedByYou ? "ваше предложение" : "предложение партнёра"}</p><p>{proposal.text}</p><p className={styles.note}>{proposal.confirmedByYou && proposal.confirmedByPartner ? "Подтверждено обоими" : `Вы: ${proposal.confirmedByYou ? "подтвердили" : "не подтвердили"}. Партнёр: ${proposal.confirmedByPartner ? "подтвердил(а)" : "не подтвердил(а)"}.`}</p><button className="button button--ghost" type="button" disabled={disabled} onClick={() => void dispatch({ kind: proposal.confirmedByYou ? "agreement_retract" : "agreement_confirm", slot, expectedRevision: proposal.revision }, proposal.confirmedByYou ? "Ваше подтверждение отозвано." : "Вы подтвердили текущую версию.")}>{proposal.confirmedByYou ? "Отозвать моё подтверждение" : "Подтвердить эту версию"}</button></div> : <p className={styles.note}>Общего предложения ещё нет. Личный черновик партнёру не виден.</p>}
  </div>;
}
export function PairAgreements() {
  const { snapshot, busy, storageKey, dispatch } = usePairShared();
  const [legacy, setLegacy] = useState<string[] | null>(null), [transferStatus, setTransferStatus] = useState("");
  useEffect(() => { try { const raw = sessionStorage.getItem(storageKey); const values: unknown = raw ? JSON.parse(raw) : null; if (Array.isArray(values) && values.length === 3 && values.every(v => parsePairMapText(v, true) !== null)) setLegacy(values); } catch { /* Storage can be disabled. Nothing is uploaded. */ } }, [storageKey]);
  if (!snapshot) return null;
  async function transfer() {
    if (!legacy || !snapshot) return;
    let latest = snapshot;
    for (const slot of [0, 1, 2] as AgreementSlot[]) {
      const result = await dispatch({ kind: "agreement_draft", slot, text: legacy[slot]!, expectedRevision: latest.agreements[slot]!.draft.revision }, "Переносим личные черновики…");
      if (!result?.ok) { setTransferStatus("Перенос не завершён. Оригинал в этой вкладке сохранён."); return; }
      latest = result.snapshot;
    }
    try { sessionStorage.removeItem(storageKey); } catch { /* Server copies remain available. */ }
    setLegacy(null); setTransferStatus("Три личных черновика перенесены. Партнёр их не видит.");
  }
  return <section id="agreements" className={styles.section} aria-labelledby="agreements-title"><header className={styles.sectionHead}><div><p className={styles.kicker}>06 / Наши договорённости</p><h2 id="agreements-title">Три шага к своему балансу</h2></div></header><p className={styles.sectionIntro}>Сначала личный черновик, затем общее предложение. Подтверждение каждого относится к одной версии. Правка сбрасывает оба подтверждения.</p>
    {legacy && <div className={styles.consent}><h3>Черновики из этой вкладки</h3><p>Они пока остаются в браузере. Перенос сохранит их как ваши личные черновики на сервере.</p><details><summary>Посмотреть перед переносом</summary>{legacy.map((text, i) => <p key={i}>{text || "Пустой черновик"}</p>)}</details><button className="button" type="button" disabled={busy || snapshot.consentRequired} onClick={() => void transfer()}>Перенести в личные черновики</button></div>}
    {transferStatus && <p role="status">{transferStatus}</p>}<div className={styles.agreements}>{snapshot.agreements.map(agreement => <AgreementCard key={agreement.slot} agreement={agreement} />)}</div>
  </section>;
}
