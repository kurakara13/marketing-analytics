# Marketing Analytics

Self-hosted marketing analytics platform that aggregates data from multiple ad and analytics sources (Google Analytics 4, Google Ads, Meta Ads, etc.) into a unified dashboard, with built-in AI-powered marketing strategy recommendations powered by Claude.

> Phase 0 — foundation only. Data connectors and AI insights arrive in subsequent phases.

## Stack

| Layer           | Choice                                      |
| --------------- | ------------------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack, RSC)     |
| Language        | TypeScript (strict)                         |
| Database        | PostgreSQL 16                               |
| ORM             | Drizzle ORM + `postgres` driver             |
| Auth            | NextAuth.js v5 (Credentials + JWT sessions) |
| UI              | Tailwind CSS v4, shadcn/ui (`base-nova`)    |
| Charts          | Recharts (Tremor reserved for later)        |
| Forms           | react-hook-form + Zod                       |
| Toasts          | Sonner                                      |
| AI (Phase 3)    | `@anthropic-ai/sdk`                         |
| Package manager | pnpm                                        |
| Deployment      | Self-hosted (PM2 + Caddy/Nginx on Ubuntu)   |

## Local development

Prerequisites: **Node.js 20.9+** (Next 16 minimum), **pnpm**, **PostgreSQL 16+** running locally (or any reachable Postgres instance — Neon, Supabase, etc.).

### 1. Provision the database

