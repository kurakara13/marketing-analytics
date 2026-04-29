import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  Plus,
  FileText,
  LayoutTemplate,
  Database,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import { listConnectionsForUser } from "@/lib/connections";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createTemplateAction } from "./actions";
import { TemplateRowActions } from "@/components/templates/template-row-actions";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const [reports, connections] = await Promise.all([
    db
      .select({
        id: reportTemplates.id,
        name: reportTemplates.name,
        description: reportTemplates.description,
        updatedAt: reportTemplates.updatedAt,
        definition: reportTemplates.definition,
      })
      .from(reportTemplates)
      .where(eq(reportTemplates.userId, userId))
      .orderBy(desc(reportTemplates.updatedAt)),
    listConnectionsForUser(userId),
  ]);
  const hasConnection = connections.some(
    (c) => !c.externalAccountId.startsWith("_pending_"),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FileText}
        title="Reports"
        subtitle="Susun layout report Anda — drag widget di canvas, pilih data source, generate jadi .pptx kapan saja."
        actions={
          <form action={createTemplateAction}>
            <input type="hidden" name="name" value="Untitled report" />
            <Button type="submit">
              <Plus className="size-4" />
              New blank report
            </Button>
          </form>
        }
      />

      {reports.length === 0 ? (
        <ReportsEmptyState hasConnection={hasConnection} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => {
            const def = r.definition as { slides?: unknown[] } | null;
            const slideCount = Array.isArray(def?.slides)
              ? def.slides.length
              : 0;
            return (
              <Card key={r.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base leading-tight">
                        {r.name}
                      </CardTitle>
                      <CardDescription className="mt-0.5 line-clamp-2">
                        {r.description ?? "Tanpa deskripsi"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-muted-foreground mt-auto flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>{slideCount} slide</span>
                    <span>
                      Diupdate{" "}
                      {formatDistanceToNow(r.updatedAt, {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/reports/${r.id}/edit`}
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "flex-1",
                      )}
                    >
                      Edit
                    </Link>
                    <a
                      href={`/api/reports/${r.id}/generate`}
                      download
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      Generate
                    </a>
                    <TemplateRowActions
                      templateId={r.id}
                      name={r.name}
                      description={r.description}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
//
// Branches on whether the user has a data source connected:
//   - No connection → guide them to /data-sources first; building a
//     report without data is a dead end (KPI/chart widgets render "—").
//   - Has connection → richer empty state explaining the report-builder
//     flow + visual cards listing the kinds of widgets available, then
//     a primary CTA for "New blank report".
function ReportsEmptyState({ hasConnection }: { hasConnection: boolean }) {
  if (!hasConnection) {
    return (
      <EmptyState
        icon={Database}
        title="Connect data source dulu"
        description={
          <>
            Report Anda akan terasa kosong tanpa data — KPI, chart, dan
            tabel butuh angka real dari Google Analytics atau Google Ads.
            Hubungkan minimal satu source dulu, lalu kembali ke sini.
          </>
        }
        action={
          <Link
            href="/data-sources"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <Database className="size-4" />
            Buka Data Sources
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={LayoutTemplate}
        tone="primary"
        title="Belum ada report — yuk bikin yang pertama"
        description={
          <>
            Builder akan terbuka dengan 1 slide kosong. Tambah widget dari
            palette di kanan, drag/resize di canvas, lalu Generate jadi
            .pptx kapan saja.
          </>
        }
        action={
          <form action={createTemplateAction}>
            <input type="hidden" name="name" value="Untitled report" />
            <Button type="submit">
              <Plus className="size-4" />
              New blank report
            </Button>
          </form>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <EmptyStateHint
          icon={LayoutTemplate}
          title="Layout"
          description="Text, image, shape, divider — bahan visual untuk frame slide."
        />
        <EmptyStateHint
          icon={Database}
          title="Data widgets"
          description="KPI card, line/bar chart, table — auto-resolve metric dari data source."
        />
        <EmptyStateHint
          icon={Sparkles}
          title="AI Insight"
          description="Drop AI Insight widget — Generate .pptx akan auto-fill commentary."
        />
      </div>
    </div>
  );
}

function EmptyStateHint({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="text-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5" />
        {title}
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        {description}
      </p>
    </div>
  );
}
