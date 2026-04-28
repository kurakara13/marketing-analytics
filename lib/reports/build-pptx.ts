import PptxGenJS from "pptxgenjs";

import type { ReportData, ReportTotals, TrendPoint } from "./fetch-report-data";

// Visual theme — tuned to look professional on a 16:9 widescreen deck.
// Hex without leading "#" — pptxgenjs convention.
const COLORS = {
  bgDark: "0F172A", // slate-900
  bgLight: "F8FAFC", // slate-50
  primary: "3B82F6", // blue-500
  accent: "10B981", // emerald-500
  warning: "F59E0B", // amber-500
  text: "0F172A",
  textMuted: "64748B", // slate-500
  border: "E2E8F0", // slate-200
  cardBg: "FFFFFF",
};

const FONT_FACE = "Calibri";

const numberFmt = new Intl.NumberFormat("id-ID");

function formatRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) {
    return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `Rp ${(n / 1_000).toFixed(0)}K`;
  }
  return `Rp ${numberFmt.format(Math.round(n))}`;
}

function deltaText(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "—";
  if (previous === 0) return "(baru)";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(pct > 100 ? 0 : 1)}% vs sebelumnya`;
}

// ─── Slide 1: Cover ─────────────────────────────────────────────────────
function addCoverSlide(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgDark };

  const title =
    data.period === "weekly"
      ? `Digital Marketing Weekly Report${data.weekNumber ? ` — Week ${data.weekNumber}` : ""}`
      : "Digital Marketing Monthly Report";

  slide.addText(title, {
    x: 0.5,
    y: 2.2,
    w: 12.3,
    h: 1.2,
    fontFace: FONT_FACE,
    fontSize: 36,
    bold: true,
    color: "FFFFFF",
    align: "center",
  });

  slide.addText(data.windowLabel, {
    x: 0.5,
    y: 3.6,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 20,
    color: COLORS.primary,
    align: "center",
  });

  slide.addText(
    `Generated ${new Date().toISOString().slice(0, 10)} · Marketing Analytics`,
    {
      x: 0.5,
      y: 6.6,
      w: 12.3,
      h: 0.4,
      fontFace: FONT_FACE,
      fontSize: 11,
      color: COLORS.textMuted,
      align: "center",
    },
  );
}

// ─── KPI card helper ────────────────────────────────────────────────────
function drawKpiCard(
  slide: PptxGenJS.Slide,
  args: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    value: string;
    sub?: string;
  },
): void {
  slide.addShape("roundRect", {
    x: args.x,
    y: args.y,
    w: args.w,
    h: args.h,
    fill: { color: COLORS.cardBg },
    line: { color: COLORS.border, width: 0.75 },
    rectRadius: 0.08,
  });
  slide.addText(args.label, {
    x: args.x + 0.15,
    y: args.y + 0.1,
    w: args.w - 0.3,
    h: 0.3,
    fontFace: FONT_FACE,
    fontSize: 10,
    color: COLORS.textMuted,
    bold: true,
  });
  slide.addText(args.value, {
    x: args.x + 0.15,
    y: args.y + 0.42,
    w: args.w - 0.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 22,
    color: COLORS.text,
    bold: true,
  });
  if (args.sub) {
    slide.addText(args.sub, {
      x: args.x + 0.15,
      y: args.y + args.h - 0.4,
      w: args.w - 0.3,
      h: 0.3,
      fontFace: FONT_FACE,
      fontSize: 9,
      color: COLORS.textMuted,
    });
  }
}

// ─── Slide 2: Executive Summary ─────────────────────────────────────────
function addExecutiveSummary(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  slide.addText(
    `Executive Summary — ${data.period === "weekly" ? `Week ${data.weekNumber ?? ""}`.trim() : data.windowLabel}`,
    {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.6,
      fontFace: FONT_FACE,
      fontSize: 24,
      bold: true,
      color: COLORS.text,
    },
  );

  // 4 KPI cards across the top
  const cardY = 1.2;
  const cardH = 1.4;
  const cardW = 2.95;
  const gap = 0.15;
  const cardX = (i: number) => 0.5 + i * (cardW + gap);

  drawKpiCard(slide, {
    x: cardX(0),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Total Sessions",
    value: numberFmt.format(Math.round(data.totals.sessions)),
    sub: deltaText(data.totals.sessions, data.previousTotals.sessions),
  });
  drawKpiCard(slide, {
    x: cardX(1),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Total Conversions",
    value: numberFmt.format(Math.round(data.totals.conversions)),
    sub: deltaText(data.totals.conversions, data.previousTotals.conversions),
  });
  drawKpiCard(slide, {
    x: cardX(2),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Total Spend (Ads)",
    value: formatRupiah(data.totals.spend),
    sub: deltaText(data.totals.spend, data.previousTotals.spend),
  });

  const cpl =
    data.totals.conversions > 0
      ? data.totals.spend / data.totals.conversions
      : 0;
  const prevCpl =
    data.previousTotals.conversions > 0
      ? data.previousTotals.spend / data.previousTotals.conversions
      : 0;
  drawKpiCard(slide, {
    x: cardX(3),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Average CPL",
    value: cpl > 0 ? formatRupiah(cpl) : "—",
    sub: cpl > 0 && prevCpl > 0 ? deltaText(cpl, prevCpl) : undefined,
  });

  // Two trend charts side-by-side
  const periodLabel = data.period === "weekly" ? "6 Minggu" : "6 Bulan";

  if (data.trend.length > 0) {
    addTrendChart(pres, slide, {
      x: 0.5,
      y: 2.85,
      w: 6.1,
      h: 4.3,
      title: `Trend Sessions (${periodLabel})`,
      data: data.trend,
      metric: "sessions",
      color: COLORS.primary,
    });
    addTrendChart(pres, slide, {
      x: 6.7,
      y: 2.85,
      w: 6.1,
      h: 4.3,
      title: `Trend Conversions (${periodLabel})`,
      data: data.trend,
      metric: "conversions",
      color: COLORS.accent,
    });
  } else {
    slide.addText("Tidak ada data trend untuk window ini.", {
      x: 0.5,
      y: 4.5,
      w: 12.3,
      h: 0.5,
      fontFace: FONT_FACE,
      fontSize: 14,
      color: COLORS.textMuted,
      align: "center",
      italic: true,
    });
  }
}

function addTrendChart(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  args: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    data: TrendPoint[];
    metric: keyof ReportTotals;
    color: string;
  },
): void {
  const labels = args.data.map((d) => d.label);
  const values = args.data.map((d) => Number(d[args.metric] ?? 0));

  slide.addChart(pres.ChartType.line, [{ name: args.title, labels, values }], {
    x: args.x,
    y: args.y,
    w: args.w,
    h: args.h,
    chartColors: [args.color],
    showTitle: true,
    title: args.title,
    titleFontSize: 12,
    titleFontFace: FONT_FACE,
    showLegend: false,
    showValue: false,
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
    catAxisLabelFontFace: FONT_FACE,
    valAxisLabelFontFace: FONT_FACE,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 6,
  });
}

// ─── Slide 3: Website (GA4) Performance ─────────────────────────────────
function addWebsiteSlide(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  slide.addText("Website Performance (GA4)", {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: COLORS.text,
  });

  const ga4Connected = data.connectedSources.includes("ga4");
  if (!ga4Connected) {
    drawPlaceholder(
      slide,
      "GA4 belum terhubung. Connect di /data-sources untuk mengisi slide ini otomatis.",
    );
    return;
  }

  // KPIs
  const cardY = 1.2;
  const cardW = 2.95;
  const cardH = 1.4;
  const gap = 0.15;
  const cardX = (i: number) => 0.5 + i * (cardW + gap);

  drawKpiCard(slide, {
    x: cardX(0),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Sessions",
    value: numberFmt.format(Math.round(data.totals.sessions)),
    sub: deltaText(data.totals.sessions, data.previousTotals.sessions),
  });
  drawKpiCard(slide, {
    x: cardX(1),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Pageviews",
    value: numberFmt.format(Math.round(data.totals.pageviews)),
    sub: deltaText(data.totals.pageviews, data.previousTotals.pageviews),
  });
  drawKpiCard(slide, {
    x: cardX(2),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Conversions",
    value: numberFmt.format(Math.round(data.totals.conversions)),
    sub: deltaText(data.totals.conversions, data.previousTotals.conversions),
  });
  const ppvSession =
    data.totals.sessions > 0 ? data.totals.pageviews / data.totals.sessions : 0;
  drawKpiCard(slide, {
    x: cardX(3),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Pages / Session",
    value: ppvSession > 0 ? ppvSession.toFixed(2) : "—",
  });

  if (data.trend.length > 0) {
    addTrendChart(pres, slide, {
      x: 0.5,
      y: 2.85,
      w: 12.3,
      h: 4.3,
      title: "Trend Sessions",
      data: data.trend,
      metric: "sessions",
      color: COLORS.primary,
    });
  }
}

// ─── Slide 4: Google Ads Performance ────────────────────────────────────
function addAdsSlide(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  slide.addText("Google Ads Performance", {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: COLORS.text,
  });

  const adsConnected = data.connectedSources.includes("google_ads");
  if (!adsConnected) {
    drawPlaceholder(
      slide,
      "Google Ads belum terhubung. Connect di /data-sources untuk mengisi slide ini otomatis.",
    );
    return;
  }
  if (data.totals.spend === 0 && data.totals.clicks === 0) {
    drawPlaceholder(
      slide,
      "Belum ada data Google Ads tersinkron untuk window ini. Kemungkinan besar dev token masih Test access — tunggu Basic access atau klik Sync di /data-sources.",
    );
    return;
  }

  // KPI cards
  const cardY = 1.2;
  const cardW = 2.95;
  const cardH = 1.4;
  const gap = 0.15;
  const cardX = (i: number) => 0.5 + i * (cardW + gap);

  drawKpiCard(slide, {
    x: cardX(0),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Total Spend",
    value: formatRupiah(data.totals.spend),
    sub: deltaText(data.totals.spend, data.previousTotals.spend),
  });
  drawKpiCard(slide, {
    x: cardX(1),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Total Clicks",
    value: numberFmt.format(Math.round(data.totals.clicks)),
    sub: deltaText(data.totals.clicks, data.previousTotals.clicks),
  });
  drawKpiCard(slide, {
    x: cardX(2),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Conversions",
    value: numberFmt.format(Math.round(data.totals.conversions)),
    sub: deltaText(data.totals.conversions, data.previousTotals.conversions),
  });
  const cpl =
    data.totals.conversions > 0
      ? data.totals.spend / data.totals.conversions
      : 0;
  drawKpiCard(slide, {
    x: cardX(3),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "CPL",
    value: cpl > 0 ? formatRupiah(cpl) : "—",
  });

  // Top campaigns table
  const adCampaigns = data.campaigns
    .filter((c) => c.source === "google_ads")
    .slice(0, 8);

  if (adCampaigns.length > 0) {
    slide.addText("Top Campaigns", {
      x: 0.5,
      y: 2.9,
      w: 12.3,
      h: 0.4,
      fontFace: FONT_FACE,
      fontSize: 14,
      bold: true,
      color: COLORS.text,
    });

    const headerRow = [
      {
        text: "Campaign",
        options: {
          bold: true,
          fill: { color: COLORS.bgDark },
          color: "FFFFFF",
        },
      },
      {
        text: "Spend",
        options: {
          bold: true,
          fill: { color: COLORS.bgDark },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
      {
        text: "Clicks",
        options: {
          bold: true,
          fill: { color: COLORS.bgDark },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
      {
        text: "Conversions",
        options: {
          bold: true,
          fill: { color: COLORS.bgDark },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
      {
        text: "CPL",
        options: {
          bold: true,
          fill: { color: COLORS.bgDark },
          color: "FFFFFF",
          align: "right" as const,
        },
      },
    ];
    const rows = adCampaigns.map((c) => {
      const campaignCpl = c.conversions > 0 ? c.spend / c.conversions : 0;
      return [
        { text: c.campaignName ?? c.campaignId ?? "(rollup)", options: {} },
        { text: formatRupiah(c.spend), options: { align: "right" as const } },
        {
          text: numberFmt.format(Math.round(c.clicks)),
          options: { align: "right" as const },
        },
        {
          text: numberFmt.format(Math.round(c.conversions)),
          options: { align: "right" as const },
        },
        {
          text: campaignCpl > 0 ? formatRupiah(campaignCpl) : "—",
          options: { align: "right" as const },
        },
      ];
    });

    slide.addTable([headerRow, ...rows], {
      x: 0.5,
      y: 3.4,
      w: 12.3,
      colW: [5, 1.85, 1.85, 1.85, 1.75],
      fontFace: FONT_FACE,
      fontSize: 11,
      border: { type: "solid", color: COLORS.border, pt: 0.5 },
    });
  }
}

// ─── Slide 5: Organic & SEO (Search Console) ────────────────────────────
function addOrganicSlide(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  slide.addText("Organic & SEO Performance", {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: COLORS.text,
  });

  const scConnected = data.connectedSources.includes("search_console");
  if (!scConnected) {
    drawPlaceholder(
      slide,
      "Search Console belum terhubung. Connect di /data-sources untuk auto-fill organic clicks, impressions, CTR, dan posisi rata-rata.",
    );
    return;
  }

  const t = data.totals;
  const p = data.previousTotals;

  const ctr = t.organicImpressions > 0 ? t.organicClicks / t.organicImpressions : 0;
  const prevCtr =
    p.organicImpressions > 0 ? p.organicClicks / p.organicImpressions : 0;
  const avgPos =
    t.organicImpressions > 0
      ? t.organicPositionWeightedSum / t.organicImpressions
      : 0;
  const prevAvgPos =
    p.organicImpressions > 0
      ? p.organicPositionWeightedSum / p.organicImpressions
      : 0;

  // 4 KPI cards across the top
  const cardY = 1.2;
  const cardH = 1.4;
  const cardW = 2.95;
  const gap = 0.15;
  const cardX = (i: number) => 0.5 + i * (cardW + gap);

  drawKpiCard(slide, {
    x: cardX(0),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Organic Clicks",
    value: numberFmt.format(Math.round(t.organicClicks)),
    sub: deltaText(t.organicClicks, p.organicClicks),
  });
  drawKpiCard(slide, {
    x: cardX(1),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Organic Impressions",
    value: numberFmt.format(Math.round(t.organicImpressions)),
    sub: deltaText(t.organicImpressions, p.organicImpressions),
  });
  drawKpiCard(slide, {
    x: cardX(2),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Average CTR",
    value: ctr > 0 ? `${(ctr * 100).toFixed(2)}%` : "—",
    sub:
      ctr > 0 && prevCtr > 0
        ? deltaText(ctr * 100, prevCtr * 100)
        : undefined,
  });
  drawKpiCard(slide, {
    x: cardX(3),
    y: cardY,
    w: cardW,
    h: cardH,
    label: "Average Position",
    // For position, lower is better — show raw value with 1 decimal.
    value: avgPos > 0 ? avgPos.toFixed(1) : "—",
    sub:
      avgPos > 0 && prevAvgPos > 0
        ? `${prevAvgPos.toFixed(1)} sebelumnya`
        : undefined,
  });

  // Two trend charts side-by-side
  const periodLabel = data.period === "weekly" ? "6 Minggu" : "6 Bulan";

  if (data.trend.length > 0) {
    addTrendChart(pres, slide, {
      x: 0.5,
      y: 2.85,
      w: 6.1,
      h: 4.3,
      title: `Organic Clicks (${periodLabel})`,
      data: data.trend,
      metric: "organicClicks",
      color: COLORS.accent,
    });
    addTrendChart(pres, slide, {
      x: 6.7,
      y: 2.85,
      w: 6.1,
      h: 4.3,
      title: `Organic Impressions (${periodLabel})`,
      data: data.trend,
      metric: "organicImpressions",
      color: COLORS.primary,
    });
  }
}

// ─── Slide 6: Key Wins / Areas of Improvement (manual) ──────────────────
function addNarrativeSlide(
  pres: PptxGenJS,
  args: {
    title: string;
    columnA: { title: string; placeholders: string[] };
    columnB: { title: string; placeholders: string[] };
  },
): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  slide.addText(args.title, {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: COLORS.text,
  });

  const columnY = 1.2;
  const columnH = 5.7;

  // Column A
  slide.addText(args.columnA.title, {
    x: 0.5,
    y: columnY,
    w: 6,
    h: 0.5,
    fontFace: FONT_FACE,
    fontSize: 16,
    bold: true,
    color: COLORS.accent,
  });
  slide.addText(
    args.columnA.placeholders.map((t) => ({
      text: t,
      options: { bullet: true },
    })),
    {
      x: 0.5,
      y: columnY + 0.6,
      w: 6,
      h: columnH - 0.6,
      fontFace: FONT_FACE,
      fontSize: 12,
      color: COLORS.text,
      paraSpaceAfter: 6,
    },
  );

  // Column B
  slide.addText(args.columnB.title, {
    x: 6.7,
    y: columnY,
    w: 6,
    h: 0.5,
    fontFace: FONT_FACE,
    fontSize: 16,
    bold: true,
    color: COLORS.warning,
  });
  slide.addText(
    args.columnB.placeholders.map((t) => ({
      text: t,
      options: { bullet: true },
    })),
    {
      x: 6.7,
      y: columnY + 0.6,
      w: 6,
      h: columnH - 0.6,
      fontFace: FONT_FACE,
      fontSize: 12,
      color: COLORS.text,
      paraSpaceAfter: 6,
    },
  );
}

// ─── Slide 7: Action Items (manual) ─────────────────────────────────────
function addActionItemsSlide(pres: PptxGenJS, data: ReportData): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgLight };

  const titleSuffix =
    data.period === "weekly"
      ? `Next Week Plan${data.weekNumber ? ` — Week ${data.weekNumber + 1}` : ""}`
      : "Next Month Plan";

  slide.addText(`Action Items & ${titleSuffix}`, {
    x: 0.5,
    y: 0.3,
    w: 12.3,
    h: 0.6,
    fontFace: FONT_FACE,
    fontSize: 24,
    bold: true,
    color: COLORS.text,
  });

  const sections: Array<{ title: string; items: string[] }> = [
    {
      title: "Google Ads",
      items: ["Edit di PowerPoint: action item Google Ads minggu ini"],
    },
    {
      title: "SEO & Content",
      items: ["Edit di PowerPoint: action item SEO/content"],
    },
    {
      title: "Channel Lain",
      items: [
        "Edit di PowerPoint: action item channel lain (LinkedIn, Meta, dll)",
      ],
    },
  ];

  let y = 1.1;
  for (const section of sections) {
    slide.addText(section.title, {
      x: 0.5,
      y,
      w: 12.3,
      h: 0.4,
      fontFace: FONT_FACE,
      fontSize: 14,
      bold: true,
      color: COLORS.primary,
    });
    y += 0.45;
    slide.addText(
      section.items.map((t) => ({ text: t, options: { bullet: true } })),
      {
        x: 0.7,
        y,
        w: 12.1,
        h: 1.4,
        fontFace: FONT_FACE,
        fontSize: 12,
        color: COLORS.text,
        paraSpaceAfter: 4,
      },
    );
    y += 1.55;
  }
}

// ─── Slide 8: Closing ───────────────────────────────────────────────────
function addClosingSlide(pres: PptxGenJS): void {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.bgDark };

  slide.addText("Terima kasih", {
    x: 0.5,
    y: 2.5,
    w: 12.3,
    h: 1,
    fontFace: FONT_FACE,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
    align: "center",
  });

  slide.addText("Marketing Analytics Platform", {
    x: 0.5,
    y: 3.7,
    w: 12.3,
    h: 0.5,
    fontFace: FONT_FACE,
    fontSize: 16,
    color: COLORS.primary,
    align: "center",
  });
}

function drawPlaceholder(slide: PptxGenJS.Slide, text: string): void {
  slide.addShape("roundRect", {
    x: 0.5,
    y: 1.4,
    w: 12.3,
    h: 5.5,
    fill: { color: COLORS.cardBg },
    line: { color: COLORS.border, width: 0.75 },
    rectRadius: 0.08,
  });
  slide.addText(text, {
    x: 1.5,
    y: 3.7,
    w: 10.3,
    h: 1,
    fontFace: FONT_FACE,
    fontSize: 14,
    color: COLORS.textMuted,
    align: "center",
    italic: true,
  });
}

// ─── Public entry ───────────────────────────────────────────────────────
export async function buildReportPptx(data: ReportData): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 inches (16:9)
  pres.title = `Marketing Analytics — ${data.windowLabel}`;
  pres.author = "Marketing Analytics Platform";
  pres.company = "Marketing Analytics";

  addCoverSlide(pres, data);
  addExecutiveSummary(pres, data);
  addWebsiteSlide(pres, data);
  addAdsSlide(pres, data);
  addOrganicSlide(pres, data);
  addNarrativeSlide(pres, {
    title: "Key Wins & Areas of Improvement",
    columnA: {
      title: "Key Wins",
      placeholders: [
        "Edit di PowerPoint: highlight pencapaian utama window ini",
        "Cite angka spesifik (mis. 'CPL turun 23% ke IDR 126K')",
        "Maksimal 5–7 bullet untuk readability",
      ],
    },
    columnB: {
      title: "Areas of Improvement",
      placeholders: [
        "Edit di PowerPoint: area yang butuh perhatian",
        "Sebutkan metric + magnitude (mis. 'organic impressions turun 31%')",
        "Optional: hipotesis penyebab + planned action",
      ],
    },
  });
  addActionItemsSlide(pres, data);
  addClosingSlide(pres);

  // pptxgenjs returns a Promise<Buffer | Blob | Uint8Array> depending on
  // outputType. "nodebuffer" gives us a Node Buffer for the API route.
  const out = await pres.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
