import { and, eq, sql } from "drizzle-orm";
import { personalityAtlasDrafts } from "./schema";
import type { Database } from "./types";

export type AtlasDraftData = {
  done:boolean[]; notes:string[]; decision:string; interaction:string[];
  memo:{quote:string;items:string[]};
};
export type AtlasDraftRecord = { revision:number; data:AtlasDraftData; updatedAt:Date | null };

export async function loadAtlasDraft(db:Database,resultId:string):Promise<AtlasDraftRecord|null>{
  const [row]=await db.select().from(personalityAtlasDrafts).where(eq(personalityAtlasDrafts.resultId,resultId)).limit(1);
  return row?{revision:row.revision,data:row.data,updatedAt:row.updatedAt}:null;
}

// Compare-and-set is atomic: an outdated browser cannot overwrite a newer draft.
// Caller must authenticate and check ownership + full-report access first.
export async function writeAtlasDraft(db:Database,p:{resultId:string;expectedRevision:number;data:AtlasDraftData}):Promise<AtlasDraftRecord|null>{
  const rows=p.expectedRevision===0
    ? await db.insert(personalityAtlasDrafts).values({resultId:p.resultId,revision:1,data:p.data}).onConflictDoNothing().returning()
    : await db.update(personalityAtlasDrafts).set({data:p.data,revision:sql`${personalityAtlasDrafts.revision}+1`,updatedAt:new Date()})
      .where(and(eq(personalityAtlasDrafts.resultId,p.resultId),eq(personalityAtlasDrafts.revision,p.expectedRevision))).returning();
  const row=rows[0];return row?{revision:row.revision,data:row.data,updatedAt:row.updatedAt}:null;
}
