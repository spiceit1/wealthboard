import { cents } from './transfer-reconciliation';

type Balance = { cash: number; transit: number; stocks: number; crypto: number; total: number };

export function explainNetWorthChange(start: Balance, current: Balance) {
  const difference = (key: keyof Balance) => cents(current[key]) - cents(start[key]);
  const transit = difference('transit');
  const cash = difference('cash') - transit;
  const stocks = difference('stocks');
  const crypto = difference('crypto');
  return {
    startingTotal: start.total,
    cash: cash / 100,
    transit: transit / 100,
    stocks: stocks / 100,
    crypto: crypto / 100,
    other: (difference('total') - cash - transit - stocks - crypto) / 100,
  };
}
