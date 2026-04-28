import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Plus, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
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

  const reports = await db
    .select({
      id: reportTemplates.id,
      name: reportTemplates.name,
      description: reportTemplates.description,
      updatedAt: reportTemplates.updatedAt,
      definition: reportTemplates.definition,
    })
    .from(reportTemplates)
    .where(eq(reportTemplates.userId, session.user.id))
    .orderBy(desc(reportTemplates.updatedAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">
            Susun layout report Anda — drag widget di canvas, pilih data
            source, generate jadi .pptx kapan saja.
          </p>
        </div>
        <form action={createTemplateAction}>
          <input type="hidden" name="name" value="Untitled report" />
          <Button type="submit">
            <Plus className="size-4" />
            New blank report
          </Button>
        </form>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Belum ada report</CardTitle>
            <CardDescription>
              Klik &quot;New blank report&quot; untuk mulai. Builder akan
              terbuka dengan 1 slide kosong — tambah widget (text, KPI card,
              line chart) lalu konfigurasi data source.
            </CardDescription>
          </CardHeader>
        </Card>
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
                    <TemplateRowActions templateId={r.id} name={r.name} />
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
