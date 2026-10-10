"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AtlasDraftData } from "@grani/db";
import { readPending, storePending, clearTabDrafts, claimTabWriter } from "./atlas-tab-drafts";
import { atlasDataSchema } from "@/lib/personality-atlas-draft";

export type ClientAtlasDraft={revision:number;data:AtlasDraftData;updatedAt:string|null};
export type SaveState="idle"|"dirty"|"saving"|"saved"|"error"|"conflict";

export function useAtlasDraft(resultId:string,initial:ClientAtlasDraft){
  const initialData=useMemo(()=>atlasDataSchema.parse(initial.data),[initial.data]);
  const [data,setData]=useState(initialData);
  const [localRecoveryAvailable,setLocalRecoveryAvailable]=useState(true);
  const [status,setStatus]=useState<SaveState>("idle");
  const [message,setMessage]=useState("");
  const current=useRef(data),revision=useRef(initial.revision),saved=useRef(JSON.stringify(initialData));
  const writer=useRef("");
  const editGeneration=useRef(0);
  const saveFinished=useRef<(()=>void)[]>([]);
  const leavingApproved=useRef(false);
  const busy=useRef(false),blocked=useRef<"error"|"conflict"|null>(null);
  const endpoint=`/api/report/${encodeURIComponent(resultId)}/atlas`;
  const persistPending=useCallback(()=>{
    const pending=busy.current||blocked.current||JSON.stringify(current.current)!==saved.current;
    setLocalRecoveryAvailable(storePending(resultId,pending?{revision:revision.current,data:current.current,blocked:blocked.current}:null,writer.current));
  },[resultId]);
  useEffect(()=>{
    writer.current=crypto.randomUUID();setLocalRecoveryAvailable(claimTabWriter(resultId,writer.current));
    const pending=readPending(resultId);if(!pending)return;
    if(JSON.stringify(pending.data)===JSON.stringify(initialData)){storePending(resultId,null,writer.current);return;}
    current.current=pending.data;setData(pending.data);
    blocked.current=pending.revision!==initial.revision?"conflict":pending.blocked;
    setStatus(blocked.current??"dirty");
    setMessage("Восстановлен несохранённый черновик этой вкладки. Это ещё не подтверждение серверного сохранения.");
  // Initial owner-checked server props are the reference for recovery on mount.
    },[resultId]);
  const flush=useCallback(async()=>{
    if(busy.current){await new Promise<void>(resolve=>saveFinished.current.push(resolve));return;}
    if(blocked.current)return;
    busy.current=true;
    persistPending();
    try{
      if(JSON.stringify(current.current)===saved.current)setStatus("saved");
      while(JSON.stringify(current.current)!==saved.current&&!blocked.current){
        const snapshot=structuredClone(current.current),expectedRevision=revision.current;
        setStatus("saving");setMessage("");
        const response=await fetch(endpoint,{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision,data:snapshot})});
        if(!response.ok){
          blocked.current=response.status===409?"conflict":"error";setStatus(blocked.current);
          setMessage(response.status===409?"В другой вкладке или на другом устройстве появились новые правки. Ваши изменения здесь сохранены в памяти; они не перезаписали серверную версию.":response.status===401?"Сессия истекла. Скачайте черновик перед повторным входом.":"Не удалось сохранить. Правки остаются здесь; можно повторить попытку или скачать черновик.");
          return;
        }
        const payload=await response.json();
        if(!payload.ok||!Number.isSafeInteger(payload.draft?.revision)||payload.draft.revision!==expectedRevision+1)throw new Error("Invalid save acknowledgement");
        revision.current=payload.draft.revision;saved.current=JSON.stringify(snapshot);
        setStatus(JSON.stringify(current.current)===saved.current?"saved":"dirty");
      }
    }catch{
      blocked.current="error";setStatus("error");setMessage("Нет подтверждения сохранения. Правки остаются здесь. Если сервер успел их записать, повторная попытка обнаружит другую версию и не перезапишет её.");
    }finally{busy.current=false;persistPending();saveFinished.current.splice(0).forEach(resolve=>resolve());}
  },[endpoint,persistPending]);
  const update=useCallback((change:(before:AtlasDraftData)=>AtlasDraftData)=>{
    editGeneration.current++;
    const next=change(current.current);current.current=next;setData(next);
    persistPending();
    if(!blocked.current){setStatus(busy.current?"saving":JSON.stringify(next)===saved.current?"saved":"dirty");setMessage("");}
  },[persistPending]);
  useEffect(()=>{if(JSON.stringify(data)===saved.current||blocked.current)return;const timer=setTimeout(()=>void flush(),800);return()=>clearTimeout(timer);},[data,flush]);
  useEffect(()=>{
    const protect=(event:BeforeUnloadEvent)=>{
      if(leavingApproved.current)return;
      if(!busy.current&&JSON.stringify(current.current)===saved.current&&!document.querySelector("[data-atlas-editor-dirty]"))return;
      event.preventDefault();event.returnValue="";
    };
    window.addEventListener("beforeunload",protect);return()=>window.removeEventListener("beforeunload",protect);
  },[data,status]);
  // A client-side history transition can unmount without beforeunload. Finish
  // any applied edits even when the caller didn't use an anchor link.
  useEffect(()=>()=>{void flush();},[flush]);
  const retry=useCallback(()=>{if(blocked.current==="conflict")return;blocked.current=null;void flush();},[flush]);
  const loadServer=useCallback(async()=>{
    if(busy.current)return;
    const generation=editGeneration.current;
    setStatus("saving");busy.current=true;
    try{
      const response=await fetch(endpoint,{credentials:"same-origin",cache:"no-store"});
      if(!response.ok)throw new Error("Could not load draft");const payload=await response.json();
      if(!payload.ok||!payload.draft?.data||!Number.isSafeInteger(payload.draft.revision))throw new Error("Invalid draft");
      if(editGeneration.current!==generation){
        blocked.current="conflict";setStatus("conflict");
        setMessage("Пока серверная версия загружалась, вы внесли новые правки. Они оставлены здесь. Загрузите серверную версию ещё раз, когда будете готовы заменить их.");
        return;
      }
      revision.current=payload.draft.revision;current.current=payload.draft.data;saved.current=JSON.stringify(payload.draft.data);
      blocked.current=null;setData(payload.draft.data);setStatus("saved");setMessage("");
    }catch{blocked.current="error";setStatus("error");setMessage("Не удалось загрузить серверную версию. Правки в этой вкладке остаются доступны.");}
    finally{busy.current=false;persistPending();saveFinished.current.splice(0).forEach(resolve=>resolve());}
  },[endpoint,persistPending]);
  useEffect(()=>{
    const protectNavigation=(event:MouseEvent)=>{
      if(leavingApproved.current)return;
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>("a[href]"):null;
      if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download"))return;
      const url=new URL(anchor.href,window.location.href);
      if(url.pathname===window.location.pathname&&url.search===window.location.search&&url.origin===window.location.origin)return;
      const editorOpen=!!document.querySelector("[data-atlas-editor-dirty]");
      if(!busy.current&&JSON.stringify(current.current)===saved.current&&!editorOpen)return;
      event.preventDefault();event.stopPropagation();
      if(editorOpen){setMessage("В редакторе есть неприменённые правки. Примените их или нажмите «Отмена» перед переходом.");return;}
      void (async()=>{
        await flush();
        if(!blocked.current&&JSON.stringify(current.current)===saved.current)window.location.assign(url.href);
        else setMessage("Переход отложен: последние правки ещё не сохранены. Сохраните их или скачайте черновик перед выходом.");
      })();
    };
    document.addEventListener("click",protectNavigation,true);
    return()=>document.removeEventListener("click",protectNavigation,true);
  },[flush]);
  const leaveWithoutSaving=()=>{leavingApproved.current=true;clearTabDrafts(resultId);window.location.assign(`/result/${encodeURIComponent(resultId)}`);};
  const prepareExport=async()=>{
    await flush();
    return !busy.current&&!blocked.current&&JSON.stringify(current.current)===saved.current?revision.current:null;
  };
  return {data,update,status,message,retry,loadServer,saveNow:flush,prepareExport,leaveWithoutSaving,localRecoveryAvailable};
}
