import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local automatically; drizzle-kit does not. Load it here
// so `pnpm db:generate` / `db:push` / `db:studio` work without extra wrappers.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional; fall back to whatever the shell already provides
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
