import assert from "node:assert/strict";

import { queryKeysForDomains } from "@/lib/query-invalidation";
import { domainsForRunFinish, domainsForRunStart } from "@/lib/sync-domain-mapping";

function run() {
  const startDomains = domainsForRunStart();
  assert.deepEqual(startDomains, ["dashboard", "syncRuns", "settings"]);

  const scheduledFinish = domainsForRunFinish("scheduled");
  assert.ok(scheduledFinish.includes("history"));
  assert.ok(scheduledFinish.includes("historyDetail"));

  const manualFinish = domainsForRunFinish("manual");
  assert.ok(manualFinish.includes("accounts"));
  assert.ok(!manualFinish.includes("history"));

  const systemFinish = domainsForRunFinish("system");
  assert.ok(systemFinish.includes("holdings"));
  assert.ok(!systemFinish.includes("accounts"));

  const keys = queryKeysForDomains(["dashboard", "holdings", "syncRuns"]);
  assert.deepEqual(keys, [["dashboard"], ["holdings-overview"], ["sync-runs-overview"]]);

  console.log("live-updates.integration: ok");
}

run();

