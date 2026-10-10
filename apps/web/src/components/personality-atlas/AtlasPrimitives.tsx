import type { KeyboardEvent, ReactNode } from "react";

export function Section({number,label,title,action,children}:{number:number;label:string;title:string;action?:ReactNode;children:ReactNode}){
  return <section className="atlas-section" id={`atlas-section-${number}`} data-atlas-section aria-labelledby={`atlas-title-${number}`}><div className="section-heading"><div><p className="eyebrow gold">{String(number).padStart(2,"0")} / {label}</p><h2 id={`atlas-title-${number}`}>{title}</h2></div>{action}</div>{children}</section>;
}
function tabKeys(event:KeyboardEvent<HTMLDivElement>,vertical:boolean){
  const tabs=[...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")];const index=tabs.indexOf(event.target as HTMLButtonElement);if(index<0)return;
  let next:number|undefined;
  if(event.key===(vertical?"ArrowDown":"ArrowRight"))next=(index+1)%tabs.length;
  if(event.key===(vertical?"ArrowUp":"ArrowLeft"))next=(index-1+tabs.length)%tabs.length;
  if(event.key==="Home")next=0;if(event.key==="End")next=tabs.length-1;
  if(next!==undefined){event.preventDefault();tabs[next]!.focus();tabs[next]!.click();}
}
export function Tabs({prefix,items,selected,onSelect,label,panel,className="segmented",vertical=false,numbers=false}:{prefix:string;items:readonly string[];selected:number;onSelect:(index:number)=>void;label:string;panel:string;className?:string;vertical?:boolean;numbers?:boolean}){
  return <div className={className} role="tablist" aria-label={label} aria-orientation={vertical?"vertical":"horizontal"} onKeyDown={event=>tabKeys(event,vertical)}>{items.map((title,i)=><button type="button" key={title} role="tab" id={`${prefix}-${i}`} aria-selected={selected===i} aria-controls={panel} tabIndex={selected===i?0:-1} className={className==="decision-steps"?"step":className==="scenario-list"?"scenario-tab":undefined} aria-label={numbers?`Шаг ${i+1}. ${title}`:undefined} onClick={()=>onSelect(i)}>{numbers&&<span aria-hidden="true">0{i+1}</span>}{title}</button>)}</div>;
}
export function SmallGem({index}:{index:number}){
  const paths=["M15 58 42 12 70 58 42 85Z M15 58H70 M42 12V85 M15 58 42 39 70 58 M42 39 42 85","M15 28 42 12 70 28V62L42 80 15 62Z M15 28 42 44 70 28 M42 44V80 M42 12V44 M15 62 42 44 70 62","M15 20H69V74H15Z M15 20 42 34 69 20 M15 74 42 60 69 74 M15 20 29 47 15 74 M69 20 55 47 69 74 M42 34 55 47 42 60 29 47Z"];
  return <div className="strength-art" aria-hidden="true"><svg viewBox="0 0 84 94"><path d={paths[index%3]}/></svg><span className="strength-index">0{index+1}</span></div>;
}
