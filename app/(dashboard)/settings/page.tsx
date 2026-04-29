import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Settings as SettingsIcon } from "lucide-react";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthlyTargets } from "@/lib/db/schema";
import { getBusinessContext } from "@/lib/business-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { MonthlyTargetsForm } from "@/components/settings/monthly-targets-form";
import { BusinessContextForm } from "@/components/settings/business-context-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [targets, businessContext] = await Promise.all([
    db
      .select({
        year: monthlyTargets.year,
        month: monthlyTargets.month,
        metric: monthlyTargets.metric,
        value: monthlyTargets.value,
      })
      .from(monthlyTargets)
      .where(eq(monthlyTargets.userId, session.user.id)),
    getBusinessContext(session.user.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Pengaturan akun dan preferensi yang menentukan bagaimana AI menganalisis data Anda."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Informasi akun yang sedang aktif.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nama</span>
            <span>{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{session?.user?.email ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konteks bisnis</CardTitle>
          <CardDescription>
            Disuntikkan ke prompt AI insights agar observation & rekomendasi
            relevan ke industri & target audience Anda. Semua opsional —
            kosongkan kalau tidak relevan. Berlaku untuk insight yang
            di-generate setelah simpan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessContextForm
            initial={
              businessContext
                ? {
                    industry: businessContext.industry,
                    targetAudience: businessContext.targetAudience,
                    brandVoice: businessContext.brandVoice,
                    businessGoals: businessContext.businessGoals,
                    leadEventName: businessContext.leadEventName,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Sessions Target</CardTitle>
          <CardDescription>
            Target sessions per bulan, dipakai oleh slide Website Performance
            di report (chart Sessions vs Target). Set untuk minimal 4 bulan
            terakhir agar chart full.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyTargetsForm targets={targets} />
        </CardContent>
      </Card>
    </div>
  );
}
