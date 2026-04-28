"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  Microscope,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { InsightDrilldown } from "@/lib/db/schema";
import { generateDrilldownAction } from "@/app/(dashboard)/insights/drilldown-actions";

type Props = {
  insightId: string;
  observationIndex: number;
  initial: InsightDrilldown | null;
};

// Inline button on each observation that opens a dialog with the
// drill-down result. State machine:
//   - no drilldown yet     → show empty CTA + Generate button
//   - drilldown cached     → show the cached content + "Re-run" button
//   - generating           → spinner placeholder
//
// Drill-down generation is the same paid GPT-5 call as a regular
// insight, so we cache aggressively (one row per insight × observation
// in DB) and re-run is explicit.
export function DrilldownButton({
  insightId,
  observationIndex,
  initial,
}: Props) {
  const [drilldown, setDrilldown] = useState<InsightDrilldown | null>(initial);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateDrilldownAction({
        insightId,
        observationIndex,
      });
      if ("error" in result) {
        toast.error(`Drill-down gagal: ${result.error}`);
        return;
      }
      setDrilldown(result.drilldown);
      toast.success("Analisis mendalam selesai.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-7 gap-1 px-2 text-xs",
        )}
      >
        <Microscope className="size-3.5" />
        Investigate
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Microscope className="size-4 text-primary" />
            Drill-down analysis
          </DialogTitle>
          <DialogDescription>
            Focused GPT-5 pass yang dig deeper ke observation ini — cite
            evidence, ranking root cause, kasih fix konkret.
          </DialogDescription>
        </DialogHeader>

        {!drilldown ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Microscope className="text-muted-foreground/40 size-10" />
            <p className="text-muted-foreground text-center text-sm">
              Belum ada drill-down. Klik untuk run analysis (~10–30 detik,
              consumes 1 GPT-5 call).
            </p>
            <Button onClick={handleGenerate} disabled={isPending}>
              <Microscope
                className={cn("size-4", isPending && "animate-pulse")}
              />
              {isPending ? "Investigating..." : "Generate drill-down"}
            </Button>
          </div>
        ) : (
          <DrilldownContent
            drilldown={drilldown}
            onRerun={handleGenerate}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DrilldownContent({
  drilldown,
  onRerun,
  isPending,
}: {
  drilldown: InsightDrilldown;
  onRerun: () => void;
  isPending: boolean;
}) {
  const c = drilldown.content;
  const generatedAt = new Date(drilldown.createdAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <p className="text-foreground/90 text-sm leading-relaxed">{c.summary}</p>

      {/* Evidence */}
      <Section title="Evidence" icon={ListChecks}>
        <ul className="space-y-1.5">
          {c.evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  e.type === "absence"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : e.type === "pattern"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {e.type === "absence"
                  ? "Absent"
                  : e.type === "pattern"
                    ? "Pattern"
                    : "Data"}
              </span>
              <span className="leading-snug">{e.description}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Hypotheses */}
      <Section title="Root cause hypotheses" icon={AlertCircle}>
        <ol className="space-y-2">
          {c.hypotheses.map((h, i) => (
            <li
              key={i}
              className="border-border/60 rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    h.likelihood === "high"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : h.likelihood === "medium"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {h.likelihood}
                </span>
                <span className="min-w-0 flex-1">{h.title}</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {h.reasoning}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Fixes */}
      <Section title="Fix steps" icon={CheckCircle2}>
        <ol className="space-y-2">
          {c.fixes.map((f, i) => (
            <li
              key={i}
              className="border-border/60 rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="mb-1 font-semibold">{f.title}</div>
              {f.where ? (
                <div className="text-muted-foreground mb-2 text-[11px]">
                  📍 {f.where}
                </div>
              ) : null}
              <ul className="space-y-1">
                {f.steps.map((step, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-1.5 text-xs leading-relaxed"
                  >
                    <ChevronRight className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-muted-foreground text-[11px]">
          Generated {generatedAt} · {drilldown.modelUsed}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRerun}
          disabled={isPending}
        >
          {isPending ? "Re-running..." : "Re-run drill-down"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof X;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}
