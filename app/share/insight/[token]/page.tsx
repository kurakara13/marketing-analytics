import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { findInsightByShareToken } from "@/lib/ai/insights";
import { InsightCard } from "@/components/insights/insight-card";

// Public read-only insight view. No auth — anyone with the token sees
// the content. Token doesn't grant any write access (the InsightCard
// is rendered with showShare=false and feedback omitted, so no
// interactive controls leak through).
//
// We don't render the user's nav shell here — this is a self-contained
// page intended for sharing with stakeholders who don't have an
// account.

type Params = Promise<{ token: string }>;

export default async function PublicInsightPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const insight = await findInsightByShareToken(token);
  if (!insight) notFound();

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-3.5 text-primary" />
            Marketing Analytics — AI Insight
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Insight {insight.windowStart} → {insight.windowEnd}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Read-only share dari sebuah AI insight di Marketing Analytics.
            Pemilik insight bisa revoke link ini kapan saja sehingga URL
            tidak bisa dibuka lagi.
          </p>
        </div>

        <InsightCard insight={insight} showShare={false} />

        <p className="text-muted-foreground/80 text-center text-xs">
          AI-generated. Validasi angka dengan source data Anda sebelum
          ambil keputusan operasional.
        </p>
      </div>
    </div>
  );
}
