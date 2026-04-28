"use client";

import { createContext, useContext, useMemo } from "react";

import type { Insight } from "@/lib/db/schema";
import type { ReportData } from "@/lib/reports/fetch-report-data";

// Lightweight context so deeply nested form components (e.g. the
// image-upload field) and canvas previews (kpi cards, charts) can
// reach editor-scoped values without a chain of props.
type EditorContextValue = {
  templateId: string;
  /** ReportData fetched once at editor mount for the canvas preview
   *  to render real values. Null when the fetch failed or the user
   *  has no connections yet — previews fall back to their placeholder
   *  rendering. */
  reportData: ReportData | null;
  /** Most recent cached AI insight for the report's current window.
   *  ai_narrative widgets read from this for the canvas preview;
   *  null = no insight yet, preview shows a "generate to populate"
   *  placeholder instead. PPT export always has fresh data — this
   *  is purely for the editor canvas. */
  latestInsight: Insight | null;
  /** Replace the cached insight (e.g. after a manual regenerate). The
   *  ai_narrative preview re-renders with the new content immediately. */
  setLatestInsight: (insight: Insight) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  templateId,
  reportData,
  latestInsight,
  setLatestInsight,
  children,
}: {
  templateId: string;
  reportData: ReportData | null;
  latestInsight: Insight | null;
  setLatestInsight: (insight: Insight) => void;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ templateId, reportData, latestInsight, setLatestInsight }),
    [templateId, reportData, latestInsight, setLatestInsight],
  );
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error(
      "useEditorContext must be used inside <EditorProvider>",
    );
  }
  return ctx;
}