Install Postgres ([official Windows installer](https://www.postgresql.org/download/windows/) or a managed service of your choice), then create an empty database:

```bash
# via psql (replace <password> with your postgres password)
psql -U postgres -c "CREATE DATABASE analytics_dev;"

# or via pgAdmin: Servers → PostgreSQL → right-click Databases → Create → Database
#   Name: analytics_dev
```

### 2. Bootstrap the app

```bash
git clone <repo>
cd marketing-analytics

pnpm install

# Configure env
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL with your password, and:
openssl rand -base64 32   # paste output as NEXTAUTH_SECRET

# Apply schema (creates auth tables: user, account, session, verificationToken)
pnpm db:push

# Run dev server
pnpm dev
```

Open <http://localhost:3000> — you'll be redirected to `/login`. Use the **Daftar** link to register the first user; you'll be auto-logged-in and dropped on `/dashboard`.

## Folder structure

```
app/
├── (auth)/                  Public routes (login, register)
├── (dashboard)/             Auth-required routes (sidebar shell)
│   ├── dashboard/           /dashboard — welcome
│   ├── data-sources/        /data-sources — Phase 1
│   ├── insights/            /insights — Phase 3
│   └── settings/            /settings
├── api/
│   ├── auth/[...nextauth]/  NextAuth route handler
│   └── health/              Liveness probe (public, no auth)
├── layout.tsx               Root layout (mounts <Toaster />)
└── page.tsx                 Root: redirects to /dashboard or /login

components/
├── ui/                      shadcn/ui components
└── dashboard/               Sidebar, header, user menu, mobile nav

lib/
├── db/
│   ├── index.ts             Drizzle client (postgres driver)
│   ├── schema/              Drizzle schemas (NextAuth tables here today)
│   └── migrations/          drizzle-kit generate output
├── auth.ts                  NextAuth config + Credentials authorize()
├── connectors/              Per-platform connectors (GA4 today)
│   ├── types.ts             Connector interface
│   ├── registry.ts          Catalog exposed to the UI
│   └── ga4/                 Google Analytics 4 implementation
├── google/                  Shared Google OAuth + token handling
├── connections.ts           DB ops for `connection` rows
├── crypto.ts                AES-256-GCM helper for at-rest token encryption
├── sync.ts                  syncConnection orchestrator
├── jobs/                    (reserved) heavier scheduled jobs
├── ai/                      ⏳ Phase 3: Claude integrations
├── validators/              Shared Zod schemas
└── utils.ts                 cn() helper

types/                       Shared TS types (NextAuth augmentation, etc.)
scripts/                     CLI scripts (e.g. seed, worker)
```

## Scripts

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start Next.js dev server (Turbopack)                  |
| `pnpm build`        | Production build                                      |
| `pnpm start`        | Run production server                                 |
| `pnpm lint`         | ESLint                                                |
| `pnpm format`       | Format codebase with Prettier                         |
| `pnpm format:check` | Verify formatting without writing                     |
| `pnpm db:generate`  | Generate SQL migrations from schema changes           |
| `pnpm db:push`      | Push schema directly to DB (dev only)                 |
| `pnpm db:migrate`   | Apply generated migrations (production)               |
| `pnpm db:studio`    | Open Drizzle Studio (DB browser)                      |
| `pnpm worker`       | Long-running cron worker (sync all connections daily) |
| `pnpm worker:once`  | Run one sync pass and exit                            |

## Architecture principles

1. **Modular connectors** — Each data source lives under `lib/connectors/<platform>/` with a consistent interface (auth, fetcher, transformer, sync).
2. **Unified schema** — All platforms normalize into shared `daily_metric` rows with a `source` discriminator and `raw_data` JSONB for source-specific fields.
3. **Type safety end-to-end** — Drizzle schema → inferred TS types → Zod validators on API boundaries.
4. **Server Components first** — Use RSCs for data fetching. Client Components only for interactivity (forms, charts).
5. **Encrypted secrets at rest** — OAuth refresh + access tokens are AES-256-GCM encrypted before hitting the DB (`lib/crypto.ts`).

## Connector lifecycle

```
[user clicks Connect with Google]
        ↓
/api/connectors/google/connect      sets state cookie, redirects to Google OAuth
        ↓
[Google consent screen]
        ↓
/api/connectors/google/callback     validates state → exchanges code →
                                    connector.listAccounts() →
                                    upserts one `connection` row per external account
        ↓
[Data Sources page shows Connected]
        ↓
[Sync now / Sync all / cron worker]
        ↓
syncConnection() → fetchMetrics() → upsert `daily_metric` rows
                                  → log a `sync_run` row
```

## Background worker

The worker syncs every active connection on a cron schedule. Run as a
separate process from the Next.js server (so a long sync doesn't block
HTTP requests):

```bash
pnpm worker            # default schedule: daily at 02:00 server local time
WORKER_CRON="*/30 * * * *" pnpm worker   # every 30 minutes
pnpm worker:once       # run one pass and exit (useful for testing)
```

In production, run it under PM2 (or systemd) alongside `next start`.

## Connectors

| Connector          | Provider | OAuth scope                                          | Extra config required        |
| ------------------ | -------- | ---------------------------------------------------- | ---------------------------- |
| Google Analytics 4 | Google   | `https://www.googleapis.com/auth/analytics.readonly` | none                         |
| Google Ads         | Google   | `https://www.googleapis.com/auth/adwords`            | `GOOGLE_ADS_DEVELOPER_TOKEN` |

### Getting a Google Ads developer token

Google Ads API requires a **developer token** in addition to OAuth. Apply
once per Google Ads account:

1. Sign in to <https://ads.google.com> with the account that owns the data
   you want to read
2. Tools menu → **Setup** → **API Center**
3. Fill the application form (use case: "internal reporting tool")
4. Token is issued in **Test access** mode immediately — it can call the
   API but only against test accounts (production accounts return zero rows)
5. To read real production data, click **Apply for Basic access** in the
   same page. Approval typically takes 1–7 days.

Once you have the token, set `GOOGLE_ADS_DEVELOPER_TOKEN` in `.env.local`.

If your Google Ads account is accessed via a manager (MCC) account, also
set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the MCC's customer id (digits only,
no dashes).

## Production deployment

> **Important:** `.env.example` contains placeholders only — never commit real credentials.

Production deployments must:

- Run Postgres on a separate, secured instance (managed service, or hardened self-hosted)
- Set a strong `NEXTAUTH_SECRET` (32+ bytes, generated with `openssl rand -base64 32`)
- Use a strong, unique database password — never commit real credentials
- Rotate database and `NEXTAUTH_SECRET` periodically
- Run the app behind a reverse proxy (Caddy or Nginx) terminating TLS
- Use PM2 (or systemd) to keep the Node process alive
- Pass env vars through the OS / orchestrator, not via committed `.env` files

Detailed deployment runbook: _to be written._

## License

Private / internal.
