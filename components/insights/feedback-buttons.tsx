"use client";

import { useOptimistic, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { setInsightFeedbackAction } from "@/app/(dashboard)/insights/feedback-actions";
import type {
  FeedbackKind,
  FeedbackRating,
} from "@/lib/insight-feedback";

type Props = {
  insightId: string;
  kind: FeedbackKind;
  itemIndex: number;
  initialRating: FeedbackRating;
};

// Inline thumbs-up / thumbs-down pair shown next to each observation
// and recommendation. Click the active button to clear the rating
// (toggle off); click the opposite button to flip. Optimistic updates
// keep the UI snappy; on server error we revert and toast.
export function FeedbackButtons({
  insightId,
  kind,
  itemIndex,
  initialRating,
}: Props) {
  const [optimisticRating, setOptimisticRating] = useOptimistic(initialRating);
  const [, startTransition] = useTransition();

  function handle(target: 1 | -1) {
    const next: FeedbackRating = optimisticRating === target ? 0 : target;
    startTransition(async () => {
      setOptimisticRating(next);
      const result = await setInsightFeedbackAction({
        insightId,
        kind,
        itemIndex,
        rating: next,
      });
      if ("error" in result) {
        toast.error(`Gagal simpan feedback: ${result.error}`);
        setOptimisticRating(initialRating);
      }
    });
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={() => handle(1)}
        aria-label="Berguna (thumbs up)"
        title="Insight ini berguna"
        className={cn(
          "rounded-md p-1 transition-colors",
          optimisticRating === 1
            ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handle(-1)}
        aria-label="Tidak berguna (thumbs down)"
        title="Insight ini tidak relevan / generic"
        className={cn(
          "rounded-md p-1 transition-colors",
          optimisticRating === -1
            ? "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  );
}
