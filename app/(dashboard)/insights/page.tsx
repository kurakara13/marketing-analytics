import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { listInsightsForUser } from "@/lib/ai/insights";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateInsightsButton } from "@/components/insights/generate-insights-button";
import { InsightCard } from "@/components/insights/insight-card";
import { cn } from "@/lib/utils";

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const insights = await listInsightsForUser(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-muted-foreground text-sm">
            Analisis data marketing Anda dengan Claude. Setiap generate
            menghasilkan ringkasan, observasi, dan rekomendasi yang actionable.
          </p>
        </div>
        <GenerateInsightsButton />
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada insight</CardTitle>
            <CardDescription>
              Pastikan ada koneksi data source yang sudah tersinkron, lalu klik{" "}
              <strong>Generate insight</strong>. Generate butuh ~10–30 detik.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/data-sources"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Buka Data Sources
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
