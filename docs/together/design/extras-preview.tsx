import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PilotClosed } from "../../../apps/web/src/app/together/PilotClosed";
import { InviteNote } from "../../../apps/web/src/app/together/InviteNote";
import { InvitePreview } from "../../../apps/web/src/app/together/InvitePreview";
import { ShareFriends } from "../../../apps/web/src/app/together/ShareFriends";
import { CareCard } from "../../../apps/web/src/app/together/CareCard";
import "../../../apps/web/src/app/globals.css";

const scenes = {
 "pilot-login": "Пилот · до входа", "pilot-code": "Пилот · код", "note": "Записка партнёру",
 "invitation": "Первый вопрос и записка", "invitation-empty": "Приглашение без записки",
 "friends": "Ссылка для друзей", "care": "Итог месяца", "care-partial": "Часть пунктов",
 "care-empty": "Нет выбранных пунктов", "care-pending": "Итог ещё не готов",
 "care-long": "Длинные имена и тексты"
};
type Scene = keyof typeof scenes;
const testWindow = window as unknown as {
 extrasSetScene: (scene: Scene) => void;
 extrasRequests: { url: string; method: string; body?: unknown }[];
 extrasFail: string;
 extrasDelay: number;
 extrasClipboardFails: boolean;
 extrasCopied: string;
};
let activeScene: Scene = (location.hash.slice(1) as Scene) || "pilot-code";
let rerender: (scene: Scene) => void;
testWindow.extrasRequests = [];
testWindow.extrasFail = "";
testWindow.extrasDelay = 0;
testWindow.extrasClipboardFails = false;
testWindow.extrasCopied = "";
const card = () => {
 const complete = activeScene !== "care-partial";
 const long = activeScene === "care-long";
 const empty = activeScene === "care-empty";
 return {
  title: "Наши способы заботы", empty, complete: !empty && complete,
  members: [
   {id:"demo-anna",name:long?"Анна"+"я".repeat(160):"Анна",
    attention:empty?[]:[{text:long?"<img src=x onerror=alert(1)>"+ "я".repeat(170):"Сначала обнять меня, а потом спросить, как прошёл день.",context:"После работы"}],
    ease:empty?[]:[{text:"Предложить приготовить ужин вместе.",context:"Когда день был насыщенным"}]},
   {id:"demo-alex",name:"Алексей",
    attention:empty||!complete?[]:[{text:"Позвать на короткую прогулку без телефонов.",context:null}],
    ease:empty||!complete?[]:[{text:"Дать несколько минут тишины и поставить чайник.",context:"Когда возвращаюсь домой"}]}
  ],
  rituals:empty?[]:[{ownerId:"demo-alex",ownerName:"Алексей",text:"Чай по воскресеньям и разговор о том, что нам понравилось на неделе.",context:"Вечером"}]
 };
};
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
 const url = String(input);
 testWindow.extrasRequests.push({url,method:init?.method||"GET",...(init?.body?{body:JSON.parse(String(init.body))}:{})});
 if(testWindow.extrasDelay)await new Promise(r=>setTimeout(r,testWindow.extrasDelay));
 const fail=testWindow.extrasFail;testWindow.extrasFail="";
 if(fail==="network")throw new TypeError("Demo network failure");
 if(fail==="429")return new Response(JSON.stringify({ok:false,error:"rate_limited"}),{status:429});
 if(fail==="limit")return new Response(JSON.stringify({ok:false,error:"limit_reached"}),{status:403});
 if(url==="/api/together/pilot")return new Response(JSON.stringify({ok:false,error:"invalid_code"}),{status:403});
 if(url==="/api/together/share")return new Response(JSON.stringify({ok:true,url:"https://grani-test.ru/together?from=AbCdEfGh23"}));
 if(url==="/api/together/care")return new Response(JSON.stringify(activeScene==="care-pending"?{ok:true,ready:false}:{ok:true,ready:true,card:card()}));
 throw new Error("Unexpected demo request: "+url);
}) as typeof fetch;
Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(value:string)=>{
 if(testWindow.extrasClipboardFails)throw new Error("Demo clipboard unavailable");
 testWindow.extrasCopied=value;
}}});

function NoteDemo() {
 const [note,setNote]=useState("Давай найдём пять минут для нас. Мне хочется чаще замечать маленькие хорошие моменты.");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 return <><InviteNote note={note} maxLength={200} working={busy} onChange={setNote} onSave={()=>{
  setBusy(true);setMessage("");testWindow.extrasRequests.push({url:"/api/together/invite/note",method:"PUT",body:{note}});
  setTimeout(()=>{setBusy(false);setMessage(note.trim()?"Записка сохранена.":"Записка убрана.");},200);
 }}/>{message&&<p role="status">{message}</p>}</>;
}
function App() {
 const [scene,setScene]=useState<Scene>(activeScene),[revision,setRevision]=useState(0);
 rerender=scene=>{activeScene=scene;setScene(scene);setRevision(value=>value+1);history.replaceState(null,"","#"+scene);};
 const invitationNote=scene==="invitation"?"Мне хочется оставить чуть больше времени для нас. Начнём с одного небольшого вопроса?":null;
 let content;
 if(scene.startsWith("pilot"))content=<PilotClosed key={revision} signedIn={scene==="pilot-code"} enterQuery="&from=AbCdEfGh23" />;
 else content=<main className="page" data-palette="pair" key={revision}>
  <header className="stack" style={{marginBottom:26}}>
   <p className="eyebrow">Грани · Вдвоём</p>
   <h1 className="display" style={{fontSize:42}}>{scene==="note"?"Ваше приглашение":scene.startsWith("invitation")?"Время для двоих":"Ваше пространство"}</h1>
  </header>
  {scene==="note"?<section className="card"><NoteDemo /></section>:scene.startsWith("invitation")?
   <InvitePreview inviterName="Анна" note={invitationNote} prompt="Какой небольшой поступок партнёра недавно сделал ваш день приятнее?" />:
   scene==="friends"?<ShareFriends />:<CareCard key={scene} />}
  {scene==="care-pending"&&<p className="muted">Демонстрация: сервер вернул ready: false, блок итога скрыт.</p>}
 </main>;
 return <><div className="extras-review">Просмотр реальных React-компонентов · Вымышленные данные · API и вход заменены фикстурами</div>
 {content}<aside className="extras-tools"><label>Экран для проверки <select id="extras-scenario" value={scene} onChange={e=>rerender(e.target.value as Scene)}>
 {Object.entries(scenes).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></aside></>;
}
testWindow.extrasSetScene=scene=>{testWindow.extrasRequests=[];testWindow.extrasFail="";testWindow.extrasDelay=0;testWindow.extrasClipboardFails=false;rerender(scene);};
createRoot(document.getElementById("extras-root")!).render(<App />);
