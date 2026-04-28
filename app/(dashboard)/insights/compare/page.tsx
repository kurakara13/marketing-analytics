import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { auth } from "@/lib/auth";
import { findInsightByIdForUser } from "@/lib/ai/insights";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InsightCard } from "@/components/insights/insight-card";
import { TotalsDeltaBlock } from "@/components/insights/totals-delta-block";
import { cn } from "@/lib/utils";

type SearchParams = Promise<{ a?: string; b?: string }>;

// Side-by-side comparison of two AI insights. The expected ordering is
// `a` = newer, `b` = older — but we don't enforce: callers (the compare
// link on the list page) pass them that way, and if they're flipped
// the rendering still makes sense (the "newer/older" labels are based
// on createdAt at runtime, not on which slot was passed).
export default async function CompareInsightsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const aId = params.a;
  const bId = params.b;

  if (!aId || !bId || aId === bId) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/insights"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "self-start",
          )}
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Parameter compare tidak lengkap</CardTitle>
            <CardDescription>
              Butuh dua insight id (`?a=...&b=...`) untuk membandingkan.
              Buka /insights dan klik tombol "Bandingkan" pada salah satu
              insight.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch both — short-circuit not-found per side so the user can tell
  // which one is missing (e.g. an insight got deleted).
  const [a, b] = await Promise.all([
    findInsightByIdForUser({ userId: session.user.id, insightId: aId }),
    findInsightByIdForUser({ userId: session.user.id, insightId: bId }),
  ]);

  if (!a || !b) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/insights"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "self-start",
          )}
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Insight tidak ditemukan</CardTitle>
            <CardDescription>
              {!a ? `Insight ${aId} tidak ada. ` : null}
              {!b ? `Insight ${bId} tidak ada.` : null}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Order so `newer` is the more recent createdAt regardless of input
  // slot. Display labels (Newer / Older) reflect runtime ordering.
  const newer = a.createdAt >= b.createdAt ? a : b;
  const older = a.createdAt >= b.createdAt ? b : a;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/insights"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "self-start -ml-3",
          )}
        >
          <ArrowLeft className="size-4" />
          Kembali ke list
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bandingkan insight
        </h1>
        <p className="text-muted-foreground text-sm">
          Side-by-side dua insight untuk lihat pergeseran observation,
          rekomendasi, dan metrik antar periode.
        </p>
      </div>

      <TotalsDeltaBlock newer={newer} older={older} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <ArrowRight className="size-3.5" />
            Lebih baru
          </div>
          <InsightCard insight={newer} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            Lebih lama
          </div>
          <InsightCard insight={older} />
        </div>
      </div>
    </div>
  );
}
