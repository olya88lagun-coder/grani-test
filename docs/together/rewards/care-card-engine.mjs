/** Pure presentation builder. Inputs must come from authorized, consented server snapshots. */
export function buildCareCard(input) {
  const text=(v,max,label)=>{if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw Error("Некорректное поле: "+label);return v.trim();};
  if(!input||!Array.isArray(input.members)||input.members.length!==2)throw Error("Нужно два участника.");
  const members=input.members.map(m=>({id:text(m.id,80,"id"),name:text(m.name,48,"имя")}));
  if(members[0].id===members[1].id)throw Error("Участники должны быть разными.");
  const memberIds=new Set(members.map(m=>m.id)), map=new Map();
  for(const c of input.candidates??[]){
    const id=text(c.id,100,"кандидат");if(map.has(id))throw Error("Повтор ID кандидата.");
    if(!memberIds.has(c.ownerId)||!["attention","ease"].includes(c.category))throw Error("Некорректный автор или категория.");
    map.set(id,{...c,id,action:text(c.action,180,"действие"),context:c.context?text(c.context,100,"контекст"):""});
  }
  const items=[],missing=[];
  for(const category of ["attention","ease"])for(const m of members){
    const selected=input.selections?.[m.id]?.[category];
    if(!selected){missing.push(m.id+"."+category);continue;}
    const c=map.get(selected);if(!c){missing.push(m.id+"."+category);continue;}
    if(c.ownerId!==m.id||c.category!==category)throw Error("Нельзя выбрать чужой пункт или другую категорию.");
    if(c.allowReward!==true){missing.push(m.id+"."+category);continue;}
    items.push({id:m.id+"."+category,ownerId:m.id,label:m.name+" · "+(category==="attention"?"внимание":"обычный день"),text:c.action,context:c.context,sourceId:c.sourceId??null});
  }
  const r=input.ritual;
  const confirmations=new Set(r?.confirmedBy??[]);
  if(r&&members.every(m=>confirmations.has(m.id))&&confirmations.size===2){
    items.push({id:"shared.ritual",ownerId:null,label:"Наш ритуал",text:text(r.name,180,"ритуал"),context:[r.schedule?text(r.schedule,100,"расписание"):"",r.duration?text(r.duration,60,"длительность"):""].filter(Boolean).join(" · "),sourceId:r.sourceId??null});
  }else missing.push("shared.ritual");
  return {schemaVersion:1,title:"Наши способы заботы",members,items,missing,complete:missing.length===0,empty:items.length===0};
}
