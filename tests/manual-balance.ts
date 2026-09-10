import assert from 'node:assert/strict';
import { manualBalanceSchema } from '../lib/manual-balance';
const accountId='11111111-1111-4111-8111-111111111111';
for (const balance of ['0','1250.25','-20.50','999999999999.99']) assert(manualBalanceSchema.safeParse({accountId,balance}).success);
for (const balance of ['', '1e6','NaN','1.001','1000000000000','1,250.25',null,100]) assert(!manualBalanceSchema.safeParse({accountId,balance}).success);
assert(!manualBalanceSchema.safeParse({accountId:'wrong',balance:'1'}).success);
console.log('Manual balance validation passed.');
