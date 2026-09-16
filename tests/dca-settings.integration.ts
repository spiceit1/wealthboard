import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {db} from "../db/client";
import {users} from "../db/schema";
import {defaultDcaSettings} from "../lib/dca-settings";
import {readDcaSettings,saveDcaSettings} from "../services/dcaSettings";
async function main(){
 if(!new URL(process.env.DATABASE_URL??"").hostname.startsWith("ep-sweet-shadow-ahkyiy46"))throw new Error("Isolated test branch required");
 const id=randomUUID(),other=randomUUID();
 await db.insert(users).values([id,other].map(id=>({id,email:`${id}@test.invalid`,fullName:"DCA test"})));
 assert.equal((await readDcaSettings(id)).latest,null);
 const concurrent=await Promise.all([saveDcaSettings(id,0,defaultDcaSettings,"draft"),saveDcaSettings(id,0,defaultDcaSettings,"draft")]);
 assert.equal(concurrent.filter(Boolean).length,1);
 assert.equal(await saveDcaSettings(id,0,defaultDcaSettings,"draft"),null);
 await saveDcaSettings(id,1,defaultDcaSettings,"next_cycle");
 await saveDcaSettings(id,2,{...defaultDcaSettings,name:"Revised"},"draft");
 const state=await readDcaSettings(id);
 assert.equal(state.latest?.version,3);assert.equal(state.queued?.version,2);assert.equal(state.queued?.settings.name,"Zcash DCA");assert.equal(state.activeVersion,null);assert.equal(state.liveTradingEnabled,false);
 assert.equal((await readDcaSettings(other)).history.length,0);
 await assert.rejects(saveDcaSettings(id,3,{...defaultDcaSettings,budget:1},"draft"));
 console.log("DCA persistence, owner isolation, immutable selection and concurrency tests passed.");
}
void main();
