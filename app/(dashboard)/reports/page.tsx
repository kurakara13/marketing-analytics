import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Download, FileText } from "lucide-react";

import { auth } from "@/lib/auth";
import { listConnectionsForUser } from "@/lib/connections";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allConnections = await listConnectionsForUser(session.user.id);
  const realConnections = allConnections.filter(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );
  const sources = Array.from(
    new Set(realConnections.map((c) => c.connectorId)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Auto-generated PowerPoint reports dari data semua data source
          terkoneksi. Download .pptx, edit narrative section di PowerPoint,
          presentasikan.
        </p>
      </div>

      {realConnections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada data source aktif</CardTitle>
            <CardDescription>
              Connect minimal satu data source di /data-sources sebelum generate
              report.
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
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ReportCard
          title="Weekly Report"
          icon={Calendar}
          description="7 hari terakhir vs 7 hari sebelumnya, dengan trend 6 minggu. 8 slide PPT — cover, executive summary, website performance, Google Ads, organic, narrative, action items, closing."
          href="/api/reports/weekly/export"
          filename="marketing-analytics-weekly-{date}.pptx"
          enabled={realConnections.length > 0}
        />
        <ReportCard
          title="Monthly Report"
          icon={FileText}
          description="30 hari terakhir vs 30 hari sebelumnya, dengan trend 6 bulan. Sama 8 slide tapi window lebih panjang — cocok untuk monthly review."
          href="/api/reports/monthly/export"
          filename="marketing-analytics-monthly-{date}.pptx"
          enabled={realConnections.length > 0}
        />
      </div>

      {realConnections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Data sources terkoneksi</CardTitle>
            <CardDescription>
              Report-nya akan otomatis pakai data dari source-source ini.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {sources.map((s) => {
                const count = realConnections.filter(
                  (c) => c.connectorId === s,
                ).length;
                return (
                  <li key={s} className="flex items-center justify-between">
                    <span className="font-medium">
                      {s === "ga4"
                        ? "Google Analytics 4"
                        : s === "google_ads"
                          ? "Google Ads"
                          : s}
                    </span>
                    <span className="text-muted-foreground">
                      {count} {count === 1 ? "akun" : "akun"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yang di-auto-fill vs manual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong className="text-emerald-700 dark:text-emerald-400">
              Auto-filled
            </strong>{" "}
            — Cover (date + week number), KPI cards (sessions, conversions,
            spend, CPL), trend charts (6 minggu / 6 bulan), Google Ads campaign
            table.
          </div>
          <div>
            <strong className="text-amber-700 dark:text-amber-400">
              Editable di PowerPoint
            </strong>{" "}
            — Key Wins, Areas of Improvement, Action Items. Slide-slide ini ship
            dengan placeholder bullets — Anda edit di PowerPoint setelah
            download untuk menambah konteks &amp; narrative.
          </div>
          <div>
            <strong className="text-muted-foreground">Coming soon</strong> —
            Search Console connector akan auto-fill slide Organic &amp; SEO.
            Meta / TikTok / Instagram connector saat tersedia akan otomatis
            nambah ke executive summary.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportCard({
  title,
  icon: Icon,
  description,
  href,
  filename,
  enabled,
}: {
  title: string;
  icon: typeof Calendar;
  description: string;
  href: string;
  filename: string;
  enabled: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground mt-auto flex flex-col gap-2 text-xs">
        <div className="font-mono">{filename}</div>
        {enabled ? (
          <a
            href={href}
            download
            className={cn(buttonVariants({ variant: "default" }), "w-full")}
          >
            <Download className="size-4" />
            Download .pptx
          </a>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full opacity-50",
            )}
          >
            Connect data source dulu
          </span>
        )}
      </CardContent>
    </Card>
  );
}
