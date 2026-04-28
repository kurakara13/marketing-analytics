"use client";

import { createContext, useContext, useMemo } from "react";

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
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  templateId,
  reportData,
  children,
}: {
  templateId: string;
  reportData: ReportData | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ templateId, reportData }),
    [templateId, reportData],
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
