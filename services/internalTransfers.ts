import { and, eq, desc, lt, sql, getTableColumns } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, internalTransfers, snapshotItems, dailySnapshots } from '@/db/schema';
import { getBrokerageCashRows } from './brokerageCash';
import { getPlaidClient } from '@/lib/plaid';
import { getPlaidAccessTokensForUser } from './plaidTokens';
import { collectCardTransactions } from '@/lib/credit-card';
import { cents, closeTransit, transferState, transitAt, unambiguousCashDrop } from '@/lib/transfer-reconciliation';

export async function getInternalTransfers(userId: string) {
  const rows = await db.select({...getTableColumns(internalTransfers), exactUpdatedAt:sql<string>`${internalTransfers.updatedAt}::text`}).from(internalTransfers).where(eq(internalTransfers.userId, userId));
  const banks = await db.select().from(accounts).where(eq(accounts.userId, userId));
  // Fail closed immediately if a newer bank balance may include the deposit.
  return rows.map(row => {
    const bank = banks.find(a => a.id === row.destinationAccountId && a.includedInTotals);
    const checked = bank ? transferState(row, bank.lastBalance, false, new Date()) : {...row, status:'needs_review', intervals:closeTransit(row.intervals, new Date())};
    if (checked.status !== row.status) {
      const expired = bank && cents(bank.lastBalance)===cents(row.destinationBalance);
      const cutoff = expired ? new Date(Date.parse(row.intervals.at(-1)!.from)+7*86400000) : bank?.balanceAsOf ?? new Date();
      return {...checked, intervals:closeTransit(row.intervals, cutoff)};
    }
    return row;
  });
}

