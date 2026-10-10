"use client";

import { useEffect, useRef, useState } from "react";
import { ATLAS_COPY } from "./atlas-copy";

export function AtlasNavigation({done}:{done:number}){
  const [active,setActive]=useState(1);const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const update=()=>{let current=1;document.querySelectorAll<HTMLElement>("[data-atlas-section]").forEach((e,i)=>{if(e.getBoundingClientRect().top<180)current=i+1;});setActive(current);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&menu.current?.open){menu.current.open=false;menu.current.querySelector("summary")?.focus();}};
    const outside=(event:PointerEvent)=>{if(menu.current?.open&&event.target instanceof Node&&!menu.current.contains(event.target))menu.current.open=false;};
    window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update,{passive:true});document.addEventListener("keydown",escape);document.addEventListener("pointerdown",outside);update();
    return()=>{window.removeEventListener("scroll",update);window.removeEventListener("resize",update);document.removeEventListener("keydown",escape);document.removeEventListener("pointerdown",outside);};
  },[]);
  const links=(mobile=false)=>ATLAS_COPY.sections.map((name,i)=><a className="nav-link" key={name} href={`#atlas-section-${i+1}`} aria-current={active===i+1?"location":undefined} onClick={()=>{setActive(i+1);if(mobile&&menu.current)menu.current.open=false;}}><span className="nav-num">{String(i+1).padStart(2,"0")}</span><span>{name}</span></a>);
  return <aside className="sidebar"><div className="side-head"><span className="eyebrow">Личный атлас</span><span className="side-title">Инструкция к себе</span></div><nav className="desktop-nav" aria-label="Девять разделов атласа">{links()}</nav><details className="mobile-nav" ref={menu}><summary>Разделы атласа <span>{String(active).padStart(2,"0")} / 09</span></summary><nav aria-label="Разделы атласа на смартфоне">{links(true)}</nav></details><div className="side-progress"><div className="row between"><span>Моя неделя</span><span className="week-count">{done} / 7</span></div><progress className="week-progress" max={7} value={done} aria-label="Выполненные практики недели"/><a href="#atlas-section-8">Продолжить практику ↗</a></div><p className="side-foot">У каждой грани —<br/>своё место.</p></aside>;
}
