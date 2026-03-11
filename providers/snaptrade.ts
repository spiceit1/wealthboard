import type { Position, ProviderResult } from "@/providers/types";

export async function fetchSnapTradePositions(): Promise<ProviderResult<Position[]>> {
  throw new Error(
    "SnapTrade provider is not implemented yet. Use MOCK_MODE=true for local development.",
  );
}
