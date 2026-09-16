import { z } from "zod";
const money = z.number().finite().min(1).max(1_000_000);
const percent = z.number().finite().positive().max(95);
export const dcaSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80), symbol: z.literal("ZEC-USD"),
  baseAmount: money, safetyAmount: money, firstDeviation: percent,
  sizeMultiplier: z.number().min(1).max(5), spacingMultiplier: z.number().min(1).max(5),
  maxBuys: z.number().int().min(0).max(20), activeOrders: z.number().int().min(0).max(20), budget: money,
  entry: z.enum(["immediate", "price_below"]), entryPrice: z.number().finite().min(0).max(1_000_000),
  targets: z.array(z.object({ profit: percent, allocation: z.number().positive().max(100) })).min(1).max(4),
  reinvest: z.boolean(), stopLoss: z.number().min(0).max(95), trailingProfit: z.number().min(0).max(50),
  trailingStop: z.boolean(), stopAfterLoss: z.boolean(), cooldownMinutes: z.number().int().min(0).max(10080),
  repeat: z.boolean(), maxHours: z.number().int().min(0).max(8760),
  feePercent: z.number().min(0).max(10),
}).strict().superRefine((s, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (s.activeOrders > s.maxBuys) issue("activeOrders", "Active additional buys cannot exceed maximum additional buys.");
  if (s.maxBuys > 0 && s.activeOrders === 0) issue("activeOrders", "Choose at least one active additional buy.");
  if (s.entry === "price_below" && s.entryPrice <= 0) issue("entryPrice", "Enter a positive entry price.");
  if (Math.abs(s.targets.reduce((a,t) => a+t.allocation,0)-100) > 0.000001) issue("targets", "Sell allocations must total 100%.");
  if (s.targets.some((t,i) => i > 0 && t.profit <= s.targets[i-1].profit)) issue("targets", "Profit targets must increase in order.");
  if (s.trailingStop && s.stopLoss === 0) issue("stopLoss", "Set a stop-loss percentage before enabling a trailing stop.");
  let capital=s.baseAmount, deviation=0;
  for(let i=0;i<s.maxBuys;i++) { capital+=s.safetyAmount*Math.pow(s.sizeMultiplier,i); deviation+=s.firstDeviation*Math.pow(s.spacingMultiplier,i); }
  if (deviation>=100) issue("firstDeviation", "The buy ladder reaches a 100% drop. Reduce its spacing or number of buys.");
  if (capital*(1+s.feePercent/100)>s.budget+0.000001) issue("budget", "Budget must cover every buy plus the estimated buy fees.");
});
export type DcaSettings = z.infer<typeof dcaSettingsSchema>;
export const defaultDcaSettings: DcaSettings = {
  name:"Zcash DCA",symbol:"ZEC-USD",baseAmount:100,safetyAmount:100,firstDeviation:3,sizeMultiplier:1,spacingMultiplier:1,
  maxBuys:4,activeOrders:2,budget:600,entry:"immediate",entryPrice:0,targets:[{profit:3,allocation:100}],
  reinvest:false,stopLoss:0,trailingProfit:0,trailingStop:false,stopAfterLoss:true,cooldownMinutes:60,repeat:false,maxHours:0,feePercent:1,
};
// Planning arithmetic only. Execution must use broker precision, actual fees and confirmed fills.
export function previewDca(s: DcaSettings, referencePrice: number) {
  if (!Number.isFinite(referencePrice) || referencePrice<=0) throw new Error("Enter a positive reference price.");
  let cost=0, quantity=0, deviation=0;
  return Array.from({length:s.maxBuys+1},(_,i) => {
    if(i) deviation+=s.firstDeviation*Math.pow(s.spacingMultiplier,i-1);
    const price=referencePrice*(1-deviation/100), amount=i?s.safetyAmount*Math.pow(s.sizeMultiplier,i-1):s.baseAmount;
    if(price<=0) throw new Error("Buy ladder reaches zero price.");
    cost+=amount*(1+s.feePercent/100); quantity+=amount/price;
    const average=cost/quantity;
    return {step:i,drop:deviation,price,amount,cost,average,targets:s.targets.map(t=>average*(1+t.profit/100)/(1-s.feePercent/100))};
  });
}
