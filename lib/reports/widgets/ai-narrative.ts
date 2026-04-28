import {
  aiNarrativeWidgetConfigSchema,
  type AiNarrativeWidgetConfig,
} from "@/lib/reports/templates/types";
import { findLatestInsight, generateInsight } from "@/lib/ai/insights";
import type { Insight } from "@/lib/db/schema";
import { registerWidget, type WidgetDefinition } from "./registry";

const FONT_FACE = "Calibri";
const COLORS = {
  cardBg: "FFFFFF",
  border: "E2E8F0",
  text: "0F172A",
  textMuted: "64748B",
  win: "10B981", // emerald
  concern: "F59E0B", // amber
  anomaly: "EF4444", // red
  recommendation: "3B82F6", // blue
};

type SectionKey = AiNarrativeWidgetConfig["sections"][number];

// Maps the user-facing section names (wins / concerns / anomalies /
// recommendations) onto the underlying insight schema, which only
// stores `observations` (severity-tagged) and `recommendations`.
//
//   wins              ← observations w/ severity = "info"
//   concerns          ← observations w/ severity = "warning"
//   anomalies         ← observations w/ severity = "alert"
//   recommendations   ← recommendations array (priority-tagged)
const SECTION_LABELS: Record<SectionKey, string> = {
  wins: "Key Wins",
  concerns: "Areas to Watch",
  anomalies: "Anomalies",
  recommendations: "Recommended Actions",
};
const SECTION_COLORS: Record<SectionKey, string> = {
  wins: COLORS.win,
  concerns: COLORS.concern,
  anomalies: COLORS.anomaly,
  recommendations: COLORS.recommendation,
};

type Bullet = { title: string; description: string };

function pullSection(insight: Insight, key: SectionKey): Bullet[] {
  if (key === "recommendations") {
    return (insight.recommendations ?? []).map((r) => ({
      title: r.title,
      description: r.description,
    }));
  }
  const severity =
    key === "wins" ? "info" : key === "concerns" ? "warning" : "alert";
  return (insight.observations ?? [])
    .filter((o) => o.severity === severity)
    .map((o) => ({ title: o.title, description: o.description }));
}

const definition: WidgetDefinition<{
  id: string;
  type: "ai_narrative";
  position: { x: number; y: number; w: number; h: number };
  config: AiNarrativeWidgetConfig;
}> = {
  type: "ai_narrative",
  configSchemaVersion: 1,
  defaultPosition: { x: 0.5, y: 1, w: 6, h: 5 },
  defaultConfig: aiNarrativeWidgetConfigSchema.parse({}),
  label: "AI Insight",
  description: "Commentary auto-generate oleh Claude.",

  async render({ slide, widget, context }) {
    const { config, position } = widget;
    const { reportData, userId } = context;

    // Card chrome
    slide.addShape("roundRect", {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      fill: { color: COLORS.cardBg },
      line: { color: COLORS.border, width: 0.75 },
      rectRadius: 0.08,
    });

    if (config.title) {
      slide.addText(config.title, {
        x: position.x + 0.2,
        y: position.y + 0.15,
        w: position.w - 0.4,
        h: 0.35,
        fontFace: FONT_FACE,
        fontSize: 14,
        bold: true,
        color: COLORS.text,
      });
    }

    // Look up cached insight first; fall back to fresh generation.
    let insight: Insight | null = null;
    try {
      insight = await findLatestInsight({
        userId,
        windowStart: reportData.windowStart,
        windowEnd: reportData.windowEnd,
      });
      if (!insight) {
        insight = await generateInsight({ userId, reportData });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      slide.addText(`AI insight gagal di-generate: ${message}`, {
        x: position.x + 0.2,
        y: position.y + (config.title ? 0.6 : 0.25),
        w: position.w - 0.4,
        h: position.h - (config.title ? 0.8 : 0.5),
        fontFace: FONT_FACE,
        fontSize: 11,
        italic: true,
        color: COLORS.textMuted,
      });
      return;
    }

    // Layout: stack section headers + bullet lists vertically.
    const innerX = position.x + 0.25;
    const innerW = position.w - 0.5;
    const startY = position.y + (config.title ? 0.65 : 0.25);
    const availableH = position.h - (config.title ? 0.9 : 0.5);

    // Estimate per-section height proportionally to bullet counts.
    const sections = config.sections.map((key) => ({
      key,
      bullets: pullSection(insight!, key).slice(0, 4),
    }));
    const populated = sections.filter((s) => s.bullets.length > 0);
    if (populated.length === 0) {
      slide.addText("AI tidak menghasilkan section yang dipilih.", {
        x: innerX,
        y: startY + availableH / 2 - 0.2,
        w: innerW,
        h: 0.4,
        fontFace: FONT_FACE,
        fontSize: 11,
        italic: true,
        color: COLORS.textMuted,
        align: "center",
      });
      return;
    }

    // Distribute height per section in proportion to bullet count
    // (with minimum slice). Each section gets a header band + body.
    const totalBullets = populated.reduce(
      (sum, s) => sum + Math.max(1, s.bullets.length),
      0,
    );
    const headerH = 0.3;
    let cursorY = startY;

    for (const section of populated) {
      const bulletCount = Math.max(1, section.bullets.length);
      const bodyH =
        ((availableH - populated.length * headerH) * bulletCount) / totalBullets;
      const sectionH = headerH + bodyH;

      // Section header — bold + colored
      slide.addText(SECTION_LABELS[section.key], {
        x: innerX,
        y: cursorY,
        w: innerW,
        h: headerH,
        fontFace: FONT_FACE,
        fontSize: 11,
        bold: true,
        color: SECTION_COLORS[section.key],
      });

      // Bullets
      if (config.style === "paragraphs") {
        const text = section.bullets
          .map((b) => `${b.title}. ${b.description}`)
          .join("\n\n");
        slide.addText(text, {
          x: innerX,
          y: cursorY + headerH,
          w: innerW,
          h: bodyH,
          fontFace: FONT_FACE,
          fontSize: config.fontSize,
          color: COLORS.text,
          paraSpaceAfter: 4,
        });
      } else {
        const lines = section.bullets.map((b) => ({
          text: b.title ? `${b.title}: ${b.description}` : b.description,
          options: { bullet: true },
        }));
        slide.addText(lines, {
          x: innerX,
          y: cursorY + headerH,
          w: innerW,
          h: bodyH,
          fontFace: FONT_FACE,
          fontSize: config.fontSize,
          color: COLORS.text,
          paraSpaceAfter: 3,
        });
      }

      cursorY += sectionH;
    }
  },
};

registerWidget(definition);
