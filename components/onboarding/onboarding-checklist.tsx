import Link from "next/link";
import { Check, ChevronRight, Circle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  /** Stable id for the step — used as key. */
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  /** When set and the step is undone, render this CTA instead of the
   *  default "Buka". */
  ctaLabel?: string;
};

type Props = {
  steps: OnboardingStep[];
  /** Compact = top-banner version (small, dismissable feel).
   *  Full = full-page hero used as the empty state for first-time
   *  users without any connections. */
  variant?: "full" | "compact";
};

export function OnboardingChecklist({ steps, variant = "full" }: Props) {
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;

  if (variant === "compact" && allDone) return null;

  if (variant === "compact") {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Setup progress: {doneCount} dari {total} selesai
              </CardTitle>
              <CardDescription>
                Selesaikan setup untuk dapetin nilai penuh dari platform.
              </CardDescription>
            </div>
            <ProgressDots done={doneCount} total={total} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="grid gap-1 sm:grid-cols-2">
            {steps.map((step) => (
              <CompactStepRow key={step.id} step={step} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  // ─── Full hero variant ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Selamat datang di Marketing Analytics
        </h1>
        <p className="text-muted-foreground text-sm">
          Ikuti {total} langkah ini untuk dapetin AI insight bermanfaat dalam
          5–10 menit. {doneCount > 0 ? `Anda sudah selesai ${doneCount}.` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <FullStepRow key={step.id} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Compact variant row ────────────────────────────────────────────
function CompactStepRow({ step }: { step: OnboardingStep }) {
  return (
    <li>
      <Link
        href={step.href}
        className={cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
          step.done ? "text-muted-foreground" : "hover:bg-muted",
        )}
      >
        {step.done ? (
          <Check className="size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            step.done && "line-through decoration-muted-foreground/40",
          )}
        >
          {step.title}
        </span>
        {!step.done ? (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        ) : null}
      </Link>
    </li>
  );
}

// ─── Full variant row — bigger card per step ────────────────────────
function FullStepRow({
  step,
  index,
}: {
  step: OnboardingStep;
  index: number;
}) {
  return (
    <Card
      className={cn(
        "transition-shadow",
        step.done ? "bg-muted/30" : "hover:shadow-md",
      )}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            step.done
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-primary/10 text-primary",
          )}
        >
          {step.done ? <Check className="size-5" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "text-sm font-semibold",
              step.done && "text-muted-foreground line-through decoration-muted-foreground/40",
            )}
          >
            {step.title}
          </div>
          <div className="text-muted-foreground text-xs">
            {step.description}
          </div>
        </div>
        {!step.done ? (
          <Link
            href={step.href}
            className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-xs transition-colors hover:bg-primary/90"
          >
            {step.ctaLabel ?? "Mulai"}
            <ChevronRight className="size-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full",
            i < done ? "bg-emerald-500" : "bg-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}
