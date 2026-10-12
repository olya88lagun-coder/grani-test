"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatRub, PRODUCT_PRICES, type ChapterKind } from "@grani/core";
import type { PersonalityAtlas as AtlasModel } from "@/lib/personality-atlas";
import type { ReportPageView } from "@/lib/report-view";
import { EDITION_SPHERES, EDITION_TRAITS } from "@/lib/personal-edition-copy";
import { Paragraphs } from "@/components/Paragraphs";
import { BuyButton } from "@/components/BuyButton";
import { ShareCard } from "@/app/result/[id]/ShareCard";
import { AtlasInteraction, AtlasMemo } from "./AtlasEditableCards";
import { AtlasScenarios, AtlasWeek } from "./AtlasPractices";
import { Tabs, Section } from "./AtlasPrimitives";
import { ATLAS_COPY } from "./atlas-copy";
import { ChapterReading } from "./ChapterReading";
import { useAtlasDraft, type ClientAtlasDraft, type SaveState } from "./use-atlas-draft";
import atlasStyles from "./PersonalityAtlas.module.css";
import styles from "./PersonalEdition.module.css";

type View = "portrait" | "facets" | "life" | "memo" | "spheres";
const NAV: readonly { id: View; label: string }[] = [{id:"portrait",label:"Портрет"},{id:"facets",label:"Пять граней"},{id:"life",label:"В жизни"},{id:"memo",label:"Мой итог"},{id:"spheres",label:"4 сферы"}];
const SAVE: Record<SaveState,string> = {idle:"Приватный черновик загружен",dirty:"Есть несохранённые изменения",saving:"Сохраняем…",saved:"Сохранено в вашем аккаунте",error:"Сохранение не подтверждено",conflict:"Есть другая версия в аккаунте"};
const OLD_VIEWS: Record<string,View> = {"atlas-section-1":"facets","atlas-section-2":"portrait","atlas-section-3":"portrait","atlas-section-4":"life","atlas-section-5":"life","atlas-section-6":"memo","atlas-section-7":"life","atlas-section-8":"life","atlas-section-9":"memo","friends-report":"memo","chapters":"spheres",portrait:"portrait",strengths:"portrait","blind-spots":"portrait",manual:"memo"};
const OLD_TARGETS: Record<string,string> = {portrait:"edition-reading",strengths:"atlas-section-2","blind-spots":"atlas-section-3",manual:"edition-manual",chapters:"edition-spheres"};
export function editionViewForHash(hash:string):View {
  const id=hash.replace(/^#/,"");
  if(id.startsWith("edition-chapter-")) return "spheres";
  return NAV.find(n=>`edition-${n.id}`===id)?.id ?? OLD_VIEWS[id] ?? "portrait";
}
type Props = {resultId:string;displayName:string;typeName:string;model:AtlasModel;initialDraft:ClientAtlasDraft;view:ReportPageView;moneyPracticeAvailable:boolean;chapterPreviews?:Readonly<Partial<Record<ChapterKind,readonly string[]>>>};

export function PersonalEdition({resultId,displayName,typeName,model,initialDraft,view,moneyPracticeAvailable,chapterPreviews}:Props){
  const draft=useAtlasDraft(resultId,initialDraft);
  const [active,setActive]=useState<View>("portrait"),[trait,setTrait]=useState(0),[step,setStep]=useState(0),[ready,setReady]=useState(false),[chapter,setChapter]=useState<ChapterKind|null>(null),[notice,setNotice]=useState("");
  const navRef=useRef<HTMLElement>(null),titleRef=useRef<HTMLHeadingElement>(null);
  const rootRef=useRef<HTMLDivElement>(null);
  const [target,setTarget]=useState<string|null>(null),[pendingEditor,setPendingEditor]=useState<string|null>(null);
  useEffect(()=>{
    setReady(true);
    const restore=()=>{setActive(editionViewForHash(location.hash));const id=location.hash.slice(1);setTarget(OLD_TARGETS[id]??id);const match=location.hash.match(/^#edition-chapter-(money|conflict|stress|relationships)$/);setChapter(match?`chapter_${match[1]}` as ChapterKind:null);};
    restore();window.addEventListener("hashchange",restore);window.addEventListener("popstate",restore);
    return()=>{window.removeEventListener("hashchange",restore);window.removeEventListener("popstate",restore);};
  },[]);
  useEffect(()=>{
    const root=rootRef.current;if(!root)return;
    const check=()=>setPendingEditor(root.querySelector<HTMLElement>("[data-atlas-editor-dirty]")?.id??null);
    const observer=new MutationObserver(check);observer.observe(root,{subtree:true,attributes:true,attributeFilter:["data-atlas-editor-dirty"]});check();
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!target)return;
    const frame=requestAnimationFrame(()=>{
      const element=document.getElementById(target);if(!element||element.closest("[hidden]"))return;
      for(let parent:HTMLElement|null=element;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
      element.scrollIntoView({block:"start",behavior:"instant"});
      if(element.matches("form"))element.querySelector<HTMLTextAreaElement>("textarea")?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[active,chapter,target,ready]);
  const navigate=(id:View,kind:ChapterKind|null=null)=>{
    const hash=kind?`#edition-chapter-${kind.replace("chapter_","")}`:`#edition-${id}`;
    if(location.hash!==hash)history.pushState(null,"",hash);
    setActive(id);setChapter(kind);setTarget(null);
    requestAnimationFrame(()=>{navRef.current?.scrollIntoView({block:"start",behavior:"instant"});titleRef.current?.focus({preventScroll:true});});
  };
  const notify=(text:string)=>setNotice(text);
  const backup=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({resultId,data:draft.data},null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="Грани-приватный-черновик.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  const current=model.traits[trait]!;
  const explanation=EDITION_TRAITS[current.key];
  const selectedChapter=view.chapters.find(c=>c.kind===chapter);
  const goLink=(id:View,label:string)=> <a href={`#edition-${id}`} onClick={e=>{e.preventDefault();navigate(id);}} className={styles.textLink}>{label} <span aria-hidden="true">↗</span></a>;
  const preparing=(what:string)=><p className={styles.preparing} role="status">Готовим {what}… Страница обновится сама.</p>;

  return <div ref={rootRef} className={`${atlasStyles.root} ${styles.root}`} data-personal-edition data-atlas-ready={ready||undefined}>
    <a className="skip" href="#edition-content">К содержанию разбора</a>
    <div className={styles.masthead}><span className={styles.brand}>ГРАНИ<small>Личный атлас</small></span><span className={styles.owner}>{displayName}<small>Полный разбор · {typeName}</small></span></div>
    <nav ref={navRef} className={styles.navigation} aria-label="Разделы личного разбора">{NAV.map(n=><a href={`#edition-${n.id}`} key={n.id} aria-current={active===n.id?"page":undefined} onClick={e=>{e.preventDefault();navigate(n.id);}}>{n.label}</a>)}</nav>
      {pendingEditor&&<p className={styles.notice} role="status">Есть неприменённые правки. <button type="button" className="text-button" onClick={()=>{navigate("memo");setTarget(pendingEditor);}}>Вернуться к редактору</button></p>}
    <div id="edition-content" className={styles.content}>
      <h1 ref={titleRef} tabIndex={-1} className={active==="portrait"?styles.coverTitle:styles.srOnly}>{active==="portrait"?<>Личный<br/><em>разбор.</em></>:"Ваш личный разбор"}</h1>
      <div className={styles.view} id="edition-portrait" hidden={active!=="portrait"}>
        <header className={styles.cover}><div><p className={styles.label}>Личное издание для {displayName}</p><div className={styles.titleSpace}/><p className={styles.coverIntro}>Ваш портрет, пять граней характера и ориентиры для повседневных решений — по ответам в тесте.</p><a className={styles.textLink} href="#edition-reading">Прочитать мой портрет <span aria-hidden="true">↓</span></a></div><figure><Image src="/report-personal-edition/cover.png" alt="" fill sizes="(max-width:600px) 90px, (max-width:1000px) 40vw, 520px" priority/><figcaption>У каждого сочетания<br/>свой характер.</figcaption></figure></header>
        <div className={`${styles.paper} ${styles.portraitPaper}`} id="edition-reading"><div><p className={styles.label}>Личный портрет</p><h2>Что связывает<br/>ваш профиль</h2>{view.full&&<Paragraphs text={view.full.portrait}/>}</div><aside className={styles.profileMap}><h3>Пять граней<br/>одного человека</h3><p>Баллы из ваших ответов, от 0 до 100. Они не являются процентилями.</p><ul className={styles.scales}>{model.traits.map(t=><li key={t.key}><div><span>{EDITION_TRAITS[t.key].label}</span><span><strong>{t.value}</strong> / 100</span></div><div className={styles.track} aria-hidden="true"><i style={{width:`${t.value}%`}}/></div></li>)}</ul>{goLink("facets","Что означает каждая грань")}</aside></div>
        {view.full&&<div className={`${styles.paper} ${styles.resources}`}><section id="atlas-section-2"><p className={styles.label}>В готовом разборе</p><h2>Ваши сильные стороны</h2><ul>{view.full.strengths.map(x=><li key={x}>{x}</li>)}</ul></section><section id="atlas-section-3"><h2>Что стоит замечать</h2><ul>{view.full.blind_spots.map(x=><li key={x.text}>{x.text}<p>{x.tip}</p></li>)}</ul></section></div>}
        <div className={styles.takeaway}><span>Личный ориентир</span><p>{draft.data.memo.quote}</p>{goLink("memo","Уточнить и сохранить мой итог")}</div>
        <div className={styles.patterns}><div className={styles.sectionIntro}><div><p className={styles.label}>Редакционные гипотезы</p><h2>Как грани могут<br/>работать вместе</h2></div><p>Это возможные объяснения. Проверяйте их на знакомых ситуациях, прежде чем делать личный вывод.</p></div>{model.strengths.map(s=><article className={styles.pattern} key={s.id}><div><p className={styles.label}>{s.basis.join(" · ")}</p><h3>{s.title}</h3></div><div><p>{s.explanation}</p><details><summary>Разобрать на примере</summary><p>{s.application}</p><p>Что стоит заметить: {s.risk}</p><p>Попробовать: {s.practice}</p></details></div></article>)}</div>
        <aside className={styles.teaser}><div><p className={styles.label}>Продолжить знакомство с собой</p><h3>Деньги. Конфликт.<br/>Стресс. Отношения.</h3><p>Выберите сферу, которую хочется рассмотреть подробнее.</p></div><div><p>{view.bundle?`99 ₽ за главу · ${view.bundle.price} за четыре`:"Ваши доступные главы и дополнительные сферы"}</p>{goLink("spheres","Посмотреть четыре сферы")}</div></aside>
      </div>
      <div className={styles.view} id="edition-facets" hidden={active!=="facets"}><div className={styles.sectionIntro}><div><p className={styles.label}>Результаты и объяснения</p><h2>Пять граней<br/>вашего профиля</h2></div><p>У каждой шкалы свой вопрос. Выберите грань: здесь её смысл, граница вывода и вопрос к вашему опыту.</p></div><div className={styles.traitMenu} role="group" aria-label="Выбрать грань для объяснения">{model.traits.map((t,i)=><button key={t.key} type="button" aria-pressed={trait===i} aria-controls="edition-trait-detail" onClick={()=>setTrait(i)}><span>{EDITION_TRAITS[t.key].label}</span><strong>{t.value} / 100</strong></button>)}</div><section id="atlas-section-1" className={`${styles.paper} ${styles.trait}`}><div><strong className={styles.traitScore}>{current.value}<small>/100</small></strong><h3>{current.name}</h3><div className={styles.axis} aria-hidden="true"><i style={{left:`${current.value}%`}}/></div><p className={styles.poles}>{current.poles[0]} · {current.poles[1]}</p></div><div id="edition-trait-detail" role="status"><h3>{explanation.label}</h3><p>{explanation.explanation[current.level]}</p><h4>Что стоит уточнить</h4><p>{explanation.limit}</p><blockquote>{explanation.question}</blockquote><p className={styles.smallNote}>0–100 — диапазон баллов этой шкалы, а не доля людей, которых вы «превосходите».</p></div></section></div>
      <div className={styles.view} id="edition-life" hidden={active!=="life"}><div className={styles.sectionIntro}><div><p className={styles.label}>От понимания к решению</p><h2>Узнать себя<br/>в обычной жизни</h2></div><p>Выберите знакомую ситуацию. Практики ниже добровольны: разбор можно прочитать без заполнения упражнений.</p></div><AtlasScenarios model={model}/><details className={styles.practice}><summary>По желанию: решения и рабочий ритм</summary><Section number={4} label="Как я принимаю решения" title="От вариантов к проверке"><Tabs prefix="edition-step" items={ATLAS_COPY.decisions.map(s=>s.title)} selected={step} onSelect={setStep} label="Шаги принятия решения" panel="edition-decision"/><div id="edition-decision" role="tabpanel" aria-labelledby={`edition-step-${step}`} tabIndex={0}><h3>{ATLAS_COPY.decisions[step]!.title}</h3><p>{ATLAS_COPY.decisions[step]!.text}</p><p>{ATLAS_COPY.decisions[step]!.prompt}</p></div><label className="field-label" htmlFor="edition-decision-note">Мой следующий непростой выбор</label><textarea id="edition-decision-note" rows={3} maxLength={2000} value={draft.data.decision} onChange={e=>draft.update(before=>({...before,decision:e.target.value}))}/></Section><Section number={5} label="Моя организация дня" title="Найти свой рабочий ритм">{ATLAS_COPY.energy.map(x=><details className={styles.workTip} key={x.title}><summary>{x.title}</summary><p>{x.text}</p><p>{x.tip}</p></details>)}<p className={styles.smallNote}>Big Five не измеряет физиологическую энергию и не объясняет состояние здоровья.</p></Section></details><details className={styles.practice}><summary>По желанию: семь дней наблюдения</summary><AtlasWeek data={draft.data} update={draft.update}/></details></div>
      <div className={styles.view} id="edition-memo" hidden={active!=="memo"}><div className={styles.sectionIntro}><div><p className={styles.label}>Личная памятка</p><h2>Унести с собой<br/>главное</h2></div><p>Уточните формулировки своими словами. Ваши правки сохраняются в аккаунте; памятку можно скачать.</p></div><div className={styles.paper}><AtlasMemo resultId={resultId} data={draft.data} update={draft.update} model={model} displayName={displayName} typeName={typeName} notify={notify} prepareExport={draft.prepareExport}/></div><details className={styles.practice}><summary>Моя карточка для общения</summary><AtlasInteraction resultId={resultId} data={draft.data} update={draft.update} displayName={displayName} notify={notify}/></details>{view.full&&<details className={styles.practice} id="edition-manual"><summary>Как со мной: работа, разговор и личные предпочтения</summary><div className={styles.manual}>{[["В работе",view.full.manual.work],["В разногласиях",view.full.manual.fight],["Что меня утомляет",view.full.manual.annoys]].map(([label,items])=><section key={label as string}><h3>{label as string}</h3><ul>{(items as string[]).map(x=><li key={x}>{x}</li>)}</ul></section>)}</div><ShareCard cardUrl={`/cards/manual/${resultId}`} fileName="grani-manual.png" typeName={typeName} heading="Карточка «инструкция по применению меня»" shareTitle="Инструкция по применению меня"/></details>}<details className={styles.practice} id="friends-report"><summary>Взгляд друзей</summary>{view.friends.state==="ready"&&<Paragraphs text={view.friends.text}/>} {view.friends.state==="preparing"&&preparing("взгляд друзей")}{view.friends.state==="waiting"&&<><p>Раздел появится, когда ответят трое друзей. {view.friends.counter}.</p><Link className={styles.textLink} href={`/result/${resultId}`}>Ссылка для друзей ↗</Link></>}</details>{goLink("spheres","Подробнее о четырёх сферах")}</div>
      <div className={styles.view} id="edition-spheres" hidden={active!=="spheres"}>
        {!selectedChapter?<><div className={styles.spheresIntro}><div><p className={styles.label}>Дополнительные главы</p><h2>Мой профиль<br/>в четырёх сферах</h2><p>Основной разбор помогает увидеть себя целиком. Здесь можно подробнее рассмотреть одну сферу жизни — или выбрать все четыре.</p></div>{view.bundle?<aside className={styles.bundle}><p>Деньги · Конфликт · Стресс · Отношения</p><h3>Все четыре главы</h3><strong>{view.bundle.price}</strong><p>По отдельности {formatRub(PRODUCT_PRICES.chapter_money*4)} · экономия {formatRub(PRODUCT_PRICES.chapter_money*4-PRODUCT_PRICES.chapters_all)}</p><BuyButton product="chapters_all" targetId={resultId} label={`Открыть комплект за ${view.bundle.price}`}/></aside>:<aside className={styles.ownedNote}><h3>Ваши главы</h3><p>Уже купленные главы остаются доступными без повторной оплаты.</p></aside>}</div><div className={styles.sphereGrid}>{view.chapters.map(c=>{const copy=EDITION_SPHERES[c.kind];return <article className={styles.sphereCard} key={c.kind}><Image src={`/gems/${copy.art}.webp`} alt="" width={96} height={96}/><span className={styles.label}>{c.state==="available"?"Дополнительная глава":c.state==="ready"?"Глава открыта":"Глава готовится"}</span><h3>{copy.label}</h3><p className={styles.sphereQuestion}>{copy.question}</p><p>{copy.description}</p><div className={styles.sphereActions}><a className={styles.textLink} href={`#edition-chapter-${c.kind.replace("chapter_","")}`} onClick={e=>{e.preventDefault();navigate("spheres",c.kind);}}>{c.state==="available"?"Что внутри":"Открыть главу"} ↗</a>{c.state==="available"&&<BuyButton product={c.kind} targetId={resultId} label={`Открыть за ${c.price}`} ghost/>}</div></article>;})}</div></>:<><a className={styles.textLink} href="#edition-spheres" onClick={e=>{e.preventDefault();navigate("spheres");}}>Все четыре сферы ↗</a><div className={styles.chapterHeading}><div><p className={styles.label}>Дополнительная глава</p><h2>{EDITION_SPHERES[selectedChapter.kind].label}</h2><p>{EDITION_SPHERES[selectedChapter.kind].description}</p>{selectedChapter.state==="available"&&<BuyButton product={selectedChapter.kind} targetId={resultId} label={`Открыть за ${selectedChapter.price}`}/>} {selectedChapter.kind==="chapter_money"&&moneyPracticeAvailable&&<Link className={styles.moneyLink} href={`/report/${resultId}/practice/money`}>Открыть мой финансовый компас ↗</Link>}</div><Image src={`/gems/${EDITION_SPHERES[selectedChapter.kind].art}.webp`} alt="" width={210} height={210}/></div><ChapterReading chapter={selectedChapter} scores={model.scores} question={EDITION_SPHERES[selectedChapter.kind].question} paperClassName={`${styles.paper} ${styles.chapterReading}`} preparing={preparing("главу")} practiceHref={selectedChapter.kind==="chapter_money"&&moneyPracticeAvailable?`/report/${resultId}/practice/money`:undefined} themes={chapterPreviews?.[selectedChapter.kind]}/></>}
      </div>
      <details className={styles.storage} id="atlas-save-status" open={draft.status==="error"||draft.status==="conflict"?true:undefined}><summary><span role="status">{ready?SAVE[draft.status]:"Подключаем сохранение…"}</span> · сохранение и приватность</summary><p>Памятка, карточка, отметки и заметки приватны. Применённые правки сохраняются автоматически. {draft.localRecoveryAvailable?"В этой вкладке доступен временный черновик.":"Временное хранение недоступно: дождитесь сохранения или скачайте черновик."}</p><div className={styles.saveActions}><button type="button" onClick={()=>void draft.saveNow()} disabled={!ready||["saving","error","conflict"].includes(draft.status)}>Сохранить сейчас</button>{draft.status==="error"&&<button type="button" onClick={draft.retry}>Повторить сохранение</button>}{draft.status==="conflict"&&<button type="button" onClick={()=>{if(window.confirm("Загрузить серверную версию? Сначала сохраните несохранённые правки в файл."))void draft.loadServer();}}>Загрузить серверную версию</button>}{["error","conflict"].includes(draft.status)&&<><button type="button" onClick={backup}>Скачать черновик</button><button type="button" onClick={()=>{if(window.confirm("Выйти без сохранения? Несохранённые правки будут потеряны."))draft.leaveWithoutSaving();}}>Выйти без сохранения</button></>}</div></details>{draft.message&&<p role="alert">{draft.message}</p>}
      {notice&&<p className={styles.notice} role="status">{notice}</p>}
      <footer className={styles.footer}><p>Материалы для самопознания, не психологическая и не медицинская диагностика. Сочетания черт и рекомендации — гипотезы для проверки на вашем опыте.</p><Link href={`/result/${resultId}`}>К результату</Link></footer>
    </div>
  </div>;
}
