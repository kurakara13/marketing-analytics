# Marketing Analytics

Multi-source SaaS reporting platform that aggregates campaign and analytics
data from **Google Ads, Google Analytics 4, Search Console, and Meta Ads**
into a unified dashboard for digital marketing teams.

> **Status**: Private beta with one pilot customer. General availability
> planned late 2026.

## What it does

- **Connect** any number of ad and analytics accounts via OAuth 2.0 — one
  click per source
- **Sync** daily campaign performance into a normalized time-series schema
  (impressions, clicks, spend, conversions, revenue, plus
  source-specific metrics in a JSONB raw_data column)
- **Visualize** unified KPIs cross-source: KPI cards, time-series charts,
  per-account / per-campaign breakdowns
- **Schedule** daily background syncs via a cron worker; manual "Sync now"
  for immediate refresh

## Google Ads API integration

The Google Ads connector is **strictly read-only**. It uses exactly two
endpoints:

| Endpoint                                | Purpose                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `customers:listAccessibleCustomers`     | Enumerate accounts the OAuth-authenticated user has access to                                                    |
| `googleAds:searchStream` (GAQL queries) | Fetch daily campaign metrics: impressions, clicks, cost_micros, conversions, conversions_value, ctr, average_cpc |

We do **not** call any mutate endpoints. We do **not** create, modify,
pause, or delete campaigns, ad groups, ads, keywords, budgets, bidding
strategies, or targeting. We do **not** use App Conversion Tracking or
Remarketing API endpoints.

Authentication: standard OAuth 2.0. Each end user authorizes the platform
to access their own Google Ads accounts. Refresh tokens are AES-256-GCM
encrypted at rest in PostgreSQL — the encryption key lives in environment
variables, never in source control or the database.

## Architecture

```
[User's Google Ads / GA4 / Meta Ads accounts]
            ↓ OAuth 2.0
[Marketing Analytics web app — Next.js + PostgreSQL]
            ↓ daily cron + manual sync
[Unified daily_metric table]
            ↓
[Dashboard UI — KPI cards, time-series charts, breakdowns]
```

Per-source connectors live under `lib/connectors/<platform>/` with a
consistent interface (`listAccounts`, `fetchMetrics`). Adding a new
source is a folder + a registry entry.

## Privacy & security

- OAuth refresh + access tokens encrypted at rest (AES-256-GCM)
- No PII collected from end-user accounts — only aggregated campaign
  performance metrics
- Multi-tenant isolation enforced at the database query level: every
  connection and metric row is scoped to a user_id; users cannot see each
  other's data
- No data resale, syndication, or third-party sharing of API responses
- Optional AI insights (OpenAI GPT-5) operate only on
  post-aggregation summary metrics — raw API responses are never sent
  to external services

## Stack

| Layer           | Choice                                      |
| --------------- | ------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, RSC)     |
| Language        | TypeScript (strict)                         |
| Database        | PostgreSQL 16+ with Drizzle ORM             |
| Auth            | NextAuth.js v5 (Credentials + JWT sessions) |
| UI              | Tailwind CSS v4, shadcn/ui (`base-nova`)    |
| Charts          | Recharts                                    |
| Forms           | react-hook-form + Zod                       |
| Cron            | node-cron (separate worker process)         |
| AI (optional)   | `openai` SDK — GPT-5 (structured outputs)   |
| Package manager | pnpm                                        |
| Deployment      | Self-hosted (PM2 + Caddy/Nginx on Ubuntu)   |

## Local development

Prerequisites: **Node.js 20.9+**, **pnpm**, **PostgreSQL 16+**.

### 1. Provision the database

```bash
psql -U postgres -c "CREATE DATABASE analytics_dev;"
```

### 2. Bootstrap the app

```bash
git clone https://github.com/kurakara13/marketing-analytics.git
cd marketing-analytics

pnpm install

cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_* keys, etc.

pnpm db:migrate   # apply schema
pnpm dev          # start the web app

# In another terminal, run the background sync worker:
pnpm worker
```

Open <http://localhost:3000> and register the first user via the **Daftar**
link.

## Folder structure

```
app/
├── (auth)/                  Public routes (login, register)
├── (dashboard)/             Auth-required routes (sidebar shell)
│   ├── dashboard/           /dashboard — KPIs + trend chart
│   ├── data-sources/        /data-sources — connect / sync / disconnect
│   ├── insights/            /insights — AI-generated reports (optional)
│   └── settings/            /settings
└── api/
    ├── auth/[...nextauth]/  NextAuth route handler
    ├── connectors/google/   OAuth connect + callback for Google sources
    └── health/              Liveness probe (public)

components/                  shadcn/ui + dashboard + data-sources + insights
lib/
├── db/                      Drizzle schemas + migrations + client
├── connectors/              Per-platform connectors
│   ├── ga4/                 Google Analytics 4
│   └── google-ads/          Google Ads (read-only)
├── google/                  Shared Google OAuth + token refresh
├── connections.ts           DB ops for `connection` rows
├── crypto.ts                AES-256-GCM helper for token encryption
├── sync.ts                  syncConnection orchestrator
├── ai/                      OpenAI GPT-5 insight engine (optional)
└── metrics-queries.ts       Aggregations powering the dashboard

scripts/
└── worker.ts                Cron worker (daily sync of all connections)
```

## Scripts

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm dev`         | Start Next.js dev server                                    |
| `pnpm build`       | Production build                                            |
| `pnpm start`       | Run production server                                       |
| `pnpm lint`        | ESLint                                                      |
| `pnpm format`      | Format codebase with Prettier                               |
| `pnpm db:generate` | Generate SQL migrations from schema changes                 |
| `pnpm db:migrate`  | Apply generated migrations                                  |
| `pnpm db:studio`   | Open Drizzle Studio (DB browser)                            |
| `pnpm worker`      | Long-running cron worker (daily sync at 02:00 server-local) |
| `pnpm worker:once` | Run one sync pass and exit (testing / ad-hoc)               |

## Production deployment

Production deployments must:

- Run PostgreSQL on a separate, secured instance
- Set a strong `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- Set a strong `ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Run the app behind a reverse proxy (Caddy / Nginx) terminating TLS
- Run the worker (`pnpm worker`) under PM2 / systemd alongside `next start`
- Pass env vars through the OS / orchestrator, never via committed `.env` files

## Contact

`johnputra13@gmail.com`

## License

Private / internal.
