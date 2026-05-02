"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

// Visual ⌘K command-palette trigger. Currently a non-functional
// placeholder rendered to look like a search input — it sets the
// affordance for future global search without committing the
// implementation. Click does nothing yet (no toast either; just
// silent until we wire it).
//
// On macOS we render ⌘ + K, on Windows/Linux it would be Ctrl + K.
// Detection runs only on the client (window guard).

import { useEffect, useState } from "react";

export function HeaderCommandTrigger() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  return (
    <button
      type="button"
      aria-label="Buka command palette (segera hadir)"
      className={cn(
        "group hidden items-center gap-2.5 rounded-md border border-border/80 bg-background/60 px-3 py-1.5 text-[12.5px] transition-colors md:inline-flex",
        "hover:border-border hover:bg-background",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "min-w-[260px]",
      )}
    >
      <Search className="text-muted-foreground/70 size-3.5 shrink-0" />
      <span className="text-muted-foreground/70 flex-1 text-left">
        Cari insight, report, koneksi…
      </span>
      <kbd
        className="text-muted-foreground/60 bg-muted/70 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-sans text-[10px] font-medium tracking-wider"
        aria-hidden
      >
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
