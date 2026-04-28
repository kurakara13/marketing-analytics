import type { ReportData } from "@/lib/reports/fetch-report-data";

// Heuristic data-quality / attribution flags computed from existing
// ReportData shape — no extra API calls. The AI insight engine
// surfaces these as a dedicated "Data quality" section so the user
// (or their analyst) can investigate before trusting other numbers.
//
// All thresholds are conservative — false positives are noise but a
// missed flag is worse (the user shipped the report with bad data).

export type AttributionFlag = {
  /** Stable id so the prompt can reference it without ambiguity. */
  id: string;
  /** Short human label — surfaces in the prompt section header. */
  label: string;
  /** One-paragraph description with concrete numbers from the data. */
  description: string;
  /** info = nice-to-know, warning = check this, alert = trust at risk. */
  severity: "info" | "warning" | "alert";
};

// Tracking / debug URL params that should never appear on top pages
// in production traffic. When they do, GA4 is filtering wrong (no
// "unwanted query parameters" rule) or someone left a debug session
// running against prod.
const SUSPICIOUS_URL_PARAMS = [
  "gtm_debug=",
  "gclid=",
  "fbclid=",
  "msclkid=",
  // hsa_* = HubSpot Ads — legitimate when HubSpot is the ad platform,
  // but ALSO suggests attribution leakage when Google Ads is the only
  // connected ad source.
  "hsa_",
  // utm_* on landing pages = traffic with manual tagging — usually OK
  // but heavy presence suggests source leak. Don't flag by itself.
];

const DEBUG_ONLY_PARAMS = ["gtm_debug=", "gtm_preview="];

