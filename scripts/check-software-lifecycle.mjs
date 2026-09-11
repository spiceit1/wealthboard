import { readFile } from 'node:fs/promises';

const inventory = JSON.parse(await readFile(new URL('../docs/software-lifecycle.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const now = Date.now();
let failures = 0;
function check(name, deadline) {
  const end = Date.parse(`${deadline}T00:00:00Z`);
  if (!Number.isFinite(end) || now >= end) {
    console.error(`::error::${name}: support/review deadline ${deadline} has expired or is invalid.`);
    failures++;
  } else {
    const days = Math.ceil((end - now) / 86400000);
    console.log(`${days <= 90 ? '::warning::' : ''}${name}: ${days} days until ${deadline}.`);
  }
}
check('Lifecycle inventory review', inventory.reviewBy);
const major = lock.packages['node_modules/next'].version.split('.')[0];
if (major !== inventory.next.major) {
  console.error('::error::Next.js major changed; review the lifecycle inventory against the vendor support policy.');
  failures++;
} else check(`Next.js ${major}`, inventory.next.supportEnds);

try {
  const response = await fetch('https://raw.githubusercontent.com/nodejs/Release/main/schedule.json', { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Schedule HTTP ${response.status}`);
  const schedule = await response.json();
  const runtime = `v${process.versions.node.split('.')[0]}`;
  const release = schedule[runtime];
  if (!release?.lts || Date.parse(release.lts) > now) throw new Error(`${runtime} is not an LTS runtime`);
  check(`Running Node.js ${runtime}`, release.end);
} catch (error) {
  console.error(`::error::Node lifecycle could not be verified: ${error.message}`);
  failures++;
}
process.exitCode = failures ? 1 : 0;
