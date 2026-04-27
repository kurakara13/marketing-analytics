import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Database,
  Download,
  Eye,
  MousePointerClick,
  Target,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getCampaignBreakdown, getMetricsSummary } from "@/lib/metrics-queries";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampaignsTable } from "@/components/dashboard/campaigns-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { RangePicker } from "@/components/dashboard/range-picker";
import { DEFAULT_DAYS, parseDaysParam } from "@/lib/dashboard-ranges";
import { cn } from "@/lib/utils";

const numberFmt = new Intl.NumberFormat("id-ID");
const compactFmt = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const windowDays = parseDaysParam(params?.days);

  const greetingName = session.user.name ?? session.user.email ?? "";
  const [summary, campaignRows] = await Promise.all([
    getMetricsSummary({ userId: session.user.id, days: windowDays }),
    getCampaignBreakdown({ userId: session.user.id, days: windowDays }),
  ]);

  if (summary.connectedSources === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Selamat datang{greetingName ? `, ${greetingName}` : ""}.
          </h1>
          <p className="text-muted-foreground text-sm">
            Hubungkan data source pertama untuk mulai melihat metrik.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Belum ada koneksi</CardTitle>
            <CardDescription>
              Konek Google Analytics 4 atau Google Ads untuk mengisi dashboard
              ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/data-sources"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Buka Data Sources
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary.hasData) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Selamat datang{greetingName ? `, ${greetingName}` : ""}.
          </h1>
          <p className="text-muted-foreground text-sm">
            {summary.connectedSources} koneksi aktif, tapi belum ada data
            tersinkron untuk {windowDays} hari terakhir.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sync data dulu</CardTitle>
            <CardDescription>
              Klik <strong>Sync all</strong> di halaman Data Sources atau tunggu
              cron worker berjalan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/data-sources"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Buka Data Sources
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totals, previousTotals, daily } = summary;
  const chartData = daily.map((p) => ({
    date: p.date,
    sessions: p.sessions,
    conversions: p.conversions,
  }));

  const compactNumber = (n: number) => compactFmt.format(n);
  const formatInt = (n: number) => numberFmt.format(Math.round(n));
  const formatRupiah = (n: number) => `Rp ${numberFmt.format(Math.round(n))}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Selamat datang{greetingName ? `, ${greetingName}` : ""}.
          </h1>
          <p className="text-muted-foreground text-sm">
            Ringkasan {windowDays} hari terakhir vs {windowDays} hari
            sebelumnya, dari {summary.connectedSources} koneksi aktif.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <RangePicker defaultDays={DEFAULT_DAYS} />
          </Suspense>
          <a
            href={`/api/export/daily-metrics?days=${windowDays}`}
            download
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Download className="size-4" />
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Sessions"
          icon={Activity}
          current={totals.sessions}
          previous={previousTotals.sessions}
          format={compactNumber}
        />
        <KpiCard
          label="Pageviews"
          icon={Eye}
          current={totals.pageviews}
          previous={previousTotals.pageviews}
          format={compactNumber}
        />
        <KpiCard
          label="Conversions"
          icon={Target}
          current={totals.conversions}
          previous={previousTotals.conversions}
          format={formatInt}
          hint={
            totals.clicks > 0
              ? `${((totals.conversions / totals.clicks) * 100).toFixed(2)}% dari clicks`
              : undefined
          }
        />
        <KpiCard
          label="Clicks (Ads)"
          icon={MousePointerClick}
          current={totals.clicks}
          previous={previousTotals.clicks}
          format={compactNumber}
          hint={
            totals.spend > 0 ? `${formatRupiah(totals.spend)} spend` : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Trend {windowDays} hari</CardTitle>
              <CardDescription>
                Sessions (biru) dan conversions (hijau) per hari.
              </CardDescription>
            </div>
            <Database className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <MetricsChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown per Campaign</CardTitle>
          <CardDescription>
            Diurutkan dari spend tertinggi. Row dengan spend = 0 (mis. GA4
            account-level rollup) diurutkan berdasarkan clicks lalu sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignsTable rows={campaignRows} />
        </CardContent>
      </Card>
    </div>
  );
}