export function detectAttributionFlags(
  reportData: ReportData,
): AttributionFlag[] {
  const flags: AttributionFlag[] = [];

  // ─── Flag 1: GA4 vs Google Ads conversions mismatch ─────────────
  // GA4 totals are channel-agnostic; Google Ads campaign rows only
  // count conversions attributed to those campaigns. They never match
  // exactly (GA4 includes organic/direct etc), but if Ads >> GA4 or
  // GA4 == 0 while Ads > 0, something's misconfigured.
  const adsCampaigns = reportData.campaigns.filter(
    (c) => c.source === "google_ads",
  );
  const adsTotalConversions = adsCampaigns.reduce(
    (sum, c) => sum + c.conversions,
    0,
  );
  const ga4Conversions = reportData.totals.conversions;

  if (
    reportData.connectedSources.includes("ga4") &&
    reportData.connectedSources.includes("google_ads") &&
    adsTotalConversions > 0 &&
    ga4Conversions > 0
  ) {
    // Ads typically a subset of GA4 total. If Ads conv > GA4 total,
    // GA4 is missing conversion events (gtag misfire, consent block).
    if (adsTotalConversions > ga4Conversions * 1.2) {
      flags.push({
        id: "ads_exceeds_ga4_conversions",
        label: "Google Ads conversions > GA4 conversions",
        description: `Google Ads attribute ${adsTotalConversions} conversions di window ini, tapi GA4 hanya tercatat ${ga4Conversions}. Karena GA4 = total semua channel dan Google Ads = subset, Ads > GA4 adalah anomali — kemungkinan GA4 conversion events tidak fire (gtag misfire, consent banner block, atau filter property salah).`,
        severity: "alert",
      });
    }
  }

  // Google Ads connected but no Ads conversions tracked while GA4 has
  // them — Ads conversion tag mungkin belum dipasang.
  if (
    reportData.connectedSources.includes("google_ads") &&
    adsCampaigns.length > 0 &&
    adsTotalConversions === 0 &&
    ga4Conversions > 0
  ) {
    flags.push({
      id: "ads_zero_conversions",
      label: "Google Ads tidak attribute satu pun conversion",
      description: `Google Ads punya ${adsCampaigns.length} campaign aktif dengan total spend ${formatRupiah(adsCampaigns.reduce((s, c) => s + c.spend, 0))}, tapi 0 conversions di-attribute. GA4 sendiri tercatat ${ga4Conversions} conversion. Indikasi Google Ads conversion tag belum dipasang atau mapping conversion action salah — semua optimize ad bid jalan tanpa sinyal.`,
      severity: "alert",
    });
  }

  // ─── Flag 2: Debug / tracking params di top pages ────────────────
  // Production GA4 should never have gtm_debug= in top pages. If it
  // does, debug session leaked into reporting. Less severe but still
  // pollutes the ranking.
  const debugPolluted = reportData.topPages.filter((p) =>
    DEBUG_ONLY_PARAMS.some((param) => p.page.includes(param)),
  );
  if (debugPolluted.length > 0) {
    const top = debugPolluted[0];
    flags.push({
      id: "gtm_debug_in_top_pages",
      label: "Debug session leaked ke production reporting",
      description: `${debugPolluted.length} dari ${reportData.topPages.length} top converting pages mengandung parameter \`gtm_debug=\` atau \`gtm_preview=\`. Contoh tertinggi: \`${top.page.slice(0, 120)}\` — ${top.conversions} conv dari ${top.sessions} sessions. Ini debug traffic yang seharusnya tidak masuk ke production property. Tambahkan rule "Unwanted query parameters" di GA4 Admin → Data Streams → property → unwanted params, atau filter di reporting view.`,
      severity: "alert",
    });
  }

  // ─── Flag 3: Suspicious params dominasi top pages ────────────────
  // Top pages punya banyak hsa_*, gclid, fbclid, dll. Bila Anda hanya
  // connect Google Ads (bukan HubSpot/Facebook), kehadiran param itu
  // di top pages = attribution leak: traffic berasal dari source yang
  // belum terdeteksi.
  const suspiciousPages = reportData.topPages.filter((p) =>
    SUSPICIOUS_URL_PARAMS.some((param) => p.page.includes(param)),
  );
  if (
    suspiciousPages.length > 0 &&
    suspiciousPages.length >= reportData.topPages.length * 0.4
  ) {
    const params = collectMatchedParams(suspiciousPages);
    flags.push({
      id: "tracking_params_in_top_pages",
      label: "Top pages didominasi URL dengan parameter tracking",
      description: `${suspiciousPages.length} dari ${reportData.topPages.length} top converting pages mengandung parameter tracking (\`${params.slice(0, 4).join("`, `")}\`). Bila ada parameter dari ad platform yang BELUM di-connect (misal \`hsa_*\` tanpa HubSpot connection, atau \`fbclid\` tanpa Meta Ads), ini mengindikasikan traffic source yang tidak ter-attribute ke campaign. Rekomendasi: tambah parameter ini ke "Unwanted query parameters" GA4 supaya tidak fragmentasi page report, atau hubungkan ad source yang relevan.`,
      severity: "warning",
    });
  }

  // ─── Flag 4: Spend tinggi tanpa conversion sama sekali ───────────
  const wastedSpendCampaigns = adsCampaigns.filter(
    (c) => c.spend > 100_000 && c.conversions === 0,
  );
  if (wastedSpendCampaigns.length > 0) {
    const total = wastedSpendCampaigns.reduce((s, c) => s + c.spend, 0);
    flags.push({
      id: "spend_no_conversion",
      label: "Campaign dengan spend tinggi tanpa conversion",
      description: `${wastedSpendCampaigns.length} Google Ads campaign menghabiskan ${formatRupiah(total)} di window ini tapi 0 conversion di-attribute. Bisa jadi (a) conversion tracking belum dipasang di campaign-nya, (b) campaign baru launch dan butuh waktu, atau (c) genuine waste. Periksa: ${wastedSpendCampaigns
        .slice(0, 3)
        .map((c) => `\`${c.campaignName ?? c.campaignId}\` (${formatRupiah(c.spend)})`)
        .join(", ")}.`,
      severity: "warning",
    });
  }

  return flags;
}

function collectMatchedParams(
  pages: ReportData["topPages"],
): string[] {
  const found = new Set<string>();
  for (const page of pages) {
    for (const param of SUSPICIOUS_URL_PARAMS) {
      if (page.page.includes(param)) found.add(param);
    }
  }
  return Array.from(found);
}

const idFmt = new Intl.NumberFormat("id-ID");
function formatRupiah(n: number): string {
  if (n === 0) return "Rp 0";
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${idFmt.format(Math.round(n))}`;
}
