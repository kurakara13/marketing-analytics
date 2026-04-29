import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Standard page header used at the top of every dashboard route.
// Goal: consistent visual rhythm — every page opens with the same
// pattern (icon, title, subtitle, optional eyebrow, optional actions
// on the right). Replaces the inconsistent ad-hoc h1 + p + flex
// layouts that were drifting per-page.
//
// Layout:
//
//   [icon] [eyebrow]
//          Title
//          Subtitle text. Two lines max.            [actions]
//
// `eyebrow` is the small uppercase label above the title (e.g.
// "Settings", "Reports") — useful for routes whose title is the
// dynamic value (insight title, template name).

type Props = {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra slot below the subtitle for status banners (quota, sync
   *  health, etc) rendered inside the header block instead of as
   *  separate stacked cards. Optional. */
  meta?: React.ReactNode;
};

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
}: Props) {
  return (
    <header className="flex flex-col gap-1.5 pb-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div
            className={cn(
              "bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            )}
          >
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex flex-col gap-0.5">
          {eyebrow ? (
            <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.08em]">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-foreground text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              {subtitle}
            </p>
          ) : null}
          {meta ? <div className="mt-1">{meta}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