export async function reconcileInternalTransfers(userId: string) {
  const plaid = getPlaidClient();
  const linked = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.includedInTotals, true)));
  const brokerCash = await getBrokerageCashRows(userId);
  const existing = await db.select({...getTableColumns(internalTransfers), exactUpdatedAt:sql<string>`${internalTransfers.updatedAt}::text`}).from(internalTransfers).where(eq(internalTransfers.userId,userId));
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const start = new Date(now.getTime()-14*86400000).toISOString().slice(0,10);
  const messages: string[] = [];
  for (const token of await getPlaidAccessTokensForUser(userId)) {
    if (token.investmentsEnabled || token.creditEnabled) continue;
    try {
      const response = await plaid.accountsGet({access_token:token.accessToken},{timeout:12000});
      for (const bank of response.data.accounts.filter(a => a.type==='depository' && a.balances.iso_currency_code==='USD')) {
        const dest = linked.find(a => a.providerAccountId===bank.account_id);
        if (!dest || bank.balances.current == null) continue;
        // Do not combine a new transaction feed with an older stored balance.
        if (cents(dest.lastBalance)!==cents(bank.balances.current)) {
          for (const row of existing.filter(r=>r.destinationAccountId===dest.id && r.status==='in_transit')) {
            await db.update(internalTransfers).set({status:'needs_review',intervals:closeTransit(row.intervals,cents(dest.lastBalance)!==cents(row.destinationBalance) ? dest.balanceAsOf ?? now : now),updatedAt:now}).where(and(eq(internalTransfers.id,row.id),eq(internalTransfers.userId,userId),sql`${internalTransfers.updatedAt} = ${row.exactUpdatedAt}::timestamptz`));
          }
          messages.push('Transfer reconciliation is waiting for matching bank balance and transaction data. Uncertain cash in transit is not counted.');
          continue;
        }
        const deadline = Date.now()+25000;
        const txs = await collectCardTransactions(async offset => { if(Date.now()>deadline) throw new Error("Transfer feed timed out"); return (await plaid.transactionsGet({access_token:token.accessToken,start_date:start,end_date:today,options:{account_ids:[bank.account_id],count:500,offset}},{timeout:12000})).data; });
        const incoming = txs.filter(t => t.account_id===bank.account_id && t.amount<0 && t.iso_currency_code==='USD');
        const claimed = new Set<string>();
        for (const row of existing.filter(r => r.destinationAccountId===dest.id && !['received','dismissed'].includes(r.status)).sort((a,b)=>a.id.localeCompare(b.id))) {
          const matches = incoming.filter(t => !claimed.has(t.transaction_id) && cents(-t.amount)===cents(row.amount) && t.date>=row.transferDate && t.date<=new Date(Date.parse(row.transferDate)+7*86400000).toISOString().slice(0,10) && (t.transaction_id===row.transactionId || t.pending_transaction_id===row.transactionId || (t.name.toLowerCase().includes(row.sourceLabel.toLowerCase().split(' ')[0]))));
          const match = matches.length===1 ? matches[0] : null;
          if (match) claimed.add(match.transaction_id);
          // Retire only after posting AND a changed receiving balance, avoiding feed/balance lag.
          const posted = !!match && !match.pending && cents(bank.balances.current)!==cents(row.destinationBalance);
          const changed = transferState(row,String(bank.balances.current),posted,now);
          const closureAt = cents(dest.lastBalance)!==cents(row.destinationBalance) ? dest.balanceAsOf ?? now : new Date(Math.min(now.getTime(),Date.parse(row.intervals.at(-1)?.from ?? now.toISOString())+7*86400000));
          const state = posted ? {...changed,status:'received',intervals:closeTransit(row.intervals,closureAt)} : changed.status!==row.status ? {...changed,intervals:closeTransit(row.intervals,closureAt)} : changed;
          await db.update(internalTransfers).set({status:state.status,intervals:state.intervals,transactionId:match?.transaction_id ?? row.transactionId,updatedAt:now}).where(and(eq(internalTransfers.userId,userId),eq(internalTransfers.id,row.id),sql`${internalTransfers.updatedAt} = ${row.exactUpdatedAt}::timestamptz`));
        }
        // Auto-count only pending inbound transfers from a uniquely identifiable linked source,
        // excluded from current balance, with an exact independently observed source cash drop.
        const pending = incoming.filter(t => t.pending && !claimed.has(t.transaction_id) && t.personal_finance_category?.primary==='TRANSFER_IN');
        const reviewedInstitutions = new Set<string>();
        for (const source of linked.filter(a=>a.id!==dest.id && a.institutionName.toLowerCase()!==dest.institutionName.toLowerCase())) {
          const institution = source.institutionName.toLowerCase();
          if (reviewedInstitutions.has(institution)) continue;
          reviewedInstitutions.add(institution);
          if (institution.length<3 || institution==='manual' || institution==='linked bank') continue;
          const group = pending.filter(t=>t.name.toLowerCase().includes(institution));
          if (!group.length) continue;
          const sum = group.reduce((n,t)=>n-t.amount,0);
          const [previous] = await db.select({value:snapshotItems.value}).from(snapshotItems).innerJoin(dailySnapshots,eq(snapshotItems.snapshotId,dailySnapshots.id)).where(and(eq(dailySnapshots.userId,userId),eq(snapshotItems.accountId,source.id),eq(snapshotItems.category,'cash_account'),lt(dailySnapshots.snapshotDate,group.map(t=>t.date).sort()[0]))).orderBy(desc(dailySnapshots.snapshotDate)).limit(1);
          const current = source.type==='brokerage' ? brokerCash.find(a=>a.id===source.id)?.lastBalance : source.lastBalance;
          const tracked=existing.filter(r=>r.sourceAccountId===source.id && r.transferDate>=start).reduce((n,r)=>n+Number(r.amount),0);
          const uniqueInstitution = linked.filter(a=>a.institutionName===source.institutionName).length===1;
          const automatic = uniqueInstitution && previous && current!=null && bank.balances.available!=null && cents(bank.balances.available-bank.balances.current)===cents(sum) && unambiguousCashDrop(Number(previous.value),Number(current),sum,tracked);
          for (const t of group) {
            await db.insert(internalTransfers).values({userId,sourceAccountId:source.id,destinationAccountId:dest.id,sourceLabel:source.institutionName,destinationLabel:dest.name,amount:String(-t.amount),transferDate:t.date,status:automatic?'in_transit':'needs_review',destinationBalance:String(bank.balances.current),transactionId:t.transaction_id,dedupeKey:`plaid:${t.transaction_id}`,evidence:automatic?'Pending inbound transfer excluded from current balance; exact linked source cash decrease verified.':'Possible internal transfer; balance inclusion or source debit not verified.',intervals:automatic?[{from:now.toISOString(),until:null}]:[],updatedAt:now}).onConflictDoNothing();
          }
        }
      }
    } catch { messages.push('Transfer reconciliation could not read a complete bank feed. Existing entries remain subject to balance and age checks; review Transfers.'); }
  }
  return messages;
}
export { transitAt };
