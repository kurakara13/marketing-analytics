"use client";

import { createContext, useContext } from "react";

// Lightweight context so deeply nested form components (e.g. the
// image-upload field) can reach editor-scoped values like templateId
// without a chain of props through every widget config form.
type EditorContextValue = {
  templateId: string;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  templateId,
  children,
}: {
  templateId: string;
  children: React.ReactNode;
}) {
  return (
    <EditorContext.Provider value={{ templateId }}>
      {children}
    </EditorContext.Provider>
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
