# WealthBoard

Production-focused personal finance dashboard scaffold.

This repository is currently at **Phase 3**:

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
- Function stubs:
  - `netlify/functions/manual-sync.ts`
  - `netlify/functions/scheduled-sync.ts`
- Schedule hardening and duplicate-run protection are implemented in later phases.

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

Phase 4 will add expanded charts and deeper drill-down pages for accounts/holdings trends.
