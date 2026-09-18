import assert from 'node:assert/strict';
import type { InvestmentsHoldingsGetResponse } from 'plaid';
import { normalizeInvestmentHoldings } from '../lib/investment-holdings';

function fixture() { return {
  accounts: [{account_id:'brokerage-1',name:'Robinhood',type:'investment'}],
  securities: [{security_id:'apple',ticker_symbol:'AAPL',name:'Apple',type:'equity',iso_currency_code:'USD'}],
  holdings: [{account_id:'brokerage-1',security_id:'apple',quantity:12.345678,institution_price:100,institution_value:1234.5678,iso_currency_code:'USD'}],
} as InvestmentsHoldingsGetResponse; }
const data = fixture();
assert.equal(normalizeInvestmentHoldings(data).positions[0].quantity,12.345678);
assert.equal(normalizeInvestmentHoldings(data).positions[0].symbol,'AAPL');
for (const bad of [NaN,Infinity,-1]) {
  const f=fixture(); f.holdings[0].quantity=bad;
  assert.throws(()=>normalizeInvestmentHoldings(f),/Invalid or short/);
}
const missing=fixture();missing.securities=[];assert.throws(()=>normalizeInvestmentHoldings(missing),/security details/);
const foreign=fixture();foreign.holdings[0].iso_currency_code='EUR';assert.throws(()=>normalizeInvestmentHoldings(foreign),/non-USD/);
const duplicate=fixture();duplicate.holdings.push(duplicate.holdings[0]);assert.throws(()=>normalizeInvestmentHoldings(duplicate),/duplicate/);
const options=fixture();options.securities[0].type='derivative';assert.throws(()=>normalizeInvestmentHoldings(options),/Cannot yet import/);
const cash=fixture();cash.securities[0].is_cash_equivalent=true;assert.equal(normalizeInvestmentHoldings(cash).positions[0].assetClass,'cash');
assert.equal(normalizeInvestmentHoldings(cash).positions[0].value,1234.5678);
const crypto=fixture();crypto.securities[0].type='cryptocurrency';assert.equal(normalizeInvestmentHoldings(crypto).positions.length,0);
const sold=fixture();sold.holdings=[];assert.equal(normalizeInvestmentHoldings(sold).positions.length,0);
const noAccounts=fixture();noAccounts.accounts=[];assert.throws(()=>normalizeInvestmentHoldings(noAccounts),/No investment accounts/);
console.log('Investment validation, fractional quantities, sold positions and unsupported assets passed');

const cashOnly=fixture();cashOnly.holdings=[];cashOnly.accounts[0].balances={available:10000,current:10000,iso_currency_code:'USD',unofficial_currency_code:null,limit:null};
assert.equal(normalizeInvestmentHoldings(cashOnly).positions[0].value,10000);
const zeroCash=fixture();zeroCash.accounts[0].balances={...cashOnly.accounts[0].balances,available:0,current:1234.5678};
const zeroPositions=normalizeInvestmentHoldings(zeroCash).positions;
assert.equal(zeroPositions.filter(p=>p.assetClass==='cash')[0].value,0);
assert.equal(zeroPositions.reduce((sum,p)=>sum+p.value,0),1234.5678);
const noCash=fixture();noCash.accounts[0].balances={...cashOnly.accounts[0].balances,available:null,current:10000};
assert.equal(normalizeInvestmentHoldings(noCash).positions.filter(p=>p.assetClass==='cash').length,0);
cash.accounts[0].balances={...cashOnly.accounts[0].balances,available:1234.5678};
assert.equal(normalizeInvestmentHoldings(cash).positions.reduce((sum,p)=>sum+p.value,0),1234.5678);
console.log('Brokerage cash: cash-only, zero cash, unknown cash and no double-counting passed');
