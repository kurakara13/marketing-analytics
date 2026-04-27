import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Public liveness probe — no auth. Don't expose anything sensitive here:
// just status, db connectivity boolean, and timestamp.
export async function GET() {
  let database: "connected" | "disconnected" = "disconnected";
  try {
    await db.execute(sql`SELECT 1`);
    database = "connected";
  } catch {
    database = "disconnected";
  }

  return NextResponse.json(
    {
      status: database === "connected" ? "ok" : "degraded",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: database === "connected" ? 200 : 503 },
  );
}
