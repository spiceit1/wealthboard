import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dcaRevisions } from "@/db/schema";
import { dcaSettingsSchema, type DcaSettings } from "@/lib/dca-settings";
export async function readDcaSettings(userId: string) {
  const history = await db.select().from(dcaRevisions).where(eq(dcaRevisions.userId,userId)).orderBy(desc(dcaRevisions.version)).limit(50);
  const [queued] = await db.select().from(dcaRevisions).where(and(eq(dcaRevisions.userId,userId),eq(dcaRevisions.intent,"next_cycle"))).orderBy(desc(dcaRevisions.version)).limit(1);
  return { latest:history[0]??null, queued:queued??null, history, activeVersion:null, liveTradingEnabled:false };
}
export async function saveDcaSettings(userId:string, expectedVersion:number, settings:DcaSettings, intent:"draft"|"next_cycle") {
  const valid = dcaSettingsSchema.parse(settings);
  const [latest] = await db.select({version:dcaRevisions.version}).from(dcaRevisions).where(eq(dcaRevisions.userId,userId)).orderBy(desc(dcaRevisions.version)).limit(1);
  if ((latest?.version??0)!==expectedVersion) return null;
  // Unique user/version key makes concurrent submissions conflict rather than overwrite.
  const [saved] = await db.insert(dcaRevisions).values({userId,version:expectedVersion+1,settings:valid,intent}).onConflictDoNothing().returning();
  return saved??null;
}
