import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, internalTransfers } from '@/db/schema';
import { getAuthorizedUserId } from '@/lib/owner-auth';
import { getInternalTransfers, transitAt } from '@/services/internalTransfers';
import { closeTransit } from '@/lib/transfer-reconciliation';
import { z } from 'zod';
export async function GET() {
  const userId=await getAuthorizedUserId();
  if (!userId) return NextResponse.json({message:'Sign in required.'},{status:401});
  const rows=await getInternalTransfers(userId);
  return NextResponse.json({rows,total:transitAt(rows,new Date())},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request) {
  const origin=request.headers.get('origin');
  if (origin && origin!==new URL(request.url).origin) return NextResponse.json({message:'Invalid origin'},{status:403});
  const userId=await getAuthorizedUserId();
  if (!userId) return NextResponse.json({message:'Sign in required.'},{status:401});
  const body=z.object({id:z.string().uuid(),action:z.enum(['confirm_in_transit','received','dismissed'])}).safeParse(await request.json().catch(()=>null));
  if (!body.success) return NextResponse.json({message:'Invalid transfer action'},{status:400});
  const [row]=await db.select().from(internalTransfers).where(and(eq(internalTransfers.userId,userId),eq(internalTransfers.id,body.data.id)));
  if (!row) return NextResponse.json({message:'Transfer not found'},{status:404});
  const [destination]=await db.select().from(accounts).where(and(eq(accounts.id,row.destinationAccountId),eq(accounts.userId,userId)));
  if (!destination) return NextResponse.json({message:'Destination not found'},{status:404});
  const now=new Date();
  const action=body.data.action;
  if (action==='confirm_in_transit' && row.status==='in_transit') return NextResponse.json({status:'ok'});
  if (['received','dismissed'].includes(row.status)) return NextResponse.json({message:'This transfer is already closed.'},{status:409});
  const effective=(await getInternalTransfers(userId)).find(r=>r.id===row.id) ?? row;
  const intervals=closeTransit(effective.intervals,now);
  if (action==='confirm_in_transit') intervals.push({from:now.toISOString(),until:null});
  const saved=await db.update(internalTransfers).set({status:action==='confirm_in_transit'?'in_transit':action,intervals,destinationBalance:destination.lastBalance,evidence:`${row.evidence}\nOwner confirmed ${action} at ${now.toISOString()}`,updatedAt:now}).where(and(eq(internalTransfers.userId,userId),eq(internalTransfers.id,row.id),eq(internalTransfers.updatedAt,row.updatedAt))).returning({id:internalTransfers.id});
  if (!saved.length) return NextResponse.json({message:"Transfer changed; refresh before confirming."},{status:409});
  return NextResponse.json({status:'ok'});
}
