// Client-safe pure functions + types shared between server-side data
// helpers (insight-feedback.ts, drilldown-feedback.ts) and client-side
// React components (FeedbackButtons, DrilldownButton, etc).
//
// CRITICAL: this file must NOT import any server-only modules (db,
// drizzle, postgres, auth). If a client component pulls a runtime
// symbol from `lib/insight-feedback.ts` or `lib/drilldown-feedback.ts`,
// the entire module — including the `db` import — ends up in the
// client bundle, which Turbopack can't compile (Node built-ins like
// `fs` / `net` aren't available in the browser).
//
// The right import for a client component is:
//   import { feedbackKey } from "@/lib/feedback-keys";
//   import type { InsightFeedbackMap } from "@/lib/feedback-keys";
//
// Server modules can still import this file freely.

// ─── Insight observation/recommendation feedback ────────────────────
export type FeedbackKind = "observation" | "recommendation";
export type FeedbackRating = -1 | 0 | 1;
export type InsightFeedbackMap = Map<string, FeedbackRating>;

export function feedbackKey(args: {
  kind: FeedbackKind;
  itemIndex: number;
}): string {
  return `${args.kind}:${args.itemIndex}`;
}

// ─── Drilldown hypothesis/fix feedback ──────────────────────────────
export type DrilldownFeedbackKind = "hypothesis" | "fix";
export type DrilldownFeedbackMap = Map<string, FeedbackRating>;

export function drilldownFeedbackKey(args: {
  kind: DrilldownFeedbackKind;
  itemIndex: number;
}): string {
  return `${args.kind}:${args.itemIndex}`;
}
