"use client";
import {useEffect,useRef,useState} from "react";
export function AtlasMemoPdfDownload({resultId,editing,prepareExport}:{resultId:string;editing:boolean;prepareExport:()=>Promise<number|null>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const controller=useRef<AbortController|null>(null),objectUrl=useRef<string|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);};},[]);
 async function download(){
  if(controller.current||editing)return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setMessage("Сохраняем правки и готовим PDF…");
  const timeout=window.setTimeout(()=>abort.abort(),60_000);
  let rejectAbort!:(reason:Error)=>void;
  const interrupted=new Promise<never>((_resolve,reject)=>{rejectAbort=reject;});
  const onAbort=()=>rejectAbort(new DOMException("PDF preparation interrupted","AbortError"));
  abort.signal.addEventListener("abort",onAbort,{once:true});
  try{
   // Stop waiting for a slow save without changing its acknowledgement state.
   const revision=await Promise.race([prepareExport(),interrupted]);if(abort.signal.aborted)return;
   if(revision===null){setMessage("Сначала сохраните правки или разрешите конфликт версий вверху атласа. PDF пока не создан.");return;}
   const response=await fetch("/api/report/"+encodeURIComponent(resultId)+"/atlas/pdf?revision="+revision,{credentials:"same-origin",cache:"no-store",signal:abort.signal});
   if(!response.ok||!response.headers.get("content-type")?.startsWith("application/pdf")){
    setMessage(response.status===409?"Памятка изменилась во время подготовки или разбор ещё готовится. Проверьте сохранённую версию и повторите скачивание.":response.status===429?"Можно подготовить до трёх PDF в минуту. Повторите через минуту.":[401,403,404].includes(response.status)?"Доступ к файлу закрыт. Проверьте вход и доступ к полному разбору.":"Не удалось подготовить PDF. Проверьте связь и повторите.");return;
   }
   const blob=await response.blob();if(abort.signal.aborted)return;
   if(await blob.slice(0,5).text()!=="%PDF-"){setMessage("Получен неверный файл. Повторите скачивание.");return;}
   if(abort.signal.aborted||!mounted.current)return;
   if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
   const url=URL.createObjectURL(blob);objectUrl.current=url;
   const anchor=document.createElement("a");anchor.href=url;anchor.download="grani-personal-memo.pdf";document.body.append(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>{URL.revokeObjectURL(url);if(objectUrl.current===url)objectUrl.current=null;},30_000);
   setMessage("PDF подготовлен. Сохраните файл в загрузках браузера.");
  }catch{if(mounted.current)setMessage(abort.signal.aborted?"Подготовка заняла слишком много времени. Повторите скачивание.":"Не удалось скачать PDF. Проверьте связь и повторите.");}
  finally{window.clearTimeout(timeout);abort.signal.removeEventListener("abort",onAbort);controller.current=null;if(mounted.current)setBusy(false);}
 }
 return <div><button type="button" className="button ghost" disabled={busy||editing} onClick={()=>void download()}>{busy?"Готовим PDF…":"Скачать памятку в PDF"}</button>{editing&&<p className="field-help">Примените правки к памятке или закройте редактор перед скачиванием.</p>}<p className="field-help">Скачивается сохранённая памятка и пять шкал. Личные заметки плана не входят в файл.</p><p className="field-help" role="status" aria-live="polite">{message}</p></div>;
}
