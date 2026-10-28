"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatUSD } from '@/lib/formatters';
type Row={id:string;amount:string;sourceLabel:string;destinationLabel:string;status:string;transferDate:string;evidence:string};
export function TransferOverview() {
 const client=useQueryClient();
 const query=useQuery({queryKey:['transfers'],queryFn:async():Promise<{rows:Row[];total:number}>=>{const r=await fetch('/api/transfers',{cache:'no-store'});if(!r.ok)throw Error('Unable to load transfer reconciliation.');return r.json();},refetchInterval:30000});
 const update=useMutation({mutationFn:async({id,action}:{id:string;action:string})=>{const r=await fetch('/api/transfers',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});if(!r.ok)throw Error('Could not update transfer. Refresh and try again.');},onSuccess:()=>client.invalidateQueries()});
 if(query.isError)return <p role="alert" className="text-sm text-amber-700">Transfer reconciliation could not load. Totals may need review. <button className="underline" onClick={()=>query.refetch()}>Retry</button></p>;
 const rows=query.data?.rows ?? [];
 if(!rows.length)return null;
 const active=rows.filter(r=>['in_transit','needs_review'].includes(r.status));
 return <div className="rounded-xl border bg-white p-4 space-y-3">
 <h2 className="font-semibold">Cash in transit: {formatUSD(query.data?.total ?? 0)}</h2>
 <p className="text-sm text-muted-foreground">Included in net worth separately from bank balances. When a receiving balance changes, uncertain amounts stop counting until reconciled. This is a balance correction, not investment profit.</p>
 {active.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"><div><strong>{formatUSD(Number(row.amount))}</strong> · {row.sourceLabel} → {row.destinationLabel}<p>{row.transferDate} · {row.status==='in_transit'?'In transit · included':'Needs review · not included'}</p><details><summary className="cursor-pointer text-muted-foreground">Why?</summary><p>{row.evidence}</p></details></div><div className="flex gap-2">{row.status==='needs_review'&&<Button variant="outline" disabled={update.isPending} onClick={()=>{if(window.confirm('Confirm this money has left the source and is NOT included in the receiving bank balance. It will be added to net worth.'))update.mutate({id:row.id,action:'confirm_in_transit'});}}>Confirm still in transit</Button>}<Button variant="outline" disabled={update.isPending} onClick={()=>{if(window.confirm('Confirm the deposit is now included in the receiving bank balance. The separate cash-in-transit amount will stop counting.'))update.mutate({id:row.id,action:'received'});}}>Deposit received</Button>{row.status==='needs_review'&&<Button variant="ghost" disabled={update.isPending} onClick={()=>update.mutate({id:row.id,action:'dismissed'})}>Dismiss</Button>}</div></div>)}
 {!active.length&&<p className="text-sm">No outstanding transfers.</p>}
 <details className="text-sm"><summary className="cursor-pointer">Transfer history</summary>{rows.filter(r=>!active.includes(r)).map(r=><p key={r.id}>{r.transferDate} · {formatUSD(Number(r.amount))} · {r.sourceLabel} → {r.destinationLabel} · {r.status}</p>)}</details>
 {update.isError&&<p role="alert" className="text-sm text-red-600">{update.error.message}</p>}
 </div>;
}
