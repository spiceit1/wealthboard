# WealthBoard

Production-focused personal finance dashboard scaffold.

This repository is currently at **Phase 6**:

- Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui configured
- TanStack Query configured
- Drizzle + Neon wiring configured
- Netlify Functions + scheduled function scaffold configured
- Mock-first provider architecture scaffolded (`plaid`, `snaptrade`, `coingecko`)
- Normalized financial data model and generated Drizzle migration
- Seed script for demo user, accounts, holdings, snapshots, and sync events
- Dashboard + history views backed by daily snapshot data
- Central sync engine persists `sync_runs`, `sync_run_events`, and `daily_snapshots`
- Manual refresh now creates a sync job and polls live progress
- `/sync-logs` page now shows recent persisted sync runs
- `/accounts` and `/holdings` pages provide detailed drill-down tables
- Dashboard includes category trends chart
- Provider adapter registry routes plaid/snaptrade/coingecko through mock or real mode
- `/connections` shows provider mode, readiness, and security constraints
- Scheduled sync hardened for 9:00 AM America/New_York with DST-safe UTC cron windows
- Duplicate scheduled runs are prevented per New York calendar day
- `/settings` now shows scheduler health and latest run status

## Tech Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts
- Backend: Netlify Functions
- Database: Neon Postgres + Drizzle ORM
- Validation: Zod
- Scheduling: Netlify Scheduled Functions (scaffolded in Phase 1)
- Deployment: Netlify

## Project Structure

```text
app/
components/
providers/
services/
db/
drizzle/
netlify/functions/
lib/
```

## Security Principles

- Bank username/password storage is prohibited.
- Financial account integrations are read-only.
- No transaction endpoints are implemented.
- Secrets must only live in environment variables.
- Frontend code does not receive provider secret keys.
- `MOCK_MODE=true` is the default development path.

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Fill required values:
   - `DATABASE_URL`
   - `APP_URL`
   - `MOCK_MODE` (`true` for local mock-first development)

## Local Development

```bash
npm install
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Database Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

If migrations fail with `ENOTFOUND host`, your `DATABASE_URL` is still a placeholder.

## Mock Mode

- Keep `MOCK_MODE=true`.
- Provider files are split into real + mock implementations:
  - `providers/plaid.ts` and `providers/plaid.mock.ts`
  - `providers/snaptrade.ts` and `providers/snaptrade.mock.ts`
  - `providers/coingecko.ts` and `providers/coingecko.mock.ts`
- The dashboard sync API uses mock providers while in mock mode.

## Netlify (Scaffolded)

- `netlify.toml` is configured for Next.js + Functions.
- Functions:
  - `netlify/functions/manual-sync.ts` (token-protected via `x-internal-sync-token`)
  - `netlify/functions/scheduled-sync.ts` (auto-refresh window + NY-time gating)
- Scheduled function cron runs at `0 13,14 * * *` and executes only at 09:00 New York.

## GitHub Push Instructions

```bash
git init
git add .
git commit -m "chore: scaffold WealthBoard phase 1 foundation"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Netlify Deploy Instructions

1. Push repository to GitHub.
2. In Netlify, click **Add new site** -> **Import an existing project**.
3. Select the GitHub repository.
4. Configure environment variables from `.env.example`.
5. Deploy.

## Next Phase

Real API connection flows (Plaid Link + SnapTrade auth) and production provider token lifecycle hardening.
