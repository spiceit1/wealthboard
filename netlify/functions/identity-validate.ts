import type { Handler } from "@netlify/functions";
// Identity lifecycle hooks intentionally use the provider's legacy handler contract.
export const handler: Handler = async event => {
  const user = JSON.parse(event.body ?? "{}").user;
  const allowed = process.env.WEALTHBOARD_OWNER_EMAIL?.toLowerCase();
  if (!allowed || user?.email?.toLowerCase() !== allowed) return { statusCode: 403, body: JSON.stringify({message:"Owner account only."}) };
  return { statusCode: 200, body: "{}" };
};
