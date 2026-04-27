import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Database,
  Eye,
  MousePointerClick,
  Target,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getMetricsSummary } from "@/lib/metrics-queries";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MetricsChart } from "@/components/dashboard/metrics-chart";
import { cn } from "@/lib/utils";

const numberFmt = new Intl.NumberFormat("id-ID");
const compactFmt = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const greetingName = session.user.name ?? session.user.email ?? "";
  const summary = await getMetricsSummary({
    userId: session.user.id,
    days: WINDOW_DAYS,
  });

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
            tersinkron untuk {WINDOW_DAYS} hari terakhir.
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

  const { totals, daily } = summary;
  const chartData = daily.map((p) => ({
    date: p.date,
    sessions: p.sessions,
    conversions: p.conversions,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Selamat datang{greetingName ? `, ${greetingName}` : ""}.
        </h1>
        <p className="text-muted-foreground text-sm">
          Ringkasan {WINDOW_DAYS} hari terakhir dari {summary.connectedSources}{" "}
          koneksi aktif.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Sessions"
          icon={Activity}
          value={compactFmt.format(totals.sessions)}
          hint={`${numberFmt.format(totals.sessions)} total`}
        />
        <KpiCard
          label="Pageviews"
          icon={Eye}
          value={compactFmt.format(totals.pageviews)}
          hint={`${numberFmt.format(totals.pageviews)} total`}
        />
        <KpiCard
          label="Conversions"
          icon={Target}
          value={numberFmt.format(Math.round(totals.conversions))}
          hint={
            totals.clicks > 0
              ? `${((totals.conversions / totals.clicks) * 100).toFixed(2)}% dari clicks`
              : "Tracked di GA4"
          }
        />
        <KpiCard
          label="Clicks (Ads)"
          icon={MousePointerClick}
          value={compactFmt.format(totals.clicks)}
          hint={
            totals.spend > 0
              ? `Rp ${numberFmt.format(Math.round(totals.spend))} spend`
              : "Belum ada spend tracked"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Trend {WINDOW_DAYS} hari</CardTitle>
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
    </div>
  );
}
