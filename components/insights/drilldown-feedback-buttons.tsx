"use client";

import { useOptimistic, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type {
  DrilldownFeedbackKind,
  FeedbackRating,
} from "@/lib/feedback-keys";
import { setDrilldownFeedbackAction } from "@/app/(dashboard)/insights/feedback-actions";

type Props = {
  drilldownId: string;
  kind: DrilldownFeedbackKind;
  itemIndex: number;
  initialRating: FeedbackRating;
};

// Same UX as observation feedback (`feedback-buttons.tsx`) but wired
// to the drilldown feedback table. Kept as a separate component so
// the two pieces of state-keyed UI don't accidentally share their
// rating maps.
export function DrilldownFeedbackButtons({
  drilldownId,
  kind,
  itemIndex,
  initialRating,
}: Props) {
  const [optimistic, setOptimistic] = useOptimistic(initialRating);
  const [, startTransition] = useTransition();

  function handle(target: 1 | -1) {
    const next: FeedbackRating = optimistic === target ? 0 : target;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setDrilldownFeedbackAction({
        drilldownId,
        kind,
        itemIndex,
        rating: next,
      });
      if ("error" in result) {
        toast.error(`Gagal simpan feedback: ${result.error}`);
        setOptimistic(initialRating);
      }
    });
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => handle(1)}
        aria-label="Berguna"
        title="Berguna"
        className={cn(
          "rounded-md p-0.5 transition-colors",
          optimistic === 1
            ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
            : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => handle(-1)}
        aria-label="Tidak relevan"
        title="Tidak relevan"
        className={cn(
          "rounded-md p-0.5 transition-colors",
          optimistic === -1
            ? "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
            : "text-muted-foreground/50 hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  );
}
