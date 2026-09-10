import { z } from "zod";

export const manualBalanceSchema = z.object({
  accountId: z.string().uuid(),
  // Keep cents exact within JavaScript's safe integer range and numeric(16,2).
  balance: z.string().trim().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Enter a dollar amount with at most two decimal places."),
});
