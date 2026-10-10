"use client";
import {useEffect,useRef,useState,type SetStateAction} from "react";
import {z} from "zod";
import {atlasDataSchema,MAX_ATLAS_EXPECTED_REVISION} from "@/lib/personality-atlas-draft";
const key=(id:string,kind:string)=>"grani-atlas-pending:"+id+":"+kind;
const pendingSchema=z.strictObject({revision:z.number().int().min(0).max(MAX_ATLAS_EXPECTED_REVISION),data:atlasDataSchema,blocked:z.enum(["error","conflict"]).nullable()});
type Pending=z.infer<typeof pendingSchema>;
// In-memory fallback covers client routing when tab storage is unavailable.
const memory=new Map<string,unknown>();const writers=new Map<string,string>();const writerPersisted=new Map<string,boolean>();
export function claimTabWriter(id:string,writer:string){try{const owner=sessionStorage.getItem(key(id,"writer"));if(writers.has(id)&&owner&&owner!==writers.get(id))for(const kind of ["applied","interaction","memo"])memory.delete(key(id,kind));}catch{}writers.set(id,writer);try{sessionStorage.setItem(key(id,"writer"),writer);writerPersisted.set(id,true);return true;}catch{writerPersisted.set(id,false);return false;}}
export function readPending(id:string){let value:unknown=memory.get(key(id,"applied"));if(!memory.has(key(id,"applied")))try{const raw=sessionStorage.getItem(key(id,"applied"));if(raw)value=JSON.parse(raw);}catch{}const parsed=pendingSchema.safeParse(value);return parsed.success?parsed.data:null;}
export function storePending(id:string,value:Pending|null,writer:string){
 if(writers.get(id)!==writer)return true;
 if(writerPersisted.get(id))try{const owner=sessionStorage.getItem(key(id,"writer"));if(owner&&owner!==writer)return true;}catch{}
 memory.set(key(id,"applied"),value);
 try{if(value)sessionStorage.setItem(key(id,"applied"),JSON.stringify(value));else sessionStorage.removeItem(key(id,"applied"));return writerPersisted.get(id)===true;}catch{return false;}
}
export function clearTabDrafts(id:string){for(const kind of ["applied","interaction","memo"]){memory.set(key(id,kind),null);try{sessionStorage.removeItem(key(id,kind));}catch{}}}
export function usePrivateEditor<T>(id:string,kind:"interaction"|"memo",schema:z.ZodType<T>){
 const [value,setValue]=useState<T|null>(null);const [available,setAvailable]=useState(true);const current=useRef<T|null>(null);
 useEffect(()=>{let candidate:unknown=memory.get(key(id,kind));if(!memory.has(key(id,kind)))try{const raw=sessionStorage.getItem(key(id,kind));if(raw)candidate=JSON.parse(raw);}catch{setAvailable(false);}const parsed=schema.safeParse(candidate);if(parsed.success){current.current=parsed.data;setValue(parsed.data);}},[id,kind,schema]);
 const update=(change:SetStateAction<T|null>)=>{const next=typeof change==="function"?(change as (before:T|null)=>T|null)(current.current):change;current.current=next;setValue(next);memory.set(key(id,kind),next);try{if(next===null)sessionStorage.removeItem(key(id,kind));else sessionStorage.setItem(key(id,kind),JSON.stringify(next));setAvailable(true);}catch{setAvailable(false);}};
 return [value,update,available] as const;
}
export const interactionEditorSchema=atlasDataSchema.shape.interaction;
export const memoEditorSchema=atlasDataSchema.shape.memo;
