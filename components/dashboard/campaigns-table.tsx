import { BarChart3, Megaphone, type LucideIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CampaignRow } from "@/lib/metrics-queries";

const numberFmt = new Intl.NumberFormat("id-ID");
const compactFmt = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const SOURCE_META: Record<string, { label: string; icon: LucideIcon }> = {
  ga4: { label: "GA4", icon: BarChart3 },
  google_ads: { label: "Google Ads", icon: Megaphone },
};

function formatNumber(n: number, opts?: { compact?: boolean }): string {
  if (n === 0) return "—";
  return opts?.compact ? compactFmt.format(n) : numberFmt.format(Math.round(n));
}

function formatCurrency(n: number): string {
  if (n === 0) return "—";
  return `Rp ${numberFmt.format(Math.round(n))}`;
}

type Props = {
  rows: CampaignRow[];
};

export function CampaignsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Belum ada data per-campaign.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source / Campaign</TableHead>
            <TableHead className="text-right">Impressions</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead className="text-right">Conversions</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const meta = SOURCE_META[row.source] ?? {
              label: row.source,
              icon: BarChart3,
            };
            const Icon = meta.icon;
            const campaignLabel =
              row.campaignName ??
              (row.campaignId ? row.campaignId : "(account-level rollup)");
            return (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <span className="bg-primary/10 text-primary mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded">
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {campaignLabel}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {meta.label} · {row.accountName}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.impressions, { compact: true })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.clicks, { compact: true })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.spend)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.conversions)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(row.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.sessions, { compact: true })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
