import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedUserId } from "@/lib/owner-auth";
import { dcaSettingsSchema } from "@/lib/dca-settings";
import { readDcaSettings, saveDcaSettings } from "@/services/dcaSettings";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const schema=z.object({expectedVersion:z.number().int().min(0).max(2147483646),intent:z.enum(["draft","next_cycle"]),settings:dcaSettingsSchema}).strict();
export async function GET(){
  const userId=await getAuthorizedUserId();
  if(!userId) return json({message:"Sign in required."},401);
  try{return json(await readDcaSettings(userId));}catch{return json({message:"Could not load bot settings."},503);}
}
export async function POST(request:Request){
  const userId=await getAuthorizedUserId(); if(!userId)return json({message:"Sign in required."},401);
  const body=await request.text(); if(body.length>20000)return json({message:"Settings request is too large."},413);
  let input:unknown;try{input=JSON.parse(body);}catch{return json({message:"Invalid settings request."},400);}
  const parsed=schema.safeParse(input);if(!parsed.success)return json({message:parsed.error.issues.map(i=>i.message).join(" ")},400);
  try{
    const saved=await saveDcaSettings(userId,parsed.data.expectedVersion,parsed.data.settings,parsed.data.intent);
    if(!saved)return json({message:"Settings changed in another tab. Reload saved settings before saving again."},409);
    return json({saved,liveTradingEnabled:false});
  }catch{return json({message:"Could not save settings. Reload to check whether the save completed before trying again."},503);}
}
