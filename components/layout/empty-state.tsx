import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Reusable empty-state primitive — replaces ad-hoc <Card> empty
// states scattered across the app. Visual pattern:
//
//   ┌─────────────────────────────────────────────┐
//   │                                             │
//   │            [⊕]   ← icon in tinted circle    │
//   │                                             │
//   │       Title (centered, semibold)            │
//   │       Description text (max 2 lines).       │
//   │                                             │
//   │            [Primary action]                 │
//   │                                             │
//   └─────────────────────────────────────────────┘
//
// More inviting than a regular card with title+description+button —
// the icon-circle gives visual anchor + breathing space + signals
// "this is intentionally empty, not loading".

type Props = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Visual tone — default subtle muted, "primary" for opt-in CTAs. */
  tone?: "muted" | "primary";
  /** Optional helper text below the action — e.g. "or browse existing
   *  reports" link. */
  footer?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "muted",
  footer,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "border-border/60 bg-card flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-10 text-center sm:py-14",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
      {footer ? (
        <div className="text-muted-foreground text-xs">{footer}</div>
      ) : null}
    </div>
  );
}
