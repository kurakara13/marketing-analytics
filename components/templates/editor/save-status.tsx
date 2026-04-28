"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
// Each state slides + fades in as a separate motion element so the
// transition between states feels like a status change, not a flash.
export function SaveStatus({ state, lastSavedAt }: Props) {
  // Re-render every 30s so "Saved 2 menit lalu" stays accurate without
  // depending on other state changes.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state !== "clean" || !lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [state, lastSavedAt]);

  return (
    <div className="relative flex h-6 min-w-[8rem] items-center justify-end overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {state === "saving" ? (
          <StatusPill key="saving" tone="muted">
            <Loader2 className="size-3 animate-spin" />
            Menyimpan…
          </StatusPill>
        ) : state === "dirty" ? (
          <StatusPill key="dirty" tone="muted">
            <CircleDashed className="size-3" />
            Ada perubahan
          </StatusPill>
        ) : (
          <StatusPill key="clean" tone="success">
            <Check className="size-3" />
            <span suppressHydrationWarning>
              Tersimpan
              {lastSavedAt ? (
                <span className="text-muted-foreground/80 ml-1">
                  ·{" "}
                  {formatDistanceToNow(lastSavedAt, {
                    addSuffix: true,
                    locale: idLocale,
                  })}
                </span>
              ) : null}
            </span>
          </StatusPill>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "success";
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs",
        tone === "success"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground",
      )}
    >
      {children}
    </motion.span>
  );
}
