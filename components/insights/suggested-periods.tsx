"use client";

import { useTransition } from "react";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InterestingPeriod } from "@/lib/period-detection";
import { generateInsightAction } from "@/app/(dashboard)/insights/actions";

// Renders 3-5 server-detected anomaly periods with one-click generate
// for each. Hidden when the detector found nothing notable in the
// 90-day lookback (most data is calm; suggestions only surface for
// real spikes/dips ≥ 2σ).

type Props = {
  suggestions: InterestingPeriod[];
};

export function SuggestedPeriods({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Periode menarik untuk dianalisis
        </CardTitle>
        <CardDescription>
          AI mendeteksi {suggestions.length}{" "}
          {suggestions.length === 1 ? "anomali" : "anomali"} ≥ 2σ pada 90 hari
          terakhir. Klik untuk generate insight khusus periode tersebut —
          quota sama seperti generate biasa.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {suggestions.map((s, i) => (
          <SuggestionRow key={i} suggestion={s} />
        ))}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({ suggestion }: { suggestion: InterestingPeriod }) {
  const [isPending, startTransition] = useTransition();

  const Icon = suggestion.kind === "spike" ? TrendingUp : TrendingDown;
  const tone =
    suggestion.kind === "spike"
      ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
      : "text-rose-600 bg-rose-100 dark:bg-rose-950 dark:text-rose-300";

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInsightAction({
        period: "weekly",
        anchorDate: suggestion.start,
      });
      if ("error" in result) {
        toast.error(`Generate gagal: ${result.error}`);
        return;
      }
      toast.success(
        "Insight untuk periode anomali tersimpan. Refresh untuk lihat hasilnya.",
      );
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          tone,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">
          {suggestion.label}
        </div>
        <div className="text-muted-foreground text-xs">
          Magnitude {suggestion.magnitude.toFixed(1)}σ · window:{" "}
          {suggestion.start === suggestion.end
            ? suggestion.start
            : `${suggestion.start} → ${suggestion.end}`}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        disabled={isPending}
        className="shrink-0"
      >
        <Sparkles className="size-3.5" />
        {isPending ? "Generating..." : "Generate"}
      </Button>
    </div>
  );
}
