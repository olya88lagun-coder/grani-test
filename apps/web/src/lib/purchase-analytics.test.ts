import { afterEach, expect, test, vi } from "vitest";
import type { PurchaseView } from "@/server/payments-service";
import { markPurchase } from "./purchase-analytics";
import { METRIKA_ID, OWNER_DEVICE_KEY } from "./analytics";

const view=(id:string,patch:Partial<PurchaseView>={}):PurchaseView=>({id,product:"pair",status:"succeeded",ready:false,reportUrl:"/pair/test",free:false,since:"2026-10-09T12:00:00Z",...patch});
function storage(initial:Record<string,string>={}) {
  const data=new Map(Object.entries(initial));
  return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>void data.set(key,value)};
}
function browser(choice="all") {
  const target=Object.assign(new EventTarget(),{localStorage:storage({"grani-cookie-consent":choice}),sessionStorage:storage(),ym:undefined as ReturnType<typeof vi.fn>|undefined});
  vi.stubGlobal("window",target);
  return target;
}
afterEach(()=>vi.unstubAllGlobals());

test("a confirmed purchase waits for analytics bootstrap and is delivered once",()=>{
  const window=browser();
  const purchase=view("delayed-sdk");
  markPurchase(purchase);
  markPurchase(purchase);
  expect(window.sessionStorage.getItem("grani-goal-delayed-sdk")).toBeNull();
  window.ym=vi.fn();
  window.dispatchEvent(new Event("grani:analytics-ready"));
  expect(window.ym).toHaveBeenCalledExactlyOnceWith(METRIKA_ID,"reachGoal","purchase_pair",{order_price:399,currency:"RUB"});
  expect(window.sessionStorage.getItem("grani-goal-delayed-sdk")).toBe("1");
  markPurchase(purchase);
  expect(window.ym).toHaveBeenCalledTimes(1);
});

test("a delayed purchase is discarded if analytics consent has been withdrawn",()=>{
  const window=browser();
  markPurchase(view("withdrawn-sdk"));
  window.localStorage.setItem("grani-cookie-consent","necessary");
  window.ym=vi.fn();
  window.dispatchEvent(new Event("grani:analytics-ready"));
  expect(window.ym).not.toHaveBeenCalled();
  expect(window.sessionStorage.getItem("grani-goal-withdrawn-sdk")).toBeNull();
});

test("necessary cookies and owner devices do not send purchase goals",()=>{
  const window=browser("necessary");
  window.ym=vi.fn();
  markPurchase(view("necessary-goal"));
  expect(window.ym).not.toHaveBeenCalled();
  window.localStorage.setItem("grani-cookie-consent","all");
  window.localStorage.setItem(OWNER_DEVICE_KEY,"1");
  markPurchase(view("owner-goal"));
  expect(window.ym).not.toHaveBeenCalled();
});

test.each(["pending","canceled","refunded"] as const)("%s purchases do not send goals",status=>{
  const window=browser();
  window.ym=vi.fn();
  markPurchase(view(`state-${status}`,{status}));
  expect(window.ym).not.toHaveBeenCalled();
});

test("free purchases do not send goals",()=>{
  const window=browser(); window.ym=vi.fn();
  markPurchase(view("free-goal",{free:true}));
  expect(window.ym).not.toHaveBeenCalled();
});

test("unavailable session storage does not prevent the goal",()=>{
  const window=browser(); window.ym=vi.fn();
  window.sessionStorage.getItem=()=>{throw new Error("denied")};
  window.sessionStorage.setItem=()=>{throw new Error("denied")};
  expect(()=>markPurchase(view("storage-denied"))).not.toThrow();
  expect(window.ym).toHaveBeenCalledTimes(1);
});
