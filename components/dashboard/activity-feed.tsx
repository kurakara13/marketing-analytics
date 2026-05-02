import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Microscope,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/lib/dashboard-feed";

import { SectionEyebrow } from "./urgent-observations";

// Vertical timeline of recent workspace activity. Two-tone — title +
// muted meta — with a small icon indicating event kind. Subtle
// hairline connecting dots between rows for "timeline" feel without
// being heavy. Click on insight/drilldown rows navigates; sync rows
// are passive (just informational).

type Props = {
  events: ActivityEvent[];
};

export function ActivityFeed({ events }: Props) {
  if (events.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionEyebrow>Aktivitas workspace</SectionEyebrow>
        <p className="text-muted-foreground text-[12.5px] italic">
          Belum ada aktivitas. Coba generate insight pertama atau sync
          data source.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionEyebrow>Aktivitas workspace</SectionEyebrow>
      <ol className="relative flex flex-col">
        {/* Continuous hairline as the timeline spine. Sits behind
         *  the icon dots which break it into ticks. */}
        <span
          aria-hidden
          className="bg-border/60 absolute left-[15px] top-3 bottom-3 w-px"
        />
        {events.map((event, i) => (
          <ActivityRow key={`${event.kind}-${event.id}-${i}`} event={event} />
        ))}
      </ol>
    </section>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const ago = formatDistanceToNow(event.occurredAt, {
    addSuffix: true,
    locale: idLocale,
  });

  return (
    <li className="relative flex items-start gap-3 py-2 pl-0">
      <span
        className={cn(
          "bg-card border-border/60 relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full border",
        )}
      >
        <ActivityIcon event={event} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-foreground line-clamp-1 text-[13px] font-medium leading-snug">
          {event.title}
        </p>
        <p className="text-muted-foreground/80 text-[11.5px] leading-snug">
          {event.meta} · {ago}
        </p>
      </div>
    </li>
  );
}

function ActivityIcon({ event }: { event: ActivityEvent }) {
  if (event.kind === "insight") {
    return <Sparkles className="text-primary size-3.5" />;
  }
  if (event.kind === "drilldown") {
    return <Microscope className="text-primary size-3.5" />;
  }
  // sync
  if (event.status === "success") {
    return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  }
  if (event.status === "error") {
    return <AlertCircle className="size-3.5 text-rose-600" />;
  }
  if (event.status === "running") {
    return <Loader2 className="size-3.5 animate-spin text-sky-600" />;
  }
  return <RotateCw className="text-muted-foreground/50 size-3.5" />;
}
