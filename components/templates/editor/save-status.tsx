"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { cn } from "@/lib/utils";

export type SaveState = "clean" | "dirty" | "saving";

type Props = {
  state: SaveState;
  lastSavedAt: Date | null;
};

// Subtle status indicator — sits next to the report name in the toolbar.
// No alarming "unsaved changes" wording; the editor auto-saves so users
// shouldn't have to think about this. We just surface what's happening
// for transparency.
export function SaveStatus({ state, lastSavedAt }: Props) {
  // Re-render every 30s so "Saved 2 minutes ago" stays accurate without
  // depending on other state changes.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state !== "clean" || !lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [state, lastSavedAt]);

  if (state === "saving") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Menyimpan…
      </span>
    );
  }

  if (state === "dirty") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <CircleDashed className="size-3" />
        Ada perubahan
      </span>
    );
  }

  // clean
  return (
    <span
      className={cn(
        "text-emerald-600 dark:text-emerald-400",
        "inline-flex items-center gap-1.5 text-xs",
      )}
      suppressHydrationWarning
    >
      <Check className="size-3" />
      Tersimpan
      {lastSavedAt ? (
        <span className="text-muted-foreground">
          ·{" "}
          {formatDistanceToNow(lastSavedAt, {
            addSuffix: true,
            locale: idLocale,
          })}
        </span>
      ) : null}
    </span>
  );
}
